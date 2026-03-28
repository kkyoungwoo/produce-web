import { CONFIG, ImageModelId } from '../config';
import { ScriptScene, ReferenceImages } from '../types';
import { makeScenePlaceholderImage } from '../utils/storyHelpers';
import { getPrimaryFreeImageForScene } from './freeMediaService';
import { resolveGoogleAiStudioApiKey } from './googleAiStudioService';
import { translatePromptToEnglish } from './promptTranslationService';
import { buildCreativeDirectionBlock, buildGenerationSignature } from '../config/creativeVariance';
import { buildMarkdownSection, buildSimilarityControlLines, joinPromptBlocks } from './promptMarkdown';

const SAMPLE_STYLE_IMAGES = [
  '/mp4Creater/samples/styles/cold_rational_architecture.png',
  '/mp4Creater/samples/styles/dawn_of_recovery.png',
  '/mp4Creater/samples/styles/dynamic_road_sprint.png',
  '/mp4Creater/samples/styles/ethereal_dreamscape_fog.png',
  '/mp4Creater/samples/styles/minimal_purity_void.png',
  '/mp4Creater/samples/styles/mysterious_night_cityscape.png',
  '/mp4Creater/samples/styles/nostalgic_film_fragments.png',
  '/mp4Creater/samples/styles/radiant_nature_bliss.png',
  '/mp4Creater/samples/styles/soft_pastel_first_blush.png',
  '/mp4Creater/samples/styles/still_moment_dust.png',
  '/mp4Creater/samples/styles/unyielding_landscape_grit.png',
  '/mp4Creater/samples/styles/vibrant_festival_lights.png',
] as const;

function getGoogleAiStudioApiKey(): string {
  return resolveGoogleAiStudioApiKey();
}

function normalizeImageModel(modelId?: string | null): ImageModelId {
  const resolved = `${modelId || CONFIG.DEFAULT_IMAGE_MODEL}`.trim();
  return (resolved as ImageModelId) || CONFIG.DEFAULT_IMAGE_MODEL;
}

function hashSceneSampleSeed(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 37) + char.charCodeAt(0) + index) >>> 0, 19);
}

function pickSampleStyleImage(scene: ScriptScene) {
  const seed = `${scene.sceneNumber}:${scene.narration || ''}:${scene.imagePrompt || scene.visualPrompt || ''}:${scene.aspectRatio || '16:9'}`;
  return SAMPLE_STYLE_IMAGES[hashSceneSampleSeed(seed) % SAMPLE_STYLE_IMAGES.length];
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

  const rawPrompt = joinPromptBlocks([
    buildMarkdownSection('Goal', [
      'Create a single production-ready storyboard image for one short-form video scene.',
      `Scene ${scene.sceneNumber}.`,
      `[GENERATION SIGNATURE] ${buildGenerationSignature('image', `${scene.sceneNumber}:${scene.narration}`, scene.sceneNumber)}`,
    ]),
    buildMarkdownSection('Similarity Control', [
      ...buildSimilarityControlLines(),
      similarityRequested
        ? 'The user asked for a near-match. Keep the core identity, composition family, and styling cues while still authoring a new adjacent variation.'
        : 'Default to a fresh frame with the same project continuity. Do not copy the most recent cached composition or wording.',
    ]),
    buildMarkdownSection('Scene Anchor', [
      scenePrompt,
      shouldAppendScriptLine ? `[SCRIPT LINE] ${scene.narration}` : '',
      'Follow the concept direction and continuity already embedded in the scene prompt.',
      'Focus on one decisive frame with a clear visible action, reaction, or emotional shift.',
    ], { bullet: false }),
    buildMarkdownSection('Transition Rules', [
      hasDialogueCue(scene.narration)
        ? 'If dialogue starts in this scene, prefer the frame right before the first spoken word or the exact instant the first line lands so the cut feels motivated by speech timing.'
        : 'Leave enough arrival or exit energy for the later cut to feel natural instead of frozen.',
      '[VIDEO HANDOFF] The resulting image must be a strong first frame for the next video-generation step. Preserve layout, identity, and motion-readiness so the frame can animate naturally into the matching scene video.',
    ]),
    buildMarkdownSection('Reference Continuity', [
      referenceHint,
      'Keep continuity with the selected character and style references.',
    ]),
    buildMarkdownSection('Creative Variance', [creativeBlock], { bullet: false }),
    buildMarkdownSection('Do Not', [
      'No captions, subtitles, UI, watermark, logo, split layout, readable signs, readable storefront text, poster text, packaging text, billboard text, or decorative typography anywhere in the frame.',
      'Background elements must support action and mood, not text reading. If signage or labels are unavoidable, keep them abstract, blurred, cropped, or unreadable.',
    ]),
  ]);

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
  options?: { qualityMode?: 'draft' | 'final'; modelId?: string | null }
): Promise<string | null> {
  const result = await generateImageWithMeta(scene, referenceImages, options);
  return result.imageData;
}

export async function generateImageWithMeta(
  scene: ScriptScene,
  referenceImages: ReferenceImages,
  options?: { qualityMode?: 'draft' | 'final'; modelId?: string | null }
): Promise<{ imageData: string | null; source: 'ai' | 'sample' | 'fallback' }> {
  const modelId = normalizeImageModel(options?.modelId || getSelectedImageModel());
  const fallback = makeScenePlaceholderImage(scene.sceneNumber, scene.imagePrompt || scene.visualPrompt || scene.narration || 'scene', scene.aspectRatio || '16:9');
  const apiKey = getGoogleAiStudioApiKey();

  if (isSampleImageModel(modelId) || !apiKey) {
    return {
      imageData: pickSampleStyleImage(scene) || fallback,
      source: 'sample',
    };
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
      return {
        imageData: freeImage || fallback,
        source: 'fallback',
      };
    }

    const json = await response.json();
    const inlineImage = extractInlineImage(json);
    if (inlineImage) {
      return {
        imageData: inlineImage,
        source: 'ai',
      };
    }

    const freeImage = await getPrimaryFreeImageForScene(scene).catch(() => null);
    return {
      imageData: freeImage || fallback,
      source: 'fallback',
    };
  } catch {
    return {
      imageData: (await getPrimaryFreeImageForScene(scene).catch(() => null)) || fallback,
      source: 'fallback',
    };
  }
}
