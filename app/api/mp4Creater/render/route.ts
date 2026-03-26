import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextRequest, NextResponse } from 'next/server';
import { resolveAssetPlaybackDuration } from '../../../../lib/mp4Creater/services/projectEnhancementService';

export const runtime = 'nodejs';

type RenderAsset = {
  sceneNumber?: number;
  imageData?: string | null;
  audioData?: string | null;
  audioDuration?: number | null;
  targetDuration?: number | null;
  videoData?: string | null;
  videoDuration?: number | null;
  narration?: string;
  selectedVisualType?: 'image' | 'video';
  subtitleData?: {
    fullText?: string;
  } | null;
};

type RenderBody = {
  assets?: RenderAsset[];
  backgroundTracks?: Array<{ audioData?: string | null; volume?: number | null }>;
  previewMix?: { narrationVolume?: number; backgroundMusicVolume?: number } | null;
  aspectRatio?: '16:9' | '1:1' | '9:16';
  qualityMode?: 'preview' | 'final';
  enableSubtitles?: boolean;
  subtitlePreset?: {
    size?: 'small' | 'medium' | 'large';
    position?: 'top' | 'middle' | 'bottom';
    fontFamily?: string;
    backgroundOpacity?: number;
  } | null;
  title?: string;
};

const EMPTY_SCENE_PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPk4pdkYGBgYmBgYGBgAAACcwA2I9Wz/QAAAABJRU5ErkJggg==';

let resolvedFfmpegBinary: string | null | undefined;

async function isExistingFile(candidate: string) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

function trySpawn(command: string, args: string[], cwd: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function resolveFfmpegBinary(cwd: string) {
  if (resolvedFfmpegBinary !== undefined) return resolvedFfmpegBinary;

  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const commandCandidates = process.platform === 'win32'
    ? ['ffmpeg.exe', 'ffmpeg']
    : ['ffmpeg'];

  const fileCandidates = [
    process.env.FFMPEG_PATH,
    process.env.FFMPEG_BINARY,
    path.join(process.cwd(), 'ffmpeg', 'bin', exeName),
    path.join(process.cwd(), 'bin', exeName),
    path.join(process.cwd(), 'tools', 'ffmpeg', 'bin', exeName),
    process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe') : '',
    process.platform === 'win32' ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'ffmpeg.exe') : '',
    process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', 'scoop', 'shims', 'ffmpeg.exe') : '',
    process.platform === 'win32' ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : '/usr/local/bin/ffmpeg',
    process.platform === 'win32' ? 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe' : '/usr/bin/ffmpeg',
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe' : '',
  ].filter(Boolean) as string[];

  for (const candidate of fileCandidates) {
    if (!(await isExistingFile(candidate))) continue;
    if (await trySpawn(candidate, ['-version'], cwd)) {
      resolvedFfmpegBinary = candidate;
      return resolvedFfmpegBinary;
    }
  }

  for (const candidate of commandCandidates) {
    if (await trySpawn(candidate, ['-version'], cwd)) {
      resolvedFfmpegBinary = candidate;
      return resolvedFfmpegBinary;
    }
  }

  resolvedFfmpegBinary = null;
  return resolvedFfmpegBinary;
}

async function runFfmpeg(args: string[], cwd: string) {
  const ffmpegBinary = await resolveFfmpegBinary(cwd);
  if (!ffmpegBinary) {
    throw new Error('ffmpeg executable not found. Install ffmpeg or set FFMPEG_PATH to the ffmpeg binary.');
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary, args, { cwd });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        reject(new Error(`ffmpeg executable not found at ${ffmpegBinary}. Install ffmpeg or update FFMPEG_PATH.`));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

function dimsForRatio(aspectRatio: RenderBody['aspectRatio'], qualityMode: RenderBody['qualityMode']) {
  const hd = qualityMode === 'final';
  if (aspectRatio === '1:1') return hd ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  if (aspectRatio === '9:16') return hd ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  return hd ? { width: 1280, height: 720 } : { width: 960, height: 540 };
}

function decodeDataLike(value: string | null | undefined, fallbackMime = 'application/octet-stream') {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { kind: 'url' as const, url: trimmed };
  }

  const match = trimmed.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return {
      kind: 'buffer' as const,
      mime: match[1] || fallbackMime,
      buffer: Buffer.from(match[2] || '', 'base64'),
    };
  }

  return {
    kind: 'buffer' as const,
    mime: fallbackMime,
    buffer: Buffer.from(trimmed, 'base64'),
  };
}

async function writeMedia(targetPath: string, value: string | null | undefined, fallbackMime: string) {
  const parsed = decodeDataLike(value, fallbackMime);
  if (!parsed) return null;
  if (parsed.kind === 'url') {
    const response = await fetch(parsed.url, { cache: 'no-store' });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
    return targetPath;
  }
  await fs.writeFile(targetPath, parsed.buffer);
  return targetPath;
}

function escapeSrtText(value: string) {
  return value.replace(/\r/g, '').trim();
}

function formatSrtTime(totalSeconds: number) {
  const wholeMs = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(wholeMs / 3600000);
  const minutes = Math.floor((wholeMs % 3600000) / 60000);
  const seconds = Math.floor((wholeMs % 60000) / 1000);
  const milliseconds = wholeMs % 1000;
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

function buildSrt(text: string, duration: number) {
  return `1\n${formatSrtTime(0)} --> ${formatSrtTime(duration)}\n${escapeSrtText(text)}\n`;
}

function ffmpegSubtitlePath(inputPath: string) {
  return inputPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function subtitleStyle(subtitlePreset: RenderBody['subtitlePreset']) {
  const sizeMap = { small: 18, medium: 26, large: 34 } as const;
  const alignmentMap = { top: 8, middle: 5, bottom: 2 } as const;
  const size = sizeMap[subtitlePreset?.size || 'medium'];
  const alignment = alignmentMap[subtitlePreset?.position || 'bottom'];
  const backgroundOpacity = Math.max(0, Math.min(1, Number(subtitlePreset?.backgroundOpacity ?? 0.55)));
  const alpha = Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0').toUpperCase();
  const fontName = subtitlePreset?.fontFamily || 'Noto Sans CJK KR';
  return `FontName=${fontName},FontSize=${size},PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BackColour=&H${alpha}000000,BorderStyle=3,Outline=1.2,Shadow=0,Alignment=${alignment},MarginV=42`;
}

export async function POST(request: NextRequest) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp4creater-render-'));
  try {
    const body = (await request.json()) as RenderBody;
    const assets = Array.isArray(body.assets) ? body.assets.filter((item) => Boolean(item)) : [];
    if (!assets.length) {
      return NextResponse.json({ error: 'renderable assets are required' }, { status: 400 });
    }

    const { width, height } = dimsForRatio(body.aspectRatio || '16:9', body.qualityMode || 'preview');
    const sceneFiles: string[] = [];

    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      const duration = resolveAssetPlaybackDuration({
        narration: asset.narration || '',
        audioDuration: typeof asset.audioDuration === 'number' ? asset.audioDuration : null,
        targetDuration: typeof asset.targetDuration === 'number' ? asset.targetDuration : null,
        videoDuration: typeof asset.videoDuration === 'number' ? asset.videoDuration : null,
      }, { minimum: 1, fallbackNarrationEstimate: true, preferTargetDuration: true });
      const imagePath = path.join(tempDir, `scene_${index + 1}.png`);
      const videoPath = path.join(tempDir, `scene_${index + 1}_source.mp4`);
      const audioPath = path.join(tempDir, `scene_${index + 1}.wav`);
      const scenePath = path.join(tempDir, `scene_${index + 1}.mp4`);
      const srtPath = path.join(tempDir, `scene_${index + 1}.srt`);

      const writtenImage = await writeMedia(imagePath, asset.imageData || EMPTY_SCENE_PLACEHOLDER_IMAGE, 'image/png');
      if (!writtenImage) continue;
      const writtenVideo = asset.selectedVisualType === 'image'
        ? null
        : await writeMedia(videoPath, asset.videoData || null, 'video/mp4');
      const writtenAudio = await writeMedia(audioPath, asset.audioData || null, 'audio/wav');

      const vfFilters = [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        'setsar=1',
      ];

      const subtitleText = `${asset.subtitleData?.fullText || asset.narration || ''}`.trim();
      if (body.enableSubtitles && subtitleText) {
        await fs.writeFile(srtPath, buildSrt(subtitleText, duration), 'utf-8');
        vfFilters.push(`subtitles='${ffmpegSubtitlePath(srtPath)}':force_style='${subtitleStyle(body.subtitlePreset)}'`);
      }

      const renderScene = async (useVideoSource: boolean) => {
        const args = ['-y'];
        if (useVideoSource && writtenVideo) {
          args.push('-stream_loop', '-1', '-i', writtenVideo);
        } else {
          args.push('-loop', '1', '-framerate', '25', '-i', imagePath);
        }

        const audioInputIndex = 1;
        const audioFilterLabel = writtenAudio ? `[${audioInputIndex}:a]apad=pad_dur=` : `[${audioInputIndex}:a]atrim=`;
        if (writtenAudio) {
          args.push('-i', audioPath);
        } else {
          args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
        }

        args.push(
          '-filter_complex', `${audioFilterLabel}${duration}[aout]`,
          '-map', '0:v:0',
          '-map', '[aout]',
          '-t', `${duration}`,
          '-vf', vfFilters.join(','),
          '-r', '25',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          scenePath,
        );

        await runFfmpeg(args, tempDir);
      };

      if (writtenVideo) {
        try {
          await renderScene(true);
        } catch (error) {
          console.warn(`[render-route] scene ${index + 1} video source failed, falling back to image`, error);
          await renderScene(false);
        }
      } else {
        await renderScene(false);
      }

      sceneFiles.push(scenePath);
    }

    if (!sceneFiles.length) {
      return NextResponse.json({ error: 'no scene file was produced' }, { status: 500 });
    }

    const concatListPath = path.join(tempDir, 'concat.txt');
    await fs.writeFile(concatListPath, sceneFiles.map((file) => `file '${file.replace(/'/g, `'\\''`)}'`).join('\n'), 'utf-8');
    const mergedPath = path.join(tempDir, 'merged.mp4');
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', mergedPath], tempDir);

    const bgm = Array.isArray(body.backgroundTracks)
      ? body.backgroundTracks.find((item) => typeof item?.audioData === 'string' && item.audioData)
      : null;

    let finalPath = mergedPath;
    if (bgm?.audioData) {
      const bgmPath = path.join(tempDir, 'bgm.wav');
      const mixedPath = path.join(tempDir, 'final.mp4');
      const writtenBgm = await writeMedia(bgmPath, bgm.audioData, 'audio/wav');
      if (writtenBgm) {
        const narrationVolume = Math.max(0, Math.min(1.5, Number(body.previewMix?.narrationVolume ?? 1)));
        const backgroundVolume = Math.max(0, Math.min(1.2, Number(body.previewMix?.backgroundMusicVolume ?? bgm.volume ?? 0.28)));
        await runFfmpeg([
          '-y',
          '-i', mergedPath,
          '-stream_loop', '-1',
          '-i', bgmPath,
          '-filter_complex', `[0:a]volume=${narrationVolume}[narr];[1:a]volume=${backgroundVolume}[bgm];[narr][bgm]amix=inputs=2:duration=first[aout]`,
          '-map', '0:v',
          '-map', '[aout]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          mixedPath,
        ], tempDir);
        finalPath = mixedPath;
      }
    }

    const deliverPath = path.join(tempDir, 'deliver.mp4');
    await runFfmpeg([
      '-y',
      '-i', finalPath,
      '-map', '0',
      '-c', 'copy',
      '-movflags', '+faststart',
      deliverPath,
    ], tempDir);

    const bytes = await fs.readFile(deliverPath);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${(body.title || 'mp4creater-render').replace(/[^a-zA-Z0-9-_가-힣]+/g, '_')}.mp4"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ffmpeg render failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
