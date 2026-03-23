/**
 * 스토리보드 / CapCut 패키지 내보내기 서비스
 * 외부 패키지 없이 엑셀 호환 HTML(.xls)과 저장형 ZIP을 생성합니다.
 */

import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings, SavedProject } from '../types';
import { blobFromDataValue, extensionFromMime, parseDataUrl, triggerBlobDownload } from '../utils/downloadHelpers';
import { generateSrtContent, generateSrtFromRecorded } from './srtService';
import { generateVideo } from './videoService';

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
