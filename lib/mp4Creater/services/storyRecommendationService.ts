import { ContentType, StorySelectionState } from '../types';
import { runOpenRouterText } from './openRouterService';

type SelectionBank = { topic: string[] } & Record<keyof StorySelectionState, string[]>;

const BANKS: Record<ContentType, SelectionBank> = {
  music_video: {
    topic: ['네온 새벽 재회', '비 내리는 옥상 고백', '도시 야경과 이별의 후렴', '막차 이후 시작되는 감정'],
    genre: ['감성 드라마', '로맨스', '몽환 팝', '시네마틱 발라드'],
    mood: ['몽환적인', '감성적인', '세련된', '잔잔하게 고조되는'],
    endingTone: ['여운 있는 마무리', '다시 듣고 싶어지는 엔딩', '희망적인 결말', '쓸쓸하지만 아름다운 마감'],
    setting: ['네온 골목', '새벽 지하철역', '비 오는 옥상', '도시 야경 도로'],
    protagonist: ['무대를 떠난 보컬', '다시 노래하는 주인공', '감정을 숨긴 연인', '혼자 춤추는 화자'],
    conflict: ['전하지 못한 마음', '다시 마주한 추억', '끝내 못한 작별', '후렴처럼 반복되는 후회'],
  },
  story: {
    topic: ['막차에서 시작된 반전', '편의점 메모가 바꾼 밤', '조용한 골목의 작은 선택', '오래된 약속과 재회'],
    genre: ['드라마', '스릴러', '로맨스', '미스터리'],
    mood: ['몰입감 있는', '따뜻한', '서늘한', '감성적인'],
    endingTone: ['여운 있는 마무리', '희망적인 결말', '강한 반전', '다음 이야기를 기대하게'],
    setting: ['늦은 지하철역', '새벽의 편의점', '비 오는 골목', '옥상'],
    protagonist: ['초보 창작자', '평범한 직장인', '조용한 관찰자', '혼자 남은 주인공'],
    conflict: ['끝내 미뤄 온 선택', '숨기고 있던 진실', '잊고 있던 약속', '돌아갈 수 없는 실수'],
  },
  news: {
    topic: ['도시 재개발 핵심 정리', 'AI 서비스 변화 브리핑', '시장 변동 이슈 정리', '지역 뉴스 심층 요약'],
    genre: ['뉴스 브리핑', '해설 리포트', '이슈 요약', '현장 리포트'],
    mood: ['정돈된', '신뢰감 있는', '차분한', '명확한'],
    endingTone: ['핵심 요약으로 마무리', '다음 이슈를 예고하는 엔딩', '중립적 정리', '시청자 행동을 유도하는 마감'],
    setting: ['뉴스룸 스튜디오', '도심 전경', '현장 브리핑 장소', '대형 스크린 앞'],
    protagonist: ['앵커', '현장 기자', '전문 해설자', '차분한 진행자'],
    conflict: ['엇갈리는 해석', '데이터와 체감의 차이', '빠르게 바뀌는 상황', '확인되지 않은 소문'],
  },
};

function pickFromList(list: string[], seedText: string, offset = 0): string {
  const seed = Array.from(`${seedText}:${offset}`).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return list[seed % list.length];
}

function fallbackSelections(contentType: ContentType, topic?: string): StorySelectionState {
  const bank = BANKS[contentType];
  const seed = topic?.trim() || bank.topic[0];
  return {
    genre: pickFromList(bank.genre, seed, 1),
    mood: pickFromList(bank.mood, seed, 2),
    endingTone: pickFromList(bank.endingTone, seed, 3),
    setting: pickFromList(bank.setting, seed, 4),
    protagonist: pickFromList(bank.protagonist, seed, 5),
    conflict: pickFromList(bank.conflict, seed, 6),
  };
}

export function getTopicSuggestion(contentType: ContentType, currentTopic = ''): string {
  const bank = BANKS[contentType];
  return currentTopic.trim() || pickFromList(bank.topic, String(Date.now()), 1);
}

export async function recommendStorySelections(options: {
  contentType: ContentType;
  topic?: string;
  model?: string;
}): Promise<StorySelectionState> {
  const fallback = fallbackSelections(options.contentType, options.topic);
  try {
    const contentLabel =
      options.contentType === 'music_video' ? '뮤직비디오' : options.contentType === 'news' ? '뉴스' : '이야기';
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.85,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국어 스토리 기획 보조자입니다. 짧고 자연스러운 값만 JSON으로 반환하세요. 키는 genre, mood, endingTone, setting, protagonist, conflict 입니다.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
주제: ${options.topic || '자동 추천'}
너무 흔하지 않지만 초보자가 쓰기 쉬운 값으로 추천해줘.`,
        },
      ],
    });

    const parsed = JSON.parse(response);
    return {
      genre: parsed.genre || fallback.genre,
      mood: parsed.mood || fallback.mood,
      endingTone: parsed.endingTone || fallback.endingTone,
      setting: parsed.setting || fallback.setting,
      protagonist: parsed.protagonist || fallback.protagonist,
      conflict: parsed.conflict || fallback.conflict,
    };
  } catch {
    return fallback;
  }
}

export async function recommendStoryField(options: {
  field: keyof StorySelectionState;
  contentType: ContentType;
  topic?: string;
  model?: string;
}): Promise<string> {
  const all = await recommendStorySelections({
    contentType: options.contentType,
    topic: options.topic,
    model: options.model,
  });
  return all[options.field];
}
