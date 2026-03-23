import { BackgroundMusicTrack, WorkflowDraft } from '../types';

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 31) + char.charCodeAt(0) + index) >>> 0, 7);
}

function wavFromSamples(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  }

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
  if (typeof window !== 'undefined') return btoa(binary);
  return (globalThis as any).Buffer.from(buffer).toString('base64');
}

function createAmbientTrack(seedText: string, seconds = 14, mood = 'ambient') {
  const sampleRate = 22050;
  const length = sampleRate * seconds;
  const samples = new Float32Array(length);
  const seed = hashCode(seedText);
  const base = mood === 'cinematic' ? 140 : mood === 'news' ? 220 : 180;
  const root = base + (seed % 50);
  const second = root * (mood === 'news' ? 1.5 : 1.25);
  const third = root * (mood === 'cinematic' ? 1.667 : 1.333);
  const bpm = mood === 'news' ? 108 : 88 + (seed % 24);
  const beatLen = 60 / bpm;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const pad = Math.sin(2 * Math.PI * root * t) * 0.18 + Math.sin(2 * Math.PI * second * t) * 0.12 + Math.sin(2 * Math.PI * third * t) * 0.08;
    const pulseEnvelope = Math.max(0, 1 - ((t % beatLen) / beatLen));
    const pulse = Math.sin(2 * Math.PI * (root / 2) * t) * 0.09 * pulseEnvelope * pulseEnvelope;
    const sparkle = Math.sin(2 * Math.PI * (root * 2.01) * t) * 0.03 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t));
    const fade = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 1.8);
    samples[i] = (pad + pulse + sparkle) * fade;
  }

  return wavFromSamples(samples, sampleRate);
}

export function buildBackgroundMusicPrompt(draft: WorkflowDraft, modelId = 'sample-ambient-v1'): string {
  const mood = draft.selections.mood || '몰입감 있는';
  const contentLabel =
    draft.contentType === 'music_video'
      ? '뮤직비디오'
      : draft.contentType === 'cinematic'
        ? '영화'
        : draft.contentType === 'info_delivery'
          ? '정보 전달'
          : '스토리';
  return `${contentLabel}용 배경음악. ${mood} 톤, 모델 ${modelId}, 전체 영상에 자연스럽게 깔리고 나레이션을 덮지 않으며 반복 가능한 구조.`;
}

export function createSampleBackgroundTrack(draft: WorkflowDraft, modelId = 'sample-ambient-v1', mode: 'preview' | 'final' = 'preview'): BackgroundMusicTrack {
  const prompt = buildBackgroundMusicPrompt(draft, modelId);
  const stylePreset = modelId.includes('news') ? 'news' : modelId.includes('cinematic') ? 'cinematic' : 'ambient';
  return {
    id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${draft.topic || '프로젝트'} 배경음 (${modelId})`,
    prompt,
    audioData: createAmbientTrack(`${draft.topic}-${draft.selections.mood}-${draft.script.slice(0, 80)}`, 14, stylePreset),
    duration: 14,
    volume: 0.28,
    sourceMode: 'sample',
    provider: modelId.startsWith('elevenlabs') ? 'elevenLabs' : 'sample',
    mode,
    stylePreset,
    createdAt: Date.now(),
  };
}

export async function createBackgroundMusicTrack(options: {
  draft: WorkflowDraft;
  modelId?: string;
  provider?: 'elevenLabs' | 'sample';
  mode?: 'preview' | 'final';
}): Promise<BackgroundMusicTrack> {
  return createSampleBackgroundTrack(options.draft, options.modelId || 'sample-ambient-v1', options.mode || 'preview');
}

export function getDefaultPreviewMix() {
  return {
    narrationVolume: 1,
    backgroundMusicVolume: 0.28,
  };
}
