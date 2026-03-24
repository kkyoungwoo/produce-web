import { YoutubeMetaDraft } from '../types';

export type YoutubeConnectionStatus = {
  connected: boolean;
  email?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  error?: string | null;
};

export async function fetchYoutubeConnectionStatus(): Promise<YoutubeConnectionStatus> {
  const response = await fetch('/api/mp4Creater/youtube/status', { cache: 'no-store' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      connected: false,
      error: json?.error || `youtube status failed (${response.status})`,
    };
  }
  return {
    connected: Boolean(json?.connected),
    email: json?.email || null,
    channelId: json?.channelId || null,
    channelTitle: json?.channelTitle || null,
    error: json?.error || null,
  };
}

export function openYoutubeConnectWindow() {
  window.location.href = '/api/mp4Creater/youtube/connect';
}

export async function disconnectYoutubeAccount() {
  const response = await fetch('/api/mp4Creater/youtube/disconnect', {
    method: 'POST',
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error || 'youtube disconnect failed');
  }
}

export async function uploadVideoToYoutube(options: {
  file: File;
  meta: YoutubeMetaDraft;
}) {
  const formData = new FormData();
  formData.set('file', options.file);
  formData.set('title', options.meta.title);
  formData.set('description', options.meta.description);
  formData.set('tags', options.meta.tags.join(','));
  formData.set('privacyStatus', options.meta.privacyStatus);

  const response = await fetch('/api/mp4Creater/youtube/upload', {
    method: 'POST',
    body: formData,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `youtube upload failed (${response.status})`);
  }
  return json;
}
