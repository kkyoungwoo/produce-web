import React, { useMemo } from 'react';
import { STYLE_SAMPLE_PRESETS } from '../../../samples/presetCatalog';
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
  onCreateVariants: (styleCard: PromptedImageAsset) => void;
  onApplyStyleSample: (sampleId: string) => void;
  onSelectStyle: (id: string) => void;
  onStyleNameChange: (value: string) => void;
  onStylePromptChange: (value: string) => void;
}

const SAMPLE_STYLE_PALETTES: Array<{ match: RegExp; from: string; to: string; badge: string }> = [
  { match: /고난|역경|진실|시간 정지/i, from: '#0f172a', to: '#475569', badge: '서사·드라마' },
  { match: /행복|첫사랑|축제/i, from: '#f59e0b', to: '#fb7185', badge: '따뜻한 감정선' },
  { match: /몽환|비밀의 밤|네온/i, from: '#312e81', to: '#db2777', badge: '네온·환상' },
  { match: /청춘|희망의 새벽/i, from: '#0891b2', to: '#22c55e', badge: '활력·회복' },
  { match: /기억/i, from: '#92400e', to: '#fb923c', badge: '필름·회상' },
];

function resolvePalette(label: string) {
  return SAMPLE_STYLE_PALETTES.find((item) => item.match.test(label)) || { from: '#4338ca', to: '#8b5cf6', badge: '최종 화풍 샘플' };
}

function buildSamplePreview(label: string, subtitle: string) {
  const palette = resolvePalette(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.from}"/>
        <stop offset="100%" stop-color="${palette.to}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="720" rx="38" fill="url(#bg)"/>
    <rect x="48" y="48" width="1104" height="624" rx="32" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.28)"/>
    <rect x="92" y="92" width="248" height="54" rx="27" fill="rgba(255,255,255,0.18)"/>
    <text x="120" y="126" fill="#ffffff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${palette.badge}</text>
    <circle cx="892" cy="280" r="156" fill="rgba(255,255,255,0.12)"/>
    <circle cx="974" cy="398" r="60" fill="rgba(255,255,255,0.08)"/>
    <rect x="128" y="196" width="296" height="348" rx="28" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.24)"/>
    <rect x="164" y="232" width="224" height="56" rx="18" fill="rgba(255,255,255,0.18)"/>
    <rect x="164" y="312" width="224" height="22" rx="11" fill="rgba(255,255,255,0.18)"/>
    <rect x="164" y="352" width="224" height="22" rx="11" fill="rgba(255,255,255,0.14)"/>
    <rect x="164" y="392" width="180" height="22" rx="11" fill="rgba(255,255,255,0.12)"/>
    <text x="478" y="268" fill="#ffffff" font-size="62" font-family="Arial, sans-serif" font-weight="700">${label}</text>
    <foreignObject x="478" y="316" width="560" height="192">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 30px; line-height: 1.5; color: rgba(255,255,255,0.94);">${subtitle}</div>
    </foreignObject>
    <text x="478" y="584" fill="rgba(255,255,255,0.82)" font-size="26" font-family="Arial, sans-serif">예시 이미지는 모두 샘플 썸네일입니다.</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function Step5Panel({
  styleGroups,
  selectedStyleImageId,
  onApplyStyleSample,
  onSelectStyle,
}: Step5PanelProps) {
  const styleItems = useMemo(
    () => styleGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: item.groupLabel || group.label }))),
    [styleGroups]
  );

  const selectedCard = useMemo(
    () => styleItems.find((item) => item.id === selectedStyleImageId) || styleItems[0] || null,
    [selectedStyleImageId, styleItems]
  );

  const stylePresetCards = useMemo(
    () => STYLE_SAMPLE_PRESETS.map((preset) => {
      const matched = styleItems.find((item) => (item.groupLabel || item.label) === preset.label || item.id === preset.id) || null;
      const selected = Boolean(matched && matched.id === selectedStyleImageId);
      return { preset, matched, selected };
    }),
    [selectedStyleImageId, styleItems]
  );

  const handleSelectPreset = (sampleId: string, existingId?: string | null) => {
    if (existingId) {
      onSelectStyle(existingId);
      return;
    }
    onApplyStyleSample(sampleId);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">최종 영상 화풍</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">캐릭터 선택처럼 화풍 샘플을 바로 눌러 최종 톤을 고르세요</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">선택한 화풍은 Step6 씬 제작에 그대로 전달됩니다. 샘플 이미지를 아직 넣지 않아도 카드 선택은 바로 동작합니다.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            총 {STYLE_SAMPLE_PRESETS.length}개 샘플
          </div>
        </div>

        {selectedCard && (
          <div className="mt-4 rounded-[24px] border border-violet-200 bg-violet-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">현재 최종 영상에 적용될 화풍</div>
            <div className="mt-1 text-lg font-black text-slate-900">{selectedCard.groupLabel || selectedCard.label}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedCard.prompt}</p>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">샘플 화풍 선택</div>
            <h3 className="mt-2 text-lg font-black text-slate-900">Step5 화풍 카드</h3>
          </div>
          <div className="text-xs text-slate-500">원하는 화풍을 누르면 바로 선택됩니다.</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stylePresetCards.map(({ preset, matched, selected }) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id, matched?.id || null)}
              className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
            >
              <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                <img
                  src={preset.imageData || buildSamplePreview(preset.label, preset.description)}
                  alt={`${preset.label} 샘플`}
                  className="aspect-[16/10] w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = buildSamplePreview(preset.label, preset.description);
                  }}
                />
              </div>
              <div className="p-4">
                <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">최종 영상 화풍</div>
                <div className="mt-2 text-base font-black text-slate-900">{preset.label}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{preset.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">샘플 적용</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : matched ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {selected ? '선택됨' : matched ? '불러옴' : '선택 가능'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
