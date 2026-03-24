import { NextRequest, NextResponse } from 'next/server';
import { clearYoutubeClientConfigStore, getYoutubeClientConfig, readYoutubeClientConfigStore, writeYoutubeClientConfigStore } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

function maskSecret(secret: string) {
  if (!secret) return '';
  if (secret.length <= 6) return '•'.repeat(secret.length);
  return `${'•'.repeat(Math.max(0, secret.length - 4))}${secret.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const current = await getYoutubeClientConfig(origin);
  return NextResponse.json({
    clientId: current.source === 'saved' ? current.clientId : '',
    clientIdConfigured: Boolean(current.clientId),
    clientSecretConfigured: Boolean(current.clientSecret),
    clientSecretMask: current.source === 'saved' ? maskSecret(current.clientSecret) : '',
    redirectUri: current.redirectUri,
    source: current.source,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = await readYoutubeClientConfigStore();
    const clientId = String(body?.clientId || '').trim();
    const clientSecretInput = String(body?.clientSecret || '').trim();
    const keepExistingSecret = Boolean(body?.keepExistingSecret);
    const clientSecret = clientSecretInput || (keepExistingSecret ? current?.clientSecret || '' : '');

    if (!clientId && !clientSecret) {
      await clearYoutubeClientConfigStore();
      return NextResponse.json({ ok: true, cleared: true });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Google Client ID를 입력해 주세요.' }, { status: 400 });
    }

    if (!clientSecret) {
      return NextResponse.json({ error: 'Google Client Secret을 입력해 주세요.' }, { status: 400 });
    }

    const saved = await writeYoutubeClientConfigStore({
      clientId,
      clientSecret,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      clientId: saved.clientId,
      clientIdConfigured: Boolean(saved.clientId),
      clientSecretConfigured: Boolean(saved.clientSecret),
      clientSecretMask: maskSecret(saved.clientSecret),
      source: 'saved',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'youtube_config_save_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
