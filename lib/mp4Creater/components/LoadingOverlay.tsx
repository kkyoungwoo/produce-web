'use client';

import React from 'react';

export function LoadingOverlay({
  open,
  title,
  description,
}: {
  open: boolean;
  title: string;
  description?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Loading</div>
            <div className="mt-1 text-lg font-black text-slate-900">{title}</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{description || '필요한 데이터만 먼저 준비하고 있습니다.'}</p>
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
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1520px] animate-pulse">
          <div className="h-8 w-64 rounded-full bg-slate-200" />
          <div className="mt-4 h-3 w-80 rounded-full bg-slate-200" />
        </div>
      </div>
      <main className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Preparing</div>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
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
