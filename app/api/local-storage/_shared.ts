import { promises as fs } from 'fs';
import path from 'path';

export type StudioState = {
  version: number;
  storageDir: string;
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
  }>;
  routing: {
    scriptModel: string;
    sceneModel: string;
    imagePromptModel: string;
    motionPromptModel: string;
    imageProvider: string;
    imageModel: string;
    audioProvider: string;
    audioModel: string;
    videoProvider: string;
    videoModel: string;
  };
  providers: {
    openRouterApiKey?: string;
    elevenLabsApiKey?: string;
    falApiKey?: string;
  };
  projects: any[];
};

export const DEFAULT_STORAGE_DIR = './local-data/tubegen-studio';
export const createDefaultState = (storageDir = DEFAULT_STORAGE_DIR): StudioState => ({
  version: 1,
  storageDir,
  configuredAt: Date.now(),
  updatedAt: Date.now(),
  selectedCharacterId: null,
  characters: [],
  routing: {
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
  },
  providers: {},
  projects: [],
});

export const resolveStorageDir = (input?: string) => {
  const value = input?.trim() || DEFAULT_STORAGE_DIR;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
};

export const stateFilePath = (storageDir: string) => path.join(resolveStorageDir(storageDir), 'studio-state.json');

export async function ensureState(storageDir?: string): Promise<StudioState> {
  const dir = resolveStorageDir(storageDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = stateFilePath(storageDir || DEFAULT_STORAGE_DIR);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as StudioState;
  } catch {
    const initial = createDefaultState(storageDir);
    await fs.writeFile(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

export async function writeState(state: StudioState): Promise<StudioState> {
  const filePath = stateFilePath(state.storageDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = {
    ...state,
    updatedAt: Date.now(),
  };
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}
