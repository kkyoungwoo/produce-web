'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetHistoryItem, BackgroundMusicSceneConfig, BackgroundMusicTrack, CostBreakdown, GeneratedAsset, PreviewMixSettings } from '../types';
import type { GlobalAssetLibraryItem } from '../services/assetLibraryService';
import TimelineWorkbench from './editor/TimelineWorkbench';
import { getAspectRatioClass } from '../utils/aspectRatio';
import { getAspectRatioPreviewClass } from '../config/workflowUi';
import { PRICING } from '../config';
import { handleHorizontalWheel, scrollContainerBy, scrollElementIntoView } from '../utils/horizontalScroll';
import { exportAssetsToZip } from '../services/exportService';
import { downloadProjectZip } from '../utils/csvHelper';
import { downloadSrt } from '../services/srtService';
import { resolveAssetPlaybackDuration } from '../services/projectEnhancementService';
import AiOptionPickerModal from './AiOptionPickerModal';
import HelpTip from './HelpTip';
import SceneStudioPreviewPage from './scene-studio/SceneStudioPreviewPage';
import { blobFromDataValue, extensionFromMime, triggerSequentialDownloads } from '../utils/downloadHelpers';
import { AiPickerOption } from '../services/aiOptionCatalog';
import type { SceneEditorPromptMode } from '../services/sceneEditorPromptService';
import TtsSelectionModal, { TtsSelectionProvider } from './TtsSelectionModal';

type PreviewVideoStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
type SceneEditorMode = SceneEditorPromptMode;
type ScenePreviewMode = 'image' | 'video' | 'audio';
type ModelPickerKind = 'image' | 'video' | 'audio';

interface AudioHistoryEntry {
  id: string;
  data: string;
  createdAt: number;
  label?: string;
  duration?: number | null;
}

type QuickModelOption = AiPickerOption & { label?: string };

interface QuickModelSelector {
  currentId?: string | null;
  currentLabel: string;
  options: QuickModelOption[];
  onSelect?: (id: string) => void;
}

interface AudioTtsSelectionFlow {
  currentProvider: TtsSelectionProvider;
  currentModelId?: string | null;
  currentVoiceId?: string | null;
  googleApiKey?: string | null;
  elevenLabsApiKey?: string | null;
  hasElevenLabsApiKey?: boolean;
  elevenLabsVoices?: Array<{
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: { accent?: string; gender?: string; description?: string };
  }>;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
  voiceReferenceName?: string | null;
  onApply: (selection: { provider: TtsSelectionProvider; modelId?: string | null; voiceId?: string | null }) => void;
}

interface ResultTableProps {
  data: GeneratedAsset[];
  onRegenerateImage?: (index: number) => void;
  onApplySceneSettings?: (index: number) => void | Promise<void>;
  onRegenerateAudio?: (index: number) => void;
  onDeleteAllAudio?: () => void;
  onExportVideo?: (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => void;
  onGenerateAnimation?: (index: number, options?: { sourceImageData?: string | null }) => void | Promise<void>;
  onNarrationChange?: (index: number, narration: string) => void;
  onImagePromptChange?: (index: number, prompt: string) => void;
  onVideoPromptChange?: (index: number, prompt: string) => void;
  onGenerateEditorContent?: (index: number, mode: SceneEditorMode) => void | Promise<void>;
  onSelectedVisualTypeChange?: (index: number, mode: 'image' | 'video') => void;
  onDurationChange?: (index: number, duration: number) => void;
  onAddParagraphScene?: () => void;
  onDeleteParagraphScene?: (index: number) => void;
  onOpenSettings?: () => void;
  onRequestProviderSetup?: (kind: 'text' | 'audio' | 'video') => void;
  isExporting?: boolean;
  animatingIndices?: Set<number>;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  onPreviewMixChange?: (mix: PreviewMixSettings) => void;
  onSelectBackgroundTrack?: (trackId: string) => void;
  activeBackgroundTrackId?: string | null;
  onCreateBackgroundTrack?: () => void;
  onDeleteBackgroundTrack?: (trackId: string) => void;
  onExtendBackgroundTrack?: (trackId: string) => void;
  backgroundMusicSceneConfig?: BackgroundMusicSceneConfig | null;
  onBackgroundMusicSceneChange?: (patch: Partial<BackgroundMusicSceneConfig>) => void;
  onAutoFillBackgroundMusicMood?: () => void;
  isMuteMode?: boolean;
  isNarrationAudioEnabled?: boolean;
  currentTopic?: string;
  totalCost?: CostBreakdown;
  isGenerating?: boolean;
  progressMessage?: string;
  progressPercent?: number | null;
  progressLabel?: string;
  previewRenderEstimatedTotalSeconds?: number | null;
  previewRenderEstimatedRemainingSeconds?: number | null;
  sceneProgressMap?: Record<number, { percent: number; label: string }>;
  finalVideoUrl?: string | null;
  finalVideoTitle?: string;
  finalVideoDuration?: number | null;
  onPreparePreviewVideo?: () => void | Promise<void>;
  isPreparingPreviewVideo?: boolean;
  onGenerateThumbnail?: () => void | Promise<void>;
  isThumbnailGenerating?: boolean;
  onGenerateAllImages?: () => void | Promise<void>;
  onGenerateAllVideos?: () => void | Promise<void>;
  isGeneratingAllVideos?: boolean;
  previewVideoStatus?: PreviewVideoStatus;
  previewVideoMessage?: string;
  onFooterBack?: () => void;
  footerBackLabel?: string;
  thumbnailToolbarRef?: React.RefObject<HTMLDivElement | null>;
  storageDir?: string;
  projectId?: string | null;
  projectNumber?: number | null;
  selectedThumbnailId?: string | null;
  onSceneReorder?: (fromIndex: number, toIndex: number) => void;
  onSplitScene?: (index: number, splitSeconds: number) => void;
  onPinSceneAsThumbnail?: (index: number) => void;
  onReuseGlobalAsset?: (index: number, asset: GlobalAssetLibraryItem) => void;
  onBackgroundTrackTimelineChange?: (trackId: string, patch: { timelineStartSeconds?: number | null; timelineEndSeconds?: number | null }) => void;
  imageModelSelector?: QuickModelSelector;
  videoModelSelector?: QuickModelSelector;
  audioModelSelector?: QuickModelSelector;
  backgroundMusicModelSelector?: QuickModelSelector;
  audioTtsSelectionFlow?: AudioTtsSelectionFlow;
  workspaceTab?: 'scene' | 'timeline';
  onWorkspaceTabChange?: (tab: 'scene' | 'timeline') => void;
}

const formatSeconds = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}초` : '-');
const formatUsdAmount = (value?: number | null) => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const digits = safeValue > 0 && safeValue < 1 ? 3 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeValue);
};
const formatKrwEstimate = (value?: number | null) => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(safeValue * PRICING.USD_TO_KRW).toLocaleString('ko-KR')}원`;
};
const MAX_SCENE_DURATION = 6;
const MIN_SCENE_DURATION = 1;
const DEFAULT_SCENE_NARRATION_VOLUME = 0.5;
const DEFAULT_SCENE_VIDEO_AUDIO_VOLUME = 0.5;
const clampMediaVolume = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.max(0, Math.min(1, value));
};

const getAdjustedAudioDuration = (audioDuration?: number | null, silenceTrim?: number | null) => {
  const baseDuration = typeof audioDuration === 'number' && !Number.isNaN(audioDuration) ? audioDuration : 0;
  if (!baseDuration) return 0;
  const trimRatio = Math.max(0, Math.min(100, silenceTrim ?? 0)) / 100;
  return Math.max(0, baseDuration * (1 - trimRatio));
};

const getSceneCutDuration = (row: GeneratedAsset, silenceTrim?: number | null) => {
  const audioDuration = getAdjustedAudioDuration(row.audioDuration, silenceTrim);
  const preferredDuration = row.targetDuration || audioDuration || row.videoDuration || 0;
  return Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, Number(preferredDuration.toFixed(1))));
};

const resolveImageSrc = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
};

const resolveNarrationAudioSrc = (value?: string | null) => {
  if (!value?.trim()) return '';
  return value.startsWith('data:') ? value : `data:audio/mpeg;base64,${value}`;
};

const resolveBackgroundAudioSrc = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http') || value.startsWith('blob:')) return value;
  return `data:audio/wav;base64,${value}`;
};

const resolveVideoSrc = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) return value;
  return value;
};

const getPreferredVisualType = (row: GeneratedAsset): 'image' | 'video' => {
  if (row.selectedVisualType === 'video' && row.videoData) return 'video';
  if (row.selectedVisualType === 'image' && row.imageData) return 'image';
  if (row.videoData) return 'video';
  return 'image';
};

const hasRenderableImage = (row: GeneratedAsset) => Boolean(resolveImageSrc(row.imageData));
const hasRenderableVideo = (row: GeneratedAsset) => Boolean(resolveVideoSrc(row.videoData));

const getSceneVisualPayload = (row: GeneratedAsset) => {
  const preferred = getPreferredVisualType(row);
  const imageSrc = resolveImageSrc(row.imageData);
  const videoSrc = resolveVideoSrc(row.videoData);

  if (preferred === 'video' && videoSrc) return { kind: 'video' as const, src: videoSrc };
  if (imageSrc) return { kind: 'image' as const, src: imageSrc };
  if (videoSrc) return { kind: 'video' as const, src: videoSrc };
  return { kind: 'image' as const, src: '' };
};

const PREVIEW_IMAGE_MAX_EDGE = 720;
const PREVIEW_IMAGE_QUALITY = 0.58;

async function createLowQualityPreview(src: string): Promise<string> {
  if (!src || typeof window === 'undefined') return src;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(src);
        return;
      }

      const longest = Math.max(width, height);
      const scale = Math.min(1, PREVIEW_IMAGE_MAX_EDGE / longest);
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', PREVIEW_IMAGE_QUALITY));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function collectMediaHistory(row: GeneratedAsset, kind: 'image' | 'video'): AssetHistoryItem[] {
  const currentData = kind === 'image' ? row.imageData : row.videoData;
  const history = (kind === 'image' ? row.imageHistory : row.videoHistory) || [];
  if (!currentData) return history.filter((item) => Boolean(item?.data));

  const latestHistory = history[0];
  if (latestHistory?.data === currentData) {
    return history.filter((item) => Boolean(item?.data));
  }

  return [{
    id: `${kind}_current_${row.sceneNumber}`,
    kind,
    data: currentData,
    sourceMode: (row.sourceMode === 'ai' ? 'ai' : 'sample') as 'ai' | 'sample',
    createdAt: Date.now(),
    label: kind === 'image' ? '현재 이미지' : '현재 동영상',
  }, ...history].filter((item) => Boolean(item?.data));
}


function collectOrderedMediaHistory(row: GeneratedAsset, kind: 'image' | 'video'): AssetHistoryItem[] {
  return collectMediaHistory(row, kind).reverse();
}

async function downloadScenePackage(row: GeneratedAsset) {
  const sceneNo = String(row.sceneNumber).padStart(3, '0');
  const downloads: Array<{ blob: Blob; filename: string }> = [
    { blob: new Blob([row.narration || ''], { type: 'text/plain;charset=utf-8' }), filename: `scene_${sceneNo}_narration.txt` },
    { blob: new Blob([row.imagePrompt || row.visualPrompt || ''], { type: 'text/plain;charset=utf-8' }), filename: `scene_${sceneNo}_image_prompt.txt` },
    { blob: new Blob([row.videoPrompt || ''], { type: 'text/plain;charset=utf-8' }), filename: `scene_${sceneNo}_video_prompt.txt` },
  ];

  const imageBlob = blobFromDataValue(resolveImageSrc(row.imageData), 'image/png');
  if (imageBlob) {
    downloads.push({
      blob: imageBlob,
      filename: `scene_${sceneNo}_image.${extensionFromMime(imageBlob.type || 'image/png', 'png')}`,
    });
  }

  const audioBlob = blobFromDataValue(resolveNarrationAudioSrc(row.audioData), 'audio/mpeg');
  if (audioBlob) {
    downloads.push({
      blob: audioBlob,
      filename: `scene_${sceneNo}_audio.${extensionFromMime(audioBlob.type || 'audio/mpeg', 'mp3')}`,
    });
  }

  if (row.subtitleData?.fullText) {
    downloads.push({
      blob: new Blob([row.subtitleData.fullText], { type: 'text/plain;charset=utf-8' }),
      filename: `scene_${sceneNo}_subtitle.txt`,
    });
  }

  if (row.videoData) {
    if (row.videoData.startsWith('data:')) {
      const videoBlob = blobFromDataValue(row.videoData, 'video/mp4');
      if (videoBlob) {
        downloads.push({
          blob: videoBlob,
          filename: `scene_${sceneNo}_video.${extensionFromMime(videoBlob.type || 'video/mp4', 'mp4')}`,
        });
      }
    } else {
      downloads.push({
        blob: new Blob([row.videoData], { type: 'text/plain;charset=utf-8' }),
        filename: `scene_${sceneNo}_video_link.txt`,
      });
    }
  }

  await triggerSequentialDownloads(downloads);
}

const ResultTable: React.FC<ResultTableProps> = ({
  data,
  onRegenerateImage,
  onApplySceneSettings,
  onRegenerateAudio,
  onDeleteAllAudio,
  onExportVideo,
  onGenerateAnimation,
  onNarrationChange,
  onImagePromptChange,
  onVideoPromptChange,
  onGenerateEditorContent,
  onSelectedVisualTypeChange,
  onDurationChange,
  onAddParagraphScene,
  onDeleteParagraphScene,
  onOpenSettings,
  onRequestProviderSetup,
  isExporting,
  animatingIndices,
  backgroundMusicTracks = [],
  previewMix,
  onPreviewMixChange,
  onSelectBackgroundTrack,
  activeBackgroundTrackId,
  onCreateBackgroundTrack,
  onDeleteBackgroundTrack,
  onExtendBackgroundTrack,
  backgroundMusicSceneConfig,
  onBackgroundMusicSceneChange,
  onAutoFillBackgroundMusicMood,
  isMuteMode = false,
  isNarrationAudioEnabled = true,
  currentTopic,
  totalCost,
  isGenerating,
  progressMessage,
  progressPercent,
  progressLabel,
  previewRenderEstimatedTotalSeconds,
  previewRenderEstimatedRemainingSeconds,
  sceneProgressMap,
  finalVideoUrl,
  finalVideoTitle,
  finalVideoDuration,
  onPreparePreviewVideo,
  isPreparingPreviewVideo,
  onGenerateThumbnail,
  isThumbnailGenerating,
  onGenerateAllImages,
  onGenerateAllVideos,
  isGeneratingAllVideos,
  previewVideoStatus = 'idle',
  previewVideoMessage = '',
  onFooterBack,
  footerBackLabel,
  thumbnailToolbarRef,
  storageDir,
  projectId,
  projectNumber,
  imageModelSelector,
  videoModelSelector,
  audioModelSelector,
  backgroundMusicModelSelector,
  audioTtsSelectionFlow,
  selectedThumbnailId,
  onSceneReorder,
  onSplitScene,
  onPinSceneAsThumbnail,
  onReuseGlobalAsset,
  onBackgroundTrackTimelineChange,
  workspaceTab,
  onWorkspaceTabChange,
}) => {
  const narrationAudioEnabled = !isMuteMode && isNarrationAudioEnabled;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSelectionMode, setPreviewSelectionMode] = useState<'all' | 'range'>('all');
  const [timelineRangePreview, setTimelineRangePreview] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const downloadQuality: 'preview' | 'final' = 'final';
  const [sequenceSceneIndex, setSequenceSceneIndex] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [sequenceRunId, setSequenceRunId] = useState(0);
  const [mediaLightbox, setMediaLightbox] = useState<{ kind: ScenePreviewMode; src: string; title: string; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ kind: 'image' | 'video'; sceneNumber: number; entries: AssetHistoryItem[]; currentIndex: number; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSequenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSequenceVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewSequenceTimerRef = useRef<number | null>(null);
  const bgmStripRef = useRef<HTMLDivElement | null>(null);
  const sceneStripRef = useRef<HTMLDivElement | null>(null);
  const sceneCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sceneMediaStripRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [previewImageMap, setPreviewImageMap] = useState<Record<string, string>>({});
  const [sceneEditorModes, setSceneEditorModes] = useState<Record<number, SceneEditorMode>>({});
  const [scenePreviewModes, setScenePreviewModes] = useState<Record<number, ScenePreviewMode>>({});
  const [sceneAudioRates, setSceneAudioRates] = useState<Record<number, number>>({});
  const [sceneAudioHistory, setSceneAudioHistory] = useState<Record<number, AudioHistoryEntry[]>>({});
  const [sceneAudioIndices, setSceneAudioIndices] = useState<Record<number, number>>({});
  const [sceneNarrationVolumes, setSceneNarrationVolumes] = useState<Record<number, number>>({});
  const [sceneVideoAudioVolumes, setSceneVideoAudioVolumes] = useState<Record<number, number>>({});
  const [sceneSilenceTrim, setSceneSilenceTrim] = useState<Record<number, number>>({});
  const [sceneMediaIndices, setSceneMediaIndices] = useState<Record<string, number>>({});
  const [sceneMediaShift, setSceneMediaShift] = useState<Record<string, number>>({});
  const [sceneActionLocks, setSceneActionLocks] = useState<Record<string, boolean>>({});
  const [activeModelPicker, setActiveModelPicker] = useState<{ index: number; kind: ModelPickerKind } | null>(null);
  const [backgroundMusicPickerOpen, setBackgroundMusicPickerOpen] = useState(false);
  const [sceneInlineSettingsOpen, setSceneInlineSettingsOpen] = useState<Record<number, boolean>>({});
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'scene' | 'timeline'>(() => workspaceTab || 'scene');
  const sceneWorkspaceScrollTopRef = useRef(0);
  const workspaceTabInitializedRef = useRef(false);
  const sceneActionLocksRef = useRef<Record<string, boolean>>({});
  const previewQueueRef = useRef<Set<string>>(new Set());
  const sceneAudioStripRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sceneAudioElementRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const sceneVideoElementRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const scenePreviewSignatureRefs = useRef<Record<string, string>>({});
  const scenePreviewSignatureInitRef = useRef(false);
  const latestDataRef = useRef(data);
  const sceneAudioAppendSeqRef = useRef<Record<number, number>>({});

  useEffect(() => {
    try {
      window.localStorage.setItem(`mp4creater_workspace_tab:${projectId || 'default'}`, activeWorkspaceTab);
    } catch {}
  }, [activeWorkspaceTab, projectId]);

  useEffect(() => {
    if (!workspaceTab) return;
    setActiveWorkspaceTab(workspaceTab);
  }, [workspaceTab]);

  useEffect(() => {
    const handleStep6NavigationGuard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));
      if (!editable && (event.key === 'Backspace' || event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft'))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleStep6NavigationGuard, true);
    return () => window.removeEventListener('keydown', handleStep6NavigationGuard, true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!workspaceTabInitializedRef.current) {
      workspaceTabInitializedRef.current = true;
      return;
    }
    if (activeWorkspaceTab === 'timeline') {
      sceneWorkspaceScrollTopRef.current = window.scrollY;
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      return;
    }
    const restoreTop = sceneWorkspaceScrollTopRef.current;
    window.requestAnimationFrame(() => window.scrollTo({ top: restoreTop, behavior: 'auto' }));
  }, [activeWorkspaceTab]);

  const handleWorkspaceTabChange = (tab: 'scene' | 'timeline') => {
    setActiveWorkspaceTab(tab);
    onWorkspaceTabChange?.(tab);
  };

  const summary = useMemo(() => {
    const imageCount = data.filter((item) => item.imageData).length;
    const audioCount = narrationAudioEnabled ? data.filter((item) => item.audioData).length : 0;
    const videoCount = data.filter((item) => item.videoData).length;
    return { imageCount, audioCount, videoCount };
  }, [data, narrationAudioEnabled]);

  const totalDuration = useMemo(() => Number(data.reduce((sum, item) => sum + resolveAssetPlaybackDuration(item, { minimum: MIN_SCENE_DURATION, fallbackNarrationEstimate: true, preferTargetDuration: true }), 0).toFixed(2)), [data]);

  const mainBgm = useMemo(() => {
    if (!backgroundMusicTracks.length) return null;
    return backgroundMusicTracks.find((item) => item.id === activeBackgroundTrackId) || backgroundMusicTracks[0];
  }, [backgroundMusicTracks, activeBackgroundTrackId]);
  const selectedBackgroundMusicOption = useMemo(
    () => backgroundMusicModelSelector?.options.find((item) => item.id === (backgroundMusicSceneConfig?.modelId || backgroundMusicModelSelector.currentId || '')) || null,
    [backgroundMusicModelSelector, backgroundMusicSceneConfig?.modelId],
  );
  const backgroundMusicModelLabel = selectedBackgroundMusicOption?.title
    || backgroundMusicModelSelector?.currentLabel
    || backgroundMusicSceneConfig?.modelId
    || '-';
  const backgroundMusicTargetDuration = Math.max(10, Math.round(totalDuration || backgroundMusicSceneConfig?.durationSeconds || 20));
  const previewMixSnapshot = previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
  const canRequestPreviewRerender = Boolean(onPreparePreviewVideo && !isPreparingPreviewVideo);
  const isResultPreviewLocked = Boolean(
    isGenerating
    || isGeneratingAllVideos
    || (animatingIndices?.size ?? 0) > 0
    || Object.keys(sceneActionLocks).length > 0
  );
  const resultPreviewLockMessage = progressMessage || '이미지, 오디오, 영상 생성이 끝난 뒤 결과 미리보기를 열 수 있습니다.';
  const estimatedCostCards = totalCost ? [
    {
      id: 'image',
      label: '이미지',
      countLabel: `${totalCost.imageCount}장`,
      amount: totalCost.images,
      tone: 'text-emerald-600',
      bgTone: 'bg-emerald-50',
    },
    {
      id: 'tts',
      label: 'TTS',
      countLabel: `${totalCost.ttsCharacters.toLocaleString('ko-KR')}자`,
      amount: totalCost.tts,
      tone: 'text-blue-600',
      bgTone: 'bg-blue-50',
    },
    {
      id: 'video',
      label: '영상',
      countLabel: `${totalCost.videoCount}개`,
      amount: totalCost.videos,
      tone: 'text-violet-600',
      bgTone: 'bg-violet-50',
    },
  ] : [];

  const displayedScenes = data;

  const previewSceneEntries = useMemo(() => {
    if (previewSelectionMode === 'range' && timelineRangePreview) {
      const safeStart = Math.max(0, Math.min(timelineRangePreview.startIndex, data.length - 1));
      const safeEnd = Math.max(safeStart, Math.min(timelineRangePreview.endIndex, data.length - 1));
      return data.slice(safeStart, safeEnd + 1).map((row, offset) => ({
        row,
        originalIndex: safeStart + offset,
      }));
    }
    return data.map((row, index) => ({ row, originalIndex: index }));
  }, [data, previewSelectionMode, timelineRangePreview]);

  const previewSceneData = previewSceneEntries.map((entry) => entry.row);
  const sequenceSceneEntry = previewSceneEntries[sequenceSceneIndex] || null;
  const sequenceScene = sequenceSceneEntry?.row || null;
  const sequenceSceneAudioRate = sceneAudioRates[sequenceSceneEntry?.originalIndex ?? sequenceSceneIndex] || 1;
  const sequenceSceneDuration = sequenceScene
    ? resolveAssetPlaybackDuration({
        ...sequenceScene,
        audioDuration: typeof sequenceScene.audioDuration === 'number'
          ? Number((sequenceScene.audioDuration / Math.max(0.1, sequenceSceneAudioRate)).toFixed(2))
          : sequenceScene.audioDuration,
      }, { minimum: MIN_SCENE_DURATION, fallbackNarrationEstimate: true, preferTargetDuration: true })
    : MIN_SCENE_DURATION;

  const stopSequencePlayback = () => {
    setSequencePlaying(false);
    if (previewSequenceTimerRef.current) {
      window.clearTimeout(previewSequenceTimerRef.current);
      previewSequenceTimerRef.current = null;
    }
    previewSequenceAudioRef.current?.pause();
    previewSequenceVideoRef.current?.pause();
    bgmAudioRef.current?.pause();
  };

  const startSequencePlayback = (restart: boolean = false) => {
    if (!previewSceneData.length) return;
    if (restart) setSequenceSceneIndex(0);
    setSequenceRunId((prev) => prev + 1);
    setSequencePlaying(true);
  };

  const advanceSequencePlayback = () => {
    if (sequenceSceneIndex >= previewSceneData.length - 1) {
      stopSequencePlayback();
      setSequenceSceneIndex(Math.max(0, previewSceneData.length - 1));
      return;
    }
    setSequenceSceneIndex((prev) => Math.min(previewSceneData.length - 1, prev + 1));
    setSequenceRunId((prev) => prev + 1);
  };

  const activeOverallProgress = typeof progressPercent === 'number'
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : null;

  const activeSceneIndex = useMemo(() => data.findIndex((row, index) => {
    const sceneProgress = sceneProgressMap?.[index];
    return Boolean(animatingIndices?.has(index) || row.status === 'generating' || (sceneProgress && sceneProgress.percent < 100));
  }), [animatingIndices, data, sceneProgressMap]);

  const previewVideoTone = useMemo(() => {
    switch (previewVideoStatus) {
      case 'loading':
        return { badge: '합본 준비 중', badgeClass: 'bg-amber-100 text-amber-700', panelClass: 'border-amber-200 bg-amber-50' };
      case 'ready':
        return { badge: '합본 완료', badgeClass: 'bg-emerald-100 text-emerald-700', panelClass: 'border-emerald-200 bg-emerald-50' };
      case 'fallback':
        return { badge: '안전 모드', badgeClass: 'bg-blue-100 text-blue-700', panelClass: 'border-blue-200 bg-blue-50' };
      case 'error':
        return { badge: '확인 필요', badgeClass: 'bg-rose-100 text-rose-700', panelClass: 'border-rose-200 bg-rose-50' };
      default:
        return { badge: '대기 중', badgeClass: 'bg-slate-100 text-slate-700', panelClass: 'border-slate-200 bg-slate-50' };
    }
  }, [previewVideoStatus]);

  const allImageSources = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      const src = resolveImageSrc(row.imageData);
      if (src) set.add(src);
      (row.imageHistory || []).forEach((entry) => {
        const historySrc = resolveImageSrc(entry.data);
        if (historySrc) set.add(historySrc);
      });
    });
    return Array.from(set);
  }, [data]);

  useEffect(() => {
    let disposed = false;
    const queue = allImageSources.filter((src) => !previewImageMap[src] && !previewQueueRef.current.has(src)).slice(0, 36);
    if (!queue.length) return;

    queue.forEach((src) => {
      previewQueueRef.current.add(src);
      void createLowQualityPreview(src).then((previewSrc) => {
        if (disposed) return;
        setPreviewImageMap((prev) => (prev[src] ? prev : { ...prev, [src]: previewSrc }));
      }).finally(() => {
        previewQueueRef.current.delete(src);
      });
    });

    return () => {
      disposed = true;
    };
  }, [allImageSources, previewImageMap]);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  const appendSceneAudioHistoryEntry = (index: number, sourceRow?: GeneratedAsset | null) => {
    const targetRow = sourceRow || latestDataRef.current[index];
    const currentAudioData = targetRow?.audioData?.trim();
    if (!currentAudioData) return;

    const nextSequence = (sceneAudioAppendSeqRef.current[index] || 0) + 1;
    sceneAudioAppendSeqRef.current[index] = nextSequence;

    const appendedEntry: AudioHistoryEntry = {
      id: `audio_regenerated_${targetRow?.sceneNumber || index + 1}_${index}_${Date.now()}_${nextSequence}_${getAudioHistorySignature(currentAudioData)}`,
      data: currentAudioData,
      createdAt: Date.now(),
      label: '생성 오디오',
      duration: targetRow?.audioDuration,
    };

    setSceneAudioHistory((prev) => {
      const existing = prev[index] || [];
      return {
        ...prev,
        [index]: [...existing, appendedEntry],
      };
    });
    setSceneAudioIndices((prev) => ({
      ...prev,
      [index]: Number.MAX_SAFE_INTEGER,
    }));
  };

  useEffect(() => {
    setSceneMediaIndices((prev) => {
      let changed = false;
      const next = { ...prev };
      data.forEach((row, index) => {
        (['image', 'video'] as const).forEach((kind) => {
          const orderedEntries = collectOrderedMediaHistory(row, kind);
          if (!orderedEntries.length) return;
          const key = getSceneMediaKey(index, kind);
          const latestEntry = orderedEntries[orderedEntries.length - 1] || null;
          const signatureKey = `${key}__sig`;
          const signature = `${latestEntry?.id || ''}:${latestEntry?.data?.slice(0, 48) || ''}:${orderedEntries.length}`;
          if ((next as Record<string, unknown>)[signatureKey] !== signature) {
            next[key] = orderedEntries.length - 1;
            (next as Record<string, unknown>)[signatureKey] = signature;
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [data]);

  const getAudioHistorySignature = (value?: string | null) => {
    const normalized = value?.trim() || '';
    if (!normalized) return 'empty';
    const safe = `${normalized.length}_${normalized.slice(0, 16)}_${normalized.slice(-16)}`;
    return safe.replace(/[^a-zA-Z0-9_-]/g, '');
  };

  useEffect(() => {
    setSceneAudioHistory((prev) => {
      let changed = false;
      const next: Record<number, AudioHistoryEntry[]> = { ...prev };

      data.forEach((row, index) => {
        const existing = next[index] || [];
        const rowAudioHistory = Array.isArray((row as GeneratedAsset & { audioHistory?: AudioHistoryEntry[] }).audioHistory)
          ? (((row as GeneratedAsset & { audioHistory?: AudioHistoryEntry[] }).audioHistory) || []).filter((item) => Boolean(item?.data))
          : [];
        const merged = [...rowAudioHistory, ...existing].reduce<AudioHistoryEntry[]>((acc, item, sourceIndex) => {
          if (!item?.data) return acc;
          const normalizedId = item.id?.trim();
          if (normalizedId && acc.some((entry) => entry.id === normalizedId)) return acc;
          acc.push({
            ...item,
            id: normalizedId || `audio_history_${index}_${sourceIndex}_${getAudioHistorySignature(item.data)}`,
          });
          return acc;
        }, []);
        const currentAudio = row.audioData?.trim()
          ? {
              id: `audio_current_${row.sceneNumber}_${index}_${getAudioHistorySignature(row.audioData)}`,
              data: row.audioData,
              createdAt: Date.now(),
              label: merged.length ? '최신 오디오' : '현재 오디오',
              duration: row.audioDuration,
            }
          : null;

        if (currentAudio && !merged.some((item) => item.id === currentAudio.id)) {
          merged.push(currentAudio);
        }

        if (
          merged.length !== existing.length
          || merged.some((entry, entryIdx) => {
            const prevEntry = existing[entryIdx];
            return prevEntry?.id !== entry.id || prevEntry?.data !== entry.data || prevEntry?.label !== entry.label;
          })
        ) {
          next[index] = merged;
          changed = true;
        } else if (!next[index] && merged.length) {
          next[index] = merged;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [data]);

  useEffect(() => {
    setSceneAudioIndices((prev) => {
      let changed = false;
      const next = { ...prev } as Record<string, number> & Record<number, number>;
      Object.entries(sceneAudioHistory as Record<string, AudioHistoryEntry[]>).forEach(([indexKey, entries]) => {
        if (!entries.length) return;
        const index = Number(indexKey);
        const latestEntry = entries[entries.length - 1] || null;
        const signatureKey = `${index}__audio_sig`;
        const signature = `${latestEntry?.id || ''}:${latestEntry?.data?.slice(0, 48) || ''}:${entries.length}`;
        if ((next as Record<string, unknown>)[signatureKey] !== signature) {
          next[index] = entries.length - 1;
          (next as Record<string, unknown>)[signatureKey] = signature;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [sceneAudioHistory]);

  useEffect(() => {
    setScenePreviewModes((prev) => {
      let changed = false;
      const next = { ...prev };
      const nextSignatures: Record<string, string> = {};

      data.forEach((row, index) => {
        const latestImage = collectOrderedMediaHistory(row, 'image').slice(-1)[0] || null;
        const latestVideo = collectOrderedMediaHistory(row, 'video').slice(-1)[0] || null;
        const latestAudio = row.audioData?.trim()
          ? `${row.audioData.slice(0, 64)}:${row.audioDuration || 0}`
          : '';

        const imageKey = `image-${index}`;
        const videoKey = `video-${index}`;
        const audioKey = `audio-${index}`;

        const imageSignature = latestImage ? `${latestImage.id}:${latestImage.data.slice(0, 64)}` : '';
        const videoSignature = latestVideo ? `${latestVideo.id}:${latestVideo.data.slice(0, 64)}` : '';

        nextSignatures[imageKey] = imageSignature;
        nextSignatures[videoKey] = videoSignature;
        nextSignatures[audioKey] = latestAudio;

        if (!scenePreviewSignatureInitRef.current) return;

        if (row.selectedVisualType === 'image' && imageSignature && scenePreviewSignatureRefs.current[imageKey] !== imageSignature && next[index] !== 'image') {
          next[index] = 'image';
          changed = true;
        }

        if (row.selectedVisualType === 'video' && videoSignature && scenePreviewSignatureRefs.current[videoKey] !== videoSignature && next[index] !== 'video') {
          next[index] = 'video';
          changed = true;
        }

        if (latestAudio && scenePreviewSignatureRefs.current[audioKey] !== latestAudio && next[index] !== 'audio') {
          next[index] = 'audio';
          changed = true;
        }
      });

      scenePreviewSignatureRefs.current = nextSignatures;
      scenePreviewSignatureInitRef.current = true;
      return changed ? next : prev;
    });
  }, [data]);

  const getDisplayImageSrc = (src: string) => previewImageMap[src] || src;

  const getSceneEditorMode = (_row: GeneratedAsset, index: number): SceneEditorMode => {
    const savedMode = sceneEditorModes[index];
    if (savedMode && (!isMuteMode || savedMode !== 'narration')) return savedMode;
    return isMuteMode ? 'image' : 'narration';
  };

  const getSceneEditorValue = (row: GeneratedAsset, mode: SceneEditorMode) => {
    if (mode === 'image') return row.imagePrompt || row.visualPrompt || '';
    if (mode === 'video') return row.videoPrompt || '';
    return row.narration || '';
  };

  const handleSceneEditorChange = (row: GeneratedAsset, index: number, mode: SceneEditorMode, value: string) => {
    if (mode === 'image') {
      onImagePromptChange?.(index, value);
      return;
    }
    if (mode === 'video') {
      onVideoPromptChange?.(index, value);
      return;
    }
    onNarrationChange?.(index, value);
  };


  const setSceneFinalPreviewMode = (index: number, mode: ScenePreviewMode) => {
    setScenePreviewModes((prev) => ({ ...prev, [index]: mode }));
    if (mode === 'image' || mode === 'video') {
      onSelectedVisualTypeChange?.(index, mode);
    }
  };

  const getSceneAudioRate = (index: number) => sceneAudioRates[index] || 1;

  const applyAudioPlaybackRate = (element: HTMLAudioElement | null, rate: number) => {
    if (!element) return;
    element.playbackRate = rate;
    element.defaultPlaybackRate = rate;
  };

  const getSceneNarrationVolume = (index: number) => sceneNarrationVolumes[index] ?? DEFAULT_SCENE_NARRATION_VOLUME;
  const getSceneVideoAudioVolume = (index: number) => sceneVideoAudioVolumes[index] ?? DEFAULT_SCENE_VIDEO_AUDIO_VOLUME;
  const getSceneSilenceTrim = (index: number) => sceneSilenceTrim[index] ?? 0;

  const applySceneNarrationState = (index: number, element: HTMLAudioElement | null) => {
    if (!element) return;
    applyAudioPlaybackRate(element, getSceneAudioRate(index));
    element.volume = clampMediaVolume(getSceneNarrationVolume(index));
  };

  const applySceneVideoState = (index: number, element: HTMLVideoElement | null) => {
    if (!element) return;
    element.volume = clampMediaVolume(getSceneVideoAudioVolume(index));
  };

  const getScenePreviewMode = (row: GeneratedAsset, index: number): ScenePreviewMode => {
    const savedMode = scenePreviewModes[index];
    if (narrationAudioEnabled && savedMode === 'audio' && row.audioData) return 'audio';
    if (savedMode === 'video' && hasRenderableVideo(row)) return 'video';
    if (savedMode === 'image' && hasRenderableImage(row)) return 'image';
    if (hasRenderableImage(row)) return 'image';
    if (hasRenderableVideo(row)) return 'video';
    if (narrationAudioEnabled && row.audioData) return 'audio';
    return 'image';
  };

  const getSceneAudioEntries = (index: number) => sceneAudioHistory[index] || [];

  const getSceneAudioIndex = (index: number, total: number) => {
    if (total <= 1) return Math.max(0, total - 1);
    const savedIndex = sceneAudioIndices[index];
    if (typeof savedIndex !== 'number') return total - 1;
    return Math.max(0, Math.min(total - 1, savedIndex));
  };

  const shiftSceneAudioIndex = (index: number, total: number, direction: -1 | 1) => {
    if (total <= 1) return;
    setSceneFinalPreviewMode(index, 'audio');
    setSceneAudioIndices((prev) => {
      const current = typeof prev[index] === 'number' ? prev[index] : total - 1;
      return {
        ...prev,
        [index]: Math.max(0, Math.min(total - 1, current + direction)),
      };
    });
  };

  const selectSceneAudioIndex = (index: number, total: number, nextIndex: number) => {
    if (!total) return;
    setSceneFinalPreviewMode(index, 'audio');
    setSceneAudioIndices((prev) => ({
      ...prev,
      [index]: Math.max(0, Math.min(total - 1, nextIndex)),
    }));
  };

  const getSceneAudioEntryLabel = (entry: AudioHistoryEntry | null, entryIndex: number) => entry?.label || `오디오 ${entryIndex + 1}`;
  const getSceneAudioEntryKey = (sceneIndex: number, entry: AudioHistoryEntry | null, entryIndex: number) => {
    const baseId = entry?.id?.trim();
    return `${sceneIndex}-audio-${entryIndex}-${baseId || getAudioHistorySignature(entry?.data)}`;
  };

  const getModelSelector = (kind: ModelPickerKind) => {
    if (kind === 'image') return imageModelSelector;
    if (kind === 'video') return videoModelSelector;
    return audioModelSelector;
  };

  const getSceneMediaKey = (index: number, kind: 'image' | 'video') => `${index}-${kind}`;

  const getSceneMediaIndex = (index: number, kind: 'image' | 'video', total: number) => {
    if (total <= 1) return Math.max(0, total - 1);
    const savedIndex = sceneMediaIndices[getSceneMediaKey(index, kind)];
    if (typeof savedIndex !== 'number') return total - 1;
    return Math.max(0, Math.min(total - 1, savedIndex));
  };

  const shiftSceneMediaIndex = (index: number, kind: 'image' | 'video', total: number, direction: -1 | 1) => {
    if (total <= 1) return;
    setSceneFinalPreviewMode(index, kind);
    const key = getSceneMediaKey(index, kind);
    setSceneMediaShift((prev) => ({ ...prev, [key]: direction }));
    setSceneMediaIndices((prev) => {
      const current = typeof prev[key] === 'number' ? prev[key] : total - 1;
      return {
        ...prev,
        [key]: Math.max(0, Math.min(total - 1, current + direction)),
      };
    });
    window.setTimeout(() => {
      setSceneMediaShift((prev) => ({ ...prev, [key]: 0 }));
    }, 220);
  };


  const runSceneAction = async (key: string, task: () => void | Promise<void>) => {
    if (sceneActionLocksRef.current[key] || sceneActionLocks[key]) return;
    sceneActionLocksRef.current[key] = true;
    setSceneActionLocks((prev) => ({ ...prev, [key]: true }));
    try {
      await task();
    } finally {
      window.setTimeout(() => {
        delete sceneActionLocksRef.current[key];
        setSceneActionLocks((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 0);
    }
  };

  useEffect(() => {
    setSceneEditorModes({});
    setScenePreviewModes({});
    setSceneInlineSettingsOpen({});
    setSceneMediaIndices({});
    setSceneMediaShift({});
    setSceneAudioIndices({});
  }, [projectId, isMuteMode]);

  const sceneEditorMeta: Record<SceneEditorMode, { label: string; placeholder: string; badgeClass: string }> = {
    narration: {
      label: '대사',
      placeholder: '이 씬에서 사용할 대사만 입력하세요',
      badgeClass: 'bg-slate-900 text-white',
    },
    image: {
      label: '이미지',
      placeholder: '이 씬의 이미지 프롬프트를 입력하세요',
      badgeClass: 'bg-blue-600 text-white',
    },
    video: {
      label: '영상',
      placeholder: '이 씬의 영상 프롬프트를 입력하세요',
      badgeClass: 'bg-violet-600 text-white',
    },
  };

  const preventButtonFocusScroll = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const openPreviewModal = async (mode: 'all' | 'range' = 'all') => {
    if (isResultPreviewLocked) return;
    setPreviewSelectionMode(mode);
    setPreviewOpen(true);
  };

  const openPreviewAtScene = (index: number, autoplay: boolean = true) => {
    setPreviewSelectionMode('all');
    void openPreviewModal('all');
    setSequenceSceneIndex(index);
    if (!autoplay) return;
    window.setTimeout(() => {
      setSequenceSceneIndex(index);
      startSequencePlayback(false);
    }, 60);
  };

  useEffect(() => {
    const container = bgmStripRef.current;
    if (!container || !mainBgm?.id) return;
    const target = container.querySelector<HTMLElement>(`[data-bgm-card-id="${mainBgm.id}"]`);
    if (target) scrollElementIntoView(target);
  }, [mainBgm?.id, backgroundMusicTracks.length]);

  useEffect(() => {
    const container = sceneStripRef.current;
    if (!container || activeSceneIndex < 0) return;
    const target = container.querySelector<HTMLElement>(`[data-scene-chip-id="${activeSceneIndex}"]`);
    if (target) scrollElementIntoView(target);
  }, [activeSceneIndex]);

  useEffect(() => {
    data.forEach((row, index) => {
      (['image', 'video'] as const).forEach((kind) => {
        const entries = collectOrderedMediaHistory(row, kind);
        if (!entries.length) return;
        const mediaKey = getSceneMediaKey(index, kind);
        const selectedIndex = getSceneMediaIndex(index, kind, entries.length);
        const container = sceneMediaStripRefs.current[mediaKey];
        if (!container) return;
        const target = container.querySelector<HTMLElement>(`[data-scene-media-card="${mediaKey}-${selectedIndex}"]`);
        if (target) scrollElementIntoView(target);
      });
    });
  }, [data, sceneMediaIndices]);

  useEffect(() => {
    Object.entries(sceneAudioHistory as Record<string, AudioHistoryEntry[]>).forEach(([indexKey, entries]) => {
      if (!entries.length) return;
      const index = Number(indexKey);
      const container = sceneAudioStripRefs.current[index];
      if (!container) return;
      const selectedIndex = getSceneAudioIndex(index, entries.length);
      const target = container.querySelector<HTMLElement>(`[data-scene-audio-card="${index}-${selectedIndex}"]`);
      if (target) scrollElementIntoView(target);
    });
  }, [sceneAudioHistory, sceneAudioIndices]);

  useEffect(() => {
    Object.entries(sceneAudioElementRefs.current as Record<string, HTMLAudioElement | null>).forEach(([indexKey, element]) => {
      applySceneNarrationState(Number(indexKey), element);
    });
  }, [sceneAudioRates, sceneNarrationVolumes]);

  useEffect(() => {
    Object.entries(sceneVideoElementRefs.current as Record<string, HTMLVideoElement | null>).forEach(([indexKey, element]) => {
      applySceneVideoState(Number(indexKey), element);
    });
  }, [sceneVideoAudioVolumes]);

  useEffect(() => {
    setActiveModelPicker((prev) => {
      if (!prev) return prev;
      return data[prev.index] ? prev : null;
    });
  }, [data.length]);

  useEffect(() => {
    if (!previewOpen) {
      stopSequencePlayback();
      setSequenceSceneIndex(0);
      return;
    }
    return () => {
      stopSequencePlayback();
    };
  }, [previewOpen]);

  useEffect(() => {
    applyAudioPlaybackRate(previewSequenceAudioRef.current, sequenceSceneAudioRate);
  }, [sequenceSceneAudioRate, sequenceSceneIndex, previewOpen]);

  useEffect(() => {
    if (!previewOpen || !sequencePlaying || !sequenceScene) return;

    if (previewSequenceTimerRef.current) {
      window.clearTimeout(previewSequenceTimerRef.current);
      previewSequenceTimerRef.current = null;
    }

    const narrationAudio = previewSequenceAudioRef.current;
    const sceneVideo = previewSequenceVideoRef.current;
    const bgmAudio = bgmAudioRef.current;

    if (sceneVideo) {
      sceneVideo.currentTime = 0;
      sceneVideo.muted = true;
      void sceneVideo.play().catch(() => {});
    }

    if (narrationAudioEnabled && narrationAudio) {
      narrationAudio.currentTime = 0;
      narrationAudio.volume = clampMediaVolume(previewMix?.narrationVolume || 1);
      void narrationAudio.play().catch(() => {});
    }

    if (bgmAudio && mainBgm?.audioData) {
      bgmAudio.loop = true;
      bgmAudio.volume = clampMediaVolume(previewMix?.backgroundMusicVolume || mainBgm.volume || 0.28);
      if (bgmAudio.paused) {
        void bgmAudio.play().catch(() => {});
      }
    }

    previewSequenceTimerRef.current = window.setTimeout(() => {
      advanceSequencePlayback();
    }, sequenceSceneDuration * 1000);

    return () => {
      if (previewSequenceTimerRef.current) {
        window.clearTimeout(previewSequenceTimerRef.current);
        previewSequenceTimerRef.current = null;
      }
      narrationAudio?.pause();
      sceneVideo?.pause();
    };
  }, [mainBgm?.audioData, mainBgm?.volume, narrationAudioEnabled, previewMix, previewOpen, sequencePlaying, sequenceRunId, sequenceScene, sequenceSceneDuration]);

  const resolvedSceneData = useMemo(() => {
    return data.map((row, index) => {
      const imageEntries = collectOrderedMediaHistory(row, 'image');
      const videoEntries = collectOrderedMediaHistory(row, 'video');
      const audioEntries = sceneAudioHistory[index] || [];

      const selectedImageIndex = getSceneMediaIndex(index, 'image', imageEntries.length);
      const selectedVideoIndex = getSceneMediaIndex(index, 'video', videoEntries.length);
      const selectedAudioIndex = getSceneAudioIndex(index, audioEntries.length);

      const selectedImageData = imageEntries[selectedImageIndex]?.data || row.imageData || null;
      const selectedVideoData = videoEntries[selectedVideoIndex]?.data || row.videoData || null;
      const selectedAudioData = narrationAudioEnabled
        ? (audioEntries[selectedAudioIndex]?.data || row.audioData || null)
        : null;
      const selectedPreviewMode = scenePreviewModes[index] || null;

      const selectedVisualType = selectedPreviewMode === 'video' && selectedVideoData
        ? 'video'
        : selectedPreviewMode === 'image' && selectedImageData
          ? 'image'
          : getPreferredVisualType({
              ...row,
              imageData: selectedImageData,
              videoData: selectedVideoData,
            });

      return {
        ...row,
        imageData: selectedImageData,
        videoData: selectedVideoData,
        audioData: selectedAudioData,
        selectedVisualType,
      };
    });
  }, [data, narrationAudioEnabled, sceneAudioHistory, sceneAudioIndices, sceneMediaIndices, scenePreviewModes]);


  const previewModalData = useMemo(() => {
    if (previewSelectionMode === 'range' && timelineRangePreview) {
      const safeStart = Math.max(0, Math.min(timelineRangePreview.startIndex, resolvedSceneData.length - 1));
      const safeEnd = Math.max(safeStart, Math.min(timelineRangePreview.endIndex, resolvedSceneData.length - 1));
      return resolvedSceneData.slice(safeStart, safeEnd + 1);
    }
    return resolvedSceneData;
  }, [previewSelectionMode, resolvedSceneData, timelineRangePreview]);

  const previewModalSummary = useMemo(() => ({
    imageCount: previewModalData.filter((item) => item.imageData).length,
    audioCount: narrationAudioEnabled ? previewModalData.filter((item) => item.audioData).length : 0,
    videoCount: previewModalData.filter((item) => item.videoData).length,
  }), [narrationAudioEnabled, previewModalData]);
  const previewModalDuration = useMemo(() => Number(previewModalData.reduce((sum, item) => sum + resolveAssetPlaybackDuration(item, { minimum: MIN_SCENE_DURATION, fallbackNarrationEstimate: true, preferTargetDuration: true }), 0).toFixed(2)), [previewModalData]);

  useEffect(() => {
    setSequenceSceneIndex((current) => Math.max(0, Math.min(current, Math.max(0, previewSceneData.length - 1))));
  }, [previewSceneData.length]);

  const shouldShowFooter = !previewOpen;

  if (!data.length) {
    return (
      <div className="mx-auto w-full px-0 pb-16">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🎬</div>
          <h3 className="mt-4 text-xl font-black text-slate-900">씬 생성 전입니다</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            캐릭터와 화풍을 정리한 뒤 씬이 생성되면 여기서는 편집과 재생성만 다루고, 실제 결과 확인은 미리보기 팝업에서 먼저 볼 수 있습니다.
          </p>
          {onAddParagraphScene ? (
            <div className="mx-auto mt-5 max-w-md">
              <button
                type="button"
                onClick={() => void onAddParagraphScene?.()}
                className="flex w-full items-center justify-center gap-3 rounded-[24px] border border-dashed border-blue-300 bg-blue-50 px-5 py-5 text-center transition hover:bg-blue-100"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-2xl font-black text-white">+</span>
                <span className="text-left">
                  <span className="block text-sm font-black text-slate-900">문단 추가</span>
                  <span className="block text-xs leading-5 text-slate-500">대본이 아직 없어도 빈 씬 카드부터 열어서 바로 편집을 시작할 수 있습니다.</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full px-0 ${activeWorkspaceTab === 'timeline' ? 'pb-8' : 'pb-20'}`}>
      <div className={`mp4-glass-panel rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm ${activeWorkspaceTab === 'timeline' ? 'hidden' : ''}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-slate-900">{currentTopic || '프로젝트'}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-2">씬 {data.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">이미지 {summary.imageCount}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">오디오 {summary.audioCount}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">영상 {summary.videoCount}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">총 {formatSeconds(totalDuration)}</span>
              </div>
            </div>
            {narrationAudioEnabled && onDeleteAllAudio ? (
              <button
                type="button"
                onClick={onDeleteAllAudio}
                className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50"
              >
                생성된 오디오 전체 삭제
              </button>
            ) : null}
          </div>
        {false && (
          <div className={`mt-4 rounded-[24px] border px-4 py-4 text-sm ${isGenerating || activeOverallProgress !== null ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="flex items-center gap-3">
              {isGenerating || activeOverallProgress !== null ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> : <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
              <span className="font-bold">{progressMessage || '씬 상태를 준비했습니다.'}</span>
            </div>
            {activeOverallProgress !== null && (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                  <span>{progressLabel || '현재 작업 진행률'}</span>
                  <span>{activeOverallProgress}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${activeOverallProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {totalCost && (
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">예상 API 비용</div>
                <div className="mt-1 text-sm font-bold text-slate-700">현재 선택된 모델 기준으로 Step6 예상 금액을 바로 확인할 수 있습니다.</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-slate-900">{formatUsdAmount(totalCost.total)}</div>
                <div className="mt-1 text-xs text-slate-500">약 {formatKrwEstimate(totalCost.total)}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {estimatedCostCards.map((item) => (
                <div key={item.id} className={`rounded-2xl border border-slate-200 ${item.bgTone} px-4 py-3`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-slate-500">{item.label}</span>
                    <span className={`text-xs font-black ${item.tone}`}>{item.countLabel}</span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-900">{formatUsdAmount(item.amount)}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{formatKrwEstimate(item.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {false && (
        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">최종 미리보기 사운드</div>
              <h3 className="mt-2 text-xl font-black text-slate-900">나레이션 / 배경음 밸런스</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">배경음은 컷과 별도로 전체 영상에 깔리고, 여러 트랙을 새로 만들어 비교한 뒤 하나를 선택해 렌더링할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onCreateBackgroundTrack && (
                <button type="button" onClick={onCreateBackgroundTrack} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  새 배경음 생성
                </button>
              )}
              <HelpTip title="배경음 적용 방식" compact>
                배경음은 컷마다 붙는 오디오가 아니라 전체 타임라인용 보조 트랙입니다. 렌더링할 때 장면 오디오 아래에 따로 섞입니다.
              </HelpTip>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900">
                <span>나레이션 볼륨</span>
                <div className="flex items-center gap-2">
                  <span>{Math.round((previewMixSnapshot.narrationVolume || 1) * 100)}%</span>
                  {onPreparePreviewVideo ? (
                    <button
                      type="button"
                      onClick={() => void onPreparePreviewVideo?.()}
                      disabled={!canRequestPreviewRerender}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isPreparingPreviewVideo ? '다시 렌더링 중...' : '다시 렌더링'}
                    </button>
                  ) : null}
                </div>
              </div>
              <input type="range" min="0" max="1.6" step="0.05" value={previewMixSnapshot.narrationVolume || 1} onChange={(e) => onPreviewMixChange?.({ ...previewMixSnapshot, narrationVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900">
                <span>배경음 볼륨</span>
                <div className="flex items-center gap-2">
                  <span>{Math.round((previewMixSnapshot.backgroundMusicVolume || mainBgm?.volume || 0.28) * 100)}%</span>
                  {onPreparePreviewVideo ? (
                    <button
                      type="button"
                      onClick={() => void onPreparePreviewVideo?.()}
                      disabled={!canRequestPreviewRerender}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isPreparingPreviewVideo ? '다시 렌더링 중...' : '다시 렌더링'}
                    </button>
                  ) : null}
                </div>
              </div>
              <input type="range" min="0" max="1" step="0.02" value={previewMixSnapshot.backgroundMusicVolume || mainBgm?.volume || 0.28} onChange={(e) => onPreviewMixChange?.({ ...previewMixSnapshot, backgroundMusicVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
            </div>
          </div>

          {backgroundMusicTracks.length > 0 && (
            <div className={`mt-4 ${activeWorkspaceTab === 'scene' ? '' : 'hidden'}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">새 배경음이 생기면 자동 선택되고, 카드 줄도 그 위치까지 부드럽게 이동합니다.</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => scrollContainerBy(bgmStripRef.current, 'left', 360)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">←</button>
                  <button type="button" onClick={() => scrollContainerBy(bgmStripRef.current, 'right', 360)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">→</button>
                </div>
              </div>
              <div ref={bgmStripRef} onWheel={(event) => handleHorizontalWheel(event, 0.9)} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {backgroundMusicTracks.map((track) => {
                  const active = track.id === (mainBgm?.id || '');
                  return (
                    <div key={track.id} data-bgm-card-id={track.id} className={`w-[min(82vw,340px)] shrink-0 rounded-2xl border p-4 transition-all duration-300 ${active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">{track.title}</div>
                          <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{track.prompt}</p>
                        </div>
                        <button type="button" onClick={() => onSelectBackgroundTrack?.(track.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                          {active ? '선택됨' : '이 트랙 사용'}
                        </button>
                      </div>
                      {active && (
                        <div className="mt-3">
                          <button type="button" onClick={() => {
                            if (!bgmAudioRef.current) return;
                            if (bgmAudioRef.current.paused) {
                              bgmAudioRef.current.volume = clampMediaVolume(previewMix?.backgroundMusicVolume || track.volume || 0.28);
                              bgmAudioRef.current.play();
                            } else {
                              bgmAudioRef.current.pause();
                            }
                          }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                            배경음 미리듣기
                          </button>
                          {resolveBackgroundAudioSrc(track.audioData) ? (
                            <audio ref={bgmAudioRef} controls className="mt-3 w-full">
                              <source src={resolveBackgroundAudioSrc(track.audioData)} type="audio/wav" />
                            </audio>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`mt-4 space-y-4 ${activeWorkspaceTab === 'timeline' ? 'hidden' : ''}`}>
        {backgroundMusicSceneConfig?.enabled ? (
          <div className="rounded-[26px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">배경음 전용 씬</div>
                <h3 className="mt-2 text-lg font-black text-slate-900">전체 영상용 배경음 카드</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">프롬프트는 5개 섹션으로 저장하고, 새로 만든 배경음은 오른쪽 끝 이력 카드에 쌓인 뒤 자동 선택되어 해당 위치로 스크롤됩니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onBackgroundMusicSceneChange?.({ enabled: false })}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  카드 숨기기
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
              <div className="min-w-0 rounded-[24px] border border-violet-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">프롬프트 설계</div>
                    <div className="mt-2 text-sm font-bold text-slate-700">트랙 제목은 프로젝트 이름 기준으로 자동 번호가 붙고, 길이는 현재 영상 총 길이에 맞춰 자동 조절됩니다.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">영상 길이 {backgroundMusicTargetDuration}초 자동 맞춤</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">모델 {backgroundMusicModelLabel}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                  <button
                    type="button"
                    onClick={() => setBackgroundMusicPickerOpen(true)}
                    disabled={!backgroundMusicModelSelector}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-2 text-base font-black text-slate-900">{backgroundMusicModelLabel}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">설정의 프로젝트 기본값과 별개로, 여기서 바꾸는 배경음 모델은 현재 Step6 배경음 카드에만 적용됩니다.</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedBackgroundMusicOption?.priceLabel || '무료'}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedBackgroundMusicOption?.qualityLabel || '샘플'}</span>
                      {selectedBackgroundMusicOption?.speedLabel ? <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedBackgroundMusicOption.speedLabel}</span> : null}
                    </div>
                    {selectedBackgroundMusicOption?.costHint ? (
                      <div className="mt-3 text-[11px] leading-5 text-slate-500">{selectedBackgroundMusicOption.costHint}</div>
                    ) : null}
                    {selectedBackgroundMusicOption?.helper ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                        {selectedBackgroundMusicOption.helper}
                      </div>
                    ) : null}
                    {selectedBackgroundMusicOption?.disabledReason ? (
                      <div className="mt-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                        {selectedBackgroundMusicOption.disabledReason}
                      </div>
                    ) : null}
                  </button>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">적용 범위</div>
                    <div className="mt-2 text-sm font-black text-slate-900">Step6 전용 배경음 모델</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">이 팝업은 현재 Step6 배경음 생성에만 적용되고, Settings에 저장된 프로젝트 기본값은 그대로 유지됩니다.</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{backgroundMusicSceneConfig.provider === 'google' ? 'Google Lyria 3' : '샘플 배경음'}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">현재 목표 길이 {backgroundMusicTargetDuration}초</span>
                    </div>
                    <div className="mt-3 rounded-2xl border border-dashed border-violet-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                      Google API가 연결되어 있으면 Lyria 3로 바로 생성하고, 연결이 없거나 실행이 실패하면 샘플 배경음으로만 안전하게 대체합니다.
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-[22px] border border-violet-100 bg-violet-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900">배경음 느낌</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">프로젝트 분위기를 한 줄로 적거나 자동으로 채운 뒤 생성하면 됩니다.</div>
                    </div>
                    {onAutoFillBackgroundMusicMood ? (
                      <button
                        type="button"
                        onClick={onAutoFillBackgroundMusicMood}
                        className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-50"
                      >
                        프로젝트 느낌 자동 생성
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    value={(backgroundMusicSceneConfig.promptSections as any)?.mood || ''}
                    placeholder="예: 몽환적이지만 너무 무겁지 않고, 서서히 감정이 올라오는 따뜻한 분위기"
                    onChange={(event) => onBackgroundMusicSceneChange?.({ promptSections: { ...(backgroundMusicSceneConfig.promptSections || {}), mood: event.target.value } as any })}
                    className="mt-3 h-[72px] w-full resize-none rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400"
                  />
                </div>
                <div className="mt-3 grid gap-2.5">
                  {[
                    ['identity', '1. 정체성', '보컬 성별 + 장르를 한 문장으로 적어 주세요.', '예: 여성 보컬이 스며든 감성 팝 기반 배경음'],
                    ['instruments', '2. 악기 구성', '악기명과 연주 동사를 함께 적어 주세요.', '예: 피아노가 잔잔하게 시작하고 스트링이 뒤에서 부드럽게 받쳐 줍니다.'],
                    ['performance', '3. 퍼포먼스', '보컬 질감, 전달 방식, 음역, 프레이징을 적어 주세요.', '예: 보컬은 속삭이듯 가볍게, 중음역 중심으로 또렷하게 흘러갑니다.'],
                    ['production', '4. 프로덕션', '스테레오 폭, 공간감, 리버브, 보컬 위치, 사운드 질감을 적어 주세요.', '예: 공간감은 넓지만 과하지 않고, 전체 텍스처는 따뜻하고 깨끗하게 유지합니다.'],
                  ].map(([key, title, helper, placeholder]) => (
                    <label key={key} className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-left">
                      <div className="text-sm font-black text-slate-900">{title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
                      <textarea
                        value={(backgroundMusicSceneConfig.promptSections as any)?.[key] || ''}
                        placeholder={placeholder}
                        onChange={(event) => onBackgroundMusicSceneChange?.({ promptSections: { ...(backgroundMusicSceneConfig.promptSections || {}), [key]: event.target.value } as any })}
                        className="mt-2 h-[64px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-3 text-sm leading-6 text-slate-600">
                  뮤직비디오면 현재 가사와 보컬 흐름을 따라가고, 일반 영상이면 대본과 음성 흐름을 기준으로 장면을 방해하지 않는 배경음 방향으로 이어집니다.
                </div>
              </div>

              <div className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">생성 이력</div>
                    <div className="mt-2 text-sm font-bold text-slate-700">배경음 생성과 연장본은 모두 이력으로만 쌓이고, 새 음악은 오른쪽 끝에 추가됩니다.</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">총 {backgroundMusicTracks.length}개 트랙</span>
                    {onCreateBackgroundTrack ? (
                      <button
                        type="button"
                        onClick={onCreateBackgroundTrack}
                        className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500"
                      >
                        배경음 생성
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">생성 이력</div>
                      <div className="mt-1 text-xs text-slate-500">가로 스크롤 스트립으로만 관리하며, 새로 만든 음악은 선택 후 해당 카드까지 이동합니다.</div>
                    </div>
                    {backgroundMusicTracks.length > 1 ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => scrollContainerBy(bgmStripRef.current, 'left', 320)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">←</button>
                        <button type="button" onClick={() => scrollContainerBy(bgmStripRef.current, 'right', 320)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">→</button>
                      </div>
                    ) : null}
                  </div>
                  <div className="overflow-hidden">
                    <div ref={bgmStripRef} onWheel={(event) => handleHorizontalWheel(event, 0.9)} className="flex gap-3 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth snap-x snap-mandatory">
                      {backgroundMusicTracks.length ? backgroundMusicTracks.map((track, trackIndex) => {
                        const active = track.id === (mainBgm?.id || '');
                        return (
                          <div
                            key={track.id}
                            data-bgm-card-id={track.id}
                            className={`w-[248px] max-w-[248px] shrink-0 snap-start rounded-[22px] border p-4 text-left transition ${active ? 'border-violet-300 bg-white shadow-[0_18px_40px_-28px_rgba(139,92,246,0.55)]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-slate-900">{track.title}</div>
                                <div className="mt-1 text-[11px] font-bold text-slate-400">{new Date(track.createdAt).toLocaleString('ko-KR')}</div>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>{active ? '사용 중' : `#${trackIndex + 1}`}</span>
                            </div>
                            <div className="mt-3 line-clamp-4 text-xs leading-5 text-slate-500">{track.prompt}</div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-600">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{track.requestedDuration || track.duration || 20}초</span>
                              {track.parentTrackId ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">연장본</span> : null}
                            </div>
                            {resolveBackgroundAudioSrc(track.audioData) ? (
                              <audio controls className="mt-3 w-full">
                                <source src={resolveBackgroundAudioSrc(track.audioData)} type="audio/wav" />
                              </audio>
                            ) : null}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button type="button" onClick={() => onSelectBackgroundTrack?.(track.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{active ? '선택됨' : '선택'}</button>
                              {onExtendBackgroundTrack ? <button type="button" onClick={() => onExtendBackgroundTrack(track.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">음악 연장</button> : null}
                              {onDeleteBackgroundTrack ? <button type="button" onClick={() => onDeleteBackgroundTrack(track.id)} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50">삭제</button> : null}
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm font-bold text-slate-500">첫 배경음을 생성하면 이력 카드가 여기에 쌓입니다.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : onBackgroundMusicSceneChange ? (
          <div className="rounded-[28px] border border-dashed border-violet-200 bg-violet-50/40 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">배경음 생성</div>
                <h3 className="mt-2 text-lg font-black text-slate-900">배경음 전용 씬 카드 추가</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">씬 영역 최상단에 배경음 전용 카드를 하나 만들고, 그 카드에서만 전체 영상용 배경음을 관리합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => onBackgroundMusicSceneChange({ enabled: true })}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500"
              >
                배경음 카드 만들기
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange('scene')}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${activeWorkspaceTab === 'scene' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              씬 편집
            </button>
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange('timeline')}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${activeWorkspaceTab === 'timeline' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              타임라인
            </button>
          </div>
          <div className="text-xs font-bold leading-5 text-slate-500">타임라인 탭은 Step6와 같은 데이터에 연결됩니다.</div>
        </div>

        {activeWorkspaceTab === 'timeline' ? (
          <div className="mt-5">
            <TimelineWorkbench
              projectId={projectId}
              data={data}
              backgroundMusicTracks={backgroundMusicTracks}
              selectedThumbnailId={selectedThumbnailId}
              onDurationChange={onDurationChange}
              onSceneReorder={onSceneReorder}
              onSplitScene={onSplitScene}
              onPinSceneAsThumbnail={onPinSceneAsThumbnail}
              onReuseGlobalAsset={onReuseGlobalAsset}
              onBackgroundTrackTimelineChange={onBackgroundTrackTimelineChange}
              onPreviewRange={(range) => {
                setTimelineRangePreview(range);
                setSequenceSceneIndex(0);
                void openPreviewModal('range');
              }}
            />
          </div>
        ) : null}

        <div className={activeWorkspaceTab === 'scene' ? 'mt-6' : 'hidden'} />

        {displayedScenes.map((row, index) => {
          const isAnimating = animatingIndices?.has(index) || false;
          const sceneProgress = sceneProgressMap?.[index] || null;
          const isSceneWorking = Boolean(sceneActionLocks[`image-${index}`] || sceneActionLocks[`video-${index}`] || sceneActionLocks[`audio-${index}`]) || isAnimating || row.status === 'generating' || Boolean(sceneProgress && sceneProgress.percent < 100);
          const editorMode = getSceneEditorMode(row, index);
          const editorMeta = sceneEditorMeta[editorMode];
          const editorValue = getSceneEditorValue(row, editorMode);
          const editorGenerateKey = `editor-${index}-${editorMode}`;
          const isEditorAiGenerating = Boolean(sceneActionLocks[editorGenerateKey]);
          const selectedVisualType = getPreferredVisualType(row);
          const previewMode = getScenePreviewMode(row, index);

          const imageEntries = collectOrderedMediaHistory(row, 'image');
          const imageEntryIndex = getSceneMediaIndex(index, 'image', imageEntries.length);
          const imageEntry = imageEntries[imageEntryIndex] || null;
          const imageSrc = resolveImageSrc(imageEntry?.data || row.imageData);
          const displayImageSrc = imageSrc ? getDisplayImageSrc(imageSrc) : '';
          const imageHasPrev = imageEntryIndex > 0;
          const imageHasNext = imageEntryIndex < imageEntries.length - 1;

          const videoEntries = collectOrderedMediaHistory(row, 'video');
          const videoEntryIndex = getSceneMediaIndex(index, 'video', videoEntries.length);
          const videoEntry = videoEntries[videoEntryIndex] || null;
          const videoSrc = resolveVideoSrc(videoEntry?.data || row.videoData);
          const videoHasPrev = videoEntryIndex > 0;
          const videoHasNext = videoEntryIndex < videoEntries.length - 1;

          const audioEntries = getSceneAudioEntries(index);
          const audioEntryIndex = getSceneAudioIndex(index, audioEntries.length);
          const audioEntry = audioEntries[audioEntryIndex] || null;
          const audioSrc = resolveNarrationAudioSrc(audioEntry?.data || row.audioData);
          const audioHasPrev = audioEntryIndex > 0;
          const audioHasNext = audioEntryIndex < audioEntries.length - 1;

          const previewHistoryCount = previewMode === 'audio'
            ? audioEntries.length
            : previewMode === 'video'
              ? videoEntries.length
              : imageEntries.length;
          const previewHistoryIndex = previewMode === 'audio'
            ? audioEntryIndex
            : previewMode === 'video'
              ? videoEntryIndex
              : imageEntryIndex;
          const previewHasPrev = previewMode === 'audio'
            ? audioHasPrev
            : previewMode === 'video'
              ? videoHasPrev
              : imageHasPrev;
          const previewHasNext = previewMode === 'audio'
            ? audioHasNext
            : previewMode === 'video'
              ? videoHasNext
              : imageHasNext;
          const previewHistoryLabel = previewMode === 'audio'
            ? (audioEntry?.label || `오디오 ${audioEntryIndex + 1}`)
            : previewMode === 'video'
              ? (videoEntry?.label || `영상 ${videoEntryIndex + 1}`)
              : (imageEntry?.label || `이미지 ${imageEntryIndex + 1}`);
          const sceneMediaOffset = previewMode === 'video'
            ? (sceneMediaShift[getSceneMediaKey(index, 'video')] || 0)
            : (sceneMediaShift[getSceneMediaKey(index, 'image')] || 0);
          const narrationVolume = getSceneNarrationVolume(index);
          const videoAudioVolume = getSceneVideoAudioVolume(index);
          const silenceTrim = getSceneSilenceTrim(index);
          const hasNarrationControl = Boolean(audioEntry?.data || row.audioData);
          const canAdjustSilenceTrim = narrationAudioEnabled && hasNarrationControl;
          const canAdjustNarrationVolume = narrationAudioEnabled && hasNarrationControl;
          const canAdjustVideoAudio = Boolean(videoEntry?.data || row.videoData);
          const canGenerateVideo = Boolean(imageEntry?.data || row.imageData || imageEntries.length);

          return (
            <div
              key={`${row.sceneNumber}-${index}`}
              ref={(node) => {
                sceneCardRefs.current[index] = node;
              }}
              className={`overflow-hidden rounded-[28px] border bg-white shadow-sm transition-all duration-300 ${activeWorkspaceTab === 'scene' ? '' : 'hidden'} ${activeSceneIndex === index ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <div className="flex flex-col gap-0 xl:grid xl:grid-cols-[236px_minmax(0,1fr)_204px]">
                <div className="border-b border-slate-200 bg-slate-50 p-3 xl:border-b-0 xl:border-r">

                  <div className="mx-auto w-[220px] max-w-full">
                    <div className="group/scene-preview relative flex h-[220px] w-[220px] max-w-full items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3 shadow-inner shadow-slate-100/70">
                      <div className="absolute left-2 top-2 z-10 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                        최종 선택 · {previewMode === 'audio' ? `오디오 ${audioEntryIndex + 1}` : previewMode === 'video' ? `영상 ${videoEntryIndex + 1}` : `이미지 ${imageEntryIndex + 1}`}
                      </div>
                      {previewMode === 'video' && videoSrc ? (
                        <>
                          <video
                            key={videoSrc}
                            src={videoSrc}
                            ref={(node) => {
                              sceneVideoElementRefs.current[index] = node;
                              applySceneVideoState(index, node);
                            }}
                            className="h-full w-full rounded-2xl object-contain"
                            style={{ transform: `translateX(${sceneMediaOffset * 10}px)` }}
                            playsInline
                            controls
                            preload="metadata"
                            onLoadedData={(event) => applySceneVideoState(index, event.currentTarget)}
                            onPlay={(event) => applySceneVideoState(index, event.currentTarget)}
                          />
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => { setSceneFinalPreviewMode(index, 'video'); setMediaLightbox({ kind: 'video', src: videoSrc, title: `씬 ${row.sceneNumber} 영상`, aspectRatio: row.aspectRatio }); }}
                            className="absolute right-2 top-2 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm hover:bg-white"
                          >
                            크게 보기
                          </button>
                        </>
                      ) : previewMode === 'audio' && audioSrc ? (
                        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 text-center">
                          <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-700">오디오 {audioEntryIndex + 1}/{Math.max(1, audioEntries.length)}</div>
                          <div className="text-sm font-black text-slate-900">{previewHistoryLabel}</div>
                          <div className="text-[11px] leading-5 text-slate-500">길이 {formatSeconds(getAdjustedAudioDuration(audioEntry?.duration || row.audioDuration, silenceTrim) || audioEntry?.duration || row.audioDuration)}</div>
                          <audio
                            controls
                            className="w-full"
                            ref={(node) => {
                              sceneAudioElementRefs.current[index] = node;
                              applySceneNarrationState(index, node);
                            }}
                            onPlay={(event) => applySceneNarrationState(index, event.currentTarget)}
                          >
                            <source src={audioSrc} type="audio/mpeg" />
                          </audio>
                        </div>
                      ) : displayImageSrc ? (
                        <>
                          <button type="button" onMouseDown={preventButtonFocusScroll} onClick={() => { setSceneFinalPreviewMode(index, 'image'); setMediaLightbox({ kind: 'image', src: displayImageSrc, title: `씬 ${row.sceneNumber} 이미지`, aspectRatio: row.aspectRatio }); }} className="block h-full w-full text-left">
                            <img src={displayImageSrc} alt={`씬 ${row.sceneNumber}`} className={`h-full w-full rounded-2xl object-contain transition-all duration-200 hover:scale-[1.01] ${isSceneWorking ? 'opacity-70' : ''}`} style={{ transform: `translateX(${sceneMediaOffset * 10}px)` }} />
                          </button>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => { setSceneFinalPreviewMode(index, 'image'); setMediaLightbox({ kind: 'image', src: displayImageSrc, title: `씬 ${row.sceneNumber} 이미지`, aspectRatio: row.aspectRatio }); }}
                            className="absolute right-2 top-2 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm hover:bg-white"
                          >
                            크게 보기
                          </button>
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-bold text-slate-400">생성 후 여기서 결과를 바로 확인합니다.</div>
                      )}

                      {(previewHasPrev || previewHasNext) && (
                        <>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => {
                              if (previewMode === 'audio') shiftSceneAudioIndex(index, audioEntries.length, -1);
                              else shiftSceneMediaIndex(index, previewMode === 'video' ? 'video' : 'image', previewMode === 'video' ? videoEntries.length : imageEntries.length, -1);
                            }}
                            disabled={!previewHasPrev}
                            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/92 text-sm font-black text-slate-700 shadow-sm backdrop-blur hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => {
                              if (previewMode === 'audio') shiftSceneAudioIndex(index, audioEntries.length, 1);
                              else shiftSceneMediaIndex(index, previewMode === 'video' ? 'video' : 'image', previewMode === 'video' ? videoEntries.length : imageEntries.length, 1);
                            }}
                            disabled={!previewHasNext}
                            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/92 text-sm font-black text-slate-700 shadow-sm backdrop-blur hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            →
                          </button>
                        </>
                      )}

                      {isSceneWorking && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-white/80 p-3 backdrop-blur-[1px]">
                          {isAnimating ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/92">
                              <div className="relative h-20 w-20">
                                <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                                  <circle cx="40" cy="40" r="32" className="fill-none stroke-slate-200" strokeWidth="6" />
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="32"
                                    className="fill-none stroke-violet-600 transition-all duration-300"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={201}
                                    strokeDashoffset={201 - ((sceneProgress?.percent ?? 12) / 100) * 201}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-900">{sceneProgress?.percent ?? 12}%</div>
                              </div>
                              <div className="px-4 text-center text-xs font-black text-slate-700">{sceneProgress?.label || '영상 만드는 중'}</div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3">
                              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600">
                                <span>{sceneProgress?.label || '생성 중'}</span>
                                <span>{sceneProgress?.percent ?? 52}%</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${sceneProgress?.percent ?? 52}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-y-2">
                      <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1">

                        {narrationAudioEnabled ? (
                          <button
                            type="button"
                            disabled={!audioSrc}
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => setSceneFinalPreviewMode(index, 'audio')}
                            className={`flex-1 rounded-2xl px-2.5 py-2 text-[11px] font-black transition ${previewMode === 'audio' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:text-slate-300`}
                          >
                            오디오
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!hasRenderableImage(row)}
                          onMouseDown={preventButtonFocusScroll}
                          onClick={() => {
                            setSceneFinalPreviewMode(index, 'image');
                          }}
                          className={`flex-1 rounded-2xl px-2.5 py-2 text-[11px] font-black transition ${previewMode === 'image' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:text-slate-300`}
                        >
                          이미지
                        </button>
                        <button
                          type="button"
                          disabled={!hasRenderableVideo(row)}
                          onMouseDown={preventButtonFocusScroll}
                          onClick={() => {
                            setSceneFinalPreviewMode(index, 'video');
                          }}
                          className={`flex-1 rounded-2xl px-2.5 py-2 text-[11px] font-black transition ${previewMode === 'video' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:text-slate-300`}
                        >
                          영상
                        </button>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="min-w-0 p-3">
                  <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500"><span className="rounded-full bg-slate-900 px-4 py-1 mr-5 text-xs font-black text-white">씬 {row.sceneNumber}</span>{sceneInlineSettingsOpen[index] ? '씬 설정' : isMuteMode ? '이미지 / 영상 프롬프트' : '문단 내용 / 프롬프트'}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">컷 {formatSeconds(getSceneCutDuration(row, silenceTrim))}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">비율 {row.aspectRatio || '16:9'}</span>
                      {narrationAudioEnabled ? <span className="rounded-full bg-slate-100 px-3 py-1">오디오 {formatSeconds(getAdjustedAudioDuration(row.audioDuration, silenceTrim) || row.audioDuration)}</span> : null}
                    </div>
                  </div>

                  <div className="relative mt-2">
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${sceneInlineSettingsOpen[index] ? 'max-h-0 -translate-y-1 opacity-0 pointer-events-none' : 'max-h-[196px] translate-y-0 opacity-100'}`}>
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {((isMuteMode ? ['image', 'video'] : ['narration', 'image', 'video']) as SceneEditorMode[]).map((mode) => {
                              const selected = editorMode === mode;
                              const tone = sceneEditorMeta[mode];
                              return (
                                <button
                                  key={`${row.sceneNumber}-${mode}`}
                                  type="button"
                                  onMouseDown={preventButtonFocusScroll}
                                  onClick={() => setSceneEditorModes((prev) => ({ ...prev, [index]: mode }))}
                                  className={`rounded-2xl px-3.5 py-2 text-sm font-black transition ${selected ? tone.badgeClass : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {tone.label}
                                </button>
                              );
                            })}
                          </div>
                          {onGenerateEditorContent ? (
                            <button
                              type="button"
                              disabled={isEditorAiGenerating}
                              onMouseDown={preventButtonFocusScroll}
                              onClick={() => {
                                void runSceneAction(editorGenerateKey, async () => {
                                  await Promise.resolve(onGenerateEditorContent(index, editorMode));
                                });
                              }}
                              className="rounded-2xl border border-blue-200 bg-white px-3.5 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {isEditorAiGenerating ? 'AI 생성 중...' : 'AI 생성'}
                            </button>
                          ) : null}
                        </div>

                        <textarea
                          value={editorValue}
                          placeholder={editorMeta.placeholder}
                          disabled={isSceneWorking || isEditorAiGenerating}
                          onChange={(e) => handleSceneEditorChange(row, index, editorMode, e.target.value)}
                          className="mt-2 h-[88px] w-full resize-none overflow-y-auto rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ease-out ${sceneInlineSettingsOpen[index] ? 'max-h-[320px] translate-y-0 opacity-100' : 'max-h-0 translate-y-1 opacity-0 pointer-events-none'}`}>
                      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 auto-rows-fr">
                        <div className="flex min-h-[112px] flex-col rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600">
                            <span>컷 길이</span>
                            <span>{formatSeconds(row.targetDuration)}</span>
                          </div>
                          <input type="range" min={MIN_SCENE_DURATION} max={MAX_SCENE_DURATION} step="0.5" value={Math.min(MAX_SCENE_DURATION, Math.max(MIN_SCENE_DURATION, row.targetDuration || 0))} onChange={(e) => onDurationChange?.(index, Number(e.target.value))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                          <div className="mt-auto pt-2 text-[11px] leading-5 text-slate-500">Step1 비율은 유지하고 컷 길이만 조절합니다.</div>
                        </div>
                        {narrationAudioEnabled ? (
                          <>
                            <div className={`flex min-h-[112px] flex-col rounded-[22px] border px-3 py-3 ${canAdjustSilenceTrim ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/90'}`}>
                              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600"><span>공백 제거</span><span>{silenceTrim}%</span></div>
                              <input type="range" min="0" max="100" step="5" value={silenceTrim} disabled={!canAdjustSilenceTrim} onChange={(e) => setSceneSilenceTrim((prev) => ({ ...prev, [index]: Number(e.target.value) }))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-45" />
                              <div className="mt-auto pt-2 text-[11px] leading-5 text-slate-500">{canAdjustSilenceTrim ? '다음 오디오 생성 전에 무음 구간을 얼마나 줄일지 정합니다.' : '오디오가 만들어진 뒤에만 조절할 수 있습니다.'}</div>
                            </div>
                            <div className={`flex min-h-[112px] flex-col rounded-[22px] border px-3 py-3 ${canAdjustNarrationVolume ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/90'}`}>
                              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600"><span>TTS 볼륨</span><span>{Math.round(narrationVolume * 100)}%</span></div>
                              <input type="range" min="0" max="1.6" step="0.05" value={narrationVolume} disabled={!canAdjustNarrationVolume} onChange={(e) => setSceneNarrationVolumes((prev) => ({ ...prev, [index]: Number(e.target.value) }))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-45" />
                              <div className="mt-auto pt-2 text-[11px] leading-5 text-slate-500">{canAdjustNarrationVolume ? '오디오 확인과 팝업 재생에 바로 반영됩니다. 기본값은 50%입니다.' : '오디오가 만들어져야 볼륨 조절이 열립니다.'}</div>
                            </div>
                          </>
                        ) : null}
                        <div className={`flex min-h-[112px] flex-col rounded-[22px] border px-3 py-3 ${canAdjustVideoAudio ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/90'}`}>
                          <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600"><span>동영상 오디오</span><span>{Math.round(videoAudioVolume * 100)}%</span></div>
                          <input type="range" min="0" max="1" step="0.05" value={videoAudioVolume} disabled={!canAdjustVideoAudio} onChange={(e) => setSceneVideoAudioVolumes((prev) => ({ ...prev, [index]: Number(e.target.value) }))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600 disabled:cursor-not-allowed disabled:opacity-45" />
                          <div className="mt-auto pt-2 text-[11px] leading-5 text-slate-500">{canAdjustVideoAudio ? '영상 원본 오디오가 있을 때만 따로 맞춥니다. 기본값은 50%입니다.' : '영상이 생성된 뒤에만 조절할 수 있습니다.'}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
                        회색으로 잠긴 항목은 아직 조절할 대상이 준비되지 않은 상태입니다. 문단 설정은 미리 열어둘 수 있고, 생성이 끝나면 바로 활성화됩니다.
                      </div>
                      {onApplySceneSettings ? (
                        <button
                          type="button"
                          disabled={isSceneWorking}
                          onMouseDown={preventButtonFocusScroll}
                          onClick={() => {
                            setActiveModelPicker(null);
                            setSceneEditorModes((prev) => ({ ...prev, [index]: 'image' }));
                            setSceneFinalPreviewMode(index, 'video');
                            void runSceneAction(`apply-scene-${index}`, async () => {
                              await Promise.resolve(onApplySceneSettings(index));
                            });
                          }}
                          className="mt-2 w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {isSceneWorking ? '문단 설정 반영 중...' : '해당 내용 적용'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 p-3 xl:border-l xl:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">생성 작업</div>
                    {onDeleteParagraphScene ? (
                      <button
                        type="button"
                        onMouseDown={preventButtonFocusScroll}
                        onClick={() => onDeleteParagraphScene(index)}
                        className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-black text-rose-600 transition hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-2.5">
                                        {narrationAudioEnabled && onRegenerateAudio && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSceneWorking}
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => {
                              setActiveModelPicker(null);
                              setSceneInlineSettingsOpen((prev) => ({ ...prev, [index]: false }));
                              setSceneEditorModes((prev) => ({ ...prev, [index]: 'narration' }));
                              setSceneFinalPreviewMode(index, 'audio');
                              void runSceneAction(`audio-${index}`, async () => {
                                await Promise.resolve(onRegenerateAudio?.(index));
                                window.setTimeout(() => {
                                  appendSceneAudioHistoryEntry(index);
                                }, 0);
                              });
                            }}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            오디오 생성
                          </button>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => setActiveModelPicker({ index, kind: 'audio' })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                            aria-label="오디오 모델 설정"
                          >
                            ⚙
                          </button>
                        </div>
                      </div>
                    )}

                    {onRegenerateImage && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSceneWorking}
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => {
                              setActiveModelPicker(null);
                              setSceneInlineSettingsOpen((prev) => ({ ...prev, [index]: false }));
                              setSceneEditorModes((prev) => ({ ...prev, [index]: 'image' }));
                              setSceneFinalPreviewMode(index, 'image');
                              void runSceneAction(`image-${index}`, async () => {
                                await Promise.resolve(onRegenerateImage?.(index));
                              });
                            }}
                            className="flex-1 rounded-2xl bg-blue-600 px-3 py-3 text-[13px] font-black leading-tight text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                          >
                            {isSceneWorking && row.status === 'generating' && previewMode === 'image' ? '이미지 생성 중...' : '이미지 생성'}
                          </button>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => setActiveModelPicker({ index, kind: 'image' })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                            aria-label="이미지 모델 설정"
                          >
                            ⚙
                          </button>
                        </div>
                      </div>
                    )}

                    {onGenerateAnimation && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSceneWorking || !canGenerateVideo}
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => {
                              setActiveModelPicker(null);
                              setSceneInlineSettingsOpen((prev) => ({ ...prev, [index]: false }));
                              setSceneEditorModes((prev) => ({ ...prev, [index]: 'video' }));
                              setSceneFinalPreviewMode(index, 'video');
                              void runSceneAction(`video-${index}`, async () => {
                                await Promise.resolve(onGenerateAnimation?.(index, { sourceImageData: imageEntry?.data || row.imageData || null }));
                              });
                            }}
                            className="flex-1 rounded-2xl bg-violet-600 px-3 py-3 text-[13px] font-black leading-tight text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                          >
                            {isAnimating ? '영상 생성 중...' : '영상 생성'}
                          </button>
                          <button
                            type="button"
                            onMouseDown={preventButtonFocusScroll}
                            onClick={() => setActiveModelPicker({ index, kind: 'video' })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                            aria-label="영상 모델 설정"
                          >
                            ⚙
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onMouseDown={preventButtonFocusScroll}
                      onClick={() => { setActiveModelPicker(null); setSceneInlineSettingsOpen((prev) => ({ ...prev, [index]: !prev[index] })); }}
                      className={`w-full rounded-2xl border px-3 py-3 text-sm font-bold transition ${sceneInlineSettingsOpen[index] ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      {sceneInlineSettingsOpen[index] ? '문단 설정 닫기' : '문단 설정 열기'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {onAddParagraphScene && (
        <div className={`mt-4 ${activeWorkspaceTab === 'timeline' ? 'hidden' : ''}`}>
          <button
            type="button"
            onClick={() => void onAddParagraphScene?.()}
            className="flex w-full items-center justify-center gap-3 rounded-[24px] border border-dashed border-blue-300 bg-blue-50 px-5 py-5 text-center transition hover:bg-blue-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-2xl font-black text-white">+</span>
            <span className="text-left">
              <span className="block text-sm font-black text-slate-900">문단 추가</span>
              <span className="block text-xs leading-5 text-slate-500">현재 생성된 문단들 맨 아래에 새 씬 카드를 추가합니다.</span>
            </span>
          </button>
        </div>
      )}
    </div>

      {backgroundMusicPickerOpen && backgroundMusicModelSelector ? (
        <AiOptionPickerModal
          open={backgroundMusicPickerOpen}
          title="Step6 배경음 모델"
          description="Settings의 프로젝트 기본 배경음과 별개로, 여기서 선택한 모델은 현재 Step6 배경음 카드에만 적용됩니다."
          currentId={backgroundMusicModelSelector.currentId || backgroundMusicSceneConfig?.modelId || ''}
          options={(backgroundMusicModelSelector.options || []).map((option) => ({
            ...option,
            title: option.title || option.label || option.id,
          }))}
          onClose={() => setBackgroundMusicPickerOpen(false)}
          onSelect={(id) => backgroundMusicModelSelector.onSelect?.(id)}
          requireConfirm
          confirmLabel="이 Step 배경음 모델 적용하기"
          emptyMessage="사용 가능한 배경음 모델이 없습니다."
        />
      ) : activeModelPicker?.kind === 'audio' && audioTtsSelectionFlow ? (
        <TtsSelectionModal
          open={Boolean(activeModelPicker)}
          title={`씬 ${data[activeModelPicker.index]?.sceneNumber} 오디오 / TTS 선택`}
          currentProvider={audioTtsSelectionFlow.currentProvider}
          currentModelId={audioTtsSelectionFlow.currentModelId}
          currentVoiceId={audioTtsSelectionFlow.currentVoiceId}
          googleApiKey={audioTtsSelectionFlow.googleApiKey}
          elevenLabsApiKey={audioTtsSelectionFlow.elevenLabsApiKey}
          hasElevenLabsApiKey={audioTtsSelectionFlow.hasElevenLabsApiKey}
          allowPaid={Boolean(audioTtsSelectionFlow.hasElevenLabsApiKey)}
          elevenLabsVoices={audioTtsSelectionFlow.elevenLabsVoices}
          voiceReferenceAudioData={audioTtsSelectionFlow.voiceReferenceAudioData}
          voiceReferenceMimeType={audioTtsSelectionFlow.voiceReferenceMimeType}
          voiceReferenceName={audioTtsSelectionFlow.voiceReferenceName}
          onApply={audioTtsSelectionFlow.onApply}
          onClose={() => setActiveModelPicker(null)}
        />
      ) : activeModelPicker && getModelSelector(activeModelPicker.kind) ? (
        <AiOptionPickerModal
          open={Boolean(activeModelPicker)}
          title={activeModelPicker.kind === 'image' ? `씬 ${data[activeModelPicker.index]?.sceneNumber} 이미지 모델` : activeModelPicker.kind === 'video' ? `씬 ${data[activeModelPicker.index]?.sceneNumber} 영상 모델` : `씬 ${data[activeModelPicker.index]?.sceneNumber} 오디오 / TTS 선택`}
          description={activeModelPicker.kind === 'audio'
            ? '비용 단계와 음성 느낌을 비교해서 고르세요. 미리듣기가 있으면 확인한 뒤 선택하면 됩니다.'
            : '비용과 품질을 한 화면에서 비교할 수 있는 공통 카드 선택기입니다.'}
          currentId={getModelSelector(activeModelPicker.kind)?.currentId || ''}
          options={(getModelSelector(activeModelPicker.kind)?.options || []).map((option) => ({
            ...option,
            title: option.title || option.label || option.id,
          }))}
          onClose={() => setActiveModelPicker(null)}
          onSelect={(id) => getModelSelector(activeModelPicker.kind)?.onSelect?.(id)}
          requireConfirm
          confirmLabel={activeModelPicker.kind === 'audio' ? '이 오디오 설정 선택하기' : activeModelPicker.kind === 'image' ? '이 이미지 모델 선택하기' : '이 영상 모델 선택하기'}
        />
      ) : null}

      {mediaViewer && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setMediaViewer(null)}>
          <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{mediaViewer.kind === 'image' ? '이미지 보기' : '영상 보기'}</div>
                <div className="mt-1 text-lg font-black text-slate-900">씬 {mediaViewer.sceneNumber} 생성 이력</div>
              </div>
              <button type="button" onClick={() => setMediaViewer(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            </div>
            <div className="grid flex-1 gap-0 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="flex items-center justify-center bg-slate-950 p-4">
                {mediaViewer.kind === 'image' ? (
                  <img src={getDisplayImageSrc(resolveImageSrc(mediaViewer.entries[mediaViewer.currentIndex]?.data))} alt={`씬 ${mediaViewer.sceneNumber} 이미지`} className={`${getAspectRatioClass(mediaViewer.aspectRatio || '16:9')} max-h-[72vh] max-w-full rounded-[24px] object-contain`} />
                ) : (
                  <video key={resolveVideoSrc(mediaViewer.entries[mediaViewer.currentIndex]?.data)} src={resolveVideoSrc(mediaViewer.entries[mediaViewer.currentIndex]?.data)} controls className="max-h-[72vh] w-full rounded-[24px] border border-slate-800 bg-black" />
                )}
              </div>
              <div className="overflow-y-auto border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">생성본 {mediaViewer.currentIndex + 1}/{mediaViewer.entries.length}</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMediaViewer((prev) => prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : prev)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">←</button>
                    <button type="button" onClick={() => setMediaViewer((prev) => prev ? { ...prev, currentIndex: Math.min(prev.entries.length - 1, prev.currentIndex + 1) } : prev)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">→</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {mediaViewer.entries.map((entry, entryIndex) => {
                    const active = entryIndex === mediaViewer.currentIndex;
                    return (
                      <button key={entry.id} type="button" onClick={() => setMediaViewer((prev) => prev ? { ...prev, currentIndex: entryIndex } : prev)} className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">{entry.label || `${mediaViewer.kind === 'image' ? '이미지' : '영상'} ${entryIndex + 1}`}</div>
                            <div className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry.sourceMode === 'ai' ? 'AI 결과' : '샘플 / 대체본'}</div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{active ? '보는 중' : `#${entryIndex + 1}`}</span>
                        </div>
                        {mediaViewer.kind === 'image' ? (
                          <img src={getDisplayImageSrc(resolveImageSrc(entry.data))} alt="이력 썸네일" className={`${getAspectRatioClass(mediaViewer.aspectRatio || '16:9')} mt-3 w-full rounded-xl object-cover`} />
                        ) : (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-900/95 p-3 text-xs font-bold text-slate-200">영상 생성본은 왼쪽 플레이어에서 바로 재생됩니다.</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mediaLightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setMediaLightbox(null)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{mediaLightbox.kind === 'video' ? '영상 크게 보기' : mediaLightbox.kind === 'audio' ? '오디오 확인' : '이미지 크게 보기'}</div>
                <div className="mt-1 text-lg font-black text-slate-900">{mediaLightbox.title}</div>
              </div>
              <button type="button" onClick={() => setMediaLightbox(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              {mediaLightbox.kind === 'video' ? (
                <video
                  key={mediaLightbox.src}
                  src={mediaLightbox.src}
                  className={`${getAspectRatioClass(mediaLightbox.aspectRatio || '16:9')} mx-auto max-h-[74vh] max-w-full rounded-2xl object-contain`}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : mediaLightbox.kind === 'audio' ? (
                <audio className="w-full max-w-xl" controls>
                  <source src={mediaLightbox.src} type="audio/mpeg" />
                </audio>
              ) : (
                <img src={mediaLightbox.src} alt={mediaLightbox.title} className={`${getAspectRatioClass(mediaLightbox.aspectRatio || '16:9')} mx-auto max-h-[74vh] max-w-full rounded-2xl object-contain`} />
              )}
            </div>
          </div>
        </div>
      )}


      <SceneStudioPreviewPage
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        currentTopic={currentTopic}
        data={previewModalData}
        summary={previewModalSummary}
        totalDuration={previewModalDuration}
        progressMessage={progressMessage}
        activeOverallProgress={activeOverallProgress}
        progressLabel={progressLabel}
        previewRenderEstimatedTotalSeconds={previewRenderEstimatedTotalSeconds}
        previewRenderEstimatedRemainingSeconds={previewRenderEstimatedRemainingSeconds}
        previewVideoTone={previewVideoTone}
        previewVideoStatus={previewVideoStatus}
        previewVideoMessage={previewVideoMessage}
        finalVideoUrl={finalVideoUrl}
        finalVideoTitle={finalVideoTitle}
        finalVideoDuration={finalVideoDuration}
        onPreparePreviewVideo={onPreparePreviewVideo}
        isPreparingPreviewVideo={isPreparingPreviewVideo}
        onExportVideo={onExportVideo}
        downloadQuality={downloadQuality}
        isExporting={isExporting}
        sequencePlaying={sequencePlaying}
        sequenceScene={sequenceScene}
        sequenceSceneIndex={sequenceSceneIndex}
        sequenceSceneDuration={sequenceSceneDuration}
        sequenceSceneAudioRate={sequenceSceneAudioRate}
        previewSequenceVideoRef={previewSequenceVideoRef}
        previewSequenceAudioRef={previewSequenceAudioRef}
        onToggleSequencePlayback={() => {
          if (sequencePlaying) {
            stopSequencePlayback();
          } else {
            startSequencePlayback(false);
          }
        }}
        onSelectSequenceScene={(queueIndex) => {
          setSequenceSceneIndex(queueIndex);
          setSequenceRunId((prev) => prev + 1);
        }}
        onSequenceAudioPlay={(element) => applyAudioPlaybackRate(element, sequenceSceneAudioRate)}
        onSequenceAudioLoadedMetadata={(element) => applyAudioPlaybackRate(element, sequenceSceneAudioRate)}
        onSequenceAudioEnded={() => {
          if (sequencePlaying) {
            advanceSequencePlayback();
          }
        }}
        previewMix={previewMix}
        onPreviewMixChange={onPreviewMixChange}
        mainBgm={mainBgm}
        backgroundMusicTracks={backgroundMusicTracks}
        onSelectBackgroundTrack={onSelectBackgroundTrack}
        onCreateBackgroundTrack={onCreateBackgroundTrack}
        bgmAudioRef={bgmAudioRef}
        thumbnailToolbarRef={thumbnailToolbarRef}
        onGenerateThumbnail={onGenerateThumbnail}
        isThumbnailGenerating={isThumbnailGenerating}
        onGenerateAllImages={onGenerateAllImages}
        onGenerateAllVideos={onGenerateAllVideos}
        isGeneratingAllVideos={isGeneratingAllVideos}
        isGenerating={isGenerating}
        sceneProgressMap={sceneProgressMap}
        getSceneVisualPayload={getSceneVisualPayload}
        getDisplayImageSrc={getDisplayImageSrc}
        getPreferredVisualType={getPreferredVisualType}
        onOpenMediaLightbox={(lightbox) => setMediaLightbox(lightbox)}
      />

      {shouldShowFooter && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-3 shadow-xl shadow-slate-200/70 backdrop-blur-md">
            {onFooterBack && (
              <button
                type="button"
                onClick={onFooterBack}
                className="min-w-[120px] rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                {footerBackLabel || '이전으로'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange(activeWorkspaceTab === 'timeline' ? 'scene' : 'timeline')}
              className={`min-w-[140px] rounded-full border px-6 py-3 text-sm font-black transition ${activeWorkspaceTab === 'timeline' ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {activeWorkspaceTab === 'timeline' ? '씬 편집 보기' : '타임라인 보기'}
            </button>
            {timelineRangePreview ? (
              <button
                type="button"
                onClick={() => {
                  setSequenceSceneIndex(0);
                  void openPreviewModal('range');
                }}
                disabled={isResultPreviewLocked}
                title={isResultPreviewLocked ? resultPreviewLockMessage : '선택 범위 미리보기'}
                className="min-w-[140px] rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
              >
                범위 미리보기
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSequenceSceneIndex(0);
                void openPreviewModal('all');
              }}
              disabled={isResultPreviewLocked}
              title={isResultPreviewLocked ? resultPreviewLockMessage : '결과 미리보기'}
              className="min-w-[140px] rounded-full bg-slate-900 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
            >
              {isResultPreviewLocked ? '생성 완료 후 미리보기' : previewSelectionMode === 'range' ? '전체 미리보기' : '결과 미리보기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultTable;
