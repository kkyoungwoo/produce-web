'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONFIG } from '../config';
import {
  AiPickerOption,
  getElevenLabsVoicePickerOptions,
  getQwenVoicePickerOptions,
  getTtsModelPickerOptions,
} from '../services/aiOptionCatalog';
import { resolveGoogleAiStudioApiKey } from '../services/googleAiStudioService';
import { createTtsPreview } from '../services/ttsService';

export type TtsSelectionProvider = 'qwen3Tts' | 'elevenLabs';

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  labels?: { accent?: string; gender?: string; description?: string };
};

type TtsSelectionStep = 'model' | 'voice';

export interface TtsSelectionResult {
  provider: TtsSelectionProvider;
  modelId?: string | null;
  voiceId?: string | null;
}

interface TtsSelectionModalProps {
  open: boolean;
  title: string;
  currentProvider: TtsSelectionProvider;
  currentModelId?: string | null;
  currentVoiceId?: string | null;
  googleApiKey?: string | null;
  elevenLabsApiKey?: string | null;
  hasElevenLabsApiKey?: boolean;
  allowPaid?: boolean;
  elevenLabsVoices?: ElevenLabsVoice[];
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
  voiceReferenceName?: string | null;
  extraVoicePanel?: React.ReactNode;
  onApply: (selection: TtsSelectionResult) => void;
  onClose: () => void;
}

const toneClassMap: Record<NonNullable<AiPickerOption['tone']>, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
};

const avatarToneClassMap: Record<NonNullable<AiPickerOption['tone']>, string> = {
  slate: 'from-slate-700 to-slate-500',
  blue: 'from-blue-700 to-cyan-500',
  violet: 'from-violet-700 to-fuchsia-500',
  emerald: 'from-emerald-700 to-teal-500',
  amber: 'from-amber-600 to-orange-500',
  rose: 'from-rose-700 to-pink-500',
};

const clampStyle: React.CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 4,
  overflow: 'hidden',
};

const modelGroupOrder: Array<NonNullable<AiPickerOption['group']>> = [
  'sample',
  'free',
  'budget',
  'premium',
  'provider',
  'voice',
];

const modelGroupLabels: Record<NonNullable<AiPickerOption['group']>, string> = {
  sample: '샘플',
  free: '최소 비용',
  budget: '중간 비용',
  premium: '고비용',
  provider: '모델 계열',
  voice: '목소리',
};

const modelGroupDescriptions: Record<NonNullable<AiPickerOption['group']>, string> = {
  sample: '실행 전 흐름 확인용 카드입니다.',
  free: '비용을 가장 아끼면서 바로 시작하기 좋은 모델입니다.',
  budget: '비용과 품질의 균형을 잡아 쓰기 좋은 모델입니다.',
  premium: '품질을 우선하고 비용 여유가 있을 때 보는 상위 모델입니다.',
  provider: '연동 계열 설명용 카드입니다.',
  voice: '목소리 전용 카드입니다.',
};

function formatStageLabel(value?: string | null) {
  if (value === '무료') return '최소 비용';
  if (value === '유료' || value === '보통') return '중간 비용';
  if (value === '프리미엄') return '고비용';
  return value || '';
}

function buildModelOptionId(provider: TtsSelectionProvider, modelId?: string | null) {
  if (provider === 'elevenLabs') return `elevenLabs:${modelId || CONFIG.DEFAULT_ELEVENLABS_MODEL}`;
  return 'qwen3Tts:qwen3-free';
}

function parseModelOptionId(value: string): { provider: TtsSelectionProvider; modelId: string | null } {
  const [providerRaw, modelRaw] = `${value || ''}`.split(':');
  const provider = providerRaw === 'elevenLabs'
    ? 'elevenLabs'
    : 'qwen3Tts';

  if (provider === 'elevenLabs') {
    return { provider, modelId: modelRaw || CONFIG.DEFAULT_ELEVENLABS_MODEL };
  }
  return { provider, modelId: null };
}

function resolveDefaultVoiceId(
  provider: TtsSelectionProvider,
  elevenLabsVoices: ElevenLabsVoice[],
  options?: { currentVoiceId?: string | null },
) {
  if (provider === 'elevenLabs') return elevenLabsVoices[0]?.voice_id || CONFIG.DEFAULT_VOICE_ID;
  const currentId = `${options?.currentVoiceId || ''}`.trim();
  return getQwenVoicePickerOptions().some((item) => item.id === currentId) ? currentId : 'qwen-default';
}

function resolveVoiceOptions(
  provider: TtsSelectionProvider,
  elevenLabsVoices: ElevenLabsVoice[],
  _options?: { voiceReferenceAudioData?: string | null; voiceReferenceName?: string | null },
) {
  if (provider === 'elevenLabs') return getElevenLabsVoicePickerOptions(elevenLabsVoices);
  return getQwenVoicePickerOptions();
}

function buildSpeechPreviewText(option: AiPickerOption) {
  return `${option.title || '선택한 목소리'} 음성 미리듣기입니다. 안녕하세요. 지금 선택한 목소리를 확인하고 있습니다.`;
}

function resolveVoiceLabel(
  provider: TtsSelectionProvider,
  voiceId: string,
  elevenLabsVoices: ElevenLabsVoice[],
  options?: { voiceReferenceAudioData?: string | null; voiceReferenceName?: string | null },
) {
  const option = resolveVoiceOptions(provider, elevenLabsVoices, options).find((item) => item.id === voiceId);
  return option?.title || '기본 목소리';
}

function normalizeAudioPreviewSource(source?: string | null) {
  const value = `${source || ''}`.trim();
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `data:audio/mpeg;base64,${value}`;
}

function buildSpeechPreviewFallbackText(
  provider: TtsSelectionProvider,
  voiceId: string,
  elevenLabsVoices: ElevenLabsVoice[],
  options?: { voiceReferenceAudioData?: string | null; voiceReferenceName?: string | null },
) {
  const label = resolveVoiceLabel(provider, voiceId, elevenLabsVoices, options);
  return `안녕하세요. ${label} 목소리 미리듣기입니다. 지금 선택한 음성을 확인하고 있습니다.`;
}

export default function TtsSelectionModal({
  open,
  title,
  currentProvider,
  currentModelId,
  currentVoiceId,
  googleApiKey,
  elevenLabsApiKey,
  hasElevenLabsApiKey = false,
  allowPaid = true,
  elevenLabsVoices = [],
  voiceReferenceAudioData,
  voiceReferenceMimeType,
  voiceReferenceName,
  extraVoicePanel,
  onApply,
  onClose,
}: TtsSelectionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<TtsSelectionStep>('model');
  const [provider, setProvider] = useState<TtsSelectionProvider>('qwen3Tts');
  const [modelId, setModelId] = useState<string>(CONFIG.DEFAULT_ELEVENLABS_MODEL);
  const [voiceId, setVoiceId] = useState('qwen-default');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const openedRef = useRef(false);

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      previewSpeechRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modelOptions = useMemo(() => (
    getTtsModelPickerOptions({
      allowPaid,
      hasGoogleApiKey: Boolean(resolveGoogleAiStudioApiKey(googleApiKey)),
      hasElevenLabsApiKey,
      elevenLabsVoices,
    }).filter((item) => !item.id.startsWith('heygen:'))
  ), [allowPaid, elevenLabsVoices, googleApiKey, hasElevenLabsApiKey]);

  useEffect(() => {
    if (!open) {
      stopPreview();
      openedRef.current = false;
      return;
    }
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;

    const preferredModelOptionId = buildModelOptionId(currentProvider, currentModelId);
    const safeModelOptionId = modelOptions.some((item) => item.id === preferredModelOptionId)
      ? preferredModelOptionId
      : (modelOptions[0]?.id || buildModelOptionId('qwen3Tts', null));
    const resolved = parseModelOptionId(safeModelOptionId);

    setProvider(resolved.provider);
    setModelId(resolved.modelId || CONFIG.DEFAULT_ELEVENLABS_MODEL);
    setVoiceId(currentVoiceId || resolveDefaultVoiceId(resolved.provider, elevenLabsVoices, {
      currentVoiceId,
    }));
    setPreviewMessage('');
    setStep('model');
  }, [currentModelId, currentProvider, currentVoiceId, elevenLabsVoices, modelOptions, open, stopPreview, voiceReferenceAudioData]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const currentModelOptionId = buildModelOptionId(provider, modelId);
  const selectedModelOption = modelOptions.find((item) => item.id === currentModelOptionId) || modelOptions[0] || null;
  const voiceOptions = useMemo(
    () => resolveVoiceOptions(provider, elevenLabsVoices),
    [elevenLabsVoices, provider],
  );
  const selectedVoiceOption = voiceOptions.find((item) => item.id === voiceId) || voiceOptions[0] || null;
  const canSaveVoice = Boolean(selectedVoiceOption?.id);
  const groupedModelOptions = useMemo(
    () => modelGroupOrder
      .map((group) => ({
        group,
        label: modelGroupLabels[group],
        description: modelGroupDescriptions[group],
        items: modelOptions.filter((item) => (item.group || 'sample') === group),
      }))
      .filter((section) => section.items.length > 0),
    [modelOptions],
  );

  useEffect(() => {
    if (!open || !voiceOptions.length) return;
    if (voiceOptions.some((item) => item.id === voiceId)) return;
    setVoiceId(selectedVoiceOption?.id || '');
  }, [open, selectedVoiceOption?.id, voiceId, voiceOptions]);

  const handlePreviewVoice = useCallback(async (option: AiPickerOption) => {
    if (previewingId === option.id) {
      stopPreview();
      setPreviewMessage('음성 재생을 멈췄습니다.');
      return;
    }

    stopPreview();
    setPreviewingId(option.id);
    setPreviewMessage(`${option.title} 음성 미리듣기를 준비하고 있습니다...`);

    try {
      const resolvedGoogleKey = resolveGoogleAiStudioApiKey(googleApiKey);
      const shouldUseSpeechFallback = provider === 'qwen3Tts' && !resolvedGoogleKey;

      if (shouldUseSpeechFallback) {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          setPreviewingId(null);
          setPreviewMessage('이 브라우저에서는 음성 미리듣기를 지원하지 않습니다.');
          return;
        }
        const utterance = new SpeechSynthesisUtterance(buildSpeechPreviewText(option));
        utterance.lang = 'ko-KR';
        utterance.rate = provider === 'qwen3Tts' ? 1 : 0.96;
        utterance.pitch = option.id === 'qwen-soft' ? 1.08 : 0.96;
        const voices = window.speechSynthesis.getVoices();
        const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('ko'));
        const preferredVoice = option.id === 'qwen-soft'
          ? (koreanVoices.find((voice) => /female|woman|yuna|sunhi/i.test(`${voice.name} ${voice.voiceURI}`)) || koreanVoices[0])
          : (koreanVoices.find((voice) => /male|man|inho|hyunsu/i.test(`${voice.name} ${voice.voiceURI}`)) || koreanVoices[0]);
        if (preferredVoice) utterance.voice = preferredVoice;
        previewSpeechRef.current = utterance;
        utterance.onend = () => {
          setPreviewingId(null);
          setPreviewMessage(`${option.title} 음성 미리듣기가 끝났습니다.`);
        };
        utterance.onerror = () => {
          setPreviewingId(null);
          setPreviewMessage(`${option.title} 음성 미리듣기에 실패했습니다.`);
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setPreviewMessage(`${option.title} 음성을 재생 중입니다.`);
        return;
      }

      const { asset } = await createTtsPreview({
        provider,
        title: `${title} ?? ??`,
        text: '안녕하세요. 지금 선택한 목소리를 확인하고 있습니다.',
        mode: 'voice-preview',
        apiKey: provider === 'elevenLabs' ? (elevenLabsApiKey || undefined) : undefined,
        googleApiKey: provider === 'qwen3Tts' ? (resolvedGoogleKey || undefined) : undefined,
        voiceId: option.id,
        modelId: provider === 'elevenLabs' ? (modelId || CONFIG.DEFAULT_ELEVENLABS_MODEL) : undefined,
        qwenPreset: provider === 'qwen3Tts' ? option.id : undefined,
        locale: 'ko',
        voiceReferenceAudioData: undefined,
        voiceReferenceMimeType: undefined,
      });

      const resolvedPreview = normalizeAudioPreviewSource(asset.audioData)
        || (asset.sourceMode === 'sample' && provider === 'qwen3Tts'
          ? `__speech__:${encodeURIComponent(buildSpeechPreviewFallbackText(provider, option.id, elevenLabsVoices, {
            voiceReferenceAudioData,
            voiceReferenceName,
          }))}`
          : '');

      if (!resolvedPreview) {
        setPreviewingId(null);
        setPreviewMessage('음성 데이터를 준비하지 못했습니다.');
        return;
      }

      if (resolvedPreview.startsWith('__speech__:')) {
        const text = decodeURIComponent(resolvedPreview.replace('__speech__:', ''));
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          setPreviewingId(null);
          setPreviewMessage('이 브라우저에서는 음성 미리듣기를 지원하지 않습니다.');
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1;
        utterance.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const koreanVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('ko'));
        if (koreanVoice) utterance.voice = koreanVoice;
        previewSpeechRef.current = utterance;
        utterance.onend = () => {
          setPreviewingId(null);
          setPreviewMessage(`${option.title} 음성 미리듣기가 끝났습니다.`);
        };
        utterance.onerror = () => {
          setPreviewingId(null);
          setPreviewMessage(`${option.title} 음성 미리듣기에 실패했습니다.`);
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setPreviewMessage(`${option.title} 음성을 재생 중입니다.`);
        return;
      }

      const audio = new Audio(resolvedPreview);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingId(null);
        setPreviewMessage(`${option.title} 음성 미리듣기가 끝났습니다.`);
      };
      audio.onerror = () => {
        setPreviewingId(null);
        setPreviewMessage(`${option.title} 음성 미리듣기에 실패했습니다.`);
      };
      await audio.play();
      setPreviewMessage(`${option.title} 음성을 재생 중입니다.`);
    } catch {
      setPreviewingId(null);
      setPreviewMessage(`${option.title} 음성 미리듣기에 실패했습니다.`);
    }
  }, [
    elevenLabsApiKey,
    elevenLabsVoices,
    googleApiKey,
    modelId,
    previewingId,
    provider,
    stopPreview,
    title,
    voiceReferenceAudioData,
    voiceReferenceName,
  ]);

  const handleModelSelect = useCallback((optionId: string) => {
    const nextOption = modelOptions.find((item) => item.id === optionId);
    if (!nextOption || nextOption.disabled) return;
    const resolved = parseModelOptionId(optionId);
    stopPreview();
    setPreviewMessage('');
    setProvider(resolved.provider);
    setModelId(resolved.modelId || CONFIG.DEFAULT_ELEVENLABS_MODEL);
    setVoiceId(resolveDefaultVoiceId(resolved.provider, elevenLabsVoices, {
      currentVoiceId,
    }));
    setStep('voice');
  }, [currentVoiceId, elevenLabsVoices, modelOptions, stopPreview]);

  const handleSave = useCallback(() => {
    if (!selectedVoiceOption) return;
    onApply({
      provider,
      modelId: provider === 'elevenLabs' ? (modelId || CONFIG.DEFAULT_ELEVENLABS_MODEL) : null,
      voiceId: selectedVoiceOption.id,
    });
    onClose();
  }, [modelId, onApply, onClose, provider, selectedVoiceOption]);

  const renderModelCard = useCallback((option: AiPickerOption) => {
    const selected = option.id === currentModelOptionId;
    const disabled = Boolean(option.disabled);
    const tone = option.tone || 'slate';
    const cardClassName = `flex h-full min-h-[280px] flex-col rounded-[28px] border p-5 text-left transition-all ${
      disabled
        ? 'border-slate-200 bg-slate-100/90 opacity-70'
        : selected
          ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/80'
    }`;
    const cardContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white ${avatarToneClassMap[tone]}`}>
            {option.avatarLabel || 'AI'}
          </div>
          <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${toneClassMap[tone]}`}>
            {formatStageLabel(option.badge)}
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-3">
          <div>
            <div className="text-lg font-black text-slate-900">{option.title}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{option.provider}</div>
          </div>

          <p className="text-sm leading-6 text-slate-600" style={clampStyle}>{option.description}</p>

          <div className="grid grid-cols-2 gap-2 text-[11px] leading-5 text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-bold text-slate-500">비용 단계</div>
              <div className="mt-1 font-black text-slate-900">{formatStageLabel(option.priceLabel)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-bold text-slate-500">품질 톤</div>
              <div className="mt-1 font-black text-slate-900">{option.qualityLabel}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-black text-slate-700">
            {option.speedLabel ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.speedLabel}</span> : null}
            {option.costHint ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.costHint}</span> : null}
          </div>

          {option.helper ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              {option.helper}
            </div>
          ) : null}

          {disabled && option.disabledReason ? (
            <div className="rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-500">
              {option.disabledReason}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <span className="text-xs font-bold text-slate-400">
            {disabled ? '지금은 선택할 수 없음' : selected ? '현재 적용된 모델' : '이 모델의 목소리 보기'}
          </span>
          <span className={`rounded-full px-3 py-2 text-[11px] font-black ${
            disabled
              ? 'bg-slate-300 text-slate-500'
              : selected
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-white'
          }`}>
            {disabled ? '선택 불가' : selected ? '선택됨' : '목소리 보기'}
          </span>
        </div>
      </>
    );

    return disabled ? (
      <div key={option.id} className={cardClassName}>
        {cardContent}
      </div>
    ) : (
      <button
        key={option.id}
        type="button"
        onClick={() => handleModelSelect(option.id)}
        className={cardClassName}
      >
        {cardContent}
      </button>
    );
  }, [currentModelOptionId, handleModelSelect]);

  const extraPanel = null;

  if (!open || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
                {step === 'model' ? '1. TTS 모델 선택' : '2. 목소리 선택'}
              </div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {step === 'model'
                  ? '다른 API 선택 모달과 같은 카드 규칙으로 최소 비용 / 중간 비용 / 고비용 TTS 모델을 먼저 고르고, 이어서 해당 모델의 실제 목소리를 확인합니다. 저장 가능한 샘플 TTS는 없고, 무료 미리듣기 fallback만 브라우저 음성으로 동작합니다.'
                  : '선택한 모델 안에서 실제로 사용할 목소리를 고르세요. 미리듣기 후 저장하면 현재 설정에 바로 반영됩니다.'}
              </p>
              {previewMessage ? <p className="mt-3 text-xs font-bold text-slate-500">{previewMessage}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 'model' ? (
            <>
              <div className="space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">모델 선택 규칙</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    최소 비용 / 중간 비용 / 고비용 구간으로 나눠서 보여주며, API가 연결되지 않은 모델은 회색으로 잠겨 있습니다.
                    저장 가능한 샘플 TTS 런타임은 없고, 무료 미리듣기 실패 시에만 브라우저 음성으로 fallback 합니다.
                  </div>
                </div>

                {groupedModelOptions.map((section) => (
                  <section key={section.group} className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{section.label}</div>
                        <div className="mt-1 text-sm text-slate-500">{section.description}</div>
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                        {section.items.length}개 모델
                      </div>
                    </div>

                    <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 xl:grid-cols-3">
                      {section.items.map((option) => renderModelCard(option))}
                    </div>
                  </section>
                ))}
              </div>

              {false && (
                <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {modelOptions.map((option) => {
                const selected = option.id === currentModelOptionId;
                const disabled = Boolean(option.disabled);
                const tone = option.tone || 'slate';
                const cardClassName = `flex h-full min-h-[280px] flex-col rounded-[28px] border p-5 text-left transition-all ${
                  disabled
                    ? 'border-slate-200 bg-slate-100/90 opacity-70'
                    : selected
                      ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/80'
                }`;
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white ${avatarToneClassMap[tone]}`}>
                        {option.avatarLabel || 'AI'}
                      </div>
                      <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${toneClassMap[tone]}`}>
                        {formatStageLabel(option.badge)}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-1 flex-col gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900">{option.title}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{option.provider}</div>
                      </div>

                      <p className="text-sm leading-6 text-slate-600" style={clampStyle}>{option.description}</p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] leading-5 text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="font-bold text-slate-500">비용 수준</div>
                          <div className="mt-1 font-black text-slate-900">{formatStageLabel(option.priceLabel)}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="font-bold text-slate-500">목소리 수</div>
                          <div className="mt-1 font-black text-slate-900">{option.helper?.replace('선택 가능한 목소리 ', '') || '-'}</div>
                        </div>
                      </div>

                      {disabled && option.disabledReason ? (
                        <div className="rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-500">
                          {option.disabledReason}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                      <span className="text-xs font-bold text-slate-400">
                        {disabled ? '현재 선택할 수 없음' : selected ? '현재 저장된 모델' : '이 모델의 목소리 보기'}
                      </span>
                      <span className={`rounded-full px-3 py-2 text-[11px] font-black ${
                        disabled
                          ? 'bg-slate-300 text-slate-500'
                          : selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-white'
                      }`}>
                        {disabled ? '선택 불가' : selected ? '선택됨' : '목소리 보기'}
                      </span>
                    </div>
                  </>
                );
                return (
                  disabled ? (
                    <div key={option.id} className={cardClassName}>
                      {cardContent}
                    </div>
                  ) : (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleModelSelect(option.id)}
                      className={cardClassName}
                    >
                      {cardContent}
                    </button>
                  )
                );
              })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택한 모델</div>
                    <div className="mt-1 text-lg font-black text-slate-900">{selectedModelOption?.title || 'TTS 모델'}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {selectedModelOption?.description || '이 모델에서 실제로 사용할 목소리를 선택해 주세요.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopPreview();
                      setPreviewMessage('');
                      setStep('model');
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    이전으로
                  </button>
                </div>
              </div>

              {!voiceOptions.length ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  선택 가능한 목소리가 아직 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">목소리 목록</div>
                      <div className="mt-1 text-sm text-slate-500">선택한 모델 안에서 실제 저장할 목소리를 미리듣기 후 고르세요.</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                      {voiceOptions.length}개 목소리
                    </div>
                  </div>

                  {voiceOptions.map((option) => {
                    const selected = option.id === selectedVoiceOption?.id;
                    const tone = option.tone || 'slate';
                    const disabled = Boolean(option.disabled);
                    return (
                      <div
                        key={option.id}
                        role={disabled ? undefined : 'button'}
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => {
                          if (!disabled) setVoiceId(option.id);
                        }}
                        onKeyDown={(event) => {
                          if (disabled) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setVoiceId(option.id);
                          }
                        }}
                        className={`rounded-[28px] border p-5 transition-all ${
                          disabled
                            ? 'border-slate-200 bg-slate-100/90 opacity-70'
                            : selected
                              ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                              : 'border-slate-200 bg-white cursor-pointer hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white ${avatarToneClassMap[tone]}`}>
                              {option.avatarLabel || 'VO'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-black text-slate-900">{option.title}</div>
                                <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${toneClassMap[tone]}`}>
                                  {formatStageLabel(option.badge)}
                                </div>
                              </div>
                              <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{option.provider}</div>
                              <p className="mt-3 text-sm leading-6 text-slate-600">{option.description}</p>
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-700">
                                {option.genderLabel ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.genderLabel}</span> : null}
                                {option.voiceToneLabel ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.voiceToneLabel}</span> : null}
                                <span className="rounded-full bg-slate-100 px-3 py-1">{formatStageLabel(option.priceLabel)}</span>
                              </div>
                              {disabled && option.disabledReason ? (
                                <div className="mt-3 rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-500">
                                  {option.disabledReason}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[240px] lg:justify-end">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handlePreviewVoice(option);
                              }}
                              disabled={disabled}
                              className={`rounded-full px-3 py-2 text-[11px] font-black ${
                                previewingId === option.id
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                            >
                              {previewingId === option.id ? '듣기 중지' : '음성 듣기'}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!disabled) setVoiceId(option.id);
                              }}
                              disabled={disabled}
                              className={`rounded-full px-3 py-2 text-[11px] font-black ${
                                disabled
                                  ? 'bg-slate-300 text-slate-500'
                                  : selected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-900 text-white hover:bg-slate-700'
                              } disabled:cursor-not-allowed`}
                            >
                              {disabled ? '선택 불가' : selected ? '선택됨' : '이 목소리 선택'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {extraPanel ? (
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
                  {extraPanel}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                {step === 'model' ? '다음 단계' : '선택 예정'}
              </div>
              <div className="mt-1 text-sm font-black text-slate-900">
                {step === 'model'
                  ? '최소 비용 / 중간 비용 / 고비용 모델 중 하나를 고르면 바로 해당 목소리 목록으로 이동합니다.'
                  : `${selectedModelOption?.title || 'TTS 모델'} · ${selectedVoiceOption?.title || '목소리를 선택해 주세요'}`}
              </div>
              {step === 'voice' ? (
                <div className="mt-1 text-xs text-slate-500">
                  목소리를 들은 뒤 저장하면 현재 설정에 바로 적용됩니다.
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {step === 'voice' ? (
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    setPreviewMessage('');
                    setStep('model');
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  이전으로
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
              {step === 'voice' ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSaveVoice}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  이 목소리 저장하기
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
