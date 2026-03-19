import { CONFIG, ImageModelId } from '../config';
import { ScriptScene, ReferenceImages } from '../types';
import { makeScenePlaceholderImage } from '../utils/storyHelpers';

export function getSelectedImageModel(): ImageModelId {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.IMAGE_MODEL);
  return (saved as ImageModelId) || CONFIG.DEFAULT_IMAGE_MODEL;
}

export function getSelectedGeminiStyle(): string {
  return 'gemini-none';
}

export function getGeminiStylePrompt(): string {
  return '';
}

export async function generateImage(
  scene: ScriptScene,
  _referenceImages: ReferenceImages
): Promise<string | null> {
  return makeScenePlaceholderImage(scene.sceneNumber, scene.narration || scene.visualPrompt || 'scene', scene.aspectRatio || '16:9');
}
