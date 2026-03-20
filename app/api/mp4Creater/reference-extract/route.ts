import { NextRequest, NextResponse } from 'next/server';

function extractMetaContent(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return '';
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function summarizeText(text: string, maxLength = 900) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trim()}...`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; mp4Creater/1.0; +https://example.com)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`링크를 읽지 못했습니다. (${response.status})`);
  }

  return response.text();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUrl = String(body?.url || '').trim();
    if (!rawUrl) {
      return NextResponse.json({ error: '링크 주소가 비어 있습니다.' }, { status: 400 });
    }

    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json({ error: 'http 또는 https 링크만 분석할 수 있습니다.' }, { status: 400 });
    }

    const host = url.hostname.toLowerCase();
    const kind = host.includes('youtube.com') || host.includes('youtu.be') ? 'youtube' : 'web';
    const html = await fetchHtml(url.toString());

    const title = extractMetaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
      /<title>([^<]+)<\/title>/i,
    ]);

    const description = extractMetaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
    ]);

    const bodyText = stripHtml(html);
    const sourceText = summarizeText(
      [
        title ? `제목: ${title}` : '',
        description ? `설명: ${description}` : '',
        bodyText,
      ].filter(Boolean).join(' '),
      kind === 'youtube' ? 1200 : 1800
    );

    const summary = summarizeText(
      kind === 'youtube'
        ? [title, description, bodyText].filter(Boolean).join(' ')
        : [description, bodyText].filter(Boolean).join(' '),
      480
    );

    return NextResponse.json({
      kind,
      title: title || url.toString(),
      summary,
      sourceText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '링크 분석에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
