/**
 * 스토리보드 / 작업 패키지 내보내기 서비스
 * 외부 ZIP 의존성 없이 브라우저에서 바로 저장 가능한 패키지를 만듭니다.
 */

import { BackgroundMusicTrack, GeneratedAsset, SavedProject } from '../types';
import { generateSrtContent } from './srtService';
import { generateVideo } from './videoService';
import { blobFromDataValue, extensionFromMime, sanitizeDownloadName, triggerBlobDownload } from '../utils/downloadHelpers';

const CAPCUT_ONLINE_EDITOR_URL = 'https://www.capcut.com/tools/online-video-editor';

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

type TimelineClipInfo = {
  entry: ZipEntry | null;
  fileName: string | null;
  duration: number;
  importMode: 'clip' | 'video_only' | 'image_audio' | 'unavailable';
  note: string;
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

function formatSceneNo(value: number): string {
  return `${value}`.padStart(3, '0');
}

function estimateSceneDuration(asset: GeneratedAsset): number {
  const duration = asset.targetDuration || asset.audioDuration || 3;
  return Number.isFinite(duration) && duration > 0 ? duration : 3;
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function buildSceneSubtitleText(asset: GeneratedAsset): string {
  if (!asset.subtitleData?.words?.length) return '';
  if (asset.subtitleData.fullText?.trim()) return asset.subtitleData.fullText.trim();
  return asset.subtitleData.words.map((item) => item.word).join(' ').trim();
}

function buildSceneSrt(asset: GeneratedAsset, duration: number): string {
  const words = asset.subtitleData?.words || [];
  if (words.length) {
    const lines: string[] = [];
    let blockIndex = 1;
    const chunkSize = 6;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      if (!chunk.length) continue;
      const startTime = chunk[0].start ?? 0;
      const fallbackEnd = i + chunkSize < words.length ? words[Math.min(i + chunkSize, words.length - 1)].start : duration;
      const endTime = Math.max(startTime + 0.2, chunk[chunk.length - 1].end ?? fallbackEnd ?? duration);
      lines.push(String(blockIndex++));
      lines.push(`${formatSrtTime(startTime)} --> ${formatSrtTime(Math.min(duration, endTime))}`);
      lines.push(chunk.map((item) => item.word).join(' '));
      lines.push('');
    }
    if (lines.length) return lines.join('\n');
  }

  const fullText = buildSceneSubtitleText(asset);
  if (!fullText) return '';
  return [
    '1',
    `${formatSrtTime(0)} --> ${formatSrtTime(duration)}`,
    fullText,
    '',
  ].join('\n');
}

function buildTimelineGuideCsv(rows: Array<{
  sceneNumber: number;
  clipFile: string;
  importMode: TimelineClipInfo['importMode'];
  duration: number;
  note: string;
}>): string {
  const header = ['Scene', 'TimelineClip', 'ImportMode', 'DurationSeconds', 'Note'];
  const body = rows.map((row) => [
    `${row.sceneNumber}`,
    escapeCsvCell(row.clipFile),
    row.importMode,
    `${row.duration.toFixed(2)}`,
    escapeCsvCell(row.note),
  ].join(','));
  return ['\uFEFF' + header.join(','), ...body].join('\n');
}

async function createCapCutTimelineClip(asset: GeneratedAsset, sceneNumber: number, root: string): Promise<TimelineClipInfo> {
  const formattedSceneNo = formatSceneNo(sceneNumber);
  const sceneDuration = estimateSceneDuration(asset);

  if (asset.imageData) {
    try {
      const result = await generateVideo(
        [{ ...asset }],
        () => undefined,
        undefined,
        {
          enableSubtitles: false,
          backgroundTracks: [],
          previewMix: { narrationVolume: 1, backgroundMusicVolume: 0 },
          aspectRatio: asset.aspectRatio || '16:9',
          qualityMode: 'preview',
          useSceneVideos: true,
        }
      );

      if (result?.videoBlob && result.videoBlob.size > 0) {
        const extension = extensionFromMime(result.videoBlob.type || 'video/mp4', 'mp4');
        const buffer = await result.videoBlob.arrayBuffer();
        const fileName = `scene_${formattedSceneNo}_clip.${extension}`;
        return {
          entry: {
            path: `${root}/timeline_ready/${fileName}`,
            bytes: new Uint8Array(buffer),
            modifiedAt: Date.now(),
          },
          fileName,
          duration: sceneDuration,
          importMode: 'clip',
          note: asset.videoData ? '씬 영상 + TTS가 합쳐진 바로 타임라인용 클립' : '이미지 + TTS가 합쳐진 바로 타임라인용 클립',
        };
      }
    } catch (error) {
      console.warn(`[exportService] scene ${sceneNumber} CapCut 타임라인 클립 생성 실패`, error);
    }
  }

  const sourceVideoBlob = blobFromDataValue(asset.videoData, 'video/mp4');
  if (sourceVideoBlob) {
    const extension = extensionFromMime(sourceVideoBlob.type || 'video/mp4', 'mp4');
    const buffer = await sourceVideoBlob.arrayBuffer();
    const fileName = `scene_${formattedSceneNo}_source_video.${extension}`;
    return {
      entry: {
        path: `${root}/timeline_ready/${fileName}`,
        bytes: new Uint8Array(buffer),
        modifiedAt: Date.now(),
      },
      fileName,
      duration: sceneDuration,
      importMode: 'video_only',
      note: '원본 씬 영상만 있습니다. scenes 폴더의 TTS를 같이 올리면 됩니다.',
    };
  }

  if (asset.imageData && asset.audioData) {
    return {
      entry: null,
      fileName: `scene_${formattedSceneNo}_image+tts`,
      duration: sceneDuration,
      importMode: 'image_audio',
      note: '자동 타임라인 클립 생성에 실패했습니다. scenes 폴더의 image + tts를 같이 넣어주세요.',
    };
  }

  return {
    entry: null,
    fileName: `scene_${formattedSceneNo}_manual`,
    duration: sceneDuration,
    importMode: 'unavailable',
    note: '타임라인용 클립을 만들 수 있는 이미지 또는 영상 데이터가 부족합니다.',
  };
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

function openCapCutEditorAfterExport(preopenedWindow: Window | null): void {
  if (typeof window === 'undefined') return;
  if (preopenedWindow && !preopenedWindow.closed) {
    preopenedWindow.location.href = CAPCUT_ONLINE_EDITOR_URL;
    return;
  }
  window.open(CAPCUT_ONLINE_EDITOR_URL, '_blank', 'noopener,noreferrer');
}

export async function exportCapCutPackage(options: {
  assets: GeneratedAsset[];
  projectName: string;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  activeBackgroundTrackId?: string | null;
  topic?: string;
  autoOpenCapCut?: boolean;
}): Promise<void> {
  const capcutWindow = options.autoOpenCapCut && typeof window !== 'undefined'
    ? window.open('', '_blank')
    : null;
  if (capcutWindow) {
    try {
      capcutWindow.opener = null;
      capcutWindow.document.title = 'CapCut 열기 준비 중...';
      capcutWindow.document.body.innerHTML = '<div style="font-family: system-ui, sans-serif; padding: 24px; line-height: 1.6;">CapCut 편집기를 여는 중입니다...<br/>잠시 뒤 새 탭이 CapCut으로 이동합니다.</div>';
    } catch {
      // noop
    }
  }

  const safeName = sanitizeDownloadName(options.projectName || options.topic || 'mp4Creater_project', 'mp4Creater_project');
  const root = `${safeName}_capcut_package`;
  const entries: ZipEntry[] = [];
  const addedPaths = new Set<string>();
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

  const timelineClipRows: Array<{ sceneNumber: number; clipFile: string; importMode: TimelineClipInfo['importMode']; duration: number; note: string }> = [];
  const timelineClipEntries: ZipEntry[] = [];

  for (let index = 0; index < options.assets.length; index += 1) {
    const asset = options.assets[index];
    const sceneNumber = asset.sceneNumber || index + 1;
    const clipInfo = await createCapCutTimelineClip(asset, sceneNumber, root);
    if (clipInfo.entry) {
      timelineClipEntries.push(clipInfo.entry);
    }
    timelineClipRows.push({
      sceneNumber,
      clipFile: clipInfo.fileName || '',
      importMode: clipInfo.importMode,
      duration: clipInfo.duration,
      note: clipInfo.note,
    });
  }

  pushEntry('README.txt', textToBytes([
    'CapCut 작업용 패키지입니다.',
    '',
    '[가장 쉬운 사용 순서]',
    '1. mp4Creater의 CapCut으로 보내기를 누르면 ZIP이 저장되고 CapCut 편집기가 새 탭에서 함께 열립니다.',
    '2. ZIP을 로컬 폴더로 푼 뒤 timeline_ready 폴더를 먼저 엽니다.',
    '3. CapCut에서 새 프로젝트를 만들고 timeline_ready 폴더의 파일을 이름순(scene_001, scene_002...)으로 모두 가져온 뒤 타임라인에 순서대로 놓습니다.',
    '4. 자막은 subtitles/project_subtitles.srt 를 CapCut의 Captions > Add Captions > Import file 에서 불러옵니다.',
    '5. 배경음은 audio 폴더의 파일을 마지막 오디오 트랙에 추가합니다.',
    '6. 어떤 씬이 timeline_ready에 클립이 없으면 scenes/scene_xxx 폴더의 image 또는 source_video와 tts를 사용하면 됩니다.',
    '',
    '[폴더 설명]',
    '- timeline_ready: CapCut 타임라인에 바로 넣기 좋게 문단별로 합쳐 둔 클립',
    '- scenes: 문단별 원본 자산(image, source_video, tts, subtitle, prompt)',
    '- subtitles: 전체 프로젝트용 SRT + 씬별 SRT',
    '- audio: 배경음',
    '- manifest.json / timeline_import_guide.csv: 어떤 파일을 어떤 순서로 넣으면 되는지 정리',
    '',
    '[CapCut 설치 링크]',
    '- Desktop 다운로드: https://www.capcut.com/tools/desktop-video-editor',
    '- 설치 도움말: https://www.capcut.com/help/download-and-install',
    '',
    'CapCut 공식 기준으로 데스크톱 앱 자동 실행과 외부 프로젝트 자동 임포트는 지원되지 않습니다.',
    '대신 이 버튼은 타임라인 ZIP을 저장하고 CapCut 편집기를 자동으로 열어, 초보자도 바로 CapCut 안에서 이어 편집할 수 있도록 맞춰져 있습니다.',
  ].join('\n')));

  pushEntry('capcut_links.txt', textToBytes([
    'CapCut Online 편집기',
    'https://www.capcut.com/tools/online-video-editor',
    '',
    'CapCut Desktop 다운로드',
    'https://www.capcut.com/tools/desktop-video-editor',
    '',
    'CapCut 설치 도움말',
    'https://www.capcut.com/help/download-and-install',
  ].join('\n')));

  pushEntry('timeline_import_guide.csv', textToBytes(buildTimelineGuideCsv(timelineClipRows)));
  pushEntry('project_script.csv', textToBytes(buildProjectCsv(options.assets)));
  pushEntry('manifest.json', textToBytes(JSON.stringify({
    projectName: options.projectName,
    topic: options.topic || options.projectName,
    exportedAt: new Date().toISOString(),
    sceneCount: options.assets.length,
    hasOverallSrt: Boolean(srtContent.trim()),
    backgroundMusic: mainBgm ? { id: mainBgm.id, title: mainBgm.title } : null,
    timelineReadyClipCount: timelineClipRows.filter((row) => row.importMode === 'clip' || row.importMode === 'video_only').length,
    scenes: options.assets.map((asset, index) => {
      const sceneNumber = asset.sceneNumber || index + 1;
      const timelineClip = timelineClipRows.find((row) => row.sceneNumber === sceneNumber);
      return {
        sceneNumber,
        narration: asset.narration,
        targetDuration: estimateSceneDuration(asset),
        hasImage: Boolean(asset.imageData),
        hasAudio: Boolean(asset.audioData),
        hasVideo: Boolean(asset.videoData),
        hasSubtitle: Boolean(asset.subtitleData?.words?.length || asset.subtitleData?.fullText),
        timelineClip,
      };
    }),
  }, null, 2)));

  if (srtContent.trim()) {
    pushEntry('subtitles/project_subtitles.srt', textToBytes(srtContent));
  }

  options.assets.forEach((asset, index) => {
    const sceneNumber = asset.sceneNumber || index + 1;
    const sceneNo = formatSceneNo(sceneNumber);
    const sceneDir = `scenes/scene_${sceneNo}`;
    const sceneDuration = estimateSceneDuration(asset);

    pushEntry(`${sceneDir}/narration.txt`, textToBytes(asset.narration || ''));
    pushEntry(`${sceneDir}/prompt.txt`, textToBytes(asset.visualPrompt || ''));

    const subtitleText = buildSceneSubtitleText(asset);
    if (subtitleText) {
      pushEntry(`${sceneDir}/subtitle.txt`, textToBytes(subtitleText));
    }

    const sceneSrt = buildSceneSrt(asset, sceneDuration);
    if (sceneSrt.trim()) {
      pushEntry(`${sceneDir}/subtitle.srt`, textToBytes(sceneSrt));
      pushEntry(`subtitles/scene_${sceneNo}.srt`, textToBytes(sceneSrt));
    }
  });

  const imageAudioVideoTasks = options.assets.flatMap((asset, index) => {
    const sceneNumber = asset.sceneNumber || index + 1;
    const sceneNo = formatSceneNo(sceneNumber);
    const basePath = `scenes/scene_${sceneNo}`;
    const tasks: Array<Promise<ZipEntry | null>> = [];

    const imageBlob = blobFromDataValue(asset.imageData, 'image/png');
    if (imageBlob) {
      const extension = extensionFromMime(imageBlob.type || 'image/png', 'png');
      tasks.push(imageBlob.arrayBuffer().then((buffer) => ({ path: `${root}/${basePath}/image.${extension}`, bytes: new Uint8Array(buffer), modifiedAt: Date.now() })));
    }

    const audioBlob = blobFromDataValue(asset.audioData, 'audio/mpeg');
    if (audioBlob) {
      const extension = extensionFromMime(audioBlob.type || 'audio/mpeg', 'mp3');
      tasks.push(audioBlob.arrayBuffer().then((buffer) => ({ path: `${root}/${basePath}/tts.${extension}`, bytes: new Uint8Array(buffer), modifiedAt: Date.now() })));
    }

    const videoBlob = blobFromDataValue(asset.videoData, 'video/mp4');
    if (videoBlob) {
      const extension = extensionFromMime(videoBlob.type || 'video/mp4', 'mp4');
      tasks.push(videoBlob.arrayBuffer().then((buffer) => ({ path: `${root}/${basePath}/source_video.${extension}`, bytes: new Uint8Array(buffer), modifiedAt: Date.now() })));
    }

    return tasks;
  });

  const resolvedBinaryEntries = (await Promise.all(imageAudioVideoTasks)).filter((item): item is ZipEntry => Boolean(item));

  const bgmTasks = (options.backgroundMusicTracks || []).flatMap((track, index) => {
    const blob = blobFromDataValue(track.audioData, 'audio/mpeg');
    if (!blob) return [] as Array<Promise<ZipEntry | null>>;
    const extension = extensionFromMime(blob.type || 'audio/mpeg', 'mp3');
    const suffix = `${index + 1}`.padStart(2, '0');
    return [blob.arrayBuffer().then((buffer) => ({
      path: `${root}/audio/background_${suffix}_${sanitizeFilename(track.title || 'bgm')}.${extension}`,
      bytes: new Uint8Array(buffer),
      modifiedAt: Date.now(),
    }))];
  });

  const resolvedBgmEntries = (await Promise.all(bgmTasks)).filter((item): item is ZipEntry => Boolean(item));
  const finalEntries = [...entries, ...timelineClipEntries, ...resolvedBinaryEntries, ...resolvedBgmEntries].filter((entry, index, array) => (
    array.findIndex((candidate) => candidate.path === entry.path) === index
  ));

  const zipBlob = createZipBlob(finalEntries);
  triggerBlobDownload(zipBlob, `${safeName}_capcut_package.zip`);

  if (options.autoOpenCapCut) {
    openCapCutEditorAfterExport(capcutWindow);
  } else if (capcutWindow && !capcutWindow.closed) {
    capcutWindow.close();
  }
}

export async function exportProjectToZip(project: SavedProject): Promise<void> {
  return exportAssetsToZip(project.assets, project.name);
}
