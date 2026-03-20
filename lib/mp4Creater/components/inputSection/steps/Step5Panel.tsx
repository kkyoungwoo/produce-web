import React, { useEffect, useMemo, useState } from 'react';
import { PromptedImageAsset } from '../../../types';
import { STYLE_SAMPLE_PRESETS } from '../../../samples/presetCatalog';

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

export default function Step5Panel({
  styleGroups,
  selectedStyleImageId,
  newStyleName,
  newStylePrompt,
  isExtracting,
  onEnsureStyleRecommendations,
  onCreateStyle,
  onCreateVariants,
  onApplyStyleSample,
  onSelectStyle,
  onStyleNameChange,
  onStylePromptChange,
}: Step5PanelProps) {
  const flattenedCards = useMemo(
    () => styleGroups.map((group) => group.items.find((item) => item.id === selectedStyleImageId) || group.items[0]).filter(Boolean) as PromptedImageAsset[],
    [selectedStyleImageId, styleGroups]
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(styleGroups[0]?.id || null);

  useEffect(() => {
    const selectedGroup = styleGroups.find((group) => group.items.some((item) => item.id === selectedStyleImageId));
    if (selectedGroup?.id) {
      setExpandedGroupId(selectedGroup.id);
      return;
    }
    if (!styleGroups.some((group) => group.id === expandedGroupId)) {
      setExpandedGroupId(styleGroups[0]?.id || null);
    }
  }, [expandedGroupId, selectedStyleImageId, styleGroups]);

  const selectedGroup = styleGroups.find((group) => group.items.some((item) => item.id === selectedStyleImageId)) || styleGroups.find((group) => group.id === expandedGroupId) || styleGroups[0] || null;
  const selectedCard = selectedGroup?.items.find((item) => item.id === selectedStyleImageId) || selectedGroup?.items[0] || null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">최종 영상 화풍</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">배경과 장면 전체 톤을 정하는 Step5 화풍</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Step4 캐릭터 스타일과 독립적으로 동작합니다. 여기서 고른 화풍은 최종 영상 장면 전체의 비주얼 톤앤매너에만 적용됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEnsureStyleRecommendations} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
              {isExtracting ? '화풍 준비 중...' : '화풍 샘플 더 불러오기'}
            </button>
            {selectedCard && (
              <button type="button" onClick={() => onCreateVariants(selectedCard)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                선택 화풍 유사안 추가
              </button>
            )}
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
          <div className="text-xs text-slate-500">최소 10개 내외 카드를 작게 배치해 비교가 쉽도록 구성했습니다.</div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {flattenedCards.map((card) => {
            const group = styleGroups.find((item) => item.items.some((variant) => variant.id === card.id || variant.groupId === card.groupId));
            const selected = group?.items.some((item) => item.id === selectedStyleImageId) || card.id === selectedStyleImageId;
            return (
              <button
                key={group?.id || card.id}
                type="button"
                onClick={() => {
                  setExpandedGroupId(group?.id || card.groupId || card.id);
                  onSelectStyle(card.id);
                }}
                className={`overflow-hidden rounded-[22px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-200'}`}
              >
                <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                  <img src={card.imageData} alt={card.label} className="aspect-square w-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{group?.label || card.groupLabel || card.label}</div>
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
            아직 준비된 화풍 카드가 없습니다. 화풍 샘플 더 불러오기를 누르면 최종 영상용 화풍 카드가 한 번에 채워집니다.
          </div>
        )}
      </section>

      {selectedGroup && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">선택 화풍 상세 비교</div>
              <h3 className="mt-2 text-lg font-black text-slate-900">{selectedGroup.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">같은 화풍 안에서 누적된 후보를 비교하고, 원하는 1개를 최종 선택하세요.</p>
            </div>
            <button type="button" onClick={() => selectedCard && onCreateVariants(selectedCard)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              이 화풍 유사안 더 만들기
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
              <img src={selectedCard?.imageData || '/mp4Creater/flow-render.svg'} alt={selectedCard?.label || selectedGroup.label} className="aspect-square w-full object-cover" />
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택 프롬프트</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCard?.prompt || '프롬프트가 없습니다.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {selectedGroup.items.map((item) => {
                  const picked = item.id === selectedStyleImageId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectStyle(item.id)}
                      className={`overflow-hidden rounded-[22px] border bg-white text-left ${picked ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                        <img src={item.imageData} alt={item.label} className="aspect-square w-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-black text-slate-900">후보</div>
                          {picked && <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">선택됨</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">직접 추가</div>
        <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[0.7fr_1.3fr_auto]">
          <input value={newStyleName} onChange={(e) => onStyleNameChange(e.target.value)} placeholder="새 화풍 이름" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" />
          <textarea value={newStylePrompt} onChange={(e) => onStylePromptChange(e.target.value)} placeholder="최종 영상 전체에 적용할 화풍 프롬프트를 직접 추가할 수 있습니다." className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400" />
          <div className="flex items-center justify-center">
            <button type="button" onClick={onCreateStyle} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">화풍 생성</button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">빠른 샘플</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {STYLE_SAMPLE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => onApplyStyleSample(preset.id)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-xs text-slate-700 hover:bg-slate-50">
                <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                  <img src={preset.imageData} alt={preset.label} loading="lazy" className="aspect-square w-full object-cover" />
                </div>
                <div className="px-3 py-3">
                  <div className="font-black text-slate-900">{preset.label}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{preset.prompt}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
