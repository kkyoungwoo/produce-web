export function sanitizeDownloadName(name: string, fallback = 'download'): string {
  const cleaned = (name || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeDownloadName(filename);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerTextDownload(content: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  triggerBlobDownload(new Blob([content], { type: mime }), filename);
}

export function parseDataUrl(value: string | null | undefined, fallbackMime: string): { mime: string; bytes: Uint8Array } | null {
  if (!value) return null;
  const trimmed = value.trim();

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return null;
    const mime = match[1] || fallbackMime;
    const base64 = match[2] || '';
    return { mime, bytes: base64ToBytes(base64) };
  }

  const normalized = trimmed.replace(/\s+/g, '');
  if (!normalized) return null;
  return { mime: fallbackMime, bytes: base64ToBytes(normalized) };
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function blobFromDataValue(value: string | null | undefined, fallbackMime: string): Blob | null {
  const parsed = parseDataUrl(value, fallbackMime);
  if (!parsed) return null;
  const view = parsed.bytes;
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return new Blob([copy.buffer], { type: parsed.mime });
}

export function extensionFromMime(mime: string, fallback: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('json')) return 'json';
  if (normalized.includes('csv')) return 'csv';
  if (normalized.includes('html')) return 'html';
  return fallback;
}

export async function triggerSequentialDownloads(items: Array<{ blob: Blob; filename: string }>, intervalMs = 180): Promise<void> {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    triggerBlobDownload(item.blob, item.filename);
    if (i < items.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
  }
}
