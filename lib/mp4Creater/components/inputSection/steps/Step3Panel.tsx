import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CharacterProfile,
  ConstitutionAnalysisSummary,
  ContentType,
  ReferenceLinkDraft,
  ScriptLanguageOption,
  WorkflowPromptTemplateEngine,
} from '../../../types';
import { CONFIG, NO_AI_SCRIPT_MODEL_ID } from '../../../config';
import AiOptionPickerModal from '../../AiOptionPickerModal';
import TtsSelectionModal from '../../TtsSelectionModal';
import {
  AiPickerOption,
  getElevenLabsVoicePickerOptions,
  getQwenVoicePickerOptions,
  getScriptModelPickerOptions,
} from '../../../services/aiOptionCatalog';
import { normalizeExpectedDurationMinutes } from '../../../utils/scriptDuration';

interface Step3PanelProps {
  contentType: ContentType;
  customScriptLanguage: ScriptLanguageOption;
  expectedDurationMinutes: number;
  isGeneratingScript: boolean;
  scriptGenerationProgressPercent?: number | null;
  scriptGenerationProgressMessage?: string;
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
  projectVoiceProvider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  projectVoiceSummary: string;
  googleApiKey?: string;
  elevenLabsApiKey?: string;
  currentTtsModelId?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
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
  onOpenSettings?: () => void;
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
    provider: 'qwen3Tts' | 'elevenLabs'
  ) => void;
  onCharacterVoiceChoiceChange: (
    characterId: string,
    provider: 'qwen3Tts' | 'elevenLabs',
    value: string
  ) => void;
  onProjectTtsModelChange?: (modelId: string) => void;
  onCharacterVoiceDirectInputChange: (
    characterId: string,
    provider: 'elevenLabs',
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

const SCRIPT_CHARACTER_RANGE_BY_TYPE: Record<ContentType, { min: number; max: number }> = {
  music_video: { min: 130, max: 250 },
  story: { min: 210, max: 390 },
  cinematic: { min: 110, max: 210 },
  info_delivery: { min: 390, max: 720 },
};

function formatRecommendedCharacterRange(contentType: ContentType, minutes: number) {
  const safeMinutes = normalizeExpectedDurationMinutes(minutes);
  const range = SCRIPT_CHARACTER_RANGE_BY_TYPE[contentType] || SCRIPT_CHARACTER_RANGE_BY_TYPE.story;
  const min = Math.round(safeMinutes * range.min);
  const max = Math.round(safeMinutes * range.max);
  return {
    min,
    max,
    target: Math.round((min + max) / 2),
  };
}

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
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 bg-gradient-to-l from-white to-transparent" />

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
  contentType,
  customScriptLanguage,
  expectedDurationMinutes,
  isGeneratingScript,
  scriptGenerationProgressPercent,
  scriptGenerationProgressMessage,
  sceneCount,
  storyScript,
  selectedScriptModel,
  scriptModelOptions: scriptModelOptionsProp,
  extractedCharacters: extractedCharactersProp,
  selectedCharacterIds: selectedCharacterIdsProp,
  isHydratingCharacters,
  googleApiKey,
  elevenLabsApiKey,
  currentTtsModelId,
  voiceReferenceAudioData,
  voiceReferenceMimeType,
  elevenLabsVoices: elevenLabsVoicesProp,
  activeVoicePreviewCharacterId,
  voicePreviewMessage,
  projectVoiceSummary,
  onOpenSettings,
  onGenerateScript,
  onViewPrompt,
  onStoryScriptChange,
  onSaveStoryScript,
  onScriptModelChange,
  onCharacterToggle,
  onCharacterRemove,
  onCharacterVoiceProviderChange,
  onCharacterVoiceChoiceChange,
  onProjectTtsModelChange,
  onCharacterVoiceDirectInputChange,
  onPreviewCharacterVoice,
  onCreateCharacterFromForm,
  getCharacterVoiceSummary,
  castSelectionHighlightTick = 0,
}: Step3PanelProps) {
  const hasGoogleApiKey = Boolean(googleApiKey?.trim());
  const scriptModelPickerOptions = useMemo<AiPickerOption[]>(() => {
    const catalogOptions = getScriptModelPickerOptions(true);
    const baseOptions = catalogOptions.length
      ? catalogOptions
      : (Array.isArray(scriptModelOptionsProp) ? scriptModelOptionsProp : []).map((item) => ({
        id: item.id,
        title: item.name,
        provider: item.id === NO_AI_SCRIPT_MODEL_ID ? 'Built-in' : 'AI model',
        description: 'Script model option',
        badge: item.id === NO_AI_SCRIPT_MODEL_ID ? 'Sample' : 'AI',
        priceLabel: item.id === NO_AI_SCRIPT_MODEL_ID ? 'Free' : 'API',
        qualityLabel: 'Balanced',
        group: item.id === NO_AI_SCRIPT_MODEL_ID ? 'sample' as const : 'free' as const,
        tier: item.id === NO_AI_SCRIPT_MODEL_ID ? 'sample' as const : 'free' as const,
      }));

    return baseOptions.map((item) => ({
      ...item,
      disabled: item.id === NO_AI_SCRIPT_MODEL_ID ? false : !hasGoogleApiKey,
      disabledReason: item.id === NO_AI_SCRIPT_MODEL_ID || hasGoogleApiKey
        ? undefined
        : 'Google AI Studio API 키를 연결하면 선택할 수 있습니다.',
    }));
  }, [hasGoogleApiKey, scriptModelOptionsProp]);
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
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [voicePickerTarget, setVoicePickerTarget] = useState<{
    characterId: string;
    provider: 'qwen3Tts' | 'elevenLabs';
  } | null>(null);

  const prevCharacterCountRef = useRef(extractedCharacters.length);
  const castSectionRef = useRef<HTMLElement | null>(null);
  const highlightResetTimerRef = useRef<number | null>(null);

  const selectedCount = selectedCharacterIds.length;
  const isMuteScriptMode = customScriptLanguage === 'mute';
  const scriptCharacterCount = Array.from(storyScript || '').length;
  const recommendedCharacterRange = useMemo(
    () => formatRecommendedCharacterRange(contentType, expectedDurationMinutes),
    [contentType, expectedDurationMinutes]
  );
  const isScriptCharacterCountInRecommendedRange =
    scriptCharacterCount >= recommendedCharacterRange.min &&
    scriptCharacterCount <= recommendedCharacterRange.max;
  const hasStoryScript = Boolean((storyScript || '').trim());
  const isPreparingCharacters = !isMuteScriptMode && hasStoryScript && (isGeneratingScript || isHydratingCharacters);

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
  const currentScriptModelSummary = useMemo(
    () => scriptModelPickerOptions.find((item) => item.id === selectedScriptModel) || scriptModelPickerOptions[0] || null,
    [scriptModelPickerOptions, selectedScriptModel]
  );
  const voicePickerOptions = useMemo<AiPickerOption[]>(() => {
    if (!voicePickerTarget) return [];
    if (voicePickerTarget.provider === 'elevenLabs') {
      return getElevenLabsVoicePickerOptions(elevenLabsVoices);
    }
    return getQwenVoicePickerOptions();
  }, [elevenLabsVoices, voicePickerTarget]);
  const voicePickerCurrentId = useMemo(() => {
    if (!voicePickerTarget) return '';
    const targetCharacter = extractedCharacters.find((item) => item.id === voicePickerTarget.characterId);
    const currentVoiceId = targetCharacter?.voiceId || targetCharacter?.voiceHint || '';
    if (voicePickerTarget.provider === 'elevenLabs') {
      return currentVoiceId || elevenLabsVoices[0]?.voice_id || '';
    }
    return currentVoiceId || 'qwen-default';
  }, [elevenLabsVoices, extractedCharacters, voicePickerTarget]);


  const needsCastSelectionGuidance = useMemo(() => {
    if (!isMuteScriptMode && !hasStoryScript) return false;

    if (!selectedCharacterIds.length) return true;

    const selectedCharacters = extractedCharacters.filter((character) =>
      selectedCharacterIds.includes(character.id)
    );

    if (!selectedCharacters.length) return true;

    return selectedCharacters.some((character) => {
      const rawVoiceProvider = character.voiceProvider;
      const voiceProvider: 'qwen3Tts' | 'elevenLabs' =
        rawVoiceProvider === 'elevenLabs'
          ? 'elevenLabs'
          : 'qwen3Tts';

      const currentVoiceId = character.voiceId || character.voiceHint || '';

      if (voiceProvider === 'qwen3Tts') {
        return !(currentVoiceId || 'qwen-default');
      }

      return !(currentVoiceId || elevenLabsVoices[0]?.voice_id);
    });
  }, [
    elevenLabsVoices,
    extractedCharacters,
    hasStoryScript,
    isMuteScriptMode,
    selectedCharacterIds,
  ]);

  const scrollToCastSelection = useCallback(() => {
    const target = castSectionRef.current;
    if (!target) return;

    if (highlightResetTimerRef.current !== null) {
      window.clearTimeout(highlightResetTimerRef.current);
      highlightResetTimerRef.current = null;
    }

    setHighlightCastSelection(true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    const findScrollableParent = (node: HTMLElement | null): HTMLElement | null => {
      let current = node?.parentElement ?? null;

      while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const isScrollable =
          (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
          current.scrollHeight > current.clientHeight;

        if (isScrollable) return current;
        current = current.parentElement;
      }

      return null;
    };

    const runScroll = () => {
      target.scrollIntoView({
        behavior,
        block: 'start',
        inline: 'nearest',
      });

      const scrollParent = findScrollableParent(target);
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - 16;

        scrollParent.scrollTo({
          top: Math.max(0, nextTop),
          behavior,
        });
      }

      const absoluteTop = window.scrollY + target.getBoundingClientRect().top - 16;
      window.scrollTo({
        top: Math.max(0, absoluteTop),
        behavior,
      });
    };

    const retryDelays = [0, 40, 120, 240, 420];
    retryDelays.forEach((delay) => {
      window.setTimeout(() => {
        window.requestAnimationFrame(runScroll);
      }, delay);
    });

    highlightResetTimerRef.current = window.setTimeout(() => {
      setHighlightCastSelection(false);
      highlightResetTimerRef.current = null;
    }, 1800);
  }, []);

  const isNextButtonAttempt = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;

    const button = target.closest('button, [role="button"]');
    if (!(button instanceof HTMLElement)) return false;

    const label = (button.textContent || '').replace(/\s+/g, '');
    const ariaLabel = (button.getAttribute('aria-label') || '').replace(/\s+/g, '');

    return (
      label.includes('다음으로') ||
      label === '다음' ||
      ariaLabel.includes('다음으로') ||
      ariaLabel === '다음'
    );
  }, []);

  useEffect(() => {
    if (isGeneratingScript) {
      setSavedScriptSnapshot(storyScript || '');
    }
  }, [isGeneratingScript, storyScript]);

  useEffect(() => {
    if (!castSelectionHighlightTick) return;
    scrollToCastSelection();
  }, [castSelectionHighlightTick, scrollToCastSelection]);

  useEffect(() => {
    return () => {
      if (highlightResetTimerRef.current !== null) {
        window.clearTimeout(highlightResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!needsCastSelectionGuidance) return;

    const handlePointerDownCapture = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!isNextButtonAttempt(event.target)) return;
      scrollToCastSelection();
    };

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!isNextButtonAttempt(event.target)) return;
      scrollToCastSelection();
    };

    document.addEventListener('pointerdown', handlePointerDownCapture, true);
    document.addEventListener('mousedown', handlePointerDownCapture, true);
    document.addEventListener('touchstart', handlePointerDownCapture, true);
    document.addEventListener('keydown', handleKeyDownCapture, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownCapture, true);
      document.removeEventListener('mousedown', handlePointerDownCapture, true);
      document.removeEventListener('touchstart', handlePointerDownCapture, true);
      document.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [isNextButtonAttempt, needsCastSelectionGuidance, scrollToCastSelection]);

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="whitespace-nowrap text-[20px] font-black uppercase text-violet-900">
            AI 설정
          </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Pick the script model here, keep the default project TTS easy to see, and only write the final script into the editor after generation is fully done.
            </p>
          </div>

          <div className="flex flex-row flex-nowrap items-center gap-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setModelPickerOpen(true)}
              className="min-w-[240px] shrink-0 rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Script model</div>
              <div className="mt-1 text-sm font-black text-slate-900">{currentScriptModelSummary?.title || selectedScriptModel}</div>
              <div className="mt-1 text-xs text-slate-500">{currentScriptModelSummary?.priceLabel || 'AI'} · {currentScriptModelSummary?.qualityLabel || 'Balanced'}</div>
            </button>
            <select
              value={selectedScriptModel}
              onChange={(e) => onScriptModelChange(e.target.value)}
              className="hidden shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {scriptModelPickerOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.id === NO_AI_SCRIPT_MODEL_ID ? ' · 무료 샘플' : ' · AI'}
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
              disabled={isGeneratingScript || isMuteScriptMode}
              className="shrink-0 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isMuteScriptMode ? '무음 모드' : isGeneratingScript ? '대본 생성 중...' : '대본 생성'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Current script model</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{currentScriptModelSummary?.provider || 'AI model'}</span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{currentScriptModelSummary?.priceLabel || 'AI'}</span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{currentScriptModelSummary?.qualityLabel || 'Balanced'}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{currentScriptModelSummary?.description || 'Select a script model for Step3 generation.'}</p>
        </div>

        {isGeneratingScript ? (
          <div className="mt-4 rounded-[24px] border border-violet-200 bg-violet-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">Script generation progress</div>
                <div className="mt-1 text-sm font-black text-slate-900">{scriptGenerationProgressMessage || 'Preparing the final script output.'}</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-violet-700">
                {typeof scriptGenerationProgressPercent === 'number' ? `${Math.round(scriptGenerationProgressPercent)}%` : 'Running'}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/90">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500 transition-all duration-300"
                style={{ width: `${Math.max(8, Math.min(100, scriptGenerationProgressPercent || 0))}%` }}
              />
            </div>
            <div className="mt-2 text-xs leading-5 text-violet-700">
              The editor stays locked until the final script is fully prepared.
            </div>
          </div>
        ) : null}
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
                        {!isMuteScriptMode && isScriptModified ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSaveStoryScript();
                    setSavedScriptSnapshot(storyScript || '');
                  }}
                  disabled={isHydratingCharacters || isGeneratingScript}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isHydratingCharacters ? '출연자 업데이트 중...' : '수정하기'}
                </button>

                <button
                  type="button"
                  onClick={() => onStoryScriptChange(savedScriptSnapshot)}
                  disabled={isHydratingCharacters || isGeneratingScript}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  수정취소
                </button>
              </>
            ) : null}
            {isMuteScriptMode ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                무음 콘텐츠
              </span>
            ) : (
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {sceneCount}문단
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    isScriptCharacterCountInRecommendedRange
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {scriptCharacterCount}자
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  추천 {recommendedCharacterRange.min}~{recommendedCharacterRange.max}자 · 목표 약 {recommendedCharacterRange.target}자
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mb-3 rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-6 text-violet-800">
          {isMuteScriptMode
            ? '무음 콘텐츠는 대본 대신 화면 흐름과 출연자 선택으로 진행합니다. 아래에서 출연자만 추가하거나 선택하면 다음 단계로 넘어갈 수 있습니다.'
            : '생성 대본은 장면 설명이 아닌 TTS 낭독용 목소리 본문만 나오도록 맞춰집니다. 추천 글자수의 중간값에 가깝게 맞추고, 한 줄을 한 문단으로 계산하며 연속 엔터는 자동으로 한 줄만 유지됩니다.'}
        </div>

        {isMuteScriptMode ? (
          <div className="flex h-[90px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-5 text-center text-sm font-black text-slate-500">
            무음 콘텐츠는 대본을 작성할 수 없습니다
          </div>
        ) : (
          <>
            <textarea
              value={storyScript}
              onChange={(e) => onStoryScriptChange(e.target.value)}
              readOnly={isGeneratingScript}
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
          </>
        )}
      </section>

      <section
        ref={castSectionRef}
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
              헤더 설정에서 고른 기본 TTS는 새 프로젝트 기본값으로만 쓰이고, 여기서는 캐릭터마다 다른 목소리를 바로 고를 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-black">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              기본 TTS {projectVoiceSummary || '무료 기본 목소리'}
            </span>
            {onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-2xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                기본값 보기
              </button>
            ) : null}
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
            {isMuteScriptMode
              ? '무음 콘텐츠는 출연자를 1명 이상 추가하거나 선택해야 다음 단계로 넘어갈 수 있습니다.'
              : '출연자를 1명 이상 선택해야 다음 단계로 넘어갈 수 있습니다.'}
          </div>
        ) : <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            다음 스텝으로 넘어갈 수 있습니다
          </div>
          }

        {isPreparingCharacters && !extractedCharacters.length && !showInlineAddCharacterCard ? (
          <div className="mt-4 rounded-[24px] border border-violet-200 bg-violet-50 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">출연자 준비 중</div>
                <div className="mt-2 text-base font-black text-slate-900">대본을 읽고 출연자 카드를 불러오는 중입니다</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  대본 길이나 내용이 바뀌면 출연자 정리도 함께 다시 맞춥니다. 응답이 늦을 때는 이 영역에서 계속 준비 상태를 안내합니다.
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-violet-700 shadow-sm">
                {isGeneratingScript ? '대본 생성 중' : '출연자 분석 중'}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="animate-pulse rounded-[18px] border border-violet-100 bg-white/90 p-4">
                  <div className="h-4 w-24 rounded-full bg-violet-100" />
                  <div className="mt-3 h-3 w-full rounded-full bg-slate-100" />
                  <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-100" />
                  <div className="mt-5 h-10 rounded-2xl bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ) : !extractedCharacters.length && !showInlineAddCharacterCard ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm leading-6 text-slate-500">
            {isMuteScriptMode
              ? '무음 모드에서는 대본 없이도 출연자를 직접 추가해 바로 다음 단계로 이어갈 수 있습니다.'
              : '대본이 준비되면 출연자를 자동으로 불러옵니다. 지금은 출연자 추가 버튼으로 먼저 직접 등록할 수 있습니다.'}
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
                const voiceProvider: 'qwen3Tts' | 'elevenLabs' =
                  rawVoiceProvider === 'elevenLabs'
                    ? 'elevenLabs'
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

                const selected = selectedCharacterIds.includes(character.id);
                const positionText =
                  character.roleLabel ||
                  character.rolePrompt ||
                  (character.role === 'lead'
                    ? '주인공'
                    : character.role === 'narrator'
                      ? '내레이터'
                      : '출연자');
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
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
        포지션 {positionText}
      </span>
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
                                setVoicePickerTarget({ characterId: character.id, provider: 'qwen3Tts' });
                              }}
                            />
                            <SelectablePill
                              active={voiceProvider === 'elevenLabs'}
                              label="ElevenLabs"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCharacterVoiceProviderChange(character.id, 'elevenLabs');
                                setVoicePickerTarget({ characterId: character.id, provider: 'elevenLabs' });
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[11px] font-black text-slate-700">TTS 선택</div>
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  stopCardToggle(event);
                                  setVoicePickerTarget({ characterId: character.id, provider: voiceProvider });
                                }}
                                className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                              >
                                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">TTS 모델 / 목소리</div>
                                <div className="mt-1 text-sm font-black text-slate-900">{getCharacterVoiceSummary(character)}</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">
                                  {voiceProvider === 'elevenLabs'
                                    ? '이 버튼을 누르면 무료 / 유료 / 프리미엄 TTS 모델 카드를 보고, 이어서 그 모델의 실제 목소리를 들어보며 선택합니다.'
                                    : '이 버튼을 누르면 같은 카드형 팝업에서 무료 TTS 모델과 실제 목소리를 이어서 선택합니다.'}
                                </div>
                              </button>
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
                                  className="hidden w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
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
                                  className="hidden w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
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
                              ) : null}
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
            대본 변경을 기준으로 출연자를 다시 정리하고 있습니다. 로딩이 길어져도 이 단계에서 계속 결과를 기다릴 수 있습니다.
          </p>
        ) : null}
      </section>

      <AiOptionPickerModal
        open={modelPickerOpen}
        title="Step3 대본 모델"
        description="대본 생성에 쓸 모델을 비교한 뒤 선택하면 저장됩니다."
        currentId={selectedScriptModel}
        options={scriptModelPickerOptions}
        onClose={() => setModelPickerOpen(false)}
        onSelect={onScriptModelChange}
        requireConfirm
        confirmLabel="이 모델 선택하기"
      />

      <TtsSelectionModal
        open={Boolean(voicePickerTarget)}
        title={voicePickerTarget ? `${extractedCharacters.find((item) => item.id === voicePickerTarget.characterId)?.name || '캐릭터'} TTS 모델 / 목소리 선택` : '음성 선택'}
        currentProvider={voicePickerTarget?.provider || 'qwen3Tts'}
        currentModelId={currentTtsModelId || CONFIG.DEFAULT_ELEVENLABS_MODEL}
        currentVoiceId={voicePickerCurrentId}
        googleApiKey={googleApiKey}
        elevenLabsApiKey={elevenLabsApiKey}
        hasElevenLabsApiKey={Boolean(elevenLabsApiKey?.trim())}
        allowPaid={Boolean(elevenLabsApiKey?.trim())}
        elevenLabsVoices={elevenLabsVoices}
        voiceReferenceAudioData={voiceReferenceAudioData}
        voiceReferenceMimeType={voiceReferenceMimeType}
        onClose={() => setVoicePickerTarget(null)}
        onApply={(selection) => {
          if (!voicePickerTarget) return;
          onCharacterVoiceProviderChange(voicePickerTarget.characterId, selection.provider as 'qwen3Tts' | 'elevenLabs');
          if (selection.provider === 'elevenLabs' && selection.modelId && onProjectTtsModelChange) {
            onProjectTtsModelChange(selection.modelId);
          }
          onCharacterVoiceChoiceChange(
            voicePickerTarget.characterId,
            selection.provider as 'qwen3Tts' | 'elevenLabs',
            selection.voiceId || ''
          );
        }}
      />
    </div>
  );
}
