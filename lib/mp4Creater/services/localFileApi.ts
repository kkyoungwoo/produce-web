import { CONFIG } from '../config';
import {
  SavedProject,
  StudioState,
  CharacterProfile,
  AiRoutingSettings,
  ProviderRegistryItem,
} from '../types';
import { compactWorkflowDraftForStorage, createDefaultWorkflowDraft } from './workflowDraftService';

export const DEFAULT_STORAGE_DIR = './local-data/tubegen-studio';

export const DEFAULT_ROUTING: AiRoutingSettings = {
  scriptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
  sceneModel: CONFIG.DEFAULT_SCRIPT_MODEL,
  imagePromptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
  motionPromptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
  openRouterMaxTokens: 800,
  openRouterInputMaxChars: 7000,
  imageProvider: 'sample',
  imageModel: 'sample-scene-image',
  audioProvider: 'qwen3Tts',
  audioModel: 'eleven_multilingual_v2',
  ttsNarratorId: 'qwen-default',
  backgroundMusicModel: 'sample-ambient-v1',
  videoProvider: 'sample',
  videoModel: CONFIG.DEFAULT_VIDEO_MODEL,
  textModel: CONFIG.DEFAULT_SCRIPT_MODEL,
  ttsProvider: 'qwen3Tts',
  elevenLabsVoiceId: CONFIG.DEFAULT_VOICE_ID,
  elevenLabsModelId: CONFIG.DEFAULT_ELEVENLABS_MODEL,
  heygenVoiceId: null,
  qwenVoicePreset: 'qwen-default',
  qwenStylePreset: 'balanced',
  backgroundMusicProvider: 'sample',
  backgroundMusicStyle: 'ambient',
  musicVideoProvider: 'sample',
  musicVideoMode: 'sample',
};

let studioStateMemoryCache: StudioState | null = null;
let studioStateSaveFailureCount = 0;
let studioStateSaveCooldownUntil = 0;

function shouldBypassStudioStateSaveRequest() {
  return typeof window !== 'undefined' && Date.now() < studioStateSaveCooldownUntil;
}

function markStudioStateSaveSuccess() {
  studioStateSaveFailureCount = 0;
  studioStateSaveCooldownUntil = 0;
}

function markStudioStateSaveFailure() {
  studioStateSaveFailureCount += 1;
  const backoffMs = Math.min(15000, 1200 * (2 ** Math.max(0, studioStateSaveFailureCount - 1)));
  studioStateSaveCooldownUntil = Date.now() + backoffMs;
}

export const createDefaultCharacter = (): CharacterProfile => ({
  id: `char_${Date.now()}`,
  name: '기본 캐릭터',
  description: '브랜드의 대표 화자. 친근하지만 과장되지 않게 설명한다.',
  visualStyle: '심플한 2D 일러스트, 또렷한 실루엣, 따뜻한 톤',
  voiceHint: '차분하고 선명한 설명형 톤',
  createdAt: Date.now(),
  role: 'lead',
});

function createDefaultRegistry(): ProviderRegistryItem[] {
  return [
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
  ];
}

export const createDefaultStudioState = (): StudioState => ({
  version: 7,
  storageDir: '',
  isStorageConfigured: false,
  configuredAt: Date.now(),
  updatedAt: Date.now(),
  selectedCharacterId: null,
  characters: [],
  routing: { ...DEFAULT_ROUTING },
  providers: {},
  projects: [],
  projectIndex: [],
  workflowDraft: createDefaultWorkflowDraft('story'),
  agentProfile: {
    name: '나만의 기본 제작 에이전트',
    mission: '초보 사용자도 스토리부터 장면, 나레이션, 영상까지 자연스럽게 따라오게 돕는다.',
    toneGuide: '선택형 옵션을 많이 보여주고, 직접 입력은 꼭 필요한 순간만 요청한다.',
    defaultWorkflow: 'general_youtube',
  },
  preferredPromptProfile: 'general_youtube',
  providerRegistry: createDefaultRegistry(),
  lastContentType: 'story',
});

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json();
}

function getCachedStorageDir() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR) || '';
}

function stripBinaryPayloadFromImage(item: any) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    imageData: undefined,
    data: undefined,
  };
}

function stripBinaryPayloadFromCharacter(character: any) {
  if (!character || typeof character !== 'object') return character;
  return {
    ...character,
    imageData: undefined,
    generatedImages: Array.isArray(character.generatedImages) ? character.generatedImages.map(stripBinaryPayloadFromImage) : [],
  };
}

function createLightweightWorkflowDraft(draft: any) {
  if (!draft || typeof draft !== 'object') return draft;
  return {
    ...draft,
    styleImages: Array.isArray(draft.styleImages) ? draft.styleImages.map(stripBinaryPayloadFromImage) : [],
    thumbnailHistory: Array.isArray(draft.thumbnailHistory) ? draft.thumbnailHistory.map(stripBinaryPayloadFromImage) : [],
    extractedCharacters: Array.isArray(draft.extractedCharacters) ? draft.extractedCharacters.map(stripBinaryPayloadFromCharacter) : [],
  };
}

export function summarizeProjectForIndex(project: any): SavedProject {
  const assets = Array.isArray(project?.assets) ? project.assets : [];
  const firstImage = assets.find((asset: any) => asset?.imageData)?.imageData || null;
  return {
    id: typeof project?.id === 'string' ? project.id : `project_${Date.now()}`,
    name: typeof project?.name === 'string' ? project.name : 'Untitled Project',
    createdAt: typeof project?.createdAt === 'number' ? project.createdAt : Date.now(),
    topic: typeof project?.topic === 'string' ? project.topic : 'Untitled Project',
    projectNumber: typeof project?.projectNumber === 'number' ? project.projectNumber : undefined,
    folderName: typeof project?.folderName === 'string' ? project.folderName : undefined,
    folderPath: typeof project?.folderPath === 'string' ? project.folderPath : undefined,
    lastSavedAt: typeof project?.lastSavedAt === 'number' ? project.lastSavedAt : Date.now(),
    settings: project?.settings || {
      imageModel: CONFIG.DEFAULT_IMAGE_MODEL,
      outputMode: 'video',
      elevenLabsModel: CONFIG.DEFAULT_ELEVENLABS_MODEL,
    },
    assets: [],
    thumbnail: typeof project?.thumbnail === 'string' ? project.thumbnail : firstImage,
    thumbnailTitle: typeof project?.thumbnailTitle === 'string' ? project.thumbnailTitle : null,
    thumbnailPrompt: typeof project?.thumbnailPrompt === 'string' ? project.thumbnailPrompt : null,
    thumbnailHistory: [],
    selectedThumbnailId: typeof project?.selectedThumbnailId === 'string' ? project.selectedThumbnailId : null,
    cost: project?.cost,
    backgroundMusicTracks: [],
    previewMix: project?.previewMix,
    workflowDraft: project?.workflowDraft ? {
      updatedAt: project.workflowDraft.updatedAt,
      aspectRatio: project.workflowDraft.aspectRatio,
      activeStage: project.workflowDraft.activeStage,
      contentType: project.workflowDraft.contentType,
      outputMode: project.workflowDraft.outputMode,
      completedSteps: project.workflowDraft.completedSteps,
      script: typeof project.workflowDraft.script === 'string' ? project.workflowDraft.script.slice(0, 800) : '',
      topic: project.workflowDraft.topic || project.topic || '',
      selectedStyleImageId: project.workflowDraft.selectedStyleImageId,
      selectedCharacterIds: project.workflowDraft.selectedCharacterIds || [],
    } as any : null,
  };
}

function createLightweightStudioState(state: StudioState): StudioState {
  const projectIndex = Array.isArray((state as any).projectIndex)
    ? (state as any).projectIndex.map(summarizeProjectForIndex)
    : [];

  return {
    ...state,
    projects: Array.isArray(state.projects) ? state.projects.map(summarizeProjectForIndex) : projectIndex,
    projectIndex,
    characters: Array.isArray(state.characters) ? state.characters.map(stripBinaryPayloadFromCharacter) : [],
    workflowDraft: createLightweightWorkflowDraft(compactWorkflowDraftForStorage(state.workflowDraft)),
  };
}

function readStudioStateCacheFromLocalStorage(): StudioState | null {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as StudioState;
  } catch {
    return null;
  }
}

export function getCachedStudioState(): StudioState | null {
  if (studioStateMemoryCache) return studioStateMemoryCache;
  const localCache = readStudioStateCacheFromLocalStorage();
  if (localCache) {
    studioStateMemoryCache = localCache;
    return localCache;
  }
  return null;
}

function syncStudioStateToLocalCache(state: StudioState) {
  studioStateMemoryCache = state;
  if (typeof window === 'undefined') return;

  const lightState = createLightweightStudioState(state);

  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(lightState));
  } catch (error) {
    console.warn('[mp4Creater] lightweight studio cache write failed', error);
    try {
      const emergencyState: Partial<StudioState> = {
        version: lightState.version,
        storageDir: lightState.storageDir,
        isStorageConfigured: lightState.isStorageConfigured,
        configuredAt: lightState.configuredAt,
        updatedAt: lightState.updatedAt,
        selectedCharacterId: lightState.selectedCharacterId,
        routing: lightState.routing,
        providers: lightState.providers,
        workflowDraft: lightState.workflowDraft,
        lastContentType: lightState.lastContentType,
        projects: Array.isArray(lightState.projects) ? lightState.projects.map(summarizeProjectForIndex) : [],
        projectIndex: Array.isArray((lightState as any).projectIndex) ? (lightState as any).projectIndex.map(summarizeProjectForIndex) : [],
        characters: [],
      };
      localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(emergencyState));
    } catch {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE);
    }
  }

  if (state.isStorageConfigured && state.storageDir) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR, state.storageDir);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR);
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_CONTENT_TYPE, state.lastContentType || 'story');

  if (state.providers?.openRouterApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY, state.providers.openRouterApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY);
  }

  if (state.providers?.elevenLabsApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY, state.providers.elevenLabsApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY);
  }

  if (state.providers?.heygenApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY, state.providers.heygenApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY);
  }

  if (state.routing?.imageModel) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.IMAGE_MODEL, state.routing.imageModel);
  }

  if (state.routing?.audioModel) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL, state.routing.audioModel);
  }

  if (state.routing?.ttsProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.TTS_PROVIDER, state.routing.ttsProvider);
  }
  if (state.routing?.qwenVoicePreset) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.QWEN_VOICE_PRESET, state.routing.qwenVoicePreset);
  }
  if (state.routing?.heygenVoiceId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.HEYGEN_VOICE_ID, state.routing.heygenVoiceId);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.HEYGEN_VOICE_ID);
  }
  if (state.routing?.qwenStylePreset) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.QWEN_STYLE_PRESET, state.routing.qwenStylePreset);
  }
  if (state.routing?.backgroundMusicProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BGM_PROVIDER, state.routing.backgroundMusicProvider);
  }
  if (state.routing?.backgroundMusicStyle) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BGM_STYLE, state.routing.backgroundMusicStyle);
  }
  if (state.routing?.musicVideoProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MUSIC_VIDEO_PROVIDER, state.routing.musicVideoProvider);
  }
  if (state.routing?.musicVideoMode) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MUSIC_VIDEO_MODE, state.routing.musicVideoMode);
  }

  if (state.selectedCharacterId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_CHARACTER_ID, state.selectedCharacterId);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SELECTED_CHARACTER_ID);
  }
}

function haveProjectsMeaningfullyChanged(nextProjects: any[] | undefined, currentProjects: any[] | undefined) {
  const nextList = Array.isArray(nextProjects) ? nextProjects : [];
  const currentList = Array.isArray(currentProjects) ? currentProjects : [];
  if (nextList.length !== currentList.length) return true;
  return nextList.some((project, index) => {
    const current = currentList[index];
    return project?.id !== current?.id
      || (project?.lastSavedAt || project?.createdAt || 0) !== (current?.lastSavedAt || current?.createdAt || 0)
      || (project?.folderName || '') !== (current?.folderName || '')
      || (project?.projectNumber || 0) !== (current?.projectNumber || 0);
  });
}

function buildLeanStatePayload(partial: Partial<StudioState>, cachedState?: StudioState | null) {
  const base = cachedState || createDefaultStudioState();
  const payload: Partial<StudioState> = {
    version: partial.version || base.version,
    storageDir: typeof partial.storageDir === 'string' ? partial.storageDir : base.storageDir,
    isStorageConfigured: typeof partial.isStorageConfigured === 'boolean' ? partial.isStorageConfigured : base.isStorageConfigured,
    configuredAt: partial.configuredAt || base.configuredAt,
    updatedAt: partial.updatedAt || Date.now(),
    selectedCharacterId: Object.prototype.hasOwnProperty.call(partial, 'selectedCharacterId') ? partial.selectedCharacterId ?? null : base.selectedCharacterId,
    characters: Array.isArray(partial.characters) ? partial.characters : base.characters,
    routing: partial.routing ? { ...(base.routing || DEFAULT_ROUTING), ...partial.routing } : base.routing,
    providers: partial.providers ? { ...(base.providers || {}), ...partial.providers } : base.providers,
    agentProfile: partial.agentProfile || base.agentProfile,
    preferredPromptProfile: partial.preferredPromptProfile || base.preferredPromptProfile,
    providerRegistry: Array.isArray(partial.providerRegistry) ? partial.providerRegistry : base.providerRegistry,
    lastContentType: partial.lastContentType || base.lastContentType || 'story',
  };

  if (Object.prototype.hasOwnProperty.call(partial, 'workflowDraft')) {
    payload.workflowDraft = compactWorkflowDraftForStorage(partial.workflowDraft as any) ?? null;
  }

  const nextProjectIndex = Array.isArray((partial as any).projectIndex)
    ? (partial as any).projectIndex.map(summarizeProjectForIndex)
    : (Array.isArray(partial.projects) ? partial.projects.map(summarizeProjectForIndex) : undefined);

  if (Array.isArray(nextProjectIndex) && haveProjectsMeaningfullyChanged(nextProjectIndex, (base as any).projectIndex || base.projects)) {
    payload.projects = nextProjectIndex;
    (payload as any).projectIndex = nextProjectIndex;
  }

  return payload;
}

export async function fetchStudioState(options?: { force?: boolean; storageDir?: string }): Promise<StudioState> {
  const cachedDir = options?.storageDir || getCachedStorageDir();
  const cachedState = getCachedStudioState();

  if (!options?.force && cachedState && (cachedState.storageDir || '') === cachedDir) {
    return cachedState;
  }

  try {
    const query = cachedDir ? `?storageDir=${encodeURIComponent(cachedDir)}` : '';
    const state = await requestJson<StudioState>(`/api/local-storage/state${query}`);
    syncStudioStateToLocalCache(state);
    return state;
  } catch {
    if (cachedState) return cachedState;
    return createDefaultStudioState();
  }
}

export async function fetchStudioProjects(options?: { storageDir?: string }): Promise<SavedProject[]> {
  const storageDir = options?.storageDir || getCachedStorageDir();
  const query = new URLSearchParams();
  if (storageDir) query.set('storageDir', storageDir);
  query.set('includeProjects', '1');
  const state = await requestJson<StudioState>(`/api/local-storage/state?${query.toString()}`);
  return Array.isArray(state.projects) ? state.projects.map(summarizeProjectForIndex) : [];
}

export async function fetchStudioProjectById(projectId: string, options?: { storageDir?: string }): Promise<SavedProject | null> {
  const storageDir = options?.storageDir || getCachedStorageDir();
  const query = new URLSearchParams();
  if (storageDir) query.set('storageDir', storageDir);
  query.set('projectId', projectId);

  try {
    return await requestJson<SavedProject>(`/api/local-storage/project?${query.toString()}`);
  } catch {
    return null;
  }
}

export async function saveStudioProject(project: SavedProject, options?: { storageDir?: string }): Promise<void> {
  const storageDir = options?.storageDir || getCachedStorageDir();
  await requestJson('/api/local-storage/project', {
    method: 'POST',
    body: JSON.stringify({ storageDir, project }),
  });
}

export async function deleteStudioProjects(projectIds: string[], options?: { storageDir?: string }): Promise<void> {
  const storageDir = options?.storageDir || getCachedStorageDir();
  await requestJson('/api/local-storage/project', {
    method: 'DELETE',
    body: JSON.stringify({ storageDir, projectIds }),
  });
}

export async function configureStorage(storageDir: string): Promise<StudioState> {
  const state = await requestJson<StudioState>('/api/local-storage/config', {
    method: 'POST',
    body: JSON.stringify({ storageDir }),
  });
  syncStudioStateToLocalCache(state);
  return state;
}

export async function saveStudioState(partial: Partial<StudioState>): Promise<StudioState> {
  const cachedState = getCachedStudioState();
  const payload = buildLeanStatePayload(partial, cachedState);

  const buildOptimisticState = () => (cachedState
    ? {
        ...cachedState,
        ...payload,
        projects: Array.isArray(partial.projects) ? partial.projects.map(summarizeProjectForIndex) : (cachedState.projects || []),
        projectIndex: Array.isArray((payload as any).projectIndex) ? (payload as any).projectIndex : ((cachedState as any)?.projectIndex || []),
      }
    : {
        ...createDefaultStudioState(),
        ...payload,
        projects: Array.isArray(partial.projects) ? partial.projects.map(summarizeProjectForIndex) : [],
        projectIndex: Array.isArray((payload as any).projectIndex) ? (payload as any).projectIndex : [],
      }) as StudioState;

  if (shouldBypassStudioStateSaveRequest()) {
    const optimisticState = buildOptimisticState();
    syncStudioStateToLocalCache(optimisticState);
    return optimisticState;
  }

  try {
    const state = await requestJson<StudioState>('/api/local-storage/state', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const nextMemoryState = cachedState
      ? {
          ...cachedState,
          ...payload,
          ...state,
          projects: Array.isArray(state.projects) ? state.projects : (Array.isArray(partial.projects) ? partial.projects.map(summarizeProjectForIndex) : (cachedState.projects || [])),
          projectIndex: Array.isArray((state as any).projectIndex) ? (state as any).projectIndex : (Array.isArray((payload as any).projectIndex) ? (payload as any).projectIndex : ((cachedState as any)?.projectIndex || [])),
        }
      : state;

    markStudioStateSaveSuccess();
    syncStudioStateToLocalCache(nextMemoryState as StudioState);
    return nextMemoryState as StudioState;
  } catch (error) {
    markStudioStateSaveFailure();
    const optimisticState = buildOptimisticState();
    syncStudioStateToLocalCache(optimisticState);
    console.warn('[mp4Creater] saveStudioState failed, keeping local cache only', error);
    return optimisticState;
  }
}

export async function saveProjectsToStudio(projects: SavedProject[]): Promise<StudioState> {
  const cachedState = getCachedStudioState() || createDefaultStudioState();
  if (!cachedState.isStorageConfigured || !cachedState.storageDir) {
    throw new Error('저장 위치가 아직 설정되지 않았습니다. 먼저 JSON 저장 위치를 선택해 주세요.');
  }
  return saveStudioState({
    storageDir: cachedState.storageDir,
    isStorageConfigured: true,
    projects: projects.map(summarizeProjectForIndex),
    projectIndex: projects.map(summarizeProjectForIndex),
    updatedAt: Date.now(),
  });
}

export async function importStudioState(file: File): Promise<StudioState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return saveStudioState(parsed);
}
