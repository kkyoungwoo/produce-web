import { CONFIG } from '../config';
import { AspectRatio } from '../types';
import { translatePromptToEnglish } from './promptTranslationService';
import { createCreativeDirection, hashCreativeSeed } from '../config/creativeVariance';
import { parseDataUrl } from '../utils/downloadHelpers';
import { getPrimaryFreeVideoForPrompt } from './freeMediaService';

export interface GeneratedVideoResult {
  videoUrl: string;
  sourceMode: 'ai' | 'sample';
}

type GoogleVideoModelConfig = {
  resolution: '720p' | '1080p';
  durationSeconds: 4 | 6 | 8;
};

const DEFAULT_GOOGLE_VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

const GOOGLE_VIDEO_MODEL_CONFIGS: Record<string, GoogleVideoModelConfig> = {
  'veo-3.1-fast-generate-preview': {
    resolution: '720p',
    durationSeconds: 4,
  },
  'veo-3.1-generate-preview': {
    resolution: '720p',
    durationSeconds: 4,
  },
};

export function getFalApiKey(): string | null {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.FAL_API_KEY || null;
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)
    || localStorage.getItem(CONFIG.STORAGE_KEYS.FAL_API_KEY)
    || process.env.FAL_API_KEY
    || null;
}

export function setFalApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY, key);
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

async function createSampleVideoFromImage(imageBase64: string, aspectRatio: AspectRatio = '16:9', motionPrompt?: string): Promise<GeneratedVideoResult | null> {
  const freeVideoUrl = motionPrompt ? await getPrimaryFreeVideoForPrompt(motionPrompt).catch(() => null) : null;
  if (freeVideoUrl) {
    return { videoUrl: freeVideoUrl, sourceMode: 'sample' };
  }
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

function buildInlineImage(imageBase64: string) {
  const parsed = parseDataUrl(imageBase64, 'image/png');
  if (!parsed) return null;
  let binary = '';
  for (let i = 0; i < parsed.bytes.length; i += 1) {
    binary += String.fromCharCode(parsed.bytes[i]);
  }
  const base64 = typeof window !== 'undefined' ? btoa(binary) : Buffer.from(parsed.bytes).toString('base64');
  return {
    inlineData: {
      mimeType: parsed.mime || 'image/png',
      data: base64,
    },
  };
}

async function pollGoogleVideo(operationName: string, apiKey: string): Promise<string | null> {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    const statusResponse = await fetch(`${baseUrl}/${operationName}`, {
      headers: {
        'x-goog-api-key': apiKey,
      },
    });
    if (!statusResponse.ok) return null;
    const statusJson = await statusResponse.json();
    if (!statusJson?.done) continue;

    const videoUri = statusJson?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      || statusJson?.response?.generatedVideos?.[0]?.video?.uri;
    if (typeof videoUri !== 'string' || !videoUri.trim()) return null;

    const downloadResponse = await fetch(videoUri, {
      headers: {
        'x-goog-api-key': apiKey,
      },
    });
    if (!downloadResponse.ok) return null;
    const blob = await downloadResponse.blob();
    if (!blob.size) return null;
    return URL.createObjectURL(blob);
  }

  return null;
}

export async function generateVideoFromImage(
  imageBase64: string,
  motionPrompt: string,
  apiKey?: string,
  aspectRatio: AspectRatio = '16:9',
  qualityMode: 'preview' | 'final' = 'preview',
  videoModel: string = DEFAULT_GOOGLE_VIDEO_MODEL,
): Promise<GeneratedVideoResult | null> {
  const key = apiKey || getFalApiKey();
  const normalizedModel = GOOGLE_VIDEO_MODEL_CONFIGS[videoModel] ? videoModel : DEFAULT_GOOGLE_VIDEO_MODEL;
  const modelConfig = GOOGLE_VIDEO_MODEL_CONFIGS[normalizedModel];

  if (!key || normalizedModel.startsWith('sample-')) {
    return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);
  }

  try {
    const englishMotionPrompt = await translatePromptToEnglish(motionPrompt, {
      label: 'image-to-video motion prompt',
      preserveLineBreaks: true,
      maxChars: 3000,
    });
    const direction = createCreativeDirection(`${englishMotionPrompt}:${aspectRatio}:${normalizedModel}`, 0);
    const image = buildInlineImage(imageBase64);
    if (!image) return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{
          prompt: `${englishMotionPrompt}\nFresh motion signature: ${direction.shotType}. ${direction.transitionBeat}`,
          image,
        }],
        parameters: {
          aspectRatio: aspectRatio,
          durationSeconds: modelConfig.durationSeconds,
          resolution: qualityMode === 'final' ? modelConfig.resolution : '720p',
          numberOfVideos: 1,
        },
      }),
    });

    if (!response.ok) {
      return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);
    }

    const operation = await response.json();
    const operationName = typeof operation?.name === 'string' ? operation.name : '';
    if (!operationName) return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);

    const videoUrl = await pollGoogleVideo(operationName, key);
    if (!videoUrl) return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);
    return { videoUrl, sourceMode: 'ai' };
  } catch {
    return await createSampleVideoFromImage(imageBase64, aspectRatio, motionPrompt);
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
  videoModel: string = DEFAULT_GOOGLE_VIDEO_MODEL,
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
