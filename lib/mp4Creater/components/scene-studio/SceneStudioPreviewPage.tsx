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
  const previewAspectRatio = sequenceScene?.aspectRatio || data[0]?.aspectRatio || '16:9';
  const showFinalRenderButton = Boolean(onPreparePreviewVideo && !finalVideoUrl);
  const showFinalOutputButton = Boolean(finalVideoUrl && onExportVideo);
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
              <p className="mt-1 text-sm leading-6 text-slate-600">미리보기에서는 씬 오디오와 배경음을 따로 조절하고, 최종 출력은 현재 믹스를 합쳐 하나의 영상으로 저장합니다.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
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
              <div className={`rounded-[28px] border p-4 sm:p-5 ${previewVideoTone.panelClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">합본 영상 상태</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${previewVideoTone.badgeClass}`}>{previewVideoTone.badge}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">비율 {previewAspectRatio}</span>
                      {finalVideoUrl ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">합본 준비 완료</span> : null}
                    </div>
                  </div>
                  <div className="text-sm leading-6 text-slate-700 sm:max-w-[420px]">
                    {previewVideoMessage || (finalVideoUrl ? '합본 영상이 준비되었습니다. 아래에서 최종 저장용 출력과 추가 결과물을 바로 사용할 수 있습니다.' : '미리보기 버튼에서 먼저 렌더링된 합본 영상을 이 창에서 확인합니다.')}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
                  {showFinalOutputButton && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onExportVideo?.({ enableSubtitles: false, qualityMode: downloadQuality })}
                        disabled={isExporting}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        {isExporting ? '최종 출력 중...' : '최종 출력'}
                      </button>
                      <div className="text-xs leading-5 text-slate-500">자막은 영상에 합치지 않고 SRT 파일로 별도 저장합니다.</div>
                    </div>
                  )}

                  {finalVideoUrl ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-black text-slate-900">{finalVideoTitle || `${currentTopic || '프로젝트'} 합본 영상`}</div>
                        <button
                          type="button"
                          onClick={() => onOpenMediaLightbox({ kind: 'video', src: finalVideoUrl, title: finalVideoTitle || `${currentTopic || '프로젝트'} 합본 영상`, aspectRatio: previewAspectRatio })}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          크게 보기
                        </button>
                      </div>
                      <div className={`${mergedPreviewShellClass} overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-3`}>
                        <video className={`${getAspectRatioClass(previewAspectRatio)} w-full rounded-[20px] bg-black object-contain`} controls playsInline preload="metadata">
                          <source src={finalVideoUrl} type="video/mp4" />
                        </video>
                      </div>
                      <div className="text-center text-xs leading-5 text-slate-500">처음에는 작은 화면으로 확인하고, 필요할 때 크게 보기로 확대할 수 있습니다.</div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      {(previewVideoStatus === 'loading' || isPreparingPreviewVideo) && <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />}
                      <span>
                        {previewVideoStatus === 'error' ? '합본 영상을 아직 만들지 못했습니다.' : '렌더링이 끝나면 이 영역에 합본 영상이 표시됩니다.'}
                      </span>
                    </div>
                  )}

                  {showFinalRenderButton && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void onPreparePreviewVideo?.()}
                        disabled={isPreparingPreviewVideo}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isPreparingPreviewVideo ? '합본 영상 렌더링 중...' : '합본 영상 렌더링'}
                      </button>
                    </div>
                  )}
                </div>

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
                </div>

                {davinciStatusMessage ? (
                  <div className="mt-4 rounded-[24px] border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
                    <div className="font-black">{davinciStatusMessage}</div>
                    {davinciPackagePath ? <div className="mt-2 break-all text-xs font-bold text-indigo-800">패키지 경로: {davinciPackagePath}</div> : null}
                    {davinciLaunchUri ? <div className="mt-1 break-all text-[11px] font-semibold text-indigo-700">브리지 호출 URI: {davinciLaunchUri}</div> : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">결과 미리보기 믹서</div>
                      <div className="mt-2 text-lg font-black text-slate-900">씬별 미리보기와 소리 조절</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-2">현재 씬 {sequenceScene ? `${sequenceSceneIndex + 1}/${data.length}` : '-'}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-2">재생 속도 {sequenceSceneAudioRate.toFixed(2)}x</span>
                      <span className="rounded-full bg-slate-100 px-3 py-2">예상 {formatSeconds(sequenceSceneDuration)}</span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-3">
                    {sequenceScene ? (
                      getSceneVisualPayload(sequenceScene).kind === 'video' ? (
                        <video ref={previewSequenceVideoRef} className={`${getAspectRatioClass(sequenceScene.aspectRatio || previewAspectRatio)} w-full rounded-[20px] bg-black object-contain`} playsInline muted controls={false} src={getSceneVisualPayload(sequenceScene).src} />
                      ) : (
                        <img src={getDisplayImageSrc(getSceneVisualPayload(sequenceScene).src)} alt={`미리보기 씬 ${sequenceScene.sceneNumber}`} className={`${getAspectRatioClass(sequenceScene.aspectRatio || previewAspectRatio)} w-full rounded-[20px] bg-black object-contain`} />
                      )
                    ) : (
                      <div className={`${getAspectRatioClass(previewAspectRatio)} flex items-center justify-center rounded-[20px] bg-slate-900 text-sm font-bold text-slate-400`}>미리볼 씬이 아직 없습니다.</div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={onToggleSequencePlayback} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">{sequencePlaying ? '미리보기 일시정지' : '미리보기 재생'}</button>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">여기서는 씬 오디오와 배경음을 따로 맞추고, 최종 출력에서는 현재 밸런스를 합쳐 저장합니다.</div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        <span>나레이션 볼륨</span>
                        <span>{Math.round((safePreviewMix.narrationVolume || 1) * 100)}%</span>
                      </div>
                      <input type="range" min="0" max="1.6" step="0.05" value={safePreviewMix.narrationVolume || 1} onChange={(event) => onPreviewMixChange?.({ ...safePreviewMix, narrationVolume: Number(event.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        <span>배경음 볼륨</span>
                        <span>{Math.round((safePreviewMix.backgroundMusicVolume || mainBgm?.volume || 0.28) * 100)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.02" value={safePreviewMix.backgroundMusicVolume || mainBgm?.volume || 0.28} onChange={(event) => onPreviewMixChange?.({ ...safePreviewMix, backgroundMusicVolume: Number(event.target.value) })} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600" />
                    </div>
                  </div>

                  {sequenceScene?.audioData ? (
                    <audio
                      ref={previewSequenceAudioRef}
                      controls
                      className="mt-4 w-full"
                      onPlay={(event) => onSequenceAudioPlay(event.currentTarget)}
                      onLoadedMetadata={(event) => onSequenceAudioLoadedMetadata(event.currentTarget)}
                      onEnded={onSequenceAudioEnded}
                    >
                      <source src={resolveNarrationAudioSrc(sequenceScene.audioData)} type="audio/mpeg" />
                    </audio>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-bold text-slate-500">현재 씬 오디오가 아직 없어도 미리보기는 계속할 수 있습니다.</div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">씬 큐</div>
                        <div className="mt-2 text-lg font-black text-slate-900">원하는 씬으로 바로 이동</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{data.length}개</span>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {data.map((row, index) => {
                        const active = index === sequenceSceneIndex;
                        return (
                          <button key={`queue-${row.sceneNumber}-${index}`} type="button" onClick={() => onSelectSequenceScene(index)} className={`rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-900">씬 {row.sceneNumber}</div>
                                <div className="mt-1 text-xs text-slate-500">{formatSeconds(row.targetDuration)} · {row.aspectRatio || previewAspectRatio}</div>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[10px] font-black ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{active ? '선택됨' : '이동'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">배경음</div>
                        <div className="mt-2 text-lg font-black text-slate-900">미리보기용 트랙 선택</div>
                      </div>
                      {onCreateBackgroundTrack ? <button type="button" onClick={() => void onCreateBackgroundTrack()} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">샘플 배경음 추가</button> : null}
                    </div>
                    {backgroundMusicTracks.length ? (
                      <div className="mt-4 space-y-3">
                        {backgroundMusicTracks.map((track) => {
                          const active = track.id === mainBgm?.id;
                          const backgroundAudioSrc = resolveBackgroundAudioSrc(track.audioData);
                          return (
                            <div key={`preview-bgm-${track.id}`} className={`rounded-2xl border p-4 ${active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-slate-50'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-black text-slate-900">{track.title}</div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneStudioPreviewPage;
