
import { CharacterSamplePreset, StyleSamplePreset, WorkflowCharacterStyleOption } from '../types';

// 여기만 수정하면 Step4/Step5 샘플 카드와 프롬프트 기준이 함께 바뀝니다.
export const WORKFLOW_CHARACTER_STYLE_OPTIONS: WorkflowCharacterStyleOption[] = [
  {
    id: 'character-realistic',
    label: '실사형 캐릭터',
    description: '자연스러운 얼굴 비율과 현실적인 조명, 또렷한 인물 중심 묘사',
    prompt: 'Generate characters in a realistic human style with natural facial proportions, clean wardrobe details, grounded lighting, and believable textures while keeping a clear silhouette.',
    accentFrom: 'from-slate-900',
    accentTo: 'to-slate-600',
    sampleImage: '/mp4Creater/samples/characters/char-real-human-v1.svg',
  },
  {
    id: 'character-kdrama',
    label: 'K-드라마 캐릭터',
    description: '따뜻한 피부톤과 친근한 조명, 감정선이 잘 보이는 한국형 드라마 톤',
    prompt: 'Generate characters in a warm Korean drama style with flattering skin tones, soft cinematic lighting, natural wardrobe details, and emotionally readable facial acting.',
    accentFrom: 'from-rose-500',
    accentTo: 'to-orange-400',
    sampleImage: '/mp4Creater/samples/characters/char-real-human-v1.svg',
  },
  {
    id: 'character-noir',
    label: '느와르 캐릭터',
    description: '강한 명암과 차가운 도시 야경, 범죄 스릴러 분위기에 어울리는 인물 연출',
    prompt: 'Generate characters in a noir crime thriller style with hard contrast lighting, cold urban night tones, sharp silhouettes, and an intense cinematic presence.',
    accentFrom: 'from-slate-800',
    accentTo: 'to-blue-700',
    sampleImage: '/mp4Creater/samples/characters/char-real-human-v1.svg',
  },
];

export const CHARACTER_SAMPLE_PRESETS: CharacterSamplePreset[] = [
  { id: 'char-real-human', name: '실사 사람형', prompt: 'Photoreal human style reference. Korean presenter look, clear silhouette.', imageData: '/mp4Creater/samples/characters/char-real-human-v1.svg', role: 'lead', roleLabel: '주인공 샘플' },
  { id: 'char-stickman', name: '졸라맨 그림', prompt: 'Stickman doodle character, simple line body, playful minimal look.', imageData: '/mp4Creater/samples/characters/char-stickman-v1.svg', role: 'support', roleLabel: '조연 샘플 1' },
  { id: 'char-jp-webtoon', name: '일본 웹툰 느낌', prompt: 'Japanese webtoon inspired character, clean linework and expressive eyes.', imageData: '/mp4Creater/samples/characters/char-jp-webtoon-v1.svg', role: 'support', roleLabel: '조연 샘플 2' },
];

export const STYLE_SAMPLE_PRESETS: StyleSamplePreset[] = [
  { id: 'style-cinematic-night', label: '시네마틱 나이트', description: '짙은 밤색 팔레트와 선명한 대비, 영화 예고편 같은 도시 야간 무드', prompt: 'Cinematic night style for full-scene rendering. Deep contrast, controlled highlights, urban night atmosphere, dramatic framing rhythm, rich blue-black palette, and premium movie-trailer finish.', imageData: '/mp4Creater/samples/styles/style-cinematic-night-v1.svg', accent: '#1d4ed8' },
  { id: 'style-news-clean', label: '뉴스 클린', description: '정돈된 정보 전달용 프레임, 밝은 스튜디오 톤, 또렷한 설명형 배경', prompt: 'Clean news explainer style. Bright studio balance, organized information framing, polished broadcast surfaces, controlled contrast, and easy-to-read visual hierarchy.', imageData: '/mp4Creater/samples/styles/style-news-clean-v1.svg', accent: '#0ea5e9' },
];
