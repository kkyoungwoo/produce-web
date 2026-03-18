import {
  ContentType,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_REFERENCE_IMAGES,
  ProjectOutputMode,
  StorySelectionState,
  StudioState,
  WorkflowDraft,
} from '../types';
import {
  buildWorkflowPromptPack,
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
    genre: '뉴스 브리핑',
    mood: '정돈된',
    endingTone: '핵심 요약으로 마무리',
    setting: '뉴스룸 스튜디오',
    protagonist: '앵커',
    conflict: '데이터와 체감의 차이',
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
    selectedStyleImageId: null,
    referenceImages: { ...DEFAULT_REFERENCE_IMAGES },
    promptPack,
    promptTemplates,
    selectedPromptTemplateId: promptTemplates[0]?.id || null,
    completedSteps: {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
    },
    updatedAt: Date.now(),
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
    promptPack,
    promptTemplates,
    selectedPromptTemplateId:
      promptTemplates.some((item) => item.id === existing.selectedPromptTemplateId)
        ? existing.selectedPromptTemplateId
        : promptTemplates[0]?.id || null,
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
        ? draft.selectedPromptTemplateId || null
        : promptTemplates[0]?.id || null,
    updatedAt: Date.now(),
  };
}
