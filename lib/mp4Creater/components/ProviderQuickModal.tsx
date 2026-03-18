'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StudioState } from '../types';

interface ProviderQuickModalProps {
  open: boolean;
  studioState: StudioState | null;
  title?: string;
  description?: string;
  focusField?: 'openRouter' | 'elevenLabs' | 'fal' | null;
  onClose: () => void;
  onSave: (partial: Partial<StudioState>) => void | Promise<void>;
  onOpenFullSettings?: () => void;
}

const ProviderQuickModal: React.FC<ProviderQuickModalProps> = ({
  open,
  studioState,
  title = 'API 키 등록',
  description = '작업을 이어가려면 필요한 공급자 키를 입력하세요. 지금 입력하지 않아도 샘플 모드로 일부 흐름은 확인할 수 있습니다.',
  focusField = null,
  onClose,
  onSave,
  onOpenFullSettings,
}) => {
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [falApiKey, setFalApiKey] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const openRouterInputRef = useRef<HTMLInputElement>(null);
  const elevenLabsInputRef = useRef<HTMLInputElement>(null);
  const falInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setOpenRouterApiKey(studioState?.providers?.openRouterApiKey || '');
    setElevenLabsApiKey(studioState?.providers?.elevenLabsApiKey || '');
    setFalApiKey(studioState?.providers?.falApiKey || '');
  }, [open, studioState]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (focusField === 'openRouter') openRouterInputRef.current?.focus();
      if (focusField === 'elevenLabs') elevenLabsInputRef.current?.focus();
      if (focusField === 'fal') falInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, focusField]);

  if (!open || !studioState) return null;

  const handleSave = async () => {
    await onSave({
      providers: {
        ...studioState.providers,
        openRouterApiKey: openRouterApiKey.trim(),
        elevenLabsApiKey: elevenLabsApiKey.trim(),
        falApiKey: falApiKey.trim(),
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">빠른 등록</div>
              <h3 className="mt-3 text-2xl font-black text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700">닫기</button>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          <label className={`rounded-2xl border p-4 ${focusField === 'openRouter' ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-sm font-black text-slate-900">OpenRouter</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">예: sk-or-v1-...</div>
            <input
              ref={openRouterInputRef}
              type="password"
              value={openRouterApiKey}
              onChange={(e) => setOpenRouterApiKey(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              placeholder="텍스트/스토리 보조용 키"
            />
          </label>

          <label className={`rounded-2xl border p-4 ${focusField === 'elevenLabs' ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-sm font-black text-slate-900">ElevenLabs</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">예: sk_... 또는 xi-...</div>
            <input
              ref={elevenLabsInputRef}
              type="password"
              value={elevenLabsApiKey}
              onChange={(e) => setElevenLabsApiKey(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              placeholder="오디오/나레이션 생성용 키"
            />
          </label>

          <label className={`rounded-2xl border p-4 ${focusField === 'fal' ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-sm font-black text-slate-900">FAL / 영상 API</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">예: Key xxxxx</div>
            <input
              ref={falInputRef}
              type="password"
              value={falApiKey}
              onChange={(e) => setFalApiKey(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              placeholder="영상 변환용 키"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onOpenFullSettings}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            고급 설정 열기
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">나중에</button>
            <button type="button" onClick={handleSave} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-500">저장하고 계속</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderQuickModal;
