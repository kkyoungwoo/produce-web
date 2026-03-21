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
import { buildSelectableStoryDraft, normalizeStoryText } from '../utils/storyHelpers';
import { runTextAi } from './textAiService';
import { getPromptRegistry } from './promptRegistryService';

interface ScriptComposerOptions {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  template: WorkflowPromptTemplate;
  currentScript?: string;
  promptAdditions?: string[];
  model?: string;
  conversationMode?: boolean;
  customSettings?: CustomScriptSettings;
  generationIntent?: 'draft' | 'expand';
  expandByChars?: number;
}

export interface ScriptComposerResult {
  text: string;
  source: 'ai' | 'sample';
  analysis?: ConstitutionAnalysisSummary | null;
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
  return normalizeStoryText(`Scene 1
오프닝 장면: ${topic || '이 이야기'}의 핵심 분위기를 ${selections.setting}에서 바로 보여준다.
화면 자막: ${selections.conflict}
연출 포인트: ${selections.mood} 톤으로 시선을 붙잡는다.

Scene 2
전개 장면: 주인공 ${selections.protagonist}의 행동과 표정으로 갈등을 이어 간다.
화면 자막: 상황이 더 선명해지는 한 줄 메시지
연출 포인트: 설명보다 장면 전환과 소품으로 정보를 전달한다.

Scene 3
엔딩 장면: ${selections.endingTone} 톤으로 마무리한다.
화면 자막: 마지막 한 줄 행동 유도 또는 여운
연출 포인트: 내레이션 없이도 이해되게 컷과 자막만 정리한다.`);
}

function createDialogueFallback(topic: string, selections: StorySelectionState, style: ScriptSpeechStyle) {
  const speechStyle = resolveSpeechStyle(style);
  if (speechStyle === 'da') {
    return normalizeStoryText(`Scene 1
${selections.protagonist}: ${topic || '이 이야기'}는 오늘 밤 시작된다.
상대: 왜 지금이어야 하지?
${selections.protagonist}: ${selections.conflict}는 더는 미룰 수 없기 때문이다.

Scene 2
상대: 그러면 어떤 분위기로 가는 건가?
${selections.protagonist}: ${selections.mood} 분위기다. 배경은 ${selections.setting}이다.
상대: 결말은?
${selections.protagonist}: ${selections.endingTone}으로 간다.`);
  }

  if (speechStyle === 'eum') {
    return normalizeStoryText(`Scene 1
${selections.protagonist}: ${topic || '이 이야기'} 오늘 밤 시작함.
상대: 왜 지금임?
${selections.protagonist}: ${selections.conflict} 더는 못 미룸.

Scene 2
상대: 분위기 어떰?
${selections.protagonist}: ${selections.mood} 분위기감. 배경 ${selections.setting}.
상대: 결말은?
${selections.protagonist}: ${selections.endingTone}으로 끝냄.`);
  }

  if (speechStyle === 'yo') {
    return normalizeStoryText(`Scene 1
${selections.protagonist}: ${topic || '이 이야기'}는 오늘 밤 시작돼요.
상대: 왜 지금이어야 하죠?
${selections.protagonist}: ${selections.conflict}는 더는 미룰 수 없으니까요.

Scene 2
상대: 그럼 어떤 분위기로 가나요?
${selections.protagonist}: ${selections.mood} 분위기로 가요. 배경은 ${selections.setting}이에요.
상대: 결말은요?
${selections.protagonist}: ${selections.endingTone}으로 마무리해요.`);
  }

  return normalizeStoryText(`Scene 1
${selections.protagonist}: ${topic || '이 이야기'}는 오늘 밤 시작된다.
상대: 왜 지금이어야 해?
${selections.protagonist}: ${selections.conflict}는 더는 미룰 수 없어.

Scene 2
상대: 그럼 어떤 분위기로 가는 거야?
${selections.protagonist}: ${selections.mood} 분위기로 간다. 배경은 ${selections.setting}이야.
상대: 결말은?
${selections.protagonist}: ${selections.endingTone}으로 마무리한다.`);
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(1, Math.min(30, Math.round(minutes || 1)));
  return `${safeMinutes} minute${safeMinutes > 1 ? 's' : ''}`;
}


function resolveExpandByChars(options: ScriptComposerOptions) {
  return Math.max(300, Math.min(4000, Math.round(options.expandByChars || 800)));
}

function buildGenerationIntentGuide(options: ScriptComposerOptions) {
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
  if (options.contentType === 'music_video') {
    return [
      '출력 형식: [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro] 중 필요한 블록을 사용한다.',
      '각 블록 안에는 실제 가사 줄을 2~4줄 배치한다.',
      '설명문이나 해설문 대신 가사만 쓴다.',
    ].join(' ');
  }

  if (options.contentType === 'info_delivery') {
    return '출력 형식: 문단형 정보 전달 대본으로 쓰고 첫 문단은 핵심 질문, 중간은 설명 블록, 마지막은 요약과 다음 행동으로 끝낸다.';
  }

  if (options.contentType === 'news') {
    return '출력 형식: 장면이 보이는 영화형 문단 대본으로 쓰고 각 문단이 하나의 시네마틱 장면처럼 읽히게 한다.';
  }

  return '출력 형식: 감정과 사건이 이어지는 이야기형 문단 대본으로 쓴다.';
}

function createMusicVideoExpansionFallback(options: ScriptComposerOptions) {
  const topic = options.topic || '이 노래';
  const lead = options.selections.protagonist || '화자';
  const conflict = options.selections.conflict || '남겨 둔 마음';
  const mood = options.selections.mood || '짙은';
  const endingTone = options.selections.endingTone || '여운 있는 마감';
  const target = resolveExpandByChars(options);
  const extraBlocks = [
    `[Bridge]
${lead}의 숨 위로 ${mood} 불빛이 더 크게 번져
끝내 숨겨 둔 ${conflict}마저 멜로디로 흘러와
돌아갈 수 없는 마음도 오늘은 후렴이 되고
멈춘 장면 같던 밤이 다시 앞으로 걸어가`,
    `[Chorus]
나는 너를 더 크게 불러, 이번엔 나를 먼저 불러
사라진 줄 알았던 떨림을 끝까지 살려
대답 없는 새벽이어도 이 노래는 계속돼
${topic}의 마지막 줄까지 전부 안고 갈게`,
    `[Outro]
${endingTone} 공기 속에서도 나는 천천히 웃어
남겨 둔 한마디까지 오늘의 노래로 남겨`,
  ];
  const blockCount = target >= 1800 ? 3 : target >= 900 ? 2 : 1;
  return normalizeStoryText([options.currentScript?.trim() || '', ...extraBlocks.slice(0, blockCount)].filter(Boolean).join('\n\n'));
}

function createNarrativeExpansionFallback(options: ScriptComposerOptions) {
  const topic = options.topic || '이번 이야기';
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
        `${setting}의 공기는 조금씩 달라지고, ${lead}은 방금 지나간 장면이 끝이 아니라는 사실을 뒤늦게 알아챈다. ${conflict}은 아직 해결되지 않았고, 오히려 더 또렷한 표정으로 눈앞에 돌아온다.`,
        `${lead}은 이번에는 도망치지 않기로 한다. 사소해 보였던 말과 움직임이 하나씩 이어지면서 ${topic}의 진짜 무게가 드러나고, ${mood} 결의가 다음 선택을 밀어 올린다.`,
        `결국 마지막 장면은 이전보다 한 걸음 더 나아간 자리에서 멈춘다. 모든 것이 끝난 것은 아니지만, ${lead}은 ${endingTone} 공기 속에서 분명히 다른 얼굴로 다음 장면을 맞는다.`,
      ];
  const paragraphCount = target >= 1800 ? 3 : target >= 900 ? 2 : 1;
  return normalizeStoryText([options.currentScript?.trim() || '', ...extras.slice(0, paragraphCount)].filter(Boolean).join('\n\n'));
}

function createExpansionFallback(options: ScriptComposerOptions) {
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
  const targetParagraphCount = Math.max(3, Math.min(36, Math.round((settings.expectedDurationMinutes || 1) * 1.2)));
  const cloned = [...paragraphs];
  const variationSuffixes = [
    '도입은 조금 더 빠르게 전개한다.',
    '중간 전환은 사례 중심으로 정리한다.',
    '마무리는 행동 유도 한 줄로 정리한다.',
    '감정 흐름이 자연스럽게 상승하도록 유지한다.',
  ];
  while (cloned.length < targetParagraphCount && paragraphs.length) {
    cloned.push(paragraphs[(cloned.length - 1) % paragraphs.length]);
  }
  const guide = buildLocalizedGuide(options);
  const body = cloned.slice(0, targetParagraphCount);
  const variation = variationSuffixes[Math.floor(Math.random() * variationSuffixes.length)];
  return normalizeStoryText([...guide, ...body, variation].filter(Boolean).join('\n\n'));
}

function createFallback(options: ScriptComposerOptions) {
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
            buildSelectableStoryDraft({
              contentType: options.contentType,
              topic: options.topic,
              ...options.selections,
            })
        );

  return applyCustomFallback(baseText, options);
}

function buildConstitutionFallbackAnalysis(options: ScriptComposerOptions, source: 'ai' | 'sample'): ConstitutionAnalysisSummary {
  const mood = options.selections.mood || '몰입형';
  const topic = options.topic || '이번 프로젝트';
  const targetName = options.contentType === 'news'
    ? '2030 시네마 몰입형'
    : options.contentType === 'info_delivery'
      ? '2030 실전 학습형'
      : '2030 호기심 몰입형';
  const structureId = options.contentType === 'news' ? '005' : options.contentType === 'info_delivery' ? '010' : '005';
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
  const cleaned = raw.replace(/\r/g, '').trim();
  if (!cleaned) return '';

  const explicitParagraphs = cleaned
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicitParagraphs.length >= 3) {
    return normalizeStoryText(explicitParagraphs.join('\n\n'));
  }

  const lines = cleaned
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  if (lines.length >= 3) {
    const grouped: string[] = [];
    let bucket: string[] = [];
    lines.forEach((line, index) => {
      const heading = isVideoSectionHeading(line);
      if (heading && bucket.length) {
        grouped.push(bucket.join('\n'));
        bucket = [];
      }
      bucket.push(line);
      const nextLine = lines[index + 1] || '';
      if (!nextLine) return;
      if (isVideoSectionHeading(nextLine)) {
        grouped.push(bucket.join('\n'));
        bucket = [];
        return;
      }
      if (!heading && bucket.length >= 3) {
        grouped.push(bucket.join('\n'));
        bucket = [];
      }
    });
    if (bucket.length) grouped.push(bucket.join('\n'));
    if (grouped.length >= 3) {
      return normalizeStoryText(grouped.join('\n\n'));
    }
  }

  const fallbackTarget = Math.max(3, Math.min(12, Math.round((options.customSettings?.expectedDurationMinutes || 3) * 1.2)));
  return normalizeStoryText(chunkSentencesForVideoScript(cleaned, fallbackTarget).join('\n\n'));
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

function buildConstitutionUserPayload(options: ScriptComposerOptions) {
  const additionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 8);
  return [
    `콘텐츠 유형: ${options.contentType}`,
    `주제: ${options.topic || '자동 생성 주제'}`,
    `장르: ${options.selections.genre}`,
    `분위기: ${options.selections.mood}`,
    `배경: ${options.selections.setting}`,
    `주인공/화자: ${options.selections.protagonist}`,
    `핵심 갈등: ${options.selections.conflict}`,
    `결말 톤: ${options.selections.endingTone}`,
    `예상 길이: ${Math.max(1, Math.min(30, options.customSettings?.expectedDurationMinutes || 3))}분`,
    `대본 언어: ${formatScriptLanguageLabel(options.customSettings?.language)}`,
    `선호 말투: ${formatSpeechStyleLabel(options.customSettings?.speechStyle)}`,
    `생성 작업: ${buildGenerationIntentGuide(options)}`,
    `출력 형식: ${buildOutputFormatReminder(options)}`,
    `현재 초안: ${options.currentScript?.trim() || '없음'}`,
    `참고 텍스트: ${options.customSettings?.referenceText?.trim() || '없음'}`,
    additionBlock.length ? `[추가 가이드]\n${additionBlock.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    '',
    '[선택된 프롬프트]',
    options.template.prompt,
  ].filter(Boolean).join('\n\n');
}

export async function composeScriptDraft(options: ScriptComposerOptions): Promise<ScriptComposerResult> {
  const fallback = createFallback(options);
  const fallbackAnalysis = options.template.engine === 'channel_constitution_v32'
    ? buildConstitutionFallbackAnalysis(options, 'sample')
    : null;
  const bundle = getPromptRegistry(options.contentType);

  if (options.template.engine === 'channel_constitution_v32') {
    const result = await runTextAi({
      system: '당신은 유튜브 쇼츠 채널 헌법을 집행하는 분석형 대본 작성자다. 내부적으로 검증과 타겟팅을 수행하되 최종 출력은 JSON 객체 하나만 반환한다. 입력에 없는 사실은 추정하지 않는다.',
      user: buildConstitutionUserPayload(options),
      model: options.model || options.customSettings?.scriptModel || 'openrouter/auto',
      maxTokens: 2600,
      temperature: 0.55,
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

    const parsed = parseConstitutionResponse(result.text || fallback, fallback, fallbackAnalysis || buildConstitutionFallbackAnalysis(options, result.source), result.source, options);
    return {
      text: parsed.text,
      source: result.source,
      analysis: parsed.analysis,
    };
  }

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
Output format reminder: ${buildOutputFormatReminder(options)}
Expected duration: ${options.customSettings?.expectedDurationMinutes || 3} minutes
Preferred speech style: ${formatSpeechStyleEnglish(options.customSettings?.speechStyle)}
Script language: ${formatScriptLanguageEnglish(options.customSettings?.language)}
Silent mode rule: ${options.customSettings?.language === 'mute' ? 'Do not write spoken dialogue or narration. Build the script around visual beats, actions, and short on-screen captions.' : 'Use normal spoken or narrated script flow.'}
Reference notes: ${options.customSettings?.referenceText?.trim() || 'None'}

[SELECTED PROMPT]
${options.template.prompt}

[CURRENT DRAFT]
${options.currentScript || 'None'}

[TRANSLATION RULE]
${bundle.translateRule}`,
    { label: 'script composer request', preserveLineBreaks: true, maxChars: 12000 }
  );

  const additionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 8);
  const mergedPayload = additionBlock.length
    ? `${requestPayload}

[ADDITIONAL GUIDANCE PHRASES]
${additionBlock.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : requestPayload;

  const result = await runTextAi({
    system: `${bundle.system} 선택된 프롬프트의 출력 형식과 예시를 우선 규칙으로 따르고, 현재 초안이 있으면 지우지 말고 이어서 확장한다.`,
    user: mergedPayload,
    model: options.model || options.customSettings?.scriptModel || 'openrouter/auto',
    temperature: options.conversationMode || options.template.mode === 'dialogue' ? 0.9 : 0.76,
    fallback,
  });

  return {
    text: ensureParagraphVideoScript(result.text || fallback, options),
    source: result.source,
    analysis: null,
  };
}
