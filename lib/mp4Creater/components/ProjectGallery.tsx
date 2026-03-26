'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { SavedProject } from '../types';
import { formatKRW } from '../config';
import { rememberProjectNavigationProject } from '../services/projectNavigationCache';
import { buildProjectsExportPayload, getProjectById } from '../services/projectService';
import { triggerTextDownload } from '../utils/downloadHelpers';

interface ProjectGalleryProps {
  projects: SavedProject[];
  isLoading?: boolean;
  onDeleteProjects: (ids: string[]) => void | Promise<void>;
  onDuplicateProject?: (id: string) => void | Promise<void>;
  onRenameProject?: (id: string, name: string) => void | Promise<void>;
  onImportProjects?: (file: File) => void | Promise<void>;
  onLoad?: (project: SavedProject) => void;
  basePath: string;
  onCreateNewProject?: (name: string) => void | Promise<void>;
  onOpenSettings?: () => void;
}

const HANGUL_NAME_REGEX = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const HEADER_HEIGHT = 77.08;

const getProjectNameLimit = (value: string) => (HANGUL_NAME_REGEX.test(value) ? 30 : 50);
const clampProjectName = (value: string) => value.slice(0, getProjectNameLimit(value));

const getProjectCreatedAt = (project: SavedProject) => (
  typeof project?.createdAt === 'number' ? project.createdAt : 0
);

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

const resolveImageSrc = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/jpeg;base64,${value}`;
};

const resolveProjectCardThumbnail = (project: SavedProject) => {
  const history = Array.isArray(project.thumbnailHistory) ? project.thumbnailHistory : [];
  const selectedThumbnail = history.find((item) => item.id === project.selectedThumbnailId && item.imageData);
  if (selectedThumbnail?.imageData) return selectedThumbnail.imageData;
  if (project.thumbnail) return project.thumbnail;

  const latestGeneratedThumbnail = [...history].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (latestGeneratedThumbnail?.imageData) return latestGeneratedThumbnail.imageData;

  const firstSceneImage = project.assets?.find((asset) => asset.imageData)?.imageData;
  if (firstSceneImage) return firstSceneImage;

  return '';
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
  const blueHue = 200 + (hue % 18);
  const secondaryBlueHue = 210 + (hue % 12);

  return `linear-gradient(135deg, hsl(${blueHue} 95% 95%), hsl(${secondaryBlueHue} 85% 88%), #ffffff)`;
};

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

const hasSceneStudioProgress = (project: SavedProject) => {
  const assets = Array.isArray(project.assets) ? project.assets : [];
  if (!assets.length) return false;
  return assets.some((asset) => (
    Boolean(asset.imageData)
    || Boolean(asset.audioData)
    || Boolean(asset.videoData)
    || Boolean(asset.imageHistory?.length)
    || Boolean(asset.videoHistory?.length)
    || asset.status !== 'pending'
  ));
};

const resolveLastWorkedStep = (project: SavedProject): 1 | 2 | 3 | 4 | 5 | 6 => {
  if (hasSceneStudioProgress(project)) return 6;
  const draft = project.workflowDraft;
  if (!draft) return 1;
  const completed = draft.completedSteps || { step1: false, step2: false, step3: false, step4: false, step5: false };

  if ((draft.activeStage || 0) >= 6) return 6;
  if (completed.step5 || (draft.activeStage || 0) >= 5) return 5;
  if (completed.step4 || (draft.activeStage || 0) >= 4) return 4;
  if (completed.step3 || (draft.activeStage || 0) >= 3) return 3;
  if (completed.step2 || (draft.activeStage || 0) >= 2) return 2;
  return 1;
};

const itemTransition: Transition = { duration: 0.3 };

const galleryLayoutTransition: Transition = {
  type: 'spring',
  stiffness: 110,
  damping: 20,
  mass: 0.9,
};

const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  projects,
  isLoading = false,
  onDeleteProjects,
  onDuplicateProject,
  onRenameProject,
  onImportProjects,
  onLoad,
  basePath,
  onCreateNewProject,
}) => {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [nameModal, setNameModal] = useState<{ mode: 'create' | 'rename'; project: SavedProject | null } | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [isSubmittingNameModal, setIsSubmittingNameModal] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [deletingProjectIds, setDeletingProjectIds] = useState<Record<string, boolean>>({});
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const galleryMinHeight = `calc(100dvh - ${HEADER_HEIGHT}px)`;

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => getProjectCreatedAt(b) - getProjectCreatedAt(a)),
    [projects]
  );

  useEffect(() => {
    const validIds = new Set(sortedProjects.map((project) => project.id));
    setSelectedProjectIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [sortedProjects]);

  const selectedProjects = useMemo(
    () => sortedProjects.filter((project) => selectedProjectIds.includes(project.id)),
    [sortedProjects, selectedProjectIds]
  );

  const isAllSelected = sortedProjects.length > 0 && selectedProjectIds.length === sortedProjects.length;
  const hasSelection = selectedProjectIds.length > 0;
  const isInteractionLocked =
    isCreatingProject ||
    isSubmittingNameModal ||
    Boolean(duplicatingProjectId) ||
    Object.keys(deletingProjectIds).length > 0;

  const totalDisplayCardCount = useMemo(() => {
    const createCard = 1;
    const projectCards = sortedProjects.length;
    const loadingCards = isLoading && !sortedProjects.length ? 3 : 0;
    const emptyCard = !isLoading && !sortedProjects.length ? 1 : 0;
    return createCard + projectCards + loadingCards + emptyCard;
  }, [isLoading, sortedProjects.length]);

  const shouldCenterWholeBox = totalDisplayCardCount <= 4;

  const galleryShellClass = shouldCenterWholeBox
    ? 'justify-center py-10 lg:py-12'
    : 'justify-start pt-12 pb-10 lg:pt-16 lg:pb-12';

  const galleryContentOffsetY = shouldCenterWholeBox ? 0 : 150;

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
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

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) => (
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    ));
  };

  const toggleSelectAll = () => {
    setSelectedProjectIds((prev) =>
      prev.length === sortedProjects.length ? [] : sortedProjects.map((project) => project.id)
    );
  };

  const openProjectScene = async (project: SavedProject) => {
    if (isInteractionLocked) return;
    const detailedProject = await getProjectById(project.id, { localOnly: true }) || await getProjectById(project.id) || project;
    rememberProjectNavigationProject(detailedProject);
    onLoad?.(detailedProject);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    const targetStep = resolveLastWorkedStep(detailedProject);
    router.push(`${basePath}/step-${targetStep}?projectId=${encodeURIComponent(detailedProject.id)}`, { scroll: false });
  };

  const openProjectThumbnailStudio = async (project: SavedProject) => {
    if (isInteractionLocked) return;
    const detailedProject = await getProjectById(project.id, { localOnly: true }) || await getProjectById(project.id) || project;
    rememberProjectNavigationProject(detailedProject);
    onLoad?.(detailedProject);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    router.push(`${basePath}/thumbnail-studio?projectId=${encodeURIComponent(detailedProject.id)}`, { scroll: false });
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
    if (!nameModal || isSubmittingNameModal) return;

    const trimmed = pendingName.trim();
    if (!trimmed) return;

    const maxLength = getProjectNameLimit(trimmed);
    if (trimmed.length > maxLength) {
      window.alert(
        HANGUL_NAME_REGEX.test(trimmed)
          ? '프로젝트 이름은 한글 기준 공백 포함 30자까지 입력할 수 있습니다.'
          : '프로젝트 이름은 영어 기준 공백 포함 50자까지 입력할 수 있습니다.'
      );
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
      } finally {
        setIsCreatingProject(false);
        setIsSubmittingNameModal(false);
      }
      return;
    }

    if (!nameModal.project || !onRenameProject) return;

    setIsSubmittingNameModal(true);
    try {
      await onRenameProject(nameModal.project.id, trimmed);
      setNameModal(null);
    } finally {
      setIsSubmittingNameModal(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!hasSelection || isInteractionLocked) return;

    const idsToDelete = Array.from(new Set(selectedProjectIds.filter(Boolean)));
    if (!idsToDelete.length) return;

    const confirmed = window.confirm(
      `선택한 ${idsToDelete.length}개 프로젝트를 삭제할까요?\n삭제 후에는 프로젝트 목록에서 제거됩니다.`
    );
    if (!confirmed) return;

    const nextDeletingMap = idsToDelete.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});

    setDeletingProjectIds((prev) => ({ ...prev, ...nextDeletingMap }));

    try {
      await onDeleteProjects(idsToDelete);
      setSelectedProjectIds([]);
    } catch (error) {
      console.error('[ProjectGallery] bulk delete failed', error);
      window.alert('선택한 프로젝트 삭제 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setDeletingProjectIds({});
    }
  };

  const handleDuplicate = async (project: SavedProject) => {
    if (isInteractionLocked || !onDuplicateProject) return;
    setDuplicatingProjectId(project.id);
    try {
      await onDuplicateProject(project.id);
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  const handleExportSelected = async () => {
    if (!selectedProjects.length) return;

    try {
      const resolvedProjects = await Promise.all(
        selectedProjects.map(async (project) => {
          const detailed = await getProjectById(project.id, { forceSync: true });
          return detailed || project;
        })
      );

      const payload = await buildProjectsExportPayload(resolvedProjects);

      triggerTextDownload(
        JSON.stringify(payload, null, 2),
        `mp4creater-projects-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json;charset=utf-8'
      );
    } catch (error) {
      console.error('[ProjectGallery] export failed', error);
      window.alert('프로젝트 내보내기 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportProjects) return;

    try {
      await onImportProjects(file);
    } catch (error) {
      console.error('[ProjectGallery] import failed', error);
      window.alert(error instanceof Error ? error.message : '프로젝트 가져오기 중 오류가 발생했습니다.');
    } finally {
      event.target.value = '';
    }
  };

  const renderProjectCard = (project: SavedProject) => {
    const thumbSrc = resolveImageSrc(resolveProjectCardThumbnail(project));
    const totalCost = project.cost?.total;
    const cardBackground = resolveThumbnailBackground(project);
    const completedMinutes = getCompletedMinutesLabel(project);
    const isChecked = selectedProjectIds.includes(project.id);
    const isDeleting = Boolean(deletingProjectIds[project.id]);
    const isDuplicating = duplicatingProjectId === project.id;

    return (
      <motion.article
        key={project.id}
        layout="position"
        initial={{ opacity: 0, y: 6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.985 }}
        transition={itemTransition}
        className={`group relative flex-none aspect-square w-full max-w-[265px] overflow-hidden rounded-[24px] border border-white/70 bg-white/65 shadow-[0_16px_40px_rgba(120,170,220,0.16)] backdrop-blur-xl lg:h-[265px] lg:w-[265px] lg:max-w-[265px] ${
          isDeleting ? 'pointer-events-none' : ''
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-sky-50/50 to-blue-100/30" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/95" />
        <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-sky-100/80" />

        <div
          className="relative h-[122px] overflow-hidden border-b border-sky-100/80 sm:h-[124px]"
          style={{ background: cardBackground }}
        >
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={project.name}
              className="h-full w-full object-cover opacity-[0.94] transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="h-full w-full" />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-sky-100/20" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_45%)]" />

          <label className="absolute left-3 top-3 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/60 px-2.5 py-1.5 text-[11px] font-black text-slate-700 shadow-sm backdrop-blur-md">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleProjectSelection(project.id)}
              onClick={(event) => event.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-sky-200 bg-transparent text-sky-500 focus:ring-sky-400"
              aria-label={`${project.name} 선택`}
            />
            {typeof project.projectNumber === 'number' ? (
              <span className="rounded-full bg-sky-50 px-2 font-bold text-sky-700">
                #{project.projectNumber}
              </span>
            ) : null}
          </label>

          {completedMinutes ? (
            <div className="absolute left-3 bottom-3 rounded-full border border-sky-200 bg-white/65 px-2.5 py-1 text-[11px] font-black text-sky-700 shadow-sm backdrop-blur-md">
              {completedMinutes}
            </div>
          ) : null}

          {onDuplicateProject ? (
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={(event) => {
                event.stopPropagation();
                void handleDuplicate(project);
              }}
              className={`absolute right-3 top-3 z-20 rounded-full border px-2.5 py-1 text-[11px] font-black shadow-sm backdrop-blur-md transition-all duration-300 ${
                isInteractionLocked
                  ? 'cursor-not-allowed border-slate-200 bg-white/40 text-slate-400'
                  : 'border-white/80 bg-white/60 text-sky-700 hover:bg-white/85'
              }`}
            >
              {isDuplicating ? '복사중...' : '복사'}
            </button>
          ) : null}

          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <div className="relative max-w-full">
              <button
                type="button"
                disabled={isInteractionLocked || !onRenameProject}
                onClick={(event) => {
                  event.stopPropagation();
                  openRenameModal(project);
                }}
                className="group/project-name relative rounded-xl border border-white/80 bg-white/55 px-3 py-2 text-base font-black text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label={`${project.name} 이름 변경`}
              >
                <span className="block transition-opacity duration-300 group-hover/project-name:opacity-0 group-focus-visible/project-name:opacity-0">
                  {project.name}
                </span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap rounded-xl bg-white/80 px-3 py-2 text-sm font-black text-sky-700 opacity-0 transition-opacity duration-300 group-hover/project-name:opacity-100 group-focus-visible/project-name:opacity-100">
                  이름 변경
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100%-122px)] flex-col justify-between p-3 sm:h-[calc(100%-124px)]">
          <div>
            <div className="text-[11px] text-slate-500">
              {formatDate(getProjectCreatedAt(project))}
            </div>

            <div className="mt-2 flex min-h-[28px] flex-wrap gap-1.5 text-[10px] sm:text-[11px]">
              {project.workflowDraft?.script ? (
                <span className="rounded-full border border-sky-100 bg-sky-50/90 px-2.5 py-1 font-bold text-sky-700">
                  대본 포함
                </span>
              ) : null}

              {totalCost !== undefined ? (
                <span className="rounded-full border border-blue-100 bg-white px-2.5 py-1 font-bold text-blue-700">
                  {formatKRW(totalCost)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              disabled={isInteractionLocked}
              onClick={() => { void openProjectScene(project); }}
              className="col-span-2 rounded-[18px] border border-sky-200 bg-gradient-to-r from-white via-sky-50 to-blue-100 px-2 py-2 text-[11px] font-black text-sky-700 shadow-[0_8px_20px_rgba(140,190,235,0.18)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_10px_24px_rgba(140,190,235,0.22)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              제작하기
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              disabled={isInteractionLocked}
              onClick={() => { void openProjectThumbnailStudio(project); }}
              className="rounded-xl border border-sky-100 bg-white/80 px-2 py-2 text-[10px] font-black text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white sm:text-[11px] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              썸네일 제작
            </motion.button>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        minHeight: galleryMinHeight,
        background:
          'linear-gradient(180deg, #f8fcff 0%, #f2f8ff 40%, #edf6ff 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 12% 15%, rgba(186, 224, 255, 0.45), transparent 22%),
            radial-gradient(circle at 84% 12%, rgba(219, 238, 255, 0.55), transparent 24%),
            radial-gradient(circle at 50% 78%, rgba(210, 232, 255, 0.40), transparent 28%)
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(180,210,240,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(180,210,240,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute right-[-70px] top-[18%] h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-90px] left-[22%] h-80 w-80 rounded-full bg-white blur-3xl" />

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFileChange}
        className="hidden"
      />

      <motion.section
        layout
        transition={galleryLayoutTransition}
        className={`relative z-10 mx-auto flex w-full flex-col px-4 ${galleryShellClass}`}
        style={{ minHeight: galleryMinHeight }}
      >
        <motion.div
          layout
          animate={{ y: galleryContentOffsetY }}
          transition={galleryLayoutTransition}
          className="mx-auto w-full max-w-[1200px]"
        >
          <motion.div
            layout="position"
            transition={galleryLayoutTransition}
            className="mb-5 w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/70 p-5 shadow-[0_18px_44px_rgba(150,190,225,0.16)] backdrop-blur-2xl lg:mx-auto lg:w-[1106px] lg:max-w-[1106px]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">
                  보관함
                </div>
                <h2 className="mt-1 text-2xl font-black text-slate-700">
                  저장된 프로젝트
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  제작하기 버튼을 눌러 프로젝트를 시작해보세요!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasSelection ? (
                  <button
                    type="button"
                    onClick={handleExportSelected}
                    className="rounded-2xl border border-sky-100 bg-white/85 px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white"
                  >
                    내보내기 ({selectedProjectIds.length})
                  </button>
                ) : null}

                {hasSelection ? (
                  <button
                    type="button"
                    disabled={isInteractionLocked}
                    onClick={() => void handleBulkDelete()}
                    className="rounded-2xl border border-rose-100 bg-white/85 px-4 py-2.5 text-sm font-black text-rose-500 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    삭제 ({selectedProjectIds.length})
                  </button>
                ) : null}

                {sortedProjects.length > 0 ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-sky-100 bg-white/85 px-3 py-2 text-sm font-bold text-slate-700 backdrop-blur-md">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-sky-200 bg-transparent text-sky-500 focus:ring-sky-400"
                    />
                    전체 선택
                  </label>
                ) : null}

                <button
                  type="button"
                  onClick={handleImportClick}
                  className="rounded-2xl border border-sky-100 bg-white/85 px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white"
                >
                  가져오기
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            layout
            transition={galleryLayoutTransition}
            className="mx-auto flex w-full max-w-[1124px] flex-wrap justify-center gap-3 sm:gap-4"
          >
            <motion.button
              layout="position"
              initial={{ opacity: 0, y: 6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.985 }}
              transition={itemTransition}
              type="button"
              disabled={isInteractionLocked}
              onClick={openCreateProject}
              className={`group relative flex-none aspect-square w-full max-w-[265px] items-center justify-center overflow-hidden rounded-[24px] border border-dashed p-6 text-left shadow-[0_16px_40px_rgba(120,170,220,0.16)] backdrop-blur-xl transition-all duration-300 lg:flex lg:h-[265px] lg:w-[265px] lg:max-w-[265px] ${
                isInteractionLocked
                  ? 'cursor-wait border-slate-200 bg-white/50 text-slate-400'
                  : 'border-sky-200 bg-white/70 hover:bg-white/85'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-sky-50 to-blue-100/70" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-100/90 blur-2xl" />
              <motion.div
                whileHover={{ y: -1 }}
                className="relative inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white/90 px-4 py-3 text-sm font-black text-sky-700 shadow-sm backdrop-blur-md"
              >
                동영상 제작하기
              </motion.div>
            </motion.button>

            <AnimatePresence initial={false} mode="popLayout">
              {isLoading && !sortedProjects.length ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <motion.div
                    key={`skeleton-${index}`}
                    layout="position"
                    initial={{ opacity: 0, y: 6, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.985 }}
                    transition={{ duration: 0.2 + index * 0.04 }}
                    className="flex-none aspect-square w-full max-w-[265px] overflow-hidden rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-[0_16px_40px_rgba(120,170,220,0.14)] backdrop-blur-xl lg:h-[265px] lg:w-[265px] lg:max-w-[265px]"
                  >
                    <div className="h-[132px] animate-pulse rounded-2xl bg-sky-50" />
                    <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-sky-50" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-sky-50" />
                    <div className="mt-6 h-10 animate-pulse rounded-2xl bg-sky-50" />
                  </motion.div>
                ))
              ) : null}

              {!isLoading && !sortedProjects.length ? (
                <motion.div
                  key="empty-card"
                  layout="position"
                  initial={{ opacity: 0, y: 6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.985 }}
                  transition={itemTransition}
                  className="flex flex-none aspect-square w-full max-w-[256px] items-center justify-center rounded-[24px] border border-white/80 bg-white/70 p-6 text-center text-sm leading-6 text-slate-500 shadow-[0_16px_40px_rgba(120,170,220,0.14)] backdrop-blur-xl lg:h-[265px]"
                >
                  아직 저장된 프로젝트가 없습니다.
                </motion.div>
              ) : null}

              {sortedProjects.map(renderProjectCard)}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.section>

      <AnimatePresence>
        {nameModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={itemTransition}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setNameModal(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={itemTransition}
              className="w-full max-w-md rounded-2xl border border-white/90 bg-white/85 p-5 shadow-[0_16px_40px_rgba(120,170,220,0.18)] backdrop-blur-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h3 className="text-base font-black text-slate-700">
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
                    void submitNameModal();
                  }
                }}
                placeholder="프로젝트 이름"
                className="mt-3 w-full rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-300"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNameModal(null)}
                  className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all duration-300 hover:bg-sky-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void submitNameModal()}
                  disabled={!pendingName.trim() || isSubmittingNameModal}
                  className="rounded-xl border border-sky-200 bg-gradient-to-r from-white via-sky-50 to-blue-100 px-3 py-2 text-xs font-black text-sky-700 shadow-sm transition-all duration-300 hover:brightness-[1.02] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default ProjectGallery;
