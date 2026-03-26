import { CONFIG, ImageModelId } from '../config';
import { ScriptScene, ReferenceImages } from '../types';
import { makeScenePlaceholderImage } from '../utils/storyHelpers';
import { getPrimaryFreeImageForScene } from './freeMediaService';
import { translatePromptToEnglish } from './promptTranslationService';
import { buildCreativeDirectionBlock, buildGenerationSignature } from '../config/creativeVariance';

function getGoogleAiStudioApiKey(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)
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


function extractInlineImagePart(dataUrl: string): { inlineData: { mimeType: string; data: string } } | null {
  const match = `${dataUrl || ''}`.trim().match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1] || 'image/png',
      data: match[2] || '',
    },
  };
}

function buildReferenceImageParts(referenceImages: ReferenceImages) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  const characterImages = referenceImages.character.slice(0, 2);
  const styleImages = referenceImages.style.slice(0, 1);

  characterImages.forEach((image, index) => {
    const inline = extractInlineImagePart(image);
    if (!inline) return;
    parts.push({ text: `[CHARACTER_REFERENCE_${index + 1}] Preserve the same identity, face structure, hair silhouette, wardrobe cues, and recognisable features. Character reference strength: ${referenceImages.characterStrength} / 100.` });
    parts.push(inline);
  });

  styleImages.forEach((image, index) => {
    const inline = extractInlineImagePart(image);
    if (!inline) return;
    parts.push({ text: `[STYLE_REFERENCE_${index + 1}] Preserve the same palette logic, texture density, lighting rhythm, rendering finish, and atmosphere. Style reference strength: ${referenceImages.styleStrength} / 100.` });
    parts.push(inline);
  });

  return parts;
}

function hasDialogueCue(text?: string | null) {
  const normalized = `${text || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return /["“”'‘’「」『』]|[:：]|\b(dialogue|speaks|says|asks|replies|whispers|shouts)\b|말하|묻|답하|대답|속삭|외치|소리치|대화/u.test(normalized);
}

async function buildImagePrompt(scene: ScriptScene, referenceImages: ReferenceImages) {
  const referenceHint = [
    referenceImages.character.length ? `Keep a consistent main character identity based on ${referenceImages.character.length} selected reference image(s). Character consistency priority: ${referenceImages.characterStrength}/100.` : '',
    referenceImages.style.length ? `Preserve the selected visual style from ${referenceImages.style.length} style reference image(s). Style consistency priority: ${referenceImages.styleStrength}/100.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const scenePrompt = (scene.imagePrompt || scene.visualPrompt || '').trim();
  const normalizedNarration = (scene.narration || '').replace(/\s+/g, ' ').trim();
  const normalizedScenePrompt = scenePrompt.replace(/\s+/g, ' ').trim();
  const shouldAppendScriptLine = Boolean(normalizedNarration) && !normalizedScenePrompt.includes(normalizedNarration);
  const similarityRequested = /비슷|유사|same vibe|near-match|similar/i.test(`${scenePrompt} ${scene.videoPrompt || ''}`);
  const creativeBlock = buildCreativeDirectionBlock({
    task: 'image',
    seedText: `${scene.sceneNumber}:${scene.narration}:${scenePrompt}`,
    index: scene.sceneNumber,
    mode: similarityRequested ? 'similar' : 'fresh',
  });

  const rawPrompt = [
    'Create a single production-ready storyboard image for one short-form video scene.',
    `Scene ${scene.sceneNumber}.`,
    `[GENERATION SIGNATURE] ${buildGenerationSignature('image', `${scene.sceneNumber}:${scene.narration}`, scene.sceneNumber)}`,
    creativeBlock,
    similarityRequested
      ? '[SIMILAR REGENERATION] User asked for a near-match based on the current image/reference. Keep the core identity, composition family, and styling cues, but still output a newly authored adjacent variation instead of a duplicate.'
      : '[FRESH GENERATION] Default to a new frame with the same project continuity. Do not copy the most recent cached composition or wording.',
    scenePrompt,
    shouldAppendScriptLine ? `[SCRIPT LINE] ${scene.narration}` : '',
    hasDialogueCue(scene.narration)
      ? '[DIALOGUE TIMING] If dialogue starts in this scene, prefer the frame right before the first spoken word or the exact instant the first line lands, so the cut feels motivated by conversation timing.'
      : '',
    referenceHint,
    '[VIDEO HANDOFF] The resulting image must be a strong first frame for the next video-generation step. Preserve layout, identity, and motion-readiness so the frame can animate naturally into the matching scene video.',
    'Focus on one decisive frame. Keep continuity with the selected character and style references. No captions, subtitles, UI, watermark, logo, or split layout.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return translatePromptToEnglish(rawPrompt, {
    label: 'scene image prompt',
    preserveLineBreaks: true,
    maxChars: 9000,
  }).catch(() => rawPrompt);
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
  const fallback = makeScenePlaceholderImage(scene.sceneNumber, scene.imagePrompt || scene.visualPrompt || scene.narration || 'scene', scene.aspectRatio || '16:9');
  const apiKey = getGoogleAiStudioApiKey();

  if (isSampleImageModel(modelId) || !apiKey) {
    const freeImage = await getPrimaryFreeImageForScene(scene).catch(() => null);
    return freeImage || fallback;
  }

  try {
    const prompt = await buildImagePrompt(scene, referenceImages);
    const referenceParts = buildReferenceImageParts(referenceImages);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }, ...referenceParts],
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
