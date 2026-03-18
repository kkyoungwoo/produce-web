import { SavedProject } from '../types';

const PROJECT_NAVIGATION_CACHE_KEY = 'mp4creater_scene_project_cache';

type ProjectNavigationCachePayload = {
  projectId: string;
  savedAt: number;
  project: SavedProject;
};

export function rememberProjectNavigationProject(project: SavedProject | null | undefined) {
  if (typeof window === 'undefined' || !project?.id) return;
  try {
    const payload: ProjectNavigationCachePayload = {
      projectId: project.id,
      savedAt: Date.now(),
      project,
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
