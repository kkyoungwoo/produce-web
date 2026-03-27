import {
  ConstitutionAnalysisSummary,
  ContentType,
  CustomScriptSettings,
  ScriptLanguageOption,
  ScriptSpeechStyle,
  StorySelectionState,
  WorkflowPromptTemplate,
} from '../types';
import { translatePromptToEnglish } from './promptTranslationService';
import { buildSelectableStoryDraft, formatStoryTextForEditor, normalizeStoryText } from '../utils/storyHelpers';
import { runTextAi } from './textAiService';
import { getPromptRegistry } from './promptRegistryService';
import { buildCreativeDirectionBlock, createCreativeDirection } from '../config/creativeVariance';
import { NO_AI_SCRIPT_MODEL_ID } from '../config';
import {
  buildConceptDirectionLines,
  buildMarkdownKeyValueSection,
  buildMarkdownSection,
  buildSimilarityControlLines,
  buildTransitionIntentLines,
  joinPromptBlocks,
} from './promptMarkdown';

interface ScriptComposerOptions {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  template: WorkflowPromptTemplate;
  currentScript?: string;
  continuityContext?: string;
  promptAdditions?: string[];
  model?: string;
  conversationMode?: boolean;
  customSettings?: CustomScriptSettings;
  generationIntent?: 'draft' | 'expand';
  expandByChars?: number;
  generationNonce?: string;
  returnOnlySegment?: boolean;
  onProgress?: (update: { percent: number; message: string }) => void;
}

export interface ScriptComposerResult {
  text: string;
  source: 'ai' | 'sample';
  analysis?: ConstitutionAnalysisSummary | null;
}

const SCRIPT_CHARACTER_RANGE_BY_TYPE: Record<ContentType, { min: number; max: number }> = {
  music_video: { min: 130, max: 250 },
  story: { min: 210, max: 390 },
  cinematic: { min: 110, max: 210 },
  info_delivery: { min: 390, max: 720 },
};

const SCRIPT_SEGMENT_TARGET_CHARS = 900;
const SCRIPT_SEGMENT_MIN_CHARS = 320;
const SCRIPT_SEGMENT_MAX_COUNT = 6;
const SCRIPT_SEGMENT_CONTEXT_CHARS = 820;

function emitScriptProgress(
  options: ScriptComposerOptions,
  percent: number,
  message: string,
) {
  options.onProgress?.({
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    message,
  });
}

function createSeededRandom(seedText: string) {
  let seed = Array.from(seedText || 'mp4Creater').reduce((acc, char, index) => {
    return (acc + (char.charCodeAt(0) * (index + 17))) >>> 0;
  }, 2166136261);

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function pickSample<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] || items[0];
}

function getScriptCharacterRange(contentType: ContentType, minutes: number) {
  const safeMinutes = Math.max(1, Math.min(30, Math.round(minutes || 1)));
  const range = SCRIPT_CHARACTER_RANGE_BY_TYPE[contentType] || SCRIPT_CHARACTER_RANGE_BY_TYPE.story;
  return {
    min: safeMinutes * range.min,
    max: safeMinutes * range.max,
    target: Math.round((safeMinutes * (range.min + range.max)) / 2),
  };
}

function countScriptCharacters(text: string) {
  return Array.from(text || '').length;
}

function getTtsOnlyRule(contentType: ContentType) {
  if (contentType === 'music_video') {
    return '결과는 TTS나 노래 보이스로 바로 읽거나 부를 수 있는 가사 본문만 작성한다. [Intro], [Verse], [Chorus], Scene, 장면, 화자 이름, 괄호 설명, 지문, 카메라 설명, 효과음 표기, 특정 상황을 해설하는 산문형 문장을 모두 금지하고 실제로 부를 가사 줄만 남긴다.';
  }
  return '결과는 TTS로 바로 읽을 목소리 대본만 작성한다. Scene, 장면, 컷, 화자 이름, 대사 라벨, 괄호 설명, 카메라 지시, 행동 지문, 효과음 표기, 메타 설명 없이 낭독할 본문만 남긴다. 영상 제작 지시문이나 상황 설명서가 아니라 실제로 읽을 대본 문장만 출력한다.';
}

function buildVoiceOnlySample(contentType: ContentType, topic: string, selections: StorySelectionState) {
  const safeTopic = topic || '이번 주제';
  if (contentType === 'music_video') {
    return [
      `${safeTopic} 끝에서 나는 아직 네 이름을 부른다`,
      `지워 둔 마음까지 오늘 밤은 다시 흔든다`,
      `멈춘 줄 알았던 박자도 내 안에서 살아난다`,
      `돌아오지 않는 새벽이어도 나는 끝까지 간다`,
    ].join('\n');
  }
  if (contentType === 'info_delivery') {
    return [
      `${safeTopic}를 볼 때 가장 먼저 확인할 것은 왜 지금 이 변화가 중요한지입니다.`,
      `먼저 기준 하나를 잡고, 그다음 비용과 시간처럼 바로 비교되는 항목부터 차례로 보면 이해가 빨라집니다.`,
      `숫자 하나와 짧은 사례 하나만 붙여도 복잡한 내용이 생활감 있는 정보로 바뀝니다.`,
      `마지막에는 오늘 기억할 핵심 한 줄만 남기면 시청자는 다음 행동까지 자연스럽게 이어 갈 수 있습니다.`,
    ].join('\n\n');
  }
  if (contentType === 'cinematic') {
    return [
      `${selections.protagonist || '그 사람'}은 ${selections.setting || '낯선 공간'}에 다시 들어서며 오래 숨겨 둔 진실과 마주한다.`,
      `${selections.conflict || '지워지지 않는 선택'}은 조용한 숨결처럼 가까워지고, 한마디마다 밤의 공기가 더 무거워진다.`,
      `그래도 물러서지 않겠다는 눈빛 하나가 남고, ${selections.endingTone || '긴 여운'}은 마지막 문장까지 천천히 번져 간다.`,
    ].join('\n\n');
  }
  return [
    `${selections.protagonist || '주인공'}은 ${selections.setting || '익숙한 공간'}에서 ${safeTopic}의 시작을 조용히 받아들인다.`,
    `${selections.conflict || '남겨 둔 갈등'}은 작게 흔들리지만, 오늘만큼은 피하지 않겠다는 마음이 먼저 자라난다.`,
    `${selections.mood || '잔잔한'} 기류 속에서도 한 걸음 더 나아가려는 선택이 생기고, 끝에는 ${selections.endingTone || '따뜻한 여운'}이 남는다.`,
  ].join('\n\n');
}

function buildLengthPaddingParagraphs(options: ScriptComposerOptions) {
  const topic = options.topic || '이번 이야기';
  const protagonist = options.selections.protagonist || '주인공';
  const setting = options.selections.setting || '익숙한 공간';
  const conflict = options.selections.conflict || '남겨 둔 문제';
  const mood = options.selections.mood || '몰입감 있는';
  const endingTone = options.selections.endingTone || '여운 있는';
  const random = createSeededRandom([
    options.contentType,
    topic,
    protagonist,
    setting,
    conflict,
    mood,
    endingTone,
    options.generationNonce || `${Date.now()}`,
  ].join('::'));
  const direction = createCreativeDirection(`${options.contentType}:${topic}:${options.generationNonce || Date.now()}`, 3, options.contentType);

  if (options.contentType === 'music_video') {
    const openers = ['젖은 네온 아래', '늦은 새벽 골목에서', '멈춘 플랫폼 끝에서', '유리창에 번진 불빛 속에서'];
    const echoes = ['후렴처럼 다시 밀려와', '낮게 번져 와', '가만히 살아나', '천천히 커져 가'];
    const lifts = ['남겨 둔 한마디도 이번엔 끝까지 부른다', '돌아서던 발끝마저 오늘은 리듬으로 남긴다', '지워 둔 마음까지 이번 밤의 멜로디로 묶는다', '사라진 줄 알았던 떨림을 다시 앞으로 끌고 간다'];
    return Array.from({ length: 6 }, () => formatStoryTextForEditor([
      `${pickSample(openers, random)} ${topic}의 그림자가 ${pickSample(echoes, random)}.`,
      `${protagonist}의 숨과 ${conflict}이 같은 박자로 겹치고, ${direction.visualHook.toLowerCase()} 결의 장면이 짧게 박힌다.`,
      `${pickSample(lifts, random)} ${endingTone} 공기가 마지막 줄까지 남는다.`
    ].join(' ')));
  }

  if (options.contentType === 'info_delivery') {
    const structures = ['기준부터 먼저 세우는 순서', '실수 포인트를 앞에서 끊어 주는 순서', '예시를 먼저 보여 주고 원리를 붙이는 순서', '비교 항목을 두세 개로 줄여 보는 순서'];
    const benefits = ['이해 속도가 확실히 빨라집니다', '짧은 영상에서도 핵심이 덜 흔들립니다', '처음 보는 사람도 전체 흐름을 따라오기 쉬워집니다', '복잡한 내용을 바로 실행 가능한 정보로 바꿀 수 있습니다'];
    return Array.from({ length: 6 }, () => formatStoryTextForEditor([
      `${topic}를 설명할 때는 ${pickSample(structures, random)}가 특히 잘 먹힙니다.`,
      `${setting} 기준의 짧은 사례 하나만 붙여도 ${conflict}이 왜 중요한지 훨씬 또렷하게 보입니다.`,
      `${mood} 톤을 유지하되 문장은 단순하게 정리하면 ${pickSample(benefits, random)}.`
    ].join(' ')));
  }

  if (options.contentType === 'cinematic') {
    const textures = ['빛이 한 번 흔들리는 순간', '대답 없는 정적이 길어지는 찰나', '손끝이 멈칫하는 아주 짧은 틈', '카메라가 숨을 고르듯 느려지는 구간'];
    const turns = ['긴장이 더 깊어진다', '같은 공간이 전혀 다른 의미로 바뀐다', '감정의 방향이 조용히 뒤집힌다', '다음 선택의 무게가 더 선명해진다'];
    return Array.from({ length: 6 }, () => formatStoryTextForEditor([
      `${pickSample(textures, random)}, ${protagonist}은 ${setting}의 공기를 다시 읽는다.`,
      `${conflict}은 설명보다 표정과 움직임으로 먼저 드러나고, ${direction.narrativeAngle.toLowerCase()} 흐름 속에서 ${pickSample(turns, random)}.`,
      `결국 ${endingTone} 잔상이 남아 마지막 컷 다음의 장면까지 상상하게 만든다.`
    ].join(' ')));
  }

  const starts = ['조용하던 장면 한가운데서', '익숙한 공기가 미묘하게 달라지는 순간', '평범한 흐름이 한 번 어긋난 바로 뒤에', '별일 아닌 듯 지나가던 찰나에'];
  const pushes = ['다음 선택이 밀려온다', '이야기의 결이 완전히 달라지기 시작한다', '숨겨 둔 감정이 조용히 떠오른다', '관계의 균형이 조금씩 이동한다'];
  return Array.from({ length: 6 }, () => formatStoryTextForEditor([
    `${pickSample(starts, random)} ${protagonist}은 ${setting}에서 ${topic}의 진짜 무게를 알아차린다.`,
    `${conflict}은 더는 뒤로 미뤄지지 않고, ${mood} 기류 속에서도 ${pickSample(pushes, random)}.`,
    `${direction.visualHook} 같은 인상이 짧게 남고, 끝에는 ${endingTone} 감정이 또렷하게 걸린다.`
  ].join(' ')));
}


function createNoAiModelSampleScript(options: ScriptComposerOptions) {
  const topic = options.topic || '이번 이야기';
  const protagonist = options.selections.protagonist || '주인공';
  const setting = options.selections.setting || '익숙한 공간';
  const conflict = options.selections.conflict || '아직 정리되지 않은 문제';
  const mood = options.selections.mood || '몰입감 있는';
  const endingTone = options.selections.endingTone || '잔잔한 여운';
  const minutes = Math.max(1, Math.min(12, Math.round(options.customSettings?.expectedDurationMinutes || 1)));
  const paragraphCount = Math.max(3, Math.min(10, Math.round(minutes * 1.4)));
  const random = createSeededRandom([
    'no-ai-model',
    options.contentType,
    topic,
    protagonist,
    setting,
    conflict,
    mood,
    endingTone,
    options.generationNonce || `${Date.now()}`,
  ].join('::'));

  const openers = ['문득', '어느 순간', '조용히', '낯설게도', '천천히'];
  const visuals = ['빛이 번지고', '공기가 흔들리고', '작은 소음이 지나가고', '장면의 결이 바뀌고', '시선이 잠깐 멈추고'];
  const feelings = ['마음이 먼저 반응한다', '이야기가 스스로 방향을 잡는다', '한 문장이 다음 장면을 불러온다', '말보다 분위기가 먼저 살아난다', '평범한 흐름이 갑자기 특별해진다'];
  const endings = ['조금 더 앞으로 간다', '결국 다음 선택을 남긴다', '짧지만 선명한 여운을 만든다', '마지막 줄까지 온도를 유지한다', '작은 결심 하나를 남긴다'];
  const infoHooks = ['핵심을 먼저 짚고', '비교 포인트를 나누고', '실제 사례를 붙이고', '보기 쉬운 기준부터 세우고', '복잡한 표현을 덜어 내고'];
  const lyricHooks = ['리듬은 느리게 시작되고', '후렴은 더 가까이 들어오고', '감정은 낮게 번지다가', '멈춘 심장이 다시 뛰듯', '숨겨 둔 한마디가 결국'];

  const paragraphs = Array.from({ length: paragraphCount }, (_, index) => {
    if (options.contentType === 'info_delivery') {
      return formatStoryTextForEditor([
        `${pickSample(infoHooks, random)} ${topic}를 이해하는 가장 쉬운 길을 연다.`,
        `${setting} 기준으로 보면 ${conflict}이 왜 중요한지 훨씬 선명해지고, ${mood} 톤으로 정리하면 처음 보는 사람도 흐름을 따라오기 쉬워진다.`,
        `${index === paragraphCount - 1 ? endingTone : pickSample(endings, random)} 흐름으로 핵심 한 줄을 또렷하게 남긴다.`
      ].join(' '));
    }

    if (options.contentType === 'music_video') {
      return formatStoryTextForEditor([
        `${pickSample(lyricHooks, random)} ${topic}의 이름을 다시 부른다.`,
        `${protagonist}의 밤은 ${setting} 위를 스치고, ${conflict}은 후렴처럼 맴돌다가 결국 목소리 안으로 스며든다.`,
        `${mood} 떨림은 작게 시작해도 마지막에는 ${endingTone} 파장으로 남는다.`
      ].join(' '));
    }

    if (options.contentType === 'cinematic') {
      return formatStoryTextForEditor([
        `${pickSample(openers, random)} ${protagonist}은 ${setting}에서 ${topic}의 진짜 얼굴을 마주한다.`,
        `${pickSample(visuals, random)} ${conflict}은 설명보다 표정과 침묵으로 먼저 드러나고, ${mood} 흐름은 장면 전체의 밀도를 끌어올린다.`,
        `${index === paragraphCount - 1 ? endingTone : pickSample(endings, random)} 컷 감각으로 마무리된다.`
      ].join(' '));
    }

    return formatStoryTextForEditor([
      `${pickSample(openers, random)} ${protagonist}은 ${setting}에서 ${topic}의 시작을 받아들인다.`,
      `${pickSample(visuals, random)} ${conflict}은 조금씩 가까워지고, ${mood} 공기 속에서 ${pickSample(feelings, random)}.`,
      `${index === paragraphCount - 1 ? endingTone : pickSample(endings, random)} 문장으로 다음 문단을 자연스럽게 이어 준다.`
    ].join(' '));
  });

  return fitScriptToCharacterRange(
    ensureParagraphVideoScript(normalizeStoryText(paragraphs.join('\n\n')), options),
    options,
  );
}

function trimScriptToMax(text: string, max: number) {
  if (countScriptCharacters(text) <= max) return text;
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const working = [...paragraphs];
  while (working.length > 1 && countScriptCharacters(working.join('\n\n')) > max) {
    working.pop();
  }
  let candidate = working.join('\n\n').trim();
  if (countScriptCharacters(candidate) <= max) return candidate;

  const sentences = candidate.split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=함\.)\s+/).map((item) => item.trim()).filter(Boolean);
  if (sentences.length > 1) {
    const kept = [];
    for (const sentence of sentences) {
      const next = [...kept, sentence].join(' ');
      if (countScriptCharacters(next) > max) break;
      kept.push(sentence);
    }
    if (kept.length) candidate = kept.join(' ').trim();
  }

  if (countScriptCharacters(candidate) <= max) return candidate;

  const sliced = Array.from(candidate).slice(0, max).join('').trim();
  const punctuationIndex = Math.max(
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('！'),
    sliced.lastIndexOf('？'),
    sliced.lastIndexOf('\n')
  );
  return (punctuationIndex > Math.max(40, Math.floor(max * 0.45)) ? sliced.slice(0, punctuationIndex + 1) : sliced).trim();
}

function fitScriptToCharacterRange(text: string, options: ScriptComposerOptions) {
  const range = getScriptCharacterRange(options.contentType, options.customSettings?.expectedDurationMinutes || 1);
  let candidate = normalizeStoryText(text);
  const paddingParagraphs = buildLengthPaddingParagraphs(options);
  const targetFloor = Math.max(range.min, Math.min(range.max, range.target));
  let guard = 0;

  while (countScriptCharacters(candidate) < targetFloor && guard < 14) {
    const addition = paddingParagraphs[guard % paddingParagraphs.length] || paddingParagraphs[0] || '';
    if (!addition) break;
    const next = [candidate, addition].filter(Boolean).join('\n\n').trim();
    if (countScriptCharacters(next) > range.max) break;
    candidate = normalizeStoryText(next);
    guard += 1;
  }

  if (countScriptCharacters(candidate) > range.max) {
    candidate = trimScriptToMax(candidate, range.max);
  }

  if (countScriptCharacters(candidate) < range.min && paddingParagraphs.length) {
    const addition = paddingParagraphs[0];
    const room = range.max - countScriptCharacters(candidate);
    if (room > 40) {
      const sliced = trimScriptToMax(addition, room);
      candidate = normalizeStoryText([candidate, sliced].filter(Boolean).join('\n\n'));
    }
  }

  return formatStoryTextForEditor(candidate);
}

function resolveSpeechStyle(style: ScriptSpeechStyle | undefined) {
  if (style === 'eum') return 'eum';
  if (style === 'da') return 'da';
  if (style === 'yo') return 'yo';
  return 'default';
}

function formatSpeechStyleLabel(style: ScriptSpeechStyle | undefined) {
  const speechStyle = resolveSpeechStyle(style);
  if (speechStyle === 'da') return '다체';
  if (speechStyle === 'eum') return '음슴체';
  if (speechStyle === 'yo') return '요체';
  return '기본체';
}

function formatSpeechStyleEnglish(style: ScriptSpeechStyle | undefined) {
  const speechStyle = resolveSpeechStyle(style);
  if (speechStyle === 'da') return 'Declarative Korean ending (다체)';
  if (speechStyle === 'eum') return 'Terse informal Korean fragment style (음슴체)';
  if (speechStyle === 'yo') return 'Polite Korean ending (요체)';
  return 'Natural default Korean dialogue (기본체)';
}

function formatScriptLanguageLabel(language: ScriptLanguageOption | undefined) {
  if (language === 'mute') return '무음';
  if (language === 'en') return '영어';
  if (language === 'ja') return '일본어';
  if (language === 'zh') return '중국어';
  if (language === 'vi') return '베트남어';
  if (language === 'mn') return '몽골어';
  if (language === 'th') return '태국어';
  if (language === 'uz') return '우즈베크어';
  return '한국어';
}

function formatScriptLanguageEnglish(language: ScriptLanguageOption | undefined) {
  if (language === 'mute') return 'Silent mode (no spoken dialogue or narration)';
  if (language === 'en') return 'English';
  if (language === 'ja') return 'Japanese';
  if (language === 'zh') return 'Chinese';
  if (language === 'vi') return 'Vietnamese';
  if (language === 'mn') return 'Mongolian';
  if (language === 'th') return 'Thai';
  if (language === 'uz') return 'Uzbek';
  return 'Korean';
}

function createSilentFallback(topic: string, selections: StorySelectionState) {
  const direction = createCreativeDirection(`${topic}:${selections.protagonist}:${selections.setting}:${selections.conflict}`, 0);
  return normalizeStoryText(`${topic || '이 이야기'}의 핵심 이미지는 ${selections.setting}에서 바로 시작된다. ${selections.mood} 공기가 첫 장면부터 흐르고, 화면에는 ${selections.conflict}을 또렷하게 남기는 짧은 자막이 뜬다.

${selections.protagonist}의 움직임과 표정만으로 갈등이 이어진다. 설명 대신 소품과 시선, 전환 속도로 내용을 이해하게 만들고 ${direction.visualHook} 같은 시각적 포인트로 집중을 붙잡는다.

마지막에는 ${selections.endingTone} 흐름을 남기는 짧은 자막 하나로 정리한다. 내레이션 없이도 장면과 자막만으로 이해되게 구성하고 ${direction.subtitleTone}처럼 한 줄의 여운을 남긴다.`);
}

function createDialogueFallback(topic: string, selections: StorySelectionState, style: ScriptSpeechStyle) {
  const speechStyle = resolveSpeechStyle(style);
  const direction = createCreativeDirection(`${topic}:${selections.protagonist}:${selections.setting}:${selections.conflict}:${speechStyle}`, 0);
  if (speechStyle === 'da') {
    return normalizeStoryText(`${topic || '이 이야기'}는 오늘 밤 시작된다. ${selections.protagonist || '나는'}는 ${selections.setting}에서 ${selections.conflict}을 더는 외면하지 않는다.

이번 이야기는 ${selections.mood} 결로 밀고 간다. 망설임보다 선택을 먼저 내세우고, ${direction.narrativeAngle.toLowerCase()} 흐름으로 감정을 앞으로 끌고 간다.

끝에서는 모든 답을 다 주지 않아도 된다. 대신 ${selections.endingTone}만은 분명하게 남겨서 마지막 한 줄이 오래 맴돌게 만든다.`);
  }

  if (speechStyle === 'eum') {
    return normalizeStoryText(`${topic || '이 이야기'} 오늘 밤 시작함. ${selections.setting}에서 ${selections.conflict} 이제 못 미룸.

전체 톤은 ${selections.mood} 쪽으로 감. 설명 길게 안 하고 감정이랑 선택을 바로 밀어 올림. ${direction.narrativeAngle.toLowerCase()} 결 유지함.

마지막은 ${selections.endingTone} 쪽으로 정리함. 짧지만 계속 남는 한 줄로 끝냄.`);
  }

  if (speechStyle === 'yo') {
    return normalizeStoryText(`${topic || '이 이야기'}는 오늘 밤 시작돼요. ${selections.setting}에서 마주한 ${selections.conflict}을 이제는 피하지 않기로 해요.

전체 흐름은 ${selections.mood} 분위기로 가져가요. 설명을 늘어놓기보다 선택과 감정이 한 걸음씩 앞으로 나가게 만들고, ${direction.narrativeAngle.toLowerCase()} 결을 살려요.

끝에서는 ${selections.endingTone}이 또렷하게 남아야 해요. 마지막 문장이 닫힘보다 여운으로 들리게 정리해요.`);
  }

  return normalizeStoryText(`${topic || '이 이야기'}는 오늘 밤 시작된다. ${selections.setting}에서 마주한 ${selections.conflict}은 더는 피할 수 없다.

전체 흐름은 ${selections.mood} 쪽으로 밀고 간다. 설명보다 선택과 감정의 전진을 먼저 보여 주고, ${direction.narrativeAngle.toLowerCase()} 결로 문장을 이어 간다.

마지막에는 ${selections.endingTone}을 분명하게 남긴다. 단정한 마침보다 오래 남는 울림으로 끝맺는다.`);
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(1, Math.min(30, Math.round(minutes || 1)));
  return `${safeMinutes} minute${safeMinutes > 1 ? 's' : ''}`;
}

function buildCharacterRangeGuide(options: ScriptComposerOptions) {
  const range = getScriptCharacterRange(options.contentType, options.customSettings?.expectedDurationMinutes || 1);
  return `글자수 규칙: 공백 포함 최종 대본은 ${range.min}자 이상 ${range.max}자 이하로 맞춘다. 가장 이상적인 목표치는 약 ${range.target}자다.`;
}

function buildFreshTakeGuide(options: ScriptComposerOptions) {
  return `Fresh generation nonce: ${options.generationNonce || Date.now()}. 이전 시도나 방금 만든 결과를 재사용하지 말고, 같은 주제여도 전개와 문장 시작, 비유, 훅을 새롭게 바꾼다.`;
}

function resolveExpandByChars(options: ScriptComposerOptions) {
  return Math.max(300, Math.min(4000, Math.round(options.expandByChars || 800)));
}

function buildGenerationIntentGuide(options: ScriptComposerOptions) {
  if (options.returnOnlySegment) {
    const target = resolveExpandByChars(options);
    return options.contentType === 'music_video'
      ? `전체 가사를 다시 쓰지 말고 약 ${target}자 분량의 다음 가사 블록만 이어서 작성한다. 앞 블록을 반복하거나 요약하지 말고 같은 노래의 다음 구간처럼 자연스럽게 연결한다.`
      : `전체 대본을 다시 쓰지 말고 약 ${target}자 분량의 다음 문단 블록만 이어서 작성한다. 앞 문단을 반복하거나 요약하지 말고 현재 흐름 다음으로 자연스럽게 이어 간다.`;
  }

  if (options.generationIntent === 'expand') {
    const target = resolveExpandByChars(options);
    return options.contentType === 'music_video'
      ? `현재 대본을 지우지 말고 그대로 유지한 채 뒤에 약 ${target}자 분량을 이어서 확장한다. 새로 시작하지 말고, 같은 노래의 다음 가사 블록을 자연스럽게 추가한다.`
      : `현재 대본을 지우지 말고 그대로 유지한 채 뒤에 약 ${target}자 분량을 이어서 확장한다. 새로 다시 쓰지 말고 현재 결말 다음으로 자연스럽게 문단을 추가한다.`;
  }

  return options.contentType === 'music_video'
    ? '선택된 프롬프트와 예시를 따라 실제로 부를 수 있는 가사형 최종 대본을 새로 작성한다.'
    : '선택된 프롬프트와 예시를 따라 최종 영상용 대본을 새로 작성한다.';
}

function buildOutputFormatReminder(options: ScriptComposerOptions) {
  const paragraphGuide = buildParagraphCountGuide(options)
    .replace('Target structure: ', '')
    .replace(/\.$/, '');

  if (options.contentType === 'music_video') {
    return `출력 형식: ${paragraphGuide}. 줄바꿈으로만 리듬을 만들고 블록 제목, 괄호, 설명문, 장면 해설 없이 실제로 부를 가사 줄만 남긴다. 특정 사건을 줄거리처럼 설명하지 말고 노래 가사 자체로 감정과 훅을 만든다.`;
  }

  if (options.contentType === 'info_delivery') {
    return `출력 형식: ${paragraphGuide}. 첫 문단은 핵심 질문, 중간은 설명/예시/비교, 마지막은 요약과 다음 행동으로 끝낸다. 대본 본문만 출력하고 장면 설명, 목표, 주제, 장르, 메모 같은 메타 문구는 본문에 쓰지 않는다.`;
  }

  if (options.contentType === 'cinematic') {
    return `출력 형식: ${paragraphGuide}. 화면 설명이 아니라 목소리로 읽힐 문장만 남긴다. 대본 본문만 출력하고 장면 제목, 카메라 지시, 메타 문구는 본문에 쓰지 않는다. 특정 상황 설명서가 아니라 낭독 가능한 본문만 남긴다.`;
  }

  return `출력 형식: ${paragraphGuide}. 각 문단이 감정과 사건을 함께 전진시켜야 한다. 대본 본문만 출력하고 장면 설명, 목표, 주제, 장르, 메모 같은 메타 문구는 본문에 쓰지 않는다. 영상 연출 지시가 아니라 실제 낭독 대본 문장만 남긴다.`;
}

function buildConceptLockGuide(options: ScriptComposerOptions) {
  if (options.contentType === 'music_video') {
    return 'Step 1 concept lock: music video. The final body must stay as singable lyrics only, with visible rhythm and chorus lift. Do not switch into scene explanation, screenplay prose, or narrative situation summary.';
  }

  if (options.contentType === 'cinematic') {
    return 'Step 1 concept lock: cinematic movie-style storytelling. The final body must feel like visible scenes, not an explainer article.';
  }

  if (options.contentType === 'info_delivery') {
    return 'Step 1 concept lock: explainer / information-delivery. The final body must teach clearly through order, example, comparison, or numbers.';
  }

  return 'Step 1 concept lock: narrative storytelling. The final body must move through emotion, action, and scene progression while staying as readable voice script sentences, not production notes.';
}

function buildParagraphCountGuide(options: ScriptComposerOptions) {
  const minutes = Math.max(1, Math.min(30, Math.round(options.customSettings?.expectedDurationMinutes || 1)));
  const baseCount = Math.max(
    options.contentType === 'music_video' ? 4 : 3,
    Math.min(options.contentType === 'music_video' ? 16 : 18, Math.round(minutes * 1.2)),
  );
  const minParagraphs = Math.max(options.contentType === 'music_video' ? 4 : 3, baseCount - 1);
  const maxParagraphs = Math.max(minParagraphs, Math.min(options.contentType === 'music_video' ? 18 : 20, baseCount + 1));

  if (options.contentType === 'music_video') {
    return `Target structure: ${minParagraphs} to ${maxParagraphs} blank-line-separated lyric paragraphs with no block labels.`;
  }

  if (options.contentType === 'info_delivery') {
    return `Target structure: ${minParagraphs} to ${maxParagraphs} blank-line-separated TTS narration paragraphs.`;
  }

  if (options.contentType === 'cinematic') {
    return `Target structure: ${minParagraphs} to ${maxParagraphs} blank-line-separated cinematic narration paragraphs.`;
  }

  return `Target structure: ${minParagraphs} to ${maxParagraphs} blank-line-separated story narration paragraphs.`;
}

function buildCompactScriptContext(text: string, maxChars: number = SCRIPT_SEGMENT_CONTEXT_CHARS) {
  const paragraphs = normalizeStoryText(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paragraphs.length) return 'None';

  const opening = paragraphs[0] ? trimScriptToMax(paragraphs[0], Math.min(220, maxChars)) : '';
  const recent = trimScriptToMax(paragraphs.slice(-2).join('\n\n'), Math.max(260, Math.min(420, maxChars - 120)));
  const middle = paragraphs.length > 3
    ? trimScriptToMax(paragraphs.slice(1, -2).join(' '), Math.max(120, Math.min(180, maxChars - opening.length - recent.length)))
    : '';

  return [
    opening ? `[OPENING LOCK] ${opening}` : '',
    middle ? `[ARC SO FAR] ${middle}` : '',
    recent ? `[LATEST FLOW] ${recent}` : '',
  ].filter(Boolean).join('\n');
}

function resolveScriptSegmentGoal(options: ScriptComposerOptions, currentText: string) {
  const range = getScriptCharacterRange(options.contentType, options.customSettings?.expectedDurationMinutes || 1);
  const currentChars = countScriptCharacters(currentText);
  const desiredTotal = options.generationIntent === 'expand'
    ? Math.min(range.max, Math.max(currentChars + resolveExpandByChars(options), range.min))
    : range.target;
  const remainingChars = Math.max(0, desiredTotal - currentChars);
  if (remainingChars < SCRIPT_SEGMENT_TARGET_CHARS) return null;

  const segmentCount = Math.max(2, Math.min(SCRIPT_SEGMENT_MAX_COUNT, Math.ceil(remainingChars / SCRIPT_SEGMENT_TARGET_CHARS)));
  const baseTarget = Math.max(SCRIPT_SEGMENT_MIN_CHARS, Math.floor(remainingChars / segmentCount));
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const remaining = remainingChars - (baseTarget * index);
    const slotsLeft = segmentCount - index;
    return Math.max(SCRIPT_SEGMENT_MIN_CHARS, Math.floor(remaining / Math.max(1, slotsLeft)));
  });

  return {
    desiredTotal,
    remainingChars,
    segmentCount,
    segments,
  };
}

function buildSegmentPhaseGuide(options: ScriptComposerOptions, index: number, total: number) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (options.contentType === 'music_video') {
    if (isFirst) return 'Open with a memorable lyrical hook and the core emotional melody of this project. Do not spend the whole segment on setup.';
    if (isLast) return 'Land the final hook, emotional lift, or afterglow without breaking singability. Finish like the ending of the same song, not a new song.';
    return 'Develop the next lyrical beat, keep chorus-level memorability, and transition naturally from the prior vocal flow without repeating earlier lines.';
  }

  if (options.contentType === 'info_delivery') {
    if (isFirst) return 'Open with the why-now question or key context, then move straight into the first clear explanation beat.';
    if (isLast) return 'Close with the final takeaway, summary, or next action so the explanation ends cleanly.';
    return 'Continue the explanation through order, example, comparison, or numbers. Extend understanding instead of restating the opener.';
  }

  if (options.contentType === 'cinematic') {
    if (isFirst) return 'Open with visible tension, a concrete scene beat, and the emotional hook of the story.';
    if (isLast) return 'Bring the emotional landing, reveal, or irreversible beat into focus and leave a cinematic aftertaste.';
    return 'Push the scene pressure forward through reaction, movement, and emotional escalation. Continue from the prior beat like the next cut of the same film.';
  }

  if (isFirst) return 'Open with the story hook and the first emotional or action beat right away.';
  if (isLast) return 'Deliver the final turn, choice, or afterglow so the story lands with continuity.';
  return 'Continue the narrative by escalating conflict, reaction, and scene progression without resetting the story.';
}

function buildContinuationPromptAdditions(options: ScriptComposerOptions, currentText: string, segmentIndex: number, segmentCount: number, targetChars: number) {
  return [
    buildMarkdownSection('Long Script Segment', [
      `This is segment ${segmentIndex + 1} of ${segmentCount}. Write only the newly added continuation block.`,
      `Aim for about ${targetChars} characters of fresh body text.`,
    ]),
    buildMarkdownSection('Segment Phase', [
      buildSegmentPhaseGuide(options, segmentIndex, segmentCount),
    ]),
    buildMarkdownSection('Continuity Rule', [
      'Continue directly from the latest beat.',
      'Do not restart the premise, summarize previous paragraphs, or duplicate lines that already exist.',
      ...buildTransitionIntentLines(options.contentType, 'script'),
    ]),
    buildMarkdownSection('Current Draft Context', [
      buildCompactScriptContext(currentText),
    ], { bullet: false }),
  ];
}

function extractUniqueContinuationParagraphs(baseText: string, candidateText: string) {
  const baseParagraphs = normalizeStoryText(baseText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const candidateParagraphs = normalizeStoryText(candidateText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return candidateParagraphs.filter((paragraph) => {
    const compactParagraph = paragraph.replace(/\s+/g, ' ').trim();
    return compactParagraph && !baseParagraphs.some((baseParagraph) => {
      const compactBase = baseParagraph.replace(/\s+/g, ' ').trim();
      return compactBase === compactParagraph
        || compactBase.includes(compactParagraph)
        || compactParagraph.includes(compactBase);
    });
  });
}

function mergeContinuationScript(baseText: string, candidateText: string) {
  const base = normalizeStoryText(baseText);
  const candidate = normalizeStoryText(candidateText);
  if (!candidate) return base;
  if (!base) return candidate;

  const baseParagraphs = base.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const candidateParagraphs = candidate.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (
    candidateParagraphs.length > baseParagraphs.length
    && candidateParagraphs[0]
    && baseParagraphs[0]
    && candidateParagraphs[0].slice(0, 28) === baseParagraphs[0].slice(0, 28)
  ) {
    return candidate;
  }

  const appended = extractUniqueContinuationParagraphs(base, candidate);
  if (!appended.length) return base;
  return normalizeStoryText([...baseParagraphs, ...appended].join('\n\n'));
}

function createMusicVideoExpansionFallback(options: ScriptComposerOptions) {
  const topic = options.topic || '이 노래';
  const direction = createCreativeDirection(`${options.contentType}:${topic}:${options.currentScript || ''}`, 1, options.contentType);
  const lead = options.selections.protagonist || '화자';
  const conflict = options.selections.conflict || '남겨 둔 마음';
  const mood = options.selections.mood || '짙은';
  const endingTone = options.selections.endingTone || '여운 있는 마감';
  const target = resolveExpandByChars(options);
  const extraBlocks = [
    `${lead}의 숨 위로 ${mood} 불빛이 더 크게 번져
${direction.visualHook}
끝내 숨겨 둔 ${conflict}마저 멜로디로 흘러와
돌아갈 수 없는 마음도 오늘은 후렴이 되고
멈춘 장면 같던 밤이 다시 앞으로 걸어간다`,
    `나는 너를 더 크게 부른다, 이번에는 나를 먼저 부른다
사라진 줄 알았던 떨림을 끝까지 살린다
대답 없는 새벽이어도 이 노래는 계속된다
${topic}의 마지막 줄까지 전부 안고 간다`,
    `${endingTone} 공기 속에서도 나는 천천히 웃는다
남겨 둔 한마디까지 오늘의 노래로 남긴다`,
  ];
  const blockCount = target >= 1800 ? 3 : target >= 900 ? 2 : 1;
  return normalizeStoryText([options.currentScript?.trim() || '', ...extraBlocks.slice(0, blockCount)].filter(Boolean).join('\n\n'));
}

function createNarrativeExpansionFallback(options: ScriptComposerOptions) {
  const topic = options.topic || '이번 이야기';
  const direction = createCreativeDirection(`${options.contentType}:${topic}:${options.currentScript || ''}`, 1, options.contentType);
  const lead = options.selections.protagonist || '주인공';
  const setting = options.selections.setting || '익숙한 공간';
  const conflict = options.selections.conflict || '남겨 둔 문제';
  const mood = options.selections.mood || '긴장감 있는';
  const endingTone = options.selections.endingTone || '여운 있는 마감';
  const target = resolveExpandByChars(options);
  const extras = options.contentType === 'info_delivery'
    ? [
        `${topic}를 더 쉽게 이해하려면 실제 장면 하나를 붙여 보는 편이 좋다. ${setting} 기준 사례를 넣으면 시청자는 설명이 아니라 체감으로 내용을 받아들이게 된다. 여기서 ${conflict}이 왜 중요한지도 자연스럽게 정리된다.`,
        `이어서 비교 지점을 짚어 주면 정보 전달력이 더 좋아진다. 이전 방식과 지금 방식을 나란히 보여 주고, 숫자나 짧은 예시를 더해 차이가 어디서 발생하는지 설명한다. ${mood} 톤을 유지하되 문장은 어렵지 않게 정리한다.`,
        `마지막에는 핵심을 다시 한 번 묶어 준다. 지금 당장 기억해야 할 포인트와 다음에 확인할 행동을 한 줄씩 남기면 ${endingTone} 흐름으로 마무리할 수 있다.`,
      ]
    : [
        `${setting}의 공기는 조금씩 달라지고, ${lead}은 방금 지나간 장면이 끝이 아니라는 사실을 뒤늦게 알아챈다. ${conflict}은 아직 해결되지 않았고, 오히려 더 또렷한 표정으로 눈앞에 돌아온다. ${direction.visualHook}`, 
        `${lead}은 이번에는 도망치지 않기로 한다. 사소해 보였던 말과 움직임이 하나씩 이어지면서 ${topic}의 진짜 무게가 드러나고, ${mood} 결의가 다음 선택을 밀어 올린다. ${direction.narrativeAngle}`, 
        `결국 마지막 장면은 이전보다 한 걸음 더 나아간 자리에서 멈춘다. 모든 것이 끝난 것은 아니지만, ${lead}은 ${endingTone} 공기 속에서 분명히 다른 얼굴로 다음 장면을 맞는다.`,
      ];
  const paragraphCount = target >= 1800 ? 3 : target >= 900 ? 2 : 1;
  return normalizeStoryText([options.currentScript?.trim() || '', ...extras.slice(0, paragraphCount)].filter(Boolean).join('\n\n'));
}

function createExpansionFallback(options: ScriptComposerOptions): string {
  const current = normalizeStoryText(options.currentScript || '');
  if (!current) return createFallback({ ...options, generationIntent: 'draft' });
  return options.contentType === 'music_video'
    ? createMusicVideoExpansionFallback(options)
    : createNarrativeExpansionFallback(options);
}

function buildLocalizedGuide(options: ScriptComposerOptions) {
  const settings = options.customSettings;
  if (!settings) return [] as string[];

  const duration = Math.max(1, Math.min(30, Math.round(settings.expectedDurationMinutes || 1)));
  const topic = options.topic || 'Auto-generated topic';
  const reference = settings.referenceText?.trim();
  const speechStyle = resolveSpeechStyle(settings.speechStyle);
  const languageGuides: Record<CustomScriptSettings['language'], string[]> = {
    ko: [
      `이 대본은 약 ${duration}분 분량을 목표로 합니다. 주제는 ${topic}이고 분위기는 ${options.selections.mood}, 배경은 ${options.selections.setting}입니다.`,
      settings.language === 'mute'
        ? '무음 영상용 구성으로 작성하고 내레이션이나 대사는 넣지 않습니다. 화면 자막과 행동 흐름 중심으로 정리합니다.'
        : `말투는 ${formatSpeechStyleLabel(settings.speechStyle)}를 유지합니다.`,
      reference ? `참고 내용은 ${reference}${speechStyle === 'da' ? '를 반영한다.' : speechStyle === 'eum' ? ' 반영 바람.' : '를 반영해 주세요.'}` : '',
    ],
    en: [
      `This script targets about ${formatDuration(duration)}. The topic is ${topic}, with a ${options.selections.mood} mood in ${options.selections.setting}.`,
      settings.language === 'mute'
        ? 'Create a silent visual script with no spoken dialogue or narration. Use scene actions and on-screen caption cues only.'
        : `Keep the speech style ${speechStyle === 'default' ? 'natural screenplay dialogue' : speechStyle === 'da' ? 'declarative' : speechStyle === 'eum' ? 'terse informal fragment style' : 'polite conversational'}.`,
      reference ? `Reference notes: ${reference}` : '',
    ],
    ja: [
      `この台本は約${duration}分を想定しています。テーマは${topic}で、雰囲気は${options.selections.mood}、舞台は${options.selections.setting}です。`,
      reference ? `参考内容: ${reference}` : '',
    ],
    zh: [
      `这份脚本预计约${duration}分钟。主题是${topic}，整体氛围是${options.selections.mood}，场景设定在${options.selections.setting}。`,
      reference ? `参考内容：${reference}` : '',
    ],
    vi: [
      `Kịch bản này hướng đến thời lượng khoảng ${duration} phút. Chủ đề là ${topic}, không khí ${options.selections.mood}, bối cảnh tại ${options.selections.setting}.`,
      reference ? `Nội dung tham khảo: ${reference}` : '',
    ],
    mn: [
      `Энэ зохиол ойролцоогоор ${duration} минутын урттай байна. Сэдэв нь ${topic}, уур амьсгал нь ${options.selections.mood}, орчин нь ${options.selections.setting}.`,
      reference ? `Лавлах агуулга: ${reference}` : '',
    ],
    th: [
      `สคริปต์นี้ตั้งเป้าความยาวประมาณ ${duration} นาที หัวข้อคือ ${topic} โทนคือ ${options.selections.mood} และฉากหลังคือ ${options.selections.setting}`,
      reference ? `ข้อมูลอ้างอิง: ${reference}` : '',
    ],
    uz: [
      `Bu ssenariy taxminan ${duration} daqiqaga mo‘ljallangan. Mavzu ${topic}, kayfiyat ${options.selections.mood}, manzara esa ${options.selections.setting}.`,
      reference ? `Tayanch matn: ${reference}` : '',
    ],
    mute: [
      `이 구성안은 약 ${duration}분 분량의 무음 영상용입니다. 주제는 ${topic}이고 분위기는 ${options.selections.mood}, 배경은 ${options.selections.setting}입니다.`,
      '내레이션과 대사는 쓰지 말고 장면 설명, 화면 자막, 행동 흐름 중심으로 구성합니다.',
      reference ? `참고 내용은 ${reference}를 반영합니다.` : '',
    ],
  };

  return languageGuides[settings.language].filter(Boolean);
}

function applyCustomFallback(baseText: string, options: ScriptComposerOptions) {
  const settings = options.customSettings;
  if (!settings) return normalizeStoryText(baseText);

  const paragraphs = normalizeStoryText(baseText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const fillers = buildLengthPaddingParagraphs(options);
  const targetParagraphCount = Math.max(3, Math.min(36, Math.round((settings.expectedDurationMinutes || 1) * 1.2)));
  const cloned = [...paragraphs];
  let fillerIndex = 0;

  while (cloned.length < targetParagraphCount) {
    const nextFiller = fillers[fillerIndex % Math.max(1, fillers.length)] || '';
    if (!nextFiller) break;
    cloned.push(nextFiller);
    fillerIndex += 1;
  }

  const body = cloned.slice(0, targetParagraphCount);
  return normalizeStoryText(body.join('\n\n'));
}

function createFallback(options: ScriptComposerOptions): string {
  if (options.generationIntent === 'expand') {
    return createExpansionFallback(options);
  }

  const speechStyle = options.customSettings?.speechStyle || 'yo';
  const isSilentMode = options.customSettings?.language === 'mute';
  const baseText = isSilentMode
    ? createSilentFallback(options.topic, options.selections)
    : options.conversationMode || options.template.mode === 'dialogue'
      ? createDialogueFallback(options.topic, options.selections, speechStyle)
      : normalizeStoryText(
          options.currentScript?.trim() ||
            [
              buildSelectableStoryDraft({
                contentType: options.contentType,
                topic: options.topic,
                ...options.selections,
              }),
              createCreativeDirection(`${options.contentType}:${options.topic}:${options.generationNonce || Date.now()}`, 2, options.contentType).subtitleTone,
            ].filter(Boolean).join('\n\n')
        );

  return fitScriptToCharacterRange(applyCustomFallback(baseText, options), options);
}

function buildConstitutionFallbackAnalysis(options: ScriptComposerOptions, source: 'ai' | 'sample'): ConstitutionAnalysisSummary {
  const mood = options.selections.mood || '몰입형';
  const topic = options.topic || '이번 프로젝트';
  const targetName = options.contentType === 'cinematic'
    ? '2030 시네마 몰입형'
    : options.contentType === 'info_delivery'
      ? '2030 실전 학습형'
      : '2030 호기심 몰입형';
  const structureId = options.contentType === 'cinematic' ? '005' : options.contentType === 'info_delivery' ? '010' : '005';
  const titles = [
    `${topic}에서 가장 먼저 보이는 장면`,
    `${topic}가 빠르게 먹히는 포인트`,
    `${topic}를 끝까지 보게 되는 흐름`,
    `${topic}를 설명보다 현상으로 푸는 방식`,
    `${topic}를 짧게 정리하는 구성`,
  ];
  const keywords = [
    { ko: topic, en: topic },
    { ko: options.selections.genre, en: options.selections.genre },
    { ko: options.selections.setting, en: options.selections.setting },
    { ko: options.selections.conflict, en: options.selections.conflict },
    { ko: mood, en: mood },
  ].filter((item) => item.ko && item.en);

  return {
    targetProfile: {
      name: targetName,
      identity: `${mood} 톤에서 핵심만 빠르게 건지는 시청자`,
      interests: [options.selections.genre, options.selections.setting, options.selections.conflict].filter(Boolean),
      tone: `${mood} 톤의 짧고 선명한 설명`,
    },
    safetyReview: {
      grade: 'safe',
      details: '현재 입력 기준으로 즉시 중단해야 할 위험 신호는 크지 않습니다.',
      decision: '대본 생성을 계속 진행해도 됩니다.',
    },
    monetizationReview: {
      grade: 'green',
      details: '선정성이나 노골적인 위험 조장 없이 정보/스토리 중심으로 정리된 초안입니다.',
      solution: '자극적인 단어를 과하게 늘리지 않고 사실 중심 표현을 유지합니다.',
    },
    selectedStructure: {
      id: structureId,
      reason: '현재 주제와 톤에 맞춰 짧은 쇼츠에서 이해와 몰입을 동시에 잡기 쉬운 구조를 선택했습니다.',
    },
    titles,
    keywords,
    source,
    updatedAt: Date.now(),
  };
}

function extractScriptFromText(raw: string) {
  const generateBlock = raw.match(/```(?:generate|text|plain|markdown)?\s*([\s\S]*?)```/i);
  if (generateBlock?.[1]?.trim()) {
    return normalizeStoryText(generateBlock[1].trim());
  }
  return normalizeStoryText(raw.trim());
}

function isVideoSectionHeading(line: string) {
  return /^(scene\s*\d+|장면\s*\d+|paragraph\s*\d+|문단\s*\d+|sequence\s*\d+|컷\s*\d+|\[(intro|verse|pre-chorus|chorus|bridge|hook|outro)[^\]]*\])/i.test(line.trim());
}

function sanitizeTtsOnlyLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return '';
  if (isVideoSectionHeading(trimmed)) return '';
  const withoutBracketLabel = trimmed.replace(/^\[(intro|verse|pre-chorus|chorus|bridge|hook|outro)[^\]]*\]\s*/i, '').trim();
  const withoutSpeaker = withoutBracketLabel.replace(/^[가-힣A-Za-z0-9 _-]{1,20}:\s*/, '').trim();
  return withoutSpeaker;
}

function stripPromptLikeParagraphs(text: string) {
  const metaPatterns = [
    /^(목표|주제|장르|분위기|배경|주인공(?:\/화자)?|화자|갈등|결말\s*톤|예상\s*길이|대본\s*언어|선호\s*말투|생성\s*작업|출력\s*형식|현재\s*초안|참고\s*텍스트|콘텐츠\s*유형)\s*:/i,
    /^this script targets about\s+/i,
    /^content type\s*:/i,
    /^topic\s*:/i,
    /^genre\s*:/i,
    /^mood\s*:/i,
    /^setting\s*:/i,
    /^lead\s*:/i,
    /^conflict\s*:/i,
    /^ending tone\s*:/i,
    /^expected duration\s*:/i,
    /^preferred speech style\s*:/i,
    /^script language\s*:/i,
    /^silent mode rule\s*:/i,
    /^reference notes\s*:/i,
    /^prompt template\s*:/i,
    /^prompt description\s*:/i,
    /^generation task\s*:/i,
    /^output format reminder\s*:/i,
    /^selected prompt\s*:/i,
    /^additional guidance phrases\s*:/i,
    /^translation rule\s*:/i,
    /^current draft\s*:/i,
    /^참고 내용\s*:/i,
    /^참고 텍스트\s*:/i,
    /^추가 가이드\s*:/i,
    /^선택된 프롬프트\s*:/i,
    /^현재 초안\s*:/i,
    /^생성 지침\s*:/i,
    /^영상 콘셉트\s*:/i,
    /^프롬프트\s*:/i,
    /^대본 작성 규칙\s*:/i,
    /^출력 규칙\s*:/i,
    /^\[(선택된 프롬프트|selected prompt|추가 가이드|additional guidance phrases|translation rule|current draft)\]/i,
  ];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const filtered = paragraphs.filter((paragraph) => {
    const lines = paragraph.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!lines.length) return false;
    const metaLineCount = lines.filter((line) => metaPatterns.some((pattern) => pattern.test(line))).length;
    return metaLineCount === 0;
  });

  return normalizeStoryText((filtered.length ? filtered : paragraphs).join('\n\n'));
}

function chunkSentencesForVideoScript(text: string, targetCount: number) {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=함\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!sentences.length) return [text.trim()].filter(Boolean);

  const chunkSize = Math.max(1, Math.ceil(sentences.length / Math.max(3, targetCount)));
  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += chunkSize) {
    chunks.push(sentences.slice(index, index + chunkSize).join(' '));
  }
  return chunks;
}

function ensureParagraphVideoScript(raw: string, options: ScriptComposerOptions) {
  const cleaned = stripPromptLikeParagraphs(raw.replace(/\r/g, '')).trim();
  if (!cleaned) return '';

  const explicitParagraphs = cleaned
    .split(/\n{2,}/)
    .map((item) => item.split('\n').map((line) => sanitizeTtsOnlyLine(line)).filter(Boolean).join('\n').trim())
    .filter(Boolean);
  if (explicitParagraphs.length >= 3) {
    return normalizeStoryText(explicitParagraphs.join('\n\n'));
  }

  const lines = cleaned
    .split('\n')
    .map((item) => sanitizeTtsOnlyLine(item))
    .filter(Boolean);
  if (lines.length >= 3) {
    const grouped: string[] = [];
    let bucket: string[] = [];
    lines.forEach((line, index) => {
      bucket.push(line);
      const nextLine = lines[index + 1] || '';
      if (!nextLine) return;
      if (bucket.length >= 3) {
        grouped.push(bucket.join('\n'));
        bucket = [];
      }
    });
    if (bucket.length) grouped.push(bucket.join('\n'));
    if (grouped.length >= 3) {
      return normalizeStoryText(grouped.join('\n\n'));
    }
  }

  const fallbackTarget = Math.max(3, Math.min(12, Math.round((options.customSettings?.expectedDurationMinutes || 1) * 1.2)));
  return normalizeStoryText(chunkSentencesForVideoScript(lines.join(' ') || cleaned, fallbackTarget).join('\n\n'));
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch?.[1] || trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeStringArray(value: unknown, max = 30) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeKeywordPairs(value: unknown, max = 25) {
  if (!Array.isArray(value)) return [] as Array<{ ko: string; en: string }>;
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const pair = item as Record<string, unknown>;
      const ko = typeof pair.ko === 'string' ? pair.ko.trim() : '';
      const en = typeof pair.en === 'string' ? pair.en.trim() : '';
      if (!ko || !en) return null;
      return { ko, en };
    })
    .filter((item): item is { ko: string; en: string } => Boolean(item))
    .slice(0, max);
}

function parseConstitutionResponse(
  raw: string,
  fallbackScript: string,
  fallbackAnalysis: ConstitutionAnalysisSummary,
  source: 'ai' | 'sample',
  options: ScriptComposerOptions
): { text: string; analysis: ConstitutionAnalysisSummary } {
  const parsed = parseJsonObject(raw);

  if (!parsed || typeof parsed !== 'object') {
    return {
      text: ensureParagraphVideoScript(extractScriptFromText(raw || fallbackScript), options),
      analysis: {
        ...fallbackAnalysis,
        source,
        updatedAt: Date.now(),
      },
    };
  }

  const record = parsed as Record<string, unknown>;
  const script = typeof record.script === 'string' && record.script.trim()
    ? ensureParagraphVideoScript(normalizeStoryText(record.script), options)
    : ensureParagraphVideoScript(extractScriptFromText(raw || fallbackScript), options);

  const targetRecord = record.targetProfile && typeof record.targetProfile === 'object'
    ? record.targetProfile as Record<string, unknown>
    : {};
  const safetyRecord = record.safetyReview && typeof record.safetyReview === 'object'
    ? record.safetyReview as Record<string, unknown>
    : {};
  const monetizationRecord = record.monetizationReview && typeof record.monetizationReview === 'object'
    ? record.monetizationReview as Record<string, unknown>
    : {};
  const structureRecord = record.selectedStructure && typeof record.selectedStructure === 'object'
    ? record.selectedStructure as Record<string, unknown>
    : {};

  const analysis: ConstitutionAnalysisSummary = {
    targetProfile: {
      name: typeof targetRecord.name === 'string' && targetRecord.name.trim() ? targetRecord.name.trim() : fallbackAnalysis.targetProfile.name,
      identity: typeof targetRecord.identity === 'string' && targetRecord.identity.trim() ? targetRecord.identity.trim() : fallbackAnalysis.targetProfile.identity,
      interests: normalizeStringArray(targetRecord.interests, 8).length ? normalizeStringArray(targetRecord.interests, 8) : fallbackAnalysis.targetProfile.interests,
      tone: typeof targetRecord.tone === 'string' && targetRecord.tone.trim() ? targetRecord.tone.trim() : fallbackAnalysis.targetProfile.tone,
    },
    safetyReview: {
      grade: safetyRecord.grade === 'danger' ? 'danger' : 'safe',
      details: typeof safetyRecord.details === 'string' && safetyRecord.details.trim() ? safetyRecord.details.trim() : fallbackAnalysis.safetyReview.details,
      decision: typeof safetyRecord.decision === 'string' && safetyRecord.decision.trim() ? safetyRecord.decision.trim() : fallbackAnalysis.safetyReview.decision,
    },
    monetizationReview: {
      grade: monetizationRecord.grade === 'yellow' || monetizationRecord.grade === 'red' ? monetizationRecord.grade : 'green',
      details: typeof monetizationRecord.details === 'string' && monetizationRecord.details.trim() ? monetizationRecord.details.trim() : fallbackAnalysis.monetizationReview.details,
      solution: typeof monetizationRecord.solution === 'string' && monetizationRecord.solution.trim() ? monetizationRecord.solution.trim() : fallbackAnalysis.monetizationReview.solution,
    },
    selectedStructure: {
      id: typeof structureRecord.id === 'string' && structureRecord.id.trim() ? structureRecord.id.trim() : fallbackAnalysis.selectedStructure.id,
      reason: typeof structureRecord.reason === 'string' && structureRecord.reason.trim() ? structureRecord.reason.trim() : fallbackAnalysis.selectedStructure.reason,
    },
    titles: normalizeStringArray(record.titles, 30).length ? normalizeStringArray(record.titles, 30) : fallbackAnalysis.titles,
    keywords: normalizeKeywordPairs(record.keywords, 25).length ? normalizeKeywordPairs(record.keywords, 25) : fallbackAnalysis.keywords,
    source,
    updatedAt: Date.now(),
  };

  return { text: script || ensureParagraphVideoScript(fallbackScript, options), analysis };
}

function buildCreativePayload(options: ScriptComposerOptions, task: 'script' | 'subtitle' = 'script') {
  const seedText = [
    options.contentType,
    options.topic || 'Auto-generated',
    options.selections.genre,
    options.selections.mood,
    options.selections.setting,
    options.selections.protagonist,
    options.selections.conflict,
    options.selections.endingTone,
    options.currentScript || '',
    options.generationIntent || 'draft',
    options.generationNonce || '',
  ].join('::');
  return buildCreativeDirectionBlock({
    task,
    seedText,
    contentType: options.contentType,
    index: options.generationIntent === 'expand' ? 1 : 0,
  });
}

function buildScriptQualityGuide(options: ScriptComposerOptions) {
  return [
    buildOutputFormatReminder(options),
    buildCharacterRangeGuide(options),
    getTtsOnlyRule(options.contentType),
    options.contentType === 'music_video'
      ? 'Keep each block singable and easy to split into Step6 visual moments without turning into prose explanation.'
      : 'Keep each paragraph easy to voice, easy to scene-ify, and easy to split into Step6 scene beats.',
    options.contentType === 'info_delivery'
      ? 'Each paragraph should preserve at least one clear explanation beat, useful example, comparison, or takeaway.'
      : 'Each paragraph should preserve at least one visible emotional beat, action beat, or scene change that Step6 can visualize.',
    options.customSettings?.language === 'mute'
      ? 'Mute mode still needs scene-ready visual beats with no spoken dialogue or narration.'
      : 'Use mouth-shape-friendly pacing and sentence flow that can be spoken clearly in sequence.',
  ];
}

function buildScriptRequestMarkdown(
  options: ScriptComposerOptions,
  currentDraftContext: string,
  extras?: {
    selectedPrompt?: string | null;
    translationRule?: string | null;
    additionalGuidance?: string[];
  }
) {
  const additionalGuidance = (extras?.additionalGuidance || []).filter((item) => item.trim());
  return joinPromptBlocks([
    buildMarkdownSection('Goal', [buildGenerationIntentGuide(options)]),
    buildMarkdownSection('Concept Direction', [
      buildConceptLockGuide(options),
      ...buildConceptDirectionLines(options.contentType, 'script'),
    ]),
    buildMarkdownSection('Writing Rules', buildScriptQualityGuide(options)),
    buildMarkdownSection('Transition Rules', buildTransitionIntentLines(options.contentType, 'script')),
    buildMarkdownSection('Similarity Control', [
      ...buildSimilarityControlLines(),
      buildFreshTakeGuide(options),
    ]),
    buildMarkdownKeyValueSection('Project Inputs', [
      ['Content Type', options.contentType],
      ['Topic', options.topic || 'Auto-generated topic'],
      ['Genre', options.selections.genre],
      ['Mood', options.selections.mood],
      ['Setting', options.selections.setting],
      ['Lead', options.selections.protagonist],
      ['Conflict', options.selections.conflict],
      ['Ending Tone', options.selections.endingTone],
      ['Expected Duration', `${Math.max(1, Math.min(30, options.customSettings?.expectedDurationMinutes || 1))} minute(s)`],
      ['Script Language', formatScriptLanguageEnglish(options.customSettings?.language)],
      ['Speech Style', formatSpeechStyleEnglish(options.customSettings?.speechStyle)],
      ['Prompt Template', options.template.name],
      ['Prompt Template Description', options.template.description],
      ['Reference Notes', options.customSettings?.referenceText?.trim() || 'None'],
    ]),
    buildMarkdownSection('Voice Only Sample', [
      buildVoiceOnlySample(options.contentType, options.topic, options.selections),
    ], { bullet: false }),
    buildMarkdownSection('Creative Variance', [
      buildCreativePayload(options),
    ], { bullet: false }),
    buildMarkdownSection('Current Draft Context', [
      currentDraftContext || 'None',
    ], { bullet: false }),
    additionalGuidance.length ? buildMarkdownSection('Additional Guidance', additionalGuidance) : '',
    extras?.selectedPrompt ? buildMarkdownSection('Selected Prompt', [extras.selectedPrompt], { bullet: false }) : '',
    extras?.translationRule ? buildMarkdownSection('Translation Rule', [extras.translationRule], { bullet: false }) : '',
  ]);
}

function buildConstitutionUserPayload(options: ScriptComposerOptions) {
  const markdownDraftContext = options.continuityContext?.trim() || options.currentScript?.trim() || 'None';
  return buildScriptRequestMarkdown(options, markdownDraftContext, {
    selectedPrompt: options.template.prompt,
    additionalGuidance: (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 8),
  });
  const additionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 8);
  const currentDraftContext = options.continuityContext?.trim() || options.currentScript?.trim() || '없음';
  return [
    `콘텐츠 유형: ${options.contentType}`,
    `주제: ${options.topic || '자동 생성 주제'}`,
    `장르: ${options.selections.genre}`,
    `분위기: ${options.selections.mood}`,
    `배경: ${options.selections.setting}`,
    `주인공/화자: ${options.selections.protagonist}`,
    `핵심 갈등: ${options.selections.conflict}`,
    `결말 톤: ${options.selections.endingTone}`,
    `예상 길이: ${Math.max(1, Math.min(30, options.customSettings?.expectedDurationMinutes || 1))}분`,
    `대본 언어: ${formatScriptLanguageLabel(options.customSettings?.language)}`,
    `선호 말투: ${formatSpeechStyleLabel(options.customSettings?.speechStyle)}`,
    `생성 작업: ${buildGenerationIntentGuide(options)}`,
    `콘셉트 고정 규칙: ${buildConceptLockGuide(options)}`,
    `문단 구조 가이드: ${buildParagraphCountGuide(options)}`,
    `출력 형식: ${buildOutputFormatReminder(options)}`,
    buildCharacterRangeGuide(options),
    `TTS 전용 규칙: ${getTtsOnlyRule(options.contentType)}`,
    buildFreshTakeGuide(options),
    `[항목별 대본 샘플]\n${buildVoiceOnlySample(options.contentType, options.topic, options.selections)}`,
    buildCreativePayload(options),
    `현재 초안/문맥: ${currentDraftContext}`,
    `참고 텍스트: ${options.customSettings?.referenceText?.trim() || '없음'}`,
    additionBlock.length ? `[추가 가이드]\n${additionBlock.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    '',
    '[선택된 프롬프트]',
    options.template.prompt,
  ].filter(Boolean).join('\n\n');
}

async function requestPlainScriptDraft(options: ScriptComposerOptions, fallback: string, maxTokens: number = 2200, applyRangeFit: boolean = true): Promise<ScriptComposerResult> {
  const markdownBundle = getPromptRegistry(options.contentType);
  const markdownDraftContext = options.continuityContext?.trim() || options.currentScript || 'None';
  const markdownRequestPayload = await translatePromptToEnglish(
    buildScriptRequestMarkdown(options, markdownDraftContext, {
      selectedPrompt: options.template.prompt,
      translationRule: markdownBundle.translateRule,
    }),
    { label: 'script composer request', preserveLineBreaks: true, maxChars: 12000 },
  );

  const markdownAdditionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 10);
  const markdownMergedPayload = markdownAdditionBlock.length
    ? joinPromptBlocks([
      markdownRequestPayload,
      buildMarkdownSection('Additional Guidance', markdownAdditionBlock),
    ])
    : markdownRequestPayload;

  const markdownResult = await runTextAi({
    system: `${markdownBundle.system} Follow the markdown sections by priority. Treat Concept Direction, Writing Rules, Transition Rules, Similarity Control, and Selected Prompt as the active execution rules. Output only the final script body with no headings or meta labels. When continuation guidance is present, write only the newly added continuation block instead of rewriting earlier paragraphs.`,
    user: markdownMergedPayload,
    model: options.model || options.customSettings?.scriptModel || 'openrouter/auto',
    temperature: options.conversationMode || options.template.mode === 'dialogue' ? 0.98 : 0.9,
    maxTokens,
    fallback,
  });

  const markdownNormalizedText = normalizeStoryText(stripPromptLikeParagraphs(extractScriptFromText(markdownResult.text || fallback) || fallback));
  return {
    text: options.returnOnlySegment
      ? markdownNormalizedText
      : applyRangeFit
        ? fitScriptToCharacterRange(ensureParagraphVideoScript(markdownNormalizedText || fallback, options) || fallback, options)
        : normalizeStoryText(markdownNormalizedText || fallback),
    source: markdownResult.source,
    analysis: null,
  };
  const bundle = getPromptRegistry(options.contentType);
  const currentDraftContext = options.continuityContext?.trim() || options.currentScript || 'None';
  const requestPayload = await translatePromptToEnglish(
    `Content type: ${options.contentType}
Topic: ${options.topic || 'Auto-generated'}
Genre: ${options.selections.genre}
Mood: ${options.selections.mood}
Setting: ${options.selections.setting}
Lead: ${options.selections.protagonist}
Conflict: ${options.selections.conflict}
Ending tone: ${options.selections.endingTone}

Prompt template: ${options.template.name}
Prompt description: ${options.template.description}
Generation task: ${buildGenerationIntentGuide(options)}
Concept lock guide: ${buildConceptLockGuide(options)}
Paragraph structure guide: ${buildParagraphCountGuide(options)}
Output format reminder: ${buildOutputFormatReminder(options)}
Expected duration: ${options.customSettings?.expectedDurationMinutes || 1} minutes
Preferred speech style: ${formatSpeechStyleEnglish(options.customSettings?.speechStyle)}
Script language: ${formatScriptLanguageEnglish(options.customSettings?.language)}
Character range guide: ${buildCharacterRangeGuide(options)}
TTS only rule: ${getTtsOnlyRule(options.contentType)}
Fresh take rule: ${buildFreshTakeGuide(options)}
Silent mode rule: ${options.customSettings?.language === 'mute' ? 'Do not write spoken dialogue or narration. Build the script around visual beats, actions, and short on-screen captions.' : 'Use normal spoken or narrated script flow.'}
Reference notes: ${options.customSettings?.referenceText?.trim() || 'None'}

[VOICE ONLY SAMPLE]
${buildVoiceOnlySample(options.contentType, options.topic, options.selections)}

[CREATIVE VARIANCE]
${buildCreativePayload(options)}

[SELECTED PROMPT]
${options.template.prompt}

[CURRENT DRAFT CONTEXT]
${currentDraftContext}

[TRANSLATION RULE]
${bundle.translateRule}`,
    { label: 'script composer request', preserveLineBreaks: true, maxChars: 12000 },
  );

  const additionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 10);
  const mergedPayload = additionBlock.length
    ? `${requestPayload}

[ADDITIONAL GUIDANCE PHRASES]
${additionBlock.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : requestPayload;

  const result = await runTextAi({
    system: `${bundle.system} Step 1 콘셉트 고정 규칙을 끝까지 유지하고, 선택된 프롬프트의 출력 형식과 예시를 우선 규칙으로 따른다. 최종 출력에는 목표, 주제, 장르, 메모 같은 메타 문구를 섞지 말고, 현재 초안이 있으면 지우지 말고 이어서 확장한다. 뮤직비디오면 가사만 쓰고 줄거리 설명이나 상황 해설을 금지한다. 그 외 유형은 실제로 읽을 대본 본문만 쓰고 제작 지시문이나 화면 설명서를 금지한다. 사용자가 비슷한 결과를 직접 원하지 않는 한 방금 전 시도와 비슷한 문장, 후킹 방식, 이미지 은유, 장면 배치를 반복하지 않는다. When continuation-segment guidance is present, output only the newly added continuation paragraphs and do not rewrite earlier paragraphs.`,
    user: mergedPayload,
    model: options.model || options.customSettings?.scriptModel || 'openrouter/auto',
    temperature: options.conversationMode || options.template.mode === 'dialogue' ? 0.98 : 0.9,
    maxTokens,
    fallback,
  });

  const normalizedText = normalizeStoryText(stripPromptLikeParagraphs(extractScriptFromText(result.text || fallback) || fallback));
  return {
    text: options.returnOnlySegment
      ? normalizedText
      : applyRangeFit
        ? fitScriptToCharacterRange(ensureParagraphVideoScript(normalizedText || fallback, options) || fallback, options)
        : normalizeStoryText(normalizedText || fallback),
    source: result.source,
    analysis: null,
  };
}

async function extendScriptWithSegments(options: ScriptComposerOptions, initialText: string, source: 'ai' | 'sample') {
  const plan = resolveScriptSegmentGoal(options, initialText);
  if (!plan) {
    emitScriptProgress(options, 88, 'Finalizing script length and paragraph flow.');
    return {
      text: fitScriptToCharacterRange(ensureParagraphVideoScript(initialText, options) || initialText, options),
      source,
    };
  }

  let workingText = normalizeStoryText(initialText);
  let effectiveSource: 'ai' | 'sample' = source;

  for (let index = 0; index < plan.segmentCount; index += 1) {
    if (countScriptCharacters(workingText) >= plan.desiredTotal) break;
    const segmentStart = 46 + Math.round((index / Math.max(1, plan.segmentCount)) * 36);
    emitScriptProgress(options, segmentStart, `Extending script flow ${index + 1}/${plan.segmentCount}.`);

    const targetChars = plan.segments[index];
    const segmentFallback = extractUniqueContinuationParagraphs(
      workingText,
      createExpansionFallback({
        ...options,
        currentScript: workingText,
        generationIntent: 'expand',
        expandByChars: targetChars,
      }),
    ).join('\n\n') || trimScriptToMax(buildLengthPaddingParagraphs(options)[index % Math.max(1, buildLengthPaddingParagraphs(options).length)] || '', targetChars + 80);

    const segmentResult = await requestPlainScriptDraft({
      ...options,
      currentScript: '',
      continuityContext: buildCompactScriptContext(workingText),
      generationIntent: 'expand',
      expandByChars: targetChars,
      returnOnlySegment: true,
      promptAdditions: [
        ...(options.promptAdditions || []),
        ...buildContinuationPromptAdditions(options, workingText, index, plan.segmentCount, targetChars),
      ],
    }, normalizeStoryText(segmentFallback), 1500);

    workingText = mergeContinuationScript(workingText, segmentResult.text || segmentFallback);
    if (segmentResult.source === 'ai') effectiveSource = 'ai';
    emitScriptProgress(
      options,
      segmentStart + Math.max(8, Math.round(36 / Math.max(1, plan.segmentCount))),
      `Segment ${index + 1} applied. Keeping the story connected.`,
    );
  }

  emitScriptProgress(options, 90, 'Polishing the final script output.');
  return {
    text: fitScriptToCharacterRange(ensureParagraphVideoScript(workingText, options) || workingText, options),
    source: effectiveSource,
  };
}


function createEmergencySampleScript(options: ScriptComposerOptions) {
  const fallback = createFallback(options);
  const paragraphReady = fitScriptToCharacterRange(ensureParagraphVideoScript(fallback, options), options);
  if ((paragraphReady || '').trim()) return paragraphReady;

  const voiceOnly = fitScriptToCharacterRange(
    ensureParagraphVideoScript(buildVoiceOnlySample(options.contentType, options.topic, options.selections), options),
    options,
  );
  if ((voiceOnly || '').trim()) return voiceOnly;

  return formatStoryTextForEditor([
    `${options.topic || '이번 이야기'}는 지금부터 바로 시작됩니다.`,
    `${options.selections.protagonist || '주인공'}은 ${options.selections.setting || '익숙한 공간'}에서 ${options.selections.conflict || '남겨 둔 문제'}와 마주합니다.`,
    `${options.selections.mood || '몰입감 있는'} 흐름으로 장면을 밀고 가며, 끝에는 ${options.selections.endingTone || '여운'}을 남깁니다.`,
  ].join('\n\n'));
}

export function buildSampleScriptDraft(options: ScriptComposerOptions): string {
  const selectedModel = options.customSettings?.scriptModel || options.model || '';
  if (selectedModel === NO_AI_SCRIPT_MODEL_ID) {
    return createNoAiModelSampleScript(options);
  }
  return createEmergencySampleScript(options);
}

export async function composeScriptDraft(options: ScriptComposerOptions): Promise<ScriptComposerResult> {
  const selectedModel = options.customSettings?.scriptModel || options.model || '';
  if (selectedModel === NO_AI_SCRIPT_MODEL_ID) {
    emitScriptProgress(options, 100, 'Sample script is ready.');
    return {
      text: buildSampleScriptDraft(options),
      source: 'sample',
      analysis: options.template.engine === 'channel_constitution_v32'
        ? buildConstitutionFallbackAnalysis(options, 'sample')
        : null,
    };
  }

  const fallback = createEmergencySampleScript(options);
  const fallbackAnalysis = options.template.engine === 'channel_constitution_v32'
    ? buildConstitutionFallbackAnalysis(options, 'sample')
    : null;

  try {
    emitScriptProgress(options, 8, 'Preparing the script request.');
    if (options.template.engine === 'channel_constitution_v32') {
      emitScriptProgress(options, 18, 'Analyzing script direction and channel structure.');
      const result = await runTextAi({
        system: '당신은 유튜브 쇼츠 채널 헌법을 집행하는 분석형 대본 작성자다. 내부적으로 검증과 타겟팅을 수행하되 최종 출력은 JSON 객체 하나만 반환한다. 입력에 없는 사실은 추정하지 않는다. 사용자가 비슷한 결과를 직접 요구하지 않는 한 최근 결과를 답습하지 말고 매번 새 관점과 새 전개를 만든다.',
        user: buildConstitutionUserPayload(options),
        model: options.model || options.customSettings?.scriptModel || 'openrouter/auto',
        maxTokens: 2600,
        temperature: 0.72,
        fallback: JSON.stringify({
          targetProfile: fallbackAnalysis?.targetProfile,
          safetyReview: fallbackAnalysis?.safetyReview,
          monetizationReview: fallbackAnalysis?.monetizationReview,
          selectedStructure: fallbackAnalysis?.selectedStructure,
          titles: fallbackAnalysis?.titles,
          keywords: fallbackAnalysis?.keywords,
          script: fallback,
        }, null, 2),
      });

      const parsed = parseConstitutionResponse(
        result.text || fallback,
        fallback,
        fallbackAnalysis || buildConstitutionFallbackAnalysis(options, result.source),
        result.source,
        options,
      );
      emitScriptProgress(options, 42, 'First draft received. Keeping the story flow connected.');
      const extended = await extendScriptWithSegments(options, parsed.text || fallback, result.source);
      emitScriptProgress(options, 100, 'Script generation completed.');
      return {
        ...extended,
        analysis: parsed.analysis,
      };
    }

    emitScriptProgress(options, 20, 'Generating the first draft.');
    const initialResult = await requestPlainScriptDraft(options, fallback, 2200, false);
    emitScriptProgress(options, 44, 'Draft received. Extending the script with consistent flow.');
    const extendedResult = await extendScriptWithSegments(options, initialResult.text || fallback, initialResult.source);
    emitScriptProgress(options, 100, 'Script generation completed.');
    return {
      ...extendedResult,
      analysis: null,
    };
  } catch {
    emitScriptProgress(options, 100, 'AI drafting failed, so the sample script was prepared instead.');
    return {
      text: fallback,
      source: 'sample',
      analysis: fallbackAnalysis,
    };
  }
}
