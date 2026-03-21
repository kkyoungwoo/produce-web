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
    system: bundle.system,
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
