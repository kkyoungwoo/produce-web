import { AudioPreviewAsset } from '../types';
import { createQwenTtsAsset } from './qwen3TtsService';
import { generateAudioWithElevenLabs } from './elevenLabsService';

let activeRequestId = 0;

export async function createTtsPreview(options: {
  provider: 'qwen3Tts' | 'elevenLabs';
  title: string;
  text: string;
  mode: AudioPreviewAsset['mode'];
  apiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
}): Promise<{ asset: AudioPreviewAsset; requestId: number }> {
  activeRequestId += 1;
  const requestId = activeRequestId;

  if (options.provider === 'elevenLabs' && options.apiKey) {
    const result = await generateAudioWithElevenLabs(options.text, options.apiKey, options.voiceId || undefined, options.modelId as any);
    if (requestId === activeRequestId && result.audioData) {
      return {
        requestId,
        asset: {
          id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: options.title,
          text: options.text,
          audioData: result.audioData,
          duration: result.estimatedDuration,
          provider: 'elevenLabs',
          mode: options.mode,
          sourceMode: result.sourceMode || 'ai',
          voiceId: result.voiceId || options.voiceId || null,
          modelId: result.modelId || options.modelId || null,
          createdAt: Date.now(),
        },
      };
    }
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
