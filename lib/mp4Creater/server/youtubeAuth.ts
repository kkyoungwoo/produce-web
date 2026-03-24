import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type YoutubeTokenStore = {
  refreshToken: string;
  accessToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  email?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  state?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type YoutubeClientConfigStore = {
  clientId: string;
  clientSecret: string;
  updatedAt: number;
};

const STORAGE_DIR = path.join(process.cwd(), 'local-data', 'tubegen-studio');
const TOKEN_PATH = path.join(STORAGE_DIR, 'youtube-auth.json');
const CLIENT_CONFIG_PATH = path.join(STORAGE_DIR, 'youtube-client-config.json');

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

export async function readYoutubeTokenStore(): Promise<YoutubeTokenStore | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, 'utf-8');
    return JSON.parse(raw) as YoutubeTokenStore;
  } catch {
    return null;
  }
}

export async function writeYoutubeTokenStore(payload: YoutubeTokenStore) {
  await ensureDir();
  await fs.writeFile(TOKEN_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

export async function clearYoutubeTokenStore() {
  await fs.rm(TOKEN_PATH, { force: true });
}

export async function readYoutubeClientConfigStore(): Promise<YoutubeClientConfigStore | null> {
  try {
    const raw = await fs.readFile(CLIENT_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<YoutubeClientConfigStore>;
    const clientId = typeof parsed?.clientId === 'string' ? parsed.clientId.trim() : '';
    const clientSecret = typeof parsed?.clientSecret === 'string' ? parsed.clientSecret.trim() : '';
    if (!clientId && !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      updatedAt: typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function writeYoutubeClientConfigStore(payload: YoutubeClientConfigStore) {
  await ensureDir();
  const normalized = {
    clientId: payload.clientId.trim(),
    clientSecret: payload.clientSecret.trim(),
    updatedAt: payload.updatedAt || Date.now(),
  };
  await fs.writeFile(CLIENT_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

export async function clearYoutubeClientConfigStore() {
  await fs.rm(CLIENT_CONFIG_PATH, { force: true });
}

export async function getYoutubeClientConfig(origin?: string) {
  const stored = await readYoutubeClientConfigStore().catch(() => null);
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim() || process.env.YOUTUBE_GOOGLE_CLIENT_ID?.trim() || '';
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || process.env.YOUTUBE_GOOGLE_CLIENT_SECRET?.trim() || '';
  const clientId = envClientId || stored?.clientId || '';
  const clientSecret = envClientSecret || stored?.clientSecret || '';
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim() || `${origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mp4Creater/youtube/callback`;
  return {
    clientId,
    clientSecret,
    redirectUri,
    source: envClientId || envClientSecret ? 'env' : stored ? 'saved' : 'missing',
  } as const;
}

export async function buildYoutubeConnectUrl(origin?: string) {
  const { clientId, redirectUri } = await getYoutubeClientConfig(origin);
  if (!clientId || !redirectUri) return null;
  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    state,
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

export async function exchangeYoutubeCodeForTokens(code: string, origin?: string) {
  const { clientId, clientSecret, redirectUri } = await getYoutubeClientConfig(origin);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error_description || json?.error || `Google token exchange failed (${response.status})`);
  }
  return json;
}

export async function refreshYoutubeAccessToken(refreshToken: string, origin?: string) {
  const { clientId, clientSecret } = await getYoutubeClientConfig(origin);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error_description || json?.error || `Google token refresh failed (${response.status})`);
  }
  return json;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return response.ok ? response.json() : null;
}

export async function fetchYoutubeChannel(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || `YouTube channel fetch failed (${response.status})`);
  }
  const channel = Array.isArray(json?.items) ? json.items[0] : null;
  return {
    channelId: channel?.id || null,
    channelTitle: channel?.snippet?.title || null,
  };
}

export async function getValidYoutubeAccessToken(origin?: string) {
  const store = await readYoutubeTokenStore();
  if (!store?.refreshToken) return null;

  if (store.accessToken && store.expiresAt && store.expiresAt > Date.now() + 30_000) {
    return { accessToken: store.accessToken, store };
  }

  const refreshed = await refreshYoutubeAccessToken(store.refreshToken, origin);
  const nextStore: YoutubeTokenStore = {
    ...store,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (Number(refreshed.expires_in || 3600) * 1000),
    scope: refreshed.scope || store.scope || null,
    updatedAt: Date.now(),
  };
  await writeYoutubeTokenStore(nextStore);
  return { accessToken: nextStore.accessToken || '', store: nextStore };
}
