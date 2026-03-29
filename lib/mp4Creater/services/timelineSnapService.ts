import { TimelineClip, TimelineSnapMode } from '../types';

export interface TimelineSnapResult {
  snappedStartMs: number;
  snappedEndMs: number;
  snappedBy: 'start' | 'end' | 'none';
  candidateMs: number | null;
}

const SNAP_THRESHOLD_MS: Record<Exclude<TimelineSnapMode, 'off'>, number> = {
  frame: 90,
  beat: 140,
  scene: 180,
};

export function collectSnapCandidates(clips: TimelineClip[], options?: { excludeClipIds?: string[]; includeMs?: number[] }): number[] {
  const excluded = new Set(options?.excludeClipIds || []);
  const values = new Set<number>();

  clips.forEach((clip) => {
    if (excluded.has(clip.id)) return;
    values.add(Math.max(0, Math.round(clip.startMs || 0)));
    values.add(Math.max(0, Math.round(clip.endMs || 0)));
  });

  (options?.includeMs || []).forEach((value) => {
    if (Number.isFinite(value)) values.add(Math.max(0, Math.round(value)));
  });

  return Array.from(values).sort((a, b) => a - b);
}

function findClosestCandidate(valueMs: number, candidates: number[], threshold: number) {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate) => {
    const distance = Math.abs(candidate - valueMs);
    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  });
  return best;
}

export function applySnapToWindow(startMs: number, endMs: number, candidates: number[], snapMode: TimelineSnapMode): TimelineSnapResult {
  if (snapMode === 'off') {
    return { snappedStartMs: startMs, snappedEndMs: endMs, snappedBy: 'none', candidateMs: null };
  }

  const threshold = SNAP_THRESHOLD_MS[snapMode];
  const startCandidate = findClosestCandidate(startMs, candidates, threshold);
  const endCandidate = findClosestCandidate(endMs, candidates, threshold);

  if (startCandidate === null && endCandidate === null) {
    return { snappedStartMs: startMs, snappedEndMs: endMs, snappedBy: 'none', candidateMs: null };
  }

  const startDistance = startCandidate === null ? Number.POSITIVE_INFINITY : Math.abs(startCandidate - startMs);
  const endDistance = endCandidate === null ? Number.POSITIVE_INFINITY : Math.abs(endCandidate - endMs);

  if (startDistance <= endDistance) {
    const delta = (startCandidate || 0) - startMs;
    return {
      snappedStartMs: startMs + delta,
      snappedEndMs: endMs + delta,
      snappedBy: 'start',
      candidateMs: startCandidate,
    };
  }

  const delta = (endCandidate || 0) - endMs;
  return {
    snappedStartMs: startMs + delta,
    snappedEndMs: endMs + delta,
    snappedBy: 'end',
    candidateMs: endCandidate,
  };
}
