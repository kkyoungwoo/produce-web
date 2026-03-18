'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SavedProject } from '../types';
import { formatKRW } from '../config';
import { LoadingOverlay } from './LoadingOverlay';

interface ProjectGalleryProps {
  projects: SavedProject[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onLoad: (project: SavedProject) => void;
  basePath: string;
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

const ProjectGallery: React.FC<ProjectGalleryProps> = ({ projects, onBack, onDelete, onRefresh, onLoad, basePath }) => {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [navigationOverlay, setNavigationOverlay] = useState<{ title: string; description: string } | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [projects]
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openProjectScene = (project: SavedProject) => {
    setNavigationOverlay({
      title: '프로젝트 씬 제작을 여는 중',
      description: '프로젝트 요약을 먼저 보여 주고, 필요한 생성은 버튼을 눌렀을 때만 시작되도록 준비합니다.',
    });
    router.push(`${basePath}/scene-studio?projectId=${encodeURIComponent(project.id)}`, { scroll: false });
  };

  /**
   * 삭제 재확인 로직
   * - 사용자가 삭제 버튼을 눌렀을 때 alert/confirm 계열 재확인을 거치도록 변경
   * - 프로젝트를 잘못 지우는 사고를 줄이기 위한 요청 반영
   */
  const handleDelete = (project: SavedProject) => {
    const confirmed = window.confirm(`"${project.name}" 프로젝트를 삭제할까요?\n삭제 후에는 프로젝트 목록에서 제거됩니다.`);
    if (!confirmed) return;
    onDelete(project.id);
    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
    }
    onRefresh();
  };

  if (selectedProject) {
    const assets = Array.isArray(selectedProject.assets) ? selectedProject.assets : [];
    const settings = getProjectSettings(selectedProject);

    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
      <LoadingOverlay open={Boolean(navigationOverlay)} title={navigationOverlay?.title || '이동 중'} description={navigationOverlay?.description} />
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
            <span className="rounded-full bg-slate-100 px-3 py-2">오디오 모델 {settings.elevenLabsModel}</span>
            {settings.fluxStyle && <span className="rounded-full bg-slate-100 px-3 py-2">스타일 {settings.fluxStyle}</span>}
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">이미지 {assets.filter((a) => a.imageData).length}/{assets.length}</span>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">오디오 {assets.filter((a) => a.audioData).length}/{assets.length}</span>
          </div>

          {selectedProject.cost && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <div className="flex flex-wrap gap-3">
                <span>이미지 {selectedProject.cost.imageCount}장 {formatKRW(selectedProject.cost.images)}</span>
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
                      <h4 className="text-sm font-black text-slate-900">나레이션</h4>
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </button>

        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">보관함</div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">저장된 프로젝트</h2>
          <p className="mt-2 text-xs text-slate-500">각 프로젝트는 번호별 폴더로 저장됩니다. 예: projects/project-0001-...</p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">{sortedProjects.length}개 프로젝트</span>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="text-6xl">📁</div>
          <h3 className="mt-5 text-xl font-black text-slate-900">저장된 프로젝트가 없습니다</h3>
          <p className="mt-2 text-sm text-slate-500">사용자가 작성하거나 AI로 생성한 프로젝트는 씬 생성 후 자동 저장되어 여기에서 다시 열 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => {
            const settings = getProjectSettings(project);
            const thumbSrc = resolveImageSrc(project.thumbnail) || '/mp4Creater/flow-story.svg';
            const assetCount = project.assets?.length || 0;
            const totalCost = project.cost?.total;
            const isDraftProject = assetCount === 0 && Boolean(project.workflowDraft?.script);
            return (
              <div key={project.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5">
                <button type="button" onClick={() => openProjectScene(project)} className="block w-full text-left">
                  <div className="relative overflow-hidden border-b border-slate-200 bg-slate-50">
                    <img src={thumbSrc} alt={project.name} className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/55 to-transparent px-4 py-3 text-sm font-bold text-white">클릭하면 씬 제작으로 이동</div>
                  </div>
                </button>

                <div className="p-4">
                  <button type="button" onClick={() => openProjectScene(project)} className="block w-full text-left">
                    <div className="flex items-center gap-2">
                      {project.projectNumber && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">#{project.projectNumber}</span>}
                      <h3 className="truncate text-lg font-black text-slate-900" title={project.name}>{project.name}</h3>
                    </div>
                  </button>
                  <div className="mt-2 text-xs text-slate-500">{formatDate(project.createdAt)}</div>
                  {project.folderName && <div className="mt-1 truncate text-[11px] text-slate-400">{project.folderName}</div>}

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{settings.imageModel || '기본 이미지 모델'}</span>
                    <span className={`rounded-full px-2.5 py-1 ${isDraftProject ? 'bg-blue-50 font-bold text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{isDraftProject ? '씬 제작 대기' : `${assetCount}씬`}</span>
                    {project.workflowDraft?.script && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">대본 포함</span>}
                    {totalCost !== undefined && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{formatKRW(totalCost)}</span>}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openProjectScene(project);
                      }}
                      className="flex-1 rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition-colors hover:bg-blue-500"
                    >
                      씬 제작으로 열기
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(project);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      상세
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-600"
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectGallery;
