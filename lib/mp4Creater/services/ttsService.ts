import { AudioPreviewAsset, SubtitleData } from '../types';
import { generateBrowserFreeTts } from './chatterboxBrowserTtsService';
import { createQwenTtsAsset } from './qwen3TtsService';
import { generateAudioWithElevenLabs } from './elevenLabsService';
import { generateAudioWithHeyGen } from './heygenService';

let activeRequestId = 0;


function buildMeaningChunks(words: SubtitleData['words']) {
  const chunks: NonNullable<SubtitleData['meaningChunks']> = [];
  const chunkSize = 4;
  for (let index = 0; index < words.length; index += chunkSize) {
    const group = words.slice(index, index + chunkSize);
    if (!group.length) continue;
    chunks.push({
      text: group.map((item) => item.word).join(' '),
      startTime: Number((group[0]?.start || 0).toFixed(2)),
      endTime: Number((group[group.length - 1]?.end || group[0]?.end || 0).toFixed(2)),
    });
  }
  return chunks;
}

function buildEstimatedSubtitleData(text: string, estimatedDuration?: number | null): SubtitleData | null {
  const normalized = `${text || ''}`.replace(/\s+/g, ' ').trim();
  const duration = Number(estimatedDuration || 0);
  if (!normalized || !Number.isFinite(duration) || duration <= 0.1) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const span = duration / Math.max(1, words.length);
  const timedWords = words.map((word, index) => ({
    word,
    start: Number((index * span).toFixed(2)),
    end: Number(((index + 1) * span).toFixed(2)),
  }));
  return {
    words: timedWords,
    fullText: normalized,
    meaningChunks: buildMeaningChunks(timedWords),
  };
}


function resolveSampleProvider(provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen'): 'qwen3Tts' | 'chatterbox' {
  return provider === 'chatterbox' ? 'chatterbox' : 'qwen3Tts';
}

function resolveLocalTtsModelId(provider: 'qwen3Tts' | 'chatterbox', freeModelId?: string | null, sourceMode?: 'ai' | 'sample') {
  if (sourceMode === 'sample') {
    return provider === 'chatterbox' ? 'sample-tone-fallback/chatterbox' : 'sample-tone-fallback/qwen3';
  }
  if (typeof freeModelId === 'string' && freeModelId.trim()) return freeModelId.trim();
  return provider === 'chatterbox' ? 'browser-free/chatterbox-heavy' : 'browser-free/chatterbox-light';
}


export async function generateTtsAudio(options: {
  provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  text: string;
  apiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
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

  if (options.provider === 'qwen3Tts' || options.provider === 'chatterbox') {
    try {
      const freeResult = await generateBrowserFreeTts({
        provider: options.provider,
        text: options.text,
        preset: options.provider === 'chatterbox' ? (options.qwenPreset || 'chatterbox-clear') : options.qwenPreset,
        locale: options.locale,
        voiceReferenceAudioData: options.voiceReferenceAudioData,
        voiceReferenceMimeType: options.voiceReferenceMimeType,
      });

      return {
        audioData: freeResult.audioData,
        subtitleData: buildEstimatedSubtitleData(options.text, freeResult.estimatedDuration),
        estimatedDuration: freeResult.estimatedDuration,
        sourceMode: freeResult.sourceMode,
        voiceId: options.voiceId || options.qwenPreset || null,
        modelId: resolveLocalTtsModelId(options.provider, freeResult.modelId, freeResult.sourceMode),
      };
    } catch (error) {
      console.warn('[ttsService] browser free tts failed, using fallback sample', error);
    }
  }

  const asset = await createQwenTtsAsset({
    title: 'qwen3-tts',
    text: options.text,
    preset: options.provider === 'chatterbox' ? (options.qwenPreset || 'chatterbox-clear') : options.qwenPreset,
    provider: resolveSampleProvider(options.provider),
    mode: 'voice-preview',
  });

  return {
    audioData: asset.audioData,
    subtitleData: buildEstimatedSubtitleData(options.text, asset.duration),
    estimatedDuration: asset.duration,
    sourceMode: asset.sourceMode,
    voiceId: asset.voiceId || options.qwenPreset || null,
    modelId: asset.modelId || resolveLocalTtsModelId(resolveSampleProvider(options.provider), null, asset.sourceMode),
  };
}

export async function createTtsPreview(options: {
  provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  title: string;
  text: string;
  mode: AudioPreviewAsset['mode'];
  apiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
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
    voiceReferenceAudioData: options.voiceReferenceAudioData,
    voiceReferenceMimeType: options.voiceReferenceMimeType,
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
        provider: options.provider === 'heygen' || options.provider === 'elevenLabs' || options.provider === 'chatterbox' || options.provider === 'qwen3Tts' ? options.provider : 'qwen3Tts',
        mode: options.mode,
        sourceMode: result.sourceMode || 'ai',
        voiceId: result.voiceId || options.voiceId || null,
        modelId:
          result.modelId ||
          options.modelId ||
          (options.provider === 'heygen'
            ? 'starfish'
            : options.provider === 'chatterbox'
              ? 'chatterbox-local'
              : options.provider === 'qwen3Tts'
                ? 'qwen3-tts'
                : null),
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
      provider: resolveSampleProvider(options.provider),
      mode: options.mode,
    }),
  };
}

export function isLatestTtsRequest(requestId: number) {
  return requestId === activeRequestId;
}
