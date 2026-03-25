'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import { LoadingOverlay, StudioPageSkeleton } from '../components/LoadingOverlay';
import { OverlayModal } from '../components/inputSection/ui';
import { getProjectById, updateProject } from '../services/projectService';
import { createDefaultStudioState, fetchStudioState, saveStudioState } from '../services/localFileApi';
import { generateImage, getSelectedImageModel, isSampleImageModel } from '../services/imageService';
import { buildYoutubeMeta } from '../services/projectEnhancementService';
import { runTextAi } from '../services/textAiService';
import { renderVideoWithFfmpeg } from '../services/serverRenderService';
import { fetchYoutubeConnectionStatus, type YoutubeConnectionStatus, uploadVideoToYoutube } from '../services/youtubeService';
import { readProjectNavigationProject, rememberProjectNavigationProject } from '../services/projectNavigationCache';
import {
  buildThumbnailPrompt,
  buildThumbnailScene,
  createSampleThumbnail,
  buildThumbnailLabel,
} from '../services/thumbnailService';
import { CharacterProfile, PromptedImageAsset, ReferenceImages, SavedProject, StudioState, YoutubeMetaDraft } from '../types';

function resolveImageSrc(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
}

function getSelectedCharacterIds(project: SavedProject) {
  const draft = project.workflowDraft;
  if (!draft) return [];
  const selectedCharacterIds = Array.isArray(draft.selectedCharacterIds) ? draft.selectedCharacterIds : [];
  const extractedCharacters = Array.isArray(draft.extractedCharacters) ? draft.extractedCharacters : [];
  return selectedCharacterIds.length
    ? selectedCharacterIds
    : extractedCharacters.map((item) => item.id);
}

function getSelectedCharacters(project: SavedProject) {
  const draft = project.workflowDraft;
  if (!draft) return [];
  const extractedCharacters = Array.isArray(draft.extractedCharacters) ? draft.extractedCharacters : [];
  const selectedIds = getSelectedCharacterIds(project);
  return extractedCharacters.filter((item) => selectedIds.includes(item.id));
}

function getCharacterSelectedImage(character?: CharacterProfile | null) {
  if (!character) return '';
  const generatedImages = Array.isArray(character.generatedImages) ? character.generatedImages : [];
  const selected = generatedImages.find((item) => item.id === character.selectedImageId);
  if (selected?.imageData) return selected.imageData;
  if (character.imageData) return character.imageData;
  return generatedImages.find((item) => item.imageData)?.imageData || '';
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
  const styleImages = Array.isArray(draft.styleImages) ? draft.styleImages : [];
  const lead = selectedCharacters.find((item) => item.id === leadCharacterId) || selectedCharacters[0];
  const selectedStyle = styleImages.find((item) => item.id === draft.selectedStyleImageId) || styleImages[0];
  const sceneImageRefs = (project.assets || [])
    .map((item) => item.imageData)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);

  return {
    character: [lead, ...selectedCharacters]
      .map((item) => getCharacterSelectedImage(item))
      .filter(Boolean) as string[],
    style: [selectedStyle?.imageData, ...sceneImageRefs].filter(Boolean) as string[],
    characterStrength: draft.referenceImages?.characterStrength || 70,
    styleStrength: draft.referenceImages?.styleStrength || 70,
  };
}

function buildDefaultLeadCharacterId(project: SavedProject) {
  const selectedCharacters = getSelectedCharacters(project);
  const lead = selectedCharacters.find((item) => item.role === 'lead');
  return lead?.id || selectedCharacters[0]?.id || null;
}

function buildRecommendedThumbnailTitle(project: SavedProject, item: PromptedImageAsset) {
  const topic = (project.topic || project.name || '프로젝트').trim();
  const lead = getSelectedCharacters(project)[0]?.name?.trim();
  const base = item.label?.trim() || topic;
  return lead ? `${base} | ${lead} 중심 썸네일` : `${base} | 프로젝트 썸네일`;
}

function buildRecommendedThumbnailDescription(project: SavedProject, item: PromptedImageAsset) {
  const lead = getSelectedCharacters(project)[0]?.name || '주인공';
  const draft = project.workflowDraft;
  const styleImages = Array.isArray(draft?.styleImages) ? draft?.styleImages : [];
  const selectedStyle = styleImages.find((style) => style.id === draft?.selectedStyleImageId) || styleImages[0];
  const mood = draft?.selections?.mood?.trim();
  const direction = (item.note || item.prompt || '').replace(/\s+/g, ' ').trim();
  return `${lead} 중심 구성의 ${selectedStyle?.groupLabel || selectedStyle?.label || '선택 화풍'} 추천 문구입니다.${mood ? ` 분위기는 ${mood}.` : ''}${direction ? ` 핵심 방향: ${direction.slice(0, 140)}.` : ''}`;
}

function buildAutoThumbnailHeadline(project: SavedProject) {
  const topic = (project.topic || project.name || '프로젝트').trim();
  const firstScene = (project.assets?.[0]?.narration || project.workflowDraft?.script || '').replace(/\s+/g, ' ').trim();
  const lead = getSelectedCharacters(project)[0]?.name?.trim();
  const base = lead ? `${topic} | ${lead}` : topic;
  const candidate = firstScene ? `${base} ${firstScene.slice(0, 18)}` : base;
  return candidate.length > 28 ? `${candidate.slice(0, 28)}…` : candidate;
}

function buildAutoThumbnailSupportText(project: SavedProject) {
  const source = (project.assets?.[0]?.narration || project.workflowDraft?.script || project.topic || project.name || '프로젝트 장면').replace(/\s+/g, ' ').trim();
  return source.length > 44 ? `${source.slice(0, 44)}…` : source;
}

function buildAutoThumbnailPromptHint(project: SavedProject) {
  const selections = project.workflowDraft?.selections;
  const lead = getSelectedCharacters(project)[0]?.name?.trim();
  return [
    lead ? `${lead} 표정 강조` : '',
    selections?.mood ? `${selections.mood} 분위기` : '',
    selections?.setting ? `${selections.setting} 배경감` : '',
    '큰 한글 타이포',
    '강한 대비',
    '클릭 유도 배치',
  ].filter(Boolean).join(', ');
}

function resolveProjectThumbnailForUpload(project: SavedProject) {
  const history = Array.isArray(project.thumbnailHistory) ? project.thumbnailHistory : [];
  const selectedThumbnail = history.find((item) => item.id === project.selectedThumbnailId && item.imageData);
  if (selectedThumbnail?.imageData) return selectedThumbnail.imageData;
  if (project.thumbnail) return project.thumbnail;
  const latestGeneratedThumbnail = [...history].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (latestGeneratedThumbnail?.imageData) return latestGeneratedThumbnail.imageData;
  const firstSceneImage = project.assets?.find((asset) => asset.imageData)?.imageData;
  return firstSceneImage || '';
}

async function recommendThumbnailMeta(options: { project: SavedProject; item: PromptedImageAsset; studioState: StudioState | null; }) {
  const { project, item, studioState } = options;
  const fallbackTitle = buildRecommendedThumbnailTitle(project, item);
  const fallbackDescription = buildRecommendedThumbnailDescription(project, item);
  const model = studioState?.routing?.sceneModel || studioState?.routing?.scriptModel || 'openrouter/auto';
  const context = [
    `프로젝트 주제: ${project.topic || project.name || '프로젝트'}`,
    `썸네일 메인 문구: ${project.thumbnailTitle || item.label || fallbackTitle}`,
    `추가 디자인 요청: ${project.thumbnailPrompt || item.note || item.prompt || '기본 연출'}`,
    `대표 캐릭터: ${getSelectedCharacters(project)[0]?.name || '주인공'}`,
    `장면 톤: ${project.workflowDraft?.selections?.mood || '선명한 클릭 유도 톤'}`,
  ].join('\n');

  const [titleResult, descriptionResult] = await Promise.all([
    runTextAi({
      system: '한국어 유튜브 썸네일 제목 추천 도우미다. 짧고 강한 한 줄만 반환하고, 따옴표나 번호는 쓰지 마라. 28자 안팎으로 유지해라.',
      user: `${context}\n위 정보로 클릭을 부르는 짧은 제목 한 줄만 제안해줘.`,
      model,
      maxTokens: 120,
      temperature: 0.85,
      fallback: fallbackTitle,
    }),
    runTextAi({
      system: '한국어 유튜브 썸네일 설명 추천 도우미다. 한두 문장으로 디자인 포인트와 장면 훅을 자연스럽게 설명해라.',
      user: `${context}\n위 정보로 추천 설명 1~2문장만 작성해줘.`,
      model,
      maxTokens: 220,
      temperature: 0.82,
      fallback: fallbackDescription,
    }),
  ]);

  return {
    title: titleResult.text.replace(/\s+/g, ' ').trim() || fallbackTitle,
    description: descriptionResult.text.replace(/\s+/g, ' ').trim() || fallbackDescription,
    source: titleResult.source === 'ai' || descriptionResult.source === 'ai' ? 'ai' as const : 'sample' as const,
  };
}

function buildProjectYoutubeMeta(project: SavedProject): YoutubeMetaDraft {
  const suggested = buildYoutubeMeta(project, {
    aspectRatio: project.workflowDraft?.aspectRatio || project.assets?.[0]?.aspectRatio || '16:9',
    durationSeconds: project.ttsDuration || project.sceneDuration || 0,
  });
  return {
    title: project.youtubeTitle?.trim() || suggested.title,
    description: project.youtubeDescription?.trim() || suggested.description,
    tags: Array.isArray(project.youtubeTags) && project.youtubeTags.length ? project.youtubeTags : suggested.tags,
    privacyStatus: 'private',
    isShortsEligible: suggested.isShortsEligible,
  };
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') throw new Error('clipboard unavailable');
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7 7.5A1.5 1.5 0 0 1 8.5 6h6A1.5 1.5 0 0 1 16 7.5v7A1.5 1.5 0 0 1 14.5 16h-6A1.5 1.5 0 0 1 7 14.5v-7Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12.5v-7A1.5 1.5 0 0 1 5.5 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
  const [thumbnailHeadline, setThumbnailHeadline] = useState('');
  const [promptText, setPromptText] = useState('');
  const [history, setHistory] = useState<PromptedImageAsset[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(null);
  const [activeThumbnailId, setActiveThumbnailId] = useState<string | null>(null);
  const [previewThumbnailId, setPreviewThumbnailId] = useState<string | null>(null);
  const [copyFeedbackMessage, setCopyFeedbackMessage] = useState<string | null>(null);
  const [studioState, setStudioState] = useState<StudioState>(() => createDefaultStudioState());
  const [showSettings, setShowSettings] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<YoutubeConnectionStatus>({ connected: false });
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
  const [isYoutubeUploading, setIsYoutubeUploading] = useState(false);
  const [youtubeModalMessage, setYoutubeModalMessage] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTagsInput, setYoutubeTagsInput] = useState('');
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const viewportCardClass = 'xl:h-[calc(100vh-300px)] xl:max-h-[calc(100vh-300px)]';

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
      setThumbnailHeadline(cached.thumbnailTitle || '');
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
      setThumbnailHeadline((prev) => prev || loaded.thumbnailTitle || buildAutoThumbnailHeadline(loaded));
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const state = await fetchStudioState({ force: true });
        if (!cancelled) setStudioState(state);
      } catch {
        if (!cancelled) setStudioState(createDefaultStudioState());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }, []);

  const activeThumbnail = useMemo(
    () => history.find((item) => item.id === activeThumbnailId) || null,
    [activeThumbnailId, history]
  );

  const previewThumbnail = useMemo(
    () => history.find((item) => item.id === previewThumbnailId) || null,
    [history, previewThumbnailId]
  );

  const heroThumbnail = useMemo(
    () => activeThumbnail
      || history.find((item) => item.id === selectedThumbnailId)
      || history[history.length - 1]
      || null,
    [activeThumbnail, history, selectedThumbnailId]
  );

  const textAiConnected = Boolean(studioState?.providers?.openRouterApiKey?.trim());

  const sampleHeroThumbnail = useMemo(() => {
    if (!project || heroThumbnail || textAiConnected) return null;
    return createSampleThumbnail(project, history.length, {
      titleText: thumbnailHeadline.trim() || buildAutoThumbnailHeadline(project),
      subtitleText: buildAutoThumbnailSupportText(project),
      customPrompt: promptText.trim(),
      similarPrompt: '',
    });
  }, [heroThumbnail, history.length, project, promptText, textAiConnected, thumbnailHeadline]);

  const heroDisplayImageData = heroThumbnail?.imageData || sampleHeroThumbnail?.dataUrl || '';

  const showCopyFeedback = useCallback((message: string) => {
    setCopyFeedbackMessage(message);
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedbackMessage(null);
      copyFeedbackTimerRef.current = null;
    }, 1000);
  }, []);

  const handleCopyText = useCallback(async (text: string, label: string) => {
    try {
      await copyTextToClipboard(text);
      showCopyFeedback(`${label} 복사됨`);
    } catch (error) {
      console.error('[ThumbnailStudio] copy failed', error);
      setStatusMessage('복사 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [showCopyFeedback]);

  const scrollStripBy = (direction: 'left' | 'right') => {
    const container = stripRef.current;
    if (!container) return;
    const amount = Math.max(280, Math.floor(container.clientWidth * 0.72));
    container.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const handleStripWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = stripRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    container.scrollBy({ left: event.deltaY, behavior: 'auto' });
  }, []);

  const scrollToCard = useCallback((cardId: string) => {
    const node = cardRefs.current[cardId];
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, []);

  const persistDraftHistory = useCallback(async (nextHistory: PromptedImageAsset[], extras?: Partial<SavedProject>) => {
    if (!project?.id) return null;
    const updated = await updateProject(project.id, {
      thumbnailHistory: nextHistory,
      thumbnailTitle: thumbnailHeadline.trim() || project.thumbnailTitle || project.topic || project.name,
      thumbnailPrompt: promptText.trim(),
      selectedThumbnailId,
      ...(extras || {}),
    });
    if (updated) {
      setProject(updated);
      rememberProjectNavigationProject(updated);
      return updated;
    }
    return null;
  }, [project, promptText, selectedThumbnailId, thumbnailHeadline]);

  const handleSaveThumbnailPrompt = useCallback(async () => {
    if (!project?.id) return;
    const updated = await updateProject(project.id, {
      thumbnailTitle: thumbnailHeadline.trim() || null,
      thumbnailPrompt: promptText.trim() || null,
    });
    if (updated) {
      setProject(updated);
      rememberProjectNavigationProject(updated);
      setStatusMessage('썸네일 메인 문구와 추가 디자인 요청을 현재 프로젝트 기준으로 저장했습니다.');
    }
  }, [project, promptText, thumbnailHeadline]);

  const handleAutoFillThumbnailText = useCallback(async () => {
    if (!project) return;
    const nextHeadline = buildAutoThumbnailHeadline(project);
    const nextPrompt = buildAutoThumbnailPromptHint(project);
    setThumbnailHeadline(nextHeadline);
    setPromptText(nextPrompt);
    setStatusMessage('대본 흐름과 현재 선택된 캐릭터, 화풍을 기준으로 메인 문구와 추가 디자인 요청을 채웠습니다.');
  }, [project]);

  const handleGenerateThumbnail = useCallback(async (similarTarget?: PromptedImageAsset | null) => {
    if (!project || isGenerating) return;

    const trimmedPrompt = promptText.trim();
    const resolvedHeadline = thumbnailHeadline.trim() || buildAutoThumbnailHeadline(project);
    const resolvedSubtitle = buildAutoThumbnailSupportText(project);
    const options = {
      titleText: resolvedHeadline,
      subtitleText: resolvedSubtitle,
      customPrompt: trimmedPrompt,
      similarPrompt: similarTarget?.prompt || '',
    };

    setIsGenerating(true);
    setStatusMessage(similarTarget ? '입력한 추가 요청을 기준으로 비슷한 결의 새 썸네일 후보를 만드는 중입니다.' : '프로젝트 대본과 현재 선택값을 기준으로 새 썸네일 후보를 만드는 중입니다.');

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
        label: buildThumbnailLabel(project, resolvedHeadline || trimmedPrompt),
        prompt,
        imageData: generated || sample.dataUrl,
        createdAt: Date.now(),
        kind: 'thumbnail',
        sourceMode: generated ? (usesSampleImageFlow ? 'sample' : 'ai') : 'sample',
        note: [
          trimmedPrompt ? `추가 요청: ${trimmedPrompt}` : '프로젝트 대본과 선택값 기준으로 생성',
          similarTarget ? '기존 썸네일과 비슷한 느낌으로 재생성' : '새 썸네일 후보',
        ].filter(Boolean).join(' · '),
        groupId: 'thumbnail-studio-history',
        groupLabel: '썸네일 후보',
      };

      const nextHistory = [...history, entry];
      const recommendedMeta = await recommendThumbnailMeta({ project, item: entry, studioState });
      setHistory(nextHistory);
      setActiveThumbnailId(entry.id);
      const updated = await persistDraftHistory(nextHistory, {
        youtubeTitle: recommendedMeta.title,
        youtubeDescription: recommendedMeta.description,
      });
      if (updated) {
        setProject(updated);
      }
      scrollToCard(entry.id);
      setStatusMessage(
        recommendedMeta.source === 'ai'
          ? (similarTarget ? '비슷한 결의 새 썸네일 후보와 추천 제목·내용을 자동 갱신했습니다.' : '새 썸네일 후보와 추천 제목·내용을 자동 갱신했습니다.')
          : (similarTarget ? 'AI 연결이 없어 비슷한 결의 샘플 썸네일과 샘플 추천 제목·내용을 함께 채웠습니다.' : 'AI 연결이 없어 샘플 썸네일과 샘플 추천 제목·내용을 함께 채웠습니다.')
      );
    } catch (error) {
      console.error('[ThumbnailStudio] generate failed', error);
      setStatusMessage('썸네일 생성 중 오류가 발생했습니다. 입력값은 유지되었으니 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [history, isGenerating, persistDraftHistory, project, promptText, scrollToCard, studioState, thumbnailHeadline]);

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
        thumbnailTitle: thumbnailHeadline.trim() || resolvedThumbnail.label || project.topic || project.name,
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
  }, [activeThumbnail, history, isSavingSelection, project, promptText, thumbnailHeadline]);

  const refreshYoutubeStatus = useCallback(async () => {
    setIsYoutubeLoading(true);
    try {
      const status = await fetchYoutubeConnectionStatus();
      setYoutubeStatus(status);
      return status;
    } catch (error) {
      console.error('[ThumbnailStudio] youtube status failed', error);
      const fallback = { connected: false, error: '유튜브 연결 상태를 확인하지 못했습니다.' } satisfies YoutubeConnectionStatus;
      setYoutubeStatus(fallback);
      return fallback;
    } finally {
      setIsYoutubeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isYoutubeModalOpen || !project) return;
    const meta = buildProjectYoutubeMeta(project);
    setYoutubeTitle(meta.title);
    setYoutubeDescription(meta.description);
    setYoutubeTagsInput(meta.tags.join(', '));
    setYoutubeModalMessage('');
    void refreshYoutubeStatus();
  }, [isYoutubeModalOpen, project, refreshYoutubeStatus]);

  const handleSaveStudioSettings = useCallback(async (partial: Partial<StudioState>) => {
    const updated = await saveStudioState(partial);
    setStudioState(updated);
    return updated;
  }, []);

  const handleAutoFillYoutubeMeta = useCallback(() => {
    if (!project) return;
    const meta = buildProjectYoutubeMeta(project);
    setYoutubeTitle(meta.title);
    setYoutubeDescription(meta.description);
    setYoutubeTagsInput(meta.tags.join(', '));
    setYoutubeModalMessage('현재 프로젝트 대본과 영상 비율을 기준으로 제목, 설명, 태그를 다시 채웠습니다.');
  }, [project]);

  const handleYoutubeUpload = useCallback(async () => {
    if (!project || isYoutubeUploading) return;
    if (!project.assets?.length) {
      setYoutubeModalMessage('생성된 씬이 없어 업로드할 수 없습니다. 먼저 영상을 제작해 주세요.');
      return;
    }

    const latestStatus = await refreshYoutubeStatus();
    if (!latestStatus.connected) {
      setYoutubeModalMessage('유튜브가 아직 연결되지 않아 설정을 열었습니다. 설정에서 OAuth를 연결한 뒤 다시 비공개 업로드를 눌러 주세요.');
      setShowSettings(true);
      return;
    }

    const meta: YoutubeMetaDraft = {
      title: youtubeTitle.trim() || `${project.topic || project.name} 영상`,
      description: youtubeDescription.trim() || `${project.topic || project.name} 프로젝트 영상`,
      tags: youtubeTagsInput.split(',').map((item) => item.trim()).filter(Boolean),
      privacyStatus: 'private',
      isShortsEligible: buildProjectYoutubeMeta(project).isShortsEligible,
    };

    setIsYoutubeUploading(true);
    setYoutubeModalMessage('최종 mp4를 만든 뒤 유튜브 비공개 업로드를 진행하는 중입니다.');

    try {
      const updatedUploading = await updateProject(project.id, {
        youtubeConnectedAccount: {
          email: latestStatus.email || null,
          channelId: latestStatus.channelId || null,
          channelTitle: latestStatus.channelTitle || null,
        },
        youtubeChannelTitle: latestStatus.channelTitle || null,
        youtubeUploadStatus: 'uploading',
        youtubeTitle: meta.title,
        youtubeDescription: meta.description,
        youtubeTags: meta.tags,
        youtubePrivacyStatus: 'private',
        isShortsEligible: meta.isShortsEligible,
        uploadErrorMessage: null,
      });
      const sourceProject = updatedUploading || project;
      if (updatedUploading) {
        setProject(updatedUploading);
        rememberProjectNavigationProject(updatedUploading);
      }

      const render = await renderVideoWithFfmpeg({
        assets: sourceProject.assets || [],
        backgroundTracks: sourceProject.backgroundMusicTracks || [],
        previewMix: sourceProject.previewMix,
        aspectRatio: sourceProject.workflowDraft?.aspectRatio || sourceProject.assets?.[0]?.aspectRatio || '16:9',
        qualityMode: 'final',
        enableSubtitles: Boolean(sourceProject.assets?.some((item) => item.subtitleData || item.audioData)),
        subtitlePreset: sourceProject.subtitlePreset || null,
        title: meta.title,
      });

      const file = new File([render.videoBlob], `mp4Creater_${sourceProject.id}.mp4`, { type: 'video/mp4' });
      const uploaded = await uploadVideoToYoutube({ file, meta });
      const uploadedAt = typeof uploaded?.uploadedAt === 'number'
        ? uploaded.uploadedAt
        : uploaded?.uploadedAt
          ? Date.parse(String(uploaded.uploadedAt))
          : Date.now();

      const updated = await updateProject(sourceProject.id, {
        youtubeConnectedAccount: {
          email: latestStatus.email || null,
          channelId: latestStatus.channelId || null,
          channelTitle: latestStatus.channelTitle || null,
        },
        youtubeChannelTitle: latestStatus.channelTitle || null,
        youtubeUploadStatus: 'uploaded',
        youtubeUploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : Date.now(),
        youtubeVideoId: uploaded?.videoId || null,
        youtubePrivacyStatus: 'private',
        youtubeTitle: meta.title,
        youtubeDescription: meta.description,
        youtubeTags: meta.tags,
        isShortsEligible: meta.isShortsEligible,
        uploadErrorMessage: null,
      });
      if (updated) {
        setProject(updated);
        rememberProjectNavigationProject(updated);
      }
      setYoutubeModalMessage('유튜브 비공개 업로드가 완료되었습니다.');
    } catch (error: any) {
      console.error('[ThumbnailStudio] youtube upload failed', error);
      const updated = await updateProject(project.id, {
        youtubeUploadStatus: 'error',
        youtubeTitle: youtubeTitle.trim() || null,
        youtubeDescription: youtubeDescription.trim() || null,
        youtubeTags: youtubeTagsInput.split(',').map((item) => item.trim()).filter(Boolean),
        uploadErrorMessage: error?.message || '유튜브 업로드 중 오류가 발생했습니다.',
      });
      if (updated) {
        setProject(updated);
        rememberProjectNavigationProject(updated);
      }
      setYoutubeModalMessage(error?.message || '유튜브 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsYoutubeUploading(false);
    }
  }, [isYoutubeUploading, project, refreshYoutubeStatus, youtubeDescription, youtubeTagsInput, youtubeTitle]);

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
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-600">thumbnail studio</div>
              <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-[28px]">설정 한 장, 히스토리 한 장으로 가볍게 보는 썸네일 작업 화면</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                기본 프롬프트는 개발단에서 대본, 캐릭터, 화풍, 씬 이미지를 자동 반영합니다. 여기서는 메인 문구와 추가 요청만 가볍게 다듬고, 오른쪽 히스토리에서 후보를 골라 대표 썸네일을 확정하면 됩니다.
              </p>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{errorMessage}</div>
          ) : null}

          {statusMessage ? (
            <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{statusMessage}</div>
          ) : null}
        </section>

        {project && (
          <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
            <section className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm ${viewportCardClass}`}>
              <div className="flex h-full flex-col gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">thumbnail inputs</div>
                  <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">왼쪽에서 문구와 업로드 정보만 빠르게 정리</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">메인 문구와 추가 요청을 다듬고, 업로드 설정은 여기서 바로 엽니다.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-sm font-black text-slate-800">썸네일 메인 문구</div>
                  <input
                    value={thumbnailHeadline}
                    onChange={(e) => setThumbnailHeadline(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                    placeholder="비워두면 대본 기준 자동 추천 문구를 사용합니다"
                  />
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-sm font-black text-slate-800">추가 디자인 요청</div>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                    placeholder="예: 노란 타이포, 놀란 표정 강조, 붉은 포인트 조명, 왼쪽 인물 크게"
                  />
                </div>

                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-600">youtube upload</div>
                      <div className="mt-1 text-sm font-black text-slate-900">유튜브 업로드 설정</div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">썸네일 확정 후 바로 비공개 업로드 정보를 열 수 있습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsYoutubeModalOpen(true)}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500"
                    >
                      업로드 설정 열기
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleAutoFillThumbnailText()}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  추천하기
                </button>
              </div>
            </section>

<section className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm ${viewportCardClass}`}>
  <div className="flex h-full min-h-0 flex-col">
    {/* 상단 헤더 영역 */}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">thumbnail generate</div>
        <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">오른쪽에서 후보를 만들고 바로 대표 이미지를 고릅니다</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">AI가 없으면 샘플 썸네일과 샘플 워딩으로 바로 흐름을 확인할 수 있습니다.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleGenerateThumbnail(null)}
          disabled={isGenerating || !project}
          className="rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
        >
          {isGenerating ? '썸네일 생성 중...' : '썸네일 생성'}
        </button>
      </div>
    </div>

    {/* 하단 히스토리 영역: grid를 제거하고 w-full 설정 */}
    <div className="mt-4 flex min-h-0 w-full flex-col gap-4">
      <div className="flex min-h-0 flex-col gap-4">

        {/* 타이틀 및 네비게이션 버튼 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">썸네일 후보 히스토리</div>
            <div className="mt-1 text-sm font-black text-slate-900">후보 비교 후 대표 이미지를 고르세요</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => scrollStripBy('left')} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" aria-label="썸네일 후보 왼쪽으로">←</button>
            <button type="button" onClick={() => scrollStripBy('right')} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" aria-label="썸네일 후보 오른쪽으로">→</button>
          </div>
        </div>

        {/* 가로 스크롤 리스트 영역 */}
        <div ref={stripRef} onWheel={handleStripWheel} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {!history.length ? (
            <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm leading-6 text-slate-500">
              오른쪽 생성 버튼으로 첫 후보를 만들면 여기서 대표 이미지를 고를 수 있습니다.
            </div>
          ) : null}

          {history.map((item) => {
            const isActive = item.id === activeThumbnailId;
            const isFinal = item.id === selectedThumbnailId;
            return (
              <div
                key={item.id}
                ref={(node) => {
                  cardRefs.current[item.id] = node;
                }}
                onClick={() => setActiveThumbnailId(item.id)}
                className={`w-[360px] shrink-0 snap-start overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition ${isActive ? 'border-fuchsia-400 ring-2 ring-fuchsia-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-fuchsia-200'}`}
              >
                {/* 카드 내부 콘텐츠 (기존 유지) */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveThumbnailId(item.id);
                    setPreviewThumbnailId(item.id);
                  }}
                  className="block w-full overflow-hidden border-b border-slate-200 bg-slate-100"
                >
                  <img src={resolveImageSrc(item.imageData)} alt={item.label} className="aspect-video w-full object-cover" />
                </button>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{item.label || '썸네일 후보'}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isFinal ? 'bg-emerald-600 text-white' : isActive ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{isFinal ? '대표' : isActive ? '선택 중' : '후보'}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-slate-500">{item.note || item.prompt}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={(event) => { event.stopPropagation(); setActiveThumbnailId(item.id); setPreviewThumbnailId(item.id); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">크게 보기</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setActiveThumbnailId(item.id); void handleSelectFinalThumbnail(item); }} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">대표 사진으로 지정</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); void handleGenerateThumbnail(item); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">비슷하게 재생성</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
</section>
          </div>
        )}
      </main>

      <OverlayModal
        open={Boolean(previewThumbnail && project)}
        title={previewThumbnail?.label || '썸네일 크게 보기'}
        description="클릭한 썸네일을 크게 보면서 제목과 설명 추천 문구까지 함께 검토합니다."
        onClose={() => setPreviewThumbnailId(null)}
        dialogClassName="max-w-5xl"
        bodyClassName="max-h-[76vh] overflow-y-auto"
        footer={previewThumbnail && project ? (
          <>
            <button
              type="button"
              onClick={() => {
                void handleCopyText(buildRecommendedThumbnailTitle(project, previewThumbnail), '추천 제목');
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <CopyIcon />
              제목 복사
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopyText(buildRecommendedThumbnailDescription(project, previewThumbnail), '추천 설명');
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <CopyIcon />
              설명 복사
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSelectFinalThumbnail(previewThumbnail);
                setPreviewThumbnailId(null);
              }}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              이 썸네일을 대표로 저장
            </button>
          </>
        ) : undefined}
      >
        {previewThumbnail && project ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
              <img src={resolveImageSrc(previewThumbnail.imageData)} alt={previewThumbnail.label} className="w-full object-cover" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 제목</div>
                <div className="mt-2 text-lg font-black leading-7 text-slate-900">{buildRecommendedThumbnailTitle(project, previewThumbnail)}</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 설명</div>
                <p className="mt-2 text-sm leading-7 text-slate-700">{buildRecommendedThumbnailDescription(project, previewThumbnail)}</p>
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">썸네일 생성 메모</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{previewThumbnail.note || previewThumbnail.prompt}</p>
            </div>
          </div>
        ) : null}
      </OverlayModal>

      <OverlayModal
        open={Boolean(isYoutubeModalOpen && project)}
        title={project ? `${project.name} 유튜브 업로드` : '유튜브 업로드'}
        description="썸네일 제작 페이지 안에서 제목, 설명, 태그를 확인한 뒤 비공개 업로드를 진행합니다. 유튜브가 아직 연결되지 않았으면 비공개 업로드를 누를 때 설정 창을 바로 엽니다."
        onClose={() => {
          if (isYoutubeUploading) return;
          setIsYoutubeModalOpen(false);
          setYoutubeModalMessage('');
        }}
        dialogClassName="max-w-4xl"
        bodyClassName="max-h-[76vh] overflow-y-auto"
        footer={project ? (
          <>
            <button
              type="button"
              onClick={() => handleAutoFillYoutubeMeta()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              제목 / 설명 자동 만들기
            </button>
            <button
              type="button"
              onClick={() => void handleYoutubeUpload()}
              disabled={isYoutubeUploading || !project.assets?.length}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isYoutubeUploading ? '업로드 중...' : '비공개 업로드'}
            </button>
          </>
        ) : undefined}
      >
        {project ? (
          <div className="space-y-4">
            <div className={`rounded-[24px] border px-4 py-4 text-sm ${youtubeStatus.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {youtubeStatus.connected
                ? `연결됨 · ${youtubeStatus.channelTitle || youtubeStatus.email || '유튜브 계정'}${isYoutubeLoading ? ' · 상태 확인 중' : ''}`
                : '유튜브가 아직 연결되지 않았습니다. 비공개 업로드를 누르면 설정 창을 열어 OAuth 연결부터 진행합니다.'}
            </div>

            {youtubeModalMessage ? (
              <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm font-bold text-sky-700">
                {youtubeModalMessage}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">업로드 정보</div>
                  <div className="mt-2">공개범위: <span className="font-black text-slate-900">비공개 고정</span></div>
                  <div>쇼츠 가능: <span className="font-black text-slate-900">{buildProjectYoutubeMeta(project).isShortsEligible ? '충족' : '미충족'}</span></div>
                  <div>마지막 업로드 상태: <span className="font-black text-slate-900">{project.youtubeUploadStatus || 'idle'}</span></div>
                  {project.youtubeUploadedAt ? <div>업로드 시각: <span className="font-black text-slate-900">{new Date(project.youtubeUploadedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span></div> : null}
                  {project.youtubeVideoId ? <div>영상 ID: <span className="font-black text-slate-900">{project.youtubeVideoId}</span></div> : null}
                </div>

                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
                  {resolveProjectThumbnailForUpload(project) ? (
                    <img src={resolveImageSrc(resolveProjectThumbnailForUpload(project))} alt={project.name} className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center px-6 text-center text-sm leading-6 text-slate-500">
                      대표 이미지가 없으면 프로젝트 첫 장면을 기준으로 업로드합니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <div className="mb-2 text-sm font-black text-slate-800">영상 제목</div>
                  <input
                    value={youtubeTitle}
                    onChange={(event) => setYoutubeTitle(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder="유튜브 제목"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-black text-slate-800">영상 설명</div>
                  <textarea
                    value={youtubeDescription}
                    onChange={(event) => setYoutubeDescription(event.target.value)}
                    rows={9}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder="유튜브 설명"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-black text-slate-800">태그</div>
                  <input
                    value={youtubeTagsInput}
                    onChange={(event) => setYoutubeTagsInput(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder="쉼표로 구분"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </OverlayModal>

      <SettingsDrawer
        open={showSettings}
        studioState={studioState}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveStudioSettings}
        youtubeSectionVariant="collapsed-bottom"
      />

      {copyFeedbackMessage ? (
        <div className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center px-4">
          <div className="rounded-[24px] bg-slate-950/92 px-6 py-4 text-sm font-black text-white shadow-2xl">
            {copyFeedbackMessage}
          </div>
        </div>
      ) : null}

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
