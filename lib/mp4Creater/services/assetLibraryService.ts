import { AssetHistoryItem, BackgroundMusicTrack, GeneratedAsset, SavedProject } from '../types';
import { getSavedProjects, getProjectById } from './projectService';

export interface GlobalAssetLibraryItem {
  id: string;
  projectId: string;
  projectName: string;
  sceneNumber?: number | null;
  kind: 'image' | 'video' | 'audio' | 'bgm' | 'thumbnail';
  title: string;
  previewData: string | null;
  sourceMode: 'ai' | 'sample' | 'upload' | 'reused' | 'derived';
  createdAt: number;
  aspectRatio?: string | null;
  provenance: string;
}

function normalizeDataValue(value?: string | null) {
  if (!value) return null;
  return value;
}

function pushHistoryItems(target: GlobalAssetLibraryItem[], project: SavedProject, asset: GeneratedAsset, kind: 'image' | 'video', items?: AssetHistoryItem[]) {
  (items || []).forEach((entry) => {
    target.push({
      id: `${project.id}:${kind}:${entry.id}`,
      projectId: project.id,
      projectName: project.name,
      sceneNumber: asset.sceneNumber,
      kind,
      title: `${project.name} · Scene ${asset.sceneNumber} ${kind === 'image' ? '이미지' : '비디오'}`,
      previewData: normalizeDataValue(entry.data),
      sourceMode: entry.sourceMode === 'sample' ? 'sample' : 'ai',
      createdAt: entry.createdAt || project.createdAt,
      aspectRatio: asset.aspectRatio || null,
      provenance: entry.label || `${kind} history`,
    });
  });
}

function collectProjectAssets(project: SavedProject): GlobalAssetLibraryItem[] {
  const assets: GlobalAssetLibraryItem[] = [];

  (project.assets || []).forEach((asset) => {
    if (asset.imageData) {
      assets.push({
        id: `${project.id}:image:scene-${asset.sceneNumber}`,
        projectId: project.id,
        projectName: project.name,
        sceneNumber: asset.sceneNumber,
        kind: 'image',
        title: `${project.name} · Scene ${asset.sceneNumber} 이미지`,
        previewData: asset.imageData,
        sourceMode: asset.sourceMode === 'sample' ? 'sample' : 'ai',
        createdAt: project.lastSavedAt || project.createdAt,
        aspectRatio: asset.aspectRatio || null,
        provenance: 'generated scene image',
      });
    }
    if (asset.videoData) {
      assets.push({
        id: `${project.id}:video:scene-${asset.sceneNumber}`,
        projectId: project.id,
        projectName: project.name,
        sceneNumber: asset.sceneNumber,
        kind: 'video',
        title: `${project.name} · Scene ${asset.sceneNumber} 비디오`,
        previewData: asset.videoData,
        sourceMode: asset.sourceMode === 'sample' ? 'sample' : 'ai',
        createdAt: project.lastSavedAt || project.createdAt,
        aspectRatio: asset.aspectRatio || null,
        provenance: 'generated scene video',
      });
    }
    if (asset.audioData) {
      assets.push({
        id: `${project.id}:audio:scene-${asset.sceneNumber}`,
        projectId: project.id,
        projectName: project.name,
        sceneNumber: asset.sceneNumber,
        kind: 'audio',
        title: `${project.name} · Scene ${asset.sceneNumber} 음성`,
        previewData: asset.audioData,
        sourceMode: asset.sourceMode === 'sample' ? 'sample' : 'ai',
        createdAt: project.lastSavedAt || project.createdAt,
        aspectRatio: asset.aspectRatio || null,
        provenance: 'scene narration audio',
      });
    }
    pushHistoryItems(assets, project, asset, 'image', asset.imageHistory);
    pushHistoryItems(assets, project, asset, 'video', asset.videoHistory);
  });

  (project.backgroundMusicTracks || []).forEach((track: BackgroundMusicTrack) => {
    if (!track.audioData) return;
    assets.push({
      id: `${project.id}:bgm:${track.id}`,
      projectId: project.id,
      projectName: project.name,
      sceneNumber: null,
      kind: 'bgm',
      title: `${project.name} · ${track.title || 'BGM'}`,
      previewData: track.audioData,
      sourceMode: track.sourceMode === 'sample' ? 'sample' : 'ai',
      createdAt: track.createdAt || project.createdAt,
      aspectRatio: project.workflowDraft?.aspectRatio || null,
      provenance: track.prompt || 'background music',
    });
  });

  if (project.thumbnail) {
    assets.push({
      id: `${project.id}:thumbnail:main`,
      projectId: project.id,
      projectName: project.name,
      sceneNumber: null,
      kind: 'thumbnail',
      title: `${project.name} · 썸네일`,
      previewData: project.thumbnail,
      sourceMode: 'derived',
      createdAt: project.lastSavedAt || project.createdAt,
      aspectRatio: project.workflowDraft?.aspectRatio || null,
      provenance: 'project thumbnail',
    });
  }

  return assets;
}

export async function getGlobalAssetLibrary(options?: { projectId?: string | null; sourceProjectId?: string | null; query?: string; limit?: number }): Promise<GlobalAssetLibraryItem[]> {
  const projects = await getSavedProjects({ localOnly: true });
  const lowerQuery = options?.query?.trim().toLowerCase() || '';
  const items = projects.flatMap(collectProjectAssets)
    .filter((item) => !options?.projectId || item.projectId !== options.projectId)
    .filter((item) => !options?.sourceProjectId || item.projectId === options.sourceProjectId)
    .filter((item) => !lowerQuery || item.title.toLowerCase().includes(lowerQuery) || item.provenance.toLowerCase().includes(lowerQuery))
    .sort((a, b) => b.createdAt - a.createdAt);
  return typeof options?.limit === 'number' ? items.slice(0, options.limit) : items;
}

export async function getProjectLineage(projectId?: string | null) {
  if (!projectId) return null;
  const project = await getProjectById(projectId, { localOnly: true });
  if (!project) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    derivationMeta: project.workfileV4?.derivationMeta || null,
    continuityState: project.workfileV4?.continuityState || null,
    metadataV4: project.metadataV4 || null,
  };
}
