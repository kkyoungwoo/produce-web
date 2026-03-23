import React, { useEffect, useMemo, useRef } from 'react';
import { CharacterProfile } from '../../../types';

interface CharacterStyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  accentFrom: string;
  accentTo: string;
  sampleImage?: string;
}

const SAMPLE_STYLE_PALETTE: Record<string, { from: string; to: string; badge: string }> = {
  realistic: { from: '#0f172a', to: '#475569', badge: '영화·드라마' },
  anime: { from: '#c026d3', to: '#7c3aed', badge: '애니메이션' },
  webtoon: { from: '#2563eb', to: '#06b6d4', badge: '웹툰·코믹' },
  threeD: { from: '#059669', to: '#14b8a6', badge: '3D 스타일' },
  object: { from: '#f59e0b', to: '#f97316', badge: '오브젝트 캐릭터' },
  illustration: { from: '#f59e0b', to: '#f97316', badge: '아트·포스터' },
};

function getStylePalette(id: string, label: string) {
  if (id.includes('photo') || id.includes('real') || label.includes('실사')) return SAMPLE_STYLE_PALETTE.realistic;
  if (id.includes('retro') || label.includes('90년대') || label.includes('일본 만화')) return SAMPLE_STYLE_PALETTE.anime;
  if (id.includes('anime') || label.includes('애니')) return SAMPLE_STYLE_PALETTE.anime;
  if (id.includes('webtoon') || label.includes('웹툰')) return SAMPLE_STYLE_PALETTE.webtoon;
  if (id.includes('3d') || label.includes('3D')) return SAMPLE_STYLE_PALETTE.threeD;
  if (id.includes('object') || label.includes('의인화')) return SAMPLE_STYLE_PALETTE.object;
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

function resolveCharacterPreview(character: CharacterProfile) {
  const selectedImage = (character.generatedImages || []).find((image) => image.id === character.selectedImageId);
  if (selectedImage?.imageData) return selectedImage.imageData;
  if (character.imageData) return character.imageData;
  return (character.generatedImages || []).find((image) => image.imageData)?.imageData || '';
}

function getCharacterInitial(name: string) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

interface Step4PanelProps {
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  selectedCharacterStyleId: string | null;
  characterStyleOptions: CharacterStyleOption[];
  localStage: 'style' | 'workspace';
  isExtracting: boolean;
  characterLoadingProgress: Record<string, number>;
  onHydrateCharacters: (forceSample?: boolean) => void;
  onLocalStageChange: (stage: 'style' | 'workspace') => void;
  onSelectCharacterStyle: (styleId: string) => void;
  onUploadCharacterImage: (characterId: string) => void;
  onUploadNewCharacterImage: () => void;
  onToggleCharacter: (id: string) => void;
  onSelectCharacterImage: (characterId: string, imageId: string) => void;
  onCharacterPromptChange: (characterId: string, prompt: string) => void;
  onCreateVariants: (character: CharacterProfile, options?: { note?: string; sourceLabel?: string }) => void;
  uploadInput: React.ReactNode;
}

export default function Step4Panel({
  extractedCharacters,
  selectedCharacterIds,
  selectedCharacterStyleId,
  characterStyleOptions,
  localStage,
  isExtracting,
  characterLoadingProgress,
  onHydrateCharacters,
  onLocalStageChange,
  onSelectCharacterStyle,
  onUploadCharacterImage,
  onUploadNewCharacterImage,
  onSelectCharacterImage,
  onCreateVariants,
  uploadInput,
}: Step4PanelProps) {
  const stripRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousImageCountRef = useRef<Record<string, number>>({});

  const selectedStyle = useMemo(
    () => characterStyleOptions.find((item) => item.id === selectedCharacterStyleId) || null,
    [characterStyleOptions, selectedCharacterStyleId]
  );
  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => selectedCharacterIds.includes(item.id)),
    [extractedCharacters, selectedCharacterIds]
  );
  const resolvedCount = useMemo(
    () => selectedCharacters.filter((item) => Boolean(item.selectedImageId)).length,
    [selectedCharacters]
  );

  useEffect(() => {
    if (!selectedCharacterStyleId && localStage !== 'style') {
      onLocalStageChange('style');
    }
  }, [selectedCharacterStyleId, localStage, onLocalStageChange]);

  useEffect(() => {
    selectedCharacters.forEach((character) => {
      const currentCount = (character.generatedImages || []).length;
      const previousCount = previousImageCountRef.current[character.id] || 0;
      if (currentCount > previousCount) {
        const strip = stripRefs.current[character.id];
        const newestCard = strip?.querySelector<HTMLElement>(`[data-character-image-card="${character.generatedImages?.[currentCount - 1]?.id || ''}"]`);
        newestCard?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      previousImageCountRef.current[character.id] = currentCount;
    });
  }, [selectedCharacters]);

  useEffect(() => {
    if (localStage !== 'workspace') return;

    selectedCharacters.forEach((character) => {
      const images = character.generatedImages || [];
      if (!character.selectedImageId && images[0]?.id) {
        onSelectCharacterImage(character.id, images[0].id);
      }
    });
  }, [localStage, selectedCharacters, onSelectCharacterImage]);



  const scrollStripBy = (characterId: string, direction: 'left' | 'right') => {
    const container = stripRefs.current[characterId];
    if (!container) return;
    const amount = Math.max(220, Math.floor(container.clientWidth * 0.72));
    container.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const moveToWorkspace = () => {
    if (!selectedCharacterStyleId) return;
    onLocalStageChange('workspace');
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className="space-y-6">
      {localStage === 'style' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">캐릭터 느낌 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">먼저 캐릭터 느낌을 고르고, 확인 버튼으로 작업 화면을 여세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">느낌 카드를 누르면 선택만 바뀌고 바로 다음 화면으로 튀지 않습니다. 확인 버튼을 눌렀을 때만 출연자별 이미지 제작 화면으로 넘어갑니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {selectedCharacterStyleId ? '선택 완료' : '느낌 선택 필요'}
              </div>
              <button
                type="button"
                onClick={moveToWorkspace}
                disabled={!selectedCharacterStyleId}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
              >
                이 느낌으로 출연자 이미지 만들기
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {characterStyleOptions.map((style) => {
              const selected = style.id === selectedCharacterStyleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onSelectCharacterStyle(style.id)}
                  className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
                >
                  <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                    <img src={style.sampleImage || buildSampleStylePreview(style.id, style.label, style.description)} alt={`${style.label} 샘플`} className="aspect-[16/10] w-full object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = buildSampleStylePreview(style.id, style.label, style.description); }} />
                  </div>
                  <div className="p-4">
                    <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">캐릭터 느낌</div>
                    <div className="mt-2 text-base font-black text-slate-900">{style.label}</div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{style.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">공통 적용</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? '선택됨' : '먼저 선택'}</span>
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
              <h2 className="mt-2 text-xl font-black text-slate-900">이미지 후보 히스토리에서 출연자마다 대표 이미지 1장씩 직접 선택해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재 느낌은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>입니다.
                선택된 출연자 {selectedCharacters.length}명 중 {resolvedCount}명이 대표 이미지를 선택했습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onLocalStageChange('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                느낌 다시 선택
              </button>
              {uploadInput}
            </div>
          </div>

          {!!selectedCharacters.length && (
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">선택된 출연자 미리보기</div>
                  <div className="mt-1 text-sm font-black text-slate-900">Step3에서 고른 출연자만 유지되며, 각 출연자 카드에서 바로 이미지 등록과 대표 이미지 선택을 이어갑니다</div>
                </div>
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600">
                  대표 이미지 선택 {resolvedCount}/{selectedCharacterIds.length}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {selectedCharacters.map((character) => {
                  const previewSrc = resolveCharacterPreview(character);
                  const hasSelectedImage = Boolean(character.selectedImageId);
                  return (
                    <div
                      key={`${character.id}-preview`}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${hasSelectedImage ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
                    >
                      {previewSrc ? (
                        <img src={previewSrc} alt={`${character.name} 미리보기`} className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-sm font-black text-slate-600">
                          {getCharacterInitial(character.name)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-black text-slate-900">{character.name}</div>
                        <div className={`text-[11px] font-black ${hasSelectedImage ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {hasSelectedImage ? '대표 이미지 선택 완료' : '대표 이미지 선택 필요'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Step3 선택 출연자</div>
                <div className="mt-1 text-sm font-black text-slate-900">Step3에서 고른 출연자만 여기서 이미지 후보를 만들고 선택합니다</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600">
                대표 이미지 선택 {resolvedCount}/{selectedCharacterIds.length}
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
            <div className="mt-5 space-y-4">
              {selectedCharacters.map((character) => {
                const images = character.generatedImages || [];
                const isGenerating = characterLoadingProgress[character.id] !== undefined;
                const hasSelectedImage = Boolean(character.selectedImageId);
                const progress = characterLoadingProgress[character.id] || 0;
                return (
                  <div key={character.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {resolveCharacterPreview(character) ? (
                          <img
                            src={resolveCharacterPreview(character)}
                            alt={`${character.name} 대표 미리보기`}
                            className="h-16 w-16 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-lg font-black text-slate-600">
                            {getCharacterInitial(character.name)}
                          </div>
                        )}
                        <div>
                          <div className="text-lg font-black text-slate-900">{character.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : character.role === 'support' ? '조연' : '출연자')} · 후보 {images.length}장</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onUploadCharacterImage(character.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          이 출연자 이미지등록
                        </button>
                        <div className={`rounded-full px-3 py-1.5 text-xs font-black ${hasSelectedImage ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {hasSelectedImage ? '대표 이미지 선택 완료' : '대표 이미지 선택 필요'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => scrollStripBy(character.id, 'left')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-50"
                        aria-label={`${character.name} 후보 왼쪽으로`}
                      >
                        ←
                      </button>

                      <div
                        ref={(node) => {
                          stripRefs.current[character.id] = node;
                        }}
                        className="flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
                      >
                        <button
                          type="button"
                          onClick={() => onCreateVariants(character)}
                          disabled={isGenerating}
                          className="flex aspect-[4/5] w-[220px] shrink-0 snap-start flex-col items-center justify-center rounded-[22px] border border-dashed border-violet-300 bg-violet-50 px-5 text-center shadow-sm transition hover:border-violet-400 hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100"
                        >
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-black text-violet-600 shadow-sm">+</div>
                          <div className="mt-4 text-sm font-black text-slate-900">{isGenerating ? '이미지 생성 중...' : '이미지 생성'}</div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {isGenerating ? `새 후보를 만드는 중입니다. ${progress}%` : '첫 카드는 생성 버튼입니다. 새 후보는 오른쪽으로 차곡차곡 추가됩니다.'}
                          </p>
                        </button>

                        {images.map((image) => {
                          const selected = image.id === character.selectedImageId;
                          return (
                            <div
                              key={image.id}
                              role="button"
                              tabIndex={0}
                              data-character-image-card={image.id}
                              onClick={() => onSelectCharacterImage(character.id, image.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  onSelectCharacterImage(character.id, image.id);
                                }
                              }}
                              className={`w-[220px] shrink-0 snap-start overflow-hidden rounded-[22px] border bg-white text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-violet-200 ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
                            >
                              <img src={image.imageData} alt={image.label} className="aspect-[4/5] w-full object-cover" />
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-slate-900">{image.label}</div>
                                    <div className="mt-1 text-[11px] text-slate-500">{selected ? '현재 선택된 이미지' : '카드를 클릭하면 대표 이미지로 선택됩니다'}</div>
                                  </div>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? '선택됨' : '카드 클릭 선택'}</span>
                                </div>
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onCreateVariants(character, { sourceLabel: image.label, note: 'Generate a near-match alternative based on this selected reference.' });
                                    }}
                                    disabled={isGenerating}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    비슷하게 재생성
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => scrollStripBy(character.id, 'right')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:bg-slate-50"
                        aria-label={`${character.name} 후보 오른쪽으로`}
                      >
                        →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
