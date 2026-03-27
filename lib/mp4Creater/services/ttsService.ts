import { AudioPreviewAsset, SubtitleData } from '../types';
import { generateAudioWithElevenLabs } from './elevenLabsService';
import { generateAudioWithHeyGen } from './heygenService';
import { generateAudioWithGoogleTts } from './googleTtsService';
import { resolveGoogleAiStudioApiKey } from './googleAiStudioService';

let activeRequestId = 0;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then((value) => {
      globalThis.clearTimeout(timeoutId);
      resolve(value);
    }).catch((error) => {
      globalThis.clearTimeout(timeoutId);
      reject(error);
    });
  });
}


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


function normalizeFreePreset(provider: 'qwen3Tts' | 'chatterbox', preset?: string | null) {
  const normalized = `${preset || ''}`.trim();
  if (provider === 'qwen3Tts') {
    return normalized || 'qwen-default';
  }
  if (/warm|soft/i.test(normalized)) {
    return 'qwen-soft';
  }
  return 'qwen-default';
}

export async function generateTtsAudio(options: {
  provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  text: string;
  apiKey?: string;
  googleApiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
}) {
  const normalizedProvider = options.provider === 'chatterbox' ? 'qwen3Tts' : options.provider;
  const resolvedGoogleApiKey = resolveGoogleAiStudioApiKey(options.googleApiKey);
  const normalizedFreePreset = normalizedProvider === 'qwen3Tts' || options.provider === 'chatterbox'
    ? normalizeFreePreset(options.provider === 'chatterbox' ? 'chatterbox' : 'qwen3Tts', options.qwenPreset)
    : null;

  if (normalizedProvider === 'elevenLabs' && options.apiKey) {
    return await generateAudioWithElevenLabs(
      options.text,
      options.apiKey,
      options.voiceId || undefined,
      options.modelId as any,
    );
  }

  if (normalizedProvider === 'heygen' && options.apiKey) {
    return await generateAudioWithHeyGen(
      options.text,
      options.apiKey,
      options.voiceId || undefined,
      options.locale || undefined,
    );
  }

  if (normalizedProvider === 'qwen3Tts') {
    if (!resolvedGoogleApiKey) {
      throw new Error('Free TTS requires a Google AI Studio API key.');
    }

    const googlePreset = normalizeFreePreset('qwen3Tts', normalizedFreePreset);
    const googleResult = await generateAudioWithGoogleTts({
      apiKey: resolvedGoogleApiKey,
      provider: 'qwen3Tts',
      text: options.text,
      preset: googlePreset,
      locale: options.locale,
    });

    if (!googleResult.audioData || (googleResult.estimatedDuration || 0) <= 0.25) {
      throw new Error('Google TTS returned no usable audio.');
    }

    return {
      audioData: googleResult.audioData,
      subtitleData: buildEstimatedSubtitleData(options.text, googleResult.estimatedDuration),
      estimatedDuration: googleResult.estimatedDuration,
      sourceMode: 'ai' as const,
      voiceId: googlePreset || options.voiceId || null,
      modelId: googleResult.modelId,
    };
  }

  throw new Error('Unsupported TTS provider configuration.');
}

export async function createTtsPreview(options: {
  provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  title: string;
  text: string;
  mode: AudioPreviewAsset['mode'];
  apiKey?: string;
  googleApiKey?: string;
  voiceId?: string | null;
  modelId?: string | null;
  qwenPreset?: string | null;
  locale?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
}): Promise<{ asset: AudioPreviewAsset; requestId: number }> {
  activeRequestId += 1;
  const requestId = activeRequestId;
  const normalizedProvider = options.provider === 'chatterbox' ? 'qwen3Tts' : options.provider;

  const result = await generateTtsAudio({
    provider: normalizedProvider,
    text: options.text,
    apiKey: options.apiKey,
    googleApiKey: options.googleApiKey,
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
        id: `${normalizedProvider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: options.title,
        text: options.text,
        audioData: result.audioData,
        duration: result.estimatedDuration,
        provider: normalizedProvider === 'heygen' || normalizedProvider === 'elevenLabs' || normalizedProvider === 'qwen3Tts' ? normalizedProvider : 'qwen3Tts',
        mode: options.mode,
        sourceMode: result.sourceMode || 'ai',
        voiceId: result.voiceId || options.voiceId || null,
        modelId:
          result.modelId ||
          options.modelId ||
          (normalizedProvider === 'heygen'
            ? 'starfish'
            : normalizedProvider === 'qwen3Tts'
                ? 'qwen3-tts'
                : null),
        createdAt: Date.now(),
      },
    };
  }

  return {
    requestId,
    asset: {
      id: `${normalizedProvider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: options.title,
      text: options.text,
      audioData: null,
      duration: null,
      provider: normalizedProvider === 'heygen' || normalizedProvider === 'elevenLabs' || normalizedProvider === 'qwen3Tts' ? normalizedProvider : 'qwen3Tts',
      mode: options.mode,
      sourceMode: 'sample',
      voiceId: options.voiceId || options.qwenPreset || null,
      modelId: options.modelId || null,
      createdAt: Date.now(),
    },
  };
}

export function isLatestTtsRequest(requestId: number) {
  return requestId === activeRequestId;
}
