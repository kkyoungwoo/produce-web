import { promises as fs } from 'fs';
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
  };
  projects: any[];
  projectIndex?: Array<{
    id: string;
    name: string;
    topic: string;
    createdAt: number;
    lastSavedAt?: number;
    projectNumber: number;
    folderName: string;
    folderPath: string;
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
const PROJECT_FILENAME = 'project.json';
const PROJECT_STRUCTURE_DIRS = ['images', 'videos', 'audio', 'thumbnails', 'characters', 'styles', 'prompts', 'metadata'];

export const createDefaultState = (storageDir = '', options?: { configured?: boolean }): StudioState => ({
  version: 5,
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
  const safeValue = value || DEFAULT_STORAGE_DIR;
  return path.isAbsolute(safeValue) ? safeValue : path.join(process.cwd(), safeValue);
};

export const stateFilePath = (storageDir: string) => path.join(resolveStorageDir(storageDir), STUDIO_STATE_FILENAME);
const projectsRootPath = (storageDir: string) => path.join(resolveStorageDir(storageDir), PROJECTS_DIRNAME);

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

function slugify(value: string) {
  const cleaned = (value || 'project')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return cleaned || 'project';
}

function padProjectNumber(projectNumber: number) {
  return String(Math.max(1, Math.floor(projectNumber || 1))).padStart(4, '0');
}

function sanitizeFolderName(value: string, fallback: string) {
  const cleaned = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 96);
  return cleaned || fallback;
}

function parseDataPayload(value: string, fallbackMime: string) {
  if (!value) return null;

  if (value.startsWith('data:')) {
    const match = value.match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (!match) return null;
    return {
      mime: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }

  return {
    mime: fallbackMime,
    buffer: Buffer.from(value, 'base64'),
  };
}

function extensionFromMime(mime: string, fallback: string) {
  if (!mime) return fallback;
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('json')) return 'json';
  return fallback;
}

const RETRYABLE_FS_CODES = new Set(['UNKNOWN', 'EPERM', 'EBUSY', 'EIO', 'ENOENT']);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeFileWithRetry(filePath: string, data: string | Buffer, encoding?: BufferEncoding, attempts = 5) {
  let lastError: any;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      if (encoding) {
        await fs.writeFile(filePath, data as string, encoding);
      } else {
        await fs.writeFile(filePath, data as Buffer);
      }
      return;
    } catch (error: any) {
      lastError = error;
      if (!RETRYABLE_FS_CODES.has(error?.code) || attempt === attempts - 1) break;
      await wait(120 * (attempt + 1));
    }
  }
  throw lastError;
}

async function writeDataAssetIfPresent(value: string | null | undefined, basePathNoExt: string, fallbackMime: string, fallbackExt: string) {
  if (!value) return null;
  const payload = parseDataPayload(value, fallbackMime);
  if (!payload) return null;
  const ext = extensionFromMime(payload.mime, fallbackExt);
  const filePath = `${basePathNoExt}.${ext}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await writeFileWithRetry(filePath, payload.buffer);
  return filePath;
}

async function writeTextIfPresent(filePath: string, value: string | null | undefined) {
  if (!value?.trim()) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await writeFileWithRetry(filePath, value, 'utf-8');
}

async function loadProjectsFromFolders(storageDir: string): Promise<any[]> {
  const root = projectsRootPath(storageDir);
  if (!(await pathExists(root))) return [];

  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects: any[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(root, entry.name, PROJECT_FILENAME);
    if (!(await pathExists(filePath))) continue;
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = safeJsonParse<any | null>(raw, null);
      if (parsed?.id) projects.push(parsed);
    } catch {
      // skip broken project file
    }
  }

  return projects.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
}

async function readExistingProjectIndex(storageDir: string) {
  const map = new Map<string, { projectNumber: number; folderName: string }>();
  const statePath = stateFilePath(storageDir);

  if (await pathExists(statePath)) {
    try {
      const raw = await fs.readFile(statePath, 'utf-8');
      const parsed = safeJsonParse<StudioState | null>(raw, null);
      for (const item of parsed?.projectIndex || []) {
        if (item?.id && item?.projectNumber && item?.folderName) {
          map.set(item.id, {
            projectNumber: item.projectNumber,
            folderName: item.folderName,
          });
        }
      }
      for (const item of parsed?.projects || []) {
        if (item?.id && item?.projectNumber && item?.folderName && !map.has(item.id)) {
          map.set(item.id, {
            projectNumber: item.projectNumber,
            folderName: item.folderName,
          });
        }
      }
    } catch {
      // ignore malformed index
    }
  }

  const folderProjects = await loadProjectsFromFolders(storageDir);
  for (const item of folderProjects) {
    if (item?.id && item?.projectNumber && item?.folderName && !map.has(item.id)) {
      map.set(item.id, {
        projectNumber: item.projectNumber,
        folderName: item.folderName,
      });
    }
  }

  return map;
}



function summarizeProjectForState(project: any) {
  const assets = Array.isArray(project?.assets) ? project.assets : [];
  const summary = project?.summary || {};
  return {
    id: project?.id,
    name: project?.name,
    topic: project?.topic,
    createdAt: project?.createdAt,
    lastSavedAt: project?.lastSavedAt || project?.createdAt,
    projectNumber: project?.projectNumber || 0,
    folderName: project?.folderName || '',
    folderPath: project?.folderPath || '',
    thumbnail: typeof project?.thumbnail === 'string' ? project.thumbnail : null,
    thumbnailTitle: typeof project?.thumbnailTitle === 'string' ? project.thumbnailTitle : null,
    selectedThumbnailId: typeof project?.selectedThumbnailId === 'string' ? project.selectedThumbnailId : null,
    assetCount: typeof summary.assetCount === 'number' ? summary.assetCount : assets.length,
    imageCount: typeof summary.imageCount === 'number' ? summary.imageCount : assets.filter((item: any) => item?.imageData).length,
    videoCount: typeof summary.videoCount === 'number' ? summary.videoCount : assets.filter((item: any) => item?.videoData).length,
    audioCount: typeof summary.audioCount === 'number' ? summary.audioCount : assets.filter((item: any) => item?.audioData).length,
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

export function serializeStateForClient(state: StudioState, options?: { includeProjects?: boolean }): StudioState {
  if (options?.includeProjects) return state;
  return {
    ...state,
    projects: Array.isArray(state?.projects) ? state.projects.map(summarizeProjectForState) : [],
  };
}

function normalizeProjectFolders(projects: any[], storageDir: string, existingIndex: Map<string, { projectNumber: number; folderName: string }>) {
  const usedNumbers = new Set<number>();

  for (const entry of existingIndex.values()) {
    if (entry.projectNumber) usedNumbers.add(entry.projectNumber);
  }

  const normalized = projects.map((project, index) => {
    const existing = project?.id ? existingIndex.get(project.id) : undefined;
    let projectNumber = Number(project?.projectNumber || existing?.projectNumber || 0);
    if (!projectNumber || usedNumbers.has(projectNumber) && existing?.projectNumber !== projectNumber) {
      projectNumber = 1;
      while (usedNumbers.has(projectNumber)) projectNumber += 1;
    }
    usedNumbers.add(projectNumber);

    const baseName = project?.name || project?.topic || `project-${index + 1}`;
    const rawFolderName = typeof project?.folderName === 'string' && project.folderName
      ? project.folderName
      : existing?.folderName || `project-${padProjectNumber(projectNumber)}-${slugify(baseName)}`;
    const folderName = sanitizeFolderName(rawFolderName, `project-${padProjectNumber(projectNumber)}-${slugify(baseName)}`);

    return {
      ...project,
      projectNumber,
      folderName,
      folderPath: path.join(storageDir, PROJECTS_DIRNAME, folderName).replace(/\\/g, '/'),
      lastSavedAt: Date.now(),
    };
  });

  return normalized.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
}

async function persistProjectFolder(storageDir: string, project: any) {
  const fallbackFolderName = `project-${padProjectNumber(project.projectNumber || 1)}-${slugify(project.name || project.topic || project.id || 'project')}`;
  const folderName = sanitizeFolderName(project.folderName || fallbackFolderName, fallbackFolderName);
  const root = path.join(projectsRootPath(storageDir), folderName);

  await fs.mkdir(root, { recursive: true });
  await Promise.all(PROJECT_STRUCTURE_DIRS.map((dir) => fs.mkdir(path.join(root, dir), { recursive: true })));

  const thumbnailPath = await writeDataAssetIfPresent(project.thumbnail, path.join(root, 'thumbnails', 'thumbnail-main'), 'image/jpeg', 'jpg');
  await writeTextIfPresent(path.join(root, 'prompts', 'thumbnail-prompt.txt'), project.thumbnailPrompt || '');
  await writeTextIfPresent(path.join(root, 'prompts', 'topic.txt'), project.topic || project.name || '');

  const thumbnailHistory = Array.isArray(project.thumbnailHistory) ? project.thumbnailHistory : [];
  for (let index = 0; index < thumbnailHistory.length; index += 1) {
    const item = thumbnailHistory[index];
    await writeDataAssetIfPresent(item?.imageData, path.join(root, 'thumbnails', `thumbnail-history-${String(index + 1).padStart(3, '0')}`), 'image/jpeg', 'jpg');
  }

  const workflowDraft = project.workflowDraft || null;
  if (workflowDraft) {
    await writeFileWithRetry(path.join(root, 'metadata', 'workflow-draft.json'), JSON.stringify(workflowDraft, null, 2), 'utf-8');
    const pack = workflowDraft.promptPack || {};
    await writeTextIfPresent(path.join(root, 'prompts', 'story-prompt.txt'), pack.storyPrompt || '');
    await writeTextIfPresent(path.join(root, 'prompts', 'character-prompt.txt'), pack.characterPrompt || '');
    await writeTextIfPresent(path.join(root, 'prompts', 'scene-prompt.txt'), pack.scenePrompt || '');
    await writeTextIfPresent(path.join(root, 'prompts', 'action-prompt.txt'), pack.actionPrompt || '');
    await writeTextIfPresent(path.join(root, 'prompts', 'lyrics-prompt.txt'), pack.lyricsPrompt || '');
    await writeTextIfPresent(path.join(root, 'prompts', 'persuasion-story-prompt.txt'), pack.persuasionStoryPrompt || '');

    const styleImages = Array.isArray(workflowDraft.styleImages) ? workflowDraft.styleImages : [];
    for (let index = 0; index < styleImages.length; index += 1) {
      const item = styleImages[index];
      await writeDataAssetIfPresent(item?.imageData, path.join(root, 'styles', `style-${String(index + 1).padStart(3, '0')}`), 'image/png', 'png');
      await writeTextIfPresent(path.join(root, 'prompts', `style-${String(index + 1).padStart(3, '0')}.txt`), item?.prompt || '');
    }

    const extractedCharacters = Array.isArray(workflowDraft.extractedCharacters) ? workflowDraft.extractedCharacters : [];
    for (let index = 0; index < extractedCharacters.length; index += 1) {
      const character = extractedCharacters[index];
      await writeTextIfPresent(path.join(root, 'prompts', `character-${String(index + 1).padStart(3, '0')}.txt`), character?.prompt || character?.description || '');
      await writeDataAssetIfPresent(character?.imageData, path.join(root, 'characters', `character-main-${String(index + 1).padStart(3, '0')}`), 'image/png', 'png');
      const generatedImages = Array.isArray(character?.generatedImages) ? character.generatedImages : [];
      for (let variantIndex = 0; variantIndex < generatedImages.length; variantIndex += 1) {
        const variant = generatedImages[variantIndex];
        await writeDataAssetIfPresent(variant?.imageData, path.join(root, 'characters', `character-${String(index + 1).padStart(3, '0')}-variant-${String(variantIndex + 1).padStart(3, '0')}`), 'image/png', 'png');
      }
    }
  }

  const assets = Array.isArray(project.assets) ? project.assets : [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const sceneNumber = String(asset?.sceneNumber || index + 1).padStart(3, '0');
    const imagePath = await writeDataAssetIfPresent(asset?.imageData, path.join(root, 'images', `scene-${sceneNumber}-main`), 'image/jpeg', 'jpg');
    const audioPath = await writeDataAssetIfPresent(asset?.audioData, path.join(root, 'audio', `scene-${sceneNumber}-tts`), 'audio/mpeg', 'mp3');
    const videoPath = await writeDataAssetIfPresent(asset?.videoData, path.join(root, 'videos', `scene-${sceneNumber}-main`), 'video/mp4', 'mp4');

    const imageHistory = Array.isArray(asset?.imageHistory) ? asset.imageHistory : [];
    for (let historyIndex = 0; historyIndex < imageHistory.length; historyIndex += 1) {
      const entry = imageHistory[historyIndex];
      await writeDataAssetIfPresent(entry?.data, path.join(root, 'images', `scene-${sceneNumber}-history-${String(historyIndex + 1).padStart(3, '0')}`), 'image/jpeg', 'jpg');
    }

    const videoHistory = Array.isArray(asset?.videoHistory) ? asset.videoHistory : [];
    for (let historyIndex = 0; historyIndex < videoHistory.length; historyIndex += 1) {
      const entry = videoHistory[historyIndex];
      await writeDataAssetIfPresent(entry?.data, path.join(root, 'videos', `scene-${sceneNumber}-history-${String(historyIndex + 1).padStart(3, '0')}`), 'video/mp4', 'mp4');
    }

    const sceneMetadata = {
      sceneNumber: asset?.sceneNumber || index + 1,
      narration: asset?.narration || '',
      visualPrompt: asset?.visualPrompt || '',
      targetDuration: asset?.targetDuration ?? null,
      audioDuration: asset?.audioDuration ?? null,
      videoDuration: asset?.videoDuration ?? null,
      status: asset?.status || 'pending',
      aspectRatio: asset?.aspectRatio || project?.workflowDraft?.aspectRatio || '16:9',
      sourceMode: asset?.sourceMode || 'sample',
      subtitleData: asset?.subtitleData || null,
      analysis: asset?.analysis || null,
      files: {
        imagePath: imagePath ? path.relative(root, imagePath).replace(/\\/g, '/') : null,
        audioPath: audioPath ? path.relative(root, audioPath).replace(/\\/g, '/') : null,
        videoPath: videoPath ? path.relative(root, videoPath).replace(/\\/g, '/') : null,
      },
    };

    await writeFileWithRetry(path.join(root, 'metadata', `scene-${sceneNumber}.json`), JSON.stringify(sceneMetadata, null, 2), 'utf-8');
    await writeTextIfPresent(path.join(root, 'prompts', `scene-${sceneNumber}-narration.txt`), asset?.narration || '');
    await writeTextIfPresent(path.join(root, 'prompts', `scene-${sceneNumber}-visual.txt`), asset?.visualPrompt || '');
  }

  const backgroundMusicTracks = Array.isArray(project.backgroundMusicTracks) ? project.backgroundMusicTracks : [];
  for (let index = 0; index < backgroundMusicTracks.length; index += 1) {
    const track = backgroundMusicTracks[index];
    await writeTextIfPresent(path.join(root, 'prompts', `bgm-${String(index + 1).padStart(3, '0')}.txt`), track?.prompt || '');
    await writeDataAssetIfPresent(track?.audioData, path.join(root, 'audio', `bgm-${String(index + 1).padStart(3, '0')}`), 'audio/mpeg', 'mp3');
  }

  const summary = {
    id: project.id,
    name: project.name,
    topic: project.topic,
    projectNumber: project.projectNumber,
    folderName,
    createdAt: project.createdAt,
    lastSavedAt: project.lastSavedAt,
    assetCount: assets.length,
    imageCount: assets.filter((item: any) => item?.imageData).length,
    videoCount: assets.filter((item: any) => item?.videoData).length,
    audioCount: assets.filter((item: any) => item?.audioData).length,
    thumbnailPath: thumbnailPath ? path.relative(root, thumbnailPath).replace(/\\/g, '/') : null,
  };

  const projectPayload = {
    ...project,
    folderName,
    folderPath: path.join(project.storageDir || storageDir, PROJECTS_DIRNAME, folderName).replace(/\\/g, '/'),
    summary,
  };

  await writeFileWithRetry(path.join(root, PROJECT_FILENAME), JSON.stringify(projectPayload, null, 2), 'utf-8');
  await writeFileWithRetry(path.join(root, 'metadata', 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
}

async function cleanupRemovedProjectFolders(storageDir: string, projects: any[]) {
  const root = projectsRootPath(storageDir);
  if (!(await pathExists(root))) return;
  const keep = new Set(projects.map((item) => item?.folderName).filter(Boolean));
  const entries = await fs.readdir(root, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory()) return;
    if (keep.has(entry.name)) return;
    await fs.rm(path.join(root, entry.name), { recursive: true, force: true });
  }));
}

async function hydrateStateProjects(state: StudioState): Promise<StudioState> {
  if (!state?.isStorageConfigured || !state?.storageDir?.trim()) {
    return {
      ...createDefaultState(state?.storageDir || '', { configured: false }),
      ...state,
      projects: Array.isArray(state?.projects) ? state.projects : [],
      projectIndex: Array.isArray(state?.projectIndex) ? state.projectIndex : [],
    };
  }

  const folderProjects = await loadProjectsFromFolders(state.storageDir);
  const projects = folderProjects.length ? folderProjects : (Array.isArray(state.projects) ? state.projects : []);
  const projectIndex = projects.map((project) => ({
    id: project.id,
    name: project.name,
    topic: project.topic,
    createdAt: project.createdAt,
    lastSavedAt: project.lastSavedAt || project.createdAt,
    projectNumber: project.projectNumber || 0,
    folderName: project.folderName || '',
    folderPath: project.folderPath || '',
  }));

  return {
    ...state,
    projects,
    projectIndex,
  };
}

type WriteStateOptions = {
  previousState?: StudioState | null;
  persistProjects?: boolean;
};

function buildProjectIndex(projects: any[]) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    topic: project.topic,
    createdAt: project.createdAt,
    lastSavedAt: project.lastSavedAt || project.createdAt,
    projectNumber: project.projectNumber || 0,
    folderName: project.folderName || '',
    folderPath: project.folderPath || '',
  }));
}

function shouldPersistProjectFolder(project: any, previousProject?: any | null) {
  if (!project?.id) return false;
  if (!previousProject) return true;
  if (!project?.folderName || !project?.projectNumber) return true;
  return (project.lastSavedAt || project.createdAt || 0) !== (previousProject.lastSavedAt || previousProject.createdAt || 0);
}

async function persistChangedProjectFolders(storageDir: string, projects: any[], previousProjects?: any[]) {
  const previousMap = new Map((previousProjects || []).filter((item) => item?.id).map((item) => [item.id, item] as const));
  for (const project of projects) {
    if (!shouldPersistProjectFolder(project, previousMap.get(project.id))) continue;
    try {
      await persistProjectFolder(storageDir, project);
    } catch (error: any) {
      console.warn('[local-storage] 프로젝트 폴더 저장 재시도 실패. 다음 저장 주기에 다시 동기화합니다.', {
        projectId: project?.id,
        folderName: project?.folderName,
        code: error?.code,
        message: error?.message,
      });
    }
  }
}

export async function readStoredState(storageDir?: string): Promise<StudioState> {
  const explicitStorageDir = storageDir?.trim() || '';
  const effectiveStorageDir = explicitStorageDir || DEFAULT_STORAGE_DIR;
  const filePath = stateFilePath(effectiveStorageDir);
  const stateExists = await pathExists(filePath);

  if (!stateExists) {
    const configured = Boolean(explicitStorageDir) && explicitStorageDir !== DEFAULT_STORAGE_DIR;
    return createDefaultState(configured ? effectiveStorageDir : '', { configured });
  }

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = safeJsonParse<StudioState>(raw, createDefaultState(effectiveStorageDir, { configured: true }));
  return {
    ...createDefaultState(parsed.storageDir || effectiveStorageDir, { configured: parsed.isStorageConfigured ?? true }),
    ...parsed,
    storageDir: parsed.storageDir || effectiveStorageDir,
    isStorageConfigured: parsed.isStorageConfigured ?? true,
  };
}

export async function ensureState(storageDir?: string): Promise<StudioState> {
  const normalized = await readStoredState(storageDir);
  if (!normalized?.isStorageConfigured || !normalized?.storageDir?.trim()) return normalized;
  return hydrateStateProjects(normalized);
}

export async function writeState(state: StudioState, options?: WriteStateOptions): Promise<StudioState> {
  const configured = Boolean(state?.isStorageConfigured) && Boolean(state?.storageDir?.trim());
  const normalizedBase = {
    ...createDefaultState(configured ? state.storageDir : '', { configured }),
    ...state,
    storageDir: configured ? state.storageDir.trim() : '',
    isStorageConfigured: configured,
    updatedAt: Date.now(),
  };

  if (!configured) {
    return {
      ...normalizedBase,
      projects: Array.isArray(state?.projects) ? state.projects : [],
      projectIndex: Array.isArray(state?.projectIndex) ? state.projectIndex : [],
    };
  }

  const filePath = stateFilePath(normalizedBase.storageDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.mkdir(projectsRootPath(normalizedBase.storageDir), { recursive: true });

  const shouldPersistProjects = Boolean(options?.persistProjects);

  if (!shouldPersistProjects) {
    const existingProjects = Array.isArray(normalizedBase.projects) ? normalizedBase.projects : [];
    const nextState = {
      ...normalizedBase,
      projectIndex: buildProjectIndex(existingProjects),
      projects: existingProjects.map(summarizeProjectForState),
    };
    await writeFileWithRetry(filePath, JSON.stringify(nextState, null, 2), 'utf-8');
    return {
      ...normalizedBase,
      projectIndex: nextState.projectIndex,
      projects: existingProjects,
    };
  }

  const existingIndex = await readExistingProjectIndex(normalizedBase.storageDir);
  const normalizedProjects = normalizeProjectFolders(Array.isArray(normalizedBase.projects) ? normalizedBase.projects : [], normalizedBase.storageDir, existingIndex);
  const normalized = {
    ...normalizedBase,
    projects: normalizedProjects,
    projectIndex: buildProjectIndex(normalizedProjects),
  };

  await persistChangedProjectFolders(normalized.storageDir, normalizedProjects, options?.previousState?.projects || []);
  await cleanupRemovedProjectFolders(normalized.storageDir, normalizedProjects);
  const persistedState = {
    ...normalized,
    projects: normalizedProjects.map(summarizeProjectForState),
  };
  await writeFileWithRetry(filePath, JSON.stringify(persistedState, null, 2), 'utf-8');
  return normalized;
}
