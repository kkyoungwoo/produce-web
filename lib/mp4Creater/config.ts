/**
 * TubeGen AI 전역 설정 파일
 * 민감한 API 키는 여기 직접 넣지 않고 설정 화면에서 입력하도록 유지합니다.
 */

export const IMAGE_MODELS = [
  {
    id: 'sample-scene-image',
    name: '샘플 장면 이미지',
    provider: '샘플',
    pricePerImage: 0,
    description: 'API 키 없이도 흐름을 확인할 수 있는 샘플 이미지',
    speed: '즉시',
  },
] as const;

export type ImageModelId = typeof IMAGE_MODELS[number]['id'];

export const SCRIPT_MODEL_OPTIONS = [
  { id: 'openrouter/auto', name: 'OpenRouter 자동 선택' },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 mini' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
] as const;

export const VIDEO_MODEL_OPTIONS = [
  { id: 'sample-sequence-v1', name: '샘플 시퀀스 v1' },
  { id: 'elevenlabs-mv-auto', name: 'ElevenLabs MV 자동 선택' },
] as const;

export const GEMINI_STYLE_CATEGORIES = [
  {
    id: 'main',
    name: '기본 화풍',
    styles: [
      {
        id: 'gemini-none',
        name: '자동 추천 안 함',
        prompt: '',
      },
    ],
  },
] as const;

export type GeminiStyleId =
  | typeof GEMINI_STYLE_CATEGORIES[number]['styles'][number]['id']
  | 'gemini-custom'
  | 'gemini-none';

export const PRICING = {
  USD_TO_KRW: 1450,
  IMAGE: {
    'sample-scene-image': 0,
  },
  TTS: {
    perCharacter: 0.00003,
  },
  VIDEO: {
    perVideo: 0.15,
  },
} as const;

export function toKRW(usd: number): number {
  return Math.round(usd * PRICING.USD_TO_KRW);
}

export function formatKRW(usd: number): string {
  const krw = toKRW(usd);
  return `${krw.toLocaleString('ko-KR')}원`;
}

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: '다국어 v2', description: '다국어 29개, 안정적인 기본 모델', supportsTimestamp: true },
  { id: 'eleven_v3', name: 'Eleven v3', description: '최신 모델, 70개 언어 지원, 표현력 강화', supportsTimestamp: true },
  { id: 'eleven_turbo_v2_5', name: '터보 v2.5', description: '빠른 속도, 32개 언어 지원', supportsTimestamp: true },
  { id: 'eleven_flash_v2_5', name: '플래시 v2.5', description: '초고속 응답, 32개 언어 지원', supportsTimestamp: true },
  { id: 'eleven_turbo_v2', name: '터보 v2', description: '빠른 속도, 영어 최적화', supportsTimestamp: true },
  { id: 'eleven_monolingual_v1', name: '영어 전용 v1', description: '영어 전용 레거시 모델', supportsTimestamp: false },
] as const;

export type ElevenLabsModelId = typeof ELEVENLABS_MODELS[number]['id'];

export const QWEN_TTS_PRESET_OPTIONS = [
  { id: 'qwen-default', name: 'qwen3-tts 기본 보이스' },
  { id: 'qwen-soft', name: 'qwen3-tts 부드러운 보이스' },
] as const;

export const TTS_NARRATOR_OPTIONS = [
  ...QWEN_TTS_PRESET_OPTIONS,
  { id: 'rachel', name: 'Rachel 보이스 (ElevenLabs)' },
  { id: 'adam', name: 'Adam 보이스 (ElevenLabs)' },
] as const;

export const BGM_MODEL_OPTIONS = [
  { id: 'sample-ambient-v1', name: '샘플 앰비언트 v1' },
  { id: 'sample-cinematic-v1', name: '샘플 시네마틱 v1' },
  { id: 'sample-news-v1', name: '샘플 뉴스 v1' },
  { id: 'elevenlabs-music-auto', name: 'ElevenLabs 음악 자동 선택' },
] as const;

export const ELEVENLABS_DEFAULT_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female' as const, accent: '미국식', description: '안정적인 기본 나레이션 보이스' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female' as const, accent: '미국식', description: '부드럽고 친근한 대화형 보이스' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female' as const, accent: '영국식', description: '차분하고 고급스러운 영국식 보이스' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male' as const, accent: '미국식', description: '뉴스와 설명형에 어울리는 보이스' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male' as const, accent: '미국식', description: '젊고 역동적인 진행형 보이스' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'male' as const, accent: '미국식', description: '차분하고 신뢰감 있는 보이스' },
] as const;

export type ElevenLabsDefaultVoice = typeof ELEVENLABS_DEFAULT_VOICES[number];
export type VoiceGender = 'male' | 'female';

export const CONFIG = {
  DEFAULT_VOICE_ID: '21m00Tcm4TlvDq8ikWAM',
  DEFAULT_ELEVENLABS_MODEL: 'eleven_multilingual_v2' as ElevenLabsModelId,
  DEFAULT_TTS_NARRATOR: 'qwen-default',
  DEFAULT_BGM_MODEL: 'sample-ambient-v1',
  DEFAULT_IMAGE_MODEL: 'sample-scene-image' as ImageModelId,
  OPENROUTER_DEFAULT_MAX_TOKENS: 800,
  OPENROUTER_DEFAULT_INPUT_MAX_CHARS: 7000,
  VIDEO_WIDTH: 1280,
  VIDEO_HEIGHT: 720,
  STORAGE_KEYS: {
    ELEVENLABS_API_KEY: 'tubegen_el_key',
    ELEVENLABS_VOICE_ID: 'tubegen_el_voice',
    ELEVENLABS_MODEL: 'tubegen_el_model',
    FAL_API_KEY: 'tubegen_fal_key',
    IMAGE_MODEL: 'tubegen_image_model',
    GEMINI_STYLE: 'tubegen_gemini_style',
    GEMINI_CUSTOM_STYLE: 'tubegen_gemini_custom_style',
    PROJECTS: 'tubegen_projects',
    STUDIO_STATE_CACHE: 'tubegen_studio_state_cache',
    OPENROUTER_API_KEY: 'tubegen_openrouter_key',
    OPENROUTER_MODELS: 'tubegen_openrouter_models',
    OPENROUTER_MAX_TOKENS: 'mp4creater_openrouter_max_tokens',
    OPENROUTER_INPUT_MAX_CHARS: 'mp4creater_openrouter_input_max_chars',
    TTS_PROVIDER: 'mp4creater_tts_provider',
    HEYGEN_API_KEY: 'mp4creater_heygen_api_key',
    HEYGEN_VOICE_ID: 'mp4creater_heygen_voice_id',
    QWEN_VOICE_PRESET: 'mp4creater_qwen_voice_preset',
    QWEN_STYLE_PRESET: 'mp4creater_qwen_style_preset',
    BGM_PROVIDER: 'mp4creater_bgm_provider',
    BGM_STYLE: 'mp4creater_bgm_style',
    MUSIC_VIDEO_PROVIDER: 'mp4creater_music_video_provider',
    MUSIC_VIDEO_MODE: 'mp4creater_music_video_mode',
    STUDIO_STORAGE_DIR: 'tubegen_storage_dir',
    SELECTED_CHARACTER_ID: 'tubegen_selected_character_id',
    LAST_CONTENT_TYPE: 'mp4creater_last_content_type',
    PENDING_SCENE_AUTOSTART: 'mp4creater_pending_scene_autostart',
  },
  ANIMATION: {
    ENABLED_SCENES: 10,
    VIDEO_DURATION: 5,
  },
};
