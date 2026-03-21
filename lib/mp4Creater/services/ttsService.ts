import { AudioPreviewAsset } from '../types';
import { createQwenTtsAsset } from './qwen3TtsService';
import { generateAudioWithElevenLabs } from './elevenLabsService';
import { generateAudioWithHeyGen } from './heygenService';

let activeRequestId = 0;

export async function generateTtsAudio(options: {
  provider: 'qwen3Tts' | 'elevenLabs' | 'heygen';
  text: string;
  apiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
}) {
  if (options.provider === 'elevenLabs' && options.apiKey) {
    return await generateAudioWithElevenLabs(
      options.text,
      options.apiKey,
      options.voiceId || undefined,
      options.modelId as any,
    );
  }

  if (options.provider === 'heygen' && options.apiKey) {
    return await generateAudioWithHeyGen(
      options.text,
      options.apiKey,
      options.voiceId || undefined,
      options.locale || undefined,
    );
  }

  const asset = await createQwenTtsAsset({
    title: 'qwen3-tts',
    text: options.text,
    preset: options.qwenPreset,
    mode: 'voice-preview',
  });

  return {
    audioData: asset.audioData,
    subtitleData: null,
    estimatedDuration: asset.duration,
    sourceMode: asset.sourceMode,
    voiceId: asset.voiceId || options.qwenPreset || null,
    modelId: asset.modelId || 'qwen3-tts',
  };
}

export async function createTtsPreview(options: {
  provider: 'qwen3Tts' | 'elevenLabs' | 'heygen';
  title: string;
  text: string;
  mode: AudioPreviewAsset['mode'];
  apiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
}): Promise<{ asset: AudioPreviewAsset; requestId: number }> {
  activeRequestId += 1;
  const requestId = activeRequestId;

  const result = await generateTtsAudio({
    provider: options.provider,
    text: options.text,
    apiKey: options.apiKey,
    voiceId: options.voiceId,
    modelId: options.modelId,
    qwenPreset: options.qwenPreset,
    locale: options.locale,
  });

  if (requestId === activeRequestId && result.audioData) {
    return {
      requestId,
      asset: {
        id: `${options.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: options.title,
        text: options.text,
        audioData: result.audioData,
        duration: result.estimatedDuration,
        provider: options.provider,
        mode: options.mode,
        sourceMode: result.sourceMode || 'ai',
        voiceId: result.voiceId || options.voiceId || null,
        modelId:
          result.modelId ||
          options.modelId ||
          (options.provider === 'heygen' ? 'starfish' : options.provider === 'qwen3Tts' ? 'qwen3-tts' : null),
        createdAt: Date.now(),
      },
    };
  }

  return {
    requestId,
    asset: await createQwenTtsAsset({
      title: options.title,
      text: options.text,
      preset: options.qwenPreset,
      mode: options.mode,
    }),
  };
}

export function isLatestTtsRequest(requestId: number) {
  return requestId === activeRequestId;
}
