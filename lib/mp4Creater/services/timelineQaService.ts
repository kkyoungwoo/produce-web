import { TimelineStateV2 } from '../types';
import { detectClipCollisions } from './timelineCollisionService';

export interface TimelineQaSummary {
  isHealthy: boolean;
  collisionCount: number;
  orphanLinkedClipCount: number;
  invalidDurationCount: number;
  duplicateIdCount: number;
  notes: string[];
}

export function runTimelineQa(state: TimelineStateV2): TimelineQaSummary {
  const clips = state.clips || [];
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  let orphanLinkedClipCount = 0;
  let invalidDurationCount = 0;
  let collisionCount = 0;

  clips.forEach((clip) => {
    if (seen.has(clip.id)) duplicateIds.add(clip.id);
    seen.add(clip.id);
    if (clip.endMs <= clip.startMs) invalidDurationCount += 1;
    clip.linkedClipIds.forEach((linkedId) => {
      if (!clips.some((candidate) => candidate.id === linkedId)) orphanLinkedClipCount += 1;
    });
    if (detectClipCollisions(clips, clip).hasCollision) collisionCount += 1;
  });

  const notes: string[] = [];
  if (collisionCount) notes.push(`충돌 ${collisionCount}건`);
  if (orphanLinkedClipCount) notes.push(`링크 누락 ${orphanLinkedClipCount}건`);
  if (invalidDurationCount) notes.push(`길이 오류 ${invalidDurationCount}건`);
  if (duplicateIds.size) notes.push(`중복 id ${duplicateIds.size}건`);
  if (!notes.length) notes.push('timeline state 정상');

  return {
    isHealthy: !collisionCount && !orphanLinkedClipCount && !invalidDurationCount && !duplicateIds.size,
    collisionCount,
    orphanLinkedClipCount,
    invalidDurationCount,
    duplicateIdCount: duplicateIds.size,
    notes,
  };
}
