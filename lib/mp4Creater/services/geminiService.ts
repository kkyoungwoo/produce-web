import { ContentType, ReferenceImages, ScriptScene } from '../types';
import {
  buildLocalVisualPrompt,
  estimateClipDuration,
  makeScenePlaceholderImage,
  splitStoryIntoParagraphScenes,
} from '../utils/storyHelpers';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getFallbackScript(topic: string, contentType: ContentType): string {
  if (contentType === 'music_video') {
    return `새벽의 도시 위로 잔잔한 불빛이 흐르고, 주인공은 멈춰 있던 마음을 다시 꺼내 든다.

비에 젖은 도로와 번지는 네온 속에서 짧은 후렴처럼 같은 감정이 반복된다.

마지막 장면에서 그는 멀어지던 관계 대신 앞으로 걸어갈 이유를 발견한다.`;
  }
  if (contentType === 'news') {
    return `비에 젖은 도시의 밤, 주인공은 오래 숨겨 둔 단서가 다시 움직이기 시작했다는 사실을 알아차린다.

사라진 약속과 남겨진 흔적이 같은 장소로 모이면서, 관계와 목적이 뒤엉킨 긴장이 점점 선명해진다.

마지막 장면에서 그는 되돌릴 수 없는 선택 앞에 서고, 그 밤의 여운이 다음 장면을 예고한다.`;
  }
  if (contentType === 'info_delivery') {
    return `오늘 핵심 이슈는 빠르게 변하는 현장 상황과 이에 대한 다양한 해석이다.

자료와 현장 반응을 함께 보면, 숫자만으로 설명되지 않는 체감 변화가 분명히 드러난다.

마지막으로 이번 흐름이 앞으로 어떤 선택으로 이어질지 차분히 정리한다.`;
  }
  return `${topic || '새로운 이야기'}를 둘러싼 분위기가 서서히 드러난다.

주인공은 익숙한 공간에서 예상하지 못한 단서를 발견하고, 미뤄 둔 선택과 다시 마주한다.

마지막 장면에서 작은 결심 하나가 다음 장면의 방향을 바꾼다.`;
}

function buildScenes(script: string, contentType: ContentType): ScriptScene[] {
  const paragraphs = splitStoryIntoParagraphScenes(script);
  return paragraphs.map((paragraph, index) => ({
    sceneNumber: index + 1,
    narration: paragraph,
    visualPrompt: buildLocalVisualPrompt(paragraph, index + 1, contentType, '16:9'),
    analysis: {
      composition_type: paragraph.length > 85 ? 'STANDARD' : 'MICRO',
      sentiment: 'NEUTRAL',
    },
    targetDuration: estimateClipDuration(paragraph),
    aspectRatio: '16:9',
  }));
}

function fallbackSplit(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = '';
  const tokens = text.split(/(?<=[,.!?])|(?=\s)/);

  for (const token of tokens) {
    if ((current + token).length <= maxChars) {
      current += token;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    current = token.trimStart();
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

export const findTrendingTopics = async (category: string, usedTopics: string[]) => {
  await wait(80);
  const base = [
    `${category} 핵심 요약`,
    `${category} 초보자용 설명`,
    `${category} 최신 분위기 정리`,
    `${category} 시청자 반응 포인트`,
  ];
  return base.filter((item) => !usedTopics.includes(item)).slice(0, 3);
};

export const generateScript = async (
  topic: string,
  _hasReferenceImage: boolean,
  sourceContext?: string | null,
  contentType: ContentType = 'story'
): Promise<ScriptScene[]> => {
  await wait(120);
  const script = sourceContext?.trim() || getFallbackScript(topic, contentType);
  return buildScenes(script, contentType);
};

export const generateScriptChunked = async (
  topic: string,
  hasReferenceImage: boolean,
  sourceContext?: string | null,
  contentType: ContentType = 'story'
): Promise<ScriptScene[]> => {
  return generateScript(topic, hasReferenceImage, sourceContext, contentType);
};

export const generateImageForScene = async (
  scene: ScriptScene,
  _referenceImages: ReferenceImages
): Promise<string | null> => {
  await wait(100);
  return makeScenePlaceholderImage(scene.sceneNumber, scene.narration, scene.aspectRatio || '16:9');
};

export const generateAudioForScene = async (_text: string) => {
  await wait(80);
  return null;
};

export const splitSubtitleByMeaning = async (
  narration: string,
  maxChars: number = 20
): Promise<string[]> => {
  await wait(30);
  return fallbackSplit(narration, maxChars);
};

export const generateMotionPrompt = async (
  narration: string,
  visualPrompt: string
): Promise<string> => {
  await wait(60);
  const trimmedNarration = narration.replace(/\s+/g, ' ').trim().slice(0, 120);
  const trimmedVisual = visualPrompt.replace(/\s+/g, ' ').trim().slice(0, 180);
  return [
    'Slow gentle zoom in.',
    'Subtle breathing and natural eye movement.',
    'Keep the composition stable and preserve the original art style.',
    trimmedNarration ? `Emotion cue: ${trimmedNarration}.` : '',
    trimmedVisual ? `Visual anchor: ${trimmedVisual}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
};
