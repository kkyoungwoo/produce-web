import { NextResponse } from 'next/server';
import { clearYoutubeTokenStore } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

export async function POST() {
  await clearYoutubeTokenStore().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
