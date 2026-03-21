import {
  ContentType,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_REFERENCE_IMAGES,
  ProjectOutputMode,
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
  news: {
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
  const selections = DEFAULT_SELECTIONS[contentType];
  const promptPack = buildWorkflowPromptPack({
    contentType,
    topic: '',
    selections,
    script: '',
  });
  const promptTemplates = resolveWorkflowPromptTemplates(contentType, promptPack, []);

  return {
    id: `workflow_${Date.now()}`,
    contentType,
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
    selectedCharacterStyleId: null,
    selectedCharacterStyleLabel: '',
    selectedCharacterStylePrompt: '',
    selectedStyleImageId: null,
    referenceImages: { ...DEFAULT_REFERENCE_IMAGES },
    promptPack,
    promptTemplates,
    selectedPromptTemplateId: getDefaultWorkflowPromptTemplateId(contentType),
    promptAdditions: [],
    customScriptSettings: {
      expectedDurationMinutes: 3,
      speechStyle: 'default',
      language: 'ko',
      referenceText: '',
      referenceLinks: [],
      scriptModel: 'openrouter/auto',
    },
    constitutionAnalysis: null,
    openRouterModel: 'openrouter/auto',
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
  return {
    ...draft,
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

export function ensureWorkflowDraft(studioState?: StudioState | null): WorkflowDraft {
  const existing = studioState?.workflowDraft;
  if (!existing) return createDefaultWorkflowDraft(studioState?.lastContentType || 'story');

  const contentType = existing.contentType || studioState?.lastContentType || 'story';
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
      scriptModel: existing.customScriptSettings?.scriptModel || existing.openRouterModel || 'openrouter/auto',
    },
    constitutionAnalysis: existing.constitutionAnalysis || null,
    selectedPromptTemplateId:
      promptTemplates.some((item) => item.id === existing.selectedPromptTemplateId)
        ? existing.selectedPromptTemplateId
        : getDefaultWorkflowPromptTemplateId(contentType),
    openRouterModel: existing.openRouterModel || existing.selectedPromptTemplateId || 'openrouter/auto',
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
  const promptPack = buildWorkflowPromptPack({
    contentType: draft.contentType,
    topic: draft.topic,
    selections: draft.selections,
    script: draft.script,
  });
  const promptTemplates = resolveWorkflowPromptTemplates(draft.contentType, promptPack, draft.promptTemplates || []);

  return {
    ...draft,
    promptPack,
    promptTemplates,
    selectedPromptTemplateId:
      promptTemplates.some((item) => item.id === draft.selectedPromptTemplateId)
        ? draft.selectedPromptTemplateId || getDefaultWorkflowPromptTemplateId(draft.contentType)
        : getDefaultWorkflowPromptTemplateId(draft.contentType),
    updatedAt: Date.now(),
  };
}
