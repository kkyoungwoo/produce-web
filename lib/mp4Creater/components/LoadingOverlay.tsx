'use client';

import React from 'react';

export function LoadingOverlay({
  open,
  title,
  description,
  progressPercent,
  progressLabel,
  mode = 'panel',
}: {
  open: boolean;
  title: string;
  description?: string;
  progressPercent?: number;
  progressLabel?: string;
  mode?: 'panel' | 'gray';
}) {
  if (!open) return null;

  if (mode === 'gray') {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
        </div>
      </div>
    );
  }

  const safeProgress = typeof progressPercent === 'number'
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/22 px-4 backdrop-blur-[6px]">
      <div className="mp4-glass-panel w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">불러오는 중</div>
            <div className="mt-1 text-lg font-black text-slate-900">{title}</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{description || '필요한 데이터만 먼저 준비하고 있습니다.'}</p>

        {safeProgress !== null && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
              <span>{progressLabel || '진행률'}</span>
              <span>{safeProgress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
              <div suppressHydrationWarning className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${safeProgress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="h-3 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function StudioPageSkeleton({
  title = '프로젝트를 부드럽게 불러오는 중',
  description = '필요한 카드만 먼저 준비하고 나머지는 화면 안에서 자연스럽게 이어집니다.',
  progressPercent = 18,
  progressLabel,
}: {
  title?: string;
  description?: string;
  progressPercent?: number;
  progressLabel?: string;
}) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progressPercent || 0)));

  return (
    <div className="mp4-shell min-h-screen text-slate-900">
      <div className="sticky top-0 z-20 border-b border-white/40 bg-white/45 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1520px] animate-pulse">
          <div className="h-8 w-64 rounded-full bg-slate-200" />
          <div className="mt-4 h-3 w-80 rounded-full bg-slate-200" />
        </div>
      </div>
      <main className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mp4-glass-hero rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">준비 중</div>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
              <span>{progressLabel || '화면 준비 진행률'}</span>
              <span>{safeProgress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
              <div suppressHydrationWarning className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${safeProgress}%` }} />
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-4 h-6 w-3/4 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-6 aspect-video animate-pulse rounded-2xl bg-slate-200" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`scene-skeleton-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-4 aspect-video animate-pulse rounded-2xl bg-slate-200" />
                <div className="mt-4 h-3 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-3 w-5/6 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
