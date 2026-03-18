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
import { LoadingOverlay, StudioPageSkeleton } from './components/LoadingOverlay';
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
} from './services/localFileApi';
import {
  getProjectById,
  getSavedProjects,
  deleteProject,
  migrateFromLocalStorage,
  updateProject,
  upsertWorkflowProject,
} from './services/projectService';
import { estimateClipDuration } from './utils/storyHelpers';
import { createInitialSceneAssetsFromDraft } from './services/sceneAssemblyService';
import { createSampleBackgroundTrack, getDefaultPreviewMix } from './services/musicService';
import { createDefaultWorkflowDraft, ensureWorkflowDraft } from './services/workflowDraftService';
import { CONFIG } from './config';

function normalizeLoadedAssets(assets: GeneratedAsset[]): GeneratedAsset[] {
  return assets.map((asset) => ({
    ...asset,
    targetDuration:
      typeof asset.targetDuration === 'number'
        ? asset.targetDuration
        : asset.audioDuration || asset.videoDuration || estimateClipDuration(asset.narration),
  }));
}

const App: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => pathname || '/mp4Creater', [pathname]);
  const newProjectHandledRef = useRef('');
  const queryProjectHandledRef = useRef('');
  const studioStateRef = useRef<StudioState | null>(null);
  const workflowDraftSaveTimerRef = useRef<number | null>(null);
  const pendingWorkflowDraftRef = useRef<StudioState['workflowDraft'] | null>(null);

  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generatedData, setGeneratedData] = useState<GeneratedAsset[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [studioState, setStudioState] = useState<StudioState | null>(null);
  const [showStartupWizard, setShowStartupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiModalTitle, setApiModalTitle] = useState('API 키 등록');
  const [apiModalDescription, setApiModalDescription] = useState('필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
  const [apiModalFocusField, setApiModalFocusField] = useState<'openRouter' | 'elevenLabs' | 'fal' | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'gallery'>(searchParams?.get('view') === 'gallery' ? 'gallery' : 'main');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [backgroundMusicTracks, setBackgroundMusicTracks] = useState<BackgroundMusicTrack[]>([]);
  const [previewMix, setPreviewMix] = useState<PreviewMixSettings>(getDefaultPreviewMix());
  const [animatingIndices] = useState<Set<number>>(new Set());
  const [isExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentCost, setCurrentCost] = useState<CostBreakdown | null>(null);
  const [navigationOverlay, setNavigationOverlay] = useState<{ title: string; description: string } | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastWorkflowDraftSignatureRef = useRef('');

  const storageReady = Boolean(studioState?.isStorageConfigured && studioState?.storageDir?.trim());

  const promptStorageSelection = useCallback((message?: string) => {
    setShowStartupWizard(true);
    setNavigationOverlay(null);
    setProgressMessage(message || '프로젝트 폴더를 먼저 정해야 저장 파일과 프로젝트 폴더가 생성됩니다. 저장 폴더를 선택해 주세요.');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  useEffect(() => {
    studioStateRef.current = studioState;
  }, [studioState]);

  useEffect(() => () => {
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
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


  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const openApiModal = useCallback((options?: {
    title?: string;
    description?: string;
    focusField?: 'openRouter' | 'elevenLabs' | 'fal' | null;
  }) => {
    setApiModalTitle(options?.title || 'API 키 등록');
    setApiModalDescription(options?.description || '필요한 키를 등록하면 실제 생성 품질이 올라갑니다.');
    setApiModalFocusField(options?.focusField || null);
    setShowApiModal(true);
  }, []);

  const refreshProjects = useCallback(async (options?: { forceSync?: boolean }) => {
    const projects = await getSavedProjects({ forceSync: Boolean(options?.forceSync) });
    setSavedProjects(projects);

    const cachedState = getCachedStudioState();
    if (cachedState) {
      setStudioState(cachedState);
      return;
    }

    try {
      const state = await fetchStudioState({ force: Boolean(options?.forceSync) });
      setStudioState(state);
    } catch {
      // local cache fallback handled in service
    }
  }, []);

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
      setStudioState(nextState);
    } catch (error) {
      console.error('[mp4Creater] workflow draft save failed', error);
      setProgressMessage('임시 저장 중 오류가 발생해 현재 브라우저 상태를 유지합니다.');
    }
  }, []);

  const handleStartNewProject = useCallback(async (forceType?: StudioState['lastContentType']) => {
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    pendingWorkflowDraftRef.current = null;

    const currentState = studioStateRef.current || studioState || createDefaultStudioState();
    const nextDraft = createDefaultWorkflowDraft(forceType || currentState.lastContentType || 'story');
    const nextState = await saveStudioState({
      ...currentState,
      workflowDraft: nextDraft,
      selectedCharacterId: null,
      updatedAt: Date.now(),
      lastContentType: nextDraft.contentType,
    });
    setStudioState(nextState);
    setGeneratedData([]);
    setCurrentTopic('');
    setCurrentProjectId(null);
    setBackgroundMusicTracks([]);
    setPreviewMix(getDefaultPreviewMix());
    setCurrentCost(null);
    setProgressMessage('신규 프로젝트 제작 상태로 초기화했습니다.');
    setStep(GenerationStep.IDLE);
    setViewMode('main');
  }, [studioState]);

  useEffect(() => {
    setViewMode(searchParams?.get('view') === 'gallery' ? 'gallery' : 'main');
  }, [searchParams]);


  useEffect(() => {
    (async () => {
      try {
        const state = await fetchStudioState({ force: true });
        setStudioState(state);
        const shouldShowWizard = !state.isStorageConfigured || !state.storageDir?.trim();
        setShowStartupWizard(shouldShowWizard);
      } catch {
        const fallback = createDefaultStudioState();
        setStudioState(fallback);
        setShowStartupWizard(true);
      }

      await migrateFromLocalStorage();
      const projects = await getSavedProjects();
      setSavedProjects(projects);
      const cachedState = getCachedStudioState();
      if (cachedState) setStudioState(cachedState);
    })();
  }, []);

  useEffect(() => {
    const newFlag = searchParams?.get('new') || '';
    if (!newFlag || !studioState) return;
    const signature = `${basePath}:${newFlag}`;
    if (newProjectHandledRef.current === signature) return;
    newProjectHandledRef.current = signature;

    void (async () => {
      await handleStartNewProject(studioState.lastContentType);
      router.replace(basePath, { scroll: false });
    })();
  }, [searchParams, studioState, handleStartNewProject, router, basePath]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (!generatedData.length) return;
    if (!storageReady) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      await updateProject(currentProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
        workflowDraft: studioState?.workflowDraft || null,
      });
      await refreshProjects();
      setProgressMessage('현재 프로젝트 변경사항을 자동 저장했습니다.');
    }, 500);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [currentProjectId, generatedData, backgroundMusicTracks, previewMix, studioState?.workflowDraft, refreshProjects, storageReady]);

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    await refreshProjects();
  };

  const handleLoadProject = useCallback((project: SavedProject) => {
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    pendingWorkflowDraftRef.current = null;

    const safeAssets = normalizeLoadedAssets(Array.isArray(project.assets) ? project.assets : []);
    setGeneratedData([...safeAssets]);
    setCurrentTopic(project.topic || project.name || '불러온 프로젝트');
    setCurrentProjectId(project.id);
    setBackgroundMusicTracks(project.backgroundMusicTracks || []);
    setPreviewMix(project.previewMix || getDefaultPreviewMix());
    setCurrentCost(project.cost || null);
    setStep(GenerationStep.COMPLETED);
    setProgressMessage(`"${project.name}" 프로젝트를 불러왔습니다.`);
    setViewMode('main');

    if (project.workflowDraft) {
      const nextState = {
        ...(studioStateRef.current || createDefaultStudioState()),
        workflowDraft: project.workflowDraft,
        lastContentType: project.workflowDraft.contentType || studioStateRef.current?.lastContentType || 'story',
        updatedAt: Date.now(),
      };
      setStudioState(nextState);
      pendingWorkflowDraftRef.current = project.workflowDraft;
      if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
      workflowDraftSaveTimerRef.current = window.setTimeout(() => {
        void commitPendingWorkflowDraft();
      }, 250);
    }
  }, [commitPendingWorkflowDraft]);

  useEffect(() => {
    const projectId = searchParams?.get('projectId') || '';
    const returnTo = searchParams?.get('returnTo') || '';
    if (!projectId || viewMode !== 'main') return;
    const signature = `${basePath}:${projectId}:${returnTo}`;
    if (queryProjectHandledRef.current === signature) return;
    queryProjectHandledRef.current = signature;

    void (async () => {
      const project = await getProjectById(projectId, { forceSync: true });
      if (!project) return;
      handleLoadProject(project);
      if (returnTo === 'workflow') {
        setProgressMessage('씬 제작 화면에서 돌아온 프로젝트를 다시 불러왔습니다. 프롬프트와 화풍을 수정한 뒤 Step 4에서 다시 씬 제작으로 이동할 수 있습니다.');
      }
      router.replace(basePath, { scroll: false });
    })();
  }, [searchParams, viewMode, basePath, router, handleLoadProject]);


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
    setShowStartupWizard(!nextState.isStorageConfigured || !nextState.storageDir?.trim());
  };

  const handleQuickRoutingUpdate = async (patch: Partial<StudioState['routing']>) => {
    const currentState = studioStateRef.current;
    if (!currentState) return;
    const nextState = await saveStudioState({
      ...currentState,
      routing: {
        ...currentState.routing,
        ...patch,
      },
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
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
    const draftSignature = JSON.stringify({
      id: nextDraft.id,
      contentType: nextDraft.contentType,
      aspectRatio: nextDraft.aspectRatio,
      topic: nextDraft.topic,
      activeStage: nextDraft.activeStage,
      updatedAt: draftPatch.updatedAt,
      selectedCharacterIds: nextDraft.selectedCharacterIds,
      selectedStyleImageId: nextDraft.selectedStyleImageId,
      script: nextDraft.script,
      completedSteps: nextDraft.completedSteps,
      extractedCharacters: nextDraft.extractedCharacters,
      styleImages: nextDraft.styleImages,
      promptTemplates: nextDraft.promptTemplates,
      selectedPromptTemplateId: nextDraft.selectedPromptTemplateId,
    });

    if (lastWorkflowDraftSignatureRef.current === draftSignature) return;
    lastWorkflowDraftSignatureRef.current = draftSignature;

    pendingWorkflowDraftRef.current = nextDraft;
    setStudioState((prev) => (prev ? {
      ...prev,
      workflowDraft: nextDraft,
      lastContentType: nextDraft.contentType || prev.lastContentType || 'story',
    } : prev));

    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    workflowDraftSaveTimerRef.current = window.setTimeout(() => {
      void commitPendingWorkflowDraft();
    }, 900);
  };

  const handleOpenSceneStudio = useCallback(async (draftPatch: Partial<WorkflowDraft>) => {
    const currentState = studioStateRef.current || createDefaultStudioState();
    if (!currentState.isStorageConfigured || !currentState.storageDir?.trim()) {
      promptStorageSelection('저장 폴더가 정해져야 프로젝트 번호 폴더와 씬 파일을 만들 수 있습니다. 먼저 저장 폴더를 선택해 주세요.');
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
      const nextState = await saveStudioState({
        ...currentState,
        workflowDraft: nextDraft,
        lastContentType: nextDraft.contentType || currentState.lastContentType || 'story',
        updatedAt: Date.now(),
      });
      setStudioState(nextState);

      const initialSceneAssets = nextDraft.script?.trim()
        ? createInitialSceneAssetsFromDraft(nextDraft)
        : generatedData;

      const nextBackgroundTracks = backgroundMusicTracks.length ? backgroundMusicTracks : [createSampleBackgroundTrack(nextDraft)];
      const nextPreviewMix = previewMix || getDefaultPreviewMix();

      const project = await upsertWorkflowProject({
        projectId: currentProjectId,
        topic: nextDraft.topic || '새 프로젝트',
        workflowDraft: nextDraft,
        assets: initialSceneAssets,
        cost: currentCost || undefined,
        backgroundMusicTracks: nextBackgroundTracks,
        previewMix: nextPreviewMix,
      });

      setGeneratedData(normalizeLoadedAssets(initialSceneAssets));
      setBackgroundMusicTracks(nextBackgroundTracks);
      setPreviewMix(nextPreviewMix);
      setProgressMessage('문단별 씬 카드와 신규 배경음을 먼저 준비했습니다. 씬 제작 화면에서는 생성 버튼을 누를 때만 실제 AI 작업이 시작됩니다.');

      setCurrentProjectId(project.id);
      await refreshProjects();
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
      router.push(`${basePath}/scene-studio?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
    } catch (error) {
      console.error('[mp4Creater] scene studio open failed', error);
      setNavigationOverlay(null);
      setProgressMessage('씬 제작 페이지를 여는 중 문제가 생겼습니다. 입력값을 다시 확인해 주세요.');
    }
  }, [backgroundMusicTracks, basePath, currentCost, currentProjectId, generatedData, previewMix, promptStorageSelection, refreshProjects, router]);

  const handleNarrationChange = (index: number, narration: string) => {
    setGeneratedData((prev) => prev.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      narration,
      targetDuration: Math.max(item.targetDuration || 0, estimateClipDuration(narration)),
    } : item));
  };

  const handleDurationChange = (index: number, duration: number) => {
    setGeneratedData((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, targetDuration: duration } : item));
  };

  if (!studioState) {
    return <StudioPageSkeleton title="워크플로우를 불러오는 중" description="Step 1부터 Step 4까지 저장된 상태를 먼저 정리하고 있습니다." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LoadingOverlay open={Boolean(navigationOverlay)} title={navigationOverlay?.title || '이동 중'} description={navigationOverlay?.description} />
      <Header
        projectCount={savedProjects.length}
        selectedCharacterName={selectedCharacterName}
        storageDir={studioState?.storageDir}
        onOpenSettings={() => setShowSettings(true)}
        onGoMain={() => { router.push(`${basePath}?new=${Date.now()}`, { scroll: false }); }}
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
          onBack={() => { router.push(basePath, { scroll: false }); }}
          onDelete={handleDeleteProject}
          onRefresh={refreshProjects}
          onLoad={handleLoadProject}
          basePath={basePath}
        />
      )}

      {viewMode === 'main' && (
        <main className="py-8">
          {!storageReady && (
            <div className="mx-auto mb-6 max-w-6xl px-4">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">저장 폴더 필요</div>
                    <p className="mt-1 text-sm font-semibold text-amber-900">프로젝트 폴더를 정해야 번호별 프로젝트 폴더와 이미지·영상·프롬프트 파일이 함께 저장됩니다.</p>
                  </div>
                  <button type="button" onClick={() => setShowStartupWizard(true)} className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white hover:bg-amber-500">폴더 선택하기</button>
                </div>
              </div>
            </div>
          )}
          <InputSection
            step={step}
            studioState={studioState}
            workflowDraft={effectiveWorkflowDraft}
            basePath={basePath}
            onOpenSettings={() => setShowSettings(true)}
            onOpenApiModal={(options) => openApiModal({ title: options?.title || 'API 키 빠른 등록', description: options?.description || '텍스트, 오디오, 영상 공급자 키를 빠르게 등록할 수 있습니다.', focusField: options?.focusField || null })}
            onUpdateRouting={handleQuickRoutingUpdate}
            onSaveWorkflowDraft={handleSaveWorkflowDraft}
            onOpenSceneStudio={handleOpenSceneStudio}
          />

          {progressMessage && (
            <div className="mx-auto mb-6 max-w-6xl px-4 text-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <div className={`h-2.5 w-2.5 rounded-full ${step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-sm font-bold text-slate-700">{progressMessage}</span>
              </div>
            </div>
          )}

          {generatedData.length > 0 && (
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
