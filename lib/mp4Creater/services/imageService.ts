import { CONFIG, ImageModelId } from '../config';
import { ScriptScene, ReferenceImages } from '../types';
import { makeScenePlaceholderImage } from '../utils/storyHelpers';
import { getPrimaryFreeImageForScene } from './freeMediaService';

function getGoogleAiStudioApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)
    || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
    || '';
}

function normalizeImageModel(modelId?: string | null): ImageModelId {
  const resolved = `${modelId || CONFIG.DEFAULT_IMAGE_MODEL}`.trim();
  return (resolved as ImageModelId) || CONFIG.DEFAULT_IMAGE_MODEL;
}

export function isSampleImageModel(modelId?: string | null): boolean {
  const resolved = normalizeImageModel(modelId);
  return !resolved || resolved === 'sample-scene-image' || resolved.startsWith('sample-');
}

export function getSelectedImageModel(): ImageModelId {
  if (typeof window === 'undefined') return CONFIG.DEFAULT_IMAGE_MODEL;
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.IMAGE_MODEL);
  return normalizeImageModel(saved);
}

export function getSelectedGeminiStyle(): string {
  return 'gemini-none';
}

export function getGeminiStylePrompt(): string {
  return '';
}

function buildImagePrompt(scene: ScriptScene, referenceImages: ReferenceImages) {
  const referenceHint = [
    referenceImages.character.length ? `Keep a consistent main character identity based on ${referenceImages.character.length} selected reference image(s).` : '',
    referenceImages.style.length ? `Preserve the selected visual style from ${referenceImages.style.length} style reference image(s).` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    'Create a single production-ready storyboard image for a short-form video scene.',
    `Scene ${scene.sceneNumber}.`,
    scene.imagePrompt || scene.visualPrompt || '',
    scene.narration ? `Narration context: ${scene.narration}` : '',
    referenceHint,
    'No captions, subtitles, UI, watermark, logo, or split layout.',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractInlineImage(json: any): string | null {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const mimeType = part?.inlineData?.mimeType || part?.inline_data?.mime_type;
      const data = part?.inlineData?.data || part?.inline_data?.data;
      if (typeof data === 'string' && data.trim()) {
        return `data:${mimeType || 'image/png'};base64,${data.trim()}`;
      }
    }
  }
  return null;
}

export async function generateImage(
  scene: ScriptScene,
  referenceImages: ReferenceImages,
  options?: { qualityMode?: 'draft' | 'final' }
): Promise<string | null> {
  const modelId = getSelectedImageModel();
  const prompt = buildImagePrompt(scene, referenceImages);
  const fallback = makeScenePlaceholderImage(scene.sceneNumber, scene.imagePrompt || scene.visualPrompt || scene.narration || 'scene', scene.aspectRatio || '16:9');
  const apiKey = getGoogleAiStudioApiKey();

  if (isSampleImageModel(modelId) || !apiKey) {
    const freeImage = await getPrimaryFreeImageForScene(scene).catch(() => null);
    return freeImage || fallback;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: scene.aspectRatio || '16:9',
            ...(modelId === 'gemini-3.1-flash-image-preview' || modelId === 'gemini-3-pro-image-preview'
              ? { imageSize: options?.qualityMode === 'final' ? '2K' : '1K' }
              : {}),
          },
        },
      }),
    });

    if (!response.ok) {
      const freeImage = await getPrimaryFreeImageForScene(scene).catch(() => null);
      return freeImage || fallback;
    }

    const json = await response.json();
    return extractInlineImage(json) || (await getPrimaryFreeImageForScene(scene).catch(() => null)) || fallback;
  } catch {
    return (await getPrimaryFreeImageForScene(scene).catch(() => null)) || fallback;
  }
}
