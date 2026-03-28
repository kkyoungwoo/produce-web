/**
 * 스토리보드 / CapCut 패키지 내보내기 서비스
 * 외부 패키지 없이 엑셀 호환 HTML(.xls)과 저장형 ZIP을 생성합니다.
 */

import { BackgroundMusicTrack, DEFAULT_SUBTITLE_CONFIG, GeneratedAsset, PreviewMixSettings, SavedProject } from '../types';
import { blobFromDataValue, extensionFromMime, parseDataUrl, triggerBlobDownload } from '../utils/downloadHelpers';
import { generateSrtContent, generateSrtFromRecorded } from './srtService';
import { generateVideo } from './videoService';
import { resolveAssetPlaybackDuration } from './projectEnhancementService';

/**
 * 파일명에 사용할 수 없는 문자 제거
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 현재 생성된 에셋을 엑셀 호환 HTML 파일로 내보내기
 */
export async function exportAssetsToZip(
  assets: GeneratedAsset[],
  projectName: string
): Promise<void> {
  const rows = assets
    .map(
      (asset, index) => `
    <tr>
      <td>${asset.sceneNumber || index + 1}</td>
      <td>${escapeHtml(asset.narration || '')}</td>
      <td>${asset.imageData ? '있음' : '없음'}</td>
      <td>${escapeHtml(asset.analysis?.sentiment || '')}</td>
      <td>${escapeHtml(asset.analysis?.composition_type || '')}</td>
    </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d0d0; padding: 8px; vertical-align: top; }
    th { background: #4472c4; color: white; }
    td { white-space: pre-wrap; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>씬</th>
        <th>나레이션</th>
        <th>이미지</th>
        <th>감정</th>
        <th>구도</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const safeName = sanitizeFilename(projectName);
  triggerBlobDownload(
    new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    `${safeName}_스토리보드.xls`
  );
}

/**
 * 저장된 프로젝트를 엑셀로 내보내기
 */
export async function exportProjectToZip(project: SavedProject): Promise<void> {
  return exportAssetsToZip(project.assets, project.name);
}

export interface CapCutDragBundleOptions {
  qualityMode?: 'preview' | 'final';
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
}

export interface DavinciResolvePackageOptions {
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  finalVideoUrl?: string | null;
  finalVideoTitle?: string | null;
  finalVideoDuration?: number | null;
  aspectRatio?: GeneratedAsset['aspectRatio'] | null;
}

export interface CapCutSubtitlePackageOptions {
  fps?: number;
  aspectRatio?: GeneratedAsset['aspectRatio'] | null;
}

interface ZipEntryInput {
  path: string;
  bytes: Uint8Array;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();
const textEncoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function getDosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function createStoredZip(entries: ZipEntryInput[]): Blob {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const { time, date } = getDosDateTime(now);

  entries.forEach((entry) => {
    const nameBytes = textEncoder.encode(entry.path.replace(/\\/g, '/'));
    const data = entry.bytes;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatUint8Arrays(centralChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  const allParts = [...localChunks.map(toBlobPart), toBlobPart(centralDirectory), toBlobPart(endRecord)];
  return new Blob(allParts, { type: 'application/zip' });
}

function toBlobPart(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function bytesFromText(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function bytesFromBlob(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function safeBasename(value: string): string {
  const cleaned = sanitizeFilename(value).replace(/\s+/g, '_');
  return cleaned || 'mp4Creater';
}

function detectVideoExtension(blob: Blob): string {
  const explicit = extensionFromMime(blob.type || 'video/mp4', 'mp4');
  return explicit === 'mp4' || explicit === 'webm' ? explicit : 'mp4';
}

function extractPreferredVideoBlob(asset: GeneratedAsset): Blob | null {
  if (!asset.videoData) return null;
  return blobFromDataValue(asset.videoData, 'video/mp4');
}

function extractNarrationBlob(asset: GeneratedAsset): Blob | null {
  if (!asset.audioData) return null;
  return blobFromDataValue(asset.audioData, 'audio/mpeg');
}

async function bytesFromResolvableValue(value: string | null | undefined, fallbackMime: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const parsed = parseDataUrl(value, fallbackMime);
  if (parsed) {
    return parsed;
  }

  const source = `${value || ''}`.trim();
  if (!source || typeof fetch !== 'function') return null;
  if (!/^blob:|^https?:\/\//i.test(source)) return null;

  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return {
      mime: blob.type || fallbackMime,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    };
  } catch {
    return null;
  }
}

function detectSceneVisualSource(asset: GeneratedAsset): { kind: 'image' | 'video'; value: string; fallbackMime: string } | null {
  if (asset.selectedVisualType === 'video' && asset.videoData) {
    return { kind: 'video', value: asset.videoData, fallbackMime: 'video/mp4' };
  }
  if (asset.selectedVisualType !== 'video' && asset.imageData) {
    return { kind: 'image', value: asset.imageData, fallbackMime: 'image/png' };
  }
  if (asset.videoData) {
    return { kind: 'video', value: asset.videoData, fallbackMime: 'video/mp4' };
  }
  if (asset.imageData) {
    return { kind: 'image', value: asset.imageData, fallbackMime: 'image/png' };
  }
  return null;
}

function formatTimecodeFromFrames(totalFrames: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps));
  const frames = Math.max(0, Math.round(totalFrames));
  const hours = Math.floor(frames / (safeFps * 3600));
  const minutes = Math.floor((frames % (safeFps * 3600)) / (safeFps * 60));
  const seconds = Math.floor((frames % (safeFps * 60)) / safeFps);
  const frame = frames % safeFps;
  return [hours, minutes, seconds, frame].map((value) => String(value).padStart(2, '0')).join(':');
}

function roundDurationSeconds(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(3));
}

const DEFAULT_CAPCUT_SUBTITLE_STYLE = {
  presetName: 'plain-clean-default',
  fontFamily: 'Pretendard',
  fallbackFontFamily: 'NanumSquare, Malgun Gothic, Apple SD Gothic Neo, sans-serif',
  fontSize: Math.max(40, DEFAULT_SUBTITLE_CONFIG.fontSize || 40),
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidthRatio: 0.12,
  alignment: 'center',
  verticalAnchor: 'bottom',
  positionX: 0.5,
  positionY: 0.88,
  safeZoneBottomRatio: 0.08,
  maxLines: Math.max(1, DEFAULT_SUBTITLE_CONFIG.maxLines || 1),
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveSubtitleDisplayText(asset: GeneratedAsset): string {
  if (asset.subtitleData?.fullText?.trim()) return asset.subtitleData.fullText.trim();
  if (asset.narration?.trim()) return asset.narration.trim();
  return '';
}

function buildCapCutSubtitleEntries(
  assets: GeneratedAsset[],
  fps: number
): { entries: Array<Record<string, unknown>>; totalDurationSeconds: number; sceneCount: number } {
  const validAssets = assets.filter((asset) => Boolean(
    asset.imageData
    || asset.videoData
    || asset.audioData
    || asset.subtitleData?.fullText?.trim()
    || asset.narration?.trim()
  ));
  const entries: Array<Record<string, unknown>> = [];
  let timelineCursorSeconds = 0;
  let globalIndex = 1;

  validAssets.forEach((asset, assetIndex) => {
    const sceneNumber = asset.sceneNumber || assetIndex + 1;
    const durationSeconds = resolveAssetPlaybackDuration(asset, {
      fallbackNarrationEstimate: true,
      preferTargetDuration: true,
      minimum: 1,
    });
    const sceneStartSeconds = timelineCursorSeconds;
    const sceneEndSeconds = sceneStartSeconds + durationSeconds;
    const subtitleWords = asset.subtitleData?.words || [];

    const pushEntry = (startSeconds: number, endSeconds: number, textValue: string) => {
      const normalizedText = `${textValue || ''}`.trim();
      if (!normalizedText) return;
      const clampedStart = Math.max(sceneStartSeconds, Number(startSeconds.toFixed(3)));
      const clampedEnd = Math.max(
        clampedStart + (1 / Math.max(fps, 1)),
        Math.min(sceneEndSeconds, Number(endSeconds.toFixed(3)))
      );
      const startFrame = Math.round(clampedStart * fps);
      const endFrame = Math.max(startFrame + 1, Math.round(clampedEnd * fps));

      entries.push({
        id: `capcut_subtitle_${String(globalIndex).padStart(4, '0')}`,
        index: globalIndex,
        sceneNumber,
        startSeconds: clampedStart,
        endSeconds: clampedEnd,
        durationSeconds: Number((clampedEnd - clampedStart).toFixed(3)),
        startFrame,
        endFrame,
        durationFrames: Math.max(1, endFrame - startFrame),
        startTimecode: formatTimecodeFromFrames(startFrame, fps),
        endTimecode: formatTimecodeFromFrames(endFrame, fps),
        text: normalizedText,
        style: DEFAULT_CAPCUT_SUBTITLE_STYLE,
      });
      globalIndex += 1;
    };

    if (subtitleWords.length) {
      const wordsPerLine = Math.max(1, DEFAULT_SUBTITLE_CONFIG.wordsPerLine || 1);
      for (let wordIndex = 0; wordIndex < subtitleWords.length; wordIndex += wordsPerLine) {
        const chunkWords = subtitleWords.slice(wordIndex, Math.min(wordIndex + wordsPerLine, subtitleWords.length));
        if (!chunkWords.length) continue;
        const nextChunkStart = subtitleWords[wordIndex + wordsPerLine]?.start;
        const chunkStartSeconds = sceneStartSeconds + Math.max(0, chunkWords[0].start || 0);
        const chunkEndBase = typeof nextChunkStart === 'number'
          ? nextChunkStart
          : chunkWords[chunkWords.length - 1].end;
        const chunkEndSeconds = sceneStartSeconds + Math.min(
          durationSeconds,
          Math.max(chunkWords[0].start || 0, chunkEndBase || durationSeconds)
        );
        pushEntry(chunkStartSeconds, chunkEndSeconds, chunkWords.map((word) => word.word).join(' '));
      }
    } else {
      const fallbackText = resolveSubtitleDisplayText(asset);
      if (fallbackText) {
        pushEntry(sceneStartSeconds, sceneEndSeconds, fallbackText);
      }
    }

    timelineCursorSeconds += durationSeconds;
  });

  return {
    entries,
    totalDurationSeconds: Number(timelineCursorSeconds.toFixed(3)),
    sceneCount: validAssets.length,
  };
}

function buildCapCutSubtitleXml(
  projectName: string,
  fps: number,
  aspectRatio: GeneratedAsset['aspectRatio'] | null | undefined,
  totalDurationFrames: number,
  entries: Array<Record<string, unknown>>
): string {
  const style = DEFAULT_CAPCUT_SUBTITLE_STYLE;
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<capcut-subtitle-package version="1.0">',
    `  <project name="${escapeXml(projectName)}" fps="${fps}" aspectRatio="${escapeXml(aspectRatio || '16:9')}">`,
    `    <default-style presetName="${escapeXml(style.presetName)}" fontFamily="${escapeXml(style.fontFamily)}" fallbackFontFamily="${escapeXml(style.fallbackFontFamily)}" fontSize="${style.fontSize}" textColor="${style.textColor}" strokeColor="${style.strokeColor}" strokeWidthRatio="${style.strokeWidthRatio}" alignment="${style.alignment}" verticalAnchor="${style.verticalAnchor}" positionX="${style.positionX}" positionY="${style.positionY}" safeZoneBottomRatio="${style.safeZoneBottomRatio}" maxLines="${style.maxLines}" />`,
    `    <timeline totalFrames="${totalDurationFrames}" totalTimecode="${formatTimecodeFromFrames(totalDurationFrames, fps)}">`,
  ];

  entries.forEach((entry) => {
    xmlLines.push(
      `      <text-item id="${escapeXml(String(entry.id))}" index="${entry.index}" sceneNumber="${entry.sceneNumber}" startFrame="${entry.startFrame}" endFrame="${entry.endFrame}" durationFrames="${entry.durationFrames}" startTimecode="${escapeXml(String(entry.startTimecode))}" endTimecode="${escapeXml(String(entry.endTimecode))}" fontFamily="${escapeXml(style.fontFamily)}" fallbackFontFamily="${escapeXml(style.fallbackFontFamily)}" fontSize="${style.fontSize}" alignment="${style.alignment}" verticalAnchor="${style.verticalAnchor}" positionX="${style.positionX}" positionY="${style.positionY}" textColor="${style.textColor}" strokeColor="${style.strokeColor}" strokeWidthRatio="${style.strokeWidthRatio}" maxLines="${style.maxLines}">${escapeXml(String(entry.text || ''))}</text-item>`
    );
  });

  xmlLines.push('    </timeline>', '  </project>', '</capcut-subtitle-package>');
  return xmlLines.join('\n');
}

function buildCapCutSubtitleReadme(projectName: string, entryCount: number): string {
  return [
    `프로젝트: ${projectName}`,
    '',
    'CapCut 자막 패키지 구성',
    '1. *_for_CapCut.srt : CapCut Desktop/Web에서 바로 가져오기 쉬운 기본 자막 파일',
    '2. *_for_CapCut.xml : 동일 타이밍과 기본 스타일값을 담은 XML 매핑 파일',
    '3. *_for_CapCut.json : XML과 동일한 내용을 JSON으로 저장한 매핑 파일',
    '',
    '권장 사용 순서',
    '1. CapCut에는 SRT 파일을 먼저 가져옵니다.',
    '2. XML/JSON은 자막 스타일 기본값과 프레임 기준 타이밍을 확인하는 참고용으로 사용합니다.',
    '3. 기본 스타일은 Pretendard 계열, 흰색 글자, 검은 외곽선, 하단 중앙 배치로 맞춰져 있습니다.',
    '',
    `총 자막 청크 수: ${entryCount}`,
  ].join('\n');
}


function buildCapCutSubtitleSrt(entries: Array<Record<string, unknown>>): string {
  return entries
    .map((entry, index) => [
      String(index + 1),
      `${formatSrtTimestamp(Number(entry.startSeconds || 0))} --> ${formatSrtTimestamp(Number(entry.endSeconds || 0))}`,
      `${entry.text || ''}`.trim(),
      '',
    ].join('\n'))
    .join('\n')
    .trim();
}

function buildSceneLocalSrt(asset: GeneratedAsset, durationSeconds: number): string {
  const subtitleWords = asset.subtitleData?.words || [];
  if (!subtitleWords.length) {
    const fallbackText = `${asset.narration || ''}`.trim();
    if (!fallbackText) return '';
    return [
      '1',
      `00:00:00,000 --> ${formatSrtTimestamp(durationSeconds)}`,
      fallbackText,
      '',
    ].join('\n');
  }

  const chunkSize = Math.max(1, DEFAULT_SUBTITLE_CONFIG.wordsPerLine || 5);
  const lines: string[] = [];
  let index = 1;
  for (let wordIndex = 0; wordIndex < subtitleWords.length; wordIndex += chunkSize) {
    const chunk = subtitleWords.slice(wordIndex, Math.min(wordIndex + chunkSize, subtitleWords.length));
    if (!chunk.length) continue;
    const startTime = Math.max(0, chunk[0].start || 0);
    const nextChunkStart = wordIndex + chunkSize < subtitleWords.length
      ? Math.max(startTime, subtitleWords[wordIndex + chunkSize].start || 0)
      : Math.max(startTime, chunk[chunk.length - 1].end || durationSeconds || 0);
    const endTime = Math.max(startTime, Math.min(durationSeconds || nextChunkStart, nextChunkStart));

    lines.push(String(index));
    lines.push(`${formatSrtTimestamp(startTime)} --> ${formatSrtTimestamp(endTime)}`);
    lines.push(chunk.map((item) => item.word).join(' '));
    lines.push('');
    index += 1;
  }

  return lines.join('\n').trim();
}

function buildMasterTimelineSrt(assets: GeneratedAsset[]): string {
  const lines: string[] = [];
  let globalIndex = 1;
  let timelineCursor = 0;

  assets.forEach((asset) => {
    const durationSeconds = resolveAssetPlaybackDuration(asset, { fallbackNarrationEstimate: true, preferTargetDuration: true, minimum: 1 });
    const subtitleWords = asset.subtitleData?.words || [];

    if (!subtitleWords.length) {
      const fallbackText = `${asset.narration || ''}`.trim();
      if (fallbackText) {
        lines.push(String(globalIndex));
        lines.push(`${formatSrtTimestamp(timelineCursor)} --> ${formatSrtTimestamp(timelineCursor + durationSeconds)}`);
        lines.push(fallbackText);
        lines.push('');
        globalIndex += 1;
      }
      timelineCursor += durationSeconds;
      return;
    }

    const chunkSize = Math.max(1, DEFAULT_SUBTITLE_CONFIG.wordsPerLine || 5);
    for (let wordIndex = 0; wordIndex < subtitleWords.length; wordIndex += chunkSize) {
      const chunk = subtitleWords.slice(wordIndex, Math.min(wordIndex + chunkSize, subtitleWords.length));
      if (!chunk.length) continue;
      const localStart = Math.max(0, chunk[0].start || 0);
      const nextLocalStart = wordIndex + chunkSize < subtitleWords.length
        ? Math.max(localStart, subtitleWords[wordIndex + chunkSize].start || 0)
        : Math.max(localStart, chunk[chunk.length - 1].end || durationSeconds || 0);
      lines.push(String(globalIndex));
      lines.push(`${formatSrtTimestamp(timelineCursor + localStart)} --> ${formatSrtTimestamp(timelineCursor + Math.max(localStart, Math.min(durationSeconds || nextLocalStart, nextLocalStart)))}`);
      lines.push(chunk.map((item) => item.word).join(' '));
      lines.push('');
      globalIndex += 1;
    }

    timelineCursor += durationSeconds;
  });

  return lines.join('\n').trim();
}

function formatSrtTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const ms = Math.round((safeSeconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function buildSceneNote(asset: GeneratedAsset, durationSeconds: number): string {
  return [
    `씬 번호: ${asset.sceneNumber}`,
    `길이(초): ${roundDurationSeconds(durationSeconds)}`,
    `선택 비주얼: ${asset.selectedVisualType || (asset.videoData ? 'video' : asset.imageData ? 'image' : 'none')}`,
    '',
    '[나레이션]',
    `${asset.narration || ''}`.trim() || '(없음)',
    '',
    '[이미지 프롬프트]',
    `${asset.imagePrompt || asset.visualPrompt || ''}`.trim() || '(없음)',
    '',
    '[영상 프롬프트]',
    `${asset.videoPrompt || ''}`.trim() || '(없음)',
  ].join('\n');
}

function buildDavinciUsageGuide(projectName: string, sceneCount: number, hasPreviewVideo: boolean): string {
  return [
    `프로젝트: ${projectName}`,
    '',
    'DaVinci Resolve 사용 순서',
    '1. ZIP을 푼 뒤 media 폴더 전체를 Resolve Media Pool로 가져옵니다.',
    '2. timeline/davinci_timeline_map.json을 열어 씬 순서, 길이, 파일명을 확인합니다.',
    '3. Edit 페이지에서 video_track_1 순서대로 씬 비주얼 파일을 배치합니다.',
    '4. narration_track_1 오디오 파일을 같은 씬 번호 기준으로 아래 오디오 트랙에 올립니다.',
    '5. subtitles/000_master_timeline.srt를 별도 자막 파일로 가져오면 전체 자막 타이밍을 다시 맞추기 쉽습니다.',
    '6. background_music 폴더의 파일은 필요할 때만 추가하고, JSON에 적힌 권장 볼륨을 참고합니다.',
    hasPreviewVideo ? '7. reference 폴더의 최종 미리보기 MP4는 배치가 맞는지 비교하는 참고본입니다.' : '7. reference 폴더에 미리보기 MP4가 없으면 JSON 타임라인 길이를 기준으로 먼저 정렬하세요.',
    '',
    '참고',
    '- 이 패키지는 실제 AAF 바이너리 대신 AAF 제작에 바로 연결할 수 있는 JSON 매핑 파일을 함께 넣습니다.',
    '- aaf_export_mapping.json의 recordStartFrame / recordDurationFrames / sourceFile 값을 기준으로 후속 자동화에 연결할 수 있습니다.',
    '- still 이미지 씬은 JSON의 durationMs 길이만큼 Resolve에서 still duration을 맞춰 주세요.',
    '',
    `총 씬 수: ${sceneCount}`,
  ].join('\n');
}

export async function exportCapCutSubtitlePackage(
  assets: GeneratedAsset[],
  projectName: string,
  options: CapCutSubtitlePackageOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  const fps = Math.max(1, Math.round(options.fps || 30));
  const aspectRatio = options.aspectRatio || assets[0]?.aspectRatio || '16:9';
  const { entries, totalDurationSeconds } = buildCapCutSubtitleEntries(assets, fps);

  if (!entries.length) {
    alert('CapCut용으로 내보낼 자막이 없습니다. 씬 대본이나 자막 데이터를 먼저 준비해 주세요.');
    return;
  }

  const safeProjectName = safeBasename(projectName);
  const totalDurationFrames = Math.max(1, Math.round(totalDurationSeconds * fps));
  const jsonPayload = {
    format: 'mp4Creater-capcut-subtitle-package',
    version: 1,
    project: {
      name: projectName,
      fps,
      aspectRatio,
      totalDurationFrames,
      totalDurationTimecode: formatTimecodeFromFrames(totalDurationFrames, fps),
    },
    defaultStyle: DEFAULT_CAPCUT_SUBTITLE_STYLE,
    subtitles: entries,
  };

  const xmlPayload = buildCapCutSubtitleXml(projectName, fps, aspectRatio, totalDurationFrames, entries);
  const srtContent = buildCapCutSubtitleSrt(entries);
  const zipEntries: ZipEntryInput[] = [
    { path: `capcut_subtitles/${safeProjectName}_for_CapCut.xml`, bytes: bytesFromText(xmlPayload) },
    { path: `capcut_subtitles/${safeProjectName}_for_CapCut.json`, bytes: bytesFromText(JSON.stringify(jsonPayload, null, 2)) },
    { path: 'README_CapCut.txt', bytes: bytesFromText(buildCapCutSubtitleReadme(projectName, entries.length)) },
  ];

  if (srtContent.trim()) {
    zipEntries.push({
      path: `capcut_subtitles/${safeProjectName}_for_CapCut.srt`,
      bytes: bytesFromText(srtContent),
    });
  }

  const zipBlob = createStoredZip(zipEntries);
  triggerBlobDownload(zipBlob, `${safeProjectName}_capcut_subtitles_package.zip`);
}


export async function exportDavinciResolvePackage(
  assets: GeneratedAsset[],
  projectName: string,
  options: DavinciResolvePackageOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  const validAssets = assets.filter((asset) => Boolean(asset.imageData || asset.videoData || asset.audioData || asset.narration?.trim()));
  if (!validAssets.length) {
    alert('DaVinci로 보낼 씬이 없습니다. 먼저 Step6 씬 데이터를 준비해 주세요.');
    return;
  }

  const baseName = safeBasename(projectName);
  const zipEntries: ZipEntryInput[] = [];
  const fps = 30;
  const previewMix = options.previewMix ?? { narrationVolume: 0.5, backgroundMusicVolume: 0.5 };
  const aspectRatio = options.aspectRatio || validAssets[0]?.aspectRatio || '16:9';
  const sceneMappings: Array<Record<string, unknown>> = [];
  const narrationTrackClips: Array<Record<string, unknown>> = [];
  const videoTrackClips: Array<Record<string, unknown>> = [];
  const backgroundTrackClips: Array<Record<string, unknown>> = [];
  let timelineCursorSeconds = 0;

  for (let index = 0; index < validAssets.length; index += 1) {
    const asset = validAssets[index];
    const sceneNo = String(asset.sceneNumber || index + 1).padStart(3, '0');
    const sceneFolder = `media/scenes/${sceneNo}`;
    const durationSeconds = resolveAssetPlaybackDuration(asset, { fallbackNarrationEstimate: true, preferTargetDuration: true, minimum: 1 });
    const startMs = Math.round(timelineCursorSeconds * 1000);
    const durationMs = Math.max(1, Math.round(durationSeconds * 1000));
    const endMs = startMs + durationMs;
    const startFrame = Math.round(timelineCursorSeconds * fps);
    const durationFrames = Math.max(1, Math.round(durationSeconds * fps));

    let visualPath: string | null = null;
    const visualSource = detectSceneVisualSource(asset);
    if (visualSource) {
      const visualBytes = await bytesFromResolvableValue(visualSource.value, visualSource.fallbackMime);
      if (visualBytes) {
        const ext = extensionFromMime(visualBytes.mime, visualSource.kind === 'video' ? 'mp4' : 'png');
        visualPath = `${sceneFolder}/${sceneNo}_visual.${ext}`;
        zipEntries.push({ path: visualPath, bytes: visualBytes.bytes });
      }
    }

    let narrationPath: string | null = null;
    const narrationBytes = await bytesFromResolvableValue(asset.audioData, 'audio/mpeg');
    if (narrationBytes) {
      const narrationExt = extensionFromMime(narrationBytes.mime, 'mp3');
      narrationPath = `${sceneFolder}/${sceneNo}_narration.${narrationExt}`;
      zipEntries.push({ path: narrationPath, bytes: narrationBytes.bytes });
    }

    const sceneSrt = buildSceneLocalSrt(asset, durationSeconds);
    const sceneSrtPath = `${sceneFolder}/${sceneNo}_scene.srt`;
    if (sceneSrt.trim()) {
      zipEntries.push({ path: sceneSrtPath, bytes: bytesFromText(sceneSrt) });
    }

    zipEntries.push({
      path: `${sceneFolder}/${sceneNo}_scene_note.txt`,
      bytes: bytesFromText(buildSceneNote(asset, durationSeconds)),
    });

    const sceneMapping = {
      sceneNumber: asset.sceneNumber || index + 1,
      timelineIndex: index + 1,
      recordStartMs: startMs,
      recordEndMs: endMs,
      durationMs,
      recordStartFrame: startFrame,
      recordDurationFrames: durationFrames,
      recordStartTimecode: formatTimecodeFromFrames(startFrame, fps),
      recordEndTimecode: formatTimecodeFromFrames(startFrame + durationFrames, fps),
      narrationText: `${asset.narration || ''}`.trim(),
      selectedVisualType: asset.selectedVisualType || (asset.videoData ? 'video' : asset.imageData ? 'image' : null),
      visualFile: visualPath,
      narrationFile: narrationPath,
      subtitleFile: sceneSrt.trim() ? sceneSrtPath : null,
      imagePrompt: `${asset.imagePrompt || asset.visualPrompt || ''}`.trim() || null,
      videoPrompt: `${asset.videoPrompt || ''}`.trim() || null,
      recommendedNarrationVolume: previewMix.narrationVolume,
    };
    sceneMappings.push(sceneMapping);

    if (visualPath) {
      videoTrackClips.push({
        sceneNumber: asset.sceneNumber || index + 1,
        sourceFile: visualPath,
        sourceKind: visualSource?.kind || 'image',
        recordStartFrame: startFrame,
        recordDurationFrames: durationFrames,
        recordStartTimecode: formatTimecodeFromFrames(startFrame, fps),
        recordDurationMs: durationMs,
      });
    }

    if (narrationPath) {
      narrationTrackClips.push({
        sceneNumber: asset.sceneNumber || index + 1,
        sourceFile: narrationPath,
        recordStartFrame: startFrame,
        recordDurationFrames: durationFrames,
        recordStartTimecode: formatTimecodeFromFrames(startFrame, fps),
        recordDurationMs: durationMs,
        recommendedVolume: previewMix.narrationVolume,
      });
    }

    timelineCursorSeconds += durationSeconds;
  }

  const backgroundTracks = (options.backgroundTracks || []).filter((track) => Boolean(track?.audioData));
  for (let index = 0; index < backgroundTracks.length; index += 1) {
    const track = backgroundTracks[index];
    const parsed = await bytesFromResolvableValue(track.audioData, 'audio/wav');
    if (!parsed) continue;
    const ext = extensionFromMime(parsed.mime, 'wav');
    const filePath = `media/background_music/${String(index + 1).padStart(3, '0')}_${safeBasename(track.title || `bgm_${index + 1}`)}.${ext}`;
    zipEntries.push({ path: filePath, bytes: parsed.bytes });
    backgroundTrackClips.push({
      trackIndex: index + 1,
      title: track.title || `배경음 ${index + 1}`,
      sourceFile: filePath,
      recordStartFrame: 0,
      recordStartTimecode: formatTimecodeFromFrames(0, fps),
      recommendedVolume: typeof track.volume === 'number' ? Number(track.volume.toFixed(3)) : previewMix.backgroundMusicVolume,
      selectedForPreview: track.id === backgroundTracks[0]?.id,
      durationSeconds: roundDurationSeconds(track.duration),
    });
  }

  const masterSrt = buildMasterTimelineSrt(validAssets);
  if (masterSrt.trim()) {
    zipEntries.push({
      path: 'subtitles/000_master_timeline.srt',
      bytes: bytesFromText(masterSrt),
    });
  }

  const previewBlob = await bytesFromResolvableValue(options.finalVideoUrl, 'video/mp4');
  const finalPreviewReferencePath = previewBlob
    ? `reference/${safeBasename(options.finalVideoTitle || `${projectName}_preview`)}.${extensionFromMime(previewBlob.mime, 'mp4')}`
    : null;
  if (previewBlob && finalPreviewReferencePath) {
    zipEntries.push({ path: finalPreviewReferencePath, bytes: previewBlob.bytes });
  }

  const totalDurationSeconds = Number(timelineCursorSeconds.toFixed(3));
  const totalDurationFrames = Math.round(totalDurationSeconds * fps);
  const timelineMap = {
    format: 'mp4Creater-davinci-resolve-package',
    version: 1,
    projectName,
    aspectRatio,
    exportedAt: new Date().toISOString(),
    fps,
    totalDurationMs: Math.round(totalDurationSeconds * 1000),
    totalDurationFrames,
    previewMix,
    finalPreview: finalPreviewReferencePath ? {
      file: finalPreviewReferencePath,
      durationSeconds: roundDurationSeconds(options.finalVideoDuration || totalDurationSeconds),
    } : null,
    scenes: sceneMappings,
  };

  const aafMapping = {
    format: 'mp4Creater-aaf-export-mapping',
    version: 1,
    note: '이 파일은 실제 AAF 바이너리 대신 Resolve 재구성과 AAF 자동화 연결에 쓰는 JSON 매핑 파일입니다.',
    project: {
      name: projectName,
      aspectRatio,
      fps,
      totalDurationFrames,
      totalDurationTimecode: formatTimecodeFromFrames(totalDurationFrames, fps),
    },
    tracks: {
      video_track_1: videoTrackClips,
      narration_track_1: narrationTrackClips,
      background_music_tracks: backgroundTrackClips,
    },
  };

  zipEntries.push({
    path: 'timeline/davinci_timeline_map.json',
    bytes: bytesFromText(JSON.stringify(timelineMap, null, 2)),
  });
  zipEntries.push({
    path: 'timeline/aaf_export_mapping.json',
    bytes: bytesFromText(JSON.stringify(aafMapping, null, 2)),
  });
  zipEntries.push({
    path: 'README_DaVinci.txt',
    bytes: bytesFromText(buildDavinciUsageGuide(projectName, validAssets.length, Boolean(finalPreviewReferencePath))),
  });

  const zipBlob = createStoredZip(zipEntries);
  triggerBlobDownload(zipBlob, `${baseName}_davinci_resolve_package.zip`);
}

async function renderTimelineClip(
  asset: GeneratedAsset,
  options: Required<CapCutDragBundleOptions>
): Promise<{ clipBlob: Blob; clipExtension: string; clipSrt: string }> {
  try {
    const result = await generateVideo(
      [asset],
      () => {},
      undefined,
      {
        enableSubtitles: true,
        backgroundTracks: options.backgroundTracks,
        previewMix: options.previewMix,
        aspectRatio: asset.aspectRatio,
        qualityMode: options.qualityMode,
        useSceneVideos: true,
      }
    );

    if (result?.videoBlob) {
      return {
        clipBlob: result.videoBlob,
        clipExtension: detectVideoExtension(result.videoBlob),
        clipSrt: generateSrtFromRecorded(result.recordedSubtitles),
      };
    }
  } catch (error) {
    console.warn(`[CapCut Export] 씬 ${asset.sceneNumber} 타임라인 클립 렌더링 실패`, error);
  }

  const fallbackVideo = extractPreferredVideoBlob(asset);
  if (fallbackVideo) {
    return {
      clipBlob: fallbackVideo,
      clipExtension: detectVideoExtension(fallbackVideo),
      clipSrt: '',
    };
  }

  throw new Error(`씬 ${asset.sceneNumber}에 내보낼 영상/이미지가 없습니다.`);
}

function buildSceneSubtitleText(asset: GeneratedAsset): string {
  if (asset.subtitleData?.fullText?.trim()) return asset.subtitleData.fullText.trim();
  if (asset.narration?.trim()) return asset.narration.trim();
  return '';
}

function buildProjectHint(projectName: string, sceneCount: number, includeEditableSources: boolean): string {
  return [
    `프로젝트: ${projectName}`,
    '',
    'CapCut 가져오기 권장 순서',
    '1. 01_videos 폴더 안의 파일만 먼저 드래그해 타임라인에 올리세요.',
    '2. 각 파일은 이미 자막/나레이션/배경음을 최대한 포함한 문단별 클립입니다.',
    includeEditableSources ? '3. 02_music, 03_subtitles는 수정이 필요할 때만 추가로 사용하세요.' : '3. 편집용 추가 파일이 필요하면 별도 저장을 사용하세요.',
    '',
    `문단 수: ${sceneCount}`,
    '파일명은 001, 002, 003 순서로 정렬되도록 맞춰집니다.',
  ].join('\n');
}

export async function exportCapCutDragBundle(
  assets: GeneratedAsset[],
  projectName: string,
  options: CapCutDragBundleOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  const validAssets = assets.filter((asset) => asset.imageData || asset.videoData);
  if (!validAssets.length) {
    alert('CapCut으로 보낼 씬이 없습니다. 먼저 이미지 또는 영상을 생성해주세요.');
    return;
  }

  const resolvedOptions: Required<CapCutDragBundleOptions> = {
    qualityMode: options.qualityMode ?? 'preview',
    backgroundTracks: options.backgroundTracks ?? [],
    previewMix: options.previewMix ?? { narrationVolume: 1, backgroundMusicVolume: 0.28 },
  };

  const baseName = safeBasename(projectName);
  const zipEntries: ZipEntryInput[] = [];
  const sceneSubtitleEntries: string[] = [];
  const includeEditableSources = true;

  for (let index = 0; index < validAssets.length; index += 1) {
    const asset = validAssets[index];
    const sceneNo = String(asset.sceneNumber || index + 1).padStart(3, '0');
    const clipBase = `${sceneNo}_scene_${sceneNo}`;

    const timelineClip = await renderTimelineClip(asset, resolvedOptions);
    const clipBytes = await bytesFromBlob(timelineClip.clipBlob);
    zipEntries.push({
      path: `01_videos/${clipBase}.${timelineClip.clipExtension}`,
      bytes: clipBytes,
    });

    const sceneSrt = timelineClip.clipSrt.trim();
    zipEntries.push({
      path: `03_subtitles/${clipBase}.srt`,
      bytes: bytesFromText(sceneSrt),
    });

    const narrationBlob = extractNarrationBlob(asset);
    if (narrationBlob) {
      const narrationExt = extensionFromMime(narrationBlob.type || 'audio/mpeg', 'mp3');
      zipEntries.push({
        path: `02_music/${clipBase}_narration.${narrationExt}`,
        bytes: await bytesFromBlob(narrationBlob),
      });
    }

    sceneSubtitleEntries.push(`${sceneNo}\t${buildSceneSubtitleText(asset)}`);
  }

  const primaryBgm = resolvedOptions.backgroundTracks[0] || null;
  if (primaryBgm?.audioData) {
    const parsed = parseDataUrl(primaryBgm.audioData, 'audio/wav');
    if (parsed) {
      zipEntries.push({
        path: `02_music/000_project_bgm.${extensionFromMime(parsed.mime, 'wav')}`,
        bytes: parsed.bytes,
      });
    }
  }

  const masterSrt = await generateSrtContent(validAssets).catch(() => '');
  zipEntries.push({
    path: '03_subtitles/000_master_timeline.srt',
    bytes: bytesFromText(masterSrt.trim()),
  });

  zipEntries.push({
    path: '03_subtitles/001_scene_text_map.txt',
    bytes: bytesFromText(sceneSubtitleEntries.join('\n')),
  });

  zipEntries.push({
    path: '03_subtitles/999_capcut_readme.txt',
    bytes: bytesFromText(buildProjectHint(projectName, validAssets.length, includeEditableSources)),
  });

  const zipBlob = createStoredZip(zipEntries);
  triggerBlobDownload(zipBlob, `${baseName}_capcut_drag_bundle.zip`);
}
