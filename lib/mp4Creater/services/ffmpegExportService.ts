const FFMPEG_CORE_VERSION = '0.12.10';
const FFMPEG_CORE_BASE_URLS = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
] as const;

type FFmpegClass = {
  load: (options: Record<string, string>) => Promise<void>;
  on: (event: string, callback: (payload: any) => void) => void;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array | { buffer: ArrayBufferLike } | ArrayBuffer>;
  deleteFile?: (path: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  terminate?: () => Promise<void> | void;
};

type FFmpegHandle = {
  ffmpeg: FFmpegClass;
  setProgressHandler: (handler: ((ratio: number) => void) | null) => void;
  setLogHandler: (handler: ((message: string) => void) | null) => void;
  dispose: () => Promise<void>;
};

let ffmpegCoreUrlPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;
let normalizeQueue: Promise<void> = Promise.resolve();

const remoteBlobUrlCache = new Map<string, Promise<string>>();

function getSafeWindow(): (Window & typeof globalThis) | null {
  return typeof window === 'undefined' ? null : window;
}

function createCdnBlobUrl(url: string, mimeType: string): Promise<string> {
  const cached = remoteBlobUrlCache.get(url);
  if (cached) return cached;

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`ffmpeg-core-fetch-failed:${response.status}`);
      return response.blob();
    })
    .then((blob) => URL.createObjectURL(new Blob([blob], { type: mimeType })))
    .catch((error) => {
      remoteBlobUrlCache.delete(url);
      throw error;
    });

  remoteBlobUrlCache.set(url, promise);
  return promise;
}

async function getOrLoadGlobalModules(): Promise<{ FFmpeg: new () => FFmpegClass }> {
  const win = getSafeWindow();
  if (!win) throw new Error('ffmpeg-window-unavailable');

  const mod = await import('@ffmpeg/ffmpeg');
  if (mod?.FFmpeg) return { FFmpeg: mod.FFmpeg as unknown as new () => FFmpegClass };
  throw new Error('ffmpeg-module-unavailable');
}

async function getCoreUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  if (!ffmpegCoreUrlPromise) {
    ffmpegCoreUrlPromise = (async () => {
      let lastError: unknown = null;
      for (const baseURL of FFMPEG_CORE_BASE_URLS) {
        try {
          const [coreURL, wasmURL] = await Promise.all([
            createCdnBlobUrl(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            createCdnBlobUrl(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          ]);
          return { coreURL, wasmURL };
        } catch (error) {
          lastError = error;
        }
      }

      ffmpegCoreUrlPromise = null;
      if (lastError instanceof Error) throw lastError;
      throw new Error('ffmpeg-core-fetch-failed');
    })();
  }

  return ffmpegCoreUrlPromise;
}

async function createFfmpegHandle(): Promise<FFmpegHandle> {
  const { FFmpeg } = await getOrLoadGlobalModules();
  const ffmpeg = new FFmpeg();
  let progressHandler: ((ratio: number) => void) | null = null;
  let logHandler: ((message: string) => void) | null = null;

  ffmpeg.on('progress', ({ progress }: { progress?: number }) => {
    if (typeof progress === 'number' && progressHandler) progressHandler(progress);
  });

  ffmpeg.on('log', ({ message }: { message?: string }) => {
    if (message && logHandler) logHandler(message);
  });

  const { coreURL, wasmURL } = await getCoreUrls();
  await ffmpeg.load({ coreURL, wasmURL });

  return {
    ffmpeg,
    setProgressHandler: (handler) => {
      progressHandler = handler;
    },
    setLogHandler: (handler) => {
      logHandler = handler;
    },
    dispose: async () => {
      progressHandler = null;
      logHandler = null;
      try {
        await ffmpeg.terminate?.();
      } catch {}
    },
  };
}

function enqueueNormalizeJob<T>(task: () => Promise<T>): Promise<T> {
  const run = normalizeQueue.then(task, task);
  normalizeQueue = run.then(() => undefined, () => undefined);
  return run;
}

function uint8ArrayFromBlob(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function normalizeFileData(data: Uint8Array | { buffer: ArrayBufferLike } | ArrayBuffer): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data && 'buffer' in data) return new Uint8Array(data.buffer);
  throw new Error('ffmpeg-output-read-failed');
}

async function sniffContainer(blob: Blob): Promise<'mp4' | 'webm' | 'ogg' | 'mov' | 'unknown'> {
  try {
    const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') return 'mp4';
    if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === 'OggS') return 'ogg';
    if (bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'mdat') return 'mov';
  } catch {}
  return 'unknown';
}

async function detectInputExtension(blob: Blob): Promise<string> {
  const sniffed = await sniffContainer(blob);
  if (sniffed !== 'unknown') return sniffed;

  const type = blob.type || '';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('quicktime')) return 'mov';
  return 'webm';
}

async function cleanupFiles(ffmpeg: FFmpegClass, paths: string[]) {
  for (const path of paths) {
    try {
      await ffmpeg.deleteFile?.(path);
    } catch {}
  }
}

function tailLogs(logs: string[], count = 12): string {
  return logs.slice(-count).join(' | ');
}

function isRecoverableInputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /(invalid as first byte of an EBML number|End of file|Invalid data found|error reading header|could not find codec parameters|moov atom not found|truncated|Input\/output error|Operation not permitted|browser-stabilize-video-load-failed|ffmpeg-exec-failed:safe-fps-transcode|ffmpeg-exec-failed:webm-copy-video)/i.test(message);
}

function getStableRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm; codecs="vp8,opus"',
    'video/webm; codecs="vp9,opus"',
    'video/webm',
  ];
  return candidates.find((candidate) => {
    try {
      return MediaRecorder.isTypeSupported(candidate);
    } catch {
      return false;
    }
  }) || '';
}

async function rerecordStableInputBlob(
  inputBlob: Blob,
  options: NormalizeVideoForExportOptions = {},
): Promise<Blob> {
  const mimeType = getStableRecorderMimeType();
  if (!mimeType) throw new Error('browser-stabilize-recorder-unsupported');

  const win = getSafeWindow();
  if (!win) throw new Error('browser-window-unavailable');

  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(inputBlob);
    const chunks: Blob[] = [];
    let settled = false;
    let recorder: MediaRecorder | null = null;
    let progressTimer: number | null = null;

    const cleanup = () => {
      if (progressTimer !== null) {
        win.clearInterval(progressTimer);
        progressTimer = null;
      }
      try {
        recorder?.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error ?? 'browser-stabilize-failed')));
    };

    const finish = (blob: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    video.onerror = () => fail(new Error('browser-stabilize-video-load-failed'));
    video.onended = () => {
      try {
        recorder?.requestData();
      } catch {}
      win.setTimeout(() => {
        try {
          recorder?.stop();
        } catch (error) {
          fail(error);
        }
      }, 150);
    };

    video.onloadedmetadata = async () => {
      try {
        const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.bind(video)
          || (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.bind(video);
        if (!capture) throw new Error('browser-stabilize-capture-unsupported');

        const stream = capture();
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 4_000_000,
          audioBitsPerSecond: 160_000,
        });

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = (event: Event) => {
          const anyEvent = event as Event & { error?: Error };
          fail(anyEvent.error ?? new Error('browser-stabilize-recorder-failed'));
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          if (!blob.size) {
            fail(new Error('browser-stabilize-empty-blob'));
            return;
          }
          finish(blob);
        };

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        options.onStatus?.('입력 영상을 안정화된 포맷으로 다시 기록하는 중입니다...');
        options.onProgress?.(0);
        if (duration > 0) {
          progressTimer = win.setInterval(() => {
            if (video.duration > 0) {
              options.onProgress?.(Math.min(video.currentTime / video.duration, 0.98));
            }
          }, 250);
        }

        recorder.start(500);
        video.currentTime = 0;
        await video.play();
      } catch (error) {
        fail(error);
      }
    };
  });
}

type TranscodePlan = {
  label: string;
  args: string[];
};

function buildTranscodePlans(inputName: string, outputName: string, inputExtension: string): TranscodePlan[] {
  if (inputExtension === 'mp4') {
    return [
      { label: 'copy-faststart', args: ['-y', '-i', inputName, '-movflags', '+faststart', '-c', 'copy', outputName] },
      { label: 'mpeg4-aac', args: ['-y', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', inputName, '-r', '30', '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', outputName] },
      { label: 'mpeg4-silent', args: ['-y', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', inputName, '-r', '30', '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outputName] },
    ];
  }

  return [
    { label: 'safe-fps-transcode', args: ['-y', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', inputName, '-r', '30', '-vsync', 'cfr', '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', outputName] },
    { label: 'safe-fps-silent', args: ['-y', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', inputName, '-r', '30', '-vsync', 'cfr', '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outputName] },
    { label: 'webm-copy-video', args: ['-y', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', inputName, '-c:v', 'mpeg4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outputName] },
  ];
}

async function execPlan(
  ffmpeg: FFmpegClass,
  plan: TranscodePlan,
  outputName: string,
  capturedLogs: string[],
): Promise<Uint8Array> {
  const exitCode = await ffmpeg.exec(plan.args);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg-exec-failed:${plan.label}:exit-${exitCode}${capturedLogs.length ? `:${tailLogs(capturedLogs)}` : ''}`);
  }

  try {
    return normalizeFileData(await ffmpeg.readFile(outputName));
  } catch (error) {
    throw new Error(`ffmpeg-output-read-failed:${plan.label}:${error instanceof Error ? error.message : String(error ?? '')}`);
  }
}

export interface NormalizeVideoForExportOptions {
  onStatus?: (message: string) => void;
  onProgress?: (ratio: number) => void;
}

export interface NormalizeVideoForExportResult {
  blob: Blob;
  converted: boolean;
  container: 'mp4' | 'original';
  engine: 'ffmpeg' | 'browser';
  warning?: string;
}

async function normalizeVideoForExportOnce(
  inputBlob: Blob,
  options: NormalizeVideoForExportOptions = {},
): Promise<NormalizeVideoForExportResult> {
  const { onStatus, onProgress } = options;
  onStatus?.('브라우저 FFmpeg 엔진과 MP4 코어 파일을 불러오는 중입니다...');

  const handle = await createFfmpegHandle();
  const { ffmpeg } = handle;
  const inputExtension = await detectInputExtension(inputBlob);
  const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputName = `input_${jobId}.${inputExtension}`;
  const outputName = `output_${jobId}.mp4`;
  const capturedLogs: string[] = [];

  handle.setProgressHandler((ratio) => onProgress?.(ratio));
  handle.setLogHandler((message) => {
    capturedLogs.push(message);
    if (capturedLogs.length > 40) capturedLogs.shift();
    if (message.includes('time=')) onStatus?.('FFmpeg로 MP4 파일을 정리하는 중입니다...');
  });

  try {
    onStatus?.('합본 결과를 FFmpeg 작업영역에 쓰는 중입니다...');
    await ffmpeg.writeFile(inputName, await uint8ArrayFromBlob(inputBlob));

    const plans = buildTranscodePlans(inputName, outputName, inputExtension);
    let lastError: unknown = null;

    for (const plan of plans) {
      try {
        onStatus?.(`FFmpeg로 MP4 인코딩을 진행 중입니다... (${plan.label})`);
        const outputData = await execPlan(ffmpeg, plan, outputName, capturedLogs);
        const outputBytes = outputData.slice(outputData.byteOffset, outputData.byteOffset + outputData.byteLength);
        const outputBlob = new Blob([outputBytes], { type: 'video/mp4' });
        if (!outputBlob.size) throw new Error(`ffmpeg-empty-output-blob:${plan.label}`);
        return { blob: outputBlob, converted: true, container: 'mp4', engine: 'ffmpeg' };
      } catch (error) {
        lastError = error;
        try {
          await ffmpeg.deleteFile?.(outputName);
        } catch {}
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`ffmpeg-mp4-transcode-failed${capturedLogs.length ? `:${tailLogs(capturedLogs)}` : ''}`);
  } finally {
    handle.setProgressHandler(null);
    handle.setLogHandler(null);
    await cleanupFiles(ffmpeg, [inputName, outputName]);
    await handle.dispose();
  }
}

export async function normalizeVideoForExport(
  inputBlob: Blob,
  options: NormalizeVideoForExportOptions = {},
): Promise<NormalizeVideoForExportResult> {
  if (!inputBlob.size) {
    throw new Error('ffmpeg-empty-input-blob');
  }

  return enqueueNormalizeJob(async () => {
    let currentInput = inputBlob;
    let usedStabilizePass = false;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (attempt > 0) {
          options.onStatus?.('FFmpeg 작업영역을 새로 열어 MP4 변환을 다시 시도합니다...');
          options.onProgress?.(0);
        }
        const result = await normalizeVideoForExportOnce(currentInput, options);
        if (usedStabilizePass) {
          return {
            ...result,
            warning: 'browser-stabilized-before-ffmpeg',
          };
        }
        return result;
      } catch (error) {
        lastError = error;
        console.error(`[ffmpegExportService] mp4 normalize attempt ${attempt + 1} failed`, error);

        if (!usedStabilizePass && isRecoverableInputError(error)) {
          usedStabilizePass = true;
          options.onStatus?.('입력 영상을 안정화한 뒤 MP4 변환을 다시 시도합니다...');
          options.onProgress?.(0);
          try {
            currentInput = await rerecordStableInputBlob(currentInput, options);
            continue;
          } catch (stabilizeError) {
            lastError = stabilizeError instanceof Error
              ? new Error(`ffmpeg-input-stabilize-failed:${stabilizeError.message}`)
              : new Error(`ffmpeg-input-stabilize-failed:${String(stabilizeError ?? 'unknown')}`);
          }
        }
      }
    }

    console.error('[ffmpegExportService] mp4 normalize failed', lastError);
    return {
      blob: inputBlob,
      converted: false,
      container: 'original',
      engine: 'browser',
      warning: lastError instanceof Error ? `ffmpeg-mp4-normalize-failed:${lastError.message}` : 'ffmpeg-mp4-normalize-failed',
    };
  });
}
