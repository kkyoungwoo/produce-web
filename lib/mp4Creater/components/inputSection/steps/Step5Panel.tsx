import React from 'react';
import { PromptedImageAsset } from '../../../types';

interface StyleGroup {
  id: string;
  label: string;
  items: PromptedImageAsset[];
}

interface Step5PanelProps {
  styleGroups: StyleGroup[];
  selectedStyleImageId: string | null;
  newStyleName: string;
  newStylePrompt: string;
  isExtracting: boolean;
  onEnsureStyleRecommendations: () => void;
  onCreateStyle: () => void;
  onSelectStyle: (id: string) => void;
  onStyleNameChange: (value: string) => void;
  onStylePromptChange: (value: string) => void;
}

export default function Step5Panel({
  styleGroups,
  selectedStyleImageId,
  newStyleName,
  newStylePrompt,
  isExtracting,
  onEnsureStyleRecommendations,
  onCreateStyle,
  onSelectStyle,
  onStyleNameChange,
  onStylePromptChange,
}: Step5PanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">화풍 선택</h2>
          <button type="button" onClick={onEnsureStyleRecommendations} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
            {isExtracting ? '생성 중...' : '추천 화풍 추가'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
          <input value={newStyleName} onChange={(e) => onStyleNameChange(e.target.value)} placeholder="새 화풍 이름" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" />
          <textarea value={newStylePrompt} onChange={(e) => onStylePromptChange(e.target.value)} placeholder="프롬프트로 새 화풍을 추가할 수 있습니다." className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400" />
          <div className="flex items-center justify-center">
            <button type="button" onClick={onCreateStyle} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">화풍 생성</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {styleGroups.map((group) => {
          const currentCard = group.items.find((item) => item.id === selectedStyleImageId) || group.items[0] || null;
          return (
            <div key={group.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img src={currentCard?.imageData || '/mp4Creater/flow-render.svg'} alt={currentCard?.label || group.label} className="aspect-square w-full object-cover" />
              </div>
              <div className="mt-3 text-sm font-black text-slate-900">{group.label || currentCard?.label || '화풍'}</div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{currentCard?.prompt || '화풍 프롬프트가 여기에 표시됩니다.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <button key={item.id} type="button" onClick={() => onSelectStyle(item.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${item.id === selectedStyleImageId ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    {item.id === selectedStyleImageId ? '선택됨' : '선택'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
