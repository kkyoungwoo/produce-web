'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetHistoryItem, BackgroundMusicTrack, CostBreakdown, GeneratedAsset, PreviewMixSettings } from '../types';
import { getAspectRatioClass } from '../utils/aspectRatio';
import { getAspectRatioPreviewClass } from '../config/workflowUi';
import { handleHorizontalWheel, scrollContainerBy, scrollElementIntoView } from '../utils/horizontalScroll';
import { exportAssetsToZip } from '../services/exportService';
import { downloadProjectZip } from '../utils/csvHelper';
import { downloadSrt } from '../services/srtService';
import { prepareDavinciResolveImport, saveDavinciResolvePackageZip } from '../services/davinciResolveService';
import HelpTip from './HelpTip';
import { blobFromDataValue, extensionFromMime, triggerSequentialDownloads } from '../utils/downloadHelpers';

type PreviewVideoStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
type SceneEditorMode = 'narration' | 'image' | 'video';

interface ResultTableProps {
  data: GeneratedAsset[];
  onRegenerateImage?: (index: number) => void;
  onRegenerateAudio?: (index: number) => void;
  onExportVideo?: (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => void;
  onGenerateAnimation?: (index: number, options?: { sourceImageData?: string | null }) => void | Promise<void>;
  onNarrationChange?: (index: number, narration: string) => void;
  onImagePromptChange?: (index: number, prompt: string) => void;
  onVideoPromptChange?: (index: number, prompt: string) => void;
  onSelectedVisualTypeChange?: (index: number, mode: 'image' | 'video') => void;
  onDurationChange?: (index: number, duration: number) => void;
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
  currentTopic?: string;
  totalCost?: CostBreakdown;
  isGenerating?: boolean;
  progressMessage?: string;
  progressPercent?: number | null;
  progressLabel?: string;
  sceneProgressMap?: Record<number, { percent: number; label: string }>;
  finalVideoUrl?: string | null;
  finalVideoTitle?: string;
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
}

const formatSeconds = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}초` : '-');
const MAX_SCENE_DURATION = 6;

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
  return value.startsWith('data:') ? value : `data:audio/wav;base64,${value}`;
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
  const current: AssetHistoryItem[] = currentData ? [{
    id: `${kind}_current_${row.sceneNumber}`,
    kind,
    data: currentData,
    sourceMode: row.sourceMode === 'ai' ? 'ai' : 'sample',
    createdAt: Date.now(),
    label: kind === 'image' ? '현재 사용 중 이미지' : '현재 사용 중 영상',
  }] : [];
  const history = (kind === 'image' ? row.imageHistory : row.videoHistory) || [];
  const deduped: AssetHistoryItem[] = [];
  const seen = new Set<string>();
  [...current, ...history].forEach((item) => {
    if (!item?.data || seen.has(item.data)) return;
    seen.add(item.data);
    deduped.push(item);
  });
  return deduped;
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
  onRegenerateAudio,
  onExportVideo,
  onGenerateAnimation,
  onNarrationChange,
  onImagePromptChange,
  onVideoPromptChange,
  onSelectedVisualTypeChange,
  onDurationChange,
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
  currentTopic,
  totalCost,
  isGenerating,
  progressMessage,
  progressPercent,
  progressLabel,
  sceneProgressMap,
  finalVideoUrl,
  finalVideoTitle,
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
}) => {
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [davinciStatusMessage, setDavinciStatusMessage] = useState('');
  const [davinciPackagePath, setDavinciPackagePath] = useState<string | null>(null);
  const [davinciLaunchUri, setDavinciLaunchUri] = useState<string | null>(null);
  const [isDavinciPreparing, setIsDavinciPreparing] = useState(false);
  const downloadQuality: 'preview' | 'final' = 'final';
  const [sequenceSceneIndex, setSequenceSceneIndex] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [sequenceRunId, setSequenceRunId] = useState(0);
  const [imageLightbox, setImageLightbox] = useState<{ src: string; title: string; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ kind: 'image' | 'video'; sceneNumber: number; entries: AssetHistoryItem[]; currentIndex: number; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSequenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSequenceVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewSequenceTimerRef = useRef<number | null>(null);
  const bgmStripRef = useRef<HTMLDivElement | null>(null);
  const sceneStripRef = useRef<HTMLDivElement | null>(null);
  const sceneCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sceneMediaStripRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAutoFocusedSceneRef = useRef<number | null>(null);
  const [previewImageMap, setPreviewImageMap] = useState<Record<string, string>>({});
  const [sceneEditorModes, setSceneEditorModes] = useState<Record<number, SceneEditorMode>>({});
  const [sceneAudioRates, setSceneAudioRates] = useState<Record<number, number>>({});
  const [sceneMediaIndices, setSceneMediaIndices] = useState<Record<string, number>>({});
  const [sceneMediaShift, setSceneMediaShift] = useState<Record<string, number>>({});
  const [sceneActionLocks, setSceneActionLocks] = useState<Record<string, boolean>>({});
  const sceneActionLocksRef = useRef<Record<string, boolean>>({});
  const previewQueueRef = useRef<Set<string>>(new Set());

  const summary = useMemo(() => {
    const imageCount = data.filter((item) => item.imageData).length;
    const audioCount = data.filter((item) => item.audioData).length;
    const videoCount = data.filter((item) => item.videoData).length;
    return { imageCount, audioCount, videoCount };
  }, [data]);

  const totalDuration = useMemo(() => data.reduce((sum, item) => sum + (item.targetDuration || item.audioDuration || 0), 0), [data]);

  const mainBgm = useMemo(() => {
    if (!backgroundMusicTracks.length) return null;
    return backgroundMusicTracks.find((item) => item.id === activeBackgroundTrackId) || backgroundMusicTracks[0];
  }, [backgroundMusicTracks, activeBackgroundTrackId]);

  const handlePrepareDavinciImport = async () => {
    setIsDavinciPreparing(true);
    setDavinciPackagePath(null);
    setDavinciLaunchUri(null);
    setDavinciStatusMessage(storageDir?.trim() ? '다빈치 리졸브용 패키지를 로컬 폴더로 정리하고 자동 Import를 시도하는 중입니다.' : '저장 위치가 없어 자동 Import 대신 정리된 ZIP 패키지를 준비합니다.');
    try {
      const result = await prepareDavinciResolveImport({ assets: data, topic: currentTopic || 'mp4Creater', backgroundTracks: backgroundMusicTracks, previewMix, storageDir, projectId, projectNumber });
      setDavinciPackagePath(result.packagePath || null);
      setDavinciLaunchUri(result.launchUri || null);
      if (result.mode === 'zip') {
        setDavinciStatusMessage(`자동 Import에 필요한 로컬 저장 위치가 없거나 패키지가 커서, ${result.downloadFilename || '다빈치 패키지 ZIP'}을 바로 저장했습니다. 압축을 풀고 번호 순서대로 media / audio / subtitles를 드래그하면 됩니다.`);
        return;
      }
      if (result.launchSucceeded) {
        setDavinciStatusMessage(`다빈치 리졸브 자동 Import 신호를 보냈습니다. 패키지 경로는 ${result.packagePath || '로컬 exports 폴더'}입니다.`);
        return;
      }
      setDavinciStatusMessage(`패키지는 준비됐지만 mp4Creater 다빈치 브리지를 찾지 못했습니다. ${result.packagePath || 'exports/davinci-resolve'} 폴더를 다빈치로 드래그하거나, open_with_mp4creater_bridge 파일을 나중에 다시 실행해 주세요.`);
    } catch (error) {
      setDavinciStatusMessage(error instanceof Error ? error.message : '다빈치 리졸브 패키지 준비에 실패했습니다.');
      setDavinciPackagePath(null);
      setDavinciLaunchUri(null);
    } finally { setIsDavinciPreparing(false); }
  };

  const handleDownloadDavinciPackage = async () => {
    setIsDavinciPreparing(true);
    setDavinciStatusMessage('정리된 다빈치 리졸브 ZIP 패키지를 만드는 중입니다.');
    setDavinciPackagePath(null);
    setDavinciLaunchUri(null);
    try {
      const result = await saveDavinciResolvePackageZip({ assets: data, topic: currentTopic || 'mp4Creater', backgroundTracks: backgroundMusicTracks, previewMix, storageDir, projectId, projectNumber });
      setDavinciStatusMessage(`${result.downloadFilename || '다빈치 패키지 ZIP'} 저장을 시작했습니다. 압축을 풀면 번호 순서가 맞춰진 media / audio / subtitles 폴더가 들어 있습니다.`);
    } catch (error) {
      setDavinciStatusMessage(error instanceof Error ? error.message : '다빈치 패키지 ZIP 저장에 실패했습니다.');
    } finally { setIsDavinciPreparing(false); }
  };

  const sequenceScene = data[sequenceSceneIndex] || null;
  const sequenceSceneAudioRate = sceneAudioRates[sequenceSceneIndex] || 1;
  const sequenceSceneDuration = Math.max((sequenceScene?.audioDuration || 0) / sequenceSceneAudioRate, sequenceScene?.targetDuration || 0, 3);

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
    if (!data.length) return;
    if (restart) setSequenceSceneIndex(0);
    setSequenceRunId((prev) => prev + 1);
    setSequencePlaying(true);
  };

  const advanceSequencePlayback = () => {
    if (sequenceSceneIndex >= data.length - 1) {
      stopSequencePlayback();
      setSequenceSceneIndex(Math.max(0, data.length - 1));
      return;
    }
    setSequenceSceneIndex((prev) => Math.min(data.length - 1, prev + 1));
    setSequenceRunId((prev) => prev + 1);
  };

  const activeOverallProgress = typeof progressPercent === 'number'
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : null;

  const activeSceneIndex = useMemo(() => data.findIndex((row, index) => {
    const sceneProgress = sceneProgressMap?.[index];
    return Boolean(animatingIndices?.has(index) || row.status === 'generating' || (sceneProgress && sceneProgress.percent < 100));
  }), [animatingIndices, data, sceneProgressMap]);

  const displayedScenes = data;

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

  const getDisplayImageSrc = (src: string) => previewImageMap[src] || src;

  const getSceneEditorMode = (_row: GeneratedAsset, index: number): SceneEditorMode => {
    const savedMode = sceneEditorModes[index];
    if (savedMode) return savedMode;
    return 'narration';
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


  const getSceneAudioRate = (index: number) => sceneAudioRates[index] || 1;

  const applyAudioPlaybackRate = (element: HTMLAudioElement | null, rate: number) => {
    if (!element) return;
    element.playbackRate = rate;
    element.defaultPlaybackRate = rate;
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

  const scrollToSceneCard = (index: number) => {
    const target = sceneCardRefs.current[index];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const togglePanel = (key: string) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openPreviewAtScene = (index: number, autoplay: boolean = true) => {
    setPreviewOpen(true);
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
    if (isGenerating) return;
    if (activeSceneIndex < 0 || lastAutoFocusedSceneRef.current === activeSceneIndex) return;
    lastAutoFocusedSceneRef.current = activeSceneIndex;
    const target = sceneCardRefs.current[activeSceneIndex];
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [activeSceneIndex, isGenerating]);

  useEffect(() => {
    if (!previewOpen) return;
    if (finalVideoUrl) return;
    if (!onPreparePreviewVideo) return;
    if (isPreparingPreviewVideo) return;
    void onPreparePreviewVideo();
  }, [finalVideoUrl, isPreparingPreviewVideo, onPreparePreviewVideo, previewOpen]);

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

    if (narrationAudio) {
      narrationAudio.currentTime = 0;
      narrationAudio.volume = previewMix?.narrationVolume || 1;
      void narrationAudio.play().catch(() => {});
    }

    if (bgmAudio && mainBgm?.audioData) {
      bgmAudio.loop = true;
      bgmAudio.volume = previewMix?.backgroundMusicVolume || mainBgm.volume || 0.28;
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
  }, [mainBgm?.audioData, mainBgm?.volume, previewMix, previewOpen, sequencePlaying, sequenceRunId, sequenceScene, sequenceSceneDuration]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full px-0 pb-20">
      <div className="mp4-glass-panel rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-slate-900">{currentTopic || '프로젝트'}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-2">씬 {data.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">이미지 {summary.imageCount}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">영상 {summary.videoCount}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">총 {formatSeconds(totalDuration)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className={`${getAspectRatioPreviewClass(data[0]?.aspectRatio || '16:9', true)} overflow-hidden rounded-xl border border-slate-200 bg-white`} />
                <div className="text-sm font-black text-slate-900">{data[0]?.aspectRatio || '16:9'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">최종 출력</div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">미리보기</button>
            {onGenerateAllImages && (
              <button type="button" onClick={() => void onGenerateAllImages?.()} disabled={isGenerating} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isGenerating ? '이미지 생성 중...' : '전체 이미지 생성'}</button>
            )}
            {onGenerateAllVideos && (
              <button type="button" onClick={() => void onGenerateAllVideos?.()} disabled={Boolean(isGeneratingAllVideos) || isGenerating} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500">{isGeneratingAllVideos ? '영상 생성 중...' : '전체 영상 생성'}</button>
            )}
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            이미지 {totalCost.imageCount}장 · TTS {totalCost.ttsCharacters}자 · 영상 {totalCost.videoCount}개
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
                <span>{Math.round((previewMix?.narrationVolume || 1) * 100)}%</span>
              </div>
              <input type="range" min="0" max="1.6" step="0.05" value={previewMix?.narrationVolume || 1} onChange={(e) => onPreviewMixChange?.({ ...(previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 }), narrationVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900">
                <span>배경음 볼륨</span>
                <span>{Math.round((previewMix?.backgroundMusicVolume || mainBgm?.volume || 0.28) * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.02" value={previewMix?.backgroundMusicVolume || mainBgm?.volume || 0.28} onChange={(e) => onPreviewMixChange?.({ ...(previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 }), backgroundMusicVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
            </div>
          </div>

          {backgroundMusicTracks.length > 0 && (
            <div className="mt-4">
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
                              bgmAudioRef.current.volume = previewMix?.backgroundMusicVolume || track.volume || 0.28;
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

      <div className="mt-4 space-y-3">
        {displayedScenes.map((row, index) => {
          const imageSrc = resolveImageSrc(row.imageData);
          const audioSrc = resolveNarrationAudioSrc(row.audioData);
          const isAnimating = animatingIndices?.has(index) || false;
          const sceneProgress = sceneProgressMap?.[index] || null;
          const isSceneWorking = Boolean(sceneActionLocks[`image-${index}`] || sceneActionLocks[`video-${index}`] || sceneActionLocks[`audio-${index}`]) || isAnimating || row.status === 'generating' || Boolean(sceneProgress && sceneProgress.percent < 100);
          const editorMode = getSceneEditorMode(row, index);
          const editorMeta = sceneEditorMeta[editorMode];
          const editorValue = getSceneEditorValue(row, editorMode);
          const selectedVisualType = getPreferredVisualType(row);
          const activeHistoryKind = selectedVisualType === 'video' && hasRenderableVideo(row) ? 'video' : 'image';
          const visualEntries = collectOrderedMediaHistory(row, activeHistoryKind);
          const visualEntryIndex = getSceneMediaIndex(index, activeHistoryKind, visualEntries.length);
          const visualEntry = visualEntries[visualEntryIndex] || null;
          const visualPayload = activeHistoryKind === 'video'
            ? { kind: 'video' as const, src: resolveVideoSrc(visualEntry?.data || row.videoData) }
            : { kind: 'image' as const, src: resolveImageSrc(visualEntry?.data || row.imageData) };
          const displayImageSrc = visualPayload.kind === 'image' && visualPayload.src ? getDisplayImageSrc(visualPayload.src) : '';
          const sceneMediaKey = getSceneMediaKey(index, activeHistoryKind);
          const sceneMediaOffset = sceneMediaShift[sceneMediaKey] || 0;
          const hasPrevVisualEntry = visualEntryIndex > 0;
          const hasNextVisualEntry = visualEntryIndex < visualEntries.length - 1;

          return (
            <div
              key={`${row.sceneNumber}-${index}`}
              ref={(node) => {
                sceneCardRefs.current[index] = node;
              }}
              className={`overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all duration-300 ${activeSceneIndex === index ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <div className="flex flex-col xl:grid xl:h-[300px] xl:grid-cols-[232px_minmax(0,1fr)_186px]">
                <div className="border-b border-slate-200 bg-slate-50 p-3 xl:border-b-0 xl:border-r">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">씬 {row.sceneNumber}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${selectedVisualType === 'video' && row.videoData ? 'bg-emerald-100 text-emerald-700' : row.imageData ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>{selectedVisualType === 'video' && row.videoData ? '영상' : row.imageData ? '이미지' : '빈 씬'}</span>
                  </div>

                  <div className="group/scene-preview relative flex h-[190px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white px-2 py-2 xl:h-[172px]">
                    {visualPayload.kind === 'video' && visualPayload.src ? (
                      <video className="max-h-full max-w-full rounded-2xl object-contain transition-all duration-200" style={{ transform: `translateX(${sceneMediaOffset * 10}px)`, opacity: 1 }} playsInline muted controls preload="metadata">
                        <source src={visualPayload.src} type="video/mp4" />
                      </video>
                    ) : displayImageSrc ? (
                      <button type="button" onClick={() => setImageLightbox({ src: displayImageSrc, title: `씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })} className="block text-left">
                        <img src={displayImageSrc} alt={`씬 ${row.sceneNumber}`} className={`max-h-full max-w-full rounded-2xl object-contain transition-all duration-200 hover:scale-[1.01] ${isSceneWorking ? 'opacity-70' : ''}`} style={{ transform: `translateX(${sceneMediaOffset * 10}px)` }} />
                      </button>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">빈 씬</div>
                    )}
                    {isSceneWorking && (
                      <div className="absolute inset-0 flex flex-col justify-end bg-white/75 p-4 backdrop-blur-[1px]">
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
                    {visualEntries.length > 1 && !isSceneWorking && (hasPrevVisualEntry || hasNextVisualEntry) && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-100 transition-opacity duration-200">
                        {hasPrevVisualEntry ? (
                          <button type="button" onClick={() => shiftSceneMediaIndex(index, activeHistoryKind, visualEntries.length, -1)} className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-black text-slate-700 shadow-sm hover:bg-white">←</button>
                        ) : <span className="h-8 w-8" aria-hidden="true" />}
                        <div className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm">{visualEntryIndex + 1}/{visualEntries.length}</div>
                        {hasNextVisualEntry ? (
                          <button type="button" onClick={() => shiftSceneMediaIndex(index, activeHistoryKind, visualEntries.length, 1)} className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-black text-slate-700 shadow-sm hover:bg-white">→</button>
                        ) : <span className="h-8 w-8" aria-hidden="true" />}
                      </div>
                    )}
                  </div>
                  {visualEntries.length > 0 && (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-2 px-1 pb-2 text-[11px] font-bold text-slate-600">
                        <span>{activeHistoryKind === 'video' ? '영상 히스토리' : '이미지 히스토리'} · 오른쪽으로 누적</span>
                        <div className="flex items-center gap-2">
                          {hasPrevVisualEntry ? (
                            <button type="button" onClick={() => shiftSceneMediaIndex(index, activeHistoryKind, visualEntries.length, -1)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100">←</button>
                          ) : null}
                          <span>{visualEntry?.label || `생성본 ${visualEntryIndex + 1}`}</span>
                          {hasNextVisualEntry ? (
                            <button type="button" onClick={() => shiftSceneMediaIndex(index, activeHistoryKind, visualEntries.length, 1)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100">→</button>
                          ) : null}
                        </div>
                      </div>
                      <div
                        ref={(node) => {
                          sceneMediaStripRefs.current[sceneMediaKey] = node;
                        }}
                        onWheel={(event) => handleHorizontalWheel(event, 0.9)}
                        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {visualEntries.map((entry, entryIndex) => {
                          const selectedEntry = entryIndex === visualEntryIndex;
                          const entryImageSrc = activeHistoryKind === 'image' ? getDisplayImageSrc(resolveImageSrc(entry.data)) : '';
                          const entryVideoSrc = activeHistoryKind === 'video' ? resolveVideoSrc(entry.data) : '';
                          return (
                            <button
                              key={entry.id || `${sceneMediaKey}-${entryIndex}`}
                              type="button"
                              data-scene-media-card={`${sceneMediaKey}-${entryIndex}`}
                              onClick={() => {
                                setSceneMediaIndices((prev) => ({ ...prev, [sceneMediaKey]: entryIndex }));
                              }}
                              className={`w-[110px] shrink-0 overflow-hidden rounded-2xl border text-left transition ${selectedEntry ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                            >
                              <div className={`flex h-[72px] items-center justify-center overflow-hidden ${activeHistoryKind === 'video' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                {activeHistoryKind === 'video' && entryVideoSrc ? (
                                  <video className="h-full w-full object-cover" playsInline muted preload="metadata">
                                    <source src={entryVideoSrc} type="video/mp4" />
                                  </video>
                                ) : entryImageSrc ? (
                                  <img src={entryImageSrc} alt={entry.label || `씬 ${row.sceneNumber} 미디어 ${entryIndex + 1}`} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="px-2 text-center text-[10px] font-black text-slate-400">미리보기 없음</div>
                                )}
                              </div>
                              <div className="space-y-1 px-2 py-2">
                                <div className="truncate text-[11px] font-black text-slate-800">{entry.label || `생성본 ${entryIndex + 1}`}</div>
                                <div className="text-[10px] text-slate-500">{entry.sourceMode === 'sample' ? '샘플' : 'AI'} · {entryIndex + 1}/{visualEntries.length}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      disabled={!hasRenderableImage(row)}
                      onClick={() => onSelectedVisualTypeChange?.(index, 'image')}
                      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-black transition ${selectedVisualType === 'image' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:text-slate-300`}
                    >
                      이미지
                    </button>
                    <button
                      type="button"
                      disabled={!hasRenderableVideo(row)}
                      onClick={() => onSelectedVisualTypeChange?.(index, 'video')}
                      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-black transition ${selectedVisualType === 'video' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:text-slate-300`}
                    >
                      영상
                    </button>
                  </div>
                </div>

                <div className="min-w-0 p-3 xl:grid xl:h-[300px] xl:grid-rows-[auto_98px_auto] xl:gap-2 xl:overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    {(['narration', 'image', 'video'] as SceneEditorMode[]).map((mode) => {
                      const selected = editorMode === mode;
                      const tone = sceneEditorMeta[mode];
                      return (
                        <button
                          key={`${row.sceneNumber}-${mode}`}
                          type="button"
                          onClick={() => setSceneEditorModes((prev) => ({ ...prev, [index]: mode }))}
                          className={`rounded-2xl px-4 py-2 text-sm font-black transition ${selected ? tone.badgeClass : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                          {tone.label}
                        </button>
                      );
                    })}
                    <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">컷 {formatSeconds(row.targetDuration)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">오디오 {formatSeconds(row.audioDuration)}</span>
                  </div>

                  <textarea
                    value={editorValue}
                    placeholder={editorMeta.placeholder}
                    disabled={isSceneWorking}
                    onChange={(e) => handleSceneEditorChange(row, index, editorMode, e.target.value)}
                    className="min-h-[96px] w-full resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400 xl:h-[98px]"
                  />

                  <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                        <span>컷 길이</span>
                        <span>{formatSeconds(row.targetDuration)}</span>
                      </div>
                      <input type="range" min="3" max={MAX_SCENE_DURATION} step="0.5" value={Math.min(MAX_SCENE_DURATION, row.targetDuration || 5)} onChange={(e) => onDurationChange?.(index, Number(e.target.value))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-600">
                        <span>오디오</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={String(getSceneAudioRate(index))}
                            onChange={(e) => setSceneAudioRates((prev) => ({ ...prev, [index]: Number(e.target.value) }))}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-700 outline-none"
                          >
                            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                              <option key={`audio-rate-${index}-${rate}`} value={rate}>{rate}x</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => togglePanel(`audio-${index}`)} className={`rounded-full px-3 py-1 ${openPanels[`audio-${index}`] ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{openPanels[`audio-${index}`] ? '숨김' : '열기'}</button>
                        </div>
                      </div>
                      {openPanels[`audio-${index}`] ? (
                        audioSrc ? (
                          <audio
                            controls
                            className="mt-2 w-full"
                            ref={(node) => applyAudioPlaybackRate(node, getSceneAudioRate(index))}
                            onPlay={(event) => applyAudioPlaybackRate(event.currentTarget, getSceneAudioRate(index))}
                          >
                            <source src={audioSrc} type="audio/mpeg" />
                          </audio>
                        ) : (
                          <div className="mt-2 text-sm text-slate-500">오디오가 아직 없습니다.</div>
                        )
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">{row.audioData ? `오디오 ${formatSeconds(row.audioDuration)} · ${getSceneAudioRate(index)}x` : '오디오 없음'}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 p-3 xl:border-l xl:border-t-0 xl:overflow-hidden">
                  <div className="grid h-full auto-rows-fr grid-cols-2 gap-2 xl:grid-cols-1">
                    {onRegenerateImage && (
                      <button type="button" disabled={isSceneWorking} onClick={() => { void runSceneAction(`image-${index}`, async () => { await Promise.resolve(onRegenerateImage?.(index)); }); }} className="rounded-2xl bg-blue-600 px-3 py-2.5 text-[13px] font-black leading-tight text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                        {row.imageData ? '이미지 다시 생성' : '이미지 생성'}
                      </button>
                    )}
                    {onGenerateAnimation && (
                      <button type="button" disabled={isSceneWorking || !row.imageData} onClick={() => { void runSceneAction(`video-${index}`, async () => { await Promise.resolve(onGenerateAnimation?.(index, { sourceImageData: activeHistoryKind === 'image' ? (visualEntry?.data || row.imageData || null) : (row.imageData || null) })); }); }} className="rounded-2xl bg-violet-600 px-3 py-2.5 text-[13px] font-black leading-tight text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                        {isAnimating ? '영상 생성 중...' : '영상 생성'}
                      </button>
                    )}
                    {onRegenerateAudio && (
                      <button type="button" disabled={isSceneWorking} onClick={() => { void runSceneAction(`audio-${index}`, async () => { await Promise.resolve(onRegenerateAudio?.(index)); }); }} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">오디오 생성</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

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
                  <video controls className="max-h-[72vh] w-full rounded-[24px] border border-slate-800 bg-black">
                    <source src={resolveVideoSrc(mediaViewer.entries[mediaViewer.currentIndex]?.data)} type="video/mp4" />
                  </video>
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

      {imageLightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setImageLightbox(null)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">이미지 크게 보기</div>
                <div className="mt-1 text-lg font-black text-slate-900">{imageLightbox.title}</div>
              </div>
              <button type="button" onClick={() => setImageLightbox(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              <img src={imageLightbox.src} alt={imageLightbox.title} className={`${getAspectRatioClass(imageLightbox.aspectRatio || '16:9')} mx-auto max-h-[74vh] max-w-full rounded-2xl object-contain`} />
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 sm:p-6" onClick={() => setPreviewOpen(false)}>
          <div className="mx-auto flex w-full max-w-6xl flex-col rounded-[32px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">웹 미리보기</div>
                <h3 className="mt-1 text-2xl font-black text-slate-900">최종 출력 전 결과 미리보기</h3>
                <p className="mt-2 text-sm text-slate-600">웹 미리보기는 저화질로 빠르게 확인하고, 최종 다운로드는 원본 품질로 저장됩니다.</p>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">씬 작업 도구</div>
                  <h4 className="mt-2 text-lg font-black text-slate-900">{currentTopic || '프로젝트'} 씬 카드</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">장면 편집은 작업 화면에서 진행하고, 최종 확인은 결과 미리보기에서 먼저 검토합니다.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-3 py-2">씬 {data.length}개</span>
                  <span className="rounded-full bg-white px-3 py-2">이미지 {summary.imageCount}개</span>
                  <span className="rounded-full bg-white px-3 py-2">오디오 {summary.audioCount}개</span>
                  <span className="rounded-full bg-white px-3 py-2">영상 {summary.videoCount}개</span>
                </div>
              </div>
              {false && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-bold text-slate-700">{progressMessage || '현재 작업 상태'}</div>
                  {activeOverallProgress !== null && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600">
                        <span>{progressLabel || '현재 작업 진행률'}</span>
                        <span>{activeOverallProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${activeOverallProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <div className={`rounded-2xl border p-4 ${previewVideoTone.panelClass}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">합본 영상 상태</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${previewVideoTone.badgeClass}`}>{previewVideoTone.badge}</span>
                        {finalVideoUrl && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">즉시 재생 가능</span>}
                      </div>
                    </div>
                    {onPreparePreviewVideo && (
                      <button
                        type="button"
                        onClick={() => void onPreparePreviewVideo()}
                        disabled={isPreparingPreviewVideo}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isPreparingPreviewVideo ? '합본 영상 생성 중...' : '합본 영상 다시 시도'}
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {previewVideoMessage || (finalVideoUrl ? '합본 영상이 준비되었습니다.' : '결과보기를 열면 여기에서 합본 영상 상태를 먼저 안내합니다.')}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => exportAssetsToZip(data, 'mp4Creater_storyboard')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">결과표 XLSX</button>
                    <button type="button" onClick={() => downloadProjectZip(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">CSV / ZIP</button>
                    <button type="button" onClick={() => downloadSrt(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">SRT</button>
                    <button
                      type="button"
                      onClick={() => void handlePrepareDavinciImport()}
                      disabled={isDavinciPreparing}
                      className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {isDavinciPreparing ? '다빈치 자동 Import 준비 중...' : '다빈치 자동 Import'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadDavinciPackage()}
                      disabled={isDavinciPreparing}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      다빈치 패키지 ZIP
                    </button>
                    {onExportVideo && (
                      <>
                        <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isExporting ? '렌더링 중...' : '최종 출력 (자막 O)'}</button>
                        <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">최종 출력 (자막 X)</button>
                      </>
                    )}
                  </div>

                  {davinciStatusMessage ? (
                    <div className="mt-4 rounded-[24px] border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
                      <div className="font-black">{davinciStatusMessage}</div>
                      {davinciPackagePath ? <div className="mt-2 break-all text-xs font-bold text-indigo-800">패키지 경로: {davinciPackagePath}</div> : null}
                      {davinciLaunchUri ? <div className="mt-1 break-all text-[11px] font-semibold text-indigo-700">브리지 호출 URI: {davinciLaunchUri}</div> : null}
                    </div>
                  ) : null}

                  {false && (
                    <div className="mt-3 rounded-2xl border border-white/70 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600">
                        <span>{progressLabel || '합본 영상 생성 진행률'}</span>
                        <span>{activeOverallProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${activeOverallProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {finalVideoUrl ? (
                    <div className="mt-4 space-y-3">
                      <div className="text-sm font-bold text-slate-700">{finalVideoTitle || '결과 미리보기'}</div>
                      <video controls className="w-full rounded-2xl border border-slate-200 bg-slate-950">
                        <source src={finalVideoUrl} type="video/mp4" />
                      </video>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/80 bg-white/70 p-4">
                      <div className="flex items-center gap-3">
                        {(previewVideoStatus === 'loading' || isPreparingPreviewVideo) && <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />}
                        <div className="text-sm font-black text-slate-900">
                          {previewVideoStatus === 'error' ? '합본 영상을 아직 만들지 못했습니다.' : '합본 영상 준비 중입니다.'}
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">AI 씬 영상이 없더라도 이미지 기반 합본을 먼저 시도합니다. 브라우저 합치기가 불안정하면 안전 모드로 다시 시도합니다.</p>
                    </div>
                  )}
                </div>
              </div>

            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="grid gap-4 xl:grid-cols-[1.16fr_0.84fr]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">연속 재생 미리보기</div>
                      <div className="mt-2 text-lg font-black text-slate-900">한 화면에서 문단별로 이어서 보기</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">합본처럼 보이되 실제로는 문단별 씬을 순서대로 넘겨 줍니다. 이미지와 영상이 섞여 있어도 같은 플레이어에서 점검할 수 있습니다.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startSequencePlayback(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">처음부터 재생</button>
                      <button type="button" onClick={() => sequencePlaying ? stopSequencePlayback() : startSequencePlayback(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{sequencePlaying ? '일시정지' : '현재 씬부터 재생'}</button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950">
                      {sequenceScene && getSceneVisualPayload(sequenceScene).kind === 'video' && getSceneVisualPayload(sequenceScene).src ? (
                        <video ref={previewSequenceVideoRef} className="aspect-video w-full bg-black object-contain" playsInline muted controls={false}>
                          <source src={getSceneVisualPayload(sequenceScene).src} type="video/mp4" />
                        </video>
                      ) : sequenceScene && getSceneVisualPayload(sequenceScene).src ? (
                        <img src={getDisplayImageSrc(getSceneVisualPayload(sequenceScene).src)} alt={`연속 재생 씬 ${sequenceScene.sceneNumber}`} className={`${getAspectRatioClass(sequenceScene.aspectRatio || '16:9')} w-full object-cover`} />
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-slate-900 px-6 text-center text-sm font-bold text-slate-300">아직 이미지나 영상이 없는 씬입니다. 이미지 만들기 후 다시 재생해 주세요.</div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {sequenceScene?.sceneNumber || Math.min(sequenceSceneIndex + 1, data.length)}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{formatSeconds(sequenceSceneDuration)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${sequenceScene && getPreferredVisualType(sequenceScene) === 'video' && sequenceScene.videoData ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{sequenceScene && getPreferredVisualType(sequenceScene) === 'video' && sequenceScene.videoData ? '영상 재생' : '이미지 재생'}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{sequenceScene?.narration || '씬을 준비하면 이곳에서 순서대로 재생됩니다.'}</p>
                        {sequenceScene?.audioData ? (
                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-slate-600">
                              <span>오디오 속도</span>
                              <span>{sequenceSceneAudioRate}x</span>
                            </div>
                            <audio ref={previewSequenceAudioRef} controls className="w-full" onPlay={(event) => applyAudioPlaybackRate(event.currentTarget, sequenceSceneAudioRate)} onLoadedMetadata={(event) => applyAudioPlaybackRate(event.currentTarget, sequenceSceneAudioRate)} onEnded={() => { if (sequencePlaying) advanceSequencePlayback(); }}>
                              <source src={resolveNarrationAudioSrc(sequenceScene.audioData)} type="audio/mpeg" />
                            </audio>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500">현재 씬에 나레이션 오디오가 없어서 지정된 컷 길이 기준으로 다음 씬으로 넘어갑니다.</div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">재생 큐</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {data.map((scene, queueIndex) => (
                            <button key={`queue-${scene.sceneNumber}-${queueIndex}`} type="button" onClick={() => { setSequenceSceneIndex(queueIndex); setSequenceRunId((prev) => prev + 1); }} className={`rounded-full px-3 py-2 text-xs font-black transition ${queueIndex === sequenceSceneIndex ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                              {scene.sceneNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">미리보기 사운드</div>
                      <div className="mt-2 text-lg font-black text-slate-900">나레이션 / 배경음 / 배경 생성</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">이 팝업 안에서 볼륨을 바로 조절하고, 배경음을 추가 생성해 같은 자리에서 다시 확인할 수 있습니다.</p>
                    </div>
                    {onCreateBackgroundTrack && (
                      <button type="button" onClick={onCreateBackgroundTrack} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">새 배경음 생성</button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900"><span>나레이션 볼륨</span><span>{Math.round((previewMix?.narrationVolume || 1) * 100)}%</span></div>
                      <input type="range" min="0" max="1.6" step="0.05" value={previewMix?.narrationVolume || 1} onChange={(e) => onPreviewMixChange?.({ ...(previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 }), narrationVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900"><span>배경음 볼륨</span><span>{Math.round((previewMix?.backgroundMusicVolume || mainBgm?.volume || 0.28) * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.02" value={previewMix?.backgroundMusicVolume || mainBgm?.volume || 0.28} onChange={(e) => onPreviewMixChange?.({ ...(previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 }), backgroundMusicVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
                    </div>
                  </div>
                  {backgroundMusicTracks.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {backgroundMusicTracks.map((track) => {
                        const active = track.id === (mainBgm?.id || '');
                        return (
                          <div key={`preview-bgm-${track.id}`} className={`rounded-2xl border p-4 ${active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-slate-900">{track.title}</div>
                                <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{track.prompt}</p>
                              </div>
                              <button type="button" onClick={() => onSelectBackgroundTrack?.(track.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{active ? '선택됨' : '이 트랙 사용'}</button>
                            </div>
                            {(() => {
                              const backgroundAudioSrc = resolveBackgroundAudioSrc(track.audioData);
                              if (!active || !backgroundAudioSrc) return null;
                              return (
                                <audio ref={bgmAudioRef} controls className="mt-3 w-full">
                                  <source src={backgroundAudioSrc} type="audio/wav" />
                                </audio>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">배경음이 아직 없습니다. 위 버튼으로 샘플 배경음을 추가해 보세요.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-4 sm:px-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">씬</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{data.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">예상 길이</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{formatSeconds(totalDuration)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">나레이션</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{summary.audioCount}/{data.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">배경음</div>
                <div className="mt-2 text-sm font-black text-slate-900">{mainBgm?.title || '미선택'}</div>
              </div>
            </div>

            <div ref={thumbnailToolbarRef} className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-4 sm:px-6">
              {onGenerateThumbnail && (
                <button type="button" onClick={() => void onGenerateThumbnail?.()} disabled={isThumbnailGenerating} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500">{isThumbnailGenerating ? '썸네일 생성 중...' : 'AI 썸네일 생성'}</button>
              )}
              {onGenerateAllImages && (
                <button type="button" onClick={() => void onGenerateAllImages?.()} disabled={isGenerating} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGenerating ? '전체 생성 중...' : '전체 이미지 생성'}</button>
              )}
              {onGenerateAllVideos && (
                <button type="button" onClick={() => void onGenerateAllVideos?.()} disabled={Boolean(isGeneratingAllVideos) || isGenerating} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '모든 영상 생성 중...' : '모든 씬 영상 생성'}</button>
              )}
              {onExportVideo && (
                <>
                  <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isExporting ? '렌더링 중...' : '최종 출력 (자막 O)'}</button>
                  <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">최종 출력 (자막 X)</button>
                </>
              )}
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {data.map((row, index) => (
                  <div key={`preview-${row.sceneNumber}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {row.sceneNumber}</span>
                          <div className={`${getAspectRatioPreviewClass(row.aspectRatio || '16:9', true)} overflow-hidden rounded-xl border border-slate-200 bg-slate-100`} />
                        </div>
                        <div className="relative flex h-[250px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-3">
                          {getSceneVisualPayload(row).kind === 'video' && getSceneVisualPayload(row).src ? (
                            <video className="max-h-[250px] max-w-full rounded-2xl object-contain" playsInline muted controls preload="metadata">
                              <source src={getSceneVisualPayload(row).src} type="video/mp4" />
                            </video>
                          ) : getSceneVisualPayload(row).src ? (
                            <button type="button" onClick={() => setImageLightbox({ src: getDisplayImageSrc(getSceneVisualPayload(row).src), title: `미리보기 씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })} className="block text-left"><img src={getDisplayImageSrc(getSceneVisualPayload(row).src)} alt={`미리보기 씬 ${row.sceneNumber}`} className="max-h-[250px] max-w-full rounded-2xl object-contain" /></button>
                          ) : (
                            <div className="max-w-[210px] text-center text-sm font-bold text-slate-400">이미지 생성 후 이 자리에서 장면을 확인할 수 있습니다.</div>
                          )}
                          {sceneProgressMap?.[index] && sceneProgressMap[index].percent < 100 && (
                            <div className="absolute inset-0 flex items-end bg-white/70 p-3">
                              <div className="w-full rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <div className="flex items-center justify-between gap-3 text-[11px] font-black text-slate-600">
                                  <span>{sceneProgressMap[index].label}</span>
                                  <span>{sceneProgressMap[index].percent}%</span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${sceneProgressMap[index].percent}%` }} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{formatSeconds(row.targetDuration)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getPreferredVisualType(row) === 'video' && row.videoData ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {getPreferredVisualType(row) === 'video' && row.videoData ? '씬 영상 선택' : '이미지 선택'}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">비율 {row.aspectRatio || '16:9'}</span>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">결과 카드</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">세로형 씬도 과하게 길어지지 않도록 높이를 250px 안에서 맞춰 보여줍니다.</p>
                        </div>
                        {row.audioData && (
                          <audio controls className="w-full">
                            <source src={resolveNarrationAudioSrc(row.audioData)} type="audio/mpeg" />
                          </audio>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => {
                setPreviewOpen(true);
              }}
              className="min-w-[140px] rounded-full bg-slate-900 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              결과 미리보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultTable;
