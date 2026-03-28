import {
  BGM_MODEL_OPTIONS,
  CHATTERBOX_CUSTOM_VOICE_ID,
  CHATTERBOX_TTS_PRESET_OPTIONS,
  ELEVENLABS_DEFAULT_VOICES,
  ELEVENLABS_MODELS,
  IMAGE_MODELS,
  NO_AI_SCRIPT_MODEL_ID,
  PRICING,
  QWEN_TTS_PRESET_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from '../config';

export type AiPickerGroup =
  | 'sample'
  | 'free'
  | 'budget'
  | 'premium'
  | 'voice'
  | 'provider';

export type AiPickerTone = 'slate' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface AiPickerOption {
  id: string;
  title: string;
  provider: string;
  description: string;
  badge: string;
  priceLabel: string;
  costHint?: string;
  qualityLabel: string;
  speedLabel?: string;
  helper?: string;
  avatarLabel?: string;
  tone?: AiPickerTone;
  previewUrl?: string;
  genderLabel?: string;
  voiceToneLabel?: string;
  group: AiPickerGroup;
  tier?: 'free' | 'paid' | 'sample';
  disabled?: boolean;
  disabledReason?: string;
  cardVariant?: 'default' | 'tts-model' | 'tts-voice';
}

type ChatterboxVoicePickerOptions = {
  includeCustomReference?: boolean;
  voiceReferenceName?: string | null;
};

type VoiceItem = {
  voice_id: string;
  name: string;
  preview_url?: string;
  labels?: { accent?: string; gender?: string; description?: string };
};

type HeygenVoiceItem = {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  preview_audio_url?: string;
  preview_audio?: string;
};

type BackgroundMusicPickerOptionsParams = {
  hasGoogleApiKey?: boolean;
};

const scriptModelMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  [NO_AI_SCRIPT_MODEL_ID]: {
    description: 'API 없이 바로 초안 흐름을 확인할 때 쓰는 내장 샘플 작성기입니다.',
    badge: '샘플',
    priceLabel: '무료',
    qualityLabel: '흐름 확인',
    speedLabel: '즉시',
    helper: '화면 테스트나 구조 확인용으로 가장 가볍습니다.',
    avatarLabel: 'S',
    tone: 'slate',
    group: 'sample',
  },
  'gemini-2.5-flash-lite': {
    description: '비용이 가장 낮은 편이라 빠른 초안 대본 생성에 적합한 모델입니다.',
    badge: '가성비',
    priceLabel: '무료',
    qualityLabel: '균형형',
    speedLabel: '빠름',
    helper: '비용 부담 없이 안정적으로 대본 초안을 만들 때 추천합니다.',
    avatarLabel: 'GL',
    tone: 'emerald',
    group: 'free',
  },
  'gemini-2.5-flash': {
    description: 'lite보다 표현력이 조금 더 좋으면서도 비교적 가볍게 쓸 수 있는 모델입니다.',
    badge: '인기',
    priceLabel: '보통',
    qualityLabel: '디테일 강화',
    speedLabel: '빠름',
    helper: '톤과 흐름 연결성을 조금 더 챙기고 싶을 때 좋습니다.',
    avatarLabel: 'GF',
    tone: 'blue',
    group: 'free',
  },
  'gemini-2.5-pro': {
    description: '긴 흐름과 복잡한 구성에 강해서 정교한 대본 작업에 유리한 모델입니다.',
    badge: '고품질',
    priceLabel: '높음',
    qualityLabel: '정교함',
    speedLabel: '보통',
    helper: '설득형, 스토리형, 구조가 복잡한 대본에 적합합니다.',
    avatarLabel: 'GP',
    tone: 'violet',
    group: 'premium',
  },
  'gemini-3-flash-preview': {
    description: '창의적인 표현이 강한 미리보기 계열 모델입니다.',
    badge: '미리보기',
    priceLabel: '보통',
    qualityLabel: '창의성',
    speedLabel: '빠름',
    helper: '새로운 표현감을 원하고 미리보기 특성을 감수할 수 있을 때 좋습니다.',
    avatarLabel: '3F',
    tone: 'amber',
    group: 'budget',
  },
  'gemini-3.1-pro-preview': {
    description: '창의성과 디테일을 가장 강하게 노릴 수 있는 상위 미리보기 모델입니다.',
    badge: '프리미엄',
    priceLabel: '높음',
    qualityLabel: '최상위',
    speedLabel: '보통',
    helper: '최대 품질이 우선일 때만 선택하는 편이 좋습니다.',
    avatarLabel: '3P',
    tone: 'rose',
    group: 'premium',
  },
};

const imageModelMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  'sample-scene-image': {
    description: 'API 비용 없이 이미지 흐름만 확인할 때 쓰는 샘플 이미지 생성입니다.',
    badge: '샘플',
    priceLabel: '무료',
    qualityLabel: '미리보기',
    speedLabel: '즉시',
    helper: '기능 흐름만 테스트할 때 사용하면 됩니다.',
    avatarLabel: 'S',
    tone: 'slate',
    group: 'sample',
  },
  'gemini-2.5-flash-image': {
    description: '속도와 품질 균형이 좋아 기본 이미지 생성 모델로 쓰기 좋은 선택지입니다.',
    badge: '가성비',
    priceLabel: formatUsd(PRICING.IMAGE['gemini-2.5-flash-image']),
    qualityLabel: '균형형',
    speedLabel: '빠름',
    helper: '과하게 비싸지 않으면서도 무난하게 좋은 결과를 원할 때 추천합니다.',
    avatarLabel: 'FI',
    tone: 'emerald',
    group: 'budget',
  },
  'gemini-3.1-flash-image-preview': {
    description: '장면 해석력과 구도 다양성이 좋아진 미리보기 이미지 모델입니다.',
    badge: '미리보기',
    priceLabel: formatUsd(PRICING.IMAGE['gemini-3.1-flash-image-preview']),
    qualityLabel: '창의성',
    speedLabel: '보통',
    helper: '프롬프트 뉘앙스와 장면 해석이 더 중요할 때 좋습니다.',
    avatarLabel: '3I',
    tone: 'blue',
    group: 'budget',
  },
  'gemini-3-pro-image-preview': {
    description: '디테일, 조명, 완성도에 더 집중하는 상위 이미지 모델입니다.',
    badge: '프리미엄',
    priceLabel: formatUsd(PRICING.IMAGE['gemini-3-pro-image-preview']),
    qualityLabel: '고해상도 느낌',
    speedLabel: '보통',
    helper: '이미지 자체의 완성도가 중요한 프로젝트에 적합합니다.',
    avatarLabel: 'PI',
    tone: 'violet',
    group: 'premium',
  },
};

const videoModelMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  'sample-sequence-v1': {
    description: 'Step6 영상 흐름만 확인할 때 쓰는 샘플 모션 생성입니다.',
    badge: '샘플',
    priceLabel: '무료',
    qualityLabel: '미리보기',
    speedLabel: '즉시',
    helper: '타이밍이나 UI 흐름만 볼 때 사용하면 됩니다.',
    avatarLabel: 'S',
    tone: 'slate',
    group: 'sample',
  },
  'veo-2.0-generate-001': {
    description: '가장 낮은 비용으로 짧은 Veo 결과를 먼저 확인할 때 쓰기 좋은 기본 영상 모델입니다.',
    badge: '최소 비용',
    priceLabel: formatUsd(PRICING.VIDEO['veo-2.0-generate-001']),
    qualityLabel: '입문형',
    speedLabel: '보통',
    helper: '비용을 가장 먼저 아껴야 할 때 시작점으로 적합합니다.',
    avatarLabel: 'V2',
    tone: 'blue',
    group: 'free',
  },
  'veo-3.1-fast-generate-preview': {
    description: '비용을 조금 낮추면서도 빠르게 모션을 확인하기 좋은 Veo 모델입니다.',
    badge: '중간 비용',
    priceLabel: formatUsd(PRICING.VIDEO['veo-3.1-fast-generate-preview']),
    qualityLabel: '균형형',
    speedLabel: '빠름',
    helper: '영상 생성의 첫 선택지로 무난합니다.',
    avatarLabel: 'VF',
    tone: 'emerald',
    group: 'budget',
  },
  'veo-3.1-generate-preview': {
    description: '움직임 정밀도와 장면 완성도를 더 끌어올리는 상위 Veo 모델입니다.',
    badge: '고비용',
    priceLabel: formatUsd(PRICING.VIDEO['veo-3.1-generate-preview']),
    qualityLabel: '고품질',
    speedLabel: '보통',
    helper: '비용보다 결과 품질이 더 중요할 때 선택하면 됩니다.',
    avatarLabel: 'VP',
    tone: 'violet',
    group: 'premium',
  },
};

const backgroundMusicModelMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  'sample-ambient-v1': {
    description: 'API 없이도 바로 미리듣기와 저장 테스트를 할 수 있는 기본 배경음 샘플입니다.',
    badge: '샘플',
    priceLabel: '무료',
    costHint: '예상 비용: 무료',
    qualityLabel: '샘플',
    speedLabel: '즉시',
    helper: '실시간 생성 없이 전체 흐름과 렌더링을 먼저 확인할 때 좋습니다.',
    avatarLabel: 'BG',
    tone: 'slate',
    group: 'sample',
  },
  'lyria-3-clip-preview': {
    description: 'Google Lyria 3 Clip 실생성 경로입니다. 가장 가볍게 Lyria3 배경음을 비교할 때 적합합니다.',
    badge: '유료',
    priceLabel: '보통',
    costHint: '예상 비용: Google AI Studio 사용량 기준',
    qualityLabel: 'AI 생성',
    speedLabel: '보통',
    helper: 'Google AI Studio API가 연결되어 있으면 Step6와 Settings에서 같은 모델로 바로 생성합니다.',
    avatarLabel: 'L3',
    tone: 'blue',
    group: 'budget',
  },
  'lyria-3-pro-preview': {
    description: 'Lyria 3 상위 모델로 더 풍부한 질감과 완성도를 노릴 때 선택하는 배경음 경로입니다.',
    badge: '프리미엄',
    priceLabel: '높음',
    costHint: '예상 비용: Google AI Studio 사용량 기준',
    qualityLabel: '프리미엄',
    speedLabel: '보통',
    helper: '배경음 정체성과 완성도를 더 강하게 유지하고 싶을 때 적합합니다.',
    avatarLabel: 'LP',
    tone: 'violet',
    group: 'premium',
  },
};

const elevenModelMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  eleven_multilingual_v2: {
    description: '대사와 내레이션에 두루 쓰기 좋은 기본형 모델입니다. 발음 안정성과 범용성이 좋아 처음 선택하기 좋습니다.',
    badge: '기본 추천',
    priceLabel: '보통',
    qualityLabel: '안정형',
    speedLabel: '빠름',
    helper: '처음 고를 때 가장 무난한 ElevenLabs 기본 모델입니다.',
    avatarLabel: 'M2',
    tone: 'blue',
    group: 'budget',
  },
  eleven_v3: {
    description: '감정 표현과 억양 변화가 가장 풍부한 상위 모델입니다. 광고형, 연기형, 감정 밀도가 높은 작업에 어울립니다.',
    badge: '고급형',
    priceLabel: '높음',
    qualityLabel: '감정 표현',
    speedLabel: '보통',
    helper: '표현력이 가장 중요할 때 선택하는 프리미엄 모델입니다.',
    avatarLabel: 'V3',
    tone: 'violet',
    group: 'premium',
  },
  eleven_turbo_v2_5: {
    description: '빠른 응답과 무난한 품질을 함께 가져가는 모델입니다. 반복 생성이 많을 때 쓰기 편합니다.',
    badge: '빠른 생성',
    priceLabel: '보통',
    qualityLabel: '가성비',
    speedLabel: '빠름',
    helper: '빠르게 여러 번 확인하면서 작업할 때 적합합니다.',
    avatarLabel: 'T2',
    tone: 'emerald',
    group: 'budget',
  },
  eleven_flash_v2_5: {
    description: '반응 속도가 가장 빠른 편이라 빠른 확인과 초안 생성에 유리합니다.',
    badge: '초안용',
    priceLabel: '보통',
    qualityLabel: '빠른 확인',
    speedLabel: '매우 빠름',
    helper: '최종본 전 빠른 검수용으로 쓰기 좋습니다.',
    avatarLabel: 'F2',
    tone: 'amber',
    group: 'budget',
  },
  eleven_turbo_v2: {
    description: '이전 세대 빠른 모델입니다. 특별한 이유가 없다면 최신 계열을 먼저 고려하는 편이 좋습니다.',
    badge: '구형',
    priceLabel: '보통',
    qualityLabel: '이전 세대',
    speedLabel: '빠름',
    helper: '기존 음색을 유지해야 할 때만 권장합니다.',
    avatarLabel: 'TV',
    tone: 'slate',
    group: 'budget',
  },
  eleven_monolingual_v1: {
    description: '영어 중심의 이전 세대 모델입니다. 한국어 서비스 기준으로는 우선순위가 낮습니다.',
    badge: '구형',
    priceLabel: '높음',
    qualityLabel: '영어 중심',
    speedLabel: '보통',
    helper: '특정 영어 음색이 꼭 필요할 때만 선택하는 편이 좋습니다.',
    avatarLabel: 'EN',
    tone: 'slate',
    group: 'premium',
  },
};

const qwenVoiceMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  'qwen-default': {
    description: '기본 한국어 음성입니다. 발화가 무난하고 빠르게 생성되어 초안 작업에 잘 맞습니다.',
    badge: '기본형',
    priceLabel: '무료',
    qualityLabel: '가성비',
    speedLabel: '빠름',
    helper: '가볍게 테스트하거나 비용 없이 빠르게 만들 때 추천합니다.',
    avatarLabel: 'QD',
    tone: 'emerald',
    group: 'free',
  },
  'qwen-soft': {
    description: '좀 더 부드럽고 차분한 느낌의 무료 음성입니다. 설명형, 감성형 내레이션에 잘 어울립니다.',
    badge: '부드러움',
    priceLabel: '무료',
    qualityLabel: '차분한 톤',
    speedLabel: '빠름',
    helper: '잔잔한 전달감이 필요할 때 선택하기 좋습니다.',
    avatarLabel: 'QS',
    tone: 'blue',
    group: 'free',
  },
};

const chatterboxVoiceMeta: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>> = {
  'chatterbox-clear': {
    description: '또렷하고 선명한 무료 음성입니다. 음성 참고 파일과 함께 쓸 때 비교적 자연스럽게 맞추기 좋습니다.',
    badge: '고품질 무료',
    priceLabel: '무료',
    qualityLabel: '선명함',
    speedLabel: '보통',
    helper: '무료 중에서는 음색 질감이 좋은 편이라 기본 추천입니다.',
    avatarLabel: 'CC',
    tone: 'violet',
    group: 'free',
  },
  'chatterbox-warm': {
    description: '조금 더 따뜻하고 사람 같은 인상을 주는 무료 음성입니다. 감성형 전달에 잘 맞습니다.',
    badge: '고품질 무료',
    priceLabel: '무료',
    qualityLabel: '따뜻한 톤',
    speedLabel: '보통',
    helper: '부드럽고 인간적인 느낌을 원할 때 고르기 좋습니다.',
    avatarLabel: 'CW',
    tone: 'amber',
    group: 'free',
  },
};

function formatUsd(value?: number | null) {
  if (!value || value <= 0) return 'Free';
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

function formatTtsPerKCharacters(value: number) {
  return `예상 비용: 1000자 기준 약 ${formatUsd(value * 1000)}`;
}

function buildElevenVoiceDescription(voice: VoiceItem) {
  const gender = voice.labels?.gender === 'female'
    ? '여성 톤'
    : voice.labels?.gender === 'male'
      ? '남성 톤'
      : '중립 톤';
  return `${voice.name} 음성은 ${gender} 중심의 프리미엄 보이스입니다. 대사와 내레이션 모두에 무난하게 쓰기 좋습니다.`;
}

function buildHeygenVoiceDescription(voice: HeygenVoiceItem) {
  const gender = voice.gender ? `${voice.gender} 톤` : '다목적 톤';
  const language = voice.language ? `${voice.language} 지원` : '다국어 지원';
  return `${gender}과 ${language} 기반의 HeyGen 음성입니다. 특정 서비스 연동용으로 고를 때 적합합니다.`;
}

function mapGenderLabel(value?: string) {
  if (!value) return '중립형';
  const normalized = value.toLowerCase();
  if (normalized.includes('female')) return '여성';
  if (normalized.includes('male')) return '남성';
  return '중립형';
}

function inferVoiceToneLabel(source?: string | null) {
  const value = (source || '').toLowerCase();
  if (!value) return '기본 톤';
  if (value.includes('warm') || value.includes('따뜻')) return '따뜻한 톤';
  if (value.includes('soft') || value.includes('gentle') || value.includes('부드')) return '부드러운 톤';
  if (value.includes('clear') || value.includes('bright') || value.includes('선명')) return '또렷한 톤';
  if (value.includes('calm') || value.includes('차분')) return '차분한 톤';
  if (value.includes('deep') || value.includes('low')) return '묵직한 톤';
  return '기본 톤';
}

function formatVoiceCountLabel(count: number) {
  return `선택 가능한 목소리 ${Math.max(1, count)}개`;
}

function initials(name: string) {
  const clean = (name || '').trim();
  if (!clean) return 'AI';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function buildOptionFromModel(
  model: { id: string; name: string; provider?: string; tier?: 'free' | 'paid' },
  metaMap: Record<string, Omit<AiPickerOption, 'id' | 'title' | 'provider' | 'tier'>>,
  fallbackProvider: string,
): AiPickerOption {
  const meta = metaMap[model.id];
  return {
    id: model.id,
    title: model.name,
    provider: model.provider || fallbackProvider,
    description: meta?.description || 'AI 모델 옵션입니다.',
    badge: meta?.badge || (model.tier === 'paid' ? '유료' : '무료'),
    priceLabel: meta?.priceLabel || (model.tier === 'paid' ? '보통' : '무료'),
    qualityLabel: meta?.qualityLabel || '균형형',
    speedLabel: meta?.speedLabel,
    helper: meta?.helper,
    avatarLabel: meta?.avatarLabel || initials(model.name),
    tone: meta?.tone || 'slate',
    group: meta?.group || (model.tier === 'paid' ? 'premium' : 'free'),
    tier: model.tier || 'free',
  };
}

function mergeElevenVoiceCatalog(
  voices: VoiceItem[] = [],
): VoiceItem[] {
  const merged = new Map<string, VoiceItem>();
  ELEVENLABS_DEFAULT_VOICES.forEach((voice) => {
    merged.set(voice.id, {
      voice_id: voice.id,
      name: voice.name,
      labels: {
        accent: voice.accent,
        gender: voice.gender,
        description: voice.description,
      },
    });
  });
  voices.forEach((voice) => {
    merged.set(voice.voice_id, {
      ...merged.get(voice.voice_id),
      ...voice,
      labels: {
        ...(merged.get(voice.voice_id)?.labels || {}),
        ...(voice.labels || {}),
      },
    });
  });
  return Array.from(merged.values());
}

export function getScriptModelPickerOptions(includeNoAi: boolean = true): AiPickerOption[] {
  const baseOptions = SCRIPT_MODEL_OPTIONS.map((item) => buildOptionFromModel(
    item,
    scriptModelMeta,
    'Google AI Studio',
  ));
  if (!includeNoAi) return baseOptions;
  return [
    {
      id: NO_AI_SCRIPT_MODEL_ID,
      title: 'Sample writer',
      provider: 'Built-in',
      tier: 'sample' as const,
      ...scriptModelMeta[NO_AI_SCRIPT_MODEL_ID],
    },
    ...baseOptions,
  ];
}

export function getImageModelPickerOptions(): AiPickerOption[] {
  return IMAGE_MODELS.map((item) => buildOptionFromModel(item, imageModelMeta, 'Google AI Studio'));
}

export function getVideoModelPickerOptions(): AiPickerOption[] {
  return VIDEO_MODEL_OPTIONS.map((item) => buildOptionFromModel(item, videoModelMeta, item.provider || 'Google AI Studio'));
}

export function getBackgroundMusicPickerOptions(
  options: BackgroundMusicPickerOptionsParams = {},
): AiPickerOption[] {
  const hasGoogleApiKey = Boolean(options.hasGoogleApiKey);
  return BGM_MODEL_OPTIONS.map((item) => {
    const meta = backgroundMusicModelMeta[item.id];
    const isSample = item.id === 'sample-ambient-v1';
    return {
      id: item.id,
      title: item.name,
      provider: isSample ? 'Sample' : 'Google AI Studio',
      description: meta?.description || '배경음 모델 옵션입니다.',
      badge: meta?.badge || (isSample ? '샘플' : '유료'),
      priceLabel: meta?.priceLabel || (isSample ? '무료' : '보통'),
      costHint: meta?.costHint,
      qualityLabel: meta?.qualityLabel || (isSample ? '샘플' : 'AI 생성'),
      speedLabel: meta?.speedLabel,
      helper: meta?.helper,
      avatarLabel: meta?.avatarLabel || initials(item.name),
      tone: meta?.tone || (isSample ? 'slate' : 'blue'),
      group: meta?.group || (isSample ? 'sample' : 'budget'),
      tier: isSample ? 'sample' as const : 'paid' as const,
      disabled: isSample ? false : !hasGoogleApiKey,
      disabledReason: isSample || hasGoogleApiKey ? undefined : 'Google AI Studio API 키를 연결하면 선택할 수 있습니다.',
    };
  });
}

export function getQwenVoicePickerOptions(): AiPickerOption[] {
  return QWEN_TTS_PRESET_OPTIONS.map((item) => ({
    id: item.id,
    title: item.name,
    provider: 'Gemini 2.5 Flash Preview TTS',
    tier: 'free' as const,
    costHint: '예상 비용: 무료',
    genderLabel: '중립형',
    voiceToneLabel: item.id === 'qwen-soft' ? '부드러운 톤' : '기본 톤',
    cardVariant: 'tts-voice' as const,
    ...qwenVoiceMeta[item.id],
  }));
}

export function getChatterboxVoicePickerOptions(options?: ChatterboxVoicePickerOptions): AiPickerOption[] {
  const items: AiPickerOption[] = CHATTERBOX_TTS_PRESET_OPTIONS.map((item) => ({
    id: item.id,
    title: item.name,
    provider: 'Chatterbox',
    tier: 'free' as const,
    costHint: '예상 비용: 무료',
    genderLabel: '중립형',
    voiceToneLabel: item.id === 'chatterbox-warm' ? '따뜻한 톤' : '또렷한 톤',
    cardVariant: 'tts-voice' as const,
    ...chatterboxVoiceMeta[item.id],
  }));

  if (options?.includeCustomReference) {
    items.unshift({
      id: CHATTERBOX_CUSTOM_VOICE_ID,
      title: options.voiceReferenceName?.trim() || '내 목소리 샘플',
      provider: 'Chatterbox',
      description: '등록한 음성 샘플을 바탕으로 비슷한 톤을 따라가는 맞춤형 무료 목소리입니다. 처음 생성할 때는 준비 시간이 조금 더 걸릴 수 있습니다.',
      badge: '맞춤 목소리',
      priceLabel: '무료',
      costHint: '예상 비용: 무료',
      qualityLabel: '등록 샘플 반영',
      speedLabel: '보통',
      helper: '샘플 업로드 후 실제 생성과 미리듣기에 사용됩니다.',
      avatarLabel: 'MY',
      tone: 'rose',
      group: 'voice',
      tier: 'free',
      genderLabel: '직접 등록',
      voiceToneLabel: '샘플 반영',
      cardVariant: 'tts-voice',
    });
  }

  return items;
}

export function getElevenLabsModelPickerOptions(): AiPickerOption[] {
  return ELEVENLABS_MODELS.map((item) => ({
    id: item.id,
    title: item.name,
    provider: 'ElevenLabs',
    tier: 'paid' as const,
    costHint: formatTtsPerKCharacters(PRICING.TTS.perCharacter),
    cardVariant: 'tts-model' as const,
    ...elevenModelMeta[item.id],
  }));
}

export function getElevenLabsVoicePickerOptions(voices: VoiceItem[] = []): AiPickerOption[] {
  return mergeElevenVoiceCatalog(voices).map((voice) => ({
    id: voice.voice_id,
    title: voice.name,
    provider: 'ElevenLabs',
    description: buildElevenVoiceDescription(voice),
    badge: voice.labels?.gender === 'female' ? '여성' : voice.labels?.gender === 'male' ? '남성' : '프리미엄',
    priceLabel: '보통',
    costHint: formatTtsPerKCharacters(PRICING.TTS.perCharacter),
    qualityLabel: '프리미엄 음색',
    speedLabel: '미리듣기 가능',
    helper: voice.preview_url ? '샘플 음성을 바로 들어볼 수 있습니다.' : '설정 화면에서 현재 모델 기준으로 미리듣기를 만들 수 있습니다.',
    avatarLabel: initials(voice.name),
    tone: 'violet' as const,
    previewUrl: voice.preview_url,
    genderLabel: mapGenderLabel(voice.labels?.gender),
    voiceToneLabel: inferVoiceToneLabel(`${voice.labels?.description || ''} ${voice.name}`),
    cardVariant: 'tts-voice' as const,
    group: 'voice' as const,
    tier: 'paid' as const,
  }));
}

export function getHeygenVoicePickerOptions(voices: HeygenVoiceItem[] = []): AiPickerOption[] {
  return voices.map((voice) => ({
    id: voice.voice_id,
    title: voice.name,
    provider: 'HeyGen',
    description: buildHeygenVoiceDescription(voice),
    badge: voice.gender === 'female' ? '여성' : voice.gender === 'male' ? '남성' : '음성',
    priceLabel: '높음',
    costHint: '예상 비용: 외부 유료 API 사용량 기준',
    qualityLabel: '연동 전용',
    speedLabel: '미리듣기 가능',
    helper: voice.preview_audio_url || voice.preview_audio ? '샘플 음성을 바로 들어볼 수 있습니다.' : '서비스 연동 후 미리듣기할 수 있습니다.',
    avatarLabel: initials(voice.name),
    tone: 'amber' as const,
    previewUrl: voice.preview_audio_url || voice.preview_audio,
    genderLabel: mapGenderLabel(voice.gender),
    voiceToneLabel: inferVoiceToneLabel(`${voice.name} ${voice.language || ''}`),
    cardVariant: 'tts-voice' as const,
    group: 'voice' as const,
    tier: 'paid' as const,
  }));
}

export function getTtsProviderPickerOptions(): AiPickerOption[] {
  return [
    {
      id: 'qwen3Tts',
      title: 'Gemini 2.5 Flash Preview TTS',
      provider: 'Google AI Studio',
      description: 'Google AI Studio 기반의 기본 TTS 모델입니다. 한국어 대사 생성에 바로 사용할 수 있습니다.',
      badge: '최소 비용',
      priceLabel: '최소 비용',
      costHint: '예상 비용: Google AI Studio 사용량 기준',
      qualityLabel: '기본형',
      speedLabel: '빠름',
      helper: '기본 TTS 생성이 필요할 때 가장 먼저 선택하면 됩니다.',
      avatarLabel: 'Q',
      tone: 'emerald' as const,
      group: 'free' as const,
      tier: 'free' as const,
    },
    {
      id: 'elevenLabs',
      title: 'ElevenLabs',
      provider: '유료 API',
      description: '감정 표현과 음색 선택 폭이 넓은 고급 TTS 모델입니다. API가 연결되어 있으면 실제 보이스를 골라 바로 사용할 수 있습니다.',
      badge: '중간 비용',
      priceLabel: '중간 비용',
      costHint: formatTtsPerKCharacters(PRICING.TTS.perCharacter),
      qualityLabel: '고품질',
      speedLabel: '보통',
      helper: '연결된 API 기준으로 실제 사용할 수 있는 목소리 목록을 불러옵니다.',
      avatarLabel: '11',
      tone: 'amber' as const,
      group: 'budget' as const,
      tier: 'paid' as const,
    },
    {
      id: 'heygen',
      title: 'HeyGen',
      provider: '유료 API',
      description: 'HeyGen 연동이 필요한 경우에만 사용하는 음성 모델입니다.',
      badge: '고비용',
      priceLabel: '고비용',
      costHint: '예상 비용: 외부 유료 API 사용량 기준',
      qualityLabel: '연동 전용',
      speedLabel: '보통',
      helper: '현재 프로젝트에서 HeyGen을 연결한 경우에만 선택하면 됩니다.',
      avatarLabel: 'HG',
      tone: 'blue' as const,
      group: 'premium' as const,
      tier: 'paid' as const,
    },
  ];
}

export function getTtsModelPickerOptions(options?: {
  allowPaid?: boolean;
  hasGoogleApiKey?: boolean;
  hasElevenLabsApiKey?: boolean;
  allowHeygen?: boolean;
  elevenLabsVoices?: VoiceItem[];
  heygenVoices?: HeygenVoiceItem[];
}): AiPickerOption[] {
  const allowPaid = options?.allowPaid ?? true;
  const hasGoogleApiKey = options?.hasGoogleApiKey ?? false;
  const hasElevenLabsApiKey = options?.hasElevenLabsApiKey ?? false;
  const allowHeygen = options?.allowHeygen ?? false;
  const elevenLabsVoices = options?.elevenLabsVoices || [];
  const heygenVoices = options?.heygenVoices || [];
  const mergedElevenVoices = mergeElevenVoiceCatalog(elevenLabsVoices);

  const result: AiPickerOption[] = [
    {
      id: 'qwen3Tts:qwen3-free',
      title: 'Gemini 2.5 Flash Preview TTS',
      provider: 'Google AI Studio',
      description: 'Google AI Studio TTS를 이용하는 기본 TTS 모델입니다.',
      badge: '최소 비용',
      priceLabel: '최소 비용',
      costHint: '예상 비용: Google AI Studio 사용량 기준',
      qualityLabel: '기본형',
      speedLabel: '빠름',
      helper: formatVoiceCountLabel(getQwenVoicePickerOptions().length),
      avatarLabel: 'Q',
      tone: 'emerald',
      cardVariant: 'tts-model',
      group: 'free',
      tier: 'free',
      disabled: !hasGoogleApiKey,
      disabledReason: !hasGoogleApiKey
        ? 'Google AI Studio API를 연결하면 선택할 수 있습니다.'
        : undefined,
    },
  ];

  result.push(...getElevenLabsModelPickerOptions().map((item) => ({
    ...item,
    id: `elevenLabs:${item.id}` ,
    helper: formatVoiceCountLabel(mergedElevenVoices.length || ELEVENLABS_DEFAULT_VOICES.length),
    disabled: !allowPaid || !hasElevenLabsApiKey,
    disabledReason: !hasElevenLabsApiKey
      ? 'ElevenLabs API를 연결하면 선택할 수 있습니다.'
      : !allowPaid
        ? '유료 기능 연결이 필요합니다.'
        : undefined,
  })));

  result.push({
    id: 'heygen:heygen-default',
    title: 'HeyGen TTS 모델',
    provider: 'HeyGen',
    description: 'HeyGen 연동이 필요한 경우에만 사용하는 음성 모델입니다.',
    badge: '유료',
    priceLabel: '보통',
    costHint: '예상 비용: 외부 유료 API 사용량 기준',
    qualityLabel: '연동 전용',
    speedLabel: '보통',
    helper: formatVoiceCountLabel(heygenVoices.length || 1),
    avatarLabel: 'HG',
    tone: 'blue',
    cardVariant: 'tts-model',
    group: 'premium',
    tier: 'paid',
    disabled: !allowPaid || !allowHeygen,
    disabledReason: !allowHeygen
      ? '현재 설정에서는 HeyGen TTS를 선택할 수 없습니다.'
      : !allowPaid
        ? '유료 기능 연결이 필요합니다.'
        : undefined,
  });

  return result;
}
export function getSceneAudioPickerOptions(): AiPickerOption[] {
  return [
    ...getQwenVoicePickerOptions().map((item) => ({ ...item, id: `qwen3Tts:${item.id}` })),
    ...getElevenLabsModelPickerOptions().map((item) => ({ ...item, id: `elevenLabs:${item.id}` })),
    {
      id: 'heygen:default',
      title: 'HeyGen 기본 음성',
      provider: 'HeyGen',
      description: '현재 설정된 HeyGen 음성을 그대로 Step6 씬 오디오에 사용합니다.',
      badge: '유료',
      priceLabel: '높음',
      costHint: '예상 비용: 외부 유료 API 사용량 기준',
      qualityLabel: '연동 전용',
      speedLabel: '보통',
      helper: '세부 음성 관리는 HeyGen 연결 설정을 따릅니다.',
      avatarLabel: 'HG',
      tone: 'blue' as const,
      group: 'provider' as const,
      tier: 'paid' as const,
    },
  ];
}

export function getScriptModelSummary(modelId?: string | null): AiPickerOption | null {
  return getScriptModelPickerOptions(true).find((item) => item.id === modelId) || null;
}

export function getImageModelSummary(modelId?: string | null): AiPickerOption | null {
  return getImageModelPickerOptions().find((item) => item.id === modelId) || null;
}

export function getVideoModelSummary(modelId?: string | null): AiPickerOption | null {
  return getVideoModelPickerOptions().find((item) => item.id === modelId) || null;
}

export function getTtsPresetSummary(provider: string, value?: string | null, voices: VoiceItem[] = [], heygenVoices: HeygenVoiceItem[] = []): AiPickerOption | null {
  if (provider === 'elevenLabs') {
    return getElevenLabsVoicePickerOptions(voices).find((item) => item.id === value) || null;
  }
  if (provider === 'chatterbox') {
    return getChatterboxVoicePickerOptions().find((item) => item.id === value) || null;
  }
  if (provider === 'heygen') {
    return getHeygenVoicePickerOptions(heygenVoices).find((item) => item.id === value) || null;
  }
  return getQwenVoicePickerOptions().find((item) => item.id === value) || null;
}
