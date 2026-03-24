/**
 * 프로젝트 저장/로드 서비스
 * - 기본은 브라우저 IndexedDB 백업
 * - 가능하면 Next API를 통해 로컬 JSON 파일에도 동기화
 */

import { CONFIG } from '../config';
import { SavedProject, GeneratedAsset, CostBreakdown, BackgroundMusicTrack, PreviewMixSettings, WorkflowDraft, AudioPreviewAsset, VideoPreviewAsset, ScriptParagraphPlan, ScenePlanItem, TtsFileItem, SubtitlePresetState, YoutubeConnectedAccountInfo, YoutubeUploadStatus } from '../types';
import { getSelectedImageModel } from './imageService';
import { compactWorkflowDraftForStorage, createSelectedWorkflowDraftForTransport } from './workflowDraftService';
import { deleteStudioProjects, fetchStudioProjectById, fetchStudioProjects, getCachedStudioState, saveProjectsToStudio, saveStudioProject, summarizeProjectForIndex } from './localFileApi';

const DB_NAME = 'TubeGenAI';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const STUDIO_SYNC_DEBOUNCE_MS = 120;

let pendingStudioSyncProjects: SavedProject[] | null = null;
let studioSyncTimer: ReturnType<typeof setTimeout> | null = null;
let studioSyncInFlight = false;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function createThumbnail(imageSource: string, maxWidth: number = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageSource.slice(0, 1000));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
    img.onerror = () => resolve('');
    img.src = imageSource.startsWith('data:') || imageSource.startsWith('/') || imageSource.startsWith('http')
      ? imageSource
      : `data:image/png;base64,${imageSource}`;
  });
}


function normalizeAssetHistory(items: any, kind: 'image' | 'video') {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.data === 'string' && item.data)
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `${kind}_${Date.now()}_${index}`,
      kind,
      data: item.data,
      sourceMode: item.sourceMode === 'ai' ? ('ai' as const) : ('sample' as const),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      label: typeof item.label === 'string' ? item.label : undefined,
    }));
}

function normalizeAsset(asset: any, index: number): GeneratedAsset {
  return {
    sceneNumber: typeof asset?.sceneNumber === 'number' ? asset.sceneNumber : index + 1,
    narration: typeof asset?.narration === 'string' ? asset.narration : '',
    visualPrompt: typeof asset?.visualPrompt === 'string' ? asset.visualPrompt : '',
    imagePrompt: typeof asset?.imagePrompt === 'string' ? asset.imagePrompt : (typeof asset?.visualPrompt === 'string' ? asset.visualPrompt : ''),
    videoPrompt: typeof asset?.videoPrompt === 'string' ? asset.videoPrompt : '',
    analysis: asset?.analysis,
    imageData: typeof asset?.imageData === 'string' ? asset.imageData : null,
    audioData: typeof asset?.audioData === 'string' ? asset.audioData : null,
    audioDuration: typeof asset?.audioDuration === 'number' ? asset.audioDuration : null,
    subtitleData: asset?.subtitleData ?? null,
    videoData: typeof asset?.videoData === 'string' ? asset.videoData : null,
    videoDuration: typeof asset?.videoDuration === 'number' ? asset.videoDuration : null,
    targetDuration: typeof asset?.targetDuration === 'number' ? asset.targetDuration : (typeof asset?.audioDuration === 'number' ? asset.audioDuration : 5),
    aspectRatio: asset?.aspectRatio === '1:1' || asset?.aspectRatio === '9:16' ? asset.aspectRatio : '16:9',
    imageHistory: normalizeAssetHistory(asset?.imageHistory, 'image'),
    videoHistory: normalizeAssetHistory(asset?.videoHistory, 'video'),
    selectedVisualType: asset?.selectedVisualType === 'video' ? 'video' : 'image',
    status: asset?.status === 'generating' || asset?.status === 'completed' || asset?.status === 'error' ? asset.status : 'pending',
    sourceMode: asset?.sourceMode === 'ai' ? 'ai' : 'sample',
  };
}

function normalizePreviewMix(mix: any): PreviewMixSettings | undefined {
  if (!mix || typeof mix !== 'object') return undefined;
  return {
    narrationVolume: typeof mix.narrationVolume === 'number' ? mix.narrationVolume : 1,
    backgroundMusicVolume: typeof mix.backgroundMusicVolume === 'number' ? mix.backgroundMusicVolume : 0.28,
  };
}

function normalizeTrack(track: any, index: number): BackgroundMusicTrack {
  return {
    id: typeof track?.id === 'string' ? track.id : `bgm_${Date.now()}_${index}`,
    title: typeof track?.title === 'string' ? track.title : `배경음 ${index + 1}`,
    prompt: typeof track?.prompt === 'string' ? track.prompt : '',
    audioData: typeof track?.audioData === 'string' ? track.audioData : null,
    duration: typeof track?.duration === 'number' ? track.duration : null,
    volume: typeof track?.volume === 'number' ? track.volume : 0.28,
    sourceMode: track?.sourceMode === 'ai' ? 'ai' : 'sample',
    createdAt: typeof track?.createdAt === 'number' ? track.createdAt : Date.now(),
  };
}

function normalizeAudioPreview(item: any): AudioPreviewAsset | null {
  if (!item || typeof item !== 'object') return null;
  return {
    id: typeof item.id === 'string' ? item.id : `audio_${Date.now()}`,
    title: typeof item.title === 'string' ? item.title : '오디오',
    text: typeof item.text === 'string' ? item.text : '',
    audioData: typeof item.audioData === 'string' ? item.audioData : null,
    duration: typeof item.duration === 'number' ? item.duration : null,
    provider: item.provider === 'elevenLabs' ? 'elevenLabs' : item.provider === 'qwen3Tts' ? 'qwen3Tts' : item.provider === 'chatterbox' ? 'chatterbox' : item.provider === 'heygen' ? 'heygen' : 'sample',
    mode: item.mode === 'script-preview' || item.mode === 'final-output' ? item.mode : 'voice-preview',
    sourceMode: item.sourceMode === 'ai' ? 'ai' : 'sample',
    voiceId: typeof item.voiceId === 'string' ? item.voiceId : null,
    modelId: typeof item.modelId === 'string' ? item.modelId : null,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
  };
}

function normalizeVideoPreview(item: any): VideoPreviewAsset | null {
  if (!item || typeof item !== 'object') return null;
  return {
    id: typeof item.id === 'string' ? item.id : `video_${Date.now()}`,
    title: typeof item.title === 'string' ? item.title : '뮤직비디오',
    prompt: typeof item.prompt === 'string' ? item.prompt : '',
    videoData: typeof item.videoData === 'string' ? item.videoData : null,
    provider: item.provider === 'elevenLabs' ? 'elevenLabs' : 'sample',
    mode: item.mode === 'final' ? 'final' : 'preview',
    sourceMode: item.sourceMode === 'ai' ? 'ai' : 'sample',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
  };
}

function normalizePromptedImages(items: any, kind: 'character' | 'style' | 'thumbnail') {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.imageData === 'string' && item.imageData)
    .map((item, index) => {
      const sourceMode: 'ai' | 'sample' | 'upload' =
        item.sourceMode === 'ai' ? 'ai' : item.sourceMode === 'upload' ? 'upload' : 'sample';
      return {
        id: typeof item.id === 'string' ? item.id : `${kind}_${Date.now()}_${index}`,
        label: typeof item.label === 'string' ? item.label : `${kind} ${index + 1}`,
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        imageData: item.imageData,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        kind,
        sourceMode,
        selected: Boolean(item.selected),
        note: typeof item.note === 'string' ? item.note : undefined,
        groupId: typeof item.groupId === 'string' ? item.groupId : undefined,
        groupLabel: typeof item.groupLabel === 'string' ? item.groupLabel : undefined,
      };
    });
}

function normalizeProject(raw: any): SavedProject {
  const topic = typeof raw?.topic === 'string' ? raw.topic : (typeof raw?.name === 'string' ? raw.name : 'Untitled Project');
  const assets = Array.isArray(raw?.assets) ? raw.assets.map(normalizeAsset) : [];
  const rawSettings = raw?.settings ?? raw ?? {};

  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: typeof raw?.name === 'string' && raw.name ? raw.name : `${topic.slice(0, 30)}${topic.length > 30 ? '...' : ''}`,
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now(),
    topic,
    projectNumber: typeof raw?.projectNumber === 'number' ? raw.projectNumber : undefined,
    folderName: typeof raw?.folderName === 'string' ? raw.folderName : undefined,
    folderPath: typeof raw?.folderPath === 'string' ? raw.folderPath : undefined,
    lastSavedAt: typeof raw?.lastSavedAt === 'number' ? raw.lastSavedAt : (typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now()),
    settings: {
      imageModel: typeof rawSettings?.imageModel === 'string' && rawSettings.imageModel
        ? rawSettings.imageModel
        : CONFIG.DEFAULT_IMAGE_MODEL,
      videoModel: typeof rawSettings?.videoModel === 'string' && rawSettings.videoModel
        ? rawSettings.videoModel
        : CONFIG.DEFAULT_VIDEO_MODEL,
      scriptModel: typeof rawSettings?.scriptModel === 'string' && rawSettings.scriptModel
        ? rawSettings.scriptModel
        : CONFIG.DEFAULT_SCRIPT_MODEL,
      sceneModel: typeof rawSettings?.sceneModel === 'string' && rawSettings.sceneModel
        ? rawSettings.sceneModel
        : CONFIG.DEFAULT_SCRIPT_MODEL,
      outputMode: rawSettings?.outputMode === 'image' ? 'image' : 'video',
      elevenLabsModel: typeof rawSettings?.elevenLabsModel === 'string' && rawSettings.elevenLabsModel
        ? rawSettings.elevenLabsModel
        : CONFIG.DEFAULT_ELEVENLABS_MODEL,
      fluxStyle: typeof rawSettings?.fluxStyle === 'string' ? rawSettings.fluxStyle : undefined,
    },
    assets,
    thumbnail: typeof raw?.thumbnail === 'string' ? raw.thumbnail : null,
    thumbnailTitle: typeof raw?.thumbnailTitle === 'string' ? raw.thumbnailTitle : null,
    thumbnailPrompt: typeof raw?.thumbnailPrompt === 'string' ? raw.thumbnailPrompt : null,
    thumbnailHistory: normalizePromptedImages(raw?.thumbnailHistory, 'thumbnail'),
    selectedThumbnailId: typeof raw?.selectedThumbnailId === 'string' ? raw.selectedThumbnailId : null,
    cost: raw?.cost && typeof raw.cost === 'object' ? {
      images: typeof raw.cost.images === 'number' ? raw.cost.images : 0,
      tts: typeof raw.cost.tts === 'number' ? raw.cost.tts : 0,
      videos: typeof raw.cost.videos === 'number' ? raw.cost.videos : 0,
      total: typeof raw.cost.total === 'number' ? raw.cost.total : 0,
      imageCount: typeof raw.cost.imageCount === 'number' ? raw.cost.imageCount : assets.filter((a: any) => a.imageData).length,
      ttsCharacters: typeof raw.cost.ttsCharacters === 'number' ? raw.cost.ttsCharacters : 0,
      videoCount: typeof raw.cost.videoCount === 'number' ? raw.cost.videoCount : assets.filter((a: any) => a.videoData).length,
    } : undefined,
    backgroundMusicTracks: Array.isArray(raw?.backgroundMusicTracks) ? raw.backgroundMusicTracks.map(normalizeTrack) : [],
    previewMix: normalizePreviewMix(raw?.previewMix),
    workflowDraft: raw?.workflowDraft ?? null,
    voicePreviewAsset: normalizeAudioPreview(raw?.voicePreviewAsset),
    scriptPreviewAsset: normalizeAudioPreview(raw?.scriptPreviewAsset),
    finalVoiceAsset: normalizeAudioPreview(raw?.finalVoiceAsset),
    backgroundMusicPreview: raw?.backgroundMusicPreview ? normalizeTrack(raw?.backgroundMusicPreview, 0) : null,
    finalBackgroundMusic: raw?.finalBackgroundMusic ? normalizeTrack(raw?.finalBackgroundMusic, 0) : null,
    musicVideoPreview: normalizeVideoPreview(raw?.musicVideoPreview),
    finalMusicVideo: normalizeVideoPreview(raw?.finalMusicVideo),
    script: typeof raw?.script === 'string' ? raw.script : null,
    scriptParagraphs: Array.isArray(raw?.scriptParagraphs)
      ? raw.scriptParagraphs
          .filter((item: any) => item && typeof item.text === 'string')
          .map((item: any, index: number) => ({
            id: typeof item.id === 'string' ? item.id : `paragraph_${Date.now()}_${index}`,
            index: typeof item.index === 'number' ? item.index : index,
            text: item.text,
            estimatedSeconds: typeof item.estimatedSeconds === 'number' ? item.estimatedSeconds : 0,
            startAt: typeof item.startAt === 'number' ? item.startAt : undefined,
            endAt: typeof item.endAt === 'number' ? item.endAt : undefined,
          } satisfies ScriptParagraphPlan))
      : [],
    sceneList: Array.isArray(raw?.sceneList)
      ? raw.sceneList
          .filter((item: any) => item && typeof item.narration === 'string')
          .map((item: any, index: number) => ({
            id: typeof item.id === 'string' ? item.id : `scene_plan_${Date.now()}_${index}`,
            sceneNumber: typeof item.sceneNumber === 'number' ? item.sceneNumber : index + 1,
            paragraphId: typeof item.paragraphId === 'string' ? item.paragraphId : null,
            narration: item.narration,
            imagePrompt: typeof item.imagePrompt === 'string' ? item.imagePrompt : undefined,
            videoPrompt: typeof item.videoPrompt === 'string' ? item.videoPrompt : undefined,
            motionPrompt: typeof item.motionPrompt === 'string' ? item.motionPrompt : undefined,
            estimatedSeconds: typeof item.estimatedSeconds === 'number' ? item.estimatedSeconds : 0,
            targetDuration: typeof item.targetDuration === 'number' ? item.targetDuration : 5,
            sceneSourceType: item.sceneSourceType === 'ai' || item.sceneSourceType === 'free-media' || item.sceneSourceType === 'sample' || item.sceneSourceType === 'mixed'
              ? item.sceneSourceType
              : undefined,
            sourceAssetUrl: typeof item.sourceAssetUrl === 'string' ? item.sourceAssetUrl : null,
          } satisfies ScenePlanItem))
      : [],
    sceneDuration: typeof raw?.sceneDuration === 'number' ? raw.sceneDuration : null,
    ttsFiles: Array.isArray(raw?.ttsFiles)
      ? raw.ttsFiles
          .filter((item: any) => item && typeof item.sceneNumber === 'number')
          .map((item: any, index: number) => ({
            id: typeof item.id === 'string' ? item.id : `tts_${Date.now()}_${index}`,
            sceneNumber: item.sceneNumber,
            paragraphId: typeof item.paragraphId === 'string' ? item.paragraphId : null,
            provider: item.provider === 'elevenLabs' || item.provider === 'qwen3Tts' || item.provider === 'heygen' ? item.provider : 'sample',
            voiceId: typeof item.voiceId === 'string' ? item.voiceId : null,
            modelId: typeof item.modelId === 'string' ? item.modelId : null,
            duration: typeof item.duration === 'number' ? item.duration : 0,
            audioData: typeof item.audioData === 'string' ? item.audioData : null,
          } satisfies TtsFileItem))
      : [],
    ttsDuration: typeof raw?.ttsDuration === 'number' ? raw.ttsDuration : null,
    generationMode: raw?.generationMode === 'premium' ? 'premium' : raw?.generationMode === 'free' ? 'free' : undefined,
    sceneSourceType: raw?.sceneSourceType === 'ai' || raw?.sceneSourceType === 'free-media' || raw?.sceneSourceType === 'sample' || raw?.sceneSourceType === 'mixed'
      ? raw.sceneSourceType
      : undefined,
    encodingMode: raw?.encodingMode === 'ffmpeg' ? 'ffmpeg' : raw?.encodingMode === 'browser' ? 'browser' : undefined,
    subtitlePreset: raw?.subtitlePreset && typeof raw.subtitlePreset === 'object'
      ? ({
          size: raw.subtitlePreset.size === 'small' || raw.subtitlePreset.size === 'large' ? raw.subtitlePreset.size : 'medium',
          position: raw.subtitlePreset.position === 'top' || raw.subtitlePreset.position === 'middle' ? raw.subtitlePreset.position : 'bottom',
          fontFamily: typeof raw.subtitlePreset.fontFamily === 'string' && raw.subtitlePreset.fontFamily ? raw.subtitlePreset.fontFamily : 'Pretendard',
          background: Boolean(raw.subtitlePreset.background),
          backgroundOpacity: typeof raw.subtitlePreset.backgroundOpacity === 'number' ? raw.subtitlePreset.backgroundOpacity : 0.45,
          segmentation: raw.subtitlePreset.segmentation === 'sentence' ? 'sentence' : 'paragraph',
        } satisfies SubtitlePresetState)
      : null,
    subtitlePosition: raw?.subtitlePosition === 'top' || raw?.subtitlePosition === 'middle' || raw?.subtitlePosition === 'bottom'
      ? raw.subtitlePosition
      : null,
    subtitleBackgroundOpacity: typeof raw?.subtitleBackgroundOpacity === 'number' ? raw.subtitleBackgroundOpacity : null,
    prompts: raw?.prompts && typeof raw.prompts === 'object'
      ? {
          scriptPrompt: typeof raw.prompts.scriptPrompt === 'string' ? raw.prompts.scriptPrompt : null,
          scenePrompt: typeof raw.prompts.scenePrompt === 'string' ? raw.prompts.scenePrompt : null,
          imagePrompt: typeof raw.prompts.imagePrompt === 'string' ? raw.prompts.imagePrompt : null,
          videoPrompt: typeof raw.prompts.videoPrompt === 'string' ? raw.prompts.videoPrompt : null,
          motionPrompt: typeof raw.prompts.motionPrompt === 'string' ? raw.prompts.motionPrompt : null,
          thumbnailPrompt: typeof raw.prompts.thumbnailPrompt === 'string' ? raw.prompts.thumbnailPrompt : null,
          youtubeMetaPrompt: typeof raw.prompts.youtubeMetaPrompt === 'string' ? raw.prompts.youtubeMetaPrompt : null,
        }
      : null,
    youtubeConnectedAccount: raw?.youtubeConnectedAccount && typeof raw.youtubeConnectedAccount === 'object'
      ? ({
          email: typeof raw.youtubeConnectedAccount.email === 'string' ? raw.youtubeConnectedAccount.email : null,
          channelId: typeof raw.youtubeConnectedAccount.channelId === 'string' ? raw.youtubeConnectedAccount.channelId : null,
          channelTitle: typeof raw.youtubeConnectedAccount.channelTitle === 'string' ? raw.youtubeConnectedAccount.channelTitle : null,
        } satisfies YoutubeConnectedAccountInfo)
      : null,
    youtubeChannelTitle: typeof raw?.youtubeChannelTitle === 'string' ? raw.youtubeChannelTitle : null,
    youtubeUploadStatus: raw?.youtubeUploadStatus === 'ready' || raw?.youtubeUploadStatus === 'uploading' || raw?.youtubeUploadStatus === 'uploaded' || raw?.youtubeUploadStatus === 'error'
      ? raw.youtubeUploadStatus as YoutubeUploadStatus
      : 'idle',
    youtubeUploadedAt: typeof raw?.youtubeUploadedAt === 'number' ? raw.youtubeUploadedAt : null,
    youtubeVideoId: typeof raw?.youtubeVideoId === 'string' ? raw.youtubeVideoId : null,
    youtubePrivacyStatus: raw?.youtubePrivacyStatus === 'private' || raw?.youtubePrivacyStatus === 'unlisted' || raw?.youtubePrivacyStatus === 'public'
      ? raw.youtubePrivacyStatus
      : null,
    youtubeTitle: typeof raw?.youtubeTitle === 'string' ? raw.youtubeTitle : null,
    youtubeDescription: typeof raw?.youtubeDescription === 'string' ? raw.youtubeDescription : null,
    youtubeTags: Array.isArray(raw?.youtubeTags) ? raw.youtubeTags.filter((item: any) => typeof item === 'string') : [],
    isShortsEligible: typeof raw?.isShortsEligible === 'boolean' ? raw.isShortsEligible : false,
    uploadErrorMessage: typeof raw?.uploadErrorMessage === 'string' ? raw.uploadErrorMessage : null,
  };
}

function getCurrentSettings() {
  const cachedRouting = getCachedStudioState()?.routing;
  const elevenLabsModel =
    cachedRouting?.elevenLabsModelId ||
    cachedRouting?.audioModel ||
    localStorage.getItem(CONFIG.STORAGE_KEYS.ELEVENLABS_MODEL) ||
    CONFIG.DEFAULT_ELEVENLABS_MODEL;
  const imageModel =
    cachedRouting?.imageModel ||
    getSelectedImageModel();
  const videoModel =
    cachedRouting?.videoModel ||
    CONFIG.DEFAULT_VIDEO_MODEL;
  const scriptModel =
    cachedRouting?.scriptModel ||
    cachedRouting?.textModel ||
    CONFIG.DEFAULT_SCRIPT_MODEL;
  const sceneModel =
    cachedRouting?.sceneModel ||
    cachedRouting?.imagePromptModel ||
    cachedRouting?.motionPromptModel ||
    scriptModel;
  return {
    imageModel,
    videoModel,
    scriptModel,
    sceneModel,
    outputMode: 'video' as const,
    elevenLabsModel,
  };
}


function resolveNextProjectNumber(projects: Array<Pick<SavedProject, 'projectNumber'>> = []) {
  return projects.reduce((max, project) => (
    typeof project?.projectNumber === 'number' && project.projectNumber > max ? project.projectNumber : max
  ), 0) + 1;
}

async function getNextProjectNumber(): Promise<number> {
  const cachedProjects = Array.isArray(getCachedStudioState()?.projects)
    ? getCachedStudioState()!.projects
    : [];
  if (cachedProjects.length) return resolveNextProjectNumber(cachedProjects as SavedProject[]);
  const indexed = await readIndexedProjects();
  return resolveNextProjectNumber(indexed);
}

async function persistProjectDetailIfPossible(project: SavedProject): Promise<SavedProject> {
  const cachedState = getCachedStudioState();
  if (!cachedState?.isStorageConfigured || !cachedState.storageDir?.trim()) {
    return project;
  }

  try {
    return await saveStudioProject(project, { storageDir: cachedState.storageDir });
  } catch (error) {
    console.warn('[Project] project detail persist failed before index write. Falling back to inline payload.', error);
    return project;
  }
}

async function syncProjectsAcrossStorage(
  projects: SavedProject[],
  options?: { immediateStudioSync?: boolean; changedProjects?: SavedProject[]; removedProjectIds?: string[] }
): Promise<void> {
  await writeIndexedProjects(projects);

  if (options?.immediateStudioSync) {
    pendingStudioSyncProjects = null;
    if (studioSyncTimer) {
      if (typeof window !== 'undefined') window.clearTimeout(studioSyncTimer);
      else clearTimeout(studioSyncTimer);
      studioSyncTimer = null;
    }

    try {
      const syncTasks: Promise<unknown>[] = [saveProjectsToStudio(projects)];
      if (Array.isArray(options?.changedProjects) && options.changedProjects.length) {
        syncTasks.push(Promise.all(options.changedProjects.map((project) => saveStudioProject(project))));
      }
      if (Array.isArray(options?.removedProjectIds) && options.removedProjectIds.length) {
        syncTasks.push(deleteStudioProjects(options.removedProjectIds));
      }
      await Promise.all(syncTasks);
    } catch (error) {
      console.warn('[Project] immediate local file sync failed. IndexedDB backup is still safe.', error);
    }
    return;
  }

  scheduleStudioSync(projects);
}

function mergeProjectsForStudioSync(updatedProject: SavedProject, fallbackProjects?: SavedProject[]) {
  const cachedState = getCachedStudioState();
  const baseline = Array.isArray(cachedState?.projects) && cachedState.projects.length
    ? cachedState.projects
    : (fallbackProjects || []);
  const byId = new Map<string, SavedProject>();

  baseline.forEach((project) => {
    if (!project?.id) return;
    byId.set(project.id, project);
  });

  byId.set(updatedProject.id, updatedProject);
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function flushStudioSyncQueue() {
  if (studioSyncInFlight || !pendingStudioSyncProjects) return;
  studioSyncInFlight = true;

  try {
    while (pendingStudioSyncProjects) {
      const payload = pendingStudioSyncProjects;
      pendingStudioSyncProjects = null;
      try {
        await saveProjectsToStudio(payload);
      } catch (error) {
        console.warn('[Project] local file sync deferred. IndexedDB backup is still safe.', error);
      }
    }
  } finally {
    studioSyncInFlight = false;
  }
}

function scheduleStudioSync(projects: SavedProject[]) {
  pendingStudioSyncProjects = projects;
  if (studioSyncTimer) {
    if (typeof window !== 'undefined') window.clearTimeout(studioSyncTimer);
    else clearTimeout(studioSyncTimer);
  }

  const setTimer = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  studioSyncTimer = setTimer(() => {
    studioSyncTimer = null;
    void flushStudioSyncQueue();
  }, STUDIO_SYNC_DEBOUNCE_MS);
}

function mergeSavedProjects(primary: SavedProject[] = [], fallback: SavedProject[] = []) {
  const byId = new Map<string, SavedProject>();
  [...primary, ...fallback].forEach((project) => {
    if (!project?.id) return;
    if (!byId.has(project.id)) byId.set(project.id, normalizeProject(project));
  });
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function readIndexedProjects(): Promise<SavedProject[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as SavedProject[]).map(normalizeProject));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

async function writeIndexedProjects(projects: SavedProject[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    projects.forEach((project) => store.put(project));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function writeIndexedProject(project: SavedProject): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(project);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readIndexedProjectById(id: string): Promise<SavedProject | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? normalizeProject(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function readProjectsForMutation(): Promise<SavedProject[]> {
  const indexed = await readIndexedProjects();
  if (indexed.length) {
    return indexed;
  }

  const cachedProjects = Array.isArray(getCachedStudioState()?.projects)
    ? getCachedStudioState()!.projects.map(normalizeProject)
    : [];

  return cachedProjects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveProject(
  topic: string,
  assets: GeneratedAsset[],
  customName?: string,
  cost?: CostBreakdown,
  extras?: {
    projectId?: string | null;
    backgroundMusicTracks?: BackgroundMusicTrack[];
    previewMix?: PreviewMixSettings;
    workflowDraft?: WorkflowDraft | null;
    outputMode?: 'video' | 'image';
    voicePreviewAsset?: AudioPreviewAsset | null;
    scriptPreviewAsset?: AudioPreviewAsset | null;
    finalVoiceAsset?: AudioPreviewAsset | null;
    backgroundMusicPreview?: BackgroundMusicTrack | null;
    finalBackgroundMusic?: BackgroundMusicTrack | null;
    musicVideoPreview?: VideoPreviewAsset | null;
    finalMusicVideo?: VideoPreviewAsset | null;
    script?: string | null;
    scriptParagraphs?: SavedProject['scriptParagraphs'];
    sceneList?: SavedProject['sceneList'];
    sceneDuration?: number | null;
    ttsFiles?: SavedProject['ttsFiles'];
    ttsDuration?: number | null;
    generationMode?: SavedProject['generationMode'];
    sceneSourceType?: SavedProject['sceneSourceType'];
    encodingMode?: SavedProject['encodingMode'];
    subtitlePreset?: SavedProject['subtitlePreset'];
    subtitlePosition?: SavedProject['subtitlePosition'];
    subtitleBackgroundOpacity?: SavedProject['subtitleBackgroundOpacity'];
    prompts?: SavedProject['prompts'];
    youtubeConnectedAccount?: SavedProject['youtubeConnectedAccount'];
    youtubeChannelTitle?: SavedProject['youtubeChannelTitle'];
    youtubeUploadStatus?: SavedProject['youtubeUploadStatus'];
    youtubeUploadedAt?: SavedProject['youtubeUploadedAt'];
    youtubeVideoId?: SavedProject['youtubeVideoId'];
    youtubePrivacyStatus?: SavedProject['youtubePrivacyStatus'];
    youtubeTitle?: SavedProject['youtubeTitle'];
    youtubeDescription?: SavedProject['youtubeDescription'];
    youtubeTags?: SavedProject['youtubeTags'];
    isShortsEligible?: SavedProject['isShortsEligible'];
    uploadErrorMessage?: SavedProject['uploadErrorMessage'];
  }
): Promise<SavedProject> {
  const id = extras?.projectId?.trim() || `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  let thumbnail: string | null = null;
  const firstImageAsset = assets.find(a => a.imageData);
  if (firstImageAsset?.imageData) {
    thumbnail = await createThumbnail(firstImageAsset.imageData);
  }

  const current = await readIndexedProjects();
  const nextProjectNumber = await getNextProjectNumber();

  const project: SavedProject = {
    id,
    name: customName || `${topic.slice(0, 30)}${topic.length > 30 ? '...' : ''}`,
    createdAt: now,
    topic,
    projectNumber: nextProjectNumber,
    settings: {
      ...getCurrentSettings(),
      outputMode: extras?.outputMode || extras?.workflowDraft?.outputMode || 'video',
    },
    lastSavedAt: now,
    assets: assets.map(asset => ({ ...asset })),
    thumbnail,
    thumbnailTitle: null,
    thumbnailPrompt: null,
    thumbnailHistory: [],
    selectedThumbnailId: null,
    cost,
    backgroundMusicTracks: extras?.backgroundMusicTracks || [],
    previewMix: extras?.previewMix,
    workflowDraft: compactWorkflowDraftForStorage(extras?.workflowDraft) || null,
    voicePreviewAsset: extras?.voicePreviewAsset || null,
    scriptPreviewAsset: extras?.scriptPreviewAsset || null,
    finalVoiceAsset: extras?.finalVoiceAsset || null,
    backgroundMusicPreview: extras?.backgroundMusicPreview || null,
    finalBackgroundMusic: extras?.finalBackgroundMusic || null,
    musicVideoPreview: extras?.musicVideoPreview || null,
    finalMusicVideo: extras?.finalMusicVideo || null,
    script: extras?.script ?? null,
    scriptParagraphs: extras?.scriptParagraphs || [],
    sceneList: extras?.sceneList || [],
    sceneDuration: typeof extras?.sceneDuration === 'number' ? extras.sceneDuration : null,
    ttsFiles: extras?.ttsFiles || [],
    ttsDuration: typeof extras?.ttsDuration === 'number' ? extras.ttsDuration : null,
    generationMode: extras?.generationMode,
    sceneSourceType: extras?.sceneSourceType,
    encodingMode: extras?.encodingMode || 'browser',
    subtitlePreset: extras?.subtitlePreset || null,
    subtitlePosition: extras?.subtitlePosition || null,
    subtitleBackgroundOpacity: typeof extras?.subtitleBackgroundOpacity === 'number' ? extras.subtitleBackgroundOpacity : null,
    prompts: extras?.prompts || null,
    youtubeConnectedAccount: extras?.youtubeConnectedAccount || null,
    youtubeChannelTitle: extras?.youtubeChannelTitle || null,
    youtubeUploadStatus: extras?.youtubeUploadStatus || 'idle',
    youtubeUploadedAt: typeof extras?.youtubeUploadedAt === 'number' ? extras.youtubeUploadedAt : null,
    youtubeVideoId: extras?.youtubeVideoId || null,
    youtubePrivacyStatus: extras?.youtubePrivacyStatus || null,
    youtubeTitle: extras?.youtubeTitle || null,
    youtubeDescription: extras?.youtubeDescription || null,
    youtubeTags: extras?.youtubeTags || [],
    isShortsEligible: Boolean(extras?.isShortsEligible),
    uploadErrorMessage: extras?.uploadErrorMessage || null,
  };

  const persistedProject = await persistProjectDetailIfPossible(project);
  const next = [persistedProject, ...current.filter((item) => item.id !== persistedProject.id)].sort((a, b) => b.createdAt - a.createdAt);
  await syncProjectsAcrossStorage(next, { immediateStudioSync: true, changedProjects: [] });

  return (await readIndexedProjectById(persistedProject.id)) || persistedProject;
}


export async function upsertWorkflowProject(options: {
  projectId?: string | null;
  topic: string;
  workflowDraft: WorkflowDraft;
  assets?: GeneratedAsset[];
  cost?: CostBreakdown;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  voicePreviewAsset?: AudioPreviewAsset | null;
  scriptPreviewAsset?: AudioPreviewAsset | null;
  finalVoiceAsset?: AudioPreviewAsset | null;
  backgroundMusicPreview?: BackgroundMusicTrack | null;
  finalBackgroundMusic?: BackgroundMusicTrack | null;
  musicVideoPreview?: VideoPreviewAsset | null;
  finalMusicVideo?: VideoPreviewAsset | null;
  script?: SavedProject['script'];
  scriptParagraphs?: SavedProject['scriptParagraphs'];
  sceneList?: SavedProject['sceneList'];
  sceneDuration?: SavedProject['sceneDuration'];
  ttsFiles?: SavedProject['ttsFiles'];
  ttsDuration?: SavedProject['ttsDuration'];
  generationMode?: SavedProject['generationMode'];
  sceneSourceType?: SavedProject['sceneSourceType'];
  encodingMode?: SavedProject['encodingMode'];
  subtitlePreset?: SavedProject['subtitlePreset'];
  subtitlePosition?: SavedProject['subtitlePosition'];
  subtitleBackgroundOpacity?: SavedProject['subtitleBackgroundOpacity'];
  prompts?: SavedProject['prompts'];
  youtubeConnectedAccount?: SavedProject['youtubeConnectedAccount'];
  youtubeChannelTitle?: SavedProject['youtubeChannelTitle'];
  youtubeUploadStatus?: SavedProject['youtubeUploadStatus'];
  youtubeUploadedAt?: SavedProject['youtubeUploadedAt'];
  youtubeVideoId?: SavedProject['youtubeVideoId'];
  youtubePrivacyStatus?: SavedProject['youtubePrivacyStatus'];
  youtubeTitle?: SavedProject['youtubeTitle'];
  youtubeDescription?: SavedProject['youtubeDescription'];
  youtubeTags?: SavedProject['youtubeTags'];
  isShortsEligible?: SavedProject['isShortsEligible'];
  uploadErrorMessage?: SavedProject['uploadErrorMessage'];
}): Promise<SavedProject> {
  const safeTopic = options.topic?.trim() || '새 프로젝트';
  const patch = {
    topic: safeTopic,
    assets: Array.isArray(options.assets) ? options.assets.map((asset) => ({ ...asset })) : [],
    cost: options.cost,
    backgroundMusicTracks: options.backgroundMusicTracks || [],
    previewMix: options.previewMix,
    workflowDraft: compactWorkflowDraftForStorage(options.workflowDraft) || null,
    voicePreviewAsset: options.voicePreviewAsset || null,
    scriptPreviewAsset: options.scriptPreviewAsset || null,
    finalVoiceAsset: options.finalVoiceAsset || null,
    backgroundMusicPreview: options.backgroundMusicPreview || null,
    finalBackgroundMusic: options.finalBackgroundMusic || null,
    musicVideoPreview: options.musicVideoPreview || null,
    finalMusicVideo: options.finalMusicVideo || null,
    script: options.script ?? null,
    scriptParagraphs: options.scriptParagraphs || [],
    sceneList: options.sceneList || [],
    sceneDuration: typeof options.sceneDuration === 'number' ? options.sceneDuration : null,
    ttsFiles: options.ttsFiles || [],
    ttsDuration: typeof options.ttsDuration === 'number' ? options.ttsDuration : null,
    generationMode: options.generationMode,
    sceneSourceType: options.sceneSourceType,
    encodingMode: options.encodingMode || 'browser',
    subtitlePreset: options.subtitlePreset || null,
    subtitlePosition: options.subtitlePosition || null,
    subtitleBackgroundOpacity: typeof options.subtitleBackgroundOpacity === 'number' ? options.subtitleBackgroundOpacity : null,
    prompts: options.prompts || null,
    youtubeConnectedAccount: options.youtubeConnectedAccount || null,
    youtubeChannelTitle: options.youtubeChannelTitle || null,
    youtubeUploadStatus: options.youtubeUploadStatus || 'idle',
    youtubeUploadedAt: typeof options.youtubeUploadedAt === 'number' ? options.youtubeUploadedAt : null,
    youtubeVideoId: options.youtubeVideoId || null,
    youtubePrivacyStatus: options.youtubePrivacyStatus || null,
    youtubeTitle: options.youtubeTitle || null,
    youtubeDescription: options.youtubeDescription || null,
    youtubeTags: options.youtubeTags || [],
    isShortsEligible: Boolean(options.isShortsEligible),
    uploadErrorMessage: options.uploadErrorMessage || null,
  } as Partial<SavedProject>;

  if (options.projectId) {
    const updated = await updateProject(options.projectId, patch);
    if (updated) {
      return (await readIndexedProjectById(updated.id)) || updated;
    }
  }

  return saveProject(
    safeTopic,
    patch.assets || [],
    `${safeTopic.slice(0, 30)}${safeTopic.length > 30 ? '...' : ''}`,
    options.cost,
    {
      projectId: options.projectId || null,
      backgroundMusicTracks: options.backgroundMusicTracks || [],
      previewMix: options.previewMix,
      workflowDraft: compactWorkflowDraftForStorage(options.workflowDraft) || null,
      outputMode: options.workflowDraft?.outputMode || 'video',
      voicePreviewAsset: options.voicePreviewAsset || null,
      scriptPreviewAsset: options.scriptPreviewAsset || null,
      finalVoiceAsset: options.finalVoiceAsset || null,
      backgroundMusicPreview: options.backgroundMusicPreview || null,
      finalBackgroundMusic: options.finalBackgroundMusic || null,
      musicVideoPreview: options.musicVideoPreview || null,
      finalMusicVideo: options.finalMusicVideo || null,
      script: options.script ?? null,
      scriptParagraphs: options.scriptParagraphs || [],
      sceneList: options.sceneList || [],
      sceneDuration: typeof options.sceneDuration === 'number' ? options.sceneDuration : null,
      ttsFiles: options.ttsFiles || [],
      ttsDuration: typeof options.ttsDuration === 'number' ? options.ttsDuration : null,
      generationMode: options.generationMode,
      sceneSourceType: options.sceneSourceType,
      encodingMode: options.encodingMode || 'browser',
      subtitlePreset: options.subtitlePreset || null,
      subtitlePosition: options.subtitlePosition || null,
      subtitleBackgroundOpacity: typeof options.subtitleBackgroundOpacity === 'number' ? options.subtitleBackgroundOpacity : null,
      prompts: options.prompts || null,
      youtubeConnectedAccount: options.youtubeConnectedAccount || null,
      youtubeChannelTitle: options.youtubeChannelTitle || null,
      youtubeUploadStatus: options.youtubeUploadStatus || 'idle',
      youtubeUploadedAt: typeof options.youtubeUploadedAt === 'number' ? options.youtubeUploadedAt : null,
      youtubeVideoId: options.youtubeVideoId || null,
      youtubePrivacyStatus: options.youtubePrivacyStatus || null,
      youtubeTitle: options.youtubeTitle || null,
      youtubeDescription: options.youtubeDescription || null,
      youtubeTags: options.youtubeTags || [],
      isShortsEligible: Boolean(options.isShortsEligible),
      uploadErrorMessage: options.uploadErrorMessage || null,
    }
  );
}

export async function updateProject(
  id: string,
  patch: Partial<SavedProject>
): Promise<SavedProject | null> {
  const target = await readIndexedProjectById(id);
  if (!target) return null;

  const hasExplicitThumbnail = Object.prototype.hasOwnProperty.call(patch, 'thumbnail');
  let thumbnail = hasExplicitThumbnail
    ? (typeof patch.thumbnail === 'string' && patch.thumbnail ? patch.thumbnail : null)
    : target.thumbnail;
  const nextAssets = Array.isArray(patch.assets) ? patch.assets : target.assets;
  const nextThumbnailHistory = Array.isArray(patch.thumbnailHistory) ? patch.thumbnailHistory : (target.thumbnailHistory || []);
  if (!hasExplicitThumbnail && !thumbnail && nextThumbnailHistory.length) {
    const latestFromHistory = [...nextThumbnailHistory]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (latestFromHistory?.imageData) {
      thumbnail = latestFromHistory.imageData;
    }
  }
  const firstImageAsset = nextAssets.find((asset) => asset.imageData);
  if (!hasExplicitThumbnail && !thumbnail && firstImageAsset?.imageData) {
    thumbnail = await createThumbnail(firstImageAsset.imageData);
  }

  const nextProject: SavedProject = normalizeProject({
    ...target,
    ...patch,
    workflowDraft: Object.prototype.hasOwnProperty.call(patch, 'workflowDraft')
      ? compactWorkflowDraftForStorage(patch.workflowDraft as any)
      : target.workflowDraft,
    id,
    lastSavedAt: Date.now(),
    settings: {
      ...target.settings,
      ...(patch.settings || {}),
    },
    assets: nextAssets,
    thumbnail,
  });

  const persistedProject = await persistProjectDetailIfPossible(nextProject);
  await writeIndexedProject(persistedProject);
  const cachedSummaries = getCachedStudioState()?.projects || [];
  const fallbackProjects = cachedSummaries.length
    ? undefined
    : (await readIndexedProjects()).filter((project) => project.id !== id);
  const syncPayload = mergeProjectsForStudioSync(persistedProject, fallbackProjects);
  scheduleStudioSync(syncPayload);
  return persistedProject;
}


export async function getSavedProjects(options?: { forceSync?: boolean; localOnly?: boolean }): Promise<SavedProject[]> {
  const indexed = await readIndexedProjects();
  const cachedState = getCachedStudioState();
  const cachedProjects = Array.isArray(cachedState?.projects)
    ? cachedState.projects.map(summarizeProjectForIndex).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const localProjects = indexed.length ? indexed : mergeSavedProjects(indexed, cachedProjects);
  const summarizedLocal = localProjects.map(summarizeProjectForIndex).sort((a, b) => b.createdAt - a.createdAt);

  if (summarizedLocal.length && !options?.forceSync) {
    return summarizedLocal;
  }

  if (options?.localOnly) {
    return summarizedLocal;
  }

  try {
    const projects = (await fetchStudioProjects()).map(normalizeProject).sort((a, b) => b.createdAt - a.createdAt);
    const remoteExists = projects.length > 0;
    if (remoteExists || options?.forceSync) {
      const mergedRemote = mergeSavedProjects(indexed, projects);
      await writeIndexedProjects(mergedRemote);
      return mergedRemote.map(summarizeProjectForIndex).sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch {}

  return summarizedLocal;
}

export async function getProjectById(id: string, options?: { forceSync?: boolean; localOnly?: boolean }): Promise<SavedProject | null> {
  const direct = await readIndexedProjectById(id);
  const hasDirectDetail = Boolean(direct && (direct.assets?.length || direct.workflowDraft || direct.backgroundMusicTracks?.length));
  if (direct && (!options?.forceSync || hasDirectDetail)) return direct;
  if (options?.localOnly) return direct || null;

  const remoteDetail = await fetchStudioProjectById(id);
  if (remoteDetail) {
    const normalized = normalizeProject(remoteDetail);
    await writeIndexedProject(normalized);
    return normalized;
  }

  const projects = await getSavedProjects(options);
  const found = projects.find((project) => project.id === id);
  if (found) return found;
  if (!options?.forceSync) {
    const refreshed = await getSavedProjects({ forceSync: true });
    return refreshed.find((project) => project.id === id) || null;
  }
  return null;
}


export async function deleteProject(id: string): Promise<boolean> {
  const deletedCount = await deleteProjects([id]);
  return deletedCount > 0;
}

export async function renameProject(id: string, newName: string): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const current = await readProjectsForMutation();
  const next = current.map((project) => project.id === id ? { ...project, name: trimmed } : project);
  await syncProjectsAcrossStorage(next, { immediateStudioSync: true, changedProjects: next.filter((project) => project.id === id) });
  return true;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeProjectForTransport(project: SavedProject): SavedProject {
  const normalized = normalizeProject(project);
  return normalizeProject({
    ...cloneValue(normalized),
    workflowDraft: createSelectedWorkflowDraftForTransport(normalized.workflowDraft || null),
  });
}

function buildCopiedProjectName(sourceName: string, existingNames: Set<string>) {
  const baseName = (sourceName || '프로젝트').replace(/\s*복사\(\d+\)\s*$/u, '').trim() || '프로젝트';
  let index = 1;
  let candidate = `${baseName} 복사(${index})`;
  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${baseName} 복사(${index})`;
  }
  return candidate;
}

export async function duplicateProject(id: string): Promise<SavedProject | null> {
  const current = await readProjectsForMutation();
  const summarySource = current.find((project) => project.id === id);
  if (!summarySource) return null;
  const remoteSource = (summarySource.assets?.length || summarySource.workflowDraft || summarySource.backgroundMusicTracks?.length) ? null : await fetchStudioProjectById(id);
  const source = remoteSource ? normalizeProject(remoteSource) : summarySource;

  const nextProjectNumber = await getNextProjectNumber();

  const existingNames = new Set(current.map((project) => project.name || ''));
  const copiedName = buildCopiedProjectName(source.name || '프로젝트', existingNames);
  const now = Date.now();

  const copied: SavedProject = normalizeProject({
    ...cloneValue(source),
    id: `project_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: copiedName,
    createdAt: now,
    lastSavedAt: now,
    projectNumber: nextProjectNumber,
    folderName: undefined,
    folderPath: undefined,
  });

  const next = [copied, ...current].sort((a, b) => b.createdAt - a.createdAt);
  await syncProjectsAcrossStorage(next, { immediateStudioSync: true, changedProjects: [copied] });
  return copied;
}


function buildWorkflowTransferSummary(project: SavedProject) {
  const draft = project.workflowDraft || null;
  const selectedCharacters = Array.isArray(draft?.extractedCharacters)
    ? draft.extractedCharacters.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role || character.roleLabel || null,
      }))
    : [];
  const selectedStyle = Array.isArray(draft?.styleImages)
    ? draft.styleImages.find((style) => style.id === draft?.selectedStyleImageId) || draft.styleImages[0] || null
    : null;
  const selectedPromptTemplate = Array.isArray(draft?.promptTemplates)
    ? draft.promptTemplates.find((template) => template.id === draft?.selectedPromptTemplateId) || draft.promptTemplates[0] || null
    : null;

  return {
    topic: draft?.topic || project.topic || '',
    _comment_topic: 'Step2에서 정한 프로젝트 주제',
    contentType: draft?.contentType || null,
    _comment_contentType: 'Step1에서 선택한 콘텐츠 유형',
    aspectRatio: draft?.aspectRatio || null,
    _comment_aspectRatio: 'Step1에서 선택한 화면 비율',
    selections: draft?.selections || null,
    _comment_selections: 'Step2에서 고른 장르, 분위기, 배경, 주인공, 갈등 값',
    selectedCharacters,
    _comment_selectedCharacters: 'Step4에서 선택된 출연자 목록',
    selectedCharacterStyleLabel: draft?.selectedCharacterStyleLabel || null,
    _comment_selectedCharacterStyleLabel: 'Step4의 공통 출연자 스타일 이름',
    selectedCharacterStylePrompt: draft?.selectedCharacterStylePrompt || null,
    _comment_selectedCharacterStylePrompt: 'Step4의 공통 출연자 스타일 프롬프트',
    selectedStyleLabel: selectedStyle?.groupLabel || selectedStyle?.label || null,
    _comment_selectedStyleLabel: 'Step5에서 선택한 최종 화풍 카드 이름',
    selectedStylePrompt: selectedStyle?.prompt || null,
    _comment_selectedStylePrompt: 'Step5에서 선택한 최종 화풍 프롬프트',
    selectedPromptTemplateName: selectedPromptTemplate?.name || null,
    _comment_selectedPromptTemplateName: 'Step3에서 선택한 프롬프트 카드 이름',
    promptTransfer: {
      storyPrompt: draft?.promptPack?.storyPrompt || project.prompts?.scriptPrompt || null,
      _comment_storyPrompt: '대본 생성용 기본 스토리 프롬프트',
      scenePrompt: draft?.promptPack?.scenePrompt || project.prompts?.scenePrompt || null,
      _comment_scenePrompt: '씬 분해와 장면 작성 기준 프롬프트',
      characterPrompt: draft?.promptPack?.characterPrompt || null,
      _comment_characterPrompt: '출연자 캐릭터 설정 기준 프롬프트',
      actionPrompt: draft?.promptPack?.actionPrompt || project.prompts?.motionPrompt || null,
      _comment_actionPrompt: '모션/행동 연출 기준 프롬프트',
      imagePrompt: project.prompts?.imagePrompt || null,
      _comment_imagePrompt: '씬별 이미지 프롬프트를 합쳐 둔 값',
      videoPrompt: project.prompts?.videoPrompt || null,
      _comment_videoPrompt: '씬별 영상 프롬프트를 합쳐 둔 값',
    },
    script: project.script || draft?.script || '',
    _comment_script: 'Step3 최종 대본 또는 Step6에서 편집된 최신 대본',
    paragraphCount: Array.isArray(project.scriptParagraphs) ? project.scriptParagraphs.length : 0,
    _comment_paragraphCount: 'Step6에서 씬으로 나뉜 총 문단 수',
    sceneCount: Array.isArray(project.sceneList) ? project.sceneList.length : 0,
    _comment_sceneCount: '현재 프로젝트에 저장된 총 씬 수',
  };
}

export function buildProjectsExportPayload(projects: SavedProject[]) {
  const normalizedProjects = Array.isArray(projects)
    ? projects.map((project) => sanitizeProjectForTransport(project))
    : [];

  return {
    format: 'mp4creater-project-export',
    version: 2,
    exportedAt: Date.now(),
    projectCount: normalizedProjects.length,
    projects: normalizedProjects.map((project) => ({
      ...project,
      workflowTransferSummary: buildWorkflowTransferSummary(project),
    })),
  };
}

function extractImportedProjects(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (payload && typeof payload === 'object' && payload.id && payload.name) return [payload];
  return [];
}

function createImportedProjectId() {
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function importProjectsFromFile(file: File): Promise<SavedProject[]> {
  const text = await file.text();
  let parsed: any;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON 파일 형식이 올바르지 않습니다.');
  }

  const importedProjects = extractImportedProjects(parsed);
  if (!importedProjects.length) {
    throw new Error('불러올 프로젝트 데이터가 없습니다.');
  }

  const current = await readProjectsForMutation();
  let nextProjectNumber = current.reduce((max, project) => (
    typeof project.projectNumber === 'number' && project.projectNumber > max ? project.projectNumber : max
  ), 0) + 1;
  let timestampCursor = Date.now();

  const prepared = importedProjects.map((project) => {
    const normalized = sanitizeProjectForTransport(normalizeProject({
      ...cloneValue(project),
      id: createImportedProjectId(),
      createdAt: timestampCursor,
      projectNumber: nextProjectNumber,
      folderName: undefined,
      folderPath: undefined,
      lastSavedAt: timestampCursor,
    }));
    nextProjectNumber += 1;
    timestampCursor += 1;
    return normalized;
  });

  const next = [...prepared, ...current].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  await syncProjectsAcrossStorage(next, { immediateStudioSync: true, changedProjects: prepared });
  return prepared;
}

export async function deleteProjects(ids: string[]): Promise<number> {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (!uniqueIds.length) return 0;
  const current = await readProjectsForMutation();
  const next = current.filter((project) => !uniqueIds.includes(project.id));
  await syncProjectsAcrossStorage(next, { immediateStudioSync: true, removedProjectIds: uniqueIds });
  return current.length - next.length;
}

export async function migrateFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.PROJECTS);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const normalized = parsed.map(normalizeProject);
    await syncProjectsAcrossStorage(normalized, { changedProjects: normalized });
    localStorage.removeItem(CONFIG.STORAGE_KEYS.PROJECTS);
  } catch (error) {
    console.error('[Project] 로컬스토리지 마이그레이션 실패:', error);
  }
}
