import { TimelineClip } from '../types';

export function applyRippleToTrack(clips: TimelineClip[], trackId: string, movedClipIds: string[], deltaMs: number): TimelineClip[] {
  if (!deltaMs) return clips;
  const movedSet = new Set(movedClipIds);
  const trackClips = clips
    .filter((clip) => clip.trackId === trackId)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));

  const movedWindow = trackClips.filter((clip) => movedSet.has(clip.id));
  if (!movedWindow.length) return clips;

  const rippleFromMs = Math.min(...movedWindow.map((clip) => clip.startMs));

  return clips.map((clip) => {
    if (clip.trackId !== trackId) return clip;
    if (movedSet.has(clip.id)) return clip;
    if (clip.startMs < rippleFromMs) return clip;
    return {
      ...clip,
      startMs: Math.max(0, clip.startMs + deltaMs),
      endMs: Math.max(clip.startMs + deltaMs + 1, clip.endMs + deltaMs),
    };
  });
}
