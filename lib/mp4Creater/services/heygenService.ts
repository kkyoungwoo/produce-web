import { CONFIG } from '../config';
import { SubtitleData, SubtitleWord } from '../types';

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  preview_audio_url?: string;
  preview_audio?: string;
  support_pause?: boolean;
  support_locale?: boolean;
  type?: 'public' | 'private';
}

export interface HeyGenAudioResult {
  audioData: string | null;
  subtitleData: SubtitleData | null;
  estimatedDuration: number | null;
  sourceMode: 'ai' | 'sample';
  voiceId?: string | null;
  modelId?: string | null;
  previewUrl?: string | null;
}

const HEYGEN_FALLBACK_VOICES: HeyGenVoice[] = [
  {
    voice_id: 'cerise-cheerful',
    name: 'Cerise · Cheerful',
    language: 'English',
    gender: 'female',
    preview_audio_url: '',
    support_pause: true,
    support_locale: true,
    type: 'public',
  },
  {
    voice_id: 'marcus-professional',
    name: 'Marcus · Professional',
    language: 'English',
    gender: 'male',
    preview_audio_url: '',
    support_pause: true,
    support_locale: false,
    type: 'public',
  },
];

function buildSubtitleData(text: string, duration?: number | null, words?: Array<{ word?: string; start?: number; end?: number }>): SubtitleData | null {
  if (Array.isArray(words) && words.length) {
    const mapped: SubtitleWord[] = words
      .filter((item) => typeof item?.word === 'string' && item.word)
      .map((item) => ({
        word: String(item.word),
        start: Number(item.start || 0),
        end: Number(item.end || 0),
      }));
    if (mapped.length) {
      return { words: mapped, fullText: text };
    }
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length || !duration) return null;
  const span = duration / Math.max(1, tokens.length);
  return {
    words: tokens.map((word, index) => ({
      word,
      start: Number((index * span).toFixed(2)),
      end: Number(((index + 1) * span).toFixed(2)),
    })),
    fullText: text,
  };
}

export async function fetchHeyGenVoices(apiKey?: string): Promise<HeyGenVoice[]> {
  const finalKey = apiKey || (typeof window !== 'undefined' ? localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY) : '') || '';
  if (!finalKey || finalKey.length < 10) return HEYGEN_FALLBACK_VOICES;

  try {
    const response = await fetch('/api/mp4Creater/heygen/voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: finalKey, limit: 100 }),
    });
    if (!response.ok) throw new Error('heygen voices failed');
    const data = await response.json();
    const voices = Array.isArray(data?.voices) ? (data.voices as HeyGenVoice[]) : [];
    return voices.length ? voices : HEYGEN_FALLBACK_VOICES;
  } catch {
    return HEYGEN_FALLBACK_VOICES;
  }
}

export async function generateAudioWithHeyGen(
  text: string,
  providedApiKey?: string,
  providedVoiceId?: string,
  locale?: string | null,
): Promise<HeyGenAudioResult> {
  const finalKey = providedApiKey || (typeof window !== 'undefined' ? localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY) : '') || '';
  const finalVoiceId = providedVoiceId || (typeof window !== 'undefined' ? localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_VOICE_ID) : '') || HEYGEN_FALLBACK_VOICES[0].voice_id;

  if (!finalKey || finalKey.length < 10) {
    return {
      audioData: null,
      subtitleData: null,
      estimatedDuration: null,
      sourceMode: 'sample',
      voiceId: finalVoiceId,
      modelId: 'starfish',
      previewUrl: null,
    };
  }

  try {
    const response = await fetch('/api/mp4Creater/heygen/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: finalKey,
        text,
        voiceId: finalVoiceId,
        locale: locale || undefined,
      }),
    });
    if (!response.ok) throw new Error('heygen tts failed');
    const data = await response.json();
    const duration = typeof data?.duration === 'number' ? data.duration : null;
    return {
      audioData: typeof data?.audioData === 'string' ? data.audioData : null,
      subtitleData: buildSubtitleData(text, duration, Array.isArray(data?.wordTimestamps) ? data.wordTimestamps : []),
      estimatedDuration: duration,
      sourceMode: typeof data?.audioData === 'string' && data.audioData ? 'ai' : 'sample',
      voiceId: finalVoiceId,
      modelId: 'starfish',
      previewUrl: typeof data?.audioUrl === 'string' ? data.audioUrl : null,
    };
  } catch {
    return {
      audioData: null,
      subtitleData: null,
      estimatedDuration: null,
      sourceMode: 'sample',
      voiceId: finalVoiceId,
      modelId: 'starfish',
      previewUrl: null,
    };
  }
}
