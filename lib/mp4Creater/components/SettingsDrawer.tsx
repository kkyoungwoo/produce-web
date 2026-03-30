'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StudioState } from '../types';
import { pickFolderPath } from '../services/folderPicker';
import {
  BGM_MODEL_OPTIONS,
  CHATTERBOX_CUSTOM_VOICE_ID,
  CONFIG,
  ELEVENLABS_MODELS,
  IMAGE_MODELS,
  QWEN_TTS_PRESET_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from '../config';
import AiOptionPickerModal from './AiOptionPickerModal';
import TtsSelectionModal from './TtsSelectionModal';
import { validateProviderConnection } from '../services/providerValidationService';
import { createTtsPreview } from '../services/ttsService';
import {
  createBackgroundMusicTrack,
  isGoogleBackgroundMusicModel,
  normalizeBackgroundMusicModelId,
  resolveBackgroundMusicProvider,
} from '../services/musicService';
import { fetchElevenLabsVoices } from '../services/elevenLabsService';
import { resolveGoogleAiStudioApiKey } from '../services/googleAiStudioService';
import {
  AiPickerOption,
  getElevenLabsModelPickerOptions,
  getElevenLabsVoicePickerOptions,
  getBackgroundMusicPickerOptions,
  getImageModelPickerOptions,
  getQwenVoicePickerOptions,
  getScriptModelPickerOptions,
  getTtsProviderPickerOptions,
  getVideoModelPickerOptions,
} from '../services/aiOptionCatalog';

interface SettingsDrawerProps {
  open: boolean;
  studioState: StudioState;
  onClose: () => void;
  onSave: (partial: Partial<StudioState>) => Promise<StudioState> | StudioState;
  youtubeSectionVariant?: 'default' | 'collapsed-bottom';
}

type InlineFeedback = { tone: 'success' | 'error' | 'info'; message: string } | null;
type SettingsPickerConfig = {
  title: string;
  description: string;
  currentId: string;
  options: AiPickerOption[];
  onSelect: (id: string) => void;
  requireConfirm?: boolean;
  confirmLabel?: string;
  emptyMessage?: string;
  onPreviewOption?: (id: string) => Promise<string | null>;
  extraPanel?: React.ReactNode;
};

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-400';
const SETTINGS_INPUT_PLACEHOLDERS = {
  storageDir: './local-data/tubegen-studio',
  googleAiStudioApiKey: 'AIza...',
  elevenLabsApiKey: 'sk_... or xi-...',
  youtubeClientId: '1234567890-xxxxxxxxxxxxxxxx.apps.googleusercontent.com',
  youtubeClientSecret: 'GOCSPX-...',
  youtubeStoredSecretFallback: 'Stored Secret',
} as const;
const SETTINGS_DEFAULT_VALUES = {
  storageDir: '',
  loadedYoutubeClientId: '',
  providerValues: {
    openRouterApiKey: '',
    elevenLabsApiKey: '',
  },
  youtubeOAuthValues: {
    googleClientId: '',
    googleClientSecret: '',
  },
} as const;
const isGoogleBgmModel = (modelId?: string | null) => isGoogleBackgroundMusicModel(modelId);
const isPaidScriptModel = (modelId?: string | null) => SCRIPT_MODEL_OPTIONS.find((item) => item.id === modelId)?.tier === 'paid';
const isPaidImageModel = (modelId?: string | null) => IMAGE_MODELS.find((item) => item.id === modelId)?.tier === 'paid';
const isPaidVideoModel = (modelId?: string | null) => VIDEO_MODEL_OPTIONS.find((item) => item.id === modelId)?.tier === 'paid';
const freeScriptModel = SCRIPT_MODEL_OPTIONS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_SCRIPT_MODEL;
const freeImageModel = IMAGE_MODELS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_IMAGE_MODEL;
const freeVideoModel = VIDEO_MODEL_OPTIONS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_VIDEO_MODEL;
const VOICE_SAMPLE_MAX_SECONDS = 15;
const LOCAL_RUNTIME_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const GOOGLE_MODEL_DISABLED_REASON = 'Google AI Studio API 키를 연결하면 선택할 수 있습니다.';

function createDefaultProviderValues(): { openRouterApiKey: string; elevenLabsApiKey: string } {
  return { ...SETTINGS_DEFAULT_VALUES.providerValues };
}

function createDefaultYoutubeOAuthValues(): { googleClientId: string; googleClientSecret: string } {
  return { ...SETTINGS_DEFAULT_VALUES.youtubeOAuthValues };
}

function resolveYoutubeClientSecretPlaceholder(hasStoredSecret: boolean, secretMask?: string | null) {
  if (!hasStoredSecret) return SETTINGS_INPUT_PLACEHOLDERS.youtubeClientSecret;
  return `${secretMask || SETTINGS_INPUT_PLACEHOLDERS.youtubeStoredSecretFallback} (new value replaces current one)`;
}

function markApiLockedOptions(options: AiPickerOption[], enabled: boolean, disabledReason: string) {
  return options.map((option) => (
    option.group === 'sample' || enabled
      ? { ...option, disabled: false, disabledReason: undefined }
      : { ...option, disabled: true, disabledReason }
  ));
}

function resolveAudioPreviewSrc(value?: string | null, fallbackMime = 'audio/mpeg') {
  const normalized = `${value || ''}`.trim();
  if (!normalized) return '';
  if (
    normalized.startsWith('data:')
    || normalized.startsWith('blob:')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('/')
  ) {
    return normalized;
  }
  return `data:${fallbackMime};base64,${normalized}`;
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null);
}

function fileNameWithWavExtension(fileName?: string | null) {
  const normalized = `${fileName || 'voice-reference'}`.trim() || 'voice-reference';
  return normalized.replace(/\.[^./\\]+$/, '') + '.wav';
}

function mixAudioBufferToMono(buffer: AudioBuffer) {
  const channelCount = Math.max(1, buffer.numberOfChannels);
  const output = new Float32Array(buffer.length);
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
      output[sampleIndex] += channel[sampleIndex] / channelCount;
    }
  }
  return output;
}

function encodeMonoSamplesToWavBase64(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] || 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function readBlobAsDataUrl(blob: Blob) {
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('blob-read-failed'));
    reader.readAsDataURL(blob);
  });
  const base64 = result.includes(',') ? result.split(',')[1] || '' : '';
  return {
    base64,
    mimeType: blob.type || 'audio/webm',
  };
}

async function readAudioDurationFromBlob(blob: Blob) {
  if (typeof window === 'undefined') return 0;
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => resolve(0);
      audio.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeVoiceReferenceBlob(blob: Blob, fileName?: string | null) {
  const original = await readBlobAsDataUrl(blob);
  const originalDurationSeconds = await readAudioDurationFromBlob(blob);
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return {
      ...original,
      fileName: fileName || 'voice-reference.webm',
      durationSeconds: originalDurationSeconds,
    };
  }

  const context = new AudioContextCtor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    return {
      ...original,
      fileName: fileName || 'voice-reference.webm',
      durationSeconds: originalDurationSeconds || decoded.duration || 0,
    };
  } catch {
    return {
      ...original,
      fileName: fileName || 'voice-reference.webm',
      durationSeconds: originalDurationSeconds,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, studioState, onClose, onSave, youtubeSectionVariant = 'default' }) => {
  const [storageDir, setStorageDir] = useState<string>(SETTINGS_DEFAULT_VALUES.storageDir);
  const [pickedFolderLabel, setPickedFolderLabel] = useState('');
  const [providerValues, setProviderValues] = useState(createDefaultProviderValues);
  const [showSecrets, setShowSecrets] = useState({
    openRouterApiKey: false,
    elevenLabsApiKey: false,
    googleClientId: false,
    googleClientSecret: false,
  });
  const [youtubeOAuthValues, setYoutubeOAuthValues] = useState(createDefaultYoutubeOAuthValues);
  const [youtubeConfigState, setYoutubeConfigState] = useState({
    isLoading: false,
    hasStoredSecret: false,
    secretMask: '',
    redirectUri: '',
    source: 'missing' as 'env' | 'saved' | 'missing',
  });
  const [loadedYoutubeClientId, setLoadedYoutubeClientId] = useState<string>(SETTINGS_DEFAULT_VALUES.loadedYoutubeClientId);
  const [youtubeConnectionState, setYoutubeConnectionState] = useState<{
    isChecking: boolean;
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [youtubeFieldFeedback, setYoutubeFieldFeedback] = useState<Record<'googleClientId' | 'googleClientSecret', InlineFeedback>>({
    googleClientId: null,
    googleClientSecret: null,
  });
  const [isCheckingYoutubeFields, setIsCheckingYoutubeFields] = useState<Record<'googleClientId' | 'googleClientSecret', boolean>>({
    googleClientId: false,
    googleClientSecret: false,
  });
  const [youtubeConnectOverlay, setYoutubeConnectOverlay] = useState<{
    active: boolean;
    tone: 'info' | 'success' | 'error';
    message: string;
  }>({
    active: false,
    tone: 'info',
    message: '',
  });
  const [isYoutubeSectionOpen, setIsYoutubeSectionOpen] = useState(youtubeSectionVariant !== 'collapsed-bottom');
  const [routing, setRouting] = useState<StudioState['routing']>({
    scriptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    sceneModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    imagePromptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    motionPromptModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    openRouterMaxTokens: CONFIG.OPENROUTER_DEFAULT_MAX_TOKENS,
    openRouterInputMaxChars: CONFIG.OPENROUTER_DEFAULT_INPUT_MAX_CHARS,
    imageProvider: 'sample',
    imageModel: CONFIG.DEFAULT_IMAGE_MODEL,
    audioProvider: 'qwen3Tts',
    audioModel: 'eleven_multilingual_v2',
    ttsNarratorId: 'qwen-default',
    backgroundMusicModel: 'sample-ambient-v1',
    videoProvider: 'sample',
    videoModel: CONFIG.DEFAULT_VIDEO_MODEL,
    textModel: CONFIG.DEFAULT_SCRIPT_MODEL,
    ttsProvider: 'qwen3Tts',
    elevenLabsVoiceId: CONFIG.DEFAULT_VOICE_ID,
    elevenLabsModelId: CONFIG.DEFAULT_ELEVENLABS_MODEL,
    heygenVoiceId: null,
    chatterboxVoicePreset: 'chatterbox-clear',
    qwenVoicePreset: 'qwen-default',
    voiceReferenceAudioData: null,
    voiceReferenceMimeType: null,
    voiceReferenceName: null,
    qwenStylePreset: 'balanced',
    backgroundMusicProvider: 'sample',
    backgroundMusicStyle: 'ambient',
    musicVideoProvider: 'sample',
    musicVideoMode: 'sample',
    paidModeEnabled: false,
  });
  const [providerFeedback, setProviderFeedback] = useState<Record<string, { tone: 'success' | 'error' | 'info'; message: string } | null>>({});
  const [isCheckingProviders, setIsCheckingProviders] = useState<Record<string, boolean>>({});
  const [isVoicePreviewing, setIsVoicePreviewing] = useState(false);
  const [voicePreviewMessage, setVoicePreviewMessage] = useState('');
  const [isRecordingVoiceSample, setIsRecordingVoiceSample] = useState(false);
  const [isVoiceSampleProcessing, setIsVoiceSampleProcessing] = useState(false);
  const [voiceSampleModalOpen, setVoiceSampleModalOpen] = useState(false);
  const [voiceSampleSecondsLeft, setVoiceSampleSecondsLeft] = useState(VOICE_SAMPLE_MAX_SECONDS);
  const [isBgmPreviewing, setIsBgmPreviewing] = useState(false);
  const [bgmPreviewMessage, setBgmPreviewMessage] = useState('');
  const [ttsSelectionModalOpen, setTtsSelectionModalOpen] = useState(false);
  const [settingsPicker, setSettingsPicker] = useState<null | {
    kind: 'tts-provider' | 'tts-voice' | 'tts-model' | 'script-model' | 'prompt-model' | 'image-model' | 'video-model' | 'bgm-model';
  }>(null);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ voice_id: string; name: string; preview_url?: string; labels?: { accent?: string; gender?: string; description?: string } }>>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceRecorderStreamRef = useRef<MediaStream | null>(null);
  const voiceRecorderChunksRef = useRef<Blob[]>([]);
  const voiceRecorderStopTimerRef = useRef<number | null>(null);
  const voiceRecorderCountdownRef = useRef<number | null>(null);
  const voiceRecorderFinalizeTimerRef = useRef<number | null>(null);
  const voicePreviewKeyRef = useRef('');
  const bgmPreviewKeyRef = useRef('');
  const youtubePopupRef = useRef<Window | null>(null);
  const youtubePopupPollRef = useRef<number | null>(null);

  const visibleScriptModels = useMemo(() => SCRIPT_MODEL_OPTIONS, []);
  const visibleImageModels = useMemo(() => IMAGE_MODELS, []);
  const visibleVideoModels = useMemo(() => VIDEO_MODEL_OPTIONS, []);
  const backgroundMusicModelOptions = useMemo(() => BGM_MODEL_OPTIONS, []);

  useEffect(() => {
    if (!open || !studioState) return;
    setStorageDir(studioState.storageDir || SETTINGS_DEFAULT_VALUES.storageDir);
    setProviderValues({
      ...createDefaultProviderValues(),
      openRouterApiKey: studioState.providers.openRouterApiKey || SETTINGS_DEFAULT_VALUES.providerValues.openRouterApiKey,
      elevenLabsApiKey: studioState.providers.elevenLabsApiKey || SETTINGS_DEFAULT_VALUES.providerValues.elevenLabsApiKey,
    });
    setRouting((prev) => ({
      ...prev,
      ...studioState.routing,
      scriptModel: studioState.routing?.scriptModel || studioState.routing?.textModel || CONFIG.DEFAULT_SCRIPT_MODEL,
      textModel: studioState.routing?.textModel || studioState.routing?.scriptModel || CONFIG.DEFAULT_SCRIPT_MODEL,
      sceneModel: studioState.routing?.sceneModel || studioState.routing?.textModel || CONFIG.DEFAULT_SCRIPT_MODEL,
      imagePromptModel: studioState.routing?.imagePromptModel || studioState.routing?.sceneModel || CONFIG.DEFAULT_SCRIPT_MODEL,
      motionPromptModel: studioState.routing?.motionPromptModel || studioState.routing?.sceneModel || CONFIG.DEFAULT_SCRIPT_MODEL,
      imageModel: studioState.routing?.imageModel || CONFIG.DEFAULT_IMAGE_MODEL,
      videoModel: studioState.routing?.videoModel || CONFIG.DEFAULT_VIDEO_MODEL,
      ttsProvider: studioState.routing?.ttsProvider === 'elevenLabs' ? 'elevenLabs' : 'qwen3Tts',
      audioProvider: studioState.routing?.audioProvider === 'elevenLabs' ? 'elevenLabs' : 'qwen3Tts',
      backgroundMusicModel: normalizeBackgroundMusicModelId(studioState.routing?.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL),
      backgroundMusicProvider: resolveBackgroundMusicProvider(
        studioState.routing?.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL,
        studioState.routing?.backgroundMusicProvider || 'sample',
      ),
      musicVideoProvider: studioState.routing?.musicVideoProvider === 'elevenLabs' ? 'elevenLabs' : 'sample',
      musicVideoMode: studioState.routing?.musicVideoMode || 'sample',
      chatterboxVoicePreset: studioState.routing?.chatterboxVoicePreset || 'chatterbox-clear',
      voiceReferenceAudioData: studioState.routing?.voiceReferenceAudioData || null,
      voiceReferenceMimeType: studioState.routing?.voiceReferenceMimeType || null,
      voiceReferenceName: studioState.routing?.voiceReferenceName || null,
    }));
    setPickedFolderLabel('');
    setVoicePreviewMessage('');
    setIsVoicePreviewing(false);
    setIsRecordingVoiceSample(false);
    setIsVoiceSampleProcessing(false);
    setVoiceSampleModalOpen(false);
    setTtsSelectionModalOpen(false);
    setBgmPreviewMessage('');
    setIsBgmPreviewing(false);
    setProviderFeedback({});
    setIsCheckingProviders({});
    setYoutubeConnectionState(null);
    setYoutubeFieldFeedback({ googleClientId: null, googleClientSecret: null });
    setYoutubeConnectOverlay({ active: false, tone: 'info', message: '' });
    setIsYoutubeSectionOpen(youtubeSectionVariant !== 'collapsed-bottom');
    setShowSecrets({
      openRouterApiKey: false,
      elevenLabsApiKey: false,
      googleClientId: false,
      googleClientSecret: false,
    });
    setYoutubeOAuthValues(createDefaultYoutubeOAuthValues());
    setLoadedYoutubeClientId(SETTINGS_DEFAULT_VALUES.loadedYoutubeClientId);
    setYoutubeConfigState({
      isLoading: true,
      hasStoredSecret: false,
      secretMask: '',
      redirectUri: '',
      source: 'missing',
    });
    setYoutubeConnectionState(null);
    setYoutubeFieldFeedback({
      googleClientId: null,
      googleClientSecret: null,
    });
    setIsCheckingYoutubeFields({
      googleClientId: false,
      googleClientSecret: false,
    });

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/mp4Creater/youtube/config', { cache: 'no-store' });
        const json = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok) {
          setYoutubeOAuthValues((prev) => ({
            ...prev,
            googleClientId: typeof json?.clientId === 'string' ? json.clientId : SETTINGS_DEFAULT_VALUES.youtubeOAuthValues.googleClientId,
          }));
          setLoadedYoutubeClientId(typeof json?.clientId === 'string' ? json.clientId : SETTINGS_DEFAULT_VALUES.loadedYoutubeClientId);
          setYoutubeConfigState({
            isLoading: false,
            hasStoredSecret: Boolean(json?.clientSecretConfigured),
            secretMask: typeof json?.clientSecretMask === 'string' ? json.clientSecretMask : '',
            redirectUri: typeof json?.redirectUri === 'string' ? json.redirectUri : '',
            source: json?.source === 'env' || json?.source === 'saved' ? json.source : 'missing',
          });
          return;
        }
      } catch {}

      if (!cancelled) {
        setLoadedYoutubeClientId(SETTINGS_DEFAULT_VALUES.loadedYoutubeClientId);
        setYoutubeConfigState({
          isLoading: false,
          hasStoredSecret: false,
          secretMask: '',
          redirectUri: '',
          source: 'missing',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, studioState]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const eleven = await fetchElevenLabsVoices(providerValues.elevenLabsApiKey.trim() || undefined);
        if (cancelled) return;
        setElevenLabsVoices(eleven);
        setRouting((prev) => ({
          ...prev,
          elevenLabsVoiceId: prev.elevenLabsVoiceId || eleven[0]?.voice_id || CONFIG.DEFAULT_VOICE_ID,
        }));
      } finally {
        if (!cancelled) setIsLoadingVoices(false);
      }
    };

    void loadVoices();
    return () => {
      cancelled = true;
    };
  }, [open, providerValues.elevenLabsApiKey]);

  const selectedElevenVoice = useMemo(
    () => elevenLabsVoices.find((item) => item.voice_id === (routing.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID)) || elevenLabsVoices[0] || null,
    [elevenLabsVoices, routing.elevenLabsVoiceId],
  );

  const selectedQwenVoice = useMemo(
    () => QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === (routing.qwenVoicePreset || 'qwen-default')) || QWEN_TTS_PRESET_OPTIONS[0],
    [routing.qwenVoicePreset],
  );
  const hasGoogleApiKey = Boolean(resolveGoogleAiStudioApiKey(providerValues.openRouterApiKey.trim()));
  const hasElevenLabsApiKey = Boolean(providerValues.elevenLabsApiKey.trim());
  const hasAnyConnectedApi = hasGoogleApiKey || hasElevenLabsApiKey;
  const visibleTtsProvider = routing.ttsProvider === 'elevenLabs' && hasElevenLabsApiKey
    ? 'elevenLabs'
    : 'qwen3Tts';
  const scriptPickerOptions = useMemo(
    () => markApiLockedOptions(
      getScriptModelPickerOptions(false).filter((item) => visibleScriptModels.some((model) => model.id === item.id)),
      hasGoogleApiKey,
      GOOGLE_MODEL_DISABLED_REASON,
    ),
    [hasGoogleApiKey, visibleScriptModels],
  );
  const imagePickerOptions = useMemo(
    () => markApiLockedOptions(
      getImageModelPickerOptions().filter((item) => visibleImageModels.some((model) => model.id === item.id)),
      hasGoogleApiKey,
      GOOGLE_MODEL_DISABLED_REASON,
    ),
    [hasGoogleApiKey, visibleImageModels],
  );
  const videoPickerOptions = useMemo(
    () => markApiLockedOptions(
      getVideoModelPickerOptions().filter((item) => visibleVideoModels.some((model) => model.id === item.id)),
      hasGoogleApiKey,
      GOOGLE_MODEL_DISABLED_REASON,
    ),
    [hasGoogleApiKey, visibleVideoModels],
  );
  /* const legacyBackgroundMusicPickerOptions = useMemo<AiPickerOption[]>(() => (
    backgroundMusicModelOptions.map((item) => {
      const isElevenLabsMusic = item.id === 'elevenlabs-music-auto';
      const isGoogleMusic = isGoogleBgmModel(item.id);
      return {
        id: item.id,
        title: item.name,
        provider: isGoogleMusic ? 'Google AI Studio' : isElevenLabsMusic ? 'ElevenLabs' : 'Sample',
        description: isElevenLabsMusic
          ? 'ElevenLabs 기반 배경음 생성 경로입니다. API가 연결되어 있으면 프로젝트 기본 배경음 모델로 바로 사용할 수 있습니다.'
          : 'API 없이도 바로 테스트할 수 있는 기본 배경음 샘플입니다. 콘셉트 방향만 빠르게 맞출 때 좋습니다.',
        badge: isElevenLabsMusic ? '유료' : '무료',
        priceLabel: isElevenLabsMusic ? '보통' : '무료',
        qualityLabel: isElevenLabsMusic ? 'AI 생성' : '샘플',
        speedLabel: isElevenLabsMusic ? '보통' : '즉시',
        helper: isElevenLabsMusic ? 'ElevenLabs API 연결 시 사용 가능' : '즉시 미리듣기 가능',
        avatarLabel: isElevenLabsMusic ? '11' : 'BG',
        tone: isElevenLabsMusic ? 'amber' : 'slate',
        group: isElevenLabsMusic ? 'premium' : 'sample',
        tier: isElevenLabsMusic ? 'paid' : 'free',
        disabled: isElevenLabsMusic && !hasElevenLabsApiKey,
        disabledReason: isElevenLabsMusic && !hasElevenLabsApiKey
          ? 'ElevenLabs API를 연결하면 선택할 수 있습니다.'
          : undefined,
      } satisfies AiPickerOption;
    })
  ), [hasElevenLabsApiKey]);
  */
  /* const backgroundMusicPickerOptions = useMemo<AiPickerOption[]>(() => (
    backgroundMusicModelOptions.map((item) => {
      const isElevenLabsMusic = item.id === 'elevenlabs-music-auto';
      const isGoogleMusic = isGoogleBgmModel(item.id);
      return {
        id: item.id,
        title: item.name,
        provider: isGoogleMusic ? 'Google AI Studio' : isElevenLabsMusic ? 'ElevenLabs' : 'Sample',
        description: isGoogleMusic
          ? 'Google AI Studio가 연결되어 있으면 기본 배경음 모델로 선택할 수 있습니다.'
          : isElevenLabsMusic
            ? 'ElevenLabs 연결 시 프롬프트 기반 배경음 모델로 사용할 수 있습니다.'
            : 'API 없이 바로 확인할 수 있는 기본 샘플 배경음입니다.',
        badge: isGoogleMusic ? 'Google AI' : isElevenLabsMusic ? '유료' : '무료',
        priceLabel: isGoogleMusic || isElevenLabsMusic ? '보통' : '무료',
        qualityLabel: isGoogleMusic || isElevenLabsMusic ? 'AI 생성' : '샘플',
        speedLabel: isGoogleMusic || isElevenLabsMusic ? '보통' : '즉시',
        helper: isGoogleMusic ? 'Google API 연결 후 선택 가능' : isElevenLabsMusic ? 'ElevenLabs API 연결 후 선택 가능' : '즉시 미리듣기 가능',
          ? 'Google API 연결 후 선택 가능'
          : isElevenLabsMusic
            ? 'ElevenLabs API 연결 후 선택 가능'
            : '즉시 미리듣기 가능',
        avatarLabel: isGoogleMusic ? 'G' : isElevenLabsMusic ? '11' : 'BG',
        tone: isGoogleMusic ? 'blue' : isElevenLabsMusic ? 'amber' : 'slate',
        group: isGoogleMusic || isElevenLabsMusic ? 'premium' : 'sample',
        tier: isGoogleMusic || isElevenLabsMusic ? 'paid' : 'free',
        disabled: isGoogleMusic ? !hasGoogleApiKey : isElevenLabsMusic ? !hasElevenLabsApiKey : false,
        disabledReason: isGoogleMusic
          ? (!hasGoogleApiKey ? 'Google AI Studio API를 연결하면 선택할 수 있습니다.' : undefined)
          : isElevenLabsMusic
            ? (!hasElevenLabsApiKey ? 'ElevenLabs API를 연결하면 선택할 수 있습니다.' : undefined)
            : undefined,
      } satisfies AiPickerOption;
    })
  ), [backgroundMusicModelOptions, hasElevenLabsApiKey, hasGoogleApiKey]);
  */
  const backgroundMusicPickerOptions = useMemo<AiPickerOption[]>(
    () => getBackgroundMusicPickerOptions({ hasGoogleApiKey }),
    [hasGoogleApiKey],
  );
  const ttsProviderPickerOptions = useMemo(
    () => getTtsProviderPickerOptions().filter((item) => {
      if (item.id === 'heygen') return false;
      if (item.id === 'chatterbox') return false;
      if (item.id === 'elevenLabs') return hasElevenLabsApiKey;
      return true;
    }),
    [hasElevenLabsApiKey],
  );
  const ttsVoicePickerOptions = useMemo<AiPickerOption[]>(() => {
    if (routing.ttsProvider === 'elevenLabs') {
      return hasElevenLabsApiKey ? getElevenLabsVoicePickerOptions(elevenLabsVoices) : [];
    }
    if (routing.ttsProvider === 'heygen') return [];
    return getQwenVoicePickerOptions();
  }, [elevenLabsVoices, hasElevenLabsApiKey, routing.ttsProvider]);
  const ttsModelPickerOptions = useMemo(
    () => (hasElevenLabsApiKey ? getElevenLabsModelPickerOptions() : []),
    [hasElevenLabsApiKey],
  );
  const selectedElevenModel = useMemo(
    () => ttsModelPickerOptions.find((item) => item.id === (routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL)) || ttsModelPickerOptions[0] || null,
    [routing.audioModel, routing.elevenLabsModelId, ttsModelPickerOptions],
  );
  const ttsProviderPickerCurrentId = useMemo(() => {
    const availableProviderIds = new Set(ttsProviderPickerOptions.map((item) => item.id));
    const currentProvider = routing.ttsProvider || 'qwen3Tts';
    if (availableProviderIds.has(currentProvider)) return currentProvider;
    if (availableProviderIds.has('qwen3Tts')) return 'qwen3Tts';
    return ttsProviderPickerOptions[0]?.id || '';
  }, [routing.ttsProvider, ttsProviderPickerOptions]);
  const queueSettingsPicker = useCallback((kind: 'tts-provider' | 'tts-voice' | 'tts-model' | 'script-model' | 'prompt-model' | 'image-model' | 'video-model' | 'bgm-model') => {
    window.setTimeout(() => setSettingsPicker({ kind }), 0);
  }, []);
  const previewSettingsTtsOption = useCallback(async (id: string) => {
    if (!settingsPicker || !settingsPicker.kind.startsWith('tts-')) return null;

    const provider = settingsPicker.kind === 'tts-provider'
      ? id as 'qwen3Tts' | 'elevenLabs'
      : ((routing.ttsProvider === 'elevenLabs' ? 'elevenLabs' : 'qwen3Tts') as 'qwen3Tts' | 'elevenLabs');

    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    if (provider === 'elevenLabs' && !elevenLabsApiKey) return null;

    const resolvedVoiceId = provider === 'elevenLabs'
      ? (settingsPicker.kind === 'tts-voice'
          ? id
          : (routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID))
      : (settingsPicker.kind === 'tts-voice' ? id : (routing.qwenVoicePreset || 'qwen-default'));

    const resolvedModelId = provider === 'elevenLabs'
      ? (settingsPicker.kind === 'tts-model' ? id : (routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL))
      : (routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL);

    const resolvedPreset = settingsPicker.kind === 'tts-voice' && provider === 'qwen3Tts'
      ? id
      : (routing.qwenVoicePreset || 'qwen-default');

    const { asset } = await createTtsPreview({
      provider,
      title: 'Settings voice preview',
      text: '안녕하세요. 지금 선택한 음성과 모델의 미리듣기를 확인하고 있습니다.',
      mode: 'voice-preview',
      apiKey: elevenLabsApiKey,
      googleApiKey: providerValues.openRouterApiKey.trim(),
      voiceId: resolvedVoiceId,
      modelId: resolvedModelId,
      qwenPreset: resolvedPreset,
      locale: 'ko',
      voiceReferenceAudioData: null,
      voiceReferenceMimeType: null,
    });

    if (!asset.audioData) return null;
    return asset.audioData.startsWith('data:')
      ? asset.audioData
      : `data:audio/mpeg;base64,${asset.audioData}`;
  }, [
    providerValues.elevenLabsApiKey,
    routing.audioModel,
    routing.chatterboxVoicePreset,
    routing.elevenLabsModelId,
    routing.elevenLabsVoiceId,
    routing.qwenVoicePreset,
    routing.ttsProvider,
    routing.voiceReferenceAudioData,
    routing.voiceReferenceMimeType,
    selectedElevenVoice?.voice_id,
    settingsPicker,
  ]);
  const recordedVoiceSampleUrl = useMemo(() => {
    if (!routing.voiceReferenceAudioData || !routing.voiceReferenceMimeType) return '';
    return `data:${routing.voiceReferenceMimeType};base64,${routing.voiceReferenceAudioData}`;
  }, [routing.voiceReferenceAudioData, routing.voiceReferenceMimeType]);
  const clearRecordedVoiceSample = useCallback(() => {
    setRouting((prev) => ({
      ...prev,
      voiceReferenceAudioData: null,
      voiceReferenceMimeType: null,
      voiceReferenceName: null,
      chatterboxVoicePreset: prev.chatterboxVoicePreset === CHATTERBOX_CUSTOM_VOICE_ID ? 'chatterbox-clear' : prev.chatterboxVoicePreset,
      ttsNarratorId: prev.ttsNarratorId === CHATTERBOX_CUSTOM_VOICE_ID ? 'chatterbox-clear' : prev.ttsNarratorId,
    }));
  }, []);
  const stopVoicePreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      previewUtteranceRef.current = null;
    }
    setIsVoicePreviewing(false);
    setVoicePreviewMessage('미리 듣기를 정지했습니다.');
  }, []);
  const playRecordedVoiceSample = useCallback(async () => {
    if (!recordedVoiceSampleUrl) {
      setVoicePreviewMessage('저장된 목소리 샘플이 없습니다. 먼저 녹음해 주세요.');
      return;
    }
    stopVoicePreview();
    setIsVoicePreviewing(true);
    const audio = new Audio(recordedVoiceSampleUrl);
    previewAudioRef.current = audio;
    audio.onended = () => {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('저장된 목소리 샘플 재생이 끝났습니다.');
    };
    audio.onerror = () => {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('저장된 목소리 샘플 재생에 실패했습니다.');
    };
    await audio.play().catch(() => {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('저장된 목소리 샘플 재생에 실패했습니다.');
    });
    setVoicePreviewMessage(`저장된 목소리 샘플 (${routing.voiceReferenceName || 'recorded-voice.webm'}) 재생 중입니다.`);
  }, [recordedVoiceSampleUrl, routing.voiceReferenceName, stopVoicePreview]);
  const ttsVoiceExtraPanel = null;
  const activeSettingsPicker = useMemo<SettingsPickerConfig | null>(() => {
    if (!settingsPicker) return null;
    if (settingsPicker.kind === 'tts-provider') {
      return {
        title: '기본 TTS 모델 선택',
        description: '먼저 사용할 TTS 모델 계열을 고르세요. 선택 후 다음 단계에서 최종 목소리를 따로 정합니다.',
        currentId: ttsProviderPickerCurrentId,
        options: ttsProviderPickerOptions,
        onSelect: (id: string) => {
          setRouting((prev) => ({ ...prev, ttsProvider: id as 'qwen3Tts' | 'elevenLabs', audioProvider: id as 'qwen3Tts' | 'elevenLabs' }));
          queueSettingsPicker(id === 'elevenLabs' ? 'tts-model' : 'tts-voice');
        },
        requireConfirm: true,
        confirmLabel: '이 모델 계열 선택하기',
        emptyMessage: '지금 바로 사용할 수 있는 TTS 모델 계열이 없습니다. API 연결이나 무료 모델 상태를 확인해 주세요.',
      };
    }
    if (settingsPicker.kind === 'tts-voice') {
      return {
        title: routing.ttsProvider === 'elevenLabs'
          ? `${selectedElevenModel?.title || 'ElevenLabs'} 음성 선택`
          : 'Gemini TTS 음성 선택',
        description: routing.ttsProvider === 'elevenLabs'
          ? '선택한 ElevenLabs 모델 안에서 사용할 최종 목소리를 고르세요. 모델만 선택해도 목소리는 아직 정해지지 않습니다.'
          : '이 단계에서 최종 목소리를 고르세요. 카드 설명과 미리듣기를 보고 확정하면 기본 TTS 목소리로 저장됩니다.',
        currentId: routing.ttsProvider === 'elevenLabs'
          ? (routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID)
          : (routing.qwenVoicePreset || 'qwen-default'),
        options: ttsVoicePickerOptions,
        onSelect: (id: string) => {
          if (routing.ttsProvider === 'elevenLabs') {
            setRouting((prev) => ({ ...prev, elevenLabsVoiceId: id }));
            return;
          }
          setRouting((prev) => ({ ...prev, qwenVoicePreset: id, ttsNarratorId: id }));
        },
        requireConfirm: true,
        confirmLabel: '이 목소리로 설정하기',
        emptyMessage: routing.ttsProvider === 'elevenLabs'
          ? '연결된 ElevenLabs 모델에서 고를 수 있는 목소리가 아직 없습니다. API 연결과 음성 목록을 확인해 주세요.'
          : '선택할 수 있는 목소리가 아직 없습니다.',
        onPreviewOption: previewSettingsTtsOption,
      };
    }
    if (settingsPicker.kind === 'tts-model') {
      return {
        title: 'ElevenLabs 모델 선택',
        description: '모델마다 속도와 표현력이 다릅니다. 여기서는 목소리가 아직 정해지지 않고, 확인 후 다음 화면에서 최종 목소리를 고릅니다.',
        currentId: routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
        options: ttsModelPickerOptions,
        onSelect: (id: string) => {
          setRouting((prev) => ({ ...prev, elevenLabsModelId: id, audioModel: id }));
          queueSettingsPicker('tts-voice');
        },
        requireConfirm: true,
        confirmLabel: '이 모델 선택하기',
        emptyMessage: 'ElevenLabs API를 연결하면 선택 가능한 유료 TTS 모델이 여기에 표시됩니다.',
      };
    }
    if (settingsPicker.kind === 'script-model') {
      return {
        title: '대본 생성 모델',
        description: 'Step3 대본 생성에 사용할 기본 모델입니다. 카드를 고른 뒤 확인하면 저장됩니다.',
        currentId: routing.scriptModel || routing.textModel || CONFIG.DEFAULT_SCRIPT_MODEL,
        options: scriptPickerOptions,
        onSelect: (id: string) => setRouting((prev) => ({ ...prev, scriptModel: id, textModel: id })),
        requireConfirm: true,
        confirmLabel: '이 모델 선택하기',
      };
    }
    if (settingsPicker.kind === 'prompt-model') {
      return {
        title: '프롬프트 생성 모델',
        description: '씬, 이미지 프롬프트, 모션 프롬프트를 만들 때 사용할 기본 모델입니다.',
        currentId: routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || CONFIG.DEFAULT_SCRIPT_MODEL,
        options: scriptPickerOptions,
        onSelect: (id: string) => setRouting((prev) => ({ ...prev, sceneModel: id, imagePromptModel: id, motionPromptModel: id })),
        requireConfirm: true,
        confirmLabel: '이 모델 선택하기',
      };
    }
    if (settingsPicker.kind === 'image-model') {
      return {
        title: '이미지 생성 모델',
        description: '이미지 품질, 속도, 비용 단계를 비교한 뒤 확인하면 저장됩니다.',
        currentId: routing.imageModel || CONFIG.DEFAULT_IMAGE_MODEL,
        options: imagePickerOptions,
        onSelect: (id: string) => setRouting((prev) => ({ ...prev, imageModel: id, imageProvider: id === freeImageModel ? 'sample' : 'openrouter' })),
        requireConfirm: true,
        confirmLabel: '이 모델 선택하기',
      };
    }
    if (settingsPicker.kind === 'bgm-model') {
      return {
        title: '배경 음악 모델',
        description: '프로젝트 기본 배경음 생성에 사용할 모델을 고르세요. Lyria 3는 Google AI Studio가 연결되어 있으면 바로 실생성에 쓰고, 실패 시에는 샘플 배경음으로만 안전하게 대체합니다.',
        currentId: routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL,
        options: backgroundMusicPickerOptions,
        onSelect: (id: string) => setRouting((prev) => ({
          ...prev,
          backgroundMusicModel: normalizeBackgroundMusicModelId(id),
          backgroundMusicProvider: resolveBackgroundMusicProvider(id, prev.backgroundMusicProvider || 'sample'),
        })),
        requireConfirm: true,
        confirmLabel: '이 배경음 모델 선택하기',
        emptyMessage: '사용 가능한 배경음 모델이 없습니다.',
      };
    }
    return {
      title: '영상 생성 모델',
      description: '영상 품질과 비용 단계를 비교한 뒤 확인하면 저장됩니다.',
      currentId: routing.videoModel || CONFIG.DEFAULT_VIDEO_MODEL,
      options: videoPickerOptions,
      onSelect: (id: string) => setRouting((prev) => ({ ...prev, videoModel: id, videoProvider: id === freeVideoModel ? 'sample' : 'elevenLabs' })),
      requireConfirm: true,
      confirmLabel: '이 모델 선택하기',
    };
  }, [
    settingsPicker,
    routing.ttsProvider,
    routing.elevenLabsVoiceId,
    routing.chatterboxVoicePreset,
    routing.qwenVoicePreset,
    routing.elevenLabsModelId,
    routing.audioModel,
    routing.scriptModel,
    routing.textModel,
    routing.sceneModel,
    routing.imagePromptModel,
    routing.motionPromptModel,
    routing.imageModel,
    routing.videoModel,
    routing.backgroundMusicModel,
    ttsProviderPickerOptions,
    ttsVoicePickerOptions,
    ttsModelPickerOptions,
    scriptPickerOptions,
    imagePickerOptions,
    videoPickerOptions,
    backgroundMusicPickerOptions,
    previewSettingsTtsOption,
    queueSettingsPicker,
    recordedVoiceSampleUrl,
    selectedElevenModel?.title,
    selectedElevenVoice?.voice_id,
    ttsProviderPickerCurrentId,
    ttsVoiceExtraPanel,
  ]);

  const clearVoiceRecorderTimers = useCallback(() => {
    if (voiceRecorderStopTimerRef.current !== null) {
      window.clearTimeout(voiceRecorderStopTimerRef.current);
      voiceRecorderStopTimerRef.current = null;
    }
    if (voiceRecorderCountdownRef.current !== null) {
      window.clearInterval(voiceRecorderCountdownRef.current);
      voiceRecorderCountdownRef.current = null;
    }
    if (voiceRecorderFinalizeTimerRef.current !== null) {
      window.clearTimeout(voiceRecorderFinalizeTimerRef.current);
      voiceRecorderFinalizeTimerRef.current = null;
    }
    setVoiceSampleSecondsLeft(VOICE_SAMPLE_MAX_SECONDS);
  }, []);

  const stopVoiceRecorderStream = useCallback(() => {
    clearVoiceRecorderTimers();
    voiceRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceRecorderStreamRef.current = null;
    voiceRecorderRef.current = null;
    voiceRecorderChunksRef.current = [];
    setIsRecordingVoiceSample(false);
  }, [clearVoiceRecorderTimers]);

  const finalizeVoiceRecorderStop = useCallback((message?: string) => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (message) setVoicePreviewMessage(message);
    recorder.requestData?.();
    if (voiceRecorderFinalizeTimerRef.current !== null) {
      window.clearTimeout(voiceRecorderFinalizeTimerRef.current);
    }
    voiceRecorderFinalizeTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, 180);
  }, []);

  const closeVoiceSampleModal = useCallback(() => {
    stopVoiceRecorderStream();
    setVoiceSampleModalOpen(false);
  }, [stopVoiceRecorderStream]);

  const persistVoiceReferenceBlob = useCallback(async (blob: Blob, fileName?: string | null) => {
    setIsVoiceSampleProcessing(true);
    setVoicePreviewMessage('목소리 샘플을 정리하고 있습니다. 처음 등록할 때는 잠시만 기다려 주세요.');
    try {
      const normalized = await normalizeVoiceReferenceBlob(blob, fileName);
      if (normalized.durationSeconds > VOICE_SAMPLE_MAX_SECONDS + 0.1) {
        setVoicePreviewMessage(`목소리 파일은 ${VOICE_SAMPLE_MAX_SECONDS}초 이하만 등록할 수 있습니다. 현재 파일은 약 ${Math.ceil(normalized.durationSeconds)}초입니다.`);
        return false;
      }
      setRouting((prev) => ({
        ...prev,
        voiceReferenceAudioData: normalized.base64 || null,
        voiceReferenceMimeType: normalized.mimeType || blob.type || 'audio/webm',
        voiceReferenceName: normalized.fileName || fileName || 'voice-reference.webm',
        chatterboxVoicePreset: prev.ttsProvider === 'chatterbox' ? CHATTERBOX_CUSTOM_VOICE_ID : prev.chatterboxVoicePreset,
        ttsNarratorId: prev.ttsProvider === 'chatterbox' ? CHATTERBOX_CUSTOM_VOICE_ID : prev.ttsNarratorId,
      }));
      closeVoiceSampleModal();
      setVoicePreviewMessage(`${normalized.fileName || fileName || 'voice-reference.webm'} 샘플을 저장했습니다. Chatterbox에서 맞춤 목소리로 바로 선택할 수 있습니다.`);
      return true;
    } catch {
      setVoicePreviewMessage('목소리 샘플 저장에 실패했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      setIsVoiceSampleProcessing(false);
    }
  }, [closeVoiceSampleModal]);

  const stopBgmPreview = useCallback(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
      bgmAudioRef.current = null;
    }
    setIsBgmPreviewing(false);
    setBgmPreviewMessage('배경 음악 미리 듣기를 정지했습니다.');
  }, []);

  const playVoicePreview = useCallback(async () => {
    const provider = visibleTtsProvider === 'elevenLabs'
      ? 'elevenLabs'
      : 'qwen3Tts';
    const voicePreviewKey = [
      provider,
      routing.qwenVoicePreset || 'qwen-default',
      routing.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID,
      routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
    ].join('|');

    if (isVoicePreviewing && voicePreviewKeyRef.current === voicePreviewKey) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();
    voicePreviewKeyRef.current = voicePreviewKey;
    setIsVoicePreviewing(true);
    setVoicePreviewMessage('음성 미리듣기를 준비하고 있습니다. 잠시만 기다려 주세요.');

    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    const googleApiKey = resolveGoogleAiStudioApiKey(providerValues.openRouterApiKey.trim());
    const resolvedVoiceId = provider === 'elevenLabs'
      ? (routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID)
      : (routing.qwenVoicePreset || 'qwen-default');

    if (provider === 'elevenLabs' && !elevenLabsApiKey) {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('ElevenLabs API가 연결되지 않았습니다. 먼저 API 키를 설정해 주세요.');
      return;
    }

    if (provider === 'qwen3Tts' && !googleApiKey) {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('이 브라우저에서는 음성 미리듣기를 지원하지 않습니다.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance('안녕하세요. 지금 선택한 목소리를 확인하고 있습니다.');
      utterance.lang = 'ko-KR';
      utterance.rate = 1;
      utterance.pitch = resolvedVoiceId === 'qwen-soft' ? 1.08 : 0.96;
      const voices = window.speechSynthesis.getVoices();
      const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('ko'));
      const preferredVoice = resolvedVoiceId === 'qwen-soft'
        ? (koreanVoices.find((voice) => /female|woman|yuna|sunhi/i.test(`${voice.name} ${voice.voiceURI}`)) || koreanVoices[0])
        : (koreanVoices.find((voice) => /male|man|inho|hyunsu/i.test(`${voice.name} ${voice.voiceURI}`)) || koreanVoices[0]);
      if (preferredVoice) utterance.voice = preferredVoice;
      previewUtteranceRef.current = utterance;
      utterance.onend = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 재생이 끝났습니다.');
      };
      utterance.onerror = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 재생에 실패했습니다.');
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setVoicePreviewMessage('Gemini 2.5 Flash Preview TTS 음성을 브라우저 음성으로 미리 재생 중입니다.');
      return;
    }

    try {
      const { asset } = await createTtsPreview({
        provider,
        title: '기본 TTS 미리듣기',
        text: '안녕하세요. 지금 선택한 목소리를 확인하고 있습니다.',
        mode: 'voice-preview',
        apiKey: elevenLabsApiKey,
        googleApiKey,
        voiceId: resolvedVoiceId,
        modelId: routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
        qwenPreset: routing.qwenVoicePreset || 'qwen-default',
        locale: 'ko',
        voiceReferenceAudioData: null,
        voiceReferenceMimeType: null,
      });

      const audioSrc = resolveAudioPreviewSrc(asset.audioData, 'audio/mpeg');
      if (!audioSrc) {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 데이터를 준비하지 못했습니다.');
        return;
      }
      const audio = new Audio(audioSrc);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 재생이 끝났습니다.');
      };
      audio.onerror = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 재생에 실패했습니다. 다시 시도하거나 다른 목소리를 선택해 주세요.');
      };
      await audio.play();

      if (provider === 'qwen3Tts') {
        setVoicePreviewMessage('Gemini 2.5 Flash Preview TTS 음성을 재생 중입니다.');
        return;
      }

      setVoicePreviewMessage(`ElevenLabs (${selectedElevenVoice?.name || asset.voiceId || '기본 보이스'}) 음성을 재생 중입니다.`);
    } catch {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('음성 재생에 실패했습니다. 다시 시도하거나 API 연결 상태를 확인해 주세요.');
    }
  }, [
    isVoicePreviewing,
    providerValues.elevenLabsApiKey,
    providerValues.openRouterApiKey,
    recordedVoiceSampleUrl,
    routing,
    selectedElevenVoice,
    stopVoicePreview,
    visibleTtsProvider,
  ]);

  const handleToggleVoiceSampleRecording = useCallback(async () => {
    if (isRecordingVoiceSample && voiceRecorderRef.current) {
      finalizeVoiceRecorderStop('녹음을 정리하고 있습니다. 마지막 구간까지 저장한 뒤 샘플에 반영합니다.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoicePreviewMessage('이 브라우저에서는 마이크 녹음을 지원하지 않습니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredMimeTypes.find((item) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(item)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      voiceRecorderStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceRecorderChunksRef.current = [];
      clearVoiceRecorderTimers();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceRecorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (!voiceRecorderChunksRef.current.length) {
          stopVoiceRecorderStream();
          setVoicePreviewMessage('녹음된 샘플을 찾지 못했습니다. 다시 시도해 주세요.');
          return;
        }
        const blob = new Blob(voiceRecorderChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        void persistVoiceReferenceBlob(
          blob,
          `voice-reference.${(blob.type || recorder.mimeType || mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'}`,
        ).finally(() => {
          stopVoiceRecorderStream();
        });
      };

      recorder.start(250);
      setIsRecordingVoiceSample(true);
      setVoiceSampleSecondsLeft(VOICE_SAMPLE_MAX_SECONDS);
      setVoicePreviewMessage('녹음 중입니다. 15초 안에서 또렷하게 읽으면 자동 저장됩니다.');

      voiceRecorderStopTimerRef.current = window.setTimeout(() => {
        if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
          finalizeVoiceRecorderStop('녹음 시간을 다 채워 샘플을 저장하고 있습니다.');
        }
      }, VOICE_SAMPLE_MAX_SECONDS * 1000);

      const startedAt = Date.now();
      voiceRecorderCountdownRef.current = window.setInterval(() => {
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const nextLeft = Math.max(0, Math.ceil(VOICE_SAMPLE_MAX_SECONDS - elapsedSeconds));
        setVoiceSampleSecondsLeft(nextLeft);
      }, 250);
    } catch {
      stopVoiceRecorderStream();
      setVoicePreviewMessage('마이크 권한을 확인한 뒤 다시 시도해 주세요.');
    }
  }, [clearVoiceRecorderTimers, finalizeVoiceRecorderStop, isRecordingVoiceSample, persistVoiceReferenceBlob, stopVoiceRecorderStream]);

  const handleVoiceSampleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
        audio.onerror = () => reject(new Error('오디오 길이를 읽지 못했습니다.'));
        audio.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      if (duration > VOICE_SAMPLE_MAX_SECONDS) {
        setVoicePreviewMessage(`목소리 파일은 ${VOICE_SAMPLE_MAX_SECONDS}초 이하만 등록할 수 있습니다. 현재 파일은 약 ${Math.ceil(duration)}초입니다.`);
        return;
      }

      await persistVoiceReferenceBlob(file, file.name);
      return;

      /* const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] || '' : '';
        setRouting((prev) => ({
          ...prev,
          voiceReferenceAudioData: base64 || null,
          voiceReferenceMimeType: file.type || 'audio/webm',
          voiceReferenceName: file.name,
        }));
        if (base64) {
          closeVoiceSampleModal();
        }
        setVoicePreviewMessage(base64 ? `${file.name} 파일을 목소리 샘플로 저장했습니다.` : '목소리 파일 저장에 실패했습니다.');
      };
      reader.readAsDataURL(file); */
    } catch {
      setVoicePreviewMessage('목소리 파일을 불러오지 못했습니다. 다른 파일로 다시 시도해 주세요.');
    }
  }, [closeVoiceSampleModal]);
  const playBgmPreview = useCallback(async () => {
    const normalizedBackgroundMusicModel = normalizeBackgroundMusicModelId(
      routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL,
    );
    const bgmPreviewKey = [
      resolveBackgroundMusicProvider(normalizedBackgroundMusicModel, routing.backgroundMusicProvider || 'sample'),
      normalizedBackgroundMusicModel,
    ].join('|');

    if (isBgmPreviewing && bgmPreviewKeyRef.current === bgmPreviewKey) {
      stopBgmPreview();
      return;
    }

    stopBgmPreview();
    bgmPreviewKeyRef.current = bgmPreviewKey;
    setIsBgmPreviewing(true);
    setBgmPreviewMessage('배경 음악 미리 듣기를 준비 중입니다.');

    try {
      const previewTrack = await createBackgroundMusicTrack({
        draft: {
          id: 'settings-preview',
          version: 1,
          contentType: 'story',
          outputMode: 'video',
          topic: '?? ?? ??',
          script: '?? ?? ?? ??',
          aspectRatio: '16:9',
          activeStage: 'draft',
          completedSteps: { step1: true, step2: true, step3: true, step4: true },
          selections: {
            mood: routing.backgroundMusicModel?.includes('news')
              ? 'news'
              : routing.backgroundMusicModel?.includes('cinematic')
                ? 'cinematic'
                : 'ambient',
          },
          promptTemplates: [],
          selectedPromptTemplateId: null,
          selectedCharacterIds: [],
          selectedStyleImageId: null,
          extractedCharacters: [],
          styleImages: [],
          updatedAt: Date.now(),
        } as any,
        modelId: normalizedBackgroundMusicModel,
        mode: 'preview',
        provider: resolveBackgroundMusicProvider(normalizedBackgroundMusicModel, routing.backgroundMusicProvider || 'sample'),
        googleApiKey: providerValues.openRouterApiKey.trim(),
        durationSeconds: 20,
        title: 'Settings background music preview',
      });

      const audioSrc = resolveAudioPreviewSrc(previewTrack.audioData, 'audio/wav');
      if (!audioSrc) {
        setIsBgmPreviewing(false);
        setBgmPreviewMessage('배경 음악 샘플을 준비하지 못했습니다.');
        return;
      }
      const audio = new Audio(audioSrc);
      audio.loop = Boolean(previewTrack.sourceMode === 'sample');
      bgmAudioRef.current = audio;
      audio.onended = () => {
        setIsBgmPreviewing(false);
        setBgmPreviewMessage(`배경 음악 (${normalizedBackgroundMusicModel}) 미리 듣기가 끝났습니다.`);
      };
      audio.onerror = () => {
        setIsBgmPreviewing(false);
        setBgmPreviewMessage('배경 음악 미리 듣기에 실패했습니다.');
      };
      await audio.play();
      setBgmPreviewMessage(`배경 음악 (${normalizedBackgroundMusicModel}) 미리 듣기 중입니다.`);
    } catch {
      setIsBgmPreviewing(false);
      setBgmPreviewMessage('배경 음악 미리 듣기에 실패했습니다.');
    }
  }, [isBgmPreviewing, providerValues.openRouterApiKey, routing.backgroundMusicModel, routing.backgroundMusicProvider, stopBgmPreview]);

  useEffect(() => {
    if (!open) {
      stopVoicePreview();
      stopBgmPreview();
      stopVoiceRecorderStream();
    }
  }, [open, stopVoicePreview, stopBgmPreview, stopVoiceRecorderStream]);


  const refreshYoutubeConfigState = useCallback(async () => {
    const response = await fetch('/api/mp4Creater/youtube/config', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.error || '유튜브 OAuth 설정을 불러오지 못했습니다.');
    }

    setYoutubeOAuthValues((prev) => ({
      ...prev,
      googleClientId: typeof json?.clientId === 'string' ? json.clientId : SETTINGS_DEFAULT_VALUES.youtubeOAuthValues.googleClientId,
      googleClientSecret: SETTINGS_DEFAULT_VALUES.youtubeOAuthValues.googleClientSecret,
    }));
    setLoadedYoutubeClientId(typeof json?.clientId === 'string' ? json.clientId : SETTINGS_DEFAULT_VALUES.loadedYoutubeClientId);
    setYoutubeConfigState({
      isLoading: false,
      hasStoredSecret: Boolean(json?.clientSecretConfigured),
      secretMask: typeof json?.clientSecretMask === 'string' ? json.clientSecretMask : '',
      redirectUri: typeof json?.redirectUri === 'string' ? json.redirectUri : '',
      source: json?.source === 'env' || json?.source === 'saved' ? json.source : 'missing',
    });
    return json;
  }, []);

  const closeDrawerCleanly = useCallback(() => {
    stopVoicePreview();
    stopBgmPreview();
    stopVoiceRecorderStream();
    setVoiceSampleModalOpen(false);
    if (typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
    }
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        onClose();
      });
      return;
    }
    onClose();
  }, [onClose, stopBgmPreview, stopVoicePreview, stopVoiceRecorderStream]);

  const persistYoutubeConfigFromInputs = useCallback(async (options?: { requireClientIdWithSecret?: boolean }) => {
    const googleClientId = youtubeOAuthValues.googleClientId.trim();
    const googleClientSecret = youtubeOAuthValues.googleClientSecret.trim();
    const hasYoutubeInput = Boolean(googleClientId) || Boolean(googleClientSecret);
    const shouldSaveYoutubeConfig = youtubeConfigState.source === 'saved'
      ? Boolean(googleClientId) || Boolean(googleClientSecret) || youtubeConfigState.hasStoredSecret
      : hasYoutubeInput;

    if (options?.requireClientIdWithSecret !== false && googleClientSecret && !googleClientId && youtubeConfigState.source !== 'env') {
      throw new Error('Google Client ID를 함께 입력해 주세요.');
    }

    if (!shouldSaveYoutubeConfig) {
      return {
        clientIdConfigured: youtubeConfigState.source === 'env' ? true : Boolean(googleClientId),
        clientSecretConfigured: youtubeConfigState.source === 'env' ? true : Boolean(googleClientSecret || youtubeConfigState.hasStoredSecret),
      };
    }

    const youtubeConfigResponse = await fetch('/api/mp4Creater/youtube/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        keepExistingSecret: !googleClientSecret && youtubeConfigState.hasStoredSecret,
      }),
    });

    const youtubeConfigJson = await youtubeConfigResponse.json().catch(() => ({}));
    if (!youtubeConfigResponse.ok) {
      throw new Error(youtubeConfigJson?.error || '유튜브 OAuth 키 저장에 실패했습니다.');
    }

    await refreshYoutubeConfigState().catch(() => undefined);
    return youtubeConfigJson;
  }, [refreshYoutubeConfigState, youtubeConfigState.hasStoredSecret, youtubeConfigState.source, youtubeOAuthValues.googleClientId, youtubeOAuthValues.googleClientSecret]);

  const runYoutubeFieldCheck = useCallback(async (field: 'googleClientId' | 'googleClientSecret') => {
    setIsCheckingYoutubeFields((prev) => ({ ...prev, [field]: true }));
    try {
      let result: InlineFeedback;

      if (field === 'googleClientId') {
        const googleClientId = youtubeOAuthValues.googleClientId.trim();
        const isEnvReady = youtubeConfigState.source === 'env' && Boolean(googleClientId);
        const looksLikeWebClient = /\.apps\.googleusercontent\.com$/i.test(googleClientId);

        if (isEnvReady) {
          result = { tone: 'success', message: '환경변수 Client ID가 준비되어 있습니다. 이 값으로 바로 유튜브 연결을 진행할 수 있습니다.' };
        } else if (!googleClientId) {
          result = { tone: 'error', message: 'Google Client ID를 입력해 주세요.' };
        } else if (!looksLikeWebClient) {
          result = { tone: 'error', message: '웹 OAuth Client ID 형식인지 확인해 주세요. 보통 .apps.googleusercontent.com 으로 끝납니다.' };
        } else {
          result = { tone: 'success', message: 'Client ID 형식이 정상입니다. 연결 확인 또는 연결 시작을 진행할 수 있습니다.' };
        }
      } else {
        const googleClientSecret = youtubeOAuthValues.googleClientSecret.trim();
        const hasEnvSecret = youtubeConfigState.source === 'env';
        const hasStoredSecret = youtubeConfigState.hasStoredSecret;

        if (hasEnvSecret) {
          result = { tone: 'success', message: '환경변수 Client Secret이 준비되어 있습니다. 이 값으로 바로 유튜브 연결을 진행할 수 있습니다.' };
        } else if (googleClientSecret) {
          result = { tone: 'success', message: '새 Client Secret 입력이 확인되었습니다. 저장 없이 연결 확인/시작 버튼으로 바로 이어갈 수 있습니다.' };
        } else if (hasStoredSecret) {
          result = { tone: 'success', message: `저장된 Secret(${youtubeConfigState.secretMask || '기존 값'})을 그대로 사용합니다.` };
        } else {
          result = { tone: 'error', message: 'Google Client Secret을 입력해 주세요.' };
        }
      }

      setYoutubeFieldFeedback((prev) => ({ ...prev, [field]: result }));
      return result;
    } finally {
      setIsCheckingYoutubeFields((prev) => ({ ...prev, [field]: false }));
    }
  }, [youtubeConfigState.hasStoredSecret, youtubeConfigState.secretMask, youtubeConfigState.source, youtubeOAuthValues.googleClientId, youtubeOAuthValues.googleClientSecret]);

  const handleFolderPick = async () => {
    const picked = await pickFolderPath(storageDir);
    if (!picked) return;
    setStorageDir(picked.nextPath);
    setPickedFolderLabel(picked.selectedLabel);
  };

  const runProviderCheck = useCallback(async (field: 'openRouterApiKey' | 'elevenLabsApiKey') => {
    const value = providerValues[field]?.trim() || '';
    const kind = field === 'openRouterApiKey' ? 'openRouter' : 'elevenLabs';
    setIsCheckingProviders((prev) => ({ ...prev, [field]: true }));
    try {
      const result = await validateProviderConnection(kind, value);
      const normalized = result?.tone === 'success'
        ? { tone: 'success' as const, message: '연결되었습니다.' }
        : result;
      setProviderFeedback((prev) => ({ ...prev, [field]: normalized }));
      return normalized;
    } finally {
      setIsCheckingProviders((prev) => ({ ...prev, [field]: false }));
    }
  }, [providerValues]);



  const stopYoutubeConnectPolling = useCallback(() => {
    if (youtubePopupPollRef.current !== null && typeof window !== 'undefined') {
      window.clearInterval(youtubePopupPollRef.current);
      youtubePopupPollRef.current = null;
    }
  }, []);

  const closeYoutubePopup = useCallback(() => {
    if (youtubePopupRef.current && !youtubePopupRef.current.closed) {
      youtubePopupRef.current.close();
    }
    youtubePopupRef.current = null;
  }, []);

  const handleCancelYoutubeConnect = useCallback(() => {
    stopYoutubeConnectPolling();
    closeYoutubePopup();
    setYoutubeConnectOverlay({
      active: false,
      tone: 'info',
      message: '',
    });
    setYoutubeConnectionState({
      isChecking: false,
      tone: 'info',
      message: '유튜브 연결을 취소했습니다.',
    });
  }, [closeYoutubePopup, stopYoutubeConnectPolling]);

  const finalizeYoutubeConnectionCheck = useCallback(async () => {
    const statusResponse = await fetch('/api/mp4Creater/youtube/status', { cache: 'no-store' });
    const statusJson = await statusResponse.json().catch(() => ({}));
    if (statusResponse.ok && statusJson?.connected) {
      const parts = [statusJson?.channelTitle || null, statusJson?.email || null].filter(Boolean);
      setYoutubeConnectOverlay({
        active: false,
        tone: 'success',
        message: parts.length ? `연결 완료: ${parts.join(' · ')}` : '유튜브 계정 연결이 완료되었습니다.',
      });
      setYoutubeConnectionState({
        isChecking: false,
        tone: 'success',
        message: '연결되었습니다.',
      });
      stopYoutubeConnectPolling();
      closeYoutubePopup();
      return true;
    }
    return false;
  }, [closeYoutubePopup, stopYoutubeConnectPolling]);

  useEffect(() => {
    if (!open) return undefined;

    const handleMessage = (event: MessageEvent) => {
      if (typeof window === 'undefined' || event.origin !== window.location.origin) return;
      const payload = event.data as { type?: string; status?: 'success' | 'error'; message?: string } | null;
      if (!payload || payload.type !== 'youtube-oauth-result') return;

      if (payload.status === 'success') {
        void finalizeYoutubeConnectionCheck();
        return;
      }

      stopYoutubeConnectPolling();
      closeYoutubePopup();
      setYoutubeConnectOverlay({
        active: false,
        tone: 'error',
        message: '',
      });
      setYoutubeConnectionState({
        isChecking: false,
        tone: 'error',
        message: payload.message || '유튜브 연결 중 오류가 발생했습니다.',
      });
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [closeYoutubePopup, finalizeYoutubeConnectionCheck, open, stopYoutubeConnectPolling]);

  useEffect(() => () => {
    stopYoutubeConnectPolling();
    closeYoutubePopup();
  }, [closeYoutubePopup, stopYoutubeConnectPolling]);

  const handleCheckYoutubeConnection = useCallback(async () => {
    setYoutubeConnectionState({
      isChecking: true,
      tone: 'info',
      message: '유튜브 연결 상태를 확인하는 중입니다.',
    });

    try {
      const persistedConfig = await persistYoutubeConfigFromInputs();
      const configResponse = await fetch('/api/mp4Creater/youtube/config', { cache: 'no-store' });
      const configJson = await configResponse.json().catch(() => ({}));
      if (!configResponse.ok) {
        throw new Error(configJson?.error || '유튜브 OAuth 설정을 확인하지 못했습니다.');
      }

      const configReady = Boolean(configJson?.clientIdConfigured ?? persistedConfig?.clientIdConfigured) && Boolean(configJson?.clientSecretConfigured ?? persistedConfig?.clientSecretConfigured);
      if (!configReady) {
        setYoutubeConnectionState({
          isChecking: false,
          tone: 'error',
          message: 'Google Client ID와 Client Secret을 입력해 주세요. 입력 후 저장 없이도 바로 연결 상태를 확인할 수 있습니다.',
        });
        return;
      }

      if (await finalizeYoutubeConnectionCheck()) {
        return;
      }

      setYoutubeConnectionState({
        isChecking: false,
        tone: 'info',
        message: 'OAuth 키는 저장되어 있지만 아직 Google 계정 연결은 완료되지 않았습니다. 아래의 연결 시작 버튼을 눌러 진행해 주세요.',
      });
    } catch (error) {
      setYoutubeConnectionState({
        isChecking: false,
        tone: 'error',
        message: error instanceof Error ? error.message : '유튜브 연결 확인 중 오류가 발생했습니다.',
      });
    }
  }, [finalizeYoutubeConnectionCheck, persistYoutubeConfigFromInputs]);

  const handleStartYoutubeConnect = useCallback(async () => {
    setYoutubeConnectionState({
      isChecking: true,
      tone: 'info',
      message: '유튜브 연결 준비 상태를 확인하는 중입니다.',
    });

    try {
      const persistedConfig = await persistYoutubeConfigFromInputs();
      const configResponse = await fetch('/api/mp4Creater/youtube/config', { cache: 'no-store' });
      const configJson = await configResponse.json().catch(() => ({}));
      if (!configResponse.ok) {
        throw new Error(configJson?.error || '유튜브 OAuth 설정을 확인하지 못했습니다.');
      }
      if (!(configJson?.clientIdConfigured ?? persistedConfig?.clientIdConfigured) || !(configJson?.clientSecretConfigured ?? persistedConfig?.clientSecretConfigured)) {
        setYoutubeConnectionState({
          isChecking: false,
          tone: 'error',
          message: 'Google Client ID와 Client Secret을 입력해 주세요. 입력 후 저장 없이도 새 창에서 바로 연결을 시작할 수 있습니다.',
        });
        return;
      }

      stopYoutubeConnectPolling();
      closeYoutubePopup();

      const popup = window.open('/api/mp4Creater/youtube/connect', 'mp4creater-youtube-connect', 'popup=yes,width=620,height=760,noopener');
      if (!popup) {
        setYoutubeConnectionState({
          isChecking: false,
          tone: 'error',
          message: '새 창을 열지 못했습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.',
        });
        return;
      }

      youtubePopupRef.current = popup;
      setYoutubeConnectOverlay({
        active: true,
        tone: 'info',
        message: '현재 창은 잠시 대기 중입니다. 새 창에서 Google 계정 연결을 완료해 주세요.',
      });
      setYoutubeConnectionState({
        isChecking: true,
        tone: 'info',
        message: '새 창에서 Google 로그인 및 권한 허용을 진행해 주세요.',
      });

      youtubePopupPollRef.current = window.setInterval(() => {
        if (youtubePopupRef.current?.closed) {
          stopYoutubeConnectPolling();
          youtubePopupRef.current = null;
          void finalizeYoutubeConnectionCheck().then((connected) => {
            if (!connected) {
              setYoutubeConnectOverlay({ active: false, tone: 'info', message: '' });
              setYoutubeConnectionState({
                isChecking: false,
                tone: 'info',
                message: '연결 창이 닫혔습니다. 연결이 완료되지 않았다면 다시 시도하거나 취소해 주세요.',
              });
            }
          });
        }
      }, 1200);
    } catch (error) {
      stopYoutubeConnectPolling();
      closeYoutubePopup();
      setYoutubeConnectOverlay({ active: false, tone: 'error', message: '' });
      setYoutubeConnectionState({
        isChecking: false,
        tone: 'error',
        message: error instanceof Error ? error.message : '유튜브 연결 시작 중 오류가 발생했습니다.',
      });
    }
  }, [closeYoutubePopup, finalizeYoutubeConnectionCheck, persistYoutubeConfigFromInputs, stopYoutubeConnectPolling]);

  const handleSave = async () => {
    if (!studioState) return;
    const googleApiKey = providerValues.openRouterApiKey.trim();
    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    const googleClientId = youtubeOAuthValues.googleClientId.trim();
    const googleClientSecret = youtubeOAuthValues.googleClientSecret.trim();
    const isHostedRuntime = typeof window !== 'undefined' && !LOCAL_RUNTIME_HOSTNAMES.has(window.location.hostname);
    const nextStorageDir = isHostedRuntime ? '' : storageDir;
    const shouldPersistYoutubeConfigOnSave =
      Boolean(googleClientSecret)
      || googleClientId !== loadedYoutubeClientId;
    const nextScriptModel = routing.scriptModel || freeScriptModel;
    const nextPromptModel = routing.sceneModel || nextScriptModel;
    const nextImageModel = routing.imageModel || freeImageModel;
    const nextVideoModel = routing.videoModel || freeVideoModel;
    const nextBackgroundMusicModel = normalizeBackgroundMusicModelId(routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL);
    const nextBackgroundMusicProvider = resolveBackgroundMusicProvider(
      nextBackgroundMusicModel,
      routing.backgroundMusicProvider || 'sample',
    );
    const wantsElevenTts = routing.ttsProvider === 'elevenLabs' && Boolean(elevenLabsApiKey);
    const wantsPaidImage = nextImageModel !== freeImageModel && Boolean(googleApiKey);
    const wantsPaidVideo = nextVideoModel !== freeVideoModel && Boolean(googleApiKey);
    const paidModeEnabled =
      wantsElevenTts
      || isPaidScriptModel(nextScriptModel)
      || isPaidScriptModel(nextPromptModel)
      || isPaidImageModel(nextImageModel)
      || isPaidVideoModel(nextVideoModel);

    const normalizedRouting = {
      ...routing,
      scriptModel: nextScriptModel,
      textModel: nextScriptModel,
      sceneModel: nextPromptModel,
      imagePromptModel: routing.imagePromptModel || nextPromptModel,
      motionPromptModel: routing.motionPromptModel || nextPromptModel,
      imageModel: nextImageModel,
      imageProvider: wantsPaidImage ? 'openrouter' : 'sample',
      ttsProvider: wantsElevenTts ? 'elevenLabs' : 'qwen3Tts',
      audioProvider: wantsElevenTts ? 'elevenLabs' : 'qwen3Tts',
      backgroundMusicProvider: nextBackgroundMusicProvider,
      videoProvider: wantsPaidVideo ? 'elevenLabs' : 'sample',
      videoModel: nextVideoModel,
      musicVideoProvider: wantsPaidVideo ? 'elevenLabs' : 'sample',
      musicVideoMode: wantsPaidVideo ? 'auto' : 'sample',
      backgroundMusicModel: nextBackgroundMusicModel,
      paidModeEnabled,
    } as StudioState['routing'];

    if (shouldPersistYoutubeConfigOnSave) {
      try {
        await persistYoutubeConfigFromInputs();
        setYoutubeConnectionState({
          isChecking: false,
          tone: 'success',
          message: '유튜브 OAuth 키가 저장되었습니다. 연결 확인 또는 연결 시작 버튼으로 바로 진행할 수 있습니다.',
        });
      } catch (error) {
        console.warn('[SettingsDrawer] youtube config save skipped while preserving AI settings', error);
        setYoutubeConnectionState({
          isChecking: false,
          tone: 'error',
          message: isHostedRuntime
            ? '실서버 환경에서는 유튜브 OAuth 파일 저장이 제한될 수 있어 AI 설정만 먼저 저장했습니다.'
            : (error instanceof Error ? error.message : '유튜브 OAuth 저장에 실패했습니다.'),
        });
      }
    }

    await onSave({
      storageDir: nextStorageDir,
      isStorageConfigured: Boolean(nextStorageDir.trim()),
      providers: {
        ...studioState.providers,
        openRouterApiKey: googleApiKey,
        elevenLabsApiKey,
        falApiKey: googleApiKey || studioState.providers.falApiKey || '',
      },
      routing: {
        ...studioState.routing,
        ...normalizedRouting,
      },
    });
    closeDrawerCleanly();
  };

  if (!open || !studioState) return null;
  const showStorageSection = false;

  const youtubeOAuthSection = (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900">유튜브 업로드 OAuth</h3>
          <p className="mt-1 text-xs text-slate-600">썸네일 화면에서 유튜브 자동 업로드를 사용하려면 Google OAuth Client ID / Client Secret을 입력해 주세요. 값은 서버 전용 설정 파일에 저장됩니다.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
            {youtubeConfigState.isLoading ? '불러오는 중...' : youtubeConfigState.source === 'env' ? '환경변수 사용 중' : youtubeConfigState.source === 'saved' ? '설정 저장됨' : '미설정'}
          </div>
          {youtubeSectionVariant === 'collapsed-bottom' ? (
            <button
              type="button"
              onClick={() => setIsYoutubeSectionOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              aria-expanded={isYoutubeSectionOpen}
            >
              {isYoutubeSectionOpen ? '닫기' : '열기'}
            </button>
          ) : null}
        </div>
      </div>

      {youtubeSectionVariant !== 'collapsed-bottom' || isYoutubeSectionOpen ? (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-900">Google Client ID</div>
              <div className="mt-1 text-[11px] text-slate-500">OAuth 동의 화면과 YouTube Data API가 연결된 웹 클라이언트 ID를 입력합니다.</div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type={showSecrets.googleClientId ? 'text' : 'password'}
                  value={youtubeOAuthValues.googleClientId}
                  onChange={(e) => setYoutubeOAuthValues((prev) => ({ ...prev, googleClientId: e.target.value }))}
                  className={inputClass}
                  placeholder={SETTINGS_INPUT_PLACEHOLDERS.youtubeClientId}
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets((prev) => ({ ...prev, googleClientId: !prev.googleClientId }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  aria-label={showSecrets.googleClientId ? 'Client ID 숨기기' : 'Client ID 보기'}
                  title={showSecrets.googleClientId ? '숨기기' : '보기'}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12c2.8-4.5 6.5-7 11-7s8.2 2.5 11 7c-2.8 4.5-6.5 7-11 7s-8.2-2.5-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                    {showSecrets.googleClientId ? <path d="M3 3l18 18" /> : null}
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => void runYoutubeFieldCheck('googleClientId')}
                disabled={isCheckingYoutubeFields.googleClientId}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isCheckingYoutubeFields.googleClientId ? '확인 중...' : '연결 확인'}
              </button>
              {youtubeFieldFeedback.googleClientId?.message ? (
                <p className={`mt-2 text-xs ${youtubeFieldFeedback.googleClientId.tone === 'success' ? 'text-blue-600' : youtubeFieldFeedback.googleClientId.tone === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                  {youtubeFieldFeedback.googleClientId.message}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-900">Google Client Secret</div>
              <div className="mt-1 text-[11px] text-slate-500">저장된 Secret이 있으면 비워둬도 유지됩니다.</div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type={showSecrets.googleClientSecret ? 'text' : 'password'}
                  value={youtubeOAuthValues.googleClientSecret}
                  onChange={(e) => setYoutubeOAuthValues((prev) => ({ ...prev, googleClientSecret: e.target.value }))}
                  className={inputClass}
                  placeholder={resolveYoutubeClientSecretPlaceholder(youtubeConfigState.hasStoredSecret, youtubeConfigState.secretMask)}
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets((prev) => ({ ...prev, googleClientSecret: !prev.googleClientSecret }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  aria-label={showSecrets.googleClientSecret ? 'Client Secret 숨기기' : 'Client Secret 보기'}
                  title={showSecrets.googleClientSecret ? '숨기기' : '보기'}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12c2.8-4.5 6.5-7 11-7s8.2 2.5 11 7c-2.8 4.5-6.5 7-11 7s-8.2-2.5-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                    {showSecrets.googleClientSecret ? <path d="M3 3l18 18" /> : null}
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => void runYoutubeFieldCheck('googleClientSecret')}
                disabled={isCheckingYoutubeFields.googleClientSecret}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isCheckingYoutubeFields.googleClientSecret ? '확인 중...' : '연결 확인'}
              </button>
              {youtubeFieldFeedback.googleClientSecret?.message ? (
                <p className={`mt-2 text-xs ${youtubeFieldFeedback.googleClientSecret.tone === 'success' ? 'text-blue-600' : youtubeFieldFeedback.googleClientSecret.tone === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                  {youtubeFieldFeedback.googleClientSecret.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleCheckYoutubeConnection()}
              disabled={youtubeConnectionState?.isChecking || youtubeConnectOverlay.active}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {youtubeConnectionState?.isChecking ? '확인 중...' : '유튜브 연결 확인'}
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleStartYoutubeConnect()}
              disabled={youtubeConnectOverlay.active}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              유튜브 연결 시작
            </button>
          </div>
          {youtubeConnectionState?.tone === 'success' && youtubeConnectionState?.message ? (
            <p className="mt-2 text-xs text-blue-600">
              {youtubeConnectionState.message}
            </p>
          ) : null}

          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-3 text-[11px] leading-5 text-slate-600">
            <div><span className="font-black text-slate-900">Redirect URI</span> · {youtubeConfigState.redirectUri || 'http://localhost:3000/api/mp4Creater/youtube/callback'}</div>
            <div className="mt-1">Google Cloud Console의 승인된 리디렉션 URI에 위 주소를 그대로 등록해야 연결이 정상 동작합니다.</div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">필요할 때만 열어 Google OAuth Client ID / Secret과 연결 상태를 확인할 수 있습니다.</p>
      )}
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-950/30 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDrawerCleanly();
      }}
    >
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-slate-50 px-5 pb-32 pt-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">제작 설정</div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Google AI Studio / ElevenLabs 연결 설정</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">mp4Creater 안에서만 텍스트, 이미지, 영상, 음성 생성의 기본 연결과 샘플 모드를 관리합니다.</p>
          </div>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeDrawerCleanly} disabled={youtubeConnectOverlay.active} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400">닫기</button>
        </div>

        <div className="mt-5 grid gap-4">
          {showStorageSection ? (
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">저장 위치</h3>
                  <p className="mt-1 text-xs text-slate-600">프로젝트 JSON 저장소와 생성 결과 메타데이터를 저장할 기본 위치입니다.</p>
                </div>
                <button type="button" onClick={handleFolderPick} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">폴더 선택</button>
              </div>
              <input value={storageDir} onChange={(e) => setStorageDir(e.target.value)} className={`${inputClass} mt-3`} placeholder={SETTINGS_INPUT_PLACEHOLDERS.storageDir} />
              {pickedFolderLabel ? <p className="mt-2 text-xs text-slate-500">선택한 위치: {pickedFolderLabel}</p> : null}
            </section>
          ) : null}

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">API 연결</h3>
                <p className="mt-1 text-xs text-slate-600">Google AI Studio는 텍스트, 이미지, 영상, 기본 TTS 생성에 사용하고 ElevenLabs는 음성과 음악 샘플 고도화에 사용합니다.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">Google AI Studio API 키</div>
                <div className="mt-1 text-[11px] text-slate-500">Gemini 텍스트/이미지, Veo 영상, 기본 TTS 생성 연결에 공통 사용합니다.</div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type={showSecrets.openRouterApiKey ? 'text' : 'password'}
                    value={providerValues.openRouterApiKey}
                    onChange={(e) => setProviderValues((prev) => ({ ...prev, openRouterApiKey: e.target.value }))}
                    className={inputClass}
                    placeholder={SETTINGS_INPUT_PLACEHOLDERS.googleAiStudioApiKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets((prev) => ({ ...prev, openRouterApiKey: !prev.openRouterApiKey }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    aria-label={showSecrets.openRouterApiKey ? 'API 키 숨기기' : 'API 키 보기'}
                    title={showSecrets.openRouterApiKey ? '숨기기' : '보기'}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12c2.8-4.5 6.5-7 11-7s8.2 2.5 11 7c-2.8 4.5-6.5 7-11 7s-8.2-2.5-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                      {showSecrets.openRouterApiKey ? <path d="M3 3l18 18" /> : null}
                    </svg>
                  </button>
                </div>
                <button type="button" onClick={() => void runProviderCheck('openRouterApiKey')} disabled={!providerValues.openRouterApiKey.trim() || isCheckingProviders.openRouterApiKey} className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">{isCheckingProviders.openRouterApiKey ? '확인 중...' : '연결 확인'}</button>
                {providerFeedback.openRouterApiKey?.message ? <p className={`mt-2 text-xs ${providerFeedback.openRouterApiKey.tone === 'success' ? 'text-blue-600' : providerFeedback.openRouterApiKey.tone === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>{providerFeedback.openRouterApiKey.message}</p> : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">ElevenLabs API 키</div>
                <div className="mt-1 text-[11px] text-slate-500">유료 모드에서 음성 생성과 음악 확장 품질 확인에 사용합니다.</div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type={showSecrets.elevenLabsApiKey ? 'text' : 'password'}
                    value={providerValues.elevenLabsApiKey}
                    onChange={(e) => setProviderValues((prev) => ({ ...prev, elevenLabsApiKey: e.target.value }))}
                    className={inputClass}
                    placeholder={SETTINGS_INPUT_PLACEHOLDERS.elevenLabsApiKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets((prev) => ({ ...prev, elevenLabsApiKey: !prev.elevenLabsApiKey }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    aria-label={showSecrets.elevenLabsApiKey ? 'API 키 숨기기' : 'API 키 보기'}
                    title={showSecrets.elevenLabsApiKey ? '숨기기' : '보기'}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12c2.8-4.5 6.5-7 11-7s8.2 2.5 11 7c-2.8 4.5-6.5 7-11 7s-8.2-2.5-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                      {showSecrets.elevenLabsApiKey ? <path d="M3 3l18 18" /> : null}
                    </svg>
                  </button>
                </div>
                <button type="button" onClick={() => void runProviderCheck('elevenLabsApiKey')} disabled={!providerValues.elevenLabsApiKey.trim() || isCheckingProviders.elevenLabsApiKey} className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">{isCheckingProviders.elevenLabsApiKey ? '확인 중...' : '연결 확인'}</button>
                {providerFeedback.elevenLabsApiKey?.message ? <p className={`mt-2 text-xs ${providerFeedback.elevenLabsApiKey.tone === 'success' ? 'text-blue-600' : providerFeedback.elevenLabsApiKey.tone === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>{providerFeedback.elevenLabsApiKey.message}</p> : null}
              </div>
            </div>
          </section>


          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">텍스트 · 이미지 · 영상 모델</h3>
                <p className="mt-1 text-xs text-slate-600">공통 카드 팝업에서 최소 비용, 중간 비용, 고비용 단계를 나눠 비교하고 선택할 수 있습니다. API가 없는 항목은 회색으로 잠겨 보여 줍니다.</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">텍스트 생성 모델</div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">대본 생성</div>
                  <button
                    type="button"
                    onClick={() => setSettingsPicker({ kind: 'script-model' })}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{scriptPickerOptions.find((item) => item.id === (routing.scriptModel || routing.textModel || freeScriptModel))?.title || (routing.scriptModel || routing.textModel || freeScriptModel)}</div>
                    <div className="mt-1 text-xs text-slate-500">Compare value, quality, and speed for Step3 script generation.</div>
                  </button>
                  <select
                    value={visibleScriptModels.some((item) => item.id === (routing.scriptModel || routing.textModel)) ? (routing.scriptModel || routing.textModel || freeScriptModel) : freeScriptModel}
                    onChange={(e) => setRouting((prev) => ({ ...prev, scriptModel: e.target.value, textModel: e.target.value }))}
                    className={`${inputClass} hidden`}
                  >
                    {visibleScriptModels.map((item) => <option key={`script-${item.id}`} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">프롬프트 생성</div>
                  <button
                    type="button"
                    onClick={() => setSettingsPicker({ kind: 'prompt-model' })}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{scriptPickerOptions.find((item) => item.id === (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || freeScriptModel))?.title || (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || freeScriptModel)}</div>
                    <div className="mt-1 text-xs text-slate-500">Used for scene planning, image prompts, and motion prompts.</div>
                  </button>
                  <select
                    value={visibleScriptModels.some((item) => item.id === (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel)) ? (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || freeScriptModel) : freeScriptModel}
                    onChange={(e) => setRouting((prev) => ({
                      ...prev,
                      sceneModel: e.target.value,
                      imagePromptModel: e.target.value,
                      motionPromptModel: e.target.value,
                    }))}
                    className={`${inputClass} hidden`}
                  >
                    {visibleScriptModels.map((item) => <option key={`prompt-${item.id}`} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </div>
                {!providerValues.openRouterApiKey.trim() ? (
                  <p className="mt-2 text-xs text-amber-600">Google AI Studio 키가 없어도 샘플/무료 흐름 점검은 가능하지만, 실제 호출은 키를 저장해야 적용됩니다.</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">저장 후 현재 프로젝트에서 선택 모델이 바로 반영됩니다.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">이미지 · 영상 생성 모델</div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">이미지 모델</div>
                  <button
                    type="button"
                    onClick={() => setSettingsPicker({ kind: 'image-model' })}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{imagePickerOptions.find((item) => item.id === (routing.imageModel || freeImageModel))?.title || (routing.imageModel || freeImageModel)}</div>
                    <div className="mt-1 text-xs text-slate-500">Compare image quality, price, and speed at a glance.</div>
                  </button>
                  <select
                    value={visibleImageModels.some((item) => item.id === routing.imageModel) ? (routing.imageModel || freeImageModel) : freeImageModel}
                    onChange={(e) => setRouting((prev) => ({
                      ...prev,
                      imageModel: e.target.value,
                      imageProvider: e.target.value === freeImageModel ? 'sample' : 'openrouter',
                    }))}
                    className={`${inputClass} hidden`}
                  >
                    {visibleImageModels.map((item) => <option key={item.id} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">영상 모델</div>
                  <button
                    type="button"
                    onClick={() => setSettingsPicker({ kind: 'video-model' })}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{videoPickerOptions.find((item) => item.id === (routing.videoModel || freeVideoModel))?.title || (routing.videoModel || freeVideoModel)}</div>
                    <div className="mt-1 text-xs text-slate-500">Compare motion quality, speed, and price tier.</div>
                  </button>
                  <select
                    value={visibleVideoModels.some((item) => item.id === routing.videoModel) ? (routing.videoModel || freeVideoModel) : freeVideoModel}
                    onChange={(e) => setRouting((prev) => ({ ...prev, videoModel: e.target.value, videoProvider: e.target.value === freeVideoModel ? 'sample' : 'elevenLabs' }))}
                    className={`${inputClass} hidden`}
                  >
                    {visibleVideoModels.map((item) => <option key={item.id} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </div>
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                  무료 API가 없는 항목은 샘플 모델로도 화면 흐름, 씬 생성, 최종 출력 테스트가 되도록 유지됩니다.
                </div>
              </div>
            </div>
          </section>
          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">기본 API 선택</h3>
                <p className="mt-1 text-xs text-slate-600">API 키가 연결되면 해당 모델이 바로 선택 가능해지고, 연결되지 않은 항목은 회색 비활성 카드로만 보여 드립니다. 헤더 설정은 새 프로젝트 기본값만 바꾸고, 프로젝트 안에서는 Step3/Step6에서 개별로 다시 조정할 수 있습니다.</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">음성</div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">기본 TTS</div>
                  <button
                    type="button"
                    onClick={() => setTtsSelectionModalOpen(true)}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">모델 / 목소리 변경</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {visibleTtsProvider === 'elevenLabs'
                        ? `${selectedElevenModel?.title || 'ElevenLabs'} · ${selectedElevenVoice?.name || '기본 목소리'}`
                          : `Gemini 2.5 Flash Preview TTS · ${selectedQwenVoice?.name || '기본 보이스'}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">같은 팝업 안에서 최소 비용 / 중간 비용 / 고비용 TTS 모델을 고르고, 이어서 그 모델의 실제 목소리를 들어본 뒤 저장합니다.</div>
                  </button>
                  <select value={ttsProviderPickerCurrentId} onChange={(e) => setRouting((prev) => ({ ...prev, ttsProvider: e.target.value as 'qwen3Tts' | 'elevenLabs', audioProvider: e.target.value as 'qwen3Tts' | 'elevenLabs' }))} className={`${inputClass} hidden`}>
                    {ttsProviderPickerOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.priceLabel === '무료' ? `🆓 ${item.title}` : `💳 ${item.title}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                  {visibleTtsProvider === 'elevenLabs'
                    ? `현재 기본 TTS: ${selectedElevenModel?.title || 'ElevenLabs 모델'} · ${selectedElevenVoice?.name || 'ElevenLabs 기본 목소리'}${selectedElevenVoice?.labels?.gender ? ` · ${selectedElevenVoice.labels.gender}` : ''}`
                      : `현재 기본 TTS: ${selectedQwenVoice?.name || '기본 보이스'} · Gemini 2.5 Flash Preview TTS`}
                </div>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                  Gemini TTS, ElevenLabs 목소리는 모두 위의 `모델 / 목소리 변경` 팝업 안에서 같은 카드 디자인으로 선택합니다.
                  헤더 설정은 새 프로젝트 기본값만 바꾸고, 프로젝트 안에서는 Step3/Step6에서 다시 덮어쓸 수 있습니다.
                </div>
                <button type="button" onClick={() => void playVoicePreview()} className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                  {isVoicePreviewing ? '음성 정지' : '음성 재생'}
                </button>
                {voicePreviewMessage ? <p className="mt-2 text-xs text-slate-500">{voicePreviewMessage}</p> : null}
                {visibleTtsProvider === 'elevenLabs' && !providerValues.elevenLabsApiKey.trim() ? (
                  <p className="mt-2 text-xs text-amber-600">선택한 음성 모델은 API 연결이 필요합니다. API 등록 후 다시 시도해 주세요.</p>
                ) : null}
                {isLoadingVoices ? <p className="mt-2 text-xs text-slate-500">보이스 목록을 불러오는 중입니다.</p> : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">배경 음악</div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold text-slate-700">배경 음악 모델</div>
                  <button
                    type="button"
                    onClick={() => setSettingsPicker({ kind: 'bgm-model' })}
                    className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model picker</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {backgroundMusicPickerOptions.find((item) => item.id === (routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL))?.title || (routing.backgroundMusicModel || CONFIG.DEFAULT_BGM_MODEL)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">배경음 모델별 비용 수준과 생성 방식을 같은 카드 UI에서 비교하고 선택할 수 있습니다.</div>
                  </button>
                  <select
                    value={routing.backgroundMusicModel || 'sample-ambient-v1'}
                    onChange={(e) => {
                      const nextModel = normalizeBackgroundMusicModelId(e.target.value);
                      setRouting((prev) => ({
                        ...prev,
                        backgroundMusicModel: nextModel,
                        backgroundMusicProvider: resolveBackgroundMusicProvider(nextModel, prev.backgroundMusicProvider || 'sample'),
                      }));
                    }}
                    className={`${inputClass} hidden`}
                  >
                    {backgroundMusicModelOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`🆓 ${item.name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => void playBgmPreview()} className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                  {isBgmPreviewing ? '배경 음악 정지' : '배경 음악 재생'}
                </button>
                {bgmPreviewMessage ? <p className="mt-2 text-xs text-slate-500">{bgmPreviewMessage}</p> : null}
                {isGoogleBgmModel(routing.backgroundMusicModel) ? (
                  <p className="mt-2 text-xs text-blue-600">Google Lyria 3 모델은 현재 선택 상태 그대로 저장되고, API가 없거나 실패하면 실행 시 샘플 배경음으로만 안전하게 대체됩니다.</p>
                ) : null}
              </div>
            </div>
          </section>

          {youtubeOAuthSection}
        </div>

        {voiceSampleModalOpen && typeof document !== 'undefined' ? createPortal((
          <div
            className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/55 px-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeVoiceSampleModal();
              }
            }}
          >
            <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">목소리 샘플</div>
                  <h3 className="mt-2 text-xl font-black text-slate-900">녹음 예시문장과 샘플 관리</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">15초 이하, 또렷한 단일 화자 음성으로 등록해 주세요. 무료 TTS 생성에 바로 연결됩니다.</p>
                </div>
                <button type="button" onClick={closeVoiceSampleModal} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">닫기</button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] leading-6 text-slate-700">
                <div className="font-black text-slate-900">녹음 예시 문장</div>
                <div className="mt-2">안녕하세요. 저는 또렷하고 자연스럽게 말합니다. 오늘은 제 목소리 샘플을 등록합니다. 짧고 안정적인 속도로 읽겠습니다.</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">숨소리와 배경 소음을 줄이고, 한국어를 기본으로 읽어 주세요. 실제 생성 문장은 Step2에서 선택한 언어를 그대로 따릅니다.</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={isVoiceSampleProcessing} onClick={() => void handleToggleVoiceSampleRecording()} className={`rounded-xl px-3 py-2 text-xs font-black ${isRecordingVoiceSample ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-slate-900 text-white hover:bg-slate-800'} disabled:cursor-not-allowed disabled:bg-slate-300`}>
                  {isRecordingVoiceSample ? `녹음 저장 (${voiceSampleSecondsLeft}s)` : '녹음 시작'}
                </button>
                <label className={`inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 ${isVoiceSampleProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  파일 등록
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => void handleVoiceSampleFileChange(e)} disabled={isVoiceSampleProcessing} />
                </label>
                <button type="button" onClick={() => void playRecordedVoiceSample()} disabled={!recordedVoiceSampleUrl || isVoiceSampleProcessing} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400">
                  저장된 샘플 듣기
                </button>
                <button type="button" onClick={clearRecordedVoiceSample} disabled={!recordedVoiceSampleUrl || isVoiceSampleProcessing} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:border-slate-200 disabled:text-slate-400">
                  샘플 삭제
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">
                {recordedVoiceSampleUrl
                  ? `저장된 파일: ${routing.voiceReferenceName || 'recorded-voice.webm'} · 무료 TTS 생성에 바로 사용됩니다.`
                  : '저장된 샘플이 없으면 한국어 기본 보이스로 생성됩니다.'}
              </div>
              {voicePreviewMessage ? <p className="mt-3 text-xs text-slate-500">{voicePreviewMessage}</p> : null}
            </div>
          </div>
        ), document.body) : null}

        <TtsSelectionModal
          open={ttsSelectionModalOpen}
          title="기본 TTS 모델 / 목소리 선택"
          currentProvider={visibleTtsProvider}
          currentModelId={routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL}
          currentVoiceId={
            visibleTtsProvider === 'elevenLabs'
              ? (routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID)
                : (routing.qwenVoicePreset || 'qwen-default')
          }
          googleApiKey={providerValues.openRouterApiKey}
          elevenLabsApiKey={providerValues.elevenLabsApiKey}
          hasElevenLabsApiKey={hasElevenLabsApiKey}
          allowPaid
          elevenLabsVoices={elevenLabsVoices}
          voiceReferenceAudioData={routing.voiceReferenceAudioData}
          voiceReferenceMimeType={routing.voiceReferenceMimeType}
          voiceReferenceName={routing.voiceReferenceName}
          extraVoicePanel={ttsVoiceExtraPanel}
          onApply={(selection) => {
            setRouting((prev) => {
              if (selection.provider === 'elevenLabs') {
                return {
                  ...prev,
                  ttsProvider: 'elevenLabs',
                  audioProvider: 'elevenLabs',
                  audioModel: selection.modelId || prev.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
                  elevenLabsModelId: selection.modelId || prev.elevenLabsModelId || CONFIG.DEFAULT_ELEVENLABS_MODEL,
                  elevenLabsVoiceId: selection.voiceId || prev.elevenLabsVoiceId || CONFIG.DEFAULT_VOICE_ID,
                };
              }
              return {
                ...prev,
                ttsProvider: 'qwen3Tts',
                audioProvider: 'qwen3Tts',
                qwenVoicePreset: selection.voiceId || prev.qwenVoicePreset || 'qwen-default',
                ttsNarratorId: selection.voiceId || prev.ttsNarratorId || 'qwen-default',
              };
            });
          }}
          onClose={() => setTtsSelectionModalOpen(false)}
        />

        {activeSettingsPicker ? (
          <AiOptionPickerModal
            open={Boolean(activeSettingsPicker)}
            title={activeSettingsPicker.title}
            description={activeSettingsPicker.description}
            currentId={activeSettingsPicker.currentId}
            options={activeSettingsPicker.options}
            onClose={() => setSettingsPicker(null)}
            onSelect={activeSettingsPicker.onSelect}
            emptyMessage={activeSettingsPicker.emptyMessage}
            requireConfirm={activeSettingsPicker.requireConfirm}
            confirmLabel={activeSettingsPicker.confirmLabel}
            onPreviewOption={activeSettingsPicker.onPreviewOption}
            extraPanel={activeSettingsPicker.extraPanel}
          />
        ) : null}

        {youtubeConnectOverlay.active ? (
          <div className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-5">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-5 text-center shadow-2xl backdrop-blur">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <svg className="h-6 w-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 3v4" />
                  <path d="M18.36 5.64l-2.83 2.83" />
                  <path d="M21 12h-4" />
                  <path d="M18.36 18.36l-2.83-2.83" />
                  <path d="M12 21v-4" />
                  <path d="M5.64 18.36l2.83-2.83" />
                  <path d="M3 12h4" />
                  <path d="M5.64 5.64l2.83 2.83" />
                </svg>
              </div>
              <div className="mt-4 text-base font-black text-slate-900">유튜브 연결 진행 중</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{youtubeConnectOverlay.message || '새 창에서 Google 계정 연결을 완료해 주세요. 현재 창은 연결이 끝날 때까지 잠시 잠겨 있습니다.'}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs leading-5 text-slate-500">
                새 창에서 계정 선택과 권한 허용을 마치면 이 화면이 자동으로 풀립니다. 연결 창을 닫아야 할 경우 아래 취소 버튼을 눌러 주세요.
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelYoutubeConnect}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  연결 취소
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="fixed bottom-0 right-0 z-[95] w-full max-w-3xl border-l border-t border-slate-300 bg-slate-200/95 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-end gap-2">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeDrawerCleanly} disabled={youtubeConnectOverlay.active} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400">취소</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={handleSave} disabled={youtubeConnectOverlay.active} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
