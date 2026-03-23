import { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings } from '../types';
import { extensionFromMime, parseDataUrl, triggerBlobDownload } from '../utils/downloadHelpers';

interface DavinciSceneRecord {
  sceneNumber: number;
  narration: string;
  duration: number;
  startTimeSec: number;
  endTimeSec: number;
  gapBeforeSec: number;
  aspectRatio: string;
  visualType: 'image' | 'video' | 'none';
  mediaFile: string | null;
  audioFile: string | null;
  subtitleFile: string | null;
  imagePrompt: string;
  videoPrompt: string;
}

interface DavinciPackageManifest {
  packageVersion: 1;
  packageType: 'mp4creater-davinci-import';
  generatedAt: string;
  projectName: string;
  projectId?: string | null;
  projectNumber?: number | null;
  sceneCount: number;
  aspectRatio: string;
  previewMix: PreviewMixSettings;
  backgroundMusicFile: string | null;
  scenes: DavinciSceneRecord[];
}

interface DavinciPrepareOptions {
  assets: GeneratedAsset[];
  topic: string;
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  storageDir?: string;
  projectId?: string | null;
  projectNumber?: number | null;
}

export interface DavinciPrepareResult {
  mode: 'bridge' | 'zip';
  packageName: string;
  sceneCount: number;
  packagePath?: string;
  launchUri?: string;
  launchAttempted: boolean;
  launchSucceeded: boolean;
  downloadFilename?: string;
}

interface ZipEntryInput {
  path: string;
  bytes: Uint8Array;
}

const textEncoder = new TextEncoder();
const BRIDGE_SCHEME = 'mp4creater-davinci://import';
const AUTO_IMPORT_PAYLOAD_LIMIT = 55 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return `${name || 'mp4Creater'}`
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'mp4Creater';
}

function safeBasename(value: string): string {
  return sanitizeFilename(value).replace(/\s+/g, '_') || 'mp4Creater';
}

function bytesFromText(value: string): Uint8Array {
  return textEncoder.encode(value);
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

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
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
  const { time, date } = getDosDateTime(new Date());

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

  return new Blob([...localChunks.map((chunk) => Uint8Array.from(chunk).buffer), Uint8Array.from(centralDirectory).buffer, Uint8Array.from(endRecord).buffer], { type: 'application/zip' });
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function buildSceneSrt(asset: GeneratedAsset): string {
  const words = asset.subtitleData?.words || [];
  if (words.length) {
    return words.map((word, index) => `${index + 1}\n${formatSrtTime(word.start)} --> ${formatSrtTime(Math.max(word.end, word.start + 0.2))}\n${word.word}\n`).join('\n');
  }
  const text = `${asset.subtitleData?.fullText || asset.narration || ''}`.trim();
  if (!text) return '';
  const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3);
  return `1\n${formatSrtTime(0)} --> ${formatSrtTime(duration)}\n${text}\n`;
}

function buildMasterSrt(assets: GeneratedAsset[]): string {
  let pointer = 0;
  let index = 1;
  const rows: string[] = [];

  assets.forEach((asset) => {
    const text = `${asset.subtitleData?.fullText || asset.narration || ''}`.trim();
    const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3);
    if (text) rows.push(`${index++}\n${formatSrtTime(pointer)} --> ${formatSrtTime(pointer + duration)}\n${text}\n`);
    pointer += duration;
  });

  return rows.join('\n');
}

function resolveVisualType(asset: GeneratedAsset): 'image' | 'video' | 'none' {
  if (asset.selectedVisualType === 'video' && asset.videoData) return 'video';
  if (asset.selectedVisualType === 'image' && asset.imageData) return 'image';
  if (asset.videoData) return 'video';
  if (asset.imageData) return 'image';
  return 'none';
}

function buildPackageManifest(options: { assets: GeneratedAsset[]; topic: string; backgroundTracks?: BackgroundMusicTrack[]; previewMix: PreviewMixSettings; projectId?: string | null; projectNumber?: number | null; }): DavinciPackageManifest {
  const aspectRatio = options.assets[0]?.aspectRatio || '16:9';
  const primaryBgm = options.backgroundTracks?.find((item) => item.audioData) || null;
  let timelinePointer = 0;
  const scenes = options.assets.map((asset, index) => {
    const sceneNumber = asset.sceneNumber || index + 1;
    const sceneNo = String(sceneNumber).padStart(3, '0');
    const visualType = resolveVisualType(asset);
    const mediaFile = visualType === 'video' ? `media/${sceneNo}_scene_${sceneNo}_video.${guessExtension(asset.videoData, 'video/mp4', 'mp4')}` : visualType === 'image' ? `media/${sceneNo}_scene_${sceneNo}_image.${guessExtension(asset.imageData, 'image/png', 'png')}` : null;
    const audioFile = asset.audioData ? `audio/${sceneNo}_scene_${sceneNo}_narration.${guessExtension(asset.audioData, 'audio/mpeg', 'mp3')}` : null;
    const subtitleFile = (asset.subtitleData?.fullText || asset.narration) ? `subtitles/${sceneNo}_scene_${sceneNo}.srt` : null;
    const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3);
    const startTimeSec = timelinePointer;
    const endTimeSec = startTimeSec + duration;
    timelinePointer = endTimeSec;
    return { sceneNumber, narration: `${asset.narration || ''}`.trim(), duration, startTimeSec, endTimeSec, gapBeforeSec: 0, aspectRatio: asset.aspectRatio || aspectRatio, visualType, mediaFile, audioFile, subtitleFile, imagePrompt: `${asset.imagePrompt || asset.visualPrompt || ''}`.trim(), videoPrompt: `${asset.videoPrompt || ''}`.trim() } satisfies DavinciSceneRecord;
  });
  return { packageVersion: 1, packageType: 'mp4creater-davinci-import', generatedAt: new Date().toISOString(), projectName: options.topic || 'mp4Creater Project', projectId: options.projectId || null, projectNumber: typeof options.projectNumber === 'number' ? options.projectNumber : null, sceneCount: scenes.length, aspectRatio, previewMix: options.previewMix, backgroundMusicFile: primaryBgm?.audioData ? `music/000_project_bgm.${guessExtension(primaryBgm.audioData, 'audio/wav', 'wav')}` : null, scenes };
}

function buildSceneCsv(manifest: DavinciPackageManifest): string {
  const header = ['scene_number', 'timeline_start_sec', 'timeline_end_sec', 'gap_before_sec', 'duration_sec', 'aspect_ratio', 'visual_type', 'media_file', 'audio_file', 'subtitle_file', 'narration'];
  const rows = manifest.scenes.map((scene) => [scene.sceneNumber, scene.startTimeSec.toFixed(2), scene.endTimeSec.toFixed(2), scene.gapBeforeSec.toFixed(2), scene.duration.toFixed(2), scene.aspectRatio, scene.visualType, scene.mediaFile || '', scene.audioFile || '', scene.subtitleFile || '', csvEscape(scene.narration)].join(','));
  return [header.join(','), ...rows].join('\n');
}

function csvEscape(value: string): string {
  const normalized = `${value || ''}`.replace(/\r?\n/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildReadme(manifest: DavinciPackageManifest, packagePath?: string): string {
  return [`프로젝트: ${manifest.projectName}`, manifest.projectNumber ? `프로젝트 번호: #${manifest.projectNumber}` : '', `씬 수: ${manifest.sceneCount}`, `화면 비율: ${manifest.aspectRatio}`, packagePath ? `패키지 위치: ${packagePath}` : '', '', '다빈치 리졸브 가져오기 우선 순서', '1. mp4Creater 브리지가 설치되어 있다면 open_with_mp4creater_bridge.cmd, .ps1, .url 중 하나로 자동 Import를 먼저 시도합니다.', '2. 브리지가 없다면 media, audio, music, subtitles 폴더를 번호 순서대로 드래그해도 바로 편집할 수 있습니다.', '3. scenes.csv와 resolve-import-manifest.json에는 타임라인 시작/종료 시각과 자막 파일명이 함께 정리됩니다.', '4. drag_order.txt에는 수동 드래그 순서가 적혀 있습니다.', '', '폴더 규칙', '- media: 씬별 이미지 또는 영상', '- audio: 씬별 내레이션', '- music: 프로젝트 배경음', '- subtitles: 씬별 SRT와 master_timeline.srt'].filter(Boolean).join('\n');
}

function guessExtension(value: string | null | undefined, fallbackMime: string, fallbackExt: string): string {
  if (!value) return fallbackExt;
  const parsed = parseDataUrl(value, fallbackMime);
  if (parsed) return extensionFromMime(parsed.mime, fallbackExt);
  if (value.startsWith('blob:')) return fallbackExt;
  const lowered = value.toLowerCase();
  if (lowered.endsWith('.png')) return 'png';
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'jpg';
  if (lowered.endsWith('.webp')) return 'webp';
  if (lowered.endsWith('.wav')) return 'wav';
  if (lowered.endsWith('.mp3')) return 'mp3';
  if (lowered.endsWith('.webm')) return 'webm';
  if (lowered.endsWith('.mp4')) return 'mp4';
  return fallbackExt;
}

async function normalizeToDataUrl(value: string | null | undefined, fallbackMime: string): Promise<string | null> {
  if (!value?.trim()) return null;
  if (value.startsWith('data:')) return value;
  if (!value.startsWith('blob:') && !value.startsWith('http') && !value.startsWith('/')) return value;
  const response = await fetch(value);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('파일 데이터를 읽지 못했습니다.'));
    reader.readAsDataURL(new Blob([blob], { type: blob.type || fallbackMime }));
  });
  return dataUrl;
}

async function normalizeAssetsForExport(assets: GeneratedAsset[]): Promise<GeneratedAsset[]> {
  return Promise.all(assets.map(async (asset) => ({ ...asset, imageData: await normalizeToDataUrl(asset.imageData, 'image/png'), audioData: await normalizeToDataUrl(asset.audioData, 'audio/mpeg'), videoData: await normalizeToDataUrl(asset.videoData, 'video/mp4') })));
}

async function normalizeBackgroundTracks(tracks: BackgroundMusicTrack[]): Promise<BackgroundMusicTrack[]> {
  return Promise.all(tracks.map(async (track) => ({ ...track, audioData: await normalizeToDataUrl(track.audioData, 'audio/wav') })));
}

function estimatePayloadSize(assets: GeneratedAsset[], tracks: BackgroundMusicTrack[]): number {
  let total = 0;
  assets.forEach((asset) => { total += asset.imageData?.length || 0; total += asset.audioData?.length || 0; total += asset.videoData?.length || 0; });
  tracks.forEach((track) => { total += track.audioData?.length || 0; });
  return total;
}

function dataBytes(value: string | null | undefined, fallbackMime: string): Uint8Array | null {
  const parsed = parseDataUrl(value, fallbackMime);
  return parsed?.bytes || null;
}

async function buildDavinciZipEntries(options: { assets: GeneratedAsset[]; topic: string; backgroundTracks: BackgroundMusicTrack[]; previewMix: PreviewMixSettings; projectId?: string | null; projectNumber?: number | null; }): Promise<{ entries: ZipEntryInput[]; packageName: string; sceneCount: number }> {
  const packageName = safeBasename(options.projectNumber ? `${options.projectNumber}_${options.topic || 'project'}` : options.topic || 'project');
  const manifest = buildPackageManifest(options);
  const entries: ZipEntryInput[] = [];
  const root = packageName;
  entries.push({ path: `${root}/manifest/resolve-import-manifest.json`, bytes: bytesFromText(JSON.stringify(manifest, null, 2)) });
  entries.push({ path: `${root}/manifest/scenes.csv`, bytes: bytesFromText(buildSceneCsv(manifest)) });
  entries.push({ path: `${root}/manifest/drag_order.txt`, bytes: bytesFromText(buildDragOrder(manifest)) });
  entries.push({ path: `${root}/subtitles/master_timeline.srt`, bytes: bytesFromText(buildMasterSrt(options.assets)) });
  entries.push({ path: `${root}/README_IMPORT.txt`, bytes: bytesFromText(buildReadme(manifest)) });
  manifest.scenes.forEach((scene, index) => {
    const asset = options.assets[index];
    if (scene.mediaFile) {
      const source = scene.visualType === 'video' ? asset.videoData : asset.imageData;
      const bytes = dataBytes(source, scene.visualType === 'video' ? 'video/mp4' : 'image/png');
      if (bytes) entries.push({ path: `${root}/${scene.mediaFile}`, bytes });
    }
    if (scene.audioFile) {
      const bytes = dataBytes(asset.audioData, 'audio/mpeg');
      if (bytes) entries.push({ path: `${root}/${scene.audioFile}`, bytes });
    }
    if (scene.subtitleFile) entries.push({ path: `${root}/${scene.subtitleFile}`, bytes: bytesFromText(buildSceneSrt(asset)) });
  });
  const bgm = options.backgroundTracks.find((track) => track.audioData) || null;
  if (bgm?.audioData && manifest.backgroundMusicFile) {
    const bytes = dataBytes(bgm.audioData, 'audio/wav');
    if (bytes) entries.push({ path: `${root}/${manifest.backgroundMusicFile}`, bytes });
  }
  return { entries, packageName, sceneCount: manifest.sceneCount };
}

async function downloadDavinciResolvePackage(options: DavinciPrepareOptions): Promise<DavinciPrepareResult> {
  const normalizedAssets = await normalizeAssetsForExport(options.assets || []);
  const normalizedTracks = await normalizeBackgroundTracks(options.backgroundTracks || []);
  const previewMix = options.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
  const built = await buildDavinciZipEntries({ assets: normalizedAssets, topic: options.topic, backgroundTracks: normalizedTracks, previewMix, projectId: options.projectId, projectNumber: options.projectNumber });
  const zipBlob = createStoredZip(built.entries);
  const filename = `${built.packageName}_davinci_resolve_import.zip`;
  triggerBlobDownload(zipBlob, filename);
  return { mode: 'zip', packageName: built.packageName, sceneCount: built.sceneCount, launchAttempted: false, launchSucceeded: false, downloadFilename: filename };
}

async function tryLaunchExternalUri(uri: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const trySingleLaunch = async (): Promise<boolean> => new Promise<boolean>((resolve) => {
    let finished = false;
    const iframe = document.createElement('iframe');
    const anchor = document.createElement('a');
    const cleanup = () => {
      window.removeEventListener('blur', onSignal, true);
      document.removeEventListener('visibilitychange', onVisibility, true);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    };
    const done = (value: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(value);
    };
    const onSignal = () => done(true);
    const onVisibility = () => { if (document.hidden) done(true); };
    iframe.style.display = 'none';
    anchor.style.display = 'none';
    anchor.href = uri;
    window.addEventListener('blur', onSignal, true);
    document.addEventListener('visibilitychange', onVisibility, true);
    document.body.appendChild(iframe);
    document.body.appendChild(anchor);
    try { iframe.src = uri; } catch {}
    window.setTimeout(() => { try { anchor.click(); } catch {} }, 90);
    window.setTimeout(() => { try { window.location.assign(uri); } catch {} }, 240);
    window.setTimeout(() => done(false), 2200);
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await trySingleLaunch()) return true;
    if (attempt < 2) await pause(420);
  }
  return false;
}

export async function prepareDavinciResolveImport(options: DavinciPrepareOptions): Promise<DavinciPrepareResult> {
  const normalizedAssets = await normalizeAssetsForExport(options.assets || []);
  const normalizedTracks = await normalizeBackgroundTracks(options.backgroundTracks || []);
  const previewMix = options.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
  const payloadSize = estimatePayloadSize(normalizedAssets, normalizedTracks);
  if (!options.storageDir?.trim() || payloadSize > AUTO_IMPORT_PAYLOAD_LIMIT) {
    return downloadDavinciResolvePackage({ ...options, assets: normalizedAssets, backgroundTracks: normalizedTracks, previewMix });
  }
  const response = await fetch('/api/mp4Creater/davinci-resolve/package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storageDir: options.storageDir, projectId: options.projectId, projectNumber: options.projectNumber, topic: options.topic, assets: normalizedAssets, backgroundTracks: normalizedTracks, previewMix }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || '다빈치 리졸브 패키지 준비에 실패했습니다.');
  const launchUri = typeof payload?.launchUri === 'string' ? payload.launchUri : '';
  const launchSucceeded = launchUri ? await tryLaunchExternalUri(launchUri) : false;
  return { mode: 'bridge', packageName: typeof payload?.packageName === 'string' ? payload.packageName : safeBasename(options.topic || 'project'), sceneCount: typeof payload?.sceneCount === 'number' ? payload.sceneCount : normalizedAssets.length, packagePath: typeof payload?.packagePath === 'string' ? payload.packagePath : undefined, launchUri: launchUri || undefined, launchAttempted: Boolean(launchUri), launchSucceeded };
}

export async function saveDavinciResolvePackageZip(options: DavinciPrepareOptions): Promise<DavinciPrepareResult> {
  return downloadDavinciResolvePackage(options);
}

export function buildDavinciBridgeUri(packagePath: string, packageName: string): string {
  const params = new URLSearchParams({ packagePath, packageName, source: 'mp4Creater-web' });
  return `${BRIDGE_SCHEME}?${params.toString()}`;
}
