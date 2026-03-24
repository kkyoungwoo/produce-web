import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { mediaFilePath } from '../_shared';

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const relativeFilePath = request.nextUrl.searchParams.get('file') || '';

  if (!relativeFilePath.trim()) {
    return NextResponse.json({ message: 'file is required.' }, { status: 400 });
  }

  try {
    const filePath = mediaFilePath(storageDir || '', relativeFilePath);
    const buffer = await fs.readFile(filePath);
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const contentType =
      extension === 'png' ? 'image/png' :
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
      extension === 'webp' ? 'image/webp' :
      extension === 'gif' ? 'image/gif' :
      extension === 'mp3' ? 'audio/mpeg' :
      extension === 'wav' ? 'audio/wav' :
      extension === 'ogg' ? 'audio/ogg' :
      extension === 'm4a' ? 'audio/mp4' :
      extension === 'aac' ? 'audio/aac' :
      extension === 'mp4' ? 'video/mp4' :
      extension === 'webm' ? 'video/webm' :
      'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.warn('[local-storage/media] GET failed', error);
    return NextResponse.json({ message: 'Media not found.' }, { status: 404 });
  }
}
