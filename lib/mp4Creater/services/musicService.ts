import { BackgroundMusicTrack, ContentType, WorkflowDraft } from '../types';

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 31) + char.charCodeAt(0) + index) >>> 0, 7);
}

function wavFromSamples(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) {
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
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof window !== 'undefined') return btoa(binary);
  return (globalThis as any).Buffer.from(buffer).toString('base64');
}

function createAmbientTrack(seedText: string, seconds = 14) {
  const sampleRate = 22050;
  const length = sampleRate * seconds;
  const samples = new Float32Array(length);
  const seed = hashCode(seedText);
  const root = 180 + (seed % 60);
  const second = root * (seed % 2 === 0 ? 1.25 : 1.333);
  const third = root * (seed % 3 === 0 ? 1.5 : 1.667);
  const bpm = 88 + (seed % 36);
  const beatLen = 60 / bpm;

  for (let i = 0; i < length; i++) {
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

export function buildBackgroundMusicPrompt(draft: WorkflowDraft): string {
  const mood = draft.selections.mood || '몰입감 있는';
  const contentLabel = draft.contentType === 'music_video' ? '뮤직비디오' : draft.contentType === 'news' ? '뉴스' : '스토리';
  return `${contentLabel}용 배경음악. ${mood} 톤, 컷과 독립적으로 전체 영상에 깔리는 트랙, 나레이션을 덮지 않도록 중저밀도, 훅은 강하지 않게, 반복 가능한 구조.`;
}

export function createSampleBackgroundTrack(draft: WorkflowDraft): BackgroundMusicTrack {
  const prompt = buildBackgroundMusicPrompt(draft);
  return {
    id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${draft.topic || '프로젝트'} 배경음`,
    prompt,
    audioData: createAmbientTrack(`${draft.topic}-${draft.selections.mood}-${draft.script.slice(0, 80)}`),
    duration: 14,
    volume: 0.28,
    sourceMode: 'sample',
    createdAt: Date.now(),
  };
}

export function getDefaultPreviewMix() {
  return {
    narrationVolume: 1,
    backgroundMusicVolume: 0.28,
  };
}
