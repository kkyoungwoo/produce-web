import { resolveGoogleAiStudioApiKey } from './googleAiStudioService';
import { BackgroundMusicPromptSections, BackgroundMusicTrack, WorkflowDraft } from '../types';
import { buildConceptDirectionLines, buildMarkdownSection, joinPromptBlocks } from './promptMarkdown';

const SAMPLE_BACKGROUND_LOOP_AUDIO = '/mp4Creater/samples/audio/loop_main.wav';
const GOOGLE_LYRIA_CLIP_MODEL = 'lyria-3-clip-preview';
const GOOGLE_LYRIA_PRO_MODEL = 'lyria-3-pro-preview';

function getSafeSelections(draft?: WorkflowDraft | null) {
  const raw = draft?.selections;
  return {
    genre: typeof raw?.genre === 'string' ? raw.genre : '',
    mood: typeof raw?.mood === 'string' ? raw.mood : '',
    endingTone: typeof raw?.endingTone === 'string' ? raw.endingTone : '',
    setting: typeof raw?.setting === 'string' ? raw.setting : '',
    protagonist: typeof raw?.protagonist === 'string' ? raw.protagonist : '',
    conflict: typeof raw?.conflict === 'string' ? raw.conflict : '',
  };
}

function getLanguageLabel(draft?: WorkflowDraft | null) {
  const language = (draft?.customScriptSettings?.language || 'ko').trim().toLowerCase();
  if (language === 'mute') return '무음';
  if (language.startsWith('en')) return 'English';
  if (language.startsWith('ja')) return '日本語';
  if (language.startsWith('zh')) return '中文';
  if (language.startsWith('es')) return 'Español';
  if (language.startsWith('fr')) return 'Français';
  if (language.startsWith('de')) return 'Deutsch';
  return language === 'ko' ? '한국어' : language;
}

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => ((acc * 31) + char.charCodeAt(0) + index) >>> 0, 7);
}

function wavFromSamples(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(0 + i));
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

export function sanitizeBackgroundMusicDuration(value?: number | null, fallback = 20) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(10, Math.min(900, numeric));
}

function inferStylePreset(modelId: string, contentType?: WorkflowDraft['contentType']) {
  if (modelId.includes('news')) return 'news';
  if (modelId.includes('cinematic') || contentType === 'cinematic') return 'cinematic';
  if (contentType === 'music_video') return 'anthem';
  return 'ambient';
}

function inferTempo(stylePreset: string) {
  if (stylePreset === 'news') return 112;
  if (stylePreset === 'cinematic') return 92;
  if (stylePreset === 'anthem') return 104;
  return 88;
}

function createAmbientTrack(seedText: string, seconds = 20, mood = 'ambient') {
  const sampleRate = 22050;
  const safeSeconds = sanitizeBackgroundMusicDuration(seconds);
  const length = sampleRate * safeSeconds;
  const samples = new Float32Array(length);
  const seed = hashCode(seedText);
  const base = mood === 'cinematic' ? 140 : mood === 'news' ? 220 : mood === 'anthem' ? 196 : 180;
  const root = base + (seed % 50);
  const second = root * (mood === 'news' ? 1.5 : 1.25);
  const third = root * (mood === 'cinematic' ? 1.667 : 1.333);
  const bpm = inferTempo(mood) + (seed % 6);
  const beatLen = 60 / bpm;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const pad = Math.sin(2 * Math.PI * root * t) * 0.18 + Math.sin(2 * Math.PI * second * t) * 0.12 + Math.sin(2 * Math.PI * third * t) * 0.08;
    const pulseEnvelope = Math.max(0, 1 - ((t % beatLen) / beatLen));
    const pulse = Math.sin(2 * Math.PI * (root / 2) * t) * 0.09 * pulseEnvelope * pulseEnvelope;
    const sparkle = Math.sin(2 * Math.PI * (root * 2.01) * t) * 0.03 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t));
    const lowDrive = Math.sin(2 * Math.PI * (root / 4) * t) * (mood === 'anthem' ? 0.06 : 0.03);
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, (safeSeconds - t) / 2.2);
    samples[i] = (pad + pulse + sparkle + lowDrive) * fadeIn * fadeOut;
  }

  return wavFromSamples(samples, sampleRate);
}

function buildMusicVideoReference(draft: WorkflowDraft) {
  const lyrics = ((draft.promptStore?.finalPrompts?.finalScript || draft.script || '')).trim().replace(/\s+/g, ' ');
  const excerpt = lyrics ? lyrics.slice(0, 140) : `${draft.topic || '프로젝트 주제'}를 따라가는 장면 흐름`;
  return `뮤직비디오 콘셉트이며 step3에서 작성한 가사를 그대로 lyric reference로 사용합니다. 현재 가사/대본 흐름은 "${excerpt}"이며, step6 배경음악은 이 가사의 훅, 리듬, 보컬 호흡을 우선 반영해야 합니다.`;
}

export function isGoogleBackgroundMusicModel(modelId?: string | null) {
  const normalized = `${modelId || ''}`.trim();
  return normalized === 'lyria-002' || normalized === GOOGLE_LYRIA_CLIP_MODEL || normalized === GOOGLE_LYRIA_PRO_MODEL;
}

function normalizeGoogleBackgroundMusicModel(modelId?: string | null) {
  const normalized = `${modelId || ''}`.trim();
  if (normalized === GOOGLE_LYRIA_PRO_MODEL) return GOOGLE_LYRIA_PRO_MODEL;
  if (normalized === GOOGLE_LYRIA_CLIP_MODEL || normalized === 'lyria-002') return GOOGLE_LYRIA_CLIP_MODEL;
  return GOOGLE_LYRIA_CLIP_MODEL;
}

function extractInlineAudioPart(json: any) {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const data = part?.inlineData?.data || part?.inline_data?.data;
      const mimeType = part?.inlineData?.mimeType || part?.inline_data?.mime_type;
      if (typeof data === 'string' && data.trim()) {
        return {
          data: data.trim(),
          mimeType: typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'audio/mpeg',
        };
      }
    }
  }
  return null;
}

async function generateGoogleBackgroundMusicTrack(options: {
  draft: WorkflowDraft;
  modelId?: string;
  mode?: 'preview' | 'final';
  promptSections?: Partial<BackgroundMusicPromptSections> | null;
  durationSeconds?: number | null;
  title?: string;
  parentTrackId?: string | null;
  prompt?: string;
  googleApiKey?: string | null;
}): Promise<BackgroundMusicTrack | null> {
  const apiKey = resolveGoogleAiStudioApiKey(options.googleApiKey);
  if (!apiKey) return null;

  const requestedDuration = sanitizeBackgroundMusicDuration(options.durationSeconds || options.draft.backgroundMusicScene?.durationSeconds || 20);
  const modelId = normalizeGoogleBackgroundMusicModel(options.modelId);
  const promptSections = buildBackgroundMusicPromptSections(options.draft, options.promptSections || options.draft.backgroundMusicScene?.promptSections || null);
  const prompt = options.prompt?.trim() || combineBackgroundMusicPromptSections(promptSections, requestedDuration);
  const stylePreset = inferStylePreset(modelId, options.draft.contentType);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO', 'TEXT'],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`google-bgm-request-failed:${response.status}`);
  }

  const json = await response.json();
  const inlineAudio = extractInlineAudioPart(json);
  if (!inlineAudio?.data) {
    throw new Error('google-bgm-no-audio');
  }

  return {
    id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: options.title?.trim() || `${options.draft.topic || '프로젝트'} 배경음 ${requestedDuration}초`,
    prompt,
    audioData: `data:${inlineAudio.mimeType};base64,${inlineAudio.data}`,
    duration: requestedDuration,
    requestedDuration,
    volume: 0.28,
    sourceMode: 'ai',
    provider: 'google',
    mode: options.mode || 'preview',
    stylePreset,
    promptSections,
    parentTrackId: options.parentTrackId || null,
    createdAt: Date.now(),
  };
}

function buildSceneFlowReference(draft: WorkflowDraft) {
  const finalScript = (draft.promptStore?.finalPrompts?.finalScript || draft.script || '').trim().replace(/\s+/g, ' ');
  const sceneCount = Number((draft.stepContract?.step6?.summaryData as any)?.sceneCount || 0);
  if (!finalScript) return sceneCount > 0 ? `step6은 총 ${sceneCount}개의 장면 흐름으로 이어집니다.` : '';
  const excerpt = finalScript.slice(0, 140);
  return sceneCount > 0
    ? `step6 장면 흐름은 총 ${sceneCount}개 컷이며, 현재 대표 흐름은 "${excerpt}"입니다.`
    : `step6 장면 흐름은 "${excerpt}"를 기준으로 이어집니다.`;
}

export function buildBackgroundMusicPromptSections(
  draft: WorkflowDraft,
  overrides?: Partial<BackgroundMusicPromptSections> | null,
): BackgroundMusicPromptSections {
  const stylePreset = inferStylePreset(draft.backgroundMusicScene?.modelId || 'sample-ambient-v1', draft.contentType);
  const bpm = inferTempo(stylePreset);
  const key = stylePreset === 'cinematic' ? 'D Minor' : stylePreset === 'anthem' ? 'A Minor' : stylePreset === 'news' ? 'C Major' : 'F Major';
  const topic = (draft.topic || '프로젝트').trim();
  const selections = getSafeSelections(draft);
  const mood = (selections.mood || '몰입감 있는').trim();
  const genre = (selections.genre || topic || '시네마틱').trim();
  const setting = (selections.setting || '장면 중심 배경').trim();
  const protagonist = (selections.protagonist || '주요 인물').trim();
  const conflict = (selections.conflict || '핵심 변화').trim();
  const languageLabel = getLanguageLabel(draft);
  const sceneFlowReference = buildSceneFlowReference(draft);
  const identityBase = draft.contentType === 'music_video'
    ? `보컬 성별은 자유 선택, 장르는 ${genre} 결의 감성 팝, 시네마틱 팝, 혹은 밝은 팝/댄스와 친밀한 시티팝/Lo-Fi 대화형 톤 사이에서 프로젝트 무드에 맞게 결정합니다. 프로젝트 주제는 ${topic}, 배경 무드는 ${setting}이며 ${protagonist}의 감정선과 ${conflict} 흐름이 음악 정체성에 자연스럽게 스며들어야 합니다.`
    : `보컬은 필요 시 최소화하고, 장르는 ${genre} 결의 인스트루멘털 중심 cinematic background로 설정합니다. 프로젝트 주제 ${topic}, 주요 배경 ${setting}, 주인공 ${protagonist}, 핵심 변화 ${conflict}를 방해하지 않는 배경음 정체성을 유지합니다. ${sceneFlowReference}`.trim();
  const moodBase = draft.contentType === 'music_video'
    ? `${mood} 감정선, 미디엄 템포 ${bpm} BPM, ${key}, ${buildMusicVideoReference(draft)} ${sceneFlowReference} 선택 언어는 ${languageLabel} 기준으로 자연스럽게 들려야 하고, 보컬이 들어가면 step3 가사 줄바꿈과 문장 호흡을 최대한 유지한 채 음절이 너무 뭉개지지 않도록 또렷한 발음과 립싱크 친화적인 프레이징을 유지합니다. 후렴이나 반복 구간이 떠오를 수 있는 리듬 포인트를 분명하게 둡니다.`
    : `${mood} 분위기, 설명을 방해하지 않는 안정적인 템포 ${bpm} BPM, ${key}, 프롬프트 분위기에 맞게 전개합니다. ${sceneFlowReference} 선택 언어가 ${languageLabel}라면 허밍이나 짧은 보컬 텍스처도 해당 언어권 발화 흐름과 어긋나지 않게 유지합니다.`;
  const instrumentsBase = draft.contentType === 'music_video'
    ? '일렉트릭 피아노가 따뜻한 메인 모티프를 연주하고, 신스 베이스가 저역 리듬을 밀어주며, 부드러운 드럼이 그루브를 받치고, 기타 포인트가 감정 고조 구간을 강조하고, 에어리 패드가 후렴 공간을 넓혀 주며, 장면 전환에는 과하지 않은 전환 효과를 짧게 넣습니다.'
    : '피아노가 깔끔한 메인 모티프를 연주하고, 소프트 베이스가 바닥을 받치며, 가벼운 퍼커션이 안정적인 박을 유지하고, 스트링이 전환 지점을 살짝 강조하고, 앰비언트 패드가 내레이션 뒤 공간감을 채우며, 필요한 순간에만 짧은 라이저를 넣습니다.';
  const performanceBase = draft.contentType === 'music_video'
    ? `보컬은 숨결이 살짝 섞인 질감으로, 감정을 밀어 올리되 과장하지 않고, 중음역 중심의 선명한 프레이징으로 전달합니다. 필요하면 두 보컬이 질문-대답처럼 주고받는 구조도 허용하되, 화면 인물이 노래할 수 있도록 입모양이 읽히는 길이의 가사 호흡을 유지하고, 후렴은 따라 부르기 쉬운 훅으로 정리합니다.`
    : `보컬은 선택 사항이며, 사용 시 낮은 존재감의 허밍 또는 짧은 코러스처럼 배치하고, 핵심은 내레이션을 비우는 절제된 전달로 둡니다. 일반 영상에서는 대본 TTS를 침범하지 않도록 보컬 존재감과 주파수 밀도를 관리합니다.`;
  const productionBase = draft.contentType === 'music_video'
    ? '스테레오는 넓게, 공간감은 중간 이상, 리버브는 부드럽고 길게, 보컬은 센터보다 살짝 뒤로 배치하고, 킥과 베이스는 컷 전환 타이밍을 받쳐 주도록 정리하며, 전체 텍스처는 따뜻하고 시네마틱하게 유지합니다.'
    : '스테레오는 넓지만 중앙 정보는 비워 두고, 공간 깊이는 중간 정도로 맞추고, 리버브는 얕고 깔끔하게 유지하며, 보컬은 뒤로 배치하고, 내레이션/TTS 선명도를 가리지 않도록 전체 텍스처는 깨끗하고 따뜻하게 유지합니다.';

  return {
    identity: overrides?.identity?.trim() || identityBase,
    mood: overrides?.mood?.trim() || moodBase,
    instruments: overrides?.instruments?.trim() || instrumentsBase,
    performance: overrides?.performance?.trim() || performanceBase,
    production: overrides?.production?.trim() || productionBase,
  };
}

export function combineBackgroundMusicPromptSections(sections: BackgroundMusicPromptSections, durationSeconds?: number | null) {
  const safeDuration = sanitizeBackgroundMusicDuration(durationSeconds, 20);
  const contentType = /music video|보컬|후렴|chorus|hook/i.test(`${sections.identity} ${sections.mood}`) ? 'music_video' : 'story';
  return joinPromptBlocks([
    buildMarkdownSection('Goal', [
      `Create background music for ${safeDuration} seconds.`,
      ...buildConceptDirectionLines(contentType, 'music'),
    ]),
    buildMarkdownSection('Identity', [sections.identity], { bullet: false }),
    buildMarkdownSection('Mood', [sections.mood], { bullet: false }),
    buildMarkdownSection('Instruments', [sections.instruments], { bullet: false }),
    buildMarkdownSection('Performance', [sections.performance], { bullet: false }),
    buildMarkdownSection('Production', [sections.production], { bullet: false }),
  ]);
}

export function buildBackgroundMusicPrompt(
  draft: WorkflowDraft,
  modelId = 'sample-ambient-v1',
  sectionsOverride?: Partial<BackgroundMusicPromptSections> | null,
  durationSeconds?: number | null,
): string {
  const sections = buildBackgroundMusicPromptSections({
    ...draft,
    backgroundMusicScene: {
      enabled: Boolean(draft.backgroundMusicScene?.enabled),
      prompt: draft.backgroundMusicScene?.prompt || '',
      provider: draft.backgroundMusicScene?.provider === 'google' ? 'google' : 'sample',
      modelId,
      title: draft.backgroundMusicScene?.title,
      durationSeconds: draft.backgroundMusicScene?.durationSeconds,
      promptSections: draft.backgroundMusicScene?.promptSections,
      selectedTrackId: draft.backgroundMusicScene?.selectedTrackId || null,
    },
  }, sectionsOverride);
  return combineBackgroundMusicPromptSections(sections, durationSeconds || draft.backgroundMusicScene?.durationSeconds || 20);
}

export function createSampleBackgroundTrack(
  draft: WorkflowDraft,
  modelId = 'sample-ambient-v1',
  mode: 'preview' | 'final' = 'preview',
  options?: {
    prompt?: string;
    title?: string;
    provider?: 'google' | 'sample';
    promptSections?: Partial<BackgroundMusicPromptSections> | null;
    durationSeconds?: number | null;
    parentTrackId?: string | null;
  },
): BackgroundMusicTrack {
  const promptSections = buildBackgroundMusicPromptSections(draft, options?.promptSections || draft.backgroundMusicScene?.promptSections || null);
  const requestedDuration = sanitizeBackgroundMusicDuration(options?.durationSeconds || draft.backgroundMusicScene?.durationSeconds || 20);
  const renderDuration = Math.min(requestedDuration, 60);
  const prompt = options?.prompt?.trim() || combineBackgroundMusicPromptSections(promptSections, requestedDuration);
  const stylePreset = inferStylePreset(modelId, draft.contentType);
  const provider = options?.provider === 'google' ? 'google' : 'sample';
  return {
    id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: options?.title?.trim() || `${draft.topic || '프로젝트'} 배경음 ${requestedDuration}초`,
    prompt,
    audioData: SAMPLE_BACKGROUND_LOOP_AUDIO || createAmbientTrack(`${draft.topic}-${prompt}-${requestedDuration}`, renderDuration, stylePreset),
    duration: requestedDuration,
    requestedDuration,
    volume: 0.28,
    sourceMode: 'sample',
    provider,
    mode,
    stylePreset,
    promptSections,
    parentTrackId: options?.parentTrackId || null,
    createdAt: Date.now(),
  };
}

export async function createBackgroundMusicTrack(options: {
  draft: WorkflowDraft;
  modelId?: string;
  provider?: 'google' | 'sample';
  mode?: 'preview' | 'final';
  promptSections?: Partial<BackgroundMusicPromptSections> | null;
  durationSeconds?: number | null;
  title?: string;
  parentTrackId?: string | null;
  prompt?: string;
  googleApiKey?: string | null;
}): Promise<BackgroundMusicTrack> {
  const wantsGoogle = options.provider === 'google' || isGoogleBackgroundMusicModel(options.modelId);
  if (wantsGoogle) {
    try {
      const generated = await generateGoogleBackgroundMusicTrack(options);
      if (generated) return generated;
    } catch (error) {
      console.warn('[musicService] google background music failed, falling back to sample loop', error);
    }
  }

  return createSampleBackgroundTrack(options.draft, options.modelId || 'sample-ambient-v1', options.mode || 'preview', {
    provider: wantsGoogle ? 'google' : (options.provider || 'sample'),
    promptSections: options.promptSections,
    durationSeconds: options.durationSeconds,
    title: options.title,
    parentTrackId: options.parentTrackId,
    prompt: options.prompt,
  });
}

export function getDefaultPreviewMix() {
  return {
    narrationVolume: 0.5,
    backgroundMusicVolume: 0.5,
  };
}
