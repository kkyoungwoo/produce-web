import { NextRequest, NextResponse } from 'next/server';
import { fetchYoutubeChannel, getValidYoutubeAccessToken, readYoutubeTokenStore, writeYoutubeTokenStore } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const valid = await getValidYoutubeAccessToken(origin);
    if (!valid?.accessToken) {
      return NextResponse.json({ connected: false });
    }
    const channel = await fetchYoutubeChannel(valid.accessToken);
    const store = await readYoutubeTokenStore();
    if (store) {
      await writeYoutubeTokenStore({
        ...store,
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        updatedAt: Date.now(),
      });
    }
    return NextResponse.json({
      connected: true,
      email: store?.email || null,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'youtube_status_failed';
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}
