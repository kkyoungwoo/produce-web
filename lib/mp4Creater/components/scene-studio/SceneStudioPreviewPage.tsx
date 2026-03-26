'use client';

import React from 'react';
import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings } from '../../types';
import { getAspectRatioClass } from '../../utils/aspectRatio';
import { exportAssetsToZip } from '../../services/exportService';
import { downloadProjectZip } from '../../utils/csvHelper';
import { downloadSrt } from '../../services/srtService';

type PreviewVideoStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

interface SceneStudioPreviewPageProps {
  open: boolean;
  onClose: () => void;
  currentTopic?: string;
  data: GeneratedAsset[];
  summary: { imageCount: number; audioCount: number; videoCount: number };
  totalDuration: number;
  progressMessage?: string;
  activeOverallProgress: number | null;
  progressLabel?: string;
  previewRenderEstimatedTotalSeconds?: number | null;
  previewRenderEstimatedRemainingSeconds?: number | null;
  previewVideoTone: { panelClass: string; badgeClass: string; badge: string };
  previewVideoStatus?: PreviewVideoStatus;
  previewVideoMessage?: string;
  finalVideoUrl?: string | null;
  finalVideoTitle?: string;
  finalVideoDuration?: number | null;
  onPreparePreviewVideo?: () => void | Promise<void>;
  isPreparingPreviewVideo?: boolean;
  onExportVideo?: (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => void;
  downloadQuality: 'preview' | 'final';
  isExporting?: boolean;
  sequencePlaying: boolean;
  sequenceScene: GeneratedAsset | null;
  sequenceSceneIndex: number;
  sequenceSceneDuration: number;
  sequenceSceneAudioRate: number;
  previewSequenceVideoRef: React.RefObject<HTMLVideoElement | null>;
  previewSequenceAudioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleSequencePlayback: () => void;
  onSelectSequenceScene: (index: number) => void;
  onSequenceAudioPlay: (element: HTMLAudioElement) => void;
  onSequenceAudioLoadedMetadata: (element: HTMLAudioElement) => void;
  onSequenceAudioEnded: () => void;
  previewMix?: PreviewMixSettings;
  onPreviewMixChange?: (mix: PreviewMixSettings) => void;
  mainBgm?: BackgroundMusicTrack | null;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  onSelectBackgroundTrack?: (trackId: string) => void;
  onCreateBackgroundTrack?: () => void;
  bgmAudioRef: React.RefObject<HTMLAudioElement | null>;
  thumbnailToolbarRef?: React.RefObject<HTMLDivElement | null>;
  onGenerateThumbnail?: () => void | Promise<void>;
  isThumbnailGenerating?: boolean;
  onGenerateAllImages?: () => void | Promise<void>;
  onGenerateAllVideos?: () => void | Promise<void>;
  isGeneratingAllVideos?: boolean;
  isGenerating?: boolean;
  sceneProgressMap?: Record<number, { percent: number; label: string }>;
  getSceneVisualPayload: (row: GeneratedAsset) => { kind: 'image' | 'video'; src: string };
  getDisplayImageSrc: (src: string) => string;
  getPreferredVisualType: (row: GeneratedAsset) => 'image' | 'video';
  onOpenMediaLightbox: (payload: { kind: 'image' | 'video' | 'audio'; src: string; title: string; aspectRatio?: GeneratedAsset['aspectRatio'] }) => void;
}

const formatSeconds = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}초` : '-');

const defaultPreviewMix: PreviewMixSettings = {
  narrationVolume: 0.5,
  backgroundMusicVolume: 0.5,
};

const SceneStudioPreviewPage: React.FC<SceneStudioPreviewPageProps> = ({
  open,
  onClose,
  currentTopic,
  data,
  summary,
  totalDuration,
  progressMessage,
  activeOverallProgress,
  progressLabel,
  previewRenderEstimatedTotalSeconds,
  previewRenderEstimatedRemainingSeconds,
  previewVideoTone,
  previewVideoStatus = 'idle',
  previewVideoMessage,
  finalVideoUrl,
  finalVideoTitle,
  finalVideoDuration,
  onPreparePreviewVideo,
  isPreparingPreviewVideo,
  onExportVideo,
  downloadQuality,
  isExporting,
  sequenceScene,
  previewMix,
  onPreviewMixChange,
  onOpenMediaLightbox,
}) => {
  if (!open) return null;

  const safePreviewMix = previewMix || defaultPreviewMix;
  const narrationVolume = safePreviewMix.narrationVolume ?? 0.5;
  const backgroundMusicVolume = safePreviewMix.backgroundMusicVolume ?? 0.5;
  const previewAspectRatio = sequenceScene?.aspectRatio || data[0]?.aspectRatio || '16:9';
  const hasPreviewRenderStarted = previewVideoStatus !== 'idle' || Boolean(isPreparingPreviewVideo);
  const canShowRenderedPreview = Boolean(finalVideoUrl);
  const showFinalRenderButton = Boolean(onPreparePreviewVideo && !isPreparingPreviewVideo);
  const showFinalOutputButton = Boolean(canShowRenderedPreview && onExportVideo);
  const showPreviewMixControls = Boolean(!finalVideoUrl && previewVideoStatus !== 'loading' && !isPreparingPreviewVideo && onPreviewMixChange);
  const showRenderProgressCard = Boolean(
    (previewVideoStatus === 'loading' || isPreparingPreviewVideo || isExporting)
    && (progressMessage || activeOverallProgress !== null),
  );
  const mergedPreviewShellClass = previewAspectRatio === '9:16'
    ? 'mx-auto w-full max-w-[240px] sm:max-w-[280px]'
    : previewAspectRatio === '1:1'
      ? 'mx-auto w-full max-w-[320px] sm:max-w-[360px]'
      : 'mx-auto w-full max-w-[560px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 p-3 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">결과 미리보기</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{currentTopic || '프로젝트'} 결과 페이지</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showFinalRenderButton ? (
                <button
                  type="button"
                  onClick={() => void onPreparePreviewVideo?.()}
                  disabled={Boolean(isPreparingPreviewVideo)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {isPreparingPreviewVideo ? '결과 영상 렌더링 중...' : '결과 영상 다시 렌더링'}
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-3 py-2">씬 {data.length}개</span>
                  <span className="rounded-full bg-white px-3 py-2">이미지 {summary.imageCount}개</span>
                  <span className="rounded-full bg-white px-3 py-2">오디오 {summary.audioCount}개</span>
                  <span className="rounded-full bg-white px-3 py-2">영상 {summary.videoCount}개</span>
                </div>
                <div className="text-sm font-bold text-slate-600">예상 길이 {formatSeconds(totalDuration)}</div>
              </div>

              {showRenderProgressCard ? (
                <div className="mt-4 rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <div className="font-bold">{progressMessage || '결과 페이지가 준비되었습니다.'}</div>
                  </div>
                  {activeOverallProgress !== null ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-black">
                        <span>{progressLabel || '현재 작업 진행률'}</span>
                        <span>{activeOverallProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${activeOverallProgress}%` }} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-blue-700">
                        {typeof previewRenderEstimatedRemainingSeconds === 'number' ? <span className="rounded-full bg-white px-3 py-1">남은 시간 합계 {formatSeconds(previewRenderEstimatedRemainingSeconds)}</span> : null}
                        {typeof previewRenderEstimatedTotalSeconds === 'number' ? <span className="rounded-full bg-white px-3 py-1">예상 소요 {formatSeconds(previewRenderEstimatedTotalSeconds)}</span> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {showPreviewMixControls ? (
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      <span>나레이션 볼륨</span>
                      <span>{Math.round(narrationVolume * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1.6" step="0.05" value={narrationVolume} onChange={(event) => onPreviewMixChange?.({ ...safePreviewMix, narrationVolume: Number(event.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      <span>배경음 볼륨</span>
                      <span>{Math.round(backgroundMusicVolume * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.02" value={backgroundMusicVolume} onChange={(event) => onPreviewMixChange?.({ ...safePreviewMix, backgroundMusicVolume: Number(event.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className={`rounded-[28px] border p-4 sm:p-5 ${hasPreviewRenderStarted ? previewVideoTone.panelClass : 'border-slate-200 bg-white'}`}>
                {!hasPreviewRenderStarted ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">결과 영상</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{previewVideoMessage || '결과 영상을 렌더링해 주세요.'}</div>
                      </div>
                      {showFinalRenderButton ? (
                        <button
                          type="button"
                          onClick={() => void onPreparePreviewVideo?.()}
                          disabled={Boolean(isPreparingPreviewVideo)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          결과 영상 렌더링하기
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">결과 영상 상태</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${previewVideoTone.badgeClass}`}>{previewVideoTone.badge}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">비율 {previewAspectRatio}</span>
                          {canShowRenderedPreview ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">렌더 완료</span> : null}
                          {typeof previewRenderEstimatedRemainingSeconds === 'number' ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">남은 시간 합계 {formatSeconds(previewRenderEstimatedRemainingSeconds)}</span> : null}
                        </div>
                      </div>
                      {showFinalRenderButton ? (
                        <button
                          type="button"
                          onClick={() => void onPreparePreviewVideo?.()}
                          disabled={Boolean(isPreparingPreviewVideo)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {isPreparingPreviewVideo ? '결과 영상 렌더링 중...' : '결과 영상 다시 렌더링'}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
                      {showFinalOutputButton ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })}
                            disabled={Boolean(isExporting)}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500"
                          >
                            {isExporting ? '최종 출력 중...' : '최종 출력'}
                          </button>
                          <div className="text-xs leading-5 text-slate-500">자막은 영상에 합치지 않고 SRT 파일로 별도 저장합니다.</div>
                        </div>
                      ) : null}

                      {canShowRenderedPreview ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-black text-slate-900">{finalVideoTitle || `${currentTopic || '프로젝트'} 결과 영상`}</div>
                              {typeof finalVideoDuration === 'number' && finalVideoDuration > 0 ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">길이 {formatSeconds(finalVideoDuration)}</span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenMediaLightbox({ kind: 'video', src: finalVideoUrl!, title: finalVideoTitle || `${currentTopic || '프로젝트'} 결과 영상`, aspectRatio: previewAspectRatio })}
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              크게 보기
                            </button>
                          </div>
                          <div className={`${mergedPreviewShellClass} overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-3`}>
                            <video
                              key={finalVideoUrl!}
                              src={finalVideoUrl!}
                              className={`${getAspectRatioClass(previewAspectRatio)} w-full rounded-[20px] bg-black object-contain`}
                              controls
                              playsInline
                              preload="metadata"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          {(previewVideoStatus === 'loading' || isPreparingPreviewVideo) ? <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : null}
                          <span>{previewVideoStatus === 'error' ? '결과 영상을 아직 만들지 못했습니다. 다시 렌더링해 주세요.' : '결과 영상 렌더링이 끝나면 이 영역에 결과가 표시됩니다.'}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {canShowRenderedPreview ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => exportAssetsToZip(data, 'mp4Creater_storyboard')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">결과표 XLSX</button>
                    <button type="button" onClick={() => downloadProjectZip(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">CSV / ZIP</button>
                    <button type="button" onClick={() => downloadSrt(data)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">SRT</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneStudioPreviewPage;
