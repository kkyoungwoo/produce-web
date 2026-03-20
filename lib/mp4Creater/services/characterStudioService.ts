import {
  AspectRatio,
  CharacterProfile,
  ContentType,
  PromptedImageAsset,
  StorySelectionState,
} from '../types';
import { getAspectRatioPrompt } from '../utils/aspectRatio';
import { runOpenRouterText } from './openRouterService';

const BASE_STYLE_TEXT = `Stylized 2D anime character inspired by early 2000s animation aesthetics and nostalgic city pop atmosphere. Balanced, human-like facial proportions with clear animated style. Simple body design with classic anime proportions, relaxed posture, minimal clothing in solid colors, bold clean lineart, soft cel shading, dreamy atmospheric mood, high resolution, full body, full figure, clear silhouette, background removed, no text, non-photorealistic illustration only.`;

function buildSimilaritySuffix(kind: 'character' | 'style', index: number) {
  if (kind === 'character') {
    return `similar variant ${index + 1}, keep the same character identity, face mood, hairstyle direction, outfit family, and silhouette. Only make a near-match alternative pose or detail update, full body, clean silhouette, highly similar result`;
  }
  return `similar variant ${index + 1}, keep the same art direction, color palette family, lighting rhythm, texture density, mood, and composition language. Only make a near-match visual alternative, highly similar result`;
}

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => {
    return (acc + char.charCodeAt(0) * (index + 1)) % 100000;
  }, 0);
}

function encodeBase64(value: string) {
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return (globalThis as any).Buffer.from(value, 'utf-8').toString('base64');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPromptPreviewCard(options: {
  label: string;
  subtitle: string;
  prompt: string;
  accent: string;
  kind: 'character' | 'style' | 'thumbnail';
  sourceMode?: PromptedImageAsset['sourceMode'];
  groupId?: string;
  groupLabel?: string;
}): PromptedImageAsset {
  const safePrompt = escapeXml(options.prompt.slice(0, 180));
  const safeLabel = escapeXml(options.label);
  const safeSubtitle = escapeXml(options.subtitle);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#eff6ff"/>
      </linearGradient>
    </defs>
    <rect width="960" height="560" rx="32" fill="url(#bg)"/>
    <rect x="32" y="32" width="896" height="496" rx="28" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>
    <circle cx="770" cy="122" r="86" fill="${options.accent}" opacity="0.14"/>
    <rect x="96" y="126" width="228" height="270" rx="24" fill="#f8fafc" stroke="#cbd5e1"/>
    <circle cx="210" cy="186" r="48" fill="#e2e8f0"/>
    <path d="M162 300 C182 256 238 256 258 300" fill="none" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M210 236 L210 362" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M154 286 L266 286" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M176 420 L210 362 L244 420" fill="none" stroke="#475569" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="390" y="102" fill="#0f172a" font-size="34" font-family="Arial, sans-serif" font-weight="700">${safeLabel}</text>
    <text x="390" y="144" fill="#475569" font-size="20" font-family="Arial, sans-serif">${safeSubtitle}</text>
    <foreignObject x="390" y="188" width="470" height="230">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 24px; line-height: 1.5; color: #334155; word-break: keep-all;">${safePrompt}</div>
    </foreignObject>
    <text x="390" y="470" fill="#64748b" font-size="18" font-family="Arial, sans-serif">프롬프트 기반 선택 카드</text>
  </svg>`;

  const id = `prompted_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: options.label,
    prompt: options.prompt,
    imageData: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    createdAt: Date.now(),
    kind: options.kind,
    sourceMode: options.sourceMode || 'sample',
    groupId: options.groupId || id,
    groupLabel: options.groupLabel || options.label,
  };
}

function normalizeRole(value?: string): CharacterProfile['role'] {
  const lower = `${value || ''}`.toLowerCase();
  if (/narrator|narration|나레이션|해설|진행자/.test(lower)) return 'narrator';
  if (/lead|main|hero|protagonist|주인공|앵커|화자|리드|메인/.test(lower)) return 'lead';
  return 'support';
}

function defaultRoleLabel(role: CharacterProfile['role'], order: number, name: string) {
  if (role === 'lead') return `${name} / 주인공`;
  if (role === 'narrator') return `${name} / 나레이터`;
  return `${name} / 조연 ${order}`;
}

function desiredCastCount(script: string) {
  const paragraphs = script.split(/\n{2,}/).filter(Boolean).length;
  if (paragraphs >= 6) return 4;
  if (paragraphs >= 4) return 3;
  return 2;
}

function extractSupportNames(script: string) {
  const pool = [
    '친구',
    '동료',
    '연인',
    '상사',
    '기자',
    '앵커',
    '가족',
    '감독',
    '손님',
    '직원',
    '고객',
    '라이벌',
    '선배',
    '후배',
    '주민',
    '전문가',
    '상대',
  ];
  return pool.filter((keyword) => script.includes(keyword));
}

function buildCharacterPrompt(name: string, roleLabel: string, script: string, styleHint: string) {
  return `${name} / ${roleLabel}\n${BASE_STYLE_TEXT}\nunique character design, varied outfit style, clean silhouette, based on the story mood: ${styleHint}. Scene context: ${script.slice(0, 220)}`;
}

function makeCharacter(options: {
  name: string;
  role: CharacterProfile['role'];
  roleLabel: string;
  script: string;
  styleHint: string;
  castOrder: number;
}): CharacterProfile {
  const prompt = buildCharacterPrompt(options.name, options.roleLabel, options.script, options.styleHint);
  const preview = buildPromptPreviewCard({
    label: options.name,
    subtitle: options.roleLabel,
    prompt,
    accent: options.role === 'lead' ? '#8b5cf6' : '#2563eb',
    kind: 'character',
  });

  return {
    id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: options.name,
    description: options.roleLabel,
    visualStyle: options.styleHint,
    role: options.role,
    roleLabel: options.roleLabel,
    rolePrompt: options.roleLabel,
    castOrder: options.castOrder,
    prompt,
    imageData: preview.imageData,
    generatedImages: [preview],
    selectedImageId: preview.id,
    createdAt: Date.now(),
  };
}

function fallbackCharacters(script: string, selections: StorySelectionState): CharacterProfile[] {
  const leadName = selections.protagonist?.trim() || '주인공';
  const supportKeyword = extractSupportNames(script)[0] || '조연';

  return [
    makeCharacter({
      name: leadName,
      role: 'lead',
      roleLabel: '주인공 / 서사를 이끄는 중심 인물',
      script,
      styleHint: selections.mood,
      castOrder: 1,
    }),
    makeCharacter({
      name: supportKeyword,
      role: 'support',
      roleLabel: supportKeyword === '앵커' || supportKeyword === '기자'
        ? `${supportKeyword} / 진행과 설명을 맡는 조연`
        : '조연 / 주인공의 흐름을 받쳐 주는 인물',
      script,
      styleHint: selections.mood,
      castOrder: 2,
    }),
  ];
}

export async function extractCharactersFromScript(options: {
  script: string;
  selections: StorySelectionState;
  contentType: ContentType;
  model?: string;
  allowAi?: boolean;
}): Promise<CharacterProfile[]> {
  const fallback = fallbackCharacters(options.script, options.selections);
  if (!options.allowAi) return fallback;

  try {
    const raw = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.35,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '한국어 스토리에서 주인공과 조연을 추출하는 도우미다. JSON만 반환한다. 키는 characters 이고, 배열 원소는 name, roleType, roleLabel, styleHint 를 가진다. roleType은 lead 또는 support만 사용한다.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${options.contentType}\n주인공 후보: ${options.selections.protagonist}\n대본:\n${options.script}\n\n가장 중요한 인물 2~${desiredCastCount(options.script)}명만 뽑아줘. 1명은 주인공 lead로 두고, 나머지는 support로 정리해줘. roleLabel은 사용자가 카드에서 바로 이해할 수 있는 한국어 역할명으로 써 줘.`,
        },
      ],
    });
    const parsed = JSON.parse(raw);
    const characters = Array.isArray(parsed?.characters) ? parsed.characters : [];
    if (!characters.length) return fallback;

    return characters.slice(0, desiredCastCount(options.script)).map((item: any, index: number) => {
      const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : (index === 0 ? options.selections.protagonist || '주인공' : `조연 ${index}`);
      const role = normalizeRole(item?.roleType || item?.roleLabel || (index === 0 ? 'lead' : 'support'));
      const roleLabel = typeof item?.roleLabel === 'string' && item.roleLabel.trim()
        ? item.roleLabel.trim()
        : defaultRoleLabel(role, index, name);
      const styleHint = typeof item?.styleHint === 'string' && item.styleHint.trim() ? item.styleHint.trim() : options.selections.mood;
      return makeCharacter({
        name,
        role,
        roleLabel,
        script: options.script,
        styleHint,
        castOrder: index + 1,
      });
    });
  } catch {
    return fallback;
  }
}

export function buildStyleRecommendations(
  script: string,
  contentType: ContentType,
  excludeLabels: string[] = [],
  limit = 1,
  aspectRatio: AspectRatio = '16:9'
): PromptedImageAsset[] {
  const seed = hashCode(script || contentType);
  const palettes = [
    ['감성 일러스트풍', '#8b5cf6'],
    ['시네마틱풍', '#0f172a'],
    ['수채화풍', '#06b6d4'],
    ['웹툰풍', '#2563eb'],
    ['애니메이션풍', '#ec4899'],
    ['동화풍', '#16a34a'],
    ['미니멀 아트풍', '#f59e0b'],
    ['네온 시티팝풍', '#7c3aed'],
    ['빈티지 포스터풍', '#b45309'],
    ['클린 뉴스 그래픽풍', '#0f766e'],
    ['몽환 판타지풍', '#9333ea'],
    ['하이패션 에디토리얼풍', '#be185d'],
  ] as const;

  const filtered = palettes.filter(([label]) => !excludeLabels.includes(label));
  const fallbackPool = filtered.length ? filtered : palettes;
  const picked = fallbackPool.slice(0, Math.max(1, limit));

  return picked.map(([label, accent], index) => {
    const prompt = `${label}. Create a cohesive full-scene visual style for the final video. Keep background direction, composition rhythm, lighting logic, color palette, texture density, and rendering finish consistent across scenes. ${getAspectRatioPrompt(aspectRatio)}. Variation seed ${seed + index + excludeLabels.length}. Story context: ${(script || contentType).slice(0, 220)}.`;
    return buildPromptPreviewCard({
      label,
      subtitle: contentType === 'news' || contentType === 'info_delivery' ? '최종 영상용 정보형 화풍' : '최종 영상용 비주얼 화풍',
      prompt,
      accent,
      kind: 'style',
      sourceMode: 'ai',
      groupLabel: label,
    });
  });
}

export function createPromptVariants(options: {
  title: string;
  prompt: string;
  kind: 'character' | 'style';
  count?: number;
  groupId?: string;
  groupLabel?: string;
  sourceMode?: PromptedImageAsset['sourceMode'];
  existingCount?: number;
}): PromptedImageAsset[] {
  const total = options.count || 1;
  const offset = options.existingCount || 0;
  return Array.from({ length: total }).map((_, index) => {
    const variantIndex = offset + index;
    const suffix = buildSimilaritySuffix(options.kind, variantIndex);
    return buildPromptPreviewCard({
      label: `${options.title} 유사안 ${variantIndex + 1}`,
      subtitle: options.kind === 'character' ? '선택 캐릭터와 비슷한 추천' : '선택 화풍과 비슷한 추천',
      prompt: `${options.prompt}\n${suffix}`,
      accent: options.kind === 'character' ? '#8b5cf6' : '#2563eb',
      kind: options.kind,
      sourceMode: options.sourceMode || 'ai',
      groupId: options.groupId,
      groupLabel: options.groupLabel || options.title,
    });
  });
}

export function buildUploadDrivenPrompt(options: {
  label: string;
  kind: 'character' | 'style';
  topic: string;
  mood?: string;
  setting?: string;
  protagonist?: string;
  contentType: ContentType;
  aspectRatio?: AspectRatio;
}): string {
  const safeLabel = options.label.replace(/[_-]+/g, ' ').trim() || (options.kind === 'character' ? '업로드 캐릭터' : '업로드 화풍');
  if (options.kind === 'character') {
    return `${safeLabel} 기반 캐릭터 디자인. ${BASE_STYLE_TEXT} Keep the identity suggested by the uploaded reference, preserve silhouette and facial mood, adapt to ${options.contentType} content. Topic: ${options.topic || 'untitled project'}. Mood: ${options.mood || 'balanced'}. Setting: ${options.setting || 'cinematic background'}. Main role hint: ${options.protagonist || 'story lead'}.`;
  }
  return `${safeLabel} 기반 화풍 프롬프트. ${getAspectRatioPrompt(options.aspectRatio || '16:9')}, preserve the uploaded image mood, color palette, texture density, lighting rhythm, and overall atmosphere. Adapt for ${options.contentType} content about ${options.topic || 'untitled project'}, with ${options.mood || 'balanced'} emotional tone and ${options.setting || 'cinematic space'} background feeling.`;
}

export function createCharacterCardFromPrompt(options: {
  name: string;
  prompt: string;
  description?: string;
  imageData?: string;
  sourceMode?: PromptedImageAsset['sourceMode'];
  role?: CharacterProfile['role'];
  roleLabel?: string;
  castOrder?: number;
}): CharacterProfile {
  const preview = buildPromptPreviewCard({
    label: options.name,
    subtitle: options.description || '프롬프트 신규 캐릭터',
    prompt: options.prompt,
    accent: '#2563eb',
    kind: 'character',
    sourceMode: options.sourceMode || 'ai',
  });
  const selectedImage = {
    ...preview,
    imageData: options.imageData || preview.imageData,
    sourceMode: options.sourceMode || 'ai',
  };

  const role = options.role || 'lead';
  const roleLabel = options.roleLabel || options.description || (
    role === 'lead'
      ? '주인공 / 직접 추가한 캐릭터'
      : role === 'narrator'
        ? '나레이터 / 직접 추가한 캐릭터'
        : '조연 / 직접 추가한 캐릭터'
  );
  return {
    id: `char_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: options.name,
    description: options.description || '프롬프트 신규 캐릭터',
    visualStyle: '프롬프트 직접 생성',
    role,
    roleLabel,
    rolePrompt: roleLabel,
    castOrder: options.castOrder || 1,
    prompt: options.prompt,
    imageData: selectedImage.imageData,
    generatedImages: [selectedImage],
    selectedImageId: selectedImage.id,
    createdAt: Date.now(),
  };
}

export function createStyleCardFromPrompt(options: {
  label: string;
  prompt: string;
  imageData?: string;
  sourceMode?: PromptedImageAsset['sourceMode'];
  groupId?: string;
  groupLabel?: string;
}): PromptedImageAsset {
  const preview = buildPromptPreviewCard({
    label: options.label,
    subtitle: '프롬프트 신규 화풍',
    prompt: options.prompt,
    accent: '#8b5cf6',
    kind: 'style',
    sourceMode: options.sourceMode || 'ai',
    groupId: options.groupId,
    groupLabel: options.groupLabel || options.label,
  });
  return {
    ...preview,
    imageData: options.imageData || preview.imageData,
    sourceMode: options.sourceMode || 'ai',
  };
}

