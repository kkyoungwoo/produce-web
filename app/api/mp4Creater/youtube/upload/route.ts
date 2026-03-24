import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getValidYoutubeAccessToken } from '../../../../../lib/mp4Creater/server/youtubeAuth';

export const runtime = 'nodejs';

function buildMultipartBody(boundary: string, metadata: Record<string, unknown>, fileName: string, mimeType: string, bytes: Buffer) {
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Disposition: attachment; filename="${fileName}"\r\n\r\n`
  );
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([metaPart, fileHeader, bytes, endPart]);
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const valid = await getValidYoutubeAccessToken(origin);
    if (!valid?.accessToken) {
      return NextResponse.json({ error: '유튜브 계정이 연결되지 않았습니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const tags = String(formData.get('tags') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const privacyStatus = String(formData.get('privacyStatus') || 'private').trim() || 'private';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '업로드할 mp4 파일이 필요합니다.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const boundary = `mp4creater_${Date.now().toString(36)}`;
    const metadata = {
      snippet: {
        title: title || 'mp4Creater 업로드',
        description,
        tags,
      },
      status: {
        privacyStatus,
      },
    };

    const body = buildMultipartBody(boundary, metadata, file.name || 'video.mp4', file.type || 'video/mp4', bytes);
    const uploadResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.byteLength),
      },
      body,
      cache: 'no-store',
    });

    const json = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      return NextResponse.json({ error: json?.error?.message || `YouTube upload failed (${uploadResponse.status})` }, { status: uploadResponse.status });
    }

    return NextResponse.json({
      ok: true,
      videoId: json?.id || null,
      privacyStatus,
      uploadedAt: Date.now(),
      raw: json,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'youtube_upload_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
