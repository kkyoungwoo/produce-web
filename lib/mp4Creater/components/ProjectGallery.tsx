'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SavedProject } from '../types';
import { formatKRW } from '../config';
import { rememberProjectNavigationProject } from '../services/projectNavigationCache';

interface ProjectGalleryProps {
  projects: SavedProject[];
  isLoading?: boolean;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicateProject?: (id: string) => void | Promise<void>;
  onRenameProject?: (id: string, name: string) => void | Promise<void>;
  onLoad: (project: SavedProject) => void;
  basePath: string;
  onCreateNewProject?: (name: string) => void | Promise<void>;
}

const getProjectSettings = (project: SavedProject) => ({
  imageModel: project?.settings?.imageModel || '',
  elevenLabsModel: project?.settings?.elevenLabsModel || 'unknown',
  fluxStyle: project?.settings?.fluxStyle || '',
});

const resolveImageSrc = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/jpeg;base64,${value}`;
};

const resolveProjectCardThumbnail = (project: SavedProject) => {
  const history = Array.isArray(project.thumbnailHistory) ? project.thumbnailHistory : [];
  const latestGeneratedThumbnail = [...history].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (latestGeneratedThumbnail?.imageData) return latestGeneratedThumbnail.imageData;

  const firstSceneImage = project.assets?.find((asset) => asset.imageData)?.imageData;
  if (firstSceneImage) return firstSceneImage;

  return project.thumbnail || '';
};

const getSeededHue = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return Math.abs(hash);
};

const resolveThumbnailBackground = (project: SavedProject) => {
  const hue = getSeededHue(project.id || project.name || 'project');
  const secondaryHue = (hue + 46) % 360;
  return `linear-gradient(135deg, hsl(${hue} 78% 86%), hsl(${secondaryHue} 70% 74%))`;
};

const getNextAutoProjectName = (projects: SavedProject[]) => {
  const usedNumbers = new Set(
    projects
      .map((project) => {
        const match = (project.name || '').match(/^프로젝트\((\d+)\)$/);
        return match ? Number(match[1]) : null;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value))
  );

  let next = 1;
  while (usedNumbers.has(next)) next += 1;
  return `프로젝트(${next})`;
};

const HANGUL_NAME_REGEX = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

const getProjectNameLimit = (value: string) => (HANGUL_NAME_REGEX.test(value) ? 30 : 50);

const clampProjectName = (value: string) => value.slice(0, getProjectNameLimit(value));

const getCompletedMinutesLabel = (project: SavedProject) => {
  const assets = Array.isArray(project.assets) ? project.assets : [];
  if (!assets.length) return null;
  const isCompleted = assets.every((asset) => Boolean(asset.imageData) && (Boolean(asset.audioData) || Boolean(asset.videoData)));
  if (!isCompleted) return null;
  const totalSeconds = assets.reduce((sum, asset) => sum + (asset.targetDuration || asset.audioDuration || asset.videoDuration || 0), 0);
  if (!totalSeconds) return null;
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes}분`;
};

const resolveLastWorkedStep = (project: SavedProject): 1 | 2 | 3 | 4 | 5 => {
  const draft = project.workflowDraft;
  if (!draft) return 1;
  const completed = draft.completedSteps || { step1: false, step2: false, step3: false, step4: false, step5: false };

  if (completed.step5 || (draft.activeStage || 0) >= 5) return 5;
  if (completed.step4 || (draft.activeStage || 0) >= 4) return 4;
  if (completed.step3 || (draft.activeStage || 0) >= 3) return 3;
  if (completed.step2 || (draft.activeStage || 0) >= 2) return 2;
  return 1;
};

const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  projects,
  isLoading = false,
  onDelete,
  onDuplicateProject,
  onRenameProject,
  onLoad,
  basePath,
  onCreateNewProject,
}) => {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [nameModal, setNameModal] = useState<{ mode: 'create' | 'rename'; project: SavedProject | null } | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [isSubmittingNameModal, setIsSubmittingNameModal] = useState(false);
  const [isGalleryIntroVisible, setIsGalleryIntroVisible] = useState(false);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const prevProjectIdsRef = useRef<string[]>([]);
  const hasListInitializedRef = useRef(false);
  const [entryAnimationIds, setEntryAnimationIds] = useState<Record<string, boolean>>({});
  const [deletingProjectIds, setDeletingProjectIds] = useState<Record<string, boolean>>({});
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showDuplicateInProgressModal, setShowDuplicateInProgressModal] = useState(false);
  const CARD_HEIGHT = 'h-[230px]';
  const CARD_WIDTH = 'w-[212px]';
  const SKELETON_COUNT = 3;
  const CARDS_PER_ROW = 4;
  const ROW_BATCH = 3;
  const INITIAL_VISIBLE_PROJECTS = CARDS_PER_ROW * ROW_BATCH - 1;
  const PROJECT_BATCH_SIZE = CARDS_PER_ROW * ROW_BATCH;

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [projects]
  );
  const [visibleProjectCount, setVisibleProjectCount] = useState(INITIAL_VISIBLE_PROJECTS);
  const visibleProjects = useMemo(
    () => sortedProjects.slice(0, visibleProjectCount),
    [sortedProjects, visibleProjectCount]
  );
  const hasMoreProjects = visibleProjectCount < sortedProjects.length;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsGalleryIntroVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const currentIds = sortedProjects.map((project) => project.id);
    const previousIds = prevProjectIdsRef.current;

    if (!hasListInitializedRef.current) {
      hasListInitializedRef.current = true;
      prevProjectIdsRef.current = currentIds;
      return;
    }

    const addedIds = currentIds.filter((id) => !previousIds.includes(id));
    if (addedIds.length) {
      setEntryAnimationIds((prev) => {
        const next = { ...prev };
        addedIds.forEach((id) => { next[id] = true; });
        return next;
      });
      window.requestAnimationFrame(() => {
        setEntryAnimationIds((prev) => {
          const next = { ...prev };
          addedIds.forEach((id) => { delete next[id]; });
          return next;
        });
      });
    }

    prevProjectIdsRef.current = currentIds;
  }, [sortedProjects]);

  useEffect(() => {
    if (isLoading || !hasMoreProjects) return;
    const target = loadMoreTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisibleProjectCount((prev) => Math.min(sortedProjects.length, prev + PROJECT_BATCH_SIZE));
      },
      { root: null, rootMargin: '280px 0px', threshold: 0.01 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreProjects, isLoading, sortedProjects.length, PROJECT_BATCH_SIZE]);

  const hasEmptyState = !isLoading && sortedProjects.length === 0;
  const totalCardsForLayout = 1 + (isLoading ? Math.max(SKELETON_COUNT, sortedProjects.length) : visibleProjects.length);
  const shouldLiftLayout = totalCardsForLayout > 4;
  const isInteractionLocked = isCreatingProject;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  };

  const openProjectScene = (project: SavedProject) => {
    if (isInteractionLocked) return;
    rememberProjectNavigationProject(project);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    const targetStep = resolveLastWorkedStep(project);
    router.replace(`${basePath}/step-${targetStep}?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
  };

  const openCreateProject = () => {
    if (isInteractionLocked) return;
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    setPendingName(getNextAutoProjectName(sortedProjects));
    setNameModal({ mode: 'create', project: null });
  };

  const openRenameModal = (project: SavedProject) => {
    if (isInteractionLocked) return;
    setPendingName(project.name || '');
    setNameModal({ mode: 'rename', project });
  };

  const submitNameModal = async () => {
    if (!nameModal) return;
    if (isSubmittingNameModal) return;
    const trimmed = pendingName.trim();
    if (!trimmed) return;
    const maxLength = getProjectNameLimit(trimmed);
    if (trimmed.length > maxLength) {
      window.alert(HANGUL_NAME_REGEX.test(trimmed) ? '프로젝트 이름은 한글 기준 공백 포함 30자까지 입력할 수 있습니다.' : '프로젝트 이름은 영어 기준 공백 포함 50자까지 입력할 수 있습니다.');
      return;
    }

    if (nameModal.mode === 'create') {
      setIsSubmittingNameModal(true);
      setIsCreatingProject(true);
      try {
        setNameModal(null);
        if (onCreateNewProject) {
          await onCreateNewProject(trimmed);
        } else {
          router.replace(`${basePath}?new=${Date.now()}`, { scroll: false });
        }
      } catch (error) {
        console.error('[ProjectGallery] create project failed', error);
      } finally {
        setIsCreatingProject(false);
        setIsSubmittingNameModal(false);
      }
      return;
    }

    setIsSubmittingNameModal(true);
    if (nameModal.project && onRenameProject) {
      await onRenameProject(nameModal.project.id, trimmed);
    }
    setNameModal(null);
    setIsSubmittingNameModal(false);
  };

  const handleDelete = async (project: SavedProject) => {
    if (isInteractionLocked) return;
    const confirmed = window.confirm(`"${project.name}" 프로젝트를 삭제할까요?\n삭제 후에는 프로젝트 목록에서 제거됩니다.`);
    if (!confirmed) return;
    setDeletingProjectIds((prev) => ({ ...prev, [project.id]: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    await onDelete(project.id);
    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
    }
    setDeletingProjectIds((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const handleDuplicate = async (project: SavedProject) => {
    if (isInteractionLocked) return;
    if (!onDuplicateProject) return;
    if (duplicatingProjectId) {
      setShowDuplicateInProgressModal(true);
      return;
    }
    setDuplicatingProjectId(project.id);
    try {
      await onDuplicateProject(project.id);
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  if (selectedProject) {
    const assets = Array.isArray(selectedProject.assets) ? selectedProject.assets : [];
    const settings = getProjectSettings(selectedProject);

    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setSelectedProject(null)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </button>

          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">프로젝트 상세</div>
            <div className="flex items-center justify-center gap-2">
              {selectedProject.projectNumber && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">프로젝트 #{selectedProject.projectNumber}</span>}
              <h2 className="text-2xl font-black text-slate-900">{selectedProject.name}</h2>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onLoad(selectedProject)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              메인에서 열기
            </button>
            <button
              onClick={() => openProjectScene(selectedProject)}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-500"
            >
              씬 제작으로 이동
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-2">{formatDate(selectedProject.createdAt)}</span>
            {selectedProject.folderName && <span className="rounded-full bg-slate-100 px-3 py-2">폴더 {selectedProject.folderName}</span>}
            <span className="rounded-full bg-slate-100 px-3 py-2">이미지 모델 {settings.imageModel || '기본값'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">음성 모델 {settings.elevenLabsModel}</span>
            {settings.fluxStyle && <span className="rounded-full bg-slate-100 px-3 py-2">스타일 {settings.fluxStyle}</span>}
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">이미지 {assets.filter((a) => a.imageData).length}/{assets.length}</span>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">오디오 {assets.filter((a) => a.audioData).length}/{assets.length}</span>
          </div>

          {selectedProject.cost && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <div className="flex flex-wrap gap-3">
                <span>이미지 {selectedProject.cost.imageCount}개 {formatKRW(selectedProject.cost.images)}</span>
                <span>TTS {selectedProject.cost.ttsCharacters}자 {formatKRW(selectedProject.cost.tts)}</span>
                {selectedProject.cost.videoCount > 0 && <span>영상 {selectedProject.cost.videoCount}개 {formatKRW(selectedProject.cost.videos)}</span>}
                <span className="font-black text-slate-900">총 {formatKRW(selectedProject.cost.total)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5">
          {assets.map((asset, index) => {
            const imageSrc = resolveImageSrc(asset.imageData) || '/mp4Creater/flow-character.svg';
            return (
              <div key={`${asset.sceneNumber}-${index}`} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img src={imageSrc} alt={`Scene ${asset.sceneNumber}`} className="aspect-video w-full object-cover" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">씬 {asset.sceneNumber}</span>
                      {asset.audioData && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">오디오 있음</span>}
                      {asset.subtitleData && <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">자막 있음</span>}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-sm font-black text-slate-900">내레이션</h4>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{asset.narration}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-sm font-black text-slate-900">비주얼 프롬프트</h4>
                      <p className="mt-2 text-xs leading-6 text-slate-600">{asset.visualPrompt}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 py-1">
      <div className={`flex min-h-[max(80px,calc(100dvh-420px))] flex-col items-center ${shouldLiftLayout ? 'justify-start' : 'justify-center'}`}>
        <div
          className={`w-full transition-all duration-500 ease-out ${
            shouldLiftLayout
              ? (isGalleryIntroVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0')
              : (isGalleryIntroVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')
          } ${shouldLiftLayout ? 'pt-[77px]' : 'pt-[max(0px,calc(50dvh-307px))]'}`}
        >
        <div className="mb-3 flex flex-col items-center justify-center gap-1 text-center">
          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">보관함</div>
            <h2 className="mt-1.5 text-xl font-black text-slate-900">저장된 프로젝트</h2>
            <p className="mt-1.5 text-[11px] text-slate-500">각 프로젝트는 번호별 폴더로 저장됩니다. 예: projects/project-0001-...</p>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[902px] flex-wrap justify-center gap-[18px]">
        <button
          type="button"
          disabled={isInteractionLocked}
          onClick={openCreateProject}
          className={`group flex ${CARD_HEIGHT} ${CARD_WIDTH} items-center justify-center overflow-hidden rounded-[24px] border border-dashed p-4 text-left shadow-sm transition-all ${
            isInteractionLocked
              ? 'cursor-wait border-slate-300 bg-slate-200/90 text-slate-500'
              : 'border-blue-300 bg-gradient-to-br from-blue-50 via-white to-cyan-50 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg'
          }`}
        >
          <div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
            isInteractionLocked ? 'bg-slate-500 text-white' : 'bg-blue-600 text-white'
          }`}>
            제작하기 <span aria-hidden="true">→</span>
          </div>
        </button>

        {isLoading && Array.from({ length: Math.max(1, SKELETON_COUNT - visibleProjects.length) }).map((_, index) => (
          <div key={`skeleton-${index}`} className={`${CARD_HEIGHT} ${CARD_WIDTH} overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm`}>
            <div className="h-[118px] animate-pulse bg-slate-200" />
            <div className="space-y-2.5 p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="col-span-2 h-7 animate-pulse rounded-xl bg-slate-200" />
                <div className="col-span-1 h-7 animate-pulse rounded-xl bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
        {duplicatingProjectId && (
          <div key="skeleton-copying" className={`${CARD_HEIGHT} ${CARD_WIDTH} overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm`}>
            <div className="h-[118px] animate-pulse bg-slate-200" />
            <div className="space-y-2.5 p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="col-span-2 h-7 animate-pulse rounded-xl bg-slate-200" />
                <div className="col-span-1 h-7 animate-pulse rounded-xl bg-slate-200" />
              </div>
            </div>
          </div>
        )}

        {!isLoading && sortedProjects.length === 0 && (
          <div className={`flex ${CARD_HEIGHT} ${CARD_WIDTH} flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white text-center shadow-sm`}>
            <div className="text-4xl">📁</div>
            <h3 className="mt-3 text-base font-black text-slate-900">프로젝트 없음</h3>
            <p className="mt-1 text-[11px] text-slate-500">제작하기로 시작</p>
          </div>
        )}

        {visibleProjects.map((project) => {
          const thumbSrc = resolveImageSrc(resolveProjectCardThumbnail(project));
          const assetCount = project.assets?.length || 0;
          const totalCost = project.cost?.total;
          const cardBackground = resolveThumbnailBackground(project);
          const completedMinutes = getCompletedMinutesLabel(project);

          return (
            <div
              key={project.id}
              className={`group relative ${CARD_HEIGHT} ${CARD_WIDTH} overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-180 will-change-transform hover:-translate-y-0.5 ${
                deletingProjectIds[project.id]
                  ? 'scale-75 opacity-0 pointer-events-none'
                  : entryAnimationIds[project.id]
                    ? 'scale-90 opacity-0'
                      : 'scale-100 opacity-100'
              }`}
            >
              {onDuplicateProject ? (
                <button
                  type="button"
                  disabled={Boolean(duplicatingProjectId) || isInteractionLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDuplicate(project);
                  }}
                  className={`absolute right-3 top-3 z-20 rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm transition-colors ${
                    duplicatingProjectId || isInteractionLocked
                      ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                      : 'bg-white/95 text-slate-700 hover:bg-white'
                  }`}
                  title="복사"
                >
                  복사
                </button>
              ) : null}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openProjectScene(project)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProjectScene(project);
                  }
                }}
                className={`block w-full text-left ${isInteractionLocked ? 'pointer-events-none cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              >
                <div className="relative h-[118px] overflow-hidden border-b border-slate-200" style={{ background: cardBackground }}>
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={project.name} className="h-full w-full object-cover opacity-85" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    {project.projectNumber ? <span className="rounded-full bg-blue-50/95 px-2.5 py-1 text-[11px] font-black text-blue-700">#{project.projectNumber}</span> : null}
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700">{assetCount}씬</span>
                    {completedMinutes ? <span className="rounded-full bg-emerald-50/95 px-2.5 py-1 text-[11px] font-black text-emerald-700">{completedMinutes}</span> : null}
                  </div>
                  {false ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDuplicateProject?.(project.id);
                      }}
                      className="absolute right-3 top-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm transition-colors hover:bg-white"
                      title="복사"
                    >
                      복사
                    </button>
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                    <div className="group/name relative rounded-xl bg-slate-900/28 px-3 py-2 text-base font-black text-white drop-shadow-sm transition-all duration-200 hover:bg-slate-900/45 hover:backdrop-blur-[1.5px]">
                      <span>{project.name}</span>
                      <button
                        type="button"
                        disabled={isInteractionLocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameModal(project);
                        }}
                        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-black/80 bg-black/80 px-3 py-1 text-[11px] font-black text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black group-hover/name:opacity-100"
                      >
                        이름 수정
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-[112px] flex-col p-2.5">
                <div className="mt-1 text-[11px] text-slate-500">{formatDate(project.createdAt)}</div>
                {project.folderName && <div className="mt-1 truncate text-[11px] text-slate-400">{project.folderName}</div>}

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {project.workflowDraft?.script && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">대본 포함</span>}
                  {totalCost !== undefined && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{formatKRW(totalCost)}</span>}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-1.5">
                  <button
                    disabled={isInteractionLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      openProjectScene(project);
                    }}
                    className="col-span-2 rounded-xl bg-blue-600 px-2 py-1.5 text-[10px] font-black text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    상세보기
                  </button>
                  <button
                    disabled={isInteractionLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project);
                    }}
                    className="col-span-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1.5 text-[10px] font-black text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {isInteractionLocked ? (
          <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-200/55 backdrop-blur-[1px]">
            <div className="rounded-xl bg-slate-700/90 px-3 py-2 text-xs font-black text-white">새 프로젝트 생성 중...</div>
          </div>
        ) : null}
        {!isLoading && hasMoreProjects ? <div ref={loadMoreTriggerRef} className="h-2 w-full" aria-hidden="true" /> : null}
        </div>
        </div>
      </div>

      {nameModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNameModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <h3 className="text-base font-black text-slate-900">
              {nameModal.mode === 'create' ? '프로젝트 이름을 적어주세요' : '프로젝트 이름 수정'}
            </h3>
            <input
              autoFocus
              value={pendingName}
              onChange={(event) => setPendingName(clampProjectName(event.target.value))}
              maxLength={getProjectNameLimit(pendingName)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (isSubmittingNameModal) return;
                  void submitNameModal();
                }
              }}
              placeholder="프로젝트 이름"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNameModal(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">취소</button>
              <button type="button" onClick={() => void submitNameModal()} disabled={!pendingName.trim() || isSubmittingNameModal} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500 disabled:bg-slate-300">확인</button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateInProgressModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowDuplicateInProgressModal(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-base font-black text-blue-700">안내</div>
            <h3 className="mt-3 text-center text-base font-black text-slate-900">복사 진행 중</h3>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">복사중인 프로젝트가 있습니다. 완료 후 다시 시도해 주세요.</p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowDuplicateInProgressModal(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectGallery;
