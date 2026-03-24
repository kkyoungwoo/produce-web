import { NextRequest, NextResponse } from 'next/server';
import { exchangeYoutubeCodeForTokens, fetchGoogleProfile, fetchYoutubeChannel, readYoutubeTokenStore, writeYoutubeTokenStore } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

const buildPopupHtml = ({
  title,
  status,
  message,
  origin,
}: {
  title: string;
  status: 'success' | 'error';
  message: string;
  origin: string;
}) => `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 420px; background: rgba(255,255,255,0.96); border: 1px solid #e2e8f0; border-radius: 24px; padding: 28px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12); text-align: center; }
      .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 88px; height: 32px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${status === 'success' ? '#dcfce7' : '#fee2e2'}; color: ${status === 'success' ? '#166534' : '#b91c1c'}; }
      h1 { margin: 16px 0 8px; font-size: 20px; }
      p { margin: 0; font-size: 14px; line-height: 1.7; color: #475569; }
      .help { margin-top: 16px; padding: 14px 16px; border-radius: 18px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; line-height: 1.7; color: #64748b; }
      .actions { margin-top: 20px; display: flex; justify-content: center; gap: 8px; }
      button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 12px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="badge">${status === 'success' ? '연결 완료' : '연결 오류'}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="help">현재 창은 자동으로 닫히도록 시도합니다. 닫히지 않으면 아래 버튼으로 직접 닫아 주세요.</div>
        <div class="actions">
          <button type="button" onclick="window.close()">창 닫기</button>
        </div>
      </div>
    </div>
    <script>
      (function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'youtube-oauth-result',
              status: '${status}',
              message: ${JSON.stringify(message)},
            }, ${JSON.stringify(origin)});
          }
        } catch (error) {}
        setTimeout(function () {
          window.close();
        }, 800);
      })();
    </script>
  </body>
</html>`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const error = request.nextUrl.searchParams.get('error') || '';
  const origin = request.nextUrl.origin;

  if (error) {
    return new NextResponse(
      buildPopupHtml({
        title: '유튜브 연결이 취소되었어요',
        status: 'error',
        message: `Google 로그인 창에서 연결이 완료되지 않았습니다. (${error})`,
        origin,
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  const store = await readYoutubeTokenStore();
  if (!code || !state || !store?.state || store.state !== state) {
    return new NextResponse(
      buildPopupHtml({
        title: '연결 확인에 실패했어요',
        status: 'error',
        message: 'OAuth state가 일치하지 않습니다. 연결 창을 다시 열어 한 번 더 진행해 주세요.',
        origin,
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  try {
    const token = await exchangeYoutubeCodeForTokens(code, origin);
    const accessToken = token.access_token as string;
    const profile = await fetchGoogleProfile(accessToken).catch(() => null);
    const channel = await fetchYoutubeChannel(accessToken).catch(() => ({ channelId: null, channelTitle: null }));

    await writeYoutubeTokenStore({
      refreshToken: token.refresh_token || store.refreshToken,
      accessToken,
      expiresAt: Date.now() + (Number(token.expires_in || 3600) * 1000),
      scope: token.scope || null,
      email: profile?.email || null,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      createdAt: store.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    const label = [channel.channelTitle, profile?.email].filter(Boolean).join(' · ');
    return new NextResponse(
      buildPopupHtml({
        title: '유튜브 연결이 완료되었어요',
        status: 'success',
        message: label ? `${label} 계정으로 연결되었습니다.` : 'Google 계정 연결이 정상적으로 완료되었습니다.',
        origin,
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'youtube_oauth_failed';
    return new NextResponse(
      buildPopupHtml({
        title: '유튜브 연결 중 오류가 발생했어요',
        status: 'error',
        message,
        origin,
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
}
