import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type PexelsVideoFile = {
  id?: number;
  width?: number;
  height?: number;
  quality?: string;
  file_type?: string;
  link?: string;
};

type PexelsVideo = {
  id: number;
  url?: string;
  image?: string;
  duration?: number;
  width?: number;
  height?: number;
  video_files?: PexelsVideoFile[];
};

type PexelsPhoto = {
  id: number;
  alt?: string;
  width?: number;
  height?: number;
  url?: string;
  src?: {
    medium?: string;
    large?: string;
    original?: string;
  };
};

async function fetchAsDataUrl(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

function buildKeywords(rawQuery: string) {
  return rawQuery
    .replace(/[\[\]#*]/g, ' ')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = buildKeywords(String(body?.query || '').trim());
    const limit = Math.max(1, Math.min(4, Number(body?.limit || 3)));
    const mediaType = body?.mediaType === 'video' ? 'video' : 'image';
    const apiKey = process.env.PEXELS_API_KEY?.trim() || '';

    if (!query) {
      return NextResponse.json({ items: [] });
    }

    if (!apiKey) {
      return NextResponse.json({
        items: [],
        provider: 'sample',
        fallbackReason: 'PEXELS_API_KEY가 없어 샘플 경로를 유지합니다.',
      });
    }

    const endpoint = mediaType === 'video'
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({ items: [], error: text || `Pexels search failed (${response.status})` }, { status: response.status });
    }

    const json = await response.json();
    const items = [] as Array<Record<string, unknown>>;

    if (mediaType === 'video') {
      const videos = Array.isArray(json?.videos) ? (json.videos as PexelsVideo[]) : [];
      for (const video of videos.slice(0, limit)) {
        const videoFile = (video.video_files || [])
          .filter((item) => typeof item?.link === 'string' && item.link)
          .sort((a, b) => (Number(a?.width || 0) * Number(a?.height || 0)) - (Number(b?.width || 0) * Number(b?.height || 0)))[0];
        if (!videoFile?.link) continue;
        items.push({
          id: `pexels_video_${video.id}`,
          type: 'video',
          title: query,
          provider: 'pexels',
          videoUrl: videoFile.link,
          previewUrl: video.image || null,
          sourceUrl: video.url || videoFile.link,
          width: typeof videoFile.width === 'number' ? videoFile.width : (typeof video.width === 'number' ? video.width : null),
          height: typeof videoFile.height === 'number' ? videoFile.height : (typeof video.height === 'number' ? video.height : null),
          duration: typeof video.duration === 'number' ? video.duration : null,
        });
      }

      return NextResponse.json({ items, provider: 'pexels', query, mediaType });
    }

    const photos = Array.isArray(json?.photos) ? (json.photos as PexelsPhoto[]) : [];
    const sliced = photos.slice(0, limit);

    for (const photo of sliced) {
      const previewUrl = photo.src?.large || photo.src?.medium || photo.src?.original || '';
      if (!previewUrl) continue;
      const dataUrl = await fetchAsDataUrl(previewUrl).catch(() => null);
      if (!dataUrl) continue;
      items.push({
        id: `pexels_${photo.id}`,
        type: 'image',
        title: photo.alt || query,
        provider: 'pexels',
        dataUrl,
        previewUrl,
        sourceUrl: photo.url || previewUrl,
        width: typeof photo.width === 'number' ? photo.width : null,
        height: typeof photo.height === 'number' ? photo.height : null,
      });
    }

    return NextResponse.json({ items, provider: 'pexels', query, mediaType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'free-media search failed';
    return NextResponse.json({ items: [], error: message }, { status: 500 });
  }
}
