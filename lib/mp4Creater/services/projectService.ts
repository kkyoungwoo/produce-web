/**
 * 프로젝트 저장/로드 서비스
 * - 기본은 브라우저 IndexedDB 백업
 * - 가능하면 Next API를 통해 로컬 JSON 파일에도 동기화
 */

import { CONFIG } from '../config';
import { SavedProject, GeneratedAsset, CostBreakdown, BackgroundMusicTrack, PreviewMixSettings, WorkflowDraft } from '../types';
import { getSelectedImageModel } from './imageService';
import { fetchStudioProjects, saveProjectsToStudio } from './localFileApi';

const DB_NAME = 'TubeGenAI';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function createThumbnail(imageSource: string, maxWidth: number = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageSource.slice(0, 1000));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
    img.onerror = () => resolve('');
    img.src = imageSource.startsWith('data:') || imageSource.startsWith('/') || imageSource.startsWith('http')
      ? imageSource
      : `data:image/png;base64,${imageSource}`;
  });
}


function normalizeAssetHistory(items: any, kind: 'image' | 'video') {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.data === 'string' && item.data)
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `${kind}_${Date.now()}_${index}`,
      kind,
      data: item.data,
      sourceMode: item.sourceMode === 'ai' ? ('ai' as const) : ('sample' as const),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      label: typeof item.label === 'string' ? item.label : undefined,
    }));
}

function normalizeAsset(asset: any, index: number): GeneratedAsset {
  return {
    sceneNumber: typeof asset?.sceneNumber === 'number' ? asset.sceneNumber : index + 1,
    narration: typeof asset?.narration === 'string' ? asset.narration : '',
    visualPrompt: typeof asset?.visualPrompt === 'string' ? asset.visualPrompt : '',
    analysis: asset?.analysis,
    imageData: typeof asset?.imageData === 'string' ? asset.imageData : null,
    audioData: typeof asset?.audioData === 'string' ? asset.audioData : null,
    audioDuration: typeof asset?.audioDuration === 'number' ? asset.audioDuration : null,
    subtitleData: asset?.subtitleData ?? null,
    videoData: typeof asset?.videoData === 'string' ? asset.videoData : null,
    videoDuration: typeof asset?.videoDuration === 'number' ? asset.videoDuration : null,
    targetDuration: typeof asset?.targetDuration === 'number' ? asset.targetDuration : (typeof asset?.audioDuration === 'number' ? asset.audioDuration : 5),
    aspectRatio: asset?.aspectRatio === '1:1' || asset?.aspectRatio === '9:16' ? asset.aspectRatio : '16:9',
    imageHistory: normalizeAssetHistory(asset?.imageHistory, 'image'),
    videoHistory: normalizeAssetHistory(asset?.videoHistory, 'video'),
    status: asset?.status === 'generating' || asset?.status === 'completed' || asset?.status === 'error' ? asset.status : 'pending',
    sourceMode: asset?.sourceMode === 'ai' ? 'ai' : 'sample',
  };
}

function normalizePreviewMix(mix: any): PreviewMixSettings | undefined {
  if (!mix || typeof mix !== 'object') return undefined;
  return {
    narrationVolume: typeof mix.narrationVolume === 'number' ? mix.narrationVolume : 1,
    backgroundMusicVolume: typeof mix.backgroundMusicVolume === 'number' ? mix.backgroundMusicVolume : 0.28,
  };
}

function normalizeTrack(track: any, index: number): BackgroundMusicTrack {
  return {
    id: typeof track?.id === 'string' ? track.id : `bgm_${Date.now()}_${index}`,
    title: typeof track?.title === 'string' ? track.title : `배경음 ${index + 1}`,
    prompt: typeof track?.prompt === 'string' ? track.prompt : '',
    audioData: typeof track?.audioData === 'string' ? track.audioData : null,
    duration: typeof track?.duration === 'number' ? track.duration : null,
    volume: typeof track?.volume === 'number' ? track.volume : 0.28,
    sourceMode: track?.sourceMode === 'ai' ? 'ai' : 'sample',
    createdAt: typeof track?.createdAt === 'number' ? track.createdAt : Date.now(),
  };
}

function normalizePromptedImages(items: any, kind: 'character' | 'style' | 'thumbnail') {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.imageData === 'string' && item.imageData)
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `${kind}_${Date.now()}_${index}`,
      label: typeof item.label === 'string' ? item.label : `${kind} ${index + 1}`,
      prompt: typeof item.prompt === 'string' ? item.prompt : '',
      imageData: item.imageData,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      kind,
      sourceMode: item.sourceMode === 'ai' ? 'ai' : item.sourceMode === 'upload' ? 'upload' : 'sample',
      selected: Boolean(item.selected),
      note: typeof item.note === 'string' ? item.note : undefined,
      groupId: typeof item.groupId === 'string' ? item.groupId : undefined,
      groupLabel: typeof item.groupLabel === 'string' ? item.groupLabel : undefined,
    }));
}

function normalizeProject(raw: any): SavedProject {
  const topic = typeof raw?.topic === 'string' ? raw.topic : (typeof raw?.name === 'string' ? raw.name : 'Untitled Project');
  const assets = Array.isArray(raw?.assets) ? raw.assets.map(normalizeAsset) : [];
  const rawSettings = raw?.settings ?? raw ?? {};

  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: typeof raw?.name === 'string' && raw.name ? raw.name : `${topic.slice(0, 30)}${topic.length > 30 ? '...' : ''}`,
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now(),
    topic,
    projectNumber: typeof raw?.projectNumber === 'number' ? raw.projectNumber : undefined,
    folderName: typeof raw?.folderName === 'string' ? raw.folderName : undefined,
    folderPath: typeof raw?.folderPath === 'string' ? raw.folderPath : undefined,
    lastSavedAt: typeof raw?.lastSavedAt === 'number' ? raw.lastSavedAt : (typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now()),
    settings: {
      imageModel: typeof rawSettings?.imageModel === 'string' && rawSettings.imageModel
        ? rawSettings.imageModel
        : CONFIG.DEFAULT_IMAGE_MODEL,
      outputMode: rawSettings?.outputMode === 'image' ? 'image' : 'video',
      elevenLabsModel: typeof rawSettings?.elevenLabsModel === 'string' && rawSettings.elevenLabsModel
        ? rawSettings.elevenLabsModel
        : CONFIG.DEFAULT_ELEVENLABS_MODEL,
      fluxStyle: typeof rawSettings?.fluxStyle === 'string' ? rawSettings.fluxStyle : undefined,
    },
    assets,
    thumbnail: typeof raw?.thumbnail === 'string' ? raw.thumbnail : null,
    thumbnailTitle: typeof raw?.thumbnailTitle === 'string' ? raw.thumbnailTitle : null,
    thumbnailPrompt: typeof raw?.thumbnailPrompt === 'string' ? raw.thumbnailPrompt : null,
    thumbnailHistory: normalizePromptedImages(raw?.thumbnailHistory, 'thumbnail'),
    selectedThumbnailId: typeof raw?.selectedThumbnailId === 'string' ? raw.selectedThumbnailId : null,
    cost: raw?.cost && typeof raw.cost === 'object' ? {
      images: typeof raw.cost.images === 'number' ? raw.cost.images : 0,
      tts: typeof raw.cost.tts === 'number' ? raw.cost.tts : 0,
      videos: typeof raw.cost.videos === 'number' ? raw.cost.videos : 0,
      total: typeof raw.cost.total === 'number' ? raw.cost.total : 0,
      imageCount: typeof raw.cost.imageCount === 'number' ? raw.cost.imageCount : assets.filter((a: any) => a.imageData).length,
      ttsCharacters: typeof raw.cost.ttsCharacters === 'number' ? raw.cost.ttsCharacters : 0,
      videoCount: typeof raw.cost.videoCount === 'number' ? raw.cost.videoCount : assets.filter((a: any) => a.videoData).length,
    } : undefined,
    backgroundMusicTracks: Array.isArray(raw?.backgroundMusicTracks) ? raw.backgroundMusicTracks.map(normalizeTrack) : [],
    previewMix: normalizePreviewMix(raw?.previewMix),
    workflowDraft: raw?.workflowDraft ?? null,
  };
}

function getCurrentSettings() {
  const elevenLabsModel = localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL) || CONFIG.DEFAULT_ELEVENLABS_MODEL;
  return {
    imageModel: getSelectedImageModel(),
    outputMode: 'video' as const,
    elevenLabsModel
  };
}

async function syncProjectsAcrossStorage(projects: SavedProject[]): Promise<void> {
  await writeIndexedProjects(projects);
  try {
    await saveProjectsToStudio(projects);
  } catch (error) {
    console.warn('[Project] 로컬 파일 동기화 실패. IndexedDB 백업 유지.', error);
    throw error;
  }
}

async function readIndexedProjects(): Promise<SavedProject[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as SavedProject[]).map(normalizeProject));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

async function writeIndexedProjects(projects: SavedProject[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    projects.forEach((project) => store.put(project));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveProject(
  topic: string,
  assets: GeneratedAsset[],
  customName?: string,
  cost?: CostBreakdown,
  extras?: {
    backgroundMusicTracks?: BackgroundMusicTrack[];
    previewMix?: PreviewMixSettings;
    workflowDraft?: WorkflowDraft | null;
    outputMode?: 'video' | 'image';
  }
): Promise<SavedProject> {
  const id = `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  let thumbnail: string | null = null;
  const firstImageAsset = assets.find(a => a.imageData);
  if (firstImageAsset?.imageData) {
    thumbnail = await createThumbnail(firstImageAsset.imageData);
  }

  const project: SavedProject = {
    id,
    name: customName || `${topic.slice(0, 30)}${topic.length > 30 ? '...' : ''}`,
    createdAt: now,
    topic,
    settings: {
      ...getCurrentSettings(),
      outputMode: extras?.outputMode || extras?.workflowDraft?.outputMode || 'video',
    },
    lastSavedAt: now,
    assets: assets.map(asset => ({ ...asset })),
    thumbnail,
    thumbnailTitle: null,
    thumbnailPrompt: null,
    thumbnailHistory: [],
    selectedThumbnailId: null,
    cost,
    backgroundMusicTracks: extras?.backgroundMusicTracks || [],
    previewMix: extras?.previewMix,
    workflowDraft: extras?.workflowDraft || null,
  };

  const current = await readIndexedProjects();
  const next = [project, ...current].sort((a, b) => b.createdAt - a.createdAt);
  await syncProjectsAcrossStorage(next);

  return project;
}


export async function upsertWorkflowProject(options: {
  projectId?: string | null;
  topic: string;
  workflowDraft: WorkflowDraft;
  assets?: GeneratedAsset[];
  cost?: CostBreakdown;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
}): Promise<SavedProject> {
  const safeTopic = options.topic?.trim() || '새 프로젝트';
  const patch = {
    name: `${safeTopic.slice(0, 30)}${safeTopic.length > 30 ? '...' : ''}`,
    topic: safeTopic,
    assets: Array.isArray(options.assets) ? options.assets.map((asset) => ({ ...asset })) : [],
    cost: options.cost,
    backgroundMusicTracks: options.backgroundMusicTracks || [],
    previewMix: options.previewMix,
    workflowDraft: options.workflowDraft,
  } as Partial<SavedProject>;

  if (options.projectId) {
    const updated = await updateProject(options.projectId, patch);
    if (updated) return updated;
  }

  return saveProject(
    safeTopic,
    patch.assets || [],
    patch.name,
    options.cost,
    {
      backgroundMusicTracks: options.backgroundMusicTracks || [],
      previewMix: options.previewMix,
      workflowDraft: options.workflowDraft,
      outputMode: options.workflowDraft?.outputMode || 'video',
    }
  );
}

export async function updateProject(
  id: string,
  patch: Partial<SavedProject>
): Promise<SavedProject | null> {
  const current = await getSavedProjects();
  const target = current.find((project) => project.id === id);
  if (!target) return null;

  let thumbnail = typeof patch.thumbnail === 'string' ? patch.thumbnail : target.thumbnail;
  const nextAssets = Array.isArray(patch.assets) ? patch.assets : target.assets;
  const firstImageAsset = nextAssets.find((asset) => asset.imageData);
  if (typeof patch.thumbnail !== 'string' && firstImageAsset?.imageData) {
    thumbnail = await createThumbnail(firstImageAsset.imageData);
  }

  const nextProject: SavedProject = normalizeProject({
    ...target,
    ...patch,
    id,
    lastSavedAt: Date.now(),
    settings: {
      ...target.settings,
      ...(patch.settings || {}),
    },
    assets: nextAssets,
    thumbnail,
  });

  const next = current
    .map((project) => (project.id === id ? nextProject : project))
    .sort((a, b) => b.createdAt - a.createdAt);

  await syncProjectsAcrossStorage(next);
  return nextProject;
}


export async function getSavedProjects(options?: { forceSync?: boolean }): Promise<SavedProject[]> {
  const indexed = await readIndexedProjects();
  if (indexed.length && !options?.forceSync) {
    return indexed.sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const projects = (await fetchStudioProjects()).map(normalizeProject).sort((a, b) => b.createdAt - a.createdAt);
    if (projects.length) {
      await writeIndexedProjects(projects);
      return projects;
    }
  } catch {}

  return indexed.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProjectById(id: string, options?: { forceSync?: boolean }): Promise<SavedProject | null> {
  const projects = await getSavedProjects(options);
  const found = projects.find((project) => project.id === id);
  if (found) return found;
  if (!options?.forceSync) {
    const refreshed = await getSavedProjects({ forceSync: true });
    return refreshed.find((project) => project.id === id) || null;
  }
  return null;
}


export async function deleteProject(id: string): Promise<boolean> {
  const current = await getSavedProjects();
  const next = current.filter((project) => project.id !== id);
  await syncProjectsAcrossStorage(next);
  return true;
}

export async function renameProject(id: string, newName: string): Promise<boolean> {
  const current = await getSavedProjects();
  const next = current.map((project) => project.id === id ? { ...project, name: newName } : project);
  await syncProjectsAcrossStorage(next);
  return true;
}

export async function migrateFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.PROJECTS);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const normalized = parsed.map(normalizeProject);
    await syncProjectsAcrossStorage(normalized);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.PROJECTS);
  } catch (error) {
    console.error('[Project] 로컬스토리지 마이그레이션 실패:', error);
  }
}
