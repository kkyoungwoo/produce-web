import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = String(body?.apiKey || '').trim();
    const text = String(body?.text || '').trim();
    const voiceId = String(body?.voiceId || '').trim();
    const locale = typeof body?.locale === 'string' ? body.locale.trim() : '';

    if (!apiKey || !text || !voiceId) {
      return NextResponse.json({ error: 'apiKey, text, voiceId는 필수입니다.' }, { status: 400 });
    }

    const response = await fetch('https://api.heygen.com/v1/audio/text_to_speech', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        ...(locale ? { locale } : {}),
      }),
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: json?.error?.message || `HeyGen tts request failed (${response.status})` }, { status: response.status });
    }

    const audioUrl = json?.data?.audio_url;
    let audioData: string | null = null;
    if (typeof audioUrl === 'string' && audioUrl) {
      const audioResponse = await fetch(audioUrl, { cache: 'no-store' });
      if (audioResponse.ok) {
        audioData = arrayBufferToBase64(await audioResponse.arrayBuffer());
      }
    }

    return NextResponse.json({
      audioData,
      audioUrl: typeof audioUrl === 'string' ? audioUrl : null,
      duration: typeof json?.data?.duration === 'number' ? json.data.duration : null,
      wordTimestamps: Array.isArray(json?.data?.word_timestamps) ? json.data.word_timestamps : [],
      requestId: typeof json?.data?.request_id === 'string' ? json.data.request_id : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HeyGen tts request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
