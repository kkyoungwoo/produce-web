import { TimelineClip } from '../types';

export interface TimelineCollisionResult {
  hasCollision: boolean;
  overlappingClipIds: string[];
  nearestBlockedStartMs: number | null;
  nearestBlockedEndMs: number | null;
}

export function detectClipCollisions(clips: TimelineClip[], draftClip: TimelineClip, options?: { excludeClipIds?: string[] }): TimelineCollisionResult {
  const excluded = new Set([draftClip.id, ...(options?.excludeClipIds || [])]);
  const sameTrack = clips.filter((clip) => clip.trackId === draftClip.trackId && !excluded.has(clip.id));
  const overlapping = sameTrack.filter((clip) => clip.startMs < draftClip.endMs && clip.endMs > draftClip.startMs);

  if (!overlapping.length) {
    return {
      hasCollision: false,
      overlappingClipIds: [],
      nearestBlockedStartMs: null,
      nearestBlockedEndMs: null,
    };
  }

  const nearestBlockedStartMs = Math.min(...overlapping.map((clip) => clip.startMs));
  const nearestBlockedEndMs = Math.max(...overlapping.map((clip) => clip.endMs));

  return {
    hasCollision: true,
    overlappingClipIds: overlapping.map((clip) => clip.id),
    nearestBlockedStartMs,
    nearestBlockedEndMs,
  };
}
