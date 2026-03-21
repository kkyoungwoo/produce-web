'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetHistoryItem, BackgroundMusicTrack, CostBreakdown, GeneratedAsset, PreviewMixSettings } from '../types';
import { getAspectRatioClass } from '../utils/aspectRatio';
import { handleHorizontalWheel, scrollContainerBy, scrollElementIntoView } from '../utils/horizontalScroll';
import { exportAssetsToZip, exportCapCutPackage } from '../services/exportService';
import { downloadProjectZip } from '../utils/csvHelper';
import { downloadSrt } from '../services/srtService';
import HelpTip from './HelpTip';
import { blobFromDataValue, extensionFromMime, triggerSequentialDownloads } from '../utils/downloadHelpers';

type PreviewVideoStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

const CAPCUT_DESKTOP_DOWNLOAD_URL = 'https://www.capcut.com/tools/desktop-video-editor';
const CAPCUT_INSTALL_GUIDE_URL = 'https://www.capcut.com/help/download-and-install';

interface ResultTableProps {
  data: GeneratedAsset[];
  onRegenerateImage?: (index: number) => void;
  onRegenerateAudio?: (index: number) => void;
  onExportVideo?: (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => void;
  onGenerateAnimation?: (index: number) => void;
  onNarrationChange?: (index: number, narration: string) => void;
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
}

const formatSeconds = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}초` : '-');

const resolveImageSrc = (value?: string | null) => {
  if (!value) return '/mp4Creater/flow-character.svg';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
};

const resolveNarrationAudioSrc = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:audio/mpeg;base64,${value}`;
};

const resolveBackgroundAudioSrc = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:audio/wav;base64,${value}`;
};

const resolveVideoSrc = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) return value;
  return value;
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

async function downloadScenePackage(row: GeneratedAsset) {
  const sceneNo = String(row.sceneNumber).padStart(3, '0');
  const downloads: Array<{ blob: Blob; filename: string }> = [
    { blob: new Blob([row.narration || ''], { type: 'text/plain;charset=utf-8' }), filename: `scene_${sceneNo}_narration.txt` },
    { blob: new Blob([row.visualPrompt || ''], { type: 'text/plain;charset=utf-8' }), filename: `scene_${sceneNo}_visual_prompt.txt` },
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
}) => {
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [finalOutputMode, setFinalOutputMode] = useState<'video' | 'image'>('video');
  const [downloadQuality, setDownloadQuality] = useState<'preview' | 'final'>('final');
  const [imageLightbox, setImageLightbox] = useState<{ src: string; title: string; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ kind: 'image' | 'video'; sceneNumber: number; entries: AssetHistoryItem[]; currentIndex: number; aspectRatio?: GeneratedAsset['aspectRatio'] } | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmStripRef = useRef<HTMLDivElement | null>(null);
  const sceneCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lastAutoFocusedSceneRef = useRef<number | null>(null);
  const [previewImageMap, setPreviewImageMap] = useState<Record<string, string>>({});
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

  const activeOverallProgress = typeof progressPercent === 'number'
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : null;

  const activeSceneIndex = useMemo(() => data.findIndex((row, index) => {
    const sceneProgress = sceneProgressMap?.[index];
    return Boolean(animatingIndices?.has(index) || row.status === 'generating' || (sceneProgress && sceneProgress.percent < 100));
  }), [animatingIndices, data, sceneProgressMap]);

  const displayedScenes = useMemo(() => data.slice(0, 6), [data]);

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

  const getDisplayImageSrc = (src: string) => previewImageMap[src] || src;

  const togglePanel = (key: string) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const container = bgmStripRef.current;
    if (!container || !mainBgm?.id) return;
    const target = container.querySelector<HTMLElement>(`[data-bgm-card-id="${mainBgm.id}"]`);
    if (target) scrollElementIntoView(target);
  }, [mainBgm?.id, backgroundMusicTracks.length]);

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
    if (finalOutputMode !== 'video') return;
    if (finalVideoUrl) return;
    if (!onPreparePreviewVideo) return;
    if (isPreparingPreviewVideo) return;
    void onPreparePreviewVideo();
  }, [finalOutputMode, finalVideoUrl, isPreparingPreviewVideo, onPreparePreviewVideo, previewOpen]);

  const shouldShowFooter = !previewOpen;

  if (!data.length) {
    return (
      <div className="mx-auto w-full px-0 pb-16">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🎬</div>
          <h3 className="mt-4 text-xl font-black text-slate-900">씬 생성 전입니다</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            캐릭터와 화풍을 정리한 뒤 씬이 생성되면 여기서는 편집과 재생성, 그리고 바로 내보내기까지 이어서 진행할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full px-0 pb-20">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">씬 작업 도구</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{currentTopic || '프로젝트'} 씬 카드</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">페이지에서는 장면 편집과 재생성, 그리고 바로 파일 내보내기에 집중하도록 정리했습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-2">씬 {data.length}개</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">이미지 {summary.imageCount}개</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">오디오 {summary.audioCount}개</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">영상 {summary.videoCount}개</span>
            {mainBgm && <span className="rounded-full bg-violet-50 px-3 py-2 text-violet-700">배경음 {backgroundMusicTracks.length}트랙</span>}
            <span className={`rounded-full px-3 py-2 ${finalOutputMode === 'video' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>최종 출력 {finalOutputMode === 'video' ? '영상' : '이미지'}</span>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">최종 출력 방식</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">작업 중에는 빠르게 확인하고, 내보낼 때는 원하는 결과 형식으로 바로 저장할 수 있습니다.</p>
            </div>
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button type="button" onClick={() => setFinalOutputMode('video')} className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${finalOutputMode === 'video' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>영상으로 저장</button>
              <button type="button" onClick={() => setFinalOutputMode('image')} className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${finalOutputMode === 'image' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>이미지로 저장</button>
            </div>
          </div>

          {finalOutputMode === 'video' && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">다운로드 품질</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">토큰과 렌더 부담을 줄이기 위해 평소에는 저화질로 저장하고, 마지막 출력만 고화질로 선택할 수 있습니다.</p>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setDownloadQuality('preview')} className={`rounded-2xl px-3 py-2 text-sm font-black ${downloadQuality === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}>저화질</button>
                <button type="button" onClick={() => setDownloadQuality('final')} className={`rounded-2xl px-3 py-2 text-sm font-black ${downloadQuality === 'final' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}>고화질</button>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onGenerateAllImages && (
              <button onClick={() => void onGenerateAllImages?.()} disabled={isGenerating} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">
                {isGenerating ? '이미지 생성 중...' : '전체 이미지 생성'}
              </button>
            )}
            {onGenerateAllVideos && (
              <button onClick={() => void onGenerateAllVideos?.()} disabled={Boolean(isGeneratingAllVideos) || isGenerating} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">
                {isGeneratingAllVideos ? '영상 생성 중...' : '모든 씬 영상 생성'}
              </button>
            )}
            <button onClick={() => exportAssetsToZip(data, 'mp4Creater_storyboard')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              결과표 XLSX
            </button>
            <button onClick={() => downloadProjectZip(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              CSV / ZIP
            </button>
            <button onClick={() => downloadSrt(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              SRT 저장
            </button>
            <button
              onClick={() => void exportCapCutPackage({
                assets: data,
                projectName: currentTopic || 'mp4Creater_project',
                backgroundMusicTracks,
                activeBackgroundTrackId,
                topic: currentTopic,
                autoOpenCapCut: true,
              })}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              CapCut으로 보내기
            </button>
            <a
              href={CAPCUT_DESKTOP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              CapCut 다운로드
            </a>
            <a
              href={CAPCUT_INSTALL_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              설치 가이드
            </a>
            {finalOutputMode === 'image' && (
              <button onClick={() => exportAssetsToZip(data, 'mp4Creater_image_storyboard')} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500">
                이미지 묶음 ZIP
              </button>
            )}
            {onExportVideo && finalOutputMode === 'video' && (
              <>
                <button onClick={() => onExportVideo?.({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">
                  {isExporting ? '영상 저장 중...' : 'MP4 저장하기 (자막 포함)'}
                </button>
                <button onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">
                  MP4 저장하기 (자막 없음)
                </button>
              </>
            )}
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
            <div className="font-black text-slate-700">CapCut 초보자 안내</div>
            <p className="mt-1">1) <span className="font-semibold text-slate-700">CapCut으로 보내기</span>를 누르면 타임라인 ZIP이 저장되고 CapCut 편집기가 새 탭에서 함께 열립니다. 2) ZIP을 풀면 <span className="font-semibold text-slate-700">timeline_ready</span> 폴더에 문단별 클립이 번호순으로 정리되어 있으니 CapCut에서 한 번에 가져와 타임라인에 올리면 됩니다. 3) 자막은 <span className="font-semibold text-slate-700">subtitles/project_subtitles.srt</span>, 배경음은 <span className="font-semibold text-slate-700">audio</span> 폴더 파일을 추가하면 됩니다.</p>
            <p className="mt-1">CapCut 공식 기준으로 데스크톱 앱 자동 실행과 외부 프로젝트 자동 임포트는 지원되지 않아서, 현재 버튼은 <span className="font-semibold text-slate-700">타임라인 ZIP 다운로드 + CapCut 편집기 자동 열기</span>까지를 한 번에 처리합니다.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <span>씬 카드 {displayedScenes.length}/{data.length}</span>
          {data.length > 6 && (
            <button
              type="button"
              onClick={() => {
                setFinalOutputMode('video');
                setPreviewOpen(true);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              더보기(+{data.length - 6})
            </button>
          )}
        </div>

        {(isGenerating || progressMessage || activeOverallProgress !== null) && (
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
                <p className="mt-3 text-xs leading-5 text-slate-500">화면 전체를 멈추지 않고, 실제 생성 중인 부분만 단계별로 표시합니다.</p>
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

      {(mainBgm || onPreviewMixChange) && (
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
                          <audio ref={bgmAudioRef} controls className="mt-3 w-full">
                            <source src={resolveBackgroundAudioSrc(track.audioData)} type="audio/wav" />
                          </audio>
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

      <div className="mt-6 space-y-5">
        {displayedScenes.map((row, index) => {
          const imageSrc = resolveImageSrc(row.imageData);
          const displayImageSrc = getDisplayImageSrc(imageSrc);
          const audioSrc = resolveNarrationAudioSrc(row.audioData);
          const isAnimating = animatingIndices?.has(index) || false;
          const sceneProgress = sceneProgressMap?.[index] || null;
          const isSceneWorking = isAnimating || row.status === 'generating' || Boolean(sceneProgress && sceneProgress.percent < 100);
          const imageHistoryEntries = collectMediaHistory(row, 'image');
          const videoHistoryEntries = collectMediaHistory(row, 'video');

          return (
            <div
              key={`${row.sceneNumber}-${index}`}
              ref={(node) => {
                sceneCardRefs.current[index] = node;
              }}
              className={`overflow-hidden rounded-[28px] border bg-white shadow-sm transition-all duration-300 ${activeSceneIndex === index ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {row.sceneNumber}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">컷 길이 {formatSeconds(row.targetDuration)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">오디오 {formatSeconds(row.audioDuration)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">비율 {row.aspectRatio || '16:9'}</span>
                    {sceneProgress && (
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${sceneProgress.percent >= 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        {sceneProgress.label} {sceneProgress.percent < 100 ? `${sceneProgress.percent}%` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeSceneIndex === index && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">현재 작업 중인 카드</span>
                    )}
                    <HelpTip title="씬 카드 사용법" compact>
                      카드 본문은 단순하게 유지하고, 컷 길이 조절, 오디오 미리듣기, 비주얼 프롬프트는 버튼으로 펼쳐서 쓰도록 구성했습니다.
                    </HelpTip>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-4 lg:min-h-[400px] lg:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
                <div className="grid gap-3 lg:grid-rows-[minmax(0,1fr)_auto]">
                  <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <button type="button" onClick={() => setImageLightbox({ src: displayImageSrc, title: `씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })} className="block w-full text-left"><img src={displayImageSrc} alt={`씬 ${row.sceneNumber}`} className={`${getAspectRatioClass(row.aspectRatio || '16:9')} w-full object-cover transition-transform duration-300 hover:scale-[1.01] ${isSceneWorking ? 'opacity-70' : ''}`} /></button>
                    {isSceneWorking && (
                      <div className="absolute inset-0 flex flex-col justify-between bg-white/78 p-4 backdrop-blur-[1px]">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Generating</div>
                          <div className="mt-2 text-sm font-black text-slate-900">{sceneProgress?.label || (isAnimating ? '영상 만드는 중' : 'AI 결과 준비 중')}</div>
                          <div className="mt-3 space-y-2">
                            <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-200" />
                            <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                            <span>{sceneProgress?.label || '진행 상황'}</span>
                            <span>{sceneProgress?.percent ?? (isAnimating ? 88 : 52)}%</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${sceneProgress?.percent ?? (isAnimating ? 88 : 52)}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setMediaViewer({ kind: 'image', sceneNumber: row.sceneNumber, entries: imageHistoryEntries, currentIndex: 0, aspectRatio: row.aspectRatio })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      이미지 보기 {imageHistoryEntries.length > 1 ? `(${imageHistoryEntries.length})` : ''}
                    </button>
                    <button type="button" disabled={!videoHistoryEntries.length} onClick={() => videoHistoryEntries.length && setMediaViewer({ kind: 'video', sceneNumber: row.sceneNumber, entries: videoHistoryEntries, currentIndex: 0, aspectRatio: row.aspectRatio })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                      영상 보기 {videoHistoryEntries.length > 1 ? `(${videoHistoryEntries.length})` : ''}
                    </button>
                    {onRegenerateImage && (
                      <button type="button" disabled={isSceneWorking} onClick={() => onRegenerateImage?.(index)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                        이미지 다시 만들기
                      </button>
                    )}
                    {onGenerateAnimation && (
                      <button type="button" disabled={isSceneWorking} onClick={() => onGenerateAnimation?.(index)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                        {isAnimating ? '영상 변환 중...' : '이 씬만 영상화'}
                      </button>
                    )}
                    <button type="button" onClick={() => void downloadScenePackage(row)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      이 문단 다운로드
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-slate-900">나레이션 / 대본 문단</div>
                      {onRegenerateAudio && (
                        <button type="button" disabled={isSceneWorking} onClick={() => onRegenerateAudio?.(index)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                          오디오 다시 생성
                        </button>
                      )}
                    </div>
                    <textarea value={row.narration} disabled={isSceneWorking} onChange={(e) => onNarrationChange?.(index, e.target.value)} className="min-h-[128px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400 lg:min-h-[112px]" />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <button type="button" onClick={() => togglePanel(`duration-${index}`)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">컷 길이 조절</button>
                    <button type="button" onClick={() => togglePanel(`audio-${index}`)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">오디오 미리듣기</button>
                    <button type="button" onClick={() => togglePanel(`prompt-${index}`)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">비주얼 프롬프트</button>
                  </div>

                  {openPanels[`duration-${index}`] && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-slate-900">컷 길이 조절</div>
                        <div className="text-xs font-bold text-slate-500">현재 {formatSeconds(row.targetDuration)}</div>
                      </div>
                      <input type="range" min="3" max="14" step="0.5" value={row.targetDuration || 5} onChange={(e) => onDurationChange?.(index, Number(e.target.value))} className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                    </div>
                  )}

                  {openPanels[`audio-${index}`] && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-slate-900">오디오 미리듣기</div>
                        {!row.audioData && (
                          <button type="button" onClick={() => onRequestProviderSetup?.('audio') || onOpenSettings?.()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                            API 키 연결
                          </button>
                        )}
                      </div>
                      {row.audioData ? (
                        <audio controls className="mt-3 w-full">
                          <source src={audioSrc} type="audio/mpeg" />
                        </audio>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-slate-500">오디오 API가 없거나 아직 생성되지 않았습니다. 설정에서 키를 넣고 이 씬만 다시 생성할 수 있습니다.</p>
                      )}
                    </div>
                  )}

                  {openPanels[`prompt-${index}`] && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-black text-slate-900">비주얼 프롬프트</div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{row.visualPrompt}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
            <div className="max-h-[78vh] overflow-auto rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              <img src={imageLightbox.src} alt={imageLightbox.title} className={`${getAspectRatioClass(imageLightbox.aspectRatio || '16:9')} mx-auto max-w-full rounded-2xl object-contain`} />
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
              {(progressMessage || activeOverallProgress !== null) && (
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

            {finalOutputMode === 'video' && (
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

                  {activeOverallProgress !== null && (previewVideoStatus === 'loading' || isPreparingPreviewVideo) && (
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
            )}

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
              <div className="mr-2 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setFinalOutputMode('video')} className={`rounded-2xl px-3 py-2 text-sm font-black transition-colors ${finalOutputMode === 'video' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}>영상</button>
                <button type="button" onClick={() => setFinalOutputMode('image')} className={`rounded-2xl px-3 py-2 text-sm font-black transition-colors ${finalOutputMode === 'image' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-white'}`}>이미지</button>
              </div>
              {onGenerateThumbnail && (
                <button type="button" onClick={() => void onGenerateThumbnail?.()} disabled={isThumbnailGenerating} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500">{isThumbnailGenerating ? '썸네일 생성 중...' : 'AI 썸네일 생성'}</button>
              )}
              {onGenerateAllImages && (
                <button type="button" onClick={() => void onGenerateAllImages?.()} disabled={isGenerating} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGenerating ? '전체 생성 중...' : '전체 이미지 생성'}</button>
              )}
              {onGenerateAllVideos && (
                <button type="button" onClick={() => void onGenerateAllVideos?.()} disabled={Boolean(isGeneratingAllVideos) || isGenerating} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '모든 영상 생성 중...' : '모든 씬 영상 생성'}</button>
              )}
              <button type="button" onClick={() => exportAssetsToZip(data, 'mp4Creater_storyboard')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">스토리보드 XLSX</button>
              <button type="button" onClick={() => downloadProjectZip(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">CSV / ZIP</button>
              {finalOutputMode === 'image' && (
                <button type="button" onClick={() => exportAssetsToZip(data, 'mp4Creater_image_storyboard')} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500">이미지 패키지 ZIP</button>
              )}
              <button type="button" onClick={() => downloadSrt(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">SRT 저장</button>
              <button type="button" onClick={() => void exportCapCutPackage({
                assets: data,
                projectName: currentTopic || 'mp4Creater_project',
                backgroundMusicTracks,
                activeBackgroundTrackId,
                topic: currentTopic,
                autoOpenCapCut: true,
              })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">CapCut으로 보내기</button>
              <a href={CAPCUT_DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">CapCut 다운로드</a>
              <a href={CAPCUT_INSTALL_GUIDE_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">설치 가이드</a>
              {onExportVideo && finalOutputMode === 'video' && (
                <>
                  <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isExporting ? '렌더링 중...' : '최종 출력 (자막 O)'}</button>
                  <button type="button" onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">최종 출력 (자막 X)</button>
                </>
              )}
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {data.map((row, index) => (
                  <div key={`preview-${row.sceneNumber}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <button type="button" onClick={() => setImageLightbox({ src: getDisplayImageSrc(resolveImageSrc(row.imageData)), title: `미리보기 씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })} className="block w-full text-left"><img src={getDisplayImageSrc(resolveImageSrc(row.imageData))} alt={`미리보기 씬 ${row.sceneNumber}`} className={`${getAspectRatioClass(row.aspectRatio || '16:9')} w-full object-cover`} /></button>
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
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {row.sceneNumber}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{formatSeconds(row.targetDuration)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.videoData ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {row.videoData ? '씬 영상 있음' : '이미지 기반'}
                          </span>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">결과 카드</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">문단 텍스트는 결과보기에서 숨기고, 장면 결과만 빠르게 검토하도록 단순화했습니다.</p>
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

      {shouldShowFooter && onFooterBack && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-3 shadow-xl shadow-slate-200/70 backdrop-blur-md">
            <button
              type="button"
              onClick={onFooterBack}
              className="min-w-[120px] rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              {footerBackLabel || '이전으로'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultTable;
