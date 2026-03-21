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
import { createInitialSceneAssetsFromDraft } from './services/sceneAssemblyService';
import { createSampleBackgroundTrack, getDefaultPreviewMix } from './services/musicService';
import { createDefaultWorkflowDraft, ensureWorkflowDraft } from './services/workflowDraftService';
import { CONFIG } from './config';
import { rememberProjectNavigationProject } from './services/projectNavigationCache';

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

const resolveBasePath = (pathname?: string | null) => {
  const fallback = '/mp4Creater';
  const value = pathname || fallback;
  const markerIndex = value.indexOf('/mp4Creater');
  if (markerIndex < 0) return value;
  return value.slice(0, markerIndex + '/mp4Creater'.length);
};

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
  const autosaveTimerRef = useRef<number | null>(null);
  const projectDraftSyncTimerRef = useRef<number | null>(null);
  const lastWorkflowDraftSignatureRef = useRef('');

  const storageReady = Boolean(studioState?.isStorageConfigured && studioState?.storageDir?.trim());

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
    if (workflowDraftSaveTimerRef.current) window.clearTimeout(workflowDraftSaveTimerRef.current);
    pendingWorkflowDraftRef.current = null;

    const shouldUseOverlay = Boolean(navigateToStep1 && viewMode !== 'gallery');
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
      const nextDraft = createDefaultWorkflowDraft(forceType || 'story');
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

      setStudioState(pendingStateForSave);
      setGeneratedData([]);
      setCurrentTopic('');
      setCurrentProjectId(null);
      setBackgroundMusicTracks([]);
      setPreviewMix(nextPreviewMix);
      setCurrentCost(null);
      setStep(GenerationStep.IDLE);
      if (!navigateToStep1) {
        setViewMode('main');
      }

      const saveStatePromise = saveStudioState(pendingStateForSave)
        .then((nextState) => {
          setStudioState(nextState);
        })
        .catch((error) => {
          console.warn('[mp4Creater] initial studio state save failed', error);
        });

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

      void saveStatePromise;
      setCurrentProjectId(project.id);
      rememberProjectNavigationProject(project);
      applyProjectListSnapshot([project!, ...savedProjects.filter((item) => item.id !== project!.id)]);

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
  }, [basePath, ensureRuntimeStorageReady, refreshProjects, router, studioState, viewMode]);

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
        const shouldShowWizardFromCache = !cachedState.isStorageConfigured || !cachedState.storageDir?.trim();
        setShowStartupWizard(shouldShowWizardFromCache);
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
          const shouldShowWizard = !state.isStorageConfigured || !state.storageDir?.trim();
          setShowStartupWizard(shouldShowWizard);
        } catch {
          const fallback = await ensureRuntimeStorageReady(createDefaultStudioState());
          if (cancelled) return;
          setStudioState(fallback);
          setShowStartupWizard(!fallback.isStorageConfigured || !fallback.storageDir?.trim());
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
    if (!storageReady) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      const updated = await updateProject(currentProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
        workflowDraft: studioState?.workflowDraft || null,
      });
      if (updated) {
        applyProjectListSnapshot([updated, ...savedProjects.filter((item) => item.id !== updated.id)]);
      }
    }, 500);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [currentProjectId, generatedData, backgroundMusicTracks, previewMix, studioState?.workflowDraft, savedProjects, storageReady]);

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
    setGeneratedData([...safeAssets]);
    setCurrentTopic(project.topic || project.name || '불러온 프로젝트');
    setCurrentProjectId(project.id);
    setBackgroundMusicTracks(project.backgroundMusicTracks || []);
    setPreviewMix(project.previewMix || getDefaultPreviewMix());
    setCurrentCost(project.cost || null);
    setStep(GenerationStep.COMPLETED);

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
      }, 180);
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
      const project = (await getProjectById(projectId, { localOnly: true }))
        || (await getProjectById(projectId, { forceSync: true }));
      if (!project) return;
      handleLoadProject(project);
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
  }, [searchParams, viewMode, basePath, router, handleLoadProject, routeStep, resolveDraftStep, pathname]);


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
    }, 180);

    if (currentProjectId && storageReady) {
      if (projectDraftSyncTimerRef.current) window.clearTimeout(projectDraftSyncTimerRef.current);
      projectDraftSyncTimerRef.current = window.setTimeout(() => {
        void updateProject(currentProjectId, {
          workflowDraft: nextDraft,
          topic: nextDraft.topic || currentTopic || '새 프로젝트',
        });
      }, 180);
    }
  };

  const handleOpenSceneStudio = useCallback(async (draftPatch: Partial<WorkflowDraft>) => {
    const currentState = await ensureRuntimeStorageReady(studioStateRef.current || createDefaultStudioState());
    if (!currentState.isStorageConfigured || !currentState.storageDir?.trim()) {
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
      const saveStatePromise = saveStudioState({
        ...currentState,
        workflowDraft: nextDraft,
        lastContentType: nextDraft.contentType || currentState.lastContentType || 'story',
        updatedAt: Date.now(),
      })
        .then((nextState) => {
          setStudioState(nextState);
          return nextState;
        })
        .catch((error) => {
          console.warn('[mp4Creater] scene studio state save failed', error);
          return null;
        });

      const initialSceneAssets = nextDraft.script?.trim()
        ? createEmptySceneAssetsFromDraft(nextDraft)
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

      setCurrentProjectId(project.id);
      rememberProjectNavigationProject(project);
      void saveStatePromise;
      void refreshProjects({ silent: true });
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
      router.push(`${basePath}/step-6?projectId=${encodeURIComponent(project.id)}`, { scroll: true });
    } catch (error) {
      console.error('[mp4Creater] scene studio open failed', error);
      setNavigationOverlay(null);
      setProgressMessage('씬 제작 페이지를 여는 중 문제가 생겼습니다. 입력값을 다시 확인해 주세요.');
    }
  }, [backgroundMusicTracks, basePath, currentCost, currentProjectId, ensureRuntimeStorageReady, generatedData, previewMix, promptStorageSelection, refreshProjects, router]);

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

  return (
    <div className={`${viewMode === 'gallery' ? 'min-h-0' : 'min-h-screen'} bg-slate-50 text-slate-900`}>
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
        />
      )}

      {viewMode === 'main' && (
        <main className="py-8">
          {!storageReady && !shouldAutoConfigureLocalStorage(studioState) && (
            <div className="mx-auto mb-6 max-w-6xl px-4">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
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
          <InputSection
            step={step}
            studioState={studioState}
            workflowDraft={effectiveWorkflowDraft}
            basePath={basePath}
            routeStep={routeStep}
            onNavigateStep={(nextStep) => {
              const currentDraft = pendingWorkflowDraftRef.current || studioStateRef.current?.workflowDraft || effectiveWorkflowDraft;
              if (pendingWorkflowDraftRef.current) {
                void commitPendingWorkflowDraft();
              }
              if (currentProjectId && storageReady && currentDraft) {
                void updateProject(currentProjectId, {
                  workflowDraft: currentDraft,
                  topic: currentDraft.topic || currentTopic || '???꾨줈?앺듃',
                });
              }
              const projectQuery = currentProjectId ? `?projectId=${encodeURIComponent(currentProjectId)}` : '';
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
