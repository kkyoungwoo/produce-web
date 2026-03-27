import { GeneratedAsset, PreviewMixSettings, SubtitlePresetState, BackgroundMusicTrack } from '../types';

export function isFfmpegUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ffmpeg executable not found|spawn ffmpeg enoent|ffmpeg.+찾지 못했습니다/i.test(message);
}

export async function renderVideoWithFfmpeg(options: {
  assets: GeneratedAsset[];
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  aspectRatio?: '16:9' | '1:1' | '9:16';
  qualityMode?: 'preview' | 'final';
  enableSubtitles?: boolean;
  subtitlePreset?: SubtitlePresetState | null;
  title?: string;
}) {
  const absolutizeMediaValue = (value?: string | null) => {
    const normalized = `${value || ''}`.trim();
    if (!normalized) return null;
    if (normalized.startsWith('/')) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${normalized}`;
      }
    }
    return normalized;
  };

  const payload = {
    ...options,
    assets: options.assets.map((asset) => ({
      ...asset,
      imageData: absolutizeMediaValue(asset.imageData),
      audioData: absolutizeMediaValue(asset.audioData),
      videoData: absolutizeMediaValue(asset.videoData),
    })),
    backgroundTracks: (options.backgroundTracks || []).map((track) => ({
      ...track,
      audioData: absolutizeMediaValue(track.audioData),
    })),
  };

  const response = await fetch('/api/mp4Creater/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallbackText = await response.text().catch(() => '');
    let message = '';

    try {
      const json = fallbackText ? JSON.parse(fallbackText) : {};
      message = json?.error || '';
    } catch {
      message = fallbackText.trim();
    }

    if (/ffmpeg executable not found|spawn ffmpeg enoent/i.test(message)) {
      throw new Error('서버에서 ffmpeg 실행 파일을 찾지 못했습니다. 기본 번들 ffmpeg도 준비되지 않았으니 배포 로그를 확인하거나 FFMPEG_PATH 환경변수에 ffmpeg 실행 경로를 넣어주세요.');
    }

    throw new Error(message || `ffmpeg render failed (${response.status})`);
  }

  const videoBlob = await response.blob();
  return {
    videoBlob,
  };
}
