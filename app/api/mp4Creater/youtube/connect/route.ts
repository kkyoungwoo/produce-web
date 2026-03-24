import { NextRequest, NextResponse } from 'next/server';
import { buildYoutubeConnectUrl, clearYoutubeTokenStore, getYoutubeClientConfig, writeYoutubeTokenStore } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const config = await getYoutubeClientConfig(origin);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.json({ error: '설정에서 Google Client ID / Client Secret 또는 환경변수를 입력해 주세요.' }, { status: 500 });
  }

  const built = await buildYoutubeConnectUrl(origin);
  if (!built) {
    return NextResponse.json({ error: '유튜브 연결 URL을 만들 수 없습니다.' }, { status: 500 });
  }

  await clearYoutubeTokenStore().catch(() => undefined);
  await writeYoutubeTokenStore({
    refreshToken: '',
    state: built.state,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return NextResponse.redirect(built.url);
}
