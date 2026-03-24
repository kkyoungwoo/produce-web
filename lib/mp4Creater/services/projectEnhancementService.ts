import {
  AspectRatio,
  GeneratedAsset,
  GenerationMode,
  SavedProject,
  ScenePlanItem,
  SceneSourceType,
  ScriptParagraphPlan,
  StudioState,
  SubtitlePresetState,
  TtsFileItem,
  YoutubeMetaDraft,
} from '../types';
import { estimateClipDuration, splitStoryIntoParagraphScenes } from '../utils/storyHelpers';

export function buildScriptParagraphPlans(script: string): ScriptParagraphPlan[] {
  const paragraphs = splitStoryIntoParagraphScenes(script || '');
  let cursor = 0;
  return paragraphs.map((text, index) => {
    const estimatedSeconds = estimateClipDuration(text);
    const item: ScriptParagraphPlan = {
      id: `paragraph_${index + 1}`,
      index: index + 1,
      text,
      estimatedSeconds,
      startAt: Number(cursor.toFixed(2)),
      endAt: Number((cursor + estimatedSeconds).toFixed(2)),
    };
    cursor += estimatedSeconds;
    return item;
  });
}

export function buildScenePlanItems(assets: GeneratedAsset[]): ScenePlanItem[] {
  return assets.map((asset, index) => ({
    id: `scene_${index + 1}`,
    sceneNumber: asset.sceneNumber || index + 1,
    paragraphId: `paragraph_${index + 1}`,
    narration: asset.narration,
    imagePrompt: asset.imagePrompt || asset.visualPrompt || '',
    videoPrompt: asset.videoPrompt || '',
    motionPrompt: asset.videoPrompt || asset.visualPrompt || '',
    estimatedSeconds: estimateClipDuration(asset.narration || ''),
    targetDuration: typeof asset.targetDuration === 'number' ? asset.targetDuration : estimateClipDuration(asset.narration || ''),
    sceneSourceType: inferAssetSceneSourceType(asset),
    sourceAssetUrl: asset.imageData || asset.videoData || null,
  }));
}

export function buildTtsFileItems(assets: GeneratedAsset[], defaultProvider: TtsFileItem['provider'] = 'sample'): TtsFileItem[] {
  return assets
    .filter((asset) => Boolean(asset.audioData || asset.audioDuration))
    .map((asset, index) => ({
      id: `tts_${index + 1}`,
      sceneNumber: asset.sceneNumber || index + 1,
      paragraphId: `paragraph_${index + 1}`,
      provider: asset.sourceMode === 'ai' ? defaultProvider : 'sample',
      duration: typeof asset.audioDuration === 'number' ? asset.audioDuration : estimateClipDuration(asset.narration || ''),
      audioData: asset.audioData || null,
    }));
}

export function sumSceneDuration(assets: GeneratedAsset[]): number {
  return Number(assets.reduce((total, asset) => total + (typeof asset.targetDuration === 'number' ? asset.targetDuration : estimateClipDuration(asset.narration || '')), 0).toFixed(2));
}

export function sumTtsDuration(assets: GeneratedAsset[]): number {
  return Number(assets.reduce((total, asset) => total + (typeof asset.audioDuration === 'number' ? asset.audioDuration : 0), 0).toFixed(2));
}

export function inferGenerationMode(studioState?: StudioState | null): GenerationMode {
  const routing = studioState?.routing;
  const isPremium = Boolean(
    routing && (
      routing.imageProvider !== 'sample'
      || routing.videoProvider !== 'sample'
      || (routing.audioProvider !== 'qwen3Tts' && routing.audioProvider !== 'chatterbox')
      || routing.backgroundMusicProvider === 'elevenLabs'
    )
  );
  return isPremium ? 'premium' : 'free';
}

export function inferAssetSceneSourceType(asset: GeneratedAsset): SceneSourceType {
  if (asset.sourceMode === 'ai') return 'ai';
  if (typeof asset.imageData === 'string' && asset.imageData.includes('pexels')) return 'free-media';
  return 'sample';
}

export function inferSceneSourceType(assets: GeneratedAsset[]): SceneSourceType {
  const flags = new Set(assets.map(inferAssetSceneSourceType));
  if (flags.size > 1) return 'mixed';
  return flags.values().next().value || 'sample';
}

export function buildDefaultSubtitlePreset(): SubtitlePresetState {
  return {
    size: 'medium',
    position: 'bottom',
    fontFamily: 'Noto Sans CJK KR',
    background: true,
    backgroundOpacity: 0.55,
    segmentation: 'paragraph',
  };
}

export function isShortsEligible(durationSeconds: number, aspectRatio: AspectRatio = '16:9') {
  return aspectRatio === '9:16' && durationSeconds <= 60;
}

export function buildYoutubeMeta(project: Partial<SavedProject>, options?: { aspectRatio?: AspectRatio; durationSeconds?: number }): YoutubeMetaDraft {
  const topic = `${project.topic || project.name || '새 영상'}`.trim();
  const durationSeconds = options?.durationSeconds || project.ttsDuration || project.sceneDuration || 0;
  const aspectRatio = options?.aspectRatio || project.workflowDraft?.aspectRatio || '16:9';
  const shorts = isShortsEligible(durationSeconds, aspectRatio);
  const contentTypeLabel = project.workflowDraft?.contentType === 'info_delivery'
    ? '정보형'
    : project.workflowDraft?.contentType === 'cinematic'
      ? '시네마틱'
      : project.workflowDraft?.contentType === 'music_video'
        ? '뮤직비디오'
        : '스토리';
  const title = shorts ? `${topic} | ${contentTypeLabel} 쇼츠` : `${topic} | ${contentTypeLabel} 영상`;
  const description = [
    `${topic} 프로젝트로 제작한 영상입니다.`,
    shorts ? '세로형 쇼츠 기준으로 정리했습니다.' : '일반 영상 기준으로 정리했습니다.',
    `총 길이: ${Math.max(1, Math.round(durationSeconds))}초`,
  ].join('\n');
  const tags = Array.from(new Set([
    topic,
    contentTypeLabel,
    shorts ? 'shorts' : 'video',
    'mp4Creater',
    'AI 영상',
  ].filter(Boolean)));

  return {
    title,
    description,
    tags,
    privacyStatus: 'private',
    isShortsEligible: shorts,
  };
}
