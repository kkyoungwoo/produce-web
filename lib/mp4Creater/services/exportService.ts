/**
 * 스토리보드 / CapCut 패키지 내보내기 서비스
 * 외부 ZIP 의존성 없이 브라우저에서 바로 저장 가능한 패키지를 만듭니다.
 */

import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings, SavedProject } from '../types';
import { generateSrtContent } from './srtService';
import { generateVideo } from './videoService';
import { blobFromDataValue, extensionFromMime, sanitizeDownloadName, triggerBlobDownload } from '../utils/downloadHelpers';

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

function escapeCsvCell(value: string): string {
  return `"${`${value || ''}`.replace(/"/g, '""')}"`;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getDosDateTime(input = Date.now()) {
  const date = new Date(input);
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
  };
}

type ZipEntry = {
  path: string;
  bytes: Uint8Array;
  modifiedAt?: number;
};

type SceneClipBuildResult = {
  blob: Blob;
  extension: string;
  mode: 'rendered-scene' | 'existing-video';
};

function createZipBlob(entries: ZipEntry[]): Blob {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const pathBytes = textToBytes(entry.path.replace(/^\/+/, ''));
    const dataBytes = entry.bytes;
    const checksum = crc32(dataBytes);
    const { dosTime, dosDate } = getDosDateTime(entry.modifiedAt);

    const local = new Uint8Array(30 + pathBytes.length + dataBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, pathBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(pathBytes, 30);
    local.set(dataBytes, 30 + pathBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + pathBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, pathBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(pathBytes, 46);
    centrals.push(central);

    offset += local.length;
  });

  const centralBytes = concatBytes(centrals);
  const localBytes = concatBytes(locals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localBytes.length, true);
  endView.setUint16(20, 0, true);

  return new Blob([localBytes, centralBytes, end], { type: 'application/zip' });
}

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

function buildProjectCsv(assets: GeneratedAsset[]): string {
  const header = ['Scene', 'Narration', 'Visual Prompt', 'Has Image', 'Has Audio', 'Has Video'];
  const rows = assets.map((asset, index) => [
    `${asset.sceneNumber || index + 1}`,
    escapeCsvCell(asset.narration || ''),
    escapeCsvCell(asset.visualPrompt || ''),
    asset.imageData ? 'Y' : 'N',
    asset.audioData ? 'Y' : 'N',
    asset.videoData ? 'Y' : 'N',
  ].join(','));
  return ['\uFEFF' + header.join(','), ...rows].join('\n');
}

async function fetchBlobFromValue(value: string | null | undefined, fallbackMime: string): Promise<Blob | null> {
  if (!value) return null;

  const direct = blobFromDataValue(value, fallbackMime);
  if (direct && direct.size > 0) return direct;

  if (typeof fetch !== 'function') return null;
  const trimmed = value.trim();
  if (!(trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('/'))) {
    return null;
  }

  try {
    const response = await fetch(trimmed);
    if (!response.ok) return null;
    const fetched = await response.blob();
    if (!fetched.size) return null;
    return fetched;
  } catch (error) {
    console.warn('[CapCut Export] fetch blob failed:', error);
    return null;
  }
}

async function pushBlobEntry(path: string, blob: Blob, pushEntry: (path: string, bytes: Uint8Array) => void): Promise<void> {
  const buffer = await blob.arrayBuffer();
  pushEntry(path, new Uint8Array(buffer));
}

async function buildSceneClip(options: {
  asset: GeneratedAsset;
  qualityMode: 'preview' | 'final';
  backgroundTrack?: BackgroundMusicTrack | null;
  previewMix?: PreviewMixSettings | null;
}): Promise<SceneClipBuildResult | null> {
  const { asset, qualityMode, backgroundTrack, previewMix } = options;

  if (asset.imageData) {
    try {
      const result = await generateVideo([asset], () => {}, undefined, {
        enableSubtitles: true,
        qualityMode,
        aspectRatio: asset.aspectRatio || '16:9',
        useSceneVideos: true,
        backgroundTracks: backgroundTrack?.audioData ? [backgroundTrack] : [],
        previewMix: {
          narrationVolume: previewMix?.narrationVolume ?? 1,
          backgroundMusicVolume: previewMix?.backgroundMusicVolume ?? backgroundTrack?.volume ?? 0.28,
        },
      });

      if (result?.videoBlob) {
        return {
          blob: result.videoBlob,
          extension: extensionFromMime(result.videoBlob.type || 'video/mp4', 'mp4'),
          mode: 'rendered-scene',
        };
      }
    } catch (error) {
      console.warn('[CapCut Export] scene render failed:', asset.sceneNumber, error);
    }
  }

  const originalVideoBlob = await fetchBlobFromValue(asset.videoData, 'video/mp4');
  if (originalVideoBlob && originalVideoBlob.size > 0) {
    return {
      blob: originalVideoBlob,
      extension: extensionFromMime(originalVideoBlob.type || 'video/mp4', 'mp4'),
      mode: 'existing-video',
    };
  }

  return null;
}

export async function exportCapCutPackage(options: {
  assets: GeneratedAsset[];
  projectName: string;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  activeBackgroundTrackId?: string | null;
  previewMix?: PreviewMixSettings | null;
  topic?: string;
  qualityMode?: 'preview' | 'final';
}): Promise<void> {
  const safeName = sanitizeDownloadName(options.projectName || options.topic || 'mp4Creater_project', 'mp4Creater_project');
  const root = `${safeName}_capcut_drag_package`;
  const entries: ZipEntry[] = [];
  const addedPaths = new Set<string>();
  const qualityMode = options.qualityMode || 'preview';
  const selectedBackgroundTrack = options.backgroundMusicTracks?.find((track) => track.id === options.activeBackgroundTrackId)
    || options.backgroundMusicTracks?.[0]
    || null;

  const pushEntry = (path: string, bytes: Uint8Array) => {
    const normalized = `${root}/${path.replace(/^\/+/, '')}`;
    if (addedPaths.has(normalized)) return;
    addedPaths.add(normalized);
    entries.push({ path: normalized, bytes, modifiedAt: Date.now() });
  };

  const videoIndexRows: string[] = ['order,file,mode,note'];
  const srtContent = await generateSrtContent(options.assets).catch(() => '');

  pushEntry('README.txt', textToBytes([
    'CapCut 드래그용 3폴더 패키지입니다.',
    '',
    '구성',
    '- 01_videos : 문단별 클립. 기본으로 자막/나레이션/선택 배경음까지 합쳐서 저장합니다.',
    '- 02_music : 원본 배경음 파일. CapCut 안에서 따로 볼륨 조절하거나 교체할 때 사용합니다.',
    '- 03_subtitles : 전체 편집용 SRT. CapCut에서 텍스트 자막을 다시 수정하고 싶을 때만 가져옵니다.',
    '',
    '추천 사용 순서',
    '1) 압축을 푼 뒤 01_videos 폴더의 파일을 모두 CapCut에 드래그합니다.',
    '2) 필요하면 02_music 폴더의 배경음을 추가합니다.',
    '3) 텍스트 자막을 수정하고 싶을 때만 03_subtitles/project_subtitles.srt 를 CapCut 자막 가져오기로 불러옵니다.',
    '',
    `현재 내보내기 품질: ${qualityMode === 'final' ? '고화질' : '저화질 빠른 편집용'}`,
    '클립은 가능한 한 현재 씬 영상 + 자막 + 나레이션 + 선택 배경음을 함께 굽습니다.',
    '브라우저/코덱 환경에 따라 확장자가 mp4 대신 webm으로 저장될 수 있습니다.',
  ].join('\n')));

  pushEntry('project_script.csv', textToBytes(buildProjectCsv(options.assets)));

  if (srtContent.trim()) {
    pushEntry('03_subtitles/001_project_subtitles.srt', textToBytes(srtContent));
  } else {
    pushEntry('03_subtitles/000_no_subtitles.txt', textToBytes('현재 프로젝트에는 가져올 SRT 자막 데이터가 없습니다.'));
  }

  let clipCount = 0;
  for (let index = 0; index < options.assets.length; index += 1) {
    const asset = options.assets[index];
    const sceneNo = `${asset.sceneNumber || index + 1}`.padStart(3, '0');
    const clipResult = await buildSceneClip({
      asset,
      qualityMode,
      backgroundTrack: selectedBackgroundTrack,
      previewMix: options.previewMix,
    });

    if (!clipResult) continue;

    const clipFilename = `01_videos/${sceneNo}_scene_${sceneNo}_clip.${clipResult.extension}`;
    await pushBlobEntry(clipFilename, clipResult.blob, pushEntry);
    videoIndexRows.push([
      sceneNo,
      clipFilename,
      clipResult.mode,
      escapeCsvCell(clipResult.mode === 'rendered-scene' ? '자막/나레이션/선택 배경음이 합쳐진 클립' : '기존 영상 원본 클립'),
    ].join(','));
    clipCount += 1;
  }

  pushEntry('01_videos/000_import_order.csv', textToBytes('\uFEFF' + videoIndexRows.join('\n')));

  if (selectedBackgroundTrack?.audioData) {
    const bgmBlob = await fetchBlobFromValue(selectedBackgroundTrack.audioData, 'audio/mpeg');
    if (bgmBlob && bgmBlob.size > 0) {
      const bgmExtension = extensionFromMime(bgmBlob.type || 'audio/mpeg', 'mp3');
      await pushBlobEntry(
        `02_music/001_selected_background_${sanitizeFilename(selectedBackgroundTrack.title || 'bgm')}.${bgmExtension}`,
        bgmBlob,
        pushEntry,
      );
    }
  }

  if (!(selectedBackgroundTrack?.audioData)) {
    pushEntry('02_music/000_no_background_music.txt', textToBytes('현재 선택된 배경음이 없습니다.'));
  }

  pushEntry('manifest.json', textToBytes(JSON.stringify({
    projectName: options.projectName,
    topic: options.topic || options.projectName,
    exportedAt: new Date().toISOString(),
    clipCount,
    sceneCount: options.assets.length,
    qualityMode,
    selectedBackgroundTrack: selectedBackgroundTrack ? { id: selectedBackgroundTrack.id, title: selectedBackgroundTrack.title } : null,
  }, null, 2)));

  const zipBlob = createZipBlob(entries);
  triggerBlobDownload(zipBlob, `${safeName}_capcut_drag_package.zip`);
}

export async function exportProjectToZip(project: SavedProject): Promise<void> {
  return exportAssetsToZip(project.assets, project.name);
}
