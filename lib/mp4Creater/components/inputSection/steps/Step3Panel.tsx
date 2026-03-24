import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CharacterProfile,
  ConstitutionAnalysisSummary,
  ContentType,
  ReferenceLinkDraft,
  WorkflowPromptTemplateEngine,
} from '../../../types';

interface Step3PanelProps {
  contentType: ContentType;
  isGeneratingScript: boolean;
  sceneCount: number;
  storyScript: string;
  customScriptReferenceText: string;
  scriptReferenceSuggestions: string[];
  referenceLinks: ReferenceLinkDraft[];
  pendingLinkUrl: string;
  showReferenceLinkInput: boolean;
  isAddingReferenceLink: boolean;
  selectedScriptModel: string;
  scriptModelOptions: Array<{ id: string; name: string }>;
  constitutionAnalysis: ConstitutionAnalysisSummary | null;
  selectedPromptTemplateName: string;
  selectedPromptTemplateEngine: WorkflowPromptTemplateEngine;
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  isHydratingCharacters: boolean;
  isLoadingVoiceCatalogs: boolean;
  projectVoiceProvider: 'qwen3Tts' | 'elevenLabs' | 'google' | 'heygen';
  projectVoiceSummary: string;
  elevenLabsVoices: Array<{
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: { accent?: string; gender?: string; description?: string };
  }>;
  heygenVoices: Array<{
    voice_id: string;
    name: string;
    language?: string;
    gender?: string;
    preview_audio_url?: string;
    preview_audio?: string;
  }>;
  activeVoicePreviewCharacterId: string | null;
  voicePreviewMessage: string;
  newCharacterName: string;
  newCharacterPrompt: string;
  onGenerateScript: () => void;
  onViewPrompt: () => void;
  onStoryScriptChange: (value: string) => void;
  onSaveStoryScript: () => void;
  onCustomScriptReferenceTextChange: (value: string) => void;
  onApplyScriptReferenceSuggestion: (value: string) => void;
  onRefreshScriptReferenceSuggestions: () => void;
  onPendingLinkUrlChange: (value: string) => void;
  onToggleReferenceLinkInput: () => void;
  onAddReferenceLink: () => void;
  onRemoveReferenceLink: (id: string) => void;
  onScriptModelChange: (value: string) => void;
  onCharacterToggle: (characterId: string) => void;
  onCharacterRemove: (characterId: string) => void;
  onCharacterVoiceProviderChange: (
    characterId: string,
    provider: 'qwen3Tts' | 'elevenLabs' | 'google'
  ) => void;
  onCharacterVoiceChoiceChange: (
    characterId: string,
    provider: 'qwen3Tts' | 'elevenLabs' | 'google',
    value: string
  ) => void;
  onCharacterVoiceDirectInputChange: (
    characterId: string,
    provider: 'elevenLabs' | 'google',
    value: string
  ) => void;
  onPreviewCharacterVoice: (characterId: string) => void;
  onNewCharacterNameChange: (value: string) => void;
  onNewCharacterPromptChange: (value: string) => void;
  onCreateNewCharacter: () => void;
  onCreateCharacterFromForm: (payload: {
    name: string;
    position: string;
    description: string;
  }) => void;
  getCharacterVoiceSummary: (character: CharacterProfile) => string;
  castSelectionHighlightTick?: number;
}

const QWEN_VOICE_OPTIONS = [
  { id: 'qwen-default', name: 'qwen3-tts 기본 보이스' },
  { id: 'qwen-soft', name: 'qwen3-tts 부드러운 보이스' },
];

function SelectablePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
        active
          ? 'border-violet-600 bg-violet-600 text-white'
          : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
      }`}
    >
      {label}
    </button>
  );
}

function ScrollArrow({
  direction,
  visible,
  onClick,
}: {
  direction: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? '왼쪽으로 이동' : '오른쪽으로 이동'}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={`absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur transition-all duration-300 ${
        direction === 'left' ? 'left-2' : 'right-2'
      } ${
        visible
          ? 'pointer-events-auto scale-100 opacity-100 hover:bg-slate-50'
          : 'pointer-events-none scale-95 opacity-0'
      }`}
    >
      <span className="text-lg font-black">{direction === 'left' ? '‹' : '›'}</span>
    </button>
  );
}

function CharacterRail({
  children,
  step = 392,
  focusIndex,
  itemCount,
}: {
  children: React.ReactNode;
  step?: number;
  focusIndex?: number | null;
  itemCount: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const draggingRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    suppressClick: false,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, input, select, textarea, label, a, [role="button"], [data-no-card-scroll="true"]'
      )
    );
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    setCanScrollLeft(container.scrollLeft > 2);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 2);
  }, []);

  const revealArrowsTemporarily = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    if (maxScrollLeft <= 2) {
      setShowArrows(false);
      clearHideTimer();
      return;
    }
    setShowArrows(true);
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setShowArrows(false);
      hideTimerRef.current = null;
    }, 2200);
  }, [clearHideTimer]);

  useEffect(() => {
    updateScrollState();
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => updateScrollState();
    const handleScroll = () => updateScrollState();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [children, updateScrollState]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (focusIndex === undefined || focusIndex === null) return;

    const focusedElement = container.querySelector<HTMLElement>(
      `[data-rail-index="${focusIndex}"]`
    );
    if (!focusedElement) return;

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    let nextScrollLeft = 0;

    if (focusIndex <= 0) {
      nextScrollLeft = 0;
    } else if (focusIndex >= itemCount - 1) {
      nextScrollLeft = maxScrollLeft;
    } else {
      const containerWidth = container.clientWidth;
      const targetLeft =
        focusedElement.offsetLeft - containerWidth / 2 + focusedElement.offsetWidth / 2;
      nextScrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);
    }

    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(() => {
        container.scrollTo({
          left: nextScrollLeft,
          behavior: 'smooth',
        });
        revealArrowsTemporarily();
      });

      return () => window.cancelAnimationFrame(raf2);
    });

    return () => window.cancelAnimationFrame(raf1);
  }, [focusIndex, itemCount, revealArrowsTemporarily]);

  const scrollByDirection = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    revealArrowsTemporarily();
    container.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className="relative"
      onMouseEnter={revealArrowsTemporarily}
      onFocusCapture={revealArrowsTemporarily}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" />

      <ScrollArrow
        direction="left"
        visible={showArrows && canScrollLeft}
        onClick={() => scrollByDirection('left')}
      />
      <ScrollArrow
        direction="right"
        visible={showArrows && canScrollRight}
        onClick={() => scrollByDirection('right')}
      />

      <div
        ref={containerRef}
        style={{ touchAction: 'pan-x' }}
        className={`flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-default'
        }`}
        onWheel={(event) => {
          const target = event.target as HTMLElement | null;
          if (!target?.closest('[data-card-wheel-zone="true"]')) return;
          if (isInteractiveTarget(target)) return;

          const container = containerRef.current;
          if (!container) return;

          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (Math.abs(delta) < 1) return;

          container.scrollLeft += delta;
          revealArrowsTemporarily();
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const target = event.target as HTMLElement | null;
          if (!target?.closest('[data-card-drag-zone="true"]')) return;
          if (isInteractiveTarget(target)) return;

          const container = containerRef.current;
          if (!container) return;

          draggingRef.current = {
            active: true,
            startX: event.clientX,
            startScrollLeft: container.scrollLeft,
            moved: false,
            suppressClick: false,
          };

          container.setPointerCapture(event.pointerId);
          setIsDragging(true);
          revealArrowsTemporarily();
        }}
        onPointerMove={(event) => {
          const container = containerRef.current;
          if (!container || !draggingRef.current.active) return;

          const deltaX = event.clientX - draggingRef.current.startX;
          if (!draggingRef.current.moved && Math.abs(deltaX) < 6) return;

          draggingRef.current.moved = true;
          draggingRef.current.suppressClick = true;
          revealArrowsTemporarily();
          container.scrollLeft = draggingRef.current.startScrollLeft - deltaX;
        }}
        onPointerUp={(event) => {
          const container = containerRef.current;
          draggingRef.current.active = false;
          setIsDragging(false);
          if (container?.hasPointerCapture(event.pointerId)) {
            container.releasePointerCapture(event.pointerId);
          }
          updateScrollState();
          revealArrowsTemporarily();

          window.setTimeout(() => {
            draggingRef.current.suppressClick = false;
            draggingRef.current.moved = false;
          }, 0);
        }}
        onPointerCancel={(event) => {
          const container = containerRef.current;
          draggingRef.current.active = false;
          draggingRef.current.moved = false;
          draggingRef.current.suppressClick = false;
          setIsDragging(false);
          if (container?.hasPointerCapture(event.pointerId)) {
            container.releasePointerCapture(event.pointerId);
          }
          updateScrollState();
        }}
        onClickCapture={(event) => {
          if (!draggingRef.current.suppressClick) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Step3Panel({
  isGeneratingScript,
  sceneCount,
  storyScript,
  selectedScriptModel,
  scriptModelOptions: scriptModelOptionsProp,
  extractedCharacters: extractedCharactersProp,
  selectedCharacterIds: selectedCharacterIdsProp,
  isHydratingCharacters,
  elevenLabsVoices: elevenLabsVoicesProp,
  activeVoicePreviewCharacterId,
  voicePreviewMessage,
  onGenerateScript,
  onViewPrompt,
  onStoryScriptChange,
  onSaveStoryScript,
  onScriptModelChange,
  onCharacterToggle,
  onCharacterRemove,
  onCharacterVoiceProviderChange,
  onCharacterVoiceChoiceChange,
  onCharacterVoiceDirectInputChange,
  onPreviewCharacterVoice,
  onCreateCharacterFromForm,
  castSelectionHighlightTick = 0,
}: Step3PanelProps) {
  const scriptModelOptions = Array.isArray(scriptModelOptionsProp) ? scriptModelOptionsProp : [];
  const extractedCharacters = Array.isArray(extractedCharactersProp) ? extractedCharactersProp : [];
  const selectedCharacterIds = Array.isArray(selectedCharacterIdsProp) ? selectedCharacterIdsProp : [];
  const elevenLabsVoices = Array.isArray(elevenLabsVoicesProp) ? elevenLabsVoicesProp : [];

  const [highlightCastSelection, setHighlightCastSelection] = useState(false);
  const [manualCharacterName, setManualCharacterName] = useState('');
  const [manualCharacterPosition, setManualCharacterPosition] = useState('');
  const [manualCharacterDescription, setManualCharacterDescription] = useState('');
  const [showInlineAddCharacterCard, setShowInlineAddCharacterCard] = useState(false);
  const [savedScriptSnapshot, setSavedScriptSnapshot] = useState(storyScript || '');
  const [railFocusIndex, setRailFocusIndex] = useState<number | null>(null);

  const prevCharacterCountRef = useRef(extractedCharacters.length);

  const selectedCount = selectedCharacterIds.length;
  const scriptCharacterCount = Array.from(storyScript || '').length;

  const canSubmitManualCharacter =
    manualCharacterName.trim().length > 0 &&
    manualCharacterPosition.trim().length > 0 &&
    manualCharacterDescription.trim().length > 0;

  const currentRoleLabel = useMemo(
    () => manualCharacterPosition.trim() || '포지션',
    [manualCharacterPosition]
  );

  const isScriptModified = useMemo(
    () => (storyScript || '') !== (savedScriptSnapshot || ''),
    [storyScript, savedScriptSnapshot]
  );

  useEffect(() => {
    if (isGeneratingScript) {
      setSavedScriptSnapshot(storyScript || '');
    }
  }, [isGeneratingScript, storyScript]);

  useEffect(() => {
    if (!castSelectionHighlightTick) return;
    setHighlightCastSelection(true);
    const timer = window.setTimeout(() => setHighlightCastSelection(false), 1800);
    return () => window.clearTimeout(timer);
  }, [castSelectionHighlightTick]);

  useEffect(() => {
    if (showInlineAddCharacterCard) {
      setRailFocusIndex(extractedCharacters.length);
    }
  }, [showInlineAddCharacterCard, extractedCharacters.length]);

  useEffect(() => {
    if (extractedCharacters.length > prevCharacterCountRef.current) {
      setShowInlineAddCharacterCard(false);
      setRailFocusIndex(extractedCharacters.length - 1);
    }
    prevCharacterCountRef.current = extractedCharacters.length;
  }, [extractedCharacters]);

  const stopCardToggle = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const resetInlineCharacterForm = () => {
    setManualCharacterName('');
    setManualCharacterPosition('');
    setManualCharacterDescription('');
    setShowInlineAddCharacterCard(false);
  };

  const handleCharacterSelect = (
    event: React.SyntheticEvent,
    characterId: string
  ) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, select, textarea, label, a')) return;
    onCharacterToggle(characterId);
  };

  const totalRailItems =
    extractedCharacters.length + (showInlineAddCharacterCard ? 1 : 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="whitespace-nowrap text-[20px] font-black uppercase text-violet-900">
            AI 설정
          </div>

          <div className="flex flex-row flex-nowrap items-center gap-3 overflow-x-auto">
            <select
              value={selectedScriptModel}
              onChange={(e) => onScriptModelChange(e.target.value)}
              className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {scriptModelOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.id === 'sample-script' ? ' · 무료' : ' · 유료'}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onViewPrompt}
              className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              프롬프트 보기
            </button>

            <button
              type="button"
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="shrink-0 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isGeneratingScript ? '대본 생성 중...' : '대본 생성'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">최종 대본</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              대본은 바로 수정할 수 있습니다. 텍스트를 추가하거나 제거해 실제 변경이 생기면
              수정하기와 수정취소 버튼이 나타나고, 수정 반영 시 출연자도 새로 업데이트됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {sceneCount}문단
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {scriptCharacterCount}자
            </span>

            {isScriptModified ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSaveStoryScript();
                    setSavedScriptSnapshot(storyScript || '');
                  }}
                  disabled={isHydratingCharacters}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isHydratingCharacters ? '출연자 업데이트 중...' : '수정하기'}
                </button>

                <button
                  type="button"
                  onClick={() => onStoryScriptChange(savedScriptSnapshot)}
                  disabled={isHydratingCharacters}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  수정취소
                </button>
              </>
            ) : null}
          </div>
        </div>

        <textarea
          value={storyScript}
          onChange={(e) => onStoryScriptChange(e.target.value)}
          className={`min-h-[420px] w-full rounded-3xl border px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition ${
            isScriptModified
              ? 'border-blue-300 bg-white focus:border-blue-400'
              : 'border-slate-200 bg-slate-50 focus:border-slate-300'
          }`}
          placeholder="여기에 최종 대본을 입력하거나 생성해 주세요."
        />

        {isScriptModified ? (
          <div className="mt-3 rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-6 text-blue-800">
            최종 대본이 수정되었습니다. 수정하기를 누르면 이 내용을 기준으로 출연자가 다시 업데이트됩니다.
          </div>
        ) : null}
      </section>

      <section
        data-step3-cast-section
        className={`rounded-[28px] border bg-white p-5 shadow-sm transition-all duration-300 ${
          highlightCastSelection
            ? 'animate-pulse border-amber-400 shadow-amber-100 ring-4 ring-amber-100'
            : 'border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
              출연자 선택 + TTS
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Step4로 넘길 출연자를 고르고, 각 카드에서 TTS까지 바로 정해 주세요
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              카드 상단 정보 영역은 선택, 아래 설정 배경은 드래그 또는 마우스 휠로 좌우 이동할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-black">
            <button
              type="button"
              onClick={() => setShowInlineAddCharacterCard(true)}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
            >
              출연자 추가
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              선택된 출연자 {selectedCount}명
            </span>
          </div>
        </div>

        {highlightCastSelection ? (
          <div className="mt-4 rounded-[20px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-900">
            여기에서 Step4로 넘길 출연자를 먼저 선택해 주세요.
          </div>
        ) : null}

        {extractedCharacters.length > 0 && !selectedCount ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            출연자를 1명 이상 선택해야 다음 단계로 넘어갈 수 있습니다.
          </div>
        ) : <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            다음 스텝으로 넘어갈 수 있습니다
          </div>
          }

        {!extractedCharacters.length && !showInlineAddCharacterCard ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm leading-6 text-slate-500">
            대본이 준비되면 출연자를 자동으로 불러옵니다. 지금은 출연자 추가 버튼으로 먼저 직접
            등록할 수 있습니다.
          </div>
        ) : null}

        {extractedCharacters.length > 0 || showInlineAddCharacterCard ? (
          <div className="mt-4">
            <CharacterRail
              step={392}
              focusIndex={railFocusIndex}
              itemCount={totalRailItems}
            >
              {extractedCharacters.map((character, index) => {
                const rawVoiceProvider = character.voiceProvider;
                const voiceProvider: 'qwen3Tts' | 'elevenLabs' | 'google' =
                  rawVoiceProvider === 'elevenLabs' ||
                  rawVoiceProvider === 'google' ||
                  rawVoiceProvider === 'qwen3Tts'
                    ? rawVoiceProvider
                    : 'qwen3Tts';

                const currentVoiceId = character.voiceId || character.voiceHint || '';
                const qwenVoiceId =
                  voiceProvider === 'qwen3Tts'
                    ? currentVoiceId || 'qwen-default'
                    : 'qwen-default';

                const elevenVoiceId =
                  voiceProvider === 'elevenLabs'
                    ? currentVoiceId || elevenLabsVoices[0]?.voice_id || ''
                    : elevenLabsVoices[0]?.voice_id || '';

                const googleVoiceId = voiceProvider === 'google' ? currentVoiceId : '';
                const selected = selectedCharacterIds.includes(character.id);
                return (
                  <div
                    key={character.id}
                    data-rail-index={index}
                    className={`relative flex min-h-[272px] w-[360px] shrink-0 snap-start flex-col rounded-[22px] border px-4 py-3 transition-all duration-300 ${
                      selected
                        ? 'border-sky-400 bg-sky-100 shadow-sm ring-2 ring-sky-200'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={(event) => handleCharacterSelect(event, character.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onCharacterToggle(character.id);
                        }
                      }}
                      className="block rounded-[16px] px-1 py-1 text-left outline-none"
                    >
                      <div className="flex items-start justify-between gap-3">
  <div className="min-w-0">
    <div className="flex items-center gap-2">
      <div className="text-sm font-black text-slate-900">{character.name}</div>
    </div>

    {character.description ? (
      <div className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-slate-500">
        {character.description}
      </div>
    ) : null}
  </div>

  <div className="shrink-0 flex items-center gap-2">
    <button
      type="button"
      onClick={(event) => {
        stopCardToggle(event);
        onCharacterToggle(character.id);
      }}
      className={`rounded-full px-3 py-1 text-[10px] font-black transition ${
        selected
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {selected ? '선택해제' : '선택하기'}
    </button>

    <button
      type="button"
      onClick={(event) => {
        stopCardToggle(event);
        onCharacterRemove(character.id);
      }}
      className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-black text-rose-600 transition hover:bg-rose-50"
    >
      삭제
    </button>
  </div>
</div>
                    </div>

                    <div
                      data-card-drag-zone="true"
                      data-card-wheel-zone="true"
                      className={`mt-3 flex flex-col rounded-[18px] border px-3 py-2.5 ${selected ? 'border-sky-200 bg-sky-50/80' : 'border-dashed border-slate-200/70 bg-white/70'}`}
                    >
                      <div className="grid gap-2.5">
                        <div>
                          <div className="mb-1.5 text-[11px] font-black text-slate-700">보이스 API</div>
                          <div className="flex flex-wrap gap-2">
                            <SelectablePill
                              active={voiceProvider === 'qwen3Tts'}
                              label="기본"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCharacterVoiceProviderChange(character.id, 'qwen3Tts');
                              }}
                            />
                            <SelectablePill
                              active={voiceProvider === 'elevenLabs'}
                              label="ElevenLabs"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCharacterVoiceProviderChange(character.id, 'elevenLabs');
                              }}
                            />
                            <SelectablePill
                              active={voiceProvider === 'google'}
                              label="Google"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCharacterVoiceProviderChange(character.id, 'google');
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[11px] font-black text-slate-700">보이스 선택</div>
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              {voiceProvider === 'qwen3Tts' ? (
                                <select
                                  value={qwenVoiceId}
                                  onClick={stopCardToggle}
                                  onKeyDown={stopCardToggle}
                                  onPointerDown={stopCardToggle}
                                  onChange={(e) =>
                                    onCharacterVoiceChoiceChange(
                                      character.id,
                                      'qwen3Tts',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                                >
                                  {QWEN_VOICE_OPTIONS.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              ) : voiceProvider === 'elevenLabs' ? (
                                <select
                                  value={elevenVoiceId}
                                  onClick={stopCardToggle}
                                  onKeyDown={stopCardToggle}
                                  onPointerDown={stopCardToggle}
                                  onChange={(e) =>
                                    onCharacterVoiceChoiceChange(
                                      character.id,
                                      'elevenLabs',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                                >
                                  {elevenLabsVoices.length ? (
                                    elevenLabsVoices.map((item) => (
                                      <option key={item.voice_id} value={item.voice_id}>
                                        {item.name}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="">연결된 보이스 없음</option>
                                  )}
                                </select>
                              ) : (
                                <input
                                  value={googleVoiceId}
                                  onClick={stopCardToggle}
                                  onKeyDown={stopCardToggle}
                                  onPointerDown={stopCardToggle}
                                  onChange={(e) =>
                                    onCharacterVoiceDirectInputChange(
                                      character.id,
                                      'google',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400"
                                  placeholder="Google voice name 입력"
                                />
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(event) => {
                                stopCardToggle(event);
                                onPreviewCharacterVoice(character.id);
                              }}
                              className={`shrink-0 rounded-2xl px-3 py-2.5 text-[11px] font-black transition ${
                                activeVoicePreviewCharacterId === character.id
                                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {activeVoicePreviewCharacterId === character.id
                                ? '미리듣기 정지'
                                : '미리듣기'}
                            </button>
                          </div>
                        </div>

                        {activeVoicePreviewCharacterId === character.id ? (
                          <div className="rounded-[16px] border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] leading-5 text-violet-700">
                            {voicePreviewMessage || '미리듣기를 준비하는 중입니다.'}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

              {showInlineAddCharacterCard ? (
                <div
                  data-rail-index={extractedCharacters.length}
                  className="flex min-h-[272px] w-[360px] shrink-0 snap-start flex-col rounded-[22px] border border-dashed border-blue-300 bg-blue-50/40 px-4 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900">출연자 추가</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        기존 카드와 같은 크기 영역에서 바로 추가합니다.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="grid gap-2">
                      <input
                        value={manualCharacterName}
                        onChange={(event) => setManualCharacterName(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                        placeholder="이름"
                      />
                      <input
                        value={manualCharacterPosition}
                        onChange={(event) => setManualCharacterPosition(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                        placeholder="포지션"
                      />
                      <textarea
                        value={manualCharacterDescription}
                        onChange={(event) => setManualCharacterDescription(event.target.value)}
                        className="min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400"
                        placeholder={`${currentRoleLabel}의 분위기, 성격, 외형, 말투 등을 적어 주세요.`}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={resetInlineCharacterForm}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!canSubmitManualCharacter}
                        onClick={() => {
                          if (!canSubmitManualCharacter) return;

                          const payload = {
                            name: manualCharacterName.trim(),
                            position: manualCharacterPosition.trim(),
                            description: manualCharacterDescription.trim(),
                          };

                          onCreateCharacterFromForm(payload);

                          setManualCharacterName('');
                          setManualCharacterPosition('');
                          setManualCharacterDescription('');
                          setShowInlineAddCharacterCard(false);
                        }}
                        className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
                      >
                        출연자 추가하기
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </CharacterRail>
          </div>
        ) : null}

        {isHydratingCharacters ? (
          <p className="mt-4 text-xs leading-6 text-violet-600">
            대본 변경을 기준으로 출연자를 다시 정리하고 있습니다.
          </p>
        ) : null}
      </section>
    </div>
  );
}
