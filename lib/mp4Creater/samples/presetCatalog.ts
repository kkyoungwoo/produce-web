export interface WorkflowCharacterStyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  accentFrom: string;
  accentTo: string;
}

// Step4 캐릭터 느낌 카드와 Step4/Step5 샘플 프롬프트·이미지는 이 파일에서 한 번에 관리합니다.
// - 캐릭터 느낌 카드: WORKFLOW_CHARACTER_STYLE_OPTIONS
// - 캐릭터 샘플 프롬프트/이미지: CHARACTER_SAMPLE_PRESETS
// - 화풍 샘플 프롬프트/이미지: STYLE_SAMPLE_PRESETS
export const WORKFLOW_CHARACTER_STYLE_OPTIONS: WorkflowCharacterStyleOption[] = [
  {
    id: 'character-realistic',
    label: '실사형 캐릭터',
    description: '자연스러운 얼굴 비율과 현실적인 조명, 또렷한 인물 중심 묘사',
    prompt: 'Generate characters in a realistic human style with natural facial proportions, clean wardrobe details, grounded lighting, and believable textures while keeping a clear silhouette.',
    accentFrom: 'from-slate-900',
    accentTo: 'to-slate-600',
  },
  {
    id: 'character-kdrama',
    label: 'K-드라마 캐릭터',
    description: '따뜻한 피부톤과 친근한 조명, 감정선이 잘 보이는 한국형 드라마 톤',
    prompt: 'Generate characters in a warm Korean drama style with flattering skin tones, soft cinematic lighting, natural wardrobe details, and emotionally readable facial acting.',
    accentFrom: 'from-rose-500',
    accentTo: 'to-orange-400',
  },
  {
    id: 'character-noir',
    label: '느와르 캐릭터',
    description: '강한 명암과 차가운 도시 야경, 범죄 스릴러 분위기에 어울리는 인물 연출',
    prompt: 'Generate characters in a noir crime thriller style with hard contrast lighting, cold urban night tones, sharp silhouettes, and an intense cinematic presence.',
    accentFrom: 'from-slate-800',
    accentTo: 'to-blue-700',
  },
  {
    id: 'character-futuristic',
    label: 'SF 퓨처리스틱 캐릭터',
    description: '메탈릭 질감과 네온 조명, 미래 도시 감성이 살아있는 하이테크 캐릭터',
    prompt: 'Generate characters in a futuristic sci-fi style with neon reflections, sleek high-tech wardrobe cues, metallic material accents, and a polished cyber city atmosphere.',
    accentFrom: 'from-cyan-500',
    accentTo: 'to-violet-500',
  },
  {
    id: 'character-anime',
    label: '애니형 캐릭터',
    description: '선명한 라인과 셀 셰이딩, 감정 표현이 또렷한 애니 감성',
    prompt: 'Generate characters in a polished anime style with expressive eyes, clean line art, cel shading, and vibrant but controlled color accents.',
    accentFrom: 'from-fuchsia-600',
    accentTo: 'to-violet-500',
  },
  {
    id: 'character-webtoon',
    label: '웹툰형 캐릭터',
    description: '웹툰 컷에 잘 어울리는 또렷한 외곽선과 리듬감 있는 채색',
    prompt: 'Generate characters in a Korean webtoon style with crisp outlines, readable silhouettes, polished facial acting, and stylish but simplified coloring.',
    accentFrom: 'from-blue-600',
    accentTo: 'to-cyan-500',
  },
  {
    id: 'character-royal-fantasy',
    label: '로판 캐릭터',
    description: '궁정 분위기와 장식성이 강조된 화려한 로맨스 판타지 캐릭터',
    prompt: 'Generate characters in a romantic fantasy court style with luxurious costume details, elegant poses, decorative accessories, and graceful lighting.',
    accentFrom: 'from-pink-500',
    accentTo: 'to-fuchsia-500',
  },
  {
    id: 'character-3d',
    label: '3D형 캐릭터',
    description: '입체감 있는 재질과 부드러운 조명, 장난감처럼 정리된 비율',
    prompt: 'Generate characters in a stylized 3D illustration style with soft studio lighting, dimensional materials, and a polished cinematic finish.',
    accentFrom: 'from-emerald-600',
    accentTo: 'to-teal-500',
  },
  {
    id: 'character-illustration',
    label: '일러스트형 캐릭터',
    description: '포스터처럼 깔끔한 구도와 감성적인 브러시 질감이 있는 캐릭터',
    prompt: 'Generate characters in a premium illustration style with editorial composition, tasteful brush texture, elegant color design, and a strong silhouette.',
    accentFrom: 'from-amber-500',
    accentTo: 'to-orange-500',
  },
];

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