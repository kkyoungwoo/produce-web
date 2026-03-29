import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings, ProjectMetadataV4, ProjectWorkfileV4, SavedProject, ScriptDocumentV1, ScriptSegmentV1, TimelineClip, TimelineStateV2, TimelineTrack } from '../types';
import { normalizeTimelineState } from './timelineMath';

function getAssetDurationMs(asset: GeneratedAsset) {
  const seconds = typeof asset.targetDuration === 'number' && asset.targetDuration > 0
    ? asset.targetDuration
    : typeof asset.audioDuration === 'number' && asset.audioDuration > 0
      ? asset.audioDuration
      : typeof asset.videoDuration === 'number' && asset.videoDuration > 0
        ? asset.videoDuration
        : 1;
  return Math.max(500, Math.round(seconds * 1000));
}

export function buildTimelineTracks(): TimelineTrack[] {
  return [
    { id: 'track-scene', kind: 'scene', title: 'Scene', order: 0, locked: false, muted: false, height: 56, laneGroup: 'primary' },
    { id: 'track-narration', kind: 'narration', title: 'Narration', order: 1, locked: false, muted: false, height: 52, laneGroup: 'primary' },
    { id: 'track-bgm', kind: 'bgm', title: 'BGM', order: 2, locked: false, muted: false, height: 48, laneGroup: 'audio' },
  ];
}

export function buildTimelineStateFromAssets(
  assets: GeneratedAsset[],
  backgroundMusicTracks?: BackgroundMusicTrack[],
  partial?: Partial<TimelineStateV2> | null,
): TimelineStateV2 {
  const tracks = buildTimelineTracks();
  let cursor = 0;
  const sceneClips: TimelineClip[] = assets.map((asset, index) => {
    const durationMs = getAssetDurationMs(asset);
    const startMs = cursor;
    const endMs = startMs + durationMs;
    cursor = endMs;
    return {
      id: `scene-${index}`,
      trackId: 'track-scene',
      sceneId: `scene-${asset.sceneNumber}`,
      segmentId: `segment-${index}`,
      assetId: `asset-${index}`,
      startMs,
      endMs,
      trimInMs: 0,
      trimOutMs: 0,
      draggable: true,
      trimmable: true,
      splittable: true,
      resizable: true,
      linkedClipIds: [`narration-${index}`],
      locked: false,
      role: 'scene',
    };
  });

  const narrationClips: TimelineClip[] = sceneClips.map((clip, index) => ({
    ...clip,
    id: `narration-${index}`,
    trackId: 'track-narration',
    linkedClipIds: [clip.id],
    role: 'narrator',
  }));

  const bgmClip: TimelineClip[] = backgroundMusicTracks?.length
    ? [{
        id: backgroundMusicTracks[0].id || 'bgm-main',
        trackId: 'track-bgm',
        sceneId: null,
        segmentId: null,
        assetId: backgroundMusicTracks[0].id || 'bgm-main',
        startMs: 0,
        endMs: Math.max(cursor, Math.round(((backgroundMusicTracks[0].duration || 0) * 1000) || cursor || 1000)),
        trimInMs: 0,
        trimOutMs: 0,
        draggable: false,
        trimmable: false,
        splittable: false,
        resizable: false,
        linkedClipIds: [],
        locked: false,
        role: 'bgm',
      }]
    : [];

  return normalizeTimelineState({
    tracks,
    clips: [...sceneClips, ...narrationClips, ...bgmClip],
    playheadMs: partial?.playheadMs || 0,
    zoomLevel: partial?.zoomLevel || 1,
    snapMode: partial?.snapMode || 'scene',
    rippleMode: partial?.rippleMode ?? true,
    selectedClipIds: partial?.selectedClipIds || [],
    selectedTrackId: partial?.selectedTrackId || 'track-scene',
    rangeSelection: partial?.rangeSelection || null,
    scrollLeftPx: partial?.scrollLeftPx || 0,
    scrollTopPx: partial?.scrollTopPx || 0,
  });
}

export function buildScriptDocumentFromAssets(assets: GeneratedAsset[]): ScriptDocumentV1 {
  const segments: ScriptSegmentV1[] = assets.map((asset, index) => ({
    id: `segment-${index}`,
    role: 'narrator',
    text: asset.narration || '',
    estimatedDurationMs: getAssetDurationMs(asset),
    beatIndex: index,
    minuteBlockIndex: Math.floor(index / 6),
    sceneHint: asset.visualPrompt || asset.imagePrompt || null,
    speakerId: 'narrator',
  }));
  const totalDurationSeconds = Math.round(segments.reduce((sum, segment) => sum + segment.estimatedDurationMs, 0) / 1000);
  return {
    runtimeMode: totalDurationSeconds >= 60 ? 'per-minute' : 'per-second',
    targetDurationSeconds: totalDurationSeconds,
    plannerSummary: {
      sceneCount: assets.length,
      generatedAt: Date.now(),
    },
    segments,
  };
}

export function buildProjectMetadataV4(project: SavedProject): ProjectMetadataV4 {
  const estimatedDurationSeconds = Math.round((project.assets || []).reduce((sum, asset) => sum + getAssetDurationMs(asset), 0) / 1000);
  return {
    id: project.id,
    schemaVersion: 4,
    name: project.name,
    projectNumber: project.projectNumber || 0,
    createdAt: project.createdAt,
    updatedAt: project.lastSavedAt || Date.now(),
    activeStep: 6,
    aspectRatio: project.workflowDraft?.aspectRatio || '16:9',
    runtimeMode: estimatedDurationSeconds >= 60 ? 'per-minute' : 'per-second',
    estimatedDurationSeconds,
    sceneCount: (project.assets || []).length,
    status: project.sceneStudioPreviewStatus === 'error'
      ? 'error'
      : project.sceneStudioPreviewStatus === 'loading'
        ? 'rendering'
        : project.sceneStudioPreviewVideo?.videoData
          ? 'done'
          : (project.assets || []).length
            ? 'ready'
            : 'draft',
    thumbnailAssetId: project.selectedThumbnailId || null,
  };
}

export function buildProjectWorkfileV4(options: {
  projectId: string;
  assets: GeneratedAsset[];
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings | null;
  subtitlePreset?: SavedProject['subtitlePreset'];
  existing?: ProjectWorkfileV4 | null;
}): ProjectWorkfileV4 {
  const scriptDocument = buildScriptDocumentFromAssets(options.assets);
  const timelineState = buildTimelineStateFromAssets(
    options.assets,
    options.backgroundMusicTracks,
    options.existing?.timelineState || options.existing?.editorState || null,
  );
  return {
    projectId: options.projectId,
    scriptDocument,
    sceneDocument: {
      sceneIds: options.assets.map((asset) => `scene-${asset.sceneNumber}`),
    },
    timelineState,
    musicState: {
      activeTrackId: options.backgroundMusicTracks?.[0]?.id || null,
      trackIds: (options.backgroundMusicTracks || []).map((track) => track.id),
      previewMix: options.previewMix || null,
    },
    subtitleState: {
      enabled: Boolean(options.subtitlePreset),
      subtitlePreset: options.subtitlePreset || null,
    },
    editorState: {
      selectedClipIds: timelineState.selectedClipIds,
      selectedTrackId: timelineState.selectedTrackId,
      playheadMs: timelineState.playheadMs,
      zoomLevel: timelineState.zoomLevel,
      rangeSelection: timelineState.rangeSelection,
      scrollLeftPx: timelineState.scrollLeftPx,
      scrollTopPx: timelineState.scrollTopPx,
      openedInspectorTab: options.existing?.editorState?.openedInspectorTab || 'timeline',
    },
    continuityState: options.existing?.continuityState || {
      sourceProjectId: null,
      continuationMode: null,
      inheritedStylePackIds: [],
      inheritedCharacterPackIds: [],
    },
    derivationMeta: options.existing?.derivationMeta || null,
  };
}
