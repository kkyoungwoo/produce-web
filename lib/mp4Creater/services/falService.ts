import { CONFIG } from '../config';
import { AspectRatio } from '../types';
import { translatePromptToEnglish } from './promptTranslationService';
import { createCreativeDirection, hashCreativeSeed } from '../config/creativeVariance';

export interface GeneratedVideoResult {
  videoUrl: string;
  sourceMode: 'ai' | 'sample';
}

interface PixVerseVideoResponse {
  video: {
    url: string;
  };
  seed?: number;
}

type FalVideoModelConfig = {
  endpoint: string;
  previewResolution: '480p' | '720p';
  finalResolution: '480p' | '720p' | '1080p';
};

const DEFAULT_FAL_VIDEO_MODEL = 'fal-pixverse-v55';

const FAL_VIDEO_MODEL_CONFIGS: Record<string, FalVideoModelConfig> = {
  'fal-pixverse-v55': {
    endpoint: 'https://fal.run/fal-ai/pixverse/v5.5/image-to-video',
    previewResolution: '480p',
    finalResolution: '720p',
  },
  'fal-pixverse-v55-quick': {
    endpoint: 'https://fal.run/fal-ai/pixverse/v5.5/image-to-video',
    previewResolution: '480p',
    finalResolution: '480p',
  },
};

export function getFalApiKey(): string | null {
  return process.env.FAL_API_KEY || localStorage.getItem(CONFIG.STORAGE_KEYS.FAL_API_KEY);
}

export function setFalApiKey(key: string): void {
  localStorage.setItem(CONFIG.STORAGE_KEYS.FAL_API_KEY, key);
}

function base64ToDataUrl(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

function normalizeImageToDataUrl(imageBase64: string) {
  const normalized = (imageBase64 || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('data:')) return normalized;
  return base64ToDataUrl(normalized);
}

function resolveSampleCanvasSize(aspectRatio: AspectRatio = '16:9') {
  if (aspectRatio === '1:1') return { width: 720, height: 720 };
  if (aspectRatio === '9:16') return { width: 540, height: 960 };
  return { width: 960, height: 540 };
}

async function createSampleVideoFromImage(imageBase64: string, aspectRatio: AspectRatio = '16:9'): Promise<GeneratedVideoResult | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const source = normalizeImageToDataUrl(imageBase64);
  if (!source) return null;

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = source;
  });

  if (!image) return null;

  const { width, height } = resolveSampleCanvasSize(aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = canvas.captureStream(12);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const durationMs = 5000;
  const start = performance.now();
  const motionSeed = hashCreativeSeed(`${imageBase64.slice(0, 180)}:${aspectRatio}`);
  const direction = createCreativeDirection(`${motionSeed}:${aspectRatio}`, 0);
  const panX = ((motionSeed % 29) - 14);
  const panY = (((Math.floor(motionSeed / 17)) % 21) - 10);
  const zoomTarget = 1.04 + ((motionSeed % 5) * 0.015);

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.start();

    const drawFrame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const zoom = 1 + progress * (zoomTarget - 1);
      const drawWidth = width * zoom;
      const drawHeight = height * zoom;
      const offsetX = (width - drawWidth) / 2 - progress * panX;
      const offsetY = (height - drawHeight) / 2 - progress * panY;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.max(22, Math.round(width * 0.028))}px Arial`;
      ctx.fillText('SAMPLE VIDEO PREVIEW · fresh motion', Math.round(width * 0.06), Math.round(height * 0.11));
      ctx.font = `500 ${Math.max(15, Math.round(width * 0.018))}px Arial`;
      ctx.fillText(direction.shotType.slice(0, 64), Math.round(width * 0.06), Math.round(height * 0.16));

      if (progress < 1) {
        window.requestAnimationFrame(drawFrame);
        return;
      }

      window.setTimeout(() => recorder.stop(), 80);
    };

    window.requestAnimationFrame(drawFrame);
  });

  const videoBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
  if (!videoBlob.size) return null;
  return {
    videoUrl: URL.createObjectURL(videoBlob),
    sourceMode: 'sample',
  };
}

export async function generateVideoFromImage(
  imageBase64: string,
  motionPrompt: string,
  apiKey?: string,
  aspectRatio: AspectRatio = '16:9',
  qualityMode: 'preview' | 'final' = 'preview',
  videoModel: string = DEFAULT_FAL_VIDEO_MODEL,
): Promise<GeneratedVideoResult | null> {
  const key = apiKey || getFalApiKey();
  const modelConfig = FAL_VIDEO_MODEL_CONFIGS[videoModel] || FAL_VIDEO_MODEL_CONFIGS[DEFAULT_FAL_VIDEO_MODEL];

  if (!key) {
    console.warn('[FAL] API key is not configured. Falling back to sample video.');
    return await createSampleVideoFromImage(imageBase64, aspectRatio);
  }

  try {
    const englishMotionPrompt = await translatePromptToEnglish(motionPrompt, {
      label: 'image-to-video motion prompt',
      preserveLineBreaks: true,
      maxChars: 3000,
    });
    const direction = createCreativeDirection(`${englishMotionPrompt}:${aspectRatio}:${videoModel}`, 0);
    const imageUrl = await uploadImageToFal(imageBase64, key);

    if (!imageUrl) {
      console.error('[FAL] Image upload failed.');
      return null;
    }

    console.log(`[FAL] PixVerse v5.5 video generation started: "${englishMotionPrompt.slice(0, 50)}..."`);

    const requestBody = {
      prompt: `${englishMotionPrompt}
Fresh motion signature: ${direction.shotType}. ${direction.transitionBeat}` ,
      image_url: imageUrl,
      duration: 5,
      aspect_ratio: aspectRatio,
      resolution: qualityMode === 'final' ? modelConfig.finalResolution : modelConfig.previewResolution,
      negative_prompt: 'blurry, low quality, low resolution, pixelated, noisy, grainy, distorted, static',
    };

    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FAL] API error (${response.status}):`, errorText);
      throw new Error(`FAL API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const result: PixVerseVideoResponse = await response.json();
    console.log(`[FAL] Video generation completed: ${result.video.url}`);
    return { videoUrl: result.video.url, sourceMode: 'ai' };
  } catch (error: any) {
    console.error('[FAL] Video generation failed:', error?.message || error);
    return await createSampleVideoFromImage(imageBase64, aspectRatio);
  }
}

async function uploadImageToFal(imageBase64: string, apiKey: string): Promise<string | null> {
  try {
    const normalized = imageBase64.trim();
    const dataMatch = normalized.match(/^data:(.*?);base64,(.*)$/);
    const mimeType = dataMatch?.[1] || 'image/png';
    const rawBase64 = dataMatch?.[2] || normalized;
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    const formData = new FormData();
    formData.append('file', blob, 'image.png');

    const uploadResponse = await fetch('https://fal.run/fal-ai/storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.warn('[FAL] File upload failed, falling back to data URL.');
      return base64ToDataUrl(imageBase64);
    }

    const uploadResult = await uploadResponse.json();
    return uploadResult.url;
  } catch {
    console.warn('[FAL] Image upload failed, falling back to data URL.');
    return base64ToDataUrl(imageBase64);
  }
}

export async function fetchVideoAsBase64(videoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function batchGenerateVideos(
  assets: Array<{ imageData: string; visualPrompt: string }>,
  apiKey?: string,
  onProgress?: (index: number, total: number) => void,
  videoModel: string = DEFAULT_FAL_VIDEO_MODEL,
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  const key = apiKey || getFalApiKey() || undefined;

  for (let i = 0; i < assets.length; i++) {
    onProgress?.(i + 1, assets.length);

    const videoResult = await generateVideoFromImage(
      assets[i].imageData,
      assets[i].visualPrompt,
      key,
      '16:9',
      'preview',
      videoModel,
    );
    results.push(videoResult?.videoUrl || null);

    if (i < assets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
