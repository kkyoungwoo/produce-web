import { FreeMediaItem, ScriptScene } from '../types';

function buildSceneSearchQuery(scene: ScriptScene) {
  return [scene.narration, scene.imagePrompt || scene.visualPrompt || '']
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

async function searchFreeMedia(query: string, limit = 3, mediaType: 'image' | 'video' = 'image'): Promise<FreeMediaItem[]> {
  try {
    const response = await fetch('/api/mp4Creater/free-media/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit,
        mediaType,
      }),
    });

    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function searchFreeMediaForScene(scene: ScriptScene, limit = 3): Promise<FreeMediaItem[]> {
  return searchFreeMedia(buildSceneSearchQuery(scene), limit, 'image');
}

export async function getPrimaryFreeImageForScene(scene: ScriptScene): Promise<string | null> {
  const items = await searchFreeMediaForScene(scene, 1);
  const first = items[0];
  return typeof first?.dataUrl === 'string' && first.dataUrl ? first.dataUrl : null;
}

export async function getPrimaryFreeVideoForPrompt(prompt: string): Promise<string | null> {
  const items = await searchFreeMedia(prompt, 1, 'video');
  const first = items[0];
  return typeof first?.videoUrl === 'string' && first.videoUrl ? first.videoUrl : null;
}
