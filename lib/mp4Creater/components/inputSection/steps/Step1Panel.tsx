import React from 'react';
import { AspectRatio, ContentType } from '../../../types';
import { ASPECT_RATIO_OPTIONS, getAspectRatioClass } from '../../../utils/aspectRatio';

interface Step1PanelProps {
  contentType: ContentType;
  aspectRatio: AspectRatio;
  hasSelectedContentType: boolean;
  hasSelectedAspectRatio: boolean;
  onSelectContentType: (value: ContentType) => void;
  onSelectAspectRatio: (value: AspectRatio) => void;
}

const QUICK_CONCEPT_CARDS: Array<{ key: string; title: string; desc: string; value: ContentType }> = [
  { key: 'music_video', title: '뮤직비디오', desc: '음악 중심 장면 연출', value: 'music_video' },
  { key: 'story', title: '이야기', desc: '기승전결 스토리 연출', value: 'story' },
  { key: 'cinematic', title: '영화', desc: '영화 같은 장면 연출', value: 'cinematic' },
  { key: 'info_delivery', title: '정보 전달', desc: '지식 전달 연출', value: 'info_delivery' },
];

export default function Step1Panel({
  contentType,
  aspectRatio,
  hasSelectedContentType,
  hasSelectedAspectRatio,
  onSelectContentType,
  onSelectAspectRatio,
}: Step1PanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">콘셉트 선택</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {QUICK_CONCEPT_CARDS.map((card) => {
            const active = hasSelectedContentType && contentType === card.value;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => onSelectContentType(card.value)}
                className={`rounded-[24px] border p-5 text-left transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
              >
                <div className="mt-1 text-xl font-black text-slate-900">{card.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">화면 비율</h2>
        <p className="mt-2 text-sm text-slate-500">제작할 영상의 비율을 정해주세요</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ASPECT_RATIO_OPTIONS.map((option) => {
            const active = hasSelectedAspectRatio && aspectRatio === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectAspectRatio(option.id)}
                className={`rounded-[24px] border p-4 text-left transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-1 items-center min-h-[88px]">
                    <div>
                      <div className="text-lg font-black text-slate-900">{option.title}</div>
                    </div>
                  </div>

                  <div className={`shrink-0 overflow-hidden rounded-2xl border bg-slate-100 p-2 ${active ? 'border-blue-200' : 'border-slate-200'}`}>
                    <div className={`${getAspectRatioClass(option.id)} w-16 rounded-xl ${active ? 'bg-blue-200/80' : 'bg-slate-200'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
