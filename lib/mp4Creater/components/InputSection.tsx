'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  CharacterProfile,
  ConstitutionAnalysisSummary,
  ContentType,
  GenerationStep,
  PromptedImageAsset,
  StorySelectionState,
  StudioState,
  WorkflowDraft,
  WorkflowPromptTemplate,
  DEFAULT_REFERENCE_IMAGES,
  ReferenceLinkDraft,
  ScriptLanguageOption,
  ScriptSpeechStyle,
  WorkflowRolePromptBundle,
} from '../types';
import { CHATTERBOX_CUSTOM_VOICE_ID, CHATTERBOX_TTS_PRESET_OPTIONS, CONFIG, IMAGE_MODELS, NO_AI_SCRIPT_MODEL_ID, QWEN_TTS_PRESET_OPTIONS, SCRIPT_MODEL_OPTIONS } from '../config';
import { STEP3_PROMPT_EDITOR_GUIDE } from '../config/promptEditGuides';
import { WORKFLOW_CHARACTER_STYLE_OPTIONS, getCharacterSamplePreset, getStyleSamplePreset } from '../samples/presetCatalog';
import {
  buildSelectableStoryDraft,
  formatStoryTextForEditor,
  normalizeStoryEditorInput,
  normalizeStoryText,
  splitStoryIntoParagraphScenes,
} from '../utils/storyHelpers';
import {
  recommendTopicCandidatesFromInput,
  getTopicSuggestion,
  recommendStoryField,
} from '../services/storyRecommendationService';
import {
  buildWorkflowPromptPack,
  getDefaultWorkflowPromptTemplateId,
  getSelectedWorkflowPromptTemplate,
  resolveWorkflowPromptTemplates,
} from '../services/workflowPromptBuilder';
import {
  buildWorkflowPromptStore,
  buildWorkflowScriptGenerationMeta,
  buildWorkflowStepContract,
} from '../services/workflowStepContractService';
import {
  buildStyleRecommendations,
  buildImageAwareUploadPrompt,
  buildPromptPreviewCard,
  buildUploadDrivenPrompt,
  createCharacterCardFromPrompt,
  createPromptVariants,
  createStyleCardFromPrompt,
  extractCharactersFromScript,
} from '../services/characterStudioService';
import { buildSampleScriptDraft, composeScriptDraft } from '../services/scriptComposerService';
import { createTtsPreview } from '../services/ttsService';
import { fetchElevenLabsVoices } from '../services/elevenLabsService';
import { fetchHeyGenVoices } from '../services/heygenService';
import { scrollElementIntoView } from '../utils/horizontalScroll';
import { formatExpectedDurationLabel, normalizeExpectedDurationMinutes } from '../utils/scriptDuration';
import {
  CONTENT_TYPE_CARDS,
  FIELD_OPTIONS_BY_TYPE,
  MAX_STYLE_CARD_COUNT,
  MAX_UPLOAD_FILE_COUNT,
  MAX_UPLOAD_FILE_SIZE_MB,
  normalizeStage,
  STEP_META,
} from './inputSection/constants';
import { OverlayModal, SummaryChip } from './inputSection/ui';
import { arePromptTemplatesEqual } from './inputSection/helpers';
import { StepId } from './inputSection/types';
import {
  ProcessingBadge,
  PromptEditorModal,
  PromptPreviewModal,
  RouteStepFooter,
  SampleGuideModal,
} from './inputSection/overlays';
import MainStepView from './inputSection/views/MainStepView';
import RouteStepView from './inputSection/views/RouteStepView';
import buildMainStepViewModel from './inputSection/buildMainStepViewModel';
import buildRouteStepViewModel from './inputSection/buildRouteStepViewModel';

const CHARACTER_STYLE_OPTIONS = WORKFLOW_CHARACTER_STYLE_OPTIONS;

const CHARACTER_GENERATION_FAILSAFE_MS = 120000;

const EMPTY_STORY_SELECTIONS: StorySelectionState = {
  genre: '',
  mood: '',
  endingTone: '',
  setting: '',
  protagonist: '',
  conflict: '',
};

interface InputSectionProps {
  step: GenerationStep;
  studioState?: StudioState | null;
  workflowDraft: WorkflowDraft;
  basePath: string;
  onOpenSettings?: () => void;
  onOpenApiModal?: (options?: { title?: string; description?: string; focusField?: 'openRouter' | 'elevenLabs' | 'heygen' | 'fal' | null }) => void | Promise<void>;
  onUpdateRouting?: (patch: Partial<StudioState['routing']>) => void | Promise<void>;
  onSaveWorkflowDraft?: (draft: Partial<WorkflowDraft>) => void | Promise<void>;
  onOpenSceneStudio?: (draft: Partial<WorkflowDraft>) => void | Promise<void>;
  routeStep?: 1 | 2 | 3 | 4 | 5 | null;
  onNavigateStep?: (step: 1 | 2 | 3 | 4 | 5) => void | Promise<void>;
  onGoBackFromStep1?: () => void;
}

const InputSection: React.FC<InputSectionProps> = ({
  step,
  studioState,
  workflowDraft,
  basePath,
  onOpenSettings,
  onOpenApiModal,
  onUpdateRouting,
  onSaveWorkflowDraft,
  onOpenSceneStudio,
  routeStep,
  onNavigateStep,
  onGoBackFromStep1,
}) => {
  const characterUploadInputRef = useRef<HTMLInputElement>(null);
  const styleUploadInputRef = useRef<HTMLInputElement>(null);
  const characterStripRef = useRef<HTMLDivElement>(null);
  const styleStripRef = useRef<HTMLDivElement>(null);
  const step4CharacterStripRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<number | null>(null);
  const autoRecommendSignatureRef = useRef('');
  const hydratedDraftIdRef = useRef('');
  const sectionScrollLockRef = useRef('');
  const shouldAutoScrollSectionRef = useRef(false);
  const step2AutoRecommendDoneRef = useRef(false);
  const autoSelectedCharacterSignatureRef = useRef('');

  const initial = workflowDraft || ({} as WorkflowDraft);
  const latestLocalDraftMutationRef = useRef(Number(initial.updatedAt || 0));
  const initialStage = normalizeStage(initial.activeStage || 1);
  const initialContentType = initial.contentType || studioState?.lastContentType || 'story';
  const initialSelections = initial.selections || FIELD_OPTIONS_BY_TYPE[initialContentType];
  const initialAspectRatio = initial.aspectRatio || '16:9';
  const initialPromptPack = buildWorkflowPromptPack({
    contentType: initialContentType,
    topic: initial.topic || '',
    selections: EMPTY_STORY_SELECTIONS,
    script: initial.script || '',
  });
  const initialTemplates = resolveWorkflowPromptTemplates(initialContentType, initialPromptPack, initial.promptTemplates || []);
  const initialHasSelectedContentType = Boolean(initial.hasSelectedContentType ?? initial.completedSteps?.step1 ?? (initialStage > 1));
  const initialHasSelectedAspectRatio = Boolean(initial.hasSelectedAspectRatio ?? initial.completedSteps?.step1 ?? (initialStage > 1));
  const step1SelectionRef = useRef({ contentType: initialHasSelectedContentType, aspectRatio: initialHasSelectedAspectRatio });
  const initialCustomScriptSettings = initial.customScriptSettings || {
    expectedDurationMinutes: 1,
    speechStyle: 'default' as ScriptSpeechStyle,
    language: 'ko' as ScriptLanguageOption,
    referenceText: '',
    referenceLinks: [] as ReferenceLinkDraft[],
    scriptModel: initial.openRouterModel || NO_AI_SCRIPT_MODEL_ID,
  };

  const [activeStage, setActiveStage] = useState<StepId>(initialStage);
  const [openStage, setOpenStage] = useState<StepId | null>(initialStage);
  const [contentType, setContentType] = useState<ContentType>(initialContentType);
  const [topic, setTopic] = useState(initial.topic || getTopicSuggestion(initialContentType, ''));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialAspectRatio);
  const [hasSelectedContentType, setHasSelectedContentType] = useState(initialHasSelectedContentType);
  const [hasSelectedAspectRatio, setHasSelectedAspectRatio] = useState(initialHasSelectedAspectRatio);

  useEffect(() => {
    step1SelectionRef.current = {
      contentType: hasSelectedContentType,
      aspectRatio: hasSelectedAspectRatio,
    };
  }, [hasSelectedContentType, hasSelectedAspectRatio]);
  const [storyScript, setStoryScript] = useState(initial.script || '');
  const [scriptGenerationMeta, setScriptGenerationMeta] = useState(workflowDraft?.scriptGenerationMeta || initial.scriptGenerationMeta || null);

  const applyGeneratedStoryScript = (value: string) => {
    setStoryScript(formatStoryTextForEditor(value));
  };

  const handleStoryScriptInputChange = (value: string) => {
    setStoryScript(normalizeStoryEditorInput(value));
  };
  const [genre, setGenre] = useState(initialSelections.genre || FIELD_OPTIONS_BY_TYPE[initialContentType].genre[0]);
  const [mood, setMood] = useState(initialSelections.mood || FIELD_OPTIONS_BY_TYPE[initialContentType].mood[0]);
  const [endingTone, setEndingTone] = useState(initialSelections.endingTone || FIELD_OPTIONS_BY_TYPE[initialContentType].endingTone[0]);
  const [setting, setSetting] = useState(initialSelections.setting || FIELD_OPTIONS_BY_TYPE[initialContentType].setting[0]);
  const [protagonist, setProtagonist] = useState(initialSelections.protagonist || FIELD_OPTIONS_BY_TYPE[initialContentType].protagonist[0]);
  const [conflict, setConflict] = useState(initialSelections.conflict || FIELD_OPTIONS_BY_TYPE[initialContentType].conflict[0]);
  const [extractedCharacters, setExtractedCharacters] = useState<CharacterProfile[]>(initial.extractedCharacters || []);
  const [styleImages, setStyleImages] = useState<PromptedImageAsset[]>(initial.styleImages || []);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(initial.selectedCharacterIds || []);
  const [selectedCharacterStyleId, setSelectedCharacterStyleId] = useState<string | null>(initial.selectedCharacterStyleId || null);
  const [selectedStyleImageId, setSelectedStyleImageId] = useState<string | null>(initial.selectedStyleImageId || null);
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [isRefreshingTopic, setIsRefreshingTopic] = useState(false);
  const [topicRecommendations, setTopicRecommendations] = useState<string[]>([]);
  const [showPromptPack, setShowPromptPack] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenerationProgress, setScriptGenerationProgress] = useState<{ percent: number; message: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<WorkflowPromptTemplate[]>(initialTemplates);
  const initialTemplateId = initial.selectedPromptTemplateId
    || getDefaultWorkflowPromptTemplateId(initialContentType);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState<string | null>(initialTemplateId);
  const [promptDetailId, setPromptDetailId] = useState<string | null>(initialTemplateId);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptPreviewId, setPromptPreviewId] = useState<string | null>(null);
  const [promptPreviewDraft, setPromptPreviewDraft] = useState('');
  const [expandedCharacterEditorId, setExpandedCharacterEditorId] = useState<string | null>(null);
  const [expandedStyleEditorId, setExpandedStyleEditorId] = useState<string | null>(null);
  const [characterCarouselIndices, setCharacterCarouselIndices] = useState<Record<string, number>>({});
  const [characterLoadingProgress, setCharacterLoadingProgress] = useState<Record<string, number>>({});
  const [styleCarouselIndices, setStyleCarouselIndices] = useState<Record<string, number>>({});
  const [styleLoadingProgress, setStyleLoadingProgress] = useState<Record<string, number>>({});
  const [step3CastSelectionHighlightTick, setStep3CastSelectionHighlightTick] = useState(0);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterPrompt, setNewCharacterPrompt] = useState('');
  const [characterUploadTargetId, setCharacterUploadTargetId] = useState<string | null>(null);
  const [step3PanelMode, setStep3PanelMode] = useState<'balanced' | 'character-focus' | 'script-focus'>('balanced');
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');
  const [customScriptDurationMinutes, setCustomScriptDurationMinutes] = useState<number>(normalizeExpectedDurationMinutes(Number(initialCustomScriptSettings.expectedDurationMinutes || 1)));
  const [customScriptSpeechStyle, setCustomScriptSpeechStyle] = useState<ScriptSpeechStyle>(initialCustomScriptSettings.speechStyle || 'default');
  const [customScriptLanguage, setCustomScriptLanguage] = useState<ScriptLanguageOption>(initialCustomScriptSettings.language || 'ko');
  const [customScriptReferenceText, setCustomScriptReferenceText] = useState(initialCustomScriptSettings.referenceText || '');
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLinkDraft[]>(initialCustomScriptSettings.referenceLinks || []);
  const [scriptReferenceSuggestions, setScriptReferenceSuggestions] = useState<string[]>([]);
  const [pendingReferenceLinkUrl, setPendingReferenceLinkUrl] = useState('');
  const [showReferenceLinkInput, setShowReferenceLinkInput] = useState(false);
  const [isAddingReferenceLink, setIsAddingReferenceLink] = useState(false);
  const [selectedScriptGenerationModel, setSelectedScriptGenerationModel] = useState(initialCustomScriptSettings.scriptModel || NO_AI_SCRIPT_MODEL_ID);
  const [constitutionAnalysis, setConstitutionAnalysis] = useState<ConstitutionAnalysisSummary | null>(initial.constitutionAnalysis || null);
  // 샘플 안내 모달과 프롬프트 수정 모달은 흐름을 끊지 않게 이 컴포넌트에서 직접 제어합니다.
  const [sampleGuideOpen, setSampleGuideOpen] = useState(false);
  const [scriptGenerationConfirmOpen, setScriptGenerationConfirmOpen] = useState(false);
  const [pendingCharacterDeleteId, setPendingCharacterDeleteId] = useState<string | null>(null);
  const [promptEditorForm, setPromptEditorForm] = useState({ name: '', description: '', prompt: '' });
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ voice_id: string; name: string; preview_url?: string; labels?: { accent?: string; gender?: string; description?: string } }>>([]);
  const [heygenVoices, setHeygenVoices] = useState<Array<{ voice_id: string; name: string; language?: string; gender?: string; preview_audio_url?: string; preview_audio?: string }>>([]);
  const [isLoadingVoiceCatalogs, setIsLoadingVoiceCatalogs] = useState(false);
  const [voicePreviewCharacterId, setVoicePreviewCharacterId] = useState<string | null>(null);
  const [voicePreviewMessage, setVoicePreviewMessage] = useState('');
  const characterVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const characterVoiceUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const extractedCharactersRef = useRef<CharacterProfile[]>(initial.extractedCharacters || []);
  const selectedCharacterIdsRef = useRef<string[]>(initial.selectedCharacterIds || []);
  const characterGenerationTimeoutsRef = useRef<Record<string, number>>({});

  const clearCharacterGenerationFailsafe = (characterId: string) => {
    const timeoutId = characterGenerationTimeoutsRef.current[characterId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete characterGenerationTimeoutsRef.current[characterId];
    }
  };

  const scheduleCharacterGenerationFailsafe = (characterId: string, characterName: string) => {
    clearCharacterGenerationFailsafe(characterId);
    characterGenerationTimeoutsRef.current[characterId] = window.setTimeout(() => {
      setCharacterLoadingProgress((prev) => {
        if (prev[characterId] === undefined) return prev;
        const next = { ...prev };
        delete next[characterId];
        return next;
      });
      delete characterGenerationTimeoutsRef.current[characterId];
      setNotice(`${characterName} 캐릭터 생성 응답이 2분을 넘어 로딩 상태를 정리했습니다. 다시 시도해 주세요.`);
    }, CHARACTER_GENERATION_FAILSAFE_MS);
  };

  useEffect(() => {
    extractedCharactersRef.current = extractedCharacters;
  }, [extractedCharacters]);

  useEffect(() => {
    selectedCharacterIdsRef.current = selectedCharacterIds;
  }, [selectedCharacterIds]);

  useEffect(() => {
    return () => {
      Object.values(characterGenerationTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      characterGenerationTimeoutsRef.current = {};
    };
  }, []);

  const replaceExtractedCharacters = (nextCharacters: CharacterProfile[], options?: { persistDraft?: boolean }) => {
    extractedCharactersRef.current = nextCharacters;
    setExtractedCharacters(nextCharacters);
    if (options?.persistDraft && onSaveWorkflowDraft) {
      onSaveWorkflowDraft({
        extractedCharacters: nextCharacters,
        selectedCharacterIds: selectedCharacterIdsRef.current,
      });
    }
  };

  const openStageWithIntent = (nextStage: StepId, shouldScroll = true) => {
    shouldAutoScrollSectionRef.current = shouldScroll;
    setOpenStage(nextStage);
  };

  const workflowHydrationKey = routeStep
    ? [
        workflowDraft?.id || 'draft',
        routeStep,
        workflowDraft?.updatedAt || 0,
        workflowDraft?.activeStage || 1,
        workflowDraft?.contentType || '',
        workflowDraft?.topic || '',
        workflowDraft?.script || '',
        (workflowDraft?.selectedCharacterIds || []).join(','),
        workflowDraft?.selectedCharacterStyleId || '',
        workflowDraft?.selectedStyleImageId || '',
        workflowDraft?.extractedCharacters?.length || 0,
        workflowDraft?.styleImages?.length || 0,
      ].join('::')
    : [workflowDraft?.id || 'draft', workflowDraft?.updatedAt || 0].join('::');

  useEffect(() => {
    if (hydratedDraftIdRef.current === workflowHydrationKey) return;
    const previousDraftId = hydratedDraftIdRef.current.split('::')[0] || '';
    const currentDraftId = workflowDraft?.id || 'draft';
    const incomingDraftUpdatedAt = Number(workflowDraft?.updatedAt || 0);
    const shouldSkipStaleHydration = previousDraftId === currentDraftId
      && incomingDraftUpdatedAt > 0
      && incomingDraftUpdatedAt < latestLocalDraftMutationRef.current;

    if (shouldSkipStaleHydration) return;

    hydratedDraftIdRef.current = workflowHydrationKey;
    latestLocalDraftMutationRef.current = Math.max(latestLocalDraftMutationRef.current, incomingDraftUpdatedAt);

    const nextType = workflowDraft?.contentType || studioState?.lastContentType || 'story';
    const nextSelections = workflowDraft?.selections || FIELD_OPTIONS_BY_TYPE[nextType];
    const nextStage = normalizeStage(workflowDraft?.activeStage || 1);
    const shouldPreserveStep1Selection = previousDraftId === currentDraftId;
    const nextPromptPack = buildWorkflowPromptPack({
      contentType: nextType,
      topic: workflowDraft?.topic || '',
      selections: nextSelections,
      script: workflowDraft?.script || '',
    });
    const nextTemplates = resolveWorkflowPromptTemplates(nextType, nextPromptPack, workflowDraft?.promptTemplates || []);

    setContentType(nextType);
    setTopic(workflowDraft?.topic || getTopicSuggestion(nextType, ''));
    setAspectRatio(workflowDraft?.aspectRatio || '16:9');
    const step1Selected = Boolean(workflowDraft?.completedSteps?.step1 || nextStage > 1);
    const nextHasSelectedContentType = workflowDraft?.hasSelectedContentType !== undefined
      ? workflowDraft.hasSelectedContentType
      : (shouldPreserveStep1Selection ? step1SelectionRef.current.contentType : step1Selected);
    const nextHasSelectedAspectRatio = workflowDraft?.hasSelectedAspectRatio !== undefined
      ? workflowDraft.hasSelectedAspectRatio
      : (shouldPreserveStep1Selection ? step1SelectionRef.current.aspectRatio : step1Selected);
    setHasSelectedContentType(Boolean(nextHasSelectedContentType));
    setHasSelectedAspectRatio(Boolean(nextHasSelectedAspectRatio));
    applyGeneratedStoryScript(workflowDraft?.script || '');
    setScriptGenerationMeta(workflowDraft?.scriptGenerationMeta || null);
    setGenre(nextSelections.genre || FIELD_OPTIONS_BY_TYPE[nextType].genre[0]);
    setMood(nextSelections.mood || FIELD_OPTIONS_BY_TYPE[nextType].mood[0]);
    setEndingTone(nextSelections.endingTone || FIELD_OPTIONS_BY_TYPE[nextType].endingTone[0]);
    setSetting(nextSelections.setting || FIELD_OPTIONS_BY_TYPE[nextType].setting[0]);
    setProtagonist(nextSelections.protagonist || FIELD_OPTIONS_BY_TYPE[nextType].protagonist[0]);
    setConflict(nextSelections.conflict || FIELD_OPTIONS_BY_TYPE[nextType].conflict[0]);
    const nextHydratedCharacters = workflowDraft?.extractedCharacters || [];
    const nextHydratedSelectedCharacterIds = workflowDraft?.selectedCharacterIds || [];
    extractedCharactersRef.current = nextHydratedCharacters;
    selectedCharacterIdsRef.current = nextHydratedSelectedCharacterIds;
    setExtractedCharacters(nextHydratedCharacters);
    setStyleImages(workflowDraft?.styleImages || []);
    setSelectedCharacterIds(nextHydratedSelectedCharacterIds);
    setSelectedCharacterStyleId(workflowDraft?.selectedCharacterStyleId || null);
    setSelectedStyleImageId(workflowDraft?.selectedStyleImageId || null);
    setActiveStage(nextStage);
    openStageWithIntent(nextStage, false);
    setPromptTemplates(nextTemplates);
    const resolvedTemplateId = nextTemplates.some((item) => item.id === workflowDraft?.selectedPromptTemplateId)
      ? (workflowDraft?.selectedPromptTemplateId || getDefaultWorkflowPromptTemplateId(nextType))
      : getDefaultWorkflowPromptTemplateId(nextType);
    setSelectedPromptTemplateId(resolvedTemplateId);
    setPromptDetailId(resolvedTemplateId);
    setEditingPromptId((prev) => prev);
    setPromptPreviewId((prev) => prev);
    setCharacterCarouselIndices({});
    setCharacterLoadingProgress({});
    setStyleCarouselIndices({});
    setStyleLoadingProgress({});
    setNewCharacterName('');
    setNewCharacterPrompt('');
    setNewStyleName('');
    setNewStylePrompt('');
    setCustomScriptDurationMinutes(normalizeExpectedDurationMinutes(Number(workflowDraft?.customScriptSettings?.expectedDurationMinutes || 1)));
    setCustomScriptSpeechStyle(workflowDraft?.customScriptSettings?.speechStyle || 'default');
    setCustomScriptLanguage(workflowDraft?.customScriptSettings?.language || 'ko');
    setCustomScriptReferenceText(workflowDraft?.customScriptSettings?.referenceText || '');
    setReferenceLinks(Array.isArray(workflowDraft?.customScriptSettings?.referenceLinks) ? workflowDraft.customScriptSettings.referenceLinks : []);
    setPendingReferenceLinkUrl('');
    setShowReferenceLinkInput(false);
    setSelectedScriptGenerationModel(workflowDraft?.customScriptSettings?.scriptModel || NO_AI_SCRIPT_MODEL_ID);
    setConstitutionAnalysis(workflowDraft?.constitutionAnalysis || null);
  }, [workflowHydrationKey, workflowDraft, studioState?.lastContentType]);

  useEffect(() => {
    let cancelled = false;

    const loadVoiceCatalogs = async () => {
      setIsLoadingVoiceCatalogs(true);
      try {
        const [eleven, heygen] = await Promise.all([
          fetchElevenLabsVoices(studioState?.providers?.elevenLabsApiKey || undefined),
          fetchHeyGenVoices(studioState?.providers?.heygenApiKey || undefined),
        ]);
        if (cancelled) return;
        setElevenLabsVoices(eleven);
        setHeygenVoices(heygen);
      } finally {
        if (!cancelled) setIsLoadingVoiceCatalogs(false);
      }
    };

    void loadVoiceCatalogs();
    return () => {
      cancelled = true;
    };
  }, [studioState?.providers?.elevenLabsApiKey, studioState?.providers?.heygenApiKey]);

  useEffect(() => () => {
    if (characterVoiceAudioRef.current) {
      characterVoiceAudioRef.current.pause();
      characterVoiceAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      characterVoiceUtteranceRef.current = null;
    }
  }, []);

  const normalizedScript = useMemo(() => normalizeStoryText(storyScript), [storyScript]);
  const sceneCount = useMemo(() => splitStoryIntoParagraphScenes(normalizedScript).length, [normalizedScript]);

  const selections = useMemo<StorySelectionState>(() => {
    const fallback = FIELD_OPTIONS_BY_TYPE[contentType];
    return {
      genre: genre.trim() || fallback.genre[0] || '',
      mood: mood.trim() || fallback.mood[0] || '',
      endingTone: endingTone.trim() || fallback.endingTone[0] || '',
      setting: setting.trim() || fallback.setting[0] || '',
      protagonist: protagonist.trim() || fallback.protagonist[0] || '',
      conflict: conflict.trim() || fallback.conflict[0] || '',
    };
  }, [conflict, contentType, endingTone, genre, mood, protagonist, setting]);

  const effectiveTopic = useMemo(() => (
    topic.trim() || getTopicSuggestion(contentType, selections.genre) || getTopicSuggestion(contentType, '') || '샘플 주제'
  ), [contentType, selections.genre, topic]);
  const seededStep2StoryDraft = useMemo(() => buildSelectableStoryDraft({
    contentType,
    topic: effectiveTopic,
    expectedDurationMinutes: customScriptDurationMinutes,
    ...selections,
  }), [contentType, customScriptDurationMinutes, effectiveTopic, selections]);
  const shouldUseCurrentStoryFoundation = Boolean(normalizedScript.trim()) && !scriptGenerationMeta?.generatedAt;

  const promptPack = useMemo(
    () => buildWorkflowPromptPack({ contentType, topic: effectiveTopic, selections, script: normalizedScript }),
    [contentType, effectiveTopic, selections, normalizedScript]
  );

  const syncedPromptTemplates = useMemo(
    () => resolveWorkflowPromptTemplates(contentType, promptPack, promptTemplates),
    [contentType, promptPack, promptTemplates]
  );

  useEffect(() => {
    if (!arePromptTemplatesEqual(promptTemplates, syncedPromptTemplates)) {
      setPromptTemplates(syncedPromptTemplates);
    }
    if (!syncedPromptTemplates.some((item) => item.id === selectedPromptTemplateId)) {
      setSelectedPromptTemplateId(syncedPromptTemplates[0]?.id || null);
    }
    if (!syncedPromptTemplates.some((item) => item.id === promptDetailId)) {
      setPromptDetailId(syncedPromptTemplates[0]?.id || null);
    }
  }, [promptTemplates, syncedPromptTemplates, selectedPromptTemplateId, promptDetailId]);

  const selectedPromptTemplate = useMemo(
    () => getSelectedWorkflowPromptTemplate(syncedPromptTemplates, selectedPromptTemplateId),
    [syncedPromptTemplates, selectedPromptTemplateId]
  );
  const promptDetailTemplate = useMemo(
    () => syncedPromptTemplates.find((item) => item.id === promptDetailId) || selectedPromptTemplate,
    [syncedPromptTemplates, promptDetailId, selectedPromptTemplate]
  );

  const selectedPromptIndex = useMemo(() => {
    const foundIndex = syncedPromptTemplates.findIndex((item) => item.id === selectedPromptTemplateId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [syncedPromptTemplates, selectedPromptTemplateId]);

  useEffect(() => {
    if (!editingPromptId) return;
    const target = syncedPromptTemplates.find((item) => item.id === editingPromptId);
    if (!target) return;
    setPromptEditorForm({
      name: target.name,
      description: target.description,
      prompt: target.prompt,
    });
  }, [editingPromptId, syncedPromptTemplates]);
  const activePromptSlide = syncedPromptTemplates[selectedPromptIndex] || selectedPromptTemplate;

  const effectiveSelectedCharacterIds = useMemo(() => selectedCharacterIds, [selectedCharacterIds]);
  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => effectiveSelectedCharacterIds.includes(item.id)),
    [effectiveSelectedCharacterIds, extractedCharacters]
  );
  const selectedCharacterStyle = useMemo(
    () => CHARACTER_STYLE_OPTIONS.find((item) => item.id === selectedCharacterStyleId) || null,
    [selectedCharacterStyleId]
  );
  const selectedStyle = useMemo(
    () => (selectedStyleImageId ? styleImages.find((item) => item.id === selectedStyleImageId) || null : null),
    [styleImages, selectedStyleImageId]
  );
  const projectVoiceProvider = (
    workflowDraft?.ttsProvider === 'elevenLabs' || studioState?.routing?.ttsProvider === 'elevenLabs'
      ? 'elevenLabs'
      : workflowDraft?.ttsProvider === 'heygen' || studioState?.routing?.ttsProvider === 'heygen'
        ? 'heygen'
        : 'qwen3Tts'
  ) as 'qwen3Tts' | 'elevenLabs' | 'heygen';
  const selectedProjectElevenVoice = useMemo(
    () => elevenLabsVoices.find((item) => item.voice_id === (workflowDraft?.elevenLabsVoiceId || studioState?.routing?.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID)) || elevenLabsVoices[0] || null,
    [elevenLabsVoices, studioState?.routing?.elevenLabsVoiceId, workflowDraft?.elevenLabsVoiceId]
  );
  const selectedProjectHeyGenVoice = useMemo(
    () => heygenVoices.find((item) => item.voice_id === (workflowDraft?.heygenVoiceId || studioState?.routing?.heygenVoiceId || '')) || heygenVoices[0] || null,
    [heygenVoices, studioState?.routing?.heygenVoiceId, workflowDraft?.heygenVoiceId]
  );
  const projectVoiceReferenceName = workflowDraft?.voiceReferenceName || studioState?.routing?.voiceReferenceName || '내 목소리 샘플';
  const hasProjectVoiceReference = Boolean(workflowDraft?.voiceReferenceAudioData || studioState?.routing?.voiceReferenceAudioData);
  const resolveChatterboxVoiceMeta = (voiceId?: string | null) => {
    const normalizedId = `${voiceId || ''}`.trim();
    if (normalizedId === CHATTERBOX_CUSTOM_VOICE_ID && hasProjectVoiceReference) {
      return {
        id: CHATTERBOX_CUSTOM_VOICE_ID,
        name: projectVoiceReferenceName,
      };
    }
    const preset = CHATTERBOX_TTS_PRESET_OPTIONS.find((item) => item.id === normalizedId) || CHATTERBOX_TTS_PRESET_OPTIONS[0];
    return {
      id: preset.id,
      name: preset.name,
    };
  };
  const projectVoiceSummary = useMemo(() => {
    if (projectVoiceProvider === 'elevenLabs') {
      return `기본값 · ElevenLabs / ${selectedProjectElevenVoice?.name || '기본 보이스'}`;
    }
    if (projectVoiceProvider === 'heygen') {
      return `기본값 · HeyGen / ${selectedProjectHeyGenVoice?.name || '기본 보이스'}`;
    }
    return `기본값 · qwen3-tts / ${QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === (workflowDraft?.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default'))?.name || 'qwen3-tts 기본 보이스'}`;
  }, [projectVoiceProvider, selectedProjectElevenVoice, selectedProjectHeyGenVoice, studioState?.routing?.qwenVoicePreset, workflowDraft?.qwenVoicePreset]);
  const stopCharacterVoicePreview = () => {
    if (characterVoiceAudioRef.current) {
      characterVoiceAudioRef.current.pause();
      characterVoiceAudioRef.current.currentTime = 0;
      characterVoiceAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      characterVoiceUtteranceRef.current = null;
    }
    setVoicePreviewCharacterId(null);
  };
  const resolveCharacterVoiceSelection = (character: CharacterProfile) => {
    const rawProvider = (character.voiceProvider || 'project-default') as 'project-default' | 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
    const provider = rawProvider === 'chatterbox' ? 'qwen3Tts' : rawProvider;
    if (provider === 'qwen3Tts') {
      const qwenId = character.voiceId || character.voiceHint || workflowDraft?.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default';
      const qwenVoice = QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === qwenId) || QWEN_TTS_PRESET_OPTIONS[0];
      return { provider, voiceId: qwenVoice.id, voiceName: qwenVoice.name, previewUrl: null as string | null, locale: 'ko-KR' };
    }
    if (provider === 'elevenLabs') {
      const voiceId = character.voiceId || character.voiceHint || workflowDraft?.elevenLabsVoiceId || studioState?.routing?.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID;
      const voice = elevenLabsVoices.find((item) => item.voice_id === voiceId) || selectedProjectElevenVoice;
      return { provider, voiceId: voice?.voice_id || voiceId, voiceName: voice?.name || character.voiceName || 'ElevenLabs 기본 보이스', previewUrl: voice?.preview_url || character.voicePreviewUrl || null, locale: character.voiceLocale || null };
    }
    if (provider === 'heygen') {
      const voiceId = character.voiceId || character.voiceHint || workflowDraft?.heygenVoiceId || studioState?.routing?.heygenVoiceId || selectedProjectHeyGenVoice?.voice_id || null;
      const voice = heygenVoices.find((item) => item.voice_id === voiceId) || selectedProjectHeyGenVoice;
      return { provider, voiceId: voice?.voice_id || voiceId, voiceName: voice?.name || character.voiceName || 'HeyGen 기본 보이스', previewUrl: voice?.preview_audio_url || voice?.preview_audio || character.voicePreviewUrl || null, locale: voice?.language || character.voiceLocale || null };
    }
    if (projectVoiceProvider === 'elevenLabs') {
      return { provider, voiceId: selectedProjectElevenVoice?.voice_id || workflowDraft?.elevenLabsVoiceId || studioState?.routing?.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID, voiceName: selectedProjectElevenVoice?.name || 'ElevenLabs 기본 보이스', previewUrl: selectedProjectElevenVoice?.preview_url || null, locale: null as string | null };
    }
    if (projectVoiceProvider === 'heygen') {
      return { provider, voiceId: selectedProjectHeyGenVoice?.voice_id || workflowDraft?.heygenVoiceId || studioState?.routing?.heygenVoiceId || null, voiceName: selectedProjectHeyGenVoice?.name || 'HeyGen 기본 보이스', previewUrl: selectedProjectHeyGenVoice?.preview_audio_url || selectedProjectHeyGenVoice?.preview_audio || null, locale: selectedProjectHeyGenVoice?.language || null };
    }
    const qwenId = workflowDraft?.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default';
    const qwenVoice = QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === qwenId) || QWEN_TTS_PRESET_OPTIONS[0];
    return { provider, voiceId: qwenVoice.id, voiceName: qwenVoice.name, previewUrl: null as string | null, locale: 'ko-KR' };
  };
  const getCharacterVoiceSummary = (character: CharacterProfile) => {
    const resolved = resolveCharacterVoiceSelection(character);
    if (resolved.provider === 'project-default') return projectVoiceSummary;
    if (resolved.provider === 'elevenLabs') return `직접 지정 · ElevenLabs / ${resolved.voiceName}`;
    if (resolved.provider === 'heygen') return `직접 지정 · HeyGen / ${resolved.voiceName}`;
    return `직접 지정 · qwen3-tts / ${resolved.voiceName}`;
  };
  const buildCharacterVoicePatch = (provider: 'project-default' | 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen', value?: string | null) => {
    const normalizedProvider = provider === 'chatterbox' ? 'qwen3Tts' : provider;
    if (normalizedProvider === 'project-default') {
      return {
        voiceProvider: 'project-default' as const,
        voiceHint: undefined,
        voiceId: undefined,
        voiceName: undefined,
        voicePreviewUrl: null,
        voiceLocale: null,
      };
    }
    if (normalizedProvider === 'qwen3Tts') {
      const preset = QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === (value || 'qwen-default')) || QWEN_TTS_PRESET_OPTIONS[0];
      return {
        voiceProvider: 'qwen3Tts' as const,
        voiceHint: preset.id,
        voiceId: preset.id,
        voiceName: preset.name,
        voicePreviewUrl: null,
        voiceLocale: 'ko-KR',
      };
    }
    if (normalizedProvider === 'elevenLabs') {
      const voice = elevenLabsVoices.find((item) => item.voice_id === value) || selectedProjectElevenVoice || elevenLabsVoices[0] || null;
      return {
        voiceProvider: 'elevenLabs' as const,
        voiceHint: voice?.voice_id || value || undefined,
        voiceId: voice?.voice_id || value || undefined,
        voiceName: voice?.name || 'ElevenLabs 보이스',
        voicePreviewUrl: voice?.preview_url || null,
        voiceLocale: null,
      };
    }
    const voice = heygenVoices.find((item) => item.voice_id === value) || selectedProjectHeyGenVoice || heygenVoices[0] || null;
    return {
      voiceProvider: 'heygen' as const,
      voiceHint: voice?.voice_id || value || undefined,
      voiceId: voice?.voice_id || value || undefined,
      voiceName: voice?.name || 'HeyGen 보이스',
      voicePreviewUrl: voice?.preview_audio_url || voice?.preview_audio || null,
      voiceLocale: voice?.language || null,
    };
  };
  const buildCharacterStyledPrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!selectedCharacterStyle) return trimmed;
    return [`[COMMON CHARACTER STYLE] ${selectedCharacterStyle.label}`, selectedCharacterStyle.prompt, trimmed].filter(Boolean).join('\n\n');
  };
  const customScriptModelOptions = useMemo(
    () => ([{ id: NO_AI_SCRIPT_MODEL_ID, name: 'AI 모델 없음' }, ...SCRIPT_MODEL_OPTIONS.map((item) => ({ id: item.id, name: item.name }))]),
    []
  );
  const combinedReferenceText = useMemo(() => {
    const linkNotes = referenceLinks
      .filter((item) => item.status === 'ready')
      .map((item) => item.summary || item.sourceText || '')
      .filter(Boolean);
    return [customScriptReferenceText.trim(), ...linkNotes].filter(Boolean).join('\n\n');
  }, [customScriptReferenceText, referenceLinks]);
  const buildScriptReferenceSuggestionSet = () => {
    const base = [
      `${topic || '이번 주제'}의 핵심 메시지가 첫 문단에서 바로 드러나게 해 주세요.`,
      `${formatExpectedDurationLabel(customScriptDurationMinutes)} 분량에 맞춰 장면 호흡이 무리 없이 이어지게 해 주세요.`,
      `${customScriptLanguage === 'mute' ? '무음 영상용이라 대사보다 장면 흐름과 시각 정보 중심으로 구성해 주세요.' : '선택한 언어와 말투가 자연스럽게 들리도록 낭독 대본으로 정리해 주세요.'}`,
      `중간에는 실제 예시나 비유를 넣어 이해가 쉬운 대본으로 정리해 주세요.`,
    ].filter(Boolean);
    return [...base].sort(() => Math.random() - 0.5).slice(0, 3);
  };
  const styleGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; items: PromptedImageAsset[] }>();
    (styleImages || []).forEach((item) => {
      const groupId = item.groupId || item.id;
      const existing = groups.get(groupId);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupId, { id: groupId, label: item.groupLabel || item.label, items: [item] });
      }
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.createdAt - b.createdAt),
    }));
  }, [styleImages]);
  const selectedStyleGroupId = selectedStyle?.groupId || null;

  useEffect(() => {
    setCharacterCarouselIndices((prev) => {
      const next = { ...prev };
      extractedCharacters.forEach((character) => {
        const imageCount = (character.generatedImages || []).length;
        if (!imageCount) {
          next[character.id] = 0;
          return;
        }
        const selectedIndex = Math.max(0, (character.generatedImages || []).findIndex((image) => image.id === character.selectedImageId));
        const fallbackIndex = typeof next[character.id] === 'number' ? next[character.id] : selectedIndex;
        next[character.id] = Math.min(Math.max(fallbackIndex, 0), imageCount - 1);
      });
      return next;
    });
  }, [extractedCharacters]);

  useEffect(() => {
    setStyleCarouselIndices((prev) => {
      const next = { ...prev };
      styleGroups.forEach((group) => {
        const currentCount = group.items.length;
        const loadingCount = styleLoadingProgress[group.id] !== undefined ? 1 : 0;
        const slideCount = currentCount + loadingCount;
        if (!slideCount) {
          next[group.id] = 0;
          return;
        }
        const selectedIndex = Math.max(0, group.items.findIndex((item) => item.id === selectedStyleImageId));
        const fallbackIndex = typeof next[group.id] === 'number' ? next[group.id] : selectedIndex;
        next[group.id] = Math.min(Math.max(selectedIndex >= 0 ? selectedIndex : fallbackIndex, 0), Math.max(slideCount - 1, 0));
      });
      return next;
    });
  }, [styleGroups, selectedStyleImageId, styleLoadingProgress]);

  useEffect(() => {
    const container = characterStripRef.current;
    if (!container || !selectedCharacterIds.length) return;
    const targetId = selectedCharacterIds[selectedCharacterIds.length - 1];
    const target = container.querySelector<HTMLElement>(`[data-character-card-id="${targetId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedCharacterIds, extractedCharacters.length]);

  useEffect(() => {
    const container = styleStripRef.current;
    if (!container || !styleGroups.length) return;
    const targetGroupId = selectedStyleGroupId || styleGroups[styleGroups.length - 1]?.id;
    if (!targetGroupId) return;
    const target = container.querySelector<HTMLElement>(`[data-style-group-id="${targetGroupId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedStyleGroupId, styleGroups.length]);

  useEffect(() => {
    const container = step4CharacterStripRef.current;
    if (!container || !selectedCharacters.length) return;
    const targetId = selectedCharacters[selectedCharacters.length - 1]?.id;
    if (!targetId) return;
    const target = container.querySelector<HTMLElement>(`[data-step4-character-id="${targetId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedCharacters.length]);

  useEffect(() => {
    if (!routeStep) return;
    const targetStage = normalizeStage(routeStep);
    if (targetStage <= activeStage) {
      openStageWithIntent(targetStage, false);
    }
  }, [routeStep, activeStage]);

  useEffect(() => {
    if (!openStage || !shouldAutoScrollSectionRef.current) return;
    const signature = `${workflowDraft?.id || 'draft'}:${openStage}`;
    if (sectionScrollLockRef.current === signature) {
      shouldAutoScrollSectionRef.current = false;
      return;
    }
    sectionScrollLockRef.current = signature;
    shouldAutoScrollSectionRef.current = false;

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-step-section="step-${openStage}"]`);
      if (!target) return;
      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
      window.scrollTo({ top, behavior: 'smooth' });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [openStage, workflowDraft?.id]);

  const selectedCharactersReady = selectedCharacters.every((character) => Boolean(character.selectedImageId));
  const isMuteScriptMode = customScriptLanguage === 'mute';
  const selectedCharactersHaveVoiceSelection = useMemo(() => {
    if (contentType === 'music_video' || isMuteScriptMode) return true;
    if (!selectedCharacters.length) return false;
    return selectedCharacters.every((character) => {
      const provider = character.voiceProvider;
      if (!provider) return false;
      if (provider === 'project-default') return true;
      if (provider === 'qwen3Tts') return Boolean(character.voiceId || character.voiceHint || 'qwen-default');
      if (provider === 'chatterbox') return Boolean(character.voiceId || character.voiceHint || studioState?.routing?.qwenVoicePreset || workflowDraft?.qwenVoicePreset || 'qwen-default');
      if (provider === 'elevenLabs') {
        return Boolean(
          character.voiceId
          || character.voiceHint
          || selectedProjectElevenVoice?.voice_id
          || studioState?.routing?.elevenLabsVoiceId
          || workflowDraft?.elevenLabsVoiceId
          || CONFIG.DEFAULT_VOICE_ID
        );
      }
      return Boolean(
        character.voiceId
        || character.voiceHint
        || selectedProjectHeyGenVoice?.voice_id
        || studioState?.routing?.heygenVoiceId
        || workflowDraft?.heygenVoiceId
      );
    });
  }, [
    contentType,
    selectedCharacters,
    selectedProjectElevenVoice?.voice_id,
    selectedProjectHeyGenVoice?.voice_id,
    studioState?.routing?.chatterboxVoicePreset,
    studioState?.routing?.elevenLabsVoiceId,
    studioState?.routing?.heygenVoiceId,
    workflowDraft?.chatterboxVoicePreset,
    workflowDraft?.elevenLabsVoiceId,
    workflowDraft?.heygenVoiceId,
    isMuteScriptMode,
  ]);

  const stepCompleted = useMemo(
    () => ({
      1: Boolean(hasSelectedContentType && hasSelectedAspectRatio),
      2: Boolean(topic.trim()),
      3: isMuteScriptMode
        ? Boolean(selectedCharacterIds.length)
        : Boolean(normalizedScript.trim() && selectedPromptTemplateId && selectedCharacterIds.length && selectedCharactersHaveVoiceSelection),
      4: Boolean(selectedCharacters.length && selectedCharacterStyleId && selectedCharactersReady),
      5: Boolean(selectedStyleImageId),
    }),
    [hasSelectedContentType, hasSelectedAspectRatio, topic, normalizedScript, selectedPromptTemplateId, selectedCharacterIds, selectedCharactersHaveVoiceSelection, selectedCharacters.length, selectedCharacterStyleId, selectedCharactersReady, selectedStyleImageId, styleImages, isMuteScriptMode]
  );

  const routeStepCompleted = useMemo(
    () => ({
      1: Boolean(hasSelectedContentType && hasSelectedAspectRatio),
      2: Boolean(topic.trim()),
      3: isMuteScriptMode
        ? Boolean(selectedCharacterIds.length)
        : Boolean(normalizedScript.trim() && selectedPromptTemplateId && selectedCharacterIds.length && selectedCharactersHaveVoiceSelection),
      4: Boolean(selectedCharacters.length && selectedCharacterStyleId && selectedCharactersReady),
      5: Boolean(selectedStyleImageId),
    }),
    [
      hasSelectedContentType,
      hasSelectedAspectRatio,
      topic,
      normalizedScript,
      selectedPromptTemplateId,
      selectedCharacterIds,
      selectedCharactersHaveVoiceSelection,
      selectedCharacters.length,
      selectedCharacterStyleId,
      selectedCharactersReady,
      selectedStyleImageId,
      styleImages,
      isMuteScriptMode,
    ]
  );

  const stageStatus = useMemo(() => ({
    1: activeStage >= 2,
    2: activeStage >= 3,
    3: activeStage >= 4,
    4: stepCompleted[4] && activeStage >= 4,
    5: stepCompleted[5] && activeStage >= 5,
  }), [activeStage, stepCompleted]);

  const completion = useMemo(() => {
    const completedCount = Object.values(stageStatus).filter(Boolean).length;
    const total = Math.round((completedCount / 5) * 100);
    return { total, remaining: Math.max(0, 100 - total) };
  }, [stageStatus]);

  const step3GuideItems = useMemo(() => {
    const items = [
      normalizedScript.trim()
        ? `대본 준비 완료: ${sceneCount}문단으로 씬 분할이 가능합니다.`
        : '먼저 프롬프트로 대본을 만들거나 직접 입력해 주세요.',
      selectedPromptTemplateId
        ? '프롬프트 선택 완료: 지금 보이는 프롬프트로 바로 대본 생성이 가능합니다.'
        : '프롬프트를 하나 선택해야 AI 대본 생성 흐름이 자연스럽게 이어집니다.',
      constitutionAnalysis
        ? `채널 헌법 브리핑 준비 완료: 타겟 "${constitutionAnalysis.targetProfile.name}" 기준으로 제목과 구조가 정리되었습니다.`
        : '채널 헌법 분석형 프롬프트를 선택하면 타겟, 안전성, 제목 브리핑도 함께 받을 수 있습니다.',
      selectedCharacters.length
        ? `출연자 준비 완료: ${selectedCharacters.length}명을 씬 참조 이미지로 넘길 수 있습니다.`
        : '대본 기준 출연자 준비를 눌러 주인공/조연 카드를 먼저 채워 주세요.',
      selectedCharacterStyle
        ? `캐릭터 스타일 선택 완료: "${selectedCharacterStyle.label}" 기준으로 출연자 이미지를 다시 생성할 수 있습니다.`
        : '4단계에서 공통 캐릭터 스타일을 먼저 고르면 출연자 이미지 생성 흐름이 빨라집니다.',
      selectedStyle
        ? `최종 화풍 선택 완료: "${selectedStyle.label}"이 씬 전체 스타일로 연결됩니다.`
        : '5단계에서 최종 영상 화풍 1개를 고르면 바로 씬 제작으로 이어집니다.',
    ];
    return items;
  }, [normalizedScript, sceneCount, selectedPromptTemplateId, selectedCharacters.length, selectedCharacterStyle, selectedStyle, constitutionAnalysis]);

  const canOpenStage = (stage: StepId) => stage <= activeStage;

  const visibleStepIds = STEP_META
    .map((meta) => meta.id)
    .filter((stage) => stage <= activeStage && (!routeStep || stage === routeStep));

  const buildDraftPayload = (
    overrides?: Partial<Pick<WorkflowDraft, 'script' | 'extractedCharacters' | 'selectedCharacterIds' | 'scriptGenerationMeta'>>
  ) => {
    const resolvedScript = normalizeStoryText(overrides?.script ?? normalizedScript);
    const resolvedExtractedCharacters = overrides?.extractedCharacters || extractedCharacters;
    const resolvedSelectedCharacterIds = overrides?.selectedCharacterIds || effectiveSelectedCharacterIds;
    const resolvedScriptGenerationMeta = overrides?.scriptGenerationMeta ?? scriptGenerationMeta ?? null;
    const baseDraft = {
      ...workflowDraft,
      contentType,
      aspectRatio,
      topic: effectiveTopic,
      script: resolvedScript,
      activeStage,
      selections,
      extractedCharacters: resolvedExtractedCharacters,
      styleImages,
      characterImages: resolvedExtractedCharacters.flatMap((item) => item.generatedImages || []),
      selectedCharacterIds: resolvedSelectedCharacterIds,
      hasSelectedContentType,
      hasSelectedAspectRatio,
      selectedCharacterStyleId: selectedCharacterStyle?.id || null,
      selectedCharacterStyleLabel: selectedCharacterStyle?.label || '',
      selectedCharacterStylePrompt: selectedCharacterStyle?.prompt || '',
      selectedStyleImageId,
      referenceImages: workflowDraft?.referenceImages || DEFAULT_REFERENCE_IMAGES,
      promptPack,
      promptTemplates: syncedPromptTemplates,
      selectedPromptTemplateId,
      ttsProvider: projectVoiceProvider,
      elevenLabsVoiceId: workflowDraft?.elevenLabsVoiceId || studioState?.routing?.elevenLabsVoiceId || selectedProjectElevenVoice?.voice_id || null,
      elevenLabsModelId: workflowDraft?.elevenLabsModelId || studioState?.routing?.elevenLabsModelId || null,
      heygenVoiceId: workflowDraft?.heygenVoiceId || studioState?.routing?.heygenVoiceId || selectedProjectHeyGenVoice?.voice_id || null,
      qwenVoicePreset: workflowDraft?.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default',
      chatterboxVoicePreset: workflowDraft?.chatterboxVoicePreset || studioState?.routing?.chatterboxVoicePreset || 'chatterbox-clear',
      voiceReferenceAudioData: workflowDraft?.voiceReferenceAudioData || studioState?.routing?.voiceReferenceAudioData || null,
      voiceReferenceMimeType: workflowDraft?.voiceReferenceMimeType || studioState?.routing?.voiceReferenceMimeType || null,
      voiceReferenceName: workflowDraft?.voiceReferenceName || studioState?.routing?.voiceReferenceName || null,
      qwenStylePreset: workflowDraft?.qwenStylePreset || studioState?.routing?.qwenStylePreset || 'balanced',
      customScriptSettings: {
        expectedDurationMinutes: customScriptDurationMinutes,
        speechStyle: customScriptSpeechStyle,
        language: customScriptLanguage,
        referenceText: customScriptReferenceText,
        referenceLinks,
        scriptModel: selectedScriptGenerationModel,
      },
      scriptGenerationMeta: resolvedScriptGenerationMeta,
      constitutionAnalysis,
      completedSteps: {
        step1: Boolean(hasSelectedContentType && hasSelectedAspectRatio),
        step2: Boolean(effectiveTopic.trim()),
        step3: Boolean(resolvedScript.trim() && selectedPromptTemplateId && resolvedSelectedCharacterIds.length && selectedCharactersHaveVoiceSelection),
        step4: Boolean(selectedCharacters.length && selectedCharacterStyleId && selectedCharactersReady),
        step5: Boolean(selectedStyleImageId),
      },
    } as WorkflowDraft;
    const promptStore = buildWorkflowPromptStore({ draft: baseDraft });
    return {
      ...baseDraft,
      promptStore,
      stepContract: buildWorkflowStepContract({
        draft: {
          ...baseDraft,
          promptStore,
        },
        generationMeta: resolvedScriptGenerationMeta,
      }),
    };
  };

  const compactPromptExecutionText = (value?: string | null, max = 420) => {
    const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= max) return normalized;
    const sliced = normalized.slice(0, max).trim();
    const punctuationIndex = Math.max(
      sliced.lastIndexOf('.'),
      sliced.lastIndexOf('!'),
      sliced.lastIndexOf('?'),
      sliced.lastIndexOf(','),
      sliced.lastIndexOf(';'),
    );
    return `${(punctuationIndex > Math.floor(max * 0.55) ? sliced.slice(0, punctuationIndex + 1) : sliced).trim()}...`;
  };

  const buildRolePromptAddition = (label: string, bundle?: WorkflowRolePromptBundle | null, max = 420) => {
    if (!bundle) return '';
    const sectionSummary = bundle.sections
      ? Object.values(bundle.sections).filter(Boolean).join(' ')
      : '';
    const content = compactPromptExecutionText(bundle.finalPrompt || sectionSummary || bundle.basePrompt, max);
    return content ? `### ${label}\n- ${content}` : '';
  };

  const buildStep3PromptAdditions = (draftForExecution: WorkflowDraft) => {
    const rolePrompts = draftForExecution.promptStore?.rolePrompts
      || buildWorkflowPromptStore({ draft: draftForExecution }).rolePrompts
      || null;

    return [
      buildRolePromptAddition('SCRIPT ROLE', rolePrompts?.script, 720),
      buildRolePromptAddition('CHARACTER CONTINUITY', rolePrompts?.character, 380),
      buildRolePromptAddition('STYLE CONTINUITY', rolePrompts?.style, 300),
      buildRolePromptAddition('SCENE CONTINUITY', rolePrompts?.scene, 460),
      buildRolePromptAddition('MOUTH SHAPE / DELIVERY', rolePrompts?.video, 300),
      draftForExecution.script?.trim()
        ? `### STORY FOUNDATION\n- 현재 Step3 텍스트는 Step2에서 먼저 정리한 1차 스토리로 간주한다. 사건 순서, 감정선, 핵심 장면은 유지하고 ${draftForExecution.contentType === 'music_video' ? '그 스토리를 바탕으로 최종 가사만 새로 쓴다.' : '그 스토리를 바탕으로 최종 대본만 새로 쓴다.'}`
        : '',
    ].filter(Boolean);
  };

  const buildNavigationDraftPayload = (
    completedStage: StepId,
    nextStage?: StepId,
    overrides?: Partial<Pick<WorkflowDraft, 'script' | 'extractedCharacters' | 'selectedCharacterIds' | 'scriptGenerationMeta'>>
  ) => {
    const nextActiveStage = nextStage ? normalizeStage(nextStage) : activeStage;
    const payload = buildDraftPayload(overrides);
    const effectiveExtractedCharacters = payload.extractedCharacters;
    const effectiveSelectedCharacterIds = payload.selectedCharacterIds;
    const effectiveScript = payload.script || '';
    return {
      ...payload,
      extractedCharacters: effectiveExtractedCharacters,
      selectedCharacterIds: effectiveSelectedCharacterIds,
      activeStage: Math.max(payload.activeStage, nextActiveStage) as StepId,
      completedSteps: {
        ...payload.completedSteps,
        step1: completedStage >= 1 ? Boolean(hasSelectedContentType && hasSelectedAspectRatio) : payload.completedSteps.step1,
        step2: completedStage >= 2 ? Boolean(effectiveTopic.trim()) : payload.completedSteps.step2,
        step3: completedStage >= 3 ? Boolean(effectiveScript.trim() && selectedPromptTemplateId && effectiveSelectedCharacterIds.length && selectedCharactersHaveVoiceSelection) : payload.completedSteps.step3,
        step4: completedStage >= 4 ? Boolean(effectiveSelectedCharacterIds.length && selectedCharacterStyleId && selectedCharactersReady) : payload.completedSteps.step4,
        step5: completedStage >= 5 ? Boolean(selectedStyleImageId) : payload.completedSteps.step5,
      },
    };
  };

  const simulateProgress = (setter: React.Dispatch<React.SetStateAction<number>> | ((value: number) => void), doneAt = 94) => new Promise<void>((resolve) => {
    let progress = 0;
    setter(0);
    const timer = window.setInterval(() => {
      progress = Math.min(doneAt, progress + Math.max(6, Math.round(Math.random() * 18)));
      setter(progress);
      if (progress >= doneAt) {
        window.clearInterval(timer);
        resolve();
      }
    }, 120);
  });

  const createGenerationNonce = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const updateScriptGenerationProgress = (percent: number, message: string) => {
    setScriptGenerationProgress({
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message,
    });
  };
  const clearScriptGenerationProgress = () => setScriptGenerationProgress(null);

  const connectionSummary = {
    text: Boolean(studioState?.providers?.openRouterApiKey),
    audio: Boolean(studioState?.providers?.elevenLabsApiKey),
    video: false,
  };

  const selectedScriptModel = studioState?.routing?.scriptModel || SCRIPT_MODEL_OPTIONS[0].id;
  const selectedImageModel = studioState?.routing?.imageModel || IMAGE_MODELS[0].id;
  const textModelReady = connectionSummary.text;
  const imageModelReady = connectionSummary.text;
  const pendingDraftSaveReasonRef = useRef<'input' | 'action' | null>(null);
  const pendingDraftSaveTokenRef = useRef(0);

  const requestWorkflowDraftSave = (reason: 'input' | 'action' = 'action') => {
    latestLocalDraftMutationRef.current = Date.now();
    pendingDraftSaveReasonRef.current = reason;
    pendingDraftSaveTokenRef.current += 1;
  };

  const handleCustomScriptDurationChange = (value: number) => {
    setCustomScriptDurationMinutes(normalizeExpectedDurationMinutes(value));
    requestWorkflowDraftSave('action');
  };

  const handleInteractionCapture = (event: React.SyntheticEvent<HTMLElement>) => {
    const nativeEvent = event.nativeEvent as Event & { isTrusted?: boolean };
    if (nativeEvent?.isTrusted === false) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tagName = target.tagName.toLowerCase();
    const inputType = target instanceof HTMLInputElement ? `${target.type || ''}`.toLowerCase() : '';

    if (tagName === 'textarea') {
      requestWorkflowDraftSave('input');
      return;
    }

    if (tagName === 'input') {
      if (['checkbox', 'radio', 'file', 'range'].includes(inputType)) {
        requestWorkflowDraftSave('action');
        return;
      }
      if (!['button', 'submit', 'reset'].includes(inputType)) {
        requestWorkflowDraftSave('input');
        return;
      }
    }

    if (tagName === 'select' || tagName === 'button' || Boolean(target.closest('button'))) {
      requestWorkflowDraftSave('action');
    }
  };

  const promptTextAiSetup = (message?: string) => {
    onOpenApiModal?.({
      title: '이 기능은 텍스트 AI 연결이 필요합니다',
      description: message || 'Google AI Studio 키를 연결하면 대본 생성, 항목 추천, 캐릭터 / 화풍 추천이 실제 AI 결과로 바뀝니다.',
      focusField: 'openRouter',
    });
  };

  useEffect(() => {
    if (!onSaveWorkflowDraft) return;
    if (!pendingDraftSaveReasonRef.current) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);

    const saveReason = pendingDraftSaveReasonRef.current;
    const saveToken = pendingDraftSaveTokenRef.current;
    autoSaveTimer.current = window.setTimeout(() => {
      if (pendingDraftSaveTokenRef.current !== saveToken) return;
      onSaveWorkflowDraft(buildDraftPayload());
      pendingDraftSaveReasonRef.current = null;
    }, saveReason === 'input' ? 1000 : 180);

    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, [
    contentType,
    aspectRatio,
    topic,
    normalizedScript,
    activeStage,
    selections,
    extractedCharacters,
    styleImages,
    selectedCharacterIds,
    hasSelectedContentType,
    hasSelectedAspectRatio,
    selectedCharacterStyleId,
    selectedStyleImageId,
    scriptGenerationMeta,
    customScriptDurationMinutes,
    customScriptSpeechStyle,
    customScriptLanguage,
    customScriptReferenceText,
    referenceLinks,
    selectedScriptGenerationModel,
    promptPack,
    syncedPromptTemplates,
    selectedPromptTemplateId,
    projectVoiceProvider,
    studioState?.routing?.elevenLabsVoiceId,
    studioState?.routing?.elevenLabsModelId,
    studioState?.routing?.heygenVoiceId,
    studioState?.routing?.qwenVoicePreset,
    studioState?.routing?.qwenStylePreset,
    workflowDraft?.elevenLabsVoiceId,
    workflowDraft?.elevenLabsModelId,
    workflowDraft?.heygenVoiceId,
    workflowDraft?.qwenVoicePreset,
    workflowDraft?.qwenStylePreset,
    selectedProjectElevenVoice?.voice_id,
    selectedProjectHeyGenVoice?.voice_id,
    stepCompleted,
    onSaveWorkflowDraft,
  ]);

  const buildDefaultSelectionsForContentType = (nextContentType: ContentType) => {
    const defaults = FIELD_OPTIONS_BY_TYPE[nextContentType];
    return {
      genre: defaults.genre[0],
      mood: defaults.mood[0],
      endingTone: defaults.endingTone[0],
      setting: defaults.setting[0],
      protagonist: defaults.protagonist[0],
      conflict: defaults.conflict[0],
    };
  };

  const applyContentTypeSelection = (nextContentType: ContentType) => {
    const nextSelections = buildDefaultSelectionsForContentType(nextContentType);
    const nextPromptPack = buildWorkflowPromptPack({ contentType: nextContentType, topic: '', selections: EMPTY_STORY_SELECTIONS, script: '' });
    const nextTemplates = resolveWorkflowPromptTemplates(nextContentType, nextPromptPack, []);
    const defaultTemplateId = getDefaultWorkflowPromptTemplateId(nextContentType);

    setContentType(nextContentType);
    setHasSelectedContentType(true);
    setTopic(getTopicSuggestion(nextContentType, ''));
    setStoryScript('');
    setGenre(nextSelections.genre);
    setMood(nextSelections.mood);
    setEndingTone(nextSelections.endingTone);
    setSetting(nextSelections.setting);
    setProtagonist(nextSelections.protagonist);
    setConflict(nextSelections.conflict);
    setConstitutionAnalysis(null);
    setPromptTemplates(nextTemplates);
    setSelectedPromptTemplateId(defaultTemplateId);
    setPromptDetailId(defaultTemplateId);
    setEditingPromptId(null);
    setPromptPreviewId(null);
    setPromptPreviewDraft('');
    setScriptReferenceSuggestions([]);
    setSelectedCharacterStyleId(null);
    resetCharactersAndStyles();
    requestWorkflowDraftSave('action');
  };

  const clearContentTypeSelection = () => {
    setHasSelectedContentType(false);
    requestWorkflowDraftSave('action');
  };

  const applyAspectRatioSelection = (nextAspectRatio: AspectRatio) => {
    setAspectRatio(nextAspectRatio);
    setHasSelectedAspectRatio(true);
    requestWorkflowDraftSave('action');
  };

  const clearAspectRatioSelection = () => {
    setHasSelectedAspectRatio(false);
    requestWorkflowDraftSave('action');
  };

  const applyCharacterStyleSelection = (styleId: string | null) => {
    setSelectedCharacterStyleId(styleId);
    requestWorkflowDraftSave('action');
  };

  const clearSelectedCharacters = () => {
    selectedCharacterIdsRef.current = [];
    setSelectedCharacterIds([]);
  };

  const resetCharactersAndStyles = () => {
    setExtractedCharacters([]);
    setStyleImages([]);
    clearSelectedCharacters();
    setSelectedStyleImageId(null);
    setExpandedCharacterEditorId(null);
    setExpandedStyleEditorId(null);
    setCharacterCarouselIndices({});
    setCharacterLoadingProgress({});
    setStyleCarouselIndices({});
    setStyleLoadingProgress({});
    setNewCharacterName('');
    setNewCharacterPrompt('');
    setNewStyleName('');
    setNewStylePrompt('');
    autoRecommendSignatureRef.current = '';
  };

  const focusPromptTemplate = (templateId: string) => {
    setSelectedPromptTemplateId(templateId);
    setPromptDetailId(templateId);
    setEditingPromptId(null);
  };

  /**
   * 프롬프트 수정은 본문에서 바로 편집하지 않고 팝업에서만 진행합니다.
   * 실수로 본문 레이아웃이 흔들리는 문제를 막기 위한 구조입니다.
   */
  const openPromptEditor = (templateId: string) => {
    const target = syncedPromptTemplates.find((item) => item.id === templateId);
    if (!target) return;
    focusPromptTemplate(templateId);
    setEditingPromptId(templateId);
    setPromptEditorForm({
      name: target.name,
      description: target.description,
      prompt: target.prompt,
    });
  };

  const savePromptEditor = () => {
    if (!editingPromptId) return;
    updatePromptTemplate(editingPromptId, {
      prompt: promptEditorForm.prompt,
    });
    setEditingPromptId(null);
    setPromptPreviewId(null);
    requestWorkflowDraftSave('action');
    setNotice('프롬프트 수정을 저장했습니다. 이후 대본 생성과 씬 제작에 바로 반영됩니다.');
  };

  const restartFromStage = (stage: StepId) => {
    if (!canOpenStage(stage)) {
      setNotice(`${stage - 1}단계를 완료한 뒤 열 수 있습니다.`);
      return;
    }

    if (stage === 1) {
      const nextSelections = buildDefaultSelectionsForContentType(contentType);
      const nextPromptPack = buildWorkflowPromptPack({ contentType, topic: '', selections: EMPTY_STORY_SELECTIONS, script: '' });
      const nextTemplates = resolveWorkflowPromptTemplates(contentType, nextPromptPack, []);
      const defaultTemplateId = getDefaultWorkflowPromptTemplateId(contentType);
      setTopic(getTopicSuggestion(contentType, ''));
      setStoryScript('');
      setGenre(nextSelections.genre);
      setMood(nextSelections.mood);
      setEndingTone(nextSelections.endingTone);
      setSetting(nextSelections.setting);
      setProtagonist(nextSelections.protagonist);
      setConflict(nextSelections.conflict);
      setPromptTemplates(nextTemplates);
      setSelectedPromptTemplateId(defaultTemplateId);
      setPromptDetailId(defaultTemplateId);
      resetCharactersAndStyles();
      setActiveStage(1);
      openStageWithIntent(1);
      setNotice('1단계를 다시 열어 이후 단계를 초기화했습니다. 2단계부터 새로 진행해 주세요.');
      return;
    }

    if (stage === 2) {
      setStoryScript('');
      resetCharactersAndStyles();
      setActiveStage(2);
      openStageWithIntent(2);
      setNotice('2단계를 다시 열었습니다. 이후 단계는 숨기고 3단계부터 다시 진행합니다.');
      return;
    }

    if (stage === 3) {
      resetCharactersAndStyles();
      setActiveStage(3);
      openStageWithIntent(3);
      setNotice('3단계를 다시 열었습니다. 캐릭터 배정부터 다시 손보고, 4단계 캐릭터 설정과 5단계 화풍 선택을 다시 이어갈 수 있습니다.');
      return;
    }

    setActiveStage(4);
    openStageWithIntent(4);
  };

  const openExampleGuide = () => {
    if (connectionSummary.text) {
      fillSample();
      return;
    }
    setSampleGuideOpen(true);
  };

  const scrollStageIntoFocus = (stage: StepId) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-step-section="step-${stage}"]`);
      if (!target) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
      window.scrollTo({ top, behavior: 'smooth' });
    });
  };

  const scrollToStep3CastSelection = () => {
    const scrollToTarget = () => {
      const target = document.querySelector<HTMLElement>('[data-step3-cast-section]');
      if (!target) {
        return false;
      }

      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
      window.scrollTo({ top, behavior: 'smooth' });
      return true;
    };

    window.requestAnimationFrame(() => {
      if (scrollToTarget()) return;

      let attempt = 0;
      const maxAttempts = 12;

      const retry = () => {
        if (scrollToTarget()) return;
        attempt += 1;
        if (attempt >= maxAttempts) {
          scrollStageIntoFocus(3);
          return;
        }
        window.setTimeout(retry, 80);
      };

      window.setTimeout(retry, 60);
    });
  };

  useEffect(() => {
    if (!step3CastSelectionHighlightTick) return;

    let cancelled = false;
    let retryTimer: number | null = null;
    let attempt = 0;
    const maxAttempts = 14;

    const run = () => {
      if (cancelled) return;

      const target = document.querySelector<HTMLElement>('[data-step3-cast-section]');
      if (target) {
        const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
        window.scrollTo({ top, behavior: 'smooth' });
        return;
      }

      attempt += 1;
      if (attempt >= maxAttempts) {
        scrollStageIntoFocus(3);
        return;
      }

      retryTimer = window.setTimeout(run, 80);
    };

    const rafId = window.requestAnimationFrame(() => {
      retryTimer = window.setTimeout(run, 60);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [step3CastSelectionHighlightTick, openStage, extractedCharacters.length, selectedCharacterIds.length]);

  const openOnly = (stage: StepId) => {
    if (!canOpenStage(stage)) return;
    openStageWithIntent(stage);
    scrollStageIntoFocus(stage);
  };

  const toggleStage = (stage: StepId) => {
    if (!canOpenStage(stage)) {
      setNotice(`${stage - 1}단계를 완료한 뒤 열 수 있습니다.`);
      return;
    }
    if (stage < activeStage) {
      restartFromStage(stage);
      return;
    }
    openStageWithIntent(stage);
  };

  const persistCurrentDraft = async () => {
    if (!onSaveWorkflowDraft) return;
    await onSaveWorkflowDraft(buildDraftPayload());
  };

  const moveRouteStep = async (targetStep: 1 | 2 | 3 | 4 | 5) => {
    await persistCurrentDraft();
    await Promise.resolve(onNavigateStep?.(targetStep));
  };

  const goBackFromStep1 = () => {
    if (onGoBackFromStep1) {
      onGoBackFromStep1();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = `${basePath}?view=gallery`;
    }
  };

  const completeStage = async (stage: StepId, nextStage?: StepId) => {
    const messages: Record<StepId, string> = routeStep
      ? {
          1: '1단계에서 먼저 제작 유형과 화면 비율을 고른 뒤 2단계로 넘어가 주세요.',
          2: '2단계에서 주제와 핵심 선택값을 채워 프롬프트 / 대본 방향을 먼저 고정해 주세요.',
          3: '3단계에서는 프롬프트를 고르고 대본을 준비해야 4단계 캐릭터 생성으로 넘어갈 수 있습니다.',
          4: '4단계에서는 출연자 선택과 공통 캐릭터 느낌만 확정하면 5단계 화풍 선택으로 넘어갈 수 있습니다.',
          5: '5단계에서는 최종 영상 화풍을 1개 선택한 뒤 프로젝트에 저장하고 씬 제작으로 넘어갈 수 있습니다.',
        }
      : {
          1: '1단계에서 먼저 제작 유형과 화면 비율을 고른 뒤 2단계로 넘어가 주세요.',
          2: '2단계에서 주제와 핵심 선택값을 채워 프롬프트 / 대본 방향을 먼저 고정해 주세요.',
          3: '3단계에서 프롬프트와 대본을 만든 뒤, 대본 기준 출연자 준비와 출연자 선택까지 마쳐 주세요.',
          4: '4단계에서는 출연자 선택과 공통 캐릭터 느낌을 확정해 주세요.',
          5: '5단계에서는 최종 영상 화풍을 확인한 뒤 씬 제작으로 넘어가 주세요.',
        };
    const completionMap = routeStep ? routeStepCompleted : stepCompleted;

    if (!completionMap[stage]) {
      if (stage === 3 && isMuteScriptMode && !selectedCharacterIds.length) {
        setStep3CastSelectionHighlightTick((prev) => prev + 1);
        setNotice('무음 콘텐츠는 대본 없이 진행할 수 있습니다. 아래에서 출연자를 1명 이상 추가하거나 선택해 주세요.');
        openOnly(3);
        scrollToStep3CastSelection();
        return false;
      }
      if (stage === 3 && normalizedScript.trim() && !selectedCharacterIds.length) {
        setStep3CastSelectionHighlightTick((prev) => prev + 1);
        setNotice('대본은 준비되었습니다. 아래 출연자 선택에서 Step4로 넘길 출연자를 1명 이상 골라 주세요. 선택 위치까지 바로 내려갑니다.');
        openOnly(3);
        scrollToStep3CastSelection();
        return false;
      }
      if (stage === 3 && !isMuteScriptMode && normalizedScript.trim() && selectedCharacterIds.length && !selectedCharactersHaveVoiceSelection) {
        setStep3CastSelectionHighlightTick((prev) => prev + 1);
        setNotice('선택한 출연자의 TTS 설정을 먼저 골라 주세요. 출연자 카드 위치까지 바로 이동합니다.');
        openOnly(3);
        scrollToStep3CastSelection();
        return false;
      }
      setNotice(messages[stage]);
      openOnly(stage);
      scrollStageIntoFocus(stage);
      return false;
    }

    if (nextStage) {
      const nextActiveStage = normalizeStage(nextStage);
      let navigationOverrides: Partial<Pick<WorkflowDraft, 'script' | 'extractedCharacters' | 'selectedCharacterIds' | 'scriptGenerationMeta'>> | undefined;
      if (stage === 2 && nextActiveStage === 3 && !normalizedScript.trim()) {
        applyGeneratedStoryScript(seededStep2StoryDraft);
        setScriptGenerationMeta(null);
        navigationOverrides = {
          ...navigationOverrides,
          script: normalizeStoryText(formatStoryTextForEditor(seededStep2StoryDraft)),
          scriptGenerationMeta: null,
        };
      }
      if (stage === 3 && nextActiveStage === 4) {
        const currentSelectedIds = selectedCharacterIds.filter((characterId) => extractedCharacters.some((character) => character.id === characterId));
        if (extractedCharacters.length && currentSelectedIds.length) {
          navigationOverrides = {
            ...navigationOverrides,
            extractedCharacters,
            selectedCharacterIds: currentSelectedIds,
          };
        } else {
          const hydrated = await hydrateCharactersForScript({ preserveSelection: true });
          if (hydrated) {
            navigationOverrides = {
              ...navigationOverrides,
              extractedCharacters: hydrated.characters,
              selectedCharacterIds: hydrated.selectedIds,
            };
          }
        }
      }
      const navigationDraftPayload = buildNavigationDraftPayload(stage, nextStage, navigationOverrides);
      if (onSaveWorkflowDraft) {
        await Promise.resolve(onSaveWorkflowDraft(navigationDraftPayload));
      }
      setNotice(stage === 2 && nextActiveStage === 3 && !normalizedScript.trim()
        ? '2단계 완료. 3단계로 이동하며 1차 스토리를 먼저 채워 두었습니다.'
        : `${stage}단계 완료. ${nextStage}단계로 이동합니다.`);
      if (routeStep) {
        await Promise.resolve(onNavigateStep?.(nextStage as 1 | 2 | 3 | 4 | 5));
        return true;
      }
      setActiveStage((prev) => Math.max(prev, nextActiveStage) as StepId);
      openStageWithIntent(nextActiveStage);
      await Promise.resolve(onNavigateStep?.(nextStage as 1 | 2 | 3 | 4 | 5));
      return true;
    }

    if (onSaveWorkflowDraft) {
      await onSaveWorkflowDraft(buildNavigationDraftPayload(stage));
    }
    setNotice(`${stage}단계 완료.`);
    setActiveStage((prev) => Math.max(prev, stage) as StepId);
    openStageWithIntent(stage);
    return true;
  };

  /**
   * 스토리 빌더는 요청에 맞춰 "예시로 채우기"를 핵심 진입점으로 유지합니다.
   * 전체 AI 일괄 추천 버튼은 제거하고, 필요한 경우 필드별 추천만 남깁니다.
   */
  const fillSample = () => {
    if (contentType === 'music_video') {
      setTopic('새벽 네온 아래 다시 시작되는 후렴');
      setGenre('시네마틱 발라드');
      setMood('몽환적인');
      setEndingTone('쓸쓸하지만 아름다운 마감');
      setSetting('비 오는 옥상');
      setProtagonist('무대를 떠난 보컬');
      setConflict('전하지 못한 마음');
      applyGeneratedStoryScript(
        normalizeStoryText(`
[Intro]
젖은 옥상 끝에 서서 밤의 숨을 세어
아직 못 보낸 말이 입술에 남아 있어

[Verse 1]
네온은 흔들리고 빗방울은 박자를 만들고
멈춘 줄 알았던 기억이 다시 어깨를 두드려
뒤돌면 끝날 것 같아서 더 천천히 걷고
사라진 너의 이름만 마음속에서 선명해져

[Chorus]
오늘의 나는 어제의 나를 지나
후렴처럼 너를 다시 불러
대답 없는 밤이어도 괜찮아
이 마음은 끝이 아니라 반전이니까

[Verse 2]
젖은 계단 아래로 도시의 불빛이 흘러내리고
숨겨 둔 후회들이 한 줄씩 노래가 되어
끝내 누르지 못한 메시지 창을 열어 둔 채
나는 같은 밤을 다른 표정으로 건너가

[Outro]
답장은 아직 없어도 발끝은 가벼워지고
같은 후렴이지만 이번엔 나를 먼저 안아`)
      );
      setNotice('뮤직비디오 샘플을 가사 구조로 채웠습니다. 각 블록이 그대로 씬 후보가 됩니다.');
      openOnly(3);
      return;
    }


    if (contentType === 'cinematic') {
      setTopic('비 오는 도시 골목에서 다시 마주친 마지막 약속');
      setGenre('시네마틱 드라마');
      setMood('몰입감 있는');
      setEndingTone('긴 여운으로 마무리');
      setSetting('비 내리는 도시 골목');
      setProtagonist('과거를 숨긴 주인공');
      setConflict('되돌릴 수 없는 선택의 대가');
      applyGeneratedStoryScript(
        normalizeStoryText(`비가 천천히 내려앉는 도시 골목에서 주인공은 오래전 끝난 줄 알았던 약속의 흔적을 다시 발견한다. 익숙한 장소인데도 오늘 밤만큼은 모든 것이 낯설게 보인다.

희미한 네온 아래로 스쳐 가는 사람들 사이에서 그는 자신이 외면해 온 이름을 다시 듣게 되고, 사라졌던 관계가 아직 끝나지 않았다는 사실을 깨닫는다.

골목 끝에서 마주한 상대는 같은 약속을 전혀 다른 이유로 기억하고 있었고, 둘 사이에 남아 있던 오해와 침묵이 한 장면씩 벗겨지기 시작한다.

마지막 순간, 주인공은 그날 밤의 진실을 받아들일지 다시 도망칠지 선택해야 한다. 화면은 대답 대신 오래 남는 표정 하나를 붙잡으며 끝난다.`)
      );
      setNotice('영화 샘플을 채웠습니다. 문단마다 장면 중심의 시네마틱 컷으로 이어집니다.');
      openOnly(3);
      return;
    }

    if (contentType === 'info_delivery') {
      setTopic('도시 재개발과 생활권 변화를 둘러싼 오늘의 쟁점');
      setGenre('정보 전달');
      setMood('정돈된');
      setEndingTone('핵심 요약으로 마무리');
      setSetting('설명형 보드');
      setProtagonist('설명자');
      setConflict('데이터와 체감의 차이');
      applyGeneratedStoryScript(
        normalizeStoryText(`오늘의 핵심 이슈는 도시 재개발 계획과 생활권 변화가 어떻게 연결되는지 이해하는 것이다. 첫 장면에서 전체 흐름을 짧게 짚고 시작한다.

이어지는 장면에서는 사업 일정과 예산, 주민 반응이 순서대로 정리되며 왜 이 사안이 빠르게 주목받는지 설명한다.

중간 장면에서는 통계 자료와 인터뷰를 함께 보여 주며 숫자로 보이는 변화와 실제 체감 사이의 간극을 쉽게 풀어 준다.

마지막 장면에서는 시청자가 기억해야 할 핵심 세 가지를 짧게 정리하고, 다음에 확인할 포인트를 안내한다.`)
      );
      setNotice('정보 전달 샘플을 채웠습니다. 문단마다 설명형 컷으로 이어집니다.');
      openOnly(3);
      return;
    }

    setTopic('새벽 편의점 불빛 아래 다시 시작되는 선택');
    setGenre('드라마');
    setMood('감성적인');
    setEndingTone('희망적인 결말');
    setSetting('새벽의 편의점');
    setProtagonist('초보 창작자');
    setConflict('잊고 있던 약속');
    applyGeneratedStoryScript(
      normalizeStoryText(`새벽의 편의점 앞, 주인공은 하루를 끝낸 표정으로 서 있지만 사실 오늘만큼은 그냥 지나칠 수 없는 밤이라는 것을 알고 있다.\n\n계산대 옆 작은 메모 하나가 눈에 들어오고, 그는 오래전에 미뤄 둔 약속이 아직 끝나지 않았다는 사실을 떠올린다.\n\n평소라면 고개를 돌렸겠지만, 이번에는 발걸음을 멈춘 채 스스로가 도망치던 이유를 처음으로 인정한다.\n\n문이 닫히기 직전, 그는 메시지를 보내고 아주 작은 선택 하나가 앞으로의 시간을 바꾸기 시작한다.\n\n마지막 장면에서 주인공은 혼자가 아니게 된 표정으로 골목을 걸어가며, 같은 밤이 전과 다른 공기로 보이기 시작한다.`)
    );
    setNotice('스토리 샘플을 채웠습니다. 이제 프롬프트를 고르고 바로 대본을 다듬을 수 있습니다.');
    openOnly(3);
  };

  const refreshTopicRecommendation = async () => {
    if (!connectionSummary.text) {
      setNotice('AI 미연결 상태라 샘플 추천으로 주제를 제안합니다.');
    }
    setIsRefreshingTopic(true);
    try {
      const recommended = await recommendTopicCandidatesFromInput({
        contentType,
        inputText: topic,
        count: 5,
        model: studioState?.routing?.scriptModel,
        allowAi: connectionSummary.text,
        scriptLanguage: customScriptLanguage,
      });
      setTopicRecommendations(recommended);
      setNotice(connectionSummary.text ? '입력한 텍스트를 기준으로 추천 주제 목록을 갱신했습니다. 원하는 항목을 클릭해 적용하세요.' : '샘플 추천 주제 목록을 갱신했습니다. 원하는 항목을 클릭해 적용하세요.');
    } finally {
      setIsRefreshingTopic(false);
    }
  };

  useEffect(() => {
    const isStep2Open = routeStep ? routeStep === 2 : openStage === 2;
    if (!isStep2Open) return;
    if (topicRecommendations.length > 0) return;
    if (isRefreshingTopic) return;
    if (step2AutoRecommendDoneRef.current) return;
    step2AutoRecommendDoneRef.current = true;
    void refreshTopicRecommendation();
  }, [routeStep, openStage, topicRecommendations.length, isRefreshingTopic]);

  useEffect(() => {
    const isStep3Open = routeStep ? routeStep === 3 : openStage === 3;
    if (!isStep3Open) return;
    if (scriptReferenceSuggestions.length) return;
    setScriptReferenceSuggestions(buildScriptReferenceSuggestionSet());
  }, [routeStep, openStage, topic, customScriptDurationMinutes, customScriptLanguage, scriptReferenceSuggestions.length]);

  useEffect(() => {
    if (contentType === 'music_video') return;
    if (!selectedCharacterIds.length) return;
    setExtractedCharacters((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (!selectedCharacterIds.includes(item.id) || item.voiceProvider) return item;
        changed = true;
        return { ...item, ...buildCharacterVoicePatch('project-default') };
      });
      return changed ? next : prev;
    });
  }, [contentType, selectedCharacterIds.join('::')]);

  useEffect(() => {
    const validCharacterIds = new Set(extractedCharacters.map((item) => item.id));
    setSelectedCharacterIds((prev) => {
      const next = prev.filter((id) => validCharacterIds.has(id));
      if (next.length !== prev.length) {
        selectedCharacterIdsRef.current = next;
      }
      return next.length === prev.length ? prev : next;
    });
  }, [extractedCharacters]);

  useEffect(() => {
    const isStep3Open = routeStep ? routeStep === 3 : openStage === 3;
    if (!isStep3Open) return;
    if (!extractedCharacters.length) return;
    if (selectedCharacterIds.length) return;

    const signature = extractedCharacters.map((item) => item.id).join('::');
    if (!signature) return;
    autoSelectedCharacterSignatureRef.current = signature;
  }, [routeStep, openStage, extractedCharacters, selectedCharacterIds.length]);

  const refreshField = async (field: keyof StorySelectionState) => {
    if (!connectionSummary.text) {
      promptTextAiSetup('현재 항목 추천은 샘플 보조 모드로 동작 중입니다. Google AI Studio를 연결하면 이 자리에서 실제 AI 추천을 바로 받을 수 있습니다.');
    }
    setLoadingFields((prev) => ({ ...prev, [field]: true }));
    try {
      const nextValue = await recommendStoryField({ field, contentType, topic, model: studioState?.routing?.scriptModel });
      ({ genre: setGenre, mood: setMood, endingTone: setEndingTone, setting: setSetting, protagonist: setProtagonist, conflict: setConflict } as const)[field](nextValue);
      setNotice(`${fieldConfigs.find((item) => item.key === field)?.label || '항목'} 추천값을 현재 주제에 맞는 텍스트로 채웠습니다.`);
    } finally {
      setLoadingFields((prev) => ({ ...prev, [field]: false }));
    }
  };

  const createDraftFromSelections = () => {
    applyGeneratedStoryScript(seededStep2StoryDraft);
    setScriptGenerationMeta(null);
    requestWorkflowDraftSave('action');
    setNotice('선택값으로 Step3용 1차 스토리를 먼저 채워 두었습니다.');
    openStageWithIntent(3, false);
  };

  const refreshScriptReferenceSuggestions = () => {
    setScriptReferenceSuggestions(buildScriptReferenceSuggestionSet());
    setNotice('대본 참고 추천 문장을 새로 불러왔습니다. 필요한 문장을 눌러 바로 합칠 수 있습니다.');
  };

  const applyScriptReferenceSuggestion = (value: string) => {
    const nextValue = [customScriptReferenceText.trim(), value.trim()].filter(Boolean).join('\n');
    setCustomScriptReferenceText(nextValue);
  };

  const toggleReferenceLinkInput = () => {
    setShowReferenceLinkInput((prev) => {
      const next = !prev;
      if (!next && !pendingReferenceLinkUrl.trim()) {
        setPendingReferenceLinkUrl('');
      }
      return next;
    });
  };

  const removeReferenceLink = (id: string) => {
    setReferenceLinks((prev) => prev.filter((item) => item.id !== id));
  };

  const addReferenceLink = async () => {
    const raw = pendingReferenceLinkUrl.trim();
    if (!raw) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw);
    } catch {
      setNotice('올바른 링크 주소를 입력해 주세요. http 또는 https 주소여야 합니다.');
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const kind: ReferenceLinkDraft['kind'] = host.includes('youtube.com') || host.includes('youtu.be') ? 'youtube' : 'web';
    const draftItem: ReferenceLinkDraft = {
      id: `reference_link_${Date.now()}`,
      url: parsedUrl.toString(),
      kind,
      status: 'loading',
      addedAt: Date.now(),
    };

    setIsAddingReferenceLink(true);
    setReferenceLinks((prev) => [draftItem, ...prev]);
    setPendingReferenceLinkUrl('');
    setShowReferenceLinkInput(false);

    try {
      const response = await fetch('/api/mp4Creater/reference-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: draftItem.url }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || '링크 분석에 실패했습니다.');

      setReferenceLinks((prev) => prev.map((item) => item.id === draftItem.id ? {
        ...item,
        title: payload.title || item.url,
        sourceText: payload.sourceText || '',
        summary: payload.summary || '',
        status: 'ready',
        error: null,
      } : item));
      setNotice(kind === 'youtube' ? '유튜브 링크를 분석해 대본 참고자료에 추가했습니다.' : '웹사이트 글을 분석해 대본 참고자료에 추가했습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '링크 분석에 실패했습니다.';
      setReferenceLinks((prev) => prev.map((item) => item.id === draftItem.id ? { ...item, status: 'error', error: message } : item));
      setNotice(message);
    } finally {
      setIsAddingReferenceLink(false);
    }
  };

  const handleGenerateScriptClick = () => {
    if (isMuteScriptMode) {
      setNotice('무음 콘텐츠는 대본을 작성할 수 없습니다. 아래에서 출연자를 추가하거나 선택해 다음 단계로 진행해 주세요.');
      openOnly(3);
      scrollToStep3CastSelection();
      return;
    }

    const targetTemplate = selectedPromptTemplate || syncedPromptTemplates[0];
    const hasExistingScript = Boolean(normalizedScript.trim());
    const isNoAiScriptMode = selectedScriptGenerationModel === NO_AI_SCRIPT_MODEL_ID;
    const shouldGenerateSampleImmediately = !connectionSummary.text || isNoAiScriptMode;
    const shouldUseStoryFoundationDirectly = hasExistingScript && !scriptGenerationMeta?.generatedAt;

    if (shouldGenerateSampleImmediately || !hasExistingScript || shouldUseStoryFoundationDirectly) {
      void generateScriptByPrompt(targetTemplate?.mode === 'dialogue', targetTemplate);
      return;
    }

    setScriptGenerationConfirmOpen(true);
  };

  const confirmGenerateScriptOverwrite = () => {
    const targetTemplate = selectedPromptTemplate || syncedPromptTemplates[0];
    setScriptGenerationConfirmOpen(false);
    void generateScriptByPrompt(targetTemplate?.mode === 'dialogue', targetTemplate);
  };


  const extendScriptByChars = async (chars: number) => {
    const targetTemplate = selectedPromptTemplate || syncedPromptTemplates[0];
    if (!targetTemplate) return;
    if (!normalizedScript.trim()) {
      setNotice('먼저 대본을 생성하거나 직접 입력한 뒤 확장해 주세요.');
      openOnly(3);
      return;
    }
    if (!connectionSummary.text) {
      promptTextAiSetup('현재 대본 확장은 샘플 보조 모드도 지원합니다. Google AI Studio를 연결하면 지금 작성된 대본을 더 자연스럽게 이어서 확장할 수 있습니다.');
    }
    focusPromptTemplate(targetTemplate.id);
    setIsGeneratingScript(true);
    updateScriptGenerationProgress(6, 'Preparing the current draft for expansion.');
    try {
      const executionDraft = buildDraftPayload();
      const result = await composeScriptDraft({
        contentType,
        topic: effectiveTopic,
        selections,
        template: targetTemplate,
        currentScript: normalizedScript,
        promptAdditions: buildStep3PromptAdditions(executionDraft),
        model: selectedScriptGenerationModel,
        conversationMode: targetTemplate.mode === 'dialogue',
        generationIntent: 'expand',
        expandByChars: chars,
        generationNonce: createGenerationNonce(),
        onProgress: ({ percent, message }) => updateScriptGenerationProgress(percent, message),
        customSettings: {
          expectedDurationMinutes: customScriptDurationMinutes,
          speechStyle: customScriptSpeechStyle,
          language: customScriptLanguage,
          referenceText: combinedReferenceText,
          referenceLinks,
          scriptModel: selectedScriptGenerationModel,
        },
      });
      const nextScript = result.text || normalizedScript;
      setScriptGenerationMeta(buildWorkflowScriptGenerationMeta({
        draft: {
          ...executionDraft,
          script: nextScript,
        },
        source: result.source,
        intent: 'expand',
        conversationMode: targetTemplate.mode === 'dialogue',
        usedSampleFallback: result.source !== 'ai',
      }));
      applyGeneratedStoryScript(nextScript);
      requestWorkflowDraftSave('action');
      setConstitutionAnalysis(result.analysis || null);
      await hydrateCharactersFromScriptText(nextScript, { preserveSelection: false });
      setNotice(result.source === 'ai'
        ? `현재 대본을 약 ${chars}자 확장했습니다. 기존 내용을 유지한 채 뒤를 자연스럽게 이어 붙였습니다.`
        : contentType === 'music_video'
          ? `샘플 보조 모드로 현재 가사를 약 ${chars}자 확장했습니다. 기존 블록 뒤에 새 가사 블록을 이어 붙였습니다.`
          : `샘플 보조 모드로 현재 대본을 약 ${chars}자 확장했습니다. 기존 문단 뒤에 새 문단을 이어 붙였습니다.`);
      openStageWithIntent(3, false);
    } finally {
      setIsGeneratingScript(false);
      clearScriptGenerationProgress();
    }
  };

  const ensureProjectPromptTemplate = () => {
    const base = selectedPromptTemplate || syncedPromptTemplates[0];
    if (!base) return null;

    if (!base.builtIn) {
      focusPromptTemplate(base.id);
      return base;
    }

    const projectTemplateId = `project_prompt_${base.id}`;
    const existingCopied = syncedPromptTemplates.find(
      (item) => item.id === projectTemplateId
    );
    if (existingCopied) {
      focusPromptTemplate(existingCopied.id);
      return existingCopied;
    }

    const copied: WorkflowPromptTemplate = {
      id: projectTemplateId,
      name: `${base.name} (프로젝트)`,
      description: '이 프로젝트 전용 프롬프트',
      prompt: base.prompt,
      mode: base.mode,
      builtIn: false,
      basePrompt: base.basePrompt || base.prompt,
      engine: base.engine || 'default',
      isCustomized: true,
      updatedAt: Date.now(),
    };
    setPromptTemplates((prev) => [...prev.filter((item) => item.id !== projectTemplateId), copied]);
    focusPromptTemplate(copied.id);
    setNotice('1단계 콘셉트 프롬프트를 이 프로젝트 전용 복사본으로 가져왔습니다. 이제 이 프로젝트에서만 수정됩니다.');
    return copied;
  };

  useEffect(() => {
    if (!promptPreviewId) return;
    const target = syncedPromptTemplates.find((item) => item.id === promptPreviewId);
    setPromptPreviewDraft(target?.prompt || '');
  }, [promptPreviewId, syncedPromptTemplates]);

  const generateScriptByPrompt = async (conversationMode = false, templateOverride?: WorkflowPromptTemplate) => {
    const template = templateOverride || selectedPromptTemplate || syncedPromptTemplates[0] || {
      id: 'sample-script-fallback-template',
      name: '기본 샘플 프롬프트',
      description: 'API 미연결 상태에서도 Step 3 샘플 대본을 즉시 만들기 위한 내부 기본 프롬프트입니다.',
      prompt: '현재 선택된 콘텐츠 유형, 주제, 분위기, 예상 길이에 맞춰 바로 읽을 수 있는 영상용 샘플 대본을 작성한다.',
      mode: 'narration' as const,
      updatedAt: Date.now(),
    };
    if (isMuteScriptMode) return;
    const isNoAiScriptMode = selectedScriptGenerationModel === NO_AI_SCRIPT_MODEL_ID;
    const hasTextApiConnection = connectionSummary.text && !isNoAiScriptMode;
    if (!hasTextApiConnection) {
      promptTextAiSetup(isNoAiScriptMode
        ? '현재 AI 모델 없음 모드가 선택되어 있어 샘플 대본을 바로 만듭니다. 실제 AI 대본을 쓰려면 모델을 바꿔 주세요.'
        : '현재 대본 생성은 샘플 보조 모드입니다. Google AI Studio를 연결하면 이 자리에서 실제 AI 대본 초안을 바로 받을 수 있습니다.');
    }
    if (template.id !== 'sample-script-fallback-template') {
      focusPromptTemplate(template.id);
    }
    const generationSettings = {
      expectedDurationMinutes: customScriptDurationMinutes,
      speechStyle: customScriptSpeechStyle,
      language: customScriptLanguage,
      referenceText: combinedReferenceText,
      referenceLinks,
      scriptModel: selectedScriptGenerationModel,
    };
    const sourceStoryFoundation = shouldUseCurrentStoryFoundation ? normalizedScript : '';
    const executionDraft = buildDraftPayload({ script: sourceStoryFoundation || normalizedScript });
    const promptAdditions = buildStep3PromptAdditions(executionDraft);
    const sampleDraft = buildSampleScriptDraft({
      contentType,
      topic: effectiveTopic,
      selections,
      template,
      currentScript: sourceStoryFoundation,
      promptAdditions,
      model: selectedScriptGenerationModel,
      conversationMode,
      generationNonce: createGenerationNonce(),
      customSettings: generationSettings,
    });

    openStageWithIntent(3, false);

    const applySampleFallback = async (message: string) => {
      updateScriptGenerationProgress(100, 'Sample script is ready.');
      setScriptGenerationMeta(buildWorkflowScriptGenerationMeta({
        draft: {
          ...executionDraft,
          script: sampleDraft,
        },
        source: 'sample',
        intent: 'draft',
        conversationMode,
        usedSampleFallback: true,
      }));
      applyGeneratedStoryScript(sampleDraft);
      requestWorkflowDraftSave('action');
      setConstitutionAnalysis(null);
      try {
        await hydrateCharactersFromScriptText(sampleDraft, { preserveSelection: false, forceSample: true });
      } catch {}
      setNotice(message);
      openStageWithIntent(3, false);
    };

    if (!hasTextApiConnection) {
      setIsGeneratingScript(true);
      updateScriptGenerationProgress(12, 'Preparing the sample script.');
      try {
        await applySampleFallback(isNoAiScriptMode
          ? 'AI 모델 없음이 선택되어 Step 3 샘플 대본을 바로 채웠습니다. 모델을 바꾸면 실제 AI 생성으로 전환됩니다.'
          : 'AI 연결이 없어 Step 3 샘플 대본을 바로 채웠습니다. 설정을 연결하면 같은 버튼에서 실제 AI 대본으로 바뀝니다.');
      } finally {
        setIsGeneratingScript(false);
        clearScriptGenerationProgress();
      }
      return;
    }

    setIsGeneratingScript(true);
    updateScriptGenerationProgress(8, 'Preparing the AI script request.');
    try {
      const result = await composeScriptDraft({
        contentType,
        topic: effectiveTopic,
        selections,
        template,
        currentScript: sourceStoryFoundation,
        promptAdditions,
        model: selectedScriptGenerationModel,
        conversationMode,
        generationNonce: createGenerationNonce(),
        onProgress: ({ percent, message }) => updateScriptGenerationProgress(percent, message),
        customSettings: generationSettings,
      });
      const nextScript = (result.text || '').trim() ? result.text : sampleDraft;
      setScriptGenerationMeta(buildWorkflowScriptGenerationMeta({
        draft: {
          ...executionDraft,
          script: nextScript,
        },
        source: result.source,
        intent: 'draft',
        conversationMode,
        usedSampleFallback: result.source !== 'ai',
      }));
      applyGeneratedStoryScript(nextScript);
      requestWorkflowDraftSave('action');
      setConstitutionAnalysis(result.analysis || null);
      await hydrateCharactersFromScriptText(nextScript, { preserveSelection: false, forceSample: result.source !== 'ai' });
      setNotice(result.source === 'ai' ? `선택한 프롬프트 "${template.name}"로 AI 초안을 만들었습니다.` : 'AI 연결 상태를 확인할 수 없어 Step 3 샘플 대본으로 안전하게 채웠습니다. 설정을 다시 연결하면 실제 AI 생성으로 전환됩니다.');
      openStageWithIntent(3, false);
    } catch {
      await applySampleFallback('AI 연결 호출이 실패해도 Step 3 샘플 대본은 바로 나오도록 보정했습니다. 지금은 샘플 대본으로 채워졌습니다.');
    } finally {
      setIsGeneratingScript(false);
      clearScriptGenerationProgress();
    }
  };

  const hydrateCharactersFromScriptText = async (
    scriptText: string,
    options?: { forceSample?: boolean; preserveSelection?: boolean }
  ): Promise<{ characters: CharacterProfile[]; selectedIds: string[] } | null> => {
    const normalizedText = normalizeStoryText(scriptText || '');
    if (!normalizedText.trim()) {
      setNotice('먼저 3단계에서 대본을 입력하거나 생성해 주세요.');
      openOnly(3);
      return null;
    }

    const forceSample = Boolean(options?.forceSample);
    const allowAi = !forceSample && Boolean(studioState?.providers?.openRouterApiKey);
    if (!allowAi && !forceSample) {
      promptTextAiSetup('캐릭터 추출은 지금 샘플 보조 모드로도 테스트할 수 있습니다. Google AI Studio를 연결하면 대본 속 역할을 더 정교하게 추출합니다.');
    }

    if (!options?.preserveSelection) {
      clearSelectedCharacters();
    }

    setIsExtracting(true);
    try {
      const nextCharacters = await extractCharactersFromScript({
        script: normalizedText,
        selections,
        contentType,
        model: selectedScriptModel,
        allowAi,
        styleLabel: selectedStyle?.label || selectedStyle?.groupLabel || selectedCharacterStyle?.label || '',
        stylePrompt: selectedStyle?.prompt || selectedCharacterStyle?.prompt || '',
        language: customScriptLanguage,
      });

      const normalizedCharacterName = (character: CharacterProfile) => (character.name || '').trim().toLowerCase();
      const normalizedCharacterKey = (character: CharacterProfile) => `${normalizedCharacterName(character)}::${character.role || ''}`;
      const previousCharacters = Array.isArray(extractedCharacters) ? extractedCharacters : [];
      const previousCharacterByKey = new Map(
        previousCharacters
          .map((item) => [normalizedCharacterKey(item), item] as const)
          .filter(([key]) => Boolean(key))
      );
      const previousCharacterByName = new Map(
        previousCharacters
          .map((item) => [normalizedCharacterName(item), item] as const)
          .filter(([key]) => Boolean(key))
      );
      const previouslySelectedCharacters = options?.preserveSelection
        ? previousCharacters.filter((item) => selectedCharacterIds.includes(item.id))
        : [];
      const previouslySelectedKeys = new Set(
        previouslySelectedCharacters
          .map((item) => normalizedCharacterKey(item))
          .filter(Boolean)
      );
      const previouslySelectedNames = new Set(
        previouslySelectedCharacters
          .map((item) => normalizedCharacterName(item))
          .filter(Boolean)
      );
      const preservedIds = options?.preserveSelection
        ? nextCharacters
            .filter((item) => previouslySelectedKeys.has(normalizedCharacterKey(item)) || previouslySelectedNames.has(normalizedCharacterName(item)))
            .map((item) => item.id)
        : [];
      const nextSelectedIds = preservedIds.length ? preservedIds : [];
      const normalizedCharacters = nextCharacters.map((item) => {
        const previousCharacter = previousCharacterByKey.get(normalizedCharacterKey(item))
          || previousCharacterByName.get(normalizedCharacterName(item))
          || null;
        const preservedGeneratedImages = Array.isArray(previousCharacter?.generatedImages) ? previousCharacter.generatedImages : [];
        const preservedSelectedImageId = previousCharacter?.selectedImageId || null;
        const preservedSelectedImage = preservedGeneratedImages.find((image) => image.id === preservedSelectedImageId) || preservedGeneratedImages[0] || null;
        const nextCharacter: CharacterProfile = {
          ...item,
          prompt: previousCharacter?.prompt || item.prompt,
          visualStyle: previousCharacter?.visualStyle || item.visualStyle,
          voiceHint: previousCharacter?.voiceHint,
          voiceProvider: previousCharacter?.voiceProvider,
          voiceId: previousCharacter?.voiceId,
          voiceName: previousCharacter?.voiceName,
          voicePreviewUrl: previousCharacter?.voicePreviewUrl,
          voiceLocale: previousCharacter?.voiceLocale,
          generatedImages: preservedGeneratedImages,
          selectedImageId: preservedSelectedImageId,
          imageData: previousCharacter?.imageData || preservedSelectedImage?.imageData || null,
        };

        if (nextSelectedIds.includes(item.id) && !nextCharacter.voiceProvider) {
          Object.assign(nextCharacter, buildCharacterVoicePatch('project-default'));
        }

        return nextCharacter;
      });
      extractedCharactersRef.current = normalizedCharacters;
      selectedCharacterIdsRef.current = nextSelectedIds;
      setExtractedCharacters(normalizedCharacters);
      setSelectedCharacterIds(nextSelectedIds);
      setCharacterCarouselIndices({});
      setNotice(allowAi
        ? (options?.preserveSelection
          ? '3단계 대본 기준으로 출연자 후보를 다시 불러왔습니다. Step4에서는 선택된 출연자 이미지에만 집중하면 됩니다.'
          : '3단계 대본 기준으로 출연자 후보를 새로 불러왔습니다. 필요한 출연자를 다시 선택해 Step4로 넘겨 주세요.')
        : 'API 연결이 없어 기본 주인공 1명과 조연 1명을 채웠습니다. Step4 흐름은 그대로 테스트할 수 있습니다.');
      return { characters: normalizedCharacters, selectedIds: nextSelectedIds };
    } finally {
      setIsExtracting(false);
    }
  };

  const hydrateCharactersForScript = async (
    options?: { forceSample?: boolean; preserveSelection?: boolean }
  ): Promise<{ characters: CharacterProfile[]; selectedIds: string[] } | null> => hydrateCharactersFromScriptText(normalizedScript, options);

  const ensureStyleRecommendations = async (mode: 'auto' | 'manual' = 'manual') => {
    if (mode === 'manual' && !connectionSummary.text) {
      promptTextAiSetup('현재 화풍 추천은 샘플 보조 모드입니다. Google AI Studio를 연결하면 화풍 추천이 실제 AI 텍스트 기반으로 더 정교해집니다.');
    }
    if (!normalizedScript.trim()) {
      setNotice('먼저 3단계에서 대본과 캐릭터 선택을 마쳐 주세요.');
      openOnly(3);
      return;
    }

    setIsExtracting(true);
    try {
      const recommendationCount = 2;
      const resolvedCards = buildStyleRecommendations(
        normalizedScript,
        contentType,
        [],
        recommendationCount,
        aspectRatio
      );
      const previousSelectedCard = styleImages.find((item) => item.id === selectedStyleImageId) || null;
      const matchedSelectedCard = previousSelectedCard
        ? resolvedCards.find((item) => (item.groupLabel || item.label) === (previousSelectedCard.groupLabel || previousSelectedCard.label)) || null
        : null;
      const nextSelectedStyleId = matchedSelectedCard?.id || null;

      if (resolvedCards.length) {
        setStyleImages(resolvedCards);
        setSelectedStyleImageId(nextSelectedStyleId);
        setStyleCarouselIndices({});
      }

      setNotice(
        studioState?.providers?.openRouterApiKey
          ? (mode === 'auto' ? '5단계 최종 화풍 카드를 2개만 정리해 바로 비교할 수 있게 맞췄습니다.' : '최종 화풍 카드 2개를 현재 대본 기준으로 다시 정리했습니다.')
          : (mode === 'auto' ? 'API 연결이 없어도 5단계용 샘플 화풍 카드 2개를 먼저 채웠습니다.' : 'AI 연결이 없어 샘플 화풍 카드 2개를 다시 정리했습니다.')
      );
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    const signature = `${contentType}::${topic}::${normalizedScript}::${routeStep || openStage || activeStage}`;
    const shouldPrepareStyle = routeStep ? routeStep === 5 : openStage === 5;
    if (!shouldPrepareStyle) return;
    if (!normalizedScript.trim()) return;
    if (styleImages.length) return;
    if (autoRecommendSignatureRef.current === signature) return;

    autoRecommendSignatureRef.current = signature;
    void ensureStyleRecommendations('auto');
  }, [routeStep, openStage, activeStage, contentType, topic, normalizedScript, styleImages.length, aspectRatio]);

  useEffect(() => {
    const shouldPrepareCharacters = routeStep ? routeStep === 4 : openStage === 4;
    if (!shouldPrepareCharacters) return;
    if (!normalizedScript.trim()) return;
    if (extractedCharacters.length) return;
    if (isExtracting) return;

    void hydrateCharactersForScript({ forceSample: !Boolean(studioState?.providers?.openRouterApiKey), preserveSelection: true });
  }, [routeStep, openStage, normalizedScript, extractedCharacters.length, isExtracting, studioState?.providers?.openRouterApiKey]);

  const updateCharacterPrompt = (characterId: string, prompt: string) => {
    const styledPrompt = buildCharacterStyledPrompt(prompt);
    setExtractedCharacters((prev) => prev.map((item) => {
      if (item.id !== characterId) return item;
      const targetImageId = item.selectedImageId || item.generatedImages?.[0]?.id || null;
      return {
        ...item,
        prompt: styledPrompt,
        generatedImages: (item.generatedImages || []).map((image) => image.id === targetImageId ? { ...image, prompt: styledPrompt } : image),
      };
    }));
  };

  const updateCharacterRole = (characterId: string, role: CharacterProfile['role']) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      role,
      roleLabel: item.roleLabel || item.description || (role === 'lead' ? '주인공' : role === 'narrator' ? '나레이터' : '조연'),
    } : item));
  };

  const updateCharacterRoleLabel = (characterId: string, roleLabel: string) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      roleLabel,
      rolePrompt: roleLabel,
      description: roleLabel || item.description,
    } : item));
  };

  const updateCharacterName = (characterId: string, name: string) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      name,
      generatedImages: (item.generatedImages || []).map((image, imageIndex) => imageIndex === 0 ? { ...image, label: name || image.label } : image),
    } : item));
  };

  const removeCharacter = (characterId: string) => {
    setExtractedCharacters((prev) => prev.filter((item) => item.id !== characterId).map((item, index) => ({ ...item, castOrder: index + 1 })));
    setSelectedCharacterIds((prev) => prev.filter((id) => id !== characterId));
    setCharacterCarouselIndices((prev) => {
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
    setCharacterLoadingProgress((prev) => {
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
    setExpandedCharacterEditorId((prev) => prev === characterId ? null : prev);
    setPendingCharacterDeleteId((prev) => (prev === characterId ? null : prev));
    setNotice('출연자 카드 1개를 제거했습니다. 선택 목록과 참조 이미지도 함께 정리했습니다.');
  };

  const requestCharacterRemoval = (characterId: string) => {
    setPendingCharacterDeleteId(characterId);
  };

  const confirmCharacterRemoval = () => {
    if (!pendingCharacterDeleteId) return;
    removeCharacter(pendingCharacterDeleteId);
    setPendingCharacterDeleteId(null);
  };

  const toggleCharacterSelection = (characterId: string) => {
    const nextSelectedIds = selectedCharacterIdsRef.current.includes(characterId)
      ? selectedCharacterIdsRef.current.filter((id) => id !== characterId)
      : [...new Set([...selectedCharacterIdsRef.current, characterId])];
    selectedCharacterIdsRef.current = nextSelectedIds;
    setSelectedCharacterIds(nextSelectedIds);

    const nextCharacters = contentType === 'music_video'
      ? extractedCharactersRef.current
      : extractedCharactersRef.current.map((item) => {
          if (item.id !== characterId || item.voiceProvider) return item;
          return { ...item, ...buildCharacterVoicePatch('project-default') };
        });

    if (contentType !== 'music_video') {
      extractedCharactersRef.current = nextCharacters;
      setExtractedCharacters(nextCharacters);
    }

    if (onSaveWorkflowDraft) {
      void Promise.resolve(onSaveWorkflowDraft({
        extractedCharacters: nextCharacters,
        selectedCharacterIds: nextSelectedIds,
      }));
    }
    requestWorkflowDraftSave('action');
  };

  const chooseCharacterImage = (characterId: string, image: PromptedImageAsset) => {
    const currentCharacter = extractedCharactersRef.current.find((item) => item.id === characterId) || null;
    const isSameImageSelected = currentCharacter?.selectedImageId === image.id;
    const nextCharacters = extractedCharactersRef.current.map((item) => (
      item.id === characterId
        ? {
            ...item,
            selectedImageId: isSameImageSelected ? null : image.id,
            imageData: isSameImageSelected ? null : image.imageData,
            prompt: isSameImageSelected ? item.prompt : (image.prompt || item.prompt),
          }
        : item
    ));

    extractedCharactersRef.current = nextCharacters;
    setExtractedCharacters(nextCharacters);

    if (onSaveWorkflowDraft) {
      onSaveWorkflowDraft({
        extractedCharacters: nextCharacters,
        selectedCharacterIds: selectedCharacterIdsRef.current,
      });
    }

    const targetCharacter = nextCharacters.find((item) => item.id === characterId);
    const nextIndex = Math.max(0, (targetCharacter?.generatedImages || []).findIndex((item) => item.id === image.id));
    setCharacterCarouselIndices((prev) => ({ ...prev, [characterId]: nextIndex }));
    requestWorkflowDraftSave('action');
  };

  const createCharacterVariants = async (
    character: CharacterProfile,
    options?: { note?: string; sourceLabel?: string }
  ) => {
    const existingImages = character.generatedImages || [];
    if (characterLoadingProgress[character.id] !== undefined) return;

    const pendingIndex = existingImages.length;
    setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: pendingIndex }));
    scheduleCharacterGenerationFailsafe(character.id, character.name);

    try {
      await simulateProgress((value: number) => setCharacterLoadingProgress((prev) => ({ ...prev, [character.id]: value })));

      const variationHints = [
        options?.sourceLabel ? `Reference candidate: ${options.sourceLabel}` : '',
        options?.sourceLabel ? 'Keep the same character identity, face mood, hairstyle family, outfit direction, lighting tone, and silhouette as closely as possible.' : '',
        options?.note?.trim() ? `Change request: ${options.note.trim()}` : '',
      ].filter(Boolean).join('\n');

      const variants = createPromptVariants({
        title: character.name,
        prompt: [buildCharacterStyledPrompt(character.prompt || character.description), variationHints].filter(Boolean).join('\n\n'),
        kind: 'character',
        count: 1,
        existingCount: existingImages.length,
        mode: options?.sourceLabel ? 'similar' : 'fresh',
      });
      setExtractedCharacters((prev) =>
        prev.map((item) =>
          item.id === character.id
            ? {
                ...item,
                generatedImages: [...(item.generatedImages || []), ...variants],
                selectedImageId: item.selectedImageId || null,
                imageData: item.imageData || null,
              }
            : item
        )
      );
      setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: pendingIndex }));
      requestWorkflowDraftSave('action');
      setNotice(
        options?.note?.trim() || options?.sourceLabel
          ? `${character.name} 기준으로 요청한 느낌을 반영한 새 후보 1장을 추가했습니다.`
          : `${character.name} 기준으로 새로운 후보 1장을 오른쪽 슬롯에 추가했습니다. 새 후보는 현재 공통 캐릭터 스타일을 반영하되 직전 후보와 다른 결을 우선합니다.`
      );
    } finally {
      clearCharacterGenerationFailsafe(character.id);
      setCharacterLoadingProgress((prev) => {
        if (prev[character.id] === undefined) return prev;
        const next = { ...prev };
        delete next[character.id];
        return next;
      });
    }
  };

  const updateStylePrompt = (styleId: string, prompt: string) => {
    setStyleImages((prev) => prev.map((item) => item.id === styleId ? { ...item, prompt } : item));
  };

  const createStyleVariants = async (styleCard: PromptedImageAsset) => {
    const groupId = styleCard.groupId || styleCard.id;
    const groupItems = styleImages.filter((item) => (item.groupId || item.id) === groupId);
    if (styleLoadingProgress[groupId] !== undefined) return;
    if (styleImages.length >= MAX_STYLE_CARD_COUNT) {
      setNotice(`화풍 카드는 최대 ${MAX_STYLE_CARD_COUNT}장까지 유지합니다. 과부하를 막기 위해 추가 생성을 잠시 막았습니다.`);
      return;
    }

    const pendingIndex = groupItems.length;
    setStyleCarouselIndices((prev) => ({ ...prev, [groupId]: pendingIndex }));
    await simulateProgress((value: number) => setStyleLoadingProgress((prev) => ({ ...prev, [groupId]: value })));

    const variants = createPromptVariants({
      title: styleCard.groupLabel || styleCard.label,
      prompt: styleCard.prompt,
      kind: 'style',
      count: 1,
      groupId,
      groupLabel: styleCard.groupLabel || styleCard.label,
      existingCount: groupItems.length,
    });
    setStyleImages((prev) => [...prev, ...variants]);
    setSelectedStyleImageId(variants[0]?.id || styleCard.id);
    setStyleCarouselIndices((prev) => ({ ...prev, [groupId]: pendingIndex }));
    setStyleLoadingProgress((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    requestWorkflowDraftSave('action');
    setNotice(`${styleCard.groupLabel || styleCard.label} 화풍 기준으로 새로운 후보 1장을 같은 카드 안에 추가했습니다.`);
  };

  const buildUploadPrompt = (label: string, kind: 'character' | 'style') => buildUploadDrivenPrompt({
    label,
    kind,
    topic,
    mood: '',
    setting: '',
    protagonist: '',
    contentType,
    aspectRatio,
  });

  const createCharacterFromPrompt = (name: string, prompt: string, sourceMode: PromptedImageAsset['sourceMode'] = 'ai', imageData?: string) => {
    const styledPrompt = buildCharacterStyledPrompt(prompt);
    const nextRole: CharacterProfile['role'] = extractedCharacters.some((item) => item.role === 'lead') ? 'support' : 'lead';
    const nextRoleLabel = sourceMode === 'upload'
      ? (nextRole === 'lead' ? '주인공 / 업로드 감성 기반 캐릭터' : '조연 / 업로드 감성 기반 캐릭터')
      : (nextRole === 'lead' ? '주인공 / 직접 추가한 캐릭터' : '조연 / 직접 추가한 캐릭터');
    const nextCharacter = createCharacterCardFromPrompt({
      name,
      prompt: styledPrompt,
      description: sourceMode === 'upload' ? '업로드 감성 기반 캐릭터' : '프롬프트 신규 캐릭터',
      imageData,
      sourceMode,
      role: nextRole,
      roleLabel: nextRoleLabel,
      castOrder: extractedCharacters.length + 1,
    });
    if (contentType !== 'music_video') {
      Object.assign(nextCharacter, buildCharacterVoicePatch('project-default'));
    }
    nextCharacter.visualStyle = selectedCharacterStyle?.label || nextCharacter.visualStyle;
    nextCharacter.selectedImageId = null;
    nextCharacter.imageData = null;
    setExtractedCharacters((prev) => [...prev, nextCharacter]);
    setCharacterCarouselIndices((prev) => ({ ...prev, [nextCharacter.id]: 0 }));
    return nextCharacter;
  };

  const createStyleFromPrompt = (label: string, prompt: string, sourceMode: PromptedImageAsset['sourceMode'] = 'ai', imageData?: string) => {
    const nextStyle = createStyleCardFromPrompt({
      label,
      prompt,
      imageData,
      sourceMode,
      groupLabel: label,
    });
    const nextGroupId = nextStyle.groupId || nextStyle.id;
    setStyleImages((prev) => [...prev, nextStyle]);
    setSelectedStyleImageId(nextStyle.id);
    setStyleCarouselIndices((prev) => ({ ...prev, [nextGroupId]: 0 }));
    return nextStyle;
  };

  const createNewCharacterByPrompt = () => {
    const fallbackName = `${protagonist || '신규 캐릭터'} ${extractedCharacters.length + 1}`;
    const prompt = newCharacterPrompt.trim() || buildUploadPrompt(newCharacterName || fallbackName, 'character');
    const name = newCharacterName.trim() || fallbackName;
    createCharacterFromPrompt(name, prompt, 'ai');
    setNewCharacterName('');
    setNewCharacterPrompt('');
    requestWorkflowDraftSave('action');
    setNotice(`${name} 출연자를 캐릭터 카드로 추가했습니다. 선택된 프롬프트와 이미지가 4단계와 씬 제작까지 그대로 이어집니다.`);
  };

  const createNewCharacterFromForm = ({
    name,
    position,
    description,
  }: {
    name: string;
    position: string;
    description: string;
  }) => {
    const trimmedName = name.trim() || `${protagonist || '신규 캐릭터'} ${extractedCharacters.length + 1}`;
    const trimmedPosition = position.trim() || '출연자';
    const trimmedDescription = description.trim() || '직접 추가한 출연자';
    const normalizedPosition = trimmedPosition.toLowerCase();
    const inferredRole: CharacterProfile['role'] = normalizedPosition.includes('나레이터') || normalizedPosition.includes('내레이터') || normalizedPosition.includes('narrator')
      ? 'narrator'
      : extractedCharacters.some((item) => item.role === 'lead')
        ? 'support'
        : 'lead';
    const prompt = buildCharacterStyledPrompt([trimmedName, `포지션: ${trimmedPosition}`, `설명: ${trimmedDescription}`].join('\n'));
    const nextCharacter = createCharacterCardFromPrompt({
      name: trimmedName,
      prompt,
      description: trimmedDescription,
      sourceMode: 'ai',
      role: inferredRole,
      roleLabel: trimmedPosition,
      castOrder: extractedCharacters.length + 1,
    });
    if (contentType !== 'music_video') {
      Object.assign(nextCharacter, buildCharacterVoicePatch('project-default'));
    }
    nextCharacter.visualStyle = selectedCharacterStyle?.label || nextCharacter.visualStyle;
    nextCharacter.selectedImageId = null;
    nextCharacter.imageData = null;
    setExtractedCharacters((prev) => [...prev, nextCharacter]);
    setCharacterCarouselIndices((prev) => ({ ...prev, [nextCharacter.id]: 0 }));
    requestWorkflowDraftSave('action');
    setNotice(`${trimmedName} 출연자를 ${trimmedPosition} 포지션으로 추가했습니다. 입력한 설명은 캐릭터 카드와 다음 단계 이미지 흐름에 그대로 반영됩니다.`);
  };

  const createNewStyleByPrompt = () => {
    const fallbackLabel = `${contentType === 'info_delivery' ? '정보 전달 화풍' : '신규 화풍'} ${styleImages.length + 1}`;
    const prompt = newStylePrompt.trim() || buildUploadPrompt(newStyleName || fallbackLabel, 'style');
    const label = newStyleName.trim() || fallbackLabel;
    createStyleFromPrompt(label, prompt, 'ai');
    setNewStyleName('');
    setNewStylePrompt('');
    setNotice(`${label} 화풍 카드를 추가했습니다. 이 화풍은 Step5 최종 영상 스타일 후보로 바로 반영됩니다.`);
    if (openStage !== 5) openOnly(5);
  };

  const applyCharacterSampleFromPreset = (sampleId: string) => {
    const preset = getCharacterSamplePreset(sampleId);
    if (!preset) return;
    const created = createCharacterFromPrompt(preset.name, preset.prompt, 'sample', preset.imageData);
    setExtractedCharacters((prev) =>
      prev.map((item) =>
        item.id === created.id
          ? { ...item, role: preset.role, roleLabel: preset.roleLabel, voiceHint: item.voiceHint || undefined, visualStyle: selectedCharacterStyle?.label || item.visualStyle }
          : item
      )
    );
    setNotice(`${preset.name} 샘플 캐릭터를 추가했습니다.`);
  };

  const applyCharacterSampleToCharacter = (characterId: string, sampleId: string) => {
    const preset = getCharacterSamplePreset(sampleId);
    if (!preset) return;
    const styledPrompt = buildCharacterStyledPrompt(preset.prompt);
    const sampleImage = buildPromptPreviewCard({
      label: preset.name,
      subtitle: preset.roleLabel,
      prompt: styledPrompt,
      accent: preset.role === 'lead' ? '#8b5cf6' : '#2563eb',
      kind: 'character',
      sourceMode: 'sample',
    });
    const sampleVariant = { ...sampleImage, imageData: preset.imageData, sourceMode: 'sample' as const };
    setExtractedCharacters((prev) =>
      prev.map((item) => {
        if (item.id !== characterId) return item;
        return {
          ...item,
          prompt: styledPrompt,
          visualStyle: selectedCharacterStyle?.label || item.visualStyle,
          generatedImages: [...(item.generatedImages || []), sampleVariant],
          selectedImageId: item.selectedImageId || null,
          imageData: item.imageData || null,
        };
      })
    );
    setNotice(`${preset.name} 기본 예시를 ${extractedCharacters.find((item) => item.id === characterId)?.name || '출연자'} 카드에 적용했습니다.`);
  };

  const applyStyleSampleFromPreset = (sampleId: string) => {
    const preset = getStyleSamplePreset(sampleId);
    if (!preset) return;
    const nextStyle = {
      ...createStyleCardFromPrompt({
        label: preset.label,
        prompt: preset.prompt,
        imageData: preset.imageData,
        sourceMode: 'sample',
        groupId: preset.id,
        groupLabel: preset.label,
      }),
      id: preset.id,
      groupId: preset.id,
      groupLabel: preset.label,
      imageData: preset.imageData,
      sourceMode: 'sample' as const,
      createdAt: Date.now(),
    };
    setStyleImages([nextStyle]);
    setSelectedStyleImageId(nextStyle.id);
    setStyleCarouselIndices({ [preset.id]: 0 });
    requestWorkflowDraftSave('action');
    setNotice(`${preset.label} 화풍 1개를 최종 영상 스타일로 선택했습니다. 다음 단계에는 이 화풍만 전달됩니다.`);
  };

  const handleCharacterUploadForId = (characterId: string) => {
    setCharacterUploadTargetId(characterId);
    characterUploadInputRef.current?.click();
  };

  const openCharacterUploadPicker = () => {
    setCharacterUploadTargetId(null);
    characterUploadInputRef.current?.click();
  };

  const selectCharacterImageById = (characterId: string, imageId: string) => {
    const targetCharacter = extractedCharacters.find((item) => item.id === characterId);
    const targetImage = (targetCharacter?.generatedImages || []).find((image) => image.id === imageId);
    if (!targetImage) return;
    chooseCharacterImage(characterId, targetImage);
  };

  const handleCharacterVoiceChange = (characterId: string, voiceHint: string | null) => {
    const nextCharacters = extractedCharactersRef.current.map((item) => (
      item.id === characterId ? { ...item, voiceHint: voiceHint || undefined } : item
    ));
    replaceExtractedCharacters(nextCharacters, { persistDraft: true });
  };

  const handleCharacterVoiceProviderChange = (characterId: string, provider: 'project-default' | 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen') => {
    const nextCharacters = extractedCharactersRef.current.map((item) => (
      item.id === characterId ? { ...item, ...buildCharacterVoicePatch(provider) } : item
    ));
    replaceExtractedCharacters(nextCharacters, { persistDraft: true });
  };

  const handleCharacterVoiceChoiceChange = (characterId: string, provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen', value: string) => {
    const nextCharacters = extractedCharactersRef.current.map((item) => (
      item.id === characterId ? { ...item, ...buildCharacterVoicePatch(provider, value) } : item
    ));
    replaceExtractedCharacters(nextCharacters, { persistDraft: true });
  };

  const handleProjectTtsModelChange = (modelId: string) => {
    if (!onSaveWorkflowDraft) return;
    void Promise.resolve(onSaveWorkflowDraft({
      ttsProvider: 'elevenLabs',
      elevenLabsModelId: modelId,
    })).catch(() => undefined);
  };

  const handleCharacterVoiceDirectInputChange = (characterId: string, provider: 'elevenLabs' | 'heygen', value: string) => {
    const directId = value.trim();
    const nextCharacters = extractedCharactersRef.current.map((item) => {
      if (item.id !== characterId) return item;
      if (!directId) return { ...item, ...buildCharacterVoicePatch(provider, '') };
      const catalogVoice: any = provider === 'elevenLabs'
        ? (elevenLabsVoices.find((voice) => voice.voice_id === directId) || null)
        : (heygenVoices.find((voice) => voice.voice_id === directId) || null);

      if (provider === 'elevenLabs') {
        return {
          ...item,
          voiceProvider: 'elevenLabs' as const,
          voiceHint: directId,
          voiceId: directId,
          voiceName: catalogVoice?.name || `ElevenLabs 직접 입력 (${directId})`,
          voicePreviewUrl: catalogVoice?.preview_url || null,
          voiceLocale: item.voiceLocale || null,
        };
      }

      return {
        ...item,
        voiceProvider: 'heygen' as const,
        voiceHint: directId,
        voiceId: directId,
        voiceName: catalogVoice?.name || `HeyGen 직접 입력 (${directId})`,
        voicePreviewUrl: catalogVoice?.preview_audio_url || catalogVoice?.preview_audio || null,
        voiceLocale: catalogVoice?.language || item.voiceLocale || null,
      };
    });
    replaceExtractedCharacters(nextCharacters, { persistDraft: true });
  };

  const handlePreviewCharacterVoice = async (characterId: string) => {
    const character = extractedCharacters.find((item) => item.id === characterId);
    if (!character) return;
    const resolved = resolveCharacterVoiceSelection(character);
    const effectiveProvider = resolved.provider === 'project-default' ? projectVoiceProvider : resolved.provider;

    if (voicePreviewCharacterId === characterId) {
      stopCharacterVoicePreview();
      setVoicePreviewMessage(`${character.name} 미리 듣기를 정지했습니다.`);
      return;
    }

    stopCharacterVoicePreview();
    setVoicePreviewCharacterId(characterId);
    setVoicePreviewMessage(`${character.name} 보이스를 준비하는 중입니다.`);

    try {
      const previewUrl = resolved.previewUrl || character.voicePreviewUrl || null;
      if (effectiveProvider !== 'qwen3Tts' && previewUrl) {
        const audio = new Audio(previewUrl);
        characterVoiceAudioRef.current = audio;
        audio.onended = () => {
          setVoicePreviewCharacterId(null);
          setVoicePreviewMessage(`${character.name} 미리 듣기가 끝났습니다.`);
        };
        audio.onerror = () => {
          setVoicePreviewCharacterId(null);
          setVoicePreviewMessage('보이스 미리 듣기에 실패했습니다. 생성형 미리 듣기로 다시 시도해 주세요.');
        };
        await audio.play();
        setVoicePreviewMessage(`${character.name} · ${resolved.voiceName} 미리 듣기 중입니다.`);
        return;
      }

      if (effectiveProvider === 'qwen3Tts') {
        setVoicePreviewMessage(`${character.name} · ${resolved.voiceName} 실제 무료 TTS 미리 듣기를 준비 중입니다.`);
      }

      const providerApiKey = effectiveProvider === 'elevenLabs'
        ? (studioState?.providers?.elevenLabsApiKey || '')
        : effectiveProvider === 'heygen'
          ? (studioState?.providers?.heygenApiKey || '')
          : '';
      if ((effectiveProvider === 'elevenLabs' || effectiveProvider === 'heygen') && !providerApiKey) {
        setVoicePreviewCharacterId(null);
        if (onOpenApiModal) {
          void onOpenApiModal({
            title: effectiveProvider === 'heygen' ? 'HeyGen API 키를 먼저 연결해 주세요' : 'ElevenLabs API 키를 먼저 연결해 주세요',
            description: '보이스 미리 듣기와 저장된 캐스팅 목록을 실제 보이스와 맞춰 사용하려면 API 연결이 필요합니다.',
            focusField: effectiveProvider === 'heygen' ? 'heygen' : 'elevenLabs',
          });
        }
        setVoicePreviewMessage('API 키가 없어 미리 듣기를 시작하지 못했습니다.');
        return;
      }

      const { asset } = await createTtsPreview({
        provider: effectiveProvider,
        title: `${character.name} 보이스 미리 듣기`,
        text: `${character.name}입니다. 지금 선택한 목소리를 확인합니다.`,
        mode: 'voice-preview',
        apiKey: providerApiKey,
        googleApiKey: studioState?.providers?.openRouterApiKey || undefined,
        voiceId: resolved.voiceId || undefined,
        modelId: studioState?.routing?.elevenLabsModelId || studioState?.routing?.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
        qwenPreset: resolved.voiceId || studioState?.routing?.qwenVoicePreset || 'qwen-default',
        locale: resolved.locale || undefined,
        voiceReferenceAudioData: studioState?.routing?.voiceReferenceAudioData || undefined,
        voiceReferenceMimeType: studioState?.routing?.voiceReferenceMimeType || undefined,
      });
      const audioSrc = asset.audioData?.startsWith('data:') ? asset.audioData : `data:audio/mpeg;base64,${asset.audioData}`;
      const audio = new Audio(audioSrc);
      characterVoiceAudioRef.current = audio;
      audio.onended = () => {
        setVoicePreviewCharacterId(null);
        setVoicePreviewMessage(`${character.name} · ${resolved.voiceName} 미리 듣기가 끝났습니다.`);
      };
      audio.onerror = () => {
        setVoicePreviewCharacterId(null);
        setVoicePreviewMessage('보이스 미리 듣기에 실패했습니다.');
      };
      await audio.play();
      setVoicePreviewMessage(`${character.name} · ${resolved.voiceName} 미리 듣기 중입니다.`);
    } catch {
      setVoicePreviewCharacterId(null);
      setVoicePreviewMessage('보이스 미리 듣기에 실패했습니다. 연결 상태를 다시 확인해 주세요.');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'character' | 'style') => {
    const files = e.target.files;
    if (!files?.length) return;

    const selectedFiles = Array.from(files as FileList).slice(0, MAX_UPLOAD_FILE_COUNT);
    const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'));
    if (invalidFile) {
      setNotice('이미지 파일만 업로드할 수 있습니다. JPG, PNG, WEBP 파일로 다시 시도해 주세요.');
      e.target.value = '';
      return;
    }

    const oversizeFile = selectedFiles.find((file) => file.size > MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024);
    if (oversizeFile) {
      setNotice(`${oversizeFile.name} 파일이 ${MAX_UPLOAD_FILE_SIZE_MB}MB를 넘어 업로드를 막았습니다. 큰 파일은 브라우저 과부하를 만들 수 있어 미리 차단했습니다.`);
      e.target.value = '';
      return;
    }

    const images = await Promise.all(
      selectedFiles.map(
        (file: File) =>
          new Promise<PromptedImageAsset>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const label = file.name.replace(/\.[^.]+$/, '');
              const imageData = String(reader.result);
              Promise.resolve(buildImageAwareUploadPrompt({
                imageData,
                label,
                kind: mode,
                topic,
                mood: '',
                setting: '',
                protagonist: '',
                contentType,
                aspectRatio,
              })).catch(() => buildUploadPrompt(label, mode)).then((basePrompt) => {
                const prompt = mode === 'character' ? buildCharacterStyledPrompt(basePrompt) : basePrompt;
                const preview = buildPromptPreviewCard({
                  label,
                  subtitle: mode === 'character' ? '업로드 감성 캐릭터' : '업로드 감성 화풍',
                  prompt,
                  accent: mode === 'character' ? '#2563eb' : '#8b5cf6',
                  kind: mode,
                  sourceMode: 'upload',
                });
                resolve({
                  ...preview,
                  imageData,
                  sourceMode: 'upload',
                });
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    if (mode === 'character') {
      if (characterUploadTargetId) {
        const targetImage = images[images.length - 1];
        if (targetImage) {
          setExtractedCharacters((prev) => prev.map((item) => {
            if (item.id !== characterUploadTargetId) return item;
            return {
              ...item,
              prompt: targetImage.prompt,
              visualStyle: selectedCharacterStyle?.label || item.visualStyle,
              generatedImages: [...(item.generatedImages || []), targetImage],
              selectedImageId: targetImage.id,
              imageData: targetImage.imageData,
            };
          }));
          requestWorkflowDraftSave('action');
          setNotice('업로드한 이미지를 선택한 출연자 카드에 추가했고, 그 이미지를 기준으로 유사 이미지도 이어서 만들 수 있게 했습니다.');
        }
        setCharacterUploadTargetId(null);
      } else {
        const uploadedCharacters = images.map((image) => {
          const created = createCharacterCardFromPrompt({
            name: image.label,
            prompt: image.prompt,
            description: '업로드 감성 기반 캐릭터',
            imageData: image.imageData,
            sourceMode: 'upload',
          });
          created.visualStyle = selectedCharacterStyle?.label || created.visualStyle;
          created.selectedImageId = image.id;
          created.imageData = image.imageData;
          created.generatedImages = image.imageData ? [{
            ...image,
            imageData: image.imageData,
          }] : created.generatedImages;
          return created;
        });
        const uploadedCharacterIds = uploadedCharacters.map((item) => item.id);
        setExtractedCharacters((prev) => [...prev, ...uploadedCharacters]);
        selectedCharacterIdsRef.current = [...new Set([...selectedCharacterIdsRef.current, ...uploadedCharacterIds])];
        setSelectedCharacterIds((prev) => [...new Set([...prev, ...uploadedCharacterIds])]);
        setCharacterCarouselIndices((prev) => ({
          ...prev,
          ...Object.fromEntries(uploadedCharacters.map((item) => [item.id, 0])),
        }));
        requestWorkflowDraftSave('action');
        setNotice('업로드한 이미지를 출연자 캐릭터 카드로 추가했고, 해당 느낌의 프롬프트와 선택 상태도 함께 저장했습니다.');
      }
    } else {
      setStyleImages((prev) => [...prev, ...images]);
      const newest = images[images.length - 1];
      if (newest) {
        setSelectedStyleImageId(newest.id);
      }
      setStyleCarouselIndices((prev) => ({
        ...prev,
        ...Object.fromEntries(images.map((item) => [item.groupId || item.id, 0])),
      }));
      requestWorkflowDraftSave('action');
      setNotice('업로드한 이미지를 Step5 최종 영상 화풍 카드로 추가했고, 해당 느낌의 프롬프트도 함께 저장했습니다.');
    }

    e.target.value = '';
    if (mode === 'character') {
        return;
    }
    if (openStage !== 5) openOnly(5);
  };

  const updatePromptTemplate = (templateId: string, patch: Partial<WorkflowPromptTemplate>) => {
    setPromptTemplates((prev) => prev.map((item) => item.id === templateId ? { ...item, ...patch, isCustomized: true, updatedAt: Date.now() } : item));
  };

  const addCustomPromptTemplate = () => {
    const source = selectedPromptTemplate;
    const custom: WorkflowPromptTemplate = {
      id: `custom_prompt_${Date.now()}`,
      name: `${source.name} 복사본`,
      description: '사용자 관리용 커스텀 프롬프트',
      prompt: source.prompt,
      mode: source.mode,
      builtIn: false,
      engine: source.engine || 'default',
      updatedAt: Date.now(),
    };
    setPromptTemplates((prev) => [...prev, custom]);
    setSelectedPromptTemplateId(custom.id);
    setPromptDetailId(custom.id);
    setEditingPromptId(custom.id);
    setPromptEditorForm({ name: custom.name, description: custom.description, prompt: custom.prompt });
    setNotice('커스텀 프롬프트를 추가했습니다. 팝업에서 세부 문구를 바로 다듬을 수 있습니다.');
  };

  const deleteCustomPromptTemplate = (templateId: string) => {
    const target = syncedPromptTemplates.find((item) => item.id === templateId);
    if (!target || target.builtIn) return;
    setPromptTemplates((prev) => prev.filter((item) => item.id !== templateId));
    const defaultTemplateId = getDefaultWorkflowPromptTemplateId(contentType);
    setSelectedPromptTemplateId(defaultTemplateId);
    setPromptDetailId(defaultTemplateId);
    setEditingPromptId(null);
    setNotice('커스텀 프롬프트를 삭제했습니다.');
  };

  const fieldConfigs: Array<{ key: keyof StorySelectionState; label: string; value: string; setter: (value: string) => void }> = [
    { key: 'genre', label: '장르', value: genre, setter: setGenre },
    { key: 'mood', label: '분위기', value: mood, setter: setMood },
    { key: 'endingTone', label: '엔딩 톤', value: endingTone, setter: setEndingTone },
    { key: 'setting', label: '배경', value: setting, setter: setSetting },
    { key: 'protagonist', label: '주인공', value: protagonist, setter: setProtagonist },
    { key: 'conflict', label: '갈등', value: conflict, setter: setConflict },
  ];

  const handleOpenSceneStudioClick = async () => {
    const finalStageForSceneOpen: StepId = 5;
    const isCompleted = await completeStage(finalStageForSceneOpen);
    if (!isCompleted) {
      if (routeStep && onNavigateStep) {
        await Promise.resolve(onNavigateStep(finalStageForSceneOpen as 1 | 2 | 3 | 4 | 5));
        return;
      }
      scrollStageIntoFocus(stepCompleted[3] ? finalStageForSceneOpen : 3);
      return;
    }
    const finalDraftPayload: Partial<WorkflowDraft> = {
      ...buildDraftPayload(),
      activeStage: finalStageForSceneOpen,
      completedSteps: {
        step1: true,
        step2: true,
        step3: true,
        step4: true,
        step5: true,
      },
    };
    await onSaveWorkflowDraft?.(finalDraftPayload);
    setNotice('현재 선택값을 프로젝트에 추가하고 씬 제작 작업 화면으로 이동합니다. 순서는 프롬프트 / 대본 → Step4 출연자 캐릭터 설정 → Step5 최종 영상 화풍 선택 → 씬 제작입니다.');
    try {
      await onOpenSceneStudio?.(finalDraftPayload);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setNotice('씬 제작 화면으로 넘기기 전에 비어 있는 항목이 있습니다. 프롬프트 / 대본 → Step4 출연자 캐릭터 설정 → Step5 최종 영상 화풍 선택 순서로 필요한 단계로 자동 이동했습니다.');
      scrollStageIntoFocus(stepCompleted[4] ? 4 : 3);
    }
  };

  const selectedContentLabel = hasSelectedContentType
    ? (CONTENT_TYPE_CARDS.find((item) => item.id === contentType)?.title || contentType)
    : '미선택';
  const selectedAspectLabel = hasSelectedAspectRatio ? aspectRatio : '미선택';
  const step1Summary = <><SummaryChip accent="blue">유형 {selectedContentLabel}</SummaryChip><SummaryChip>{selectedAspectLabel}</SummaryChip></>;
  const step2Summary = (
    <>
      <SummaryChip accent="blue">주제 {topic || '미입력'}</SummaryChip>
      <SummaryChip>{formatExpectedDurationLabel(customScriptDurationMinutes)}</SummaryChip>
      <SummaryChip>{customScriptSpeechStyle}</SummaryChip>
      <SummaryChip>{customScriptLanguage}</SummaryChip>
    </>
  );
  const step3Summary = (
    <>
      <SummaryChip accent="violet">프롬프트 {selectedPromptTemplate?.name || '미선택'}</SummaryChip>
      <SummaryChip>{normalizedScript.trim() ? `문단 ${sceneCount}개` : '원문 미입력'}</SummaryChip>
      <SummaryChip>{normalizedScript.trim().length}자</SummaryChip>
    </>
  );
  const step4Summary = (
    <>
      <SummaryChip accent="blue">출연자 {selectedCharacters.length}명</SummaryChip>
      <SummaryChip accent="violet">캐릭터 스타일 {selectedCharacterStyle?.label || '미선택'}</SummaryChip>
      <SummaryChip>이미지 모델 {studioState?.routing?.imageModel || IMAGE_MODELS[0].id}</SummaryChip>
    </>
  );
  const footerStage = normalizeStage(routeStep || openStage || activeStage);
  const previousRouteStep = footerStage > 1 ? ((footerStage - 1) as 1 | 2 | 3 | 4 | 5) : null;
  const nextRouteStep = footerStage < 5 ? ((footerStage + 1) as 1 | 2 | 3 | 4 | 5) : null;
  const inputSectionViewModelSource = {
    routeStep,
    completion,
    notice,
    openStage,
    activeStage,
    toggleStage,
    stageStatus,
    step1Summary,
    step2Summary,
    step3Summary,
    step4Summary,
    step3GuideItems,
    contentType,
    hasSelectedContentType,
    hasSelectedAspectRatio,
    aspectRatio,
    clearContentTypeSelection,
    applyAspectRatioSelection,
    clearAspectRatioSelection,
    setHasSelectedContentType,
    setContentType,
    setTopic,
    setStoryScript: handleStoryScriptInputChange,
    setGenre,
    setMood,
    setEndingTone,
    setSetting,
    setProtagonist,
    setConflict,
    setExtractedCharacters,
    setStyleImages,
    setSelectedCharacterIds,
    selectedCharacterIds,
    applyCharacterStyleSelection,
    setSelectedCharacterStyleId,
    setSelectedStyleImageId,
    setHasSelectedAspectRatio,
    applyContentTypeSelection,
    topic,
    isRefreshingTopic,
    refreshTopicRecommendation,
    topicRecommendations,
    fieldConfigs,
    refreshField,
    loadingFields,
    selectedPromptTemplate,
    selectedPromptTemplateId,
    syncedPromptTemplates,
    focusPromptTemplate,
    openPromptEditor,
    deleteCustomPromptTemplate,
    addCustomPromptTemplate,
    handleGenerateScriptClick,
    createDraftFromSelections,
    isGeneratingScript,
    ensureProjectPromptTemplate,
    setPromptPreviewDraft,
    setPromptPreviewId,
    storyScript,
    sceneCount,
    selectedCharacters,
    selectedStyle,
    connectionSummary,
    selectedScriptModel,
    selectedImageModel,
    onOpenApiModal,
    hydrateCharactersForScript,
    isExtracting,
    characterUploadInputRef,
    handleUpload,
    newCharacterName,
    setNewCharacterName,
    newCharacterPrompt,
    setNewCharacterPrompt,
    createNewCharacterByPrompt,
    createNewCharacterFromForm,
    extractedCharacters,
    characterStripRef,
    characterCarouselIndices,
    setCharacterCarouselIndices,
    characterLoadingProgress,
    chooseCharacterImage,
    toggleCharacterSelection,
    createCharacterVariants,
    expandedCharacterEditorId,
    setExpandedCharacterEditorId,
    updateCharacterName,
    updateCharacterPrompt,
    updateCharacterRole,
    updateCharacterRoleLabel,
    removeCharacter,
    ensureStyleRecommendations,
    newStyleName,
    setNewStyleName,
    newStylePrompt,
    setNewStylePrompt,
    createNewStyleByPrompt,
    applyStyleSampleFromPreset,
    styleGroups,
    styleStripRef,
    styleCarouselIndices,
    setStyleCarouselIndices,
    styleLoadingProgress,
    createStyleVariants,
    expandedStyleEditorId,
    setExpandedStyleEditorId,
    updateStylePrompt,
    stepCompleted,
    handleOpenSceneStudioClick,
    visibleStepIds,
    setCharacterLoadingProgress,
    setStyleLoadingProgress,
    autoRecommendSignatureRef,
    setPromptTemplates,
    setSelectedPromptTemplateId,
    setPromptDetailId,
    setNotice,
    completeStage,
    openExampleGuide,
    normalizedScript,
    setShowPromptPack,
    showPromptPack,
    onUpdateRouting,
    textModelReady,
    step3PanelMode,
    setStep3PanelMode,
    activePromptSlide,
    selectedPromptIndex,
    generateScriptByPrompt,
    promptDetailTemplate,
    promptPack,
    onOpenSettings,
    scriptGenerationProgressPercent: scriptGenerationProgress?.percent ?? null,
    scriptGenerationProgressMessage: scriptGenerationProgress?.message || '',
    studioState,
    imageModelReady,
    openStageWithIntent,
    step4CharacterStripRef,
    styleUploadInputRef,
    extendScriptByChars,
    setAspectRatio,
    selectedCharacterStyleId,
    characterStyleOptions: CHARACTER_STYLE_OPTIONS,
    handleCharacterUploadForId,
    openCharacterUploadPicker,
    selectCharacterImageById,
    handleCharacterVoiceChange,
    selectedStyleImageId,
    customScriptDurationMinutes,
    customScriptSpeechStyle,
    customScriptLanguage,
    customScriptReferenceText,
    scriptReferenceSuggestions,
    referenceLinks,
    pendingReferenceLinkUrl,
    showReferenceLinkInput,
    isAddingReferenceLink,
    selectedScriptGenerationModel,
    customScriptModelOptions,
    constitutionAnalysis,
    selectedPromptTemplateName: selectedPromptTemplate?.name || '',
    selectedPromptTemplateEngine: selectedPromptTemplate?.engine || 'default',
    setCustomScriptDurationMinutes: handleCustomScriptDurationChange,
    setCustomScriptSpeechStyle,
    setCustomScriptLanguage,
    setCustomScriptReferenceText,
    applyScriptReferenceSuggestion,
    refreshScriptReferenceSuggestions,
    setPendingReferenceLinkUrl,
    toggleReferenceLinkInput,
    addReferenceLink,
    removeReferenceLink,
    setSelectedScriptGenerationModel,
    elevenLabsVoices,
    heygenVoices,
    isLoadingVoiceCatalogs,
    projectVoiceProvider,
    projectVoiceSummary,
    googleApiKey: studioState?.providers?.openRouterApiKey || '',
    elevenLabsApiKey: studioState?.providers?.elevenLabsApiKey || '',
    currentTtsModelId: workflowDraft?.elevenLabsModelId || studioState?.routing?.elevenLabsModelId || studioState?.routing?.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
    voiceReferenceAudioData: workflowDraft?.voiceReferenceAudioData || studioState?.routing?.voiceReferenceAudioData || null,
    voiceReferenceMimeType: workflowDraft?.voiceReferenceMimeType || studioState?.routing?.voiceReferenceMimeType || null,
    voicePreviewCharacterId,
    voicePreviewMessage,
    handleCharacterVoiceProviderChange,
    handleCharacterVoiceChoiceChange,
    handleProjectTtsModelChange,
    handleCharacterVoiceDirectInputChange,
    handlePreviewCharacterVoice,
    getCharacterVoiceSummary,
    step3CastSelectionHighlightTick,
    requestCharacterRemoval,
    previousRouteStep,
    moveRouteStep,
    goBackFromStep1,
    nextRouteStep,
    routeStepCompleted,
    promptPreviewId,
    promptPreviewDraft,
    updatePromptTemplate,
    scriptGenerationConfirmOpen,
    confirmGenerateScriptOverwrite,
    setScriptGenerationConfirmOpen,
  };
  const routeStepVm = buildRouteStepViewModel(inputSectionViewModelSource);
  const mainStepVm = buildMainStepViewModel(inputSectionViewModelSource);
  if (routeStep) {
    return (
      <div onClickCapture={handleInteractionCapture} onChangeCapture={handleInteractionCapture} onInputCapture={handleInteractionCapture}>
        <RouteStepView
        vm={routeStepVm}
        />
      </div>
    );
  }

  return (
    <div className="mp4-editor-shell mx-auto my-6 w-full max-w-[1520px] px-4 sm:px-6 lg:px-8" onClickCapture={handleInteractionCapture} onChangeCapture={handleInteractionCapture} onInputCapture={handleInteractionCapture}>
      <MainStepView
        vm={mainStepVm}
      />

      <RouteStepFooter
        routeStep={routeStep}
        previousRouteStep={previousRouteStep}
        footerStage={footerStage}
        nextRouteStep={nextRouteStep}
        routeStepCompleted={routeStepCompleted}
        stepCompleted={stepCompleted}
        onMoveRouteStep={moveRouteStep}
        onOpenSceneStudio={() => handleOpenSceneStudioClick()}
        onCompleteStage={(from, to) => { void completeStage(from, to); }}
      />

      <SampleGuideModal
        open={sampleGuideOpen}
        onClose={() => setSampleGuideOpen(false)}
        onOpenApiModal={onOpenApiModal}
        onContinueWithSample={fillSample}
      />

      <PromptPreviewModal
        promptPreviewId={promptPreviewId}
        templates={syncedPromptTemplates}
        draft={promptPreviewDraft || syncedPromptTemplates.find((item) => item.id === promptPreviewId)?.prompt || selectedPromptTemplate?.prompt || ''}
        onClose={() => setPromptPreviewId(null)}
        onSaveEdit={() => {
          const target = syncedPromptTemplates.find((item) => item.id === promptPreviewId);
          if (!target) return;
          updatePromptTemplate(target.id, { prompt: promptPreviewDraft });
          setNotice('프롬프트 수정이 저장되었습니다. 대본생성 시 바로 반영됩니다.');
          setPromptPreviewId(null);
        }}
        onDraftChange={setPromptPreviewDraft}
      />

      <PromptEditorModal
        editingPromptId={editingPromptId}
        prompt={promptEditorForm.prompt}
        guideTitle={STEP3_PROMPT_EDITOR_GUIDE.title}
        guideItems={STEP3_PROMPT_EDITOR_GUIDE.items}
        onClose={() => setEditingPromptId(null)}
        onSave={savePromptEditor}
        onPromptChange={(value) => setPromptEditorForm((prev) => ({ ...prev, prompt: value }))}
      />

      <OverlayModal
        open={scriptGenerationConfirmOpen}
        title="대본을 새로 생성할까요?"
        description="대본을 생성하면 현재 작성된 대본은 새 결과로 교체됩니다. 영상 길이와 현재 설정을 기준으로 새 대본을 다시 만듭니다."
        onClose={() => setScriptGenerationConfirmOpen(false)}
        footer={(
          <>
            <button
              type="button"
              onClick={() => setScriptGenerationConfirmOpen(false)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmGenerateScriptOverwrite}
              disabled={isGeneratingScript}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isGeneratingScript ? '생성 중...' : '확인하고 생성'}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-black text-violet-900">새로 생성되는 기준</div>
            <p className="mt-2 text-sm leading-6 text-violet-800">
              예상 길이 {formatExpectedDurationLabel(customScriptDurationMinutes)}, {selectedPromptTemplate?.name || '현재 프롬프트'}, {selectedScriptGenerationModel} 기준으로
              글자수 범위에 맞는 새 대본을 만듭니다.
            </p>
          </div>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-black text-amber-900">현재 대본 교체 안내</div>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              확인을 누르면 지금 작성된 내용은 유지되지 않고 새 대본으로 덮어써집니다. 생성 결과는 항상 새로운 느낌으로 다시 만듭니다.
            </p>
          </div>
        </div>
      </OverlayModal>

      <OverlayModal
        open={Boolean(pendingCharacterDeleteId)}
        title="출연자를 삭제할까요?"
        description="삭제하면 선택 상태와 연결된 참조 정보도 함께 정리됩니다."
        onClose={() => setPendingCharacterDeleteId(null)}
        footer={(
          <>
            <button
              type="button"
              onClick={() => setPendingCharacterDeleteId(null)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmCharacterRemoval}
              className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-500"
            >
              삭제 확인
            </button>
          </>
        )}
      >
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-black text-rose-900">
            {extractedCharacters.find((item) => item.id === pendingCharacterDeleteId)?.name || '선택한 출연자'}
          </div>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            한 번 삭제하면 현재 Step3 카드 목록에서 빠지고, 다시 쓰려면 대본 기준으로 다시 불러오거나 직접 추가해야 합니다.
          </p>
        </div>
      </OverlayModal>

      <ProcessingBadge step={step} />
    </div>
  );
};

export default InputSection;
