const LIGHT_MODEL_ID = 'ipsilondev/chatterbox-multilingual-ONNX-q4';
const HEAVY_MODEL_ID = 'onnx-community/chatterbox-multilingual-ONNX';
const DEFAULT_SAMPLE_RATE = 24000;
const MAX_CHUNK_LENGTH = 130;
const MAX_CHUNK_SENTENCES = 2;
const INTER_CHUNK_SILENCE_SECONDS = 0.06;

type FreeTtsProvider = 'qwen3Tts' | 'chatterbox';

type TransformersLike = {
  AutoProcessor: {
    from_pretrained: (modelId: string, options?: Record<string, unknown>) => Promise<any>;
  };
  ChatterboxModel: {
    from_pretrained: (modelId: string, options?: Record<string, unknown>) => Promise<any>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => any;
};

type CachedModelEntry = {
  modelId: string;
  processor: any;
  model: any;
  sampleRate: number;
  defaultSpeakerEmbeddings: any | null;
};

type ToneShapingProfile = {
  pitchScale: number;
  brightness: number;
  body: number;
  gain: number;
};

const modelCache = new Map<string, Promise<CachedModelEntry>>();

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeLocale(locale?: string | null) {
  const raw = (locale || 'ko').trim().toLowerCase();
  if (!raw || raw === 'mute') return 'ko';
  if (raw.startsWith('ko')) return 'ko';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ja')) return 'ja';
  if (raw.startsWith('zh')) return 'zh';
  if (raw.startsWith('vi')) return 'vi';
  if (raw.startsWith('th')) return 'th';
  if (raw.startsWith('uz')) return 'uz';
  if (raw.startsWith('mn')) return 'mn';
  return 'ko';
}

function getReferenceTextForLocale(locale?: string | null) {
  const normalized = normalizeLocale(locale);
  switch (normalized) {
    case 'en':
      return 'Hello. This is a short reference line for a voice check.';
    case 'ja':
      return 'こんにちは。これは音声確認用の短いサンプルです。';
    case 'zh':
      return '你好，这是一段用于检查声音的简短示例。';
    case 'vi':
      return 'Xin chào. Đây là một câu mẫu ngắn để kiểm tra giọng nói.';
    case 'th':
      return 'สวัสดี นี่คือตัวอย่างสั้น ๆ สำหรับตรวจสอบเสียงพูด';
    case 'uz':
      return 'Salom. Bu ovozni tekshirish uchun qisqa namunadir.';
    case 'mn':
      return 'Сайн байна уу. Энэ бол дуу хоолой шалгах богино жишээ юм.';
    default:
      return '안녕하세요. 지금 선택한 무료 음성 모델을 확인합니다.';
  }
}

function splitParagraph(paragraph: string, maxLength: number) {
  const sentences = paragraph
    .split(/(?<=[.!?。！？\n])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) return [paragraph.trim()].filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';
  let bufferCount = 0;

  for (const sentence of sentences) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    const shouldFlush = buffer && (next.length > maxLength || bufferCount >= MAX_CHUNK_SENTENCES);
    if (shouldFlush) {
      chunks.push(buffer.trim());
      buffer = sentence;
      bufferCount = 1;
      continue;
    }
    buffer = next;
    bufferCount += 1;
  }

  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) return [chunk];
    const words = chunk.split(/\s+/).filter(Boolean);
    const pieces: string[] = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && next.length > maxLength) {
        pieces.push(current.trim());
        current = word;
      } else {
        current = next;
      }
    });
    if (current.trim()) pieces.push(current.trim());
    return pieces;
  });
}

function splitTextForBrowserTts(text: string) {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

  if (!paragraphs.length) return splitParagraph(cleaned, MAX_CHUNK_LENGTH);
  return paragraphs.flatMap((paragraph) => splitParagraph(paragraph, MAX_CHUNK_LENGTH)).filter(Boolean);
}

function hasWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function resolveDevice() {
  return hasWebGPU() ? 'webgpu' : 'wasm';
}

function resolveDtype(provider: FreeTtsProvider, device: 'webgpu' | 'wasm') {
  const lightDtype = device === 'webgpu'
    ? { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q4f16', conditional_decoder: 'fp32' }
    : { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q4', conditional_decoder: 'fp32' };

  const heavyDtype = device === 'webgpu'
    ? { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'fp16', conditional_decoder: 'fp32' }
    : { embed_tokens: 'fp32', speech_encoder: 'fp32', language_model: 'q8', conditional_decoder: 'fp32' };

  return provider === 'chatterbox' ? heavyDtype : lightDtype;
}

function resolveModelId(provider: FreeTtsProvider) {
  return provider === 'chatterbox' ? HEAVY_MODEL_ID : LIGHT_MODEL_ID;
}

function resolveExaggeration(provider: FreeTtsProvider, preset?: string | null) {
  const normalized = (preset || '').trim().toLowerCase();
  if (normalized.includes('warm') || normalized.includes('soft')) return provider === 'chatterbox' ? 0.72 : 0.64;
  return provider === 'chatterbox' ? 0.52 : 0.46;
}

function resolveToneShapingProfile(
  provider: FreeTtsProvider,
  preset?: string | null,
  hasVoiceReference: boolean = false,
): ToneShapingProfile {
  if (provider === 'chatterbox' && hasVoiceReference) {
    return {
      pitchScale: 1,
      brightness: 0.02,
      body: 0.08,
      gain: 1,
    };
  }

  const normalized = (preset || '').trim().toLowerCase();
  if (provider === 'qwen3Tts') {
    if (normalized.includes('soft')) {
      return {
        pitchScale: 1.08,
        brightness: 0.16,
        body: -0.02,
        gain: 0.98,
      };
    }
    return {
      pitchScale: 0.93,
      brightness: -0.05,
      body: 0.12,
      gain: 1.02,
    };
  }

  if (normalized.includes('warm')) {
    return {
      pitchScale: 1.03,
      brightness: 0.03,
      body: 0.1,
      gain: 1,
    };
  }

  return {
    pitchScale: 0.96,
    brightness: 0.06,
    body: 0.04,
    gain: 1,
  };
}

function resizeFloat32Linear(input: Float32Array, targetLength: number) {
  if (!input.length || targetLength <= 0) return new Float32Array();
  if (input.length === targetLength) return input.slice();
  const output = new Float32Array(targetLength);
  const lastIndex = Math.max(0, input.length - 1);
  for (let index = 0; index < targetLength; index += 1) {
    const position = targetLength === 1 ? 0 : (index / (targetLength - 1)) * lastIndex;
    const left = Math.floor(position);
    const right = Math.min(lastIndex, left + 1);
    const mix = position - left;
    output[index] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

function shiftPitchPreserveDuration(input: Float32Array, pitchScale: number) {
  if (!input.length || !Number.isFinite(pitchScale) || Math.abs(pitchScale - 1) < 0.01) {
    return input.slice();
  }
  const shiftedLength = Math.max(1, Math.round(input.length / Math.max(0.65, Math.min(1.35, pitchScale))));
  const shifted = resizeFloat32Linear(input, shiftedLength);
  return resizeFloat32Linear(shifted, input.length);
}

function lowPassFilter(input: Float32Array, smoothing: number) {
  if (!input.length) return new Float32Array();
  const alpha = Math.max(0.01, Math.min(0.35, smoothing));
  const output = new Float32Array(input.length);
  let previous = input[0] || 0;
  output[0] = previous;
  for (let index = 1; index < input.length; index += 1) {
    previous += alpha * ((input[index] || 0) - previous);
    output[index] = previous;
  }
  return output;
}

function normalizePeak(input: Float32Array, targetPeak: number = 0.92) {
  if (!input.length) return input;
  let peak = 0;
  for (let index = 0; index < input.length; index += 1) {
    const magnitude = Math.abs(input[index] || 0);
    if (magnitude > peak) peak = magnitude;
  }
  if (!peak || peak <= targetPeak) return input;
  const scale = targetPeak / peak;
  const output = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index] * scale;
  }
  return output;
}

function applyToneShaping(input: Float32Array, profile: ToneShapingProfile) {
  if (!input.length) return input;
  const pitchShifted = shiftPitchPreserveDuration(input, profile.pitchScale);
  const low = lowPassFilter(pitchShifted, 0.08);
  const output = new Float32Array(pitchShifted.length);
  for (let index = 0; index < pitchShifted.length; index += 1) {
    const sample = pitchShifted[index] || 0;
    const lowSample = low[index] || 0;
    const highSample = sample - lowSample;
    output[index] = (sample + lowSample * profile.body + highSample * profile.brightness) * profile.gain;
  }
  return normalizePeak(output);
}

function float32ToBase64Wav(samples: Float32Array, sampleRate = DEFAULT_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] || 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return {
    base64,
    dataUrl: `data:audio/wav;base64,${base64}`,
  };
}

function concatWaveforms(parts: Float32Array[], sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!parts.length) return new Float32Array();
  const silenceLength = Math.max(0, Math.floor(sampleRate * INTER_CHUNK_SILENCE_SECONDS));
  const totalLength = parts.reduce((sum, item, index) => {
    return sum + item.length + (index < parts.length - 1 ? silenceLength : 0);
  }, 0);

  const merged = new Float32Array(totalLength);
  let cursor = 0;
  parts.forEach((part, index) => {
    merged.set(part, cursor);
    cursor += part.length;
    if (index < parts.length - 1 && silenceLength > 0) {
      cursor += silenceLength;
    }
  });
  return merged;
}

function resampleFloat32(input: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate === targetRate || !input.length) return input;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const mix = position - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

async function decodeAudioDataToMonoFloat32(source: string) {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('참조 음성을 불러오지 못했습니다.');
  }
  const arrayBuffer = await response.arrayBuffer();
  const AudioContextCtor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AudioContextCtor) {
    throw new Error('이 브라우저는 오디오 디코딩을 지원하지 않습니다.');
  }
  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const channel = decoded.getChannelData(0);
    return resampleFloat32(channel, decoded.sampleRate, DEFAULT_SAMPLE_RATE);
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function loadTransformersRuntime(): Promise<TransformersLike> {
  const runtime = await import('@huggingface/transformers');
  return runtime as unknown as TransformersLike;
}

async function loadModelEntry(provider: FreeTtsProvider): Promise<CachedModelEntry> {
  if (!isBrowser()) {
    throw new Error('브라우저 환경에서만 무료 TTS를 생성할 수 있습니다.');
  }

  const modelId = resolveModelId(provider);
  const cached = modelCache.get(modelId);
  if (cached) return cached;

  const pending = (async () => {
    const runtime = await loadTransformersRuntime();
    const device = resolveDevice();
    const dtype = resolveDtype(provider, device);
    const processor = await runtime.AutoProcessor.from_pretrained(modelId);
    const model = await runtime.ChatterboxModel.from_pretrained(modelId, {
      device,
      dtype,
    });
    return {
      modelId,
      processor,
      model,
      sampleRate: DEFAULT_SAMPLE_RATE,
      defaultSpeakerEmbeddings: null,
    } satisfies CachedModelEntry;
  })().catch((error) => {
    modelCache.delete(modelId);
    throw error;
  });

  modelCache.set(modelId, pending);
  return pending;
}

async function getDefaultSpeakerEmbeddings(entry: CachedModelEntry, runtime: TransformersLike) {
  if (entry.defaultSpeakerEmbeddings) return entry.defaultSpeakerEmbeddings;
  const referenceAudio = await decodeAudioDataToMonoFloat32(`https://huggingface.co/${entry.modelId}/resolve/main/default_voice.wav`);
  const tensor = new runtime.Tensor('float32', referenceAudio, [1, referenceAudio.length]);
  entry.defaultSpeakerEmbeddings = await entry.model.encode_speech(tensor);
  return entry.defaultSpeakerEmbeddings;
}

async function getSpeakerEmbeddings(options: {
  entry: CachedModelEntry;
  runtime: TransformersLike;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
}) {
  const { entry, runtime, voiceReferenceAudioData, voiceReferenceMimeType } = options;
  if (voiceReferenceAudioData && voiceReferenceMimeType) {
    const source = `data:${voiceReferenceMimeType};base64,${voiceReferenceAudioData}`;
    const audio = await decodeAudioDataToMonoFloat32(source);
    const tensor = new runtime.Tensor('float32', audio, [1, audio.length]);
    return await entry.model.encode_speech(tensor);
  }
  return await getDefaultSpeakerEmbeddings(entry, runtime);
}

async function generateChunk(entry: CachedModelEntry, runtime: TransformersLike, text: string, speakerEmbeddings: any, exaggeration: number) {
  const inputs = await entry.processor._call(text);
  const waveform = await entry.model.generate({
    ...inputs,
    ...speakerEmbeddings,
    exaggeration,
    max_new_tokens: 256,
  });
  const data = waveform?.data instanceof Float32Array ? waveform.data : new Float32Array(waveform?.data || []);
  return data;
}

export async function generateBrowserFreeTts(options: {
  provider: FreeTtsProvider;
  text: string;
  preset?: string | null;
  locale?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
}) {
  const chunks = splitTextForBrowserTts(options.text);
  if (!chunks.length) {
    return {
      audioData: null,
      estimatedDuration: 0,
      sourceMode: 'sample' as const,
      modelId: resolveModelId(options.provider),
      usedLocale: normalizeLocale(options.locale),
      usedVoiceReference: Boolean(options.voiceReferenceAudioData),
    };
  }

  const runtime = await loadTransformersRuntime();
  const entry = await loadModelEntry(options.provider);
  const speakerEmbeddings = await getSpeakerEmbeddings({
    entry,
    runtime,
    voiceReferenceAudioData: options.voiceReferenceAudioData,
    voiceReferenceMimeType: options.voiceReferenceMimeType,
  });
  const exaggeration = resolveExaggeration(options.provider, options.preset);
  const toneShaping = resolveToneShapingProfile(
    options.provider,
    options.preset,
    Boolean(options.voiceReferenceAudioData),
  );
  const waveforms: Float32Array[] = [];

  for (const chunk of chunks) {
    const waveform = await generateChunk(entry, runtime, chunk, speakerEmbeddings, exaggeration);
    if (waveform.length) waveforms.push(waveform);
  }

  const merged = concatWaveforms(waveforms, entry.sampleRate);
  const shaped = applyToneShaping(merged, toneShaping);
  const wav = float32ToBase64Wav(shaped, entry.sampleRate);

  return {
    audioData: wav.dataUrl,
    estimatedDuration: shaped.length / entry.sampleRate,
    sourceMode: 'ai' as const,
    modelId: entry.modelId,
    usedLocale: normalizeLocale(options.locale),
    usedVoiceReference: Boolean(options.voiceReferenceAudioData),
    referenceText: getReferenceTextForLocale(options.locale),
  };
}

export function getBrowserFreeTtsModelLabel(provider: FreeTtsProvider) {
  return provider === 'chatterbox' ? 'Chatterbox 고품질 모델' : 'Chatterbox 경량 모델';
}
