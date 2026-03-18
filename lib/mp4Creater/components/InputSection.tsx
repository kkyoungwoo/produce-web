'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  CharacterProfile,
  ContentType,
  GenerationStep,
  PromptedImageAsset,
  StorySelectionState,
  StudioState,
  WorkflowDraft,
  WorkflowPromptTemplate,
  DEFAULT_REFERENCE_IMAGES,
} from '../types';
import { IMAGE_MODELS, SCRIPT_MODEL_OPTIONS } from '../config';
import HelpTip from './HelpTip';
import {
  buildSelectableStoryDraft,
  normalizeStoryText,
  splitStoryIntoParagraphScenes,
} from '../utils/storyHelpers';
import {
  getTopicSuggestion,
  recommendStoryField,
} from '../services/storyRecommendationService';
import {
  buildWorkflowPromptPack,
  getSelectedWorkflowPromptTemplate,
  resolveWorkflowPromptTemplates,
} from '../services/workflowPromptBuilder';
import {
  buildStyleRecommendations,
  buildPromptPreviewCard,
  buildUploadDrivenPrompt,
  createCharacterCardFromPrompt,
  createPromptVariants,
  createStyleCardFromPrompt,
  extractCharactersFromScript,
} from '../services/characterStudioService';
import { composeScriptDraft } from '../services/scriptComposerService';
import { ASPECT_RATIO_OPTIONS, getAspectRatioClass, getAspectRatioDescription } from '../utils/aspectRatio';
import { handleHorizontalWheel, scrollContainerBy, scrollElementIntoView } from '../utils/horizontalScroll';

type StepId = 1 | 2 | 3 | 4;

interface InputSectionProps {
  step: GenerationStep;
  studioState?: StudioState | null;
  workflowDraft: WorkflowDraft;
  basePath: string;
  onOpenSettings?: () => void;
  onOpenApiModal?: (options?: { title?: string; description?: string; focusField?: 'openRouter' | 'elevenLabs' | 'fal' | null }) => void | Promise<void>;
  onUpdateRouting?: (patch: Partial<StudioState['routing']>) => void | Promise<void>;
  onSaveWorkflowDraft?: (draft: Partial<WorkflowDraft>) => void | Promise<void>;
  onOpenSceneStudio?: (draft: Partial<WorkflowDraft>) => void | Promise<void>;
}

const CONTENT_TYPE_CARDS: Array<{ id: ContentType; title: string; desc: string; badge: string }> = [
  { id: 'music_video', title: '뮤직비디오', desc: '가사, 후렴, 장면 훅 중심으로 설계합니다.', badge: 'MV' },
  { id: 'story', title: '이야기', desc: '기승전결과 감정 흐름이 살아 있는 스토리형입니다.', badge: 'STORY' },
  { id: 'news', title: '뉴스', desc: '브리핑 구조와 장면 정리가 또렷한 형식입니다.', badge: 'NEWS' },
];

const FIELD_OPTIONS_BY_TYPE: Record<ContentType, Record<keyof StorySelectionState, string[]>> = {
  music_video: {
    genre: ['감성 드라마', '로맨스', '몽환 팝', '시네마틱 발라드', '아트 팝'],
    mood: ['몽환적인', '감성적인', '세련된', '잔잔하게 고조되는', '네온빛의'],
    endingTone: ['여운 있는 마무리', '다시 듣고 싶어지는 엔딩', '쓸쓸하지만 아름다운 마감', '희망적인 결말'],
    setting: ['네온 골목', '새벽 지하철역', '비 오는 옥상', '도시 야경 도로'],
    protagonist: ['무대를 떠난 보컬', '다시 노래하는 화자', '감정을 숨긴 연인', '새벽을 걷는 뮤지션'],
    conflict: ['전하지 못한 마음', '다시 마주한 추억', '끝내 못한 작별', '후렴처럼 반복되는 후회'],
  },
  story: {
    genre: ['드라마', '스릴러', '로맨스', '코미디', '미스터리', 'SF'],
    mood: ['따뜻한', '서늘한', '몰입감 있는', '감성적인', '세련된'],
    endingTone: ['여운 있는 마무리', '강한 반전', '희망적인 결말', '씁쓸한 여운'],
    setting: ['비 오는 골목', '늦은 지하철역', '새벽의 편의점', '옥상', '사무실'],
    protagonist: ['평범한 직장인', '초보 창작자', '무대 뒤 스태프', '조용한 관찰자'],
    conflict: ['끝내 미뤄 온 선택', '숨기고 있던 진실', '돌아갈 수 없는 실수', '잊고 있던 약속'],
  },
  news: {
    genre: ['뉴스 브리핑', '해설 리포트', '이슈 요약', '현장 리포트'],
    mood: ['정돈된', '신뢰감 있는', '차분한', '명확한'],
    endingTone: ['핵심 요약으로 마무리', '다음 이슈를 예고하는 엔딩', '중립적 정리'],
    setting: ['뉴스룸 스튜디오', '도심 전경', '현장 브리핑 장소', '데이터 월 앞'],
    protagonist: ['앵커', '현장 기자', '전문 해설자', '차분한 진행자'],
    conflict: ['엇갈리는 해석', '데이터와 체감의 차이', '빠르게 바뀌는 상황', '확인되지 않은 소문'],
  },
};

const STEP_META: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: 1, title: '콘텐츠 선택', subtitle: '형식과 제작 타입' },
  { id: 2, title: '스토리 빌더', subtitle: '주제와 선택값' },
  { id: 3, title: '제작 대본', subtitle: '프롬프트 선택과 원문' },
  { id: 4, title: '화풍 / 씬 제작', subtitle: '스타일 선택 후 이동' },
];

const MAX_UPLOAD_FILE_COUNT = 4;
const MAX_UPLOAD_FILE_SIZE_MB = 8;
const MAX_CHARACTER_VARIANT_COUNT = 6;
const MAX_STYLE_CARD_COUNT = 12;

function normalizeStage(value?: number | null): StepId {
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

function StepChip({
  meta,
  isOpen,
  completed,
  onClick,
}: {
  meta: { id: StepId; title: string; subtitle: string };
  isOpen: boolean;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-4 text-left transition-all ${
        isOpen
          ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-sm'
          : completed
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em]">Step {meta.id}</div>
          <div className="mt-1 text-sm font-black">{meta.title}</div>
          <div className="mt-1 text-xs text-slate-500">{meta.subtitle}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {completed ? '완료' : '진행 중'}
          </span>
          <span className="text-xs font-bold">{isOpen ? '현재 단계' : '보기'}</span>
        </div>
      </div>
    </button>
  );
}

function AccordionSection({
  stepId,
  title,
  description,
  summary,
  open,
  completed,
  onToggle,
  children,
  actions,
}: {
  stepId: StepId;
  title: string;
  description: string;
  summary?: React.ReactNode;
  open: boolean;
  completed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section data-step-section={`step-${stepId}`} className={`overflow-hidden rounded-[30px] border shadow-sm transition-all ${open ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Step {stepId}</div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          {summary && <div className="mt-3 flex flex-wrap gap-2">{summary}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {completed && <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">완료됨</span>}
          {actions}
          <button type="button" onClick={onToggle} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
            {open ? '현재 단계' : '다시 보기'}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-slate-200/80 bg-white px-6 py-6">{children}</div>}
    </section>
  );
}

function SummaryChip({ children, accent = 'slate' }: { children: React.ReactNode; accent?: 'slate' | 'blue' | 'violet' | 'emerald' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  } as const;
  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${classes[accent]}`}>{children}</span>;
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition-all ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300' : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'}`}
      aria-label={direction === 'left' ? '이전 이미지' : '다음 이미지'}
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}

function LoadingSlide({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-4">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">AI 생성 중</div>
        <div className="mt-2 text-sm font-black text-slate-900">{label}</div>
        <p className="mt-2 text-xs leading-5 text-slate-500">기존 이미지는 왼쪽으로 넘기고, 새 이미지는 오른쪽 슬롯에서 준비합니다.</p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>로딩</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function GuidedActionButton({
  children,
  ready,
  disabled,
  onClick,
  tone = 'blue',
  className = '',
}: {
  children: React.ReactNode;
  ready?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'blue' | 'violet';
  className?: string;
}) {
  const toneClass = tone === 'violet'
    ? 'bg-violet-600 text-white hover:bg-violet-500'
    : 'bg-blue-600 text-white hover:bg-blue-500';

  return (
    <div className="relative inline-flex">
      {ready && !disabled && (
        <div className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 animate-bounce">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-black text-blue-700 shadow-sm">
            <span className="text-sm">🖱️</span>
            클릭해서 진행
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black transition-all ${disabled ? 'cursor-not-allowed bg-slate-300 text-slate-500' : toneClass} ${className}`}
      >
        {children}
      </button>
    </div>
  );
}

/**
 * 입력 화면에서 재사용하는 가벼운 팝업 껍데기입니다.
 * 프롬프트 수정, 샘플 안내처럼 빠르게 닫히는 작업을 한 곳에서 정리합니다.
 */
function OverlayModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-[30px] border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Popup</div>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{title}</h3>
            {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
        </div>
        <div className="px-6 py-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">{footer}</div>}
      </div>
    </div>
  );
}

function arePromptTemplatesEqual(a: WorkflowPromptTemplate[], b: WorkflowPromptTemplate[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return Boolean(other)
      && item.id === other.id
      && item.name === other.name
      && item.description === other.description
      && item.prompt === other.prompt
      && item.mode === other.mode
      && item.builtIn === other.builtIn
      && item.basePrompt === other.basePrompt
      && item.isCustomized === other.isCustomized;
  });
}

const InputSection: React.FC<InputSectionProps> = ({
  step,
  studioState,
  workflowDraft,
  basePath,
  onOpenSettings,
  onOpenApiModal,
  onUpdateRouting,
  onSaveWorkflowDraft,
  onOpenSceneStudio,
}) => {
  const characterUploadInputRef = useRef<HTMLInputElement>(null);
  const styleUploadInputRef = useRef<HTMLInputElement>(null);
  const characterStripRef = useRef<HTMLDivElement>(null);
  const styleStripRef = useRef<HTMLDivElement>(null);
  const step4CharacterStripRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<number | null>(null);
  const autoRecommendSignatureRef = useRef('');
  const hydratedDraftIdRef = useRef('');
  const sectionScrollLockRef = useRef('');
  const shouldAutoScrollSectionRef = useRef(false);

  const initial = workflowDraft || ({} as WorkflowDraft);
  const initialStage = normalizeStage(initial.activeStage || 1);
  const initialContentType = initial.contentType || studioState?.lastContentType || 'story';
  const initialSelections = initial.selections || FIELD_OPTIONS_BY_TYPE[initialContentType];
  const initialAspectRatio = initial.aspectRatio || '16:9';
  const initialPromptPack = buildWorkflowPromptPack({
    contentType: initialContentType,
    topic: initial.topic || '',
    selections: initialSelections,
    script: initial.script || '',
  });
  const initialTemplates = resolveWorkflowPromptTemplates(initialContentType, initialPromptPack, initial.promptTemplates || []);

  const [activeStage, setActiveStage] = useState<StepId>(initialStage);
  const [openStage, setOpenStage] = useState<StepId | null>(initialStage);
  const [contentType, setContentType] = useState<ContentType>(initialContentType);
  const [topic, setTopic] = useState(initial.topic || getTopicSuggestion(initialContentType, ''));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialAspectRatio);
  const [storyScript, setStoryScript] = useState(initial.script || '');
  const [genre, setGenre] = useState(initialSelections.genre || FIELD_OPTIONS_BY_TYPE[initialContentType].genre[0]);
  const [mood, setMood] = useState(initialSelections.mood || FIELD_OPTIONS_BY_TYPE[initialContentType].mood[0]);
  const [endingTone, setEndingTone] = useState(initialSelections.endingTone || FIELD_OPTIONS_BY_TYPE[initialContentType].endingTone[0]);
  const [setting, setSetting] = useState(initialSelections.setting || FIELD_OPTIONS_BY_TYPE[initialContentType].setting[0]);
  const [protagonist, setProtagonist] = useState(initialSelections.protagonist || FIELD_OPTIONS_BY_TYPE[initialContentType].protagonist[0]);
  const [conflict, setConflict] = useState(initialSelections.conflict || FIELD_OPTIONS_BY_TYPE[initialContentType].conflict[0]);
  const [extractedCharacters, setExtractedCharacters] = useState<CharacterProfile[]>(initial.extractedCharacters || []);
  const [styleImages, setStyleImages] = useState<PromptedImageAsset[]>(initial.styleImages || []);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(initial.selectedCharacterIds || []);
  const [selectedStyleImageId, setSelectedStyleImageId] = useState<string | null>(initial.selectedStyleImageId || null);
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [showPromptPack, setShowPromptPack] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [notice, setNotice] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<WorkflowPromptTemplate[]>(initialTemplates);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState<string | null>(initial.selectedPromptTemplateId || initialTemplates[0]?.id || null);
  const [promptDetailId, setPromptDetailId] = useState<string | null>(initial.selectedPromptTemplateId || initialTemplates[0]?.id || null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptPreviewId, setPromptPreviewId] = useState<string | null>(null);
  const [expandedCharacterEditorId, setExpandedCharacterEditorId] = useState<string | null>(null);
  const [expandedStyleEditorId, setExpandedStyleEditorId] = useState<string | null>(null);
  const [characterCarouselIndices, setCharacterCarouselIndices] = useState<Record<string, number>>({});
  const [characterLoadingProgress, setCharacterLoadingProgress] = useState<Record<string, number>>({});
  const [styleCarouselIndices, setStyleCarouselIndices] = useState<Record<string, number>>({});
  const [styleLoadingProgress, setStyleLoadingProgress] = useState<Record<string, number>>({});
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterPrompt, setNewCharacterPrompt] = useState('');
  const [step3PanelMode, setStep3PanelMode] = useState<'balanced' | 'character-focus' | 'script-focus'>('balanced');
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');
  // 샘플 안내 모달과 프롬프트 수정 모달은 흐름을 끊지 않게 이 컴포넌트에서 직접 제어합니다.
  const [sampleGuideOpen, setSampleGuideOpen] = useState(false);
  const [promptEditorForm, setPromptEditorForm] = useState({ name: '', description: '', prompt: '' });

  const openStageWithIntent = (nextStage: StepId, shouldScroll = true) => {
    shouldAutoScrollSectionRef.current = shouldScroll;
    setOpenStage(nextStage);
  };

  useEffect(() => {
    const draftKey = workflowDraft?.id || 'draft';
    if (hydratedDraftIdRef.current === draftKey) return;
    hydratedDraftIdRef.current = draftKey;

    const nextType = workflowDraft?.contentType || studioState?.lastContentType || 'story';
    const nextSelections = workflowDraft?.selections || FIELD_OPTIONS_BY_TYPE[nextType];
    const nextStage = normalizeStage(workflowDraft?.activeStage || 1);
    const nextPromptPack = buildWorkflowPromptPack({
      contentType: nextType,
      topic: workflowDraft?.topic || '',
      selections: nextSelections,
      script: workflowDraft?.script || '',
    });
    const nextTemplates = resolveWorkflowPromptTemplates(nextType, nextPromptPack, workflowDraft?.promptTemplates || []);

    setContentType(nextType);
    setTopic(workflowDraft?.topic || getTopicSuggestion(nextType, ''));
    setAspectRatio(workflowDraft?.aspectRatio || '16:9');
    setStoryScript(workflowDraft?.script || '');
    setGenre(nextSelections.genre || FIELD_OPTIONS_BY_TYPE[nextType].genre[0]);
    setMood(nextSelections.mood || FIELD_OPTIONS_BY_TYPE[nextType].mood[0]);
    setEndingTone(nextSelections.endingTone || FIELD_OPTIONS_BY_TYPE[nextType].endingTone[0]);
    setSetting(nextSelections.setting || FIELD_OPTIONS_BY_TYPE[nextType].setting[0]);
    setProtagonist(nextSelections.protagonist || FIELD_OPTIONS_BY_TYPE[nextType].protagonist[0]);
    setConflict(nextSelections.conflict || FIELD_OPTIONS_BY_TYPE[nextType].conflict[0]);
    setExtractedCharacters(workflowDraft?.extractedCharacters || []);
    setStyleImages(workflowDraft?.styleImages || []);
    setSelectedCharacterIds(workflowDraft?.selectedCharacterIds || []);
    setSelectedStyleImageId(workflowDraft?.selectedStyleImageId || null);
    setActiveStage(nextStage);
    openStageWithIntent(nextStage, false);
    setPromptTemplates(nextTemplates);
    setSelectedPromptTemplateId(
      nextTemplates.some((item) => item.id === workflowDraft?.selectedPromptTemplateId)
        ? workflowDraft?.selectedPromptTemplateId || nextTemplates[0]?.id || null
        : nextTemplates[0]?.id || null
    );
    setPromptDetailId(
      nextTemplates.some((item) => item.id === workflowDraft?.selectedPromptTemplateId)
        ? workflowDraft?.selectedPromptTemplateId || nextTemplates[0]?.id || null
        : nextTemplates[0]?.id || null
    );
    setEditingPromptId(null);
    setPromptPreviewId(null);
    setCharacterCarouselIndices({});
    setCharacterLoadingProgress({});
    setStyleCarouselIndices({});
    setStyleLoadingProgress({});
    setNewCharacterName('');
    setNewCharacterPrompt('');
    setNewStyleName('');
    setNewStylePrompt('');
  }, [workflowDraft?.id, studioState?.lastContentType]);

  const isProcessing = step === GenerationStep.SCRIPTING || step === GenerationStep.ASSETS;
  const normalizedScript = useMemo(() => normalizeStoryText(storyScript), [storyScript]);
  const sceneCount = useMemo(() => splitStoryIntoParagraphScenes(normalizedScript).length, [normalizedScript]);

  const selections = useMemo(
    () => ({ genre, mood, endingTone, setting, protagonist, conflict }),
    [genre, mood, endingTone, setting, protagonist, conflict]
  );

  const promptPack = useMemo(
    () => buildWorkflowPromptPack({ contentType, topic, selections, script: normalizedScript }),
    [contentType, topic, selections, normalizedScript]
  );

  const syncedPromptTemplates = useMemo(
    () => resolveWorkflowPromptTemplates(contentType, promptPack, promptTemplates),
    [contentType, promptPack, promptTemplates]
  );

  useEffect(() => {
    if (!arePromptTemplatesEqual(promptTemplates, syncedPromptTemplates)) {
      setPromptTemplates(syncedPromptTemplates);
    }
    if (!syncedPromptTemplates.some((item) => item.id === selectedPromptTemplateId)) {
      setSelectedPromptTemplateId(syncedPromptTemplates[0]?.id || null);
    }
    if (!syncedPromptTemplates.some((item) => item.id === promptDetailId)) {
      setPromptDetailId(syncedPromptTemplates[0]?.id || null);
    }
  }, [promptTemplates, syncedPromptTemplates, selectedPromptTemplateId, promptDetailId]);

  const selectedPromptTemplate = useMemo(
    () => getSelectedWorkflowPromptTemplate(syncedPromptTemplates, selectedPromptTemplateId),
    [syncedPromptTemplates, selectedPromptTemplateId]
  );
  const promptDetailTemplate = useMemo(
    () => syncedPromptTemplates.find((item) => item.id === promptDetailId) || selectedPromptTemplate,
    [syncedPromptTemplates, promptDetailId, selectedPromptTemplate]
  );

  const selectedPromptIndex = useMemo(() => {
    const foundIndex = syncedPromptTemplates.findIndex((item) => item.id === selectedPromptTemplateId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [syncedPromptTemplates, selectedPromptTemplateId]);

  useEffect(() => {
    if (!editingPromptId) return;
    const target = syncedPromptTemplates.find((item) => item.id === editingPromptId);
    if (!target) return;
    setPromptEditorForm({
      name: target.name,
      description: target.description,
      prompt: target.prompt,
    });
  }, [editingPromptId, syncedPromptTemplates]);
  const activePromptSlide = syncedPromptTemplates[selectedPromptIndex] || selectedPromptTemplate;

  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => selectedCharacterIds.includes(item.id)),
    [extractedCharacters, selectedCharacterIds]
  );
  const selectedStyle = useMemo(
    () => styleImages.find((item) => item.id === selectedStyleImageId) || null,
    [styleImages, selectedStyleImageId]
  );
  const styleGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; items: PromptedImageAsset[] }>();
    (styleImages || []).forEach((item) => {
      const groupId = item.groupId || item.id;
      const existing = groups.get(groupId);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupId, { id: groupId, label: item.groupLabel || item.label, items: [item] });
      }
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.createdAt - b.createdAt),
    }));
  }, [styleImages]);
  const selectedStyleGroupId = selectedStyle?.groupId || null;

  useEffect(() => {
    setCharacterCarouselIndices((prev) => {
      const next = { ...prev };
      extractedCharacters.forEach((character) => {
        const imageCount = (character.generatedImages || []).length;
        if (!imageCount) {
          next[character.id] = 0;
          return;
        }
        const selectedIndex = Math.max(0, (character.generatedImages || []).findIndex((image) => image.id === character.selectedImageId));
        const fallbackIndex = typeof next[character.id] === 'number' ? next[character.id] : selectedIndex;
        next[character.id] = Math.min(Math.max(fallbackIndex, 0), imageCount - 1);
      });
      return next;
    });
  }, [extractedCharacters]);

  useEffect(() => {
    setStyleCarouselIndices((prev) => {
      const next = { ...prev };
      styleGroups.forEach((group) => {
        const currentCount = group.items.length;
        const loadingCount = styleLoadingProgress[group.id] !== undefined ? 1 : 0;
        const slideCount = currentCount + loadingCount;
        if (!slideCount) {
          next[group.id] = 0;
          return;
        }
        const selectedIndex = Math.max(0, group.items.findIndex((item) => item.id === selectedStyleImageId));
        const fallbackIndex = typeof next[group.id] === 'number' ? next[group.id] : selectedIndex;
        next[group.id] = Math.min(Math.max(selectedIndex >= 0 ? selectedIndex : fallbackIndex, 0), Math.max(slideCount - 1, 0));
      });
      return next;
    });
  }, [styleGroups, selectedStyleImageId, styleLoadingProgress]);

  useEffect(() => {
    const container = characterStripRef.current;
    if (!container || !selectedCharacterIds.length) return;
    const targetId = selectedCharacterIds[selectedCharacterIds.length - 1];
    const target = container.querySelector<HTMLElement>(`[data-character-card-id="${targetId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedCharacterIds, extractedCharacters.length]);

  useEffect(() => {
    const container = styleStripRef.current;
    if (!container || !styleGroups.length) return;
    const targetGroupId = selectedStyleGroupId || styleGroups[styleGroups.length - 1]?.id;
    if (!targetGroupId) return;
    const target = container.querySelector<HTMLElement>(`[data-style-group-id="${targetGroupId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedStyleGroupId, styleGroups.length]);

  useEffect(() => {
    const container = step4CharacterStripRef.current;
    if (!container || !selectedCharacters.length) return;
    const targetId = selectedCharacters[selectedCharacters.length - 1]?.id;
    if (!targetId) return;
    const target = container.querySelector<HTMLElement>(`[data-step4-character-id="${targetId}"]`);
    if (target) scrollElementIntoView(target);
  }, [selectedCharacters.length]);

  useEffect(() => {
    if (!openStage || !shouldAutoScrollSectionRef.current) return;
    const signature = `${workflowDraft?.id || 'draft'}:${openStage}`;
    if (sectionScrollLockRef.current === signature) {
      shouldAutoScrollSectionRef.current = false;
      return;
    }
    sectionScrollLockRef.current = signature;
    shouldAutoScrollSectionRef.current = false;

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-step-section="step-${openStage}"]`);
      if (!target) return;
      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
      window.scrollTo({ top, behavior: 'smooth' });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [openStage, workflowDraft?.id]);

  const stepCompleted = useMemo(
    () => ({
      1: Boolean(contentType),
      2: Boolean(topic.trim() && genre.trim() && mood.trim() && endingTone.trim() && setting.trim() && protagonist.trim() && conflict.trim()),
      3: Boolean(normalizedScript.trim() && selectedPromptTemplateId && selectedCharacterIds.length),
      4: Boolean(selectedStyleImageId),
    }),
    [contentType, aspectRatio, topic, genre, mood, endingTone, setting, protagonist, conflict, normalizedScript, selectedPromptTemplateId, selectedCharacterIds, selectedStyleImageId]
  );

  const stageStatus = useMemo(() => ({
    1: activeStage >= 2,
    2: activeStage >= 3,
    3: activeStage >= 4,
    4: stepCompleted[4] && activeStage >= 4,
  }), [activeStage, stepCompleted]);

  const completion = useMemo(() => {
    const completedCount = Object.values(stageStatus).filter(Boolean).length;
    const total = Math.round((completedCount / 4) * 100);
    return { total, remaining: Math.max(0, 100 - total) };
  }, [stageStatus]);

  const step3GuideItems = useMemo(() => {
    const items = [
      normalizedScript.trim()
        ? `대본 준비 완료: ${sceneCount}문단으로 씬 분할이 가능합니다.`
        : '먼저 프롬프트로 대본을 만들거나 직접 입력해 주세요.',
      selectedPromptTemplateId
        ? '프롬프트 선택 완료: 지금 보이는 프롬프트로 바로 대본 생성이 가능합니다.'
        : '프롬프트를 하나 선택해야 AI 대본 생성 흐름이 자연스럽게 이어집니다.',
      selectedCharacters.length
        ? `출연자 준비 완료: ${selectedCharacters.length}명을 씬 참조 이미지로 넘길 수 있습니다.`
        : '대본 기준 출연자 준비를 눌러 주인공/조연/나레이터 카드를 먼저 채워 주세요.',
      selectedStyle
        ? `화풍 선택 완료: "${selectedStyle.label}"이 씬 전체 스타일로 연결됩니다.`
        : 'Step 4에서 화풍 1개를 꼭 선택해야 프로젝트에 추가 후 씬 제작으로 넘어갑니다.',
    ];
    return items;
  }, [normalizedScript, sceneCount, selectedPromptTemplateId, selectedCharacters.length, selectedStyle]);

  const canOpenStage = (stage: StepId) => stage <= activeStage;

  const visibleStepIds = STEP_META
    .map((meta) => meta.id)
    .filter((stage) => stage <= activeStage);

  const buildDraftPayload = () => ({
    contentType,
    aspectRatio,
    topic,
    script: normalizedScript,
    activeStage,
    selections,
    extractedCharacters,
    styleImages,
    characterImages: extractedCharacters.flatMap((item) => item.generatedImages || []),
    selectedCharacterIds,
    selectedStyleImageId,
    referenceImages: workflowDraft?.referenceImages || DEFAULT_REFERENCE_IMAGES,
    promptPack,
    promptTemplates: syncedPromptTemplates,
    selectedPromptTemplateId,
    completedSteps: {
      step1: stageStatus[1],
      step2: stageStatus[2],
      step3: stageStatus[3],
      step4: stageStatus[4],
    },
  });

  const simulateProgress = (setter: React.Dispatch<React.SetStateAction<number>> | ((value: number) => void), doneAt = 94) => new Promise<void>((resolve) => {
    let progress = 0;
    setter(0);
    const timer = window.setInterval(() => {
      progress = Math.min(doneAt, progress + Math.max(6, Math.round(Math.random() * 18)));
      setter(progress);
      if (progress >= doneAt) {
        window.clearInterval(timer);
        resolve();
      }
    }, 120);
  });

  const connectionSummary = {
    text: Boolean(studioState?.providers?.openRouterApiKey),
    audio: Boolean(studioState?.providers?.elevenLabsApiKey),
    video: Boolean(studioState?.providers?.falApiKey),
  };

  const selectedScriptModel = studioState?.routing?.scriptModel || SCRIPT_MODEL_OPTIONS[0].id;
  const selectedImageModel = studioState?.routing?.imageModel || IMAGE_MODELS[0].id;
  const textModelReady = connectionSummary.text;
  const imageModelReady = connectionSummary.text;

  const promptTextAiSetup = (message?: string) => {
    onOpenApiModal?.({
      title: '이 기능은 텍스트 AI 연결이 필요합니다',
      description: message || 'OpenRouter 키를 연결하면 대본 생성, 항목 추천, 캐릭터 / 화풍 추천이 실제 AI 결과로 바뀝니다.',
      focusField: 'openRouter',
    });
  };

  useEffect(() => {
    if (!onSaveWorkflowDraft) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      onSaveWorkflowDraft(buildDraftPayload());
    }, 350);

    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, [
    contentType,
    aspectRatio,
    topic,
    normalizedScript,
    activeStage,
    selections,
    extractedCharacters,
    styleImages,
    selectedCharacterIds,
    selectedStyleImageId,
    promptPack,
    syncedPromptTemplates,
    selectedPromptTemplateId,
    stepCompleted,
    onSaveWorkflowDraft,
  ]);

  const resetCharactersAndStyles = () => {
    setExtractedCharacters([]);
    setStyleImages([]);
    setSelectedCharacterIds([]);
    setSelectedStyleImageId(null);
    setExpandedCharacterEditorId(null);
    setExpandedStyleEditorId(null);
    setCharacterCarouselIndices({});
    setCharacterLoadingProgress({});
    setStyleCarouselIndices({});
    setStyleLoadingProgress({});
    setNewCharacterName('');
    setNewCharacterPrompt('');
    setNewStyleName('');
    setNewStylePrompt('');
    autoRecommendSignatureRef.current = '';
  };

  const focusPromptTemplate = (templateId: string) => {
    setSelectedPromptTemplateId(templateId);
    setPromptDetailId(templateId);
    setEditingPromptId(null);
  };

  /**
   * 프롬프트 수정은 본문에서 바로 편집하지 않고 팝업에서만 진행합니다.
   * 실수로 본문 레이아웃이 흔들리는 문제를 막기 위한 구조입니다.
   */
  const openPromptEditor = (templateId: string) => {
    const target = syncedPromptTemplates.find((item) => item.id === templateId);
    if (!target) return;
    focusPromptTemplate(templateId);
    setEditingPromptId(templateId);
    setPromptEditorForm({
      name: target.name,
      description: target.description,
      prompt: target.prompt,
    });
  };

  const savePromptEditor = () => {
    if (!editingPromptId) return;
    updatePromptTemplate(editingPromptId, {
      name: promptEditorForm.name,
      description: promptEditorForm.description,
      prompt: promptEditorForm.prompt,
    });
    setEditingPromptId(null);
    setPromptPreviewId(null);
    setNotice('프롬프트 수정을 저장했습니다. 이후 대본 생성과 씬 제작에 바로 반영됩니다.');
  };

  const restartFromStage = (stage: StepId) => {
    if (!canOpenStage(stage)) {
      setNotice(`Step ${stage - 1} 완료 후 열 수 있습니다.`);
      return;
    }

    if (stage === 1) {
      const defaults = FIELD_OPTIONS_BY_TYPE[contentType];
      const nextSelections = {
        genre: defaults.genre[0],
        mood: defaults.mood[0],
        endingTone: defaults.endingTone[0],
        setting: defaults.setting[0],
        protagonist: defaults.protagonist[0],
        conflict: defaults.conflict[0],
      };
      const nextPromptPack = buildWorkflowPromptPack({ contentType, topic: '', selections: nextSelections, script: '' });
      const nextTemplates = resolveWorkflowPromptTemplates(contentType, nextPromptPack, []);
      setTopic(getTopicSuggestion(contentType, ''));
      setStoryScript('');
      setGenre(nextSelections.genre);
      setMood(nextSelections.mood);
      setEndingTone(nextSelections.endingTone);
      setSetting(nextSelections.setting);
      setProtagonist(nextSelections.protagonist);
      setConflict(nextSelections.conflict);
      setPromptTemplates(nextTemplates);
      setSelectedPromptTemplateId(nextTemplates[0]?.id || null);
      setPromptDetailId(nextTemplates[0]?.id || null);
      resetCharactersAndStyles();
      setActiveStage(1);
      openStageWithIntent(1);
      setNotice('Step 1을 다시 열어 이후 단계를 초기화했습니다. Step 2부터 새로 진행해 주세요.');
      return;
    }

    if (stage === 2) {
      setStoryScript('');
      resetCharactersAndStyles();
      setActiveStage(2);
      openStageWithIntent(2);
      setNotice('Step 2를 다시 열었습니다. 이후 단계는 숨기고 Step 3부터 다시 진행합니다.');
      return;
    }

    if (stage === 3) {
      resetCharactersAndStyles();
      setActiveStage(3);
      openStageWithIntent(3);
      setNotice('Step 3를 다시 열었습니다. 캐릭터 배정부터 다시 손보고, Step 4에서 화풍을 다시 고를 수 있습니다.');
      return;
    }

    setActiveStage(4);
    openStageWithIntent(4);
  };

  const openExampleGuide = () => {
    if (connectionSummary.text) {
      fillSample();
      return;
    }
    setSampleGuideOpen(true);
  };

  const scrollStageIntoFocus = (stage: StepId) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-step-section="step-${stage}"]`);
      if (!target) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 12);
      window.scrollTo({ top, behavior: 'smooth' });
    });
  };

  const openOnly = (stage: StepId) => {
    if (!canOpenStage(stage)) return;
    openStageWithIntent(stage);
    scrollStageIntoFocus(stage);
  };

  const toggleStage = (stage: StepId) => {
    if (!canOpenStage(stage)) {
      setNotice(`Step ${stage - 1} 완료 후 열 수 있습니다.`);
      return;
    }
    if (stage < activeStage) {
      restartFromStage(stage);
      return;
    }
    openStageWithIntent(stage);
  };

  const completeStage = (stage: StepId, nextStage?: StepId) => {
    const messages: Record<StepId, string> = {
      1: 'Step 1에서 먼저 제작 유형과 화면 비율을 고른 뒤 Step 2로 넘어가 주세요.',
      2: 'Step 2에서 주제와 핵심 선택값을 채워 프롬프트 / 대본 방향을 먼저 고정해 주세요.',
      3: 'Step 3에서 프롬프트와 대본을 만든 뒤, 대본 기준 출연자 준비와 출연자 선택까지 마쳐 주세요.',
      4: 'Step 4에서는 Step 3에서 고른 출연자를 확인하고 화풍 1개를 선택해야 프로젝트에 추가 후 씬 제작으로 넘어갈 수 있습니다.',
    };

    if (!stepCompleted[stage]) {
      setNotice(messages[stage]);
      openOnly(stage);
      scrollStageIntoFocus(stage);
      return false;
    }

    if (nextStage) {
      setNotice(`Step ${stage} 완료. Step ${nextStage}로 이동합니다.`);
      setActiveStage((prev) => Math.max(prev, nextStage) as StepId);
      openStageWithIntent(nextStage);
      return true;
    }

    setNotice(`Step ${stage} 완료.`);
    setActiveStage((prev) => Math.max(prev, stage) as StepId);
    openStageWithIntent(stage);
    return true;
  };

  /**
   * 스토리 빌더는 요청에 맞춰 "예시로 채우기"를 핵심 진입점으로 유지합니다.
   * 전체 AI 일괄 추천 버튼은 제거하고, 필요한 경우 필드별 추천만 남깁니다.
   */
  const fillSample = () => {
    if (contentType === 'music_video') {
      setTopic('새벽 네온 아래 다시 시작되는 후렴');
      setGenre('시네마틱 발라드');
      setMood('몽환적인');
      setEndingTone('쓸쓸하지만 아름다운 마감');
      setSetting('비 오는 옥상');
      setProtagonist('무대를 떠난 보컬');
      setConflict('전하지 못한 마음');
      setStoryScript(
        normalizeStoryText(`
[Intro]
젖은 옥상 끝에 서서 밤의 숨을 세어
아직 못 보낸 말이 입술에 남아 있어

[Verse 1]
네온은 흔들리고 빗방울은 박자를 만들고
멈춘 줄 알았던 기억이 다시 어깨를 두드려
뒤돌면 끝날 것 같아서 더 천천히 걷고
사라진 너의 이름만 마음속에서 선명해져

[Chorus]
오늘의 나는 어제의 나를 지나
후렴처럼 너를 다시 불러
대답 없는 밤이어도 괜찮아
이 마음은 끝이 아니라 반전이니까

[Verse 2]
젖은 계단 아래로 도시의 불빛이 흘러내리고
숨겨 둔 후회들이 한 줄씩 노래가 되어
끝내 누르지 못한 메시지 창을 열어 둔 채
나는 같은 밤을 다른 표정으로 건너가

[Outro]
답장은 아직 없어도 발끝은 가벼워지고
같은 후렴이지만 이번엔 나를 먼저 안아`)
      );
      setNotice('뮤직비디오 샘플을 가사 구조로 채웠습니다. 각 블록이 그대로 씬 후보가 됩니다.');
      openOnly(3);
      return;
    }

    if (contentType === 'news') {
      setTopic('도시 재개발 이슈 핵심 브리핑');
      setGenre('해설 리포트');
      setMood('정돈된');
      setEndingTone('핵심 요약으로 마무리');
      setSetting('뉴스룸 스튜디오');
      setProtagonist('앵커');
      setConflict('데이터와 체감의 차이');
      setStoryScript(
        normalizeStoryText(`앵커는 오늘의 핵심 이슈가 도시 재개발 계획과 생활권 변화에 어떻게 연결되는지 첫 화면에서 짚어 준다.\n\n이어지는 장면에서는 사업 일정과 예산, 주민 반응이 순서대로 정리되며 왜 이 사안이 빠르게 주목받고 있는지 설명한다.\n\n중간 장면에서는 통계 자료와 인터뷰가 함께 제시되며, 숫자로 보이는 변화와 실제 체감 사이의 간극이 논점으로 떠오른다.\n\n마지막 장면에서 앵커는 시청자가 기억해야 할 핵심 세 가지를 짧게 정리하고, 다음 업데이트 포인트를 예고한다.`)
      );
      setNotice('뉴스 샘플을 채웠습니다. 문단마다 브리핑 컷이 분리됩니다.');
      openOnly(3);
      return;
    }

    setTopic('새벽 편의점 불빛 아래 다시 시작되는 선택');
    setGenre('드라마');
    setMood('감성적인');
    setEndingTone('희망적인 결말');
    setSetting('새벽의 편의점');
    setProtagonist('초보 창작자');
    setConflict('잊고 있던 약속');
    setStoryScript(
      normalizeStoryText(`새벽의 편의점 앞, 주인공은 하루를 끝낸 표정으로 서 있지만 사실 오늘만큼은 그냥 지나칠 수 없는 밤이라는 것을 알고 있다.\n\n계산대 옆 작은 메모 하나가 눈에 들어오고, 그는 오래전에 미뤄 둔 약속이 아직 끝나지 않았다는 사실을 떠올린다.\n\n평소라면 고개를 돌렸겠지만, 이번에는 발걸음을 멈춘 채 스스로가 도망치던 이유를 처음으로 인정한다.\n\n문이 닫히기 직전, 그는 메시지를 보내고 아주 작은 선택 하나가 앞으로의 시간을 바꾸기 시작한다.\n\n마지막 장면에서 주인공은 혼자가 아니게 된 표정으로 골목을 걸어가며, 같은 밤이 전과 다른 공기로 보이기 시작한다.`)
    );
    setNotice('스토리 샘플을 채웠습니다. 이제 프롬프트를 고르고 바로 대본을 다듬을 수 있습니다.');
    openOnly(3);
  };

  const refreshField = async (field: keyof StorySelectionState) => {
    if (!connectionSummary.text) {
      promptTextAiSetup('현재 항목 추천은 샘플 보조 모드로 동작 중입니다. OpenRouter를 연결하면 이 자리에서 실제 AI 추천을 바로 받을 수 있습니다.');
    }
    setLoadingFields((prev) => ({ ...prev, [field]: true }));
    try {
      const nextValue = await recommendStoryField({ field, contentType, topic, model: studioState?.routing?.scriptModel });
      ({ genre: setGenre, mood: setMood, endingTone: setEndingTone, setting: setSetting, protagonist: setProtagonist, conflict: setConflict } as const)[field](nextValue);
      setNotice(`${fieldConfigs.find((item) => item.key === field)?.label || '항목'} 추천값을 현재 주제에 맞는 텍스트로 채웠습니다.`);
    } finally {
      setLoadingFields((prev) => ({ ...prev, [field]: false }));
    }
  };

  const createDraftFromSelections = () => {
    const draft = buildSelectableStoryDraft({ contentType, topic, ...selections });
    setStoryScript(draft);
    setNotice(contentType === 'music_video' ? '선택값으로 가사형 샘플을 만들었습니다.' : '선택값으로 대본 초안을 만들었습니다.');
    openOnly(3);
  };

  const generateScriptByPrompt = async (conversationMode = false, templateOverride?: WorkflowPromptTemplate) => {
    const template = templateOverride || selectedPromptTemplate;
    if (!template) return;
    if (!connectionSummary.text) {
      promptTextAiSetup('현재 대본 생성은 샘플 보조 모드입니다. OpenRouter를 연결하면 이 자리에서 실제 AI 대본 초안을 바로 받을 수 있습니다.');
    }
    focusPromptTemplate(template.id);
    setIsGeneratingScript(true);
    try {
      const result = await composeScriptDraft({
        contentType,
        topic,
        selections,
        template,
        currentScript: normalizedScript,
        model: studioState?.routing?.scriptModel,
        conversationMode,
      });
      setStoryScript(result.text);
      setNotice(result.source === 'ai' ? `선택한 프롬프트 "${template.name}"로 AI 초안을 만들었습니다.` : 'API 연결이 없어 현재는 정해진 샘플 로직으로 대본을 채웠습니다. OpenRouter를 등록하면 실제 AI 생성으로 전환됩니다.');
      openOnly(3);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const hydrateCharactersForScript = async (options?: { forceSample?: boolean; preserveSelection?: boolean }) => {
    if (!normalizedScript.trim()) {
      setNotice('먼저 Step 3에서 대본을 입력하거나 생성해 주세요.');
      openOnly(3);
      return;
    }

    const forceSample = Boolean(options?.forceSample);
    const allowAi = !forceSample && Boolean(studioState?.providers?.openRouterApiKey);
    if (!allowAi && !forceSample) {
      promptTextAiSetup('캐릭터 추출은 지금 샘플 보조 모드로도 테스트할 수 있습니다. OpenRouter를 연결하면 대본 속 역할을 더 정교하게 추출합니다.');
    }

    setIsExtracting(true);
    try {
      const nextCharacters = await extractCharactersFromScript({
        script: normalizedScript,
        selections,
        contentType,
        model: selectedScriptModel,
        allowAi,
      });

      const preservedIds = options?.preserveSelection ? selectedCharacterIds.filter((id) => nextCharacters.some((item) => item.id === id)) : [];
      const nextSelectedIds = preservedIds.length ? preservedIds : nextCharacters.map((item) => item.id);
      setExtractedCharacters(nextCharacters);
      setSelectedCharacterIds(nextSelectedIds);
      setCharacterCarouselIndices({});
      setNotice(allowAi ? 'Step 3 대본 기준으로 주인공과 조연 후보를 추출했습니다. 여기서 바로 선택하고 역할을 손볼 수 있습니다.' : 'API 연결이 없어 샘플 캐릭터 후보를 채웠습니다. 선택과 역할 배정 흐름은 그대로 테스트할 수 있습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const ensureStyleRecommendations = async (mode: 'auto' | 'manual' = 'manual') => {
    if (mode === 'manual' && !connectionSummary.text) {
      promptTextAiSetup('현재 화풍 추천은 샘플 보조 모드입니다. OpenRouter를 연결하면 화풍 추천이 실제 AI 텍스트 기반으로 더 정교해집니다.');
    }
    if (!normalizedScript.trim()) {
      setNotice('먼저 Step 3에서 대본과 캐릭터 선택을 마쳐 주세요.');
      openOnly(3);
      return;
    }

    setIsExtracting(true);
    try {
      const usedLabels: string[] = Array.from(new Set(styleImages.map((item) => item.groupLabel || item.label).filter(Boolean) as string[]));
      const nextStyleCard = buildStyleRecommendations(
        normalizedScript,
        contentType,
        usedLabels,
        1,
        aspectRatio
      )[0] || buildStyleRecommendations(normalizedScript, contentType, [], 1, aspectRatio)[0];

      const nextStyles = nextStyleCard
        ? (mode === 'auto' ? [nextStyleCard] : [...styleImages, nextStyleCard])
        : styleImages;
      const nextSelectedStyleId = selectedStyleImageId || nextStyles[0]?.id || null;

      if (nextStyles.length) {
        setStyleImages(nextStyles);
        setSelectedStyleImageId(nextSelectedStyleId || nextStyles[0].id);
        setStyleCarouselIndices({});
      }

      setNotice(
        studioState?.providers?.openRouterApiKey
          ? (mode === 'auto' ? 'Step 4용 기본 화풍 카드를 준비했습니다. 여기서 유사 화풍을 계속 추가할 수 있습니다.' : '선택한 대본 기준으로 화풍 카드 1개를 추가했습니다.')
          : (mode === 'auto' ? 'API 연결이 없어도 Step 4용 샘플 화풍 카드를 먼저 채웠습니다.' : 'AI 연결이 없어 샘플 화풍 카드 1개를 추가했습니다. OpenRouter를 연결하면 실제 추천 기반으로 계속 늘릴 수 있습니다.')
      );
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    const signature = `${contentType}::${topic}::${normalizedScript}`;
    if (openStage !== 4) return;
    if (!normalizedScript.trim()) return;
    if (styleImages.length) return;
    if (autoRecommendSignatureRef.current === signature) return;

    autoRecommendSignatureRef.current = signature;
    void ensureStyleRecommendations('auto');
  }, [openStage, contentType, topic, normalizedScript, styleImages.length, aspectRatio]);

  const updateCharacterPrompt = (characterId: string, prompt: string) => {
    setExtractedCharacters((prev) => prev.map((item) => {
      if (item.id !== characterId) return item;
      const targetImageId = item.selectedImageId || item.generatedImages?.[0]?.id || null;
      return {
        ...item,
        prompt,
        generatedImages: (item.generatedImages || []).map((image) => image.id === targetImageId ? { ...image, prompt } : image),
      };
    }));
  };

  const updateCharacterRole = (characterId: string, role: CharacterProfile['role']) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      role,
      roleLabel: item.roleLabel || item.description || (role === 'lead' ? '주인공' : role === 'narrator' ? '나레이터' : '조연'),
    } : item));
  };

  const updateCharacterRoleLabel = (characterId: string, roleLabel: string) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      roleLabel,
      rolePrompt: roleLabel,
      description: roleLabel || item.description,
    } : item));
  };

  const updateCharacterName = (characterId: string, name: string) => {
    setExtractedCharacters((prev) => prev.map((item) => item.id === characterId ? {
      ...item,
      name,
      generatedImages: (item.generatedImages || []).map((image, imageIndex) => imageIndex === 0 ? { ...image, label: name || image.label } : image),
    } : item));
  };

  const removeCharacter = (characterId: string) => {
    setExtractedCharacters((prev) => prev.filter((item) => item.id !== characterId).map((item, index) => ({ ...item, castOrder: index + 1 })));
    setSelectedCharacterIds((prev) => prev.filter((id) => id !== characterId));
    setCharacterCarouselIndices((prev) => {
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
    setCharacterLoadingProgress((prev) => {
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
    setExpandedCharacterEditorId((prev) => prev === characterId ? null : prev);
    setNotice('출연자 카드 1개를 제거했습니다. 선택 목록과 참조 이미지도 함께 정리했습니다.');
  };

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacterIds((prev) => prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...new Set([...prev, characterId])]);
  };

  const chooseCharacterImage = (characterId: string, image: PromptedImageAsset) => {
    setExtractedCharacters((prev) =>
      prev.map((item) => item.id === characterId ? { ...item, selectedImageId: image.id, imageData: image.imageData, prompt: image.prompt || item.prompt } : item)
    );
    const targetCharacter = extractedCharacters.find((item) => item.id === characterId);
    const nextIndex = Math.max(0, (targetCharacter?.generatedImages || []).findIndex((item) => item.id === image.id));
    setCharacterCarouselIndices((prev) => ({ ...prev, [characterId]: nextIndex }));
  };

  const createCharacterVariants = async (character: CharacterProfile) => {
    const existingImages = character.generatedImages || [];
    if (characterLoadingProgress[character.id] !== undefined) return;
    if (existingImages.length >= MAX_CHARACTER_VARIANT_COUNT) {
      setNotice(`${character.name} 캐릭터 카드는 최대 ${MAX_CHARACTER_VARIANT_COUNT}장까지 유지합니다. 과도한 생성은 미리 막았습니다.`);
      return;
    }

    const pendingIndex = existingImages.length;
    setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: pendingIndex }));
    await simulateProgress((value) => setCharacterLoadingProgress((prev) => ({ ...prev, [character.id]: value })));

    const variants = createPromptVariants({
      title: character.name,
      prompt: character.prompt || character.description,
      kind: 'character',
      count: 1,
      existingCount: existingImages.length,
    });
    setExtractedCharacters((prev) =>
      prev.map((item) =>
        item.id === character.id
          ? {
              ...item,
              generatedImages: [...(item.generatedImages || []), ...variants],
              selectedImageId: variants[0]?.id || item.selectedImageId,
              imageData: variants[0]?.imageData || item.imageData,
            }
          : item
      )
    );
    setSelectedCharacterIds((prev) => (prev.includes(character.id) ? prev : [...prev, character.id]));
    setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: pendingIndex }));
    setCharacterLoadingProgress((prev) => { const next = { ...prev }; delete next[character.id]; return next; });
    setNotice(`${character.name} 기준 추천 카드 1장을 오른쪽 슬롯에 추가했습니다.`);
  };

  const updateStylePrompt = (styleId: string, prompt: string) => {
    setStyleImages((prev) => prev.map((item) => item.id === styleId ? { ...item, prompt } : item));
  };

  const createStyleVariants = async (styleCard: PromptedImageAsset) => {
    const groupId = styleCard.groupId || styleCard.id;
    const groupItems = styleImages.filter((item) => (item.groupId || item.id) === groupId);
    if (styleLoadingProgress[groupId] !== undefined) return;
    if (styleImages.length >= MAX_STYLE_CARD_COUNT) {
      setNotice(`화풍 카드는 최대 ${MAX_STYLE_CARD_COUNT}장까지 유지합니다. 과부하를 막기 위해 추가 생성을 잠시 막았습니다.`);
      return;
    }

    const pendingIndex = groupItems.length;
    setStyleCarouselIndices((prev) => ({ ...prev, [groupId]: pendingIndex }));
    await simulateProgress((value) => setStyleLoadingProgress((prev) => ({ ...prev, [groupId]: value })));

    const variants = createPromptVariants({
      title: styleCard.groupLabel || styleCard.label,
      prompt: styleCard.prompt,
      kind: 'style',
      count: 1,
      groupId,
      groupLabel: styleCard.groupLabel || styleCard.label,
      existingCount: groupItems.length,
    });
    setStyleImages((prev) => [...prev, ...variants]);
    setSelectedStyleImageId(variants[0]?.id || styleCard.id);
    setStyleCarouselIndices((prev) => ({ ...prev, [groupId]: pendingIndex }));
    setStyleLoadingProgress((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setNotice(`${styleCard.groupLabel || styleCard.label} 화풍 기준 유사안 1장을 같은 카드 안에 추가했습니다.`);
  };

  const buildUploadPrompt = (label: string, kind: 'character' | 'style') => buildUploadDrivenPrompt({
    label,
    kind,
    topic,
    mood,
    setting,
    protagonist,
    contentType,
    aspectRatio,
  });

  const createCharacterFromPrompt = (name: string, prompt: string, sourceMode: PromptedImageAsset['sourceMode'] = 'ai', imageData?: string) => {
    const nextRole: CharacterProfile['role'] = extractedCharacters.some((item) => item.role === 'lead') ? 'support' : 'lead';
    const nextRoleLabel = sourceMode === 'upload'
      ? (nextRole === 'lead' ? '주인공 / 업로드 감성 기반 캐릭터' : '조연 / 업로드 감성 기반 캐릭터')
      : (nextRole === 'lead' ? '주인공 / 직접 추가한 캐릭터' : '조연 / 직접 추가한 캐릭터');
    const nextCharacter = createCharacterCardFromPrompt({
      name,
      prompt,
      description: sourceMode === 'upload' ? '업로드 감성 기반 캐릭터' : '프롬프트 신규 캐릭터',
      imageData,
      sourceMode,
      role: nextRole,
      roleLabel: nextRoleLabel,
      castOrder: extractedCharacters.length + 1,
    });
    setExtractedCharacters((prev) => [...prev, nextCharacter]);
    setSelectedCharacterIds((prev) => [...new Set([...prev, nextCharacter.id])]);
    setCharacterCarouselIndices((prev) => ({ ...prev, [nextCharacter.id]: 0 }));
    return nextCharacter;
  };

  const createStyleFromPrompt = (label: string, prompt: string, sourceMode: PromptedImageAsset['sourceMode'] = 'ai', imageData?: string) => {
    const nextStyle = createStyleCardFromPrompt({
      label,
      prompt,
      imageData,
      sourceMode,
      groupLabel: label,
    });
    const nextGroupId = nextStyle.groupId || nextStyle.id;
    setStyleImages((prev) => [...prev, nextStyle]);
    setSelectedStyleImageId(nextStyle.id);
    setStyleCarouselIndices((prev) => ({ ...prev, [nextGroupId]: 0 }));
    return nextStyle;
  };

  const createNewCharacterByPrompt = () => {
    const fallbackName = `${protagonist || '신규 캐릭터'} ${extractedCharacters.length + 1}`;
    const prompt = newCharacterPrompt.trim() || buildUploadPrompt(newCharacterName || fallbackName, 'character');
    const name = newCharacterName.trim() || fallbackName;
    createCharacterFromPrompt(name, prompt, 'ai');
    setNewCharacterName('');
    setNewCharacterPrompt('');
    setNotice(`${name} 출연자를 캐릭터 카드로 추가했습니다. 선택된 프롬프트와 이미지가 Step 4, 씬 제작까지 그대로 이어집니다.`);
    if (openStage !== 3) openOnly(3);
  };

  const createNewStyleByPrompt = () => {
    const fallbackLabel = `${contentType === 'news' ? '뉴스 화풍' : '신규 화풍'} ${styleImages.length + 1}`;
    const prompt = newStylePrompt.trim() || buildUploadPrompt(newStyleName || fallbackLabel, 'style');
    const label = newStyleName.trim() || fallbackLabel;
    createStyleFromPrompt(label, prompt, 'ai');
    setNewStyleName('');
    setNewStylePrompt('');
    setNotice(`${label} 화풍 카드를 오른쪽에 추가했습니다. 선택된 화풍 프롬프트가 씬 이미지 생성에 반영됩니다.`);
    if (openStage !== 4) openOnly(4);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'character' | 'style') => {
    const files = e.target.files;
    if (!files?.length) return;

    const selectedFiles = Array.from(files as FileList).slice(0, MAX_UPLOAD_FILE_COUNT);
    const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'));
    if (invalidFile) {
      setNotice('이미지 파일만 업로드할 수 있습니다. JPG, PNG, WEBP 파일로 다시 시도해 주세요.');
      e.target.value = '';
      return;
    }

    const oversizeFile = selectedFiles.find((file) => file.size > MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024);
    if (oversizeFile) {
      setNotice(`${oversizeFile.name} 파일이 ${MAX_UPLOAD_FILE_SIZE_MB}MB를 넘어 업로드를 막았습니다. 큰 파일은 브라우저 과부하를 만들 수 있어 미리 차단했습니다.`);
      e.target.value = '';
      return;
    }

    const images = await Promise.all(
      selectedFiles.map(
        (file: File) =>
          new Promise<PromptedImageAsset>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const prompt = buildUploadPrompt(file.name.replace(/\.[^.]+$/, ''), mode);
              const preview = buildPromptPreviewCard({
                label: file.name.replace(/\.[^.]+$/, ''),
                subtitle: mode === 'character' ? '업로드 감성 캐릭터' : '업로드 감성 화풍',
                prompt,
                accent: mode === 'character' ? '#2563eb' : '#8b5cf6',
                kind: mode,
                sourceMode: 'upload',
              });
              resolve({
                ...preview,
                imageData: String(reader.result),
                sourceMode: 'upload',
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    if (mode === 'character') {
      const uploadedCharacters = images.map((image, index) => createCharacterCardFromPrompt({
        name: image.label,
        prompt: image.prompt,
        description: '업로드 감성 기반 캐릭터',
        imageData: image.imageData,
        sourceMode: 'upload',
      }));
      setExtractedCharacters((prev) => [...prev, ...uploadedCharacters]);
      setSelectedCharacterIds((prev) => [...new Set([...prev, ...uploadedCharacters.map((item) => item.id)])]);
      setCharacterCarouselIndices((prev) => ({
        ...prev,
        ...Object.fromEntries(uploadedCharacters.map((item) => [item.id, 0])),
      }));
      setNotice('업로드한 이미지를 출연자 캐릭터 카드로 추가했고, 해당 느낌의 프롬프트도 함께 저장했습니다.');
    } else {
      setStyleImages((prev) => [...prev, ...images]);
      const newest = images[images.length - 1];
      if (newest) {
        setSelectedStyleImageId(newest.id);
      }
      setStyleCarouselIndices((prev) => ({
        ...prev,
        ...Object.fromEntries(images.map((item) => [item.groupId || item.id, 0])),
      }));
      setNotice('업로드한 이미지를 화풍 카드로 추가했고, 해당 느낌의 프롬프트도 함께 저장했습니다.');
    }

    e.target.value = '';
    if (mode === 'character') {
      if (openStage !== 3) openOnly(3);
      return;
    }
    if (openStage !== 4) openOnly(4);
  };

  const updatePromptTemplate = (templateId: string, patch: Partial<WorkflowPromptTemplate>) => {
    setPromptTemplates((prev) => prev.map((item) => item.id === templateId ? { ...item, ...patch, isCustomized: true, updatedAt: Date.now() } : item));
  };

  const addCustomPromptTemplate = () => {
    const source = selectedPromptTemplate;
    const custom: WorkflowPromptTemplate = {
      id: `custom_prompt_${Date.now()}`,
      name: `${source.name} 복사본`,
      description: '사용자 관리용 커스텀 프롬프트',
      prompt: source.prompt,
      mode: source.mode,
      builtIn: false,
      updatedAt: Date.now(),
    };
    setPromptTemplates((prev) => [...prev, custom]);
    setSelectedPromptTemplateId(custom.id);
    setPromptDetailId(custom.id);
    setEditingPromptId(custom.id);
    setPromptEditorForm({ name: custom.name, description: custom.description, prompt: custom.prompt });
    setNotice('커스텀 프롬프트를 추가했습니다. 팝업에서 세부 문구를 바로 다듬을 수 있습니다.');
  };

  const deleteCustomPromptTemplate = (templateId: string) => {
    const target = syncedPromptTemplates.find((item) => item.id === templateId);
    if (!target || target.builtIn) return;
    setPromptTemplates((prev) => prev.filter((item) => item.id !== templateId));
    setSelectedPromptTemplateId('builtin-core-script');
    setPromptDetailId('builtin-core-script');
    setEditingPromptId(null);
    setNotice('커스텀 프롬프트를 삭제했습니다.');
  };

  const fieldConfigs: Array<{ key: keyof StorySelectionState; label: string; value: string; setter: (value: string) => void }> = [
    { key: 'genre', label: '장르', value: genre, setter: setGenre },
    { key: 'mood', label: '분위기', value: mood, setter: setMood },
    { key: 'endingTone', label: '엔딩 톤', value: endingTone, setter: setEndingTone },
    { key: 'setting', label: '배경', value: setting, setter: setSetting },
    { key: 'protagonist', label: '주인공', value: protagonist, setter: setProtagonist },
    { key: 'conflict', label: '갈등', value: conflict, setter: setConflict },
  ];

  const handleOpenSceneStudioClick = async () => {
    if (!completeStage(4)) {
      scrollStageIntoFocus(stepCompleted[3] ? 4 : 3);
      return;
    }
    setNotice('현재 선택값을 프로젝트에 추가하고 씬 제작 작업 화면으로 이동합니다. 순서는 프롬프트 / 대본 → 출연자 준비 → 출연자 / 화풍 선택 → 씬 제작입니다.');
    try {
      await onOpenSceneStudio?.({
        ...buildDraftPayload(),
        activeStage: 4,
        completedSteps: {
          step1: true,
          step2: true,
          step3: true,
          step4: true,
        },
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setNotice('씬 제작 화면으로 넘기기 전에 비어 있는 항목이 있습니다. 프롬프트 / 대본 → 출연자 준비 → 출연자 / 화풍 선택 순서로 필요한 단계로 자동 이동했습니다.');
      scrollStageIntoFocus(stepCompleted[4] ? 4 : 3);
    }
  };

  const selectedContentLabel = CONTENT_TYPE_CARDS.find((item) => item.id === contentType)?.title || contentType;
  const step1Summary = <><SummaryChip accent="blue">유형 {selectedContentLabel}</SummaryChip><SummaryChip>{aspectRatio}</SummaryChip></>;
  const step2Summary = (
    <>
      <SummaryChip accent="blue">주제 {topic || '미입력'}</SummaryChip>
      <SummaryChip>{genre}</SummaryChip>
      <SummaryChip>{mood}</SummaryChip>
      <SummaryChip>{setting}</SummaryChip>
      <SummaryChip>{protagonist}</SummaryChip>
      <SummaryChip>{conflict}</SummaryChip>
    </>
  );
  const step3Summary = (
    <>
      <SummaryChip accent="violet">프롬프트 {selectedPromptTemplate?.name || '미선택'}</SummaryChip>
      <SummaryChip>{normalizedScript.trim() ? `문단 ${sceneCount}개` : '원문 미입력'}</SummaryChip>
      <SummaryChip>{normalizedScript.trim().length}자</SummaryChip>
    </>
  );
  const step4Summary = (
    <>
      <SummaryChip accent="blue">캐릭터는 Step 3에서 확정</SummaryChip>
      <SummaryChip accent="violet">화풍 {selectedStyle?.label || '미선택'}</SummaryChip>
      <SummaryChip>이미지 모델 {studioState?.routing?.imageModel || IMAGE_MODELS[0].id}</SummaryChip>
    </>
  );

  return (
    <div className="mx-auto my-6 w-full max-w-[1520px] px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-8 text-white md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-blue-100">mp4Creater Flow</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">한 화면에서 Step 1부터 캐릭터 / 화풍 선택까지</h1>
              <p className="mt-4 text-sm leading-7 text-slate-200 md:text-base">
                제작 버튼은 항상 신규 프로젝트로 시작하고, 프로젝트 페이지의 저장 파일을 누르면 씬 제작으로 바로 이어지도록 흐름을 정리했습니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">연결 상태</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className={`rounded-full px-3 py-1.5 ${connectionSummary.text ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-slate-200'}`}>텍스트 AI {connectionSummary.text ? '연결됨' : '임시 추천'}</span>
                  <span className={`rounded-full px-3 py-1.5 ${connectionSummary.audio ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-slate-200'}`}>TTS {connectionSummary.audio ? '연결됨' : '미등록'}</span>
                  <span className={`rounded-full px-3 py-1.5 ${connectionSummary.video ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-slate-200'}`}>영상 {connectionSummary.video ? '연결됨' : '미등록'}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">진행률</div>
                <div className="mt-2 text-2xl font-black">{completion.total}%</div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${completion.total}%` }} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-200">남은 입력 {completion.remaining}% · 선택된 캐릭터 {selectedCharacters.length}명 · 화풍 {selectedStyle ? 1 : 0}개</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-5 md:px-8">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STEP_META.filter((meta) => visibleStepIds.includes(meta.id)).map((meta) => (
              <StepChip
                key={meta.id}
                meta={meta}
                isOpen={openStage === meta.id}
                completed={stageStatus[meta.id]}
                onClick={() => toggleStage(meta.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900 shadow-sm">
          {notice}
        </div>
      )}

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">순서 가이드</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">처음 쓰는 사용자도 길을 잃지 않도록</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Step 1부터 4까지는 아래 순서대로 진행하면 됩니다. 비어 있는 항목이 있으면 씬 제작으로 넘어가기 전에 해당 단계로 다시 안내합니다.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">현재 진행률 {completion.total}%</div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <div className={`rounded-[22px] border p-4 ${stepCompleted[1] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">1단계</div>
            <div className="mt-2 text-base font-black text-slate-900">프롬프트 / 제작 방향 정하기</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">콘텐츠 유형, 화면 비율, 주제와 선택값을 채워 전체 방향을 먼저 고정합니다.</p>
          </div>
          <div className={`rounded-[22px] border p-4 ${stepCompleted[2] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">2단계</div>
            <div className="mt-2 text-base font-black text-slate-900">대본 만들기</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">선택한 프롬프트로 대본 초안을 만들고, 씬 기준이 되는 문단 구조를 정리합니다.</p>
          </div>
          <div className={`rounded-[22px] border p-4 ${stepCompleted[3] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">3단계</div>
            <div className="mt-2 text-base font-black text-slate-900">대본 기준 출연자 준비</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">주인공과 조연 후보를 대본에서 뽑고, 실제 출연자로 쓸 인물을 선택합니다. 현재 {selectedCharacters.length}명 선택됨.</p>
          </div>
          <div className={`rounded-[22px] border p-4 ${stepCompleted[4] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">4단계</div>
            <div className="mt-2 text-base font-black text-slate-900">출연자 / 화풍 확정 후 씬 제작</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">출연자가 비어 있거나 화풍이 선택되지 않으면 프로젝트에 추가되지 않습니다. 현재 화풍 {selectedStyle ? '선택됨' : '미선택'}.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <AccordionSection
          stepId={1}
          title="무엇을 만들지 선택"
          description="유형을 고르면 추천값, 프롬프트 구조, 샘플 대본 형식이 함께 바뀝니다."
          summary={step1Summary}
          open={openStage === 1}
          completed={stageStatus[1]}
          onToggle={() => toggleStage(1)}
          actions={<HelpTip title="첫 단계가 흐름을 바꿉니다">뮤직비디오는 가사 블록 중심, 스토리는 서사 문단 중심, 뉴스는 브리핑 문단 중심으로 다음 단계가 자동 조정됩니다.</HelpTip>}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {CONTENT_TYPE_CARDS.map((card) => {
              const active = contentType === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    const defaults = FIELD_OPTIONS_BY_TYPE[card.id];
                    setContentType(card.id);
                    setTopic(getTopicSuggestion(card.id, ''));
                    setStoryScript('');
                    setGenre(defaults.genre[0]);
                    setMood(defaults.mood[0]);
                    setEndingTone(defaults.endingTone[0]);
                    setSetting(defaults.setting[0]);
                    setProtagonist(defaults.protagonist[0]);
                    setConflict(defaults.conflict[0]);
                    setExtractedCharacters([]);
                    setStyleImages([]);
                    setSelectedCharacterIds([]);
                    setSelectedStyleImageId(null);
                    setCharacterCarouselIndices({});
                    setCharacterLoadingProgress({});
                    setStyleCarouselIndices({});
                    setStyleLoadingProgress({});
                    autoRecommendSignatureRef.current = '';
                    setNotice(card.id === 'music_video' ? '뮤직비디오 모드로 전환했습니다. Step 1 완료 버튼을 누르면 Step 2로 넘어갑니다.' : '콘텐츠 유형을 변경했습니다. Step 1 완료 버튼으로 다음 단계로 진행해 주세요.');
                  }}
                  className={`rounded-[28px] border p-5 text-left transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                >
                  <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 shadow-sm">{card.badge}</div>
                  <div className="mt-4 text-xl font-black text-slate-900">{card.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.desc}</p>
                  <div className="mt-4 text-xs font-bold text-blue-700">선택 완료</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">씬 사이즈</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">생성 비율 선택</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Step 1에서 고른 비율이 추천 카드, 씬 생성, 씬 미리보기까지 그대로 이어집니다.</p>
              </div>
              <SummaryChip accent="blue">현재 {aspectRatio}</SummaryChip>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const active = aspectRatio === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAspectRatio(option.id)}
                    className={`rounded-[24px] border p-4 text-left transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900">{option.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{option.description}</div>
                      </div>
                      <div className={`overflow-hidden rounded-2xl border bg-slate-100 p-2 ${active ? 'border-blue-200' : 'border-slate-200'}`}>
                        <div className={`${getAspectRatioClass(option.id)} w-16 rounded-xl ${active ? 'bg-blue-200/80' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                    <div className="mt-4 text-xs font-bold text-slate-500">{getAspectRatioDescription(option.id)}</div>
                  </button>
                );
              })}
            </div>
          </div>



          <div className="mt-5 flex justify-center pt-8">
            <GuidedActionButton ready={stepCompleted[1]} onClick={() => completeStage(1, 2)}>
              Step 1 완료하고 Step 2로
            </GuidedActionButton>
          </div>
        </AccordionSection>

        {visibleStepIds.includes(2) && (
        <AccordionSection
          stepId={2}
          title="스토리 빌더"
          description="예시로 채우기를 중심으로 빠르게 골격을 만든 뒤, 필요하면 항목별 AI 추천만 보조로 사용합니다."
          summary={step2Summary}
          open={openStage === 2}
          completed={stageStatus[2]}
          onToggle={() => toggleStage(2)}
          actions={(
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openExampleGuide} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                예시로 채우기
              </button>
              <button type="button" onClick={createDraftFromSelections} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                선택값으로 초안 만들기
              </button>
            </div>
          )}
        >
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-sm font-black text-slate-900">콘텐츠 주제</label>
              <button type="button" onClick={() => setTopic(getTopicSuggestion(contentType, topic))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                주제 새로고침
              </button>
            </div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              placeholder="예: 새벽 네온 아래 다시 시작되는 후렴, 막차에서 시작된 반전, 도시 재개발 핵심 브리핑"
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fieldConfigs.map((field) => (
              <div key={field.key} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-black text-slate-900">{field.label}</label>
                  <button type="button" onClick={() => refreshField(field.key)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                    {loadingFields[field.key] ? '삽입 중...' : 'AI 추천'}
                  </button>
                </div>
                <input
                  list={`story-field-${field.key}`}
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
                />
                <datalist id={`story-field-${field.key}`}>
                  {FIELD_OPTIONS_BY_TYPE[contentType][field.key].map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <div className="mt-3 text-xs font-bold text-slate-500">현재 선택: {field.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-center pt-8">
            <GuidedActionButton ready={stepCompleted[2]} disabled={!stepCompleted[2]} onClick={() => completeStage(2, 3)}>
              Step 2 완료하고 Step 3로
            </GuidedActionButton>
          </div>
        </AccordionSection>
        )}

        {visibleStepIds.includes(3) && (
        <AccordionSection
          stepId={3}
          title={contentType === 'music_video' ? '제작 가사 / 뮤비 대본' : '제작 대본'}
          description="프롬프트를 좌우로 넘겨 확인한 뒤 생성하기 버튼으로 바로 대본을 만듭니다. 프롬프트 상세와 높이를 맞춰 같은 눈높이에서 검토할 수 있게 정리했습니다."
          summary={step3Summary}
          open={openStage === 3}
          completed={stageStatus[3]}
          onToggle={() => toggleStage(3)}
          actions={(
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStoryScript(normalizedScript)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                문단 정리
              </button>
              <button type="button" onClick={addCustomPromptTemplate} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                새 프롬프트 추가
              </button>
              <button type="button" onClick={() => setShowPromptPack((prev) => !prev)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                {showPromptPack ? '기본 프롬프트 닫기' : '기본 프롬프트 보기'}
              </button>
            </div>
          )}
        >
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">텍스트 모델</div>
              <div className="mt-2 text-sm font-black text-slate-900">대본 생성 모델</div>
              <select value={selectedScriptModel} onChange={(e) => onUpdateRouting?.({ scriptModel: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400">
                {SCRIPT_MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <p className={`mt-2 text-xs leading-5 ${textModelReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                {textModelReady ? '선택한 프롬프트에서 바로 AI 대본 생성이 가능합니다.' : 'OpenRouter 연결 전에는 안전한 샘플 생성 로직으로 동작합니다.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">원고 현황</div>
              <div className="mt-2 text-sm font-black text-slate-900">현재 입력된 대본</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{sceneCount}문단 · {normalizedScript.trim().length}자</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">프롬프트는 아래 캐러셀에서 넘겨 보고, 생성 버튼으로 바로 반영합니다.</p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Step 3 작업 집중 보기</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">PC에서는 5:5 균형 또는 집중 보기 1:9 비율로 바로 전환됩니다. 작업 중인 영역을 더 크게 보고, 나머지 영역은 좁고 짧게 접어 흐름을 잃지 않게 했습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['balanced', '5:5 균형'],
                ['script-focus', '대본 크게'],
                ['character-focus', '캐릭터 크게'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStep3PanelMode(mode as 'balanced' | 'script-focus' | 'character-focus')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${step3PanelMode === mode ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5 rounded-[24px] border border-violet-200 bg-violet-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">초보자 진행 가이드</div>
                <div className="mt-2 text-sm font-black text-slate-900">지금 해야 할 순서</div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">Step 3 집중 체크</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {step3GuideItems.map((item, index) => (
                <div key={`step3-guide-${index}`} className="rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className={`space-y-5 ${step3PanelMode === 'character-focus' ? 'opacity-70' : ''}`}>
              <div className="flex min-h-[560px] flex-col rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">프롬프트 선택</div>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">좌우로 넘기며 프롬프트 확인</h3>
                  </div>
                  <SummaryChip accent="violet">{activePromptSlide?.name || '미선택'}</SummaryChip>
                </div>

                <div className="mt-5 flex flex-1 flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  {activePromptSlide ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ArrowButton
                            direction="left"
                            disabled={selectedPromptIndex <= 0}
                            onClick={() => {
                              const target = syncedPromptTemplates[Math.max(selectedPromptIndex - 1, 0)];
                              if (target) focusPromptTemplate(target.id);
                            }}
                          />
                          <ArrowButton
                            direction="right"
                            disabled={selectedPromptIndex >= syncedPromptTemplates.length - 1}
                            onClick={() => {
                              const target = syncedPromptTemplates[Math.min(selectedPromptIndex + 1, syncedPromptTemplates.length - 1)];
                              if (target) focusPromptTemplate(target.id);
                            }}
                          />
                          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">{syncedPromptTemplates.length ? `${selectedPromptIndex + 1} / ${syncedPromptTemplates.length}` : '0 / 0'}</span>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${activePromptSlide.mode === 'dialogue' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{activePromptSlide.mode === 'dialogue' ? '대화형' : '기본형'}</span>
                      </div>

                      <div className={`mt-4 rounded-[24px] border p-4 ${activePromptSlide.id === selectedPromptTemplateId ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white'}`}>
                        <div className="text-lg font-black text-slate-900">{activePromptSlide.name}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{activePromptSlide.description}</p>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-6 text-slate-600">{activePromptSlide.prompt}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setPromptPreviewId(activePromptSlide.id)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            프롬프트 보기
                          </button>
                          <button type="button" onClick={() => void generateScriptByPrompt(activePromptSlide.mode === 'dialogue', activePromptSlide)} disabled={isGeneratingScript} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500">
                            {isGeneratingScript && activePromptSlide.id === selectedPromptTemplateId ? '생성 중...' : '이 프롬프트로 생성하기'}
                          </button>
                          <button type="button" onClick={() => openPromptEditor(activePromptSlide.id)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            프롬프트 수정
                          </button>
                          {!activePromptSlide.builtIn && (
                            <button type="button" onClick={() => deleteCustomPromptTemplate(activePromptSlide.id)} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50">
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                      프롬프트가 아직 없습니다. 새 프롬프트를 추가해 주세요.
                    </div>
                  )}
                </div>
              </div>

              <div className={`rounded-[28px] border bg-white p-5 shadow-sm transition-all duration-300 ${step3PanelMode === 'script-focus' ? 'border-blue-300 ring-2 ring-blue-200 lg:sticky lg:top-24' : 'border-blue-100'} ${step3PanelMode === 'character-focus' ? 'max-h-[320px] overflow-hidden' : ''}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">최종 대본</div>
                    <div className="mt-2 text-xl font-black text-slate-900">문단별 씬 기준으로 크게 수정</div>
                  </div>
                  <SummaryChip accent="blue">{sceneCount}문단</SummaryChip>
                </div>

                <div className={`grid gap-4 xl:items-stretch ${step3PanelMode === 'balanced' ? 'lg:grid-cols-2' : step3PanelMode === 'script-focus' ? 'lg:grid-cols-[minmax(0,9fr)_minmax(260px,1fr)]' : 'lg:grid-cols-[minmax(260px,1fr)_minmax(0,9fr)]'}`}>
                  <div>
                    <textarea
                      value={storyScript}
                      onChange={(e) => setStoryScript(e.target.value)}
                      className={`w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition focus:border-blue-400 ${step3PanelMode === 'script-focus' ? 'min-h-[78vh]' : 'min-h-[460px]'}` }
                      placeholder={contentType === 'music_video' ? '[Intro]\n짧은 도입 가사\n\n[Verse 1]\n첫 번째 벌스 가사\n\n[Chorus]\n후렴 가사' : '여기에 최종 대본을 입력하세요. 문단 단위로 나누면 씬 생성에 유리합니다.'}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-white px-3 py-1">블록 / 문단 수 {sceneCount}</span>
                      <span className="rounded-full bg-white px-3 py-1">글자 수 {normalizedScript.trim().length}</span>
                      <span className={`rounded-full px-3 py-1 ${normalizedScript.trim() ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{normalizedScript.trim() ? '원고 준비됨' : '원고 비어 있음'}</span>
                    </div>
                  </div>

                  <div className={`rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition-all duration-300 ${step3PanelMode === 'character-focus' ? 'min-h-[78vh] ring-2 ring-violet-200 lg:sticky lg:top-24' : 'min-h-[460px]'} ${step3PanelMode === 'script-focus' ? 'max-h-[420px] overflow-hidden opacity-75' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">Step 3 출연자 관리</div>
                        <div className="mt-2 text-lg font-black text-slate-900">주인공 / 조연 / 나레이터 카드 제작</div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">화풍 카드와 같은 방식으로 각 출연자마다 이미지 카드 가족을 만들고, 마음에 들 때까지 각자 반복 생성할 수 있게 맞췄습니다. 여기서 선택한 카드가 Step 4와 씬 제작 참조 이미지로 그대로 넘어갑니다.</p>
                      </div>
                      <SummaryChip accent="violet">선택 {selectedCharacters.length}명 / 전체 {extractedCharacters.length}명</SummaryChip>
                    </div>

                    {normalizedScript.trim() ? (
                      <>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void hydrateCharactersForScript({ preserveSelection: true })} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
                            {isExtracting ? '준비 중...' : '대본 기준 출연자 준비'}
                          </button>
                          <button type="button" onClick={() => void hydrateCharactersForScript({ forceSample: true })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            샘플로 테스트
                          </button>
                          <button type="button" onClick={() => characterUploadInputRef.current?.click()} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            캐릭터 업로드
                          </button>
                          <input ref={characterUploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleUpload(e, 'character')} />
                          {!connectionSummary.text && (
                            <button type="button" onClick={() => onOpenApiModal?.({ title: '캐릭터 추출 정확도를 높이려면 텍스트 AI를 연결하세요', description: 'OpenRouter를 연결하면 대본에서 인물과 역할을 더 정확하게 추출합니다. 연결 전에는 샘플 카드로 전체 흐름을 확인할 수 있습니다.', focusField: 'openRouter' })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                              API 연결
                            </button>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 lg:grid-cols-[0.75fr_1.25fr_auto]">
                          <input value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)} placeholder="신규 출연자 이름" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" />
                          <textarea value={newCharacterPrompt} onChange={(e) => setNewCharacterPrompt(e.target.value)} placeholder="프롬프트로 신규 출연자 생성. 비워두면 현재 대본과 설정으로 자동 작성합니다." className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400" />
                          <div className="flex items-center justify-center">
                            <button type="button" onClick={createNewCharacterByPrompt} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">출연자 추가</button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="text-xs font-bold text-slate-500">지금은 {step3PanelMode === 'character-focus' ? '캐릭터 집중 보기 9칸 / 대본 1칸' : step3PanelMode === 'script-focus' ? '대본 집중 보기 9칸 / 캐릭터 1칸' : '5:5 균형'} 모드입니다. PC에서는 좌우 비율이 즉시 바뀌고, 카드 영역은 화면 밖으로 새지 않게 숨겼습니다.</div>
                          <div className="flex items-center gap-2">
                            <ArrowButton direction="left" disabled={!extractedCharacters.length} onClick={() => scrollContainerBy(characterStripRef.current, 'left', 360)} />
                            <ArrowButton direction="right" disabled={!extractedCharacters.length} onClick={() => scrollContainerBy(characterStripRef.current, 'right', 360)} />
                          </div>
                        </div>

                        <div className="relative mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/60 p-2">
                          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent" />
                          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent" />
                          <div ref={characterStripRef} onWheel={(event) => handleHorizontalWheel(event, 0.9)} className="flex snap-x snap-mandatory gap-3 overflow-x-hidden scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {extractedCharacters.length ? extractedCharacters.map((character, characterIndex) => {
                            const slides = character.generatedImages || [];
                            const loadingProgress = characterLoadingProgress[character.id];
                            const slideCount = slides.length + (loadingProgress !== undefined ? 1 : 0);
                            const activeIndex = Math.min(Math.max(characterCarouselIndices[character.id] || 0, 0), Math.max(slideCount - 1, 0));
                            const currentRealSlide = activeIndex < slides.length ? slides[activeIndex] : null;
                            const active = selectedCharacterIds.includes(character.id);
                            const currentPrompt = character.prompt || currentRealSlide?.prompt || '';
                            return (
                              <div key={`step3-character-${character.id}`} data-character-card-id={character.id} className={`shrink-0 snap-start rounded-[24px] border p-3 shadow-sm transition-all duration-300 ${step3PanelMode === 'character-focus' ? 'w-[min(84vw,460px)]' : step3PanelMode === 'balanced' ? 'w-[min(44vw,340px)]' : 'w-[min(26vw,290px)]'} ${active ? 'border-violet-300 bg-violet-50/60 ring-2 ring-violet-100' : 'border-slate-200 bg-white'}`}>
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                  <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
                                    {slides.map((image) => (
                                      <button key={image.id} type="button" onClick={() => chooseCharacterImage(character.id, image)} className="w-full shrink-0 text-left">
                                        <img src={image.imageData || '/mp4Creater/flow-character.svg'} alt={image.label} className="aspect-square w-full object-cover" />
                                      </button>
                                    ))}
                                    {loadingProgress !== undefined && (
                                      <div className="w-full shrink-0 p-3">
                                        <div className="aspect-square">
                                          <LoadingSlide progress={loadingProgress} label={`${character.name} 새 캐릭터 준비`} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <ArrowButton direction="left" disabled={activeIndex <= 0} onClick={() => setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: Math.max((prev[character.id] || 0) - 1, 0) }))} />
                                    <ArrowButton direction="right" disabled={activeIndex >= Math.max(slideCount - 1, 0)} onClick={() => setCharacterCarouselIndices((prev) => ({ ...prev, [character.id]: Math.min((prev[character.id] || 0) + 1, Math.max(slideCount - 1, 0)) }))} />
                                  </div>
                                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500">{slideCount ? `${Math.min(activeIndex + 1, slideCount)} / ${slideCount}` : '1 / 1'}</span>
                                </div>

                                <div className="mt-3 flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{currentRealSlide?.sourceMode === 'upload' ? '업로드 출연자 카드' : currentRealSlide?.sourceMode === 'sample' ? '샘플 출연자 카드' : 'AI 추천 출연자 유사안'}</div>
                                  </div>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{active ? '선택' : '대기'}</span>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <input value={character.name} onChange={(e) => updateCharacterName(character.id, e.target.value)} placeholder="출연자 이름" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-900 outline-none focus:border-violet-400" />
                                  <input value={character.roleLabel || ''} onChange={(e) => updateCharacterRoleLabel(character.id, e.target.value)} placeholder="역할 설명" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 outline-none focus:border-violet-400" />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {([['lead', '주인공'], ['support', '조연'], ['narrator', '나레이터']] as const).map(([roleValue, roleLabel]) => (
                                    <button
                                      key={`${character.id}-${roleValue}`}
                                      type="button"
                                      onClick={() => updateCharacterRole(character.id, roleValue)}
                                      className={`rounded-full px-3 py-1.5 text-[11px] font-black ${character.role === roleValue ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                      {roleLabel}
                                    </button>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {currentRealSlide && (
                                    <button type="button" onClick={() => chooseCharacterImage(character.id, currentRealSlide)} className={`rounded-xl px-3 py-2 text-xs font-black ${active && currentRealSlide.id === character.selectedImageId ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                                      {active && currentRealSlide.id === character.selectedImageId ? '이 카드 사용 중' : '이 카드 선택'}
                                    </button>
                                  )}
                                  <button type="button" onClick={() => toggleCharacterSelection(character.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                                    {active ? '출연자 선택 해제' : '출연자로 선택'}
                                  </button>
                                  <button type="button" disabled={loadingProgress !== undefined} onClick={() => void createCharacterVariants(character)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">
                                    {loadingProgress !== undefined ? '생성 중...' : '추천 +1'}
                                  </button>
                                  <button type="button" onClick={() => setExpandedCharacterEditorId(expandedCharacterEditorId === character.id ? null : character.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                                    {expandedCharacterEditorId === character.id ? '고급 닫기' : '고급'}
                                  </button>
                                  <button type="button" onClick={() => removeCharacter(character.id)} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                                    제거
                                  </button>
                                </div>

                                {expandedCharacterEditorId === character.id && (
                                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <textarea value={currentPrompt} onChange={(e) => updateCharacterPrompt(character.id, e.target.value)} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-700 outline-none focus:border-violet-400" />
                                  </div>
                                )}

                                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
                                  출연 순서 {character.castOrder || characterIndex + 1} · 선택한 카드의 이미지와 프롬프트가 Step 4 / 씬 제작 참조로 이어집니다.
                                </div>
                              </div>
                            );
                          }) : (
                            <div className="w-full rounded-[22px] border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-500">
                              대본을 만든 뒤 위 버튼을 누르면 주인공과 조연 후보가 여기에 채워집니다. 직접 추가, 업로드, 반복 생성으로 전체 출연진을 이 자리에서 바로 관리할 수 있습니다.
                            </div>
                          )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                        최종 대본이 준비되면 이 자리에서 전체 출연자 카드 제작과 선택 컴포넌트가 열립니다. 먼저 왼쪽 대본을 입력하거나 생성해 주세요.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <GuidedActionButton tone="violet" ready={stepCompleted[3]} disabled={!stepCompleted[3]} onClick={() => completeStage(3, 4)}>
                  Step 3 완료하고 Step 4로
                </GuidedActionButton>
              </div>
            </div>

            {showPromptPack && (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">기본 프롬프트 팩</div>
                    <div className="mt-2 text-lg font-black text-slate-900">팝업으로 보지 않아도 되는 기본 프롬프트 묶음</div>
                  </div>
                  {promptDetailTemplate && (
                    <button type="button" onClick={() => setPromptPreviewId(promptDetailTemplate.id)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      현재 선택 프롬프트 크게 보기
                    </button>
                  )}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {[
                    ['스토리 프롬프트', promptPack.storyPrompt],
                    ['가사 / 메타 프롬프트', promptPack.lyricsPrompt],
                    ['캐릭터 추출 프롬프트', promptPack.characterPrompt],
                    ['씬 이미지 프롬프트', promptPack.scenePrompt],
                    ['행동 프롬프트', promptPack.actionPrompt],
                    ['설득 10원칙 적용 프롬프트', promptPack.persuasionStoryPrompt],
                  ].map(([title, value]) => (
                    <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-black text-slate-900">{title}</div>
                      <textarea readOnly value={String(value)} className="mt-3 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-700 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}
        </AccordionSection>
        )}

        {visibleStepIds.includes(4) && (
        <AccordionSection
          stepId={4}
          title="화풍 선택과 씬 제작 이동"
          description="캐릭터 선택은 Step 3에서 끝내고, 여기서는 화풍만 고른 뒤 바로 씬 제작 작업 화면으로 이동합니다. 선택한 스타일 프롬프트가 그대로 프로젝트 씬 생성에 반영됩니다."
          summary={step4Summary}
          open={openStage === 4}
          completed={stageStatus[4]}
          onToggle={() => toggleStage(4)}
          actions={(
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpenApiModal?.({ title: '지금 필요한 API 키 등록', description: '현재 단계에서 가장 바로 체감되는 건 OpenRouter입니다. 연결하면 캐릭터 추천과 화풍 추천, 대본 생성 품질이 즉시 올라갑니다.', focusField: 'openRouter' })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                API 빠른 등록
              </button>
              <button type="button" onClick={() => void ensureStyleRecommendations('manual')} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">
                {isExtracting ? '추천 생성 중...' : '화풍 추천 1개 추가'}
              </button>
              <button type="button" onClick={onOpenSettings} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                설정 / 모델 / 폴더
              </button>
            </div>
          )}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-900">이미지 모델</div>
              <select value={studioState?.routing?.imageModel || IMAGE_MODELS[0].id} onChange={(e) => onUpdateRouting?.({ imageModel: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400">
                {IMAGE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <p className={`mt-2 text-xs leading-5 ${imageModelReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                {imageModelReady ? '선택한 캐릭터와 화풍 프롬프트를 기준으로 이미지 생성에 반영됩니다.' : '모델 연결 전에도 샘플 카드로 흐름 검증이 가능합니다.'}
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-900">Step 3 확정 캐릭터</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedCharacters.length}명 · 여기서는 선택을 바꾸지 않고 요약만 보여 줍니다.</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-900">선택된 화풍</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedStyle ? '1개 준비됨' : '선택 필요'}</p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">캐릭터 연결 확인</div>
                  <h3 className="mt-2 text-xl font-black text-slate-900">씬 이미지에 반영될 출연자 카드</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Step 3에서 확정한 캐릭터의 현재 선택 이미지와 프롬프트가 Step 4 이후 씬 이미지 프롬프트에 그대로 묶여 들어갑니다. 마음에 들지 않으면 Step 3에서 추천 +1로 계속 다시 뽑을 수 있습니다.</p>
                </div>
                <button type="button" onClick={() => openStageWithIntent(3)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Step 3 다시 열기
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">확인용으로만 작게 보여 줍니다. 한 줄에 5개 기준으로 보고, 아래로 길어지지 않게 좌우 버튼으로만 이동합니다.</div>
                <div className="flex items-center gap-2">
                  <ArrowButton direction="left" disabled={!selectedCharacters.length} onClick={() => scrollContainerBy(step4CharacterStripRef.current, 'left', 320)} />
                  <ArrowButton direction="right" disabled={!selectedCharacters.length} onClick={() => scrollContainerBy(step4CharacterStripRef.current, 'right', 320)} />
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white via-white/90 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white via-white/90 to-transparent" />
                <div ref={step4CharacterStripRef} onWheel={(event) => handleHorizontalWheel(event, 0.9)} className="flex snap-x snap-mandatory gap-3 overflow-x-hidden scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {selectedCharacters.map((character) => {
                    const selectedImage = (character.generatedImages || []).find((image) => image.id === character.selectedImageId) || character.generatedImages?.[0] || null;
                    return (
                      <div key={`step4-character-${character.id}`} data-step4-character-id={character.id} className="w-[min(19vw,212px)] min-w-[168px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3 p-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
                            {selectedImage?.imageData ? (
                              <img src={selectedImage.imageData} alt={character.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-500">없음</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : character.role === 'narrator' ? '나레이터' : '조연')}</div>
                            <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{selectedImage?.prompt || character.prompt || character.description || '선택 프롬프트 없음'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!selectedCharacters.length && (
                    <div className="w-full rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
                      아직 선택된 출연자가 없습니다. Step 3에서 주인공, 조연, 나레이터를 추가하고 대표 이미지를 고른 뒤 다시 오면 씬 프롬프트에 연결됩니다.
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">화풍 박스</div>
                  <h3 className="mt-2 text-xl font-black text-slate-900">스타일 카드</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">각 화풍은 하나의 카드 가족으로 관리하고, 추천 버튼을 누르면 그 카드 안에 유사한 화풍 변형이 계속 쌓이도록 캐릭터 박스와 같은 로직으로 맞췄습니다.</p>
                </div>
                <SummaryChip accent="violet">{selectedStyle?.groupLabel || selectedStyle?.label || '선택 필요'}</SummaryChip>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">선택된 화풍 카드의 현재 슬라이드 프롬프트가 씬 전체 스타일 프롬프트로 그대로 연결됩니다.</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => styleUploadInputRef.current?.click()} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">화풍 업로드</button>
                  <input ref={styleUploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleUpload(e, 'style')} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
                <input value={newStyleName} onChange={(e) => setNewStyleName(e.target.value)} placeholder="신규 화풍 이름" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" />
                <textarea value={newStylePrompt} onChange={(e) => setNewStylePrompt(e.target.value)} placeholder="프롬프트로 신규 화풍 생성. 비워두면 현재 스토리 느낌으로 자동 작성합니다." className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400" />
                <div className="flex items-center justify-center">
                  <button type="button" onClick={createNewStyleByPrompt} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">신규 화풍 생성</button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">카드 줄은 화면 안에서만 이동하도록 숨김 처리했고, 바깥 화살표로 카드 가족을 넘길 수 있습니다. 카드 안쪽 화살표는 같은 화풍의 유사안을 이동합니다.</div>
                <div className="flex items-center gap-2">
                  <ArrowButton direction="left" disabled={!styleGroups.length} onClick={() => scrollContainerBy(styleStripRef.current, 'left', 360)} />
                  <ArrowButton direction="right" disabled={!styleGroups.length} onClick={() => scrollContainerBy(styleStripRef.current, 'right', 360)} />
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/60 p-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent" />
                <div ref={styleStripRef} onWheel={(event) => handleHorizontalWheel(event, 0.9)} className="flex snap-x snap-mandatory gap-3 overflow-x-hidden scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {styleGroups.map((group) => {
                  const slides = group.items;
                  const loadingProgress = styleLoadingProgress[group.id];
                  const slideCount = slides.length + (loadingProgress !== undefined ? 1 : 0);
                  const activeIndex = Math.min(Math.max(styleCarouselIndices[group.id] || 0, 0), Math.max(slideCount - 1, 0));
                  const currentRealSlide = activeIndex < slides.length ? slides[activeIndex] : null;
                  const selected = group.items.some((item) => item.id === selectedStyleImageId);
                  const groupTitle = group.label || currentRealSlide?.label || '화풍';
                  return (
                    <div key={group.id} data-style-group-id={group.id} className={`w-[min(82vw,328px)] shrink-0 snap-start rounded-[20px] border p-3 shadow-sm transition-all duration-300 ${selected ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white'}`}>
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
                          {slides.map((styleCard) => (
                            <button key={styleCard.id} type="button" onClick={() => setSelectedStyleImageId(styleCard.id)} className="w-full shrink-0 text-left">
                              <img src={styleCard.imageData || '/mp4Creater/flow-render.svg'} alt={styleCard.label} className="aspect-square w-full object-cover" />
                            </button>
                          ))}
                          {loadingProgress !== undefined && (
                            <div className="w-full shrink-0 p-3">
                              <div className="aspect-square">
                                <LoadingSlide progress={loadingProgress} label={`${groupTitle} 새 화풍 준비`} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ArrowButton direction="left" disabled={activeIndex <= 0} onClick={() => setStyleCarouselIndices((prev) => ({ ...prev, [group.id]: Math.max((prev[group.id] || 0) - 1, 0) }))} />
                          <ArrowButton direction="right" disabled={activeIndex >= Math.max(slideCount - 1, 0)} onClick={() => setStyleCarouselIndices((prev) => ({ ...prev, [group.id]: Math.min((prev[group.id] || 0) + 1, Math.max(slideCount - 1, 0)) }))} />
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500">{slideCount ? `${Math.min(activeIndex + 1, slideCount)} / ${slideCount}` : '1 / 1'}</span>
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">{groupTitle}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{currentRealSlide?.sourceMode === 'upload' ? '업로드 화풍 기반' : currentRealSlide?.sourceMode === 'sample' ? '샘플 화풍' : 'AI 추천 화풍 유사안'}</div>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? '선택' : '대기'}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentRealSlide && (
                          <button type="button" onClick={() => setSelectedStyleImageId(currentRealSlide.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${selected && currentRealSlide.id === selectedStyleImageId ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                            {selected && currentRealSlide.id === selectedStyleImageId ? '선택됨' : '이 화풍 선택'}
                          </button>
                        )}
                        <button type="button" disabled={loadingProgress !== undefined || !currentRealSlide} onClick={() => currentRealSlide && void createStyleVariants(currentRealSlide)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">
                          {loadingProgress !== undefined ? '생성 중...' : '추천 +1'}
                        </button>
                        {currentRealSlide && (
                          <button type="button" onClick={() => setExpandedStyleEditorId(expandedStyleEditorId === currentRealSlide.id ? null : currentRealSlide.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            {expandedStyleEditorId === currentRealSlide.id ? '고급 닫기' : '고급'}
                          </button>
                        )}
                      </div>

                      {currentRealSlide && expandedStyleEditorId === currentRealSlide.id && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <textarea value={currentRealSlide.prompt} onChange={(e) => updateStylePrompt(currentRealSlide.id, e.target.value)} className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-700 outline-none focus:border-violet-400" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!styleGroups.length && (
                  <div className="w-full rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
                    Step 3 대본과 선택 프롬프트를 준비한 뒤 추천 생성 버튼을 누르면 화풍 카드가 채워집니다. 업로드한 이미지에서도 바로 화풍 프롬프트를 저장할 수 있습니다.
                  </div>
                )}
                </div>
              </div>
            </section>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">다음 단계</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">씬 제작 시작</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Step 4를 마치면 현재 선택값을 프로젝트에 자동 추가하고, 바로 프로젝트 기준 씬 제작 화면으로 이동합니다.</p>
              <div className="mt-4 flex justify-center pt-8">
                <GuidedActionButton ready={stepCompleted[4]} disabled={!stepCompleted[4]} onClick={() => void handleOpenSceneStudioClick()} className="px-6 py-4 text-base">
                  Step 4 완료 후 프로젝트에 추가하고 씬 제작 열기
                </GuidedActionButton>
              </div>
            </div>
          </div>
        </AccordionSection>
        )}
      </div>

      {/* 샘플 안내와 프롬프트 수정은 본문을 밀어내지 않도록 팝업으로 처리합니다. */}
      <OverlayModal
        open={sampleGuideOpen}
        title="예시는 현재 샘플 데이터로 동작합니다"
        description="지금은 API 연결이 없어 정해진 예시만 채워집니다. 아래에서 OpenRouter를 바로 등록하거나, 샘플로 즉시 계속 진행할 수 있습니다."
        onClose={() => setSampleGuideOpen(false)}
        footer={(
          <>
            <button type="button" onClick={() => setSampleGuideOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
            <button
              type="button"
              onClick={() => {
                setSampleGuideOpen(false);
                onOpenApiModal?.({
                  title: '지금 바로 필요한 OpenRouter 키 등록',
                  description: '텍스트 생성, 스토리 추천, 캐릭터 / 화풍 추천 품질을 한 번에 올리는 가장 빠른 연결입니다.',
                  focusField: 'openRouter',
                });
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              OpenRouter 등록
            </button>
            <button
              type="button"
              onClick={() => {
                fillSample();
                setSampleGuideOpen(false);
              }}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500"
            >
              샘플로 계속 진행
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-900">현재 동작 방식</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">연결 전에는 장르, 분위기, 배경, 대본 예시가 미리 준비된 안전한 샘플 데이터로 채워집니다.</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-900">키를 등록하면 바뀌는 점</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">선택한 프롬프트 기준 실제 AI 대본 생성과 더 자연스러운 추천 문구를 바로 사용할 수 있습니다.</p>
          </div>
        </div>
      </OverlayModal>

      <OverlayModal
        open={Boolean(promptPreviewId && syncedPromptTemplates.some((item) => item.id === promptPreviewId))}
        title={syncedPromptTemplates.find((item) => item.id === promptPreviewId)?.name || '프롬프트 보기'}
        description={syncedPromptTemplates.find((item) => item.id === promptPreviewId)?.description || '선택한 프롬프트 본문을 팝업에서 크게 확인합니다.'}
        onClose={() => setPromptPreviewId(null)}
        footer={(
          <>
            {promptPreviewId && (
              <button type="button" onClick={() => { const target = syncedPromptTemplates.find((item) => item.id === promptPreviewId); if (target) openPromptEditor(target.id); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                이 프롬프트 수정
              </button>
            )}
            <button type="button" onClick={() => setPromptPreviewId(null)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">
              닫기
            </button>
          </>
        )}
      >
        <textarea
          readOnly
          value={syncedPromptTemplates.find((item) => item.id === promptPreviewId)?.prompt || ''}
          className="min-h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 outline-none"
        />
      </OverlayModal>

      <OverlayModal
        open={Boolean(editingPromptId)}
        title="프롬프트 수정"
        description="이 팝업에서 이름, 설명, 본문 프롬프트를 수정하면 선택한 템플릿에 바로 저장됩니다."
        onClose={() => setEditingPromptId(null)}
        footer={(
          <>
            <button type="button" onClick={() => setEditingPromptId(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">취소</button>
            <button type="button" onClick={savePromptEditor} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">수정 저장</button>
          </>
        )}
      >
        <div className="space-y-4">
          <input value={promptEditorForm.name} onChange={(e) => setPromptEditorForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-violet-400" placeholder="프롬프트 이름" />
          <input value={promptEditorForm.description} onChange={(e) => setPromptEditorForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400" placeholder="짧은 설명" />
          <textarea value={promptEditorForm.prompt} onChange={(e) => setPromptEditorForm((prev) => ({ ...prev, prompt: e.target.value }))} className="min-h-[360px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-violet-400" placeholder="프롬프트 본문" />
        </div>
      </OverlayModal>

      {isProcessing && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 w-[300px] rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">진행 중</div>
              <div className="mt-1 text-lg font-black text-slate-900">현재 생성 작업이 실행 중입니다</div>
            </div>
            <div className="text-2xl">🎬</div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">작업 중에도 Step 카드 구조와 저장 상태는 유지됩니다.</p>
        </div>
      )}
    </div>
  );
};

export default InputSection;
