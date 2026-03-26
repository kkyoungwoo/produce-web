import { GeneratedAsset, SavedProject, VideoPreviewAsset } from '../../types';

function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function getBase64Payload(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:')) return trimmed;
  const separatorIndex = trimmed.indexOf(',');
  return separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1).trim() : '';
}

function decodeBase64(value: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }

  const buffer = (globalThis as { Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } } }).Buffer;
  if (buffer?.from) {
    return buffer.from(value, 'base64').toString('utf-8');
  }

  return '';
}

function isScenePlaceholderImageData(value?: string | null): boolean {
  if (!hasText(value)) return false;
  const payload = getBase64Payload(value!);
  if (!payload || payload.length > 20000) return false;

  try {
    const decoded = decodeBase64(payload).slice(0, 800).toUpperCase();
    return decoded.includes('<SVG') && decoded.includes('SAMPLE SCENE');
  } catch {
    return false;
  }
}

function hasMediaMetadata(value?: Record<string, unknown> | null): boolean {
  if (!value) return false;

  const stringKeys = [
    'url',
    'path',
    'blobUrl',
    'blobUri',
    'resultUrl',
    'resultPath',
    'mediaUrl',
    'mediaPath',
    'previewUrl',
    'previewPath',
    'downloadUrl',
    'downloadPath',
    'fileUrl',
    'filePath',
  ];

  if (stringKeys.some((key) => hasText(value[key] as string | null | undefined))) {
    return true;
  }

  const blobValue = value.blob;
  if (blobValue && typeof blobValue === 'object') {
    return true;
  }

  const objectKeys = ['metadata', 'result', 'media'];
  return objectKeys.some((key) => {
    const candidate = value[key];
    return Boolean(candidate && typeof candidate === 'object' && Object.keys(candidate as Record<string, unknown>).length > 0);
  });
}

export function hasGeneratedSceneStudioAsset(asset?: GeneratedAsset | null): boolean {
  if (!asset) return false;

  const hasImageHistory = Array.isArray(asset.imageHistory) && asset.imageHistory.length > 0;
  const hasVideoHistory = Array.isArray(asset.videoHistory) && asset.videoHistory.length > 0;
  const hasRenderableImage = hasText(asset.imageData) && !isScenePlaceholderImageData(asset.imageData);
  const hasAudioData = hasText(asset.audioData);
  const hasVideoData = hasText(asset.videoData);
  const hasSubtitleData = Boolean(
    asset.subtitleData?.fullText?.trim()
    || asset.subtitleData?.words?.length
    || asset.subtitleData?.meaningChunks?.length,
  );
  const hasDurationMetadata = Boolean(
    (typeof asset.audioDuration === 'number' && asset.audioDuration > 0)
    || (typeof asset.videoDuration === 'number' && asset.videoDuration > 0),
  );
  const hasCompletedMedia = asset.status === 'completed' && (hasRenderableImage || hasAudioData || hasVideoData || hasSubtitleData || hasDurationMetadata);

  return Boolean(
    hasImageHistory
    || hasVideoHistory
    || hasRenderableImage
    || hasAudioData
    || hasVideoData
    || hasSubtitleData
    || hasDurationMetadata
    || hasCompletedMedia
    || hasMediaMetadata(asset as unknown as Record<string, unknown>),
  );
}

function hasSceneStudioPreviewVideo(preview?: VideoPreviewAsset | null): boolean {
  if (!preview) return false;

  return Boolean(
    hasText(preview.videoData)
    || (typeof preview.duration === 'number' && preview.duration > 0)
    || hasMediaMetadata(preview as unknown as Record<string, unknown>),
  );
}

export function hasDetailedSceneStudioProject(project?: SavedProject | null): boolean {
  if (!project) return false;

  return Boolean(
    (Array.isArray(project.assets) && project.assets.some((asset) => hasGeneratedSceneStudioAsset(asset)))
    || hasSceneStudioPreviewVideo(project.sceneStudioPreviewVideo),
  );
}
