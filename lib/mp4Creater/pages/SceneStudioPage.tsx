'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import ProviderQuickModal from '../components/ProviderQuickModal';
import ResultTable from '../components/ResultTable';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { OverlayModal } from '../components/inputSection/ui';
import {
  AspectRatio,
  BackgroundMusicTrack,
  CostBreakdown,
  GeneratedAsset,
  GenerationStep,
  PreviewMixSettings,
  PromptedImageAsset,
  ReferenceImages,
  ScriptScene,
  StudioState,
  SavedProject,
  WorkflowDraft,
} from '../types';
import { DEFAULT_STORAGE_DIR, createDefaultStudioState, fetchStudioState, saveStudioState, getCachedStudioState } from '../services/localFileApi';
import { ensureWorkflowDraft } from '../services/workflowDraftService';
import { getDefaultPreviewMix, createSampleBackgroundTrack } from '../services/musicService';
import { generateImage, getSelectedImageModel, isSampleImageModel } from '../services/imageService';
import { buildThumbnailScene, createSampleThumbnail } from '../services/thumbnailService';
import { generateTtsAudio } from '../services/ttsService';
import { generateMotionPrompt, generateScript } from '../services/geminiService';
import { generateVideo } from '../services/videoService';
import { generateVideoFromImage, getFalApiKey } from '../services/falService';
import { getProjectById, getSavedProjects, updateProject, upsertWorkflowProject } from '../services/projectService';
import { CONFIG, PRICING } from '../config';
import { clearProjectNavigationProject, readProjectNavigationProject, rememberProjectNavigationProject } from '../services/projectNavigationCache';
import { estimateClipDuration, splitStoryIntoParagraphScenes } from '../utils/storyHelpers';
import {
  applySelectionPromptsToScenes as applyDraftSelectionPromptsToScenes,
  createInitialSceneAssetsFromDraft,
  createLocalScenesFromDraft,
} from '../services/sceneAssemblyService';
import { triggerBlobDownload } from '../utils/downloadHelpers';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mergeAiScenesIntoLocalScenes(localScenes: ScriptScene[], aiScenes?: ScriptScene[]): ScriptScene[] {
  if (!aiScenes?.length) return localScenes;
  return localScenes.map((scene, index) => ({
    ...scene,
    visualPrompt: aiScenes[index]?.visualPrompt || scene.visualPrompt,
    analysis: aiScenes[index]?.analysis || scene.analysis,
  }));
}

function createEmptySceneAssetsFromDraft(draft: WorkflowDraft): GeneratedAsset[] {
  return createInitialSceneAssetsFromDraft(draft).map((asset) => ({
    ...asset,
    imageData: null,
    sourceMode: 'sample',
    status: 'pending',
    imageHistory: [],
    videoData: null,
    videoHistory: [],
  }));
}

function createBootstrapStudioState(projectId: string): StudioState {
  const cachedState = getCachedStudioState();
  if (cachedState) return cachedState;

  const cachedProject = projectId ? readProjectNavigationProject(projectId) : null;
  if (cachedProject?.workflowDraft) {
    return {
      ...createDefaultStudioState(),
      workflowDraft: cachedProject.workflowDraft,
      projects: [cachedProject],
      lastContentType: cachedProject.workflowDraft?.contentType || 'story',
      storageDir: cachedState?.storageDir || DEFAULT_STORAGE_DIR,
      isStorageConfigured: Boolean((cachedState?.storageDir || DEFAULT_STORAGE_DIR).trim()),
      updatedAt: Date.now(),
    };
  }

  return createDefaultStudioState();
}

const SceneStudioPage: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => pathname.replace(/\/(scene-studio|step-6|thumbnail-studio)$/, ''), [pathname]);
  const requestedProjectId = searchParams?.get('projectId') || '';
  const isThumbnailStudioRoute = useMemo(() => pathname.endsWith('/thumbnail-studio'), [pathname]);
  const [studioState, setStudioState] = useState<StudioState>(() => createBootstrapStudioState(requestedProjectId));
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generatedData, setGeneratedData] = useState<GeneratedAsset[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiModalTitle, setApiModalTitle] = useState('API 키 등록');
  const [apiModalDescription, setApiModalDescription] = useState('필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
  const [apiModalFocusField, setApiModalFocusField] = useState<'openRouter' | 'elevenLabs' | 'heygen' | 'fal' | null>(null);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [backgroundMusicTracks, setBackgroundMusicTracks] = useState<BackgroundMusicTrack[]>([]);
  const [activeBackgroundTrackId, setActiveBackgroundTrackId] = useState<string | null>(null);
  const [previewMix, setPreviewMix] = useState<PreviewMixSettings>(getDefaultPreviewMix());
  const [step4Open, setStep4Open] = useState(false);
  const [summarySection, setSummarySection] = useState<'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6'>('step1');
  const [animatingIndices, setAnimatingIndices] = useState<Set<number>>(new Set());
  const [currentCost, setCurrentCost] = useState<CostBreakdown | null>(null);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoTitle, setFinalVideoTitle] = useState('');
  const [navigationOverlay, setNavigationOverlay] = useState<{ title: string; description: string } | null>(null);
  const [isThumbnailGenerating, setIsThumbnailGenerating] = useState(false);
  const [isGeneratingAllVideos, setIsGeneratingAllVideos] = useState(false);
  const [isPreparingPreviewVideo, setIsPreparingPreviewVideo] = useState(false);
  const [previewVideoStatus, setPreviewVideoStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback' | 'error'>('idle');
  const [previewVideoMessage, setPreviewVideoMessage] = useState('결과보기에서 합본 영상 상태를 먼저 안내합니다.');
  const [taskProgressPercent, setTaskProgressPercent] = useState<number | null>(null);
  const [sceneProgressMap, setSceneProgressMap] = useState<Record<number, { percent: number; label: string }>>({});
  const assetsRef = useRef<GeneratedAsset[]>([]);
  const studioStateRef = useRef<StudioState | null>(null);
  const isAbortedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const projectQueryHandledRef = useRef('');
  const currentCostRef = useRef<CostBreakdown>({ images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 });
  const autosaveSignatureRef = useRef('');
  const thumbnailToolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}

    const cachedState = getCachedStudioState();
    if (cachedState) {
      setStudioState(cachedState);
      if (cachedState.workflowDraft) setBackgroundMusicTracks([]);
    }

    void (async () => {
      const state = await fetchStudioState({ force: true });
      if (cancelled) return;
      setStudioState(state);
      if (state.workflowDraft) setBackgroundMusicTracks([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedProjectId]);

  useEffect(() => {
    studioStateRef.current = studioState;
  }, [studioState]);

  useEffect(() => {
    if (!isThumbnailStudioRoute) return;
    const toolbar = thumbnailToolbarRef.current;
    if (!toolbar) return;
    const frame = window.requestAnimationFrame(() => {
      toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isThumbnailStudioRoute, currentProjectId, generatedData.length]);

  const draft = useMemo(() => ensureWorkflowDraft(studioState), [studioState]);
  const workflowProgress = useMemo(() => {
    const completed = draft?.completedSteps || { step1: false, step2: false, step3: false, step4: false };
    const count = Object.values(completed).filter(Boolean).length;
    return {
      percent: Math.round((count / 4) * 100),
      text: `워크플로우 ${count}/4 단계 완료`,
    };
  }, [draft]);

  const currentProjectSummary = useMemo(() => (studioState?.projects || []).find((item) => item.id === currentProjectId) || null, [studioState?.projects, currentProjectId]);
  const summaryCharacterIds = useMemo(() => (
    draft.selectedCharacterIds.length ? draft.selectedCharacterIds : draft.extractedCharacters.map((item) => item.id)
  ), [draft.extractedCharacters, draft.selectedCharacterIds]);
  const summaryCharacters = useMemo(() => draft.extractedCharacters.filter((item) => summaryCharacterIds.includes(item.id)), [draft.extractedCharacters, summaryCharacterIds]);
  const summarySelectedStyle = useMemo(() => draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0] || null, [draft.selectedStyleImageId, draft.styleImages]);
  const summarySelectedPromptTemplate = useMemo(() => draft.promptTemplates.find((item) => item.id === draft.selectedPromptTemplateId) || draft.promptTemplates[0] || null, [draft.promptTemplates, draft.selectedPromptTemplateId]);
  const summarySceneCount = useMemo(() => splitStoryIntoParagraphScenes(draft.script).length, [draft.script]);
  const summarySections = useMemo(() => ([
    { id: 'step1' as const, label: '1단계 기본', description: '콘텐츠 유형과 화면 비율 등 시작 설정' },
    { id: 'step2' as const, label: '2단계 기획', description: '주제와 장르, 분위기, 배경 설정' },
    { id: 'step3' as const, label: '3단계 대본', description: '선택 프롬프트와 최종 대본, 참조 메모' },
    { id: 'step4' as const, label: '4단계 캐릭터', description: '선택 출연자와 캐릭터 프롬프트, 대표 이미지 기준' },
    { id: 'step5' as const, label: '5단계 화풍', description: '최종 영상용 화풍 카드와 프롬프트' },
    { id: 'step6' as const, label: '6단계 씬 전달', description: '씬 제작 화면으로 넘어온 최종 전달값' },
  ]), []);

  const resolveSceneTtsOptions = useCallback(() => {
    const preferredProvider = (draft.ttsProvider || studioState?.routing?.ttsProvider || 'qwen3Tts') as 'qwen3Tts' | 'elevenLabs' | 'heygen';
    const elevenApiKey = studioState?.providers?.elevenLabsApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY) || '';
    const heygenApiKey = studioState?.providers?.heygenApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY) || '';

    const provider = preferredProvider === 'heygen'
      ? (heygenApiKey ? 'heygen' : elevenApiKey ? 'elevenLabs' : 'qwen3Tts')
      : preferredProvider === 'elevenLabs'
        ? (elevenApiKey ? 'elevenLabs' : heygenApiKey ? 'heygen' : 'qwen3Tts')
        : 'qwen3Tts';

    const apiKey = provider === 'elevenLabs'
      ? elevenApiKey
      : provider === 'heygen'
        ? heygenApiKey
        : '';

    return {
      provider,
      apiKey,
      voiceId: provider === 'elevenLabs'
        ? (draft.elevenLabsVoiceId || studioState?.routing?.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID)
        : provider === 'heygen'
          ? (draft.heygenVoiceId || studioState?.routing?.heygenVoiceId || null)
          : (draft.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default'),
      modelId: draft.elevenLabsModelId || studioState?.routing?.elevenLabsModelId || studioState?.routing?.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
      qwenPreset: draft.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default',
    };
  }, [draft.elevenLabsModelId, draft.elevenLabsVoiceId, draft.heygenVoiceId, draft.qwenVoicePreset, draft.ttsProvider, studioState?.providers?.elevenLabsApiKey, studioState?.providers?.heygenApiKey, studioState?.routing?.audioModel, studioState?.routing?.elevenLabsModelId, studioState?.routing?.elevenLabsVoiceId, studioState?.routing?.heygenVoiceId, studioState?.routing?.qwenVoicePreset, studioState?.routing?.ttsProvider]);

  const generateSceneAudioAsset = useCallback(async (text: string) => {
    const tts = resolveSceneTtsOptions();
    return await generateTtsAudio({
      provider: tts.provider,
      text,
      apiKey: tts.apiKey || undefined,
      voiceId: tts.voiceId || undefined,
      modelId: tts.modelId || undefined,
      qwenPreset: tts.qwenPreset || undefined,
    });
  }, [resolveSceneTtsOptions]);

  useEffect(() => {
    if (generatedData.length) return;
    if (!draft.script?.trim()) return;

    const localAssets = createEmptySceneAssetsFromDraft(draft);
    if (!localAssets.length) return;

    assetsRef.current = localAssets;
    setGeneratedData(localAssets);
    setStep(GenerationStep.COMPLETED);
    setProgressMessage((prev) => prev || '전달된 데이터로 씬 카드를 먼저 표시했습니다. 필요한 씬만 개별 생성하면 됩니다.');
  }, [draft, generatedData.length]);

  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const selectedVideoModel = useMemo(() => {
    const model = studioState?.routing?.videoModel || '';
    return model.startsWith('fal-') ? model : 'fal-pixverse-v55';
  }, [studioState?.routing?.videoModel]);

  const effectiveBackgroundTracks = useMemo(() => {
    const picked = backgroundMusicTracks.find((item) => item.id === activeBackgroundTrackId) || backgroundMusicTracks[0];
    return picked ? [picked] : [];
  }, [backgroundMusicTracks, activeBackgroundTrackId]);

  const buildReferenceImages = useCallback((): ReferenceImages => {
    const resolvedCharacterIds = draft.selectedCharacterIds.length ? draft.selectedCharacterIds : draft.extractedCharacters.map((item) => item.id);
    const selectedCharacters = draft.extractedCharacters.filter((item) => resolvedCharacterIds.includes(item.id));
    const selectedStyle = draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0];
    return {
      character: selectedCharacters.map((item) => item.imageData).filter(Boolean) as string[],
      style: selectedStyle?.imageData ? [selectedStyle.imageData] : [],
      characterStrength: draft.referenceImages?.characterStrength || 70,
      styleStrength: draft.referenceImages?.styleStrength || 70,
    };
  }, [draft]);

  const resetCost = () => {
    currentCostRef.current = { images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 };
    setCurrentCost(null);
  };

  const addCost = (type: 'image' | 'tts' | 'video', amount: number, count = 1) => {
    if (type === 'image') {
      currentCostRef.current.images += amount;
      currentCostRef.current.imageCount += count;
    } else if (type === 'tts') {
      currentCostRef.current.tts += amount;
      currentCostRef.current.ttsCharacters += count;
    } else {
      currentCostRef.current.videos += amount;
      currentCostRef.current.videoCount += count;
    }
    currentCostRef.current.total = currentCostRef.current.images + currentCostRef.current.tts + currentCostRef.current.videos;
    setCurrentCost({ ...currentCostRef.current });
  };

  const updateAssetAt = useCallback((index: number, updates: Partial<GeneratedAsset>) => {
    if (!assetsRef.current[index]) return;
    assetsRef.current[index] = { ...assetsRef.current[index], ...updates };
    setGeneratedData([...assetsRef.current]);
  }, []);


  const setSceneProgress = useCallback((index: number, percent: number, label: string) => {
    setSceneProgressMap((prev) => ({
      ...prev,
      [index]: { percent: Math.max(0, Math.min(100, Math.round(percent))), label },
    }));
  }, []);

  const clearSceneProgress = useCallback((index?: number) => {
    if (typeof index === 'number') {
      setSceneProgressMap((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }
    setSceneProgressMap({});
  }, []);

  const applyProjectToScreen = useCallback((project: SavedProject, options?: { message?: string }) => {
    const safeAssets = Array.isArray(project.assets) && project.assets.length
      ? project.assets.map((asset) => ({ ...asset, aspectRatio: asset?.aspectRatio || project.workflowDraft?.aspectRatio || '16:9' }))
      : (project.workflowDraft ? createEmptySceneAssetsFromDraft(project.workflowDraft) : []);

    assetsRef.current = safeAssets;
    setGeneratedData([...safeAssets]);
    setCurrentProjectId(project.id);
    setBackgroundMusicTracks(project.backgroundMusicTracks || []);
    setActiveBackgroundTrackId(project.backgroundMusicTracks?.[0]?.id || null);
    setPreviewMix(project.previewMix || getDefaultPreviewMix());
    setCurrentCost(project.cost || null);
    currentCostRef.current = project.cost || { images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 };
    setStep(safeAssets.length ? GenerationStep.COMPLETED : GenerationStep.IDLE);
    setIsPreparingPreviewVideo(false);
    setFinalVideoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setFinalVideoTitle('');
    setStep4Open(false);
    setProgressMessage(options?.message || `"${project.name}" 프로젝트를 열었습니다. 씬 카드는 먼저 가볍게 보여 주고, 실제 AI 생성은 생성 버튼을 눌렀을 때만 시작합니다.`);
    rememberProjectNavigationProject(project);
  }, []);

  const appendImageHistory = useCallback((asset: GeneratedAsset, imageData: string, sourceMode: 'ai' | 'sample', label: string) => {
    const prev = Array.isArray(asset.imageHistory) ? asset.imageHistory : [];
    if (prev[0]?.data === imageData) return prev;
    return [
      {
        id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'image' as const,
        data: imageData,
        sourceMode,
        createdAt: Date.now(),
        label,
      },
      ...prev,
    ];
  }, []);

  const appendVideoHistory = useCallback((asset: GeneratedAsset, videoData: string, sourceMode: 'ai' | 'sample', label: string) => {
    const prev = Array.isArray(asset.videoHistory) ? asset.videoHistory : [];
    if (prev[0]?.data === videoData) return prev;
    return [
      {
        id: `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'video' as const,
        data: videoData,
        sourceMode,
        createdAt: Date.now(),
        label,
      },
      ...prev,
    ];
  }, []);

  const createScenePlan = useCallback(async (): Promise<ScriptScene[]> => {
    const localScenes = createLocalScenesFromDraft(draft);
    const referenceImages = buildReferenceImages();
    const hasReferenceImage = referenceImages.character.length + referenceImages.style.length > 0;
    try {
      const aiScenes = await withSoftTimeout(
        generateScript(draft.topic || 'Manual Script Input', hasReferenceImage, draft.script, draft.contentType),
        7000,
        [] as ScriptScene[]
      );
      return applyDraftSelectionPromptsToScenes(mergeAiScenesIntoLocalScenes(localScenes, aiScenes), draft);
    } catch {
      return applyDraftSelectionPromptsToScenes(localScenes, draft);
    }
  }, [draft, buildReferenceImages]);

  const openApiModal = (options: { title?: string; description?: string; focusField?: 'openRouter' | 'elevenLabs' | 'heygen' | 'fal' | null }) => {
    setApiModalTitle(options.title || 'API 키 등록');
    setApiModalDescription(options.description || '필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
    setApiModalFocusField(options.focusField || null);
    setShowApiModal(true);
  };

  const handleApiModalClose = () => {
    setShowApiModal(false);
  };

  const handleGoBackToWorkflow = useCallback(() => {
    setNavigationOverlay({
      title: '이전 단계로 이동하는 중',
      description: '현재 프로젝트를 유지한 채 Step5(화풍 선택)로 돌아갑니다.',
    });
    if (currentProjectId) {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
      router.push(`${basePath}/step-5?projectId=${encodeURIComponent(currentProjectId)}`, { scroll: true });
      return;
    }
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
    router.push(`${basePath}/step-5`, { scroll: true });
  }, [basePath, currentProjectId, router]);

  const createAnotherBackgroundTrack = useCallback(() => {
    const nextTrack = createSampleBackgroundTrack(draft);
    setBackgroundMusicTracks((prev) => [nextTrack, ...prev]);
    setActiveBackgroundTrackId(nextTrack.id);
    setProgressMessage('새 배경음 샘플을 생성했습니다. 여러 트랙 중 하나를 선택해 렌더링할 수 있습니다.');
  }, [draft]);

  const persistWorkflowStep4 = async (step4Completed: boolean) => {
    if (!studioState) return;
    const nextState = await saveStudioState({
      ...studioState,
      workflowDraft: {
        ...draft,
        completedSteps: { ...draft.completedSteps, step4: step4Completed },
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
  };

  useEffect(() => {
    if (!studioState) return;
    const projectId = searchParams?.get('projectId') || '';
    if (!projectId) return;
    const signature = projectId;
    if (projectQueryHandledRef.current === signature) return;
    projectQueryHandledRef.current = signature;

    let cancelled = false;

    void (async () => {
      setProgressMessage('프로젝트 요약과 씬 카드를 먼저 붙이는 중...');

      const cachedProject = readProjectNavigationProject(projectId) || await getProjectById(projectId, { localOnly: true });
      if (cancelled) return;

      if (cachedProject) {
        const cachedDraft = cachedProject.workflowDraft;
        if (cachedDraft) {
          setStudioState((prev) => prev ? {
            ...prev,
            workflowDraft: cachedDraft,
            lastContentType: cachedDraft.contentType || prev.lastContentType || 'story',
          } : prev);
        }
        applyProjectToScreen(cachedProject, { message: `"${cachedProject.name}" 프로젝트를 빠르게 열었습니다. 저장본을 확인하는 동안 씬 카드는 먼저 보여 드립니다.` });
      }

      const project = await getProjectById(projectId, { forceSync: !cachedProject });
      if (cancelled || !project) return;

      const projectDraft = project.workflowDraft;
      if (projectDraft) {
        const existingDraft = studioStateRef.current?.workflowDraft;
        const sameDraft = Boolean(existingDraft
          && existingDraft.updatedAt === projectDraft.updatedAt
          && existingDraft.selectedStyleImageId === projectDraft.selectedStyleImageId
          && existingDraft.selectedCharacterStyleId === projectDraft.selectedCharacterStyleId
          && JSON.stringify(existingDraft.selectedCharacterIds || []) === JSON.stringify(projectDraft.selectedCharacterIds || [])
          && (existingDraft.script || '') === (projectDraft.script || ''));

        if (sameDraft) {
          setStudioState((prev) => prev ? {
            ...prev,
            workflowDraft: projectDraft,
            lastContentType: projectDraft.contentType || prev.lastContentType || 'story',
          } : prev);
        } else {
          const baseStudioState = studioStateRef.current || createDefaultStudioState();
          const syncedState = await saveStudioState({
            ...baseStudioState,
            workflowDraft: projectDraft,
            lastContentType: projectDraft.contentType || baseStudioState.lastContentType || 'story',
            updatedAt: Date.now(),
          });
          if (!cancelled) setStudioState(syncedState);
        }
      }

      applyProjectToScreen(project);
      clearProjectNavigationProject(projectId);
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [applyProjectToScreen, searchParams]);


  const handleGenerate = useCallback(async (options?: { preserveExistingCards?: boolean; generateAudio?: boolean }) => {
    if (isProcessingRef.current) return;
    if (!draft.script?.trim()) {
      setStep(GenerationStep.ERROR);
      setProgressMessage('대본이 비어 있어 씬 생성을 시작할 수 없습니다. 1단계부터 3단계까지 먼저 완료해 주세요.');
      return;
    }
    if (!draft.selectedStyleImageId && !draft.styleImages.length) {
      setStep(GenerationStep.ERROR);
      setProgressMessage('화풍 카드가 아직 없습니다. 5단계에서 화풍 예시를 먼저 채워 주세요.');
      return;
    }

    const preserveExistingCards = Boolean(options?.preserveExistingCards && assetsRef.current.length);
    const generateAudio = Boolean(options?.generateAudio);

    isProcessingRef.current = true;
    setIsGeneratingScenes(true);
    isAbortedRef.current = false;
    resetCost();
    setStep4Open(false);
    setStep(preserveExistingCards ? GenerationStep.ASSETS : GenerationStep.SCRIPTING);
    setTaskProgressPercent(6);
    clearSceneProgress();
    setProgressMessage(
      preserveExistingCards
        ? (generateAudio ? '기존 씬 카드 기준으로 이미지와 오디오를 다시 준비하는 중...' : '기존 씬 카드 기준으로 이미지를 다시 준비하는 중...')
        : '스토리를 문단별 씬으로 정리하는 중...'
    );

    try {
      const scenes = await createScenePlan();
      const referenceImages = buildReferenceImages();
      const sampleAssets = createInitialSceneAssetsFromDraft(draft);
      const baseAssets = preserveExistingCards ? assetsRef.current : [];
      setTaskProgressPercent(18);

      const initialAssets: GeneratedAsset[] = scenes.map((scene, index) => {
        const existing = baseAssets[index];
        const fallbackPreview = sampleAssets[index];
        return {
          ...fallbackPreview,
          ...existing,
          ...scene,
          aspectRatio: scene.aspectRatio || existing?.aspectRatio || draft.aspectRatio || '16:9',
          targetDuration: existing?.targetDuration || scene.targetDuration || estimateClipDuration(scene.narration),
          imageHistory: existing?.imageHistory || [],
          videoHistory: existing?.videoHistory || [],
          status: existing?.imageData ? 'completed' : 'pending',
        };
      });

      assetsRef.current = initialAssets;
      setGeneratedData([...initialAssets]);
      setStep(GenerationStep.ASSETS);
      initialAssets.forEach((_, index) => setSceneProgress(index, 8, '생성 대기 중'));

      const initialTtsOptions = generateAudio ? resolveSceneTtsOptions() : null;
      const isTtsAvailable = Boolean(initialTtsOptions && (initialTtsOptions.provider === 'qwen3Tts' || initialTtsOptions.apiKey));

      for (let i = 0; i < initialAssets.length; i++) {
        const currentAspectRatio = assetsRef.current[i].aspectRatio || draft.aspectRatio || '16:9';
        updateAssetAt(i, { status: 'generating', aspectRatio: currentAspectRatio });
        const sceneStartPercent = 18 + Math.round((i / Math.max(1, initialAssets.length)) * 70);
        setTaskProgressPercent(sceneStartPercent);
        setSceneProgress(i, 22, '이미지 초안 준비');
        setProgressMessage(`씬 ${i + 1}/${initialAssets.length} 이미지를 준비하는 중...`);

        let imageData: string | null = null;
        const imageModel = getSelectedImageModel();
        const usesSampleImageFlow = isSampleImageModel(imageModel);
        let sourceMode: 'ai' | 'sample' = usesSampleImageFlow ? 'sample' : 'ai';

        try {
          imageData = await withSoftTimeout(
            generateImage({ ...assetsRef.current[i], aspectRatio: currentAspectRatio }, referenceImages, { qualityMode: 'draft' }),
            12000,
            null
          );
          if (imageData && !usesSampleImageFlow) {
            const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
            addCost('image', price, 1);
          }
          setSceneProgress(i, 58, imageData ? (usesSampleImageFlow ? '샘플 초안 이미지 완성' : 'AI 이미지 완성') : '샘플 이미지 준비');
        } catch {
          imageData = null;
        }

        if (!imageData) {
          imageData = assetsRef.current[i].imageData || sampleAssets[i]?.imageData || null;
        }

        const nextImageHistory = imageData
          ? appendImageHistory(assetsRef.current[i], imageData, sourceMode, sourceMode === 'ai' ? 'AI 생성 이미지' : '샘플 / 저부하 초안 이미지')
          : assetsRef.current[i].imageHistory || [];

        updateAssetAt(i, {
          imageData,
          imageHistory: nextImageHistory,
          sourceMode,
          status: 'completed',
          aspectRatio: currentAspectRatio,
        });
        setSceneProgress(i, isTtsAvailable ? 72 : 100, isTtsAvailable ? '오디오 대기 중' : '이미지 준비 완료');

        const sceneTts = resolveSceneTtsOptions();
        if (generateAudio && (sceneTts.provider === 'qwen3Tts' || sceneTts.apiKey)) {
          setProgressMessage(`씬 ${i + 1}/${initialAssets.length} 오디오와 자막을 준비하는 중...`);
          try {
            const audio = await withSoftTimeout(
              generateSceneAudioAsset(assetsRef.current[i].narration),
              15000,
              { audioData: null, subtitleData: null, estimatedDuration: null, sourceMode: 'sample' as const }
            );
            if (audio.audioData) {
              updateAssetAt(i, {
                audioData: audio.audioData,
                subtitleData: audio.subtitleData,
                audioDuration: audio.estimatedDuration,
                targetDuration: Math.max(assetsRef.current[i].targetDuration || 0, audio.estimatedDuration || 0, 3),
              });
              addCost('tts', PRICING.TTS.perCharacter * assetsRef.current[i].narration.length, assetsRef.current[i].narration.length);
            }
            setSceneProgress(i, 90, '오디오 / 자막 정리');
          } catch {}
        }

        setTaskProgressPercent(18 + Math.round(((i + 1) / Math.max(1, initialAssets.length)) * 72));
        setSceneProgress(i, 100, '씬 준비 완료');
        await wait(120);
      }

      const nextTracks = backgroundMusicTracks.length ? backgroundMusicTracks : [createSampleBackgroundTrack(draft)];
      const selectedTrack = nextTracks[0];
      setBackgroundMusicTracks(nextTracks);
      setActiveBackgroundTrackId(selectedTrack?.id || null);
      setPreviewMix((prev) => prev || getDefaultPreviewMix());

      setStep(GenerationStep.COMPLETED);
      setTaskProgressPercent(96);
      setProgressMessage(generateAudio
        ? '씬 카드(이미지/오디오) 생성이 끝났습니다. 현재는 저부하 샘플 이미지 중심으로 준비했고, 필요하면 씬별 영상화 또는 최종 출력으로 넘어가 주세요.'
        : '씬 이미지 생성이 끝났습니다. 현재는 저부하 샘플 이미지 중심으로 준비했고, 필요하면 씬별 또는 전체 영상 생성을 진행해 주세요.');

      const saved = await upsertWorkflowProject({
        projectId: currentProjectId,
        topic: draft.topic || 'Manual Script Input',
        workflowDraft: {
          ...draft,
          completedSteps: { ...draft.completedSteps, step4: true },
          updatedAt: Date.now(),
        },
        assets: assetsRef.current,
        cost: currentCostRef.current,
        backgroundMusicTracks: nextTracks,
        previewMix,
      });
      setCurrentProjectId(saved.id);
      rememberProjectNavigationProject(saved);
      setTaskProgressPercent(100);
      await persistWorkflowStep4(true);
    } catch (error: any) {
      setStep(GenerationStep.ERROR);
      setProgressMessage(`오류: ${error?.message || '생성 중 문제가 발생했습니다.'}`);
    } finally {
      isProcessingRef.current = false;
      setIsGeneratingScenes(false);
      window.setTimeout(() => setTaskProgressPercent(null), 900);
    }
  }, [appendImageHistory, backgroundMusicTracks, buildReferenceImages, createScenePlan, currentProjectId, draft, persistWorkflowStep4, previewMix, studioState, updateAssetAt]);

  useEffect(() => {
    return () => {
      if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
    };
  }, [finalVideoUrl]);

  useEffect(() => {
    if (!currentProjectId || !generatedData.length) return;
    if (isGeneratingScenes || isThumbnailGenerating || isGeneratingAllVideos || isVideoGenerating || animatingIndices.size > 0) return;
    const signature = JSON.stringify({
      currentProjectId,
      sceneCount: generatedData.length,
      sceneStatus: generatedData.map((item) => ({
        sceneNumber: item.sceneNumber,
        hasImage: Boolean(item.imageData),
        hasAudio: Boolean(item.audioData),
        hasVideo: Boolean(item.videoData),
        imageHistoryCount: Array.isArray(item.imageHistory) ? item.imageHistory.length : 0,
        videoHistoryCount: Array.isArray(item.videoHistory) ? item.videoHistory.length : 0,
        targetDuration: item.targetDuration,
        status: item.status,
      })),
      backgroundMusicTracks: backgroundMusicTracks.map((track) => ({ id: track.id, hasAudio: Boolean(track.audioData), volume: track.volume })),
      previewMix,
      draftUpdatedAt: draft.updatedAt,
      selectedStyleImageId: draft.selectedStyleImageId,
      selectedCharacterIds: draft.selectedCharacterIds,
    });
    if (autosaveSignatureRef.current === signature) return;
    autosaveSignatureRef.current = signature;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      await updateProject(currentProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
        cost: currentCostRef.current,
        workflowDraft: draft,
      });
      setProgressMessage('씬, 배경음, 프리뷰 설정을 자동 저장했습니다.');
    }, 1800);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [currentProjectId, generatedData, backgroundMusicTracks, previewMix, draft, isGeneratingScenes, isThumbnailGenerating, isGeneratingAllVideos, isVideoGenerating, animatingIndices]);

  const renderMergedVideo = useCallback(async (options: {
    enableSubtitles: boolean;
    qualityMode: 'preview' | 'final';
    downloadFile?: boolean;
    customTitle?: string;
  }) => {
    const { enableSubtitles, qualityMode, downloadFile = false, customTitle } = options;
    if (isVideoGenerating) return null;

    const renderableAssets = assetsRef.current.filter((asset) => Boolean(asset.imageData));
    const sceneVideoCount = renderableAssets.filter((asset) => Boolean(asset.videoData)).length;

    if (!renderableAssets.length) {
      const message = '먼저 씬 이미지가 있어야 합본 미리보기를 만들 수 있습니다.';
      setProgressMessage(message);
      setPreviewVideoStatus('error');
      setPreviewVideoMessage(message);
      return null;
    }

    if (enableSubtitles && assetsRef.current.some((asset) => !asset.subtitleData && !asset.audioData)) {
      const message = '자막 포함 출력은 오디오와 자막 데이터가 준비된 뒤에 진행할 수 있습니다.';
      setPreviewVideoStatus('error');
      setPreviewVideoMessage(message);
      openApiModal({
        title: '자막 출력에는 오디오 생성 연결이 필요합니다',
        description: '현재 씬 중 일부는 자막용 오디오 데이터가 없어 자막이 비어 있을 수 있습니다. ElevenLabs 키를 연결하면 이 자리에서 다시 생성할 수 있습니다.',
        focusField: 'elevenLabs',
      });
      return null;
    }

    const progressHandler = (message: string) => {
      setProgressMessage(`[Render] ${message}`);
      const percentMatch = message.match(/(\d+)%/);
      if (percentMatch) {
        setTaskProgressPercent(Math.max(8, Math.min(100, Number(percentMatch[1]))));
        return;
      }
      if (message.includes('(1/3)')) setTaskProgressPercent(18);
      else if (message.includes('(2/3)')) setTaskProgressPercent(52);
      else if (message.includes('렌더링 완료')) setTaskProgressPercent(96);
    };

    const renderTitle = (fallbackLabel?: string) => (
      customTitle
      || (downloadFile
        ? `${draft.topic || '프로젝트'} 최종 출력 (${enableSubtitles ? '자막 포함' : '자막 없음'})${fallbackLabel ? ` · ${fallbackLabel}` : ''}`
        : `${draft.topic || '프로젝트'} 합본 미리보기${fallbackLabel ? ` · ${fallbackLabel}` : ''}`)
    );

    try {
      setIsVideoGenerating(true);
      if (!downloadFile) {
        setIsPreparingPreviewVideo(true);
        setFinalVideoUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      }
      setTaskProgressPercent(8);
      setPreviewVideoStatus('loading');

      const primaryMessage = sceneVideoCount > 0
        ? `준비된 씬 영상 ${sceneVideoCount}개와 이미지를 함께 합쳐 합본 영상을 만드는 중입니다.`
        : 'AI 씬 영상이 없어도 이미지 기반 합본 영상을 만드는 중입니다.';
      setPreviewVideoMessage(primaryMessage);
      setProgressMessage(primaryMessage);

      let result = null;
      let usedFallback = false;
      let usedSceneVideos = sceneVideoCount > 0;

      try {
        result = await generateVideo(
          assetsRef.current,
          progressHandler,
          isAbortedRef,
          {
            enableSubtitles,
            qualityMode,
            backgroundTracks: effectiveBackgroundTracks,
            previewMix,
            aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
            useSceneVideos: usedSceneVideos,
          }
        );
      } catch (primaryError) {
        console.error('[SceneStudioPage] primary merged render failed', primaryError);
        usedFallback = true;
        usedSceneVideos = false;
        setTaskProgressPercent(22);
        const fallbackMessage = '합치는 중 문제가 있어 안전 모드로 다시 시도합니다. 씬 영상 없이 이미지 기반으로 합칩니다.';
        setPreviewVideoStatus('loading');
        setPreviewVideoMessage(fallbackMessage);
        setProgressMessage(fallbackMessage);

        result = await generateVideo(
          assetsRef.current.map((asset) => ({ ...asset, videoData: null })),
          progressHandler,
          isAbortedRef,
          {
            enableSubtitles,
            qualityMode: 'preview',
            backgroundTracks: effectiveBackgroundTracks,
            previewMix,
            aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
            useSceneVideos: false,
          }
        );
      }

      if (!result) {
        const message = '합본 영상 결과를 아직 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
        setPreviewVideoStatus('error');
        setPreviewVideoMessage(message);
        setProgressMessage(message);
        return null;
      }

      const suffix = enableSubtitles ? 'sub' : 'nosub';
      setFinalVideoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(result.videoBlob);
      });
      setFinalVideoTitle(renderTitle(usedFallback ? '안전 모드' : undefined));

      if (downloadFile) {
        triggerBlobDownload(result.videoBlob, `mp4Creater_${suffix}_${Date.now()}.mp4`);
      }

      const successMessage = usedFallback
        ? '안전 모드로 합본 영상을 만들었습니다. 브라우저 합치기 문제가 있어 이미지 기반으로 다시 합쳤습니다.'
        : usedSceneVideos
          ? `씬 영상 ${sceneVideoCount}개를 반영한 합본 영상이 준비되었습니다.`
          : 'AI 씬 영상 없이도 이미지 기반 합본 영상이 준비되었습니다.';

      setPreviewVideoStatus(usedFallback || !usedSceneVideos ? 'fallback' : 'ready');
      setPreviewVideoMessage(successMessage);
      setProgressMessage(downloadFile ? '합본 영상 저장이 완료되었습니다.' : '합본 영상 미리보기가 준비되었습니다.');
      setTaskProgressPercent(100);

      return result;
    } catch (error) {
      console.error('[SceneStudioPage] merged render failed', error);
      const failureMessage = '브라우저에서 합본 영상을 만드는 중 문제가 발생했습니다. 다시 시도하거나 씬 수를 줄여 확인해 주세요.';
      setPreviewVideoStatus('error');
      setPreviewVideoMessage(failureMessage);
      setProgressMessage(failureMessage);
      return null;
    } finally {
      setIsVideoGenerating(false);
      if (!downloadFile) setIsPreparingPreviewVideo(false);
      window.setTimeout(() => setTaskProgressPercent(null), 1200);
    }
  }, [draft.aspectRatio, draft.topic, effectiveBackgroundTracks, isVideoGenerating, openApiModal, previewMix]);

  const handleRegenerateImage = async (index: number) => {
    updateAssetAt(index, { status: 'generating' });
    setTaskProgressPercent(12);
    setSceneProgress(index, 18, '이미지 다시 준비');
    setProgressMessage(`씬 ${index + 1} 이미지를 다시 만드는 중...`);
    try {
      const imageModel = getSelectedImageModel();
      const usesSampleImageFlow = isSampleImageModel(imageModel);
      const imageData = await generateImage(assetsRef.current[index], buildReferenceImages(), { qualityMode: 'draft' });
      if (imageData) {
        updateAssetAt(index, {
          imageData,
          imageHistory: appendImageHistory(assetsRef.current[index], imageData, usesSampleImageFlow ? 'sample' : 'ai', usesSampleImageFlow ? '샘플 / 저부하 초안 이미지' : 'AI 재생성 이미지'),
          sourceMode: usesSampleImageFlow ? 'sample' : 'ai',
          status: 'completed',
        });
        if (!usesSampleImageFlow) {
          const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
          addCost('image', price, 1);
        }
        setSceneProgress(index, 100, usesSampleImageFlow ? '샘플 이미지 다시 준비 완료' : '이미지 다시 생성 완료');
        setTaskProgressPercent(100);
        return;
      }
    } catch {}
    const fallbackImage = createInitialSceneAssetsFromDraft(draft)[index]?.imageData || assetsRef.current[index].imageData || null;
    if (fallbackImage) {
      updateAssetAt(index, {
        imageData: fallbackImage,
        imageHistory: appendImageHistory(assetsRef.current[index], fallbackImage, 'sample', '샘플 / 대체 이미지'),
        sourceMode: 'sample',
        status: 'completed',
        aspectRatio: assetsRef.current[index].aspectRatio || draft.aspectRatio || '16:9',
      });
      setSceneProgress(index, 100, '샘플 이미지로 교체 완료');
    }
    window.setTimeout(() => setTaskProgressPercent(null), 700);
  };

  const handleRegenerateAudio = async (index: number) => {
    setTaskProgressPercent(12);
    setSceneProgress(index, 24, '오디오 다시 생성');
    const tts = resolveSceneTtsOptions();
    if (tts.provider !== 'qwen3Tts' && !tts.apiKey) {
      setTaskProgressPercent(null);
      openApiModal({
        title: tts.provider === 'heygen' ? '오디오 생성에는 HeyGen API 키가 필요합니다' : '오디오 생성에는 ElevenLabs API 키가 필요합니다',
        description: '키를 넣고 저장하면 현재 씬의 오디오만 바로 다시 만들 수 있습니다.',
        focusField: tts.provider === 'heygen' ? 'heygen' : 'elevenLabs',
      });
      return;
    }

    try {
      const audio = await generateSceneAudioAsset(assetsRef.current[index].narration);
      if (audio.audioData) {
        updateAssetAt(index, {
          audioData: audio.audioData,
          subtitleData: audio.subtitleData,
          audioDuration: audio.estimatedDuration,
          targetDuration: Math.max(assetsRef.current[index].targetDuration || 0, audio.estimatedDuration || 0, 3),
        });
      }
      setSceneProgress(index, 100, '오디오 다시 생성 완료');
      setTaskProgressPercent(100);
    } catch {}
    window.setTimeout(() => setTaskProgressPercent(null), 700);
  };

  const handleGenerateAnimation = async (index: number) => {
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    if (!falKey) {
      setTaskProgressPercent(null);
      openApiModal({ title: '영상 변환용 API가 필요합니다', description: 'FAL 키나 직접 연결한 외부 영상 공급자 키를 등록하면 이 씬만 영상으로 변환할 수 있습니다.', focusField: 'fal' });
      return;
    }
    if (!assetsRef.current[index]?.imageData) return;
    if (animatingIndices.has(index)) return;

    try {
      setAnimatingIndices((prev) => new Set(prev).add(index));
      setTaskProgressPercent(10);
      setSceneProgress(index, 20, '영상 프롬프트 생성');
      const motionPrompt = await generateMotionPrompt(assetsRef.current[index].narration, assetsRef.current[index].visualPrompt);
      const videoUrl = await generateVideoFromImage(
        assetsRef.current[index].imageData!,
        motionPrompt,
        falKey,
        assetsRef.current[index].aspectRatio || draft.aspectRatio || '16:9',
        'preview',
        selectedVideoModel,
      );
      if (videoUrl) {
        updateAssetAt(index, {
          videoData: videoUrl,
          videoHistory: appendVideoHistory(assetsRef.current[index], videoUrl, 'ai', 'AI 영상 변환'),
          videoDuration: CONFIG.ANIMATION.VIDEO_DURATION,
        });
        addCost('video', PRICING.VIDEO.perVideo, 1);
      }
      setSceneProgress(index, 100, '영상 변환 완료');
      setTaskProgressPercent(100);
    } finally {
      setAnimatingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      window.setTimeout(() => setTaskProgressPercent(null), 700);
    }
  };

  const handleGenerateAllVideos = useCallback(async () => {
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    if (!falKey) {
      setTaskProgressPercent(null);
      openApiModal({ title: '영상 변환용 API가 필요합니다', description: 'FAL 키나 연결한 외부 영상 공급자 키를 등록하면 전체 씬 영상을 한 번에 만들 수 있습니다.', focusField: 'fal' });
      return;
    }
    const availableIndices = assetsRef.current
      .map((asset, index) => ({ asset, index }))
      .filter(({ asset }) => Boolean(asset.imageData));
    if (!availableIndices.length) {
      setProgressMessage('먼저 전체 씬 이미지 생성 또는 개별 이미지 생성을 완료해 주세요.');
      return;
    }

    setIsGeneratingAllVideos(true);
    setTaskProgressPercent(8);
    try {
      for (let order = 0; order < availableIndices.length; order += 1) {
        const { asset, index } = availableIndices[order];
        setTaskProgressPercent(10 + Math.round((order / Math.max(1, availableIndices.length)) * 78));
        setSceneProgress(index, 24, '영상 프롬프트 생성');
        setProgressMessage(`씬 ${order + 1}/${availableIndices.length} 전체 영상 생성 중...`);
        const motionPrompt = await generateMotionPrompt(asset.narration, asset.visualPrompt);
        const videoUrl = await generateVideoFromImage(
          asset.imageData!,
          motionPrompt,
          falKey,
          asset.aspectRatio || draft.aspectRatio || '16:9',
          'preview',
          selectedVideoModel,
        );
        if (videoUrl) {
          updateAssetAt(index, {
            videoData: videoUrl,
            videoHistory: appendVideoHistory(assetsRef.current[index], videoUrl, 'ai', '전체 일괄 영상 생성'),
            videoDuration: CONFIG.ANIMATION.VIDEO_DURATION,
          });
          addCost('video', PRICING.VIDEO.perVideo, 1);
        }
        setSceneProgress(index, 100, '영상 변환 완료');
        await wait(120);
      }
      setTaskProgressPercent(100);
      setProgressMessage('모든 씬의 영상 변환을 마쳤습니다. 미리보기에서 바로 확인할 수 있습니다.');
    } finally {
      setIsGeneratingAllVideos(false);
      window.setTimeout(() => setTaskProgressPercent(null), 900);
    }
  }, [appendVideoHistory, draft.aspectRatio, selectedVideoModel, studioState, updateAssetAt]);

  const triggerVideoExport = async (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => {
    await renderMergedVideo({
      enableSubtitles: options.enableSubtitles,
      qualityMode: options.qualityMode,
      downloadFile: true,
    });
  };

  const handlePreparePreviewVideo = useCallback(async () => {
    if (isPreparingPreviewVideo || isVideoGenerating) return;
    await renderMergedVideo({
      enableSubtitles: false,
      qualityMode: 'preview',
      downloadFile: false,
      customTitle: `${draft.topic || '프로젝트'} 합본 미리보기`,
    });
  }, [draft.topic, isPreparingPreviewVideo, isVideoGenerating, renderMergedVideo]);

  const handleNarrationChange = (index: number, narration: string) => {
    updateAssetAt(index, { narration, targetDuration: Math.max(assetsRef.current[index].targetDuration || 0, estimateClipDuration(narration)) });
  };

  const handleDurationChange = (index: number, duration: number) => {
    updateAssetAt(index, { targetDuration: duration });
  };

  const handleGenerateThumbnail = useCallback(async () => {
    if (!currentProjectId || isThumbnailGenerating) return;
    setIsThumbnailGenerating(true);
    try {
      const allProjects = await getSavedProjects();
      const existingProject = allProjects.find((item) => item.id === currentProjectId) || null;
      const existingThumbnailHistory = existingProject?.thumbnailHistory || [];
      const workingProject: SavedProject = {
        id: currentProjectId,
        name: draft.topic || '프로젝트',
        createdAt: existingProject?.createdAt || Date.now(),
        topic: draft.topic || '프로젝트',
        settings: {
          imageModel: studioState?.routing?.imageModel || getSelectedImageModel(),
          outputMode: 'video',
          elevenLabsModel: studioState?.routing?.audioModel || 'eleven_multilingual_v2',
        },
        assets: generatedData,
        thumbnail: existingProject?.thumbnail || null,
        thumbnailTitle: existingProject?.thumbnailTitle || null,
        thumbnailPrompt: existingProject?.thumbnailPrompt || null,
        thumbnailHistory: existingThumbnailHistory,
        selectedThumbnailId: existingProject?.selectedThumbnailId || null,
        cost: currentCostRef.current,
        backgroundMusicTracks,
        previewMix,
        workflowDraft: draft,
      };

      const thumbnailVariantSeed = existingThumbnailHistory.length;
      const sampleThumbnail = createSampleThumbnail(workingProject, thumbnailVariantSeed);
      let nextThumbnail = sampleThumbnail.dataUrl;
      let sourceMode: PromptedImageAsset['sourceMode'] = 'sample';
      let sourceLabel = '샘플 썸네일';
      try {
        const imageModel = studioState?.routing?.imageModel || getSelectedImageModel();
        const usesSampleImageFlow = isSampleImageModel(imageModel);
        const generated = await generateImage(buildThumbnailScene(workingProject, thumbnailVariantSeed), buildReferenceImages(), { qualityMode: 'draft' });
        if (generated) {
          nextThumbnail = generated;
          sourceMode = usesSampleImageFlow ? 'sample' : 'ai';
          sourceLabel = usesSampleImageFlow ? '샘플 썸네일' : 'AI 썸네일';
        }
      } catch {}

      const historyEntry: PromptedImageAsset = {
        id: `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: `${sampleThumbnail.title} 썸네일 ${existingThumbnailHistory.length + 1}`,
        prompt: sampleThumbnail.prompt,
        imageData: nextThumbnail,
        createdAt: Date.now(),
        kind: 'thumbnail',
        sourceMode,
        selected: true,
        groupId: 'thumbnail-history',
        groupLabel: 'thumbnail-history',
        note: sourceLabel,
      };

      const nextThumbnailHistory = [historyEntry, ...existingThumbnailHistory].map((item, index) => ({
        ...item,
        selected: index === 0,
      }));

      await updateProject(currentProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
        workflowDraft: draft,
        thumbnail: nextThumbnail,
        thumbnailTitle: sampleThumbnail.title,
        thumbnailPrompt: sampleThumbnail.prompt,
        thumbnailHistory: nextThumbnailHistory,
        selectedThumbnailId: historyEntry.id,
        cost: currentCostRef.current,
      });
      setProgressMessage(`${sourceLabel}을 프로젝트 대표 이미지로 저장했습니다. 버튼을 다시 누르면 지금 완성된 씬 기준으로 새 후보를 계속 생성할 수 있습니다.`);
    } finally {
      setIsThumbnailGenerating(false);
    }
  }, [backgroundMusicTracks, buildReferenceImages, currentProjectId, draft, generatedData, isThumbnailGenerating, previewMix, studioState?.routing?.audioModel, studioState?.routing?.imageModel]);


  const renderSummarySection = () => {
    if (summarySection === 'step1') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">콘텐츠 유형</div><div className="mt-2 text-sm font-black text-slate-900">{draft.contentType || '미설정'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">화면 비율</div><div className="mt-2 text-sm font-black text-slate-900">{draft.aspectRatio || '16:9'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">프로젝트 번호</div><div className="mt-2 text-sm font-black text-slate-900">{currentProjectSummary?.projectNumber ? `#${currentProjectSummary.projectNumber}` : '미지정'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">완료 단계</div><div className="mt-2 text-sm font-black text-slate-900">{Object.values(draft.completedSteps || {}).filter(Boolean).length} / 5</div></div>
          </div>
        </div>
      );
    }
    if (summarySection === 'step2') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">주제</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{draft.topic || '미입력'}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">장르</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.genre || '미입력'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">분위기</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.mood || '미입력'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">엔딩 톤</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.endingTone || '미입력'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">배경</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.setting || '미입력'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">주인공</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.protagonist || '미입력'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">갈등</div><div className="mt-2 text-sm font-black text-slate-900">{draft.selections?.conflict || '미입력'}</div></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">예상 분량</div><div className="mt-2 text-sm font-black text-slate-900">{draft.customScriptSettings?.expectedDurationMinutes || 3}분</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">말투</div><div className="mt-2 text-sm font-black text-slate-900">{draft.customScriptSettings?.speechStyle || 'default'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">언어</div><div className="mt-2 text-sm font-black text-slate-900">{draft.customScriptSettings?.language || 'ko'}</div></div>
          </div>
        </div>
      );
    }
    if (summarySection === 'step3') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택된 프로젝트 프롬프트</div>
            <div className="mt-2 text-sm font-black text-slate-900">{summarySelectedPromptTemplate?.name || '미선택'}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{summarySelectedPromptTemplate?.prompt || '저장된 프롬프트가 없습니다.'}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">스토리 프롬프트 팩</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.promptPack?.storyPrompt || '없음'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">장면 프롬프트 팩</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.promptPack?.scenePrompt || '없음'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">캐릭터 프롬프트 팩</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.promptPack?.characterPrompt || '없음'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">액션 프롬프트 팩</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.promptPack?.actionPrompt || '없음'}</div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">최종 대본</div><div className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">문단 {summarySceneCount}개</div></div>
            <div className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{draft.script || '저장된 대본이 없습니다.'}</div>
          </div>
          {(draft.customScriptSettings?.referenceText || draft.customScriptSettings?.referenceLinks?.length) ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">참조 자료</div>
              {draft.customScriptSettings?.referenceText ? <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.customScriptSettings.referenceText}</div> : null}
              {draft.customScriptSettings?.referenceLinks?.length ? (
                <div className="mt-3 space-y-2">{draft.customScriptSettings.referenceLinks.map((link) => <div key={link.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600"><div className="font-black text-slate-800">{link.title || link.url}</div><div className="mt-1 break-all">{link.url}</div><div className="mt-1 whitespace-pre-wrap break-words">{link.summary || link.sourceText || link.status}</div></div>)}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    if (summarySection === 'step4') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">공통 캐릭터 스타일</div>
            <div className="mt-2 text-sm font-black text-slate-900">{draft.selectedCharacterStyleLabel || '미선택'}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{draft.selectedCharacterStylePrompt || '저장된 캐릭터 스타일 프롬프트가 없습니다.'}</div>
          </div>
          <div className="space-y-3">
            {summaryCharacters.length ? summaryCharacters.map((character) => {
              const selectedImage = (character.generatedImages || []).find((item) => item.id === character.selectedImageId) || character.generatedImages?.[0] || null;
              return <div key={character.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-900">{character.name}</div><div className="mt-1 text-xs text-slate-500">{character.roleLabel || character.role || '출연자'} · 후보 {(character.generatedImages || []).length}장</div></div><div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">대표 이미지 {selectedImage ? '선택됨' : '없음'}</div></div><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">캐릭터 프롬프트</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{character.prompt || character.description || '없음'}</div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택 이미지 프롬프트</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{selectedImage?.prompt || '선택된 이미지 프롬프트 없음'}</div></div></div></div>;
            }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">저장된 출연자 정보가 없습니다.</div>}
          </div>
        </div>
      );
    }
    if (summarySection === 'step5') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">선택된 최종 화풍</div><div className="mt-2 text-sm font-black text-slate-900">{summarySelectedStyle?.groupLabel || summarySelectedStyle?.label || '미선택'}</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{summarySelectedStyle?.prompt || '저장된 화풍 프롬프트가 없습니다.'}</div></div>
          <div className="space-y-3">{draft.styleImages.length ? draft.styleImages.map((style) => <div key={style.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-black text-slate-900">{style.groupLabel || style.label}</div><div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{style.id === draft.selectedStyleImageId ? '현재 선택' : style.sourceMode === 'sample' ? '샘플' : style.sourceMode === 'upload' ? '업로드' : '추천 카드'}</div></div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{style.prompt}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">저장된 화풍 카드가 없습니다.</div>}</div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">씬 수</div><div className="mt-2 text-sm font-black text-slate-900">{summarySceneCount}개</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">출연자 참조 이미지</div><div className="mt-2 text-sm font-black text-slate-900">{summaryCharacters.filter((item) => Boolean(item.imageData)).length}장</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">캐릭터 강도</div><div className="mt-2 text-sm font-black text-slate-900">{draft.referenceImages?.characterStrength || 70}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">화풍 강도</div><div className="mt-2 text-sm font-black text-slate-900">{draft.referenceImages?.styleStrength || 70}</div></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">씬 제작으로 넘기는 핵심 값</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            <div><span className="font-black text-slate-900">기본:</span> {draft.contentType} · {draft.aspectRatio} · 주제 {draft.topic || '미입력'}</div>
            <div><span className="font-black text-slate-900">선택 출연자:</span> {summaryCharacters.map((item) => item.name).join(', ') || '없음'}</div>
            <div><span className="font-black text-slate-900">캐릭터 스타일:</span> {draft.selectedCharacterStyleLabel || '미선택'}</div>
            <div><span className="font-black text-slate-900">최종 화풍:</span> {summarySelectedStyle?.groupLabel || summarySelectedStyle?.label || '미선택'}</div>
            <div><span className="font-black text-slate-900">씬 생성 기준 프롬프트:</span> {draft.promptPack?.scenePrompt || '없음'}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LoadingOverlay open={Boolean(navigationOverlay)} title={navigationOverlay?.title || '이동 중'} description={navigationOverlay?.description} />
      <Header
        projectCount={studioState.projects?.length || 0}
        selectedCharacterName={selectedCharacterName}
        storageDir={studioState.storageDir}
        onOpenSettings={() => setShowSettings(true)}
        basePath={basePath}
        currentSection="scene"
        progressPercent={workflowProgress.percent}
        progressText={workflowProgress.text}
        onGoGallery={() => {
          setNavigationOverlay({
            title: '프로젝트 보관함을 여는 중',
            description: '현재 씬 작업은 저장된 상태로 유지하고, 보관함 목록으로 이동합니다.',
          });
          try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
          router.push(`${basePath}?view=gallery`, { scroll: true });
        }}
      />
      <SettingsDrawer open={showSettings} studioState={studioState} onClose={() => setShowSettings(false)} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} />
      <ProviderQuickModal open={showApiModal} studioState={studioState} title={apiModalTitle} description={apiModalDescription} focusField={apiModalFocusField} onClose={handleApiModalClose} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} onOpenFullSettings={() => { setShowApiModal(false); setShowSettings(true); }} />

      <main className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">{isThumbnailStudioRoute ? '썸네일 제작 화면' : '씬 제작 화면'}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900">{isThumbnailStudioRoute ? '프로젝트 썸네일 제작' : '프로젝트 씬 제작'}</h1>
                {currentProjectSummary?.projectNumber && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">프로젝트 #{currentProjectSummary.projectNumber}</span>}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{isThumbnailStudioRoute ? '썸네일 생성 버튼과 결과 영역으로 바로 안내하는 전용 페이지입니다. 기존 씬 제작 데이터는 그대로 유지한 채 썸네일 작업만 이어갈 수 있습니다.' : '페이지 자체는 먼저 열고, 필요한 경우에만 짧게 준비 화면을 보여 줍니다. 실제 생성이 시작되면 전체 화면을 막지 않고 제작 중인 씬 카드에만 스켈레톤과 퍼센트를 표시합니다.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep4Open(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">입력 요약 보기</button>
              <button type="button" onClick={() => void handleGenerate({ preserveExistingCards: true, generateAudio: false })} disabled={isGeneratingScenes} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isGeneratingScenes ? '전체 이미지 생성 중...' : '전체 이미지 생성'}</button>
              <button type="button" onClick={() => void handleGenerate({ preserveExistingCards: true, generateAudio: true })} disabled={isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">이미지 + 오디오 생성</button>
              <button type="button" onClick={() => void handleGenerateAllVideos()} disabled={isGeneratingAllVideos || isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '전체 영상 생성 중...' : '모든 씬 영상 생성'}</button>
            </div>
          </div>

          <OverlayModal
            open={step4Open}
            title="입력 요약"
            description="Step1부터 Step6까지 저장된 값과 실제 전달되는 프롬프트를 구분별 버튼으로 확인합니다."
            onClose={() => setStep4Open(false)}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {summarySections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSummarySection(section.id)}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${summarySection === section.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">현재 구분 설명</div>
                <div className="mt-2 text-sm font-black text-slate-900">{summarySections.find((section) => section.id === summarySection)?.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{summarySections.find((section) => section.id === summarySection)?.description}</p>
              </div>
              <div className="max-h-[62vh] overflow-auto pr-1">{renderSummarySection()}</div>
            </div>
          </OverlayModal>
        </div>

        {step !== GenerationStep.IDLE && progressMessage && !generatedData.length && (
          <div className="my-6 text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              {step === GenerationStep.SCRIPTING || step === GenerationStep.ASSETS ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> : <div className={`h-2.5 w-2.5 rounded-full ${step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-emerald-500'}`} />}
              <span className="text-sm font-bold text-slate-700">{progressMessage}</span>
            </div>
          </div>
        )}

        <ResultTable
          data={generatedData}
          onRegenerateImage={handleRegenerateImage}
          onRegenerateAudio={handleRegenerateAudio}
          onExportVideo={triggerVideoExport}
          onGenerateAnimation={handleGenerateAnimation}
          onNarrationChange={handleNarrationChange}
          onDurationChange={handleDurationChange}
          onOpenSettings={() => setShowSettings(true)}
          onRequestProviderSetup={(kind) => openApiModal({
            title: kind === 'audio' ? '오디오 / 자막 기능 연결' : kind === 'video' ? '영상 기능 연결' : '텍스트 AI 연결',
            description: kind === 'audio'
              ? '현재 위치에서 바로 오디오와 자막 생성을 이어가려면 ElevenLabs 키를 연결해 주세요.'
              : kind === 'video'
                ? '현재 위치에서 바로 영상 변환을 이어가려면 FAL 또는 연결한 영상 공급자 키를 등록해 주세요.'
                : '현재 위치에서 바로 AI 보조 기능을 쓰려면 OpenRouter 키를 연결해 주세요.',
            focusField: kind === 'audio' ? 'elevenLabs' : kind === 'video' ? 'fal' : 'openRouter',
          })}
          isExporting={isVideoGenerating}
          animatingIndices={animatingIndices}
          backgroundMusicTracks={backgroundMusicTracks}
          activeBackgroundTrackId={activeBackgroundTrackId}
          onSelectBackgroundTrack={setActiveBackgroundTrackId}
          onCreateBackgroundTrack={createAnotherBackgroundTrack}
          previewMix={previewMix}
          onPreviewMixChange={setPreviewMix}
          currentTopic={draft.topic}
          totalCost={currentCost || undefined}
          isGenerating={isGeneratingScenes}
          progressMessage={progressMessage}
          progressPercent={taskProgressPercent}
          progressLabel={isVideoGenerating ? '최종 MP4 출력 진행률' : isGeneratingAllVideos ? '전체 씬 영상 생성 진행률' : isGeneratingScenes ? '씬 생성 진행률' : '현재 작업 진행률'}
          sceneProgressMap={sceneProgressMap}
          finalVideoUrl={finalVideoUrl}
          finalVideoTitle={finalVideoTitle}
          previewVideoStatus={previewVideoStatus}
          previewVideoMessage={previewVideoMessage}
          onPreparePreviewVideo={handlePreparePreviewVideo}
          isPreparingPreviewVideo={isPreparingPreviewVideo}
          onGenerateThumbnail={handleGenerateThumbnail}
          isThumbnailGenerating={isThumbnailGenerating}
          onGenerateAllImages={() => void handleGenerate({ preserveExistingCards: true, generateAudio: false })}
          onGenerateAllVideos={() => void handleGenerateAllVideos()}
          isGeneratingAllVideos={isGeneratingAllVideos}
          onFooterBack={handleGoBackToWorkflow}
          footerBackLabel="이전으로"
          thumbnailToolbarRef={thumbnailToolbarRef}
        />
      </main>
    </div>
  );
};

export default SceneStudioPage;
