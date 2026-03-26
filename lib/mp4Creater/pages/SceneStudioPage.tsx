'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import ProviderQuickModal from '../components/ProviderQuickModal';
import { LoadingOverlay } from '../components/LoadingOverlay';
import {
  AspectRatio,
  BackgroundMusicPromptSections,
  BackgroundMusicSceneConfig,
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
  getContentTypeLabel,
} from '../types';
import { DEFAULT_STORAGE_DIR, createDefaultStudioState, fetchStudioState, saveStudioState, getCachedStudioState } from '../services/localFileApi';
import { createSelectedWorkflowDraftForTransport, ensureWorkflowDraft } from '../services/workflowDraftService';
import { buildBackgroundMusicPrompt, buildBackgroundMusicPromptSections, combineBackgroundMusicPromptSections, getDefaultPreviewMix, createSampleBackgroundTrack, sanitizeBackgroundMusicDuration } from '../services/musicService';
import { buildProjectSettingsSnapshot } from '../services/projectSettingsSnapshot';
import { generateImage, getSelectedImageModel, isSampleImageModel } from '../services/imageService';
import { buildThumbnailScene, createSampleThumbnail } from '../services/thumbnailService';
import { isFfmpegUnavailableError, renderVideoWithFfmpeg } from '../services/serverRenderService';
import { generateTtsAudio } from '../services/ttsService';
import { generateMotionPrompt, generateScript } from '../services/geminiService';
import { generateVideo, generateVideoStaticFallback } from '../services/videoService';
import { generateVideoFromImage, getFalApiKey } from '../services/falService';
import { getProjectById, getSavedProjects, updateProject, upsertWorkflowProject } from '../services/projectService';
import { buildDefaultSubtitlePreset, buildScenePlanItems, buildScriptParagraphPlans, buildTtsFileItems, inferGenerationMode, inferSceneSourceType, resolveAssetPlaybackDuration, sumSceneDuration, sumTtsDuration } from '../services/projectEnhancementService';
import { CHATTERBOX_TTS_PRESET_OPTIONS, CONFIG, ELEVENLABS_MODELS, IMAGE_MODELS, PRICING, QWEN_TTS_PRESET_OPTIONS, VIDEO_MODEL_OPTIONS } from '../config';
import { clearProjectNavigationProject, readProjectNavigationProject, rememberProjectNavigationProject } from '../services/projectNavigationCache';
import { estimateClipDuration, splitStoryIntoParagraphScenes } from '../utils/storyHelpers';
import {
  applySelectionPromptsToScenes as applyDraftSelectionPromptsToScenes,
  createAdditionalSceneAssetFromDraft,
  createInitialSceneAssetsFromDraft,
  createLightweightSceneAssetsFromDraft,
  createLocalScenesFromDraft,
} from '../services/sceneAssemblyService';
import { triggerBlobDownload } from '../utils/downloadHelpers';
import SceneStudioHeaderPanel from '../components/scene-studio/SceneStudioHeaderPanel';
import { buildWorkflowPromptStore, buildWorkflowStepContract } from '../services/workflowStepContractService';
import SceneStudioResultPanel from '../components/scene-studio/SceneStudioResultPanel';
import { buildSceneStudioSnapshotPayload, mergeSceneStudioSnapshotIntoProject, readSceneStudioSnapshot, writeSceneStudioSnapshot, type SceneStudioSnapshotPayload } from '../services/sceneStudioSnapshotCache';
import { hasDetailedSceneStudioProject } from './sceneStudio/helpers';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_SCENE_DURATION = 1;
const MAX_SCENE_DURATION = 6;
const MAX_GENERATION_QUEUE = 4;
const clampSceneDuration = (value?: number | null) => Math.min(MAX_SCENE_DURATION, Math.max(0, Number((value || 0).toFixed(1))));

function hasDetailedSceneStudioWorkflowDraft(draft?: WorkflowDraft | null) {
  if (!draft) return false;
  return Boolean(
    (draft.script || '').trim()
    || (Array.isArray(draft.extractedCharacters) && draft.extractedCharacters.length)
    || (Array.isArray(draft.styleImages) && draft.styleImages.length)
    || (Array.isArray(draft.selectedCharacterIds) && draft.selectedCharacterIds.length)
    || draft.selectedStyleImageId
    || (draft.promptStore && Object.keys(draft.promptStore).length)
    || (draft.stepContract && Object.keys(draft.stepContract).length),
  );
}

function createSceneStudioSnapshotFallbackProject(
  projectId: string,
  snapshot?: SceneStudioSnapshotPayload | null,
  fallback?: SavedProject | null,
): SavedProject | null {
  if (!snapshot || snapshot.projectId !== projectId) return fallback || null;
  const hasSnapshotPayload = Boolean(
    (Array.isArray(snapshot.assets) && snapshot.assets.length)
    || (Array.isArray(snapshot.backgroundMusicTracks) && snapshot.backgroundMusicTracks.length)
    || hasDetailedSceneStudioWorkflowDraft(snapshot.workflowDraft),
  );
  if (!hasSnapshotPayload && !fallback) return null;

  const baseName = fallback?.name || fallback?.topic || snapshot.workflowDraft?.topic || '프로젝트';
  const defaultSettings: SavedProject['settings'] = fallback?.settings || {
    imageModel: CONFIG.DEFAULT_IMAGE_MODEL,
    videoModel: CONFIG.DEFAULT_VIDEO_MODEL,
    scriptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    sceneModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    outputMode: snapshot.workflowDraft?.outputMode || 'video',
    elevenLabsModel: CONFIG.DEFAULT_ELEVENLABS_MODEL,
    imageProvider: 'sample',
    videoProvider: 'sample',
    ttsProvider: 'qwen3Tts',
    audioProvider: 'qwen3Tts',
    qwenVoicePreset: 'qwen-default',
    chatterboxVoicePreset: 'chatterbox-clear',
    elevenLabsVoiceId: null,
    heygenVoiceId: null,
    backgroundMusicProvider: 'sample',
    backgroundMusicModel: CONFIG.DEFAULT_BGM_MODEL,
    musicVideoProvider: 'sample',
    musicVideoMode: 'sample',
  };

  return {
    ...(fallback || {}),
    id: projectId,
    name: baseName,
    createdAt: fallback?.createdAt || snapshot.savedAt || Date.now(),
    topic: fallback?.topic || baseName,
    lastSavedAt: Math.max(fallback?.lastSavedAt || 0, snapshot.savedAt || 0),
    settings: defaultSettings,
    assets: Array.isArray(snapshot.assets) && snapshot.assets.length
      ? snapshot.assets.map((asset) => ({ ...asset }))
      : (fallback?.assets || []),
    thumbnail: fallback?.thumbnail || null,
    thumbnailTitle: fallback?.thumbnailTitle || null,
    thumbnailPrompt: fallback?.thumbnailPrompt || null,
    thumbnailHistory: fallback?.thumbnailHistory || [],
    selectedThumbnailId: fallback?.selectedThumbnailId || null,
    cost: snapshot.cost || fallback?.cost,
    backgroundMusicTracks: Array.isArray(snapshot.backgroundMusicTracks) && snapshot.backgroundMusicTracks.length
      ? snapshot.backgroundMusicTracks.map((track) => ({ ...track }))
      : (fallback?.backgroundMusicTracks || []),
    activeBackgroundTrackId: snapshot.activeBackgroundTrackId ?? fallback?.activeBackgroundTrackId ?? null,
    previewMix: snapshot.previewMix || fallback?.previewMix,
    workflowDraft: snapshot.workflowDraft || fallback?.workflowDraft || null,
    sceneStudioPreviewVideo: fallback?.sceneStudioPreviewVideo || null,
    sceneStudioPreviewStatus: fallback?.sceneStudioPreviewStatus || null,
    sceneStudioPreviewMessage: fallback?.sceneStudioPreviewMessage || null,
    script: fallback?.script ?? snapshot.workflowDraft?.script ?? null,
    scriptParagraphs: fallback?.scriptParagraphs || [],
    sceneList: fallback?.sceneList || [],
    sceneDuration: fallback?.sceneDuration ?? null,
    ttsFiles: fallback?.ttsFiles || [],
    ttsDuration: fallback?.ttsDuration ?? null,
    encodingMode: fallback?.encodingMode || 'browser',
  };
}

function pickLatestSceneStudioProject(...projects: Array<SavedProject | null | undefined>) {
  const candidates = projects.filter(Boolean) as SavedProject[];
  if (!candidates.length) return null;
  return candidates.reduce<SavedProject | null>((best, candidate) => {
    if (!best) return candidate;
    const bestSavedAt = best.lastSavedAt || 0;
    const candidateSavedAt = candidate.lastSavedAt || 0;
    if (candidateSavedAt !== bestSavedAt) {
      return candidateSavedAt > bestSavedAt ? candidate : best;
    }
    const bestDetailed = hasDetailedSceneStudioProject(best);
    const candidateDetailed = hasDetailedSceneStudioProject(candidate);
    if (candidateDetailed !== bestDetailed) {
      return candidateDetailed ? candidate : best;
    }
    const bestAssetCount = Array.isArray(best.assets) ? best.assets.length : 0;
    const candidateAssetCount = Array.isArray(candidate.assets) ? candidate.assets.length : 0;
    return candidateAssetCount > bestAssetCount ? candidate : best;
  }, null);
}

function readMergedSceneStudioProject(projectId: string) {
  if (!projectId) return null;
  const navigationProject = readProjectNavigationProject(projectId);
  const snapshot = readSceneStudioSnapshot(projectId);
  if (!navigationProject) {
    return createSceneStudioSnapshotFallbackProject(projectId, snapshot);
  }
  return mergeSceneStudioSnapshotIntoProject(
    navigationProject,
    snapshot,
  );
}

function resolveScenePlaybackDuration(asset?: Pick<GeneratedAsset, 'audioDuration' | 'targetDuration' | 'videoDuration' | 'narration'> | null) {
  return resolveAssetPlaybackDuration(asset, { minimum: DEFAULT_SCENE_DURATION, fallbackNarrationEstimate: true, preferTargetDuration: true });
}

function revokePreviewVideoUrl(value?: string | null) {
  if (value && value.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(value);
    } catch {}
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('preview-video-data-url-failed'));
    reader.onerror = () => reject(reader.error || new Error('preview-video-data-url-failed'));
    reader.readAsDataURL(blob);
  });
}

async function measureRenderedVideoDuration(blob: Blob): Promise<number | null> {
  if (typeof window === 'undefined' || !blob.size) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const video = document.createElement('video');
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => finish(null), 5000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      finish(Number.isFinite(duration) && duration > 0.1 ? Number(duration.toFixed(2)) : null);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}

function resolveStep2VideoDurationSeconds(draft: WorkflowDraft) {
  const durationMinutes = Number(draft.stepContract?.step2?.videoDuration || draft.customScriptSettings?.expectedDurationMinutes || 0);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 20;
  return Math.max(10, Math.round(durationMinutes * 60));
}

function resolveCurrentVideoDurationSeconds(draft: WorkflowDraft, assets: GeneratedAsset[] = []) {
  const assetTotal = Number(assets.reduce((sum, asset) => sum + resolveAssetPlaybackDuration(asset, { fallbackNarrationEstimate: true, preferTargetDuration: true }), 0).toFixed(1));
  if (assetTotal > 0) return Math.max(10, Math.round(assetTotal));
  return resolveStep2VideoDurationSeconds(draft);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBackgroundTrackTitleBase(value?: string | null) {
  return (value || '프로젝트').replace(/\s*\(\d+\)\s*$/u, '').trim() || '프로젝트';
}

function buildNextBackgroundTrackTitle(baseTitle: string, tracks: BackgroundMusicTrack[] = []) {
  const normalizedBase = normalizeBackgroundTrackTitleBase(baseTitle);
  const matcher = new RegExp(`^${escapeRegExp(normalizedBase)}\\s*\\((\\d+)\\)$`, 'u');
  const maxVersion = tracks.reduce((max, track) => {
    const match = (track.title || '').match(matcher);
    if (!match) return max;
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 0);
  return `${normalizedBase} (${maxVersion + 1})`;
}

function hasDialogueCue(narration: string) {
  const normalized = narration.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return /["“”'‘’「」『』]|[:：]|\b(dialogue|speaks|says|asks|replies|whispers|shouts)\b|말하|묻|답하|대답|속삭|외치|소리치|대화/u.test(normalized);
}

function buildDialogueStartMotionGuide(narration: string) {
  if (!hasDialogueCue(narration)) return '';
  return 'When spoken dialogue begins, open with a brief reaction or establishing micro-beat and then land on the speaker exactly as the first line starts. Keep the transition motivated by the conversation timing and preserve clean eyeline continuity.';
}

function buildLipSyncDirection(contentType: WorkflowDraft['contentType'], narration: string) {
  const trimmedNarration = narration.replace(/\s+/g, ' ').trim();
  if (!trimmedNarration) return '';
  if (contentType === 'music_video') {
    return `Visible performers must sing with precise lip sync to the current vocal or lyric timing. Mouth shapes, consonant hits, and vowel openings should clearly follow this sung line: ${trimmedNarration.slice(0, 180)}.`;
  }
  return `If a character is speaking on screen, keep mouth shapes and facial articulation tightly synced to the narration and spoken timing of this script line: ${trimmedNarration.slice(0, 180)}.`;
}

function buildDefaultBackgroundMusicSceneConfig(draft: WorkflowDraft): BackgroundMusicSceneConfig {
  const defaultDurationSeconds = resolveStep2VideoDurationSeconds(draft);
  const promptSections = buildBackgroundMusicPromptSections(draft);
  return {
    enabled: false,
    prompt: combineBackgroundMusicPromptSections(promptSections, defaultDurationSeconds),
    provider: 'sample',
    modelId: CONFIG.DEFAULT_BGM_MODEL,
    title: draft.topic?.trim() ? `${draft.topic.trim()} 배경음` : '프로젝트 배경음',
    durationSeconds: defaultDurationSeconds,
    promptSections,
    selectedTrackId: null,
  };
}

function resolveBackgroundMusicSceneConfig(draft: WorkflowDraft): BackgroundMusicSceneConfig {
  const base = buildDefaultBackgroundMusicSceneConfig(draft);
  const promptSections = buildBackgroundMusicPromptSections(draft, draft.backgroundMusicScene?.promptSections || base.promptSections);
  const durationSeconds = sanitizeBackgroundMusicDuration(draft.backgroundMusicScene?.durationSeconds, base.durationSeconds || 20);
  return {
    enabled: Boolean(draft.backgroundMusicScene?.enabled),
    prompt: draft.backgroundMusicScene?.prompt?.trim() || combineBackgroundMusicPromptSections(promptSections, durationSeconds),
    provider: draft.backgroundMusicScene?.provider === 'google' ? 'google' : base.provider,
    modelId: draft.backgroundMusicScene?.modelId || base.modelId,
    title: draft.backgroundMusicScene?.title?.trim() || base.title,
    durationSeconds,
    promptSections,
    selectedTrackId: typeof draft.backgroundMusicScene?.selectedTrackId === 'string' ? draft.backgroundMusicScene.selectedTrackId : null,
  };
}

function stringifySummaryJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ error: 'JSON stringify failed' }, null, 2);
  }
}

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
    imagePrompt: aiScenes[index]?.imagePrompt || aiScenes[index]?.visualPrompt || scene.imagePrompt || scene.visualPrompt,
    videoPrompt: aiScenes[index]?.videoPrompt || scene.videoPrompt || '',
    analysis: aiScenes[index]?.analysis || scene.analysis,
  }));
}

function createEmptySceneAssetsFromDraft(
  draft: WorkflowDraft,
  startSceneNumber = 1,
  count = 1,
): GeneratedAsset[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const sceneNumber = startSceneNumber + index;
    const base = createAdditionalSceneAssetFromDraft(draft, sceneNumber);
    return {
      ...base,
      sceneNumber,
      narration: '',
      visualPrompt: '',
      imagePrompt: '',
      videoPrompt: '',
      status: 'pending',
    };
  });
}

function shouldBootstrapEmptyScene(draft: WorkflowDraft) {
  if ((draft.script || '').trim()) return false;
  return Boolean(
    (draft.activeStage || 0) >= 5
      || draft.completedSteps?.step3
      || draft.completedSteps?.step4
      || draft.completedSteps?.step5
      || draft.selectedCharacterIds?.length
      || draft.selectedStyleImageId
      || draft.styleImages?.length
  );
}

function createBootstrapStudioState(projectId: string): StudioState {
  const cachedState = getCachedStudioState();
  const cachedProject = projectId ? readMergedSceneStudioProject(projectId) : null;
  const snapshot = projectId ? readSceneStudioSnapshot(projectId) : null;
  const cachedDraft = snapshot?.workflowDraft || cachedProject?.workflowDraft || null;

  if (cachedDraft) {
    return {
      ...(cachedState || createDefaultStudioState()),
      workflowDraft: cachedDraft,
      projects: cachedProject ? [cachedProject, ...((cachedState?.projects || []).filter((item) => item.id !== cachedProject.id))] : (cachedState?.projects || []),
      lastContentType: cachedDraft.contentType || cachedState?.lastContentType || 'story',
      storageDir: cachedState?.storageDir || DEFAULT_STORAGE_DIR,
      isStorageConfigured: Boolean((cachedState?.storageDir || DEFAULT_STORAGE_DIR).trim()),
      updatedAt: Date.now(),
    };
  }

  if (cachedState) return cachedState;
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
  const [finalVideoDuration, setFinalVideoDuration] = useState<number | null>(null);
  const [navigationOverlay, setNavigationOverlay] = useState<{ title: string; description: string } | null>(null);
  const [isThumbnailGenerating, setIsThumbnailGenerating] = useState(false);
  const [isGeneratingAllVideos, setIsGeneratingAllVideos] = useState(false);
  const [isPreparingPreviewVideo, setIsPreparingPreviewVideo] = useState(false);
  const [previewVideoStatus, setPreviewVideoStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback' | 'error'>('idle');
  const [previewVideoMessage, setPreviewVideoMessage] = useState('결과보기에서 합본 영상 상태를 먼저 안내합니다.');
  const [taskProgressPercent, setTaskProgressPercent] = useState<number | null>(null);
  const [sceneProgressMap, setSceneProgressMap] = useState<Record<number, { percent: number; label: string }>>({});
  const [queuedGenerationCount, setQueuedGenerationCount] = useState(0);
  const [projectLookupTick, setProjectLookupTick] = useState(0);
  const [isProjectHydrating, setIsProjectHydrating] = useState(Boolean(requestedProjectId));
  const assetsRef = useRef<GeneratedAsset[]>([]);
  const studioStateRef = useRef<StudioState | null>(null);
  const isAbortedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const projectQueryHandledRef = useRef('');
  const projectQueryRetryTimerRef = useRef<number | null>(null);
  const projectLookupRetryCountRef = useRef(0);
  const currentCostRef = useRef<CostBreakdown>({ images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 });
  const autosaveSignatureRef = useRef('');
  const sceneStudioDirtyRef = useRef(false);
  const projectHydrationPendingRef = useRef(Boolean(requestedProjectId));
  const thumbnailToolbarRef = useRef<HTMLDivElement | null>(null);
  const sceneActionLocksRef = useRef<Record<string, boolean>>({});
  const generationQueueRef = useRef(Promise.resolve());
  const generationQueueSizeRef = useRef(0);
  const step6VisitSyncRef = useRef('');
  const finalPreviewPersistedRef = useRef(false);
  const previewRenderNonceRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    projectHydrationPendingRef.current = Boolean(requestedProjectId);
    projectLookupRetryCountRef.current = 0;
    setIsProjectHydrating(Boolean(requestedProjectId));

    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}

    const cachedState = getCachedStudioState();
    const cachedProject = requestedProjectId ? readMergedSceneStudioProject(requestedProjectId) : null;
    const bootstrapState = createBootstrapStudioState(requestedProjectId);

    if (cachedProject?.workflowDraft) {
      setStudioState(bootstrapState);
      setBackgroundMusicTracks(cachedProject.backgroundMusicTracks || []);
    } else if (cachedState) {
      setStudioState(cachedState);
      if (cachedState.workflowDraft) setBackgroundMusicTracks([]);
    }

    void (async () => {
      const state = await withSoftTimeout(fetchStudioState({ force: true }), 2500, cachedState || bootstrapState);
      if (cancelled) return;

      if (cachedProject?.workflowDraft) {
        setStudioState((prev) => ({
          ...(state || prev || createDefaultStudioState()),
          workflowDraft: cachedProject.workflowDraft,
          projects: cachedProject ? [cachedProject, ...(((state || prev || createDefaultStudioState()).projects || []).filter((item) => item.id !== cachedProject.id))] : ((state || prev || createDefaultStudioState()).projects || []),
          lastContentType: cachedProject.workflowDraft?.contentType || (state || prev || createDefaultStudioState()).lastContentType || 'story',
          storageDir: (state || prev || createDefaultStudioState()).storageDir || DEFAULT_STORAGE_DIR,
          isStorageConfigured: Boolean(((state || prev || createDefaultStudioState()).storageDir || DEFAULT_STORAGE_DIR).trim()),
          updatedAt: Date.now(),
        }));
        setBackgroundMusicTracks(cachedProject.backgroundMusicTracks || []);
        return;
      }

      setStudioState(state);
      if (state.workflowDraft) setBackgroundMusicTracks([]);
    })();

    return () => {
      cancelled = true;
      if (projectQueryRetryTimerRef.current) {
        window.clearTimeout(projectQueryRetryTimerRef.current);
        projectQueryRetryTimerRef.current = null;
      }
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
  const isMuteProject = draft.customScriptSettings?.language === 'mute';
  const backgroundMusicSceneConfig = useMemo(() => resolveBackgroundMusicSceneConfig(draft), [draft]);
  const workflowProgress = useMemo(() => {
    const completed = draft?.completedSteps || { step1: false, step2: false, step3: false, step4: false };
    const count = Object.values(completed).filter(Boolean).length;
    return {
      percent: Math.round((count / 4) * 100),
      text: `워크플로우 ${count}/4 단계 완료`,
    };
  }, [draft]);

  const currentProjectSummary = useMemo(() => (studioState?.projects || []).find((item) => item.id === currentProjectId) || null, [studioState?.projects, currentProjectId]);
  const resolvedProjectId = currentProjectId || requestedProjectId;
  const backgroundTrackBaseTitle = useMemo(
    () => currentProjectSummary?.name || draft.topic || '프로젝트',
    [currentProjectSummary?.name, draft.topic],
  );
  const resolveNextBackgroundTrackTitle = useCallback(
    (tracks: BackgroundMusicTrack[] = backgroundMusicTracks) => buildNextBackgroundTrackTitle(backgroundTrackBaseTitle, tracks),
    [backgroundMusicTracks, backgroundTrackBaseTitle],
  );
  const buildSceneMotionPrompt = useCallback(async (asset: GeneratedAsset) => {
    const basePrompt = (asset.videoPrompt || '').trim() || await generateMotionPrompt(asset.narration, asset.imagePrompt || asset.visualPrompt);
    const lipSyncDirection = buildLipSyncDirection(draft.contentType, asset.narration || '');
    const dialogueStartGuide = buildDialogueStartMotionGuide(asset.narration || '');
    return [basePrompt, lipSyncDirection, dialogueStartGuide].filter(Boolean).join(' ');
  }, [draft.contentType]);
  const summaryCharacterIds = useMemo(() => (
    draft.selectedCharacterIds.length ? draft.selectedCharacterIds : draft.extractedCharacters.map((item) => item.id)
  ), [draft.extractedCharacters, draft.selectedCharacterIds]);
  const summaryCharacters = useMemo(() => draft.extractedCharacters.filter((item) => summaryCharacterIds.includes(item.id)), [draft.extractedCharacters, summaryCharacterIds]);
  const summarySelectedStyle = useMemo(() => draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0] || null, [draft.selectedStyleImageId, draft.styleImages]);
  const summarySelectedPromptTemplate = useMemo(() => draft.promptTemplates.find((item) => item.id === draft.selectedPromptTemplateId) || draft.promptTemplates[0] || null, [draft.promptTemplates, draft.selectedPromptTemplateId]);
  const summarySceneCount = useMemo(() => {
    const scriptSceneCount = splitStoryIntoParagraphScenes(draft.script).length;
    if (scriptSceneCount) return scriptSceneCount;
    return createLightweightSceneAssetsFromDraft(draft).length;
  }, [draft]);
  const summarySections = useMemo(() => ([
    { id: 'step1' as const, label: '1단계 기본', description: '콘텐츠 유형과 화면 비율 등 시작 설정' },
    { id: 'step2' as const, label: '2단계 기획', description: '주제와 장르, 분위기, 배경 설정' },
    { id: 'step3' as const, label: '3단계 대본', description: '선택 프롬프트와 최종 대본, 참조 메모' },
    { id: 'step4' as const, label: '4단계 캐릭터', description: '선택 출연자와 캐릭터 프롬프트, 대표 이미지 기준' },
    { id: 'step5' as const, label: '5단계 화풍', description: '최종 영상용 화풍 카드와 프롬프트' },
    { id: 'step6' as const, label: '6단계 씬 전달', description: '씬 제작 화면으로 넘어온 최종 전달값' },
  ]), []);

  const summarySceneImagePrompt = useMemo(() => (
    currentProjectSummary?.prompts?.imagePrompt
    || generatedData.map((item) => item.imagePrompt || item.visualPrompt).filter(Boolean).join('\n\n')
    || null
  ), [currentProjectSummary?.prompts?.imagePrompt, generatedData]);

  const summarySceneVideoPrompt = useMemo(() => (
    currentProjectSummary?.prompts?.videoPrompt
    || generatedData.map((item) => item.videoPrompt).filter(Boolean).join('\n\n')
    || null
  ), [currentProjectSummary?.prompts?.videoPrompt, generatedData]);

  const summaryPromptTransfer = useMemo(() => ({
    selectedPromptTemplateName: summarySelectedPromptTemplate?.name || null,
    storyPrompt: draft.promptStore?.stepPrompts?.step3?.scriptPrompt || draft.promptPack?.storyPrompt || currentProjectSummary?.prompts?.scriptPrompt || null,
    scenePrompt: draft.promptStore?.stepPrompts?.step3?.scenePrompt || draft.promptPack?.scenePrompt || currentProjectSummary?.prompts?.scenePrompt || null,
    characterPrompt: draft.promptStore?.stepPrompts?.step4?.characterPrompt || draft.promptPack?.characterPrompt || null,
    actionPrompt: draft.promptStore?.stepPrompts?.step6?.finalActionPrompt || draft.promptPack?.actionPrompt || currentProjectSummary?.prompts?.motionPrompt || null,
    imagePromptBundle: draft.promptStore?.finalPrompts?.finalImagePrompt || summarySceneImagePrompt,
    videoPromptBundle: draft.promptStore?.finalPrompts?.finalVideoPrompt || summarySceneVideoPrompt,
  }), [
    currentProjectSummary?.prompts?.motionPrompt,
    currentProjectSummary?.prompts?.scenePrompt,
    currentProjectSummary?.prompts?.scriptPrompt,
    draft.promptPack?.actionPrompt,
    draft.promptPack?.characterPrompt,
    draft.promptPack?.scenePrompt,
    draft.promptPack?.storyPrompt,
    draft.promptStore?.finalPrompts?.finalImagePrompt,
    draft.promptStore?.finalPrompts?.finalVideoPrompt,
    draft.promptStore?.stepPrompts?.step3?.scenePrompt,
    draft.promptStore?.stepPrompts?.step3?.scriptPrompt,
    draft.promptStore?.stepPrompts?.step4?.characterPrompt,
    draft.promptStore?.stepPrompts?.step6?.finalActionPrompt,
    summarySceneImagePrompt,
    summarySceneVideoPrompt,
    summarySelectedPromptTemplate?.name,
  ]);

  const summaryJsonBySection = useMemo(() => {
    const selectedCharacters = summaryCharacters.map((character) => {
      const selectedImage = (character.generatedImages || []).find((item) => item.id === character.selectedImageId) || character.generatedImages?.[0] || null;
      const resolvedImageData = selectedImage?.imageData || character.imageData || '';
      return {
        id: character.id,
        name: character.name,
        role: character.role || null,
        roleLabel: character.roleLabel || null,
        prompt: character.prompt || character.description || null,
        selectedImageId: character.selectedImageId || selectedImage?.id || null,
        selectedImagePrompt: selectedImage?.prompt || null,
        generatedImageCount: (character.generatedImages || []).length,
        hasImageData: Boolean(resolvedImageData),
        selectedImageDataLength: resolvedImageData.length || 0,
      };
    });

    const selectedStyle = summarySelectedStyle ? {
      id: summarySelectedStyle.id,
      label: summarySelectedStyle.label,
      groupLabel: summarySelectedStyle.groupLabel || null,
      prompt: summarySelectedStyle.prompt || null,
      sourceMode: summarySelectedStyle.sourceMode,
      hasImageData: Boolean(summarySelectedStyle.imageData),
      imageDataLength: summarySelectedStyle.imageData?.length || 0,
    } : null;

    const selectedPromptTemplate = summarySelectedPromptTemplate ? {
      id: summarySelectedPromptTemplate.id,
      name: summarySelectedPromptTemplate.name,
      description: summarySelectedPromptTemplate.description || null,
      engine: summarySelectedPromptTemplate.engine || null,
      mode: summarySelectedPromptTemplate.mode || null,
      prompt: summarySelectedPromptTemplate.prompt || null,
    } : null;

    const projectPromptContext = {
      scriptPrompt: currentProjectSummary?.prompts?.scriptPrompt || draft.promptPack?.storyPrompt || null,
      scenePrompt: currentProjectSummary?.prompts?.scenePrompt || draft.promptPack?.scenePrompt || null,
      imagePrompt: currentProjectSummary?.prompts?.imagePrompt || summarySceneImagePrompt || null,
      videoPrompt: currentProjectSummary?.prompts?.videoPrompt || summarySceneVideoPrompt || null,
      motionPrompt: currentProjectSummary?.prompts?.motionPrompt || draft.promptPack?.actionPrompt || null,
      thumbnailPrompt: currentProjectSummary?.thumbnailPrompt || null,
    };
    const persistedPromptStore = draft.promptStore || buildWorkflowPromptStore({
      draft,
      assets: generatedData,
      projectPrompts: projectPromptContext,
    });
    const persistedStepContract = draft.stepContract || buildWorkflowStepContract({
      draft: { ...draft, promptStore: persistedPromptStore },
      assets: generatedData,
      generationMeta: draft.scriptGenerationMeta || null,
      projectPrompts: projectPromptContext,
    });

    const transportDraft = createSelectedWorkflowDraftForTransport(draft);
    const sceneAssets = generatedData.map((asset, index) => {
      const rawAudioData = asset.audioData || '';
      const normalizedAudioPayload = rawAudioData.startsWith('data:') ? (rawAudioData.split(',')[1] || '') : rawAudioData;
      return {
        index,
        sceneNumber: asset.sceneNumber,
        dialogue: asset.narration || '',
        dialogueLength: (asset.narration || '').length,
        imagePrompt: asset.imagePrompt || asset.visualPrompt || '',
        videoPrompt: asset.videoPrompt || '',
        selectedVisualType: asset.selectedVisualType || (asset.videoData ? 'video' : 'image'),
        aspectRatio: asset.aspectRatio || draft.aspectRatio || '16:9',
        targetDuration: asset.targetDuration || null,
        audio: {
          hasAudio: Boolean(asset.audioData),
          mime: rawAudioData.startsWith('data:audio/wav')
            ? 'audio/wav'
            : rawAudioData.startsWith('data:audio/mpeg')
              ? 'audio/mpeg'
              : rawAudioData
                ? 'inline-or-url'
                : null,
          payloadLength: normalizedAudioPayload.length,
          duration: asset.audioDuration || null,
        },
        subtitle: {
          hasSubtitle: Boolean(asset.subtitleData?.fullText),
          segmentCount: Array.isArray(asset.subtitleData?.meaningChunks) ? asset.subtitleData?.meaningChunks.length : Array.isArray(asset.subtitleData?.words) ? asset.subtitleData.words.length : 0,
          fullTextLength: asset.subtitleData?.fullText?.length || 0,
        },
        image: {
          hasImage: Boolean(asset.imageData),
          historyCount: Array.isArray(asset.imageHistory) ? asset.imageHistory.length : 0,
          sourceMode: asset.sourceMode || null,
        },
        video: {
          hasVideo: Boolean(asset.videoData),
          historyCount: Array.isArray(asset.videoHistory) ? asset.videoHistory.length : 0,
          duration: asset.videoDuration || null,
        },
        status: asset.status,
      };
    });

    const exportSnapshot = {
      workflowSelection: transportDraft ? {
        selectedCharacterIds: transportDraft.selectedCharacterIds,
        selectedCharacterStyleId: transportDraft.selectedCharacterStyleId || null,
        selectedStyleImageId: transportDraft.selectedStyleImageId || null,
        promptTemplateId: transportDraft.selectedPromptTemplateId || null,
      } : null,
      selectedCharacters: transportDraft?.extractedCharacters?.map((character) => ({
        id: character.id,
        name: character.name,
        selectedImageId: character.selectedImageId || null,
        generatedImageCount: Array.isArray(character.generatedImages) ? character.generatedImages.length : 0,
      })) || [],
      selectedStyles: transportDraft?.styleImages?.map((style) => ({
        id: style.id,
        label: style.groupLabel || style.label,
        sourceMode: style.sourceMode,
      })) || [],
      sceneAssets,
    };

    const step1 = {
      contentType: draft.contentType,
      _comment_contentType: 'Step1에서 선택한 콘텐츠 유형',
      contentTypeLabel: getContentTypeLabel(draft.contentType),
      aspectRatio: draft.aspectRatio,
      _comment_aspectRatio: 'Step1에서 선택한 화면 비율',
      conceptPrompt: persistedStepContract.step1.conceptPrompt,
      _comment_conceptPrompt: 'Step1 콘셉트 잠금 프롬프트',
      charsPerMinute: persistedStepContract.step1.charsPerMinute,
      _comment_charsPerMinute: '콘셉트별 1분당 권장 글자수 기준',
      hasSelectedContentType: Boolean(draft.hasSelectedContentType),
      hasSelectedAspectRatio: Boolean(draft.hasSelectedAspectRatio),
      promptStore: persistedPromptStore.stepPrompts.step1,
      completed: Boolean(draft.completedSteps?.step1),
    };

    const step2 = {
      topic: draft.topic || '',
      _comment_topic: 'Step2에서 정한 프로젝트 주제',
      selections: {
        genre: draft.selections?.genre || '',
        mood: draft.selections?.mood || '',
        endingTone: draft.selections?.endingTone || '',
        setting: draft.selections?.setting || '',
        protagonist: draft.selections?.protagonist || '',
        conflict: draft.selections?.conflict || '',
      },
      _comment_selections: 'Step2에서 고른 장르, 분위기, 배경, 주인공, 갈등 값',
      customScriptSettings: {
        expectedDurationMinutes: draft.customScriptSettings?.expectedDurationMinutes || 3,
        speechStyle: draft.customScriptSettings?.speechStyle || 'default',
        language: draft.customScriptSettings?.language || 'ko',
      },
      contract: persistedStepContract.step2,
      _comment_contract: 'Step2에서 Step3/6으로 전달할 명시적 계약 데이터',
      promptStore: persistedPromptStore.stepPrompts.step2,
      completed: Boolean(draft.completedSteps?.step2),
    };

    const step3 = {
      selectedPromptTemplate,
      _comment_selectedPromptTemplate: 'Step3에서 선택한 프롬프트 카드',
      promptPack: draft.promptPack || null,
      _comment_promptPack: '대본/씬/캐릭터/액션 생성에 쓰는 프롬프트 묶음',
      script: draft.script || '',
      _comment_script: 'Step3 최종 대본',
      sceneCount: summarySceneCount,
      customScriptSettings: {
        referenceText: draft.customScriptSettings?.referenceText || '',
        referenceLinks: draft.customScriptSettings?.referenceLinks || [],
      },
      contract: persistedStepContract.step3,
      _comment_contract: 'Step3 최종 대본/이미지 프롬프트/영상 프롬프트/출연자 전달 계약',
      scriptGenerationMeta: draft.scriptGenerationMeta || null,
      _comment_scriptGenerationMeta: '샘플 폴백 여부, 생성 소스, 입력 서명 등 Step3 생성 메타데이터',
      promptStore: persistedPromptStore.stepPrompts.step3,
      constitutionAnalysis: draft.constitutionAnalysis || null,
      selectedScriptModel: draft.openRouterModel || null,
      completed: Boolean(draft.completedSteps?.step3),
    };

    const step4 = {
      selectedCharacterIds: summaryCharacterIds,
      _comment_selectedCharacterIds: 'Step4에서 선택된 출연자 ID 목록',
      selectedCharacterStyleId: draft.selectedCharacterStyleId || null,
      selectedCharacterStyleLabel: draft.selectedCharacterStyleLabel || null,
      selectedCharacterStylePrompt: draft.selectedCharacterStylePrompt || null,
      _comment_selectedCharacterStylePrompt: 'Step4 공통 출연자 스타일 프롬프트',
      contract: persistedStepContract.step4,
      _comment_contract: '캐릭터 후보, 최종 선택, 공통 캐릭터 스타일 전달 계약',
      promptStore: persistedPromptStore.stepPrompts.step4,
      characters: selectedCharacters,
      completed: Boolean(draft.completedSteps?.step4),
    };

    const step5 = {
      selectedStyleImageId: draft.selectedStyleImageId || null,
      _comment_selectedStyleImageId: 'Step5에서 선택한 최종 화풍 카드 ID',
      selectedStyle,
      _comment_selectedStyle: 'Step5에서 선택된 최종 화풍 카드',
      contract: persistedStepContract.step5,
      _comment_contract: '화풍 후보와 최종 선택 전달 계약',
      promptStore: persistedPromptStore.stepPrompts.step5,
      styleImages: draft.styleImages.map((style) => ({
        id: style.id,
        label: style.label,
        groupLabel: style.groupLabel || null,
        prompt: style.prompt || null,
        sourceMode: style.sourceMode,
        selected: style.id === draft.selectedStyleImageId,
        hasImageData: Boolean(style.imageData),
      })),
      completed: Boolean(draft.completedSteps?.step5),
    };

    const step6 = {
      projectId: currentProjectId,
      _comment_projectId: '현재 저장된 프로젝트 ID',
      projectNumber: currentProjectSummary?.projectNumber || null,
      contentType: draft.contentType,
      _comment_contentType: 'Step1에서 선택한 콘텐츠 유형',
      contentTypeLabel: getContentTypeLabel(draft.contentType),
      aspectRatio: draft.aspectRatio,
      _comment_aspectRatio: 'Step1에서 선택한 화면 비율',
      topic: draft.topic || '',
      _comment_topic: 'Step2에서 정한 프로젝트 주제',
      script: draft.script || '',
      _comment_script: 'Step3 최종 대본',
      finalScript: persistedStepContract.step6.finalScript,
      _comment_finalScript: 'Step6에서 최종 확인 가능한 대본',
      finalImagePrompt: persistedStepContract.step6.finalImagePrompt,
      _comment_finalImagePrompt: 'Step6 최종 이미지 프롬프트 번들',
      finalVideoPrompt: persistedStepContract.step6.finalVideoPrompt,
      _comment_finalVideoPrompt: 'Step6 최종 영상 프롬프트 번들',
      sceneCount: summarySceneCount,
      _comment_sceneCount: '현재 Step6에 전달된 총 씬 수',
      selectedCharacters,
      _comment_selectedCharacters: 'Step4에서 선택된 출연자 정보',
      selectedCharacterStyle: {
        id: draft.selectedCharacterStyleId || null,
        label: draft.selectedCharacterStyleLabel || null,
        prompt: draft.selectedCharacterStylePrompt || null,
        _comment_label: 'Step4에서 선택한 공통 출연자 스타일 이름',
        _comment_prompt: 'Step4에서 선택한 공통 출연자 스타일 프롬프트',
      },
      selectedStyle,
      _comment_selectedStyle: 'Step5에서 선택된 최종 화풍 카드',
      referenceImages: {
        characterCount: summaryCharacters.filter((item) => Boolean(item.imageData)).length,
        styleCount: summarySelectedStyle?.imageData ? 1 : 0,
        characterStrength: draft.referenceImages?.characterStrength || 70,
        styleStrength: draft.referenceImages?.styleStrength || 70,
      },
      promptTransfer: {
        selectedPromptTemplateName: summaryPromptTransfer.selectedPromptTemplateName,
        _comment_selectedPromptTemplateName: 'Step3에서 선택한 프롬프트 카드 이름',
        storyPrompt: summaryPromptTransfer.storyPrompt,
        _comment_storyPrompt: '대본 생성용 기본 스토리 프롬프트',
        scenePrompt: summaryPromptTransfer.scenePrompt,
        _comment_scenePrompt: '씬 분해와 장면 작성 기준 프롬프트',
        characterPrompt: summaryPromptTransfer.characterPrompt,
        _comment_characterPrompt: '출연자 캐릭터 설정 기준 프롬프트',
        actionPrompt: summaryPromptTransfer.actionPrompt,
        _comment_actionPrompt: '모션/행동 연출 기준 프롬프트',
        imagePromptBundle: summaryPromptTransfer.imagePromptBundle,
        _comment_imagePromptBundle: '현재 씬들에 배분된 이미지 프롬프트 묶음',
        videoPromptBundle: summaryPromptTransfer.videoPromptBundle,
        _comment_videoPromptBundle: '현재 씬들에 배분된 영상 프롬프트 묶음',
      },
      promptStore: persistedPromptStore,
      _comment_promptStore: '공통 프롬프트 / 단계별 프롬프트 / 최종 프롬프트 저장소',
      contract: persistedStepContract.step6,
      _comment_contract: 'Step6 최종 허브 입력/출력/누락값 진단 계약',
      usedInputs: persistedStepContract.step6.usedInputs,
      _comment_usedInputs: '현재 결과를 만들 때 사용된 Step1~Step5 핵심 입력 요약',
      missingInputs: persistedStepContract.step6.missingInputs,
      _comment_missingInputs: '현재 결과에 반영되지 못했거나 비어 있는 입력 경로',
      thumbnailContext: {
        selectedThumbnailId: currentProjectSummary?.selectedThumbnailId || null,
        thumbnailTitle: currentProjectSummary?.thumbnailTitle || null,
        thumbnailPrompt: currentProjectSummary?.thumbnailPrompt || null,
      },
      sceneAssets,
      exportSnapshot,
      transportDraft,
    };

    return {
      step1,
      step2,
      step3,
      step4,
      step5,
      step6,
      all: { step1, step2, step3, step4, step5, step6 },
    };
  }, [
    currentProjectId,
    currentProjectSummary?.projectNumber,
    currentProjectSummary?.selectedThumbnailId,
    currentProjectSummary?.thumbnailPrompt,
    currentProjectSummary?.thumbnailTitle,
    draft,
    generatedData,
    summaryCharacterIds,
    summaryCharacters,
    summarySceneCount,
    summarySelectedPromptTemplate,
    summarySelectedStyle,
  ]);

  const renderSummaryJsonCard = useCallback((title: string, payload: unknown, accent: 'slate' | 'blue' | 'violet' = 'slate') => {
    const accentClass = accent === 'blue'
      ? 'border-blue-200 bg-blue-50'
      : accent === 'violet'
        ? 'border-violet-200 bg-violet-50'
        : 'border-slate-200 bg-slate-50';
    const labelClass = accent === 'blue'
      ? 'text-blue-700'
      : accent === 'violet'
        ? 'text-violet-700'
        : 'text-slate-500';

    return (
      <div className={`rounded-[24px] border p-4 ${accentClass}`}>
        <div className={`text-[11px] font-black uppercase tracking-[0.16em] ${labelClass}`}>{title}</div>
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-[12px] leading-6 text-slate-100">{stringifySummaryJson(payload)}</pre>
      </div>
    );
  }, []);

  const resolveSceneTtsOptions = useCallback((): {
    provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
    apiKey: string;
    voiceId: string | null;
    modelId: string;
    qwenPreset: string;
    locale: string;
    voiceReferenceAudioData: string | null;
    voiceReferenceMimeType: string | null;
  } => {
    const preferredProvider = (draft.ttsProvider || studioState?.routing?.ttsProvider || 'qwen3Tts') as 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
    const elevenApiKey = studioState?.providers?.elevenLabsApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_API_KEY) || '';
    const heygenApiKey = studioState?.providers?.heygenApiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.HEYGEN_API_KEY) || '';

    const provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen' = preferredProvider === 'chatterbox'
      ? 'chatterbox'
      : preferredProvider === 'heygen'
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
        : provider === 'chatterbox'
          ? (draft.chatterboxVoicePreset || studioState?.routing?.chatterboxVoicePreset || 'chatterbox-clear')
        : provider === 'heygen'
          ? (draft.heygenVoiceId || studioState?.routing?.heygenVoiceId || null)
          : (draft.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default'),
      modelId: draft.elevenLabsModelId || studioState?.routing?.elevenLabsModelId || studioState?.routing?.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
      qwenPreset: provider === 'chatterbox'
        ? (draft.chatterboxVoicePreset || studioState?.routing?.chatterboxVoicePreset || 'chatterbox-clear')
        : (draft.qwenVoicePreset || studioState?.routing?.qwenVoicePreset || 'qwen-default'),
      locale: ((draft.customScriptSettings?.language || 'ko').trim().toLowerCase() === 'mute' ? 'ko' : (draft.customScriptSettings?.language || 'ko')),
      voiceReferenceAudioData: draft.voiceReferenceAudioData || studioState?.routing?.voiceReferenceAudioData || null,
      voiceReferenceMimeType: draft.voiceReferenceMimeType || studioState?.routing?.voiceReferenceMimeType || null,
    };
  }, [draft.chatterboxVoicePreset, draft.customScriptSettings?.language, draft.elevenLabsModelId, draft.elevenLabsVoiceId, draft.heygenVoiceId, draft.qwenVoicePreset, draft.ttsProvider, draft.voiceReferenceAudioData, draft.voiceReferenceMimeType, studioState?.providers?.elevenLabsApiKey, studioState?.providers?.heygenApiKey, studioState?.routing?.audioModel, studioState?.routing?.chatterboxVoicePreset, studioState?.routing?.elevenLabsModelId, studioState?.routing?.elevenLabsVoiceId, studioState?.routing?.heygenVoiceId, studioState?.routing?.qwenVoicePreset, studioState?.routing?.ttsProvider, studioState?.routing?.voiceReferenceAudioData, studioState?.routing?.voiceReferenceMimeType]);

  const generateSceneAudioAsset = useCallback(async (text: string) => {
    const tts = resolveSceneTtsOptions();
    return await generateTtsAudio({
      provider: tts.provider,
      text,
      apiKey: tts.apiKey || undefined,
      voiceId: tts.voiceId || undefined,
      modelId: tts.modelId || undefined,
      qwenPreset: tts.qwenPreset || undefined,
      locale: tts.locale || undefined,
      voiceReferenceAudioData: tts.voiceReferenceAudioData || undefined,
      voiceReferenceMimeType: tts.voiceReferenceMimeType || undefined,
    });
  }, [resolveSceneTtsOptions]);

  useEffect(() => {
    if (resolvedProjectId && projectHydrationPendingRef.current) return;
    if (generatedData.length) return;

    const localAssets = createInitialSceneAssetsFromDraft(draft);
    const fallbackAssets = !localAssets.length && shouldBootstrapEmptyScene(draft)
      ? createEmptySceneAssetsFromDraft(draft)
      : [];
    const bootstrapAssets = localAssets.length ? localAssets : fallbackAssets;
    if (!bootstrapAssets.length) return;

    assetsRef.current = bootstrapAssets;
    setGeneratedData(bootstrapAssets);
    setStep(GenerationStep.COMPLETED);
    setProgressMessage((prev) => prev || (localAssets.length
      ? (draft.customScriptSettings?.language === 'mute' && !draft.script?.trim()
        ? '무음 모드라 주제와 지금까지 입력한 내용을 바탕으로 씬용 이미지 / 영상 프롬프트를 자동 준비했습니다. 필요하면 문단 추가 버튼으로 장면을 더 늘릴 수 있습니다.'
        : '전달된 데이터로 씬 카드를 먼저 표시했습니다. 필요한 씬만 개별 생성하면 됩니다.')
      : '대본이 아직 없어도 바로 작업할 수 있게 빈 씬 카드 1개를 먼저 열었습니다. 문단 추가 버튼으로 장면을 더 늘릴 수 있습니다.'));
  }, [draft, generatedData.length, resolvedProjectId]);

  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const selectedVideoModel = useMemo(() => {
    const model = studioState?.routing?.videoModel || '';
    return model || CONFIG.DEFAULT_VIDEO_MODEL;
  }, [studioState?.routing?.videoModel]);

  const effectiveBackgroundTracks = useMemo(() => {
    const picked = backgroundMusicTracks.find((item) => item.id === activeBackgroundTrackId) || backgroundMusicTracks[0];
    return picked ? [picked] : [];
  }, [backgroundMusicTracks, activeBackgroundTrackId]);

  const updateBackgroundMusicScene = useCallback((patch: Partial<BackgroundMusicSceneConfig>) => {
    let nextState: StudioState | null = null;
    let nextDraft: WorkflowDraft | null = null;
    setStudioState((prev) => {
      if (!prev) return prev;
      const currentDraft = ensureWorkflowDraft(prev);
      const currentConfig = resolveBackgroundMusicSceneConfig(currentDraft);
      const nextSections = buildBackgroundMusicPromptSections(currentDraft, {
        ...(currentConfig.promptSections || {}),
        ...(patch.promptSections || {}),
      } as Partial<BackgroundMusicPromptSections>);
      const nextDuration = sanitizeBackgroundMusicDuration(patch.durationSeconds ?? currentConfig.durationSeconds, currentConfig.durationSeconds || 20);
      const nextConfig = {
        ...currentConfig,
        ...patch,
        durationSeconds: nextDuration,
        promptSections: nextSections,
        prompt: combineBackgroundMusicPromptSections(nextSections, nextDuration),
      } satisfies BackgroundMusicSceneConfig;
      nextDraft = {
        ...currentDraft,
        backgroundMusicScene: nextConfig,
        updatedAt: Date.now(),
      };
      nextState = {
        ...prev,
        workflowDraft: nextDraft,
        updatedAt: Date.now(),
      };
      return nextState;
    });
    if (nextState) {
      void saveStudioState(nextState);
      if (resolvedProjectId && nextDraft) {
        void updateProject(resolvedProjectId, { workflowDraft: nextDraft });
      }
    }
  }, [resolvedProjectId]);

  const handleSaveStudioState = useCallback(async (partial: Partial<StudioState>) => {
    const currentState = studioStateRef.current || studioState || createDefaultStudioState();
    const nextState = await saveStudioState({
      ...currentState,
      ...partial,
      updatedAt: Date.now(),
    });
    setStudioState(nextState);

    if (currentProjectId && partial.routing) {
      await updateProject(currentProjectId, {
        settings: buildProjectSettingsSnapshot({
          routing: nextState.routing,
          workflowDraft: nextState.workflowDraft,
        }),
      });
    }
  }, [currentProjectId, studioState]);

  const updateQuickRouting = useCallback(async (routingPatch: Partial<StudioState['routing']>, draftPatch?: Partial<WorkflowDraft>) => {
    const baseState = studioStateRef.current || studioState || createDefaultStudioState();
    const defaultRouting = createDefaultStudioState().routing;
    const nextWorkflowDraft = { ...ensureWorkflowDraft(baseState), ...(draftPatch || {}) };
    const nextState = await saveStudioState({
      ...baseState,
      workflowDraft: nextWorkflowDraft,
      routing: {
        ...defaultRouting,
        ...(baseState.routing || {}),
        ...routingPatch,
      },
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
  }, [studioState]);

  const selectedImageModelId = useMemo(() => studioState?.routing?.imageModel || getSelectedImageModel(), [studioState?.routing?.imageModel]);
  const selectedImageModelLabel = useMemo(() => IMAGE_MODELS.find((item) => item.id === selectedImageModelId)?.name || selectedImageModelId || CONFIG.DEFAULT_IMAGE_MODEL, [selectedImageModelId]);
  const selectedVideoModelLabel = useMemo(() => VIDEO_MODEL_OPTIONS.find((item) => item.id === selectedVideoModel)?.name || selectedVideoModel, [selectedVideoModel]);

  const quickImageModelOptions = useMemo(() => IMAGE_MODELS.map((item) => ({
    id: item.id,
    label: item.name,
    helper: `${item.provider} · ${item.description}`,
  })), []);

  const quickVideoModelOptions = useMemo(() => VIDEO_MODEL_OPTIONS.map((item) => ({
    id: item.id,
    label: item.name,
    helper: `${item.provider} · ${item.tier === 'paid' ? '유료' : '무료'} 모델`,
  })), []);

  const selectedAudioModelMeta = useMemo(() => {
    const tts = resolveSceneTtsOptions();
    if (tts.provider === 'elevenLabs') {
      const model = ELEVENLABS_MODELS.find((item) => item.id === tts.modelId) || ELEVENLABS_MODELS[0];
      return {
        currentId: `elevenLabs:${model?.id || CONFIG.DEFAULT_ELEVENLABS_MODEL}`,
        currentLabel: `ElevenLabs · ${model?.name || tts.modelId}`,
      };
    }
    if (tts.provider === 'chatterbox') {
      const preset = CHATTERBOX_TTS_PRESET_OPTIONS.find((item) => item.id === tts.qwenPreset) || CHATTERBOX_TTS_PRESET_OPTIONS[0];
      return {
        currentId: `chatterbox:${preset?.id || 'chatterbox-clear'}`,
        currentLabel: `Chatterbox 고품질 · ${preset?.name || tts.qwenPreset}`,
      };
    }
    if (tts.provider === 'heygen') {
      return {
        currentId: `heygen:${tts.voiceId || 'default'}`,
        currentLabel: 'HeyGen · 기본 보이스',
      };
    }
    const preset = QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === tts.qwenPreset) || QWEN_TTS_PRESET_OPTIONS[0];
    return {
      currentId: `qwen3Tts:${preset?.id || 'qwen-default'}`,
      currentLabel: `qwen3-tts 경량 · ${preset?.name || tts.qwenPreset}`,
    };
  }, [resolveSceneTtsOptions]);

  const quickAudioModelOptions = useMemo(() => ([
    ...QWEN_TTS_PRESET_OPTIONS.map((item) => ({ id: `qwen3Tts:${item.id}`, label: item.name, helper: '경량 무료 TTS · 빠른 로드' })),
    ...CHATTERBOX_TTS_PRESET_OPTIONS.map((item) => ({ id: `chatterbox:${item.id}`, label: item.name, helper: '고품질 무료 TTS · 음성 샘플 반영' })),
    ...ELEVENLABS_MODELS.slice(0, 4).map((item) => ({ id: `elevenLabs:${item.id}`, label: `ElevenLabs ${item.name}`, helper: item.description })),
    { id: 'heygen:default', label: 'HeyGen 기본 보이스', helper: 'HeyGen TTS 사용' },
  ]), []);

  const handleQuickImageModelSelect = useCallback((modelId: string) => {
    void updateQuickRouting({
      imageModel: modelId,
      imageProvider: modelId === 'sample-scene-image' ? 'sample' : 'openrouter',
    });
  }, [updateQuickRouting]);

  const handleQuickVideoModelSelect = useCallback((modelId: string) => {
    void updateQuickRouting({
      videoModel: modelId,
      videoProvider: modelId === CONFIG.DEFAULT_VIDEO_MODEL ? 'sample' : 'elevenLabs',
    });
  }, [updateQuickRouting]);

  const handleQuickAudioModelSelect = useCallback((value: string) => {
    const [provider, rawId] = value.split(':');
    if (provider === 'elevenLabs') {
      void updateQuickRouting({
        ttsProvider: 'elevenLabs',
        audioProvider: 'elevenLabs',
        audioModel: rawId || CONFIG.DEFAULT_ELEVENLABS_MODEL,
        elevenLabsModelId: rawId || CONFIG.DEFAULT_ELEVENLABS_MODEL,
      }, {
        ttsProvider: 'elevenLabs',
        elevenLabsModelId: rawId || CONFIG.DEFAULT_ELEVENLABS_MODEL,
      });
      return;
    }
    if (provider === 'chatterbox') {
      void updateQuickRouting({
        ttsProvider: 'chatterbox',
        audioProvider: 'chatterbox',
        chatterboxVoicePreset: rawId || 'chatterbox-clear',
      }, {
        ttsProvider: 'chatterbox',
        chatterboxVoicePreset: rawId || 'chatterbox-clear',
      });
      return;
    }
    if (provider === 'heygen') {
      void updateQuickRouting({
        ttsProvider: 'heygen',
        audioProvider: 'heygen',
        heygenVoiceId: rawId || 'default',
      }, {
        ttsProvider: 'heygen',
        heygenVoiceId: rawId || 'default',
      });
      return;
    }
    void updateQuickRouting({
      ttsProvider: 'qwen3Tts',
      audioProvider: 'qwen3Tts',
      qwenVoicePreset: rawId || 'qwen-default',
    }, {
      ttsProvider: 'qwen3Tts',
      qwenVoicePreset: rawId || 'qwen-default',
    });
  }, [updateQuickRouting]);

  const buildProjectEnhancementPatch = useCallback((assets: GeneratedAsset[], overrides?: Partial<SavedProject>) => {
    const subtitlePreset = overrides?.subtitlePreset || buildDefaultSubtitlePreset();
    const sceneDrivenScript = (draft.script || '').trim() || assets.map((item) => item.narration).filter(Boolean).join('\n\n');
    const sceneImagePrompt = assets.map((item) => item.imagePrompt || item.visualPrompt).filter(Boolean).join('\n\n') || null;
    const sceneVideoPrompt = assets.map((item) => item.videoPrompt).filter(Boolean).join('\n\n') || null;
    const projectPromptContext = {
      scriptPrompt: draft.promptPack?.storyPrompt || null,
      scenePrompt: draft.promptPack?.scenePrompt || null,
      imagePrompt: sceneImagePrompt,
      videoPrompt: sceneVideoPrompt,
      motionPrompt: draft.promptPack?.actionPrompt || null,
      thumbnailPrompt: overrides?.thumbnailPrompt ?? null,
    };
    const promptStore = buildWorkflowPromptStore({
      draft,
      assets,
      projectPrompts: projectPromptContext,
    });
    const rolePrompts = promptStore.rolePrompts || null;
    return {
      script: sceneDrivenScript || null,
      scriptParagraphs: buildScriptParagraphPlans(sceneDrivenScript),
      sceneList: buildScenePlanItems(assets),
      sceneDuration: sumSceneDuration(assets),
      ttsFiles: buildTtsFileItems(assets, resolveSceneTtsOptions().provider),
      ttsDuration: sumTtsDuration(assets),
      generationMode: inferGenerationMode(studioState),
      sceneSourceType: inferSceneSourceType(assets),
      encodingMode: overrides?.encodingMode || 'browser',
      subtitlePreset,
      subtitlePosition: subtitlePreset.position,
      subtitleBackgroundOpacity: subtitlePreset.backgroundOpacity,
      prompts: {
        scriptPrompt: rolePrompts?.script.finalPrompt || draft.promptPack?.storyPrompt || null,
        scenePrompt: rolePrompts?.scene.basePrompt || draft.promptPack?.scenePrompt || null,
        characterPrompt: rolePrompts?.character.finalPrompt || draft.promptPack?.characterPrompt || null,
        stylePrompt: rolePrompts?.style.finalPrompt || null,
        imagePrompt: rolePrompts?.scene.finalPrompt || sceneImagePrompt,
        videoPrompt: rolePrompts?.video.finalPrompt || sceneVideoPrompt,
        motionPrompt: rolePrompts?.video.basePrompt || draft.promptPack?.actionPrompt || null,
        backgroundMusicPrompt: rolePrompts?.backgroundMusic.finalPrompt || backgroundMusicSceneConfig.prompt || null,
        backgroundMusicPromptSections: backgroundMusicSceneConfig.promptSections || null,
        thumbnailPrompt: overrides?.thumbnailPrompt ?? rolePrompts?.thumbnail.finalPrompt ?? null,
        rolePrompts,
        youtubeMetaPrompt: overrides?.prompts?.youtubeMetaPrompt ?? null,
      },
      ...overrides,
    } satisfies Partial<SavedProject>;
  }, [backgroundMusicSceneConfig.prompt, backgroundMusicSceneConfig.promptSections, draft, resolveSceneTtsOptions, studioState]);

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
    sceneStudioDirtyRef.current = true;
    setGeneratedData([...assetsRef.current]);
  }, []);

  const buildSceneStudioWorkflowDraft = useCallback((source: WorkflowDraft, assetsOverride?: GeneratedAsset[]): WorkflowDraft => {
    const assets = Array.isArray(assetsOverride) ? assetsOverride : assetsRef.current;
    const projectPrompts = {
      scriptPrompt: source.promptPack?.storyPrompt || null,
      scenePrompt: source.promptPack?.scenePrompt || null,
      imagePrompt: assets.map((item) => item.imagePrompt || item.visualPrompt).filter(Boolean).join('\n\n') || null,
      videoPrompt: assets.map((item) => item.videoPrompt).filter(Boolean).join('\n\n') || null,
      motionPrompt: source.promptPack?.actionPrompt || null,
      thumbnailPrompt: source.promptStore?.rolePrompts?.thumbnail.finalPrompt || null,
    };
    const promptStore = buildWorkflowPromptStore({
      draft: source,
      assets,
      projectPrompts,
    });
    const stepContract = buildWorkflowStepContract({
      draft: { ...source, promptStore },
      assets,
      generationMeta: source.scriptGenerationMeta || null,
      projectPrompts,
    });

    const resolvedBgmConfig = resolveBackgroundMusicSceneConfig(source);
    return {
      ...source,
      promptStore,
      stepContract,
      backgroundMusicScene: {
        ...resolvedBgmConfig,
        selectedTrackId: activeBackgroundTrackId || resolvedBgmConfig.selectedTrackId || null,
      },
      activeStage: Math.max(source.activeStage || 0, 6),
      completedSteps: { ...source.completedSteps, step5: true },
      updatedAt: Date.now(),
    };
  }, [activeBackgroundTrackId]);

  const writeSceneStudioLocalSnapshot = useCallback((projectId: string, options?: {
    assets?: GeneratedAsset[];
    backgroundMusicTracks?: BackgroundMusicTrack[];
    activeBackgroundTrackId?: string | null;
    previewMix?: PreviewMixSettings;
    workflowDraft?: WorkflowDraft | null;
    cost?: CostBreakdown | null;
  }) => {
    if (!projectId) return;
    const nextAssets = Array.isArray(options?.assets) ? options.assets : assetsRef.current;
    const nextWorkflowDraft = options && 'workflowDraft' in options
      ? options.workflowDraft ?? null
      : buildSceneStudioWorkflowDraft(draft, nextAssets);
    writeSceneStudioSnapshot(buildSceneStudioSnapshotPayload({
      projectId,
      assets: nextAssets,
      backgroundMusicTracks: Array.isArray(options?.backgroundMusicTracks) ? options.backgroundMusicTracks : backgroundMusicTracks,
      activeBackgroundTrackId: options && 'activeBackgroundTrackId' in options ? options.activeBackgroundTrackId ?? null : activeBackgroundTrackId,
      previewMix: options?.previewMix ?? previewMix,
      workflowDraft: nextWorkflowDraft,
      cost: options?.cost ?? currentCostRef.current,
    }));
  }, [activeBackgroundTrackId, backgroundMusicTracks, buildSceneStudioWorkflowDraft, draft, previewMix]);

  const rememberSceneStudioWorkingProject = useCallback((projectId: string) => {
    if (!projectId) return;
    const fallbackProject = pickLatestSceneStudioProject(
      currentProjectSummary,
      readProjectNavigationProject(projectId),
    );
    const workingProject = createSceneStudioSnapshotFallbackProject(
      projectId,
      readSceneStudioSnapshot(projectId),
      fallbackProject || null,
    );
    if (workingProject) {
      rememberProjectNavigationProject(workingProject);
    }
  }, [currentProjectSummary]);

  const syncSceneStudioWorkingCopy = useCallback((assetsOverride?: GeneratedAsset[]) => {
    if (!resolvedProjectId) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveSignatureRef.current = '';
    sceneStudioDirtyRef.current = true;
    const nextAssets = Array.isArray(assetsOverride) ? assetsOverride : assetsRef.current;
    writeSceneStudioLocalSnapshot(resolvedProjectId, {
      assets: nextAssets,
      backgroundMusicTracks,
      activeBackgroundTrackId,
      previewMix,
      workflowDraft: buildSceneStudioWorkflowDraft(draft, nextAssets),
      cost: currentCostRef.current,
    });
    rememberSceneStudioWorkingProject(resolvedProjectId);
  }, [activeBackgroundTrackId, backgroundMusicTracks, buildSceneStudioWorkflowDraft, draft, previewMix, rememberSceneStudioWorkingProject, resolvedProjectId, writeSceneStudioLocalSnapshot]);

  const persistSceneStudioSnapshot = useCallback(async (projectId: string, patch?: Partial<SavedProject>) => {
    if (!projectId) return null;
    const nextAssets = Array.isArray(patch?.assets) ? patch.assets : assetsRef.current;
    const nextTracks = Array.isArray(patch?.backgroundMusicTracks) ? patch.backgroundMusicTracks : backgroundMusicTracks;
    const nextActiveBackgroundTrackId = patch && 'activeBackgroundTrackId' in patch
      ? patch.activeBackgroundTrackId ?? null
      : activeBackgroundTrackId;
    const nextPreviewMix = patch?.previewMix ?? previewMix;
    const nextCost = patch?.cost ?? currentCostRef.current;
    const nextWorkflowDraft = patch && 'workflowDraft' in patch
      ? patch.workflowDraft ?? null
      : buildSceneStudioWorkflowDraft(draft, nextAssets);

    writeSceneStudioLocalSnapshot(projectId, {
      assets: nextAssets,
      backgroundMusicTracks: nextTracks,
      activeBackgroundTrackId: nextActiveBackgroundTrackId,
      previewMix: nextPreviewMix,
      workflowDraft: nextWorkflowDraft,
      cost: nextCost,
    });
    rememberSceneStudioWorkingProject(projectId);

    const savedProject = await updateProject(projectId, {
      ...patch,
      assets: nextAssets,
      backgroundMusicTracks: nextTracks,
      activeBackgroundTrackId: nextActiveBackgroundTrackId,
      previewMix: nextPreviewMix,
      workflowDraft: nextWorkflowDraft,
      cost: nextCost,
    });
    if (savedProject) {
      rememberProjectNavigationProject(mergeSceneStudioSnapshotIntoProject(savedProject, readSceneStudioSnapshot(projectId)));
      sceneStudioDirtyRef.current = false;
    }
    return savedProject;
  }, [activeBackgroundTrackId, backgroundMusicTracks, buildSceneStudioWorkflowDraft, draft, previewMix, rememberSceneStudioWorkingProject, writeSceneStudioLocalSnapshot]);

  const flushPendingSceneStudioSave = useCallback(async (patch?: Partial<SavedProject>) => {
    const projectId = resolvedProjectId;
    if (!projectId) return null;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    return persistSceneStudioSnapshot(projectId, patch);
  }, [persistSceneStudioSnapshot, resolvedProjectId]);

  const acquireSceneActionLock = useCallback((index: number, kind: 'image' | 'audio' | 'video') => {
    const key = `${index}:${kind}`;
    if (sceneActionLocksRef.current[key]) return false;
    sceneActionLocksRef.current[key] = true;
    return true;
  }, []);

  const releaseSceneActionLock = useCallback((index: number, kind: 'image' | 'audio' | 'video') => {
    delete sceneActionLocksRef.current[`${index}:${kind}`];
  }, []);

  const enqueueGenerationTask = useCallback(async function queueGenerationTask<T>(label: string, task: () => Promise<T>): Promise<T> {
    if (generationQueueSizeRef.current >= MAX_GENERATION_QUEUE) {
      setProgressMessage('생성 대기열이 가득합니다. 이미 눌러 둔 작업이 끝난 뒤 다시 시도해 주세요.');
      throw new Error('generation queue full');
    }

    generationQueueSizeRef.current += 1;
    setQueuedGenerationCount(generationQueueSizeRef.current);

    const previous = generationQueueRef.current.catch(() => undefined);
    let releaseQueue = () => {};
    generationQueueRef.current = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    try {
      if (generationQueueSizeRef.current > 1) {
        setProgressMessage(`${label} 작업을 순차 대기열에 넣었습니다. 과부하와 불필요한 토큰 사용을 줄이기 위해 하나씩 처리합니다.`);
      }
      await previous;
      return await task();
    } finally {
      generationQueueSizeRef.current = Math.max(0, generationQueueSizeRef.current - 1);
      setQueuedGenerationCount(generationQueueSizeRef.current);
      releaseQueue();
    }
  }, []);

  const invalidateFinalPreview = useCallback((message?: string) => {
    const nextMessage = message || '씬 구성이 바뀌어 합본 영상을 다시 렌더링해야 합니다.';
    const canKeepExistingPreview = finalPreviewPersistedRef.current
      && (previewVideoStatus === 'ready' || previewVideoStatus === 'fallback')
      && Boolean(finalVideoUrl);
    previewRenderNonceRef.current += 1;
    if (!canKeepExistingPreview) {
      setFinalVideoUrl((previous) => {
        revokePreviewVideoUrl(previous);
        return null;
      });
      setFinalVideoTitle('');
      setFinalVideoDuration(null);
    }
    setPreviewVideoStatus(canKeepExistingPreview ? previewVideoStatus : 'idle');
    setPreviewVideoMessage(nextMessage);

    if (resolvedProjectId && finalPreviewPersistedRef.current) {
      void persistSceneStudioSnapshot(resolvedProjectId, {
        sceneStudioPreviewStatus: canKeepExistingPreview ? previewVideoStatus : 'idle',
        sceneStudioPreviewMessage: nextMessage,
      });
    }
  }, [finalVideoUrl, persistSceneStudioSnapshot, previewVideoStatus, resolvedProjectId]);

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

  useEffect(() => {
    if (queuedGenerationCount > 1) {
      setProgressMessage(`생성 작업 ${queuedGenerationCount}개가 순차 대기 중입니다. 과부하를 막기 위해 하나씩 처리합니다.`);
    }
  }, [queuedGenerationCount]);

  const applyProjectToScreen = useCallback((project: SavedProject, options?: { message?: string; suppressStatusMessage?: boolean }) => {
    const hydratedProject = mergeSceneStudioSnapshotIntoProject(project, readSceneStudioSnapshot(project.id));
    const safeAssets = Array.isArray(hydratedProject.assets) && hydratedProject.assets.length
      ? hydratedProject.assets.map((asset) => ({ ...asset, aspectRatio: asset?.aspectRatio || hydratedProject.workflowDraft?.aspectRatio || '16:9' }))
      : (hydratedProject.workflowDraft ? createInitialSceneAssetsFromDraft(hydratedProject.workflowDraft) : []);

    assetsRef.current = safeAssets;
    setGeneratedData([...safeAssets]);
    setCurrentProjectId(hydratedProject.id);
    setBackgroundMusicTracks(hydratedProject.backgroundMusicTracks || []);
    setActiveBackgroundTrackId(hydratedProject.activeBackgroundTrackId || hydratedProject.workflowDraft?.backgroundMusicScene?.selectedTrackId || hydratedProject.backgroundMusicTracks?.[0]?.id || null);
    setPreviewMix(hydratedProject.previewMix || getDefaultPreviewMix());
    setCurrentCost(hydratedProject.cost || null);
    currentCostRef.current = hydratedProject.cost || { images: 0, tts: 0, videos: 0, total: 0, imageCount: 0, ttsCharacters: 0, videoCount: 0 };
    setStep(safeAssets.length ? GenerationStep.COMPLETED : GenerationStep.IDLE);
    setIsPreparingPreviewVideo(false);
    sceneStudioDirtyRef.current = false;
    projectHydrationPendingRef.current = false;
    setIsProjectHydrating(false);

    const persistedPreviewVideo = hydratedProject.sceneStudioPreviewVideo?.videoData || null;
    const persistedPreviewStatus = hydratedProject.sceneStudioPreviewStatus === 'ready' || hydratedProject.sceneStudioPreviewStatus === 'fallback'
      ? hydratedProject.sceneStudioPreviewStatus
      : 'idle';

    finalPreviewPersistedRef.current = Boolean(persistedPreviewVideo && persistedPreviewStatus !== 'idle');
    setFinalVideoUrl((previous) => {
      revokePreviewVideoUrl(previous);
      return persistedPreviewVideo;
    });
    setFinalVideoTitle(hydratedProject.sceneStudioPreviewVideo?.title || '');
    setFinalVideoDuration(hydratedProject.sceneStudioPreviewVideo?.duration || null);
    setPreviewVideoStatus(persistedPreviewStatus);
    setPreviewVideoMessage(hydratedProject.sceneStudioPreviewMessage || '합본 영상을 렌더링해 주세요.');
    setStep4Open(false);
    if (options?.suppressStatusMessage) {
      setProgressMessage('');
    } else {
      setProgressMessage(options?.message || `"${hydratedProject.name}" 프로젝트를 열었습니다. 씬 카드는 먼저 가볍게 보여 주고, 실제 AI 생성은 생성 버튼을 눌렀을 때만 시작합니다.`);
    }
    rememberProjectNavigationProject(hydratedProject);
  }, []);

  const appendImageHistory = useCallback((asset: GeneratedAsset, imageData: string, sourceMode: 'ai' | 'sample', label: string) => {
    const prev = Array.isArray(asset.imageHistory) ? asset.imageHistory : [];
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
    const isMuteWithoutScript = draft.customScriptSettings?.language === 'mute' && !draft.script?.trim();
    if (isMuteWithoutScript) {
      if (assetsRef.current.length) {
        return applyDraftSelectionPromptsToScenes(
          assetsRef.current.map((asset, index) => ({
            ...asset,
            sceneNumber: index + 1,
            narration: asset.narration || `추가 장면 ${index + 1}`,
            visualPrompt: asset.imagePrompt || asset.visualPrompt || '',
            imagePrompt: asset.imagePrompt || asset.visualPrompt || '',
            videoPrompt: asset.videoPrompt || '',
            targetDuration: clampSceneDuration(asset.targetDuration || estimateClipDuration(asset.narration || '장면')), 
            aspectRatio: asset.aspectRatio || draft.aspectRatio || '16:9',
          })),
          draft,
        );
      }
      return applyDraftSelectionPromptsToScenes(createLocalScenesFromDraft(draft), draft);
    }

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

  const handleGoBackToWorkflow = useCallback(async () => {
    const projectId = resolvedProjectId;
    setNavigationOverlay({
      title: '이전 단계로 이동하는 중',
      description: '현재 프로젝트를 유지한 채 Step5(화풍 선택)로 돌아갑니다.',
    });
    if (projectId) {
      await flushPendingSceneStudioSave({
        workflowDraft: {
          ...buildSceneStudioWorkflowDraft(draft),
          activeStage: 5,
          updatedAt: Date.now(),
        },
      });
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
      router.push(`${basePath}/step-5?projectId=${encodeURIComponent(projectId)}`, { scroll: true });
      return;
    }
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
    router.push(`${basePath}/step-5`, { scroll: true });
  }, [basePath, buildSceneStudioWorkflowDraft, draft, flushPendingSceneStudioSave, resolvedProjectId, router]);

  const persistBackgroundMusicSnapshot = useCallback((nextTracks: BackgroundMusicTrack[], nextSelectedId: string | null, scenePatch?: Partial<BackgroundMusicSceneConfig>) => {
    if (!resolvedProjectId) return;
    const nextDraft = buildSceneStudioWorkflowDraft({
      ...draft,
      backgroundMusicScene: {
        ...resolveBackgroundMusicSceneConfig(draft),
        ...(scenePatch || {}),
        selectedTrackId: nextSelectedId,
      },
      updatedAt: Date.now(),
    });
    sceneStudioDirtyRef.current = true;
    void persistSceneStudioSnapshot(resolvedProjectId, {
      backgroundMusicTracks: nextTracks,
      activeBackgroundTrackId: nextSelectedId,
      workflowDraft: nextDraft,
      previewMix,
    });
  }, [buildSceneStudioWorkflowDraft, draft, persistSceneStudioSnapshot, previewMix, resolvedProjectId]);

  const handleSelectBackgroundTrack = useCallback((trackId: string) => {
    setActiveBackgroundTrackId(trackId);
    updateBackgroundMusicScene({ enabled: true, selectedTrackId: trackId });
    persistBackgroundMusicSnapshot(backgroundMusicTracks, trackId, { enabled: true, selectedTrackId: trackId });
  }, [backgroundMusicTracks, persistBackgroundMusicSnapshot, updateBackgroundMusicScene]);

  const handleAutoFillBackgroundMusicMood = useCallback(() => {
    const suggestedMood = buildBackgroundMusicPromptSections(draft, backgroundMusicSceneConfig.promptSections).mood;
    updateBackgroundMusicScene({
      enabled: true,
      promptSections: {
        ...(backgroundMusicSceneConfig.promptSections || {}),
        mood: suggestedMood,
      } as BackgroundMusicPromptSections,
    });
    setProgressMessage('현재 프로젝트 흐름을 바탕으로 배경음 느낌 문장을 자동으로 채웠습니다. 필요하면 바로 수정해서 다시 생성하면 됩니다.');
  }, [backgroundMusicSceneConfig.promptSections, draft, updateBackgroundMusicScene]);

  const createAnotherBackgroundTrack = useCallback(() => {
    const nextDuration = resolveCurrentVideoDurationSeconds(draft, assetsRef.current);
    const nextTrack = createSampleBackgroundTrack(
      draft,
      backgroundMusicSceneConfig.modelId,
      'preview',
      {
        prompt: backgroundMusicSceneConfig.prompt,
        title: resolveNextBackgroundTrackTitle(backgroundMusicTracks),
        provider: backgroundMusicSceneConfig.provider,
        promptSections: backgroundMusicSceneConfig.promptSections,
        durationSeconds: nextDuration,
      },
    );
    const nextTracks = [...backgroundMusicTracks, nextTrack];
    setBackgroundMusicTracks(nextTracks);
    setActiveBackgroundTrackId(nextTrack.id);
    updateBackgroundMusicScene({ enabled: true, selectedTrackId: nextTrack.id, durationSeconds: nextDuration });
    persistBackgroundMusicSnapshot(nextTracks, nextTrack.id, { enabled: true, selectedTrackId: nextTrack.id, durationSeconds: nextDuration });
    setProgressMessage(
      backgroundMusicSceneConfig.provider === 'google'
        ? `Google Lyria 연동용 배경음 설정을 보존했고, 현재는 영상 총 길이 ${nextDuration}초 기준 샘플 음원으로 새 트랙을 생성했습니다.`
        : `새 배경음을 영상 총 길이 ${nextDuration}초 기준으로 생성했습니다. 생성 이력은 고정 폭 카드 안에서 가로로 쌓이며, 방금 생성한 트랙으로 자동 포커스됩니다.`,
    );
  }, [backgroundMusicSceneConfig, backgroundMusicTracks, draft, persistBackgroundMusicSnapshot, resolveNextBackgroundTrackTitle, updateBackgroundMusicScene]);

  const handleDeleteBackgroundTrack = useCallback((trackId: string) => {
    const nextTracks = backgroundMusicTracks.filter((track) => track.id !== trackId);
    const fallbackTrack = nextTracks[0] || null;
    const nextSelectedId = activeBackgroundTrackId === trackId ? fallbackTrack?.id || null : activeBackgroundTrackId;
    setBackgroundMusicTracks(nextTracks);
    setActiveBackgroundTrackId(nextSelectedId);
    updateBackgroundMusicScene({ selectedTrackId: nextSelectedId });
    persistBackgroundMusicSnapshot(nextTracks, nextSelectedId, { selectedTrackId: nextSelectedId });
    setProgressMessage('배경음 이력에서 선택한 트랙을 삭제했습니다. 남은 트랙은 프로젝트 저장 시 함께 유지됩니다.');
  }, [activeBackgroundTrackId, backgroundMusicTracks, persistBackgroundMusicSnapshot, updateBackgroundMusicScene]);

  const handleExtendBackgroundTrack = useCallback((trackId: string) => {
    const sourceTrack = backgroundMusicTracks.find((track) => track.id === trackId);
    if (!sourceTrack) return;
    const nextDuration = resolveCurrentVideoDurationSeconds(draft, assetsRef.current);
    const nextTrack = createSampleBackgroundTrack(
      draft,
      backgroundMusicSceneConfig.modelId,
      'preview',
      {
        prompt: sourceTrack.prompt || backgroundMusicSceneConfig.prompt,
        title: resolveNextBackgroundTrackTitle(backgroundMusicTracks),
        provider: backgroundMusicSceneConfig.provider,
        promptSections: sourceTrack.promptSections || backgroundMusicSceneConfig.promptSections,
        durationSeconds: nextDuration,
        parentTrackId: sourceTrack.id,
      },
    );
    const nextTracks = [...backgroundMusicTracks, nextTrack];
    setBackgroundMusicTracks(nextTracks);
    setActiveBackgroundTrackId(nextTrack.id);
    updateBackgroundMusicScene({ enabled: true, selectedTrackId: nextTrack.id, durationSeconds: nextDuration });
    persistBackgroundMusicSnapshot(nextTracks, nextTrack.id, { enabled: true, selectedTrackId: nextTrack.id, durationSeconds: nextDuration });
    setProgressMessage(`선택한 배경음을 영상 총 길이 ${nextDuration}초 기준으로 타이밍 조절 버전으로 추가했습니다. 원본은 그대로 남아 언제든 다시 선택할 수 있습니다.`);
  }, [backgroundMusicSceneConfig, backgroundMusicTracks, draft, persistBackgroundMusicSnapshot, resolveNextBackgroundTrackTitle, updateBackgroundMusicScene]);

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
    const projectId = requestedProjectId;
    if (!projectId) return;
    const signature = `${projectId}:${projectLookupTick}`;
    if (projectQueryHandledRef.current === signature) return;
    projectQueryHandledRef.current = signature;

    let cancelled = false;

    void (async () => {
      const snapshot = readSceneStudioSnapshot(projectId);
      const navigationProject = readMergedSceneStudioProject(projectId);
      const snapshotProject = createSceneStudioSnapshotFallbackProject(projectId, snapshot, navigationProject);
      const immediateProject = pickLatestSceneStudioProject(snapshotProject, navigationProject);
      let shouldShowRestoreUi = hasDetailedSceneStudioProject(immediateProject);
      if (shouldShowRestoreUi) {
        setStep((prev) => (prev === GenerationStep.IDLE ? GenerationStep.ASSETS : prev));
        setProgressMessage('프로젝트 요약과 씬 카드를 먼저 붙이는 중...');
        setTaskProgressPercent(12);
      } else {
        setProgressMessage('');
        setTaskProgressPercent(null);
      }

      if (immediateProject) {
        if (shouldShowRestoreUi) {
          setTaskProgressPercent(42);
          applyProjectToScreen(immediateProject, { message: `"${immediateProject.name}" 프로젝트 저장본을 먼저 붙였습니다. 상세 데이터를 확인하는 동안 현재 씬부터 이어서 보여 드립니다.` });
        } else {
          applyProjectToScreen(immediateProject, { suppressStatusMessage: true });
        }
      } else if (shouldShowRestoreUi) {
        setTaskProgressPercent(30);
      }
      const localProjectRecord = await withSoftTimeout(getProjectById(projectId, { localOnly: true }), 700, null);
      const localProject = localProjectRecord
        ? mergeSceneStudioSnapshotIntoProject(localProjectRecord, snapshot)
        : snapshotProject;
      const cachedProject = pickLatestSceneStudioProject(localProject, immediateProject);
      if (cancelled) return;

      if (cachedProject) {
        const hasCachedRestoreProject = hasDetailedSceneStudioProject(cachedProject);
        shouldShowRestoreUi = shouldShowRestoreUi || hasCachedRestoreProject;
        const cachedDraft = cachedProject.workflowDraft;
        if (cachedDraft) {
          setStudioState((prev) => prev ? {
            ...prev,
            workflowDraft: cachedDraft,
            lastContentType: cachedDraft.contentType || prev.lastContentType || 'story',
          } : prev);
        }
        if (hasCachedRestoreProject) {
          setStep((prev) => (prev === GenerationStep.IDLE ? GenerationStep.ASSETS : prev));
          setTaskProgressPercent(58);
          applyProjectToScreen(cachedProject, { message: `"${cachedProject.name}" 프로젝트를 빠르게 열었습니다. 저장본을 확인하는 동안 씬 카드는 먼저 보여 드립니다.` });
        } else {
          setTaskProgressPercent(null);
          applyProjectToScreen(cachedProject, { suppressStatusMessage: true });
        }
      }

      if (shouldShowRestoreUi) {
        setTaskProgressPercent(cachedProject ? 76 : 48);
      } else {
        setTaskProgressPercent(null);
      }
      const projectRecord = await withSoftTimeout(getProjectById(projectId, { forceSync: !cachedProject }), 1800, cachedProject || snapshotProject || null);
      const project = projectRecord
        ? mergeSceneStudioSnapshotIntoProject(projectRecord, snapshot)
        : null;
      if (cancelled) return;
      if (!project) {
        projectLookupRetryCountRef.current += 1;
        if (projectLookupRetryCountRef.current >= 3) {
          projectHydrationPendingRef.current = false;
          setIsProjectHydrating(false);
          setTaskProgressPercent(null);
          if (shouldShowRestoreUi) {
            setProgressMessage('저장된 Step6 데이터를 아직 찾지 못했습니다. 잠시 후 다시 열면 마지막 저장본을 다시 확인합니다.');
          } else {
            setProgressMessage('');
          }
          return;
        }
        projectQueryHandledRef.current = '';
        if (shouldShowRestoreUi) {
          setTaskProgressPercent(66);
          setProgressMessage(`저장 직후 프로젝트 상세 JSON을 다시 확인하는 중입니다... (${projectLookupRetryCountRef.current}/3)`);
        }
        if (projectQueryRetryTimerRef.current) window.clearTimeout(projectQueryRetryTimerRef.current);
        projectQueryRetryTimerRef.current = window.setTimeout(() => {
          setProjectLookupTick((prev) => prev + 1);
        }, 220);
        return;
      }

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
          const syncedState = {
            ...baseStudioState,
            workflowDraft: projectDraft,
            lastContentType: projectDraft.contentType || baseStudioState.lastContentType || 'story',
            updatedAt: Date.now(),
          };
          if (!cancelled) setStudioState(syncedState);
        }
      }

      const hasPersistedRestoreProject = hasDetailedSceneStudioProject(project);
      if (hasPersistedRestoreProject) {
        setStep((prev) => (prev === GenerationStep.IDLE ? GenerationStep.ASSETS : prev));
        setTaskProgressPercent(100);
        applyProjectToScreen(project);
        window.setTimeout(() => setTaskProgressPercent(null), 600);
      } else {
        setTaskProgressPercent(null);
        applyProjectToScreen(project, { suppressStatusMessage: true });
      }
      clearProjectNavigationProject(projectId);
      if (projectQueryRetryTimerRef.current) {
        window.clearTimeout(projectQueryRetryTimerRef.current);
        projectQueryRetryTimerRef.current = null;
      }
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_SCENE_AUTOSTART);
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (projectQueryRetryTimerRef.current) {
        window.clearTimeout(projectQueryRetryTimerRef.current);
        projectQueryRetryTimerRef.current = null;
      }
    };
  }, [applyProjectToScreen, projectLookupTick, requestedProjectId]);


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
          targetDuration: typeof existing?.targetDuration === 'number' ? clampSceneDuration(existing.targetDuration) : 0,
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
      const isTtsAvailable = Boolean(initialTtsOptions && (initialTtsOptions.provider === 'qwen3Tts' || initialTtsOptions.provider === 'chatterbox' || initialTtsOptions.apiKey));

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
            generateImage({ ...assetsRef.current[i], aspectRatio: currentAspectRatio }, referenceImages, { qualityMode: 'final' }),
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
          targetDuration: clampSceneDuration(assetsRef.current[i].targetDuration || DEFAULT_SCENE_DURATION),
          selectedVisualType: 'image',
        });
        syncSceneStudioWorkingCopy();
        setSceneProgress(i, isTtsAvailable ? 72 : 100, isTtsAvailable ? '오디오 대기 중' : '이미지 준비 완료');

        const sceneTts = resolveSceneTtsOptions();
        if (generateAudio && (sceneTts.provider === 'qwen3Tts' || sceneTts.provider === 'chatterbox' || sceneTts.apiKey)) {
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
                targetDuration: clampSceneDuration(audio.estimatedDuration || assetsRef.current[i].targetDuration || DEFAULT_SCENE_DURATION),
              });
              syncSceneStudioWorkingCopy();
              addCost('tts', PRICING.TTS.perCharacter * assetsRef.current[i].narration.length, assetsRef.current[i].narration.length);
            }
            setSceneProgress(i, 90, '오디오 / 자막 정리');
          } catch {}
        }

        setTaskProgressPercent(18 + Math.round(((i + 1) / Math.max(1, initialAssets.length)) * 72));
        setSceneProgress(i, 100, '씬 준비 완료');
        await wait(120);
      }

      const nextTracks = backgroundMusicTracks.length ? backgroundMusicTracks : [createSampleBackgroundTrack(draft, backgroundMusicSceneConfig.modelId, 'preview', {
        promptSections: backgroundMusicSceneConfig.promptSections,
        durationSeconds: resolveCurrentVideoDurationSeconds(draft, assetsRef.current),
        provider: backgroundMusicSceneConfig.provider,
        title: resolveNextBackgroundTrackTitle(backgroundMusicTracks),
      })];
      const selectedTrack = nextTracks.find((track) => track.id === (activeBackgroundTrackId || backgroundMusicSceneConfig.selectedTrackId)) || nextTracks[0];
      setBackgroundMusicTracks(nextTracks);
      setActiveBackgroundTrackId(selectedTrack?.id || null);
      setPreviewMix((prev) => prev || getDefaultPreviewMix());

      setStep(GenerationStep.COMPLETED);
      setTaskProgressPercent(96);
      setProgressMessage(generateAudio
        ? '씬 카드(이미지/오디오) 생성이 끝났습니다. 현재는 저부하 샘플 이미지 중심으로 준비했고, 필요하면 씬별 영상화 또는 최종 출력으로 넘어가 주세요.'
        : '씬 이미지 생성이 끝났습니다. 현재는 저부하 샘플 이미지 중심으로 준비했고, 필요하면 씬별 또는 전체 영상 생성을 진행해 주세요.');

      const nextWorkflowDraftForSave: WorkflowDraft = buildSceneStudioWorkflowDraft({
        ...draft,
        completedSteps: { ...draft.completedSteps, step4: true },
        updatedAt: Date.now(),
      });

      const saved = await upsertWorkflowProject({
        projectId: resolvedProjectId,
        topic: draft.topic || 'Manual Script Input',
        assets: assetsRef.current,
        cost: currentCostRef.current,
        backgroundMusicTracks: nextTracks,
        activeBackgroundTrackId: selectedTrack?.id || null,
        previewMix,
        ...buildProjectEnhancementPatch(assetsRef.current),
        workflowDraft: nextWorkflowDraftForSave,
      });
      setCurrentProjectId(saved.id);
      writeSceneStudioLocalSnapshot(saved.id, {
        assets: assetsRef.current,
        backgroundMusicTracks: nextTracks,
        activeBackgroundTrackId: selectedTrack?.id || null,
        previewMix,
        workflowDraft: saved.workflowDraft || buildSceneStudioWorkflowDraft(draft, assetsRef.current),
        cost: currentCostRef.current,
      });
      rememberProjectNavigationProject(mergeSceneStudioSnapshotIntoProject(saved, readSceneStudioSnapshot(saved.id)));
      sceneStudioDirtyRef.current = false;
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
  }, [appendImageHistory, backgroundMusicTracks, backgroundMusicSceneConfig, buildProjectEnhancementPatch, buildReferenceImages, buildSceneStudioWorkflowDraft, createScenePlan, draft, persistWorkflowStep4, previewMix, resolveNextBackgroundTrackTitle, resolvedProjectId, studioState, updateAssetAt, writeSceneStudioLocalSnapshot]);

  useEffect(() => {
    return () => {
      revokePreviewVideoUrl(finalVideoUrl);
    };
  }, [finalVideoUrl]);

  useEffect(() => {
    if (!resolvedProjectId || !generatedData.length) return;
    if (isGeneratingScenes || isThumbnailGenerating || isGeneratingAllVideos || isVideoGenerating || animatingIndices.size > 0) return;
    const signature = JSON.stringify({
      currentProjectId: resolvedProjectId,
      sceneCount: generatedData.length,
      sceneStatus: generatedData.map((item) => ({
        sceneNumber: item.sceneNumber,
        narration: item.narration,
        imagePrompt: item.imagePrompt,
        videoPrompt: item.videoPrompt,
        visualPrompt: item.visualPrompt,
        selectedVisualType: item.selectedVisualType,
        hasImage: Boolean(item.imageData),
        hasAudio: Boolean(item.audioData),
        hasVideo: Boolean(item.videoData),
        imageDataSize: item.imageData?.length || 0,
        audioDataSize: item.audioData?.length || 0,
        videoDataSize: item.videoData?.length || 0,
        audioDuration: item.audioDuration || null,
        videoDuration: item.videoDuration || null,
        subtitleSize: item.subtitleData?.fullText?.length || 0,
        imageHistoryCount: Array.isArray(item.imageHistory) ? item.imageHistory.length : 0,
        videoHistoryCount: Array.isArray(item.videoHistory) ? item.videoHistory.length : 0,
        targetDuration: item.targetDuration,
        status: item.status,
      })),
      backgroundMusicTracks: backgroundMusicTracks.map((track) => ({ id: track.id, hasAudio: Boolean(track.audioData), volume: track.volume, duration: track.duration })),
      activeBackgroundTrackId,
      previewMix,
      draftUpdatedAt: draft.updatedAt,
      selectedStyleImageId: draft.selectedStyleImageId,
      selectedCharacterIds: draft.selectedCharacterIds,
      cost: currentCost ? {
        images: currentCost.images,
        tts: currentCost.tts,
        videos: currentCost.videos,
        total: currentCost.total,
        imageCount: currentCost.imageCount,
        ttsCharacters: currentCost.ttsCharacters,
        videoCount: currentCost.videoCount,
      } : null,
    });
    if (autosaveSignatureRef.current === signature) return;
    autosaveSignatureRef.current = signature;
    writeSceneStudioLocalSnapshot(resolvedProjectId, {
      assets: generatedData,
      backgroundMusicTracks,
      activeBackgroundTrackId,
      previewMix,
      workflowDraft: buildSceneStudioWorkflowDraft(draft, generatedData),
      cost: currentCostRef.current,
    });
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      await persistSceneStudioSnapshot(resolvedProjectId, {
        assets: generatedData,
        backgroundMusicTracks,
        activeBackgroundTrackId,
        previewMix,
        cost: currentCostRef.current,
        workflowDraft: buildSceneStudioWorkflowDraft(draft, generatedData),
        ...buildProjectEnhancementPatch(generatedData),
      });
      setProgressMessage('씬, 배경음, 프리뷰 설정을 자동 저장했습니다.');
    }, 40);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [activeBackgroundTrackId, animatingIndices, backgroundMusicTracks, buildProjectEnhancementPatch, buildSceneStudioWorkflowDraft, currentCost, draft, generatedData, isGeneratingAllVideos, isGeneratingScenes, isThumbnailGenerating, isVideoGenerating, persistSceneStudioSnapshot, previewMix, resolvedProjectId, writeSceneStudioLocalSnapshot]);

  useEffect(() => {
    if (!resolvedProjectId || !studioState) return;
    if ((draft.activeStage || 0) >= 6) return;
    const signature = `${resolvedProjectId}:${draft.updatedAt}:${draft.activeStage || 0}`;
    if (step6VisitSyncRef.current === signature) return;
    step6VisitSyncRef.current = signature;

    const nextDraft = buildSceneStudioWorkflowDraft(draft);
    setStudioState((prev) => prev ? { ...prev, workflowDraft: nextDraft, updatedAt: Date.now() } : prev);
    void saveStudioState({ ...studioState, workflowDraft: nextDraft, updatedAt: Date.now() });
    writeSceneStudioLocalSnapshot(resolvedProjectId, { workflowDraft: nextDraft });
    void persistSceneStudioSnapshot(resolvedProjectId, { workflowDraft: nextDraft });
  }, [buildSceneStudioWorkflowDraft, draft, persistSceneStudioSnapshot, resolvedProjectId, studioState, writeSceneStudioLocalSnapshot]);

  const renderMergedVideo = useCallback(async (options: {
    enableSubtitles: boolean;
    qualityMode: 'preview' | 'final';
    downloadFile?: boolean;
    customTitle?: string;
  }) => {
    const { enableSubtitles, qualityMode, downloadFile = false, customTitle } = options;
    if (isVideoGenerating) return null;

    const renderableAssets = [...assetsRef.current];
    const existingPreviewUrl = finalVideoUrl;
    const existingPreviewStatus = previewVideoStatus;
    const existingPreviewMessage = previewVideoMessage;
    const sceneVideoCount = renderableAssets.filter((asset) => Boolean(asset.videoData)).length;
    const hasSceneOutputs = renderableAssets.some((asset) => Boolean(asset.imageData || asset.videoData || asset.audioData));
    const hasBackgroundOutputs = effectiveBackgroundTracks.some((track) => Boolean(track?.audioData));
    const shouldStartWithStaticFallback = !hasSceneOutputs && !hasBackgroundOutputs;
    const subtitlePreset = currentProjectSummary?.subtitlePreset || buildDefaultSubtitlePreset();

    if (!renderableAssets.length) {
      const message = '합칠 씬이 아직 없어 결과 미리보기를 만들 수 없습니다.';
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
      }
      if (downloadFile) {
        setTaskProgressPercent(12);
        setProgressMessage('ffmpeg로 완성형 MP4를 정리하는 중입니다.');
        const finalResult = await renderVideoWithFfmpeg({
          assets: assetsRef.current,
          backgroundTracks: effectiveBackgroundTracks,
          previewMix,
          aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
          qualityMode,
          enableSubtitles,
          subtitlePreset,
          title: renderTitle(),
        });
        setTaskProgressPercent(92);
        triggerBlobDownload(finalResult.videoBlob, `mp4Creater_${enableSubtitles ? 'sub' : 'nosub'}_${Date.now()}.mp4`);
        setProgressMessage('완성형 MP4 저장이 완료되었습니다.');
        setTaskProgressPercent(100);

        if (resolvedProjectId) {
          await persistSceneStudioSnapshot(resolvedProjectId, {
            ...buildProjectEnhancementPatch(assetsRef.current, {
              encodingMode: 'ffmpeg',
            }),
          });
        }

        return {
          videoBlob: finalResult.videoBlob,
          recordedSubtitles: [],
        };
      }

      setTaskProgressPercent(8);
      setPreviewVideoStatus('loading');

      const primaryMessage = shouldStartWithStaticFallback
        ? '이미지, 영상, 오디오가 없어도 각 씬 길이만큼 검정 화면으로 합본 영상을 만드는 중입니다.'
        : sceneVideoCount > 0
          ? `준비된 씬 영상 ${sceneVideoCount}개와 이미지를 함께 합쳐 합본 영상을 만드는 중입니다.`
          : 'AI 씬 영상이 없어도 현재 씬 이미지와 오디오를 기준으로 합본 영상을 만드는 중입니다.';
      setPreviewVideoMessage(primaryMessage);
      setProgressMessage(primaryMessage);

      let result = null;
      let usedFallback = shouldStartWithStaticFallback;
      let usedSceneVideos = sceneVideoCount > 0 && !shouldStartWithStaticFallback;
      let usedSafeFallback = shouldStartWithStaticFallback;

      try {
        if (shouldStartWithStaticFallback) {
          result = await generateVideoStaticFallback(
            assetsRef.current.map((asset) => ({ ...asset, videoData: null })),
            progressHandler,
            isAbortedRef,
            {
              enableSubtitles,
              qualityMode,
              backgroundTracks: effectiveBackgroundTracks,
              previewMix,
              aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
            }
          );
        } else {
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
        }
      } catch (primaryError) {
        console.error('[SceneStudioPage] primary merged render failed', primaryError);
        usedFallback = true;
        usedSceneVideos = false;
        setTaskProgressPercent(22);
        const fallbackMessage = '합치는 중 문제가 있어 안전 모드로 다시 시도합니다. 씬 영상 없이 이미지 기반으로 합칩니다.';
        setPreviewVideoStatus('loading');
        setPreviewVideoMessage(fallbackMessage);
        setProgressMessage(fallbackMessage);

        try {
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
        } catch (secondaryError) {
          console.error('[SceneStudioPage] browser merged render failed, switching to static fallback', secondaryError);
          usedSafeFallback = true;
          setTaskProgressPercent(35);
          const safeFallbackMessage = '브라우저 합치기 중 문제가 있어 ZIP 방식과 같은 정적 합본 렌더로 다시 만듭니다.';
          setPreviewVideoStatus('loading');
          setPreviewVideoMessage(safeFallbackMessage);
          setProgressMessage(safeFallbackMessage);

          result = await generateVideoStaticFallback(
            assetsRef.current.map((asset) => ({ ...asset, videoData: null })),
            progressHandler,
            isAbortedRef,
            {
              enableSubtitles,
              qualityMode,
              backgroundTracks: effectiveBackgroundTracks,
              previewMix,
              aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
            }
          );
        }
      }

      if (!result) {
        const message = '합본 영상 결과를 아직 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
        setPreviewVideoStatus('error');
        setPreviewVideoMessage(message);
        setProgressMessage(message);
        return null;
      }

      let finalResult = result;

      const expectedDuration = Number(renderableAssets.reduce((sum, asset) => sum + resolveScenePlaybackDuration(asset), 0).toFixed(2));
      const measuredDuration = await measureRenderedVideoDuration(finalResult.videoBlob);

      if (!usedSafeFallback && (!measuredDuration || measuredDuration < 0.2)) {
        usedSafeFallback = true;
        usedFallback = true;
        usedSceneVideos = false;
        setTaskProgressPercent(42);
        const invalidDurationMessage = '렌더 결과 길이를 확인하지 못해 정적 합본 렌더로 한 번 더 맞춥니다.';
        setPreviewVideoStatus('loading');
        setPreviewVideoMessage(invalidDurationMessage);
        setProgressMessage(invalidDurationMessage);

        const safeFallbackResult = await generateVideoStaticFallback(
          assetsRef.current.map((asset) => ({ ...asset, videoData: null })),
          progressHandler,
          isAbortedRef,
          {
            enableSubtitles,
            qualityMode,
            backgroundTracks: effectiveBackgroundTracks,
            previewMix,
            aspectRatio: draft.aspectRatio || assetsRef.current[0]?.aspectRatio || '16:9',
          }
        );
        if (!safeFallbackResult) return null;
        finalResult = safeFallbackResult;
      }

      const safeMeasuredDuration = await measureRenderedVideoDuration(finalResult.videoBlob);
      const normalizedExpectedDuration = safeMeasuredDuration && safeMeasuredDuration > 0.1
        ? safeMeasuredDuration
        : expectedDuration;

      const suffix = enableSubtitles ? 'sub' : 'nosub';
      const previewUrl = URL.createObjectURL(finalResult.videoBlob);
      setFinalVideoUrl((previous) => {
        revokePreviewVideoUrl(previous);
        return previewUrl;
      });
      const nextFinalVideoTitle = renderTitle(usedFallback ? '안전 모드' : undefined);
      setFinalVideoTitle(nextFinalVideoTitle);
      setFinalVideoDuration(normalizedExpectedDuration > 0 ? normalizedExpectedDuration : null);

      if (downloadFile) {
        const outputExtension = finalResult.videoBlob.type.includes('webm') ? 'webm' : 'mp4';
        triggerBlobDownload(finalResult.videoBlob, `mp4Creater_${suffix}_${Date.now()}.${outputExtension}`);
      }

      const successMessage = usedSafeFallback
        ? '정적 합본 렌더로 전체 씬을 다시 묶어 결과 영상을 준비했습니다.'
        : usedFallback
          ? '안전 모드로 합본 영상을 만들었습니다. 브라우저 합치기 문제가 있어 이미지 기반으로 다시 합쳤습니다.'
          : usedSceneVideos
            ? `씬 영상 ${sceneVideoCount}개를 반영한 합본 영상이 준비되었습니다.`
            : 'AI 씬 영상 없이도 이미지 기반 합본 영상이 준비되었습니다.';

      const durationMessage = normalizedExpectedDuration > 0
        ? ` 총 길이 ${normalizedExpectedDuration.toFixed(1)}초 기준으로 맞췄습니다.`
        : '';

      const nextPreviewStatus = usedFallback || usedSafeFallback || !usedSceneVideos ? 'fallback' : 'ready';
      setPreviewVideoStatus(nextPreviewStatus);
      setPreviewVideoMessage(`${successMessage}${durationMessage}`);
      setProgressMessage(downloadFile ? '합본 영상 저장이 완료되었습니다.' : '합본 영상 미리보기가 준비되었습니다.');
      setTaskProgressPercent(100);

      if (resolvedProjectId) {
        const renderNonce = previewRenderNonceRef.current;
        finalPreviewPersistedRef.current = true;
        try {
          const previewVideoData = await blobToDataUrl(finalResult.videoBlob);
          if (renderNonce === previewRenderNonceRef.current) {
            await persistSceneStudioSnapshot(resolvedProjectId, {
              ...buildProjectEnhancementPatch(assetsRef.current, {
                encodingMode: 'browser',
              }),
              sceneStudioPreviewVideo: {
                id: `scene_preview_${Date.now()}`,
                title: nextFinalVideoTitle,
                prompt: successMessage,
                videoData: previewVideoData,
                provider: 'sample',
                mode: 'preview',
                sourceMode: usedSceneVideos && !usedFallback && !usedSafeFallback ? 'ai' : 'sample',
                createdAt: Date.now(),
                duration: normalizedExpectedDuration,
              },
              sceneStudioPreviewStatus: nextPreviewStatus,
              sceneStudioPreviewMessage: `${successMessage}${durationMessage}`,
            });
          }
        } catch (persistError) {
          finalPreviewPersistedRef.current = false;
          console.error('[SceneStudioPage] preview persist failed', persistError);
        }
      }

      return finalResult;
    } catch (error) {
      console.error('[SceneStudioPage] merged render failed', error);
      const failureMessage = '브라우저에서 합본 영상을 만드는 중 문제가 발생했습니다. 다시 시도하거나 씬 수를 줄여 확인해 주세요.';
      const resolvedFailureMessage = downloadFile
        ? (isFfmpegUnavailableError(error)
          ? '완성형 MP4 출력에 필요한 ffmpeg를 찾지 못했습니다. ffmpeg 설치 또는 FFMPEG_PATH 설정이 필요합니다.'
          : error instanceof Error && error.message
            ? error.message
            : '완성형 MP4 출력 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
        : failureMessage;
      if (downloadFile) {
        setProgressMessage(resolvedFailureMessage);
        setPreviewVideoMessage(resolvedFailureMessage);
      } else if (existingPreviewUrl && (existingPreviewStatus === 'ready' || existingPreviewStatus === 'fallback')) {
        setPreviewVideoStatus(existingPreviewStatus);
        setPreviewVideoMessage(existingPreviewMessage);
        setProgressMessage(resolvedFailureMessage);
      } else {
        setPreviewVideoStatus('error');
        setPreviewVideoMessage(resolvedFailureMessage);
        setProgressMessage(resolvedFailureMessage);
        setFinalVideoDuration(null);
      }
      return null;
    } finally {
      setIsVideoGenerating(false);
      if (!downloadFile) setIsPreparingPreviewVideo(false);
      window.setTimeout(() => setTaskProgressPercent(null), 1200);
    }
  }, [buildProjectEnhancementPatch, currentProjectSummary?.subtitlePreset, draft.aspectRatio, draft.topic, effectiveBackgroundTracks, finalVideoUrl, isVideoGenerating, openApiModal, persistSceneStudioSnapshot, previewMix, previewVideoMessage, previewVideoStatus, resolvedProjectId]);

  const handleRegenerateImage = async (index: number) => {
    if (!acquireSceneActionLock(index, 'image')) return;
    try {
      await enqueueGenerationTask(`씬 ${index + 1} 이미지 생성`, async () => {
        invalidateFinalPreview();
        updateAssetAt(index, { status: 'generating', selectedVisualType: 'image' });
        setTaskProgressPercent(12);
        setSceneProgress(index, 18, '이미지 다시 준비');
        setProgressMessage(`씬 ${index + 1} 이미지를 다시 만드는 중...`);
        try {
          const imageModel = getSelectedImageModel();
          const usesSampleImageFlow = isSampleImageModel(imageModel);
          const imageData = await generateImage(assetsRef.current[index], buildReferenceImages(), { qualityMode: 'final' });
          if (imageData) {
            updateAssetAt(index, {
              imageData,
              imageHistory: appendImageHistory(assetsRef.current[index], imageData, usesSampleImageFlow ? 'sample' : 'ai', usesSampleImageFlow ? '샘플 / 저부하 초안 이미지' : 'AI 재생성 이미지'),
              sourceMode: usesSampleImageFlow ? 'sample' : 'ai',
              status: 'completed',
              selectedVisualType: 'image',
            });
            syncSceneStudioWorkingCopy();
            if (!usesSampleImageFlow) {
              const price = PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;
              addCost('image', price, 1);
            }
            setSceneProgress(index, 100, usesSampleImageFlow ? '샘플 이미지 다시 준비 완료' : '이미지 다시 생성 완료');
            setTaskProgressPercent(100);
            window.setTimeout(() => setTaskProgressPercent(null), 700);
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
            selectedVisualType: 'image',
          });
          syncSceneStudioWorkingCopy();
          setSceneProgress(index, 100, '샘플 이미지로 교체 완료');
        } else {
          updateAssetAt(index, { status: 'completed', selectedVisualType: 'image' });
          syncSceneStudioWorkingCopy();
          setSceneProgress(index, 100, '이미지 다시 준비를 마쳤습니다.');
        }
        window.setTimeout(() => setTaskProgressPercent(null), 700);
      });
    } catch {}
    releaseSceneActionLock(index, 'image');
  };

  const handleRegenerateAudio = async (index: number) => {
    if (isMuteProject) return;
    if (!acquireSceneActionLock(index, 'audio')) return;
    try {
      await enqueueGenerationTask(`씬 ${index + 1} 오디오 생성`, async () => {
        invalidateFinalPreview();
        updateAssetAt(index, { status: 'generating' });
        setTaskProgressPercent(12);
        setSceneProgress(index, 24, '오디오 다시 생성');
        try {
          const audio = await generateSceneAudioAsset(assetsRef.current[index].narration);
          if (audio.audioData) {
            updateAssetAt(index, {
              audioData: audio.audioData,
              subtitleData: audio.subtitleData,
              audioDuration: audio.estimatedDuration,
              targetDuration: clampSceneDuration(audio.estimatedDuration || assetsRef.current[index].targetDuration || DEFAULT_SCENE_DURATION),
              status: 'completed',
            });
            syncSceneStudioWorkingCopy();
          } else {
            updateAssetAt(index, { status: 'completed' });
            syncSceneStudioWorkingCopy();
          }
          setSceneProgress(index, 100, '오디오 다시 생성 완료');
          setTaskProgressPercent(100);
        } catch {
          updateAssetAt(index, { status: 'completed' });
          syncSceneStudioWorkingCopy();
          setSceneProgress(index, 100, '오디오 생성 대기 상태로 복귀했습니다.');
        }
        window.setTimeout(() => setTaskProgressPercent(null), 700);
      });
    } catch {}
    releaseSceneActionLock(index, 'audio');
  };


  const handleDeleteAllGeneratedAudio = useCallback(async () => {
    const clearedAssets = assetsRef.current.map((asset) => {
      const nextStatus: GeneratedAsset['status'] = asset.status === 'error' ? 'error' : 'completed';
      return {
        ...asset,
        audioData: null,
        audioDuration: null,
        subtitleData: null,
        targetDuration: typeof asset.videoDuration === 'number'
          ? clampSceneDuration(asset.videoDuration)
          : clampSceneDuration(asset.targetDuration || DEFAULT_SCENE_DURATION),
        status: nextStatus,
      };
    });
    invalidateFinalPreview();
    assetsRef.current = clearedAssets;
    setGeneratedData([...clearedAssets]);
    syncSceneStudioWorkingCopy(clearedAssets);
    setProgressMessage('씬 오디오와 자막을 전체 삭제했습니다. 필요하면 다시 생성해 주세요.');
    if (resolvedProjectId) {
      await persistSceneStudioSnapshot(resolvedProjectId, {
        assets: clearedAssets,
        workflowDraft: buildSceneStudioWorkflowDraft(draft, clearedAssets),
        ...buildProjectEnhancementPatch(clearedAssets),
      });
    }
  }, [buildProjectEnhancementPatch, buildSceneStudioWorkflowDraft, draft, invalidateFinalPreview, persistSceneStudioSnapshot, resolvedProjectId, syncSceneStudioWorkingCopy]);

  const handleGenerateAnimation = async (index: number, options?: { sourceImageData?: string | null }) => {
    if (!acquireSceneActionLock(index, 'video')) return;
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    const sourceImageData = options?.sourceImageData?.trim() || assetsRef.current[index]?.imageData || null;
    if (!sourceImageData) {
      releaseSceneActionLock(index, 'video');
      return;
    }
    if (animatingIndices.has(index)) {
      releaseSceneActionLock(index, 'video');
      return;
    }

    try {
      await enqueueGenerationTask(`씬 ${index + 1} 영상 생성`, async () => {
        invalidateFinalPreview();
        updateAssetAt(index, { status: 'generating', selectedVisualType: 'video' });
        setAnimatingIndices((prev) => new Set(prev).add(index));
        setTaskProgressPercent(10);
        setSceneProgress(index, 20, falKey ? '영상 프롬프트 생성' : '샘플 영상 준비');
        const motionPrompt = await buildSceneMotionPrompt(assetsRef.current[index]);
        const videoResult = await generateVideoFromImage(
          sourceImageData,
          motionPrompt,
          falKey || undefined,
          assetsRef.current[index].aspectRatio || draft.aspectRatio || '16:9',
          'final',
          selectedVideoModel || undefined,
        );
        if (videoResult?.videoUrl) {
          const resolvedVideoDuration = clampSceneDuration(CONFIG.ANIMATION.VIDEO_DURATION);
          updateAssetAt(index, {
            videoData: videoResult.videoUrl,
            videoHistory: appendVideoHistory(assetsRef.current[index], videoResult.videoUrl, videoResult.sourceMode, videoResult.sourceMode === 'ai' ? 'AI 영상 변환' : '샘플 영상'),
            videoDuration: resolvedVideoDuration,
            targetDuration: resolvedVideoDuration,
            selectedVisualType: 'video',
            status: 'completed',
          });
          syncSceneStudioWorkingCopy();
          if (videoResult.sourceMode === 'ai') {
            addCost('video', PRICING.VIDEO.perVideo, 1);
          }
        } else {
          updateAssetAt(index, { status: 'completed' });
          syncSceneStudioWorkingCopy();
        }
        setSceneProgress(index, 100, videoResult?.sourceMode === 'sample' ? '샘플 영상 준비 완료' : '영상 변환 완료');
        setTaskProgressPercent(100);
      });
    } catch {}
    finally {
      setAnimatingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      if (assetsRef.current[index]?.status === 'generating') {
        updateAssetAt(index, { status: 'completed' });
        syncSceneStudioWorkingCopy();
      }
      releaseSceneActionLock(index, 'video');
      window.setTimeout(() => setTaskProgressPercent(null), 700);
    }
  };

  const handleGenerateAllVideos = useCallback(async () => {
    const falKey = studioState?.providers?.falApiKey || getFalApiKey();
    const availableIndices = assetsRef.current
      .map((asset, index) => ({ asset, index }))
      .filter(({ asset }) => Boolean(asset.imageData));
    if (!availableIndices.length) {
      setProgressMessage('먼저 전체 씬 이미지 생성 또는 개별 이미지 생성을 완료해 주세요.');
      return;
    }

    try {
      await enqueueGenerationTask('전체 씬 영상 생성', async () => {
        invalidateFinalPreview();
        setIsGeneratingAllVideos(true);
        setTaskProgressPercent(8);
        try {
          for (let order = 0; order < availableIndices.length; order += 1) {
            const { asset, index } = availableIndices[order];
            setTaskProgressPercent(10 + Math.round((order / Math.max(1, availableIndices.length)) * 78));
            setSceneProgress(index, 24, falKey ? '영상 프롬프트 생성' : '샘플 영상 준비');
            setProgressMessage(`씬 ${order + 1}/${availableIndices.length} ${falKey ? '전체 영상 생성' : '샘플 영상 준비'} 중...`);
            const motionPrompt = await buildSceneMotionPrompt(asset);
            const videoResult = await generateVideoFromImage(
              asset.imageData!,
              motionPrompt,
              falKey || undefined,
              asset.aspectRatio || draft.aspectRatio || '16:9',
              'final',
              selectedVideoModel || undefined,
            );
            if (videoResult?.videoUrl) {
              const resolvedVideoDuration = clampSceneDuration(CONFIG.ANIMATION.VIDEO_DURATION);
              updateAssetAt(index, {
                videoData: videoResult.videoUrl,
                videoHistory: appendVideoHistory(assetsRef.current[index], videoResult.videoUrl, videoResult.sourceMode, videoResult.sourceMode === 'ai' ? '전체 일괄 영상 생성' : '샘플 영상'),
                videoDuration: resolvedVideoDuration,
                targetDuration: resolvedVideoDuration,
                selectedVisualType: 'video',
              });
              syncSceneStudioWorkingCopy();
              if (videoResult.sourceMode === 'ai') {
                addCost('video', PRICING.VIDEO.perVideo, 1);
              }
            }
            setSceneProgress(index, 100, videoResult?.sourceMode === 'sample' ? '샘플 영상 준비 완료' : '영상 변환 완료');
            await wait(120);
          }
          setTaskProgressPercent(100);
          setProgressMessage(falKey ? '모든 씬의 영상 변환을 마쳤습니다. 미리보기에서 바로 확인할 수 있습니다.' : '모든 씬에 샘플 영상을 채웠습니다. API 없이도 영상 흐름을 바로 확인할 수 있습니다.');
        } finally {
          setIsGeneratingAllVideos(false);
          window.setTimeout(() => setTaskProgressPercent(null), 900);
        }
      });
    } catch {}
  }, [appendVideoHistory, buildSceneMotionPrompt, draft.aspectRatio, enqueueGenerationTask, invalidateFinalPreview, selectedVideoModel, studioState, updateAssetAt]);

  const triggerVideoExport = async (options: { enableSubtitles: boolean; qualityMode: 'preview' | 'final' }) => {
    await flushPendingSceneStudioSave({
      ...buildProjectEnhancementPatch(assetsRef.current),
      workflowDraft: buildSceneStudioWorkflowDraft(draft, assetsRef.current),
    });
    await renderMergedVideo({
      enableSubtitles: options.enableSubtitles,
      qualityMode: options.qualityMode,
      downloadFile: true,
    });
  };

  const handlePreparePreviewVideo = useCallback(async () => {
    if (isPreparingPreviewVideo || isVideoGenerating) return;
    try {
      await enqueueGenerationTask('합본 영상 렌더링', async () => {
        await flushPendingSceneStudioSave({
          ...buildProjectEnhancementPatch(assetsRef.current),
          workflowDraft: buildSceneStudioWorkflowDraft(draft, assetsRef.current),
        });
        await renderMergedVideo({
          enableSubtitles: false,
          qualityMode: 'preview',
          downloadFile: false,
          customTitle: `${draft.topic || '프로젝트'} 합본 미리보기`,
        });
      });
    } catch {}
  }, [buildProjectEnhancementPatch, buildSceneStudioWorkflowDraft, draft, enqueueGenerationTask, flushPendingSceneStudioSave, isPreparingPreviewVideo, isVideoGenerating, renderMergedVideo]);

  const handlePreviewMixChange = useCallback((nextMix: PreviewMixSettings) => {
    setPreviewMix((prev) => {
      const currentMix = prev || getDefaultPreviewMix();
      const nextNarrationVolume = typeof nextMix.narrationVolume === 'number' ? nextMix.narrationVolume : currentMix.narrationVolume;
      const nextBackgroundMusicVolume = typeof nextMix.backgroundMusicVolume === 'number' ? nextMix.backgroundMusicVolume : currentMix.backgroundMusicVolume;
      const hasChanged = currentMix.narrationVolume !== nextNarrationVolume || currentMix.backgroundMusicVolume !== nextBackgroundMusicVolume;
      if (hasChanged) {
        invalidateFinalPreview('볼륨 설정이 바뀌어 합본 영상을 다시 렌더링해야 합니다.');
      }
      return {
        narrationVolume: nextNarrationVolume,
        backgroundMusicVolume: nextBackgroundMusicVolume,
      };
    });
  }, [invalidateFinalPreview]);

  const handleNarrationChange = (index: number, narration: string) => {
    invalidateFinalPreview();
    updateAssetAt(index, { narration });
    syncSceneStudioWorkingCopy();
  };

  const handleImagePromptChange = (index: number, prompt: string) => {
    invalidateFinalPreview();
    updateAssetAt(index, { imagePrompt: prompt, visualPrompt: prompt || assetsRef.current[index].visualPrompt });
    syncSceneStudioWorkingCopy();
  };

  const handleVideoPromptChange = (index: number, prompt: string) => {
    invalidateFinalPreview();
    updateAssetAt(index, { videoPrompt: prompt });
    syncSceneStudioWorkingCopy();
  };

  const handleSelectedVisualTypeChange = (index: number, mode: 'image' | 'video') => {
    const asset = assetsRef.current[index];
    const safeMode = mode === 'video' && asset?.videoData ? 'video' : 'image';
    invalidateFinalPreview();
    updateAssetAt(index, { selectedVisualType: safeMode });
    syncSceneStudioWorkingCopy();
  };

  const handleDurationChange = (index: number, duration: number) => {
    invalidateFinalPreview();
    updateAssetAt(index, { targetDuration: Math.max(DEFAULT_SCENE_DURATION, clampSceneDuration(duration)) });
    syncSceneStudioWorkingCopy();
  };

  const handleDeleteParagraphScene = useCallback((index: number) => {
    const targetAsset = assetsRef.current[index];
    if (!targetAsset) return;
    if (assetsRef.current.length <= 1) {
      window.alert('마지막 문단은 삭제할 수 없습니다. 새 문단을 추가한 뒤 정리해 주세요.');
      return;
    }
    const confirmed = window.confirm(`씬 ${targetAsset.sceneNumber} 문단을 삭제할까요? 삭제한 뒤에는 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    invalidateFinalPreview();
    const nextAssets = assetsRef.current
      .filter((_, assetIndex) => assetIndex !== index)
      .map((asset, assetIndex) => ({
        ...asset,
        sceneNumber: assetIndex + 1,
      }));

    assetsRef.current = nextAssets;
    setGeneratedData([...nextAssets]);
    syncSceneStudioWorkingCopy(nextAssets);
    if (resolvedProjectId) {
      void persistSceneStudioSnapshot(resolvedProjectId, {
        assets: nextAssets,
        workflowDraft: buildSceneStudioWorkflowDraft(draft, nextAssets),
        ...buildProjectEnhancementPatch(nextAssets),
      });
    }
    setSceneProgressMap((prev) => {
      const entries = Object.entries(prev)
        .filter(([key]) => Number(key) !== index)
        .sort((a, b) => Number(a[0]) - Number(b[0]));
      return entries.reduce<Record<number, { percent: number; label: string }>>((acc, [key, value]) => {
        const numericKey = Number(key);
        const nextKey = numericKey > index ? numericKey - 1 : numericKey;
        acc[nextKey] = value;
        return acc;
      }, {});
    });
    setProgressMessage(`씬 ${targetAsset.sceneNumber} 문단을 삭제했습니다.`);
  }, [buildProjectEnhancementPatch, buildSceneStudioWorkflowDraft, draft, invalidateFinalPreview, persistSceneStudioSnapshot, resolvedProjectId, syncSceneStudioWorkingCopy]);

  const handleAddParagraphScene = useCallback(() => {
    invalidateFinalPreview();
    const nextSceneNumber = assetsRef.current.length + 1;
    const nextAssetBase = (draft.script || '').trim()
      ? createAdditionalSceneAssetFromDraft(draft, nextSceneNumber)
      : createEmptySceneAssetsFromDraft(draft, nextSceneNumber, 1)[0];
    const nextAsset = {
      ...nextAssetBase,
      targetDuration: DEFAULT_SCENE_DURATION,
      audioDuration: null,
      videoDuration: null,
    };
    assetsRef.current = [...assetsRef.current, nextAsset];
    setGeneratedData([...assetsRef.current]);
    syncSceneStudioWorkingCopy(assetsRef.current);
    if (resolvedProjectId) {
      void persistSceneStudioSnapshot(resolvedProjectId, {
        assets: assetsRef.current,
        workflowDraft: buildSceneStudioWorkflowDraft(draft, assetsRef.current),
        ...buildProjectEnhancementPatch(assetsRef.current),
      });
    }
    setStep(GenerationStep.COMPLETED);
    setProgressMessage((draft.script || '').trim()
      ? '새 문단 장면을 추가했습니다. 무음 프로젝트도 대사 없이 이미지 / 영상 프롬프트를 바로 수정하며 이어서 제작할 수 있습니다.'
      : '빈 씬 카드를 추가했습니다. 대사 없이 이미지 / 영상 프롬프트만 채워 무음 영상 흐름으로 바로 이어서 제작할 수 있습니다.');
  }, [buildProjectEnhancementPatch, buildSceneStudioWorkflowDraft, draft, invalidateFinalPreview, persistSceneStudioSnapshot, resolvedProjectId, syncSceneStudioWorkingCopy]);

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
        settings: buildProjectSettingsSnapshot({
          routing: studioState?.routing,
          workflowDraft: draft,
          fallback: {
            imageModel: studioState?.routing?.imageModel || getSelectedImageModel(),
            outputMode: 'video',
            elevenLabsModel: studioState?.routing?.audioModel || 'eleven_multilingual_v2',
          },
        }),
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
      const nextWorkflowDraft = buildSceneStudioWorkflowDraft(draft, generatedData);
      const projectEnhancementPatch = buildProjectEnhancementPatch(generatedData, {
        thumbnailPrompt: sampleThumbnail.prompt,
      });

      await updateProject(currentProjectId, {
        ...projectEnhancementPatch,
        assets: generatedData,
        backgroundMusicTracks,
        previewMix,
        workflowDraft: nextWorkflowDraft,
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
  }, [backgroundMusicTracks, buildProjectEnhancementPatch, buildReferenceImages, buildSceneStudioWorkflowDraft, currentProjectId, draft, generatedData, isThumbnailGenerating, previewMix, studioState?.routing?.audioModel, studioState?.routing?.imageModel]);


  const renderSummarySection = () => {
    if (summarySection === 'step1') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">콘텐츠 유형</div><div className="mt-2 text-sm font-black text-slate-900">{draft.contentType ? getContentTypeLabel(draft.contentType) : '미설정'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">화면 비율</div><div className="mt-2 text-sm font-black text-slate-900">{draft.aspectRatio || '16:9'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">프로젝트 번호</div><div className="mt-2 text-sm font-black text-slate-900">{currentProjectSummary?.projectNumber ? `#${currentProjectSummary.projectNumber}` : '미지정'}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">완료 단계</div><div className="mt-2 text-sm font-black text-slate-900">{Object.values(draft.completedSteps || {}).filter(Boolean).length} / 5</div></div>
          </div>
          {renderSummaryJsonCard('1단계 검토용 JSON', summaryJsonBySection.step1)}
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
          {renderSummaryJsonCard('2단계 검토용 JSON', summaryJsonBySection.step2)}
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
          {renderSummaryJsonCard('3단계 검토용 JSON', summaryJsonBySection.step3, 'blue')}
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
          {renderSummaryJsonCard('4단계 검토용 JSON', summaryJsonBySection.step4)}
        </div>
      );
    }
    if (summarySection === 'step5') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">선택된 최종 화풍</div><div className="mt-2 text-sm font-black text-slate-900">{summarySelectedStyle?.groupLabel || summarySelectedStyle?.label || '미선택'}</div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{summarySelectedStyle?.prompt || '저장된 화풍 프롬프트가 없습니다.'}</div></div>
          <div className="space-y-3">{draft.styleImages.length ? draft.styleImages.map((style) => <div key={style.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-black text-slate-900">{style.groupLabel || style.label}</div><div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{style.id === draft.selectedStyleImageId ? '현재 선택' : style.sourceMode === 'sample' ? '샘플' : style.sourceMode === 'upload' ? '업로드' : '추천 카드'}</div></div><div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{style.prompt}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">저장된 화풍 카드가 없습니다.</div>}</div>
          {renderSummaryJsonCard('5단계 검토용 JSON', summaryJsonBySection.step5, 'violet')}
        </div>
      );
    }
    const step2Summary = (summaryJsonBySection.step6.usedInputs.step2 || {}) as {
      resolvedTopic?: string;
      selections?: {
        genre?: string;
        mood?: string;
        setting?: string;
        protagonist?: string;
        conflict?: string;
        endingTone?: string;
      };
    };
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
            <div><span className="font-black text-slate-900">기본:</span> {getContentTypeLabel(draft.contentType)} · {draft.aspectRatio} · 주제 {step2Summary.resolvedTopic || '미입력'}</div>
            <div><span className="font-black text-slate-900">2단계 입력:</span> 장르 {step2Summary.selections?.genre || '미입력'} · 분위기 {step2Summary.selections?.mood || '미입력'} · 배경 {step2Summary.selections?.setting || '미입력'} · 주인공 {step2Summary.selections?.protagonist || '미입력'} · 갈등 {step2Summary.selections?.conflict || '미입력'} · 결말 {step2Summary.selections?.endingTone || '미입력'}</div>
            <div><span className="font-black text-slate-900">대본 소스:</span> {draft.scriptGenerationMeta?.source === 'ai' ? 'AI 생성' : draft.scriptGenerationMeta?.source === 'sample' ? '샘플 생성' : draft.script?.trim() ? '직접 입력 / 수정' : '미생성'} · 프롬프트 카드 {summaryPromptTransfer.selectedPromptTemplateName || '없음'}</div>
            <div><span className="font-black text-slate-900">선택 출연자:</span> {summaryCharacters.map((item) => item.name).join(', ') || '없음'}</div>
            <div><span className="font-black text-slate-900">캐릭터 스타일:</span> {draft.selectedCharacterStyleLabel || '미선택'}</div>
            <div><span className="font-black text-slate-900">최종 화풍:</span> {summarySelectedStyle?.groupLabel || summarySelectedStyle?.label || '미선택'}</div>
            <div><span className="font-black text-slate-900">씬 생성 기준 프롬프트:</span> {summaryPromptTransfer.scenePrompt || '없음'}</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { label: '프롬프트 카드', comment: 'Step3에서 선택한 프롬프트 카드 이름', value: summaryPromptTransfer.selectedPromptTemplateName || '없음' },
            { label: '스토리 프롬프트', comment: '대본 전체 흐름을 잡는 기준값', value: summaryPromptTransfer.storyPrompt || '없음' },
            { label: '씬 프롬프트', comment: '씬 분해와 장면 설명 생성에 쓰는 값', value: summaryPromptTransfer.scenePrompt || '없음' },
            { label: '캐릭터 프롬프트', comment: '출연자 외형/톤 유지 기준값', value: summaryPromptTransfer.characterPrompt || '없음' },
            { label: '액션 프롬프트', comment: '모션/행동 연출 기준값', value: summaryPromptTransfer.actionPrompt || '없음' },
            { label: '이미지 프롬프트 묶음', comment: '현재 문단별 이미지 프롬프트 전체 묶음', value: summaryPromptTransfer.imagePromptBundle || '없음' },
            { label: '영상 프롬프트 묶음', comment: '현재 문단별 영상 프롬프트 전체 묶음', value: summaryPromptTransfer.videoPromptBundle || '없음' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{item.label}</div>
              <div className="mt-2 text-[11px] leading-5 text-slate-500">주석: {item.comment}</div>
              <div className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">{item.value}</div>
            </div>
          ))}
        </div>
        {renderSummaryJsonCard('6단계 최종 전달 JSON', summaryJsonBySection.step6, 'blue')}
        {renderSummaryJsonCard('Step1~6 전체 검토 JSON', summaryJsonBySection.all)}
      </div>
    );
  };

  return (
    <div className="mp4-shell min-h-screen text-slate-900">
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
        liveApiCostTotal={currentCost?.total ?? null}
        onGoGallery={async () => {
          setNavigationOverlay({
            title: '프로젝트 보관함을 여는 중',
            description: '현재 씬 작업은 저장된 상태로 유지하고, 보관함 목록으로 이동합니다.',
          });
          await flushPendingSceneStudioSave({
            ...buildProjectEnhancementPatch(assetsRef.current),
            workflowDraft: buildSceneStudioWorkflowDraft(draft, assetsRef.current),
          });
          try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
          router.push(`${basePath}?view=gallery`, { scroll: true });
        }}
      />
      <SettingsDrawer open={showSettings} studioState={studioState} onClose={() => setShowSettings(false)} onSave={handleSaveStudioState} />
      <ProviderQuickModal open={showApiModal} studioState={studioState} title={apiModalTitle} description={apiModalDescription} focusField={apiModalFocusField} onClose={handleApiModalClose} onSave={handleSaveStudioState} onOpenFullSettings={() => { setShowApiModal(false); setShowSettings(true); }} />

      <main className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <SceneStudioHeaderPanel
          isThumbnailStudioRoute={isThumbnailStudioRoute}
          currentProjectNumber={currentProjectSummary?.projectNumber || null}
          isGeneratingScenes={isGeneratingScenes}
          isGeneratingAllVideos={isGeneratingAllVideos}
          step4Open={step4Open}
          summarySection={summarySection}
          summarySections={summarySections}
          onOpenSummary={() => setStep4Open(true)}
          onCloseSummary={() => setStep4Open(false)}
          onSelectSummarySection={setSummarySection}
          onGenerateImages={() => void handleGenerate({ preserveExistingCards: true, generateAudio: false })}
          onGenerateImagesWithAudio={() => void handleGenerate({ preserveExistingCards: true, generateAudio: true })}
          onGenerateAllVideos={() => void handleGenerateAllVideos()}
          renderSummarySection={renderSummarySection}
        />

        {step !== GenerationStep.IDLE && progressMessage && !generatedData.length && (
          <div className="my-6 text-center">
            <div className="mp4-glass-panel inline-flex min-w-[320px] max-w-[560px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              {typeof taskProgressPercent === 'number' && (
                <div className="w-full">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <span>Loading</span>
                    <span>{Math.max(0, Math.min(100, Math.round(taskProgressPercent)))}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, Math.round(taskProgressPercent)))}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="inline-flex flex-wrap items-center justify-center gap-3">
              {step === GenerationStep.SCRIPTING || step === GenerationStep.ASSETS ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> : <div className={`h-2.5 w-2.5 rounded-full ${step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-emerald-500'}`} />}
              <span className="text-sm font-bold text-slate-700">{progressMessage}</span>
              </div>
            </div>
          </div>
        )}

        {!(isProjectHydrating && !generatedData.length) && (
        <SceneStudioResultPanel
          data={generatedData}
          onRegenerateImage={handleRegenerateImage}
          onRegenerateAudio={handleRegenerateAudio}
          onDeleteAllAudio={() => void handleDeleteAllGeneratedAudio()}
          onExportVideo={triggerVideoExport}
          onGenerateAnimation={handleGenerateAnimation}
          onNarrationChange={handleNarrationChange}
          onImagePromptChange={handleImagePromptChange}
          onVideoPromptChange={handleVideoPromptChange}
          onSelectedVisualTypeChange={handleSelectedVisualTypeChange}
          onDurationChange={handleDurationChange}
          onAddParagraphScene={handleAddParagraphScene}
          onOpenSettings={() => setShowSettings(true)}
          onRequestProviderSetup={(kind) => openApiModal({
            title: kind === 'audio' ? '오디오 / 자막 기능 연결' : kind === 'video' ? '영상 기능 연결' : '텍스트 AI 연결',
            description: kind === 'audio'
              ? '현재 위치에서 바로 오디오와 자막 생성을 이어가려면 ElevenLabs 키를 연결해 주세요.'
              : kind === 'video'
                ? '현재 위치에서 바로 영상 변환을 이어가려면 Google AI Studio 키를 연결해 주세요.'
                : '현재 위치에서 바로 AI 보조 기능을 쓰려면 Google AI Studio 키를 연결해 주세요.',
            focusField: kind === 'audio' ? 'elevenLabs' : 'openRouter',
          })}
          isExporting={isVideoGenerating}
          animatingIndices={animatingIndices}
          backgroundMusicTracks={backgroundMusicTracks}
          activeBackgroundTrackId={activeBackgroundTrackId}
          onSelectBackgroundTrack={handleSelectBackgroundTrack}
          onCreateBackgroundTrack={createAnotherBackgroundTrack}
          onDeleteBackgroundTrack={handleDeleteBackgroundTrack}
          onExtendBackgroundTrack={handleExtendBackgroundTrack}
          backgroundMusicSceneConfig={backgroundMusicSceneConfig}
          onBackgroundMusicSceneChange={updateBackgroundMusicScene}
          onAutoFillBackgroundMusicMood={handleAutoFillBackgroundMusicMood}
          isMuteMode={isMuteProject}
          previewMix={previewMix}
          onPreviewMixChange={handlePreviewMixChange}
          currentTopic={draft.topic}
          totalCost={currentCost || undefined}
          isGenerating={isGeneratingScenes}
          progressMessage={progressMessage}
          progressPercent={taskProgressPercent}
          progressLabel={isVideoGenerating ? '최종 MP4 출력 진행률' : isGeneratingAllVideos ? '전체 씬 영상 생성 진행률' : isGeneratingScenes ? '씬 생성 진행률' : '현재 작업 진행률'}
          sceneProgressMap={sceneProgressMap}
          finalVideoUrl={finalVideoUrl}
          finalVideoTitle={finalVideoTitle}
          finalVideoDuration={finalVideoDuration}
          previewVideoStatus={previewVideoStatus}
          previewVideoMessage={previewVideoMessage}
          onPreparePreviewVideo={handlePreparePreviewVideo}
          isPreparingPreviewVideo={isPreparingPreviewVideo}
          onGenerateThumbnail={handleGenerateThumbnail}
          isThumbnailGenerating={isThumbnailGenerating}
          onGenerateAllImages={() => void handleGenerate({ preserveExistingCards: true, generateAudio: false })}
          onGenerateAllVideos={() => void handleGenerateAllVideos()}
          isGeneratingAllVideos={isGeneratingAllVideos}
          imageModelSelector={{
            currentId: selectedImageModelId,
            currentLabel: selectedImageModelLabel,
            options: quickImageModelOptions,
            onSelect: handleQuickImageModelSelect,
          }}
          videoModelSelector={{
            currentId: selectedVideoModel,
            currentLabel: selectedVideoModelLabel,
            options: quickVideoModelOptions,
            onSelect: handleQuickVideoModelSelect,
          }}
          audioModelSelector={{
            currentId: selectedAudioModelMeta.currentId,
            currentLabel: selectedAudioModelMeta.currentLabel,
            options: quickAudioModelOptions,
            onSelect: handleQuickAudioModelSelect,
          }}
          onFooterBack={handleGoBackToWorkflow}
          footerBackLabel="이전으로"
          thumbnailToolbarRef={thumbnailToolbarRef}
          onDeleteParagraphScene={handleDeleteParagraphScene}
          storageDir={studioState.storageDir}
          projectId={currentProjectId}
          projectNumber={currentProjectSummary?.projectNumber || null}
        />
        )}
      </main>
    </div>
  );
};

export default SceneStudioPage;
