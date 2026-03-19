/**
 * mp4Creater 전용 스토리/씬 보조 함수
 */

import { AspectRatio, ContentType, StorySelectionState } from '../types';
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
  return Math.min(14, Math.max(3, Number(seconds.toFixed(1))));
}

export function buildSelectableStoryDraft(options: StoryDraftOptions): string {
  const topic = options.topic.trim() || '한밤중에 시작된 뜻밖의 이야기';
  const protagonist = options.protagonist.trim() || '주인공';
  const setting = options.setting.trim() || '도시의 골목';
  const conflict = options.conflict.trim() || '피할 수 없는 선택';

  if (options.contentType === 'music_video') {
    return normalizeStoryText([
      `[Intro]
${setting} 위로 번지는 공기 속에서 ${protagonist}은 ${topic}의 첫 감정을 낮게 꺼낸다.`,
      `[Verse 1]
${protagonist}의 시선은 천천히 흔들리고, ${options.mood} 온도의 밤이 장면마다 번진다. ${conflict}은 아직 직접 말하지 못한 채 후렴 전의 숨처럼 맴돈다.`,
      `[Chorus]
${protagonist}은 같은 마음을 다른 표정으로 다시 부른다. 반복되는 한 문장이 영상의 중심 훅이 되고, 감정은 더 크게 열리기 시작한다.`,
      `[Verse 2]
리듬이 올라가듯 작은 단서와 움직임이 쌓이며, 화면은 더 선명한 상징과 대비를 만든다. 숨기고 있던 감정이 결국 노래의 중심으로 올라온다.`,
      `[Outro]
마지막 장면은 ${options.endingTone} 느낌으로 남긴다. 모든 답을 다 말하지 않아도, ${protagonist}의 잔향이 다음 재생을 부르게 만든다.`,
    ].join('\n\n'));
  }

  if (options.contentType === 'news' || options.contentType === 'info_delivery') {
    return normalizeStoryText([
      `${setting}에서 ${protagonist}은 ${topic}의 핵심을 먼저 짚으며, 이번 이슈가 왜 중요한지 ${options.mood} 톤으로 정리한다.`,
      `이어지는 장면에서는 현재 상황과 배경이 차례로 설명되고, ${conflict}이 왜 논점이 되는지 시청자가 한 번에 이해할 수 있게 연결한다.`,
      `중간 장면에서는 서로 다른 시각이나 데이터가 부딪히며 이슈의 핵심 긴장이 드러난다. ${protagonist}은 복잡한 내용을 흐트러지지 않게 정돈해 전달한다.`,
      `마지막은 ${options.endingTone} 방식으로 요약한다. 시청자가 지금 무엇을 기억해야 하는지 분명하게 남기고 다음 흐름을 예상하게 만든다.`,
    ].join('\n\n'));
  }

  return normalizeStoryText([
    `${setting}에서 ${protagonist}은 ${topic}의 조짐을 처음 마주한다. ${options.mood} 톤으로 시작하지만, 화면 어딘가에는 이미 ${conflict}의 그림자가 놓여 있다.`,
    `처음엔 사소해 보였던 단서가 점점 커지면서 ${protagonist}의 일상은 흔들리기 시작한다. ${options.genre} 흐름답게 사건은 조용히 쌓이고, 작은 선택 하나가 다음 장면의 방향을 바꾼다.`,
    `결정적인 순간, ${protagonist}은 가장 숨기고 싶었던 감정과 정면으로 마주한다. 그동안 외면하던 ${conflict}가 드러나고, 이제는 같은 자리로 돌아갈 수 없다는 사실을 깨닫는다.`,
    `마지막 장면은 ${options.endingTone} 감정으로 남긴다. 모든 것이 완전히 해결된 것처럼 보이지 않아도, ${protagonist}은 이전과는 다른 표정으로 앞으로 걸어간다.`,
  ].join('\n\n'));
}

export function buildLocalVisualPrompt(narration: string, sceneNumber: number, contentType: ContentType = 'story', aspectRatio: AspectRatio = '16:9'): string {
  const modeLine =
    contentType === 'music_video'
      ? 'Music video storyboard illustration, lyrical, symbolic, cinematic rhythm.'
      : contentType === 'news' || contentType === 'info_delivery'
        ? 'News explainer storyboard illustration, clean visual hierarchy, credible composition.'
        : 'Narrative storyboard illustration, cinematic emotion and clear visual storytelling.';

  return [
    `${modeLine} Scene ${sceneNumber}.`,
    `Show the main visual idea from this narration: ${narration}`,
    `Clean composition, ${getAspectRatioPrompt(aspectRatio)}, strong subject focus, no watermark, no text overlay.`,
    'Keep character appearance consistent across scenes.',
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
  const titleY = Math.round(height * 0.2);
  const headlineY = Math.round(height * 0.32);
  const textY = Math.round(height * 0.42);
  const footerY = height - Math.round(height * 0.1);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#eff6ff"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" rx="32"/>
    <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="28" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>
    <text x="${Math.round(width * 0.1)}" y="${titleY}" fill="#2563eb" font-size="28" font-family="Arial, sans-serif" font-weight="700">SAMPLE SCENE ${sceneNumber.toString().padStart(2, '0')} · ${aspectRatio}</text>
    <text x="${Math.round(width * 0.1)}" y="${headlineY}" fill="#0f172a" font-size="54" font-family="Arial, sans-serif" font-weight="800">API 키가 없을 때도 흐름 확인 가능</text>
    <foreignObject x="${Math.round(width * 0.1)}" y="${textY}" width="${Math.round(width * 0.8)}" height="${Math.round(height * 0.32)}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 34px; line-height: 1.5; color: #334155; word-break: keep-all;">${safeText}</div>
    </foreignObject>
    <text x="${Math.round(width * 0.1)}" y="${footerY}" fill="#64748b" font-size="26" font-family="Arial, sans-serif">설정에서 이미지 API를 등록하면 이 칸이 실제 생성 이미지로 바뀝니다.</text>
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
