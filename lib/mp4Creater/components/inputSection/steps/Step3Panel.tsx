import React from 'react';

interface Step3PanelProps {
  isGeneratingScript: boolean;
  sceneCount: number;
  storyScript: string;
  onGenerateScript: () => void;
  onViewPrompt: () => void;
  onStoryScriptChange: (value: string) => void;
}

export default function Step3Panel({
  isGeneratingScript,
  sceneCount,
  storyScript,
  onGenerateScript,
  onViewPrompt,
  onStoryScriptChange,
}: Step3PanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">1단계에서 선택한 콘셉트 프롬프트가 자동 적용됩니다.</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewPrompt}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              프롬프트 보기
            </button>
            <button
              type="button"
              onClick={onGenerateScript}
              className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500"
            >
              {isGeneratingScript ? '대본 생성 중...' : '대본생성'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">최종 대본</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sceneCount}문단</span>
        </div>
        <textarea
          value={storyScript}
          onChange={(e) => onStoryScriptChange(e.target.value)}
          className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition focus:border-blue-400"
          placeholder="여기에 최종 대본을 입력하거나 생성해 주세요."
        />
      </section>
    </div>
  );
}
