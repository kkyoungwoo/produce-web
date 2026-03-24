'use client';

import React from 'react';
import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings } from '../../types';
import { getAspectRatioClass } from '../../utils/aspectRatio';
import { getAspectRatioPreviewClass } from '../../config/workflowUi';
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
  previewVideoTone: { panelClass: string; badgeClass: string; badge: string };
  previewVideoStatus?: PreviewVideoStatus;
  previewVideoMessage?: string;
  finalVideoUrl?: string | null;
  finalVideoTitle?: string;
  onPreparePreviewVideo?: () => void | Promise<void>;
  isPreparingPreviewVideo?: boolean;
  handlePrepareDavinciImport: () => void | Promise<void>;
  handleDownloadDavinciPackage: () => void | Promise<void>;
  isDavinciPreparing?: boolean;
  davinciStatusMessage?: string;
  davinciPackagePath?: string | null;
  davinciLaunchUri?: string | null;
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

const resolveNarrationAudioSrc = (value?: string | null) => {
  if (!value?.trim()) return '';
  return value.startsWith('data:') ? value : `data:audio/mpeg;base64,${value}`;
};

const resolveBackgroundAudioSrc = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  return value.startsWith('data:') ? value : `data:audio/wav;base64,${value}`;
};

const defaultPreviewMix: PreviewMixSettings = {
  narrationVolume: 1,
  backgroundMusicVolume: 0.28,
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
  previewVideoTone,
  previewVideoStatus = 'idle',
  previewVideoMessage,
  finalVideoUrl,
  finalVideoTitle,
  onPreparePreviewVideo,
  isPreparingPreviewVideo,
  handlePrepareDavinciImport,
  handleDownloadDavinciPackage,
  isDavinciPreparing,
  davinciStatusMessage,
  davinciPackagePath,
  davinciLaunchUri,
  onExportVideo,
  downloadQuality,
  isExporting,
  sequencePlaying,
  sequenceScene,
  sequenceSceneIndex,
  sequenceSceneDuration,
  sequenceSceneAudioRate,
  previewSequenceVideoRef,
  previewSequenceAudioRef,
  onToggleSequencePlayback,
  onSelectSequenceScene,
  onSequenceAudioPlay,
  onSequenceAudioLoadedMetadata,
  onSequenceAudioEnded,
  previewMix,
  onPreviewMixChange,
  mainBgm,
  backgroundMusicTracks = [],
  onSelectBackgroundTrack,
  onCreateBackgroundTrack,
  bgmAudioRef,
  thumbnailToolbarRef,
  onGenerateThumbnail,
  isThumbnailGenerating,
  onGenerateAllImages,
  onGenerateAllVideos,
  isGeneratingAllVideos,
  isGenerating,
  sceneProgressMap,
  getSceneVisualPayload,
  getDisplayImageSrc,
  getPreferredVisualType,
  onOpenMediaLightbox,
}) => {
  if (!open) return null;

  const safePreviewMix = previewMix || defaultPreviewMix;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 sm:p-6" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-6xl flex-col rounded-[32px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">동영상 미리보기</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">씬 작업 도구</div>
              <h4 className="mt-2 text-lg font-black text-slate-900">{currentTopic || '프로젝트'} 결과 페이지</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">씬 편집은 step6에서 하고, 최종 확인은 이 분리된 결과 페이지에서 이어서 볼 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white px-3 py-2">씬 {data.length}개</span>
              <span className="rounded-full bg-white px-3 py-2">이미지 {summary.imageCount}개</span>
              <span className="rounded-full bg-white px-3 py-2">오디오 {summary.audioCount}개</span>
              <span className="rounded-full bg-white px-3 py-2">영상 {summary.videoCount}개</span>
            </div>
          </div>
          <div className={`mt-4 rounded-[24px] border px-4 py-4 text-sm ${isGenerating || activeOverallProgress !== null ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="flex items-center gap-3">
              {isGenerating || activeOverallProgress !== null ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> : <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
              <div className="font-bold">{progressMessage || '결과 페이지가 준비되었습니다.'}</div>
            </div>
            {activeOverallProgress !== null && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3 text-[11px] font-black">
                  <span>{progressLabel || '현재 작업 진행률'}</span>
                  <span>{activeOverallProgress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${activeOverallProgress}%` }} />
                </div>
              </div>
            )}
          </div>
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
                  {isPreparingPreviewVideo ? '합본 영상 렌더링 중...' : '합본 영상 렌더링'}
                </button>
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-700">
              {previewVideoMessage || (finalVideoUrl ? '합본 영상이 준비되었습니다.' : '이 페이지에서 합본 영상 상태를 먼저 확인할 수 있습니다.')}
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
                  <button type="button" onClick={() => onExportVideo({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isExporting ? '렌더링 중...' : '최종 출력 (자막 O)'}</button>
                  <button type="button" onClick={() => onExportVideo({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">최종 출력 (자막 X)</button>
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

            {finalVideoUrl ? (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-bold text-slate-700">{finalVideoTitle || '결과 미리보기'}</div>
                <video controls className="w-full rounded-2xl border border-slate-200 bg-slate-950" src={finalVideoUrl} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/80 bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  {(previewVideoStatus === 'loading' || isPreparingPreviewVideo) && <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />}
                  <div className="text-sm font-black text-slate-900">
                    {previewVideoStatus === 'error' ? '합본 영상을 아직 만들지 못했습니다.' : '렌더링 버튼을 누르면 합본 영상이 생성됩니다.'}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">씬 이미지와 오디오 데이터는 그대로 넘어온 상태입니다. 필요할 때만 렌더링 버튼을 눌러 합본 영상을 생성하세요.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:grid-cols-[minmax(0,1.1fr)_340px] sm:px-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">연속 재생 미리보기</div>
                <div className="mt-2 text-lg font-black text-slate-900">결과 확인 전 전체 흐름 체크</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onToggleSequencePlayback} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{sequencePlaying ? '일시정지' : '현재 씬부터 재생'}</button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950">
              {sequenceScene && getSceneVisualPayload(sequenceScene).kind === 'video' && getSceneVisualPayload(sequenceScene).src ? (
                <video ref={previewSequenceVideoRef} className="aspect-video w-full bg-black object-contain" playsInline muted controls={false} src={getSceneVisualPayload(sequenceScene).src} />
              ) : sequenceScene && getSceneVisualPayload(sequenceScene).src ? (
                <img src={getDisplayImageSrc(getSceneVisualPayload(sequenceScene).src)} alt={`연속 재생 씬 ${sequenceScene.sceneNumber}`} className={`${getAspectRatioClass(sequenceScene.aspectRatio || '16:9')} w-full object-cover`} />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm font-bold text-slate-400">씬 미디어가 준비되면 여기에서 연속 흐름을 확인할 수 있습니다.</div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {sequenceScene?.sceneNumber || Math.min(sequenceSceneIndex + 1, Math.max(1, data.length))}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{formatSeconds(sequenceSceneDuration)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${sequenceScene && getPreferredVisualType(sequenceScene) === 'video' && sequenceScene.videoData ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{sequenceScene && getPreferredVisualType(sequenceScene) === 'video' && sequenceScene.videoData ? '영상 재생' : '이미지 재생'}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">오디오 {sequenceSceneAudioRate}x</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{sequenceScene?.narration || '씬을 준비하면 이곳에서 순서대로 재생됩니다.'}</p>
              {sequenceScene?.audioData ? (
                <div className="mt-4">
                  <audio
                    ref={previewSequenceAudioRef}
                    controls
                    className="w-full"
                    onPlay={(event) => onSequenceAudioPlay(event.currentTarget)}
                    onLoadedMetadata={(event) => onSequenceAudioLoadedMetadata(event.currentTarget)}
                    onEnded={onSequenceAudioEnded}
                  >
                    <source src={resolveNarrationAudioSrc(sequenceScene.audioData)} type="audio/mpeg" />
                  </audio>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {data.map((scene, queueIndex) => (
                <button
                  key={`queue-${scene.sceneNumber}-${queueIndex}`}
                  type="button"
                  onClick={() => onSelectSequenceScene(queueIndex)}
                  className={`rounded-full px-3 py-2 text-xs font-black transition ${queueIndex === sequenceSceneIndex ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  씬 {scene.sceneNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">미리보기 사운드</div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900"><span>나레이션 볼륨</span><span>{Math.round((safePreviewMix.narrationVolume || 1) * 100)}%</span></div>
                <input type="range" min="0" max="1.6" step="0.05" value={safePreviewMix.narrationVolume || 1} onChange={(e) => onPreviewMixChange?.({ ...safePreviewMix, narrationVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-900"><span>배경음 볼륨</span><span>{Math.round((safePreviewMix.backgroundMusicVolume || mainBgm?.volume || 0.28) * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.02" value={safePreviewMix.backgroundMusicVolume || mainBgm?.volume || 0.28} onChange={(e) => onPreviewMixChange?.({ ...safePreviewMix, backgroundMusicVolume: Number(e.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">배경음 트랙</div>
                {onCreateBackgroundTrack && (
                  <button type="button" onClick={() => void onCreateBackgroundTrack()} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">샘플 추가</button>
                )}
              </div>
              {backgroundMusicTracks.length ? (
                <div className="mt-4 space-y-3">
                  {backgroundMusicTracks.map((track) => {
                    const active = track.id === (mainBgm?.id || '');
                    const backgroundAudioSrc = resolveBackgroundAudioSrc(track.audioData);
                    return (
                      <div key={`preview-bgm-${track.id}`} className={`rounded-2xl border p-4 ${active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black text-slate-900">{track.title}</div>
                            <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{track.prompt}</p>
                          </div>
                          <button type="button" onClick={() => onSelectBackgroundTrack?.(track.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{active ? '선택됨' : '이 트랙 사용'}</button>
                        </div>
                        {active && backgroundAudioSrc ? (
                          <audio ref={bgmAudioRef} controls className="mt-3 w-full">
                            <source src={backgroundAudioSrc} type="audio/wav" />
                          </audio>
                        ) : null}
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
            <button type="button" onClick={() => void onGenerateThumbnail()} disabled={isThumbnailGenerating} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500">{isThumbnailGenerating ? '썸네일 생성 중...' : 'AI 썸네일 생성'}</button>
          )}
          {onGenerateAllImages && (
            <button type="button" onClick={() => void onGenerateAllImages()} disabled={isGenerating} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGenerating ? '전체 생성 중...' : '전체 이미지 생성'}</button>
          )}
          {onGenerateAllVideos && (
            <button type="button" onClick={() => void onGenerateAllVideos()} disabled={Boolean(isGeneratingAllVideos) || isGenerating} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '모든 영상 생성 중...' : '모든 씬 영상 생성'}</button>
          )}
          {onExportVideo && (
            <>
              <button type="button" onClick={() => onExportVideo({ enableSubtitles: true, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isExporting ? '렌더링 중...' : '최종 출력 (자막 O)'}</button>
              <button type="button" onClick={() => onExportVideo({ enableSubtitles: false, qualityMode: downloadQuality })} disabled={isExporting} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">최종 출력 (자막 X)</button>
            </>
          )}
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {data.map((row, index) => {
              const visual = getSceneVisualPayload(row);
              const isVideo = visual.kind === 'video' && visual.src;
              const displayImageSrc = visual.src ? getDisplayImageSrc(visual.src) : '';
              return (
                <div key={`preview-${row.sceneNumber}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {row.sceneNumber}</span>
                        <div className={`${getAspectRatioPreviewClass(row.aspectRatio || '16:9', true)} overflow-hidden rounded-xl border border-slate-200 bg-slate-100`} />
                      </div>
                      <div className="relative flex h-[250px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-3">
                        {isVideo ? (
                          <button
                            type="button"
                            onClick={() => onOpenMediaLightbox({ kind: 'video', src: visual.src, title: `미리보기 씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })}
                            className="block h-full w-full text-left"
                          >
                            <video className="max-h-[250px] max-w-full rounded-2xl object-contain" playsInline muted controls preload="metadata" src={visual.src} />
                          </button>
                        ) : visual.src ? (
                          <button type="button" onClick={() => onOpenMediaLightbox({ kind: 'image', src: displayImageSrc, title: `미리보기 씬 ${row.sceneNumber}`, aspectRatio: row.aspectRatio })} className="block text-left"><img src={displayImageSrc} alt={`미리보기 씬 ${row.sceneNumber}`} className="max-h-[250px] max-w-full rounded-2xl object-contain" /></button>
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
                        <p className="mt-2 text-sm leading-6 text-slate-600">step6에서 만든 최신 씬 데이터가 그대로 이동된 상태입니다.</p>
                      </div>
                      {row.audioData && (
                        <audio controls className="w-full" onDoubleClick={() => onOpenMediaLightbox({ kind: 'audio', src: resolveNarrationAudioSrc(row.audioData), title: `씬 ${row.sceneNumber} 오디오`, aspectRatio: row.aspectRatio })}>
                          <source src={resolveNarrationAudioSrc(row.audioData)} type="audio/mpeg" />
                        </audio>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneStudioPreviewPage;
