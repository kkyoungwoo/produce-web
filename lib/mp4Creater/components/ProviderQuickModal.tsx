'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StudioState } from '../types';
import { validateProviderConnection } from '../services/providerValidationService';

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

type ProviderField = 'openRouter' | 'elevenLabs';

const fieldOrder: ProviderField[] = ['openRouter', 'elevenLabs'];

const ProviderQuickModal: React.FC<ProviderQuickModalProps> = ({
  open,
  studioState,
  title = 'API 빠른 연결',
  description = '필요한 API 키만 입력하면 현재 화면에서 바로 실제 생성 흐름을 이어갈 수 있습니다.',
  focusField = null,
  onClose,
  onSave,
  onOpenFullSettings,
}) => {
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [feedback, setFeedback] = useState<Record<string, { tone: 'success' | 'error' | 'info'; message: string } | null>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const openRouterInputRef = useRef<HTMLInputElement>(null);
  const elevenLabsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setOpenRouterApiKey(studioState?.providers?.openRouterApiKey || '');
    setElevenLabsApiKey(studioState?.providers?.elevenLabsApiKey || '');
    setFeedback({});
    setChecking({});
  }, [open, studioState]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (focusField === 'openRouter') openRouterInputRef.current?.focus();
      if (focusField === 'elevenLabs') elevenLabsInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, focusField]);

  if (!open || !studioState) return null;

  const runCheck = async (field: ProviderField) => {
    const value = field === 'openRouter' ? openRouterApiKey : elevenLabsApiKey;
    setChecking((prev) => ({ ...prev, [field]: true }));
    try {
      const result = await validateProviderConnection(field, value);
      setFeedback((prev) => ({ ...prev, [field]: { tone: result.tone, message: result.message } }));
      return result;
    } finally {
      setChecking((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    for (const field of fieldOrder) {
      const value = field === 'openRouter' ? openRouterApiKey : elevenLabsApiKey;
      if (!value.trim()) continue;
      const result = await runCheck(field);
      if (!result.ok) return;
    }

    await onSave({
      providers: {
        ...studioState.providers,
        openRouterApiKey: openRouterApiKey.trim(),
        elevenLabsApiKey: elevenLabsApiKey.trim(),
      },
    });
    onClose();
  };

  const renderFeedback = (field: ProviderField) => {
    const item = feedback[field];
    if (!item?.message) return null;
    const className = item.tone === 'success' ? 'text-emerald-700' : item.tone === 'info' ? 'text-blue-700' : 'text-rose-700';
    return <p className={`mt-2 text-xs leading-5 ${className}`}>{item.message}</p>;
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
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">Quick setup</div>
              <h3 className="mt-3 text-2xl font-black text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              닫기
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <label className={`rounded-2xl border p-4 ${focusField === 'openRouter' ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-sm font-black text-slate-900">OpenRouter</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">대본 생성, 추천 문장, 프롬프트 보강에 사용합니다.</div>
            <input
              ref={openRouterInputRef}
              type="password"
              value={openRouterApiKey}
              onChange={(e) => {
                setOpenRouterApiKey(e.target.value);
                setFeedback((prev) => ({ ...prev, openRouter: null }));
              }}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              placeholder="sk-or-v1-..."
            />
            <button
              type="button"
              onClick={() => void runCheck('openRouter')}
              disabled={!openRouterApiKey.trim() || checking.openRouter}
              className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {checking.openRouter ? '확인 중...' : '연결 확인'}
            </button>
            {renderFeedback('openRouter')}
          </label>

          <label className={`rounded-2xl border p-4 ${focusField === 'elevenLabs' ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-sm font-black text-slate-900">ElevenLabs</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">음성 생성, 보이스 미리 듣기, 자막 생성에 사용합니다.</div>
            <input
              ref={elevenLabsInputRef}
              type="password"
              value={elevenLabsApiKey}
              onChange={(e) => {
                setElevenLabsApiKey(e.target.value);
                setFeedback((prev) => ({ ...prev, elevenLabs: null }));
              }}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              placeholder="sk_... 또는 xi-..."
            />
            <button
              type="button"
              onClick={() => void runCheck('elevenLabs')}
              disabled={!elevenLabsApiKey.trim() || checking.elevenLabs}
              className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {checking.elevenLabs ? '확인 중...' : '연결 확인'}
            </button>
            {renderFeedback('elevenLabs')}
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onOpenFullSettings}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            전체 설정 열기
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">
              취소
            </button>
            <button type="button" onClick={handleSave} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-500">
              저장하고 계속하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderQuickModal;
