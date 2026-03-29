import { TimelineClip, TimelineRangeSelection, TimelineSnapMode, TimelineStateV2 } from '../types';

export const TIMELINE_BASE_PX_PER_SECOND = 56;
export const TIMELINE_MIN_CLIP_MS = 500;

export function msToPx(ms: number, zoomLevel: number) {
  return (Math.max(0, ms) / 1000) * TIMELINE_BASE_PX_PER_SECOND * Math.max(0.35, zoomLevel || 1);
}

export function pxToMs(x: number, zoomLevel: number) {
  const safeZoom = Math.max(0.35, zoomLevel || 1);
  return Math.max(0, (x / (TIMELINE_BASE_PX_PER_SECOND * safeZoom)) * 1000);
}

export function clampTimelineZoom(value: number) {
  return Math.max(0.35, Math.min(5, Number.isFinite(value) ? value : 1));
}

export function getTimelineDurationMs(clips: TimelineClip[]) {
  return clips.reduce((max, clip) => Math.max(max, clip.endMs || 0), 0);
}

export function clampRangeSelection(range: TimelineRangeSelection | null, totalDurationMs: number): TimelineRangeSelection | null {
  if (!range) return null;
  const startMs = Math.max(0, Math.min(range.startMs, totalDurationMs));
  const endMs = Math.max(startMs, Math.min(range.endMs, totalDurationMs));
  if (endMs - startMs < TIMELINE_MIN_CLIP_MS) return null;
  return { startMs, endMs };
}

export function clampClipBounds(clip: TimelineClip, assetDurationMs?: number | null): TimelineClip {
  const boundedStart = Math.max(0, clip.startMs || 0);
  const boundedEnd = Math.max(boundedStart + TIMELINE_MIN_CLIP_MS, clip.endMs || boundedStart + TIMELINE_MIN_CLIP_MS);
  const maxTrimOut = typeof assetDurationMs === 'number' && assetDurationMs > 0
    ? Math.max(0, assetDurationMs - (boundedEnd - boundedStart) - (clip.trimInMs || 0))
    : Math.max(0, clip.trimOutMs || 0);

  return {
    ...clip,
    startMs: boundedStart,
    endMs: boundedEnd,
    trimInMs: Math.max(0, clip.trimInMs || 0),
    trimOutMs: Math.max(0, Math.min(maxTrimOut, clip.trimOutMs || 0)),
  };
}

export function snapMs(valueMs: number, candidates: number[], snapMode: TimelineSnapMode) {
  if (snapMode === 'off' || !candidates.length) return valueMs;
  const threshold = snapMode === 'frame' ? 80 : snapMode === 'beat' ? 140 : 180;
  let best = valueMs;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate) => {
    const distance = Math.abs(candidate - valueMs);
    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      best = candidate;
    }
  });
  return best;
}

export function splitClipAtMs(clip: TimelineClip, splitMs: number): [TimelineClip, TimelineClip] {
  const boundedSplitMs = Math.max(clip.startMs + TIMELINE_MIN_CLIP_MS, Math.min(splitMs, clip.endMs - TIMELINE_MIN_CLIP_MS));
  const leftDuration = boundedSplitMs - clip.startMs;
  const rightDuration = clip.endMs - boundedSplitMs;
  const first: TimelineClip = {
    ...clip,
    id: `${clip.id}__a`,
    endMs: boundedSplitMs,
    trimOutMs: (clip.trimOutMs || 0) + rightDuration,
  };
  const second: TimelineClip = {
    ...clip,
    id: `${clip.id}__b`,
    startMs: boundedSplitMs,
    trimInMs: (clip.trimInMs || 0) + leftDuration,
  };
  return [first, second];
}

export function normalizeTimelineState(state: TimelineStateV2): TimelineStateV2 {
  const tracks = [...(state.tracks || [])].sort((a, b) => a.order - b.order);
  const clips = [...(state.clips || [])]
    .map((clip) => clampClipBounds(clip))
    .sort((a, b) => (a.startMs - b.startMs) || a.id.localeCompare(b.id));
  const totalDurationMs = getTimelineDurationMs(clips);
  const selectedClipIds = (state.selectedClipIds || []).filter((id) => clips.some((clip) => clip.id === id));
  return {
    ...state,
    tracks,
    clips,
    zoomLevel: clampTimelineZoom(state.zoomLevel),
    playheadMs: Math.max(0, Math.min(state.playheadMs || 0, totalDurationMs)),
    selectedClipIds,
    rangeSelection: clampRangeSelection(state.rangeSelection || null, totalDurationMs),
    scrollLeftPx: Math.max(0, state.scrollLeftPx || 0),
    scrollTopPx: Math.max(0, state.scrollTopPx || 0),
  };
}
