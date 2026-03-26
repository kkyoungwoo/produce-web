import { GeneratedAsset, PreviewMixSettings, SubtitlePresetState, BackgroundMusicTrack } from '../types';

export function isFfmpegUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ffmpeg executable not found|spawn ffmpeg enoent|ffmpeg 실행 파일을 찾지 못했습니다/i.test(message);
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
  const response = await fetch('/api/mp4Creater/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
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
      throw new Error('서버에서 ffmpeg 실행 파일을 찾지 못했습니다. ffmpeg를 설치하거나 FFMPEG_PATH 환경변수에 ffmpeg.exe 경로를 넣어주세요.');
    }

    throw new Error(message || `ffmpeg render failed (${response.status})`);
  }

  const videoBlob = await response.blob();
  return {
    videoBlob,
  };
}
