import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const CHARACTER_CARD_WIDTH = 220;
const CHARACTER_CARD_HEIGHT = 360;
const GENERATION_FAILSAFE_MS = 120000;
const START_CLICK_LOCK_MS = 700;

interface PendingGenerationCard {
  requestId: string;
  progress: number;
  sourceLabel?: string;
}

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

function isStripDragBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, input, select, textarea, a, [data-no-strip-drag="true"]'));
}

function findCharacterCardNode(container: HTMLDivElement | null, cardId: string) {
  if (!container) return null;
  return (
    Array.from(container.querySelectorAll<HTMLElement>('[data-character-image-card]')).find(
      (node) => node.dataset.characterImageCard === cardId
    ) || null
  );
}

function getGeneratedImageIds(character?: CharacterProfile) {
  return (character?.generatedImages || []).map((image) => image.id).filter(Boolean);
}

function hasNewGeneratedImage(character: CharacterProfile | undefined, expectedImageIds: string[]) {
  if (!character) return false;
  const expectedIdSet = new Set(expectedImageIds);
  return (character.generatedImages || []).some((image) => Boolean(image.id) && !expectedIdSet.has(image.id));
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
  onCreateVariants: (character: CharacterProfile, options?: { note?: string; sourceLabel?: string }) => void | Promise<void>;
  onDeleteCharacterImage?: (characterId: string, imageId: string) => void;
  uploadInput: React.ReactNode;
}

export default function Step4Panel({
  extractedCharacters,
  selectedCharacterIds,
  selectedCharacterStyleId,
  characterStyleOptions,
  localStage,
  characterLoadingProgress,
  onLocalStageChange,
  onSelectCharacterStyle,
  onUploadCharacterImage,
  onSelectCharacterImage,
  onCreateVariants,
  onDeleteCharacterImage,
  uploadInput,
}: Step4PanelProps) {
  const stripRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const latestCharactersRef = useRef<CharacterProfile[]>(extractedCharacters);
  const previousImageIdsRef = useRef<Record<string, string[]>>({});
  const pendingGenerationMapRef = useRef<Record<string, PendingGenerationCard[]>>({});
  const pendingRequestMetaRef = useRef<
    Record<
      string,
      {
        characterId: string;
        expectedImageIds: string[];
        hadProgress: boolean;
        timeoutId: number | null;
      }
    >
  >({});
  const requestSequenceRef = useRef(0);
  const clickLockRef = useRef<Record<string, number>>({});
  const dragStateRef = useRef<{
    active: boolean;
    characterId: string | null;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
    suppressClick: boolean;
    rafId: number | null;
    pendingScrollLeft: number;
  }>({
    active: false,
    characterId: null,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    suppressClick: false,
    rafId: null,
    pendingScrollLeft: 0,
  });

  const [draggingCharacterId, setDraggingCharacterId] = useState<string | null>(null);
  const [stripScrollState, setStripScrollState] = useState<Record<string, { canScrollLeft: boolean; canScrollRight: boolean }>>({});
  const [locallyDeletedImageIds, setLocallyDeletedImageIds] = useState<Record<string, string[]>>({});
  const [pendingGenerationMap, setPendingGenerationMap] = useState<Record<string, PendingGenerationCard[]>>({});

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

  const activeRunningCount = useMemo(
    () => Object.values(pendingGenerationMap).reduce((total, items) => total + items.length, 0),
    [pendingGenerationMap]
  );

  useEffect(() => {
    latestCharactersRef.current = extractedCharacters;
  }, [extractedCharacters]);

  useEffect(() => {
    pendingGenerationMapRef.current = pendingGenerationMap;
  }, [pendingGenerationMap]);

  useEffect(() => {
    return () => {
      Object.values(pendingRequestMetaRef.current).forEach((meta) => {
        if (meta.timeoutId) {
          window.clearTimeout(meta.timeoutId);
        }
      });
      pendingRequestMetaRef.current = {};
      clickLockRef.current = {};
    };
  }, []);

  const getPendingJobsForCharacter = (characterId: string) => pendingGenerationMapRef.current[characterId] || [];

  const syncStripScrollState = (characterId: string) => {
    const container = stripRefs.current[characterId];
    if (!container) {
      setStripScrollState((prev) => {
        if (!prev[characterId]) return prev;
        const next = { ...prev };
        delete next[characterId];
        return next;
      });
      return;
    }

    const firstCard = container.querySelector<HTMLElement>('[data-character-image-card]');
    const cards = container.querySelectorAll<HTMLElement>('[data-character-image-card]');
    const lastCard = cards.length ? cards[cards.length - 1] : null;
    const startThreshold = 6;
    const endThreshold = 6;

    const firstCardLeft = firstCard ? firstCard.offsetLeft - container.scrollLeft : 0;
    const lastCardRight = lastCard ? lastCard.offsetLeft + lastCard.offsetWidth - container.scrollLeft : 0;

    const canScrollLeft = firstCard ? firstCardLeft < -startThreshold : false;
    const canScrollRight = lastCard ? lastCardRight > container.clientWidth + endThreshold : false;

    setStripScrollState((prev) => {
      const current = prev[characterId];
      if (current?.canScrollLeft === canScrollLeft && current?.canScrollRight === canScrollRight) {
        return prev;
      }
      return { ...prev, [characterId]: { canScrollLeft, canScrollRight } };
    });
  };

  const patchPendingGenerationMap = (
    characterId: string,
    updater: (current: PendingGenerationCard[]) => PendingGenerationCard[]
  ) => {
    setPendingGenerationMap((prev) => {
      const current = prev[characterId] || [];
      const nextJobs = updater(current);
      if (nextJobs === current) return prev;

      const next = { ...prev };
      if (nextJobs.length) {
        next[characterId] = nextJobs;
      } else {
        delete next[characterId];
      }
      return next;
    });
  };

  const setPendingProgress = (characterId: string, requestId: string, progress: number) => {
    patchPendingGenerationMap(characterId, (current) =>
      current.map((job) =>
        job.requestId === requestId
          ? { ...job, progress: Math.max(4, Math.min(99, Math.round(progress))) }
          : job
      )
    );
  };

  const clearPendingGeneration = (requestId: string) => {
    const meta = pendingRequestMetaRef.current[requestId];
    if (!meta) return;

    if (meta.timeoutId) {
      window.clearTimeout(meta.timeoutId);
    }

    delete pendingRequestMetaRef.current[requestId];

    patchPendingGenerationMap(meta.characterId, (current) =>
      current.filter((job) => job.requestId !== requestId)
    );
  };

  const clearPendingGenerationByCharacter = (characterId: string) => {
    const jobs = getPendingJobsForCharacter(characterId);
    jobs.forEach((job) => clearPendingGeneration(job.requestId));
  };

  const scheduleGenerationFailsafe = (requestId: string) => {
    const meta = pendingRequestMetaRef.current[requestId];
    if (!meta) return;

    if (meta.timeoutId) {
      window.clearTimeout(meta.timeoutId);
    }

    meta.timeoutId = window.setTimeout(() => {
      clearPendingGeneration(requestId);
    }, GENERATION_FAILSAFE_MS);
  };

  const beginPendingGeneration = (character: CharacterProfile, options?: { note?: string; sourceLabel?: string }) => {
    const now = Date.now();
    const lockUntil = clickLockRef.current[character.id] || 0;
    const characterPendingCount = getPendingJobsForCharacter(character.id).length;

    if (lockUntil > now) return;
    if (characterPendingCount > 0) return;

    clickLockRef.current[character.id] = now + START_CLICK_LOCK_MS;
    window.setTimeout(() => {
      if ((clickLockRef.current[character.id] || 0) <= Date.now()) {
        delete clickLockRef.current[character.id];
      }
    }, START_CLICK_LOCK_MS + 50);

    requestSequenceRef.current += 1;
    const requestId = `${character.id}-generation-${requestSequenceRef.current}`;

    pendingRequestMetaRef.current[requestId] = {
      characterId: character.id,
      expectedImageIds: getGeneratedImageIds(character),
      hadProgress: false,
      timeoutId: null,
    };

    patchPendingGenerationMap(character.id, (current) => [
      ...current,
      {
        requestId,
        progress: 4,
        sourceLabel: options?.sourceLabel,
      },
    ]);

    scheduleGenerationFailsafe(requestId);

    try {
      const maybePromise = onCreateVariants(character, options) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
        (maybePromise as Promise<unknown>).catch(() => {
          clearPendingGeneration(requestId);
        });
      }
      nudgeCardToCenter(character.id, `loading-${requestId}`);
    } catch (error) {
      clearPendingGeneration(requestId);
      throw error;
    }
  };

  useEffect(() => {
    if (!selectedCharacterStyleId && localStage !== 'style') {
      onLocalStageChange('style');
    }
  }, [selectedCharacterStyleId, localStage, onLocalStageChange]);

  useEffect(() => {
    const selectedIdSet = new Set(selectedCharacters.map((character) => character.id));
    Object.keys(pendingGenerationMapRef.current).forEach((characterId) => {
      if (!selectedIdSet.has(characterId)) {
        clearPendingGenerationByCharacter(characterId);
      }
    });
  }, [selectedCharacters]);

  const centerCardInStrip = (characterId: string, cardId: string, behavior: ScrollBehavior = 'smooth') => {
    const container = stripRefs.current[characterId];
    const cardNode = findCharacterCardNode(container, cardId);
    if (!container || !cardNode) return;

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const rawTargetScrollLeft = cardNode.offsetLeft - (container.clientWidth - cardNode.offsetWidth) / 2;
    const targetScrollLeft = Math.min(Math.max(rawTargetScrollLeft, 0), maxScrollLeft);

    if (Math.abs(targetScrollLeft - container.scrollLeft) < 1) {
      syncStripScrollState(characterId);
      return;
    }

    container.scrollTo({ left: targetScrollLeft, behavior });
    window.requestAnimationFrame(() => window.setTimeout(() => syncStripScrollState(characterId), 220));
  };

  const nudgeCardToCenter = (characterId: string, cardId: string) => {
    [0, 90, 180, 320].forEach((delay) => {
      window.setTimeout(() => centerCardInStrip(characterId, cardId), delay);
    });
  };

  const handleSelectCharacterCard = (characterId: string, imageId: string) => {
    onSelectCharacterImage(characterId, imageId);
    nudgeCardToCenter(characterId, imageId);
  };

  const triggerCharacterGeneration = (
    character: CharacterProfile,
    options?: { note?: string; sourceLabel?: string }
  ) => {
    beginPendingGeneration(character, options);
  };

  useEffect(() => {
    selectedCharacters.forEach((character) => {
      const currentIds = getGeneratedImageIds(character);
      const hadPreviousSnapshot = Object.prototype.hasOwnProperty.call(previousImageIdsRef.current, character.id);
      const previousIds = previousImageIdsRef.current[character.id] || [];
      const previousIdSet = new Set(previousIds);
      const newIds = hadPreviousSnapshot ? currentIds.filter((id) => !previousIdSet.has(id)) : [];

      if (newIds.length > 0) {
        const pendingJobs = getPendingJobsForCharacter(character.id);
        pendingJobs.slice(0, newIds.length).forEach((job) => clearPendingGeneration(job.requestId));

        const newestId = newIds[newIds.length - 1] || currentIds[currentIds.length - 1];
        if (newestId) {
          nudgeCardToCenter(character.id, newestId);
        }
      }

      previousImageIdsRef.current[character.id] = currentIds;
      window.requestAnimationFrame(() => syncStripScrollState(character.id));
    });
  }, [selectedCharacters]);

  useEffect(() => {
    selectedCharacters.forEach((character) => {
      window.requestAnimationFrame(() => syncStripScrollState(character.id));
    });
  }, [selectedCharacters, localStage]);

  useEffect(() => {
    selectedCharacters.forEach((character) => {
      const progressValue = characterLoadingProgress[character.id];
      const pendingJobs = getPendingJobsForCharacter(character.id);
      const pendingJob = pendingJobs[0];

      if (!pendingJob) {
        window.requestAnimationFrame(() => syncStripScrollState(character.id));
        return;
      }

      const generationMeta = pendingRequestMetaRef.current[pendingJob.requestId];
      if (!generationMeta) return;

      if (typeof progressValue === 'number' && progressValue > 0 && progressValue < 100) {
        generationMeta.hadProgress = true;
        setPendingProgress(character.id, pendingJob.requestId, progressValue);
      }

      if (hasNewGeneratedImage(character, generationMeta.expectedImageIds)) {
        clearPendingGeneration(pendingJob.requestId);
      } else if (typeof progressValue === 'number' && progressValue >= 100) {
        clearPendingGeneration(pendingJob.requestId);
      } else if ((progressValue === undefined || progressValue <= 0) && generationMeta.hadProgress) {
        clearPendingGeneration(pendingJob.requestId);
      }

      window.requestAnimationFrame(() => syncStripScrollState(character.id));
    });
  }, [selectedCharacters, characterLoadingProgress, extractedCharacters]);

  const scrollStripBy = (characterId: string, direction: 'left' | 'right') => {
    const container = stripRefs.current[characterId];
    if (!container) return;
    const amount = Math.max(220, Math.floor(container.clientWidth * 0.72));
    container.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
    window.requestAnimationFrame(() => window.setTimeout(() => syncStripScrollState(characterId), 180));
  };

  const releaseStripDrag = (characterId: string, pointerId?: number) => {
    const container = stripRefs.current[characterId];
    if (container && pointerId !== undefined && container.hasPointerCapture(pointerId)) {
      container.releasePointerCapture(pointerId);
    }
    if (dragStateRef.current.rafId) {
      window.cancelAnimationFrame(dragStateRef.current.rafId);
      dragStateRef.current.rafId = null;
    }
    dragStateRef.current.active = false;
    setDraggingCharacterId((current) => (current === characterId ? null : current));
    syncStripScrollState(characterId);
    window.setTimeout(() => {
      dragStateRef.current.suppressClick = false;
      dragStateRef.current.moved = false;
      dragStateRef.current.characterId = null;
      dragStateRef.current.pendingScrollLeft = 0;
    }, 0);
  };

  return (
    <div className="space-y-6">
      {localStage === 'style' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">캐릭터 느낌 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">먼저 캐릭터 느낌을 골라주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">다음으로 버튼을 누르면 이미지 제작 화면으로 넘어갑니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {selectedCharacterStyleId ? '선택 완료' : '느낌 선택 필요'}
              </div>
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
                  className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${
                    selected
                      ? 'border-violet-400 ring-2 ring-violet-200'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'
                  }`}
                >
                  <div className="relative overflow-hidden border-b border-slate-200 bg-slate-100">
                    {selected ? (
                      <span className="absolute right-2 top-2 z-10 rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                        선택됨
                      </span>
                    ) : null}

                    <img
                      src={style.sampleImage || buildSampleStylePreview(style.id, style.label, style.description)}
                      alt={`${style.label} 샘플`}
                      className="aspect-[16/10] w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = buildSampleStylePreview(style.id, style.label, style.description);
                      }}
                    />
                  </div>

                  <div className="p-4">
                    <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      캐릭터 느낌
                    </div>
                    <div className="mt-2 text-base font-black text-slate-900">{style.label}</div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{style.description}</p>
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
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">캐릭터 제작</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">출연자의 대표 이미지를 선택해주세요</h2>
              <div className="rounded-full bg-white py-1.5 text-xs font-black text-slate-600">
                대표 이미지 선택 {resolvedCount}/{selectedCharacters.length}
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  현재 느낌은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>입니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onLocalStageChange('style')}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                느낌 바꾸기
              </button>
            </div>
          </div>

          <div className="hidden">{uploadInput}</div>

          {!selectedCharacters.length && (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <div className="text-base font-black text-slate-900">선택된 출연자가 아직 없습니다</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Step3에서 출연자를 1명 이상 선택해야 Step4에서 이미지 제작을 진행할 수 있습니다.
              </p>
            </div>
          )}

          {!!selectedCharacters.length && (
            <div className="mt-5 space-y-4">
              {selectedCharacters.map((character) => {
                const hiddenImageIds = locallyDeletedImageIds[character.id] || [];
                const images = (character.generatedImages || []).filter((image) => !hiddenImageIds.includes(image.id));
                const pendingJobs = pendingGenerationMap[character.id] || [];
                const pendingJob = pendingJobs[0] || null;
                const isGenerating = pendingJobs.length > 0;
                const isGenerationBlocked = isGenerating;
                const hasSelectedImage =
                  Boolean(character.selectedImageId) && images.some((image) => image.id === character.selectedImageId);
                const progress = pendingJob?.progress || 0;
                const visibleCandidateCount = images.length + pendingJobs.length;

                const displayCards: Array<
                  | { kind: 'image'; image: (typeof images)[number] }
                  | { kind: 'loading'; job: PendingGenerationCard }
                > = [
                  ...images.map((image) => ({ kind: 'image' as const, image })),
                  ...pendingJobs.map((job) => ({ kind: 'loading' as const, job })),
                ];

                return (
                  <div key={character.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className='flex'>
                          <div className="text-lg font-black text-slate-900">{character.name}</div>
                          <div className="mt-1 text-xs text-slate-500 ml-4">
                            {character.roleLabel ||
                              (character.role === 'lead' ? '주인공' : character.role === 'support' ? '조연' : '출연자')}
                            {' · '}
                            후보 {visibleCandidateCount}장
                            {' · '}
                            현재 생성 {activeRunningCount}건
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div
                          className={`rounded-full px-3 py-1.5 text-xs font-black ${
                            hasSelectedImage ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {hasSelectedImage ? '대표 이미지 선택 완료' : '대표 이미지 선택 필요'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid items-stretch gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                      <div
                        style={{ width: CHARACTER_CARD_WIDTH, height: CHARACTER_CARD_HEIGHT }}
                        className="relative z-30 flex shrink-0 items-center justify-center self-stretch justify-self-center overflow-visible pointer-events-auto"
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        <div className="relative flex h-full w-full overflow-hidden rounded-[24px] border border-white/70 bg-white/72 shadow-[0_14px_42px_rgba(148,163,184,0.16)] backdrop-blur-xl">
                          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-b from-white/90 via-sky-50/70 to-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (isGenerationBlocked) return;
                                triggerCharacterGeneration(character);
                              }}
                              disabled={isGenerationBlocked}
                              className="group relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-65"
                            >
                              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/10 text-3xl font-black text-sky-600 shadow-sm ring-1 ring-sky-200/80 transition group-hover:scale-[1.03]">
                                +
                              </div>
                              <div className="mt-4 text-base font-black text-slate-900">새 캐릭터 생성</div>
                              <div className="mt-2 text-xs font-bold text-slate-500">
                                {isGenerating ? '이 캐릭터는 생성 중' : '새 후보 카드 추가'}
                              </div>
                            </button>
                            <div className="border-t border-white/70 p-3">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onUploadCharacterImage(character.id);
                                }}
                                className="flex h-11 w-full items-center justify-center rounded-[14px] border border-slate-200/90 bg-white/90 px-3 text-sm font-black text-slate-800 shadow-[0_8px_20px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/90"
                              >
                                이미지 등록
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{ minHeight: CHARACTER_CARD_HEIGHT }}
                        className="relative z-0 min-w-0 overflow-visible"
                      >
                        {stripScrollState[character.id]?.canScrollLeft ? (
                          <button
                            type="button"
                            onClick={() => scrollStripBy(character.id, 'left')}
                            className="absolute left-1 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-lg font-black text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                            aria-label={`${character.name} 후보 왼쪽으로`}
                          >
                            ←
                          </button>
                        ) : null}
                        {stripScrollState[character.id]?.canScrollRight ? (
                          <button
                            type="button"
                            onClick={() => scrollStripBy(character.id, 'right')}
                            className="absolute right-1 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-lg font-black text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                            aria-label={`${character.name} 후보 오른쪽으로`}
                          >
                            →
                          </button>
                        ) : null}

                        <div
                          ref={(node) => {
                            stripRefs.current[character.id] = node;
                            if (node) {
                              window.requestAnimationFrame(() => syncStripScrollState(character.id));
                            }
                          }}
                          style={{
                            touchAction: 'pan-x',
                            scrollPaddingInline: '0px',
                            minHeight: CHARACTER_CARD_HEIGHT + 16,
                          }}
                          onScroll={() => syncStripScrollState(character.id)}
                          onContextMenu={(event) => event.preventDefault()}
                          onDragStart={(event) => event.preventDefault()}
                          onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            if (isStripDragBlockedTarget(event.target)) return;
                            const container = stripRefs.current[character.id];
                            if (!container) return;
                            dragStateRef.current = {
                              active: true,
                              characterId: character.id,
                              startX: event.clientX,
                              startScrollLeft: container.scrollLeft,
                              moved: false,
                              suppressClick: false,
                              rafId: null,
                              pendingScrollLeft: container.scrollLeft,
                            };
                            container.setPointerCapture(event.pointerId);
                            setDraggingCharacterId(character.id);
                          }}
                          onPointerMove={(event) => {
                            const container = stripRefs.current[character.id];
                            if (!container || !dragStateRef.current.active || dragStateRef.current.characterId !== character.id) return;

                            const deltaX = event.clientX - dragStateRef.current.startX;
                            if (!dragStateRef.current.moved && Math.abs(deltaX) < 4) return;

                            if (!dragStateRef.current.moved) {
                              dragStateRef.current.moved = true;
                              dragStateRef.current.suppressClick = true;
                            }

                            const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
                            const nextScrollLeft = Math.min(
                              Math.max(dragStateRef.current.startScrollLeft - deltaX, 0),
                              maxScrollLeft
                            );

                            dragStateRef.current.pendingScrollLeft = nextScrollLeft;

                            if (dragStateRef.current.rafId === null) {
                              dragStateRef.current.rafId = window.requestAnimationFrame(() => {
                                const latestContainer = stripRefs.current[character.id];
                                if (latestContainer) {
                                  latestContainer.scrollLeft = dragStateRef.current.pendingScrollLeft;
                                  syncStripScrollState(character.id);
                                }
                                dragStateRef.current.rafId = null;
                              });
                            }
                          }}
                          onPointerUp={(event) => {
                            if (dragStateRef.current.characterId !== character.id) return;
                            releaseStripDrag(character.id, event.pointerId);
                          }}
                          onPointerLeave={(event) => {
                            if (dragStateRef.current.characterId !== character.id || !dragStateRef.current.active) return;
                            releaseStripDrag(character.id, event.pointerId);
                          }}
                          onPointerCancel={(event) => {
                            if (dragStateRef.current.characterId !== character.id) return;
                            releaseStripDrag(character.id, event.pointerId);
                          }}
                          onClickCapture={(event) => {
                            if (!dragStateRef.current.suppressClick || dragStateRef.current.characterId !== character.id) return;
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          className={`flex min-w-0 gap-3 overflow-x-auto overflow-y-visible px-5 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                            draggingCharacterId === character.id ? 'select-none snap-none cursor-grabbing' : 'snap-x snap-mandatory cursor-grab'
                          }`}
                        >
                          {displayCards.map((card, cardIndex) => {
                            if (card.kind === 'loading') {
                              const loadingJob = card.job;
                              return (
                                <div
                                  key={`loading-${loadingJob.requestId}`}
                                  data-character-image-card={`loading-${loadingJob.requestId}`}
                                  style={{ width: CHARACTER_CARD_WIDTH, height: CHARACTER_CARD_HEIGHT }}
                                  className="flex shrink-0 snap-start rounded-[24px] border border-white/70 bg-white/70 shadow-[0_10px_28px_rgba(148,163,184,0.16)] backdrop-blur-xl"
                                >
                                  <div className="flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-sky-100 bg-gradient-to-b from-sky-50 via-white to-sky-50/80 text-left">
                                    <div className="flex h-[230px] items-center justify-center bg-sky-50/90 px-6 text-center">
                                      <div className="w-full">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-black text-sky-600 shadow-sm animate-pulse ring-1 ring-sky-200">
                                          +
                                        </div>
                                        <div className="mt-4 text-center text-sm font-black text-slate-900">새 후보 생성 중</div>
                                        <p className="mt-2 text-center text-xs leading-5 text-slate-600">
                                          {Math.max(4, progress)}% 완료 · 최대 2분 대기
                                        </p>
                                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-sky-100">
                                          <div
                                            className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                            style={{ width: `${Math.max(progress, 8)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-1 flex-col p-3">
                                      <div className="truncate text-sm font-black text-slate-900">
                                        {loadingJob.sourceLabel
                                          ? `${loadingJob.sourceLabel} 기반 새 후보 준비 중`
                                          : '새 캐릭터 후보 준비 중'}
                                      </div>
                                      <p className="mt-2 text-xs leading-5 text-slate-500">
                                        생성 완료되면 이 자리에 새 이미지 카드가 표시됩니다. 2분 안에 응답이 없으면 로딩 카드는 자동으로 정리됩니다.
                                      </p>
                                      <div className="mt-auto rounded-xl bg-sky-50 px-3 py-2 text-center text-xs font-black text-sky-600">
                                        로딩 중...
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            const image = card.image;
                            const selected = image.id === character.selectedImageId;

                            return (
                              <div
                                key={image.id}
                                data-character-image-card={image.id}
                                style={{ width: CHARACTER_CARD_WIDTH, height: CHARACTER_CARD_HEIGHT }}
                                className={`flex shrink-0 snap-start rounded-[24px] transition-all duration-200 ease-out ${
                                  selected
                                    ? 'bg-sky-50 shadow-[0_12px_28px_rgba(14,165,233,0.12)]'
                                    : 'bg-transparent hover:-translate-y-0.5'
                                } ${draggingCharacterId === character.id ? 'scale-[0.985]' : ''}`}
                              >
                                <div
                                  className={`flex h-full w-full flex-col overflow-hidden rounded-[24px] border text-left shadow-sm transition ${
                                    selected
                                      ? 'border-sky-300 bg-sky-50/90 shadow-[0_10px_24px_rgba(125,211,252,0.16)]'
                                      : 'border-slate-200 bg-white/90 hover:border-sky-200'
                                  }`}
                                >
                                  <div className="relative h-[230px] w-full overflow-hidden">
                                    <button
                                      type="button"
                                      data-no-strip-drag="true"
                                      onClick={() => handleSelectCharacterCard(character.id, image.id)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          handleSelectCharacterCard(character.id, image.id);
                                        }
                                      }}
                                      onContextMenu={(event) => event.preventDefault()}
                                      className="group block h-full w-full text-left outline-none"
                                      aria-pressed={selected}
                                      aria-label={`${image.label}${selected ? ' 선택됨' : ' 선택하기'}`}
                                    >
                                      <div className="flex h-full w-full items-center justify-center bg-slate-50 p-4 text-center">
                                        <img
                                          src={image.imageData}
                                          alt={image.label}
                                          draggable={false}
                                          className="block h-full w-full object-contain object-center transition group-hover:scale-[1.01]"
                                        />
                                      </div>
                                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/10 via-slate-900/0 to-transparent" />
                                    </button>

                                    <button
                                      type="button"
                                      data-no-strip-drag="true"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (!window.confirm('진짜 삭제하겠습니까?')) return;

                                        setLocallyDeletedImageIds((prev) => ({
                                          ...prev,
                                          [character.id]: [...(prev[character.id] || []), image.id],
                                        }));

                                        if (typeof onDeleteCharacterImage === 'function') {
                                          onDeleteCharacterImage(character.id, image.id);
                                        }

                                        if (character.selectedImageId === image.id) {
                                          const remainingImages = images.filter((item) => item.id !== image.id);
                                          onSelectCharacterImage(character.id, remainingImages[0]?.id || '');
                                        }
                                      }}
                                      onContextMenu={(event) => event.preventDefault()}
                                      className="absolute right-3 top-3 z-10 flex h-8 min-w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50/95 px-2 text-[11px] font-black text-rose-600 shadow-sm transition hover:bg-rose-100"
                                      aria-label={`${image.label} 삭제`}
                                    >
                                      삭제
                                    </button>

                                    {selected ? (
                                      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                                        선택됨
                                      </span>
                                    ) : null}
                                  </div>

                                  <div
                                    className={`flex flex-1 flex-col p-3 transition-transform duration-200 ${
                                      draggingCharacterId === character.id ? 'cursor-grabbing' : 'cursor-grab'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        data-no-strip-drag="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSelectCharacterCard(character.id, image.id);
                                        }}
                                        onContextMenu={(event) => event.preventDefault()}
                                        className="block w-full truncate text-left text-sm font-black text-slate-900 hover:text-sky-700"
                                      >
                                        {image.label || `후보 ${cardIndex + 1}`}
                                      </button>
                                    </div>

                                    <div className="mt-auto space-y-2 pt-3">
                                      <button
                                        type="button"
                                        data-no-strip-drag="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSelectCharacterCard(character.id, image.id);
                                        }}
                                        onContextMenu={(event) => event.preventDefault()}
                                        className={`w-full rounded-xl border px-3 py-2 text-xs font-black transition ${
                                          selected
                                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                                            : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                                        }`}
                                      >
                                        {selected ? '선택됨' : '선택하기'}
                                      </button>

                                      <button
                                        type="button"
                                        data-no-strip-drag="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (isGenerationBlocked) return;
                                          triggerCharacterGeneration(character, {
                                            sourceLabel: image.label,
                                            note: 'Generate a near-match alternative based on this selected reference.',
                                          });
                                        }}
                                        onContextMenu={(event) => event.preventDefault()}
                                        disabled={isGenerationBlocked}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                                      >
                                        {isGenerating ? '이 캐릭터 생성 중' : '비슷하게 재생성'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
