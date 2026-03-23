'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const ResultTable = dynamic(() => import('../ResultTable'), {
  ssr: false,
  loading: () => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">씬 제작 페이지</div>
      <div className="mt-3 text-lg font-black text-slate-900">저장된 프로젝트를 불러와 작업판을 준비하는 중입니다.</div>
      <div className="mt-4 grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[180px] animate-pulse rounded-[24px] border border-slate-200 bg-slate-100" />
        ))}
      </div>
    </section>
  ),
});

const SceneStudioResultPanel: React.FC<React.ComponentProps<typeof ResultTable>> = (props) => {
  return <ResultTable {...props} />;
};

export default SceneStudioResultPanel;
