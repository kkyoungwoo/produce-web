import { AudioPreviewAsset } from '../types';

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 33) + char.charCodeAt(0) + index) >>> 0, 11);
}

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

function createSampleVoice(text: string, preset: string) {
  const sampleRate = 22050;
  const seconds = Math.max(3, Math.min(12, Math.ceil(text.length / 18)));
  const total = sampleRate * seconds;
  const seed = hashCode(`${preset}:${text}`);
  const base = preset === 'qwen-soft' ? 210 : 180;
  const freq = base + (seed % 50);
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t / 0.08) * Math.min(1, (seconds - t) / 0.22);
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.18;
    const overtone = Math.sin(2 * Math.PI * freq * 2 * t) * 0.08;
    const pulse = Math.sin(2 * Math.PI * 4 * t) * 0.03;
    samples[i] = (tone + overtone + pulse) * envelope;
  }
  return { audioData: wavFromSamples(samples, sampleRate), duration: seconds };
}

export async function createQwenTtsAsset(options: {
  title: string;
  text: string;
  preset?: string | null;
  mode: AudioPreviewAsset['mode'];
}): Promise<AudioPreviewAsset> {
  const preset = options.preset || 'qwen-default';
  const sample = createSampleVoice(options.text, preset);
  return {
    id: `qwen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: options.title,
    text: options.text,
    audioData: sample.audioData,
    duration: sample.duration,
    provider: 'qwen3Tts',
    mode: options.mode,
    sourceMode: 'sample',
    voiceId: preset,
    modelId: 'qwen3-tts',
    createdAt: Date.now(),
  };
}
