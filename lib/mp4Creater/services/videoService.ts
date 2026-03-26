import { parseDataUrl } from '../utils/downloadHelpers';

import { AspectRatio, BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings, SubtitleData, SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from '../types';
import { resolveAssetPlaybackDuration } from './projectEnhancementService';

/**
 * 고정밀 오디오 디코딩: ElevenLabs(MP3)와 Gemini(PCM) 통합 처리
 */
async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const parsed = parseDataUrl(base64, 'audio/mpeg');
  const sourceBase64 = parsed ? '' : (base64.startsWith('data:audio') ? (base64.split(',')[1] || '') : base64);
  const bytes = parsed
    ? Uint8Array.from(parsed.bytes)
    : (() => {
        const binaryString = atob(sourceBase64);
        const buffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);
        return buffer;
      })();

  try {
    return await ctx.decodeAudioData(bytes.buffer.slice(0));
  } catch (e) {
    const dataInt16 = new Int16Array(bytes.buffer.slice(0));
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }
}

// 자막 청크 (단어 그룹)
interface SubtitleChunk {
  text: string;       // 표시할 텍스트
  startTime: number;  // 시작 시간
  endTime: number;    // 끝 시간
}


interface RenderProfile {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

function resolvePreferredImageSources(value: string): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/') || trimmed.startsWith('http')) return [trimmed];

  const candidates = [
    `data:image/png;base64,${trimmed}`,
    `data:image/jpeg;base64,${trimmed}`,
    `data:image/webp;base64,${trimmed}`,
  ];

  const parsed = parseDataUrl(trimmed, 'image/png');
  if (parsed) {
    try {
      const blob = new Blob([Uint8Array.from(parsed.bytes).buffer], { type: parsed.mime || 'image/png' });
      candidates.unshift(URL.createObjectURL(blob));
    } catch {}
  }

  return Array.from(new Set(candidates));
}

async function loadSceneImage(img: HTMLImageElement, asset: GeneratedAsset, sceneIndex: number): Promise<void> {
  const candidates = resolvePreferredImageSources(asset.imageData || '');
  if (!candidates.length) throw new Error('Image source missing');

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          img.onload = null;
          img.onerror = null;
        };
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error('Image load timeout'));
        }, 5000);
        img.onload = () => {
          cleanup();
          window.clearTimeout(timer);
          if (!img.width || !img.height) {
            reject(new Error('Image has zero dimensions'));
            return;
          }
          resolve();
        };
        img.onerror = () => {
          cleanup();
          window.clearTimeout(timer);
          reject(new Error('Image load failed'));
        };
        img.src = candidate;
      });
      return;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`Scene ${sceneIndex + 1} image load failed`);
}


function wrapPlaceholderText(value: string, maxChars = 24, maxLines = 4): string[] {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let cursor = normalized;
  while (cursor && chunks.length < maxLines) {
    if (cursor.length <= maxChars) {
      chunks.push(cursor);
      break;
    }
    let sliceIndex = cursor.lastIndexOf(' ', maxChars);
    if (sliceIndex < Math.floor(maxChars * 0.55)) sliceIndex = maxChars;
    chunks.push(cursor.slice(0, sliceIndex).trim());
    cursor = cursor.slice(sliceIndex).trim();
  }
  if (cursor && chunks.length >= maxLines) {
    chunks[maxLines - 1] = `${chunks[maxLines - 1].slice(0, Math.max(0, maxChars - 1)).trim()}…`;
  }
  return chunks.filter(Boolean);
}

function buildScenePlaceholderDataUrl(asset: GeneratedAsset, sceneIndex: number, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(320, width);
  canvas.height = Math.max(320, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.55, '#1e293b');
  gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(canvas.width * 0.08, canvas.height * 0.12, canvas.width * 0.84, canvas.height * 0.76);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(26, Math.round(canvas.width * 0.026))}px sans-serif`;
  ctx.fillText(`씬 ${asset.sceneNumber || sceneIndex + 1}`, canvas.width / 2, canvas.height * 0.28);

  const bodyLines = wrapPlaceholderText(
    asset.narration || asset.imagePrompt || asset.visualPrompt || asset.videoPrompt || '이미지가 없어도 이 문단은 최종 합본에 포함됩니다.',
    Math.max(16, Math.round(canvas.width / 32)),
    4,
  );

  ctx.font = `600 ${Math.max(18, Math.round(canvas.width * 0.018))}px sans-serif`;
  const lineHeight = Math.max(28, Math.round(canvas.height * 0.055));
  const startY = canvas.height * 0.46 - ((bodyLines.length - 1) * lineHeight) / 2;
  bodyLines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  ctx.font = `500 ${Math.max(14, Math.round(canvas.width * 0.013))}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText('이미지 미등록 씬 자동 플레이스홀더', canvas.width / 2, canvas.height * 0.78);

  return canvas.toDataURL('image/png');
}

function isRenderableSceneAsset(asset: GeneratedAsset | null | undefined): asset is GeneratedAsset {
  return Boolean(asset);
}

async function prepareSceneImage(
  img: HTMLImageElement,
  asset: GeneratedAsset,
  sceneIndex: number,
  renderProfile: RenderProfile,
): Promise<void> {
  const placeholder = buildScenePlaceholderDataUrl(asset, sceneIndex, renderProfile.width, renderProfile.height);
  try {
    if (!asset.imageData) throw new Error('Image source missing');
    await loadSceneImage(img, asset, sceneIndex);
  } catch {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Placeholder image load failed'));
      img.src = placeholder;
    });
  }
}

/**
 * 렌더링 과부하 방지용 프로파일
 * - 씬 수가 많을수록 해상도와 FPS를 낮춰 CPU/GPU 순간 피크를 줄입니다.
 * - 사용자가 브라우저에서 직접 렌더링하므로 안전한 기본값을 우선합니다.
 */
function resolveRenderProfile(
  sceneCount: number,
  aspectRatio: AspectRatio = '16:9',
  qualityMode: 'preview' | 'final' = 'preview'
): RenderProfile {
  const profileKey = sceneCount >= 14 ? 'small' : sceneCount >= 8 ? 'medium' : 'large';
  const previewProfiles: Record<AspectRatio, Record<'small' | 'medium' | 'large', RenderProfile>> = {
    '16:9': {
      small: { width: 640, height: 360, fps: 18, bitrate: 2_500_000 },
      medium: { width: 854, height: 480, fps: 20, bitrate: 3_500_000 },
      large: { width: 960, height: 540, fps: 24, bitrate: 4_200_000 },
    },
    '1:1': {
      small: { width: 640, height: 640, fps: 18, bitrate: 2_500_000 },
      medium: { width: 800, height: 800, fps: 20, bitrate: 3_500_000 },
      large: { width: 960, height: 960, fps: 24, bitrate: 4_200_000 },
    },
    '9:16': {
      small: { width: 360, height: 640, fps: 18, bitrate: 2_500_000 },
      medium: { width: 480, height: 854, fps: 20, bitrate: 3_500_000 },
      large: { width: 540, height: 960, fps: 24, bitrate: 4_200_000 },
    },
  };

  const finalProfiles: Record<AspectRatio, Record<'small' | 'medium' | 'large', RenderProfile>> = {
    '16:9': {
      small: { width: 1280, height: 720, fps: 24, bitrate: 6_500_000 },
      medium: { width: 1600, height: 900, fps: 24, bitrate: 8_000_000 },
      large: { width: 1920, height: 1080, fps: 30, bitrate: 10_000_000 },
    },
    '1:1': {
      small: { width: 1080, height: 1080, fps: 24, bitrate: 6_500_000 },
      medium: { width: 1440, height: 1440, fps: 24, bitrate: 8_000_000 },
      large: { width: 1920, height: 1920, fps: 30, bitrate: 10_000_000 },
    },
    '9:16': {
      small: { width: 720, height: 1280, fps: 24, bitrate: 6_500_000 },
      medium: { width: 900, height: 1600, fps: 24, bitrate: 8_000_000 },
      large: { width: 1080, height: 1920, fps: 30, bitrate: 10_000_000 },
    },
  };

  const sourceProfiles = qualityMode === 'final' ? finalProfiles : previewProfiles;
  return sourceProfiles[aspectRatio]?.[profileKey] || sourceProfiles['16:9'][profileKey];
}

interface PreparedScene {
  img: HTMLImageElement;
  video: HTMLVideoElement | null;  // 애니메이션 영상 (있으면 이미지 대신 사용)
  isAnimated: boolean;             // 애니메이션 씬 여부
  audioBuffer: AudioBuffer | null;
  subtitleChunks: SubtitleChunk[];  // 미리 계산된 자막 청크들
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * 자막 데이터를 청크로 변환
 * - AI 의미 단위 청크가 있으면 우선 사용 (22자 이하, 의미 단위)
 * - 없으면 기존 단어 수 기반으로 폴백
 */
function createSubtitleChunks(
  subtitleData: SubtitleData | null,
  config: SubtitleConfig
): SubtitleChunk[] {
  if (!subtitleData || subtitleData.words.length === 0) {
    return [];
  }

  // AI 의미 단위 청크가 있으면 우선 사용
  if (subtitleData.meaningChunks && subtitleData.meaningChunks.length > 0) {
    console.log(`[Video] AI 의미 단위 자막 사용: ${subtitleData.meaningChunks.length}개 청크`);
    return subtitleData.meaningChunks.map(chunk => ({
      text: chunk.text,
      startTime: chunk.startTime,
      endTime: chunk.endTime
    }));
  }

  // 폴백: 기존 단어 수 기반 분리
  console.log('[Video] 기본 단어 수 기반 자막 사용');
  const chunks: SubtitleChunk[] = [];
  const words = subtitleData.words;
  const wordsPerChunk = config.wordsPerLine * config.maxLines;

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, Math.min(i + wordsPerChunk, words.length));

    if (chunkWords.length === 0) continue;

    const lines: string[] = [];
    for (let j = 0; j < chunkWords.length; j += config.wordsPerLine) {
      const lineWords = chunkWords.slice(j, j + config.wordsPerLine);
      lines.push(lineWords.map(w => w.word).join(' '));
    }

    chunks.push({
      text: lines.join('\n'),
      startTime: chunkWords[0].start,
      endTime: chunkWords[chunkWords.length - 1].end
    });
  }

  // 청크 간 간격 제거
  for (let i = 0; i < chunks.length - 1; i++) {
    chunks[i].endTime = chunks[i + 1].startTime;
  }

  return chunks;
}

/**
 * 현재 시간에 해당하는 자막 청크 찾기
 * - 씬 내에서 자막 바가 깜빡이지 않도록 마지막 청크를 씬 끝까지 유지
 */
function getCurrentChunk(
  chunks: SubtitleChunk[],
  sceneElapsed: number
): SubtitleChunk | null {
  if (chunks.length === 0) return null;

  // 현재 시간에 해당하는 청크 찾기
  for (const chunk of chunks) {
    if (sceneElapsed >= chunk.startTime && sceneElapsed <= chunk.endTime) {
      return chunk;
    }
  }

  // 청크 사이에 있을 때 (이전 청크 유지)
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (sceneElapsed > chunks[i].endTime) {
      // 다음 청크가 있고 아직 시작 전이면 이전 청크 유지
      if (i + 1 < chunks.length && sceneElapsed < chunks[i + 1].startTime) {
        return chunks[i];
      }
      // 마지막 청크 이후: 씬 끝까지 마지막 자막 유지 (깜빡임 방지)
      if (i === chunks.length - 1) {
        return chunks[i];
      }
      break;
    }
  }

  // 시작 전이면 첫 번째 청크 (시작 0.1초 전부터 표시해서 깜빡임 방지)
  if (sceneElapsed < chunks[0].startTime && sceneElapsed >= 0) {
    if (chunks[0].startTime - sceneElapsed < 0.1) {
      return chunks[0]; // 시작 직전이면 미리 표시
    }
    return null;
  }

  return null;
}

/**
 * 자막 렌더링 함수
 */
function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  chunks: SubtitleChunk[],
  sceneElapsed: number,
  config: SubtitleConfig
) {
  const currentChunk = getCurrentChunk(chunks, sceneElapsed);
  if (!currentChunk) return;

  const lines = currentChunk.text.split('\n');
  if (lines.length === 0) return;

  // 자막 스타일 설정
  const lineHeight = config.fontSize * 1.4;
  const padding = 20;
  const safeMargin = 10; // 화면 경계 안전 여백

  ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 전체 자막 영역 크기 계산
  const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  let boxWidth = maxLineWidth + padding * 2;
  const boxHeight = lines.length * lineHeight + padding * 2;

  // 화면 경계 체크 - 박스가 화면을 넘지 않도록
  const maxBoxWidth = canvas.width - safeMargin * 2;
  if (boxWidth > maxBoxWidth) {
    boxWidth = maxBoxWidth;
  }

  const boxX = Math.max(safeMargin, (canvas.width - boxWidth) / 2);
  let boxY = canvas.height - config.bottomMargin - boxHeight;

  // 상단 경계 체크
  if (boxY < safeMargin) {
    boxY = safeMargin;
  }

  // 반투명 배경 박스
  ctx.fillStyle = config.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
  ctx.fill();

  // 텍스트 렌더링
  lines.forEach((line, lineIndex) => {
    const textY = boxY + padding + lineIndex * lineHeight;

    // 검은 외곽선
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(line, canvas.width / 2, textY);

    // 흰색 텍스트
    ctx.fillStyle = config.textColor;
    ctx.fillText(line, canvas.width / 2, textY);
  });
}

export interface VideoExportOptions {
  enableSubtitles?: boolean;  // 자막 활성화 여부 (기본: true)
  subtitleConfig?: Partial<SubtitleConfig>;
  backgroundTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  aspectRatio?: AspectRatio;
  qualityMode?: 'preview' | 'final';
  useSceneVideos?: boolean;
}

// 실제 렌더링된 자막 타이밍 기록용 인터페이스
export interface RecordedSubtitleEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

// 비디오 생성 결과 (영상 + SRT 데이터)
export interface VideoGenerationResult {
  videoBlob: Blob;
  recordedSubtitles: RecordedSubtitleEntry[];
}

export const generateVideoStaticFallback = async (
  assets: GeneratedAsset[],
  onProgress: (msg: string) => void,
  abortRef?: { current: boolean },
  options?: VideoExportOptions
): Promise<VideoGenerationResult | null> => {
  const enableSubtitles = options?.enableSubtitles ?? true;
  const config: SubtitleConfig = { ...DEFAULT_SUBTITLE_CONFIG, ...options?.subtitleConfig };
  const backgroundTracks = options?.backgroundTracks || [];
  const previewMix = options?.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
  const aspectRatio = options?.aspectRatio || assets[0]?.aspectRatio || '16:9';
  const qualityMode = options?.qualityMode || 'preview';

  const validAssets = assets.filter(isRenderableSceneAsset);
  if (!validAssets.length) throw new Error('에셋이 준비되지 않았습니다.');

  onProgress(`정적 씬 안전 합본 준비 중 (1/3) · ${qualityMode === 'final' ? '고화질' : '미리보기'}...`);

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const destination = audioCtx.createMediaStreamDestination();
  const renderProfile = resolveRenderProfile(validAssets.length, aspectRatio, qualityMode);
  const preparedScenes: PreparedScene[] = [];
  let timelinePointer = 0;
  const DEFAULT_DURATION = 1;

  for (let i = 0; i < validAssets.length; i += 1) {
    const asset = validAssets[i];
    onProgress(`안전 합본용 씬 준비 중 (${i + 1}/${validAssets.length})...`);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await prepareSceneImage(img, asset, i, renderProfile);

    let audioBuffer: AudioBuffer | null = null;
    let duration = resolveAssetPlaybackDuration(asset, { minimum: DEFAULT_DURATION, fallbackNarrationEstimate: true });

    if (asset.audioData) {
      try {
        audioBuffer = await decodeAudio(asset.audioData, audioCtx);
        duration = resolveAssetPlaybackDuration({
          ...asset,
          audioDuration: Math.max(audioBuffer.duration || 0, asset.audioDuration || 0),
        }, { minimum: DEFAULT_DURATION, fallbackNarrationEstimate: true });
      } catch (error) {
        console.warn(`[Video/Fallback] 씬 ${i + 1} 오디오 디코딩 실패`, error);
      }
    }

    const startTime = Number(timelinePointer.toFixed(2));
    const endTime = Number((timelinePointer + duration).toFixed(2));
    const subtitleChunks = enableSubtitles ? createSubtitleChunks(asset.subtitleData || null, config) : [];

    preparedScenes.push({
      img,
      video: null,
      isAnimated: false,
      audioBuffer,
      subtitleChunks,
      startTime,
      endTime,
      duration,
    });
    timelinePointer = endTime;
  }

  const totalDuration = Number(timelinePointer.toFixed(2));
  if (totalDuration <= 0) throw new Error('합본 길이를 계산하지 못했습니다.');

  const canvas = document.createElement('canvas');
  canvas.width = renderProfile.width;
  canvas.height = renderProfile.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('캔버스 초기화 실패');

  const canvasStream = canvas.captureStream(renderProfile.fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
    ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    : 'video/webm; codecs=vp9,opus';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: renderProfile.bitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const recordedSubtitles: RecordedSubtitleEntry[] = [];
  let lastRecordedChunkText: string | null = null;
  let currentChunkStartTime = 0;
  let subtitleIndex = 0;

  return new Promise(async (resolve, reject) => {
    let isFinished = false;
    let lastProgressPercent = -1;

    recorder.onstop = async () => {
      await audioCtx.close().catch(() => undefined);
      if (lastRecordedChunkText !== null) {
        recordedSubtitles.push({
          index: subtitleIndex,
          startTime: currentChunkStartTime,
          endTime: totalDuration,
          text: lastRecordedChunkText,
        });
      }
      resolve({
        videoBlob: new Blob(chunks, { type: mimeType }),
        recordedSubtitles,
      });
    };

    recorder.onerror = (event) => reject(event);

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    onProgress(`정적 씬 안전 합본 렌더링 시작 (2/3)... ${renderProfile.width}x${renderProfile.height}`);

    const initialDelay = 0.35;
    const masterStartTime = audioCtx.currentTime + initialDelay;
    const startAt = performance.now() + initialDelay * 1000;

    preparedScenes.forEach((scene) => {
      if (!scene.audioBuffer) return;
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = previewMix.narrationVolume ?? 1;
      source.buffer = scene.audioBuffer;
      source.connect(gainNode);
      gainNode.connect(destination);
      source.start(masterStartTime + scene.startTime);
      source.stop(masterStartTime + Math.min(scene.endTime, scene.startTime + scene.audioBuffer.duration));
    });

    for (const track of backgroundTracks) {
      if (!track?.audioData) continue;
      try {
        const bgBuffer = await decodeAudio(track.audioData, audioCtx);
        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        source.buffer = bgBuffer;
        source.loop = true;
        gainNode.gain.value = previewMix.backgroundMusicVolume ?? track.volume ?? 0.28;
        source.connect(gainNode);
        gainNode.connect(destination);
        source.start(masterStartTime);
        source.stop(masterStartTime + totalDuration + 0.25);
      } catch (error) {
        console.warn('[Video/Fallback] 배경음 디코딩 실패', error);
      }
    }

    recorder.start();

    const drawScene = (scene: PreparedScene, elapsed: number) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sceneElapsed = Math.max(0, Math.min(scene.duration, elapsed - scene.startTime));
      const sceneProgress = scene.duration > 0 ? Math.min(1, Math.max(0, sceneElapsed / scene.duration)) : 0;
      const img = scene.img;
      if (img.width > 0 && img.height > 0) {
        const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
        const scale = 1 + 0.08 * sceneProgress;
        const drawWidth = img.width * ratio * scale;
        const drawHeight = img.height * ratio * scale;
        ctx.drawImage(img, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      }

      if (enableSubtitles) {
        renderSubtitle(ctx, canvas, scene.subtitleChunks, sceneElapsed, config);
        const currentChunk = getCurrentChunk(scene.subtitleChunks, sceneElapsed);
        const currentChunkText = currentChunk?.text || null;
        if (currentChunkText !== lastRecordedChunkText) {
          if (lastRecordedChunkText !== null) {
            recordedSubtitles.push({
              index: subtitleIndex,
              startTime: currentChunkStartTime,
              endTime: Math.max(0, elapsed),
              text: lastRecordedChunkText,
            });
            subtitleIndex += 1;
          }
          if (currentChunkText !== null) {
            currentChunkStartTime = Math.max(0, elapsed);
          }
          lastRecordedChunkText = currentChunkText;
        }
      }
    };

    const renderLoop = (now: number = performance.now()) => {
      if (isFinished) return;

      if (abortRef?.current) {
        isFinished = true;
        recorder.stop();
        return;
      }

      const elapsed = Math.max(0, (now - startAt) / 1000);
      const clampedElapsed = Math.min(totalDuration, elapsed);
      const currentScene = preparedScenes.find((scene) => clampedElapsed >= scene.startTime && clampedElapsed <= scene.endTime)
        || preparedScenes.find((scene) => clampedElapsed < scene.startTime)
        || preparedScenes[preparedScenes.length - 1];

      if (currentScene) {
        drawScene(currentScene, clampedElapsed);
      }

      const percent = Math.min(100, Math.round((clampedElapsed / totalDuration) * 100));
      if (percent !== lastProgressPercent && percent % 5 === 0) {
        lastProgressPercent = percent;
        onProgress(`정적 씬 안전 합본 렌더링 중: ${percent}%`);
      }

      if (elapsed >= totalDuration) {
        isFinished = true;
        onProgress('정적 씬 안전 합본 완료! 파일 생성 중...');
        window.setTimeout(() => recorder.stop(), 350);
        return;
      }

      requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
};

export const generateVideo = async (
  assets: GeneratedAsset[],
  onProgress: (msg: string) => void,
  abortRef?: { current: boolean },
  options?: VideoExportOptions
): Promise<VideoGenerationResult | null> => {
  // 옵션 기본값
  const enableSubtitles = options?.enableSubtitles ?? true;
  const config: SubtitleConfig = { ...DEFAULT_SUBTITLE_CONFIG, ...options?.subtitleConfig };
  const backgroundTracks = options?.backgroundTracks || [];
  const previewMix = options?.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
  const aspectRatio = options?.aspectRatio || assets[0]?.aspectRatio || '16:9';
  const qualityMode = options?.qualityMode || 'preview';
  const useSceneVideos = options?.useSceneVideos ?? true;

  // 이미지가 있는 모든 씬 포함 (오디오 없으면 기본 3초)
  const validAssets = assets.filter(isRenderableSceneAsset);
  if (validAssets.length === 0) throw new Error("에셋이 준비되지 않았습니다.");

  // 자막 데이터 유무 체크
  const hasSubtitles = enableSubtitles && validAssets.some(a => a.subtitleData !== null);
  console.log(`[Video] 총 ${assets.length}개 씬 중 ${validAssets.length}개 렌더링, 자막: ${enableSubtitles ? (hasSubtitles ? '활성화' : '데이터 없음') : '비활성화'}`);
  if (enableSubtitles) {
    console.log(`[Video] 자막 설정: ${config.wordsPerLine}단어/줄, 최대 ${config.maxLines}줄`);
  }

  onProgress(`에셋 메모리 사전 로딩 중 (1/3) · ${qualityMode === 'final' ? '고화질 렌더' : '저화질 렌더'}...`);

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const destination = audioCtx.createMediaStreamDestination();

  const renderProfile = resolveRenderProfile(validAssets.length, aspectRatio, qualityMode);

  // 1. 모든 장면의 경계(startTime, endTime)를 미리 계산하여 타임라인 구축
  const preparedScenes: PreparedScene[] = [];
  let timelinePointer = 0;

  const DEFAULT_DURATION = 1; // 오디오/영상/대본이 비어 있어도 기본 1초는 유지

  for (let i = 0; i < validAssets.length; i++) {
    const asset = validAssets[i];
    onProgress(`데이터 디코딩 및 프레임 매칭 중 (${i + 1}/${validAssets.length})...`);

    // 이미지 로드 (폴백용으로 항상 필요) - 에러 핸들링 추가
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await prepareSceneImage(img, asset, i, renderProfile).then(() => {
      console.log(`[Video] 씬 ${i + 1}: 이미지 또는 플레이스홀더 준비 완료 (${img.width}x${img.height})`);
    }).catch((e) => {
      console.warn(`[Video] 씬 ${i + 1}: ${e.message}`);
    });

    // 애니메이션 영상 로드 (있는 경우)
    let video: HTMLVideoElement | null = null;
    let isAnimated = false;

    if (useSceneVideos && asset.selectedVisualType !== 'image' && asset.videoData) {
      try {
        video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = asset.videoData;
        video.muted = true;  // 영상 자체 오디오는 사용 안 함
        video.playsInline = true;
        video.loop = true;   // 영상 길이가 오디오보다 짧으면 반복

        await new Promise<void>((resolve, reject) => {
          video!.onloadeddata = () => resolve();
          video!.onerror = () => reject(new Error('Video load failed'));
          setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });

        isAnimated = true;
        console.log(`[Video] 씬 ${i + 1}: 애니메이션 영상 로드 완료`);
      } catch (e) {
        console.warn(`[Video] 씬 ${i + 1}: 애니메이션 로드 실패, 정적 이미지 사용`);
        video = null;
        isAnimated = false;
      }
    }

    let audioBuffer: AudioBuffer | null = null;
    let duration = resolveAssetPlaybackDuration(asset, { minimum: DEFAULT_DURATION, fallbackNarrationEstimate: true });

    // 오디오가 있으면 디코딩, 없으면 기본 시간 사용
    if (asset.audioData) {
      try {
        audioBuffer = await decodeAudio(asset.audioData, audioCtx);
        duration = resolveAssetPlaybackDuration({
          ...asset,
          audioDuration: Math.max(audioBuffer.duration || 0, asset.audioDuration || 0),
        }, { minimum: DEFAULT_DURATION, fallbackNarrationEstimate: true });
      } catch (e) {
        console.warn(`[Video] 씬 ${i + 1} 오디오 디코딩 실패, 기본 ${DEFAULT_DURATION}초 사용`);
      }
    } else {
      console.log(`[Video] 씬 ${i + 1} 오디오 없음, 기본 ${DEFAULT_DURATION}초 사용`);
    }

    // 자막 청크 미리 계산 (자막 비활성화시 빈 배열)
    const subtitleChunks = enableSubtitles ? createSubtitleChunks(asset.subtitleData, config) : [];
    if (subtitleChunks.length > 0) {
      console.log(`[Video] 씬 ${i + 1}: ${subtitleChunks.length}개 자막 청크 생성`);
    }

    const startTime = timelinePointer;
    const endTime = startTime + duration;

    preparedScenes.push({
      img,
      video,
      isAnimated,
      audioBuffer,
      subtitleChunks,
      startTime,
      endTime,
      duration
    });
    timelinePointer = endTime;
  }

  const totalDuration = timelinePointer;

  // 2. 캔버스 및 미디어 레코더 설정
  const canvas = document.createElement('canvas');
  canvas.width = renderProfile.width;
  canvas.height = renderProfile.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error("캔버스 초기화 실패");

  const canvasStream = canvas.captureStream(renderProfile.fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
    ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    : 'video/webm; codecs=vp9,opus';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: renderProfile.bitrate
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  // 자막 타이밍 기록용 배열
  const recordedSubtitles: RecordedSubtitleEntry[] = [];
  let lastRecordedChunkText: string | null = null;
  let currentChunkStartTime: number = 0;
  let subtitleIndex = 0;

  return new Promise(async (resolve, reject) => {
    let isFinished = false;

    recorder.onstop = async () => {
      await audioCtx.close(); // 오디오 컨텍스트 정리

      // 마지막 자막 청크 종료 처리
      if (lastRecordedChunkText !== null) {
        recordedSubtitles.push({
          index: subtitleIndex,
          startTime: currentChunkStartTime,
          endTime: totalDuration,
          text: lastRecordedChunkText
        });
      }

      resolve({
        videoBlob: new Blob(chunks, { type: mimeType }),
        recordedSubtitles
      });
    };
    recorder.onerror = (e) => reject(e);

    if (audioCtx.state === 'suspended') await audioCtx.resume();

    onProgress(`실시간 동기화 렌더링 시작 (2/3)... ${renderProfile.width}x${renderProfile.height} / ${renderProfile.fps}fps 안전 모드`);

    // 3. 오디오 스케줄링
    const initialDelay = 0.5; // 레코더 안정화를 위한 여유 시간 확보
    const masterStartTime = audioCtx.currentTime + initialDelay;

    preparedScenes.forEach(scene => {
      if (scene.audioBuffer) {
        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = previewMix.narrationVolume ?? 1;
        source.buffer = scene.audioBuffer;
        source.connect(gainNode);
        gainNode.connect(destination);
        source.start(masterStartTime + scene.startTime);
        source.stop(masterStartTime + scene.endTime);
      }
    });

    for (const track of backgroundTracks) {
      if (!track?.audioData) continue;
      try {
        const bgBuffer = await decodeAudio(track.audioData, audioCtx);
        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        source.buffer = bgBuffer;
        source.loop = true;
        gainNode.gain.value = previewMix.backgroundMusicVolume ?? track.volume ?? 0.28;
        source.connect(gainNode);
        gainNode.connect(destination);
        source.start(masterStartTime);
        source.stop(masterStartTime + totalDuration + 0.5);
      } catch (error) {
        console.warn('[Video] 배경음 디코딩 실패:', error);
      }
    }

    // 애니메이션 영상 재생 스케줄링
    preparedScenes.forEach((scene, idx) => {
      if (scene.isAnimated && scene.video) {
        const videoStartDelay = (masterStartTime - audioCtx.currentTime + scene.startTime) * 1000;
        setTimeout(() => {
          if (!isFinished && scene.video) {
            scene.video.currentTime = 0;
            scene.video.play().catch(e => console.warn(`[Video] 씬 ${idx + 1} 영상 재생 실패:`, e));
          }
        }, Math.max(0, videoStartDelay));
      }
    });

    recorder.start();

    // 4. 고정밀 프레임 루프 (Master Clock Tracking)
    const minFrameInterval = 1000 / renderProfile.fps;
    let lastFrameTs = 0;

    const renderLoop = (now: number = 0) => {
      if (isFinished) return;

      if (abortRef?.current) {
        isFinished = true;
        recorder.stop();
        return;
      }

      if (now - lastFrameTs < minFrameInterval) {
        requestAnimationFrame(renderLoop);
        return;
      }
      lastFrameTs = now;

      const currentAudioTime = audioCtx.currentTime;
      const elapsed = currentAudioTime - masterStartTime;

      // 모든 장면 완료 체크
      if (elapsed >= totalDuration) {
        isFinished = true;
        onProgress("렌더링 완료! 파일 생성 중...");
        setTimeout(() => recorder.stop(), 500); // 마지막 프레임 유지를 위해 0.5초 대기
        return;
      }

      // 현재 오디오 타임스탬프에 '절대 동기화'된 장면 찾기 (경계값 포함)
      let currentScene = preparedScenes.find(s =>
        elapsed >= s.startTime && elapsed <= s.endTime
      );

      // 씬을 못 찾으면 가장 가까운 씬 선택
      if (!currentScene) {
        if (elapsed < 0 || elapsed < preparedScenes[0].startTime) {
          currentScene = preparedScenes[0];
        } else {
          // elapsed 이후로 시작하는 가장 가까운 씬 또는 마지막 씬
          currentScene = preparedScenes.find(s => elapsed < s.startTime) || preparedScenes[preparedScenes.length - 1];
        }
      }

      if (ctx && currentScene) {
        // 배경 클리어
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 씬 진행률 계산
        const sceneProgress = Math.min(1, Math.max(0, (elapsed - currentScene.startTime) / currentScene.duration));

        let rendered = false;

        // 애니메이션 씬: 비디오 프레임 렌더링
        if (currentScene.isAnimated && currentScene.video && currentScene.video.readyState >= 2) {
          const video = currentScene.video;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const ratio = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);

            // 부드러운 줌인 효과 (정적 이미지보다 약하게)
            const scale = 1.0 + 0.05 * sceneProgress;

            const nw = video.videoWidth * ratio * scale;
            const nh = video.videoHeight * ratio * scale;
            ctx.drawImage(video, (canvas.width - nw) / 2, (canvas.height - nh) / 2, nw, nh);
            rendered = true;
          }
        }

        // 정적 이미지 렌더링 (비디오 실패 시 또는 기본)
        if (!rendered) {
          const img = currentScene.img;
          if (img.width > 0 && img.height > 0) {
            const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);

            // 줌인 효과: 씬 진행률에 따라 1.0 → 1.1 (10% 확대)
            const scale = 1.0 + 0.1 * sceneProgress;

            const nw = img.width * ratio * scale;
            const nh = img.height * ratio * scale;
            ctx.drawImage(img, (canvas.width - nw) / 2, (canvas.height - nh) / 2, nw, nh);
          }
        }

        // 자막 렌더링 (청크 기반)
        const sceneElapsed = elapsed - currentScene.startTime;
        renderSubtitle(ctx, canvas, currentScene.subtitleChunks, sceneElapsed, config);

        // 자막 타이밍 기록 (실제 표시되는 것과 동일하게)
        const currentChunk = getCurrentChunk(currentScene.subtitleChunks, sceneElapsed);
        const currentChunkText = currentChunk?.text || null;

        if (currentChunkText !== lastRecordedChunkText) {
          // 이전 청크 종료 기록
          if (lastRecordedChunkText !== null) {
            recordedSubtitles.push({
              index: subtitleIndex,
              startTime: currentChunkStartTime,
              endTime: elapsed,
              text: lastRecordedChunkText
            });
            subtitleIndex++;
          }
          // 새 청크 시작
          if (currentChunkText !== null) {
            currentChunkStartTime = elapsed;
          }
          lastRecordedChunkText = currentChunkText;
        }

        // 실시간 진행률 업데이트
        const percent = Math.min(100, Math.round((elapsed / totalDuration) * 100));
        if (percent % 5 === 0) { // 너무 빈번한 업데이트 방지
            onProgress(`동기화 렌더링 가동 중: ${percent}%`);
        }
      }

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  });
};
