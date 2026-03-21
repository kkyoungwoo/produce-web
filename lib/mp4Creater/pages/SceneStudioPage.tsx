'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import ProviderQuickModal from '../components/ProviderQuickModal';
import ResultTable from '../components/ResultTable';
import { LoadingOverlay } from '../components/LoadingOverlay';
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
import { createDefaultStudioState, fetchStudioState, saveStudioState, getCachedStudioState } from '../services/localFileApi';
import { ensureWorkflowDraft } from '../services/workflowDraftService';
import { getDefaultPreviewMix, createSampleBackgroundTrack } from '../services/musicService';
import { generateImage, getSelectedImageModel } from '../services/imageService';
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
      storageDir: cachedProject.folderPath || '',
      isStorageConfigured: Boolean(cachedProject.folderPath),
      updatedAt: Date.now(),
    };
  }

  return createDefaultStudioState();
}

const SceneStudioPage: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => pathname.replace(/\/(scene-studio|step-6)$/, ''), [pathname]);
  const requestedProjectId = searchParams?.get('projectId') || '';
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
  const isAbortedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const projectQueryHandledRef = useRef('');
  const currentCostRef = useRef<CostBreakdown>({ images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 });
  const autosaveSignatureRef = useRef('');

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}

    const cachedState = getCachedStudioState();
    if (cachedState) {
      setStudioState(cachedState);
      if (cachedState.workflowDraft) setBackgroundMusicTracks([]);
    }

    (async () => {
      const state = await fetchStudioState({ force: true });
      setStudioState(state);
      if (state.workflowDraft) setBackgroundMusicTracks([]);
    })();
  }, [requestedProjectId]);

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

  const resolveSceneTtsOptions = useCallback(() => {
    const provider = (draft.ttsProvider || studioState?.routing?.ttsProvider || 'qwen3Tts') as 'qwen3Tts' | 'elevenLabs' | 'heygen';
    const apiKey = provider === 'elevenLabs'
      ? (studioState?.providers?.elevenLabsApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY) || '')
      : provider === 'heygen'
        ? (studioState?.providers?.heygenApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY) || '')
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

  const beginnerGuideItems = useMemo(() => {
    const scriptReady = Boolean(draft.script?.trim());
    const charactersReady = Boolean(draft.selectedCharacterIds.length || draft.extractedCharacters.length);
    const styleReady = Boolean(draft.selectedStyleImageId || draft.styleImages[0]?.id);
    const aiAudioReady = Boolean(studioState?.providers?.elevenLabsApiKey || studioState?.providers?.heygenApiKey || draft.ttsProvider === 'qwen3Tts');
    const aiVideoReady = Boolean(studioState?.providers?.falApiKey);

    return [
      scriptReady
        ? `대본 준비 완료: ${splitStoryIntoParagraphScenes(draft.script).length}개 씬으로 나눌 수 있습니다.`
        : '대본이 아직 없습니다. 1단계부터 3단계까지 프롬프트 또는 직접 입력으로 원고를 먼저 준비해 주세요.',
      charactersReady
        ? `출연자 준비 완료: ${(draft.selectedCharacterIds.length || draft.extractedCharacters.length)}명이 씬 참조 이미지로 연결됩니다.`
        : '출연자가 없어도 장면 생성은 가능하지만, 4단계에서 캐릭터 예시를 채우면 일관성이 더 좋아집니다.',
      styleReady
        ? '최종 화풍 선택 완료: 지금 고른 화풍이 모든 씬 이미지 스타일 기준이 됩니다. Step4 캐릭터 스타일과는 별도로 적용됩니다.'
        : '최종 영상 화풍이 아직 없습니다. 5단계에서 화풍 1개를 선택해야 프로젝트 씬 생성이 안정적으로 진행됩니다.',
      aiAudioReady
        ? '오디오 / 자막은 실제 AI로 생성됩니다.'
        : 'ElevenLabs 키가 없으면 오디오는 건너뛰고 이미지 중심 샘플 흐름으로 빠르게 확인합니다.',
      aiVideoReady
        ? '씬 영상화는 실제 AI로 이어집니다.'
        : 'FAL 키가 없으면 씬 카드는 정상 생성되고, 영상화 버튼만 연결 전 상태로 남습니다.',
    ];
  }, [draft, studioState?.providers?.elevenLabsApiKey, studioState?.providers?.falApiKey]);

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

      const cachedProject = readProjectNavigationProject(projectId) || await getProjectById(projectId);
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
        const existingDraft = studioState.workflowDraft;
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
          const syncedState = await saveStudioState({
            ...studioState,
            workflowDraft: projectDraft,
            lastContentType: projectDraft.contentType || studioState.lastContentType || 'story',
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
  }, [applyProjectToScreen, searchParams, studioState]);


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
        let sourceMode: 'ai' | 'sample' = 'sample';

        try {
          imageData = await withSoftTimeout(
            generateImage({ ...assetsRef.current[i], aspectRatio: currentAspectRatio }, referenceImages),
            12000,
            null
          );
          if (imageData) {
            sourceMode = 'ai';
            const imageModel = getSelectedImageModel();
            const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
            addCost('image', price, 1);
          }
          setSceneProgress(i, 58, imageData ? 'AI 이미지 완성' : '샘플 이미지 준비');
        } catch {
          imageData = null;
        }

        if (!imageData) {
          imageData = assetsRef.current[i].imageData || sampleAssets[i]?.imageData || null;
        }

        const nextImageHistory = imageData
          ? appendImageHistory(assetsRef.current[i], imageData, sourceMode, sourceMode === 'ai' ? 'AI 생성 이미지' : '샘플 / 대체 이미지')
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
        ? '씬 카드(이미지/오디오) 생성이 끝났습니다. 필요하면 씬별로 영상화를 진행해 주세요.'
        : '씬 이미지 생성이 끝났습니다. 필요하면 씬별 또는 전체 영상 생성을 진행해 주세요.');

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
      const imageData = await generateImage(assetsRef.current[index], buildReferenceImages());
      if (imageData) {
        updateAssetAt(index, {
          imageData,
          imageHistory: appendImageHistory(assetsRef.current[index], imageData, 'ai', 'AI 재생성 이미지'),
          sourceMode: 'ai',
          status: 'completed',
        });
        const imageModel = getSelectedImageModel();
        const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
        addCost('image', price, 1);
        setSceneProgress(index, 100, '이미지 다시 생성 완료');
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
        const generated = await generateImage(buildThumbnailScene(workingProject, thumbnailVariantSeed), buildReferenceImages());
        if (generated) {
          nextThumbnail = generated;
          sourceMode = 'ai';
          sourceLabel = 'AI 썸네일';
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
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">씬 제작 화면</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900">프로젝트 씬 제작</h1>
                {currentProjectSummary?.projectNumber && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">프로젝트 #{currentProjectSummary.projectNumber}</span>}
                {currentProjectSummary?.folderName && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{currentProjectSummary.folderName}</span>}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">페이지 자체는 먼저 열고, 필요한 경우에만 짧게 준비 화면을 보여 줍니다. 실제 생성이 시작되면 전체 화면을 막지 않고 제작 중인 씬 카드에만 스켈레톤과 퍼센트를 표시합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep4Open((prev) => !prev)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{step4Open ? '입력 요약 접기' : '입력 요약 보기'}</button>
              <button type="button" onClick={() => void handleGenerate({ preserveExistingCards: true, generateAudio: false })} disabled={isGeneratingScenes} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isGeneratingScenes ? '전체 이미지 생성 중...' : '전체 이미지 생성'}</button>
              <button type="button" onClick={() => void handleGenerate({ preserveExistingCards: true, generateAudio: true })} disabled={isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">이미지 + 오디오 생성</button>
              <button type="button" onClick={() => void handleGenerateAllVideos()} disabled={isGeneratingAllVideos || isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '전체 영상 생성 중...' : '모든 씬 영상 생성'}</button>
            </div>
          </div>

          {step4Open && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">3단계에서 고른 캐릭터</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{draft.selectedCharacterIds.length || draft.extractedCharacters.length}명 연결됨</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">5단계에서 고른 최종 화풍</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{(draft.selectedStyleImageId || draft.styleImages[0]?.id) ? '1개 준비됨' : '선택 필요'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">예상 씬 수 / 비율</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{splitStoryIntoParagraphScenes(draft.script).length}개 · {draft.aspectRatio || '16:9'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">처음 이용하는 분을 위한 순서</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">지금 화면에서 이렇게 진행하면 됩니다</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {beginnerGuideItems.map((item, index) => (
                <div key={`scene-guide-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">현재 상태</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">프로젝트 준비 현황</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">대본 {draft.script?.trim() ? '준비됨' : '필요'}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">출연자 {draft.selectedCharacterIds.length || draft.extractedCharacters.length}명 연결</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">화풍 {(draft.selectedStyleImageId || draft.styleImages[0]?.id) ? '선택 완료' : '선택 필요'}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">예상 씬 {splitStoryIntoParagraphScenes(draft.script).length}개</div>
            </div>
          </div>
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
        />
      </main>
    </div>
  );
};

export default SceneStudioPage;
