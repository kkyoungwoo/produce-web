import { CONFIG } from '../config';
import {
  ContentType,
  normalizeContentType,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_REFERENCE_IMAGES,
  ProjectOutputMode,
  PromptedImageAsset,
  StorySelectionState,
  StudioState,
  WorkflowDraft,
  WorkflowPromptTemplate,
} from '../types';
import {
  buildWorkflowPromptPack,
  getDefaultWorkflowPromptTemplateId,
  resolveWorkflowPromptTemplates,
} from './workflowPromptBuilder';

export const DEFAULT_SELECTIONS: Record<ContentType, StorySelectionState> = {
  music_video: {
    genre: '감성 드라마',
    mood: '몽환적인',
    endingTone: '여운 있는 마무리',
    setting: '네온 골목',
    protagonist: '무대를 떠난 보컬',
    conflict: '전하지 못한 마음',
  },
  story: {
    genre: '드라마',
    mood: '몰입감 있는',
    endingTone: '희망적인 결말',
    setting: '새벽의 편의점',
    protagonist: '초보 창작자',
    conflict: '잊고 있던 약속',
  },
  cinematic: {
    genre: '시네마틱 드라마',
    mood: '몰입감 있는',
    endingTone: '긴 여운으로 마무리',
    setting: '비 내리는 도시 골목',
    protagonist: '과거를 숨긴 주인공',
    conflict: '되돌릴 수 없는 선택의 대가',
  },
  info_delivery: {
    genre: '정보 전달',
    mood: '정돈된',
    endingTone: '요약 정리',
    setting: '스튜디오 보드',
    protagonist: '설명자',
    conflict: '복잡도를 낮춰야 하는 과제',
  },
};

export function createDefaultWorkflowDraft(contentType: ContentType = 'story', outputMode: ProjectOutputMode = 'video'): WorkflowDraft {
  const normalizedContentType = normalizeContentType(contentType);
  const selections = DEFAULT_SELECTIONS[normalizedContentType];
  const promptPack = buildWorkflowPromptPack({
    contentType: normalizedContentType,
    topic: '',
    selections,
    script: '',
  });
  const promptTemplates = resolveWorkflowPromptTemplates(normalizedContentType, promptPack, []);

  return {
    id: `workflow_${Date.now()}`,
    contentType: normalizedContentType,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    topic: '',
    outputMode,
    selections,
    script: '',
    activeStage: 1,
    extractedCharacters: [],
    styleImages: [],
    characterImages: [],
    selectedCharacterIds: [],
    hasSelectedContentType: false,
    hasSelectedAspectRatio: false,
    selectedCharacterStyleId: null,
    selectedCharacterStyleLabel: '',
    selectedCharacterStylePrompt: '',
    selectedStyleImageId: null,
    referenceImages: { ...DEFAULT_REFERENCE_IMAGES },
    promptPack,
    promptTemplates,
    selectedPromptTemplateId: getDefaultWorkflowPromptTemplateId(normalizedContentType),
    promptAdditions: [],
    customScriptSettings: {
      expectedDurationMinutes: 3,
      speechStyle: 'default',
      language: 'ko',
      referenceText: '',
      referenceLinks: [],
      scriptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    },
    constitutionAnalysis: null,
    openRouterModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    ttsProvider: 'qwen3Tts',
    elevenLabsVoiceId: null,
    elevenLabsModelId: null,
    heygenVoiceId: null,
    qwenVoicePreset: 'qwen-default',
    qwenStylePreset: 'balanced',
    voicePreviewAsset: null,
    scriptPreviewAsset: null,
    finalVoiceAsset: null,
    backgroundMusicPreview: null,
    finalBackgroundMusic: null,
    musicVideoPreview: null,
    finalMusicVideo: null,
    sampleMode: {
      text: true,
      tts: true,
      backgroundMusic: true,
      musicVideo: true,
    },
    completedSteps: {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
    },
    updatedAt: Date.now(),
  };
}


function compactPromptTemplatesForStorage(templates?: WorkflowPromptTemplate[]): WorkflowPromptTemplate[] {
  if (!Array.isArray(templates)) return [];
  return templates
    .filter((template): template is WorkflowPromptTemplate => Boolean(template?.id))
    .map((template) => {
      const shouldKeepPromptBody = !template.builtIn || Boolean(template.isCustomized);
      if (shouldKeepPromptBody) return { ...template };
      return {
        ...template,
        prompt: '',
        basePrompt: undefined,
      };
    });
}

export function compactWorkflowDraftForStorage(draft?: WorkflowDraft | null): WorkflowDraft | null {
  if (!draft) return null;
  const contentType = normalizeContentType(draft.contentType);
  return {
    ...draft,
    contentType,
    promptPack: {
      storyPrompt: '',
      lyricsPrompt: '',
      characterPrompt: '',
      scenePrompt: '',
      actionPrompt: '',
      persuasionStoryPrompt: '',
    },
    promptTemplates: compactPromptTemplatesForStorage(draft.promptTemplates),
  };
}

function pickSingleImage(items: PromptedImageAsset[] | undefined, preferredId?: string | null): PromptedImageAsset[] {
  if (!Array.isArray(items) || !items.length) return [];
  const picked = items.find((item) => item.id === preferredId) || items[0];
  return picked ? [{ ...picked, selected: true }] : [];
}

export function createSelectedWorkflowDraftForTransport(draft?: WorkflowDraft | null): WorkflowDraft | null {
  const compacted = compactWorkflowDraftForStorage(draft);
  if (!compacted) return null;

  const selectedCharacterIds = Array.from(new Set(
    (Array.isArray(compacted.selectedCharacterIds) && compacted.selectedCharacterIds.length
      ? compacted.selectedCharacterIds
      : compacted.extractedCharacters.map((item) => item.id)
    ).filter(Boolean)
  ));

  const extractedCharacters = compacted.extractedCharacters
    .filter((item) => selectedCharacterIds.includes(item.id))
    .map((item) => {
      const generatedImages = pickSingleImage(item.generatedImages, item.selectedImageId);
      const selectedImage = generatedImages[0] || null;
      return {
        ...item,
        generatedImages,
        selectedImageId: selectedImage?.id || item.selectedImageId || null,
        imageData: item.imageData || selectedImage?.imageData || null,
      };
    });

  const styleImages = pickSingleImage(compacted.styleImages, compacted.selectedStyleImageId);
  const selectedStyleImageId = styleImages[0]?.id || compacted.selectedStyleImageId || null;
  const selectedPromptTemplates = Array.isArray(compacted.promptTemplates)
    ? compacted.promptTemplates
      .filter((template) => template?.id && template.id === compacted.selectedPromptTemplateId)
      .map((template) => ({ ...template }))
    : [];

  return {
    ...compacted,
    extractedCharacters,
    characterImages: extractedCharacters.flatMap((item) => item.generatedImages || []).map((item) => ({ ...item })),
    selectedCharacterIds,
    styleImages,
    selectedStyleImageId,
    promptTemplates: selectedPromptTemplates,
  };
}

export function ensureWorkflowDraft(studioState?: StudioState | null): WorkflowDraft {
  const existing = studioState?.workflowDraft;
  if (!existing) return createDefaultWorkflowDraft(normalizeContentType(studioState?.lastContentType || 'story'));

  const contentType = normalizeContentType(existing.contentType || studioState?.lastContentType || 'story');
  const selections = {
    ...DEFAULT_SELECTIONS[contentType],
    ...existing.selections,
  };
  const promptPack = buildWorkflowPromptPack({
    contentType,
    topic: existing.topic || '',
    selections,
    script: existing.script || '',
  });
  const promptTemplates = resolveWorkflowPromptTemplates(contentType, promptPack, existing.promptTemplates || []);

  return {
    ...createDefaultWorkflowDraft(contentType),
    ...existing,
    contentType,
    aspectRatio: existing.aspectRatio || DEFAULT_ASPECT_RATIO,
    outputMode: existing.outputMode === 'image' ? 'image' : 'video',
    selections,
    referenceImages: {
      ...DEFAULT_REFERENCE_IMAGES,
      ...existing.referenceImages,
    },
    hasSelectedContentType: existing.hasSelectedContentType ?? Boolean(existing.completedSteps?.step1),
    hasSelectedAspectRatio: existing.hasSelectedAspectRatio ?? Boolean(existing.completedSteps?.step1),
    completedSteps: {
      step1: Boolean(existing.completedSteps?.step1),
      step2: Boolean(existing.completedSteps?.step2),
      step3: Boolean(existing.completedSteps?.step3),
      step4: Boolean(existing.completedSteps?.step4),
      step5: Boolean(existing.completedSteps?.step5),
    },
    promptPack,
    promptTemplates,
    promptAdditions: Array.isArray(existing.promptAdditions) ? existing.promptAdditions.filter((item) => typeof item === 'string' && item.trim()) : [],
    customScriptSettings: {
      expectedDurationMinutes: Math.max(1, Math.min(30, Number(existing.customScriptSettings?.expectedDurationMinutes || 3))),
      speechStyle: existing.customScriptSettings?.speechStyle || 'default',
      language: existing.customScriptSettings?.language || 'ko',
      referenceText: existing.customScriptSettings?.referenceText || '',
      referenceLinks: Array.isArray(existing.customScriptSettings?.referenceLinks) ? existing.customScriptSettings?.referenceLinks : [],
      scriptModel: existing.customScriptSettings?.scriptModel || existing.openRouterModel || CONFIG.DEFAULT_SCRIPT_MODEL,
    },
    constitutionAnalysis: existing.constitutionAnalysis || null,
    selectedPromptTemplateId:
      promptTemplates.some((item) => item.id === existing.selectedPromptTemplateId)
        ? existing.selectedPromptTemplateId
        : getDefaultWorkflowPromptTemplateId(contentType),
    openRouterModel: existing.openRouterModel || existing.selectedPromptTemplateId || CONFIG.DEFAULT_SCRIPT_MODEL,
    ttsProvider: existing.ttsProvider || 'qwen3Tts',
    heygenVoiceId: existing.heygenVoiceId || null,
    qwenVoicePreset: existing.qwenVoicePreset || 'qwen-default',
    qwenStylePreset: existing.qwenStylePreset || 'balanced',
    sampleMode: {
      text: existing.sampleMode?.text ?? true,
      tts: existing.sampleMode?.tts ?? true,
      backgroundMusic: existing.sampleMode?.backgroundMusic ?? true,
      musicVideo: existing.sampleMode?.musicVideo ?? true,
    },
  };
}

export function buildWorkflowDraftPatch(draft: Partial<WorkflowDraft> & {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  script: string;
}): Partial<WorkflowDraft> {
  const contentType = normalizeContentType(draft.contentType);
  const promptPack = buildWorkflowPromptPack({
    contentType,
    topic: draft.topic,
    selections: draft.selections,
    script: draft.script,
  });
  const promptTemplates = resolveWorkflowPromptTemplates(contentType, promptPack, draft.promptTemplates || []);

  return {
    ...draft,
    contentType,
    promptPack,
    promptTemplates,
    selectedPromptTemplateId:
      promptTemplates.some((item) => item.id === draft.selectedPromptTemplateId)
        ? draft.selectedPromptTemplateId || getDefaultWorkflowPromptTemplateId(contentType)
        : getDefaultWorkflowPromptTemplateId(contentType),
    updatedAt: Date.now(),
  };
}
