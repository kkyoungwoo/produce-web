'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackgroundMusicTrack, GeneratedAsset, TimelineClip, TimelineRangeSelection, TimelineSnapMode } from '../../types';
import { clampTimelineZoom, msToPx, pxToMs, TIMELINE_MIN_CLIP_MS } from '../../services/timelineMath';
import { readTimelineUiSnapshot, writeTimelineUiSnapshot } from '../../services/timelineUiSnapshotService';
import { getGlobalAssetLibrary, GlobalAssetLibraryItem } from '../../services/assetLibraryService';
import { appendEditorTelemetry, readEditorTelemetry } from '../../services/editorTelemetryService';
import { runTimelineQa } from '../../services/timelineQaService';

interface TimelineWorkbenchProps {
  projectId?: string | null;
  data: GeneratedAsset[];
  backgroundMusicTracks?: BackgroundMusicTrack[];
  selectedThumbnailId?: string | null;
  onDurationChange?: (index: number, duration: number) => void;
  onSceneReorder?: (fromIndex: number, toIndex: number) => void;
  onSplitScene?: (index: number, splitSeconds: number) => void;
  onPinSceneAsThumbnail?: (index: number) => void;
  onPreviewRange?: (range: { startIndex: number; endIndex: number }) => void;
  onReuseGlobalAsset?: (index: number, asset: GlobalAssetLibraryItem) => void;
  onBackgroundTrackTimelineChange?: (trackId: string, patch: { timelineStartSeconds?: number | null; timelineEndSeconds?: number | null }) => void;
}

type TrackKey = 'scene' | 'narration' | 'subtitle' | 'bgm';
type InteractionKind = 'move' | 'resize-left' | 'resize-right' | 'scrub' | 'marquee' | 'pan';

interface SceneSpan {
  index: number;
  startMs: number;
  endMs: number;
  durationMs: number;
}

interface RenderClip extends TimelineClip {
  label: string;
  trackKey: TrackKey;
  sceneIndex: number;
  accentClass: string;
}

interface DragPreview {
  startMs: number;
  endMs: number;
  widthMs: number;
  insertIndex: number;
  selectedIndices: number[];
}

interface TrimPreview {
  kind: 'resize-left' | 'resize-right';
  sceneIndex: number;
  trackKey?: TrackKey | null;
  clipId?: string | null;
  nextDurations?: Record<number, number>;
  backgroundTrackBounds?: { startMs: number; endMs: number } | null;
  clipBounds?: Record<string, { startMs: number; endMs: number }>;
}

interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface InteractionState {
  kind: InteractionKind;
  phase: 'pending' | 'active';
  sceneIndex: number | null;
  selectedIndices: number[];
  startClientX: number;
  startClientY: number;
  originDurationMs: number;
  originPlayheadMs: number;
  originScrollLeft: number;
  trackKey: TrackKey | null;
  originSceneSpans: SceneSpan[];
  moveDeltaPx: number;
  clipId?: string | null;
  originBgmBounds?: { startMs: number; endMs: number } | null;
  originClipStartMs?: number | null;
  originClipEndMs?: number | null;
}

const TRACK_LABEL_WIDTH = 172;
const TRACK_HEIGHT = 58;
const TRACK_GAP = 8;
const RULER_HEIGHT = 42;
const TIMELINE_PADDING_RIGHT = 160;
const DRAG_THRESHOLD_PX = 4;
const MIN_SCENE_DURATION_MS = 1000;
const MIN_BGM_DURATION_MS = 400;
const FRAME_STEP_MS = 1000 / 30;
const PREVIEW_ASPECT_BY_RATIO: Record<NonNullable<GeneratedAsset['aspectRatio']>, string> = {
  '16:9': '16 / 9',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function isSameDragPreview(a: DragPreview | null, b: DragPreview | null) {
  if (!a || !b) return false;
  if (a.startMs !== b.startMs || a.endMs !== b.endMs || a.widthMs !== b.widthMs || a.insertIndex !== b.insertIndex) return false;
  if (a.selectedIndices.length !== b.selectedIndices.length) return false;
  return a.selectedIndices.every((value, index) => value === b.selectedIndices[index]);
}

function isSameTrimPreview(a: TrimPreview | null, b: TrimPreview | null) {
  if (!a || !b) return false;
  if (a.kind !== b.kind || a.sceneIndex !== b.sceneIndex || a.trackKey !== b.trackKey || a.clipId !== b.clipId) return false;
  const aBounds = a.backgroundTrackBounds || null;
  const bBounds = b.backgroundTrackBounds || null;
  if (aBounds || bBounds) {
    return aBounds?.startMs === bBounds?.startMs && aBounds?.endMs === bBounds?.endMs;
  }
  const aBoundsEntries = Object.entries(a.clipBounds || {});
  const bBoundsEntries = Object.entries(b.clipBounds || {});
  if (aBoundsEntries.length !== bBoundsEntries.length) return false;
  const sameBounds = aBoundsEntries.every(([key, value]) => {
    const other = (b.clipBounds || {})[key as keyof typeof b.clipBounds];
    return other?.startMs === value.startMs && other?.endMs === value.endMs;
  });
  if (!sameBounds) return false;
  const aEntries = Object.entries(a.nextDurations || {});
  const bEntries = Object.entries(b.nextDurations || {});
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([key, value]) => (b.nextDurations || {})[key as unknown as keyof typeof b.nextDurations] === value);
}

function formatTimelineTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function getSceneDurationSeconds(asset: GeneratedAsset, override?: number | null) {
  if (typeof override === 'number' && override > 0) return Math.max(1, Number(override.toFixed(1)));
  const value = typeof asset.targetDuration === 'number' && asset.targetDuration > 0
    ? asset.targetDuration
    : typeof asset.audioDuration === 'number' && asset.audioDuration > 0
      ? asset.audioDuration
      : typeof asset.videoDuration === 'number' && asset.videoDuration > 0
        ? asset.videoDuration
        : 3;
  return Math.max(1, Number(value.toFixed(1)));
}

function resolveImageSrc(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http') || value.startsWith('/')) return value;
  return `data:image/png;base64,${value}`;
}

function resolveVideoSrc(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) return value;
  return value;
}

function tokenizeSubtitle(text: string) {
  return text
    .split(/(?<=[.!?。！？]|다\.|요\.)\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getSceneRangeFromSelection(selection: number[], length: number) {
  if (!selection.length || !length) return null;
  const sorted = [...selection].sort((a, b) => a - b).filter((index) => index >= 0 && index < length);
  if (!sorted.length) return null;
  return { startIndex: sorted[0], endIndex: sorted[sorted.length - 1] };
}

function areIndicesContiguous(indices: number[]) {
  if (indices.length <= 1) return true;
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (typeof moved === 'undefined') return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function getTrackConfig(hasSubtitle: boolean, hasBgm: boolean) {
  return [
    { key: 'scene' as const, label: 'Video', hint: '씬 클립', badge: 'CUT', accent: 'border-cyan-400', glyph: '🎬' },
    { key: 'narration' as const, label: 'Voice', hint: '나레이션', badge: 'VOICE', accent: 'border-violet-400', glyph: '🎙️' },
    ...(hasSubtitle ? [{ key: 'subtitle' as const, label: 'Subtitle', hint: '자막', badge: 'TXT', accent: 'border-amber-400', glyph: '💬' }] : []),
    ...(hasBgm ? [{ key: 'bgm' as const, label: 'Music', hint: '배경음', badge: 'BGM', accent: 'border-emerald-400', glyph: '🎵' }] : []),
  ];
}

function getTrackTop(trackOrder: number) {
  return RULER_HEIGHT + (trackOrder * (TRACK_HEIGHT + TRACK_GAP));
}

function getSceneSpans(data: GeneratedAsset[], durationDrafts: Record<number, number>) {
  let cursor = 0;
  return data.map((asset, index) => {
    const durationMs = Math.round(getSceneDurationSeconds(asset, durationDrafts[index]) * 1000);
    const startMs = cursor;
    const endMs = startMs + durationMs;
    cursor = endMs;
    return { index, startMs, endMs, durationMs } satisfies SceneSpan;
  });
}

function buildSnapTargets(totalDurationMs: number, sceneSpans: SceneSpan[], activeIndices: number[], mode: TimelineSnapMode, playheadMs: number, extraTargets: number[] = []) {
  if (mode === 'off') return [];
  const values = new Set<number>([0, totalDurationMs, playheadMs, ...extraTargets]);
  sceneSpans.forEach((span) => {
    if (activeIndices.includes(span.index)) return;
    values.add(span.startMs);
    values.add(span.endMs);
  });
  if (mode === 'frame') {
    for (let ms = 0; ms <= totalDurationMs; ms += FRAME_STEP_MS) values.add(Math.round(ms));
  }
  return Array.from(values).sort((a, b) => a - b);
}

function applySnap(valueMs: number, targets: number[], snapMode: TimelineSnapMode) {
  if (snapMode === 'off' || !targets.length) return valueMs;
  const threshold = snapMode === 'frame' ? 80 : snapMode === 'beat' ? 140 : 180;
  let best = valueMs;
  let bestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((target) => {
    const distance = Math.abs(target - valueMs);
    if (distance <= threshold && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  });
  return best;
}

function buildRenderClips(
  data: GeneratedAsset[],
  sceneSpans: SceneSpan[],
  backgroundMusicTracks: BackgroundMusicTrack[],
  subtitleEnabled: boolean,
  totalDurationMs: number,
  backgroundTrackBounds: { startMs: number; endMs: number } | null,
): RenderClip[] {
  const clips: RenderClip[] = [];
  sceneSpans.forEach((span) => {
    const asset = data[span.index];
    clips.push({
      id: `scene-${span.index}`,
      trackId: 'scene',
      sceneId: `scene-${span.index}`,
      segmentId: `segment-${span.index}`,
      assetId: `scene-asset-${span.index}`,
      startMs: span.startMs,
      endMs: span.endMs,
      trimInMs: 0,
      trimOutMs: 0,
      draggable: true,
      trimmable: true,
      splittable: true,
      resizable: true,
      linkedClipIds: [`narration-${span.index}`],
      locked: false,
      role: 'scene',
      label: `Scene ${asset.sceneNumber || span.index + 1}`,
      trackKey: 'scene',
      sceneIndex: span.index,
      accentClass: 'border-slate-700 bg-[#141925]',
    });

    clips.push({
      id: `narration-${span.index}`,
      trackId: 'narration',
      sceneId: `scene-${span.index}`,
      segmentId: `narration-${span.index}`,
      assetId: `narration-asset-${span.index}`,
      startMs: span.startMs,
      endMs: span.endMs,
      trimInMs: 0,
      trimOutMs: 0,
      draggable: false,
      trimmable: false,
      splittable: false,
      resizable: false,
      linkedClipIds: [`scene-${span.index}`],
      locked: false,
      role: 'narrator',
      label: asset.audioData ? 'Narration ready' : 'TTS pending',
      trackKey: 'narration',
      sceneIndex: span.index,
      accentClass: 'border-violet-500/30 bg-violet-500/12',
    });

    if (subtitleEnabled) {
      const subtitleTokens = tokenizeSubtitle(asset.subtitleData?.fullText || asset.narration || '');
      if (!subtitleTokens.length) {
        clips.push({
          id: `subtitle-${span.index}-0`,
          trackId: 'subtitle',
          sceneId: `scene-${span.index}`,
          segmentId: `subtitle-${span.index}-0`,
          assetId: `subtitle-${span.index}`,
          startMs: span.startMs,
          endMs: span.endMs,
          trimInMs: 0,
          trimOutMs: 0,
          draggable: false,
          trimmable: false,
          splittable: false,
          resizable: false,
          linkedClipIds: [`scene-${span.index}`],
          locked: false,
          role: 'caption',
          label: '자막 없음',
          trackKey: 'subtitle',
          sceneIndex: span.index,
          accentClass: 'border-amber-500/30 bg-amber-500/12',
        });
      } else {
        const chunkMs = Math.max(TIMELINE_MIN_CLIP_MS, Math.floor(span.durationMs / subtitleTokens.length));
        subtitleTokens.forEach((token, tokenIndex) => {
          const startMs = span.startMs + (chunkMs * tokenIndex);
          const endMs = tokenIndex === subtitleTokens.length - 1 ? span.endMs : Math.min(span.endMs, startMs + chunkMs);
          clips.push({
            id: `subtitle-${span.index}-${tokenIndex}`,
            trackId: 'subtitle',
            sceneId: `scene-${span.index}`,
            segmentId: `subtitle-${span.index}-${tokenIndex}`,
            assetId: `subtitle-${span.index}`,
            startMs,
            endMs,
            trimInMs: 0,
            trimOutMs: 0,
            draggable: false,
            trimmable: false,
            splittable: false,
            resizable: false,
            linkedClipIds: [`scene-${span.index}`],
            locked: false,
            role: 'caption',
            label: token.slice(0, 24),
            trackKey: 'subtitle',
            sceneIndex: span.index,
            accentClass: 'border-amber-500/30 bg-amber-500/12',
          });
        });
      }
    }
  });

  if (backgroundMusicTracks.length) {
    const track = backgroundMusicTracks[0];
    const safeStartMs = backgroundTrackBounds?.startMs ?? Math.max(0, Math.round((track.timelineStartSeconds || 0) * 1000));
    const defaultEndMs = typeof track.timelineEndSeconds === 'number' && Number.isFinite(track.timelineEndSeconds)
      ? Math.max(safeStartMs + MIN_BGM_DURATION_MS, Math.round(track.timelineEndSeconds * 1000))
      : totalDurationMs;
    const safeEndMs = backgroundTrackBounds?.endMs ?? clamp(defaultEndMs, safeStartMs + MIN_BGM_DURATION_MS, Math.max(totalDurationMs, Math.round((track.duration || totalDurationMs / 1000 || 1) * 1000)));
    clips.push({
      id: `bgm-${track.id}`,
      trackId: 'bgm',
      sceneId: null,
      segmentId: null,
      assetId: track.id,
      startMs: safeStartMs,
      endMs: safeEndMs,
      trimInMs: 0,
      trimOutMs: 0,
      draggable: false,
      trimmable: true,
      splittable: false,
      resizable: true,
      linkedClipIds: [],
      locked: false,
      role: 'bgm',
      label: track.title || 'Main BGM',
      trackKey: 'bgm',
      sceneIndex: -1,
      accentClass: 'border-emerald-500/30 bg-emerald-500/12',
    });
  }

  return clips;
}

function getRangeIndices(rangeSelection: TimelineRangeSelection | null, sceneSpans: SceneSpan[]) {
  if (!rangeSelection) return null;
  const touched = sceneSpans.filter((span) => span.endMs > rangeSelection.startMs && span.startMs < rangeSelection.endMs);
  if (!touched.length) return null;
  return { startIndex: touched[0].index, endIndex: touched[touched.length - 1].index };
}

const TimelineWorkbench: React.FC<TimelineWorkbenchProps> = ({
  projectId,
  data,
  backgroundMusicTracks = [],
  selectedThumbnailId,
  onDurationChange,
  onSceneReorder,
  onSplitScene,
  onPinSceneAsThumbnail,
  onPreviewRange,
  onReuseGlobalAsset,
  onBackgroundTrackTimelineChange,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.45);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [rangeSelection, setRangeSelection] = useState<TimelineRangeSelection | null>(null);
  const [selectedSceneIndices, setSelectedSceneIndices] = useState<number[]>(data.length ? [0] : []);
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [snapMode, setSnapMode] = useState<TimelineSnapMode>('scene');
  const [isPlaying, setIsPlaying] = useState(false);
  const [backgroundTrackBounds, setBackgroundTrackBounds] = useState<{ startMs: number; endMs: number } | null>(null);
  const [snapGuideMs, setSnapGuideMs] = useState<number | null>(null);
  const [previewMediaLoading, setPreviewMediaLoading] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [trimPreview, setTrimPreview] = useState<TrimPreview | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const trimPreviewRef = useRef<TrimPreview | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<GlobalAssetLibraryItem[]>([]);
  const [assetQuery, setAssetQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sceneIndex: number } | null>(null);
  const [clipOverrides, setClipOverrides] = useState<Record<string, { startMs: number; endMs: number }>>({});
  const [panelVisibility, setPanelVisibility] = useState({ selectedScene: false, recentActions: false, assetLibrary: false });
  const [telemetryTick, setTelemetryTick] = useState(0);
  const [viewportState, setViewportState] = useState({ scrollLeft: 0, width: 0 });
  const scrollRafRef = useRef<number | null>(null);
  const playbackRafRef = useRef<number | null>(null);
  const playbackPrevTimeRef = useRef<number | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const pendingPointerEventRef = useRef<PointerEvent | null>(null);

  useEffect(() => {
    const snapshot = readTimelineUiSnapshot(projectId);
    if (!snapshot) return;
    setPlayheadMs(snapshot.playheadMs || 0);
    setZoomLevel(snapshot.zoomLevel || 1.45);
    setRangeSelection(snapshot.rangeSelection || null);
    setBackgroundTrackBounds(snapshot.backgroundTrackBounds || null);
    setClipOverrides(snapshot.clipOverrides || {});
    setPanelVisibility({
      selectedScene: Boolean(snapshot.panelVisibility?.selectedScene),
      recentActions: Boolean(snapshot.panelVisibility?.recentActions),
      assetLibrary: Boolean(snapshot.panelVisibility?.assetLibrary),
    });
  }, [projectId]);

  useEffect(() => {
    writeTimelineUiSnapshot(projectId, { playheadMs, zoomLevel, rangeSelection, backgroundTrackBounds, clipOverrides, panelVisibility });
  }, [backgroundTrackBounds, clipOverrides, panelVisibility, playheadMs, projectId, rangeSelection, zoomLevel]);

  useEffect(() => {
    setSelectedSceneIndices((current) => {
      const next = current.filter((index) => index >= 0 && index < data.length);
      return next.length ? next : (data.length ? [0] : []);
    });
  }, [data.length]);

  useEffect(() => {
    let mounted = true;
    void getGlobalAssetLibrary({ projectId: projectId || null, query: assetQuery, limit: 1 }).then((items) => {
      if (mounted) setAssetLibrary(items);
    }).catch(() => {
      if (mounted) setAssetLibrary([]);
    });
    return () => { mounted = false; };
  }, [assetQuery, projectId]);

  useEffect(() => {
    dragPreviewRef.current = dragPreview;
  }, [dragPreview]);

  useEffect(() => {
    trimPreviewRef.current = trimPreview;
  }, [trimPreview]);

  const commitDragPreview = (nextPreview: DragPreview | null) => {
    if (nextPreview === null) {
      dragPreviewRef.current = null;
      setDragPreview((current) => current === null ? current : null);
      return;
    }
    if (isSameDragPreview(dragPreviewRef.current, nextPreview)) return;
    dragPreviewRef.current = nextPreview;
    setDragPreview(nextPreview);
  };

  const commitTrimPreview = (nextPreview: TrimPreview | null) => {
    if (nextPreview === null) {
      trimPreviewRef.current = null;
      setTrimPreview((current) => current === null ? current : null);
      return;
    }
    if (isSameTrimPreview(trimPreviewRef.current, nextPreview)) return;
    trimPreviewRef.current = nextPreview;
    setTrimPreview(nextPreview);
  };

  const sceneSpans = useMemo(() => getSceneSpans(data, {}), [data]);
  const displaySceneSpans = useMemo(() => (trimPreview?.nextDurations ? getSceneSpans(data, trimPreview.nextDurations) : sceneSpans), [data, sceneSpans, trimPreview]);
  const sceneSpanMap = useMemo(() => new Map(sceneSpans.map((span) => [span.index, span])), [sceneSpans]);
  const displaySceneSpanMap = useMemo(() => new Map(displaySceneSpans.map((span) => [span.index, span])), [displaySceneSpans]);
  const totalDurationMs = sceneSpans.length ? sceneSpans[sceneSpans.length - 1].endMs : 0;
  const displayTotalDurationMs = displaySceneSpans.length ? displaySceneSpans[displaySceneSpans.length - 1].endMs : totalDurationMs;
  const trackConfig = useMemo(() => getTrackConfig(subtitleEnabled, backgroundMusicTracks.length > 0), [backgroundMusicTracks.length, subtitleEnabled]);
  const effectiveBackgroundTrackBounds = trimPreview?.backgroundTrackBounds || backgroundTrackBounds;
  const effectiveClipBounds = useMemo(() => ({ ...clipOverrides, ...(trimPreview?.clipBounds || {}) }), [clipOverrides, trimPreview]);
  const renderClips = useMemo(() => buildRenderClips(data, sceneSpans, backgroundMusicTracks, subtitleEnabled, totalDurationMs, effectiveBackgroundTrackBounds).map((clip) => {
    if (clip.trackKey === 'scene' || clip.trackKey === 'bgm') return clip;
    const override = effectiveClipBounds[clip.id];
    if (!override) return { ...clip, draggable: true, trimmable: true, resizable: true };
    return {
      ...clip,
      startMs: override.startMs,
      endMs: override.endMs,
      draggable: true,
      trimmable: true,
      resizable: true,
    };
  }), [backgroundMusicTracks, data, effectiveBackgroundTrackBounds, effectiveClipBounds, sceneSpans, subtitleEnabled, totalDurationMs]);
  const totalCanvasWidth = TRACK_LABEL_WIDTH + msToPx(Math.max(displayTotalDurationMs, 1000), zoomLevel) + TIMELINE_PADDING_RIGHT;
  const visibleStartMs = Math.max(0, pxToMs(viewportState.scrollLeft - 220, zoomLevel));
  const visibleEndMs = Math.max(visibleStartMs + 1200, pxToMs(viewportState.scrollLeft + viewportState.width + 220, zoomLevel));

  const visibleClips = useMemo(() => {
    const selectedSet = new Set(selectedSceneIndices);
    return renderClips.filter((clip) => selectedSet.has(clip.sceneIndex) || clip.id === interaction?.clipId || (clip.endMs >= visibleStartMs && clip.startMs <= visibleEndMs));
  }, [interaction?.clipId, renderClips, selectedSceneIndices, visibleEndMs, visibleStartMs]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const syncViewportState = () => {
      setViewportState((current) => current.scrollLeft === viewport.scrollLeft && current.width === viewport.clientWidth
        ? current
        : { scrollLeft: viewport.scrollLeft, width: viewport.clientWidth });
    };

    syncViewportState();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncViewportState()) : null;
    resizeObserver?.observe(viewport);
    window.addEventListener('resize', syncViewportState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncViewportState);
    };
  }, []);

  const selectedSceneIndex = selectedSceneIndices[0] ?? 0;
  const selectedScene = sceneSpans[selectedSceneIndex] || null;
  const selectedAsset = data[selectedSceneIndex] || null;
  const selectedImageSrc = useMemo(() => resolveImageSrc(selectedAsset?.imageData), [selectedAsset?.imageData]);
  const selectedVideoSrc = useMemo(() => resolveVideoSrc(selectedAsset?.videoData), [selectedAsset?.videoData]);
  const effectivePreviewSceneIndex = useMemo(() => {
    const atPlayhead = sceneSpans.find((span) => playheadMs >= span.startMs && playheadMs < span.endMs);
    return atPlayhead?.index ?? selectedSceneIndex;
  }, [playheadMs, sceneSpans, selectedSceneIndex]);
  const previewSceneAsset = data[effectivePreviewSceneIndex] || selectedAsset;
  const previewImageSrc = useMemo(() => resolveImageSrc(previewSceneAsset?.imageData), [previewSceneAsset?.imageData]);
  const previewVideoSrc = useMemo(() => resolveVideoSrc(previewSceneAsset?.videoData), [previewSceneAsset?.videoData]);

  useEffect(() => {
    if (!backgroundMusicTracks.length) {
      setBackgroundTrackBounds(null);
      return;
    }
    const primaryTrack = backgroundMusicTracks[0];
    const nextStartMs = Math.max(0, Math.round((primaryTrack.timelineStartSeconds || 0) * 1000));
    const nextEndMs = typeof primaryTrack.timelineEndSeconds === 'number' && Number.isFinite(primaryTrack.timelineEndSeconds)
      ? Math.max(nextStartMs + MIN_BGM_DURATION_MS, Math.round(primaryTrack.timelineEndSeconds * 1000))
      : Math.max(totalDurationMs, nextStartMs + MIN_BGM_DURATION_MS);
    setBackgroundTrackBounds((current) => {
      if (current && current.startMs === nextStartMs && current.endMs === nextEndMs) return current;
      return { startMs: nextStartMs, endMs: nextEndMs };
    });
  }, [backgroundMusicTracks, totalDurationMs]);

  useEffect(() => {
    setPreviewMediaLoading(Boolean(previewVideoSrc || previewImageSrc));
  }, [previewImageSrc, previewVideoSrc]);

  const rangeIndices = useMemo(() => getRangeIndices(rangeSelection, sceneSpans), [rangeSelection, sceneSpans]);

  const telemetry = useMemo(() => readEditorTelemetry(projectId || null).slice(0, 5), [projectId, telemetryTick]);
  const timelineQa = useMemo(() => runTimelineQa({
    tracks: trackConfig.map((track, order) => ({ id: track.key, kind: track.key, title: track.label, order, locked: false, muted: false, height: TRACK_HEIGHT })),
    clips: renderClips,
    playheadMs,
    zoomLevel,
    snapMode,
    rippleMode: true,
    selectedClipIds: selectedSceneIndices.map((index) => `scene-${index}`),
    selectedTrackId: 'scene',
    rangeSelection,
    scrollLeftPx: viewportState.scrollLeft,
    scrollTopPx: 0,
  }), [playheadMs, rangeSelection, renderClips, selectedSceneIndices, snapMode, trackConfig, viewportState.scrollLeft, zoomLevel]);

  useEffect(() => {
    setPlayheadMs((current) => clamp(current, 0, totalDurationMs));
    if (rangeSelection && rangeSelection.endMs > totalDurationMs) {
      setRangeSelection({
        startMs: clamp(rangeSelection.startMs, 0, totalDurationMs),
        endMs: totalDurationMs,
      });
    }
  }, [rangeSelection, totalDurationMs]);

  useEffect(() => {
    if (!isPlaying) {
      playbackPrevTimeRef.current = null;
      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      const previous = playbackPrevTimeRef.current ?? timestamp;
      const delta = timestamp - previous;
      playbackPrevTimeRef.current = timestamp;
      setPlayheadMs((current) => {
        const next = current + delta;
        if (next >= totalDurationMs) {
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });
      playbackRafRef.current = window.requestAnimationFrame(tick);
    };

    playbackRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      playbackPrevTimeRef.current = null;
    };
  }, [isPlaying, totalDurationMs]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      setIsPlaying((current) => !current);
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('keyup', handleGlobalKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('keyup', handleGlobalKeyUp, true);
    };
  }, []);

  useEffect(() => {
    if (!interaction) return;

    const processPointerMove = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const dx = event.clientX - interaction.startClientX;
      const dy = event.clientY - interaction.startClientY;
      const movedEnough = Math.abs(dx) >= DRAG_THRESHOLD_PX || Math.abs(dy) >= DRAG_THRESHOLD_PX;
      const baseSceneSpans = interaction.originSceneSpans.length ? interaction.originSceneSpans : sceneSpans;
      const baseTotalDurationMs = baseSceneSpans.length ? baseSceneSpans[baseSceneSpans.length - 1].endMs : totalDurationMs;

      if (interaction.kind === 'scrub') {
        const x = event.clientX - rect.left + viewport.scrollLeft - TRACK_LABEL_WIDTH;
        setPlayheadMs(clamp(pxToMs(x, zoomLevel), 0, totalDurationMs));
        setSnapGuideMs(null);
        if (interaction.phase === 'pending' && movedEnough) {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        return;
      }

      if (interaction.kind === 'pan') {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        viewport.scrollLeft = clamp(interaction.originScrollLeft - dx, 0, maxScrollLeft);
        setSnapGuideMs(null);
        return;
      }

      if (interaction.kind === 'marquee') {
        const x = event.clientX - rect.left + viewport.scrollLeft;
        const y = event.clientY - rect.top;
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        setMarqueeRect({ x1: interaction.startClientX, y1: interaction.startClientY, x2: x, y2: y });
        setSnapGuideMs(null);
        return;
      }

      if (interaction.kind === 'move') {
        if (interaction.trackKey && interaction.trackKey !== 'scene' && interaction.clipId && typeof interaction.originClipStartMs === 'number' && typeof interaction.originClipEndMs === 'number') {
          if (interaction.phase === 'pending' && !movedEnough) return;
          if (interaction.phase === 'pending') {
            setInteraction((current) => current ? { ...current, phase: 'active', moveDeltaPx: dx } : current);
          } else {
            setInteraction((current) => current ? { ...current, moveDeltaPx: dx } : current);
          }
          const durationMs = Math.max(TIMELINE_MIN_CLIP_MS, interaction.originClipEndMs - interaction.originClipStartMs);
          const rawStartMs = Math.max(0, interaction.originClipStartMs + pxToMs(dx, zoomLevel));
          const snapTargets = buildSnapTargets(Math.max(baseTotalDurationMs, interaction.originClipEndMs + 120000), baseSceneSpans, [], snapMode, playheadMs, [interaction.originClipEndMs]);
          const snappedStartMs = Math.max(0, applySnap(rawStartMs, snapTargets, snapMode));
          setSnapGuideMs(Math.abs(snappedStartMs - rawStartMs) > 1 ? snappedStartMs : null);
          commitTrimPreview({
            kind: 'resize-right',
            sceneIndex: interaction.sceneIndex ?? -1,
            trackKey: interaction.trackKey,
            clipId: interaction.clipId,
            clipBounds: {
              [interaction.clipId]: {
                startMs: snappedStartMs,
                endMs: snappedStartMs + durationMs,
              },
            },
          });
          return;
        }
        const activeIndices = areIndicesContiguous(interaction.selectedIndices)
          ? [...interaction.selectedIndices].sort((a, b) => a - b)
          : (interaction.sceneIndex !== null ? [interaction.sceneIndex] : []);
        if (!activeIndices.length) return;
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active', selectedIndices: activeIndices, moveDeltaPx: dx } : current);
        } else {
          setInteraction((current) => current ? { ...current, moveDeltaPx: dx } : current);
        }
        const firstIndex = activeIndices[0];
        const lastIndex = activeIndices[activeIndices.length - 1];
        const firstSpan = baseSceneSpans[firstIndex];
        const lastSpan = baseSceneSpans[lastIndex];
        if (!firstSpan || !lastSpan) return;
        const blockDurationMs = lastSpan.endMs - firstSpan.startMs;
        const maxStartMs = Math.max(0, baseTotalDurationMs - blockDurationMs);
        const rawStartMs = clamp(firstSpan.startMs + pxToMs(dx, zoomLevel), 0, maxStartMs);
        const snapTargets = buildSnapTargets(baseTotalDurationMs, baseSceneSpans, activeIndices, snapMode, playheadMs);
        const snappedStartMs = clamp(applySnap(rawStartMs, snapTargets, snapMode), 0, maxStartMs);
        setSnapGuideMs(Math.abs(snappedStartMs - rawStartMs) > 1 ? snappedStartMs : null);
        const centerMs = snappedStartMs + (blockDurationMs / 2);
        const remainder = baseSceneSpans.filter((span) => !activeIndices.includes(span.index));
        let insertIndex = remainder.length;
        for (let i = 0; i < remainder.length; i += 1) {
          const midpoint = remainder[i].startMs + ((remainder[i].endMs - remainder[i].startMs) / 2);
          if (centerMs < midpoint) {
            insertIndex = i;
            break;
          }
        }
        const nextDragPreview = {
          startMs: snappedStartMs,
          endMs: snappedStartMs + blockDurationMs,
          widthMs: blockDurationMs,
          insertIndex,
          selectedIndices: activeIndices,
        } satisfies DragPreview;
        commitDragPreview(nextDragPreview);
        return;
      }

      if (interaction.kind === 'resize-right' && interaction.trackKey === 'bgm' && interaction.originBgmBounds && interaction.clipId) {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        const maxBgmEndMs = Math.max(totalDurationMs, Math.round((backgroundMusicTracks[0]?.duration || totalDurationMs / 1000 || 1) * 1000));
        const rawEndMs = interaction.originBgmBounds.endMs + pxToMs(dx, zoomLevel);
        const snapTargets = buildSnapTargets(maxBgmEndMs, baseSceneSpans, [], snapMode, playheadMs, [interaction.originBgmBounds.startMs, totalDurationMs]);
        const snappedEndMs = clamp(applySnap(rawEndMs, snapTargets, snapMode), interaction.originBgmBounds.startMs + MIN_BGM_DURATION_MS, maxBgmEndMs);
        setSnapGuideMs(Math.abs(snappedEndMs - rawEndMs) > 1 ? snappedEndMs : null);
        commitTrimPreview({
          kind: 'resize-right',
          sceneIndex: -1,
          trackKey: 'bgm',
          clipId: interaction.clipId,
          backgroundTrackBounds: { startMs: interaction.originBgmBounds.startMs, endMs: snappedEndMs },
        });
        return;
      }

      if (interaction.kind === 'resize-left' && interaction.trackKey === 'bgm' && interaction.originBgmBounds && interaction.clipId) {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        const rawStartMs = interaction.originBgmBounds.startMs + pxToMs(dx, zoomLevel);
        const maxStartMs = interaction.originBgmBounds.endMs - MIN_BGM_DURATION_MS;
        const snapTargets = buildSnapTargets(Math.max(totalDurationMs, interaction.originBgmBounds.endMs), baseSceneSpans, [], snapMode, playheadMs, [0, totalDurationMs, interaction.originBgmBounds.endMs]);
        const snappedStartMs = clamp(applySnap(rawStartMs, snapTargets, snapMode), 0, maxStartMs);
        setSnapGuideMs(Math.abs(snappedStartMs - rawStartMs) > 1 ? snappedStartMs : null);
        commitTrimPreview({
          kind: 'resize-left',
          sceneIndex: -1,
          trackKey: 'bgm',
          clipId: interaction.clipId,
          backgroundTrackBounds: { startMs: snappedStartMs, endMs: interaction.originBgmBounds.endMs },
        });
        return;
      }

      if ((interaction.kind === 'resize-right' || interaction.kind === 'resize-left') && interaction.trackKey && interaction.trackKey !== 'scene' && interaction.trackKey !== 'bgm' && interaction.clipId && typeof interaction.originClipStartMs === 'number' && typeof interaction.originClipEndMs === 'number') {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        const minDurationMs = Math.max(TIMELINE_MIN_CLIP_MS, 320);
        let nextStartMs = interaction.originClipStartMs;
        let nextEndMs = interaction.originClipEndMs;
        if (interaction.kind === 'resize-right') {
          const rawEndMs = interaction.originClipEndMs + pxToMs(dx, zoomLevel);
          const snapTargets = buildSnapTargets(Math.max(baseTotalDurationMs, interaction.originClipEndMs + 120000), baseSceneSpans, [], snapMode, playheadMs, [interaction.originClipStartMs]);
          nextEndMs = Math.max(interaction.originClipStartMs + minDurationMs, applySnap(rawEndMs, snapTargets, snapMode));
          setSnapGuideMs(Math.abs(nextEndMs - rawEndMs) > 1 ? nextEndMs : null);
        } else {
          const rawStartMs = interaction.originClipStartMs + pxToMs(dx, zoomLevel);
          const snapTargets = buildSnapTargets(Math.max(baseTotalDurationMs, interaction.originClipEndMs + 120000), baseSceneSpans, [], snapMode, playheadMs, [0, interaction.originClipEndMs]);
          nextStartMs = Math.max(0, Math.min(interaction.originClipEndMs - minDurationMs, applySnap(rawStartMs, snapTargets, snapMode)));
          setSnapGuideMs(Math.abs(nextStartMs - rawStartMs) > 1 ? nextStartMs : null);
        }
        commitTrimPreview({
          kind: interaction.kind,
          sceneIndex: interaction.sceneIndex ?? -1,
          trackKey: interaction.trackKey,
          clipId: interaction.clipId,
          clipBounds: {
            [interaction.clipId]: {
              startMs: nextStartMs,
              endMs: nextEndMs,
            },
          },
        });
        return;
      }

      if (interaction.kind === 'resize-right' && interaction.sceneIndex !== null) {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        const span = baseSceneSpans[interaction.sceneIndex];
        if (!span) return;
        const rawEndMs = span.endMs + pxToMs(dx, zoomLevel);
        const snapTargets = buildSnapTargets(baseTotalDurationMs + 120000, baseSceneSpans, [interaction.sceneIndex], snapMode, playheadMs);
        const snappedEndMs = applySnap(rawEndMs, snapTargets, snapMode);
        const nextDurationMs = Math.max(MIN_SCENE_DURATION_MS, snappedEndMs - span.startMs);
        setSnapGuideMs(Math.abs(snappedEndMs - rawEndMs) > 1 ? snappedEndMs : null);
        const nextTrimPreview = {
          kind: 'resize-right',
          sceneIndex: interaction.sceneIndex,
          trackKey: 'scene',
          clipId: interaction.clipId || `scene-${interaction.sceneIndex}`,
          nextDurations: { [interaction.sceneIndex]: Number((nextDurationMs / 1000).toFixed(1)) },
        } satisfies TrimPreview;
        commitTrimPreview(nextTrimPreview);
        return;
      }

      if (interaction.kind === 'resize-left' && interaction.sceneIndex !== null) {
        if (interaction.phase === 'pending' && !movedEnough) return;
        if (interaction.phase === 'pending') {
          setInteraction((current) => current ? { ...current, phase: 'active' } : current);
        }
        if (interaction.sceneIndex === 0) return;
        const previousSpan = baseSceneSpans[interaction.sceneIndex - 1];
        const currentSpan = baseSceneSpans[interaction.sceneIndex];
        if (!previousSpan || !currentSpan) return;
        const rawBoundary = currentSpan.startMs + pxToMs(dx, zoomLevel);
        const snapTargets = buildSnapTargets(baseTotalDurationMs, baseSceneSpans, [interaction.sceneIndex - 1, interaction.sceneIndex], snapMode, playheadMs);
        const snappedBoundary = applySnap(rawBoundary, snapTargets, snapMode);
        const boundedBoundary = clamp(snappedBoundary, previousSpan.startMs + MIN_SCENE_DURATION_MS, currentSpan.endMs - MIN_SCENE_DURATION_MS);
        setSnapGuideMs(Math.abs(boundedBoundary - rawBoundary) > 1 ? boundedBoundary : null);
        const nextTrimPreview = {
          kind: 'resize-left',
          sceneIndex: interaction.sceneIndex,
          trackKey: 'scene',
          clipId: interaction.clipId || `scene-${interaction.sceneIndex}`,
          nextDurations: {
            [interaction.sceneIndex - 1]: Number(((boundedBoundary - previousSpan.startMs) / 1000).toFixed(1)),
            [interaction.sceneIndex]: Number(((currentSpan.endMs - boundedBoundary) / 1000).toFixed(1)),
          },
        } satisfies TrimPreview;
        commitTrimPreview(nextTrimPreview);
      }
    };

    const flushPointerMove = () => {
      interactionFrameRef.current = null;
      const event = pendingPointerEventRef.current;
      if (!event) return;
      processPointerMove(event);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointerEventRef.current = event;
      if (interactionFrameRef.current !== null) return;
      interactionFrameRef.current = window.requestAnimationFrame(flushPointerMove);
    };

    const handlePointerUp = () => {
      const currentDragPreview = dragPreviewRef.current;
      const currentTrimPreview = trimPreviewRef.current;

      if (interaction.kind === 'move' && interaction.phase === 'active') {
        if (interaction.trackKey && interaction.trackKey !== 'scene' && interaction.clipId && currentTrimPreview?.clipBounds?.[interaction.clipId]) {
          const nextBounds = currentTrimPreview.clipBounds[interaction.clipId];
          setClipOverrides((current) => ({ ...current, [interaction.clipId as string]: nextBounds }));
          appendEditorTelemetry(projectId || null, 'timeline-move-clip', { clipId: interaction.clipId, trackKey: interaction.trackKey });
          setTelemetryTick((current) => current + 1);
        } else if (currentDragPreview && onSceneReorder) {
          const selected = currentDragPreview.selectedIndices;
          const currentOrder = data.map((_, index) => index);
          const movedBlock = selected.map((index) => currentOrder[index]);
          const remainder = currentOrder.filter((index) => !selected.includes(index));
          const nextOrder = [...remainder];
          nextOrder.splice(currentDragPreview.insertIndex, 0, ...movedBlock);
          let workingOrder = currentOrder;
          nextOrder.forEach((sceneIndex, desiredIndex) => {
            const currentIndex = workingOrder.indexOf(sceneIndex);
            if (currentIndex !== desiredIndex) {
              onSceneReorder(currentIndex, desiredIndex);
              workingOrder = arrayMove(workingOrder, currentIndex, desiredIndex);
            }
          });
          const remappedSelection = movedBlock.map((sceneIndex) => nextOrder.indexOf(sceneIndex)).sort((a, b) => a - b);
          setSelectedSceneIndices(remappedSelection);
          appendEditorTelemetry(projectId || null, 'timeline-move-scenes', { count: selected.length, insertIndex: currentDragPreview.insertIndex });
          setTelemetryTick((current) => current + 1);
        }
      }

      if ((interaction.kind === 'resize-right' || interaction.kind === 'resize-left') && interaction.phase === 'active' && currentTrimPreview) {
        if (currentTrimPreview.trackKey === 'bgm' && currentTrimPreview.backgroundTrackBounds && backgroundMusicTracks[0]) {
          setBackgroundTrackBounds(currentTrimPreview.backgroundTrackBounds);
          onBackgroundTrackTimelineChange?.(backgroundMusicTracks[0].id, {
            timelineStartSeconds: Number((currentTrimPreview.backgroundTrackBounds.startMs / 1000).toFixed(3)),
            timelineEndSeconds: Number((currentTrimPreview.backgroundTrackBounds.endMs / 1000).toFixed(3)),
          });
          appendEditorTelemetry(projectId || null, 'timeline-trim-bgm', { kind: interaction.kind });
          setTelemetryTick((current) => current + 1);
        } else if (currentTrimPreview.trackKey && currentTrimPreview.trackKey !== 'scene' && currentTrimPreview.clipId && currentTrimPreview.clipBounds?.[currentTrimPreview.clipId]) {
          const nextBounds = currentTrimPreview.clipBounds[currentTrimPreview.clipId];
          setClipOverrides((current) => ({ ...current, [currentTrimPreview.clipId as string]: nextBounds }));
          appendEditorTelemetry(projectId || null, 'timeline-trim-clip', { clipId: currentTrimPreview.clipId, kind: interaction.kind, trackKey: currentTrimPreview.trackKey });
          setTelemetryTick((current) => current + 1);
        } else {
          const changedEntries = Object.entries(currentTrimPreview.nextDurations || {});
          changedEntries.forEach(([key, value]) => {
            const index = Number(key);
            if (!Number.isFinite(index)) return;
            onDurationChange?.(index, Number(value));
          });
          if (changedEntries.length) {
            appendEditorTelemetry(projectId || null, 'timeline-trim', { count: changedEntries.length, kind: interaction.kind });
            setTelemetryTick((current) => current + 1);
          }
        }
      }

      if (interaction.kind === 'marquee' && interaction.phase === 'active' && marqueeRect) {
        const minX = Math.min(marqueeRect.x1, marqueeRect.x2) - TRACK_LABEL_WIDTH;
        const maxX = Math.max(marqueeRect.x1, marqueeRect.x2) - TRACK_LABEL_WIDTH;
        const minY = Math.min(marqueeRect.y1, marqueeRect.y2);
        const maxY = Math.max(marqueeRect.y1, marqueeRect.y2);
        const selection = sceneSpans.filter((span) => {
          const left = msToPx(span.startMs, zoomLevel);
          const right = msToPx(span.endMs, zoomLevel);
          const sceneTrackTop = getTrackTop(0);
          const sceneTrackBottom = sceneTrackTop + TRACK_HEIGHT;
          return right >= minX && left <= maxX && sceneTrackBottom >= minY && sceneTrackTop <= maxY;
        }).map((span) => span.index);
        if (selection.length) {
          setSelectedSceneIndices(selection);
          appendEditorTelemetry(projectId || null, 'timeline-marquee-select', { count: selection.length });
          setTelemetryTick((current) => current + 1);
        }
      }

      if (interactionFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionFrameRef.current);
        interactionFrameRef.current = null;
      }
      pendingPointerEventRef.current = null;
      setInteraction(null);
      setSnapGuideMs(null);
      commitDragPreview(null);
      setMarqueeRect(null);
      commitTrimPreview(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (interactionFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionFrameRef.current);
        interactionFrameRef.current = null;
      }
      pendingPointerEventRef.current = null;
    };
  }, [backgroundMusicTracks, data, interaction, marqueeRect, onBackgroundTrackTimelineChange, onDurationChange, onSceneReorder, playheadMs, projectId, sceneSpans, snapMode, totalDurationMs, zoomLevel]);

  const handleSelectScene = (sceneIndex: number, event?: React.MouseEvent) => {
    setContextMenu(null);
    if (event?.shiftKey && selectedSceneIndices.length) {
      const anchor = selectedSceneIndices[selectedSceneIndices.length - 1] ?? sceneIndex;
      const start = Math.min(anchor, sceneIndex);
      const end = Math.max(anchor, sceneIndex);
      setSelectedSceneIndices(Array.from({ length: end - start + 1 }, (_, offset) => start + offset));
      return;
    }
    if (event && (event.metaKey || event.ctrlKey)) {
      setSelectedSceneIndices((current) => current.includes(sceneIndex)
        ? current.filter((item) => item !== sceneIndex)
        : [...current, sceneIndex].sort((a, b) => a - b));
      return;
    }
    setSelectedSceneIndices([sceneIndex]);
  };

  const beginScrub = (event: React.MouseEvent) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + viewportRef.current.scrollLeft - TRACK_LABEL_WIDTH;
    setPlayheadMs(clamp(pxToMs(x, zoomLevel), 0, totalDurationMs));
    setInteraction({
      kind: 'scrub',
      phase: 'pending',
      sceneIndex: null,
      selectedIndices: [],
      startClientX: event.clientX,
      startClientY: event.clientY,
      originDurationMs: 0,
      originPlayheadMs: playheadMs,
      originScrollLeft: viewportRef.current.scrollLeft,
      trackKey: null,
      originSceneSpans: sceneSpans,
      moveDeltaPx: 0,
    });
  };

  const ensureVisibleAtMs = (targetMs: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const targetPx = msToPx(targetMs, zoomLevel);
    const leftEdge = viewport.scrollLeft;
    const rightEdge = viewport.scrollLeft + viewport.clientWidth - 120;
    if (targetPx < leftEdge) {
      viewport.scrollTo({ left: Math.max(0, targetPx - 80), behavior: 'smooth' });
    } else if (targetPx > rightEdge) {
      viewport.scrollTo({ left: Math.max(0, targetPx - viewport.clientWidth + 160), behavior: 'smooth' });
    }
  };

  useEffect(() => {
    ensureVisibleAtMs(playheadMs);
  }, [playheadMs]);

  const handleContextAction = (action: 'split' | 'pin' | 'range-preview') => {
    if (!contextMenu) return;
    const sceneIndex = contextMenu.sceneIndex;
    setContextMenu(null);
    handleSelectScene(sceneIndex);
    const span = sceneSpans[sceneIndex];
    if (!span) return;

    if (action === 'split' && onSplitScene) {
      const splitMs = clamp(playheadMs, span.startMs + TIMELINE_MIN_CLIP_MS, span.endMs - TIMELINE_MIN_CLIP_MS);
      onSplitScene(sceneIndex, Number(((splitMs - span.startMs) / 1000).toFixed(1)));
      appendEditorTelemetry(projectId || null, 'timeline-split', { sceneIndex });
      setTelemetryTick((current) => current + 1);
      return;
    }

    if (action === 'pin') {
      onPinSceneAsThumbnail?.(sceneIndex);
      window.alert('썸네일이 저장되었습니다.');
      appendEditorTelemetry(projectId || null, 'timeline-pin-thumbnail', { sceneIndex });
      setTelemetryTick((current) => current + 1);
      return;
    }

    if (action === 'range-preview') {
      onPreviewRange?.({ startIndex: sceneIndex, endIndex: sceneIndex });
    }
  };

  const previewRangeLabel = rangeIndices
    ? `${rangeIndices.startIndex + 1} ~ ${rangeIndices.endIndex + 1}씬`
    : `${selectedSceneIndices.length ? `${selectedSceneIndices.length}개 선택` : '범위 없음'}`;

  const blockPreview = dragPreview && dragPreview.selectedIndices.length
    ? {
        left: msToPx(dragPreview.startMs, zoomLevel),
        width: msToPx(dragPreview.widthMs, zoomLevel),
      }
    : null;

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#030814] text-white shadow-[0_30px_80px_-40px_rgba(2,8,23,1)]">
      <div className="border-b border-slate-800 bg-[linear-gradient(180deg,#09101d,#050914)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">Timeline Editor</div>
            <h3 className="mt-2 text-xl font-black text-white">씬 카드와 분리된 실사용 타임라인 워크벤치</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">클릭은 선택만 하고, 드래그는 움직이고, 핸들을 잡았을 때만 길이가 바뀌도록 다시 정리했습니다. Step6 데이터와 그대로 연결됩니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-300">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">총 {data.length}씬</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">길이 {((trimPreview ? displayTotalDurationMs : totalDurationMs) / 1000).toFixed(1)}초</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">선택 {previewRangeLabel}</span>
            <span className={`rounded-full border px-3 py-2 ${timelineQa.isHealthy ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>{timelineQa.isHealthy ? 'QA 정상' : 'QA 점검'}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 px-5 py-5">
        <div className="overflow-hidden rounded-[26px] border border-slate-800 bg-black">
          <div className="flex min-h-[340px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.75),rgba(2,6,23,0.92))] px-6 py-6">
            <div className="w-full max-w-[660px]">
              <div className="mb-3 flex items-center justify-between text-xs font-black text-slate-400">
                <span>PREVIEW</span>
                <span>Scene {previewSceneAsset?.sceneNumber || effectivePreviewSceneIndex + 1}</span>
              </div>
              <div className="relative overflow-hidden rounded-[24px] border border-slate-800 bg-[#020617] shadow-[0_26px_60px_-30px_rgba(0,0,0,0.9)]" style={{ aspectRatio: PREVIEW_ASPECT_BY_RATIO[previewSceneAsset?.aspectRatio || '16:9'] }}>
                {previewVideoSrc ? (
                  <video
                    key={previewVideoSrc}
                    src={previewVideoSrc}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    playsInline
                    muted
                    controls={false}
                    onLoadStart={() => setPreviewMediaLoading(true)}
                    onLoadedData={() => setPreviewMediaLoading(false)}
                    onCanPlay={() => setPreviewMediaLoading(false)}
                  />
                ) : previewImageSrc ? (
                  <img
                    src={previewImageSrc}
                    alt={`Scene ${previewSceneAsset?.sceneNumber || effectivePreviewSceneIndex + 1}`}
                    className="h-full w-full object-cover"
                    draggable={false}
                    loading="lazy"
                    onLoad={() => setPreviewMediaLoading(false)}
                    onError={() => setPreviewMediaLoading(false)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">선택한 씬 미리보기가 아직 없습니다.</div>
                )}
                {previewMediaLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/72 backdrop-blur-[2px]">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-center shadow-xl">
                      <div className="text-sm font-black text-white">이 구간 미리보기를 불러오는 중</div>
                      <div className="mt-1 text-[11px] font-bold text-slate-400">무거운 영상은 현재 보이는 미리보기만 먼저 로딩합니다.</div>
                    </div>
                  </div>
                ) : null}
                {previewVideoSrc ? <div className="absolute right-3 top-3 rounded-full bg-violet-500/90 px-3 py-1 text-[11px] font-black text-white">VIDEO</div> : null}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-6 pb-5 pt-16">
                  <div className="text-center text-[18px] font-black text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">{previewSceneAsset?.narration || '현재 선택한 씬의 나레이션이 여기에 표시됩니다.'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#060c17] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((current) => !current)}
                className="flex h-10 items-center gap-2 rounded-full bg-cyan-500 px-4 text-sm font-black text-slate-950 shadow-[0_12px_30px_-18px_rgba(34,211,238,0.95)] hover:bg-cyan-400"
              >
                <span>{isPlaying ? '⏸' : '▶'}</span>
                <span>{isPlaying ? '일시정지' : '재생'}</span>
              </button>
              <button type="button" onClick={() => setPlayheadMs((current) => clamp(current - 1000, 0, totalDurationMs))} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800">-1s</button>
              <button type="button" onClick={() => setPlayheadMs((current) => clamp(current + 1000, 0, totalDurationMs))} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800">+1s</button>
              <div className="rounded-full border border-slate-800 bg-[#090f1b] px-4 py-2 text-sm font-black text-cyan-300">{formatTimelineTime(playheadMs)} / {formatTimelineTime(trimPreview ? displayTotalDurationMs : totalDurationMs)}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-1">
                {(['off', 'scene', 'frame'] as TimelineSnapMode[]).map((mode) => (
                  <button key={mode} type="button" title={mode === 'off' ? '자석 정렬 없이 자유 이동' : mode === 'scene' ? '씬 경계와 세로 가이드에 맞춰 자석 정렬' : '30fps 프레임 단위로 더 촘촘하게 정렬'} onClick={() => setSnapMode(mode)} className={`rounded-full px-3 py-1.5 text-[11px] font-black ${snapMode === mode ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>{mode === 'off' ? 'OFF' : mode === 'scene' ? '씬' : '프레임'}</button>
                ))}
              </div>
              <button type="button" onClick={() => setSubtitleEnabled((current) => !current)} className={`rounded-full border px-3 py-2 text-[11px] font-black ${subtitleEnabled ? 'border-amber-500/40 bg-amber-500/12 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>자막 {subtitleEnabled ? 'ON' : 'OFF'}</button>
              <button type="button" onClick={() => setZoomLevel((current) => clampTimelineZoom(current - 0.12))} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800">축소</button>
              <button type="button" onClick={() => setZoomLevel((current) => clampTimelineZoom(current + 0.12))} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800">확대</button>
              <button type="button" onClick={() => {
                if (rangeIndices) {
                  onPreviewRange?.(rangeIndices);
                  return;
                }
                const fallbackRange = getSceneRangeFromSelection(selectedSceneIndices, data.length);
                if (fallbackRange) onPreviewRange?.(fallbackRange);
              }} className="rounded-full bg-violet-600 px-4 py-2 text-[11px] font-black text-white hover:bg-violet-500">범위 미리보기</button>
              <button type="button" onClick={() => {
                if (!selectedScene || !onSplitScene) return;
                const splitMs = clamp(playheadMs, selectedScene.startMs + TIMELINE_MIN_CLIP_MS, selectedScene.endMs - TIMELINE_MIN_CLIP_MS);
                onSplitScene(selectedScene.index, Number(((splitMs - selectedScene.startMs) / 1000).toFixed(1)));
              }} disabled={!selectedScene || !onSplitScene || playheadMs <= (selectedScene?.startMs || 0) || playheadMs >= (selectedScene?.endMs || 0)} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500">플레이헤드 분할</button>
              <button type="button" onClick={() => selectedSceneIndex >= 0 && onPinSceneAsThumbnail?.(selectedSceneIndex)} disabled={selectedSceneIndex < 0 || !onPinSceneAsThumbnail} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500">썸네일 핀</button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="overflow-hidden rounded-[26px] border border-slate-800 bg-[#060b16]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs font-black text-slate-400">
            <span>클립 본문은 이동 전용, 양 끝 핸들은 길이 조절 전용입니다. 빈 공간은 드래그로 좌우 이동하고, Shift+드래그는 범위 선택입니다.</span>
            <span>{Math.round(zoomLevel * 100)}%</span>
          </div>

          <div
            ref={viewportRef}
            className="overflow-x-auto overflow-y-hidden"
            onDragStart={(event) => event.preventDefault()}
            onScroll={(event) => {
              const nextScrollLeft = event.currentTarget.scrollLeft;
              const nextWidth = event.currentTarget.clientWidth;
              if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
              scrollRafRef.current = window.requestAnimationFrame(() => {
                setViewportState((current) => current.scrollLeft === nextScrollLeft && current.width === nextWidth ? current : { scrollLeft: nextScrollLeft, width: nextWidth });
                scrollRafRef.current = null;
              });
            }}
            onWheel={(event) => {
              if (!(event.ctrlKey || event.metaKey)) return;
              event.preventDefault();
              setZoomLevel((current) => clampTimelineZoom(current + (event.deltaY < 0 ? 0.12 : -0.12)));
            }}
          >
            <div className="relative min-w-full" style={{ width: totalCanvasWidth, height: RULER_HEIGHT + (trackConfig.length * (TRACK_HEIGHT + TRACK_GAP)) + 18 }}>
              <div className="sticky left-0 z-30 flex h-[42px] border-b border-slate-800 bg-[#090f19]">
                <div className="flex w-[172px] shrink-0 items-center justify-between border-r border-slate-800 px-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Tracks</span>
                  <span className="text-[11px] font-black text-slate-500">+</span>
                </div>
                <div className="relative flex-1 select-none" onMouseDown={beginScrub}>
                  {Array.from({ length: Math.max(2, Math.ceil((trimPreview ? displayTotalDurationMs : totalDurationMs) / 1000) + 1) }, (_, second) => second * 1000).map((tick) => (
                    <div key={tick} className="absolute inset-y-0" style={{ left: msToPx(tick, zoomLevel) }}>
                      <div className="h-full border-l border-slate-800" />
                      <div className="absolute left-1 top-1 text-[10px] font-bold text-slate-500">{tick / 1000}</div>
                    </div>
                  ))}
                  {rangeSelection ? (
                    <div className="absolute inset-y-0 bg-cyan-500/12" style={{ left: msToPx(rangeSelection.startMs, zoomLevel), width: Math.max(2, msToPx(rangeSelection.endMs - rangeSelection.startMs, zoomLevel)) }} />
                  ) : null}
                  <div className="absolute inset-y-0 z-20 w-[2px] bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.7)]" style={{ left: msToPx(playheadMs, zoomLevel) }} />
                </div>
              </div>

              {trackConfig.map((track, order) => {
                const top = getTrackTop(order);
                const rowClips = visibleClips.filter((clip) => clip.trackKey === track.key);
                const isBgmTrack = track.key === 'bgm';
                return (
                  <div key={track.key} className="absolute inset-x-0" style={{ top, height: TRACK_HEIGHT }}>
                    <div className="flex h-full border-b border-slate-900/80">
                      <div className={`sticky left-0 z-20 flex w-[172px] shrink-0 items-center justify-between border-r border-slate-800 bg-[#0b1220] px-4 ${track.accent} border-l-2`}>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-black text-slate-100"><span className="text-base">{track.glyph}</span>{track.label}</div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{track.badge}</div>
                        </div>
                        <div className="rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black text-slate-500">{track.hint}</div>
                      </div>

                      <div
                        className="relative flex-1 bg-[linear-gradient(180deg,#0a101a,#090d15)]"
                        onMouseDown={(event) => {
                          const target = event.target as HTMLElement | null;
                          if (target?.closest('[data-timeline-clip="true"]') || target?.closest('[data-timeline-handle="true"]')) return;
                          if (!viewportRef.current) return;
                          event.preventDefault();
                          const rect = viewportRef.current.getBoundingClientRect();
                          const x = event.clientX - rect.left + viewportRef.current.scrollLeft;
                          const y = event.clientY - rect.top;
                          setContextMenu(null);
                          setInteraction({
                            kind: event.shiftKey ? 'marquee' : 'pan',
                            phase: 'pending',
                            sceneIndex: null,
                            selectedIndices: [],
                            startClientX: event.shiftKey ? x : event.clientX,
                            startClientY: event.shiftKey ? y : event.clientY,
                            originDurationMs: 0,
                            originPlayheadMs: playheadMs,
                            originScrollLeft: viewportRef.current.scrollLeft,
                            trackKey: track.key,
                            originSceneSpans: sceneSpans,
                            moveDeltaPx: 0,
                          });
                        }}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(51,65,85,0.4)_1px,transparent_1px)]" style={{ backgroundSize: `${Math.max(28, msToPx(1000, zoomLevel))}px 100%` }} />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.01),transparent)]" />

                        {track.key === 'scene' && dragPreview ? (() => {
                          const remainder = sceneSpans.filter((span) => !dragPreview.selectedIndices.includes(span.index));
                          const insertBefore = remainder[dragPreview.insertIndex] ?? null;
                          const insertAfter = dragPreview.insertIndex > 0 ? remainder[dragPreview.insertIndex - 1] : null;
                          const insertionMs = insertBefore ? insertBefore.startMs : insertAfter ? insertAfter.endMs : dragPreview.startMs;
                          return (
                            <div
                              className="pointer-events-none absolute bottom-[4px] top-[4px] z-[18] w-[3px] rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.8)]"
                              style={{ left: msToPx(insertionMs, zoomLevel) - 1 }}
                            />
                          );
                        })() : null}

                        {rowClips.map((clip) => {
                          const isSelected = clip.sceneIndex >= 0 && selectedSceneIndices.includes(clip.sceneIndex);
                          const isPinned = selectedThumbnailId === `scene-${clip.sceneIndex}` || selectedThumbnailId === `scene-${data[clip.sceneIndex]?.sceneNumber}`;
                          const visualSpan = track.key === 'scene' && clip.sceneIndex >= 0 ? displaySceneSpanMap.get(clip.sceneIndex) : null;
                          const clipStartMs = visualSpan?.startMs ?? clip.startMs;
                          const clipEndMs = visualSpan?.endMs ?? clip.endMs;
                          const width = Math.max(track.key === 'subtitle' ? 66 : 88, msToPx(clipEndMs - clipStartMs, zoomLevel));
                          const left = msToPx(clipStartMs, zoomLevel);
                          const isActivelyMoving = Boolean(
                            interaction?.kind === 'move'
                            && interaction.phase === 'active'
                            && (
                              (track.key === 'scene' && interaction.selectedIndices.includes(clip.sceneIndex))
                              || (track.key !== 'scene' && interaction.clipId === clip.id)
                            )
                          );
                          const activeBlockFirstIndex = dragPreview?.selectedIndices?.[0] ?? -1;
                          const activeBlockFirstSpan = activeBlockFirstIndex >= 0 ? sceneSpanMap.get(activeBlockFirstIndex) : null;
                          const activeBlockDeltaPx = track.key === 'scene'
                            ? (dragPreview && activeBlockFirstSpan ? msToPx(dragPreview.startMs - activeBlockFirstSpan.startMs, zoomLevel) : 0)
                            : (interaction?.kind === 'move' && interaction.clipId === clip.id ? interaction.moveDeltaPx : 0);
                          return (
                            <div
                              key={clip.id}
                              data-timeline-clip="true"
                              draggable={false}
                              onDragStart={(event) => event.preventDefault()}
                              className={`group absolute top-[6px] h-[46px] overflow-hidden rounded-[14px] border shadow-[0_12px_20px_-18px_rgba(15,23,42,1)] transition ${clip.accentClass} ${isSelected ? 'ring-1 ring-cyan-300/60' : ''} cursor-grab active:cursor-grabbing select-none`}
                              style={{
                                left,
                                width,
                                opacity: isActivelyMoving ? 0.82 : isBgmTrack ? 0.9 : 1,
                                zIndex: isActivelyMoving ? 24 : isSelected ? 12 : 1,
                                transform: isActivelyMoving ? `translate3d(${activeBlockDeltaPx}px, 0, 0)` : 'translate3d(0, 0, 0)',
                                willChange: isActivelyMoving ? 'transform' : 'auto',
                              }}
                              onMouseDown={(event) => {
                                if (event.button !== 0) return;
                                event.preventDefault();
                                event.stopPropagation();
                                if (clip.sceneIndex >= 0) {
                                  handleSelectScene(clip.sceneIndex, event);
                                }
                                setInteraction({
                                  kind: 'move',
                                  phase: 'pending',
                                  sceneIndex: clip.sceneIndex,
                                  selectedIndices: track.key === 'scene' ? (selectedSceneIndices.includes(clip.sceneIndex) ? selectedSceneIndices : [clip.sceneIndex]) : [],
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  originDurationMs: clipEndMs - clipStartMs,
                                  originPlayheadMs: playheadMs,
                                  originScrollLeft: viewportRef.current?.scrollLeft || 0,
                                  trackKey: track.key,
                                  originSceneSpans: sceneSpans,
                                  moveDeltaPx: 0,
                                  clipId: clip.id,
                                  originClipStartMs: clipStartMs,
                                  originClipEndMs: clipEndMs,
                                });
                              }}
                              onDoubleClick={() => {
                                if (clip.sceneIndex < 0) return;
                                setPlayheadMs(clip.startMs);
                                ensureVisibleAtMs(clip.startMs);
                              }}
                              onContextMenu={(event) => {
                                if (clip.sceneIndex < 0) return;
                                event.preventDefault();
                                handleSelectScene(clip.sceneIndex, event);
                                setContextMenu({ x: event.clientX, y: event.clientY, sceneIndex: clip.sceneIndex });
                              }}
                            >
                              {clip.trimmable ? (
                                <button
                                  type="button"
                                  aria-label="왼쪽 길이 조절"
                                  data-timeline-handle="true"
                                  draggable={false}
                                  className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-3 cursor-ew-resize opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${track.key === 'bgm' ? 'bg-emerald-400/70' : track.key === 'subtitle' ? 'bg-amber-400/70' : track.key === 'narration' ? 'bg-violet-400/70' : 'bg-cyan-400/70'}`}
                                  onMouseDown={(event) => {
                                    if (track.key === 'scene' && clip.sceneIndex <= 0) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (clip.sceneIndex >= 0) {
                                      handleSelectScene(clip.sceneIndex, event as unknown as React.MouseEvent);
                                    }
                                    setInteraction({
                                      kind: 'resize-left',
                                      phase: 'pending',
                                      sceneIndex: track.key === 'bgm' ? -1 : clip.sceneIndex,
                                      selectedIndices: track.key === 'bgm' ? [] : [clip.sceneIndex],
                                      startClientX: event.clientX,
                                      startClientY: event.clientY,
                                      originDurationMs: clipEndMs - clipStartMs,
                                      originPlayheadMs: playheadMs,
                                      originScrollLeft: viewportRef.current?.scrollLeft || 0,
                                      trackKey: track.key,
                                      originSceneSpans: sceneSpans,
                                      moveDeltaPx: 0,
                                      clipId: clip.id,
                                      originBgmBounds: track.key === 'bgm' ? { startMs: clipStartMs, endMs: clipEndMs } : null,
                                      originClipStartMs: clipStartMs,
                                      originClipEndMs: clipEndMs,
                                    });
                                  }}
                                />
                              ) : null}
                              <div className="pointer-events-none flex h-full items-center gap-2 px-3">
                                <div className={`h-7 w-7 shrink-0 rounded-xl ${track.key === 'scene' ? 'bg-cyan-500/18 text-cyan-200' : track.key === 'narration' ? 'bg-violet-500/18 text-violet-200' : track.key === 'subtitle' ? 'bg-amber-500/18 text-amber-200' : 'bg-emerald-500/18 text-emerald-200'} flex items-center justify-center text-[11px] font-black`}>
                                  {track.badge}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`truncate text-xs font-black ${isSelected ? 'text-white' : 'text-slate-200'}`}>{clip.label}</div>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                    <span>{((clipEndMs - clipStartMs) / 1000).toFixed(1)}s</span>
                                    {isPinned && track.key === 'scene' ? <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black text-amber-300">THUMB</span> : null}
                                  </div>
                                </div>
                              </div>
                              {clip.trimmable ? (
                                <button
                                  type="button"
                                  aria-label="오른쪽 길이 조절"
                                  data-timeline-handle="true"
                                  draggable={false}
                                  className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-3 cursor-ew-resize opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${track.key === 'bgm' ? 'bg-emerald-400/70' : track.key === 'subtitle' ? 'bg-amber-400/70' : track.key === 'narration' ? 'bg-violet-400/70' : 'bg-cyan-400/70'}`}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (clip.sceneIndex >= 0) {
                                      handleSelectScene(clip.sceneIndex, event as unknown as React.MouseEvent);
                                    }
                                    setInteraction({
                                      kind: 'resize-right',
                                      phase: 'pending',
                                      sceneIndex: track.key === 'bgm' ? -1 : clip.sceneIndex,
                                      selectedIndices: track.key === 'bgm' ? [] : [clip.sceneIndex],
                                      startClientX: event.clientX,
                                      startClientY: event.clientY,
                                      originDurationMs: clipEndMs - clipStartMs,
                                      originPlayheadMs: playheadMs,
                                      originScrollLeft: viewportRef.current?.scrollLeft || 0,
                                      trackKey: track.key,
                                      originSceneSpans: sceneSpans,
                                      moveDeltaPx: 0,
                                      clipId: clip.id,
                                      originBgmBounds: track.key === 'bgm' ? { startMs: clipStartMs, endMs: clipEndMs } : null,
                                      originClipStartMs: clipStartMs,
                                      originClipEndMs: clipEndMs,
                                    });
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}

                        {dragPreview && track.key === 'scene' && blockPreview ? (
                          <>
                            <div className="pointer-events-none absolute top-[6px] h-[46px] rounded-[14px] border border-cyan-300/70 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]" style={{ left: blockPreview.left, width: blockPreview.width }} />
                            <div className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-cyan-300" style={{ left: msToPx(dragPreview.startMs, zoomLevel) }} />
                          </>
                        ) : null}

                        {snapGuideMs !== null ? (
                          <div className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-emerald-300/90 shadow-[0_0_20px_rgba(110,231,183,0.75)]" style={{ left: msToPx(snapGuideMs, zoomLevel) }} />
                        ) : null}
                        <div className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.7)]" style={{ left: msToPx(playheadMs, zoomLevel) }} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {marqueeRect ? (
                <div className="pointer-events-none absolute z-40 border border-cyan-400 bg-cyan-400/10" style={{ left: Math.min(marqueeRect.x1, marqueeRect.x2), top: Math.min(marqueeRect.y1, marqueeRect.y2), width: Math.abs(marqueeRect.x2 - marqueeRect.x1), height: Math.abs(marqueeRect.y2 - marqueeRect.y1) }} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 px-5 py-5 space-y-3">
        <div className="rounded-[24px] border border-slate-800 bg-[#060b16]">
          <button
            type="button"
            onClick={() => setPanelVisibility((current) => ({ ...current, selectedScene: !current.selectedScene }))}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Selected Scene</div>
              <div className="mt-1 text-sm font-black text-white">Scene {selectedAsset?.sceneNumber || selectedSceneIndex + 1}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300">{selectedScene ? `${(selectedScene.durationMs / 1000).toFixed(1)}초` : '-'}</div>
              <span className="text-xs font-black text-slate-400">{panelVisibility.selectedScene ? '닫기' : '열기'}</span>
            </div>
          </button>
          {panelVisibility.selectedScene ? (
            <div className="border-t border-slate-800 px-4 pb-4 pt-3">
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[18px] border border-slate-800 bg-slate-950">
                  {selectedImageSrc ? (
                    <img src={selectedImageSrc} alt={`선택된 씬 ${selectedAsset?.sceneNumber || selectedSceneIndex + 1}`} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-[150px] items-center justify-center text-sm font-bold text-slate-500">이미지 없음</div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="rounded-[18px] border border-slate-800 bg-slate-950 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Narration</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200">{selectedAsset?.narration || '나레이션이 없습니다.'}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-300">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onPinSceneAsThumbnail?.(selectedSceneIndex);
                          window.alert('썸네일이 저장되었습니다.');
                        }}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 font-black text-slate-200 hover:bg-slate-800"
                      >
                        썸네일 핀
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const range = getSceneRangeFromSelection(selectedSceneIndices, data.length);
                          if (range) onPreviewRange?.(range);
                        }}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 font-black text-slate-200 hover:bg-slate-800"
                      >
                        선택 범위 미리보기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-slate-800 bg-[#060b16]">
          <button
            type="button"
            onClick={() => setPanelVisibility((current) => ({ ...current, recentActions: !current.recentActions }))}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Recent Actions</div>
              <div className="mt-1 text-sm font-black text-white">최근 편집 액션 {telemetry.length}개</div>
            </div>
            <span className="text-xs font-black text-slate-400">{panelVisibility.recentActions ? '닫기' : '열기'}</span>
          </button>
          {panelVisibility.recentActions ? (
            <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-2 text-xs text-slate-300">
              {telemetry.length ? telemetry.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="font-black text-slate-200">{record.type}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{new Date(record.createdAt).toLocaleTimeString('ko-KR')}</div>
                </div>
              )) : <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-slate-500">아직 기록된 편집 액션이 없습니다.</div>}
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-slate-800 bg-[#060b16]">
          <button
            type="button"
            onClick={() => setPanelVisibility((current) => ({ ...current, assetLibrary: !current.assetLibrary }))}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Global Asset Library</div>
              <div className="mt-1 text-sm font-black text-white">다른 프로젝트 에셋 재사용 · 1개씩</div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`rounded-full border px-3 py-2 text-[11px] font-black ${timelineQa.isHealthy ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>{timelineQa.notes.slice(0, 1).join('') || '상태 확인'}</div>
              <span className="text-xs font-black text-slate-400">{panelVisibility.assetLibrary ? '닫기' : '열기'}</span>
            </div>
          </button>
          {panelVisibility.assetLibrary ? (
            <div className="border-t border-slate-800 px-4 pb-4 pt-3">
              <input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="이미지 / 비디오 / BGM 검색" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60" />
              <div className="mt-4 space-y-3">
                {assetLibrary.length ? assetLibrary.map((asset) => {
                  const previewSrc = asset.kind === 'audio' || asset.kind === 'bgm' ? null : resolveImageSrc(asset.previewData);
                  const canReuse = selectedSceneIndex >= 0 && (asset.kind === 'image' || asset.kind === 'video');
                  return (
                    <div key={asset.id} className="rounded-[18px] border border-slate-800 bg-slate-950 p-3">
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                          {previewSrc ? <img src={previewSrc} alt={asset.title} className="h-full w-full object-cover" draggable={false} /> : <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-500">{asset.kind.toUpperCase()}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-white">{asset.title}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{asset.projectName} · {asset.provenance}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-black text-slate-400">{asset.kind}</span>
                            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-black text-slate-400">{asset.sourceMode}</span>
                            {canReuse ? <button type="button" onClick={() => onReuseGlobalAsset?.(selectedSceneIndex, asset)} className="rounded-full bg-cyan-500 px-2.5 py-1 text-[10px] font-black text-slate-950 hover:bg-cyan-400">현재 씬에 적용</button> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : <div className="rounded-[18px] border border-dashed border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm font-bold text-slate-500">검색된 전역 에셋이 없습니다.</div>}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {contextMenu ? (
        <div className="fixed z-[130] min-w-[220px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {[
            ['split', '플레이헤드에서 분할'],
            ['pin', '썸네일 핀 지정'],
            ['range-preview', '이 씬만 미리보기'],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => handleContextAction(key as 'split' | 'pin' | 'range-preview')} className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm font-bold text-slate-200 last:border-b-0 hover:bg-slate-900">{label}</button>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default React.memo(TimelineWorkbench);
