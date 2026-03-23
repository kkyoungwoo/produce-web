import React, { useEffect, useMemo, useState } from 'react';
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

function inferCategory(label: string) {
  if (/광고|브랜드|뷰티|패션|비즈니스|테크/i.test(label)) return '광고·브랜드';
  if (/애니|3d|픽사|디즈니|지브리|아케인|스파이더버스/i.test(label)) return '애니메이션';
  if (/웹툰|코믹|로판|만화|치비/i.test(label)) return '웹툰·코믹';
  if (/스케치|펜슬|잉크|콘티|블루프린트/i.test(label)) return '스케치·기획';
  if (/유화|수채화|필름|스냅|드론|아트|포스터/i.test(label)) return '아트·사진';
  return '영화·드라마';
}

function resolvePalette(label: string) {
  if (/느와르|범죄|호러|공포/i.test(label)) return { from: '#111827', to: '#1d4ed8' };
  if (/sf|퓨처|스파이|테크|사이버/i.test(label)) return { from: '#0f172a', to: '#0891b2' };
  if (/광고|뷰티|패션|럭셔리/i.test(label)) return { from: '#7c3aed', to: '#ec4899' };
  if (/애니|3d|픽사|디즈니|지브리/i.test(label)) return { from: '#059669', to: '#38bdf8' };
  if (/웹툰|코믹|만화|로판/i.test(label)) return { from: '#2563eb', to: '#8b5cf6' };
  if (/스케치|펜슬|잉크|콘티/i.test(label)) return { from: '#334155', to: '#94a3b8' };
  if (/유화|수채화|필름|아트|포스터/i.test(label)) return { from: '#b45309', to: '#f97316' };
  return { from: '#0f172a', to: '#475569' };
}

function buildSamplePreview(label: string, subtitle: string) {
  const category = inferCategory(label);
  const palette = resolvePalette(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.from}"/>
        <stop offset="100%" stop-color="${palette.to}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="720" rx="36" fill="url(#bg)"/>
    <rect x="46" y="46" width="1108" height="628" rx="30" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.24)"/>
    <rect x="84" y="84" width="232" height="52" rx="26" fill="rgba(255,255,255,0.16)"/>
    <text x="112" y="118" fill="#ffffff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${category} · 샘플</text>
    <rect x="86" y="188" width="330" height="378" rx="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)"/>
    <circle cx="252" cy="286" r="76" fill="rgba(255,255,255,0.78)"/>
    <path d="M168 432c24-78 144-78 168 0" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="18" stroke-linecap="round"/>
    <path d="M252 364v126" stroke="rgba(255,255,255,0.9)" stroke-width="18" stroke-linecap="round"/>
    <path d="M180 416h144" stroke="rgba(255,255,255,0.9)" stroke-width="18" stroke-linecap="round"/>
    <circle cx="920" cy="242" r="114" fill="rgba(255,255,255,0.12)"/>
    <circle cx="1012" cy="358" r="52" fill="rgba(255,255,255,0.08)"/>
    <text x="470" y="278" fill="#ffffff" font-size="66" font-family="Arial, sans-serif" font-weight="700">${label}</text>
    <foreignObject x="470" y="326" width="540" height="186">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 28px; line-height: 1.55; color: rgba(255,255,255,0.92);">${subtitle}</div>
    </foreignObject>
    <text x="470" y="586" fill="rgba(255,255,255,0.82)" font-size="26" font-family="Arial, sans-serif">예시 이미지는 모두 샘플 썸네일입니다.</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function Step5Panel({
  styleGroups,
  selectedStyleImageId,
  onSelectStyle,
}: Step5PanelProps) {
  const visibleStyleGroups = useMemo(() => styleGroups.slice(0, 2), [styleGroups]);
  const flattenedCards = useMemo(
    () => visibleStyleGroups.map((group) => group.items.find((item) => item.id === selectedStyleImageId) || group.items[0]).filter(Boolean) as PromptedImageAsset[],
    [selectedStyleImageId, visibleStyleGroups]
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(visibleStyleGroups[0]?.id || null);

  useEffect(() => {
    const selectedGroup = visibleStyleGroups.find((group) => group.items.some((item) => item.id === selectedStyleImageId));
    if (selectedGroup?.id) {
      if (selectedGroup.id !== expandedGroupId) {
        setExpandedGroupId(selectedGroup.id);
      }
      return;
    }
    const fallbackGroupId = visibleStyleGroups[0]?.id || null;
    if (!visibleStyleGroups.some((group) => group.id === expandedGroupId) && fallbackGroupId !== expandedGroupId) {
      setExpandedGroupId(fallbackGroupId);
    }
  }, [expandedGroupId, selectedStyleImageId, visibleStyleGroups]);

  const selectedGroup = visibleStyleGroups.find((group) => group.items.some((item) => item.id === selectedStyleImageId)) || visibleStyleGroups.find((group) => group.id === expandedGroupId) || visibleStyleGroups[0] || null;
  const selectedCard = selectedGroup?.items.find((item) => item.id === selectedStyleImageId) || selectedGroup?.items[0] || null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">최종 영상 화풍</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">배경과 장면 전체 톤을 정하는 Step5 화풍</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">여기서는 제공된 샘플 화풍 2개만 비교해서 고를 수 있습니다. 선택한 화풍은 최종 영상 장면 전체의 톤앤매너에만 적용됩니다.</p>
          </div>
        </div>

        {selectedCard && (
          <div className="mt-4 rounded-[24px] border border-violet-200 bg-violet-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">현재 최종 영상에 적용될 화풍</div>
            <div className="mt-1 text-lg font-black text-slate-900">{selectedCard.groupLabel || selectedCard.label}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">선택된 화풍은 배경, 장면 연출, 렌더링 질감, 전체 톤앤매너 기준으로 씬 제작에 전달됩니다.</p>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">한눈에 비교</div>
            <h3 className="mt-2 text-lg font-black text-slate-900">화풍 카드 선택</h3>
          </div>
          <div className="text-xs text-slate-500">항상 2개 카드만 보여 줍니다.</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {flattenedCards.map((card) => {
            const group = styleGroups.find((item) => item.items.some((variant) => variant.id === card.id || variant.groupId === card.groupId));
            const selected = group?.items.some((item) => item.id === selectedStyleImageId) || card.id === selectedStyleImageId;
            const groupLabel = group?.label || card.groupLabel || card.label;
            return (
              <button
                key={group?.id || card.id}
                type="button"
                onClick={() => {
                  setExpandedGroupId(group?.id || card.groupId || card.id);
                  onSelectStyle(card.id);
                }}
                className={`overflow-hidden rounded-[20px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-200'}`}
              >
                <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                  <img src={card.imageData || buildSamplePreview(groupLabel, '최종 영상 장면용 화풍 카드')} alt={`${groupLabel} 샘플`} className="aspect-[16/9] w-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{groupLabel}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{group?.items.length || 1}개 후보</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? '선택' : '비교'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!flattenedCards.length && (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
            아직 선택 가능한 화풍 카드가 준비되지 않았습니다. Step5에서는 제공된 샘플 카드만 선택할 수 있습니다.
          </div>
        )}
      </section>
    </div>
  );
}
