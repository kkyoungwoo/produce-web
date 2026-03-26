import {
  ContentType,
  GeneratedAsset,
  ScriptLanguageOption,
  ScriptSpeechStyle,
  WorkflowDraft,
  WorkflowPromptStore,
  WorkflowRolePromptBundle,
  WorkflowRolePromptStore,
  WorkflowScriptGenerationMeta,
  WorkflowStepContract,
} from '../types';
import { createLightweightSceneAssetsFromDraft } from './sceneAssemblyService';
import { DEFAULT_SELECTIONS } from './workflowDraftService';
import { splitStoryIntoParagraphScenes } from '../utils/storyHelpers';
import { buildBackgroundMusicPromptSections, combineBackgroundMusicPromptSections } from './musicService';

export const SCRIPT_CHARS_PER_MINUTE_BY_CONTENT_TYPE: Record<ContentType, number> = {
  music_video: 190,
  story: 300,
  cinematic: 160,
  info_delivery: 555,
};

function normalizeDurationMinutes(value?: number | null) {
  return Math.max(1, Math.min(30, Math.round(Number(value || 1))));
}

function normalizeParagraphRecommendation(contentType: ContentType, minutes: number) {
  const safeMinutes = normalizeDurationMinutes(minutes);
  if (contentType === 'music_video') return Math.max(4, Math.min(24, safeMinutes * 4));
  if (contentType === 'info_delivery') return Math.max(3, Math.min(18, Math.round(safeMinutes * 1.5)));
  if (contentType === 'cinematic') return Math.max(3, Math.min(15, Math.round(safeMinutes * 1.2)));
  return Math.max(3, Math.min(15, Math.round(safeMinutes * 1.3)));
}

function countScenesFromScript(script: string) {
  const scenes = splitStoryIntoParagraphScenes(script || '');
  return scenes.length;
}

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function getSafeSelections(draft: WorkflowDraft) {
  const fallback = DEFAULT_SELECTIONS[draft.contentType] || DEFAULT_SELECTIONS.story;
  return {
    genre: normalizeText(draft.selections?.genre) || fallback.genre || '',
    mood: normalizeText(draft.selections?.mood) || fallback.mood || '',
    endingTone: normalizeText(draft.selections?.endingTone) || fallback.endingTone || '',
    setting: normalizeText(draft.selections?.setting) || fallback.setting || '',
    protagonist: normalizeText(draft.selections?.protagonist) || fallback.protagonist || '',
    conflict: normalizeText(draft.selections?.conflict) || fallback.conflict || '',
  };
}

function joinUniqueBlocks(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .flatMap((value) => (value || '').split(/\n\s*\n/g).map((block) => block.trim()).filter(Boolean))
    .filter((block) => {
      const key = block.replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n\n');
}

function resolveSelectedTemplate(draft: WorkflowDraft) {
  return (draft.promptTemplates || []).find((item) => item.id === draft.selectedPromptTemplateId)
    || (draft.promptTemplates || [])[0]
    || null;
}

function resolveSelectedStyle(draft: WorkflowDraft) {
  return (draft.styleImages || []).find((item) => item.id === draft.selectedStyleImageId)
    || (draft.styleImages || [])[0]
    || null;
}

function resolveSelectedCharacters(draft: WorkflowDraft) {
  const selectedIds = Array.isArray(draft.selectedCharacterIds) && draft.selectedCharacterIds.length
    ? draft.selectedCharacterIds
    : (draft.extractedCharacters || []).map((item) => item.id);
  return (draft.extractedCharacters || []).filter((item) => selectedIds.includes(item.id));
}

function inferCastType(draft: WorkflowDraft) {
  const selectedTemplate = resolveSelectedTemplate(draft);
  const selectedCharacters = resolveSelectedCharacters(draft);
  if (selectedTemplate?.mode === 'dialogue') return selectedCharacters.length > 1 ? 'dialogue-multi' : 'dialogue-single';
  if (!selectedCharacters.length) return 'narration-only';
  if (selectedCharacters.length === 1) return 'single-cast';
  return 'multi-cast';
}

function trimResultHint(value?: string | null, max = 320) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function pickUniqueStepSources(steps: string[]) {
  return Array.from(new Set(steps.filter(Boolean)));
}

function buildRoleBundle(options: {
  label: string;
  stepSources: string[];
  basePrompt?: string | null;
  finalPrompt?: string | null;
  resultHint?: string | null;
  sections?: Record<string, string> | null;
}): WorkflowRolePromptBundle {
  const safeSections = options.sections
    ? Object.fromEntries(
      Object.entries(options.sections)
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => [key, value.trim()])
    )
    : null;

  return {
    label: options.label,
    stepSources: pickUniqueStepSources(options.stepSources),
    basePrompt: normalizeText(options.basePrompt),
    finalPrompt: normalizeText(options.finalPrompt),
    resultHint: trimResultHint(options.resultHint),
    sections: safeSections && Object.keys(safeSections).length ? safeSections : null,
  };
}

function buildThumbnailRolePrompt(options: {
  draft: WorkflowDraft;
  assets: GeneratedAsset[];
  safeSelections: ReturnType<typeof getSafeSelections>;
  selectedCharacters: ReturnType<typeof resolveSelectedCharacters>;
  selectedStyle: ReturnType<typeof resolveSelectedStyle>;
  finalScript: string;
  thumbnailPrompt?: string | null;
}) {
  const { draft, assets, safeSelections, selectedCharacters, selectedStyle, finalScript, thumbnailPrompt } = options;
  const sceneSummary = assets
    .slice(0, 3)
    .map((asset) => normalizeText(asset.narration || asset.imagePrompt || asset.visualPrompt))
    .filter(Boolean)
    .join(' / ');
  const selectedCharacterSummary = selectedCharacters
    .slice(0, 3)
    .map((character) => normalizeText(character.name || character.description || character.prompt))
    .filter(Boolean)
    .join(', ');

  return joinUniqueBlocks([
    thumbnailPrompt,
    `썸네일은 Step1 ${draft.contentType || 'story'} 형식과 ${draft.aspectRatio || '16:9'} 비율을 대표하는 최종 대표 컷으로 구성한다.`,
    draft.topic ? `Step2 주제는 ${draft.topic}이며 분위기 ${safeSelections.mood}, 배경 ${safeSelections.setting}, 감정 축 ${safeSelections.conflict}를 유지한다.` : '',
    finalScript ? `Step3 핵심 감정과 대본 흐름은 ${trimResultHint(finalScript, 220) || ''}` : '',
    selectedCharacterSummary ? `Step4 캐릭터 기준은 ${selectedCharacterSummary}이다.` : '',
    selectedStyle?.prompt ? `Step5 스타일 기준은 ${selectedStyle.prompt}` : '',
    sceneSummary ? `Step6 실제 장면 기준은 ${sceneSummary}다.` : '',
  ]);
}

function buildRolePromptStore(options: {
  draft: WorkflowDraft;
  assets: GeneratedAsset[];
  selectedTemplate: ReturnType<typeof resolveSelectedTemplate>;
  selectedStyle: ReturnType<typeof resolveSelectedStyle>;
  selectedCharacters: ReturnType<typeof resolveSelectedCharacters>;
  safeSelections: ReturnType<typeof getSafeSelections>;
  finalScript: string;
  finalImagePrompt: string;
  finalVideoPrompt: string;
  projectPrompts?: {
    scriptPrompt?: string | null;
    scenePrompt?: string | null;
    imagePrompt?: string | null;
    videoPrompt?: string | null;
    motionPrompt?: string | null;
    thumbnailPrompt?: string | null;
  } | null;
}): WorkflowRolePromptStore {
  const {
    draft,
    assets,
    selectedTemplate,
    selectedStyle,
    selectedCharacters,
    safeSelections,
    finalScript,
    finalImagePrompt,
    finalVideoPrompt,
    projectPrompts,
  } = options;
  const bgmSections = buildBackgroundMusicPromptSections(draft, draft.backgroundMusicScene?.promptSections || null);
  const bgmSectionMap: Record<string, string> = {
    identity: bgmSections.identity,
    mood: bgmSections.mood,
    instruments: bgmSections.instruments,
    performance: bgmSections.performance,
    production: bgmSections.production,
  };
  const backgroundMusicPrompt = normalizeText(
    draft.backgroundMusicScene?.prompt
    || combineBackgroundMusicPromptSections(bgmSections, draft.backgroundMusicScene?.durationSeconds || 20)
  );
  const characterFinalPrompt = joinUniqueBlocks([
    draft.promptPack?.characterPrompt,
    draft.selectedCharacterStylePrompt,
    ...selectedCharacters.map((character) => normalizeText(character.prompt || character.description || '')),
  ]);
  const styleFinalPrompt = joinUniqueBlocks([
    selectedStyle?.prompt,
    draft.selectedCharacterStylePrompt,
  ]);
  const sceneBasePrompt = joinUniqueBlocks([
    draft.promptPack?.scenePrompt,
    projectPrompts?.scenePrompt,
  ]);
  const videoBasePrompt = joinUniqueBlocks([
    draft.promptPack?.actionPrompt,
    projectPrompts?.motionPrompt,
  ]);
  const thumbnailFinalPrompt = buildThumbnailRolePrompt({
    draft,
    assets,
    safeSelections,
    selectedCharacters,
    selectedStyle,
    finalScript,
    thumbnailPrompt: projectPrompts?.thumbnailPrompt,
  });

  return {
    script: buildRoleBundle({
      label: '대본 프롬프트',
      stepSources: ['step1', 'step2', 'step3'],
      basePrompt: joinUniqueBlocks([selectedTemplate?.prompt, draft.promptPack?.storyPrompt]),
      finalPrompt: joinUniqueBlocks([projectPrompts?.scriptPrompt, draft.promptPack?.storyPrompt]),
      resultHint: finalScript,
      sections: {
        template: selectedTemplate?.prompt || '',
        story: draft.promptPack?.storyPrompt || '',
      },
    }),
    character: buildRoleBundle({
      label: '캐릭터 프롬프트',
      stepSources: ['step2', 'step3', 'step4'],
      basePrompt: draft.promptPack?.characterPrompt,
      finalPrompt: characterFinalPrompt,
      resultHint: selectedCharacters.map((character) => character.name).filter(Boolean).join(', '),
      sections: {
        character: draft.promptPack?.characterPrompt || '',
        characterStyle: draft.selectedCharacterStylePrompt || '',
      },
    }),
    style: buildRoleBundle({
      label: '스타일 프롬프트',
      stepSources: ['step1', 'step2', 'step5'],
      basePrompt: selectedStyle?.prompt || draft.selectedCharacterStylePrompt || '',
      finalPrompt: styleFinalPrompt,
      resultHint: selectedStyle?.groupLabel || selectedStyle?.label || '',
      sections: {
        selectedStyle: selectedStyle?.prompt || '',
        characterStyle: draft.selectedCharacterStylePrompt || '',
      },
    }),
    scene: buildRoleBundle({
      label: '장면 프롬프트',
      stepSources: ['step2', 'step3', 'step5', 'step6'],
      basePrompt: sceneBasePrompt,
      finalPrompt: joinUniqueBlocks([projectPrompts?.imagePrompt, finalImagePrompt]),
      resultHint: assets.map((asset) => asset.narration).filter(Boolean).slice(0, 3).join(' / '),
      sections: {
        scene: draft.promptPack?.scenePrompt || '',
        imageBundle: finalImagePrompt,
      },
    }),
    video: buildRoleBundle({
      label: '영상 프롬프트',
      stepSources: ['step3', 'step4', 'step5', 'step6'],
      basePrompt: videoBasePrompt,
      finalPrompt: joinUniqueBlocks([projectPrompts?.videoPrompt, finalVideoPrompt]),
      resultHint: assets.map((asset) => asset.videoPrompt || '').filter(Boolean).slice(0, 3).join(' / '),
      sections: {
        motion: draft.promptPack?.actionPrompt || '',
        videoBundle: finalVideoPrompt,
      },
    }),
    backgroundMusic: buildRoleBundle({
      label: '배경음 프롬프트',
      stepSources: ['step2', 'step3', 'step6'],
      basePrompt: backgroundMusicPrompt,
      finalPrompt: backgroundMusicPrompt,
      resultHint: `${safeSelections.mood} / ${safeSelections.setting}`,
      sections: bgmSectionMap,
    }),
    thumbnail: buildRoleBundle({
      label: '썸네일 프롬프트',
      stepSources: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'],
      basePrompt: projectPrompts?.thumbnailPrompt || thumbnailFinalPrompt,
      finalPrompt: thumbnailFinalPrompt,
      resultHint: assets[0]?.narration || draft.topic || '',
      sections: {
        topic: draft.topic || '',
        mood: safeSelections.mood || '',
        setting: safeSelections.setting || '',
        style: selectedStyle?.prompt || '',
      },
    }),
  };
}

export function getCharsPerMinuteByContentType(contentType: ContentType) {
  return SCRIPT_CHARS_PER_MINUTE_BY_CONTENT_TYPE[contentType] || SCRIPT_CHARS_PER_MINUTE_BY_CONTENT_TYPE.story;
}

export function getRecommendedCharacterCount(contentType: ContentType, expectedDurationMinutes?: number | null) {
  return getCharsPerMinuteByContentType(contentType) * normalizeDurationMinutes(expectedDurationMinutes);
}

export function getRecommendedParagraphCount(contentType: ContentType, expectedDurationMinutes?: number | null) {
  return normalizeParagraphRecommendation(contentType, expectedDurationMinutes || 1);
}

export function buildWorkflowInputSignature(draft: Pick<WorkflowDraft,
  'contentType'
  | 'aspectRatio'
  | 'topic'
  | 'selections'
  | 'selectedPromptTemplateId'
  | 'selectedCharacterIds'
  | 'selectedCharacterStyleId'
  | 'selectedStyleImageId'
  | 'customScriptSettings'
  | 'promptPack'
  | 'promptTemplates'
>) {
  const selectedTemplate = resolveSelectedTemplate(draft as WorkflowDraft);
  const safeSelections = getSafeSelections(draft as WorkflowDraft);
  return JSON.stringify({
    contentType: draft.contentType,
    aspectRatio: draft.aspectRatio,
    topic: normalizeText(draft.topic) || '샘플 주제',
    selections: safeSelections,
    selectedPromptTemplateId: draft.selectedPromptTemplateId || null,
    selectedPromptTemplatePrompt: selectedTemplate?.prompt || '',
    selectedCharacterIds: Array.isArray(draft.selectedCharacterIds) ? [...draft.selectedCharacterIds].sort() : [],
    selectedCharacterStyleId: draft.selectedCharacterStyleId || null,
    selectedStyleImageId: draft.selectedStyleImageId || null,
    expectedDurationMinutes: normalizeDurationMinutes(draft.customScriptSettings?.expectedDurationMinutes),
    speechStyle: draft.customScriptSettings?.speechStyle || 'default',
    language: draft.customScriptSettings?.language || 'ko',
    referenceText: draft.customScriptSettings?.referenceText || '',
    referenceLinkCount: Array.isArray(draft.customScriptSettings?.referenceLinks) ? draft.customScriptSettings.referenceLinks.length : 0,
    storyPrompt: draft.promptPack?.storyPrompt || '',
    scenePrompt: draft.promptPack?.scenePrompt || '',
    actionPrompt: draft.promptPack?.actionPrompt || '',
  });
}

export function buildWorkflowScriptGenerationMeta(options: {
  draft: WorkflowDraft;
  source: 'ai' | 'sample' | 'manual';
  intent?: 'draft' | 'expand' | 'manual';
  usedSampleFallback?: boolean;
  conversationMode?: boolean;
  generatedAt?: number;
}): WorkflowScriptGenerationMeta {
  const selectedTemplate = resolveSelectedTemplate(options.draft);
  const expectedDurationMinutes = normalizeDurationMinutes(options.draft.customScriptSettings?.expectedDurationMinutes);
  return {
    source: options.source,
    intent: options.intent || (options.source === 'manual' ? 'manual' : 'draft'),
    generatedAt: options.generatedAt || Date.now(),
    templateId: selectedTemplate?.id || null,
    templateName: selectedTemplate?.name || null,
    modelId: options.draft.customScriptSettings?.scriptModel || options.draft.openRouterModel || null,
    conversationMode: Boolean(options.conversationMode ?? (selectedTemplate?.mode === 'dialogue')),
    language: (options.draft.customScriptSettings?.language || 'ko') as ScriptLanguageOption,
    speechStyle: (options.draft.customScriptSettings?.speechStyle || 'default') as ScriptSpeechStyle,
    expectedDurationMinutes,
    recommendedCharacterCount: getRecommendedCharacterCount(options.draft.contentType, expectedDurationMinutes),
    inputSignature: buildWorkflowInputSignature(options.draft),
    usedSampleFallback: Boolean(options.usedSampleFallback ?? (options.source !== 'ai')),
  };
}

export function buildWorkflowCastAudioMap(draft: WorkflowDraft) {
  return resolveSelectedCharacters(draft).reduce<Record<string, {
    characterId: string;
    characterName: string;
    provider: string;
    voiceId: string | null;
    voiceName: string | null;
    modelId: string | null;
  }>>((acc, character) => {
    acc[character.id] = {
      characterId: character.id,
      characterName: character.name,
      provider: character.voiceProvider || draft.ttsProvider || 'project-default',
      voiceId: character.voiceId || null,
      voiceName: character.voiceName || character.voiceHint || null,
      modelId: draft.elevenLabsModelId || null,
    };
    return acc;
  }, {});
}

function createAssetsForSummary(draft: WorkflowDraft, assets?: GeneratedAsset[] | null) {
  if (Array.isArray(assets) && assets.length) return assets;
  return createLightweightSceneAssetsFromDraft(draft);
}

export function buildWorkflowPromptStore(options: {
  draft: WorkflowDraft;
  assets?: GeneratedAsset[] | null;
  projectPrompts?: {
    scriptPrompt?: string | null;
    scenePrompt?: string | null;
    imagePrompt?: string | null;
    videoPrompt?: string | null;
    motionPrompt?: string | null;
    thumbnailPrompt?: string | null;
  } | null;
}): WorkflowPromptStore {
  const { draft, projectPrompts } = options;
  const assets = createAssetsForSummary(draft, options.assets);
  const selectedTemplate = resolveSelectedTemplate(draft);
  const selectedStyle = resolveSelectedStyle(draft);
  const safeSelections = getSafeSelections(draft);

  const finalImagePrompt = joinUniqueBlocks([
    projectPrompts?.imagePrompt,
    ...assets.map((item) => item.imagePrompt || item.visualPrompt),
  ]);
  const finalVideoPrompt = joinUniqueBlocks([
    projectPrompts?.videoPrompt,
    ...assets.map((item) => item.videoPrompt),
  ]);
  const finalScript = draft.script || assets.map((item) => item.narration).filter(Boolean).join('\n\n') || '';
  const rolePrompts = buildRolePromptStore({
    draft,
    assets,
    selectedTemplate,
    selectedStyle,
    selectedCharacters: resolveSelectedCharacters(draft),
    safeSelections,
    finalScript,
    finalImagePrompt,
    finalVideoPrompt,
    projectPrompts,
  });

  return {
    commonPrompts: {
      contentTypePrompt: draft.promptPack?.storyPrompt || '',
      characterPrompt: draft.promptPack?.characterPrompt || '',
      scenePrompt: draft.promptPack?.scenePrompt || '',
      actionPrompt: draft.promptPack?.actionPrompt || '',
    },
    /**
     * stepPrompts는 각 Step 화면에서 사용자가 최종 선택한 입력을 다시 편집할 수 있도록 묶어 둔 저장용 프롬프트입니다.
     * - step1/2: 콘셉트/주제 기반 공통 프롬프트
     * - step3: 대본 생성과 씬 분해에 직접 들어간 템플릿/스토리 프롬프트
     * - step4/5: 캐릭터/화풍 선택 결과를 재사용하는 프롬프트
     * - step6: 최종 씬/영상 재생성 시 다시 참고하는 스크립트/씬/모션 프롬프트
     */
    stepPrompts: {
      step1: {
        conceptPrompt: draft.promptPack?.storyPrompt || '',
      },
      step2: {
        topicPrompt: draft.promptPack?.storyPrompt || '',
      },
      step3: {
        selectedPromptTemplate: selectedTemplate?.prompt || '',
        scriptPrompt: draft.promptPack?.storyPrompt || '',
        scenePrompt: draft.promptPack?.scenePrompt || '',
      },
      step4: {
        characterMoodPrompt: draft.selectedCharacterStylePrompt || '',
        characterPrompt: draft.promptPack?.characterPrompt || '',
      },
      step5: {
        stylePrompt: selectedStyle?.prompt || '',
      },
      step6: {
        finalScriptPrompt: projectPrompts?.scriptPrompt || draft.promptPack?.storyPrompt || '',
        finalScenePrompt: projectPrompts?.scenePrompt || draft.promptPack?.scenePrompt || '',
        finalActionPrompt: projectPrompts?.motionPrompt || draft.promptPack?.actionPrompt || '',
      },
    },
    finalPrompts: {
      finalScript,
      finalImagePrompt,
      finalVideoPrompt,
    },
    rolePrompts,
  };
}

export function buildWorkflowStepContract(options: {
  draft: WorkflowDraft;
  assets?: GeneratedAsset[] | null;
  generationMeta?: WorkflowScriptGenerationMeta | null;
  projectPrompts?: {
    scriptPrompt?: string | null;
    scenePrompt?: string | null;
    imagePrompt?: string | null;
    videoPrompt?: string | null;
    motionPrompt?: string | null;
    thumbnailPrompt?: string | null;
  } | null;
}): WorkflowStepContract {
  const { draft } = options;
  const selectedTemplate = resolveSelectedTemplate(draft);
  const selectedStyle = resolveSelectedStyle(draft);
  const selectedCharacters = resolveSelectedCharacters(draft);
  const safeSelections = getSafeSelections(draft);
  const resolvedTopic = normalizeText(draft.topic) || '샘플 주제';
  const assets = createAssetsForSummary(draft, options.assets);
  const promptStore = buildWorkflowPromptStore({ draft, assets, projectPrompts: options.projectPrompts });
  const generationMeta = options.generationMeta || null;
  const expectedDurationMinutes = normalizeDurationMinutes(draft.customScriptSettings?.expectedDurationMinutes);
  const currentInputSignature = buildWorkflowInputSignature(draft);
  const recommendedCharacterCount = getRecommendedCharacterCount(draft.contentType, expectedDurationMinutes);
  const recommendedParagraphCount = getRecommendedParagraphCount(draft.contentType, expectedDurationMinutes);
  const finalScript = promptStore.finalPrompts.finalScript || draft.script || '';
  const finalImagePrompt = promptStore.finalPrompts.finalImagePrompt || '';
  const finalVideoPrompt = promptStore.finalPrompts.finalVideoPrompt || '';
  const missingInputs = [
    !draft.hasSelectedContentType && !draft.completedSteps?.step1 ? 'step1.contentType' : '',
    !draft.hasSelectedAspectRatio && !draft.completedSteps?.step1 ? 'step1.aspectRatio' : '',
    !resolvedTopic ? 'step2.topic' : '',
    !selectedTemplate ? 'step3.selectedPromptTemplate' : '',
    !draft.script?.trim() && !finalScript.trim() && draft.customScriptSettings?.language !== 'mute' ? 'step3.script' : '',
    !selectedCharacters.length ? 'step4.selectedCharacters' : '',
    !selectedStyle ? 'step5.selectedStyle' : '',
  ].filter(Boolean);

  return {
    step1: {
      concept: draft.contentType,
      conceptLabel: draft.contentType,
      conceptPrompt: promptStore.stepPrompts.step1.conceptPrompt || '',
      aspectRatio: draft.aspectRatio,
      charsPerMinute: getCharsPerMinuteByContentType(draft.contentType),
    },
    step2: {
      videoDuration: expectedDurationMinutes,
      isConversational: selectedTemplate?.mode === 'dialogue',
      scriptLanguage: (draft.customScriptSettings?.language || 'ko') as ScriptLanguageOption,
      speechStyle: (draft.customScriptSettings?.speechStyle || 'default') as ScriptSpeechStyle,
      contentTopic: resolvedTopic,
      selections: safeSelections,
    },
    step3: {
      recommendedCharacterCount,
      recommendedParagraphCount,
      script: draft.script || '',
      sceneCount: countScenesFromScript(draft.script || '') || assets.length,
      imagePrompt: finalImagePrompt,
      videoStoryPrompt: finalVideoPrompt,
      castType: inferCastType(draft),
      cast: selectedCharacters.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role || character.roleLabel || null,
      })),
      castAudioMap: buildWorkflowCastAudioMap(draft),
      selectedPromptTemplateId: selectedTemplate?.id || null,
      selectedPromptTemplateName: selectedTemplate?.name || null,
      usedSampleFallback: Boolean(generationMeta?.usedSampleFallback),
      generationMeta,
      currentInputSignature,
      needsRegeneration: Boolean(generationMeta?.inputSignature && generationMeta.inputSignature !== currentInputSignature),
    },
    step4: {
      characterMood: draft.selectedCharacterStyleLabel || '',
      characterMoodPrompt: draft.selectedCharacterStylePrompt || '',
      generatedCharacters: (draft.extractedCharacters || []).map((character) => ({
        id: character.id,
        name: character.name,
        prompt: character.prompt || character.description || '',
        selected: selectedCharacters.some((selected) => selected.id === character.id),
        generatedImageCount: Array.isArray(character.generatedImages) ? character.generatedImages.length : 0,
      })),
      selectedCharacters: selectedCharacters.map((character) => ({
        id: character.id,
        name: character.name,
        prompt: character.prompt || character.description || '',
      })),
      selectedCharacterPrompt: draft.selectedCharacterStylePrompt || '',
      candidateCount: (draft.extractedCharacters || []).length,
    },
    step5: {
      generatedStyles: (draft.styleImages || []).map((style) => ({
        id: style.id,
        label: style.groupLabel || style.label,
        prompt: style.prompt || '',
        selected: style.id === draft.selectedStyleImageId,
      })),
      selectedStyle: selectedStyle ? {
        id: selectedStyle.id,
        label: selectedStyle.groupLabel || selectedStyle.label,
      } : null,
      selectedStylePrompt: selectedStyle?.prompt || '',
      candidateCount: (draft.styleImages || []).length,
      hasSelection: Boolean(selectedStyle),
    },
    step6: {
      finalScript,
      finalImagePrompt,
      finalVideoPrompt,
      summaryData: {
        sceneCount: assets.length,
        selectedCharacterCount: selectedCharacters.length,
        styleCandidateCount: (draft.styleImages || []).length,
        scriptCharacterCount: Array.from(finalScript).length,
        backgroundMusicEnabled: Boolean(draft.backgroundMusicScene?.enabled),
        thumbnailPromptReady: Boolean(promptStore.rolePrompts?.thumbnail.finalPrompt),
      },
      usedInputs: {
        step1: {
          concept: draft.contentType,
          aspectRatio: draft.aspectRatio,
        },
        step2: {
          topic: resolvedTopic,
          resolvedTopic,
          duration: expectedDurationMinutes,
          language: draft.customScriptSettings?.language || 'ko',
          speechStyle: draft.customScriptSettings?.speechStyle || 'default',
          selections: safeSelections,
        },
        step3: {
          promptTemplateId: selectedTemplate?.id || null,
          promptTemplateName: selectedTemplate?.name || null,
          castIds: selectedCharacters.map((character) => character.id),
          usedSampleFallback: Boolean(generationMeta?.usedSampleFallback),
          generationSource: generationMeta?.source || (draft.script?.trim() ? 'manual' : 'sample'),
        },
        step4: {
          selectedCharacterIds: selectedCharacters.map((character) => character.id),
          selectedCharacterStyleId: draft.selectedCharacterStyleId || null,
        },
        step5: {
          selectedStyleImageId: selectedStyle?.id || draft.selectedStyleImageId || null,
        },
        backgroundMusic: {
          enabled: Boolean(draft.backgroundMusicScene?.enabled),
          provider: draft.backgroundMusicScene?.provider || null,
          modelId: draft.backgroundMusicScene?.modelId || null,
          selectedTrackId: draft.backgroundMusicScene?.selectedTrackId || null,
          prompt: promptStore.rolePrompts?.backgroundMusic.finalPrompt || draft.backgroundMusicScene?.prompt || '',
          sections: promptStore.rolePrompts?.backgroundMusic.sections || null,
        },
        thumbnail: {
          prompt: promptStore.rolePrompts?.thumbnail.finalPrompt || options.projectPrompts?.thumbnailPrompt || '',
          sourceSteps: promptStore.rolePrompts?.thumbnail.stepSources || [],
        },
        rolePrompts: promptStore.rolePrompts || null,
      },
      missingInputs,
      ready: missingInputs.length === 0,
    },
  };
}
