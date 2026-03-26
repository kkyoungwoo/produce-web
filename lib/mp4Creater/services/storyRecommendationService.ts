import { ContentType, ScriptLanguageOption, StorySelectionState } from '../types';
import { runOpenRouterText } from './openRouterService';

type StorySelectionField = 'genre' | 'mood' | 'endingTone' | 'setting' | 'protagonist' | 'conflict';
type SelectionBank = { topic: string[] } & Record<StorySelectionField, string[]>;

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
  cinematic: {
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

const TOPIC_SENTENCE_PATTERNS: Record<ContentType, string[]> = {
  music_video: [
    '{topic}으로 시작하는 장면 중심 전개',
    '{topic}의 감정을 첫 장면에서 바로 보여주기',
    '{topic}를 다시 마주하는 순간처럼 구성하기',
    '{topic} 분위기를 따라가는 몽환적 흐름',
    '{topic}에서 추억과 현재가 겹치게 만들기',
    '{topic}을 짧고 강한 장면으로 압축하기',
    '{topic}을 한밤중 재회와 감정 폭발로 이어지는 흐름으로 설계하기',
    '{topic}을 후렴처럼 반복되는 상징 장면으로 묶어 전개하기',
  ],
  story: [
    '{topic} 문제로 주인공의 선택이 흔들리는 이야기',
    '{topic} 속 진실을 따라가는 전개',
    '{topic}로 평범한 하루가 흔들리는 사건',
    '{topic}으로 관계가 달라지는 인물 중심 구성',
    '{topic} 기반으로 한 직관적 반전 구조',
    '{topic}의 감정 차이를 살린 서사 흐름',
    '{topic} 때문에 숨겨 둔 과거가 드러나는 한밤의 전개',
    '{topic}을 시작점으로 관계가 천천히 뒤집히는 감성 구조',
  ],
  cinematic: [
    '{topic}을 첫 장면부터 영화처럼 밀어붙이는 구성',
    '{topic} 속 감정선과 비밀을 교차시키는 전개',
    '{topic}이 관계를 바꾸는 결정적 밤으로 설계하기',
    '{topic}을 따라 추적과 회상이 엇갈리는 흐름 만들기',
    '{topic}의 긴장과 침묵을 장면 전환으로 살리기',
    '{topic}을 엔딩의 여운까지 이어지는 영화 톤으로 묶기',
    '{topic}을 결정적 단서와 감정 충돌이 함께 움직이는 장면으로 설계하기',
    '{topic}을 같은 공간의 다른 기억이 부딪히는 영화형 흐름으로 전개하기',
  ],
  info_delivery: [
    '{topic}을 처음 보는 사람도 이해하는 단계별 설명',
    '{topic} 핵심 개념을 3단계로 정리하기',
    '{topic} 실전 적용 순서를 예시 중심으로 설명하기',
    '{topic}에서 자주 헷갈리는 포인트를 먼저 안내하기',
    '{topic} 체크리스트를 바로 실행 가능하게 만들기',
    '{topic} 핵심 요약과 다음 액션까지 한 번에 제시하기',
    '{topic}을 실무자가 바로 적용할 수 있는 짧은 사례 중심으로 설명하기',
    '{topic}을 처음 듣는 사람도 한 번에 이해하는 순서로 차근차근 안내하기',
  ],
};

const RECOMMENDATION_HISTORY_KEY = 'mp4creater:recommendation-history';
const STORY_SELECTION_FIELDS: StorySelectionField[] = ['genre', 'mood', 'endingTone', 'setting', 'protagonist', 'conflict'];
const MAX_HISTORY_PER_KEY = 8;

function normalizeTopicSeed(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const firstChunk = compact.split(/[\n,|/]/)[0]?.trim() || compact;
  return firstChunk.slice(0, 36);
}

function readRecommendationHistory(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRecommendationHistory(next: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECOMMENDATION_HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

function normalizeHistoryValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildRecommendationHistoryKey(contentType: ContentType, scope: string, seedText = '') {
  const normalizedSeed = normalizeTopicSeed(seedText).toLowerCase();
  return `${contentType}:${scope}:${normalizedSeed || 'global'}`;
}

function getRecentRecommendations(key: string): string[] {
  const history = readRecommendationHistory();
  return Array.isArray(history[key]) ? history[key] : [];
}

function rememberRecommendations(key: string, values: string[]) {
  const cleaned = values
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!cleaned.length) return;

  const history = readRecommendationHistory();
  const merged: string[] = [];
  for (const value of [...cleaned, ...(history[key] || [])]) {
    const normalized = normalizeHistoryValue(value);
    if (!normalized || merged.some((entry) => normalizeHistoryValue(entry) === normalized)) continue;
    merged.push(value);
    if (merged.length >= MAX_HISTORY_PER_KEY) break;
  }
  history[key] = merged;
  writeRecommendationHistory(history);
}

function filterRecentDuplicates(values: string[], recent: string[]): string[] {
  const recentSet = new Set(recent.map((item) => normalizeHistoryValue(item)));
  return values.filter((item) => !recentSet.has(normalizeHistoryValue(item)));
}

function hashCode(value: string) {
  return Array.from(value).reduce((acc, char, index) => {
    return (acc + char.charCodeAt(0) * (index + 1)) % 100000;
  }, 0);
}

function buildNonceLabel(seedText: string) {
  return `${Date.now().toString(36)}-${hashCode(seedText || String(Date.now())).toString(36)}`;
}

function pickFromList(list: string[], seedText: string, offset = 0): string {
  const seed = Array.from(`${seedText}:${offset}`).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return list[seed % list.length];
}

function pickFreshFallbackValue(list: string[], seedText: string, offset: number, recent: string[]) {
  const freshPool = filterRecentDuplicates(list, recent);
  const pool = freshPool.length ? freshPool : list;
  return pickFromList(pool, `${seedText}:${buildNonceLabel(seedText)}`, offset);
}

function fallbackSelections(contentType: ContentType, topic?: string): StorySelectionState {
  const bank = BANKS[contentType];
  const seed = topic?.trim() || bank.topic[0];
  return {
    genre: pickFreshFallbackValue(bank.genre, seed, 1, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'genre', seed))),
    mood: pickFreshFallbackValue(bank.mood, seed, 2, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'mood', seed))),
    endingTone: pickFreshFallbackValue(bank.endingTone, seed, 3, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'endingTone', seed))),
    setting: pickFreshFallbackValue(bank.setting, seed, 4, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'setting', seed))),
    protagonist: pickFreshFallbackValue(bank.protagonist, seed, 5, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'protagonist', seed))),
    conflict: pickFreshFallbackValue(bank.conflict, seed, 6, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'conflict', seed))),
  };
}

function getContentLabel(contentType: ContentType) {
  if (contentType === 'music_video') return '뮤직비디오';
  if (contentType === 'cinematic') return '영화';
  if (contentType === 'info_delivery') return '정보 전달';
  return '이야기';
}

export function getTopicSuggestion(contentType: ContentType, currentTopic = ''): string {
  const bank = BANKS[contentType];
  return currentTopic.trim() || pickFreshFallbackValue(bank.topic, String(Date.now()), 1, getRecentRecommendations(buildRecommendationHistoryKey(contentType, 'topic')));
}

export function buildTopicSentenceRecommendations(contentType: ContentType, topic: string, count = 8): string[] {
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
  const topicSeed = normalizeTopicSeed(options.topic || '') || fallback.genre;
  const recentSummary = STORY_SELECTION_FIELDS
    .map((field) => `${field}: ${getRecentRecommendations(buildRecommendationHistoryKey(options.contentType, field, topicSeed)).slice(0, 3).join(' / ') || '없음'}`)
    .join('\n');

  try {
    const contentLabel = getContentLabel(options.contentType);
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.9,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '당신은 한국어 영상 스토리 기획 보조다. 직관적이고 자연스러운 값만 JSON으로 반환해라. 키는 genre, mood, endingTone, setting, protagonist, conflict 이다. 최근 추천을 반복하지 말고 매번 새 디테일로 제안해라.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
주제: ${options.topic || '자동 추천'}
최근 추천 히스토리:
${recentSummary}
새 추천 nonce: ${buildNonceLabel(topicSeed)}
너무 과하지 않지만 초보자가 쓰기 쉬운 값으로 추천해줘. 같은 주제여도 직전 추천과 표현이 겹치지 않게 바꿔줘.`,
        },
      ],
    });

    const parsed = JSON.parse(response);
    const result: StorySelectionState = {
      genre: parsed.genre || fallback.genre,
      mood: parsed.mood || fallback.mood,
      endingTone: parsed.endingTone || fallback.endingTone,
      setting: parsed.setting || fallback.setting,
      protagonist: parsed.protagonist || fallback.protagonist,
      conflict: parsed.conflict || fallback.conflict,
    };
    STORY_SELECTION_FIELDS.forEach((field) => {
      rememberRecommendations(buildRecommendationHistoryKey(options.contentType, field, topicSeed), [result[field]]);
    });
    return result;
  } catch {
    STORY_SELECTION_FIELDS.forEach((field) => {
      rememberRecommendations(buildRecommendationHistoryKey(options.contentType, field, topicSeed), [fallback[field]]);
    });
    return fallback;
  }
}

export async function recommendStoryField(options: {
  field: StorySelectionField;
  contentType: ContentType;
  topic?: string;
  model?: string;
}): Promise<string> {
  const all = await recommendStorySelections({
    contentType: options.contentType,
    topic: options.topic,
    model: options.model,
  });
  rememberRecommendations(buildRecommendationHistoryKey(options.contentType, options.field, options.topic || ''), [all[options.field]]);
  return all[options.field];
}

export async function recommendTopicFromInput(options: {
  contentType: ContentType;
  inputText: string;
  model?: string;
  allowAi?: boolean;
  scriptLanguage?: ScriptLanguageOption;
}): Promise<string> {
  const seedText = normalizeTopicSeed(options.inputText);
  const historyKey = buildRecommendationHistoryKey(options.contentType, 'topic', seedText);
  const recentTopics = getRecentRecommendations(historyKey);
  const fallbackBase = seedText || getTopicSuggestion(options.contentType, '');
  const fallbackPool = filterRecentDuplicates(buildTopicSentenceRecommendations(options.contentType, fallbackBase), recentTopics);
  const fallback = fallbackPool[Math.floor(Math.random() * Math.max(1, fallbackPool.length))] || fallbackBase;

  if (!options.allowAi) {
    rememberRecommendations(historyKey, [fallback]);
    return fallback;
  }

  try {
    const contentLabel = getContentLabel(options.contentType);
    const response = await runOpenRouterText({
      model: options.model || 'openrouter/auto',
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content: '한국어 영상 제작용 주제 추천 도우미다. 한 줄 주제만 반환하고 설명은 쓰지 마라. 기존 입력 문장을 그대로 앞뒤로 붙이지 마라. 최근 추천이나 샘플 표현을 답습하지 말고 매번 새 관점과 새 훅으로 제안하라.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
사용자 입력: ${seedText || '자동 추천'}
무음 모드 여부: ${options.scriptLanguage === 'mute' ? '예' : '아니오'}
최근 추천: ${recentTopics.slice(0, 5).join(' / ') || '없음'}
새 추천 nonce: ${buildNonceLabel(seedText || fallbackBase)}
이 입력을 바탕으로 바로 사용할 수 있는 새 주제 한 줄만 추천해줘.
입력이 길면 정보 밀도에 맞춰 조금 더 구체적으로 쓰고, 무음 모드면 화면 전개와 장면 흐름이 떠오르도록 제안해줘.`,
        },
      ],
    });

    const cleaned = response.replace(/\s+/g, ' ').trim() || fallback;
    rememberRecommendations(historyKey, [cleaned]);
    return cleaned;
  } catch {
    rememberRecommendations(historyKey, [fallback]);
    return fallback;
  }
}

export async function recommendTopicCandidatesFromInput(options: {
  contentType: ContentType;
  inputText: string;
  count?: number;
  model?: string;
  allowAi?: boolean;
  scriptLanguage?: ScriptLanguageOption;
}): Promise<string[]> {
  const count = Math.max(1, options.count || 5);
  const seedText = normalizeTopicSeed(options.inputText);
  const historyKey = buildRecommendationHistoryKey(options.contentType, 'topic-candidates', seedText);
  const recentTopics = getRecentRecommendations(historyKey);
  const fallbackFactory = () => normalizeUniqueTopicList(
    filterRecentDuplicates(
      buildTopicSentenceRecommendations(options.contentType, seedText || getTopicSuggestion(options.contentType, ''), count + 4),
      recentTopics,
    ),
    count + 2,
    () => buildTopicSentenceRecommendations(options.contentType, seedText || getTopicSuggestion(options.contentType, ''), count + 4),
  );

  if (!options.allowAi) {
    const fallbackTopics = normalizeUniqueTopicList(fallbackFactory(), count, fallbackFactory);
    rememberRecommendations(historyKey, fallbackTopics);
    return fallbackTopics;
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
          content: '한국어 영상 제작 주제 추천 도우미다. JSON만 반환한다. key는 topics, value는 한국어 한 줄 주제 배열이다. 각 항목은 줄바꿈 없는 한 줄 문장으로 작성한다. 입력이 짧으면 간결하게, 입력이 길거나 정보가 많으면 그 밀도에 맞춰 조금 더 길고 구체적인 한 줄 문장으로 확장한다. 기존 입력을 그대로 복붙하지 말고 새 관점으로 변형하며, 서로 결이 겹치지 않게 다양하게 제안한다. 최근 추천 결과나 샘플 표현을 재활용하지 말고 매번 새로 제안한다.',
        },
        {
          role: 'user',
          content: `콘텐츠 유형: ${contentLabel}
사용자 입력: ${seedText || '자동 추천'}
무음 모드 여부: ${options.scriptLanguage === 'mute' ? '예' : '아니오'}
최근 추천: ${recentTopics.slice(0, 6).join(' / ') || '없음'}
새 추천 nonce: ${buildNonceLabel(seedText || String(count))}
조건:
1) 주제 문장을 ${count}개 추천
2) 각 항목은 줄바꿈 없는 한 줄 문장으로 작성
3) 입력이 짧으면 간결하게, 입력이 길면 그에 맞춰 더 디테일한 한 줄로 확장
4) 서로 의미와 전개 방향이 겹치지 않게 다양하게
5) 바로 입력창에 넣어 영상 스토리의 출발점으로 쓸 수 있게
6) 무음 모드면 대사보다 장면 흐름, 감정선, 시각적 전개가 잘 떠오르도록 작성
7) 설명문 없이 주제 문장만`,
        },
      ],
    });

    const parsed = JSON.parse(response);
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    const normalized = normalizeUniqueTopicList(
      filterRecentDuplicates(topics.map((item: unknown) => (typeof item === 'string' ? item : '')).filter(Boolean), recentTopics),
      count,
      fallbackFactory,
    );
    rememberRecommendations(historyKey, normalized);
    return normalized;
  } catch {
    const fallbackTopics = normalizeUniqueTopicList(fallbackFactory(), count, fallbackFactory);
    rememberRecommendations(historyKey, fallbackTopics);
    return fallbackTopics;
  }
}
