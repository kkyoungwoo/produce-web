import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CharacterProfile } from '../../../types';

interface CharacterStyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  accentFrom: string;
  accentTo: string;
}

const SAMPLE_STYLE_PALETTE: Record<string, { from: string; to: string; badge: string }> = {
  realistic: { from: '#0f172a', to: '#475569', badge: '영화·드라마' },
  anime: { from: '#c026d3', to: '#7c3aed', badge: '애니메이션' },
  webtoon: { from: '#2563eb', to: '#06b6d4', badge: '웹툰·코믹' },
  threeD: { from: '#059669', to: '#14b8a6', badge: '3D 스타일' },
  illustration: { from: '#f59e0b', to: '#f97316', badge: '아트·포스터' },
};

function getStylePalette(id: string, label: string) {
  if (id.includes('real') || label.includes('실사')) return SAMPLE_STYLE_PALETTE.realistic;
  if (id.includes('anime') || label.includes('애니')) return SAMPLE_STYLE_PALETTE.anime;
  if (id.includes('webtoon') || label.includes('웹툰')) return SAMPLE_STYLE_PALETTE.webtoon;
  if (id.includes('3d') || label.includes('3D')) return SAMPLE_STYLE_PALETTE.threeD;
  return SAMPLE_STYLE_PALETTE.illustration;
}

function buildSampleStylePreview(id: string, label: string, description: string) {
  const palette = getStylePalette(id, label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.from}"/>
        <stop offset="100%" stop-color="${palette.to}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="720" rx="38" fill="url(#bg)"/>
    <rect x="48" y="48" width="1104" height="624" rx="32" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.28)"/>
    <rect x="92" y="92" width="226" height="54" rx="27" fill="rgba(255,255,255,0.18)"/>
    <text x="120" y="126" fill="#ffffff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${palette.badge} · 샘플</text>
    <circle cx="872" cy="298" r="148" fill="rgba(255,255,255,0.13)"/>
    <rect x="130" y="186" width="290" height="366" rx="28" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)"/>
    <circle cx="276" cy="292" r="70" fill="rgba(255,255,255,0.78)"/>
    <path d="M194 430c24-68 138-68 162 0" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="18" stroke-linecap="round"/>
    <path d="M276 362v126" stroke="rgba(255,255,255,0.92)" stroke-width="18" stroke-linecap="round"/>
    <path d="M204 414h144" stroke="rgba(255,255,255,0.92)" stroke-width="18" stroke-linecap="round"/>
    <text x="490" y="270" fill="#ffffff" font-size="64" font-family="Arial, sans-serif" font-weight="700">${label}</text>
    <foreignObject x="490" y="318" width="560" height="192">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 30px; line-height: 1.5; color: rgba(255,255,255,0.94);">${description}</div>
    </foreignObject>
    <text x="490" y="580" fill="rgba(255,255,255,0.82)" font-size="26" font-family="Arial, sans-serif">예시 이미지는 모두 샘플 썸네일입니다.</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getCharacterPreview(character: CharacterProfile) {
  return (character.generatedImages || []).find((item) => item.id === character.selectedImageId)
    || character.generatedImages?.[0]
    || null;
}

interface Step4PanelProps {
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  selectedCharacterStyleId: string | null;
  characterStyleOptions: CharacterStyleOption[];
  isExtracting: boolean;
  characterLoadingProgress: Record<string, number>;
  onHydrateCharacters: (forceSample?: boolean) => void;
  onSelectCharacterStyle: (styleId: string) => void;
  onUploadCharacterImage: (characterId: string) => void;
  onUploadNewCharacterImage: () => void;
  onToggleCharacter: (id: string) => void;
  onSelectCharacterImage: (characterId: string, imageId: string) => void;
  onCharacterPromptChange: (characterId: string, prompt: string) => void;
  onCreateVariants: (character: CharacterProfile) => void;
  uploadInput: React.ReactNode;
}

export default function Step4Panel({
  extractedCharacters,
  selectedCharacterIds,
  selectedCharacterStyleId,
  characterStyleOptions,
  isExtracting,
  characterLoadingProgress,
  onHydrateCharacters,
  onSelectCharacterStyle,
  onUploadCharacterImage,
  onUploadNewCharacterImage,
  onToggleCharacter,
  onSelectCharacterImage,
  onCharacterPromptChange,
  onCreateVariants,
  uploadInput,
}: Step4PanelProps) {
  const [localStage, setLocalStage] = useState<'style' | 'workspace'>(selectedCharacterStyleId ? 'workspace' : 'style');
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(selectedCharacterIds[0] || null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startScrollLeft: number; active: boolean }>({ startX: 0, startScrollLeft: 0, active: false });

  const selectedStyle = useMemo(
    () => characterStyleOptions.find((item) => item.id === selectedCharacterStyleId) || null,
    [characterStyleOptions, selectedCharacterStyleId]
  );
  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => selectedCharacterIds.includes(item.id)),
    [extractedCharacters, selectedCharacterIds]
  );
  const activeCharacter = useMemo(
    () => selectedCharacters.find((item) => item.id === activeCharacterId) || selectedCharacters[0] || null,
    [selectedCharacters, activeCharacterId]
  );
  const resolvedCount = useMemo(
    () => selectedCharacters.filter((item) => Boolean(item.selectedImageId || item.generatedImages?.[0]?.id || item.imageData)).length,
    [selectedCharacters]
  );

  useEffect(() => {
    setLocalStage(selectedCharacterStyleId ? 'workspace' : 'style');
  }, [selectedCharacterStyleId]);

  useEffect(() => {
    if (!selectedCharacters.length) {
      setActiveCharacterId(null);
      return;
    }
    if (!activeCharacterId || !selectedCharacters.some((item) => item.id === activeCharacterId)) {
      setActiveCharacterId(selectedCharacters[0].id);
    }
  }, [activeCharacterId, selectedCharacters]);

  const scrollStripBy = (direction: 'left' | 'right') => {
    const container = stripRef.current;
    if (!container) return;
    const amount = Math.max(220, Math.floor(container.clientWidth * 0.72));
    container.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const startDrag = (clientX: number) => {
    const container = stripRef.current;
    if (!container) return;
    dragStateRef.current = {
      startX: clientX,
      startScrollLeft: container.scrollLeft,
      active: true,
    };
  };

  const moveDrag = (clientX: number) => {
    const container = stripRef.current;
    if (!container || !dragStateRef.current.active) return;
    const delta = clientX - dragStateRef.current.startX;
    container.scrollLeft = dragStateRef.current.startScrollLeft - delta;
  };

  const endDrag = () => {
    dragStateRef.current.active = false;
  };

  return (
    <div className="space-y-6">
      {localStage === 'style' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">캐릭터 느낌 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">먼저 캐릭터 느낌을 고르면 Step4 작업 화면이 열립니다</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">여기서 고른 느낌은 출연자별 캐릭터 생성의 공통 기준이 됩니다. 선택 후에는 출연자마다 이미지를 계속 만들고, 여러 장 중 대표 이미지를 확정할 수 있습니다.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {characterStyleOptions.map((style) => {
              const selected = style.id === selectedCharacterStyleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    onSelectCharacterStyle(style.id);
                    setLocalStage('workspace');
                  }}
                  className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
                >
                  <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                    <img src={buildSampleStylePreview(style.id, style.label, style.description)} alt={`${style.label} 샘플`} className="aspect-[16/10] w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">캐릭터 느낌</div>
                    <div className="mt-2 text-base font-black text-slate-900">{style.label}</div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{style.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">공통 적용</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {selected ? '선택됨' : '선택'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {localStage === 'workspace' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">출연자별 캐릭터 제작</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">선택된 출연자 이미지만 만들고 대표 이미지를 확정해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재 느낌은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>입니다.
                선택된 출연자 {selectedCharacters.length}명 중 {resolvedCount}명이 대표 이미지를 가진 상태입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLocalStage('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                느낌 다시 선택
              </button>
              <button type="button" onClick={() => onHydrateCharacters(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                {isExtracting ? '출연자 갱신 중...' : '출연자 갱신'}
              </button>
              <button type="button" onClick={onUploadNewCharacterImage} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">
                이미지 등록
              </button>
              {uploadInput}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Step3 선택 출연자</div>
                <div className="mt-1 text-sm font-black text-slate-900">여기서는 Step3에서 선택한 출연자만 이미지 제작 대상으로 표시됩니다</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600">
                총 {selectedCharacterIds.length}명 작업 중
              </div>
            </div>
          </div>

          {!selectedCharacters.length && (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <div className="text-base font-black text-slate-900">선택된 출연자가 아직 없습니다</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Step3에서 출연자를 1명 이상 선택해야 Step4에서 이미지 제작을 진행할 수 있습니다.</p>
            </div>
          )}

          {!!selectedCharacters.length && (
            <>
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택된 출연자</div>
                    <div className="mt-1 text-sm font-black text-slate-900">이미지 위 카드를 눌러 현재 편집할 출연자를 바꿉니다</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">모든 선택 출연자가 대표 이미지를 가져야 다음 단계로 이동됩니다</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {selectedCharacters.map((character) => {
                    const active = character.id === activeCharacter?.id;
                    const preview = getCharacterPreview(character);
                    const resolved = Boolean(character.selectedImageId || character.generatedImages?.[0]?.id || character.imageData);
                    return (
                      <button
                        key={character.id}
                        type="button"
                        onClick={() => setActiveCharacterId(character.id)}
                        className={`overflow-hidden rounded-[22px] border text-left transition ${active ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                          {preview ? (
                            <img src={preview.imageData} alt={character.name} className="aspect-square w-full object-cover" />
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center text-4xl font-black text-slate-300">{character.name.slice(0, 1)}</div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                              <div className="mt-1 truncate text-[11px] text-slate-500">후보 {(character.generatedImages || []).length}장</div>
                            </div>
                            {active && <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black text-white">편집중</span>}
                          </div>
                          <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {resolved ? '대표 이미지 준비됨' : '이미지 선택 필요'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeCharacter && (
                <div className="mt-5 grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">현재 편집 중</div>
                        <div className="mt-1 text-lg font-black text-slate-900">{activeCharacter.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{activeCharacter.roleLabel || (activeCharacter.role === 'lead' ? '주인공' : activeCharacter.role === 'support' ? '조연' : '출연자')} · {selectedStyle?.label || '스타일 미선택'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onCreateVariants(activeCharacter)}
                          disabled={characterLoadingProgress[activeCharacter.id] !== undefined}
                          className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
                        >
                          {characterLoadingProgress[activeCharacter.id] !== undefined ? '이미지 생성 중...' : '이미지 생성'}
                        </button>
                        <button type="button" onClick={() => onUploadCharacterImage(activeCharacter.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                          이 출연자 이미지 등록
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                      {(getCharacterPreview(activeCharacter)?.imageData || activeCharacter.imageData) ? (
                        <img
                          src={getCharacterPreview(activeCharacter)?.imageData || activeCharacter.imageData || '/mp4Creater/flow-character.svg'}
                          alt={activeCharacter.name}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full flex-col items-center justify-center bg-slate-100 px-6 text-center text-sm leading-6 text-slate-500">
                          아직 이미지가 없습니다. 현재 느낌으로 이미지를 생성하거나 직접 등록해 주세요.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{activeCharacter.name} 프롬프트</div>
                      <textarea
                        value={activeCharacter.prompt || ''}
                        onChange={(event) => onCharacterPromptChange(activeCharacter.id, event.target.value)}
                        placeholder="이 출연자를 어떤 분위기로 만들지 간단히 조정하세요. 수정 후 이미지 생성 시 바로 반영됩니다."
                        className="mt-2 min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">이미지 후보 히스토리</div>
                        <div className="mt-1 text-sm font-black text-slate-900">이전 사진까지 좌우로 넘겨 보며 대표 이미지를 고릅니다</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => scrollStripBy('left')} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">←</button>
                        <button type="button" onClick={() => scrollStripBy('right')} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">→</button>
                      </div>
                    </div>

                    {(activeCharacter.generatedImages || []).length > 0 ? (
                      <div
                        ref={stripRef}
                        className="mt-4 flex gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        onMouseDown={(event) => startDrag(event.clientX)}
                        onMouseMove={(event) => moveDrag(event.clientX)}
                        onMouseUp={endDrag}
                        onMouseLeave={endDrag}
                        onTouchStart={(event) => startDrag(event.touches[0]?.clientX || 0)}
                        onTouchMove={(event) => moveDrag(event.touches[0]?.clientX || 0)}
                        onTouchEnd={endDrag}
                      >
                        {(activeCharacter.generatedImages || []).map((image, index) => {
                          const selected = image.id === activeCharacter.selectedImageId || (!activeCharacter.selectedImageId && index === 0);
                          return (
                            <button
                              key={image.id}
                              type="button"
                              onClick={() => onSelectCharacterImage(activeCharacter.id, image.id)}
                              className={`min-w-[180px] max-w-[180px] shrink-0 rounded-2xl border bg-white p-2 text-left ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                <img src={image.imageData} alt={image.label} className="aspect-square w-full object-cover" draggable={false} />
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div>
                                  <div className="truncate text-[11px] font-black text-slate-800">후보 {index + 1}</div>
                                  <div className="mt-1 text-[10px] text-slate-500">{image.sourceMode === 'upload' ? '직접 등록' : image.sourceMode === 'sample' ? '샘플' : '생성 이미지'}</div>
                                </div>
                                {selected && <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">선택됨</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm leading-6 text-slate-500">
                        아직 저장된 후보 이미지가 없습니다. 지금 느낌으로 이미지를 생성하거나 직접 등록해 주세요.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
