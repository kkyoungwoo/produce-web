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
  onToggleCharacter: (id: string) => void;
  onSelectCharacterImage: (characterId: string, imageId: string) => void;
  onCharacterVoiceChange: (characterId: string, voiceHint: string | null) => void;
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
  onToggleCharacter,
  onSelectCharacterImage,
  onCharacterVoiceChange,
  onCharacterPromptChange,
  onCreateVariants,
  uploadInput,
}: Step4PanelProps) {
  const resolvedSelectedIds = selectedCharacterIds;
  const [localStage, setLocalStage] = useState<'style' | 'cast' | 'character'>(selectedCharacterStyleId ? 'cast' : 'style');
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(resolvedSelectedIds[0] || null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startScrollLeft: number; active: boolean }>({ startX: 0, startScrollLeft: 0, active: false });

  const selectedStyle = useMemo(
    () => characterStyleOptions.find((item) => item.id === selectedCharacterStyleId) || null,
    [characterStyleOptions, selectedCharacterStyleId]
  );
  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => resolvedSelectedIds.includes(item.id)),
    [extractedCharacters, resolvedSelectedIds]
  );
  const activeCharacter = useMemo(
    () => selectedCharacters.find((item) => item.id === activeCharacterId) || selectedCharacters[0] || null,
    [selectedCharacters, activeCharacterId]
  );

  useEffect(() => {
    if (!selectedCharacterStyleId) {
      setLocalStage('style');
      return;
    }
    setLocalStage((prev) => (prev === 'style' ? 'cast' : prev));
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

  const openCastSelection = () => {
    if (!selectedCharacterStyleId) {
      setLocalStage('style');
      return;
    }
    setLocalStage('cast');
  };

  const confirmCastSelection = () => {
    if (!resolvedSelectedIds.length) return;
    setLocalStage('character');
  };

  const scrollStripBy = (direction: 'left' | 'right') => {
    const container = stripRef.current;
    if (!container) return;
    const amount = Math.max(240, Math.floor(container.clientWidth * 0.72));
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
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">공통 캐릭터 스타일 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">출연자 전체에 먼저 적용할 캐릭터 스타일을 골라주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">여기서 고른 스타일은 Step4 출연자 캐릭터용 공통 기준입니다. Step5 최종 영상 화풍과는 분리되어 유지됩니다.</p>
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
                    setLocalStage('cast');
                  }}
                  className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
                >
                  <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                    <img src={buildSampleStylePreview(style.id, style.label, style.description)} alt={`${style.label} 샘플`} className="aspect-[16/10] w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">샘플 미리보기</div>
                    <div className="mt-2 text-base font-black text-slate-900">{style.label}</div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{style.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">전체 적용</span>
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

      {localStage === 'cast' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">출연자 목록 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">이번 영상에 사용할 출연자를 확정해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">공통 캐릭터 스타일은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>입니다. 출연자를 확정한 뒤 각 출연자별 이미지와 프롬프트를 정리합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLocalStage('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                스타일 다시 선택
              </button>
              <button type="button" onClick={() => onHydrateCharacters(false)} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
                {isExtracting ? '불러오는 중...' : '출연자 다시 불러오기'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {extractedCharacters.map((character) => {
              const selected = resolvedSelectedIds.includes(character.id);
              const preview = (character.generatedImages || []).find((item) => item.id === character.selectedImageId) || character.generatedImages?.[0] || null;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => onToggleCharacter(character.id)}
                  className={`rounded-[24px] border p-4 text-left transition ${selected ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img src={preview?.imageData || '/mp4Creater/flow-character.svg'} alt={character.name} className="aspect-square w-full object-cover" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : '조연')}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {selected ? '선택됨' : '선택'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!extractedCharacters.length && (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
              3단계 대본 기준 출연자를 먼저 불러와 주세요.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={confirmCastSelection}
              disabled={!resolvedSelectedIds.length}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              출연자 확정하기
            </button>
          </div>
        </section>
      )}

      {localStage === 'character' && activeCharacter && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">출연자별 캐릭터 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">출연자마다 사용할 이미지와 프롬프트를 정리해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">공통 캐릭터 스타일은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>로 유지됩니다. 여기서 고른 이미지와 프롬프트는 Step6까지 그대로 전달됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openCastSelection} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                출연자 다시 선택
              </button>
              <button type="button" onClick={() => setLocalStage('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                스타일 다시 선택
              </button>
              {uploadInput}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedCharacters.map((character) => {
              const active = character.id === activeCharacter.id;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setActiveCharacterId(character.id)}
                  className={`rounded-full px-4 py-2 text-sm font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {character.name}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{activeCharacter.name} 프롬프트</label>
                </div>
                <textarea
                  value={activeCharacter.prompt || ''}
                  onChange={(event) => onCharacterPromptChange(activeCharacter.id, event.target.value)}
                  placeholder="이 출연자 이미지를 어떤 느낌으로 만들지 직접 수정하세요. 수정 후 이미지 생성을 누르면 비슷한 방향으로 새 후보를 더 만듭니다."
                  className="mt-2 min-h-[170px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400"
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">보이스 안내</div>
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                  보이스 API와 목소리 선택은 Step3에서 완료합니다.
                  <div className="mt-2 text-xs font-black text-slate-700">현재 저장값 · {activeCharacter.voiceName || activeCharacter.voiceHint || '프로젝트 기본 보이스'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{activeCharacter.name} 이미지 후보</div>
              <div className="mt-1 text-sm font-black text-slate-900">카드뉴스처럼 넘겨 보며 대표 이미지를 선택합니다</div>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <img
                  src={(activeCharacter.generatedImages || []).find((item) => item.id === activeCharacter.selectedImageId)?.imageData || activeCharacter.generatedImages?.[0]?.imageData || '/mp4Creater/flow-character.svg'}
                  alt={activeCharacter.name}
                  className="aspect-square w-full object-cover"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
                    이미지 등록
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => scrollStripBy('left')} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">←</button>
                  <button type="button" onClick={() => scrollStripBy('right')} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">→</button>
                </div>
              </div>

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
                  const selected = image.id === activeCharacter.selectedImageId;
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
                        <div className="truncate text-[11px] font-black text-slate-800">후보 {index + 1}</div>
                        {selected && <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">선택</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
