/**
 * 스토리보드 / 작업 패키지 내보내기 서비스
 * 외부 ZIP 의존성 없이 브라우저에서 바로 저장 가능한 패키지를 만듭니다.
 */

import { BackgroundMusicTrack, GeneratedAsset, SavedProject } from '../types';
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

type CapCutRegistrationRow = {
  order: string;
  kind: 'timeline_clip' | 'subtitle' | 'image' | 'tts' | 'source_video' | 'bgm';
  path: string;
  note: string;
};

type SceneClipBuildResult = {
  blob: Blob;
  extension: string;
  mode: 'existing-video' | 'rendered-image-audio' | 'rendered-image-only';
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

function buildSceneSubtitleText(asset: GeneratedAsset): string {
  if (!asset.subtitleData?.words?.length) return '';
  if (asset.subtitleData.fullText?.trim()) return asset.subtitleData.fullText.trim();
  return asset.subtitleData.words.map((item) => item.word).join(' ').trim();
}

function buildCapCutRegistrationCsv(rows: CapCutRegistrationRow[]): string {
  const header = ['order', 'kind', 'relative_path', 'note'];
  return ['\uFEFF' + header.join(','), ...rows.map((row) => [
    escapeCsvCell(row.order),
    escapeCsvCell(row.kind),
    escapeCsvCell(row.path),
    escapeCsvCell(row.note),
  ].join(','))].join('\n');
}

function buildTimelineOrderText(rows: CapCutRegistrationRow[]): string {
  return rows
    .filter((row) => row.kind === 'timeline_clip')
    .map((row) => `${row.order}. ${row.path}`)
    .join('\n');
}

async function buildSceneClip(asset: GeneratedAsset, qualityMode: 'preview' | 'final'): Promise<SceneClipBuildResult | null> {
  const localVideoBlob = blobFromDataValue(asset.videoData, 'video/mp4');
  if (localVideoBlob && localVideoBlob.size > 0) {
    return {
      blob: localVideoBlob,
      extension: extensionFromMime(localVideoBlob.type || 'video/mp4', 'mp4'),
      mode: 'existing-video',
    };
  }

  if (!asset.imageData) return null;

  try {
    const result = await generateVideo([asset], () => {}, undefined, {
      enableSubtitles: false,
      qualityMode,
      aspectRatio: asset.aspectRatio || '16:9',
      useSceneVideos: false,
    });
    if (!result?.videoBlob) return null;
    return {
      blob: result.videoBlob,
      extension: extensionFromMime(result.videoBlob.type || 'video/mp4', 'mp4'),
      mode: asset.audioData ? 'rendered-image-audio' : 'rendered-image-only',
    };
  } catch (error) {
    console.warn('[CapCut Export] scene clip render failed:', asset.sceneNumber, error);
    return null;
  }
}

async function pushBlobEntry(path: string, blob: Blob, pushEntry: (path: string, bytes: Uint8Array) => void): Promise<void> {
  const buffer = await blob.arrayBuffer();
  pushEntry(path, new Uint8Array(buffer));
}

export async function exportCapCutPackage(options: {
  assets: GeneratedAsset[];
  projectName: string;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  activeBackgroundTrackId?: string | null;
  topic?: string;
  qualityMode?: 'preview' | 'final';
}): Promise<void> {
  const safeName = sanitizeDownloadName(options.projectName || options.topic || 'mp4Creater_project', 'mp4Creater_project');
  const root = `${safeName}_capcut_package`;
  const entries: ZipEntry[] = [];
  const addedPaths = new Set<string>();
  const qualityMode = options.qualityMode || 'preview';
  const pushEntry = (path: string, bytes: Uint8Array) => {
    const normalized = `${root}/${path.replace(/^\/+/, '')}`;
    if (addedPaths.has(normalized)) return;
    addedPaths.add(normalized);
    entries.push({ path: normalized, bytes, modifiedAt: Date.now() });
  };

  const mainBgm = options.backgroundMusicTracks?.find((track) => track.id === options.activeBackgroundTrackId)
    || options.backgroundMusicTracks?.[0]
    || null;
  const srtContent = await generateSrtContent(options.assets).catch(() => '');
  const registrationRows: CapCutRegistrationRow[] = [];
  const sceneSummaries: Array<Record<string, unknown>> = [];
  let generatedClipCount = 0;

  pushEntry('README.txt', textToBytes([
    'CapCut 파일등록용 작업 패키지입니다.',
    '',
    '추천 순서',
    '1) 압축을 풀고 timeline_ready 폴더의 문단별 clip 파일을 CapCut에 한 번에 Import 합니다.',
    '2) clip 파일을 scene_001 -> scene_002 -> scene_003 순서로 타임라인에 배치합니다.',
    '3) 자막은 CapCut 상단 Captions > Add Captions 또는 Import file에서 subtitles/project_subtitles.srt 를 불러옵니다.',
    '4) 씬별 세부 수정이 필요하면 scenes/scene_001 폴더의 이미지, TTS, 자막 파일을 사용해 교체 편집합니다.',
    '5) 배경음은 audio 폴더 파일을 추가로 올려 길이에 맞게 깔아 주세요.',
    '',
    `현재 패키지 품질: ${qualityMode === 'final' ? '고화질' : '저화질 빠른 편집용'}`,
    'scene clip 은 가능한 경우 기존 영상 파일을 사용하고, 없으면 현재 이미지 + TTS로 로컬 MP4/WebM 클립을 만들어 넣습니다.',
    '브라우저/코덱 환경에 따라 일부 clip 이 WebM으로 저장될 수 있습니다. 그런 경우 scenes 폴더의 이미지 + TTS를 직접 넣어도 됩니다.',
  ].join('\n')));

  pushEntry('capcut_download.txt', textToBytes([
    'CapCut Desktop 다운로드',
    'https://www.capcut.com/tools/desktop-video-editor',
    '',
    '자막 가져오기 도움말',
    'https://www.capcut.com/help/how-to-import-subtitles',
    '',
    'MP4/JPG 가져오기 문제 도움말',
    'https://www.capcut.com/help/can-not-import-mp4-and-jpg-files',
  ].join('\n')));

  pushEntry('project_script.csv', textToBytes(buildProjectCsv(options.assets)));

  if (srtContent.trim()) {
    pushEntry('subtitles/project_subtitles.srt', textToBytes(srtContent));
    registrationRows.push({
      order: 'project',
      kind: 'subtitle',
      path: 'subtitles/project_subtitles.srt',
      note: 'CapCut에서 전체 자막 파일로 가져오기',
    });
  }

  for (let index = 0; index < options.assets.length; index += 1) {
    const asset = options.assets[index];
    const sceneNo = `${asset.sceneNumber || index + 1}`.padStart(3, '0');
    const sceneFolder = `scenes/scene_${sceneNo}`;
    const subtitleText = buildSceneSubtitleText(asset);
    const sceneSrt = await generateSrtContent([asset]).catch(() => '');

    pushEntry(`${sceneFolder}/scene_${sceneNo}_narration.txt`, textToBytes(asset.narration || ''));
    pushEntry(`${sceneFolder}/scene_${sceneNo}_prompt.txt`, textToBytes(asset.visualPrompt || ''));

    if (subtitleText) {
      pushEntry(`${sceneFolder}/scene_${sceneNo}_subtitle.txt`, textToBytes(subtitleText));
    }

    if (sceneSrt.trim()) {
      pushEntry(`${sceneFolder}/scene_${sceneNo}_subtitle.srt`, textToBytes(sceneSrt));
    }

    const imageBlob = blobFromDataValue(asset.imageData, 'image/png');
    if (imageBlob) {
      const imageExt = extensionFromMime(imageBlob.type || 'image/png', 'png');
      await pushBlobEntry(`${sceneFolder}/scene_${sceneNo}_image.${imageExt}`, imageBlob, pushEntry);
      registrationRows.push({
        order: sceneNo,
        kind: 'image',
        path: `${sceneFolder}/scene_${sceneNo}_image.${imageExt}`,
        note: 'clip 교체가 필요할 때 씬 원본 이미지로 사용',
      });
    }

    const audioBlob = blobFromDataValue(asset.audioData, 'audio/mpeg');
    if (audioBlob) {
      const audioExt = extensionFromMime(audioBlob.type || 'audio/mpeg', 'mp3');
      await pushBlobEntry(`${sceneFolder}/scene_${sceneNo}_tts.${audioExt}`, audioBlob, pushEntry);
      registrationRows.push({
        order: sceneNo,
        kind: 'tts',
        path: `${sceneFolder}/scene_${sceneNo}_tts.${audioExt}`,
        note: 'CapCut에서 음성만 따로 교체하거나 볼륨 조절할 때 사용',
      });
    }

    const originalVideoBlob = blobFromDataValue(asset.videoData, 'video/mp4');
    if (originalVideoBlob) {
      const originalVideoExt = extensionFromMime(originalVideoBlob.type || 'video/mp4', 'mp4');
      await pushBlobEntry(`${sceneFolder}/scene_${sceneNo}_source_video.${originalVideoExt}`, originalVideoBlob, pushEntry);
      registrationRows.push({
        order: sceneNo,
        kind: 'source_video',
        path: `${sceneFolder}/scene_${sceneNo}_source_video.${originalVideoExt}`,
        note: '원본 씬 영상 보관본',
      });
    }

    const clipResult = await buildSceneClip(asset, qualityMode);
    if (clipResult) {
      const clipPath = `timeline_ready/scene_${sceneNo}_clip.${clipResult.extension}`;
      await pushBlobEntry(clipPath, clipResult.blob, pushEntry);
      registrationRows.push({
        order: sceneNo,
        kind: 'timeline_clip',
        path: clipPath,
        note: clipResult.mode === 'existing-video'
          ? '이 파일을 CapCut에 먼저 Import 해서 타임라인에 배치'
          : clipResult.mode === 'rendered-image-audio'
            ? '현재 이미지 + TTS로 만든 문단 클립'
            : '현재 이미지로 만든 정적 문단 클립',
      });
      generatedClipCount += 1;
    }

    sceneSummaries.push({
      sceneNumber: asset.sceneNumber || index + 1,
      narration: asset.narration,
      targetDuration: asset.targetDuration,
      hasImage: Boolean(asset.imageData),
      hasAudio: Boolean(asset.audioData),
      hasVideo: Boolean(asset.videoData),
      hasSubtitle: Boolean(asset.subtitleData?.words?.length || asset.subtitleData?.fullText),
      exportedTimelineClip: Boolean(clipResult),
      qualityMode,
    });
  }

  const bgmTasks = (options.backgroundMusicTracks || []).flatMap((track, index) => {
    const blob = blobFromDataValue(track.audioData, 'audio/mpeg');
    if (!blob) return [] as Array<Promise<void>>;
    const extension = extensionFromMime(blob.type || 'audio/mpeg', 'mp3');
    const suffix = `${index + 1}`.padStart(2, '0');
    const fileName = `audio/background_${suffix}_${sanitizeFilename(track.title || 'bgm')}.${extension}`;
    registrationRows.push({
      order: suffix,
      kind: 'bgm',
      path: fileName,
      note: track.id === mainBgm?.id ? '현재 선택된 메인 배경음' : '추가 배경음 후보',
    });
    return [blob.arrayBuffer().then((buffer) => {
      pushEntry(fileName, new Uint8Array(buffer));
    })];
  });
  await Promise.all(bgmTasks);

  pushEntry('capcut_file_registration.csv', textToBytes(buildCapCutRegistrationCsv(registrationRows)));
  pushEntry('timeline_ready/timeline_import_order.txt', textToBytes(buildTimelineOrderText(registrationRows)));

  pushEntry('manifest.json', textToBytes(JSON.stringify({
    projectName: options.projectName,
    topic: options.topic || options.projectName,
    exportedAt: new Date().toISOString(),
    sceneCount: options.assets.length,
    generatedClipCount,
    hasOverallSrt: Boolean(srtContent.trim()),
    qualityMode,
    backgroundMusic: mainBgm ? { id: mainBgm.id, title: mainBgm.title } : null,
    scenes: sceneSummaries,
  }, null, 2)));

  const zipBlob = createZipBlob(entries);
  triggerBlobDownload(zipBlob, `${safeName}_capcut_package.zip`);
}

export async function exportProjectToZip(project: SavedProject): Promise<void> {
  return exportAssetsToZip(project.assets, project.name);
}
