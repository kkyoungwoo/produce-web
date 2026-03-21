import { ContentType, StorySelectionState } from '../types';
import { runOpenRouterText } from './openRouterService';

type SelectionBank = { topic: string[] } & Record<keyof StorySelectionState, string[]>;

const BANKS: Record<ContentType, SelectionBank> = {
  music_video: {
    topic: ['도심 야경 속 재회', '비 내리는 새벽 고백', '첫사랑을 다시 마주한 순간', '끝난 줄 알았던 감정의 반전'],
    genre: ['감성 드라마', '로맨스', '몽환 팝', '시네마틱 발라드'],
    mood: ['몽환적', '감성적', '강렬한', '잔잔하게 고조되는'],
    endingTone: ['여운 있는 마무리', '다시 엇갈리고 떠나는 엔딩', '서정적인 결말', '아련하지만 아름다운 마감'],
    setting: ['도심 골목', '야간 지하철역', '비 내리는 옥상', '도시 야경 도로'],
    protagonist: ['무대를 떠난 보컬', '다시 노래하는 주인공', '감정을 숨긴 연인', '혼자 춤추는 여자'],
    conflict: ['전하지 못한 마음', '다시 마주친 추억', '끝내 못한 약속', '노랫말처럼 반복되는 후회'],
  },
  story: {
    topic: ['마감에서 시작한 반전', '편지의 메모가 바꾼 밤', '조용한 골목의 작은 선택', '오래된 약속과 사회'],
    genre: ['드라마', '스릴러', '로맨스', '미스터리'],
    mood: ['몰입감 있는', '여유 있는', '서늘한', '감성적인'],
    endingTone: ['여운 있는 마무리', '서정적인 결말', '강한 반전', '다음 이야기를 기대하게'],
    setting: ['야간 지하철역', '도심의 편의점', '비 내리는 골목', '옥상'],
    protagonist: ['초보 창작자', '평범한 직장인', '조용한 관찰자', '혼자 사는 주인공'],
    conflict: ['끝내 미루던 선택', '속이고 있던 진실', '잊고 있던 약속', '돌아갈 수 없는 실수'],
  },
  news: {
    topic: ['비 오는 도시에서 다시 마주친 약속', '사라진 편지를 따라가는 밤의 추적', '막차 직전 서로를 붙잡는 선택', '폐극장에서 시작되는 마지막 리허설'],
    genre: ['시네마틱 드라마', '느와르 로맨스', '서스펜스', '감성 미스터리'],
    mood: ['몰입감 있는', '서늘한', '감성적인', '긴장감 있는'],
    endingTone: ['긴 여운으로 마무리', '서정적인 결말', '열린 결말', '반전이 남는 엔딩'],
    setting: ['비 내리는 도시 골목', '새벽 지하철역', '낡은 극장 무대', '네온 불빛의 옥상'],
    protagonist: ['과거를 숨긴 주인공', '무대를 떠난 배우', '마지막 기회를 잡으려는 연인', '진실을 쫓는 관찰자'],
    conflict: ['되돌릴 수 없는 선택의 대가', '끝내 전하지 못한 진심', '사라진 단서를 둘러싼 오해', '같은 밤 서로 다른 목적'],
  },
  info_delivery: {
    topic: ['초보자를 위한 핵심 개념 정리', '업무 프로세스 빠른 이해 가이드', '실수 줄이는 체크리스트 안내', '도구 사용법 단계별 설명'],
    genre: ['설명형 가이드', '튜토리얼', '핵심 요약', '절차 안내'],
    mood: ['친절한', '명확한', '구조적인', '실용적인'],
    endingTone: ['요점 정리로 마무리', '바로 실행할 다음 단계 안내', '핵심 체크리스트 정리', '주의사항 리마인드'],
    setting: ['설명형 보드', '튜토리얼 스튜디오', '인포그래픽 화면', '단계 안내 화면'],
    protagonist: ['가이드 진행자', '설명자', '튜토리얼 코치', '정보 전달자'],
    conflict: ['복잡한 내용을 쉽게 전달해야 함', '핵심 우선순위를 빠르게 전달해야 함', '오해 없이 정확히 안내해야 함', '짧은 시간 내 이해도를 올려야 함'],
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

const TOPIC_SENTENCE_PATTERNS: Record<ContentType, string[]> = {
  music_video: [
    '{topic}으로 시작하는 장면 중심 전개',
    '{topic}의 감정을 첫 장면에서 바로 보여주기',
    '{topic}를 다시 마주하는 순간처럼 구성하기',
    '{topic} 분위기를 따라가는 몽환적 흐름',
    '{topic}에서 추억과 현재가 겹치게 만들기',
    '{topic}을 짧고 강한 장면으로 압축하기',
  ],
  story: [
    '{topic} 문제로 주인공의 선택이 흔들리는 이야기',
    '{topic} 속 진실을 따라가는 전개',
    '{topic}로 평범한 하루가 흔들리는 사건',
    '{topic}으로 관계가 달라지는 인물 중심 구성',
    '{topic} 기반으로 한 직관적 반전 구조',
    '{topic}의 감정 차이를 살린 서사 흐름',
  ],
  news: [
    '{topic}을 첫 장면부터 영화처럼 밀어붙이는 구성',
    '{topic} 속 감정선과 비밀을 교차시키는 전개',
    '{topic}이 관계를 바꾸는 결정적 밤으로 설계하기',
    '{topic}을 따라 추적과 회상이 엇갈리는 흐름 만들기',
    '{topic}의 긴장과 침묵을 장면 전환으로 살리기',
    '{topic}을 엔딩의 여운까지 이어지는 영화 톤으로 묶기',
  ],
  info_delivery: [
    '{topic}을 처음 보는 사람도 이해하는 단계별 설명',
    '{topic} 핵심 개념을 3단계로 정리하기',
    '{topic} 실전 적용 순서를 예시 중심으로 설명하기',
    '{topic}에서 자주 헷갈리는 포인트를 먼저 안내하기',
    '{topic} 체크리스트를 바로 실행 가능하게 만들기',
    '{topic} 핵심 요약과 다음 액션까지 한 번에 제시하기',
  ],
};

function normalizeTopicSeed(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const firstChunk = compact.split(/[,\n|/]/)[0]?.trim() || compact;
  return firstChunk.slice(0, 36);
}

function getContentLabel(contentType: ContentType) {
  if (contentType === 'music_video') return '뮤직비디오';
  if (contentType === 'news') return '영화';
  if (contentType === 'info_delivery') return '정보 전달';
  return '이야기';
}

export function buildTopicSentenceRecommendations(contentType: ContentType, topic: string, count = 4): string[] {
  const baseTopic = normalizeTopicSeed(topic) || getTopicSuggestion(contentType, '');
  const pool = TOPIC_SENTENCE_PATTERNS[contentType]
    .map((pattern) => pattern.replaceAll('{topic}', baseTopic))
    .filter((item, index, array) => array.indexOf(item) === index);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(1, count));
}

function normalizeUniqueTopicList(input: string[], count: number, fallbackFactory: () => string[]): string[] {
  const unique = input
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);

  if (unique.length >= count) return unique.slice(0, count);

  const fallback = fallbackFactory();
  for (const item of fallback) {
    if (unique.includes(item)) continue;
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique.slice(0, count);
}

export async function recommendStorySelections(options: {
  contentType: ContentType;
  topic?: string;
  model?: string;
}): Promise<StorySelectionState> {
  const fallback = fallbackSelections(options.contentType, options.topic);
  try {
    const contentLabel = getContentLabel(options.contentType);
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.85,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국어 영상 스토리 기획 보조다. 직관적이고 자연스러운 값만 JSON으로 반환해라. 키는 genre, mood, endingTone, setting, protagonist, conflict 이다.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
주제: ${options.topic || '자동 추천'}
너무 과하지 않지만 초보자가 쓰기 쉬운 값으로 추천해줘.`,
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

export async function recommendTopicFromInput(options: {
  contentType: ContentType;
  inputText: string;
  model?: string;
  allowAi?: boolean;
}): Promise<string> {
  const seedText = normalizeTopicSeed(options.inputText);
  const fallbackBase = seedText || getTopicSuggestion(options.contentType, '');
  const fallbackPool = buildTopicSentenceRecommendations(options.contentType, fallbackBase);
  const fallback = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || fallbackBase;

  if (!options.allowAi) return fallback;

  try {
    const contentLabel = getContentLabel(options.contentType);
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content: '한국어 영상 제작용 주제 추천 도우미다. 한 줄 주제만 반환하고 설명은 쓰지 마라. 기존 입력 문장을 그대로 앞뒤로 붙이지 마라.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
사용자 입력: ${seedText || '자동 추천'}
이 입력을 바탕으로 바로 사용할 수 있는 새 주제 한 줄만 추천해줘.`,
        },
      ],
    });

    const cleaned = response.replace(/\s+/g, ' ').trim();
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

export async function recommendTopicCandidatesFromInput(options: {
  contentType: ContentType;
  inputText: string;
  count?: number;
  model?: string;
  allowAi?: boolean;
}): Promise<string[]> {
  const count = Math.max(1, options.count || 5);
  const seedText = normalizeTopicSeed(options.inputText);
  const fallbackFactory = () => buildTopicSentenceRecommendations(
    options.contentType,
    seedText || getTopicSuggestion(options.contentType, ''),
    count + 2
  );

  if (!options.allowAi) {
    return normalizeUniqueTopicList(fallbackFactory(), count, fallbackFactory);
  }

  try {
    const contentLabel = getContentLabel(options.contentType);
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.95,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '한국어 영상 제작 주제 추천 도우미다. JSON만 반환한다. key는 topics, value는 문장형 주제 배열이다. 기존 입력을 그대로 복붙하지 말고 비슷한 새 문장으로 변형해라.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
사용자 입력: ${seedText || '자동 추천'}
조건:
1) 주제 문장을 ${count}개 추천
2) 서로 의미가 겹치지 않게
3) 바로 입력창에 넣어 사용할 수 있게
4) 설명문 없이 주제 문장만`,
        },
      ],
    });

    const parsed = JSON.parse(response);
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    return normalizeUniqueTopicList(
      topics.map((item: unknown) => (typeof item === 'string' ? item : '')).filter(Boolean),
      count,
      fallbackFactory
    );
  } catch {
    return normalizeUniqueTopicList(fallbackFactory(), count, fallbackFactory);
  }
}
