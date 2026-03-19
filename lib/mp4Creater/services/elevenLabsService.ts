import { CONFIG, ElevenLabsModelId, ELEVENLABS_DEFAULT_VOICES } from '../config';
import { SubtitleData, SubtitleWord } from '../types';

const OUTPUT_FORMAT = 'mp3_44100_128';

export const getElevenLabsModelId = (): ElevenLabsModelId => {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL);
  return (saved as ElevenLabsModelId) || CONFIG.DEFAULT_ELEVENLABS_MODEL;
};

export const setElevenLabsModelId = (modelId: ElevenLabsModelId): void => {
  localStorage.setItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL, modelId);
};

export interface ElevenLabsResult {
  audioData: string | null;
  subtitleData: SubtitleData | null;
  estimatedDuration: number | null;
  sourceMode: 'ai' | 'sample';
  voiceId?: string | null;
  modelId?: string | null;
}

function buildWordLevelSubtitle(text: string, estimatedDuration: number): SubtitleData {
  const words = text.split(/\s+/).filter(Boolean);
  const span = estimatedDuration / Math.max(1, words.length);
  const result: SubtitleWord[] = words.map((word, index) => ({
    word,
    start: Number((index * span).toFixed(2)),
    end: Number(((index + 1) * span).toFixed(2)),
  }));
  return { words: result, fullText: text };
}

export const generateAudioWithElevenLabs = async (
  text: string,
  providedApiKey?: string,
  providedVoiceId?: string,
  providedModelId?: ElevenLabsModelId
): Promise<ElevenLabsResult> => {
  const savedApiKey = process.env.ELEVENLABS_API_KEY || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY);
  const savedVoiceId = process.env.ELEVENLABS_VOICE_ID || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_VOICE_ID);

  const finalKey = providedApiKey || savedApiKey;
  const finalVoiceId = providedVoiceId || savedVoiceId || CONFIG.DEFAULT_VOICE_ID;
  const finalModelId = providedModelId || getElevenLabsModelId();

  if (!finalKey || finalKey.length < 10) {
    return { audioData: null, subtitleData: null, estimatedDuration: null, sourceMode: 'sample', voiceId: finalVoiceId, modelId: finalModelId };
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/with-timestamps`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': finalKey,
      },
      body: JSON.stringify({
        text,
        model_id: finalModelId,
        output_format: OUTPUT_FORMAT,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      return { audioData: null, subtitleData: null, estimatedDuration: null, sourceMode: 'sample', voiceId: finalVoiceId, modelId: finalModelId };
    }

    const jsonResponse = await response.json();
    const audioBase64 = jsonResponse.audio_base64 || null;
    const estimatedDuration = Math.max(2, Number(jsonResponse?.alignment?.character_end_times_seconds?.slice?.(-1)?.[0] || text.length / 8));
    const subtitleData = audioBase64 ? buildWordLevelSubtitle(text, estimatedDuration) : null;

    return {
      audioData: audioBase64,
      subtitleData,
      estimatedDuration,
      sourceMode: audioBase64 ? 'ai' : 'sample',
      voiceId: finalVoiceId,
      modelId: finalModelId,
    };
  } catch {
    return { audioData: null, subtitleData: null, estimatedDuration: null, sourceMode: 'sample', voiceId: finalVoiceId, modelId: finalModelId };
  }
};

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    description?: string;
    use_case?: string;
  };
  preview_url?: string;
}

export const fetchElevenLabsVoices = async (apiKey?: string): Promise<ElevenLabsVoice[]> => {
  const finalKey = apiKey || process.env.ELEVENLABS_API_KEY || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY);
  if (!finalKey || finalKey.length < 10) {
    return ELEVENLABS_DEFAULT_VOICES.map((voice) => ({
      voice_id: voice.id,
      name: voice.name,
      category: 'default',
      labels: {
        accent: voice.accent,
        gender: voice.gender,
        description: voice.description,
      },
    }));
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': finalKey },
    });
    if (!response.ok) throw new Error('voice fetch failed');
    const data = await response.json();
    const voices: ElevenLabsVoice[] = data.voices || [];
    return voices.length ? voices : ELEVENLABS_DEFAULT_VOICES.map((voice) => ({
      voice_id: voice.id,
      name: voice.name,
      category: 'default',
      labels: {
        accent: voice.accent,
        gender: voice.gender,
        description: voice.description,
      },
    }));
  } catch {
    return ELEVENLABS_DEFAULT_VOICES.map((voice) => ({
      voice_id: voice.id,
      name: voice.name,
      category: 'default',
      labels: {
        accent: voice.accent,
        gender: voice.gender,
        description: voice.description,
      },
    }));
  }
};
