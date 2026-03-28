import { CHATTERBOX_CUSTOM_VOICE_ID, CHATTERBOX_TTS_PRESET_OPTIONS, CONFIG, ELEVENLABS_MODELS, IMAGE_MODELS, QWEN_TTS_PRESET_OPTIONS, SCRIPT_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS } from '../config';
import {
  SavedProject,
  StudioState,
  CharacterProfile,
  AiRoutingSettings,
  ProviderRegistryItem,
  WorkflowDraft,
  normalizeContentType,
} from '../types';
import { compactWorkflowDraftForStorage, createDefaultWorkflowDraft } from './workflowDraftService';
import { normalizeBackgroundMusicModelId, resolveBackgroundMusicProvider } from './musicService';

export const DEFAULT_STORAGE_DIR = './local-data/tubegen-studio';

const SCRIPT_MODEL_ID_SET = new Set(SCRIPT_MODEL_OPTIONS.map((item) => item.id));
const IMAGE_MODEL_ID_SET = new Set(IMAGE_MODELS.map((item) => item.id));
const VIDEO_MODEL_ID_SET = new Set(VIDEO_MODEL_OPTIONS.map((item) => item.id));
const ELEVENLABS_MODEL_ID_SET = new Set(ELEVENLABS_MODELS.map((item) => item.id));
const QWEN_TTS_PRESET_ID_SET = new Set(QWEN_TTS_PRESET_OPTIONS.map((item) => item.id));
const CHATTERBOX_TTS_PRESET_ID_SET = new Set([
  ...CHATTERBOX_TTS_PRESET_OPTIONS.map((item) => item.id),
  CHATTERBOX_CUSTOM_VOICE_ID,
]);

function normalizeAllowedValue(value: string | null | undefined, allowed: Set<string>, fallback: string) {
  const trimmed = `${value || ''}`.trim();
  return trimmed && allowed.has(trimmed) ? trimmed : fallback;
}

function normalizeWorkflowDraftContentType(draft: any): WorkflowDraft | null {
  if (!draft || typeof draft !== 'object') return null;
  return {
    ...draft,
    contentType: normalizeContentType(draft.contentType),
  } as WorkflowDraft;
}

function normalizeProjectContentTypes(project: any): SavedProject {
  if (!project || typeof project !== 'object') return summarizeProjectForIndex(project);
  return {
    ...project,
    workflowDraft: project.workflowDraft ? normalizeWorkflowDraftContentType(project.workflowDraft) : null,
  } as SavedProject;
}

function normalizeStudioStateContentTypes(state: StudioState | null | undefined): StudioState {
  if (!state) return createDefaultStudioState();
  return sanitizeRoutingForAvailableProviders({
    ...state,
    workflowDraft: state.workflowDraft ? normalizeWorkflowDraftContentType(state.workflowDraft) : null,
    projects: Array.isArray(state.projects) ? state.projects.map(normalizeProjectContentTypes) : [],
    projectIndex: Array.isArray((state as any).projectIndex) ? (state as any).projectIndex.map(normalizeProjectContentTypes) : [],
    lastContentType: normalizeContentType(state.lastContentType || state.workflowDraft?.contentType || 'story'),
  });
}

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
  chatterboxVoicePreset: 'chatterbox-clear',
  voiceReferenceAudioData: null,
  voiceReferenceMimeType: null,
  voiceReferenceName: null,
  qwenStylePreset: 'balanced',
  backgroundMusicProvider: 'sample',
  backgroundMusicStyle: 'ambient',
  musicVideoProvider: 'sample',
  musicVideoMode: 'sample',
};

let studioStateMemoryCache: StudioState | null = null;
let studioStateSaveFailureCount = 0;
let studioStateSaveCooldownUntil = 0;
const STUDIO_STATE_CACHE_MAX_PROJECTS = 80;
const STUDIO_STATE_CACHE_SOFT_LIMIT = 1_800_000;
const LOCAL_STUDIO_STORAGE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function canUseServerStudioPersistence() {
  if (typeof window === 'undefined') return true;
  return LOCAL_STUDIO_STORAGE_HOSTNAMES.has(window.location.hostname);
}

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
  version: 8,
  storageDir: '',
  isStorageConfigured: false,
  configuredAt: Date.now(),
  updatedAt: Date.now(),
  selectedCharacterId: null,
  characters: [],
  routing: { ...DEFAULT_ROUTING },
  providers: {
    openRouterApiKey: '',
    elevenLabsApiKey: '',
    heygenApiKey: '',
    falApiKey: '',
  },
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

function sanitizeRoutingForAvailableProviders(state: StudioState): StudioState {
  const providers = state.providers || {};
  const routing = { ...DEFAULT_ROUTING, ...(state.routing || {}) };
  const hasGoogleStyleKey = Boolean((providers.openRouterApiKey || providers.falApiKey || '').trim());
  const hasElevenLabsKey = Boolean((providers.elevenLabsApiKey || '').trim());
  const hasHeygenKey = Boolean((providers.heygenApiKey || '').trim());

  // 텍스트/이미지/비디오 모델은 설정창 저장값이 오래돼도 항상 실제 지원 목록으로 정규화합니다.
  routing.scriptModel = normalizeAllowedValue(routing.scriptModel, SCRIPT_MODEL_ID_SET, CONFIG.DEFAULT_SCRIPT_MODEL);
  routing.textModel = normalizeAllowedValue(routing.textModel || routing.scriptModel, SCRIPT_MODEL_ID_SET, routing.scriptModel);
  routing.sceneModel = normalizeAllowedValue(routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel, SCRIPT_MODEL_ID_SET, routing.textModel || CONFIG.DEFAULT_SCRIPT_MODEL);
  routing.imagePromptModel = normalizeAllowedValue(routing.imagePromptModel || routing.sceneModel, SCRIPT_MODEL_ID_SET, routing.sceneModel);
  routing.motionPromptModel = normalizeAllowedValue(routing.motionPromptModel || routing.sceneModel, SCRIPT_MODEL_ID_SET, routing.sceneModel);
  routing.imageModel = normalizeAllowedValue(routing.imageModel, IMAGE_MODEL_ID_SET, CONFIG.DEFAULT_IMAGE_MODEL);
  routing.videoModel = normalizeAllowedValue(routing.videoModel, VIDEO_MODEL_ID_SET, CONFIG.DEFAULT_VIDEO_MODEL);
  routing.audioModel = normalizeAllowedValue(routing.audioModel || routing.elevenLabsModelId, ELEVENLABS_MODEL_ID_SET, CONFIG.DEFAULT_ELEVENLABS_MODEL);
  routing.elevenLabsModelId = normalizeAllowedValue(routing.elevenLabsModelId || routing.audioModel, ELEVENLABS_MODEL_ID_SET, routing.audioModel);
  routing.qwenVoicePreset = normalizeAllowedValue(routing.qwenVoicePreset, QWEN_TTS_PRESET_ID_SET, 'qwen-default');
  routing.chatterboxVoicePreset = normalizeAllowedValue(routing.chatterboxVoicePreset, CHATTERBOX_TTS_PRESET_ID_SET, 'chatterbox-clear');
  routing.backgroundMusicModel = normalizeBackgroundMusicModelId(routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL);
  routing.backgroundMusicProvider = resolveBackgroundMusicProvider(
    routing.backgroundMusicModel,
    routing.backgroundMusicProvider || 'sample',
  );
  if (routing.ttsProvider === 'chatterbox') {
    routing.ttsProvider = 'qwen3Tts';
  }
  if (routing.audioProvider === 'chatterbox') {
    routing.audioProvider = 'qwen3Tts';
  }
  if (routing.chatterboxVoicePreset === CHATTERBOX_CUSTOM_VOICE_ID && !routing.voiceReferenceAudioData) {
    routing.chatterboxVoicePreset = 'chatterbox-clear';
  }
  if (routing.ttsNarratorId === CHATTERBOX_CUSTOM_VOICE_ID && !routing.voiceReferenceAudioData) {
    routing.ttsNarratorId = 'chatterbox-clear';
  }

  if (routing.imageModel === CONFIG.DEFAULT_IMAGE_MODEL) {
    routing.imageProvider = 'sample';
  }

  if (routing.videoModel === CONFIG.DEFAULT_VIDEO_MODEL) {
    routing.videoProvider = 'sample';
  }

  if (!hasGoogleStyleKey) {
    routing.imageProvider = 'sample';
    routing.videoProvider = 'sample';
    routing.musicVideoProvider = 'sample';
    routing.musicVideoMode = 'sample';
    routing.imageModel = CONFIG.DEFAULT_IMAGE_MODEL;
    routing.videoModel = CONFIG.DEFAULT_VIDEO_MODEL;
  }

  if (!hasElevenLabsKey) {
    if (routing.audioProvider === 'elevenLabs') routing.audioProvider = 'qwen3Tts';
    if (routing.ttsProvider === 'elevenLabs') routing.ttsProvider = 'qwen3Tts';
    routing.elevenLabsModelId = CONFIG.DEFAULT_ELEVENLABS_MODEL;
    routing.audioModel = CONFIG.DEFAULT_ELEVENLABS_MODEL;
  }

  if (!hasHeygenKey) {
    if (routing.audioProvider === 'heygen') routing.audioProvider = 'qwen3Tts';
    if (routing.ttsProvider === 'heygen') routing.ttsProvider = 'qwen3Tts';
  }

  return {
    ...state,
    routing,
  };
}

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

function stripBinaryPayloadFromAudioPreviewAsset(asset: any) {
  if (!asset || typeof asset !== 'object') return asset;
  return {
    ...asset,
    audioData: undefined,
  };
}

function stripBinaryPayloadFromVideoPreviewAsset(asset: any) {
  if (!asset || typeof asset !== 'object') return asset;
  return {
    ...asset,
    videoData: undefined,
  };
}

function stripBinaryPayloadFromBackgroundTrack(track: any) {
  if (!track || typeof track !== 'object') return track;
  return {
    ...track,
    audioData: undefined,
  };
}

function trimCachedProjects(projects: any[] | undefined | null) {
  return Array.isArray(projects) ? projects.slice(0, STUDIO_STATE_CACHE_MAX_PROJECTS) : [];
}

function stripBinaryPayloadFromProjectSummary(project: any) {
  if (!project || typeof project !== 'object') return project;
  const thumbnail = typeof project.thumbnail === 'string' && project.thumbnail.startsWith('data:') ? null : project.thumbnail;
  return {
    ...project,
    thumbnail,
    thumbnailHistory: [],
    backgroundMusicTracks: [],
    workflowDraft: project.workflowDraft ? {
      ...project.workflowDraft,
      script: typeof project.workflowDraft.script === 'string' ? project.workflowDraft.script.slice(0, 180) : '',
    } : null,
  };
}

function createLightweightWorkflowDraft(draft: any) {
  if (!draft || typeof draft !== 'object') return draft;
  return {
    ...draft,
    script: typeof draft.script === 'string' ? draft.script.slice(0, 2400) : '',
    styleImages: Array.isArray(draft.styleImages) ? draft.styleImages.map(stripBinaryPayloadFromImage) : [],
    thumbnailHistory: Array.isArray(draft.thumbnailHistory) ? draft.thumbnailHistory.map(stripBinaryPayloadFromImage) : [],
    extractedCharacters: Array.isArray(draft.extractedCharacters) ? draft.extractedCharacters.map(stripBinaryPayloadFromCharacter) : [],
    characterImages: [],
    promptTemplates: [],
    promptAdditions: Array.isArray(draft.promptAdditions) ? draft.promptAdditions.slice(0, 20) : [],
    voicePreviewAsset: stripBinaryPayloadFromAudioPreviewAsset(draft.voicePreviewAsset),
    scriptPreviewAsset: stripBinaryPayloadFromAudioPreviewAsset(draft.scriptPreviewAsset),
    finalVoiceAsset: stripBinaryPayloadFromAudioPreviewAsset(draft.finalVoiceAsset),
    backgroundMusicPreview: stripBinaryPayloadFromBackgroundTrack(draft.backgroundMusicPreview),
    finalBackgroundMusic: stripBinaryPayloadFromBackgroundTrack(draft.finalBackgroundMusic),
    musicVideoPreview: stripBinaryPayloadFromVideoPreviewAsset(draft.musicVideoPreview),
    finalMusicVideo: stripBinaryPayloadFromVideoPreviewAsset(draft.finalMusicVideo),
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
    schemaVersion: typeof project?.schemaVersion === 'number' && project.schemaVersion > 0 ? project.schemaVersion : 2,
    settings: project?.settings || {
      imageModel: CONFIG.DEFAULT_IMAGE_MODEL,
      videoModel: CONFIG.DEFAULT_VIDEO_MODEL,
      scriptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
      sceneModel: CONFIG.DEFAULT_SCRIPT_MODEL,
      outputMode: 'video',
      elevenLabsModel: CONFIG.DEFAULT_ELEVENLABS_MODEL,
      imageProvider: 'sample',
      videoProvider: 'sample',
      ttsProvider: 'qwen3Tts',
      audioProvider: 'qwen3Tts',
      qwenVoicePreset: 'qwen-default',
      chatterboxVoicePreset: 'chatterbox-clear',
      elevenLabsVoiceId: null,
      heygenVoiceId: null,
      voiceReferenceAudioData: null,
      voiceReferenceMimeType: null,
      voiceReferenceName: null,
      backgroundMusicProvider: 'sample',
      backgroundMusicModel: CONFIG.DEFAULT_BGM_MODEL,
      musicVideoProvider: 'sample',
      musicVideoMode: 'sample',
    },
    assets: [],
    thumbnail: typeof project?.thumbnail === 'string' ? project.thumbnail : firstImage,
    thumbnailTitle: typeof project?.thumbnailTitle === 'string' ? project.thumbnailTitle : null,
    thumbnailPrompt: typeof project?.thumbnailPrompt === 'string' ? project.thumbnailPrompt : null,
    thumbnailHistory: [],
    selectedThumbnailId: typeof project?.selectedThumbnailId === 'string' ? project.selectedThumbnailId : null,
    cost: project?.cost,
    backgroundMusicTracks: [],
    activeBackgroundTrackId: typeof project?.activeBackgroundTrackId === 'string' ? project.activeBackgroundTrackId : null,
    previewMix: project?.previewMix,
    workflowDraft: project?.workflowDraft ? {
      updatedAt: project.workflowDraft.updatedAt,
      aspectRatio: project.workflowDraft.aspectRatio,
      activeStage: project.workflowDraft.activeStage,
      contentType: normalizeContentType(project.workflowDraft.contentType),
      outputMode: project.workflowDraft.outputMode,
      completedSteps: project.workflowDraft.completedSteps,
      script: typeof project.workflowDraft.script === 'string' ? project.workflowDraft.script.slice(0, 240) : '',
      topic: project.workflowDraft.topic || project.topic || '',
      selectedStyleImageId: project.workflowDraft.selectedStyleImageId,
      selectedCharacterIds: project.workflowDraft.selectedCharacterIds || [],
    } as any : null,
    youtubeUploadStatus: project?.youtubeUploadStatus || 'idle',
    youtubeUploadedAt: typeof project?.youtubeUploadedAt === 'number' ? project.youtubeUploadedAt : null,
    youtubeVideoId: typeof project?.youtubeVideoId === 'string' ? project.youtubeVideoId : null,
    youtubeChannelTitle: typeof project?.youtubeChannelTitle === 'string' ? project.youtubeChannelTitle : null,
    youtubeTitle: typeof project?.youtubeTitle === 'string' ? project.youtubeTitle : null,
    isShortsEligible: typeof project?.isShortsEligible === 'boolean' ? project.isShortsEligible : false,
  };
}

function createLightweightStudioState(state: StudioState): StudioState {
  const summarizedProjects = trimCachedProjects(
    Array.isArray(state.projects) ? state.projects.map(summarizeProjectForIndex) : (Array.isArray((state as any).projectIndex) ? (state as any).projectIndex.map(summarizeProjectForIndex) : []),
  ).map(stripBinaryPayloadFromProjectSummary);

  return {
    ...state,
    projects: summarizedProjects,
    projectIndex: [],
    characters: Array.isArray(state.characters) ? state.characters.map(stripBinaryPayloadFromCharacter) : [],
    workflowDraft: createLightweightWorkflowDraft(compactWorkflowDraftForStorage(state.workflowDraft)),
  };
}

function readStudioStateCacheFromLocalStorage(): StudioState | null {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE);
  if (!cached) return null;
  try {
    return normalizeStudioStateContentTypes(JSON.parse(cached) as StudioState);
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
  const normalizedState = normalizeStudioStateContentTypes(state);
  studioStateMemoryCache = normalizedState;
  if (typeof window === 'undefined') return;

  const lightState = createLightweightStudioState(normalizedState);
  const writeCache = (payload: unknown) => localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(payload));

  try {
    const serializedLightState = JSON.stringify(lightState);
    if (serializedLightState.length > STUDIO_STATE_CACHE_SOFT_LIMIT) {
      throw new Error('studio cache payload too large');
    }
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, serializedLightState);
  } catch {
    try {
      const summarizedProjects = trimCachedProjects(Array.isArray(lightState.projects) ? lightState.projects.map(summarizeProjectForIndex) : []).map(stripBinaryPayloadFromProjectSummary);
      const emergencyState: Partial<StudioState> = {
        version: lightState.version,
        storageDir: lightState.storageDir,
        isStorageConfigured: lightState.isStorageConfigured,
        configuredAt: lightState.configuredAt,
        updatedAt: lightState.updatedAt,
        selectedCharacterId: lightState.selectedCharacterId,
        routing: lightState.routing,
        providers: lightState.providers,
        workflowDraft: lightState.workflowDraft ? {
          id: lightState.workflowDraft.id,
          contentType: lightState.workflowDraft.contentType,
          aspectRatio: lightState.workflowDraft.aspectRatio,
          topic: lightState.workflowDraft.topic,
          outputMode: lightState.workflowDraft.outputMode,
          selections: lightState.workflowDraft.selections,
          script: typeof lightState.workflowDraft.script === 'string' ? lightState.workflowDraft.script.slice(0, 600) : '',
          activeStage: lightState.workflowDraft.activeStage,
          selectedCharacterIds: lightState.workflowDraft.selectedCharacterIds,
          selectedStyleImageId: lightState.workflowDraft.selectedStyleImageId,
          completedSteps: lightState.workflowDraft.completedSteps,
          updatedAt: lightState.workflowDraft.updatedAt,
        } as any : null,
        lastContentType: lightState.lastContentType,
        projects: summarizedProjects,
        projectIndex: [],
        characters: [],
      };
      writeCache(emergencyState);
    } catch {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE);
    }
  }

  if (normalizedState.isStorageConfigured && normalizedState.storageDir) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR, normalizedState.storageDir);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR);
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_CONTENT_TYPE, normalizedState.lastContentType || 'story');

  if (normalizedState.providers?.openRouterApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY, normalizedState.providers.openRouterApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY);
  }

  if (normalizedState.providers?.elevenLabsApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY, normalizedState.providers.elevenLabsApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY);
  }

  if (normalizedState.providers?.heygenApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY, normalizedState.providers.heygenApiKey);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY);
  }

  if (normalizedState.routing?.imageModel) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.IMAGE_MODEL, normalizedState.routing.imageModel);
  }

  if (normalizedState.routing?.audioModel) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL, normalizedState.routing.audioModel);
  }

  if (normalizedState.routing?.ttsProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.TTS_PROVIDER, normalizedState.routing.ttsProvider);
  }
  if (normalizedState.routing?.qwenVoicePreset) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.QWEN_VOICE_PRESET, normalizedState.routing.qwenVoicePreset);
  }
  if (normalizedState.routing?.heygenVoiceId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.HEYGEN_VOICE_ID, normalizedState.routing.heygenVoiceId);
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.HEYGEN_VOICE_ID);
  }
  if (normalizedState.routing?.qwenStylePreset) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.QWEN_STYLE_PRESET, normalizedState.routing.qwenStylePreset);
  }
  if (normalizedState.routing?.backgroundMusicProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BGM_PROVIDER, normalizedState.routing.backgroundMusicProvider);
  }
  if (normalizedState.routing?.backgroundMusicStyle) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BGM_STYLE, normalizedState.routing.backgroundMusicStyle);
  }
  if (normalizedState.routing?.musicVideoProvider) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MUSIC_VIDEO_PROVIDER, normalizedState.routing.musicVideoProvider);
  }
  if (normalizedState.routing?.musicVideoMode) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MUSIC_VIDEO_MODE, normalizedState.routing.musicVideoMode);
  }

  if (normalizedState.selectedCharacterId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_CHARACTER_ID, normalizedState.selectedCharacterId);
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
    lastContentType: normalizeContentType(partial.lastContentType || base.lastContentType || 'story'),
  };

  if (Object.prototype.hasOwnProperty.call(partial, 'workflowDraft')) {
    payload.workflowDraft = compactWorkflowDraftForStorage(normalizeWorkflowDraftContentType(partial.workflowDraft as any)) ?? null;
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
  const hasConfiguredExternalStorage = Boolean(cachedDir.trim() || cachedState?.isStorageConfigured);

  if (!canUseServerStudioPersistence()) {
    return cachedState || createDefaultStudioState();
  }

  if (!options?.force && cachedState && (cachedState.storageDir || '') === cachedDir) {
    return cachedState;
  }

  if (!hasConfiguredExternalStorage) {
    return cachedState || createDefaultStudioState();
  }

  try {
    const query = cachedDir ? `?storageDir=${encodeURIComponent(cachedDir)}` : '';
    const state = normalizeStudioStateContentTypes(await requestJson<StudioState>(`/api/local-storage/state${query}`));
    syncStudioStateToLocalCache(state);
    return state;
  } catch {
    if (cachedState) return cachedState;
    return createDefaultStudioState();
  }
}

export async function fetchStudioProjects(options?: { storageDir?: string }): Promise<SavedProject[]> {
  if (!canUseServerStudioPersistence()) {
    const cachedProjects = getCachedStudioState()?.projects;
    return Array.isArray(cachedProjects) ? cachedProjects.map(summarizeProjectForIndex) : [];
  }

  const storageDir = options?.storageDir || getCachedStorageDir();
  if (!storageDir.trim()) {
    const cachedProjects = getCachedStudioState()?.projects;
    return Array.isArray(cachedProjects) ? cachedProjects.map(summarizeProjectForIndex) : [];
  }
  const query = new URLSearchParams();
  if (storageDir) query.set('storageDir', storageDir);
  query.set('includeProjects', '1');
  const state = normalizeStudioStateContentTypes(await requestJson<StudioState>(`/api/local-storage/state?${query.toString()}`));
  return Array.isArray(state.projects) ? state.projects.map(summarizeProjectForIndex) : [];
}

export async function fetchStudioProjectById(projectId: string, options?: { storageDir?: string }): Promise<SavedProject | null> {
  if (!canUseServerStudioPersistence()) {
    const cachedProjects = getCachedStudioState()?.projects;
    const cachedProject = Array.isArray(cachedProjects)
      ? cachedProjects.find((project) => project.id === projectId)
      : null;
    return cachedProject ? normalizeProjectContentTypes(cachedProject) : null;
  }

  const storageDir = options?.storageDir || getCachedStorageDir();
  if (!storageDir.trim()) return null;
  const query = new URLSearchParams();
  if (storageDir) query.set('storageDir', storageDir);
  query.set('projectId', projectId);

  try {
    return normalizeProjectContentTypes(await requestJson<SavedProject>(`/api/local-storage/project?${query.toString()}`));
  } catch {
    return null;
  }
}

export async function saveStudioProject(project: SavedProject, options?: { storageDir?: string }): Promise<SavedProject> {
  if (!canUseServerStudioPersistence()) {
    return normalizeProjectContentTypes(project);
  }

  const storageDir = options?.storageDir || getCachedStorageDir();
  if (!storageDir.trim()) return normalizeProjectContentTypes(project);
  const response = await requestJson<{ project?: SavedProject }>('/api/local-storage/project', {
    method: 'POST',
    body: JSON.stringify({ storageDir, project: normalizeProjectContentTypes(project) }),
  });
  return normalizeProjectContentTypes(response?.project || project);
}

export async function deleteStudioProjects(projectIds: string[], options?: { storageDir?: string }): Promise<void> {
  if (!canUseServerStudioPersistence()) return;

  const storageDir = options?.storageDir || getCachedStorageDir();
  if (!storageDir.trim()) return;
  await requestJson('/api/local-storage/project', {
    method: 'DELETE',
    body: JSON.stringify({ storageDir, projectIds }),
  });
}

export async function configureStorage(storageDir: string): Promise<StudioState> {
  if (!canUseServerStudioPersistence()) {
    const cachedState = getCachedStudioState() || createDefaultStudioState();
    const nextState = normalizeStudioStateContentTypes({
      ...cachedState,
      storageDir: '',
      isStorageConfigured: false,
      updatedAt: Date.now(),
    });
    syncStudioStateToLocalCache(nextState);
    return nextState;
  }

  const state = normalizeStudioStateContentTypes(await requestJson<StudioState>('/api/local-storage/config', {
    method: 'POST',
    body: JSON.stringify({ storageDir }),
  }));
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

  const normalizedOptimisticState = normalizeStudioStateContentTypes(buildOptimisticState());

  if (!canUseServerStudioPersistence()) {
    syncStudioStateToLocalCache(normalizedOptimisticState);
    return normalizedOptimisticState;
  }

  if (!normalizedOptimisticState.isStorageConfigured || !normalizedOptimisticState.storageDir?.trim()) {
    syncStudioStateToLocalCache(normalizedOptimisticState);
    return normalizedOptimisticState;
  }

  if (shouldBypassStudioStateSaveRequest()) {
    syncStudioStateToLocalCache(normalizedOptimisticState);
    return normalizedOptimisticState;
  }

  try {
    const state = await requestJson<StudioState>('/api/local-storage/state', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const nextMemoryState = normalizeStudioStateContentTypes(cachedState
      ? {
          ...cachedState,
          ...payload,
          ...state,
          projects: Array.isArray(state.projects) ? state.projects : (Array.isArray(partial.projects) ? partial.projects.map(summarizeProjectForIndex) : (cachedState.projects || [])),
          projectIndex: Array.isArray((state as any).projectIndex) ? (state as any).projectIndex : (Array.isArray((payload as any).projectIndex) ? (payload as any).projectIndex : ((cachedState as any)?.projectIndex || [])),
        }
      : state);

    markStudioStateSaveSuccess();
    syncStudioStateToLocalCache(nextMemoryState as StudioState);
    return nextMemoryState as StudioState;
  } catch (error) {
    markStudioStateSaveFailure();
    syncStudioStateToLocalCache(normalizedOptimisticState);
    console.warn('[mp4Creater] saveStudioState failed, keeping local cache only', error);
    return normalizedOptimisticState;
  }
}

export async function saveProjectsToStudio(projects: SavedProject[]): Promise<StudioState> {
  const cachedState = getCachedStudioState() || createDefaultStudioState();
  if (!canUseServerStudioPersistence()) {
    return saveStudioState({
      ...cachedState,
      projects: projects.map(summarizeProjectForIndex),
      projectIndex: projects.map(summarizeProjectForIndex),
      updatedAt: Date.now(),
    });
  }
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
