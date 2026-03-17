import { CONFIG } from '../config';
import { SavedProject, StudioState, CharacterProfile, AiRoutingSettings } from '../types';

export const DEFAULT_STORAGE_DIR = './local-data/tubegen-studio';

export const DEFAULT_ROUTING: AiRoutingSettings = {
  scriptModel: 'openrouter/auto',
  sceneModel: 'openrouter/auto',
  imagePromptModel: 'openrouter/auto',
  motionPromptModel: 'openrouter/auto',
  imageProvider: 'gemini',
  imageModel: 'gemini-2.5-flash-image',
  audioProvider: 'elevenlabs',
  audioModel: 'eleven_multilingual_v2',
  videoProvider: 'fal',
  videoModel: 'pixverse/v5.5',
};

export const createDefaultCharacter = (): CharacterProfile => ({
  id: `char_${Date.now()}`,
  name: '기본 캐릭터',
  description: '브랜드의 대표 화자. 친근하지만 과장되지 않게 설명한다.',
  visualStyle: '심플한 2D 일러스트, 또렷한 실루엣, 따뜻한 톤',
  voiceHint: '차분하고 선명한 설명형 톤',
  createdAt: Date.now(),
});

export const createDefaultStudioState = (): StudioState => ({
  version: 1,
  storageDir: DEFAULT_STORAGE_DIR,
  configuredAt: Date.now(),
  updatedAt: Date.now(),
  selectedCharacterId: null,
  characters: [],
  routing: { ...DEFAULT_ROUTING },
  providers: {},
  projects: [],
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

export async function fetchStudioState(): Promise<StudioState> {
  try {
    const state = await requestJson<StudioState>('/api/local-storage/state');
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(state));
    return state;
  } catch (error) {
    const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE);
    if (cached) return JSON.parse(cached) as StudioState;
    return createDefaultStudioState();
  }
}

export async function configureStorage(storageDir: string): Promise<StudioState> {
  const state = await requestJson<StudioState>('/api/local-storage/config', {
    method: 'POST',
    body: JSON.stringify({ storageDir }),
  });
  localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(state));
  localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STORAGE_DIR, state.storageDir);
  return state;
}

export async function saveStudioState(partial: Partial<StudioState>): Promise<StudioState> {
  const state = await requestJson<StudioState>('/api/local-storage/state', {
    method: 'POST',
    body: JSON.stringify(partial),
  });
  localStorage.setItem(CONFIG.STORAGE_KEYS.STUDIO_STATE_CACHE, JSON.stringify(state));
  if (state.providers?.openRouterApiKey) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY, state.providers.openRouterApiKey);
  }
  if (state.selectedCharacterId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_CHARACTER_ID, state.selectedCharacterId);
  }
  return state;
}

export async function saveProjectsToStudio(projects: SavedProject[]): Promise<StudioState> {
  return saveStudioState({ projects, updatedAt: Date.now() });
}

export async function importStudioState(file: File): Promise<StudioState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return saveStudioState(parsed);
}
