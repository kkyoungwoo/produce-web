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
  { key: 'music_video', title: '뮤직비디오', desc: '음악 중심 영상 제작', value: 'music_video' },
  { key: 'story', title: '이야기', desc: '스토리텔링 중심 구성', value: 'story' },
  { key: 'news', title: '영화', desc: '영화 같은 장면과 감정선 중심 구성', value: 'news' },
  { key: 'info_delivery', title: '정보 전달', desc: '설명형 전달 콘텐츠', value: 'info_delivery' },
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
        <p className="mt-2 text-sm text-slate-500">이미지 생성과 영상 생성에 공통 적용됩니다: 16:9, 1:1, 9:16</p>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-slate-900">{option.title}</div>
                  </div>
                  <div className={`overflow-hidden rounded-2xl border bg-slate-100 p-2 ${active ? 'border-blue-200' : 'border-slate-200'}`}>
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
