import { TimelineRangeSelection } from '../types';

const PREFIX = 'mp4creater_timeline_ui:';

export interface TimelineUiSnapshot {
  playheadMs: number;
  zoomLevel: number;
  rangeSelection: TimelineRangeSelection | null;
  backgroundTrackBounds?: { startMs: number; endMs: number } | null;
  clipOverrides?: Record<string, { startMs: number; endMs: number }>;
  sceneStartOffsets?: number[];
  panelVisibility?: {
    selectedScene?: boolean;
    recentActions?: boolean;
    assetLibrary?: boolean;
  };
}

function getKey(projectId?: string | null) {
  return `${PREFIX}${projectId || 'default'}`;
}

function normalizeBoundsMap(value: unknown): Record<string, { startMs: number; endMs: number }> {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, { startMs: number; endMs: number }>>((acc, [key, entry]) => {
    if (!entry || typeof entry !== 'object') return acc;
    const startMs = typeof (entry as any).startMs === 'number' ? Math.max(0, (entry as any).startMs) : null;
    const endMs = typeof (entry as any).endMs === 'number' ? Math.max(0, (entry as any).endMs) : null;
    if (startMs === null || endMs === null || endMs <= startMs) return acc;
    acc[key] = { startMs, endMs };
    return acc;
  }, {});
}


function normalizeSceneStartOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? Math.max(0, Math.round(entry)) : 0));
}

export function readTimelineUiSnapshot(projectId?: string | null): TimelineUiSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      playheadMs: typeof parsed.playheadMs === 'number' ? parsed.playheadMs : 0,
      zoomLevel: typeof parsed.zoomLevel === 'number' ? parsed.zoomLevel : 1,
      rangeSelection: parsed.rangeSelection && typeof parsed.rangeSelection === 'object'
        ? {
            startMs: typeof parsed.rangeSelection.startMs === 'number' ? parsed.rangeSelection.startMs : 0,
            endMs: typeof parsed.rangeSelection.endMs === 'number' ? parsed.rangeSelection.endMs : 0,
          }
        : null,
      backgroundTrackBounds: parsed.backgroundTrackBounds && typeof parsed.backgroundTrackBounds === 'object'
        ? {
            startMs: typeof parsed.backgroundTrackBounds.startMs === 'number' ? parsed.backgroundTrackBounds.startMs : 0,
            endMs: typeof parsed.backgroundTrackBounds.endMs === 'number' ? parsed.backgroundTrackBounds.endMs : 0,
          }
        : null,
      clipOverrides: normalizeBoundsMap(parsed.clipOverrides),
      sceneStartOffsets: normalizeSceneStartOffsets(parsed.sceneStartOffsets),
      panelVisibility: parsed.panelVisibility && typeof parsed.panelVisibility === 'object'
        ? {
            selectedScene: Boolean(parsed.panelVisibility.selectedScene),
            recentActions: Boolean(parsed.panelVisibility.recentActions),
            assetLibrary: Boolean(parsed.panelVisibility.assetLibrary),
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

export function writeTimelineUiSnapshot(projectId: string | null | undefined, snapshot: TimelineUiSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getKey(projectId), JSON.stringify(snapshot));
  } catch {}
}
