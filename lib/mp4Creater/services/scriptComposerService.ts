import {
  ConstitutionAnalysisSummary,
  ContentType,
  CustomScriptSettings,
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
  if (style === 'random') {
    return Math.random() > 0.5 ? 'yo' : 'da';
  }
  return style === 'da' ? 'da' : 'yo';
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

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(1, Math.min(16, Math.round(minutes || 1)));
  return `${safeMinutes} minute${safeMinutes > 1 ? 's' : ''}`;
}

function buildLocalizedGuide(options: ScriptComposerOptions) {
  const settings = options.customSettings;
  if (!settings) return [] as string[];

  const duration = Math.max(1, Math.min(16, Math.round(settings.expectedDurationMinutes || 1)));
  const topic = options.topic || 'Auto-generated topic';
  const reference = settings.referenceText?.trim();
  const speechStyle = resolveSpeechStyle(settings.speechStyle);
  const languageGuides: Record<CustomScriptSettings['language'], string[]> = {
    ko: [
      `이 대본은 약 ${duration}분 분량을 목표로 합니다. 주제는 ${topic}이고 분위기는 ${options.selections.mood}, 배경은 ${options.selections.setting}입니다.`,
      `말투는 ${speechStyle === 'da' ? '다체' : '요체'}를 유지합니다.`,
      reference ? `참고 내용은 ${reference}${speechStyle === 'da' ? '를 반영한다.' : '를 반영해 주세요.'}` : '',
    ],
    en: [
      `This script targets about ${formatDuration(duration)}. The topic is ${topic}, with a ${options.selections.mood} mood in ${options.selections.setting}.`,
      `Keep the speech style ${speechStyle === 'da' ? 'declarative' : 'polite conversational'}.`,
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
  const targetParagraphCount = Math.max(3, Math.min(12, Math.round((settings.expectedDurationMinutes || 1) * 1.2)));
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
  const baseText = options.conversationMode || options.template.mode === 'dialogue'
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
    ? '2030 브리핑 실속형'
    : options.contentType === 'info_delivery'
      ? '2030 실전 학습형'
      : '2030 호기심 몰입형';
  const structureId = options.contentType === 'news' ? '002' : options.contentType === 'info_delivery' ? '010' : '005';
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
  source: 'ai' | 'sample'
): { text: string; analysis: ConstitutionAnalysisSummary } {
  const parsed = parseJsonObject(raw);

  if (!parsed || typeof parsed !== 'object') {
    return {
      text: extractScriptFromText(raw || fallbackScript),
      analysis: {
        ...fallbackAnalysis,
        source,
        updatedAt: Date.now(),
      },
    };
  }

  const record = parsed as Record<string, unknown>;
  const script = typeof record.script === 'string' && record.script.trim()
    ? normalizeStoryText(record.script)
    : extractScriptFromText(raw || fallbackScript);

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

  return { text: script || fallbackScript, analysis };
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
    `예상 길이: ${options.customSettings?.expectedDurationMinutes || 3}분`,
    `대본 언어: ${options.customSettings?.language || 'ko'}`,
    `선호 말투: ${resolveSpeechStyle(options.customSettings?.speechStyle) === 'da' ? '다체' : '요체'}`,
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
  const resolvedSpeechStyle = resolveSpeechStyle(options.customSettings?.speechStyle);

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

    const parsed = parseConstitutionResponse(result.text || fallback, fallback, fallbackAnalysis || buildConstitutionFallbackAnalysis(options, result.source), result.source);
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
Preferred speech style: ${resolvedSpeechStyle === 'da' ? 'Declarative Korean ending (다체)' : 'Polite Korean ending (요체)'}
Script language: ${options.customSettings?.language || 'ko'}
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
    text: normalizeStoryText(result.text || fallback),
    source: result.source,
    analysis: null,
  };
}
