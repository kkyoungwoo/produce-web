'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import ProviderQuickModal from '../components/ProviderQuickModal';
import ResultTable from '../components/ResultTable';
import { LoadingOverlay, StudioPageSkeleton } from '../components/LoadingOverlay';
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
} from '../types';
import { fetchStudioState, saveStudioState, getCachedStudioState } from '../services/localFileApi';
import { ensureWorkflowDraft } from '../services/workflowDraftService';
import { getDefaultPreviewMix, createSampleBackgroundTrack } from '../services/musicService';
import { generateImage, getSelectedImageModel } from '../services/imageService';
import { buildThumbnailScene, createSampleThumbnail } from '../services/thumbnailService';
import { generateAudioWithElevenLabs } from '../services/elevenLabsService';
import { generateMotionPrompt, generateScript } from '../services/geminiService';
import { generateVideo } from '../services/videoService';
import { generateVideoFromImage, getFalApiKey } from '../services/falService';
import { getProjectById, getSavedProjects, updateProject, upsertWorkflowProject } from '../services/projectService';
import { CONFIG, PRICING } from '../config';
import { estimateClipDuration, splitStoryIntoParagraphScenes } from '../utils/storyHelpers';
import {
  applySelectionPromptsToScenes as applyDraftSelectionPromptsToScenes,
  createInitialSceneAssetsFromDraft,
  createLocalScenesFromDraft,
} from '../services/sceneAssemblyService';
import * as FileSaver from 'file-saver';

const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mergeAiScenesIntoLocalScenes(localScenes: ScriptScene[], aiScenes?: ScriptScene[]): ScriptScene[] {
  if (!aiScenes?.length) return localScenes;
  return localScenes.map((scene, index) => ({
    ...scene,
    visualPrompt: aiScenes[index]?.visualPrompt || scene.visualPrompt,
    analysis: aiScenes[index]?.analysis || scene.analysis,
  }));
}

const SceneStudioPage: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => pathname.replace(/\/scene-studio$/, ''), [pathname]);
  const [studioState, setStudioState] = useState<StudioState | null>(null);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generatedData, setGeneratedData] = useState<GeneratedAsset[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiModalTitle, setApiModalTitle] = useState('API 키 등록');
  const [apiModalDescription, setApiModalDescription] = useState('필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
  const [apiModalFocusField, setApiModalFocusField] = useState<'openRouter' | 'elevenLabs' | 'fal' | null>(null);
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
  const assetsRef = useRef<GeneratedAsset[]>([]);
  const isAbortedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const projectQueryHandledRef = useRef('');
  const currentCostRef = useRef<CostBreakdown>({ images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 });
  const autosaveSignatureRef = useRef('');

  useEffect(() => {
    const cachedState = getCachedStudioState();
    if (cachedState) {
      setStudioState(cachedState);
      if (cachedState.workflowDraft) {
        setBackgroundMusicTracks([]);
      }
    }

    (async () => {
      const state = await fetchStudioState({ force: true });
      setStudioState(state);
      if (state.workflowDraft) {
        setBackgroundMusicTracks([]);
      }
    })();
  }, []);

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

  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const effectiveBackgroundTracks = useMemo(() => {
    const picked = backgroundMusicTracks.find((item) => item.id === activeBackgroundTrackId) || backgroundMusicTracks[0];
    return picked ? [picked] : [];
  }, [backgroundMusicTracks, activeBackgroundTrackId]);

  const buildReferenceImages = useCallback((): ReferenceImages => {
    const selectedCharacters = draft.extractedCharacters.filter((item) => draft.selectedCharacterIds.includes(item.id));
    const selectedStyle = draft.styleImages.find((item) => item.id === draft.selectedStyleImageId);
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
      const aiScenes = await generateScript(draft.topic || 'Manual Script Input', hasReferenceImage, draft.script, draft.contentType);
      return applyDraftSelectionPromptsToScenes(mergeAiScenesIntoLocalScenes(localScenes, aiScenes), draft);
    } catch {
      return applyDraftSelectionPromptsToScenes(localScenes, draft);
    }
  }, [draft, buildReferenceImages]);

  const openApiModal = (options: { title?: string; description?: string; focusField?: 'openRouter' | 'elevenLabs' | 'fal' | null }) => {
    setApiModalTitle(options.title || 'API 키 등록');
    setApiModalDescription(options.description || '필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
    setApiModalFocusField(options.focusField || null);
    setShowApiModal(true);
  };

  const handleApiModalClose = () => {
    setShowApiModal(false);
  };

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

    void (async () => {
      const project = await getProjectById(projectId, { forceSync: true });
      if (!project) return;
      const safeAssets = Array.isArray(project.assets) && project.assets.length
        ? project.assets.map((asset) => ({ ...asset, aspectRatio: asset?.aspectRatio || project.workflowDraft?.aspectRatio || '16:9' }))
        : (project.workflowDraft ? createInitialSceneAssetsFromDraft(project.workflowDraft) : []);
      if (project.workflowDraft) {
        const existingDraft = studioState.workflowDraft;
        const sameDraft = Boolean(existingDraft
          && existingDraft.updatedAt === project.workflowDraft.updatedAt
          && existingDraft.selectedStyleImageId === project.workflowDraft.selectedStyleImageId
          && JSON.stringify(existingDraft.selectedCharacterIds || []) === JSON.stringify(project.workflowDraft.selectedCharacterIds || [])
          && (existingDraft.script || '') === (project.workflowDraft.script || ''));

        if (sameDraft) {
          setStudioState((prev) => prev ? {
            ...prev,
            workflowDraft: project.workflowDraft,
            lastContentType: project.workflowDraft.contentType || prev.lastContentType || 'story',
          } : prev);
        } else {
          const syncedState = await saveStudioState({
            ...studioState,
            workflowDraft: project.workflowDraft,
            lastContentType: project.workflowDraft.contentType || studioState.lastContentType || 'story',
            updatedAt: Date.now(),
          });
          setStudioState(syncedState);
        }
      }
      assetsRef.current = safeAssets;
      setGeneratedData([...safeAssets]);
      setCurrentProjectId(project.id);
      setBackgroundMusicTracks(project.backgroundMusicTracks || []);
      setActiveBackgroundTrackId(project.backgroundMusicTracks?.[0]?.id || null);
      setPreviewMix(project.previewMix || getDefaultPreviewMix());
      setCurrentCost(project.cost || null);
      currentCostRef.current = project.cost || { images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 };
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
      setStep(safeAssets.length ? GenerationStep.COMPLETED : GenerationStep.IDLE);
      setStep4Open(false);
      setProgressMessage(`"${project.name}" 프로젝트를 열었습니다. 씬 카드는 먼저 가볍게 보여 주고, 실제 AI 생성은 생성 버튼을 눌렀을 때만 시작합니다.`);
    })();
  }, [searchParams, studioState]);


  const handleGenerate = useCallback(async (options?: { preserveExistingCards?: boolean }) => {
    if (isProcessingRef.current) return;
    if (!draft.script?.trim()) {
      setStep(GenerationStep.ERROR);
      setProgressMessage('대본이 비어 있어 씬 생성을 시작할 수 없습니다. Step 1~3을 먼저 완료해 주세요.');
      return;
    }
    if (!draft.selectedCharacterIds.length || !draft.selectedStyleImageId) {
      setStep(GenerationStep.ERROR);
      setProgressMessage('캐릭터와 화풍 선택이 필요합니다. Step 4에서 선택을 마쳐 주세요.');
      return;
    }

    const preserveExistingCards = Boolean(options?.preserveExistingCards && assetsRef.current.length);

    isProcessingRef.current = true;
    setIsGeneratingScenes(true);
    isAbortedRef.current = false;
    resetCost();
    setStep4Open(false);
    setStep(preserveExistingCards ? GenerationStep.ASSETS : GenerationStep.SCRIPTING);
    setProgressMessage(preserveExistingCards ? '기존 예시 씬 카드는 그대로 두고, 각 카드 자리에서만 새 결과를 덧입히는 중...' : '스토리를 문단별 씬으로 정리하는 중...');

    try {
      const scenes = await createScenePlan();
      const referenceImages = buildReferenceImages();
      const baseAssets = preserveExistingCards ? assetsRef.current : [];

      const initialAssets: GeneratedAsset[] = scenes.map((scene, index) => {
        const existing = baseAssets[index];
        const fallbackPreview = createInitialSceneAssetsFromDraft(draft)[index];
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

      const elevenKey = studioState?.providers?.elevenLabsApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY) || '';

      for (let i = 0; i < initialAssets.length; i++) {
        const currentAspectRatio = assetsRef.current[i].aspectRatio || draft.aspectRatio || '16:9';
        updateAssetAt(i, { status: 'generating', aspectRatio: currentAspectRatio });
        setProgressMessage(`씬 ${i + 1}/${initialAssets.length} 이미지를 준비하는 중...`);

        let imageData: string | null = null;
        let sourceMode: 'ai' | 'sample' = 'sample';

        try {
          imageData = await generateImage({ ...assetsRef.current[i], aspectRatio: currentAspectRatio }, referenceImages);
          if (imageData) {
            sourceMode = 'ai';
            const imageModel = getSelectedImageModel();
            const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
            addCost('image', price, 1);
          }
        } catch {
          imageData = null;
        }

        if (!imageData) {
          imageData = assetsRef.current[i].imageData || createInitialSceneAssetsFromDraft(draft)[i]?.imageData || null;
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

        if (elevenKey) {
          setProgressMessage(`씬 ${i + 1}/${initialAssets.length} 오디오와 자막을 준비하는 중...`);
          try {
            const audio = await generateAudioWithElevenLabs(assetsRef.current[i].narration, elevenKey);
            if (audio.audioData) {
              updateAssetAt(i, {
                audioData: audio.audioData,
                subtitleData: audio.subtitleData,
                audioDuration: audio.estimatedDuration,
                targetDuration: Math.max(assetsRef.current[i].targetDuration || 0, audio.estimatedDuration || 0, 3),
              });
              addCost('tts', PRICING.TTS.perCharacter * assetsRef.current[i].narration.length, assetsRef.current[i].narration.length);
            }
          } catch {}
        }

        await wait(220);
      }

      const nextTracks = backgroundMusicTracks.length ? backgroundMusicTracks : [createSampleBackgroundTrack(draft)];
      const selectedTrack = nextTracks[0];
      setBackgroundMusicTracks(nextTracks);
      setActiveBackgroundTrackId(selectedTrack?.id || null);
      setPreviewMix((prev) => prev || getDefaultPreviewMix());

      setStep(GenerationStep.COMPLETED);
      setProgressMessage('씬 카드 생성이 끝났습니다. 이미지 보기 / 영상 보기에서 이전 생성본도 함께 비교할 수 있습니다.');

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
      await persistWorkflowStep4(true);
    } catch (error: any) {
      setStep(GenerationStep.ERROR);
      setProgressMessage(`오류: ${error?.message || '생성 중 문제가 발생했습니다.'}`);
    } finally {
      isProcessingRef.current = false;
      setIsGeneratingScenes(false);
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

  const handleRegenerateImage = async (index: number) => {
    updateAssetAt(index, { status: 'generating' });
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
    }
  };

  const handleRegenerateAudio = async (index: number) => {
    const apiKey = studioState?.providers?.elevenLabsApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY) || '';
    if (!apiKey) {
      openApiModal({ title: '오디오 생성에는 ElevenLabs API 키가 필요합니다', description: '키를 넣고 저장하면 현재 씬의 오디오만 바로 다시 만들 수 있습니다.', focusField: 'elevenLabs' });
      return;
    }

    try {
      const audio = await generateAudioWithElevenLabs(assetsRef.current[index].narration, apiKey);
      if (audio.audioData) {
        updateAssetAt(index, {
          audioData: audio.audioData,
          subtitleData: audio.subtitleData,
          audioDuration: audio.estimatedDuration,
          targetDuration: Math.max(assetsRef.current[index].targetDuration || 0, audio.estimatedDuration || 0, 3),
        });
      }
    } catch {}
  };

  const handleGenerateAnimation = async (index: number) => {
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    if (!falKey) {
      openApiModal({ title: '영상 변환용 API가 필요합니다', description: 'FAL 키나 직접 연결한 외부 영상 공급자 키를 등록하면 이 씬만 영상으로 변환할 수 있습니다.', focusField: 'fal' });
      return;
    }
    if (!assetsRef.current[index]?.imageData) return;
    if (animatingIndices.has(index)) return;

    try {
      setAnimatingIndices((prev) => new Set(prev).add(index));
      const motionPrompt = await generateMotionPrompt(assetsRef.current[index].narration, assetsRef.current[index].visualPrompt);
      const videoUrl = await generateVideoFromImage(assetsRef.current[index].imageData!, motionPrompt, falKey, assetsRef.current[index].aspectRatio || draft.aspectRatio || '16:9');
      if (videoUrl) {
        updateAssetAt(index, {
          videoData: videoUrl,
          videoHistory: appendVideoHistory(assetsRef.current[index], videoUrl, 'ai', 'AI 영상 변환'),
          videoDuration: CONFIG.ANIMATION.VIDEO_DURATION,
        });
        addCost('video', PRICING.VIDEO.perVideo, 1);
      }
    } finally {
      setAnimatingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleGenerateAllVideos = useCallback(async () => {
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    if (!falKey) {
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
    try {
      for (const { asset, index } of availableIndices) {
        setProgressMessage(`씬 ${index + 1}/${availableIndices.length} 전체 영상 생성 중...`);
        const motionPrompt = await generateMotionPrompt(asset.narration, asset.visualPrompt);
        const videoUrl = await generateVideoFromImage(asset.imageData!, motionPrompt, falKey, asset.aspectRatio || draft.aspectRatio || '16:9');
        if (videoUrl) {
          updateAssetAt(index, {
            videoData: videoUrl,
            videoHistory: appendVideoHistory(assetsRef.current[index], videoUrl, 'ai', '전체 일괄 영상 생성'),
            videoDuration: CONFIG.ANIMATION.VIDEO_DURATION,
          });
          addCost('video', PRICING.VIDEO.perVideo, 1);
        }
        await wait(180);
      }
      setProgressMessage('모든 씬의 영상 변환을 마쳤습니다. 미리보기에서 바로 확인할 수 있습니다.');
    } finally {
      setIsGeneratingAllVideos(false);
    }
  }, [appendVideoHistory, draft.aspectRatio, studioState, updateAssetAt]);

  const triggerVideoExport = async (enableSubtitles: boolean) => {
    if (isVideoGenerating) return;
    if (enableSubtitles && assetsRef.current.some((asset) => !asset.subtitleData && !asset.audioData)) {
      openApiModal({ title: '자막 출력에는 오디오 생성 연결이 필요합니다', description: '현재 씬 중 일부는 자막용 오디오 데이터가 없어 자막이 비어 있을 수 있습니다. ElevenLabs 키를 연결하면 이 자리에서 다시 생성할 수 있습니다.', focusField: 'elevenLabs' });
      return;
    }
    try {
      setIsVideoGenerating(true);
      const result = await generateVideo(
        assetsRef.current,
        (message) => setProgressMessage(`[Render] ${message}`),
        isAbortedRef,
        {
          enableSubtitles,
          backgroundTracks: effectiveBackgroundTracks,
          previewMix,
          aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
        }
      );
      if (result) {
        const suffix = enableSubtitles ? 'sub' : 'nosub';
        if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
        const objectUrl = URL.createObjectURL(result.videoBlob);
        setFinalVideoUrl(objectUrl);
        setFinalVideoTitle(`${draft.topic || '프로젝트'} 최종 출력 (${enableSubtitles ? '자막 포함' : '자막 없음'})`);
        saveAs(result.videoBlob, `mp4Creater_${suffix}_${Date.now()}.mp4`);
      }
    } finally {
      setIsVideoGenerating(false);
    }
  };

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


  if (!studioState) {
    return <StudioPageSkeleton title="씬 제작 화면을 여는 중" description="프로젝트 요약과 씬 카드를 먼저 안정적으로 붙이고 있습니다." />;
  }

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
        onGoMain={() => {
          setNavigationOverlay({
            title: '새 프로젝트를 여는 중',
            description: '현재 씬 작업은 저장된 상태로 남기고, 새 프로젝트 제작 화면으로 이동합니다.',
          });
          router.push(`${basePath}?new=${Date.now()}`, { scroll: false });
        }}
        onGoGallery={() => {
          setNavigationOverlay({
            title: '프로젝트 보관함을 여는 중',
            description: '현재 씬 작업은 저장된 상태로 유지하고, 보관함 목록으로 이동합니다.',
          });
          router.push(`${basePath}?view=gallery`, { scroll: false });
        }}
      />
      <SettingsDrawer open={showSettings} studioState={studioState} onClose={() => setShowSettings(false)} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} />
      <ProviderQuickModal open={showApiModal} studioState={studioState} title={apiModalTitle} description={apiModalDescription} focusField={apiModalFocusField} onClose={handleApiModalClose} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} onOpenFullSettings={() => { setShowApiModal(false); setShowSettings(true); }} />

      <main className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Scene Studio</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900">프로젝트 씬 제작</h1>
                {currentProjectSummary?.projectNumber && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">프로젝트 #{currentProjectSummary.projectNumber}</span>}
                {currentProjectSummary?.folderName && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{currentProjectSummary.folderName}</span>}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">페이지는 먼저 열리고, 씬 카드는 즉시 보이며 실제 AI 생성은 버튼을 눌렀을 때만 시작됩니다. 결과 확인은 결과 미리보기에서 먼저 검토한 뒤 최종 출력하면 됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setNavigationOverlay({
                    title: '워크플로우 화면으로 돌아가는 중',
                    description: '현재 프로젝트 상태를 유지한 채 Step 4 선택 화면으로 자연스럽게 돌아갑니다.',
                  });
                  if (currentProjectId) {
                    router.push(`${basePath}?projectId=${encodeURIComponent(currentProjectId)}&returnTo=workflow`, { scroll: false });
                    return;
                  }
                  router.push(basePath, { scroll: false });
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                이전으로 이동
              </button>
              <button type="button" onClick={() => setStep4Open((prev) => !prev)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{step4Open ? '입력 요약 접기' : '입력 요약 보기'}</button>
              <button type="button" onClick={() => void handleGenerate()} disabled={isGeneratingScenes} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isGeneratingScenes ? '전체 씬 생성 중...' : '전체 씬 생성'}</button>
              <button type="button" onClick={() => void handleGenerate({ preserveExistingCards: true })} disabled={isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">이미지 / 오디오 다시 생성</button>
              <button type="button" onClick={() => void handleGenerateAllVideos()} disabled={isGeneratingAllVideos || isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '전체 영상 생성 중...' : '모든 씬 영상 생성'}</button>
            </div>
          </div>

          {step4Open && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">Step 3에서 고른 캐릭터</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{draft.selectedCharacterIds.length}명 선택됨</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">Step 4에서 고른 화풍</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{draft.selectedStyleImageId ? '1개 준비됨' : '선택 필요'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">예상 씬 수 / 비율</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{splitStoryIntoParagraphScenes(draft.script).length}개 · {draft.aspectRatio || '16:9'}</p>
              </div>
            </div>
          )}
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
          finalVideoUrl={finalVideoUrl}
          finalVideoTitle={finalVideoTitle}
          onGenerateThumbnail={handleGenerateThumbnail}
          isThumbnailGenerating={isThumbnailGenerating}
          onGenerateAllImages={() => void handleGenerate({ preserveExistingCards: true })}
          onGenerateAllVideos={() => void handleGenerateAllVideos()}
          isGeneratingAllVideos={isGeneratingAllVideos}
        />
      </main>
    </div>
  );
};

export default SceneStudioPage;
