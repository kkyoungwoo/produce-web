/**
 * 프로젝트 저장/로드 서비스
 * - 기본은 브라우저 IndexedDB 백업
 * - 가능하면 Next API를 통해 로컬 JSON 파일에도 동기화
 */

import { CONFIG } from '../config';
import { SavedProject, GeneratedAsset, CostBreakdown } from '../types';
import { getSelectedImageModel } from './imageService';
import { fetchStudioState, saveProjectsToStudio } from './localFileApi';

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

function createThumbnail(base64Image: string, maxWidth: number = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image.slice(0, 1000));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
    img.onerror = () => resolve('');
    img.src = `data:image/png;base64,${base64Image}`;
  });
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
    status: asset?.status === 'generating' || asset?.status === 'completed' || asset?.status === 'error' ? asset.status : 'pending',
  };
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
    settings: {
      imageModel: typeof rawSettings?.imageModel === 'string' && rawSettings.imageModel
        ? rawSettings.imageModel
        : CONFIG.DEFAULT_IMAGE_MODEL,
      elevenLabsModel: typeof rawSettings?.elevenLabsModel === 'string' && rawSettings.elevenLabsModel
        ? rawSettings.elevenLabsModel
        : CONFIG.DEFAULT_ELEVENLABS_MODEL,
      fluxStyle: typeof rawSettings?.fluxStyle === 'string' ? rawSettings.fluxStyle : undefined,
    },
    assets,
    thumbnail: typeof raw?.thumbnail === 'string' ? raw.thumbnail : null,
    cost: raw?.cost && typeof raw.cost === 'object' ? {
      images: typeof raw.cost.images === 'number' ? raw.cost.images : 0,
      tts: typeof raw.cost.tts === 'number' ? raw.cost.tts : 0,
      videos: typeof raw.cost.videos === 'number' ? raw.cost.videos : 0,
      total: typeof raw.cost.total === 'number' ? raw.cost.total : 0,
      imageCount: typeof raw.cost.imageCount === 'number' ? raw.cost.imageCount : assets.filter((a: any) => a.imageData).length,
      ttsCharacters: typeof raw.cost.ttsCharacters === 'number' ? raw.cost.ttsCharacters : 0,
      videoCount: typeof raw.cost.videoCount === 'number' ? raw.cost.videoCount : assets.filter((a: any) => a.videoData).length,
    } : undefined,
  };
}

function getCurrentSettings() {
  const elevenLabsModel = localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL) || CONFIG.DEFAULT_ELEVENLABS_MODEL;
  return {
    imageModel: getSelectedImageModel(),
    elevenLabsModel
  };
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
  cost?: CostBreakdown
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
    settings: getCurrentSettings(),
    assets: assets.map(asset => ({ ...asset })),
    thumbnail,
    cost
  };

  const current = await readIndexedProjects();
  const next = [project, ...current].sort((a, b) => b.createdAt - a.createdAt);
  await writeIndexedProjects(next);

  try {
    await saveProjectsToStudio(next);
  } catch (error) {
    console.warn('[Project] 로컬 파일 동기화 실패. IndexedDB 백업 유지.', error);
  }

  return project;
}

export async function getSavedProjects(): Promise<SavedProject[]> {
  try {
    const studioState = await fetchStudioState();
    if (Array.isArray(studioState.projects) && studioState.projects.length > 0) {
      const projects = studioState.projects.map(normalizeProject).sort((a, b) => b.createdAt - a.createdAt);
      await writeIndexedProjects(projects);
      return projects;
    }
  } catch {}

  const indexed = await readIndexedProjects();
  return indexed.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProjectById(id: string): Promise<SavedProject | null> {
  const projects = await getSavedProjects();
  return projects.find((project) => project.id === id) || null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const current = await getSavedProjects();
  const next = current.filter((project) => project.id !== id);
  await writeIndexedProjects(next);
  try {
    await saveProjectsToStudio(next);
  } catch {}
  return true;
}

export async function renameProject(id: string, newName: string): Promise<boolean> {
  const current = await getSavedProjects();
  const next = current.map((project) => project.id === id ? { ...project, name: newName } : project);
  await writeIndexedProjects(next);
  try {
    await saveProjectsToStudio(next);
  } catch {}
  return true;
}

export async function migrateFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.PROJECTS);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const normalized = parsed.map(normalizeProject);
    await writeIndexedProjects(normalized);
    try {
      await saveProjectsToStudio(normalized);
    } catch {}
    localStorage.removeItem(CONFIG.STORAGE_KEYS.PROJECTS);
  } catch (error) {
    console.error('[Project] 로컬스토리지 마이그레이션 실패:', error);
  }
}
