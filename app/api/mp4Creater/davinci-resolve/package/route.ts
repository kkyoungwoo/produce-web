import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveStorageDir } from '../../../local-storage/_shared';
import type { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings } from '@/lib/mp4Creater/types';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const textEncoder = new TextEncoder();
const BRIDGE_SCHEME = 'mp4creater-davinci://import';

interface RequestBody {
  storageDir?: string;
  projectId?: string | null;
  projectNumber?: number | null;
  topic?: string;
  assets?: GeneratedAsset[];
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  launchBridge?: boolean;
  downloadZip?: boolean;
}

interface DavinciSceneRecord {
  sceneNumber: number;
  narration: string;
  duration: number;
  timelineStartSec: number;
  timelineEndSec: number;
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

interface ZipEntryInput {
  path: string;
  bytes: Uint8Array;
}

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

function ensureArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
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

function createStoredZipBytes(entries: ZipEntryInput[]): Uint8Array {
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

  return concatUint8Arrays([...localChunks, centralDirectory, endRecord]);
}

function parseDataValue(value: string | null | undefined, fallbackMime: string): { mime: string; bytes: Buffer } | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return null;
    return { mime: match[1] || fallbackMime, bytes: Buffer.from(match[2] || '', 'base64') };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return { mime: fallbackMime, bytes: Buffer.from(trimmed.replace(/\s+/g, ''), 'base64') };
  }
  return null;
}

function extensionFromMime(mime: string, fallback: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  return fallback;
}

function guessExtension(value: string | null | undefined, fallbackMime: string, fallbackExt: string): string {
  const parsed = parseDataValue(value, fallbackMime);
  return parsed ? extensionFromMime(parsed.mime, fallbackExt) : fallbackExt;
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function resolveVisualType(asset: GeneratedAsset): 'image' | 'video' | 'none' {
  if (asset.selectedVisualType === 'video' && asset.videoData) return 'video';
  if (asset.selectedVisualType === 'image' && asset.imageData) return 'image';
  if (asset.videoData) return 'video';
  if (asset.imageData) return 'image';
  return 'none';
}

function buildSceneSrt(asset: GeneratedAsset): string {
  const words = asset.subtitleData?.words || [];
  if (words.length) {
    return words
      .map((word, index) => `${index + 1}\n${formatSrtTime(word.start)} --> ${formatSrtTime(Math.max(word.end, word.start + 0.2))}\n${word.word}\n`)
      .join('\n');
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

function csvEscape(value: string): string {
  return `"${`${value || ''}`.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
}

function buildBridgeUri(packagePath: string, packageName: string): string {
  const params = new URLSearchParams({ packagePath, packageName, source: 'mp4Creater-web' });
  return `${BRIDGE_SCHEME}?${params.toString()}`;
}

function buildPackageManifest(options: {
  assets: GeneratedAsset[];
  topic: string;
  backgroundTracks: BackgroundMusicTrack[];
  previewMix: PreviewMixSettings;
  projectId?: string | null;
  projectNumber?: number | null;
}): DavinciPackageManifest {
  const aspectRatio = options.assets[0]?.aspectRatio || '16:9';
  const primaryBgm = options.backgroundTracks.find((item) => item.audioData) || null;
  let timelinePointer = 0;

  const scenes = options.assets.map((asset, index) => {
    const sceneNumber = asset.sceneNumber || index + 1;
    const sceneNo = String(sceneNumber).padStart(3, '0');
    const visualType = resolveVisualType(asset);
    const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3);
    const timelineStartSec = timelinePointer;
    const timelineEndSec = timelinePointer + duration;
    timelinePointer = timelineEndSec;

    return {
      sceneNumber,
      narration: `${asset.narration || ''}`.trim(),
      duration,
      timelineStartSec,
      timelineEndSec,
      aspectRatio: asset.aspectRatio || aspectRatio,
      visualType,
      mediaFile:
        visualType === 'video'
          ? `media/${sceneNo}_scene_${sceneNo}_video.${guessExtension(asset.videoData, 'video/mp4', 'mp4')}`
          : visualType === 'image'
            ? `media/${sceneNo}_scene_${sceneNo}_image.${guessExtension(asset.imageData, 'image/png', 'png')}`
            : null,
      audioFile: asset.audioData ? `audio/${sceneNo}_scene_${sceneNo}_narration.${guessExtension(asset.audioData, 'audio/mpeg', 'mp3')}` : null,
      subtitleFile: (asset.subtitleData?.fullText || asset.narration) ? `subtitles/${sceneNo}_scene_${sceneNo}.srt` : null,
      imagePrompt: `${asset.imagePrompt || asset.visualPrompt || ''}`.trim(),
      videoPrompt: `${asset.videoPrompt || ''}`.trim(),
    } satisfies DavinciSceneRecord;
  });

  return {
    packageVersion: 1,
    packageType: 'mp4creater-davinci-import',
    generatedAt: new Date().toISOString(),
    projectName: options.topic || 'mp4Creater Project',
    projectId: options.projectId || null,
    projectNumber: typeof options.projectNumber === 'number' ? options.projectNumber : null,
    sceneCount: scenes.length,
    aspectRatio,
    previewMix: options.previewMix,
    backgroundMusicFile: primaryBgm?.audioData ? `music/000_project_bgm.${guessExtension(primaryBgm.audioData, 'audio/wav', 'wav')}` : null,
    scenes,
  };
}

function buildSceneCsv(manifest: DavinciPackageManifest): string {
  const header = ['scene_number', 'start_sec', 'end_sec', 'duration_sec', 'aspect_ratio', 'visual_type', 'media_file', 'audio_file', 'subtitle_file', 'narration'];
  const rows = manifest.scenes.map((scene) => [
    scene.sceneNumber,
    scene.timelineStartSec.toFixed(2),
    scene.timelineEndSec.toFixed(2),
    scene.duration.toFixed(2),
    scene.aspectRatio,
    scene.visualType,
    scene.mediaFile || '',
    scene.audioFile || '',
    scene.subtitleFile || '',
    csvEscape(scene.narration),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

function buildDragOrderText(manifest: DavinciPackageManifest): string {
  return manifest.scenes.map((scene) => {
    const rows = [
      `Scene ${String(scene.sceneNumber).padStart(3, '0')}`,
      `  start: ${scene.timelineStartSec.toFixed(2)} sec`,
      `  end: ${scene.timelineEndSec.toFixed(2)} sec`,
    ];
    if (scene.mediaFile) rows.push(`  visual: ${scene.mediaFile}`);
    if (scene.audioFile) rows.push(`  audio: ${scene.audioFile}`);
    if (scene.subtitleFile) rows.push(`  subtitle: ${scene.subtitleFile}`);
    return rows.join('\n');
  }).join('\n\n');
}

function buildReadme(manifest: DavinciPackageManifest, packagePath: string): string {
  return [
    `프로젝트: ${manifest.projectName}`,
    manifest.projectNumber ? `프로젝트 번호: #${manifest.projectNumber}` : '',
    `씬 수: ${manifest.sceneCount}`,
    `화면 비율: ${manifest.aspectRatio}`,
    `패키지 위치: ${packagePath}`,
    '',
    '다빈치 리졸브 가져오기 우선 순서',
    '1. 브리지가 설치되어 있다면 open_with_mp4creater_bridge.cmd 또는 .ps1 또는 .url을 먼저 실행합니다.',
    '2. 자동 Import가 바로 열리지 않으면 다빈치 리졸브를 먼저 띄운 뒤 같은 파일을 다시 실행합니다.',
    '3. 그래도 안 되면 manifest/drag_order.txt 순서대로 media, audio, music, subtitles 폴더를 드래그합니다.',
    '4. manifest/scenes.csv와 resolve-import-manifest.json에는 시작/종료 시각이 같이 정리되어 있습니다.',
  ].filter(Boolean).join('\n');
}

function buildHelperScripts(launchUri: string): Record<string, string> {
  const powershellUri = launchUri.replace(/'/g, "''");
  return {
    'open_with_mp4creater_bridge.cmd': [
      '@echo off',
      'setlocal',
      `start "" "${launchUri}"`,
      'exit /b 0',
    ].join('\r\n'),
    'open_with_mp4creater_bridge.ps1': [
      `$uri = '${powershellUri}'`,
      'Start-Process $uri',
    ].join('\r\n'),
    'open_with_mp4creater_bridge.vbs': [
      'Set shell = CreateObject("WScript.Shell")',
      `shell.Run "${launchUri}", 0, False`,
    ].join('\r\n'),
    'open_with_mp4creater_bridge.url': [
      '[InternetShortcut]',
      `URL=${launchUri}`,
    ].join('\r\n'),
  };
}

function buildZipEntries(options: {
  assets: GeneratedAsset[];
  topic: string;
  backgroundTracks: BackgroundMusicTrack[];
  previewMix: PreviewMixSettings;
  projectId?: string | null;
  projectNumber?: number | null;
  packageName: string;
  packagePath: string;
}): ZipEntryInput[] {
  const manifest = buildPackageManifest(options);
  const root = options.packageName;
  const entries: ZipEntryInput[] = [
    { path: `${root}/manifest/resolve-import-manifest.json`, bytes: bytesFromText(JSON.stringify(manifest, null, 2)) },
    { path: `${root}/manifest/scenes.csv`, bytes: bytesFromText(buildSceneCsv(manifest)) },
    { path: `${root}/manifest/drag_order.txt`, bytes: bytesFromText(buildDragOrderText(manifest)) },
    { path: `${root}/subtitles/master_timeline.srt`, bytes: bytesFromText(buildMasterSrt(options.assets)) },
    { path: `${root}/README_IMPORT.txt`, bytes: bytesFromText(buildReadme(manifest, options.packagePath)) },
  ];

  const launchUri = buildBridgeUri(options.packagePath, options.packageName);
  const helperScripts = buildHelperScripts(launchUri);
  Object.entries(helperScripts).forEach(([filename, content]) => {
    entries.push({ path: `${root}/${filename}`, bytes: bytesFromText(content) });
  });

  manifest.scenes.forEach((scene, index) => {
    const asset = options.assets[index];
    if (scene.mediaFile) {
      const parsed = parseDataValue(scene.visualType === 'video' ? asset.videoData : asset.imageData, scene.visualType === 'video' ? 'video/mp4' : 'image/png');
      if (parsed) entries.push({ path: `${root}/${scene.mediaFile}`, bytes: new Uint8Array(parsed.bytes) });
    }
    if (scene.audioFile) {
      const parsed = parseDataValue(asset.audioData, 'audio/mpeg');
      if (parsed) entries.push({ path: `${root}/${scene.audioFile}`, bytes: new Uint8Array(parsed.bytes) });
    }
    if (scene.subtitleFile) {
      entries.push({ path: `${root}/${scene.subtitleFile}`, bytes: bytesFromText(buildSceneSrt(asset)) });
    }
  });

  const primaryBgm = options.backgroundTracks.find((track) => track.audioData) || null;
  if (primaryBgm?.audioData && manifest.backgroundMusicFile) {
    const parsed = parseDataValue(primaryBgm.audioData, 'audio/wav');
    if (parsed) entries.push({ path: `${root}/${manifest.backgroundMusicFile}`, bytes: new Uint8Array(parsed.bytes) });
  }

  return entries;
}

async function writePackageDirectory(options: {
  packageRoot: string;
  assets: GeneratedAsset[];
  topic: string;
  backgroundTracks: BackgroundMusicTrack[];
  previewMix: PreviewMixSettings;
  projectId?: string | null;
  projectNumber?: number | null;
  packageName: string;
}) {
  await fs.mkdir(path.join(options.packageRoot, 'manifest'), { recursive: true });
  await fs.mkdir(path.join(options.packageRoot, 'media'), { recursive: true });
  await fs.mkdir(path.join(options.packageRoot, 'audio'), { recursive: true });
  await fs.mkdir(path.join(options.packageRoot, 'music'), { recursive: true });
  await fs.mkdir(path.join(options.packageRoot, 'subtitles'), { recursive: true });

  const manifest = buildPackageManifest(options);
  const launchUri = buildBridgeUri(options.packageRoot, options.packageName);

  await fs.writeFile(path.join(options.packageRoot, 'manifest', 'resolve-import-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  await fs.writeFile(path.join(options.packageRoot, 'manifest', 'scenes.csv'), buildSceneCsv(manifest), 'utf-8');
  await fs.writeFile(path.join(options.packageRoot, 'manifest', 'drag_order.txt'), buildDragOrderText(manifest), 'utf-8');
  await fs.writeFile(path.join(options.packageRoot, 'subtitles', 'master_timeline.srt'), buildMasterSrt(options.assets), 'utf-8');
  await fs.writeFile(path.join(options.packageRoot, 'README_IMPORT.txt'), buildReadme(manifest, options.packageRoot), 'utf-8');

  const helperScripts = buildHelperScripts(launchUri);
  await Promise.all(Object.entries(helperScripts).map(([filename, content]) => fs.writeFile(path.join(options.packageRoot, filename), content, 'utf-8')));

  for (let index = 0; index < manifest.scenes.length; index += 1) {
    const scene = manifest.scenes[index];
    const asset = options.assets[index];
    if (scene.mediaFile) {
      const parsed = parseDataValue(scene.visualType === 'video' ? asset.videoData : asset.imageData, scene.visualType === 'video' ? 'video/mp4' : 'image/png');
      if (parsed) await fs.writeFile(path.join(options.packageRoot, scene.mediaFile), parsed.bytes);
    }
    if (scene.audioFile) {
      const parsed = parseDataValue(asset.audioData, 'audio/mpeg');
      if (parsed) await fs.writeFile(path.join(options.packageRoot, scene.audioFile), parsed.bytes);
    }
    if (scene.subtitleFile) {
      await fs.writeFile(path.join(options.packageRoot, scene.subtitleFile), buildSceneSrt(asset), 'utf-8');
    }
  }

  const primaryBgm = options.backgroundTracks.find((track) => track.audioData) || null;
  if (primaryBgm?.audioData && manifest.backgroundMusicFile) {
    const parsed = parseDataValue(primaryBgm.audioData, 'audio/wav');
    if (parsed) await fs.writeFile(path.join(options.packageRoot, manifest.backgroundMusicFile), parsed.bytes);
  }

  return { manifest, launchUri };
}

async function tryExecOnWindows(file: string, args: string[]): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync(file, args, { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function tryLaunchBridgeOnServer(launchUri: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const escapedUri = launchUri.replace(/'/g, "''");

  if (await tryExecOnWindows('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Start-Process '${escapedUri}'`])) {
    return true;
  }
  if (await tryExecOnWindows('cmd.exe', ['/c', 'start', '', launchUri])) {
    return true;
  }
  if (await tryExecOnWindows('rundll32.exe', ['url.dll,FileProtocolHandler', launchUri])) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const assets = ensureArray(body.assets);
    const backgroundTracks = ensureArray(body.backgroundTracks);
    const previewMix = body.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
    const topic = body.topic?.trim() || 'mp4Creater Project';
    const packageName = safeBasename(body.projectNumber ? `${body.projectNumber}_${topic}` : topic);

    if (body.downloadZip) {
      const virtualPackagePath = path.join('exports', 'davinci-resolve', `${packageName}_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`);
      const entries = buildZipEntries({
        assets,
        topic,
        backgroundTracks,
        previewMix,
        projectId: body.projectId,
        projectNumber: body.projectNumber,
        packageName,
        packagePath: virtualPackagePath,
      });
      const zipBytes = createStoredZipBytes(entries);
      const filename = `${packageName}_davinci_resolve_import.zip`;
      return new NextResponse(zipBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': String(zipBytes.byteLength),
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const requestedStorageDir = body.storageDir?.trim();
    if (!requestedStorageDir) {
      return NextResponse.json({ error: '저장 위치가 있어야 다빈치 패키지를 로컬 폴더로 만들 수 있습니다.' }, { status: 400 });
    }

    const storageDir = resolveStorageDir(requestedStorageDir);
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const packageRoot = path.join(storageDir, 'exports', 'davinci-resolve', `${packageName}_${stamp}`);

    const { manifest, launchUri } = await writePackageDirectory({
      packageRoot,
      assets,
      topic,
      backgroundTracks,
      previewMix,
      projectId: body.projectId,
      projectNumber: body.projectNumber,
      packageName,
    });

    const launchAttempted = Boolean(body.launchBridge);
    const launchSucceeded = body.launchBridge ? await tryLaunchBridgeOnServer(launchUri) : false;

    return NextResponse.json({
      ok: true,
      packageName,
      packagePath: packageRoot,
      launchUri,
      launchAttempted,
      launchSucceeded,
      sceneCount: manifest.sceneCount,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '다빈치 패키지 생성 실패',
    }, { status: 500 });
  }
}
