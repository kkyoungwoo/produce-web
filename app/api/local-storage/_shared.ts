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

  const legacyExists = await pathExists(legacyDir);
  const safeExists = await pathExists(safeDir);

  if (!legacyExists || safeExists) return;

  await fs.mkdir(path.dirname(safeDir), { recursive: true });
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
    scriptModel: 'openrouter/auto',
    sceneModel: 'openrouter/auto',
    imagePromptModel: 'openrouter/auto',
    motionPromptModel: 'openrouter/auto',
    openRouterMaxTokens: 800,
    openRouterInputMaxChars: 7000,
    imageProvider: 'gemini',
    imageModel: 'gemini-2.5-flash-image',
    audioProvider: 'elevenlabs',
    audioModel: 'eleven_multilingual_v2',
    ttsNarratorId: 'rachel',
    backgroundMusicModel: 'sample-ambient-v1',
    videoProvider: 'fal',
    videoModel: 'pixverse/v5.5',
  },
  providers: {},
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
export const projectDetailDirPath = (storageDir: string) => path.join(resolveStorageDir(storageDir), PROJECTS_DIRNAME);
export const projectDetailFilePath = (storageDir: string, projectId: string) => path.join(projectDetailDirPath(storageDir), `${projectId}.json`);

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
  return safeJsonParse<any | null>(raw, null);
}

export async function writeProjectDetail(storageDir: string, project: any): Promise<any> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  if (!project?.id) {
    throw new Error('project_id_required');
  }
  const filePath = projectDetailFilePath(storageDir, project.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

export async function deleteProjectDetails(storageDir: string, projectIds: string[]): Promise<number> {
  await ensureSafeDefaultStorageDirReady(storageDir);
  let deleted = 0;
  for (const projectId of projectIds) {
    const safeProjectId = projectId?.trim();
    if (!safeProjectId) continue;
    const filePath = projectDetailFilePath(storageDir, safeProjectId);
    try {
      await fs.unlink(filePath);
      deleted += 1;
    } catch {
      // noop
    }
  }
  return deleted;
}
