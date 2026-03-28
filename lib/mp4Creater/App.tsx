'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from './components/Header';
import StartupWizard from './components/StartupWizard';
import SettingsDrawer from './components/SettingsDrawer';
import InputSection from './components/InputSection';
import ResultTable from './components/ResultTable';
import ProjectGallery from './components/ProjectGallery';
import ProviderQuickModal from './components/ProviderQuickModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import {
  BackgroundMusicTrack,
  CostBreakdown,
  GeneratedAsset,
  GenerationStep,
  PreviewMixSettings,
  SavedProject,
  StudioState,
  WorkflowDraft,
} from './types';
import {
  fetchStudioState,
  configureStorage,
  saveStudioState,
  createDefaultStudioState,
  getCachedStudioState,
  DEFAULT_STORAGE_DIR,
  summarizeProjectForIndex,
  saveStudioProject,
} from './services/localFileApi';
import {
  getProjectById,
  getSavedProjects,
  deleteProjects,
  duplicateProject,
  importProjectsFromFile,
  migrateFromLocalStorage,
  renameProject,
  updateProject,
  upsertWorkflowProject,
} from './services/projectService';
import { estimateClipDuration } from './utils/storyHelpers';
import { createLightweightSceneAssetsFromDraft } from './services/sceneAssemblyService';
import { createSampleBackgroundTrack, getDefaultPreviewMix } from './services/musicService';
import { createDefaultWorkflowDraft, ensureWorkflowDraft } from './services/workflowDraftService';
import { CONFIG } from './config';
import { readProjectNavigationProject, rememberProjectNavigationProject } from './services/projectNavigationCache';
import { applyProjectSettingsToRouting, buildProjectSettingsSnapshot } from './services/projectSettingsSnapshot';
import { buildSceneStudioSnapshotPayload, writeSceneStudioSnapshot } from './services/sceneStudioSnapshotCache';
import { hasDetailedSceneStudioProject } from './pages/sceneStudio/helpers';

function normalizeLoadedAssets(assets: GeneratedAsset[]): GeneratedAsset[] {
  return assets.map((asset) => ({
    ...asset,
    targetDuration:
      typeof asset.targetDuration === 'number'
        ? asset.targetDuration
        : asset.audioDuration || asset.videoDuration || estimateClipDuration(asset.narration),
  }));
}

function createEmptySceneAssetsFromDraft(draft: WorkflowDraft): GeneratedAsset[] {
  return createLightweightSceneAssetsFromDraft(draft);
}

function hasSceneStudioProgressFromAssets(assets?: GeneratedAsset[] | null): boolean {
  const safeAssets = Array.isArray(assets) ? assets : [];
  if (!safeAssets.length) return false;
  return safeAssets.some((asset) => (
    Boolean(asset.imageData)
    || Boolean(asset.audioData)
    || Boolean(asset.videoData)
    || Boolean(asset.imageHistory?.length)
    || Boolean(asset.videoHistory?.length)
    || asset.status !== 'pending'
  ));
}

const resolveAppViewMode = (params: ReturnType<typeof useSearchParams>) => {
  if (params?.get('view') === 'gallery') return 'gallery' as const;
  if (params?.get('new') || params?.get('projectId') || params?.get('returnTo')) return 'main' as const;
  return 'gallery' as const;
};

function createOptimisticProjectId() {
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createOptimisticWorkflowProject(options: {
  projectId?: string | null;
  topic: string;
  workflowDraft: WorkflowDraft;
  assets?: GeneratedAsset[];
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
}): SavedProject {
  const now = Date.now();
  const safeTopic = options.topic?.trim() || '새 프로젝트';
  return {
    id: options.projectId?.trim() || createOptimisticProjectId(),
    name: `${safeTopic.slice(0, 30)}${safeTopic.length > 30 ? '...' : ''}`,
    createdAt: now,
    topic: safeTopic,
    lastSavedAt: now,
    settings: buildProjectSettingsSnapshot({
      routing: getCachedStudioState()?.routing || createDefaultStudioState().routing,
      workflowDraft: options.workflowDraft,
      fallback: {
        imageModel: CONFIG.DEFAULT_IMAGE_MODEL,
        videoModel: CONFIG.DEFAULT_VIDEO_MODEL,
        scriptModel: options.workflowDraft?.customScriptSettings?.scriptModel || options.workflowDraft?.openRouterModel || CONFIG.DEFAULT_SCRIPT_MODEL,
        sceneModel: options.workflowDraft?.customScriptSettings?.scriptModel || options.workflowDraft?.openRouterModel || CONFIG.DEFAULT_SCRIPT_MODEL,
        outputMode: options.workflowDraft?.outputMode || 'video',
        elevenLabsModel: CONFIG.DEFAULT_ELEVENLABS_MODEL,
      },
    }),
    assets: Array.isArray(options.assets) ? options.assets.map((asset) => ({ ...asset })) : [],
    thumbnail: null,
    thumbnailTitle: null,
    thumbnailPrompt: null,
    thumbnailHistory: [],
    selectedThumbnailId: null,
    backgroundMusicTracks: options.backgroundMusicTracks || [],
    previewMix: options.previewMix,
    workflowDraft: options.workflowDraft,
    voicePreviewAsset: null,
    scriptPreviewAsset: null,
    finalVoiceAsset: null,
    backgroundMusicPreview: null,
    finalBackgroundMusic: null,
    musicVideoPreview: null,
    finalMusicVideo: null,
  };
}


function hasDetailedWorkflowDraft(draft?: WorkflowDraft | null) {
  if (!draft) return false;
  return Boolean(
    (Array.isArray(draft.extractedCharacters) && draft.extractedCharacters.length)
    || (Array.isArray(draft.styleImages) && draft.styleImages.length)
    || (Array.isArray(draft.characterImages) && draft.characterImages.length)
    || (Array.isArray(draft.selectedCharacterIds) && draft.selectedCharacterIds.length)
    || draft.selectedCharacterStyleId
    || draft.selectedStyleImageId
  );
}

function hasDetailedProjectPayload(project?: SavedProject | null) {
  if (!project) return false;
  return Boolean(
    (Array.isArray(project.assets) && project.assets.length)
    || (Array.isArray(project.backgroundMusicTracks) && project.backgroundMusicTracks.length)
    || hasDetailedWorkflowDraft(project.workflowDraft || null)
  );
}

function mergeLoadedWorkflowDraft(baseDraft?: WorkflowDraft | null, incomingDraft?: WorkflowDraft | null): WorkflowDraft | null {
  if (!incomingDraft) return null;

  const fallbackBase = baseDraft
    ? ensureWorkflowDraft({ workflowDraft: baseDraft, lastContentType: baseDraft.contentType } as StudioState)
    : createDefaultWorkflowDraft(incomingDraft.contentType || 'story');
  const ensuredIncoming = ensureWorkflowDraft({ workflowDraft: incomingDraft, lastContentType: incomingDraft.contentType || fallbackBase.contentType } as StudioState);
  const baseUpdatedAt = Number(fallbackBase.updatedAt || 0);
  const incomingUpdatedAt = Number(ensuredIncoming.updatedAt || 0);
  const preferBaseDraft = Boolean(baseDraft && baseUpdatedAt > incomingUpdatedAt);
  const preferredDraft = preferBaseDraft ? fallbackBase : ensuredIncoming;
  const secondaryDraft = preferBaseDraft ? ensuredIncoming : fallbackBase;
  const defaultWorkflowDraft = createDefaultWorkflowDraft(preferredDraft.contentType || secondaryDraft.contentType || fallbackBase.contentType);
  const defaultPromptPack = defaultWorkflowDraft.promptPack;
  const defaultReferenceImages = defaultWorkflowDraft.referenceImages;
  const defaultCustomScriptSettings = defaultWorkflowDraft.customScriptSettings || {
    expectedDurationMinutes: 1,
    speechStyle: 'default',
    language: 'ko',
    referenceText: '',
    referenceLinks: [],
    scriptModel: defaultWorkflowDraft.openRouterModel,
  };
  const defaultBackgroundMusicScene = defaultWorkflowDraft.backgroundMusicScene || {
    enabled: false,
    prompt: '',
    provider: 'sample',
    modelId: '',
    title: '',
    durationSeconds: 20,
    promptSections: undefined,
    selectedTrackId: null,
  };
  const defaultSampleMode = defaultWorkflowDraft.sampleMode || {
    text: true,
    tts: true,
    backgroundMusic: true,
    musicVideo: true,
  };
  const defaultCompletedSteps = defaultWorkflowDraft.completedSteps;
  const pickNonEmptyArray = <T,>(preferred?: T[] | null, secondary?: T[] | null): T[] => {
    if (Array.isArray(preferred) && preferred.length) return preferred;
    return Array.isArray(secondary) ? secondary : [];
  };
  const pickString = (preferred?: string | null, secondary?: string | null) => preferred || secondary || '';

  return {
    ...secondaryDraft,
    ...preferredDraft,
    promptPack: {
      storyPrompt: preferredDraft.promptPack?.storyPrompt
        ?? secondaryDraft.promptPack?.storyPrompt
        ?? defaultPromptPack.storyPrompt,
      lyricsPrompt: preferredDraft.promptPack?.lyricsPrompt
        ?? secondaryDraft.promptPack?.lyricsPrompt
        ?? defaultPromptPack.lyricsPrompt,
      characterPrompt: preferredDraft.promptPack?.characterPrompt
        ?? secondaryDraft.promptPack?.characterPrompt
        ?? defaultPromptPack.characterPrompt,
      scenePrompt: preferredDraft.promptPack?.scenePrompt
        ?? secondaryDraft.promptPack?.scenePrompt
        ?? defaultPromptPack.scenePrompt,
      actionPrompt: preferredDraft.promptPack?.actionPrompt
        ?? secondaryDraft.promptPack?.actionPrompt
        ?? defaultPromptPack.actionPrompt,
      persuasionStoryPrompt: preferredDraft.promptPack?.persuasionStoryPrompt
        ?? secondaryDraft.promptPack?.persuasionStoryPrompt
        ?? defaultPromptPack.persuasionStoryPrompt,
    },
    referenceImages: {
      character: preferredDraft.referenceImages?.character
        ?? secondaryDraft.referenceImages?.character
        ?? defaultReferenceImages.character,
      style: preferredDraft.referenceImages?.style
        ?? secondaryDraft.referenceImages?.style
        ?? defaultReferenceImages.style,
      characterStrength: preferredDraft.referenceImages?.characterStrength
        ?? secondaryDraft.referenceImages?.characterStrength
        ?? defaultReferenceImages.characterStrength,
      styleStrength: preferredDraft.referenceImages?.styleStrength
        ?? secondaryDraft.referenceImages?.styleStrength
        ?? defaultReferenceImages.styleStrength,
    },
    customScriptSettings: {
      expectedDurationMinutes: preferredDraft.customScriptSettings?.expectedDurationMinutes
        ?? secondaryDraft.customScriptSettings?.expectedDurationMinutes
        ?? defaultCustomScriptSettings.expectedDurationMinutes,
      speechStyle: preferredDraft.customScriptSettings?.speechStyle
        ?? secondaryDraft.customScriptSettings?.speechStyle
        ?? defaultCustomScriptSettings.speechStyle,
      language: preferredDraft.customScriptSettings?.language
        ?? secondaryDraft.customScriptSettings?.language
        ?? defaultCustomScriptSettings.language,
      referenceText: preferredDraft.customScriptSettings?.referenceText
        ?? secondaryDraft.customScriptSettings?.referenceText
        ?? defaultCustomScriptSettings.referenceText,
      referenceLinks: preferredDraft.customScriptSettings?.referenceLinks
        ?? secondaryDraft.customScriptSettings?.referenceLinks
        ?? defaultCustomScriptSettings.referenceLinks,
      scriptModel: preferredDraft.customScriptSettings?.scriptModel
        ?? secondaryDraft.customScriptSettings?.scriptModel
        ?? defaultCustomScriptSettings.scriptModel,
    },
    backgroundMusicScene: {
      enabled: preferredDraft.backgroundMusicScene?.enabled
        ?? secondaryDraft.backgroundMusicScene?.enabled
        ?? defaultBackgroundMusicScene.enabled,
      prompt: preferredDraft.backgroundMusicScene?.prompt
        ?? secondaryDraft.backgroundMusicScene?.prompt
        ?? defaultBackgroundMusicScene.prompt,
      provider: preferredDraft.backgroundMusicScene?.provider
        ?? secondaryDraft.backgroundMusicScene?.provider
        ?? defaultBackgroundMusicScene.provider,
      modelId: preferredDraft.backgroundMusicScene?.modelId
        ?? secondaryDraft.backgroundMusicScene?.modelId
        ?? defaultBackgroundMusicScene.modelId,
      title: preferredDraft.backgroundMusicScene?.title
        ?? secondaryDraft.backgroundMusicScene?.title
        ?? defaultBackgroundMusicScene.title,
      durationSeconds: preferredDraft.backgroundMusicScene?.durationSeconds
        ?? secondaryDraft.backgroundMusicScene?.durationSeconds
        ?? defaultBackgroundMusicScene.durationSeconds,
      promptSections: preferredDraft.backgroundMusicScene?.promptSections
        ?? secondaryDraft.backgroundMusicScene?.promptSections
        ?? defaultBackgroundMusicScene.promptSections,
      selectedTrackId: preferredDraft.backgroundMusicScene?.selectedTrackId
        ?? secondaryDraft.backgroundMusicScene?.selectedTrackId
        ?? defaultBackgroundMusicScene.selectedTrackId,
    },
    sampleMode: {
      text: preferredDraft.sampleMode?.text
        ?? secondaryDraft.sampleMode?.text
        ?? defaultSampleMode.text,
      tts: preferredDraft.sampleMode?.tts
        ?? secondaryDraft.sampleMode?.tts
        ?? defaultSampleMode.tts,
      backgroundMusic: preferredDraft.sampleMode?.backgroundMusic
        ?? secondaryDraft.sampleMode?.backgroundMusic
        ?? defaultSampleMode.backgroundMusic,
      musicVideo: preferredDraft.sampleMode?.musicVideo
        ?? secondaryDraft.sampleMode?.musicVideo
        ?? defaultSampleMode.musicVideo,
    },
    completedSteps: {
      step1: preferredDraft.completedSteps?.step1
        ?? secondaryDraft.completedSteps?.step1
        ?? defaultCompletedSteps.step1,
      step2: preferredDraft.completedSteps?.step2
        ?? secondaryDraft.completedSteps?.step2
        ?? defaultCompletedSteps.step2,
      step3: preferredDraft.completedSteps?.step3
        ?? secondaryDraft.completedSteps?.step3
        ?? defaultCompletedSteps.step3,
      step4: preferredDraft.completedSteps?.step4
        ?? secondaryDraft.completedSteps?.step4
        ?? defaultCompletedSteps.step4,
      step5: preferredDraft.completedSteps?.step5
        ?? secondaryDraft.completedSteps?.step5
        ?? defaultCompletedSteps.step5,
    },
    extractedCharacters: pickNonEmptyArray(preferredDraft.extractedCharacters, secondaryDraft.extractedCharacters),
    styleImages: pickNonEmptyArray(preferredDraft.styleImages, secondaryDraft.styleImages),
    characterImages: pickNonEmptyArray(preferredDraft.characterImages, secondaryDraft.characterImages),
    selectedCharacterIds: pickNonEmptyArray(preferredDraft.selectedCharacterIds, secondaryDraft.selectedCharacterIds),
    hasSelectedContentType: preferredDraft.hasSelectedContentType ?? secondaryDraft.hasSelectedContentType ?? false,
    hasSelectedAspectRatio: preferredDraft.hasSelectedAspectRatio ?? secondaryDraft.hasSelectedAspectRatio ?? false,
    selectedCharacterStyleId: preferredDraft.selectedCharacterStyleId ?? secondaryDraft.selectedCharacterStyleId ?? null,
    selectedCharacterStyleLabel: pickString(preferredDraft.selectedCharacterStyleLabel, secondaryDraft.selectedCharacterStyleLabel),
    selectedCharacterStylePrompt: pickString(preferredDraft.selectedCharacterStylePrompt, secondaryDraft.selectedCharacterStylePrompt),
    selectedStyleImageId: preferredDraft.selectedStyleImageId ?? secondaryDraft.selectedStyleImageId ?? null,
    promptTemplates: pickNonEmptyArray(preferredDraft.promptTemplates, secondaryDraft.promptTemplates),
    selectedPromptTemplateId: preferredDraft.selectedPromptTemplateId || secondaryDraft.selectedPromptTemplateId || null,
    updatedAt: Math.max(baseUpdatedAt, incomingUpdatedAt, Date.now()),
  };
}

function buildWorkflowDraftSignature(draft: WorkflowDraft) {
  return JSON.stringify({
    id: draft.id,
    contentType: draft.contentType,
    aspectRatio: draft.aspectRatio,
    topic: draft.topic,
    outputMode: draft.outputMode,
    activeStage: draft.activeStage,
    selections: draft.selections,
    script: draft.script,
    completedSteps: draft.completedSteps,
    hasSelectedContentType: draft.hasSelectedContentType,
    hasSelectedAspectRatio: draft.hasSelectedAspectRatio,
    selectedCharacterIds: draft.selectedCharacterIds,
    selectedCharacterStyleId: draft.selectedCharacterStyleId,
    selectedCharacterStyleLabel: draft.selectedCharacterStyleLabel,
    selectedCharacterStylePrompt: draft.selectedCharacterStylePrompt,
    selectedStyleImageId: draft.selectedStyleImageId,
    extractedCharacters: draft.extractedCharacters,
    styleImages: draft.styleImages,
    characterImages: draft.characterImages,
    promptPack: draft.promptPack,
    promptTemplates: draft.promptTemplates,
    selectedPromptTemplateId: draft.selectedPromptTemplateId,
    customScriptSettings: draft.customScriptSettings,
    constitutionAnalysis: draft.constitutionAnalysis,
    ttsProvider: draft.ttsProvider,
    elevenLabsVoiceId: draft.elevenLabsVoiceId,
    elevenLabsModelId: draft.elevenLabsModelId,
    heygenVoiceId: draft.heygenVoiceId,
    qwenVoicePreset: draft.qwenVoicePreset,
    chatterboxVoicePreset: draft.chatterboxVoicePreset,
    qwenStylePreset: draft.qwenStylePreset,
    voiceReferenceName: draft.voiceReferenceName,
    voiceReferenceMimeType: draft.voiceReferenceMimeType,
    referenceImages: draft.referenceImages,
  });
}

const resolveBasePath = (pathname?: string | null) => {
  const fallback = '/mp4Creater';
  const value = pathname || fallback;
  const markerIndex = value.indexOf('/mp4Creater');
  if (markerIndex < 0) return value;
  return value.slice(0, markerIndex + '/mp4Creater'.length);
};

function applyStudioDefaultsToWorkflowDraft(baseDraft: WorkflowDraft, studioState?: StudioState | null): WorkflowDraft {
  const routing = studioState?.routing;
  return {
    ...baseDraft,
    openRouterModel: routing?.scriptModel || routing?.textModel || baseDraft.openRouterModel,
    customScriptSettings: {
      expectedDurationMinutes: baseDraft.customScriptSettings?.expectedDurationMinutes || 1,
      speechStyle: baseDraft.customScriptSettings?.speechStyle || 'default',
      language: baseDraft.customScriptSettings?.language || 'ko',
      referenceText: baseDraft.customScriptSettings?.referenceText || '',
      referenceLinks: baseDraft.customScriptSettings?.referenceLinks || [],
      scriptModel: routing?.scriptModel || routing?.textModel || baseDraft.customScriptSettings?.scriptModel || baseDraft.openRouterModel,
    },
    ttsProvider: baseDraft.ttsProvider || routing?.ttsProvider || 'qwen3Tts',
    elevenLabsVoiceId: baseDraft.elevenLabsVoiceId ?? routing?.elevenLabsVoiceId ?? null,
    elevenLabsModelId: baseDraft.elevenLabsModelId ?? routing?.elevenLabsModelId ?? routing?.audioModel ?? null,
    heygenVoiceId: baseDraft.heygenVoiceId ?? routing?.heygenVoiceId ?? null,
    qwenVoicePreset: baseDraft.qwenVoicePreset || routing?.qwenVoicePreset || 'qwen-default',
    qwenStylePreset: baseDraft.qwenStylePreset || routing?.qwenStylePreset || 'balanced',
    updatedAt: Date.now(),
  };
}

let hasBootstrappedSession = false;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const isLocalMp4CreaterRuntime = () => (
  typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname)
);

const shouldAutoConfigureLocalStorage = (state?: Pick<StudioState, 'isStorageConfigured' | 'storageDir'> | null) => (
  isLocalMp4CreaterRuntime()
  && (!state?.isStorageConfigured || !state?.storageDir?.trim())
);

const mergeProjectLists = (primary: SavedProject[] = [], fallback: SavedProject[] = []) => {
  const byId = new Map<string, SavedProject>();
  [...primary, ...fallback].forEach((project) => {
    if (!project?.id) return;
    if (!byId.has(project.id)) byId.set(project.id, project);
  });
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

interface AppProps {
  routeStep?: 1 | 2 | 3 | 4 | 5 | null;
}

type WorkflowRouteStep = 1 | 2 | 3 | 4 | 5 | 6;

const App: React.FC<AppProps> = ({ routeStep = null }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => resolveBasePath(pathname), [pathname]);
  const newProjectHandledRef = useRef('');
  const queryProjectHandledRef = useRef('');
  const queryProjectLoadingRef = useRef('');
  const queryProjectRetryTimerRef = useRef<number | null>(null);
  const studioStateRef = useRef<StudioState | null>(null);
  const workflowDraftSaveTimerRef = useRef<number | null>(null);
  const pendingWorkflowDraftRef = useRef<StudioState['workflowDraft'] | null>(null);

  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generatedData, setGeneratedData] = useState<GeneratedAsset[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [studioState, setStudioState] = useState<StudioState>(() => createDefaultStudioState());
  const [showStartupWizard, setShowStartupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiModalTitle, setApiModalTitle] = useState('API 키 등록');
  const [apiModalDescription, setApiModalDescription] = useState('필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
  const [apiModalFocusField, setApiModalFocusField] = useState<'openRouter' | 'elevenLabs' | 'heygen' | 'fal' | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'gallery'>(routeStep ? 'main' : resolveAppViewMode(searchParams));
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [backgroundMusicTracks, setBackgroundMusicTracks] = useState<BackgroundMusicTrack[]>([]);
  const [previewMix, setPreviewMix] = useState<PreviewMixSettings>(getDefaultPreviewMix());
  const [animatingIndices] = useState<Set<number>>(new Set());
  const [isExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentCost, setCurrentCost] = useState<CostBreakdown | null>(null);
  const [navigationOverlay, setNavigationOverlay] = useState<{ title: string; description: string; mode?: 'panel' | 'gray' } | null>(null);
  const [projectLookupTick, setProjectLookupTick] = useState(0);
  const autosaveTimerRef = useRef<number | null>(null);
  const projectDraftSyncTimerRef = useRef<number | null>(null);
  const lastWorkflowDraftSignatureRef = useRef('');
  const pendingProjectSaveReasonRef = useRef<'input' | 'action' | null>(null);
  const pendingProjectSaveTokenRef = useRef(0);

  const externalStorageReady = Boolean(studioState?.isStorageConfigured && studioState?.storageDir?.trim());
  const projectPersistenceReady = typeof window === 'undefined' ? true : typeof window.indexedDB !== 'undefined';
  const requestedProjectId = searchParams?.get('projectId') || '';
  const galleryLiveApiCostTotal = useMemo(
    () => savedProjects.reduce((sum, project) => sum + (typeof project?.cost?.total === 'number' ? project.cost.total : 0), 0),
    [savedProjects],
  );

  const buildNavigationSnapshotProject = useCallback((workflowDraftOverride?: WorkflowDraft | null) => {
    const targetProjectId = currentProjectId || requestedProjectId;
    if (!targetProjectId) return null;
    const existingProject = savedProjects.find((item) => item.id === targetProjectId) || null;
    const topic = workflowDraftOverride?.topic || currentTopic || existingProject?.topic || existingProject?.name || '새 프로젝트';
    const fallbackDraft = workflowDraftOverride
      || studioStateRef.current?.workflowDraft
      || createDefaultWorkflowDraft(studioStateRef.current?.lastContentType || 'story');
    const baseProject = createOptimisticWorkflowProject({
      projectId: targetProjectId,
      topic,
      workflowDraft: fallbackDraft,
      assets: generatedData,
      backgroundMusicTracks,
      previewMix,
    });

    return {
      ...baseProject,
      ...existingProject,
      id: targetProjectId,
      topic,
      workflowDraft: fallbackDraft,
      assets: generatedData.length ? normalizeLoadedAssets(generatedData) : (existingProject?.assets || []),
      backgroundMusicTracks: backgroundMusicTracks.length ? backgroundMusicTracks : (existingProject?.backgroundMusicTracks || []),
      previewMix: previewMix || existingProject?.previewMix,
      lastSavedAt: Date.now(),
      cost: currentCost || existingProject?.cost,
    } as SavedProject;
  }, [backgroundMusicTracks, currentCost, currentProjectId, currentTopic, generatedData, previewMix, requestedProjectId, savedProjects]);

  const applyProjectListSnapshot = useCallback((projects: SavedProject[] = []) => {
    const nextProjects = [...projects]
      .map((project) => summarizeProjectForIndex(project))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setSavedProjects(nextProjects);
    setStudioState((prev) => (prev ? { ...prev, projects: nextProjects, projectIndex: nextProjects as any } : prev));
    return nextProjects;
  }, []);

  const promptStorageSelection = useCallback((message?: string) => {
    setShowStartupWizard(true);
    setNavigationOverlay(null);
    setProgressMessage(message || 'JSON 저장 위치를 먼저 정해야 프로젝트와 워크플로우를 안정적으로 저장할 수 있습니다. 저장 위치를 선택해 주세요.');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  const ensureRuntimeStorageReady = useCallback(async (state?: StudioState | null) => {
    const currentState = state || studioStateRef.current || createDefaultStudioState();
    if (!shouldAutoConfigureLocalStorage(currentState)) return currentState;

    try {
      const configured = await configureStorage(DEFAULT_STORAGE_DIR);
      setStudioState(configured);
      setShowStartupWizard(false);
      return configured;
    } catch (error) {
      console.warn('[mp4Creater] local default storage auto-config failed', error);
      return currentState;
    }
  }, []);

  useEffect(() => {
    studioStateRef.current = studioState;
  }, [studioState]);

  useEffect(() => () => {
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    if (projectDraftSyncTimerRef.current) window.clearTimeout(projectDraftSyncTimerRef.current);
    if (queryProjectRetryTimerRef.current) window.clearTimeout(queryProjectRetryTimerRef.current);
  }, []);

  const effectiveWorkflowDraft = useMemo(() => ensureWorkflowDraft(studioState), [studioState]);

  const workflowProgress = useMemo(() => {
    const completed = effectiveWorkflowDraft?.completedSteps || { step1: false, step2: false, step3: false, step4: false };
    const count = Object.values(completed).filter(Boolean).length;
    return {
      percent: Math.round((count / 4) * 100),
      text: `워크플로우 ${count}/4 단계 완료`,
    };
  }, [effectiveWorkflowDraft]);

  const resolveDraftStep = useCallback((draft?: WorkflowDraft | null, assets?: GeneratedAsset[] | null): WorkflowRouteStep => {
    if (hasSceneStudioProgressFromAssets(assets)) return 6;
    if (!draft) return 1;
    const completed = draft.completedSteps || { step1: false, step2: false, step3: false, step4: false, step5: false };
    if ((draft.activeStage || 0) >= 6) return 6;
    if (completed.step5 || (draft.activeStage || 0) >= 5) return 5;
    if (completed.step4 || (draft.activeStage || 0) >= 4) return 4;
    if (completed.step3 || (draft.activeStage || 0) >= 3) return 3;
    if (completed.step2 || (draft.activeStage || 0) >= 2) return 2;
    return 1;
  }, []);


  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const openApiModal = useCallback((options?: {
    title?: string;
    description?: string;
    focusField?: 'openRouter' | 'elevenLabs' | 'heygen' | 'fal' | null;
  }) => {
    setApiModalTitle(options?.title || 'API 키 등록');
    setApiModalDescription(options?.description || '필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
    setApiModalFocusField(options?.focusField || null);
    setShowApiModal(true);
  }, []);

  const requestProjectSave = useCallback((reason: 'input' | 'action' = 'action') => {
    pendingProjectSaveReasonRef.current = reason;
    pendingProjectSaveTokenRef.current += 1;
  }, []);

  const handleProjectInteractionCapture = useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    const nativeEvent = event.nativeEvent as Event & { isTrusted?: boolean };
    if (nativeEvent?.isTrusted === false) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tagName = target.tagName.toLowerCase();
    const inputType = target instanceof HTMLInputElement ? `${target.type || ''}`.toLowerCase() : '';

    if (tagName === 'textarea') {
      requestProjectSave('input');
      return;
    }

    if (tagName === 'input') {
      if (['checkbox', 'radio', 'file', 'range'].includes(inputType)) {
        requestProjectSave('action');
        return;
      }
      if (!['button', 'submit', 'reset'].includes(inputType)) {
        requestProjectSave('input');
        return;
      }
    }

    if (tagName === 'select' || tagName === 'button' || Boolean(target.closest('button'))) {
      requestProjectSave('action');
    }
  }, [requestProjectSave]);

  const refreshProjects = useCallback(async (options?: { forceSync?: boolean; silent?: boolean }) => {
    if (!options?.silent) setIsProjectsLoading(true);
    const cachedState = getCachedStudioState();
    const cachedProjects = Array.isArray(cachedState?.projects) ? cachedState.projects : [];
    if (cachedState) {
      setStudioState(cachedState);
      if (cachedProjects.length) {
        applyProjectListSnapshot(cachedProjects);
      }
    }

    try {
      const projects = await getSavedProjects({ forceSync: Boolean(options?.forceSync) });
      const nextProjects = applyProjectListSnapshot(projects);

      if (!cachedState || options?.forceSync) {
        const state = await fetchStudioState({ force: Boolean(options?.forceSync) });
        setStudioState({
          ...state,
          projects: nextProjects,
        });
      }
    } catch {
      // local cache fallback handled in service
    } finally {
      if (!options?.silent) setIsProjectsLoading(false);
    }
  }, [applyProjectListSnapshot]);

  const commitPendingWorkflowDraft = useCallback(async () => {
    const currentState = studioStateRef.current;
    const pendingDraft = pendingWorkflowDraftRef.current;
    if (!currentState || !pendingDraft) return;

    try {
      const nextState = await saveStudioState({
        ...currentState,
        workflowDraft: pendingDraft,
        lastContentType: pendingDraft.contentType || currentState.lastContentType || 'story',
        updatedAt: Date.now(),
      });
      pendingWorkflowDraftRef.current = null;
      lastWorkflowDraftSignatureRef.current = buildWorkflowDraftSignature(pendingDraft);
      setStudioState(nextState);
    } catch (error) {
      console.error('[mp4Creater] workflow draft save failed', error);
      setProgressMessage('임시 저장 중 오류가 발생해 현재 브라우저 상태를 유지합니다.');
    }
  }, []);

  const handleStartNewProject = useCallback(async (
    forceType?: StudioState['lastContentType'],
    projectName?: string,
    navigateToStep1?: boolean
  ) => {
    if (workflowDraftSaveTimerRef.current) {
      window.clearTimeout(workflowDraftSaveTimerRef.current);
      workflowDraftSaveTimerRef.current = null;
    }
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (projectDraftSyncTimerRef.current) {
      window.clearTimeout(projectDraftSyncTimerRef.current);
      projectDraftSyncTimerRef.current = null;
    }
    pendingWorkflowDraftRef.current = null;
    lastWorkflowDraftSignatureRef.current = '';

    const shouldUseOverlay = false;
    try {
      if (shouldUseOverlay) {
        setNavigationOverlay({
          title: '프로젝트 생성 중',
          description: '새 프로젝트를 만들고 있습니다.',
          mode: 'gray',
        });
      }
      if (navigateToStep1) {
        try {
          router.prefetch(`${basePath}/step-1`);
        } catch {}
      }

      const currentState = await ensureRuntimeStorageReady(studioStateRef.current || studioState || createDefaultStudioState());
      const nextDraft = applyStudioDefaultsToWorkflowDraft(createDefaultWorkflowDraft(forceType || 'story'), currentState);
      const safeProjectName = projectName?.trim() || '';
      if (safeProjectName) nextDraft.topic = safeProjectName;
      const topic = safeProjectName || nextDraft.topic || '새 프로젝트';
      const nextPreviewMix = getDefaultPreviewMix();
      const pendingStateForSave: StudioState = {
        ...currentState,
        workflowDraft: nextDraft,
        selectedCharacterId: null,
        updatedAt: Date.now(),
        lastContentType: nextDraft.contentType,
      };

      const optimisticProject = navigateToStep1
        ? createOptimisticWorkflowProject({
            topic,
            workflowDraft: nextDraft,
            assets: [],
            backgroundMusicTracks: [],
            previewMix: nextPreviewMix,
          })
        : null;
      const optimisticProjectList = optimisticProject
        ? [optimisticProject, ...savedProjects.filter((item) => item.id !== optimisticProject.id)]
        : undefined;

      setStudioState(pendingStateForSave);
      setGeneratedData([]);
      setCurrentTopic(optimisticProject?.topic || '');
      setCurrentProjectId(optimisticProject?.id || null);
      setBackgroundMusicTracks([]);
      setPreviewMix(nextPreviewMix);
      setCurrentCost(null);
      setStep(GenerationStep.IDLE);
      if (!navigateToStep1) {
        setViewMode('main');
      }

      const saveStatePromise = saveStudioState({
        ...pendingStateForSave,
        ...(optimisticProjectList
          ? {
              projects: optimisticProjectList,
              projectIndex: optimisticProjectList,
            }
          : {}),
      })
        .catch((error) => {
          console.warn('[mp4Creater] initial studio state save failed', error);
          return pendingStateForSave;
        });

      const committedState = await saveStatePromise;
      setStudioState(committedState);

      if (navigateToStep1 && optimisticProject) {
        let project: SavedProject | null = null;
        let lastError: unknown = null;

        rememberProjectNavigationProject(optimisticProject);
        applyProjectListSnapshot(optimisticProjectList || [optimisticProject]);
        setViewMode('main');

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const created = await upsertWorkflowProject({
              projectId: optimisticProject.id,
              topic,
              workflowDraft: nextDraft,
              assets: [],
              backgroundMusicTracks: [],
              previewMix: nextPreviewMix,
            });
            project = created;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!project) {
          try {
            await saveStudioProject(optimisticProject);
            project = optimisticProject;
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }

        if (!project) {
          console.error('[mp4Creater] project_create_failed', lastError || new Error('project_create_failed'));
          project = optimisticProject;
          setProgressMessage('프로젝트 저장이 잠시 지연되어도 Step1은 바로 열리도록 임시 상태로 먼저 진행합니다.');
        }

        setCurrentProjectId(project.id);
        setCurrentTopic(project.topic || topic);
        rememberProjectNavigationProject(project);
        applyProjectListSnapshot([project, ...savedProjects.filter((item) => item.id !== project.id && item.id !== optimisticProject.id)]);
        setNavigationOverlay(null);
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
        router.push(`${basePath}/step-1?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
        void refreshProjects({ silent: true });
        return;
      }

      let project: SavedProject | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const created = await upsertWorkflowProject({
            projectId: null,
            topic,
            workflowDraft: nextDraft,
            assets: [],
            backgroundMusicTracks: [],
            previewMix: nextPreviewMix,
          });
          project = created;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!project) throw lastError || new Error('project_create_failed');

      setCurrentProjectId(project.id);
      rememberProjectNavigationProject(project);
      applyProjectListSnapshot([project, ...savedProjects.filter((item) => item.id !== project.id)]);

      setNavigationOverlay(null);
      if (navigateToStep1) {
        setViewMode('main');
        router.push(`${basePath}/step-1?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
      } else {
        void refreshProjects({ silent: true });
      }
    } catch (error) {
      setNavigationOverlay(null);
      throw error;
    }
  }, [applyProjectListSnapshot, basePath, ensureRuntimeStorageReady, refreshProjects, router, savedProjects, studioState]);

  useEffect(() => {
    setViewMode(routeStep ? 'main' : resolveAppViewMode(searchParams));
  }, [searchParams, routeStep]);

  useEffect(() => {
    if (!routeStep) return;
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
  }, [routeStep, pathname]);

  useEffect(() => {
    if (!routeStep) return;
    const projectQuery = currentProjectId ? `?projectId=${encodeURIComponent(currentProjectId)}` : '';
    const candidates = [routeStep - 1, routeStep + 1]
      .filter((step): step is number => step >= 1 && step <= 6);

    candidates.forEach((step) => {
      try {
        router.prefetch(`${basePath}/step-${step}${projectQuery}`);
      } catch {}
    });
  }, [routeStep, currentProjectId, router, basePath]);

  useEffect(() => {
    if (routeStep) return;
    if (searchParams?.get('view') !== 'main') return;
    router.replace(`${basePath}?view=gallery`, { scroll: false });
  }, [routeStep, searchParams, router, basePath]);

  useEffect(() => {
    if (!routeStep) return;
    if (searchParams?.get('projectId')) return;
    setNavigationOverlay(null);
    const targetStep = resolveDraftStep(studioState?.workflowDraft || null, generatedData);
    if (targetStep <= routeStep) return;
    const projectQuery = currentProjectId ? `?projectId=${encodeURIComponent(currentProjectId)}` : '';
    router.replace(`${basePath}/step-${targetStep}${projectQuery}`, { scroll: false });
  }, [routeStep, studioState?.workflowDraft, resolveDraftStep, router, basePath, currentProjectId, generatedData, searchParams]);


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const bootstrapCachedState = getCachedStudioState();
      const cachedProjects = Array.isArray(bootstrapCachedState?.projects) ? bootstrapCachedState.projects : [];
      if (bootstrapCachedState) {
        const cachedState = await ensureRuntimeStorageReady(bootstrapCachedState);
        if (cancelled) return;
        setStudioState(cachedState);
        if (cachedProjects.length) {
          applyProjectListSnapshot(cachedProjects);
        }
        setShowStartupWizard(false);
      }

      if (hasBootstrappedSession && bootstrapCachedState) {
        if (!cancelled) setIsProjectsLoading(false);
        void refreshProjects({ silent: true });
        return;
      }

      hasBootstrappedSession = true;
      if (!cancelled) setIsProjectsLoading(true);
      try {
        try {
          const fetchedState = await fetchStudioState({ force: true });
          const state = await ensureRuntimeStorageReady(fetchedState);
          if (cancelled) return;
          setStudioState(state);
          if (Array.isArray(state.projects) && state.projects.length) {
            applyProjectListSnapshot(state.projects);
          }
          setShowStartupWizard(false);
        } catch {
          const fallback = await ensureRuntimeStorageReady(createDefaultStudioState());
          if (cancelled) return;
          setStudioState(fallback);
          setShowStartupWizard(false);
        }

        await migrateFromLocalStorage();
        const projects = await getSavedProjects();
        if (cancelled) return;
        const latestCachedProjects = getCachedStudioState()?.projects || [];
        applyProjectListSnapshot(projects.length ? projects : latestCachedProjects);
        const latestCachedState = getCachedStudioState();
        if (latestCachedState) setStudioState(latestCachedState);
      } finally {
        if (!cancelled) setIsProjectsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureRuntimeStorageReady, refreshProjects]);

  useEffect(() => {
    const newFlag = searchParams?.get('new') || '';
    if (!newFlag || !studioState) return;
    const signature = `${basePath}:${newFlag}`;
    if (newProjectHandledRef.current === signature) return;
    newProjectHandledRef.current = signature;

    void (async () => {
      await handleStartNewProject('story', undefined, true);
    })();
  }, [searchParams, studioState, handleStartNewProject, router, basePath]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (!generatedData.length) return;
    if (!projectPersistenceReady) return;
    if (!pendingProjectSaveReasonRef.current) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);

    const saveReason = pendingProjectSaveReasonRef.current;
    const saveToken = pendingProjectSaveTokenRef.current;
    autosaveTimerRef.current = window.setTimeout(async () => {
      if (pendingProjectSaveTokenRef.current !== saveToken) return;
      const updated = await updateProject(currentProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
      });
      if (updated) {
        applyProjectListSnapshot([updated, ...savedProjects.filter((item) => item.id !== updated.id)]);
      }
      pendingProjectSaveReasonRef.current = null;
    }, saveReason === 'input' ? 1000 : 180);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [currentProjectId, generatedData, backgroundMusicTracks, previewMix, savedProjects, projectPersistenceReady]);

  const handleDeleteProjects = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;

    const deletingCurrentProject = Boolean(currentProjectId && uniqueIds.includes(currentProjectId));
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (projectDraftSyncTimerRef.current) {
      window.clearTimeout(projectDraftSyncTimerRef.current);
      projectDraftSyncTimerRef.current = null;
    }
    if (deletingCurrentProject && workflowDraftSaveTimerRef.current) {
      window.clearTimeout(workflowDraftSaveTimerRef.current);
      workflowDraftSaveTimerRef.current = null;
      pendingWorkflowDraftRef.current = null;
    }

    const previousProjects = savedProjects;
    const nextProjects = previousProjects.filter((project) => !uniqueIds.includes(project.id));
    applyProjectListSnapshot(nextProjects);

    if (deletingCurrentProject) {
      setCurrentProjectId(null);
      setCurrentTopic('');
      setGeneratedData([]);
      setBackgroundMusicTracks([]);
      setPreviewMix(getDefaultPreviewMix());
      setCurrentCost(null);
      setStep(GenerationStep.IDLE);
      setNavigationOverlay(null);
      setProgressMessage('');
      setViewMode('gallery');
      try {
        router.replace(`${basePath}?view=gallery`, { scroll: false });
      } catch {}
    }

    try {
      await deleteProjects(uniqueIds);
      void refreshProjects({ silent: true });
    } catch (error) {
      applyProjectListSnapshot(previousProjects);
      throw error;
    }
  };

  const handleImportProjects = async (file: File) => {
    const imported = await importProjectsFromFile(file);
    if (!imported.length) return;
    applyProjectListSnapshot([...imported, ...savedProjects.filter((existing) => !imported.some((item) => item.id === existing.id))]);
    void refreshProjects({ silent: true });
  };

  const handleRenameProject = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await renameProject(id, trimmed);
    if (!ok) return;
    applyProjectListSnapshot(savedProjects.map((item) => item.id === id ? { ...item, name: trimmed } : item));
  };

  const handleDuplicateProject = async (id: string) => {
    const copied = await duplicateProject(id);
    if (!copied) return;
    applyProjectListSnapshot([copied, ...savedProjects.filter((item) => item.id !== copied.id)]);
  };

  const handleLoadProject = useCallback((project: SavedProject) => {
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    pendingWorkflowDraftRef.current = null;

    const safeAssets = normalizeLoadedAssets(Array.isArray(project.assets) ? project.assets : []);
    const sameProjectDraft = currentProjectId === project.id ? studioStateRef.current?.workflowDraft : null;
    const mergedWorkflowDraft = mergeLoadedWorkflowDraft(sameProjectDraft || null, project.workflowDraft || null);

    setGeneratedData([...safeAssets]);
    setCurrentTopic(project.topic || project.name || '불러온 프로젝트');
    setCurrentProjectId(project.id);
    setBackgroundMusicTracks(project.backgroundMusicTracks || []);
    setPreviewMix(project.previewMix || getDefaultPreviewMix());
    setCurrentCost(project.cost || null);
    setStep(GenerationStep.COMPLETED);

    setViewMode('main');

    const baseStudioState = studioStateRef.current || createDefaultStudioState();
    const nextRouting = applyProjectSettingsToRouting({
      ...baseStudioState.routing,
    }, project.settings || null);

    const nextState = {
      ...baseStudioState,
      routing: nextRouting,
      updatedAt: Date.now(),
      ...(mergedWorkflowDraft
        ? {
            workflowDraft: mergedWorkflowDraft,
            lastContentType: mergedWorkflowDraft.contentType || baseStudioState.lastContentType || 'story',
          }
        : {}),
    };
    setStudioState(nextState);

    if (mergedWorkflowDraft) {
      const mergedDraftSignature = buildWorkflowDraftSignature(mergedWorkflowDraft);
      const currentDraftSignature = sameProjectDraft ? buildWorkflowDraftSignature(sameProjectDraft) : '';
      lastWorkflowDraftSignatureRef.current = mergedDraftSignature;

      if (mergedDraftSignature !== currentDraftSignature) {
        pendingWorkflowDraftRef.current = mergedWorkflowDraft;
        if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
        workflowDraftSaveTimerRef.current = window.setTimeout(() => {
          void commitPendingWorkflowDraft();
        }, 180);
      }
    }
  }, [commitPendingWorkflowDraft, currentProjectId]);

  useEffect(() => {
    const projectId = searchParams?.get('projectId') || '';
    const returnTo = searchParams?.get('returnTo') || '';
    if (!projectId || viewMode !== 'main') return;
    const signature = `${basePath}:${projectId}:${returnTo}`;
    if (queryProjectHandledRef.current === signature || queryProjectLoadingRef.current === signature) return;
    queryProjectLoadingRef.current = signature;

    let cancelled = false;

    void (async () => {
      const cachedNavigationProject = readProjectNavigationProject(projectId);
      const localDetailedProject = await getProjectById(projectId, { localOnly: true });
      const syncedDetailedProject = localDetailedProject ? null : await getProjectById(projectId, { forceSync: true });
      const cachedListedProject = savedProjects.find((item) => item.id === projectId) || null;
      const project = hasDetailedProjectPayload(cachedNavigationProject)
        ? cachedNavigationProject
        : localDetailedProject
          || syncedDetailedProject
          || cachedNavigationProject
          || cachedListedProject;

      if (cancelled) return;

      if (!project) {
        queryProjectLoadingRef.current = '';
        if (queryProjectRetryTimerRef.current) window.clearTimeout(queryProjectRetryTimerRef.current);
        queryProjectRetryTimerRef.current = window.setTimeout(() => {
          setProjectLookupTick((prev) => prev + 1);
        }, 180);
        return;
      }

      queryProjectHandledRef.current = signature;
      queryProjectLoadingRef.current = '';
      handleLoadProject(project);
      setNavigationOverlay(null);
      if (returnTo === 'workflow') {
        setProgressMessage('');
      }
      const nextStep = resolveDraftStep(project.workflowDraft || null, project.assets || []);
      const clearRouteStep = routeStep || nextStep;
      const clearQueryPath = `${basePath}/step-${clearRouteStep}?projectId=${encodeURIComponent(project.id)}`;
      const isSameRoute = pathname === `${basePath}/step-${clearRouteStep}` && searchParams?.get('projectId') === project.id && !returnTo;
      if (isSameRoute) return;
      router.replace(clearQueryPath, { scroll: false });
    })();

    return () => {
      cancelled = true;
      if (queryProjectLoadingRef.current === signature) {
        queryProjectLoadingRef.current = '';
      }
    };
  }, [searchParams, viewMode, basePath, router, handleLoadProject, routeStep, resolveDraftStep, pathname, savedProjects, projectLookupTick]);


  const handleStartupComplete = async (payload: {
    storageDir: string;
  }) => {
    const configured = await configureStorage(payload.storageDir.trim());
    const nextState = await saveStudioState({
      ...configured,
      characters: configured.characters || [],
      selectedCharacterId: configured.selectedCharacterId || null,
      isStorageConfigured: true,
    });
    setStudioState(nextState);
    setShowStartupWizard(false);
    await refreshProjects();
  };

  const handleSaveStudioState = async (partial: Partial<StudioState>) => {
    const currentState = studioStateRef.current || createDefaultStudioState();
    const nextState = await saveStudioState({
      ...currentState,
      ...partial,
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
    setShowStartupWizard(false);

    if (currentProjectId && partial.routing) {
      const currentProject = await updateProject(currentProjectId, {
        settings: buildProjectSettingsSnapshot({
          routing: nextState.routing,
          workflowDraft: nextState.workflowDraft,
        }),
      });
      if (currentProject) {
        applyProjectListSnapshot([currentProject, ...savedProjects.filter((item) => item.id !== currentProject.id)]);
      }
    }

    return nextState;
  };

  const handleQuickRoutingUpdate = async (patch: Partial<StudioState['routing']>) => {
    const currentState = studioStateRef.current;
    if (!currentState) return;
    const nextRouting = {
      ...currentState.routing,
      ...patch,
    };
    const nextState = await saveStudioState({
      ...currentState,
      routing: nextRouting,
      updatedAt: Date.now(),
    });
    setStudioState(nextState);

    if (currentProjectId) {
      const currentProject = await updateProject(currentProjectId, {
        settings: buildProjectSettingsSnapshot({
          routing: nextRouting,
          workflowDraft: nextState.workflowDraft,
        }),
      });
      if (currentProject) {
        applyProjectListSnapshot([currentProject, ...savedProjects.filter((item) => item.id !== currentProject.id)]);
      }
    }
  };

  const handleSaveWorkflowDraft = (draftPatch: Partial<WorkflowDraft>) => {
    const currentState = studioStateRef.current;
    if (!currentState) return;

    const baseDraft = currentState.workflowDraft || createDefaultWorkflowDraft(currentState.lastContentType || 'story');
    const nextDraft = {
      ...baseDraft,
      ...draftPatch,
      updatedAt: Date.now(),
    };
    const draftSignature = buildWorkflowDraftSignature(nextDraft);

    if (lastWorkflowDraftSignatureRef.current === draftSignature) return;
    lastWorkflowDraftSignatureRef.current = draftSignature;

    pendingWorkflowDraftRef.current = nextDraft;
    setStudioState((prev) => (prev ? {
      ...prev,
      workflowDraft: nextDraft,
      lastContentType: nextDraft.contentType || prev.lastContentType || 'story',
    } : prev));

    const navigationSnapshotProject = buildNavigationSnapshotProject(nextDraft);
    if (navigationSnapshotProject) {
      rememberProjectNavigationProject(navigationSnapshotProject);
    }

    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    workflowDraftSaveTimerRef.current = window.setTimeout(() => {
      void commitPendingWorkflowDraft();
    }, 180);

    const targetProjectId = currentProjectId || requestedProjectId;
    if (targetProjectId && projectPersistenceReady) {
      if (projectDraftSyncTimerRef.current) window.clearTimeout(projectDraftSyncTimerRef.current);
      projectDraftSyncTimerRef.current = window.setTimeout(() => {
        void updateProject(targetProjectId, {
          workflowDraft: nextDraft,
          topic: nextDraft.topic || currentTopic || '새 프로젝트',
        });
      }, 180);
    }
  };

  const handleOpenSceneStudio = useCallback(async (draftPatch: Partial<WorkflowDraft>) => {
    const currentState = studioStateRef.current || createDefaultStudioState();
    if (false) {
      promptStorageSelection('JSON 저장 위치가 정해져야 프로젝트와 씬 데이터를 빠르게 저장할 수 있습니다. 먼저 저장 위치를 선택해 주세요.');
      return;
    }
    const baseDraft = currentState.workflowDraft || createDefaultWorkflowDraft(currentState.lastContentType || 'story');
    const nextDraft: WorkflowDraft = {
      ...baseDraft,
      ...draftPatch,
      updatedAt: Date.now(),
    };

    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    pendingWorkflowDraftRef.current = null;
    setNavigationOverlay({
      title: '씬 제작 페이지를 여는 중',
      description: '프로젝트를 먼저 저장하고, 씬 카드는 생성 버튼을 눌렀을 때만 실제 AI 작업이 시작되도록 준비합니다.',
    });
    try {
      router.prefetch(`${basePath}/step-6`);
    } catch {}

    try {
      const targetProjectId = currentProjectId || requestedProjectId || null;
      const cachedSceneProject = targetProjectId ? readProjectNavigationProject(targetProjectId) : null;
      const storedSceneProject = targetProjectId ? await getProjectById(targetProjectId, { localOnly: true }) : null;
      const existingSceneProject = hasDetailedSceneStudioProject(storedSceneProject)
        ? storedSceneProject
        : hasDetailedSceneStudioProject(cachedSceneProject)
          ? cachedSceneProject
          : storedSceneProject || cachedSceneProject;
      const initialSceneAssets = existingSceneProject?.assets?.length
        ? normalizeLoadedAssets(existingSceneProject.assets)
        : nextDraft.script?.trim()
          ? createEmptySceneAssetsFromDraft(nextDraft)
          : generatedData;

      const nextBackgroundTracks = backgroundMusicTracks.length
        ? backgroundMusicTracks
        : existingSceneProject?.backgroundMusicTracks?.length
          ? existingSceneProject.backgroundMusicTracks
          : [createSampleBackgroundTrack(nextDraft)];
      const nextActiveBackgroundTrackId = existingSceneProject?.activeBackgroundTrackId
        || nextDraft.backgroundMusicScene?.selectedTrackId
        || nextBackgroundTracks[0]?.id
        || null;
      const nextPreviewMix = previewMix || existingSceneProject?.previewMix || getDefaultPreviewMix();
      const nextCost = currentCost || existingSceneProject?.cost || null;
      // Step6 생성에는 선택본만 참조하지만, 프로젝트 저장본에는 후보/선택 관계 전체를 유지해 재열기와 export/import 재현성을 지킵니다.
      const projectDraftForScene = mergeLoadedWorkflowDraft(existingSceneProject?.workflowDraft || null, nextDraft) || nextDraft;
      setStudioState((prev) => ({
        ...(prev || currentState),
        workflowDraft: projectDraftForScene,
        lastContentType: projectDraftForScene.contentType || currentState.lastContentType || 'story',
        updatedAt: Date.now(),
      }));
      const optimisticSceneProjectBase = createOptimisticWorkflowProject({
        projectId: targetProjectId,
        topic: nextDraft.topic || '새 프로젝트',
        workflowDraft: projectDraftForScene,
        assets: initialSceneAssets,
        backgroundMusicTracks: nextBackgroundTracks,
        previewMix: nextPreviewMix,
      });
      const optimisticSceneProject = {
        ...optimisticSceneProjectBase,
        cost: nextCost,
        activeBackgroundTrackId: nextActiveBackgroundTrackId,
        sceneStudioPreviewVideo: existingSceneProject?.sceneStudioPreviewVideo || null,
        sceneStudioPreviewStatus: existingSceneProject?.sceneStudioPreviewStatus || null,
        sceneStudioPreviewMessage: existingSceneProject?.sceneStudioPreviewMessage || null,
      } as SavedProject;

      setGeneratedData(normalizeLoadedAssets(initialSceneAssets));
      setBackgroundMusicTracks(nextBackgroundTracks);
      setPreviewMix(nextPreviewMix);
      setCurrentProjectId(optimisticSceneProject.id);
      rememberProjectNavigationProject(optimisticSceneProject);
      writeSceneStudioSnapshot(buildSceneStudioSnapshotPayload({
        projectId: optimisticSceneProject.id,
        assets: initialSceneAssets,
        backgroundMusicTracks: nextBackgroundTracks,
        activeBackgroundTrackId: nextActiveBackgroundTrackId,
        previewMix: nextPreviewMix,
        workflowDraft: projectDraftForScene,
        cost: nextCost,
      }));

      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}

      void upsertWorkflowProject({
        projectId: optimisticSceneProject.id,
        topic: nextDraft.topic || '새 프로젝트',
        workflowDraft: projectDraftForScene,
        assets: initialSceneAssets,
        cost: nextCost || undefined,
        backgroundMusicTracks: nextBackgroundTracks,
        activeBackgroundTrackId: nextActiveBackgroundTrackId,
        previewMix: nextPreviewMix,
      })
        .then((project) => {
          rememberProjectNavigationProject(project);
          setCurrentProjectId(project.id);
          void refreshProjects({ silent: true });
        })
        .catch((saveError) => {
          console.error('[mp4Creater] scene studio background save failed', saveError);
        });

      router.push(`${basePath}/step-6?projectId=${encodeURIComponent(optimisticSceneProject.id)}`, { scroll: true });
    } catch (error) {
      console.error('[mp4Creater] scene studio open failed', error);
      setNavigationOverlay(null);
      setProgressMessage('씬 제작 페이지를 여는 중 문제가 생겼습니다. 입력값을 다시 확인해 주세요.');
    }
  }, [backgroundMusicTracks, basePath, currentCost, currentProjectId, ensureRuntimeStorageReady, generatedData, previewMix, promptStorageSelection, refreshProjects, requestedProjectId, router]);

  const handleNarrationChange = (index: number, narration: string) => {
    requestProjectSave('input');
    setGeneratedData((prev) => prev.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      narration,
      targetDuration: Math.min(6, Math.max(3, estimateClipDuration(narration))),
    } : item));
  };

  const handleDurationChange = (index: number, duration: number) => {
    requestProjectSave('input');
    setGeneratedData((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, targetDuration: Math.min(6, Math.max(3, duration)) } : item));
  };

  return (
    <div className={`mp4-shell ${viewMode === 'gallery' ? 'min-h-0' : 'min-h-screen'} text-slate-900`} onClickCapture={handleProjectInteractionCapture} onChangeCapture={handleProjectInteractionCapture} onInputCapture={handleProjectInteractionCapture}>
      <LoadingOverlay
        open={Boolean(navigationOverlay)}
        title={navigationOverlay?.title || '이동 중'}
        description={navigationOverlay?.description}
        mode={navigationOverlay?.mode || 'panel'}
      />
      <Header
        projectCount={savedProjects.length}
        selectedCharacterName={selectedCharacterName}
        storageDir={studioState?.storageDir}
        liveApiCostTotal={viewMode === 'gallery' ? galleryLiveApiCostTotal : currentCost?.total ?? null}
        onOpenSettings={() => setShowSettings(true)}
        onGoGallery={() => { router.push(`${basePath}?view=gallery`, { scroll: false }); }}
        viewMode={viewMode}
        basePath={basePath}
        currentSection={viewMode}
        progressPercent={workflowProgress.percent}
        progressText={workflowProgress.text}
      />

      {showStartupWizard && (
        <StartupWizard initialStorageDir={studioState?.storageDir} onComplete={handleStartupComplete} />
      )}

      <SettingsDrawer
        open={showSettings}
        studioState={studioState}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveStudioState}
      />

      <ProviderQuickModal
        open={showApiModal}
        studioState={studioState}
        title={apiModalTitle}
        description={apiModalDescription}
        focusField={apiModalFocusField}
        onClose={() => setShowApiModal(false)}
        onSave={handleSaveStudioState}
        onOpenFullSettings={() => {
          setShowApiModal(false);
          setShowSettings(true);
        }}
      />

      {viewMode === 'gallery' && (
        <ProjectGallery
          projects={savedProjects}
          isLoading={isProjectsLoading}
          onDeleteProjects={handleDeleteProjects}
          onImportProjects={handleImportProjects}
          onDuplicateProject={handleDuplicateProject}
          onRenameProject={handleRenameProject}
          onLoad={handleLoadProject}
          basePath={basePath}
          onCreateNewProject={(name) => handleStartNewProject('story', name, true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {viewMode === 'main' && (
        <main className="py-8">
          {false && !externalStorageReady && !shouldAutoConfigureLocalStorage(studioState) && (
            <div className="mx-auto mb-6 max-w-6xl px-4">
              <div className="mp4-glass-panel rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">저장 위치 필요</div>
                    <p className="mt-1 text-sm font-semibold text-amber-900">JSON 저장 위치를 정해야 프로젝트와 프롬프트, 미디어 메타데이터가 한 번에 안정적으로 저장됩니다.</p>
                  </div>
                  <button type="button" onClick={() => setShowStartupWizard(true)} className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white hover:bg-amber-500">저장 위치 정하기</button>
                </div>
              </div>
            </div>
          )}
          {routeStep && requestedProjectId && currentProjectId !== requestedProjectId ? (
            <div className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8">
              <div className="mp4-glass-hero rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">프로젝트 복원 중</div>
                <div className="mt-2 text-2xl font-black text-slate-900">선택한 Step 데이터를 먼저 정확히 맞추고 있습니다</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Step3 출연자 선택, Step4 캐릭터 이미지, Step5 화풍 선택이 요약본으로 덮이지 않도록 프로젝트 상세 JSON 또는 세션 캐시를 먼저 읽은 뒤 화면을 엽니다.</p>
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                    <span>Step 데이터 준비 상태</span>
                    <span>28%</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full w-[28%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <InputSection
            step={step}
            studioState={studioState}
            workflowDraft={effectiveWorkflowDraft}
            basePath={basePath}
            routeStep={routeStep}
            onNavigateStep={async (nextStep) => {
              const currentDraft = pendingWorkflowDraftRef.current || studioStateRef.current?.workflowDraft || effectiveWorkflowDraft;
              if (workflowDraftSaveTimerRef.current) {
                window.clearTimeout(workflowDraftSaveTimerRef.current);
                workflowDraftSaveTimerRef.current = null;
              }
              if (projectDraftSyncTimerRef.current) {
                window.clearTimeout(projectDraftSyncTimerRef.current);
                projectDraftSyncTimerRef.current = null;
              }
              if (pendingWorkflowDraftRef.current) {
                await commitPendingWorkflowDraft();
              }
              if (currentDraft) {
                const navigationSnapshotProject = buildNavigationSnapshotProject(currentDraft);
                if (navigationSnapshotProject) {
                  rememberProjectNavigationProject(navigationSnapshotProject);
                }
              }
              const targetProjectId = currentProjectId || requestedProjectId;
      if (targetProjectId && projectPersistenceReady && currentDraft) {
                const persistedProject = await updateProject(targetProjectId, {
                  workflowDraft: currentDraft,
                  topic: currentDraft.topic || currentTopic || '새 프로젝트',
                });
                if (persistedProject) {
                  rememberProjectNavigationProject(persistedProject);
                }
              }
              const projectQuery = targetProjectId ? `?projectId=${encodeURIComponent(targetProjectId)}` : '';
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              router.push(`${basePath}/step-${nextStep}${projectQuery}`, { scroll: false });
            }}
            onGoBackFromStep1={() => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              router.push(`${basePath}?view=gallery`, { scroll: false });
            }}
            onOpenSettings={() => setShowSettings(true)}
            onOpenApiModal={(options) => openApiModal({ title: options?.title || 'API 키 빠른 등록', description: options?.description || '텍스트, 오디오, 영상 공급자 키를 빠르게 등록할 수 있습니다.', focusField: options?.focusField || null })}
            onUpdateRouting={handleQuickRoutingUpdate}
            onSaveWorkflowDraft={handleSaveWorkflowDraft}
            onOpenSceneStudio={handleOpenSceneStudio}
          />
          )}

          {!routeStep && generatedData.length > 0 && (
            <ResultTable
              data={generatedData}
              onNarrationChange={handleNarrationChange}
              onDurationChange={handleDurationChange}
              onOpenSettings={() => setShowSettings(true)}
              isExporting={isExporting}
              animatingIndices={animatingIndices}
              backgroundMusicTracks={backgroundMusicTracks}
              previewMix={previewMix}
              onPreviewMixChange={setPreviewMix}
              currentTopic={currentTopic}
              totalCost={currentCost || undefined}
            />
          )}
        </main>
      )}
    </div>
  );
};

export default App;
