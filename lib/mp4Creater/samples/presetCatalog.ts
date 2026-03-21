export interface CharacterSamplePreset {
  id: string;
  name: string;
  prompt: string;
  imageData: string;
  role: 'lead' | 'support';
  roleLabel: string;
}

export interface StyleSamplePreset {
  id: string;
  label: string;
  prompt: string;
  imageData: string;
}

export interface StyleCharacterPreset {
  id: 'real' | 'stick' | 'webtoon';
  label: string;
  characterId: string;
  styleId: string;
}

export const CHARACTER_SAMPLE_PRESETS: CharacterSamplePreset[] = [
  {
    id: 'char-real-human',
    name: '실사 사람형',
    prompt: 'Photoreal human style reference. Korean presenter look, clear silhouette.',
    imageData: '/mp4Creater/samples/characters/char-real-human-v1.svg',
    role: 'lead',
    roleLabel: '주인공 샘플',
  },
  {
    id: 'char-stickman',
    name: '졸라맨 그림',
    prompt: 'Stickman doodle character, simple line body, playful minimal look.',
    imageData: '/mp4Creater/samples/characters/char-stickman-v1.svg',
    role: 'support',
    roleLabel: '조연 샘플 1',
  },
  {
    id: 'char-jp-webtoon',
    name: '일본 웹툰 느낌',
    prompt: 'Japanese webtoon inspired character, clean linework and expressive eyes.',
    imageData: '/mp4Creater/samples/characters/char-jp-webtoon-v1.svg',
    role: 'support',
    roleLabel: '조연 샘플 2',
  },
];

export const STYLE_SAMPLE_PRESETS: StyleSamplePreset[] = [
  {
    id: 'style-animation',
    label: '애니메이션 느낌',
    prompt: 'Animation style for full-scene video look, crisp cel shading, bright key light, saturated accent colors, readable silhouettes, playful motion energy, clean background depth.',
    imageData: '/mp4Creater/samples/styles/style-animation-v1.svg',
  },
  {
    id: 'style-korean-real',
    label: '실사 한국 느낌',
    prompt: 'Korean cinematic realism for full-scene storytelling, natural skin tone, soft contrast, emotionally grounded composition, practical lighting, polished drama mood, restrained color grade.',
    imageData: '/mp4Creater/samples/styles/style-korean-real-v1.svg',
  },
  {
    id: 'style-sketch',
    label: '스케치 느낌',
    prompt: 'Hand-drawn sketch storyboard style, visible pencil strokes, paper grain, loose shading blocks, planning-board composition, monochrome base with selective accent color, previsualization mood.',
    imageData: '/mp4Creater/samples/styles/style-sketch-v1.svg',
  },
];

export const STYLE_CHARACTER_PRESETS: StyleCharacterPreset[] = [
  {
    id: 'real',
    label: '실사 캐릭터 + 한국형 실사',
    characterId: 'char-real-human',
    styleId: 'style-korean-real',
  },
  {
    id: 'stick',
    label: '졸라맨 + 애니메이션',
    characterId: 'char-stickman',
    styleId: 'style-animation',
  },
  {
    id: 'webtoon',
    label: '일본 웹툰 + 스케치',
    characterId: 'char-jp-webtoon',
    styleId: 'style-sketch',
  },
];

export function getCharacterSamplePreset(id: string) {
  return CHARACTER_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}

export function getStyleSamplePreset(id: string) {
  return STYLE_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}

export function getStyleCharacterPreset(id: StyleCharacterPreset['id']) {
  return STYLE_CHARACTER_PRESETS.find((item) => item.id === id) || null;
}