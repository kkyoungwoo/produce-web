'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
}

const HANGUL_NAME_REGEX = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

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
  const secondaryHue = (hue + 46) % 360;
  return `linear-gradient(135deg, hsl(${hue} 78% 86%), hsl(${secondaryHue} 70% 74%))`;
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
  const isInteractionLocked = isCreatingProject || isSubmittingNameModal || Boolean(duplicatingProjectId) || Object.keys(deletingProjectIds).length > 0;

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
    setSelectedProjectIds((prev) => (prev.length === sortedProjects.length ? [] : sortedProjects.map((project) => project.id)));
  };

  const openProjectScene = (project: SavedProject) => {
    if (isInteractionLocked) return;
    rememberProjectNavigationProject(project);
    onLoad?.(project);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    const targetStep = resolveLastWorkedStep(project);
    router.push(`${basePath}/step-${targetStep}?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
  };

  const openProjectThumbnailStudio = (project: SavedProject) => {
    if (isInteractionLocked) return;
    rememberProjectNavigationProject(project);
    onLoad?.(project);
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {}
    router.push(`${basePath}/thumbnail-studio?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
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
    const confirmed = window.confirm(`선택한 ${idsToDelete.length}개 프로젝트를 삭제할까요?
삭제 후에는 프로젝트 목록에서 제거됩니다.`);
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
      const payload = buildProjectsExportPayload(resolvedProjects);
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
      <article
        key={project.id}
        className={`mp4-glass-panel group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all ${isDeleting ? 'pointer-events-none scale-95 opacity-50' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
      >
        <div className="relative h-[132px] overflow-hidden border-b border-slate-200" style={{ background: cardBackground }}>
          {thumbSrc ? (
            <img src={thumbSrc} alt={project.name} className="h-full w-full object-cover opacity-90" />
          ) : (
            <div className="h-full w-full" />
          )}
          <div className="absolute inset-0 bg-slate-900/12" />

          <label className="absolute left-3 top-3 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-black text-slate-700 shadow-sm">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleProjectSelection(project.id)}
              onClick={(event) => event.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              aria-label={`${project.name} 선택`}
            />
            {typeof project.projectNumber === 'number' ? <span className="rounded-full px-2.5 py-1 font-bold text-slate-600">#{project.projectNumber}</span> : null}
          </label>

          {completedMinutes ? (
            <div className="absolute left-3 bottom-3 rounded-full bg-emerald-50/95 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm">
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
              className={`absolute right-3 top-3 z-20 rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm transition-colors ${isInteractionLocked ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-white/95 text-slate-700 hover:bg-white'}`}
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
                className="group/project-name relative rounded-xl bg-slate-900/38 px-3 py-2 text-base font-black text-white backdrop-blur-[1.5px] transition disabled:cursor-not-allowed disabled:opacity-70"
                aria-label={`${project.name} 이름 변경`}
              >
                <span className="block transition-opacity group-hover/project-name:opacity-0 group-focus-visible/project-name:opacity-0">{project.name}</span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/54 px-3 py-2 text-sm font-black text-white opacity-0 transition-opacity group-hover/project-name:opacity-100 group-focus-visible/project-name:opacity-100">이름 변경</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div>
            <div className="text-[11px] text-slate-500">{formatDate(getProjectCreatedAt(project))}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {project.workflowDraft?.script ? <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">대본 포함</span> : null}
              {totalCost !== undefined ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{formatKRW(totalCost)}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={() => openProjectScene(project)}
              className="col-span-2 rounded-[18px] border border-white/70 bg-white/70 px-2 py-2 text-[11px] font-black text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.10)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              제작하기
            </button>
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={() => openProjectThumbnailStudio(project)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              썸네일 제작
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFileChange}
        className="hidden"
      />

      <div className="mp4-glass-hero mb-5 flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">보관함</div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">저장된 프로젝트</h2>
            <p className="mt-2 text-sm text-slate-500">프로젝트 데이터는 번호별 폴더가 아니라 단일 JSON 저장소 기준으로 관리되어 복사, 삭제, 가져오기가 더 빠르게 동작합니다.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {hasSelection ? (
              <button
                type="button"
                onClick={handleExportSelected}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                내보내기 ({selectedProjectIds.length})
              </button>
            ) : null}
                        {hasSelection ? (
              <button
                type="button"
                disabled={isInteractionLocked}
                onClick={() => void handleBulkDelete()}
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                삭제 ({selectedProjectIds.length})
              </button>
            ) : null}
            {sortedProjects.length > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                전체 선택
              </label>
            ) : null}
                        <button
              type="button"
              onClick={handleImportClick}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              가져오기
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          disabled={isInteractionLocked}
          onClick={openCreateProject}
          className={`mp4-glass-panel flex min-h-[238px] items-center justify-center rounded-[24px] border border-dashed p-6 text-left shadow-sm transition-all ${isInteractionLocked ? 'cursor-wait border-slate-300 bg-slate-200/90 text-slate-500' : 'border-blue-300 bg-gradient-to-br from-blue-50 via-white to-cyan-50 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg'}`}
        >
          <div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${isInteractionLocked ? 'bg-slate-500 text-white' : 'bg-blue-600 text-white'}`}>
            제작하기 <span aria-hidden="true">→</span>
          </div>
        </button>

        {isLoading && !sortedProjects.length ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="min-h-[238px] animate-pulse rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-[132px] rounded-2xl bg-slate-100" />
              <div className="mt-4 h-4 w-2/3 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-6 h-10 rounded-2xl bg-slate-100" />
            </div>
          ))
        ) : null}

        {!isLoading && !sortedProjects.length ? (
          <div className="flex min-h-[238px] items-center justify-center rounded-[24px] border border-slate-200 bg-white p-6 text-center text-sm leading-6 text-slate-500 shadow-sm sm:col-span-1 xl:col-span-3">
            아직 저장된 프로젝트가 없습니다. 왼쪽 카드에서 새 프로젝트를 시작하거나 JSON 파일을 가져오세요.
          </div>
        ) : null}

        {sortedProjects.map(renderProjectCard)}
      </div>

      {nameModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNameModal(null);
          }}
        >
          <div className="mp4-glass-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
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
      ) : null}
    </div>
  );
};

export default ProjectGallery;
