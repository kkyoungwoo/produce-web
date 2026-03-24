import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScriptLanguageOption, ScriptSpeechStyle } from '../../../types';

interface Step2PanelProps {
  topic: string;
  isRefreshingTopic: boolean;
  isInitialLoadingRecommendations?: boolean;
  topicRecommendations: string[];
  customScriptDurationMinutes: number;
  customScriptSpeechStyle: ScriptSpeechStyle;
  customScriptLanguage: ScriptLanguageOption;
  onTopicChange: (value: string) => void;
  onRefreshTopic: () => void;
  onSelectTopicRecommendation: (value: string) => void;
  onCustomScriptDurationChange: (value: number) => void;
  onCustomScriptSpeechStyleChange: (value: ScriptSpeechStyle) => void;
  onCustomScriptLanguageChange: (value: ScriptLanguageOption) => void;
}

const SCRIPT_LANGUAGE_OPTIONS: Array<{ value: ScriptLanguageOption; label: string; flag: string; hint: string }> = [
  { value: 'mute', label: '무음', flag: '🔇', hint: '내레이션 없이 화면 흐름 중심' },
  { value: 'ko', label: '한국어', flag: '🇰🇷', hint: '자연스러운 한국어 대본' },
  { value: 'en', label: '영어', flag: '🇺🇸', hint: '글로벌 타깃 영어 대본' },
  { value: 'ja', label: '일본어', flag: '🇯🇵', hint: '일본어 흐름 반영' },
  { value: 'zh', label: '중국어', flag: '🇨🇳', hint: '중국어 톤 반영' },
  { value: 'vi', label: '베트남어', flag: '🇻🇳', hint: '베트남어 말맛 반영' },
  { value: 'mn', label: '몽골어', flag: '🇲🇳', hint: '몽골어 문장 흐름 반영' },
  { value: 'th', label: '태국어', flag: '🇹🇭', hint: '태국어 표현 반영' },
  { value: 'uz', label: '우즈베크어', flag: '🇺🇿', hint: '우즈베크어 리듬 반영' },
];

const QUICK_DURATION_OPTIONS = [1, 3, 5, 10, 15] as const;
const DURATION_MARK_OPTIONS = [1, 3, 5, 8, 10, 15, 20, 25, 30] as const;

const SPEECH_STYLE_OPTIONS: Array<{ value: ScriptSpeechStyle; label: string; hint: string }> = [
  { value: 'default', label: '기본', hint: '가장 무난한 기본 대화체' },
  { value: 'yo', label: '요체', hint: '부드럽고 친근한 말투' },
  { value: 'da', label: '다체', hint: '단정하고 서술형인 말투' },
  { value: 'eum', label: '음슴체', hint: '짧고 건조한 리듬감' },
];

const DEFAULT_TOPIC_RECOMMENDATIONS = [
  '새벽 버스 정류장에서 우연히 다시 만난 두 사람이 한 번 미뤘던 선택을 끝내 마주하는 이야기.',
  '도시 재개발 이슈를 생활권 변화와 체감 물가 흐름까지 한 번에 이해하게 만드는 설명형 영상.',
  '비 오는 골목의 작은 분실물을 계기로 오래 끊겼던 관계가 다시 이어지는 감정 서사.',
  '초보자도 바로 따라 할 수 있게 핵심 도구 사용 순서를 여덟 장면 안에 정리하는 가이드 영상.',
  '막차 직전 플랫폼에서 같은 밤을 다르게 기억하는 두 인물이 진실을 맞춰 가는 전개.',
  '조용한 사무실의 야근 풍경 속에서 한 통의 메시지가 하루의 방향을 바꾸는 이야기.',
  '처음 시작하는 사람을 위해 복잡한 업무 프로세스를 실제 예시 중심으로 풀어 주는 요약 영상.',
  '낡은 극장 무대에서 마지막 리허설을 준비하며 각자의 비밀이 드러나는 시네마틱 전개.',
] as const;

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
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition-all duration-300 ${
        direction === 'left' ? 'left-1.5' : 'right-1.5'
      } ${visible ? 'pointer-events-auto scale-100 opacity-100 hover:bg-slate-50' : 'pointer-events-none scale-95 opacity-0'}`}
    >
      <span className="text-base font-black">{direction === 'left' ? '‹' : '›'}</span>
    </button>
  );
}

function HorizontalOptionRail({
  children,
  step = 220,
  selectedKey,
  selectedIndex,
  itemCount,
}: {
  children: React.ReactNode;
  step?: number;
  selectedKey?: string | number | null;
  selectedIndex?: number;
  itemCount?: number;
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
  const [isDragging, setIsDragging] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, a, input, textarea, select, label, [role="button"], [data-no-drag="true"]'));
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
    }, 3000);
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
    if (selectedKey === undefined || selectedKey === null) return;
    revealArrowsTemporarily();
  }, [selectedKey, revealArrowsTemporarily]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (selectedIndex === undefined || itemCount === undefined) return;

    const selectedElement = container.querySelector<HTMLElement>(`[data-option-index="${selectedIndex}"]`);
    if (!selectedElement) return;

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    let nextScrollLeft = 0;

    if (selectedIndex === 0) {
      nextScrollLeft = 0;
    } else if (selectedIndex === itemCount - 1) {
      nextScrollLeft = maxScrollLeft;
    } else {
      const containerWidth = container.clientWidth;
      const targetLeft = selectedElement.offsetLeft - containerWidth / 2 + selectedElement.offsetWidth / 2;
      nextScrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);
    }

    container.scrollTo({
      left: nextScrollLeft,
      behavior: 'smooth',
    });

    revealArrowsTemporarily();
  }, [selectedIndex, itemCount, selectedKey, revealArrowsTemporarily]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  const scrollByDirection = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    if (direction === 'left' && !canScrollLeft) return;
    if (direction === 'right' && !canScrollRight) return;

    revealArrowsTemporarily();
    container.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => revealArrowsTemporarily()}
      onFocusCapture={() => revealArrowsTemporarily()}
    >
      <ScrollArrow direction="left" visible={showArrows && canScrollLeft} onClick={() => scrollByDirection('left')} />

      <div
        ref={containerRef}
        style={{ touchAction: 'pan-x' }}
        className={`flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pl-0.5 pr-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (isInteractiveTarget(event.target)) return;

          const container = containerRef.current;
          if (!container) return;

          draggingRef.current = {
            active: true,
            startX: event.clientX,
            startScrollLeft: container.scrollLeft,
            moved: false,
            suppressClick: draggingRef.current.suppressClick,
          };

          container.setPointerCapture(event.pointerId);
          revealArrowsTemporarily();
        }}
        onPointerMove={(event) => {
          const container = containerRef.current;
          if (!container || !draggingRef.current.active) return;

          const deltaX = event.clientX - draggingRef.current.startX;
          if (!draggingRef.current.moved && Math.abs(deltaX) < 8) return;

          if (!draggingRef.current.moved) {
            draggingRef.current.moved = true;
            draggingRef.current.suppressClick = true;
            setIsDragging(true);
          }

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
        }}
        onPointerCancel={(event) => {
          const container = containerRef.current;
          draggingRef.current.active = false;
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
          draggingRef.current.suppressClick = false;
          draggingRef.current.moved = false;
        }}
      >
        {children}
      </div>

      <ScrollArrow direction="right" visible={showArrows && canScrollRight} onClick={() => scrollByDirection('right')} />
    </div>
  );
}

function CompactOption({
  active,
  onClick,
  title,
  subtitle,
  leading,
  minWidth = 'min-w-[112px]',
  index,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  minWidth?: string;
  index?: number;
}) {
  return (
    <button
      type="button"
      data-no-drag="true"
      data-option-index={index}
      onClick={onClick}
      className={`${minWidth} shrink-0 snap-start rounded-[18px] border px-3 py-2.5 text-left transition-all duration-300 ${
        active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {leading ? <div className="pt-0.5 text-lg leading-none">{leading}</div> : null}
        <div className="min-w-0">
          <div className={`text-[13px] font-black ${active ? 'text-violet-700' : 'text-slate-900'}`}>{title}</div>
          {subtitle ? <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}

function SettingBlock({
  label,
  selectedLabel,
  helper,
  children,
}: {
  label: string;
  selectedLabel: React.ReactNode;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="mb-4 text-sm font-black text-slate-900">
            {label}
            <span className="ml-3 rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700 shadow-sm">
              {selectedLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500">{helper}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function Step2Panel({
  topic,
  isRefreshingTopic,
  isInitialLoadingRecommendations = false,
  topicRecommendations,
  customScriptDurationMinutes,
  customScriptSpeechStyle,
  customScriptLanguage,
  onTopicChange,
  onRefreshTopic,
  onSelectTopicRecommendation,
  onCustomScriptDurationChange,
  onCustomScriptSpeechStyleChange,
  onCustomScriptLanguageChange,
}: Step2PanelProps) {
  const topicTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTopicTextarea = useCallback(() => {
    const textarea = topicTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';

    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight || '24') || 24;
    const borderHeight =
      (Number.parseFloat(computed.borderTopWidth || '0') || 0) +
      (Number.parseFloat(computed.borderBottomWidth || '0') || 0);
    const maxHeight = lineHeight * 5 + 24 + borderHeight;

    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeTopicTextarea();
  }, [topic, resizeTopicTextarea]);

  const selectedLanguage = useMemo(
    () => SCRIPT_LANGUAGE_OPTIONS.find((item) => item.value === customScriptLanguage) || SCRIPT_LANGUAGE_OPTIONS[0],
    [customScriptLanguage]
  );

  const selectedSpeech = useMemo(
    () => SPEECH_STYLE_OPTIONS.find((item) => item.value === customScriptSpeechStyle) || SPEECH_STYLE_OPTIONS[0],
    [customScriptSpeechStyle]
  );

  const visibleRecommendations = useMemo(() => {
    return (topicRecommendations.length ? topicRecommendations : [...DEFAULT_TOPIC_RECOMMENDATIONS])
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index)
      .slice(0, 5);
  }, [topicRecommendations]);

  const selectedRecommendation = useMemo(() => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return null;
    return visibleRecommendations.find((item) => item === trimmedTopic) ?? null;
  }, [topic, visibleRecommendations]);

  const selectedSpeechIndex = SPEECH_STYLE_OPTIONS.findIndex((item) => item.value === customScriptSpeechStyle);
  const selectedLanguageIndex = SCRIPT_LANGUAGE_OPTIONS.findIndex((item) => item.value === customScriptLanguage);

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">대본 설정</div>
            <h2 className="mt-1 text-lg font-black text-slate-900">Step3 생성 전에 핵심 설정만 빠르게 정하세요</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <SettingBlock
            label="영상 예상 길이"
            helper="카드를 드래그하거나 화살표로 넘기며 길이를 정합니다. 클릭만 하면 바로 선택됩니다."
            selectedLabel={<>{customScriptDurationMinutes}분</>}
          >
            <div className="mt-3 rounded-[18px] border border-violet-100 bg-white px-3 py-3">
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={customScriptDurationMinutes}
                onChange={(event) => onCustomScriptDurationChange(Number(event.target.value))}
                className="h-2.5 w-full cursor-pointer accent-violet-600"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] font-black text-slate-400">
                <span>1분</span>
                <span>10분</span>
                <span>20분</span>
                <span>30분</span>
              </div>
            </div>
          </SettingBlock>

          <SettingBlock
            label="대화체"
            helper="처음은 맨 앞으로, 끝은 맨 뒤로, 그 외는 가운데로 부드럽게 이동합니다."
            selectedLabel={<>{selectedSpeech.label}</>}
          >
            <HorizontalOptionRail
              step={240}
              selectedKey={customScriptSpeechStyle}
              selectedIndex={selectedSpeechIndex}
              itemCount={SPEECH_STYLE_OPTIONS.length}
            >
              {SPEECH_STYLE_OPTIONS.map((item, index) => (
                <CompactOption
                  key={item.value}
                  index={index}
                  active={customScriptSpeechStyle === item.value}
                  onClick={() => onCustomScriptSpeechStyleChange(item.value)}
                  title={item.label}
                  subtitle={item.hint}
                  minWidth="min-w-[136px]"
                />
              ))}
            </HorizontalOptionRail>
          </SettingBlock>

          <SettingBlock
            label="대본 언어"
            helper="처음은 맨 앞으로, 끝은 맨 뒤로, 그 외는 가운데로 부드럽게 이동합니다."
            selectedLabel={
              <span className="inline-flex items-center gap-1.5">
                <span>{selectedLanguage.flag}</span>
                <span>{selectedLanguage.label}</span>
              </span>
            }
          >
            <HorizontalOptionRail
              step={260}
              selectedKey={customScriptLanguage}
              selectedIndex={selectedLanguageIndex}
              itemCount={SCRIPT_LANGUAGE_OPTIONS.length}
            >
              {SCRIPT_LANGUAGE_OPTIONS.map((item, index) => (
                <CompactOption
                  key={item.value}
                  index={index}
                  active={customScriptLanguage === item.value}
                  onClick={() => onCustomScriptLanguageChange(item.value)}
                  title={item.label}
                  subtitle={item.hint}
                  leading={item.flag}
                  minWidth="min-w-[148px]"
                />
              ))}
            </HorizontalOptionRail>
          </SettingBlock>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-black text-slate-900">콘텐츠 주제</label>
          <button
            type="button"
            onClick={onRefreshTopic}
            disabled={isRefreshingTopic}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshingTopic ? '추천 중...' : '주제 새로고침'}
          </button>
        </div>

        <textarea
          ref={topicTextareaRef}
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          rows={1}
          className="max-h-[148px] min-h-[56px] w-full resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400"
          placeholder={`예: 비 오는 도시 골목에서 다시 만난 두 사람
장면이 길어지면 엔터로 줄을 나눠 자세히 적어도 됩니다`}
        />

        <p className="mt-3 text-xs text-slate-500">
          엔터로 줄을 나누며 최대 5줄 높이까지 입력할 수 있고, 더 길어지면 스크롤로 이어서 작성할 수 있습니다.
        </p>

        <div className="mt-3 space-y-2">
          {visibleRecommendations.map((item, index) => {
            const isActive = selectedRecommendation === item;

            return (
              <button
                key={`${index}-${item}`}
                type="button"
                onClick={() => onSelectTopicRecommendation(item)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-6 transition ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {isInitialLoadingRecommendations ? (
          <p className="mt-3 text-xs text-violet-600">추천 주제를 불러오는 중입니다.</p>
        ) : null}
      </section>
    </div>
  );
}
