import { AudioPreviewAsset } from '../types';

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 33) + char.charCodeAt(0) + index) >>> 0, 11);
}

type FormantFrame = {
  f1: number;
  f2: number;
  f3: number;
};

type VoiceReferenceProfile = {
  seed: number;
  basePitch: number;
  breathNoise: number;
  vibratoRate: number;
  frames: FormantFrame[];
};

function wavFromSamples(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
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
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof window !== 'undefined' ? btoa(binary) : (globalThis as any).Buffer.from(buffer).toString('base64');
  return `data:audio/wav;base64,${base64}`;
}

function pickVoiceFrames(seed: number): FormantFrame[] {
  const vowelBanks: FormantFrame[] = [
    { f1: 730, f2: 1090, f3: 2440 },
    { f1: 570, f2: 840, f3: 2410 },
    { f1: 300, f2: 2320, f3: 3000 },
    { f1: 440, f2: 1020, f3: 2240 },
    { f1: 640, f2: 1190, f3: 2390 },
    { f1: 360, f2: 1750, f3: 2750 },
  ];
  return [0, 1, 2, 3].map((offset) => vowelBanks[(seed + offset) % vowelBanks.length]);
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null);
}

async function decodeVoiceReferenceToMono(audioData?: string | null, mimeType?: string | null) {
  if (typeof window === 'undefined' || !audioData) return null;
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) return null;

  const dataUrl = audioData.startsWith('data:')
    ? audioData
    : `data:${mimeType || 'audio/webm'};base64,${audioData}`;

  const response = await fetch(dataUrl);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelCount = Math.max(1, decoded.numberOfChannels);
    const mono = new Float32Array(decoded.length);
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = decoded.getChannelData(channelIndex);
      for (let sampleIndex = 0; sampleIndex < decoded.length; sampleIndex += 1) {
        mono[sampleIndex] += channel[sampleIndex] / channelCount;
      }
    }
    return { samples: mono, sampleRate: decoded.sampleRate };
  } catch {
    return null;
  } finally {
    await context.close().catch(() => undefined);
  }
}

function estimateZeroCrossingPitch(samples: Float32Array, sampleRate: number) {
  let crossings = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const prev = samples[index - 1];
    const current = samples[index];
    if ((prev <= 0 && current > 0) || (prev >= 0 && current < 0)) {
      crossings += 1;
    }
  }
  const seconds = samples.length / Math.max(1, sampleRate);
  if (!seconds) return 0;
  return (crossings / 2) / seconds;
}

function estimateRms(samples: Float32Array) {
  if (!samples.length) return 0;
  let total = 0;
  for (let index = 0; index < samples.length; index += 1) {
    total += samples[index] * samples[index];
  }
  return Math.sqrt(total / samples.length);
}

async function buildVoiceReferenceProfile(audioData?: string | null, mimeType?: string | null): Promise<VoiceReferenceProfile | null> {
  const decoded = await decodeVoiceReferenceToMono(audioData, mimeType);
  if (!decoded?.samples.length) return null;

  const seedSource = decoded.samples.subarray(0, Math.min(decoded.samples.length, 4096));
  let seedBinary = '';
  for (let index = 0; index < seedSource.length; index += 32) {
    seedBinary += String.fromCharCode(Math.round((seedSource[index] || 0) * 127 + 128));
  }
  const seed = hashCode(seedBinary || 'custom-voice');
  const pitchEstimate = estimateZeroCrossingPitch(decoded.samples, decoded.sampleRate);
  const rms = estimateRms(decoded.samples);
  const basePitch = Math.max(105, Math.min(235, Number.isFinite(pitchEstimate) && pitchEstimate > 0 ? pitchEstimate : 155));
  const breathNoise = Math.max(0.004, Math.min(0.018, rms * 0.09));
  const vibratoRate = 4 + ((seed >> 5) % 16) * 0.1;
  const frames = pickVoiceFrames(seed).map((frame, index) => ({
    f1: Math.max(280, Math.min(820, frame.f1 + (((seed >> (index + 1)) % 11) - 5) * 12)),
    f2: Math.max(780, Math.min(2500, frame.f2 + (((seed >> (index + 3)) % 13) - 6) * 18)),
    f3: Math.max(2100, Math.min(3200, frame.f3 + (((seed >> (index + 6)) % 15) - 7) * 20)),
  }));

  return {
    seed,
    basePitch,
    breathNoise,
    vibratoRate,
    frames,
  };
}

function createSpeechLikeSample(text: string, preset: string, profile?: VoiceReferenceProfile | null) {
  const sampleRate = 22050;
  const seconds = Math.max(3, Math.min(12, Math.ceil(text.length / 20)));
  const total = sampleRate * seconds;
  const seed = profile?.seed || hashCode(`${preset}:${text}`);
  const voicedPitch = profile?.basePitch || ((preset === 'qwen-soft' ? 185 : 155) + (seed % 24));
  const voiceFrames = profile?.frames || pickVoiceFrames(seed);
  const samples = new Float32Array(total);
  const frameDuration = 0.11;
  const vibratoRate = profile?.vibratoRate || (4.6 + ((seed >> 4) % 12) * 0.1);
  const breathNoise = profile?.breathNoise || (preset.includes('soft') ? 0.012 : 0.008);

  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t / 0.08) * Math.min(1, (seconds - t) / 0.28);
    const frameIndex = Math.min(voiceFrames.length - 1, Math.floor((t / seconds) * voiceFrames.length));
    const nextFrameIndex = Math.min(voiceFrames.length - 1, frameIndex + 1);
    const mix = ((t / frameDuration) % 1);
    const current = voiceFrames[frameIndex];
    const next = voiceFrames[nextFrameIndex];
    const f1 = current.f1 * (1 - mix) + next.f1 * mix;
    const f2 = current.f2 * (1 - mix) + next.f2 * mix;
    const f3 = current.f3 * (1 - mix) + next.f3 * mix;
    const pitch = voicedPitch + Math.sin(2 * Math.PI * vibratoRate * t) * 4;
    const glottal = Math.sin(2 * Math.PI * pitch * t) * 0.14;
    const harmonic2 = Math.sin(2 * Math.PI * pitch * 2 * t) * 0.08;
    const harmonic3 = Math.sin(2 * Math.PI * pitch * 3 * t) * 0.05;
    const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.12;
    const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.06;
    const formant3 = Math.sin(2 * Math.PI * f3 * t) * 0.03;
    const syllablePulse = 0.55 + 0.45 * Math.max(0, Math.sin(2 * Math.PI * 5.2 * t));
    const aspiration = (((seed + i * 17) % 101) / 101 - 0.5) * breathNoise;
    samples[i] = (glottal + harmonic2 + harmonic3 + formant1 + formant2 + formant3 + aspiration) * envelope * syllablePulse;
  }
  return { audioData: wavFromSamples(samples, sampleRate), duration: seconds };
}

export async function createQwenTtsAsset(options: {
  title: string;
  text: string;
  preset?: string | null;
  provider?: 'qwen3Tts' | 'chatterbox';
  mode: AudioPreviewAsset['mode'];
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
}): Promise<AudioPreviewAsset> {
  const preset = options.preset || 'qwen-default';
  const requestedProvider = options.provider === 'chatterbox' ? 'chatterbox' : 'qwen3Tts';
  const customReferenceProfile = requestedProvider === 'chatterbox'
    ? await buildVoiceReferenceProfile(options.voiceReferenceAudioData, options.voiceReferenceMimeType)
    : null;
  const sample = createSpeechLikeSample(options.text, preset, customReferenceProfile);
  const fallbackModelId = requestedProvider === 'chatterbox'
    ? (customReferenceProfile ? 'sample-reference-fallback/chatterbox' : 'sample-tone-fallback/chatterbox')
    : 'sample-tone-fallback/qwen3';
  return {
    id: `qwen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: options.title,
    text: options.text,
    audioData: sample.audioData,
    duration: sample.duration,
    provider: requestedProvider,
    mode: options.mode,
    sourceMode: 'sample',
    voiceId: preset,
    modelId: fallbackModelId,
    createdAt: Date.now(),
  };
}
