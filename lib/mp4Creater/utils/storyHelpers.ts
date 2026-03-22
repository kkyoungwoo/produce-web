/**
 * mp4Creater 전용 스토리/씬 보조 함수
 */

import { AspectRatio, ContentType, StorySelectionState } from '../types';
import { buildFreshIdeaRule, buildSampleTheme, createCreativeDirection } from '../config/creativeVariance';
import { getAspectRatioDimensions, getAspectRatioPrompt } from './aspectRatio';

export interface StoryDraftOptions extends StorySelectionState {
  topic: string;
  contentType: ContentType;
}

export function normalizeStoryText(text: string): string {
  return text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function splitStoryIntoParagraphScenes(text: string): string[] {
  const normalized = normalizeStoryText(text);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs;

  return normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function estimateClipDuration(text: string): number {
  const length = text.trim().length;
  const seconds = 2.8 + length / 18;
  return Math.min(6, Math.max(3, Number(seconds.toFixed(1))));
}

export function buildSelectableStoryDraft(options: StoryDraftOptions): string {
  const topic = options.topic.trim() || '한밤중에 시작된 뜻밖의 이야기';
  const protagonist = options.protagonist.trim() || '주인공';
  const setting = options.setting.trim() || '도시의 골목';
  const conflict = options.conflict.trim() || '피할 수 없는 선택';
  const direction = createCreativeDirection(`${options.contentType}:${topic}:${protagonist}:${setting}:${conflict}`, 0, options.contentType);

  if (options.contentType === 'music_video') {
    return normalizeStoryText([
      `[Intro]
${setting} 위로 젖은 불빛이 내려와
${topic}의 첫 문장이 입술 끝에 맴돌아`,
      `[Verse 1]
${protagonist}의 걸음마다 ${options.mood} 밤이 번지고
말하지 못한 ${conflict}만 박자처럼 남아
${direction.narrativeAngle}
같은 거리를 걸어도 오늘은 다르게 울려`,
      `[Chorus]
나는 너를 다시 불러, 후렴처럼 크게 불러
사라진 줄 알았던 장면을 다시 살려
끝난 줄 알았던 이 밤도 아직 노래가 돼
${options.endingTone} 기분까지 안고 끝까지 갈래`,
      `[Verse 2]
젖은 창문 너머로 뒤늦은 진심이 번지고
숨겨 둔 표정들이 한 줄씩 멜로디가 돼
돌아설 수 있었던 순간도 천천히 지나가고
이제는 미뤄 둔 마음까지 전부 따라와`,
      `[Outro]
마지막 불빛 아래서도 나는 멈추지 않아
${direction.transitionBeat}
남겨 둔 한마디까지 오늘의 노래로 안아`,
    ].join('\n\n'));
  }

  if (options.contentType === 'news') {
    return normalizeStoryText([
      `${setting}의 공기가 먼저 화면을 채우고, ${protagonist}은 ${topic}의 이상 징후를 가장 먼저 알아챈다. ${options.mood} 무드가 깔린 오프닝 안에서 관객은 설명보다 표정과 움직임으로 상황의 균열을 읽게 된다. ${direction.visualHook}`, 
      `다음 장면에서는 사소해 보였던 단서들이 빠르게 겹치며 ${conflict}의 실체가 드러난다. ${protagonist}은 멈추지 않고 더 깊은 곳으로 들어가고, 장면의 긴장감은 영화처럼 한 컷씩 눌러 붙는다.`,
      `중반부에는 인물의 선택과 시선이 부딪히며 갈등이 정면으로 폭발한다. 말보다 공간의 온도, 조명, 소품이 먼저 의미를 만들고, ${topic}는 하나의 사건이 아니라 인물을 바꾸는 장면으로 보이기 시작한다.`,
      `엔딩은 ${options.endingTone} 결로 남긴다. 모든 설명을 닫아 버리기보다 마지막 표정과 여운을 남겨, 다음 컷이 자동으로 떠오르는 시네마틱 마감으로 정리한다.`,
    ].join('\n\n'));
  }

  if (options.contentType === 'info_delivery') {
    return normalizeStoryText([
      `먼저 ${topic}가 왜 지금 중요한지부터 짚는다. ${setting}에서 바로 마주칠 수 있는 상황을 예로 열고, 이번 영상에서 무엇을 이해하게 될지 ${options.mood} 톤으로 선명하게 예고한다.`,
      `이어서 핵심 구조를 한 단계씩 풀어 준다. ${protagonist} 시점에서 가장 먼저 확인해야 할 포인트를 짚고, ${conflict}이 실제로 어떤 문제를 만드는지 짧은 예시와 함께 설명한다.`,
      `중간 문단에서는 자주 헷갈리는 지점을 비교해 정리한다. 무엇을 먼저 보고 무엇을 나중에 판단해야 하는지, 실수하기 쉬운 흐름과 더 나은 선택을 나란히 보여 주며 이해를 돕는다. ${direction.subtitleTone}`, 
      `마지막은 ${options.endingTone} 톤으로 요약한다. 지금 기억해야 할 한 줄과 바로 해 볼 다음 행동을 남겨, 시청자가 영상을 보고 곧바로 적용할 수 있게 마무리한다.`,
    ].join('\n\n'));
  }

  return normalizeStoryText([
    `${setting}에서 ${protagonist}은 ${topic}의 조짐을 처음 마주한다. ${options.mood} 톤으로 시작하지만, 화면 어딘가에는 이미 ${conflict}의 그림자가 놓여 있다. ${direction.visualHook}`, 
    `처음엔 사소해 보였던 단서가 점점 커지면서 ${protagonist}의 일상은 흔들리기 시작한다. ${options.genre} 흐름답게 사건은 조용히 쌓이고, 작은 선택 하나가 다음 장면의 방향을 바꾼다.`,
    `결정적인 순간, ${protagonist}은 가장 숨기고 싶었던 감정과 정면으로 마주한다. 그동안 외면하던 ${conflict}가 드러나고, 이제는 같은 자리로 돌아갈 수 없다는 사실을 깨닫는다. ${direction.narrativeAngle}`, 
    `마지막 장면은 ${options.endingTone} 감정으로 남긴다. 모든 것이 완전히 해결된 것처럼 보이지 않아도, ${protagonist}은 이전과는 다른 표정으로 앞으로 걸어간다.`,
  ].join('\n\n'));
}

export function buildLocalVisualPrompt(narration: string, sceneNumber: number, contentType: ContentType = 'story', aspectRatio: AspectRatio = '16:9'): string {
  const direction = createCreativeDirection(`${contentType}:${sceneNumber}:${narration}`, sceneNumber, contentType);
  const modeLine =
    contentType === 'music_video'
      ? 'Music video storyboard illustration, lyrical, symbolic, cinematic rhythm.'
      : contentType === 'news'
        ? 'Cinematic movie storyboard illustration, dramatic lighting, emotional tension, immersive composition.'
        : contentType === 'info_delivery'
          ? 'Information explainer storyboard illustration, clean visual hierarchy, credible composition.'
          : 'Narrative storyboard illustration, cinematic emotion and clear visual storytelling.';

  return [
    `${modeLine} Scene ${sceneNumber}.`,
    `Show the main visual idea from this narration: ${narration}`,
    buildFreshIdeaRule('image'),
    `Use ${direction.shotType}. ${direction.cameraLanguage}`,
    `Lighting: ${direction.lightingDirection}. Palette: ${direction.paletteDirection}.`,
    `Visual hook: ${direction.visualHook}`,
    `Caption rhythm hint: ${direction.subtitleTone}`,
    `Clean composition, ${getAspectRatioPrompt(aspectRatio)}, strong subject focus, no watermark, no text overlay.`,
    'Keep character appearance consistent across scenes while avoiding repetitive framing.',
  ].join(' ');
}

export function buildReferencePreviewDataUrl(options: {
  label: string;
  subtitle: string;
  accent: string;
  storyText: string;
}) {
  const summary = escapeXml((options.storyText || '대본 기반 샘플').slice(0, 84));
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#eff6ff"/>
      </linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#bg)" rx="36"/>
    <rect x="36" y="36" width="888" height="468" rx="28" fill="#f8fafc" stroke="#dbeafe"/>
    <circle cx="792" cy="136" r="72" fill="${options.accent}" opacity="0.18"/>
    <circle cx="212" cy="192" r="84" fill="#ffffff" stroke="#cbd5e1" stroke-width="8"/>
    <path d="M170 300 C200 252 228 252 258 300" fill="none" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M212 278 L212 382" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M160 338 L264 338" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
    <path d="M180 430 L212 382 L244 430" fill="none" stroke="#475569" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="84" y="88" fill="#0f172a" font-size="28" font-family="Arial, sans-serif" font-weight="700">${escapeXml(options.label)}</text>
    <text x="84" y="124" fill="#475569" font-size="18" font-family="Arial, sans-serif">${escapeXml(options.subtitle)}</text>
    <foreignObject x="360" y="182" width="500" height="180">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 28px; color: #334155; line-height: 1.45; word-break: keep-all;">${summary}</div>
    </foreignObject>
    <text x="84" y="468" fill="#64748b" font-size="20" font-family="Arial, sans-serif">스크립트 분위기를 반영한 참조 샘플</text>
  </svg>`;
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}

export function makeScenePlaceholderImage(sceneNumber: number, narration: string, aspectRatio: AspectRatio = '16:9'): string {
  const safeText = escapeXml(narration.length > 100 ? `${narration.slice(0, 100)}…` : narration);
  const { width, height } = getAspectRatioDimensions(aspectRatio);
  const padding = Math.round(Math.min(width, height) * 0.06);
  const innerX = padding;
  const innerY = padding;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const titleY = Math.round(height * 0.18);
  const headlineY = Math.round(height * 0.3);
  const textY = Math.round(height * 0.42);
  const footerY = height - Math.round(height * 0.1);
  const direction = createCreativeDirection(`${sceneNumber}:${narration}:${aspectRatio}`, sceneNumber);
  const theme = buildSampleTheme(`${sceneNumber}:${narration}`, sceneNumber, aspectRatio);
  const safeShot = escapeXml(direction.shotType);
  const safeLighting = escapeXml(direction.lightingDirection);
  const safeHook = escapeXml(direction.visualHook);
  const safeCaptionTone = escapeXml(direction.subtitleTone);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.start}"/>
        <stop offset="100%" stop-color="${theme.end}"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" rx="32"/>
    <circle cx="${Math.round(width * 0.82)}" cy="${Math.round(height * 0.18)}" r="${Math.round(Math.min(width, height) * 0.13)}" fill="${theme.accent}" fill-opacity="0.16"/>
    <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.8)}" r="${Math.round(Math.min(width, height) * 0.16)}" fill="${theme.chip}" fill-opacity="0.12"/>
    <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="28" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.2" stroke-width="3"/>
    <text x="${Math.round(width * 0.1)}" y="${titleY}" fill="#ffffff" font-size="28" font-family="Arial, sans-serif" font-weight="700">SAMPLE SCENE ${sceneNumber.toString().padStart(2, '0')} · ${aspectRatio}</text>
    <text x="${Math.round(width * 0.1)}" y="${headlineY}" fill="#ffffff" font-size="54" font-family="Arial, sans-serif" font-weight="800">샘플 모드도 매번 새 결로 진행</text>
    <foreignObject x="${Math.round(width * 0.1)}" y="${textY}" width="${Math.round(width * 0.8)}" height="${Math.round(height * 0.28)}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 32px; line-height: 1.48; color: rgba(255,255,255,0.92); word-break: keep-all;">${safeText}</div>
    </foreignObject>
    <rect x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.74)}" width="${Math.round(width * 0.76)}" height="${Math.round(height * 0.12)}" rx="18" fill="#020617" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.18"/>
    <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.79)}" fill="#ffffff" font-size="22" font-family="Arial, sans-serif" font-weight="700">${safeShot}</text>
    <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.835)}" fill="#e2e8f0" font-size="18" font-family="Arial, sans-serif">${safeLighting} · ${safeCaptionTone}</text>
    <text x="${Math.round(width * 0.1)}" y="${footerY}" fill="#e2e8f0" font-size="22" font-family="Arial, sans-serif">${safeHook}</text>
  </svg>`;

  return encodeBase64(svg);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeBase64(value: string) {
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return (globalThis as any).Buffer.from(value, 'utf-8').toString('base64');
}
