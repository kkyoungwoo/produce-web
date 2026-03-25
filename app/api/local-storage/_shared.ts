import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export type StudioState = {
  version: number;
  storageDir: string;
  isStorageConfigured?: boolean;
  configuredAt: number;
  updatedAt: number;
  selectedCharacterId: string | null;
  characters: Array<{
    id: string;
    name: string;
    description: string;
    visualStyle: string;
    voiceHint?: string;
    createdAt: number;
    role?: 'lead' | 'support';
    prompt?: string;
    imageData?: string | null;
    selectedImageId?: string | null;
    generatedImages?: Array<{
      id: string;
      label: string;
      prompt: string;
      imageData: string;
      createdAt: number;
      kind: 'character' | 'style' | 'thumbnail';
      sourceMode: 'ai' | 'sample' | 'upload';
      selected?: boolean;
      note?: string;
    }>;
  }>;
  routing: {
    scriptModel: string;
    sceneModel: string;
    imagePromptModel: string;
    motionPromptModel: string;
    openRouterMaxTokens?: number;
    openRouterInputMaxChars?: number;
    imageProvider: string;
    imageModel: string;
    audioProvider: string;
    audioModel: string;
    ttsNarratorId: string;
    backgroundMusicModel: string;
    videoProvider: string;
    videoModel: string;
  };
  providers: {
    openRouterApiKey?: string;
    elevenLabsApiKey?: string;
    falApiKey?: string;
    heygenApiKey?: string;
  };
  projects: any[];
  projectIndex?: Array<{
    id: string;
    name: string;
    topic: string;
    createdAt: number;
    lastSavedAt?: number;
    projectNumber: number;
    thumbnail?: string | null;
    thumbnailTitle?: string | null;
    selectedThumbnailId?: string | null;
    assetCount?: number;
    imageCount?: number;
    videoCount?: number;
    audioCount?: number;
    workflowDraft?: any;
  }>;
  workflowDraft?: any;
  agentProfile?: {
    name: string;
    mission: string;
    toneGuide: string;
    defaultWorkflow: 'general_youtube' | 'music_video';
  };
  preferredPromptProfile?: 'general_youtube' | 'music_video';
  providerRegistry?: Array<{
    id: string;
    name: string;
    kind: 'text' | 'image' | 'audio' | 'video';
    baseUrl: string;
    modelHint: string;
    apiKey?: string;
    authScheme?: string;
    notes?: string;
    enabled: boolean;
  }>;
  lastContentType?: 'music_video' | 'story' | 'news';
};

export const DEFAULT_STORAGE_DIR = './local-data/tubegen-studio';
const STUDIO_STATE_FILENAME = 'studio-state.json';
const PROJECTS_DIRNAME = 'projects';
const MEDIA_DIRNAME = 'media';
const SAFE_DEFAULT_STORAGE_DIR = path.join(os.homedir(), '.tubegen-studio');

function isLegacyDefaultStorageDir(input?: string) {
  const value = input?.trim();
  return !value || value === DEFAULT_STORAGE_DIR;
}

async function ensureSafeDefaultStorageDirReady(storageDir?: string) {
  if (!isLegacyDefaultStorageDir(storageDir)) return;

  const legacyDir = path.join(process.cwd(), DEFAULT_STORAGE_DIR);
  const safeDir = SAFE_DEFAULT_STORAGE_DIR;

  if (path.normalize(legacyDir) === path.normalize(safeDir)) return;

  const safeExists = await pathExists(safeDir);

  if (safeExists) return;

  await fs.mkdir(path.dirname(safeDir), { recursive: true });

  const legacyStatePath = path.join(legacyDir, STUDIO_STATE_FILENAME);
  const legacyStateExists = await pathExists(legacyStatePath);

  if (!legacyStateExists) {
    await fs.mkdir(safeDir, { recursive: true });
    return;
  }

  const legacyRaw = await fs.readFile(legacyStatePath, 'utf-8').catch(() => '');
  const legacyState = safeJsonParse<StudioState | null>(legacyRaw, null);
  const hasBundledProjects = Array.isArray(legacyState?.projectIndex) && legacyState!.projectIndex.length > 0;

  if (hasBundledProjects) {
    await fs.mkdir(safeDir, { recursive: true });
    return;
  }

  await fs.cp(legacyDir, safeDir, { recursive: true });
}

export const createDefaultState = (storageDir = '', options?: { configured?: boolean }): StudioState => ({
  version: 7,
  storageDir,
  isStorageConfigured: options?.configured ?? Boolean(storageDir?.trim()),
  configuredAt: Date.now(),
  updatedAt: Date.now(),
  selectedCharacterId: null,
  characters: [],
  routing: {
    scriptModel: 'gemini-2.5-flash-lite',
    sceneModel: 'gemini-2.5-flash-lite',
    imagePromptModel: 'gemini-2.5-flash-lite',
    motionPromptModel: 'gemini-2.5-flash-lite',
    openRouterMaxTokens: 800,
    openRouterInputMaxChars: 7000,
    imageProvider: 'sample',
    imageModel: 'sample-scene-image',
    audioProvider: 'qwen3Tts',
    audioModel: 'eleven_multilingual_v2',
    ttsNarratorId: 'qwen-default',
    backgroundMusicModel: 'sample-ambient-v1',
    videoProvider: 'sample',
    videoModel: 'sample-sequence-v1',
  },
  providers: {
    openRouterApiKey: '',
    elevenLabsApiKey: '',
    falApiKey: '',
    heygenApiKey: '',
  },
  projects: [],
  projectIndex: [],
  workflowDraft: null,
  agentProfile: {
    name: '나만의 기본 제작 에이전트',
    mission: '초보 사용자도 스토리부터 장면, 나레이션, 영상까지 자연스럽게 따라오게 돕는다.',
    toneGuide: '선택형 옵션을 많이 보여주고, 직접 입력은 꼭 필요한 순간만 요청한다.',
    defaultWorkflow: 'general_youtube',
  },
  preferredPromptProfile: 'general_youtube',
  providerRegistry: [
    {
      id: 'provider_seedance_direct',
      name: 'Seedance 2.0 (직접 연결 슬롯)',
      kind: 'video',
      baseUrl: '',
      modelHint: 'seedance-2.0',
      apiKey: '',
      authScheme: 'Authorization: Bearer YOUR_KEY',
      notes: 'OpenRouter에 없는 외부 영상 모델을 저장하는 자리입니다.',
      enabled: false,
    },
  ],
  lastContentType: 'story',
});

export const resolveStorageDir = (input?: string) => {
  const value = input?.trim();

  if (isLegacyDefaultStorageDir(value)) {
    return SAFE_DEFAULT_STORAGE_DIR;
  }

  if (value === '~') {
    return os.homedir();
  }

  if (value?.startsWith('~/') || value?.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return path.isAbsolute(value || '') ? (value as string) : path.join(process.cwd(), value || '');
};

export const stateFilePath = (storageDir: string) => path.join(resolveStorageDir(storageDir), STUDIO_STATE_FILENAME);

export const mediaDirPath = (storageDir: string) => path.join(resolveStorageDir(storageDir), MEDIA_DIRNAME);
export const mediaFilePath = (storageDir: string, relativePath: string) => path.join(mediaDirPath(storageDir), normalizeRelativeMediaPath(relativePath));

function buildMediaUrl(storageDir: string, relativePath: string) {
  const query = new URLSearchParams({ file: normalizeRelativeMediaPath(relativePath) });
  const trimmedStorageDir = storageDir?.trim();
  if (trimmedStorageDir) query.set('storageDir', trimmedStorageDir);
  return `/api/local-storage/media?${query.toString()}`;
}

function getMediaContentType(relativePath: string) {
  return MEDIA_CONTENT_TYPES[path.extname(relativePath).toLowerCase()] || 'application/octet-stream';
}

async function persistInlineMedia(storageDir: string, relativeBasePath: string, dataUrl: string) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const ext = extensionFromMimeType(parsed.mimeType);
  const relativePath = normalizeRelativeMediaPath(`${relativeBasePath}${ext}`);
  const absolutePath = mediaFilePath(storageDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, parsed.buffer);
  return {
    file: relativePath,
    url: buildMediaUrl(storageDir, relativePath),
    mimeType: parsed.mimeType,
    absolutePath,
  };
}

async function hydrateMediaField(target: Record<string, any>, dataKey: string, fileKey: string, storageDir: string) {
  const relativePath = typeof target?.[fileKey] === 'string' ? target[fileKey].trim() : '';
  if (!relativePath) return;
  try {
    const absolutePath = mediaFilePath(storageDir, relativePath);
    if (!(await pathExists(absolutePath))) return;
    target[dataKey] = buildMediaUrl(storageDir, relativePath);
    target[`${dataKey}LocalPath`] = absolutePath;
    target[`${dataKey}ContentType`] = getMediaContentType(relativePath);
  } catch {
    // noop
  }
}

async function persistMediaField(target: Record<string, any>, dataKey: string, fileKey: string, storageDir: string, relativeBasePath: string) {
  const value = target?.[dataKey];
  if (!isDataUrl(value)) return;
  const persisted = await persistInlineMedia(storageDir, relativeBasePath, value);
  if (!persisted) return;
  target[fileKey] = persisted.file;
  target[`${dataKey}LocalPath`] = persisted.absolutePath;
  target[`${dataKey}ContentType`] = persisted.mimeType;
  target[dataKey] = persisted.url;
}

async function persistProjectMedia(storageDir: string, project: any) {
  const projectId = sanitizePathSegment(typeof project?.id === 'string' ? project.id : `project-${Date.now()}`);
  await persistMediaField(project, 'thumbnail', 'thumbnailFile', storageDir, `${projectId}/thumbnail`);

  if (Array.isArray(project?.thumbnailHistory)) {
    for (let index = 0; index < project.thumbnailHistory.length; index += 1) {
      const item = project.thumbnailHistory[index];
      if (!item || typeof item !== 'object') continue;
      const itemId = sanitizePathSegment(item.id || `thumbnail-history-${index}`);
      await persistMediaField(item, 'imageData', 'imageFile', storageDir, `${projectId}/thumbnail-history/${itemId}`);
    }
  }

  if (Array.isArray(project?.assets)) {
    for (let index = 0; index < project.assets.length; index += 1) {
      const asset = project.assets[index];
      if (!asset || typeof asset !== 'object') continue;
      const assetId = sanitizePathSegment(asset.id || `scene-${index + 1}`);
      await persistMediaField(asset, 'imageData', 'imageFile', storageDir, `${projectId}/assets/${assetId}/image`);
      await persistMediaField(asset, 'audioData', 'audioFile', storageDir, `${projectId}/assets/${assetId}/audio`);
      await persistMediaField(asset, 'videoData', 'videoFile', storageDir, `${projectId}/assets/${assetId}/video`);
      if (Array.isArray(asset.imageHistory)) {
        for (let h = 0; h < asset.imageHistory.length; h += 1) {
          const historyItem = asset.imageHistory[h];
          if (!historyItem || typeof historyItem !== 'object') continue;
          const historyId = sanitizePathSegment(historyItem.id || `image-history-${h}`);
          await persistMediaField(historyItem, 'data', 'file', storageDir, `${projectId}/assets/${assetId}/image-history/${historyId}`);
        }
      }
      if (Array.isArray(asset.videoHistory)) {
        for (let h = 0; h < asset.videoHistory.length; h += 1) {
          const historyItem = asset.videoHistory[h];
          if (!historyItem || typeof historyItem !== 'object') continue;
          const historyId = sanitizePathSegment(historyItem.id || `video-history-${h}`);
          await persistMediaField(historyItem, 'data', 'file', storageDir, `${projectId}/assets/${assetId}/video-history/${historyId}`);
        }
      }
    }
  }

  const persistTrackArray = async (tracks: any[], prefix: string) => {
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      if (!track || typeof track !== 'object') continue;
      const trackId = sanitizePathSegment(track.id || `${prefix}-${index}`);
      await persistMediaField(track, 'audioData', 'audioFile', storageDir, `${projectId}/${prefix}/${trackId}`);
    }
  };

  const persistWorkflowImageArray = async (items: any[], prefix: string) => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item || typeof item !== 'object') continue;
      const itemId = sanitizePathSegment(item.id || `${prefix}-${index}`);
      await persistMediaField(item, 'imageData', 'imageFile', storageDir, `${projectId}/workflow/${prefix}/${itemId}`);
      if (Array.isArray(item.generatedImages)) {
        for (let imageIndex = 0; imageIndex < item.generatedImages.length; imageIndex += 1) {
          const image = item.generatedImages[imageIndex];
          if (!image || typeof image !== 'object') continue;
          const imageId = sanitizePathSegment(image.id || `${itemId}-${imageIndex}`);
          await persistMediaField(image, 'imageData', 'imageFile', storageDir, `${projectId}/workflow/${prefix}/${itemId}/generated/${imageId}`);
        }
      }
    }
  };

  if (Array.isArray(project?.backgroundMusicTracks)) {
    await persistTrackArray(project.backgroundMusicTracks, 'background-music');
  }

  if (project?.workflowDraft && typeof project.workflowDraft === 'object') {
    const workflowDraft = project.workflowDraft;
    await persistWorkflowImageArray(Array.isArray(workflowDraft.extractedCharacters) ? workflowDraft.extractedCharacters : [], 'characters');
    await persistWorkflowImageArray(Array.isArray(workflowDraft.styleImages) ? workflowDraft.styleImages : [], 'styles');
    await persistWorkflowImageArray(Array.isArray(workflowDraft.characterImages) ? workflowDraft.characterImages : [], 'character-images');
    await persistMediaField(workflowDraft, 'voiceReferenceAudioData', 'voiceReferenceAudioFile', storageDir, `${projectId}/workflow/voice-reference`);
  }

  const singularMediaFields: Array<[any, string, string, string]> = [
    [project?.voicePreviewAsset, 'audioData', 'audioFile', `${projectId}/preview/voice`],
    [project?.scriptPreviewAsset, 'audioData', 'audioFile', `${projectId}/preview/script`],
    [project?.finalVoiceAsset, 'audioData', 'audioFile', `${projectId}/preview/final-voice`],
    [project?.backgroundMusicPreview, 'audioData', 'audioFile', `${projectId}/preview/background-music`],
    [project?.finalBackgroundMusic, 'audioData', 'audioFile', `${projectId}/preview/final-background-music`],
    [project?.musicVideoPreview, 'videoData', 'videoFile', `${projectId}/preview/music-video`],
    [project?.finalMusicVideo, 'videoData', 'videoFile', `${projectId}/preview/final-music-video`],
  ];

  for (const [target, dataKey, fileKey, relativeBasePath] of singularMediaFields) {
    if (!target || typeof target !== 'object') continue;
    await persistMediaField(target, dataKey, fileKey, storageDir, relativeBasePath);
  }
}

async function hydrateProjectMedia(storageDir: string, project: any) {
  await hydrateMediaField(project, 'thumbnail', 'thumbnailFile', storageDir);

  if (Array.isArray(project?.thumbnailHistory)) {
    for (const item of project.thumbnailHistory) {
      if (!item || typeof item !== 'object') continue;
      await hydrateMediaField(item, 'imageData', 'imageFile', storageDir);
    }
  }

  if (Array.isArray(project?.assets)) {
    for (const asset of project.assets) {
      if (!asset || typeof asset !== 'object') continue;
      await hydrateMediaField(asset, 'imageData', 'imageFile', storageDir);
      await hydrateMediaField(asset, 'audioData', 'audioFile', storageDir);
      await hydrateMediaField(asset, 'videoData', 'videoFile', storageDir);
      if (Array.isArray(asset.imageHistory)) {
        for (const historyItem of asset.imageHistory) {
          if (!historyItem || typeof historyItem !== 'object') continue;
          await hydrateMediaField(historyItem, 'data', 'file', storageDir);
        }
      }
      if (Array.isArray(asset.videoHistory)) {
        for (const historyItem of asset.videoHistory) {
          if (!historyItem || typeof historyItem !== 'object') continue;
          await hydrateMediaField(historyItem, 'data', 'file', storageDir);
        }
      }
    }
  }

  const hydrateWorkflowImageArray = async (items: any[]) => {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      await hydrateMediaField(item, 'imageData', 'imageFile', storageDir);
      if (Array.isArray(item.generatedImages)) {
        for (const image of item.generatedImages) {
          if (!image || typeof image !== 'object') continue;
          await hydrateMediaField(image, 'imageData', 'imageFile', storageDir);
        }
      }
    }
  };

  if (Array.isArray(project?.backgroundMusicTracks)) {
    for (const track of project.backgroundMusicTracks) {
      if (!track || typeof track !== 'object') continue;
      await hydrateMediaField(track, 'audioData', 'audioFile', storageDir);
    }
  }

  if (project?.workflowDraft && typeof project.workflowDraft === 'object') {
    const workflowDraft = project.workflowDraft;
    await hydrateWorkflowImageArray(Array.isArray(workflowDraft.extractedCharacters) ? workflowDraft.extractedCharacters : []);
    await hydrateWorkflowImageArray(Array.isArray(workflowDraft.styleImages) ? workflowDraft.styleImages : []);
    await hydrateWorkflowImageArray(Array.isArray(workflowDraft.characterImages) ? workflowDraft.characterImages : []);
    await hydrateMediaField(workflowDraft, 'voiceReferenceAudioData', 'voiceReferenceAudioFile', storageDir);
  }

  const singularTargets = [
    project?.voicePreviewAsset,
    project?.scriptPreviewAsset,
    project?.finalVoiceAsset,
    project?.backgroundMusicPreview,
    project?.finalBackgroundMusic,
    project?.musicVideoPreview,
    project?.finalMusicVideo,
  ];

  for (const target of singularTargets) {
    if (!target || typeof target !== 'object') continue;
    await hydrateMediaField(target, 'audioData', 'audioFile', storageDir);
    await hydrateMediaField(target, 'videoData', 'videoFile', storageDir);
  }
}

export const projectDetailDirPath = (storageDir: string) => path.join(resolveStorageDir(storageDir), PROJECTS_DIRNAME);
export const projectDetailFilePath = (storageDir: string, projectId: string) => path.join(projectDetailDirPath(storageDir), `${projectId}.json`);



const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/i;
const MEDIA_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_PATTERN.test(value.trim());
}

function parseDataUrl(value: string) {
  const match = value.trim().match(DATA_URL_PATTERN);
  if (!match) return null;
  const mimeType = (match[1] || 'application/octet-stream').toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf-8');
  return { mimeType, buffer };
}

function extensionFromMimeType(mimeType: string, fallback = '.bin') {
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('gif')) return '.gif';
  if (mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp4')) return mimeType.startsWith('audio/') ? '.m4a' : '.mp4';
  if (mimeType.includes('aac')) return '.aac';
  if (mimeType.includes('webm')) return '.webm';
  return fallback;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function normalizeRelativeMediaPath(value: string) {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.posix.normalize(normalized);
  if (!resolved || resolved === '.' || resolved.startsWith('..')) {
    throw new Error('invalid_media_path');
  }
  return resolved;
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeProjectSummary(project: any) {
  const assets = Array.isArray(project?.assets) ? project.assets : [];
  return {
    id: typeof project?.id === 'string' ? project.id : '',
    name: typeof project?.name === 'string' && project.name ? project.name : 'Untitled Project',
    topic: typeof project?.topic === 'string' && project.topic ? project.topic : 'Untitled Project',
    createdAt: typeof project?.createdAt === 'number' ? project.createdAt : 0,
    lastSavedAt: typeof project?.lastSavedAt === 'number' ? project.lastSavedAt : (typeof project?.createdAt === 'number' ? project.createdAt : 0),
    projectNumber: typeof project?.projectNumber === 'number' ? project.projectNumber : 0,
    thumbnail: typeof project?.thumbnail === 'string' ? project.thumbnail : null,
    thumbnailTitle: typeof project?.thumbnailTitle === 'string' ? project.thumbnailTitle : null,
    selectedThumbnailId: typeof project?.selectedThumbnailId === 'string' ? project.selectedThumbnailId : null,
    assetCount: assets.length,
    imageCount: assets.filter((item: any) => Boolean(item?.imageData)).length,
    videoCount: assets.filter((item: any) => Boolean(item?.videoData)).length,
    audioCount: assets.filter((item: any) => Boolean(item?.audioData)).length,
    workflowDraft: project?.workflowDraft ? {
      updatedAt: project.workflowDraft.updatedAt,
      aspectRatio: project.workflowDraft.aspectRatio,
      script: project.workflowDraft.script,
      selectedStyleImageId: project.workflowDraft.selectedStyleImageId,
      selectedCharacterIds: project.workflowDraft.selectedCharacterIds || [],
    } : null,
    assets: [],
    backgroundMusicTracks: [],
    thumbnailHistory: [],
  };
}

function normalizeProjectIndex(projectIndex: any[] | undefined, fallbackProjects: any[] | undefined) {
  const source = Array.isArray(projectIndex) && projectIndex.length ? projectIndex : (Array.isArray(fallbackProjects) ? fallbackProjects : []);
  return source
    .map((project) => normalizeProjectSummary(project))
    .filter((project) => project.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function assignProjectNumbers(projectIndex: any[]) {
  const sorted = [...projectIndex].sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
  const seen = new Set<number>();
  let maxNumber = 0;

  for (const project of sorted) {
    const number = Number(project?.projectNumber || 0);
    if (!Number.isInteger(number) || number <= 0) continue;
    if (number > maxNumber) maxNumber = number;
  }

  return sorted.map((project) => {
    const currentNumber = Number(project?.projectNumber || 0);
    let nextNumber = currentNumber;

    if (!Number.isInteger(currentNumber) || currentNumber <= 0 || seen.has(currentNumber)) {
      maxNumber += 1;
      nextNumber = maxNumber;
    }

    seen.add(nextNumber);

    return {
      ...cloneValue(project),
      projectNumber: nextNumber,
      folderName: undefined,
      folderPath: undefined,
      lastSavedAt: typeof project?.lastSavedAt === 'number' ? project.lastSavedAt : Date.now(),
    };
  });
}

function normalizeState(state: StudioState): StudioState {
  const configured = Boolean(state?.isStorageConfigured) && Boolean(state?.storageDir?.trim());
  const base = createDefaultState(configured ? state.storageDir.trim() : '', { configured });
  const merged: StudioState = {
    ...base,
    ...cloneValue(state),
    providers: {
      ...base.providers,
      ...(state?.providers || {}),
    },
    storageDir: configured ? state.storageDir.trim() : '',
    isStorageConfigured: configured,
    updatedAt: Date.now(),
  };

  const projectIndex = assignProjectNumbers(normalizeProjectIndex(merged.projectIndex, merged.projects));
  merged.projectIndex = projectIndex;
  merged.projects = projectIndex.map((project) => cloneValue(project));

  return merged;
}

function createPersistedState(state: StudioState): StudioState {
  return {
    ...state,
    projects: [],
    projectIndex: Array.isArray(state.projectIndex)
      ? state.projectIndex.map((project) => normalizeProjectSummary(project))
      : [],
  };
}

export function serializeStateForClient(state: StudioState, _options?: { includeProjects?: boolean }): StudioState {
  const projectIndex = Array.isArray(state?.projectIndex)
    ? state.projectIndex.map((project) => normalizeProjectSummary(project))
    : [];

  return {
    ...state,
    projectIndex,
    projects: projectIndex,
  };
}

export async function readStoredState(storageDir?: string): Promise<StudioState> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  const explicitStorageDir = storageDir?.trim() || '';
  const effectiveStorageDir = explicitStorageDir || DEFAULT_STORAGE_DIR;
  const filePath = stateFilePath(effectiveStorageDir);
  const configured = Boolean(explicitStorageDir) && explicitStorageDir !== DEFAULT_STORAGE_DIR;

  if (!(await pathExists(filePath))) {
    return createDefaultState(configured ? effectiveStorageDir : '', { configured });
  }

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = safeJsonParse<StudioState>(raw, createDefaultState(effectiveStorageDir, { configured: true }));
  return normalizeState({
    ...createDefaultState(parsed.storageDir || effectiveStorageDir, { configured: parsed.isStorageConfigured ?? true }),
    ...parsed,
    storageDir: parsed.storageDir || effectiveStorageDir,
    isStorageConfigured: parsed.isStorageConfigured ?? true,
  });
}

export async function ensureState(storageDir?: string): Promise<StudioState> {
  return readStoredState(storageDir);
}

type WriteStateOptions = {
  previousState?: StudioState | null;
  persistProjects?: boolean;
};

export async function writeState(state: StudioState, _options?: WriteStateOptions): Promise<StudioState> {
  await ensureSafeDefaultStorageDirReady(state?.storageDir);
  const normalized = normalizeState(state);

  if (!normalized.isStorageConfigured || !normalized.storageDir?.trim()) {
    return normalized;
  }

  const filePath = stateFilePath(normalized.storageDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.mkdir(projectDetailDirPath(normalized.storageDir), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(createPersistedState(normalized), null, 2), 'utf-8');
  return normalized;
}

export async function readProjectDetail(storageDir: string, projectId: string): Promise<any | null> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  const safeProjectId = projectId?.trim();
  if (!safeProjectId) return null;
  const filePath = projectDetailFilePath(storageDir, safeProjectId);
  if (!(await pathExists(filePath))) return null;
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = safeJsonParse<any | null>(raw, null);
  if (!parsed) return null;
  await hydrateProjectMedia(storageDir, parsed);
  return parsed;
}

export async function writeProjectDetail(storageDir: string, project: any): Promise<any> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  if (!project?.id) {
    throw new Error('project_id_required');
  }
  const persistedProject = cloneValue(project);
  await persistProjectMedia(storageDir, persistedProject);
  const filePath = projectDetailFilePath(storageDir, project.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(persistedProject, null, 2), 'utf-8');
  return persistedProject;
}

export async function deleteProjectDetails(storageDir: string, projectIds: string[]): Promise<number> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  let deleted = 0;
  for (const projectId of projectIds) {
    const safeProjectId = projectId?.trim();
    if (!safeProjectId) continue;
    const filePath = projectDetailFilePath(storageDir, safeProjectId);
    const mediaProjectDir = path.join(mediaDirPath(storageDir), sanitizePathSegment(safeProjectId));
    try {
      await fs.unlink(filePath);
      deleted += 1;
    } catch {
      // noop
    }
    try {
      await fs.rm(mediaProjectDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  }
  return deleted;
}
