'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StudioState } from '../types';
import { pickFolderPath } from '../services/folderPicker';
import {
  BGM_MODEL_OPTIONS,
  CONFIG,
  ELEVENLABS_MODELS,
  IMAGE_MODELS,
  QWEN_TTS_PRESET_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from '../config';
import { validateProviderConnection } from '../services/providerValidationService';
import { createTtsPreview } from '../services/ttsService';
import { createSampleBackgroundTrack } from '../services/musicService';
import { fetchElevenLabsVoices } from '../services/elevenLabsService';

interface SettingsDrawerProps {
  open: boolean;
  studioState: StudioState | null;
  onClose: () => void;
  onSave: (nextState: Partial<StudioState>) => void | Promise<void>;
}

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-400';
const isElevenLabsBgmModel = (modelId?: string | null) => (modelId || '').startsWith('elevenlabs');
const isPaidScriptModel = (modelId?: string | null) => SCRIPT_MODEL_OPTIONS.find((item) => item.id === modelId)?.tier === 'paid';
const isPaidImageModel = (modelId?: string | null) => IMAGE_MODELS.find((item) => item.id === modelId)?.tier === 'paid';
const isPaidVideoModel = (modelId?: string | null) => VIDEO_MODEL_OPTIONS.find((item) => item.id === modelId)?.tier === 'paid';
const freeScriptModel = SCRIPT_MODEL_OPTIONS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_SCRIPT_MODEL;
const freeImageModel = IMAGE_MODELS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_IMAGE_MODEL;
const freeVideoModel = VIDEO_MODEL_OPTIONS.find((item) => item.tier !== 'paid')?.id || CONFIG.DEFAULT_VIDEO_MODEL;

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, studioState, onClose, onSave }) => {
  const [storageDir, setStorageDir] = useState('');
  const [pickedFolderLabel, setPickedFolderLabel] = useState('');
  const [providerValues, setProviderValues] = useState({
    openRouterApiKey: '',
    elevenLabsApiKey: '',
  });
  const [showSecrets, setShowSecrets] = useState({
    openRouterApiKey: false,
    elevenLabsApiKey: false,
  });
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
    qwenVoicePreset: 'qwen-default',
    qwenStylePreset: 'balanced',
    backgroundMusicProvider: 'sample',
    backgroundMusicStyle: 'ambient',
    musicVideoProvider: 'sample',
    musicVideoMode: 'sample',
  });
  const [providerFeedback, setProviderFeedback] = useState<Record<string, { tone: 'success' | 'error' | 'info'; message: string } | null>>({});
  const [isCheckingProviders, setIsCheckingProviders] = useState<Record<string, boolean>>({});
  const [isVoicePreviewing, setIsVoicePreviewing] = useState(false);
  const [voicePreviewMessage, setVoicePreviewMessage] = useState('');
  const [isBgmPreviewing, setIsBgmPreviewing] = useState(false);
  const [bgmPreviewMessage, setBgmPreviewMessage] = useState('');
  const [isPaidMode, setIsPaidMode] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ voice_id: string; name: string; preview_url?: string; labels?: { accent?: string; gender?: string; description?: string } }>>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewUtteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const voicePreviewKeyRef = React.useRef('');
  const bgmPreviewKeyRef = React.useRef('');

  const visibleScriptModels = useMemo(
    () => SCRIPT_MODEL_OPTIONS.filter((item) => isPaidMode || item.tier !== 'paid'),
    [isPaidMode],
  );
  const visibleImageModels = useMemo(
    () => IMAGE_MODELS.filter((item) => isPaidMode || item.tier !== 'paid'),
    [isPaidMode],
  );
  const visibleVideoModels = useMemo(
    () => VIDEO_MODEL_OPTIONS.filter((item) => isPaidMode || item.tier !== 'paid'),
    [isPaidMode],
  );

  useEffect(() => {
    if (!open || !studioState) return;
    setStorageDir(studioState.storageDir || '');
    setProviderValues({
      openRouterApiKey: studioState.providers.openRouterApiKey || '',
      elevenLabsApiKey: studioState.providers.elevenLabsApiKey || '',
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
      backgroundMusicProvider: studioState.routing?.backgroundMusicProvider === 'elevenLabs' ? 'elevenLabs' : 'sample',
      musicVideoProvider: studioState.routing?.musicVideoProvider === 'elevenLabs' ? 'elevenLabs' : 'sample',
      musicVideoMode: studioState.routing?.musicVideoMode || 'sample',
    }));
    setPickedFolderLabel('');
    setVoicePreviewMessage('');
    setIsVoicePreviewing(false);
    setBgmPreviewMessage('');
    setIsBgmPreviewing(false);
    setIsPaidMode(Boolean(
      studioState.routing?.ttsProvider === 'elevenLabs'
      || studioState.routing?.backgroundMusicProvider === 'elevenLabs'
      || isPaidScriptModel(studioState.routing?.scriptModel || studioState.routing?.textModel)
      || isPaidScriptModel(studioState.routing?.sceneModel)
      || isPaidImageModel(studioState.routing?.imageModel)
      || isPaidVideoModel(studioState.routing?.videoModel)
    ));
    setProviderFeedback({});
    setIsCheckingProviders({});
    setShowSecrets({
      openRouterApiKey: false,
      elevenLabsApiKey: false,
    });
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
    const provider = routing.ttsProvider === 'elevenLabs' ? 'elevenLabs' : 'qwen3Tts';
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
    setVoicePreviewMessage('선택한 모델로 미리 듣기를 준비 중입니다.');

    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    if (provider === 'elevenLabs' && !elevenLabsApiKey) {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('ElevenLabs API가 연결되지 않았습니다. 먼저 API 연결 확인을 해주세요.');
      return;
    }

    try {
      if (provider === 'qwen3Tts') {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          setIsVoicePreviewing(false);
          setVoicePreviewMessage('이 브라우저에서는 qwen3-tts 미리 듣기를 지원하지 않습니다.');
          return;
        }

        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance('안녕하세요 반갑습니다. 지금 선택한 기본 목소리를 확인합니다.');
        utterance.lang = 'ko-KR';

        const allVoices = synth.getVoices();
        const koreanVoices = allVoices.filter((voice) => (voice.lang || '').toLowerCase().startsWith('ko'));
        const selectedVoice =
          routing.qwenVoicePreset === 'qwen-soft'
            ? koreanVoices.find((voice) => /female|yuna|soyoung|sunhi|sora/i.test(voice.name)) || koreanVoices[0]
            : koreanVoices.find((voice) => /male|minho|inho|jiyoung|hyun/i.test(voice.name)) || koreanVoices[0];

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.onend = () => {
          setIsVoicePreviewing(false);
          setVoicePreviewMessage(`qwen3-tts (${routing.qwenVoicePreset || 'qwen-default'}) 미리 듣기가 끝났습니다.`);
          previewUtteranceRef.current = null;
        };
        utterance.onerror = () => {
          setIsVoicePreviewing(false);
          setVoicePreviewMessage('qwen3-tts 미리 듣기에 실패했습니다.');
          previewUtteranceRef.current = null;
        };
        previewUtteranceRef.current = utterance;
        synth.speak(utterance);
        setVoicePreviewMessage(`qwen3-tts (${routing.qwenVoicePreset || 'qwen-default'}) 미리 듣기 중입니다.`);
        return;
      }

      const { asset } = await createTtsPreview({
        provider,
        title: '설정 미리 듣기',
        text: '안녕하세요 반갑습니다. 지금 선택한 기본 목소리를 확인합니다.',
        mode: 'voice-preview',
        apiKey: elevenLabsApiKey,
        voiceId: routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID,
        modelId: routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL,
        qwenPreset: routing.qwenVoicePreset || 'qwen-default',
      });

      const audio = new Audio(`data:audio/mpeg;base64,${asset.audioData}`);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 미리 듣기가 끝났습니다.');
      };
      audio.onerror = () => {
        setIsVoicePreviewing(false);
        setVoicePreviewMessage('음성 미리 듣기에 실패했습니다.');
      };
      await audio.play();
      setVoicePreviewMessage(`ElevenLabs (${selectedElevenVoice?.name || asset.voiceId || '기본 보이스'}) 미리 듣기 중입니다.`);
    } catch {
      setIsVoicePreviewing(false);
      setVoicePreviewMessage('음성 미리 듣기에 실패했습니다. API 연결 상태를 확인해 주세요.');
    }
  }, [
    isVoicePreviewing,
    providerValues.elevenLabsApiKey,
    routing,
    selectedElevenVoice,
    stopVoicePreview,
  ]);

  const playBgmPreview = useCallback(async () => {
    const bgmPreviewKey = [
      routing.backgroundMusicProvider || 'sample',
      routing.backgroundMusicModel || 'sample-ambient-v1',
    ].join('|');

    if (isBgmPreviewing && bgmPreviewKeyRef.current === bgmPreviewKey) {
      stopBgmPreview();
      return;
    }

    stopBgmPreview();
    bgmPreviewKeyRef.current = bgmPreviewKey;
    setIsBgmPreviewing(true);
    setBgmPreviewMessage('배경 음악 미리 듣기를 준비 중입니다.');

    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    const selectedBgmModel = routing.backgroundMusicModel || 'sample-ambient-v1';
    const requiresElevenLabsBgm = isElevenLabsBgmModel(selectedBgmModel);
    if (requiresElevenLabsBgm && !elevenLabsApiKey) {
      setIsBgmPreviewing(false);
      setBgmPreviewMessage('배경 음악 API가 연결되지 않았습니다. API 등록 후 다시 시도해 주세요.');
      return;
    }

    try {
      const previewTrack = createSampleBackgroundTrack({
        id: 'settings-preview',
        version: 1,
        contentType: 'story',
        outputMode: 'video',
        topic: '설정 미리 듣기',
        script: '배경 음악 미리 듣기',
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
      } as any, routing.backgroundMusicModel || 'sample-ambient-v1', 'preview');

      const audio = new Audio(`data:audio/wav;base64,${previewTrack.audioData}`);
      bgmAudioRef.current = audio;
      audio.onended = () => {
        setIsBgmPreviewing(false);
        setBgmPreviewMessage(`배경 음악 (${routing.backgroundMusicModel || 'sample-ambient-v1'}) 미리 듣기가 끝났습니다.`);
      };
      audio.onerror = () => {
        setIsBgmPreviewing(false);
        setBgmPreviewMessage('배경 음악 미리 듣기에 실패했습니다.');
      };
      await audio.play();
      setBgmPreviewMessage(`배경 음악 (${routing.backgroundMusicModel || 'sample-ambient-v1'}) 미리 듣기 중입니다.`);
    } catch {
      setIsBgmPreviewing(false);
      setBgmPreviewMessage('배경 음악 미리 듣기에 실패했습니다.');
    }
  }, [isBgmPreviewing, providerValues.elevenLabsApiKey, routing.backgroundMusicModel, routing.backgroundMusicProvider, stopBgmPreview]);

  useEffect(() => {
    if (!open) {
      stopVoicePreview();
      stopBgmPreview();
    }
  }, [open, stopVoicePreview, stopBgmPreview]);

  useEffect(() => {
    if (isPaidMode) return;
    setRouting((prev) => ({
      ...prev,
      scriptModel: isPaidScriptModel(prev.scriptModel) ? freeScriptModel : prev.scriptModel,
      textModel: isPaidScriptModel(prev.textModel) ? freeScriptModel : (prev.textModel || freeScriptModel),
      sceneModel: isPaidScriptModel(prev.sceneModel) ? freeScriptModel : (prev.sceneModel || freeScriptModel),
      imagePromptModel: isPaidScriptModel(prev.imagePromptModel) ? freeScriptModel : (prev.imagePromptModel || freeScriptModel),
      motionPromptModel: isPaidScriptModel(prev.motionPromptModel) ? freeScriptModel : (prev.motionPromptModel || freeScriptModel),
      imageModel: isPaidImageModel(prev.imageModel) ? freeImageModel : (prev.imageModel || freeImageModel),
      imageProvider: 'sample',
      ttsProvider: 'qwen3Tts',
      audioProvider: 'qwen3Tts',
      backgroundMusicProvider: 'sample',
      videoProvider: 'sample',
      videoModel: isPaidVideoModel(prev.videoModel) ? freeVideoModel : (prev.videoModel || freeVideoModel),
      musicVideoProvider: 'sample',
      musicVideoMode: 'sample',
      backgroundMusicModel: prev.backgroundMusicModel.startsWith('elevenlabs') ? 'sample-ambient-v1' : prev.backgroundMusicModel,
    }));
  }, [isPaidMode]);

  const handleTogglePaidMode = useCallback(() => {
    setIsPaidMode((prev) => !prev);
  }, []);

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
      setProviderFeedback((prev) => ({ ...prev, [field]: result }));
      return result;
    } finally {
      setIsCheckingProviders((prev) => ({ ...prev, [field]: false }));
    }
  }, [providerValues]);

  const handleSave = async () => {
    if (!studioState) return;
    const googleApiKey = providerValues.openRouterApiKey.trim();
    const elevenLabsApiKey = providerValues.elevenLabsApiKey.trim();
    const nextScriptModel = !isPaidMode && isPaidScriptModel(routing.scriptModel) ? freeScriptModel : (routing.scriptModel || freeScriptModel);
    const nextPromptModel = !isPaidMode && isPaidScriptModel(routing.sceneModel) ? freeScriptModel : (routing.sceneModel || nextScriptModel);
    const nextImageModel = !isPaidMode && isPaidImageModel(routing.imageModel) ? freeImageModel : (routing.imageModel || freeImageModel);
    const nextVideoModel = !isPaidMode && isPaidVideoModel(routing.videoModel) ? freeVideoModel : (routing.videoModel || freeVideoModel);
    const wantsElevenTts = isPaidMode && routing.ttsProvider === 'elevenLabs' && Boolean(elevenLabsApiKey);
    const wantsElevenBgm = isPaidMode && routing.backgroundMusicProvider === 'elevenLabs' && Boolean(elevenLabsApiKey);
    const wantsPaidImage = isPaidMode && nextImageModel !== freeImageModel && Boolean(googleApiKey);
    const wantsPaidVideo = isPaidMode && nextVideoModel !== freeVideoModel && Boolean(googleApiKey);

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
      backgroundMusicProvider: wantsElevenBgm ? 'elevenLabs' : 'sample',
      videoProvider: wantsPaidVideo ? 'elevenLabs' : 'sample',
      videoModel: nextVideoModel,
      musicVideoProvider: wantsPaidVideo ? 'elevenLabs' : 'sample',
      musicVideoMode: wantsPaidVideo ? 'auto' : 'sample',
      backgroundMusicModel: wantsElevenBgm ? routing.backgroundMusicModel : (isElevenLabsBgmModel(routing.backgroundMusicModel) ? 'sample-ambient-v1' : routing.backgroundMusicModel),
    } as StudioState['routing'];

    await onSave({
      storageDir,
      isStorageConfigured: Boolean(storageDir.trim()),
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
    onClose();
  };

  if (!open || !studioState) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-950/30 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-slate-50 px-5 pb-32 pt-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">제작 설정</div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Google AI Studio / ElevenLabs 연결 설정</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">mp4Creater 안에서만 텍스트, 이미지, 영상, 음성 생성의 기본 연결과 샘플 모드를 관리합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">닫기</button>
        </div>

        <div className="mt-5 grid gap-4">
          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">저장 위치</h3>
                <p className="mt-1 text-xs text-slate-600">프로젝트 JSON 저장소와 생성 결과 메타데이터를 저장할 기본 위치입니다.</p>
              </div>
              <button type="button" onClick={handleFolderPick} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">폴더 선택</button>
            </div>
            <input value={storageDir} onChange={(e) => setStorageDir(e.target.value)} className={`${inputClass} mt-3`} placeholder="./local-data/tubegen-studio" />
            {pickedFolderLabel ? <p className="mt-2 text-xs text-slate-500">선택한 위치: {pickedFolderLabel}</p> : null}
          </section>

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">API 연결</h3>
                <p className="mt-1 text-xs text-slate-600">Google AI Studio는 텍스트, 이미지, 영상 생성에 사용하고 ElevenLabs는 음성과 음악 샘플 고도화에 사용합니다.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">Google AI Studio API 키</div>
                <div className="mt-1 text-[11px] text-slate-500">Gemini 텍스트/이미지와 Veo 영상 생성 연결에 공통 사용합니다.</div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type={showSecrets.openRouterApiKey ? 'text' : 'password'}
                    value={providerValues.openRouterApiKey}
                    onChange={(e) => setProviderValues((prev) => ({ ...prev, openRouterApiKey: e.target.value }))}
                    className={inputClass}
                    placeholder="AIza..."
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
                {providerFeedback.openRouterApiKey?.message ? <p className="mt-2 text-xs text-slate-500">{providerFeedback.openRouterApiKey.message}</p> : null}
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
                    placeholder="sk_... 또는 xi-..."
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
                {providerFeedback.elevenLabsApiKey?.message ? <p className="mt-2 text-xs text-slate-500">{providerFeedback.elevenLabsApiKey.message}</p> : null}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">기본 API 선택</h3>
                <p className="mt-1 text-xs text-slate-600">무료 모드는 샘플과 무료 모델만 보이고, 유료 모드를 켜면 무료 모델과 유료 모델을 함께 선택할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={handleTogglePaidMode}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${isPaidMode ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                {isPaidMode ? '유료모드 끄기' : '유료모드 켜기'}
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">음성</div>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">음성 공급자</div>
                  <select value={routing.ttsProvider === 'elevenLabs' && isPaidMode ? 'elevenLabs' : 'qwen3Tts'} onChange={(e) => setRouting((prev) => ({ ...prev, ttsProvider: e.target.value as 'qwen3Tts' | 'elevenLabs', audioProvider: e.target.value as 'qwen3Tts' | 'elevenLabs' }))} className={inputClass}>
                    <option value="qwen3Tts">🆓 qwen3-tts</option>
                    {isPaidMode ? <option value="elevenLabs">ElevenLabs</option> : null}
                  </select>
                </label>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">qwen3-tts 보이스 프리셋</div>
                  <select value={routing.qwenVoicePreset || 'qwen-default'} onChange={(e) => setRouting((prev) => ({ ...prev, qwenVoicePreset: e.target.value, ttsNarratorId: e.target.value }))} className={inputClass}>
                    {QWEN_TTS_PRESET_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                {routing.ttsProvider === 'elevenLabs' ? (
                  <>
                    <label className="mt-2 block">
                      <div className="mb-1 text-xs font-bold text-slate-700">ElevenLabs 보이스</div>
                      <select value={routing.elevenLabsVoiceId || selectedElevenVoice?.voice_id || CONFIG.DEFAULT_VOICE_ID} onChange={(e) => setRouting((prev) => ({ ...prev, elevenLabsVoiceId: e.target.value }))} className={inputClass}>
                        {elevenLabsVoices.map((item) => <option key={item.voice_id} value={item.voice_id}>{item.name}</option>)}
                      </select>
                    </label>
                    <label className="mt-2 block">
                      <div className="mb-1 text-xs font-bold text-slate-700">ElevenLabs 모델</div>
                      <select value={routing.elevenLabsModelId || routing.audioModel || CONFIG.DEFAULT_ELEVENLABS_MODEL} onChange={(e) => setRouting((prev) => ({ ...prev, elevenLabsModelId: e.target.value, audioModel: e.target.value }))} className={inputClass}>
                        {ELEVENLABS_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                  </>
                ) : null}
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                  {routing.ttsProvider === 'elevenLabs'
                    ? `현재 기본 보이스: ${selectedElevenVoice?.name || 'ElevenLabs 기본 보이스'}${selectedElevenVoice?.labels?.gender ? ` · ${selectedElevenVoice.labels.gender}` : ''}`
                    : `현재 기본 보이스: ${QWEN_TTS_PRESET_OPTIONS.find((item) => item.id === (routing.qwenVoicePreset || 'qwen-default'))?.name || 'qwen3-tts 기본 보이스'}`}
                </div>
                <button type="button" onClick={() => void playVoicePreview()} className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                  {isVoicePreviewing ? '음성 정지' : '음성 재생'}
                </button>
                {voicePreviewMessage ? <p className="mt-2 text-xs text-slate-500">{voicePreviewMessage}</p> : null}
                {routing.ttsProvider === 'elevenLabs' && !providerValues.elevenLabsApiKey.trim() ? (
                  <p className="mt-2 text-xs text-amber-600">선택한 음성 모델은 API 연결이 필요합니다. API 등록 후 다시 시도해 주세요.</p>
                ) : null}
                {isLoadingVoices ? <p className="mt-2 text-xs text-slate-500">보이스 목록을 불러오는 중입니다.</p> : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">배경 음악</div>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">배경 음악 모델</div>
                  <select
                    value={routing.backgroundMusicModel || 'sample-ambient-v1'}
                    onChange={(e) => {
                      const nextModel = e.target.value;
                      setRouting((prev) => ({
                        ...prev,
                        backgroundMusicModel: nextModel,
                        backgroundMusicProvider: isElevenLabsBgmModel(nextModel) ? 'elevenLabs' : 'sample',
                      }));
                    }}
                    className={inputClass}
                  >
                    {BGM_MODEL_OPTIONS.filter((item) => isPaidMode || !item.id.startsWith('elevenlabs')).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id.startsWith('elevenlabs') ? item.name : `🆓 ${item.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => void playBgmPreview()} className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                  {isBgmPreviewing ? '배경 음악 정지' : '배경 음악 재생'}
                </button>
                {bgmPreviewMessage ? <p className="mt-2 text-xs text-slate-500">{bgmPreviewMessage}</p> : null}
                {isElevenLabsBgmModel(routing.backgroundMusicModel) && !providerValues.elevenLabsApiKey.trim() ? (
                  <p className="mt-2 text-xs text-amber-600">선택한 배경 음악 모델은 API 연결이 필요합니다. API 등록 후 다시 시도해 주세요.</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">텍스트 · 이미지 · 영상 모델</h3>
                <p className="mt-1 text-xs text-slate-600">Google AI Studio 모델은 무료/유료를 구분해 드롭다운으로 제공합니다. 무료 API가 없는 항목은 샘플 모델로 최종 출력까지 테스트할 수 있습니다.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isPaidMode ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {isPaidMode ? '무료 + 유료 표시' : '무료만 표시'}
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">텍스트 생성 모델</div>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">대본 생성</div>
                  <select
                    value={visibleScriptModels.some((item) => item.id === (routing.scriptModel || routing.textModel)) ? (routing.scriptModel || routing.textModel || freeScriptModel) : freeScriptModel}
                    onChange={(e) => setRouting((prev) => ({ ...prev, scriptModel: e.target.value, textModel: e.target.value }))}
                    className={inputClass}
                  >
                    {visibleScriptModels.map((item) => <option key={`script-${item.id}`} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </label>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">프롬프트 생성</div>
                  <select
                    value={visibleScriptModels.some((item) => item.id === (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel)) ? (routing.sceneModel || routing.imagePromptModel || routing.motionPromptModel || freeScriptModel) : freeScriptModel}
                    onChange={(e) => setRouting((prev) => ({
                      ...prev,
                      sceneModel: e.target.value,
                      imagePromptModel: e.target.value,
                      motionPromptModel: e.target.value,
                    }))}
                    className={inputClass}
                  >
                    {visibleScriptModels.map((item) => <option key={`prompt-${item.id}`} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </label>
                {!providerValues.openRouterApiKey.trim() ? (
                  <p className="mt-2 text-xs text-amber-600">Google AI Studio 키가 없어도 샘플/무료 흐름 점검은 가능하지만, 실제 호출은 키를 저장해야 적용됩니다.</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">저장 후 현재 프로젝트에서 선택 모델이 바로 반영됩니다.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-900">이미지 · 영상 생성 모델</div>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">이미지 모델</div>
                  <select
                    value={visibleImageModels.some((item) => item.id === routing.imageModel) ? (routing.imageModel || freeImageModel) : freeImageModel}
                    onChange={(e) => setRouting((prev) => ({
                      ...prev,
                      imageModel: e.target.value,
                      imageProvider: e.target.value === freeImageModel ? 'sample' : 'openrouter',
                    }))}
                    className={inputClass}
                  >
                    {visibleImageModels.map((item) => <option key={item.id} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </label>
                <label className="mt-2 block">
                  <div className="mb-1 text-xs font-bold text-slate-700">영상 모델</div>
                  <select
                    value={visibleVideoModels.some((item) => item.id === routing.videoModel) ? (routing.videoModel || freeVideoModel) : freeVideoModel}
                    onChange={(e) => setRouting((prev) => ({ ...prev, videoModel: e.target.value, videoProvider: e.target.value === freeVideoModel ? 'sample' : 'elevenLabs' }))}
                    className={inputClass}
                  >
                    {visibleVideoModels.map((item) => <option key={item.id} value={item.id}>{item.tier === 'paid' ? `💳 ${item.name}` : `🆓 ${item.name}`}</option>)}
                  </select>
                </label>
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                  무료 API가 없는 항목은 샘플 모델로도 화면 흐름, 씬 생성, 최종 출력 테스트가 되도록 유지됩니다.
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="fixed bottom-0 right-0 z-[95] w-full max-w-3xl border-l border-t border-slate-300 bg-slate-200/95 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">취소</button>
            <button type="button" onClick={handleSave} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
