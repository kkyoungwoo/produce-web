import { CONFIG } from '../config';
import {
  ContentType,
  StorySelectionState,
  WorkflowPromptTemplate,
} from '../types';
import { runOpenRouterText } from './openRouterService';
import { buildSelectableStoryDraft, normalizeStoryText } from '../utils/storyHelpers';

interface ScriptComposerOptions {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  template: WorkflowPromptTemplate;
  currentScript?: string;
  model?: string;
  conversationMode?: boolean;
}

export interface ScriptComposerResult {
  text: string;
  source: 'ai' | 'sample';
}

function createDialogueFallback(topic: string, selections: StorySelectionState) {
  return normalizeStoryText(`장면 1\n${selections.protagonist}: 오늘은 그냥 지나칠 수 없는 밤이야. ${topic || '이 이야기'}가 이제 시작되거든.\n상대 인물: 왜 지금이어야 하지?\n${selections.protagonist}: ${selections.conflict}을 더는 미룰 수 없으니까.\n\n장면 2\n상대 인물: 그럼 어떤 분위기로 가야 해?\n${selections.protagonist}: ${selections.mood} 톤으로, 배경은 ${selections.setting}이야.\n상대 인물: 결말은?\n${selections.protagonist}: ${selections.endingTone}.`);
}

function createFallback(options: ScriptComposerOptions) {
  if (options.conversationMode || options.template.mode === 'dialogue') {
    return createDialogueFallback(options.topic, options.selections);
  }

  return normalizeStoryText(
    options.currentScript?.trim() ||
      buildSelectableStoryDraft({
        contentType: options.contentType,
        topic: options.topic,
        ...options.selections,
      })
  );
}

/**
 * Step 3 대본 생성 서비스
 * - OpenRouter 키가 있으면 선택 프롬프트로 실제 AI 초안을 만듭니다.
 * - 키가 없거나 실패하면 샘플 초안으로 안전하게 폴백합니다.
 * - 즉, 사용자가 OpenRouter만 등록해도 즉시 실사용 흐름을 테스트할 수 있습니다.
 */
export async function composeScriptDraft(options: ScriptComposerOptions): Promise<ScriptComposerResult> {
  const fallback = createFallback(options);
  const apiKey =
    (typeof window !== 'undefined' && localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)) ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) {
    return { text: fallback, source: 'sample' };
  }

  try {
    const contentLabel =
      options.contentType === 'music_video' ? '뮤직비디오' : options.contentType === 'news' ? '뉴스' : '이야기';

    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: options.conversationMode || options.template.mode === 'dialogue' ? 0.85 : 0.7,
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국어 영상 대본 작가다. 출력은 바로 씬 제작에 넣을 수 있게 간결하지만 장면감 있게 쓴다. 설명문은 빼고 결과 본문만 반환한다.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}\n주제: ${options.topic || '자동 생성'}\n장르: ${options.selections.genre}\n분위기: ${options.selections.mood}\n배경: ${options.selections.setting}\n주인공: ${options.selections.protagonist}\n갈등: ${options.selections.conflict}\n엔딩 톤: ${options.selections.endingTone}\n\n선택된 프롬프트 이름: ${options.template.name}\n선택된 프롬프트 설명: ${options.template.description}\n\n[선택 프롬프트]\n${options.template.prompt}\n\n[현재 초안]\n${options.currentScript || '없음'}\n\n${options.conversationMode || options.template.mode === 'dialogue' ? '대화형 흐름이 살아 있도록 작성하되 마지막 출력은 문단 구조를 유지해줘.' : '문단형 내레이션 구조로 정리해줘.'}`,
        },
      ],
    });

    return {
      text: normalizeStoryText(response || fallback),
      source: 'ai',
    };
  } catch {
    return { text: fallback, source: 'sample' };
  }
}
