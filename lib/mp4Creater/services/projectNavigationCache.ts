import { SavedProject } from '../types';
import { compactWorkflowDraftForStorage } from './workflowDraftService';

const PROJECT_NAVIGATION_CACHE_KEY = 'mp4creater_scene_project_cache';

type ProjectNavigationCachePayload = {
  projectId: string;
  savedAt: number;
  project: SavedProject;
};

function stripPromptedImages(items: any) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    imageData: '',
  }));
}

function stripWorkflowDraftBinary(draft: any) {
  if (!draft || typeof draft !== 'object') return draft;
  return {
    ...draft,
    styleImages: stripPromptedImages(draft.styleImages),
    characterImages: stripPromptedImages(draft.characterImages),
    extractedCharacters: Array.isArray(draft.extractedCharacters)
      ? draft.extractedCharacters.map((character: any) => ({
          ...character,
          imageData: null,
          generatedImages: stripPromptedImages(character?.generatedImages),
        }))
      : [],
  };
}

function stripProjectBinary(project: SavedProject): SavedProject {
  return {
    ...project,
    assets: Array.isArray(project.assets)
      ? project.assets.map((asset) => ({
          ...asset,
          imageData: null,
          audioData: null,
          videoData: null,
          imageHistory: [],
          videoHistory: [],
        }))
      : [],
    backgroundMusicTracks: Array.isArray(project.backgroundMusicTracks)
      ? project.backgroundMusicTracks.map((track) => ({
          ...track,
          audioData: null,
        }))
      : [],
    workflowDraft: compactWorkflowDraftForStorage(stripWorkflowDraftBinary(project.workflowDraft) as any) as any,
  };
}

export function rememberProjectNavigationProject(project: SavedProject | null | undefined) {
  if (typeof window === 'undefined' || !project?.id) return;
  try {
    const payload: ProjectNavigationCachePayload = {
      projectId: project.id,
      savedAt: Date.now(),
      project: stripProjectBinary(project),
    };
    window.sessionStorage.setItem(PROJECT_NAVIGATION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable in privacy mode
  }
}

export function readProjectNavigationProject(projectId: string): SavedProject | null {
  if (typeof window === 'undefined' || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(PROJECT_NAVIGATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectNavigationCachePayload;
    if (parsed?.projectId !== projectId) return null;
    return parsed?.project || null;
  } catch {
    return null;
  }
}

export function clearProjectNavigationProject(projectId?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!projectId) {
      window.sessionStorage.removeItem(PROJECT_NAVIGATION_CACHE_KEY);
      return;
    }
    const raw = window.sessionStorage.getItem(PROJECT_NAVIGATION_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ProjectNavigationCachePayload;
    if (parsed?.projectId === projectId) {
      window.sessionStorage.removeItem(PROJECT_NAVIGATION_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}
