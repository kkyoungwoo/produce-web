import { CONFIG } from '../config';
import { AspectRatio } from '../types';
import { translatePromptToEnglish } from './promptTranslationService';

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

export async function generateVideoFromImage(
  imageBase64: string,
  motionPrompt: string,
  apiKey?: string,
  aspectRatio: AspectRatio = '16:9',
  qualityMode: 'preview' | 'final' = 'preview',
  videoModel: string = DEFAULT_FAL_VIDEO_MODEL,
): Promise<string | null> {
  const key = apiKey || getFalApiKey();
  const modelConfig = FAL_VIDEO_MODEL_CONFIGS[videoModel] || FAL_VIDEO_MODEL_CONFIGS[DEFAULT_FAL_VIDEO_MODEL];

  if (!key) {
    console.warn('[FAL] API key is not configured.');
    return null;
  }

  try {
    const englishMotionPrompt = await translatePromptToEnglish(motionPrompt, {
      label: 'image-to-video motion prompt',
      preserveLineBreaks: true,
      maxChars: 3000,
    });
    const imageUrl = await uploadImageToFal(imageBase64, key);

    if (!imageUrl) {
      console.error('[FAL] Image upload failed.');
      return null;
    }

    console.log(`[FAL] PixVerse v5.5 video generation started: "${englishMotionPrompt.slice(0, 50)}..."`);

    const requestBody = {
      prompt: englishMotionPrompt,
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
    return result.video.url;
  } catch (error: any) {
    console.error('[FAL] Video generation failed:', error?.message || error);
    return null;
  }
}

async function uploadImageToFal(imageBase64: string, apiKey: string): Promise<string | null> {
  try {
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

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

    const videoUrl = await generateVideoFromImage(
      assets[i].imageData,
      assets[i].visualPrompt,
      key,
      '16:9',
      'preview',
      videoModel,
    );
    results.push(videoUrl);

    if (i < assets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
