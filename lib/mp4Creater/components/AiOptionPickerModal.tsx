'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AiPickerOption } from '../services/aiOptionCatalog';

interface AiOptionPickerModalProps {
  open: boolean;
  title: string;
  description?: string;
  currentId?: string | null;
  options: AiPickerOption[];
  onClose: () => void;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  requireConfirm?: boolean;
  confirmLabel?: string;
  closeAfterConfirm?: boolean;
  onPreviewOption?: (id: string) => Promise<string | null | undefined> | string | null | undefined;
  extraPanel?: React.ReactNode;
  cardVariant?: 'default' | 'tts-model' | 'tts-voice';
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
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

export default function AiOptionPickerModal({
  open,
  title,
  description,
  currentId,
  options,
  onClose,
  onSelect,
  emptyMessage = '선택할 수 있는 옵션이 아직 없습니다.',
  requireConfirm = false,
  confirmLabel = '선택하기',
  closeAfterConfirm = true,
  onPreviewOption,
  extraPanel,
  cardVariant = 'default',
  secondaryActionLabel,
  onSecondaryAction,
}: AiOptionPickerModalProps) {
  const [pendingId, setPendingId] = useState(currentId || options[0]?.id || '');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopPreview = () => {
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
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      stopPreview();
      return;
    }
    setPendingId(currentId || options[0]?.id || '');
    setPreviewMessage('');
  }, [currentId, open, options]);

  useEffect(() => () => stopPreview(), []);

  if (!open || !mounted) return null;

  const activeId = requireConfirm ? pendingId : currentId;
  const pendingOption = options.find((option) => option.id === pendingId) || null;
  const canConfirm = Boolean(pendingId) && !pendingOption?.disabled;

  const handleOptionClick = (id: string) => {
    const nextOption = options.find((option) => option.id === id);
    if (nextOption?.disabled) return;
    if (requireConfirm) {
      setPendingId(id);
      return;
    }
    onSelect(id);
    if (closeAfterConfirm) onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm || !pendingId) return;
    onSelect(pendingId);
    if (closeAfterConfirm) onClose();
  };

  const handlePreview = async (option: AiPickerOption) => {
    if (previewingId === option.id) {
      stopPreview();
      setPreviewMessage('미리듣기를 멈췄습니다.');
      return;
    }

    stopPreview();
    setPreviewingId(option.id);
    setPreviewMessage(`${option.title} 미리듣기를 준비하고 있습니다...`);

    try {
      const resolvedPreview = option.previewUrl || await onPreviewOption?.(option.id) || '';
      if (!resolvedPreview) {
        setPreviewingId(null);
        setPreviewMessage('이 옵션은 아직 미리듣기를 지원하지 않습니다.');
        return;
      }

      if (resolvedPreview.startsWith('__speech__:')) {
        const text = decodeURIComponent(resolvedPreview.replace('__speech__:', ''));
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          setPreviewingId(null);
          setPreviewMessage('이 브라우저에서는 기본 음성 미리듣기를 지원하지 않습니다.');
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
          setPreviewMessage(`${option.title} 미리듣기가 끝났습니다.`);
        };
        utterance.onerror = () => {
          setPreviewingId(null);
          setPreviewMessage(`${option.title} 미리듣기에 실패했습니다.`);
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setPreviewMessage(`${option.title} 미리듣기 재생 중입니다.`);
        return;
      }

      const audio = new Audio(resolvedPreview);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingId(null);
        setPreviewMessage(`${option.title} 미리듣기가 끝났습니다.`);
      };
      audio.onerror = () => {
        setPreviewingId(null);
        setPreviewMessage(`${option.title} 미리듣기에 실패했습니다.`);
      };
      await audio.play();
      setPreviewMessage(`${option.title} 미리듣기 재생 중입니다.`);
    } catch {
      setPreviewingId(null);
      setPreviewMessage(`${option.title} 미리듣기에 실패했습니다.`);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">AI 선택</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{title}</h3>
              {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
              {previewMessage ? <p className="mt-3 text-xs font-bold text-slate-500">{previewMessage}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {!options.length ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {options.map((option) => {
                const selected = option.id === activeId;
                const isCurrent = option.id === currentId;
                const canPreview = Boolean(option.previewUrl || onPreviewOption);
                const tone = option.tone || 'slate';
                const disabled = Boolean(option.disabled);
                const resolvedCardVariant = option.cardVariant || cardVariant;
                const isTtsModelCard = resolvedCardVariant === 'tts-model';
                const isTtsVoiceCard = resolvedCardVariant === 'tts-voice';
                return (
                  <div
                    key={option.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={() => handleOptionClick(option.id)}
                    onKeyDown={(event) => {
                      if (disabled) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOptionClick(option.id);
                      }
                    }}
                    className={`group flex h-full min-h-[280px] flex-col overflow-hidden rounded-[24px] border p-4 text-left transition-all ${
                      disabled
                        ? 'border-slate-200 bg-slate-100/90 opacity-70'
                        : selected
                          ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/80'
                    } ${disabled ? '' : 'cursor-pointer'}`}
                  >
                    <div className="flex min-h-0 flex-1 flex-col text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white ${avatarToneClassMap[tone]}`}>
                          {option.avatarLabel || 'AI'}
                        </div>
                        <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${toneClassMap[tone]}`}>
                          {option.badge}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-1 flex-col gap-2.5">
                        <div>
                          <div className="text-[15px] font-black leading-5 text-slate-900">{option.title}</div>
                          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{option.provider}</div>
                        </div>

                        <p className="text-xs leading-5 text-slate-600" style={clampStyle}>{option.description}</p>

                        {isTtsModelCard ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-[11px] leading-5 text-slate-600">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="font-bold text-slate-500">비용 수준</div>
                                <div className="mt-1 font-black text-slate-900">{option.priceLabel}</div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="font-bold text-slate-500">목소리 수</div>
                                <div className="mt-1 font-black text-slate-900">{option.helper?.replace('선택 가능한 목소리 ', '') || '-'}</div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {option.genderLabel || option.voiceToneLabel ? (
                              isTtsVoiceCard ? (
                                <div className="flex flex-wrap gap-2 text-[11px] font-black text-slate-700">
                                  {option.genderLabel ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.genderLabel}</span> : null}
                                  {option.voiceToneLabel ? <span className="rounded-full bg-slate-100 px-3 py-1">{option.voiceToneLabel}</span> : null}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                  {option.genderLabel ? (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-bold text-slate-500">성별</span>
                                      <span className="font-black text-slate-800">{option.genderLabel}</span>
                                    </div>
                                  ) : null}
                                  {option.voiceToneLabel ? (
                                    <div className={`flex items-center justify-between gap-3 ${option.genderLabel ? 'mt-1.5' : ''}`}>
                                      <span className="font-bold text-slate-500">특징</span>
                                      <span className="font-black text-slate-800">{option.voiceToneLabel}</span>
                                    </div>
                                  ) : null}
                                </div>
                              )
                            ) : null}

                            <div className="flex flex-wrap gap-2 text-[11px] font-black">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{option.priceLabel}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{option.qualityLabel}</span>
                              {option.speedLabel ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{option.speedLabel}</span> : null}
                            </div>

                            {option.costHint && !isTtsVoiceCard && !isTtsModelCard ? (
                              <div className="text-[11px] leading-5 text-slate-500">
                                {option.costHint}
                              </div>
                            ) : null}

                            {!isTtsVoiceCard && option.helper ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
                                {option.helper}
                              </div>
                            ) : null}
                          </>
                        )}

                        {disabled && option.disabledReason ? (
                          <div className="rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-[11px] leading-5 text-slate-500">
                            {option.disabledReason}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-400">
                        {disabled
                          ? '현재 선택할 수 없음'
                          : selected
                            ? (requireConfirm && !isCurrent ? '적용 대기 중' : '현재 선택됨')
                            : isCurrent && requireConfirm
                              ? '현재 저장된 선택'
                              : '이 옵션 선택하기'}
                      </span>
                      <div className="flex items-center gap-2">
                        {canPreview ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handlePreview(option);
                            }}
                            disabled={disabled}
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              previewingId === option.id
                                ? 'bg-slate-900 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                          >
                            {previewingId === option.id ? '듣기 중지' : '음성 듣기'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOptionClick(option.id);
                          }}
                          disabled={disabled}
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${
                            disabled
                              ? 'bg-slate-300 text-slate-500'
                              : selected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900 text-white group-hover:bg-slate-700'
                          } disabled:cursor-not-allowed`}
                        >
                          {disabled
                            ? '선택 불가'
                            : selected
                              ? (requireConfirm && !isCurrent ? '대기 중' : '선택됨')
                              : isTtsVoiceCard
                                ? '이 목소리 고르기'
                                : isTtsModelCard
                                  ? '이 모델 고르기'
                              : '선택하기'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {extraPanel ? (
            <div className="mt-4">
              {extraPanel}
            </div>
          ) : null}
        </div>

        {requireConfirm && options.length ? (
          <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택 예정</div>
                <div className="mt-1 text-sm font-black text-slate-900">{pendingOption?.title || '옵션을 선택해 주세요'}</div>
                {pendingOption?.disabledReason ? <div className="mt-1 text-xs text-rose-500">{pendingOption.disabledReason}</div> : null}
                {cardVariant === 'tts-voice' ? (
                  <div className="mt-1 text-xs text-slate-500">목소리를 고른 뒤 오른쪽 확인 버튼을 누르면 적용됩니다.</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {secondaryActionLabel && onSecondaryAction ? (
                  <button
                    type="button"
                    onClick={onSecondaryAction}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {secondaryActionLabel}
                  </button>
                ) : null}
                <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
