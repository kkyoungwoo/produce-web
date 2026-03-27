type SupportedFreeTtsProvider = 'qwen3Tts' | 'chatterbox';

const GEMINI_TTS_FLASH_MODEL = 'gemini-2.5-flash-preview-tts';
const PCM_SAMPLE_RATE = 24000;

const PROVIDER_VOICE_MAP: Record<SupportedFreeTtsProvider, Record<string, { voiceName: string; direction: string }>> = {
  qwen3Tts: {
    'qwen-default': {
      voiceName: 'Alnilam',
      direction: 'Read in natural Korean with a firm, grounded, and stable narrator tone. Keep articulation clear, pacing balanced, and the register slightly lower and fuller than the soft preset.',
    },
    'qwen-soft': {
      voiceName: 'Achernar',
      direction: 'Read in Korean with a soft, calm, and slightly warmer delivery while staying clear and easy to follow.',
    },
  },
  chatterbox: {
    'chatterbox-clear': {
      voiceName: 'Iapetus',
      direction: 'Read in Korean with precise articulation, cleaner consonants, and a polished studio narration tone.',
    },
    'chatterbox-warm': {
      voiceName: 'Sulafat',
      direction: 'Read in Korean with a warmer, more human, and gentler conversational tone while keeping the pacing steady.',
    },
  },
};

function resolveVoicePreset(provider: SupportedFreeTtsProvider, preset?: string | null) {
  const normalizedPreset = (preset || '').trim();
  const presets = PROVIDER_VOICE_MAP[provider];
  return presets[normalizedPreset] || presets[Object.keys(presets)[0]] || {
    voiceName: 'Kore',
    direction: 'Read in natural Korean with stable narration pacing.',
  };
}

function buildPrompt(text: string, provider: SupportedFreeTtsProvider, preset?: string | null, locale?: string | null) {
  const resolved = resolveVoicePreset(provider, preset);
  const language = (locale || 'ko').trim().toLowerCase().startsWith('en') ? 'English' : 'Korean';
  return [
    resolved.direction,
    `Read the transcript in ${language}.`,
    'Output spoken voice only.',
    'Do not sing, hum, whisper effects, breathe theatrically, add background sound, or create nonverbal sound effects.',
    'Keep the delivery natural, with clear mouth-shape timing and smooth phrase breathing.',
    'Transcript:',
    text.trim(),
  ].join('\n');
}

function base64ToBytes(base64: string) {
  if (typeof window !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return Uint8Array.from((globalThis as any).Buffer.from(base64, 'base64'));
}

function parseSampleRateFromMimeType(mimeType?: string | null) {
  const match = `${mimeType || ''}`.match(/rate=(\d+)/i);
  const parsed = Number(match?.[1] || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PCM_SAMPLE_RATE;
}

function normalizeGoogleAudioBytesForWav(bytes: Uint8Array, mimeType?: string | null) {
  // Google TTS inline audio is returned as raw PCM that matches the official
  // `ffmpeg -f s16le` decode example. Swapping bytes here corrupts speech into
  // metallic/noise-like output, so we preserve the payload as-is.
  return bytes;
}

function wrapPcm16MonoToWav(pcmBytes: Uint8Array, sampleRate = PCM_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmBytes.length, true);

  new Uint8Array(buffer, 44).set(pcmBytes);

  const bytes = new Uint8Array(buffer);
  if (typeof window !== 'undefined') {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:audio/wav;base64,${btoa(binary)}`;
  }
  return `data:audio/wav;base64,${(globalThis as any).Buffer.from(buffer).toString('base64')}`;
}

function extractInlineAudioPart(json: any) {
  const parts = json?.candidates?.[0]?.content?.parts || json?.candidates?.[0]?.content?.parts || [];
  const audioPart = Array.isArray(parts)
    ? parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data)
    : null;
  return {
    data: audioPart?.inlineData?.data || audioPart?.inline_data?.data || '',
    mimeType: audioPart?.inlineData?.mimeType || audioPart?.inline_data?.mime_type || '',
  };
}

export async function generateAudioWithGoogleTts(options: {
  apiKey: string;
  provider: SupportedFreeTtsProvider;
  text: string;
  preset?: string | null;
  locale?: string | null;
}) {
  const finalKey = (options.apiKey || '').trim();
  if (!finalKey || finalKey.length < 10 || !options.text.trim()) {
    return { audioData: null, estimatedDuration: null, modelId: GEMINI_TTS_FLASH_MODEL, voiceName: null };
  }

  const resolved = resolveVoicePreset(options.provider, options.preset);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), 20000)
    : null;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TTS_FLASH_MODEL)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': finalKey,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: buildPrompt(options.text, options.provider, options.preset, options.locale),
        }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: resolved.voiceName,
            },
          },
        },
      },
      model: GEMINI_TTS_FLASH_MODEL,
    }),
    signal: controller?.signal,
  }).finally(() => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  });

  if (!response.ok) {
    throw new Error(`Google TTS request failed (${response.status})`);
  }

  const json = await response.json();
  const inlineAudio = extractInlineAudioPart(json);
  const sampleRate = parseSampleRateFromMimeType(inlineAudio.mimeType);
  const rawBytes = inlineAudio.data ? base64ToBytes(inlineAudio.data) : null;
  const wavReadyBytes = rawBytes ? normalizeGoogleAudioBytesForWav(rawBytes, inlineAudio.mimeType) : null;
  if (!wavReadyBytes || !wavReadyBytes.length) {
    throw new Error('Google TTS returned no audio data');
  }

  const estimatedDuration = Number(((wavReadyBytes.length / 2) / sampleRate).toFixed(2));
  return {
    audioData: wrapPcm16MonoToWav(wavReadyBytes, sampleRate),
    estimatedDuration: estimatedDuration > 0 ? estimatedDuration : null,
    modelId: GEMINI_TTS_FLASH_MODEL,
    voiceName: resolved.voiceName,
  };
}
