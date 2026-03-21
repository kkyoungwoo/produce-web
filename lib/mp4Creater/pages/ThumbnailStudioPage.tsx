'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import { LoadingOverlay, StudioPageSkeleton } from '../components/LoadingOverlay';
import { getProjectById, updateProject } from '../services/projectService';
import { generateImage, getSelectedImageModel, isSampleImageModel } from '../services/imageService';
import { readProjectNavigationProject, rememberProjectNavigationProject } from '../services/projectNavigationCache';
import {
  buildThumbnailPrompt,
  buildThumbnailScene,
  createSampleThumbnail,
  buildThumbnailLabel,
} from '../services/thumbnailService';
import { CharacterProfile, PromptedImageAsset, ReferenceImages, SavedProject } from '../types';

function resolveImageSrc(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
}

function getSelectedCharacterIds(project: SavedProject) {
  const draft = project.workflowDraft;
  if (!draft) return [];
  return draft.selectedCharacterIds.length
    ? draft.selectedCharacterIds
    : draft.extractedCharacters.map((item) => item.id);
}

function getSelectedCharacters(project: SavedProject) {
  const draft = project.workflowDraft;
  if (!draft) return [];
  const selectedIds = getSelectedCharacterIds(project);
  return draft.extractedCharacters.filter((item) => selectedIds.includes(item.id));
}

function getCharacterSelectedImage(character: CharacterProfile) {
  const selected = character.generatedImages?.find((item) => item.id === character.selectedImageId);
  if (selected?.imageData) return selected.imageData;
  if (character.imageData) return character.imageData;
  return character.generatedImages?.find((item) => item.imageData)?.imageData || '';
}

function buildReferenceImages(project: SavedProject, leadCharacterId: string | null): ReferenceImages {
  const draft = project.workflowDraft;
  if (!draft) {
    return {
      character: [],
      style: [],
      characterStrength: 70,
      styleStrength: 70,
    };
  }

  const selectedCharacters = getSelectedCharacters(project);
  const lead = selectedCharacters.find((item) => item.id === leadCharacterId) || selectedCharacters[0];
  const selectedStyle = draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0];

  return {
    character: [lead, ...selectedCharacters]
      .map((item) => getCharacterSelectedImage(item))
      .filter(Boolean) as string[],
    style: selectedStyle?.imageData ? [selectedStyle.imageData] : [],
    characterStrength: draft.referenceImages?.characterStrength || 70,
    styleStrength: draft.referenceImages?.styleStrength || 70,
  };
}

function buildDefaultLeadCharacterId(project: SavedProject) {
  const selectedCharacters = getSelectedCharacters(project);
  const lead = selectedCharacters.find((item) => item.role === 'lead');
  return lead?.id || selectedCharacters[0]?.id || null;
}

export default function ThumbnailStudioPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = useMemo(() => pathname.replace(/\/thumbnail-studio$/, ''), [pathname]);
  const projectId = searchParams?.get('projectId') || '';

  const [project, setProject] = useState<SavedProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [promptText, setPromptText] = useState('');
  const [history, setHistory] = useState<PromptedImageAsset[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(null);
  const [activeThumbnailId, setActiveThumbnailId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setErrorMessage('프로젝트 ID가 없어 썸네일 작업 화면을 열 수 없습니다.');
      setIsLoading(false);
      return;
    }

    const cached = readProjectNavigationProject(projectId);
    if (cached) {
      setProject(cached);
      setPromptText(cached.thumbnailPrompt || '');
      setHistory(Array.isArray(cached.thumbnailHistory) ? cached.thumbnailHistory : []);
      setSelectedThumbnailId(cached.selectedThumbnailId || null);
      setActiveThumbnailId(cached.selectedThumbnailId || cached.thumbnailHistory?.[cached.thumbnailHistory.length - 1]?.id || null);
      setIsLoading(false);
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setErrorMessage('');
      const loaded = await getProjectById(projectId);
      if (cancelled) return;
      if (!loaded) {
        setProject(null);
        setErrorMessage('프로젝트를 찾을 수 없습니다. 프로젝트 저장소에서 다시 열어 주세요.');
        setIsLoading(false);
        return;
      }
      setProject(loaded);
      setPromptText((prev) => prev || loaded.thumbnailPrompt || '');
      setHistory(Array.isArray(loaded.thumbnailHistory) ? loaded.thumbnailHistory : []);
      setSelectedThumbnailId(loaded.selectedThumbnailId || null);
      setActiveThumbnailId((current) => current || loaded.selectedThumbnailId || loaded.thumbnailHistory?.[loaded.thumbnailHistory.length - 1]?.id || null);
      rememberProjectNavigationProject(loaded);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);


  const activeThumbnail = useMemo(
    () => history.find((item) => item.id === activeThumbnailId) || null,
    [activeThumbnailId, history]
  );

  const scrollStripBy = (direction: 'left' | 'right') => {
    const container = stripRef.current;
    if (!container) return;
    const amount = Math.max(280, Math.floor(container.clientWidth * 0.72));
    container.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const scrollToCard = useCallback((cardId: string) => {
    const node = cardRefs.current[cardId];
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, []);

  const persistDraftHistory = useCallback(async (nextHistory: PromptedImageAsset[], prompt: string) => {
    if (!project?.id) return;
    const updated = await updateProject(project.id, {
      thumbnailHistory: nextHistory,
      thumbnailTitle: project.thumbnailTitle || project.topic || project.name,
      thumbnailPrompt: promptText.trim(),
      selectedThumbnailId,
    });
    if (updated) {
      setProject(updated);
      rememberProjectNavigationProject(updated);
    }
  }, [project, promptText, selectedThumbnailId]);

  const handleGenerateThumbnail = useCallback(async (similarTarget?: PromptedImageAsset | null) => {
    if (!project || isGenerating) return;

    const trimmedPrompt = promptText.trim();
    const options = {
      customPrompt: trimmedPrompt,
      similarPrompt: similarTarget?.prompt || '',
    };

    setIsGenerating(true);
    setStatusMessage(similarTarget ? '입력한 프롬프트를 기준으로 비슷한 결의 새 썸네일 후보를 만드는 중입니다.' : '입력한 프롬프트와 현재 프로젝트 작업 내용을 바탕으로 새 썸네일 후보를 만드는 중입니다.');

    try {
      const variantSeed = history.length;
      const prompt = buildThumbnailPrompt(project, variantSeed, options);
      const sample = createSampleThumbnail(project, variantSeed, options);
      const imageModel = getSelectedImageModel();
      const usesSampleImageFlow = isSampleImageModel(imageModel);
      const generated = await generateImage(
        buildThumbnailScene(project, variantSeed, options),
        buildReferenceImages(project, buildDefaultLeadCharacterId(project)),
        { qualityMode: 'draft' },
      ).catch(() => null);

      const entry: PromptedImageAsset = {
        id: `thumbnail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: buildThumbnailLabel(project, trimmedPrompt),
        prompt,
        imageData: generated || sample.dataUrl,
        createdAt: Date.now(),
        kind: 'thumbnail',
        sourceMode: generated ? (usesSampleImageFlow ? 'sample' : 'ai') : 'sample',
        note: [
          trimmedPrompt ? `입력 프롬프트: ${trimmedPrompt}` : '프로젝트 작업 내용을 기준으로 생성',
          similarTarget ? '기존 썸네일과 비슷한 느낌으로 재생성' : '새 썸네일 후보',
        ].filter(Boolean).join(' · '),
        groupId: 'thumbnail-studio-history',
        groupLabel: '썸네일 후보',
      };

      const nextHistory = [...history, entry];
      setHistory(nextHistory);
      setActiveThumbnailId(entry.id);
      await persistDraftHistory(nextHistory, prompt);
      scrollToCard(entry.id);
      setStatusMessage(similarTarget ? '비슷한 결의 새 썸네일 후보가 오른쪽에 추가되었습니다.' : '새 썸네일 후보가 오른쪽에 추가되었습니다.');
    } catch (error) {
      console.error('[ThumbnailStudio] generate failed', error);
      setStatusMessage('썸네일 생성 중 오류가 발생했습니다. 입력값은 유지되었으니 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [history, isGenerating, persistDraftHistory, project, promptText, scrollToCard]);

  const handleSelectFinalThumbnail = useCallback(async (targetThumbnail?: PromptedImageAsset | null) => {
    const resolvedThumbnail = targetThumbnail || activeThumbnail;
    if (!project || !resolvedThumbnail || isSavingSelection) return;
    setIsSavingSelection(true);
    setStatusMessage('선택한 썸네일을 프로젝트 대표 이미지로 저장하는 중입니다.');
    try {
      const normalizedHistory = history.map((item) => ({
        ...item,
        selected: item.id === resolvedThumbnail.id,
      }));
      const updated = await updateProject(project.id, {
        thumbnail: resolvedThumbnail.imageData,
        thumbnailHistory: normalizedHistory,
        selectedThumbnailId: resolvedThumbnail.id,
        thumbnailTitle: resolvedThumbnail.label || project.topic || project.name,
        thumbnailPrompt: promptText.trim(),
      });
      if (!updated) throw new Error('save failed');
      setProject(updated);
      setHistory(Array.isArray(updated.thumbnailHistory) ? updated.thumbnailHistory : normalizedHistory);
      setSelectedThumbnailId(resolvedThumbnail.id);
      setActiveThumbnailId(resolvedThumbnail.id);
      rememberProjectNavigationProject(updated);
      setStatusMessage('대표 썸네일이 저장되었습니다. 프로젝트 저장소 카드에도 이 이미지가 표시됩니다.');
    } catch (error) {
      console.error('[ThumbnailStudio] select failed', error);
      setStatusMessage('대표 썸네일 저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSavingSelection(false);
    }
  }, [activeThumbnail, history, isSavingSelection, project, promptText]);

  if (isLoading && !project) {
    return <StudioPageSkeleton title="썸네일 제작 페이지를 준비하는 중" description="현재 프로젝트의 대본, 캐릭터, 화풍을 먼저 불러와 썸네일 작업 화면에 연결합니다." progressPercent={22} progressLabel="썸네일 스튜디오 준비" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        onGoGallery={() => router.push(`${basePath}?view=gallery`, { scroll: false })}
        basePath={basePath}
        currentSection="scene"
        selectedCharacterName={undefined}
      />

      <main className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-600">thumbnail studio</div>
              <h1 className="mt-2 text-3xl font-black text-slate-900">현재 프로젝트 기준으로 썸네일을 따로 만드는 페이지</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                현재 프로젝트의 대본, 캐릭터 이미지, 화풍을 그대로 참고하면서 프롬프트 입력값을 기준으로 썸네일을 여러 장 만들고 마지막에 대표 썸네일 1장을 선택할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`${basePath}?view=gallery`, { scroll: false })}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
              >
                프로젝트 저장소
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{errorMessage}</div>
          ) : null}

          {statusMessage ? (
            <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">{statusMessage}</div>
          ) : null}
        </section>

        {project && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="space-y-6">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">썸네일 프롬프트</div>
                <h2 className="mt-2 text-xl font-black text-slate-900">프롬프트를 입력하면 현재 작업 내용을 함께 반영해 생성합니다</h2>
                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <div className="mb-2 text-sm font-black text-slate-800">프롬프트 입력</div>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={8}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                      placeholder="예: 강한 시선의 주인공 클로즈업, 큰 제목 타이포, 클릭을 부르는 대비, 긴장감 있는 유튜브 썸네일"
                    />
                  </label>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                    입력한 프롬프트에 현재 프로젝트의 대본, 선택된 캐릭터 이미지, 화풍을 함께 반영해 썸네일을 생성합니다.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateThumbnail(null)}
                    disabled={isGenerating || !project}
                    className="rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
                  >
                    {isGenerating ? '썸네일 생성 중...' : '썸네일 만들기'}
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">썸네일 후보 히스토리</div>
                    <h2 className="mt-2 text-xl font-black text-slate-900">새로 만든 후보는 계속 오른쪽 히스토리에 쌓입니다</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => scrollStripBy('left')} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" aria-label="썸네일 후보 왼쪽으로">←</button>
                    <button type="button" onClick={() => scrollStripBy('right')} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" aria-label="썸네일 후보 오른쪽으로">→</button>
                  </div>
                </div>

                <div ref={stripRef} className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
                  {!history.length ? (
                    <div className="flex w-full min-w-[280px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm leading-6 text-slate-500">
                      왼쪽 프롬프트 입력 아래의 썸네일 만들기 버튼으로 첫 후보를 생성해 주세요.
                    </div>
                  ) : null}
                  {history.map((item) => {
                    const isActive = item.id === activeThumbnailId;
                    const isFinal = item.id === selectedThumbnailId;
                    return (
                      <button
                        key={item.id}
                        ref={(node) => {
                          cardRefs.current[item.id] = node;
                        }}
                        type="button"
                        onClick={() => setActiveThumbnailId(item.id)}
                        className={`w-[300px] shrink-0 snap-start overflow-hidden rounded-[28px] border bg-white text-left shadow-sm transition ${isActive ? 'border-fuchsia-400 ring-2 ring-fuchsia-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-fuchsia-200'}`}
                      >
                        <div className="overflow-hidden border-b border-slate-200 bg-slate-100">
                          <img src={resolveImageSrc(item.imageData)} alt={item.label} className="aspect-video w-full object-cover" />
                        </div>
                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-slate-900">{item.label || '썸네일 후보'}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isFinal ? 'bg-emerald-600 text-white' : isActive ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{isFinal ? '대표' : isActive ? '선택 중' : '후보'}</span>
                          </div>
                          <p className="line-clamp-3 text-xs leading-5 text-slate-500">{item.note || item.prompt}</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveThumbnailId(item.id);
                                void handleSelectFinalThumbnail(item);
                              }}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                            >
                              대표 썸네일 선택
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleGenerateThumbnail(item);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              비슷하게 재생성
                            </button>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </section>
          </div>
        )}
      </main>

      <LoadingOverlay
        open={isGenerating || isSavingSelection}
        title={isGenerating ? '썸네일 후보 생성 중' : '대표 썸네일 저장 중'}
        description={isGenerating ? '현재 프로젝트의 대본, 캐릭터 이미지, 화풍과 입력한 문구를 조합해 새 썸네일 후보를 만들고 있습니다.' : '선택한 썸네일을 프로젝트 대표 이미지와 히스토리에 반영하고 있습니다.'}
        progressPercent={isGenerating ? 68 : 86}
        progressLabel={isGenerating ? '썸네일 생성 진행률' : '프로젝트 반영 진행률'}
      />
    </div>
  );
}
