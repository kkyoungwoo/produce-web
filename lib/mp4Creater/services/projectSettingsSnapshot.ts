import { CONFIG } from '../config';
import { AiRoutingSettings, SavedProject, WorkflowDraft } from '../types';

/**
 * 프로젝트별 AI 설정 스냅샷
 * - 설정창에서 저장한 현재 라우팅 값을 프로젝트에도 같이 남겨 둡니다.
 * - 프로젝트를 다시 열면 그 프로젝트를 만들 때 쓰던 모델/보이스/BGM 설정을 먼저 복원합니다.
 * - 전역 설정과 프로젝트 설정이 섞여도, 프로젝트 복원 우선순위는 이 스냅샷이 담당합니다.
 */
export function buildProjectSettingsSnapshot(options: {
  routing?: Partial<AiRoutingSettings> | null;
  workflowDraft?: Pick<WorkflowDraft, 'outputMode'> | null;
  fallback?: Partial<SavedProject['settings']> | null;
}): SavedProject['settings'] {
  const routing = options.routing || {};
  const fallback = options.fallback || {};
  const scriptModel = routing.scriptModel || routing.textModel || fallback.scriptModel || CONFIG.DEFAULT_SCRIPT_MODEL;
  const sceneModel = routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || fallback.sceneModel || scriptModel;
  const audioModel = routing.elevenLabsModelId || routing.audioModel || fallback.elevenLabsModel || CONFIG.DEFAULT_ELEVENLABS_MODEL;
  const imageModel = routing.imageModel || fallback.imageModel || CONFIG.DEFAULT_IMAGE_MODEL;
  const videoModel = routing.videoModel || fallback.videoModel || CONFIG.DEFAULT_VIDEO_MODEL;
  const backgroundMusicModel = routing.backgroundMusicModel || fallback.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL;
  const backgroundMusicProvider = backgroundMusicModel === 'lyria-002'
    ? 'google'
    : (routing.backgroundMusicProvider || fallback.backgroundMusicProvider || 'sample');

  return {
    imageModel,
    videoModel,
    scriptModel,
    sceneModel,
    outputMode: options.workflowDraft?.outputMode || fallback.outputMode || 'video',
    elevenLabsModel: audioModel,
    fluxStyle: fallback.fluxStyle,
    imageProvider: routing.imageProvider || fallback.imageProvider || 'sample',
    videoProvider: routing.videoProvider || fallback.videoProvider || 'sample',
    ttsProvider: routing.ttsProvider || fallback.ttsProvider || 'qwen3Tts',
    audioProvider: routing.audioProvider || fallback.audioProvider || 'qwen3Tts',
    qwenVoicePreset: routing.qwenVoicePreset || fallback.qwenVoicePreset || 'qwen-default',
    chatterboxVoicePreset: routing.chatterboxVoicePreset || fallback.chatterboxVoicePreset || 'chatterbox-clear',
    elevenLabsVoiceId: routing.elevenLabsVoiceId || fallback.elevenLabsVoiceId || null,
    heygenVoiceId: routing.heygenVoiceId || fallback.heygenVoiceId || null,
    backgroundMusicProvider,
    backgroundMusicModel,
    musicVideoProvider: routing.musicVideoProvider || fallback.musicVideoProvider || 'sample',
    musicVideoMode: routing.musicVideoMode || fallback.musicVideoMode || 'sample',
  };
}

/**
 * 프로젝트 저장값을 현재 라우팅 상태에 다시 덮어씌웁니다.
 * - Step 6에서 프로젝트를 불러올 때 설정창에서 저장했던 모델 선택이 그대로 이어지게 합니다.
 * - 선택된 모델과 보이스 프리셋만 복원하고, API 키처럼 전역 보안 값은 복원하지 않습니다.
 */
export function applyProjectSettingsToRouting(baseRouting: AiRoutingSettings, settings?: Partial<SavedProject['settings']> | null): AiRoutingSettings {
  if (!settings) return baseRouting;
  const scriptModel = settings.scriptModel || baseRouting.scriptModel || baseRouting.textModel || CONFIG.DEFAULT_SCRIPT_MODEL;
  const sceneModel = settings.sceneModel || baseRouting.sceneModel || baseRouting.imagePromptModel || scriptModel;
  const elevenLabsModel = settings.elevenLabsModel || baseRouting.elevenLabsModelId || baseRouting.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL;
  const backgroundMusicModel = settings.backgroundMusicModel || baseRouting.backgroundMusicModel;
  const backgroundMusicProvider = backgroundMusicModel === 'lyria-002'
    ? 'google'
    : (settings.backgroundMusicProvider || baseRouting.backgroundMusicProvider);

  return {
    ...baseRouting,
    imageModel: settings.imageModel || baseRouting.imageModel,
    videoModel: settings.videoModel || baseRouting.videoModel,
    scriptModel,
    textModel: scriptModel,
    sceneModel,
    imagePromptModel: sceneModel,
    motionPromptModel: sceneModel,
    elevenLabsModelId: elevenLabsModel,
    audioModel: elevenLabsModel,
    imageProvider: settings.imageProvider || baseRouting.imageProvider,
    videoProvider: settings.videoProvider || baseRouting.videoProvider,
    ttsProvider: settings.ttsProvider || baseRouting.ttsProvider,
    audioProvider: settings.audioProvider || baseRouting.audioProvider,
    qwenVoicePreset: settings.qwenVoicePreset || baseRouting.qwenVoicePreset,
    chatterboxVoicePreset: settings.chatterboxVoicePreset || baseRouting.chatterboxVoicePreset,
    elevenLabsVoiceId: settings.elevenLabsVoiceId ?? baseRouting.elevenLabsVoiceId,
    heygenVoiceId: settings.heygenVoiceId ?? baseRouting.heygenVoiceId,
    backgroundMusicProvider,
    backgroundMusicModel,
    musicVideoProvider: settings.musicVideoProvider || baseRouting.musicVideoProvider,
    musicVideoMode: settings.musicVideoMode || baseRouting.musicVideoMode,
  };
}
