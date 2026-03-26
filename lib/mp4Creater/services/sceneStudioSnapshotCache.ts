import {
  BackgroundMusicTrack,
  CostBreakdown,
  GeneratedAsset,
  PreviewMixSettings,
  SavedProject,
  WorkflowDraft,
} from '../types';
import { compactWorkflowDraftForStorage } from './workflowDraftService';

const SNAPSHOT_KEY_PREFIX = 'mp4creater_scene_studio_snapshot:';
const SNAPSHOT_VERSION = 1;

export interface SceneStudioSnapshotPayload {
  version: number;
  projectId: string;
  savedAt: number;
  assets: GeneratedAsset[];
  backgroundMusicTracks: BackgroundMusicTrack[];
  activeBackgroundTrackId: string | null;
  previewMix: PreviewMixSettings | null;
  workflowDraft: WorkflowDraft | null;
  cost: CostBreakdown | null;
}

function getStorageKey(projectId: string) {
  return `${SNAPSHOT_KEY_PREFIX}${projectId}`;
}

function getStorages(): Storage[] {
  if (typeof window === 'undefined') return [];
  const storages: Storage[] = [];
  try {
    storages.push(window.localStorage);
  } catch {}
  try {
    if (!storages.includes(window.sessionStorage)) {
      storages.push(window.sessionStorage);
    }
  } catch {}
  return storages;
}

function stripPromptedImageBinary<T extends { imageData?: string | null; data?: string | null; thumbnailData?: string | null } | null | undefined>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    imageData: null,
    data: null,
    thumbnailData: null,
  } as T;
}

function stripCharacterBinary<T extends { imageData?: string | null; generatedImages?: any[] } | null | undefined>(character: T): T {
  if (!character || typeof character !== 'object') return character;
  return {
    ...character,
    imageData: null,
    generatedImages: Array.isArray(character.generatedImages)
      ? character.generatedImages.map((item) => stripPromptedImageBinary(item))
      : [],
  } as T;
}

function stripAudioPreviewBinary<T extends { audioData?: string | null } | null | undefined>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    audioData: null,
  } as T;
}

function stripVideoPreviewBinary<T extends { videoData?: string | null } | null | undefined>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    videoData: null,
  } as T;
}

function stripWorkflowDraftBinary(draft?: WorkflowDraft | null): WorkflowDraft | null {
  const compacted = compactWorkflowDraftForStorage(draft);
  if (!compacted) return null;
  return {
    ...compacted,
    styleImages: Array.isArray(compacted.styleImages)
      ? compacted.styleImages.map((item) => stripPromptedImageBinary(item))
      : [],
    characterImages: Array.isArray(compacted.characterImages)
      ? compacted.characterImages.map((item) => stripPromptedImageBinary(item))
      : [],
    extractedCharacters: Array.isArray(compacted.extractedCharacters)
      ? compacted.extractedCharacters.map((character) => stripCharacterBinary(character))
      : [],
    voiceReferenceAudioData: null,
    voicePreviewAsset: stripAudioPreviewBinary(compacted.voicePreviewAsset),
    scriptPreviewAsset: stripAudioPreviewBinary(compacted.scriptPreviewAsset),
    finalVoiceAsset: stripAudioPreviewBinary(compacted.finalVoiceAsset),
    backgroundMusicPreview: compacted.backgroundMusicPreview ? { ...compacted.backgroundMusicPreview, audioData: null } : null,
    finalBackgroundMusic: compacted.finalBackgroundMusic ? { ...compacted.finalBackgroundMusic, audioData: null } : null,
    musicVideoPreview: stripVideoPreviewBinary(compacted.musicVideoPreview),
    finalMusicVideo: stripVideoPreviewBinary(compacted.finalMusicVideo),
  };
}

function stripSceneAssetBinary(asset: GeneratedAsset): GeneratedAsset {
  return {
    ...asset,
    imageData: null,
    audioData: null,
    subtitleData: null,
    videoData: null,
    imageHistory: [],
    videoHistory: [],
  };
}

function stripBackgroundTrackBinary(track: BackgroundMusicTrack): BackgroundMusicTrack {
  return {
    ...track,
    audioData: null,
  };
}

function hasDetailedWorkflowDraft(draft?: WorkflowDraft | null) {
  if (!draft) return false;
  return Boolean(
    (Array.isArray(draft.extractedCharacters) && draft.extractedCharacters.length)
    || (Array.isArray(draft.styleImages) && draft.styleImages.length)
    || (Array.isArray(draft.characterImages) && draft.characterImages.length)
    || (draft.promptStore && Object.keys(draft.promptStore).length)
    || (draft.stepContract && Object.keys(draft.stepContract).length)
    || (draft.backgroundMusicScene && Object.keys(draft.backgroundMusicScene).length),
  );
}

function hasProjectSceneStudioState(project?: SavedProject | null) {
  if (!project) return false;
  return Boolean(
    (Array.isArray(project.assets) && project.assets.length)
    || (Array.isArray(project.backgroundMusicTracks) && project.backgroundMusicTracks.length)
    || project.activeBackgroundTrackId
    || project.previewMix
    || project.cost,
  );
}

function hasSnapshotSceneStudioState(snapshot?: SceneStudioSnapshotPayload | null) {
  if (!snapshot) return false;
  return Boolean(
    (Array.isArray(snapshot.assets) && snapshot.assets.length)
    || (Array.isArray(snapshot.backgroundMusicTracks) && snapshot.backgroundMusicTracks.length)
    || snapshot.activeBackgroundTrackId
    || snapshot.previewMix
    || snapshot.cost,
  );
}

function mergeSceneAsset(baseAsset: GeneratedAsset | undefined, snapshotAsset: GeneratedAsset): GeneratedAsset {
  return {
    ...(baseAsset || snapshotAsset),
    ...snapshotAsset,
    imageData: baseAsset?.imageData || null,
    audioData: baseAsset?.audioData || null,
    subtitleData: baseAsset?.subtitleData || null,
    videoData: baseAsset?.videoData || null,
    imageHistory: baseAsset?.imageHistory || [],
    videoHistory: baseAsset?.videoHistory || [],
  };
}

function mergeBackgroundTrack(baseTrack: BackgroundMusicTrack | undefined, snapshotTrack: BackgroundMusicTrack): BackgroundMusicTrack {
  return {
    ...(baseTrack || snapshotTrack),
    ...snapshotTrack,
    audioData: baseTrack?.audioData || null,
  };
}

export function buildSceneStudioSnapshotPayload(options: {
  projectId: string;
  assets: GeneratedAsset[];
  backgroundMusicTracks?: BackgroundMusicTrack[];
  activeBackgroundTrackId?: string | null;
  previewMix?: PreviewMixSettings | null;
  workflowDraft?: WorkflowDraft | null;
  cost?: CostBreakdown | null;
}): SceneStudioSnapshotPayload {
  return {
    version: SNAPSHOT_VERSION,
    projectId: options.projectId,
    savedAt: Date.now(),
    assets: Array.isArray(options.assets) ? options.assets.map((asset) => stripSceneAssetBinary(asset)) : [],
    backgroundMusicTracks: Array.isArray(options.backgroundMusicTracks)
      ? options.backgroundMusicTracks.map((track) => stripBackgroundTrackBinary(track))
      : [],
    activeBackgroundTrackId: options.activeBackgroundTrackId ?? null,
    previewMix: options.previewMix || null,
    workflowDraft: stripWorkflowDraftBinary(options.workflowDraft),
    cost: options.cost || null,
  };
}

export function writeSceneStudioSnapshot(payload: SceneStudioSnapshotPayload) {
  const key = getStorageKey(payload.projectId);
  const serialized = JSON.stringify(payload);
  getStorages().forEach((storage) => {
    try {
      storage.setItem(key, serialized);
    } catch {}
  });
}

export function readSceneStudioSnapshot(projectId: string): SceneStudioSnapshotPayload | null {
  if (!projectId) return null;
  const key = getStorageKey(projectId);
  for (const storage of getStorages()) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SceneStudioSnapshotPayload;
      if (!parsed || parsed.projectId !== projectId || parsed.version !== SNAPSHOT_VERSION) continue;
      return parsed;
    } catch {}
  }
  return null;
}

export function clearSceneStudioSnapshot(projectId: string) {
  if (!projectId) return;
  const key = getStorageKey(projectId);
  getStorages().forEach((storage) => {
    try {
      storage.removeItem(key);
    } catch {}
  });
}

export function mergeSceneStudioSnapshotIntoProject(project: SavedProject, snapshot?: SceneStudioSnapshotPayload | null): SavedProject {
  if (!snapshot || snapshot.projectId !== project.id) return project;

  const baseAssets = Array.isArray(project.assets) ? project.assets : [];
  const shouldUseSnapshotSceneState = Boolean(
    hasSnapshotSceneStudioState(snapshot)
    && (
      !hasProjectSceneStudioState(project)
      || (snapshot.savedAt || 0) >= (project.lastSavedAt || 0)
    ),
  );
  const mergedAssets = shouldUseSnapshotSceneState && Array.isArray(snapshot.assets)
    ? snapshot.assets.map((asset, index) => {
        const baseAsset = baseAssets.find((item) => item.sceneNumber === asset.sceneNumber) || baseAssets[index];
        return mergeSceneAsset(baseAsset, asset);
      })
    : baseAssets;

  const baseTracks = Array.isArray(project.backgroundMusicTracks) ? project.backgroundMusicTracks : [];
  const mergedTracks = shouldUseSnapshotSceneState && Array.isArray(snapshot.backgroundMusicTracks)
    ? snapshot.backgroundMusicTracks.map((track, index) => {
        const baseTrack = baseTracks.find((item) => item.id === track.id) || baseTracks[index];
        return mergeBackgroundTrack(baseTrack, track);
      })
    : baseTracks;

  const shouldUseSnapshotDraft = Boolean(
    snapshot.workflowDraft
    && (
      !project.workflowDraft
      || snapshot.savedAt >= (project.lastSavedAt || 0)
      || (!hasDetailedWorkflowDraft(project.workflowDraft) && hasDetailedWorkflowDraft(snapshot.workflowDraft))
    ),
  );

  return {
    ...project,
    assets: mergedAssets,
    backgroundMusicTracks: mergedTracks,
    activeBackgroundTrackId: shouldUseSnapshotSceneState ? snapshot.activeBackgroundTrackId ?? null : (project.activeBackgroundTrackId ?? null),
    previewMix: shouldUseSnapshotSceneState ? (snapshot.previewMix || project.previewMix) : project.previewMix,
    workflowDraft: shouldUseSnapshotDraft ? snapshot.workflowDraft : project.workflowDraft,
    cost: shouldUseSnapshotSceneState ? (snapshot.cost || project.cost) : project.cost,
    lastSavedAt: Math.max(project.lastSavedAt || 0, shouldUseSnapshotSceneState ? (snapshot.savedAt || 0) : 0),
  };
}
