import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = String(body?.apiKey || '').trim();
    const limit = Math.max(1, Math.min(100, Number(body?.limit || 100)));
    const type = body?.type === 'private' ? 'private' : 'public';
    if (!apiKey) {
      return NextResponse.json({ error: 'HeyGen API 키가 비어 있습니다.' }, { status: 400 });
    }

    const response = await fetch(`https://api.heygen.com/v1/audio/voices?limit=${limit}&type=${type}`, {
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: json?.error?.message || `HeyGen voices request failed (${response.status})` }, { status: response.status });
    }

    return NextResponse.json({ voices: Array.isArray(json?.data?.voices) ? json.data.voices : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HeyGen voices request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
