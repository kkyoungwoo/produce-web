import React from 'react';
import { createPortal } from 'react-dom';
import { StepId } from './types';

export function StepChip({
  meta,
  isOpen,
  completed,
  onClick,
}: {
  meta: { id: StepId; title: string; subtitle: string };
  isOpen: boolean;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-4 text-left transition-all ${
        isOpen
          ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-sm'
          : completed
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em]">{meta.id}단계</div>
          <div className="mt-1 text-sm font-black">{meta.title}</div>
          <div className="mt-1 text-xs text-slate-500">{meta.subtitle}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {completed ? '완료' : '진행 중'}
          </span>
          <span className="text-xs font-bold">{isOpen ? '현재 단계' : '열기'}</span>
        </div>
      </div>
    </button>
  );
}

export function AccordionSection({
  stepId,
  title,
  description,
  summary,
  open,
  completed,
  onToggle,
  children,
  actions,
}: {
  stepId: StepId;
  title: string;
  description: string;
  summary?: React.ReactNode;
  open: boolean;
  completed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      data-step-section={`step-${stepId}`}
      className={`overflow-hidden rounded-[30px] border shadow-sm transition-all ${open ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">{stepId}단계</div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          {summary && <div className="mt-3 flex flex-wrap gap-2">{summary}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {completed && <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">완료됨</span>}
          {actions}
          <button type="button" onClick={onToggle} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
            {open ? '현재 단계' : '다시 보기'}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-slate-200/80 bg-white px-6 py-6">{children}</div>}
    </section>
  );
}

export function SummaryChip({ children, accent = 'slate' }: { children: React.ReactNode; accent?: 'slate' | 'blue' | 'violet' | 'emerald' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  } as const;
  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${classes[accent]}`}>{children}</span>;
}

export function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition-all ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300' : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'}`}
      aria-label={direction === 'left' ? '이전' : '다음'}
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}

export function LoadingSlide({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-4">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">AI 생성 중</div>
        <div className="mt-2 text-sm font-black text-slate-900">{label}</div>
        <p className="mt-2 text-xs leading-5 text-slate-500">준비 중인 결과를 곧 보여드릴게요.</p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>로딩</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export function GuidedActionButton({
  children,
  ready,
  disabled,
  onClick,
  tone = 'blue',
  className = '',
}: {
  children: React.ReactNode;
  ready?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'blue' | 'violet';
  className?: string;
}) {
  const toneClass = tone === 'violet'
    ? 'bg-violet-600 text-white hover:bg-violet-500'
    : 'bg-blue-600 text-white hover:bg-blue-500';

  return (
    <div className="relative inline-flex">
      {ready && !disabled && (
        <div className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 animate-bounce">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-black text-blue-700 shadow-sm">
            클릭해서 진행
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black transition-all ${disabled ? 'cursor-not-allowed bg-slate-300 text-slate-500' : toneClass} ${className}`}
      >
        {children}
      </button>
    </div>
  );
}

export function OverlayModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  dialogClassName = '',
  bodyClassName = '',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dialogClassName?: string;
  bodyClassName?: string;
}) {
  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div className={`my-4 w-full max-w-3xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl ${dialogClassName}`.trim()} onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">팝업</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{title}</h3>
              {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
          </div>
          <div className={`px-6 py-6 ${bodyClassName}`.trim()}>{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">{footer}</div>}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
