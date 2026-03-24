import { GeneratedAsset, PreviewMixSettings, SubtitlePresetState, BackgroundMusicTrack } from '../types';

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
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error || `ffmpeg render failed (${response.status})`);
  }

  const videoBlob = await response.blob();
  return {
    videoBlob,
  };
}
