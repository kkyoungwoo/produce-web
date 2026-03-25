'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '../components/Header';
import { LoadingOverlay, StudioPageSkeleton } from '../components/LoadingOverlay';
import { OverlayModal } from '../components/inputSection/ui';
import { getProjectById, updateProject } from '../services/projectService';
import { renderVideoWithFfmpeg } from '../services/serverRenderService';
import { buildYoutubeMeta } from '../services/projectEnhancementService';
import { disconnectYoutubeAccount, fetchYoutubeConnectionStatus, openYoutubeConnectWindow, uploadVideoToYoutube, type YoutubeConnectionStatus } from '../services/youtubeService';
import { generateImage, getSelectedImageModel, isSampleImageModel } from '../services/imageService';
import { readProjectNavigationProject, rememberProjectNavigationProject } from '../services/projectNavigationCache';
import {
  buildThumbnailPrompt,
  buildThumbnailScene,
  createSampleThumbnail,
  buildThumbnailLabel,
} from '../services/thumbnailService';
import { CharacterProfile, PromptedImageAsset, ReferenceImages, SavedProject, YoutubeMetaDraft } from '../types';

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
  const [youtubeStatus, setYoutubeStatus] = useState<YoutubeConnectionStatus>({ connected: false });
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
  const [isYoutubeUploading, setIsYoutubeUploading] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTagsInput, setYoutubeTagsInput] = useState('');
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const hydratedProjectIdRef = useRef<string | null>(null);

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
      setYoutubeTitle(cached.youtubeTitle || '');
      setYoutubeDescription(cached.youtubeDescription || '');
      setYoutubeTagsInput(Array.isArray(cached.youtubeTags) ? cached.youtubeTags.join(', ') : '');
      hydratedProjectIdRef.current = cached.id;
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
      setThumbnailHeadline((prev) => prev || loaded.thumbnailTitle || '');
      setPromptText((prev) => prev || loaded.thumbnailPrompt || '');
      setHistory(Array.isArray(loaded.thumbnailHistory) ? loaded.thumbnailHistory : []);
      setSelectedThumbnailId(loaded.selectedThumbnailId || null);
      setActiveThumbnailId((current) => current || loaded.selectedThumbnailId || loaded.thumbnailHistory?.[loaded.thumbnailHistory.length - 1]?.id || null);
      if (hydratedProjectIdRef.current !== loaded.id) {
        setYoutubeTitle(loaded.youtubeTitle || '');
        setYoutubeDescription(loaded.youtubeDescription || '');
        setYoutubeTagsInput(Array.isArray(loaded.youtubeTags) ? loaded.youtubeTags.join(', ') : '');
        hydratedProjectIdRef.current = loaded.id;
      }
      rememberProjectNavigationProject(loaded);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }, []);

  const refreshYoutubeStatus = useCallback(async () => {
    setIsYoutubeLoading(true);
    try {
      const status = await fetchYoutubeConnectionStatus();
      setYoutubeStatus(status);
    } catch (error) {
      console.error('[ThumbnailStudio] youtube status failed', error);
    } finally {
      setIsYoutubeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshYoutubeStatus();
  }, [refreshYoutubeStatus]);

  const activeThumbnail = useMemo(
    () => history.find((item) => item.id === activeThumbnailId) || null,
    [activeThumbnailId, history]
  );

  const previewThumbnail = useMemo(
    () => history.find((item) => item.id === previewThumbnailId) || null,
    [history, previewThumbnailId]
  );

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

  const persistDraftHistory = useCallback(async (nextHistory: PromptedImageAsset[]) => {
    if (!project?.id) return;
    const updated = await updateProject(project.id, {
      thumbnailHistory: nextHistory,
      thumbnailTitle: thumbnailHeadline.trim() || project.thumbnailTitle || project.topic || project.name,
      thumbnailPrompt: promptText.trim(),
      selectedThumbnailId,
    });
    if (updated) {
      setProject(updated);
      rememberProjectNavigationProject(updated);
    }
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
      setStatusMessage('썸네일 문구와 디자인 프롬프트를 현재 프로젝트 기준으로 저장했습니다.');
    }
  }, [project, promptText, thumbnailHeadline]);

  const handleAutoFillThumbnailText = useCallback(async () => {
    if (!project) return;
    const nextHeadline = buildAutoThumbnailHeadline(project);
    const nextPrompt = promptText.trim() || '선택된 프로젝트 이미지 기반, 큰 한글 제목 타이포, 강한 대비, 깔끔한 유튜브 썸네일 디자인, 클릭 유도형 배치';
    setThumbnailHeadline(nextHeadline);
    setPromptText(nextPrompt);
    setStatusMessage('현재 프로젝트 대본과 캐릭터 기준으로 썸네일 문구와 기본 디자인 프롬프트를 채웠습니다.');
  }, [project, promptText]);

  const handleAutoFillYoutubeMeta = useCallback(() => {
    if (!project) return;
    const meta = buildYoutubeMeta(project, {
      aspectRatio: project.workflowDraft?.aspectRatio || project.assets?.[0]?.aspectRatio || '16:9',
      durationSeconds: project.ttsDuration || project.sceneDuration || 0,
    });
    setYoutubeTitle(meta.title);
    setYoutubeDescription(meta.description);
    setYoutubeTagsInput(meta.tags.join(', '));
    setStatusMessage('대본 느낌과 영상 비율을 바탕으로 제목, 설명, 태그를 자동 제안했습니다.');
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
        label: buildThumbnailLabel(project, resolvedHeadline || trimmedPrompt),
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
      await persistDraftHistory(nextHistory);
      scrollToCard(entry.id);
      setStatusMessage(similarTarget ? '비슷한 결의 새 썸네일 후보가 오른쪽에 추가되었습니다.' : '새 썸네일 후보가 오른쪽에 추가되었습니다.');
    } catch (error) {
      console.error('[ThumbnailStudio] generate failed', error);
      setStatusMessage('썸네일 생성 중 오류가 발생했습니다. 입력값은 유지되었으니 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [history, isGenerating, persistDraftHistory, project, promptText, scrollToCard, thumbnailHeadline]);

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

  const handleDisconnectYoutube = useCallback(async () => {
    try {
      await disconnectYoutubeAccount();
      setYoutubeStatus({ connected: false });
      setStatusMessage('유튜브 연결을 해제했습니다.');
      if (project?.id) {
        const updated = await updateProject(project.id, {
          youtubeConnectedAccount: null,
          youtubeChannelTitle: null,
        });
        if (updated) {
          setProject(updated);
          rememberProjectNavigationProject(updated);
        }
      }
    } catch (error) {
      console.error('[ThumbnailStudio] youtube disconnect failed', error);
      setStatusMessage('유튜브 연결 해제 중 오류가 발생했습니다.');
    }
  }, [project]);

  const handleYoutubeUpload = useCallback(async () => {
    if (!project || isYoutubeUploading) return;
    if (!youtubeStatus.connected) {
      openYoutubeConnectWindow();
      return;
    }

    const meta: YoutubeMetaDraft = {
      title: youtubeTitle.trim() || `${project.topic || project.name} 영상`,
      description: youtubeDescription.trim() || `${project.topic || project.name} 프로젝트 영상`,
      tags: youtubeTagsInput.split(',').map((item) => item.trim()).filter(Boolean),
      privacyStatus: 'private',
      isShortsEligible: buildYoutubeMeta(project, {
        aspectRatio: project.workflowDraft?.aspectRatio || project.assets?.[0]?.aspectRatio || '16:9',
        durationSeconds: project.ttsDuration || project.sceneDuration || 0,
      }).isShortsEligible,
    };

    setIsYoutubeUploading(true);
    setStatusMessage('최종 mp4를 ffmpeg로 만든 뒤 유튜브 비공개 업로드를 진행하는 중입니다.');

    try {
      const updatedUploading = await updateProject(project.id, {
        youtubeConnectedAccount: youtubeStatus.connected ? {
          email: youtubeStatus.email || null,
          channelId: youtubeStatus.channelId || null,
          channelTitle: youtubeStatus.channelTitle || null,
        } : null,
        youtubeChannelTitle: youtubeStatus.channelTitle || null,
        youtubeUploadStatus: 'uploading',
        youtubeTitle: meta.title,
        youtubeDescription: meta.description,
        youtubeTags: meta.tags,
        youtubePrivacyStatus: 'private',
        isShortsEligible: meta.isShortsEligible,
        uploadErrorMessage: null,
      });
      if (updatedUploading) {
        setProject(updatedUploading);
        rememberProjectNavigationProject(updatedUploading);
      }

      const render = await renderVideoWithFfmpeg({
        assets: project.assets || [],
        backgroundTracks: project.backgroundMusicTracks || [],
        previewMix: project.previewMix,
        aspectRatio: project.workflowDraft?.aspectRatio || project.assets?.[0]?.aspectRatio || '16:9',
        qualityMode: 'final',
        enableSubtitles: Boolean(project.assets?.some((item) => item.subtitleData || item.audioData)),
        subtitlePreset: project.subtitlePreset || null,
        title: meta.title,
      });

      const file = new File([render.videoBlob], `mp4Creater_${project.id}.mp4`, { type: 'video/mp4' });
      const uploaded = await uploadVideoToYoutube({ file, meta });
      const uploadedAt = typeof uploaded?.uploadedAt === 'number'
        ? uploaded.uploadedAt
        : uploaded?.uploadedAt
          ? Date.parse(String(uploaded.uploadedAt))
          : Date.now();

      const updated = await updateProject(project.id, {
        youtubeConnectedAccount: youtubeStatus.connected ? {
          email: youtubeStatus.email || null,
          channelId: youtubeStatus.channelId || null,
          channelTitle: youtubeStatus.channelTitle || null,
        } : null,
        youtubeChannelTitle: youtubeStatus.channelTitle || null,
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
      setStatusMessage('유튜브 비공개 업로드가 완료되었습니다.');
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
      setStatusMessage(error?.message || '유튜브 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsYoutubeUploading(false);
    }
  }, [isYoutubeUploading, project, youtubeDescription, youtubeStatus, youtubeTagsInput, youtubeTitle]);

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
                <h2 className="mt-2 text-xl font-black text-slate-900">문구는 직접, 디자인은 프롬프트로 관리하고 생성은 버튼으로만 실행합니다</h2>
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                    <label className="block">
                      <div className="mb-2 text-sm font-black text-slate-800">썸네일 메인 문구</div>
                      <input
                        value={thumbnailHeadline}
                        onChange={(e) => setThumbnailHeadline(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                        placeholder="예: 클릭을 부르는 한 줄 제목"
                      />
                    </label>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">자동 보조 문구</div>
                      <div className="mt-2 font-bold text-slate-800">{buildAutoThumbnailSupportText(project)}</div>
                      <div className="mt-2">현재 프로젝트 첫 장면과 대본을 바탕으로 보조 문구를 자동 반영합니다. 메인 문구만 바꿔도 샘플 썸네일과 AI 프롬프트에 함께 들어갑니다.</div>
                    </div>
                  </div>
                  <label className="block">
                    <div className="mb-2 text-sm font-black text-slate-800">디자인 프롬프트</div>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={7}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                      placeholder="예: 프로젝트 장면 이미지를 배경 레퍼런스로 활용, 주인공 클로즈업, 큰 한글 제목 타이포, 강한 대비, 클릭을 부르는 유튜브 썸네일"
                    />
                  </label>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                    현재 프로젝트 캐릭터 이미지, 선택 화풍, 생성된 씬 이미지까지 함께 참고해서 썸네일을 만듭니다. 자동 채우기는 버튼을 눌렀을 때만 실행되고, 생성도 버튼을 눌렀을 때만 시작됩니다.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAutoFillThumbnailText()}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      문구 / 프롬프트 자동 채우기
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveThumbnailPrompt()}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      현재 프롬프트 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateThumbnail(null)}
                      disabled={isGenerating || !project}
                      className="rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
                    >
                      {isGenerating ? '썸네일 생성 중...' : '썸네일 만들기'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">youtube upload</div>
                <h2 className="mt-2 text-xl font-black text-slate-900">썸네일 확인 뒤 바로 유튜브 비공개 업로드</h2>
                <div className="mt-5 space-y-4">
                  <div className={`rounded-[24px] border px-4 py-4 text-sm ${youtubeStatus.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {youtubeStatus.connected
                      ? `연결됨 · ${youtubeStatus.channelTitle || youtubeStatus.email || '유튜브 계정'}`
                      : '아직 유튜브 계정이 연결되지 않았습니다. 연결 후 썸네일 화면에서 바로 비공개 업로드할 수 있습니다.'}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">업로드 조건</div>
                      <div className="mt-2">공개범위: <span className="font-black text-slate-900">비공개 고정</span></div>
                      <div>쇼츠 가능: <span className="font-black text-slate-900">{buildYoutubeMeta(project, { aspectRatio: project.workflowDraft?.aspectRatio || project.assets?.[0]?.aspectRatio || '16:9', durationSeconds: project.ttsDuration || project.sceneDuration || 0 }).isShortsEligible ? '충족' : '미충족'}</span></div>
                      <div>마지막 업로드 상태: <span className="font-black text-slate-900">{project.youtubeUploadStatus || 'idle'}</span></div>
                      {project.youtubeUploadedAt ? <div>업로드 시각: <span className="font-black text-slate-900">{new Date(project.youtubeUploadedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span></div> : null}
                      {project.youtubeVideoId ? <div>영상 ID: <span className="font-black text-slate-900">{project.youtubeVideoId}</span></div> : null}
                    </div>

                    <div className="flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (youtubeStatus.connected) {
                            void refreshYoutubeStatus();
                          } else {
                            openYoutubeConnectWindow();
                          }
                        }}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                      >
                        {youtubeStatus.connected ? (isYoutubeLoading ? '연결 상태 확인 중...' : '연결 상태 새로고침') : '유튜브 연결'}
                      </button>
                      {youtubeStatus.connected ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnectYoutube()}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          연결 해제
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleYoutubeUpload()}
                        disabled={isYoutubeUploading || !project.assets?.length}
                        className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isYoutubeUploading ? '업로드 중...' : '비공개 업로드'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAutoFillYoutubeMeta()}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      제목 / 설명 자동 만들기
                    </button>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold leading-6 text-slate-600">
                      자동 채우기는 버튼을 눌렀을 때만 실행됩니다.
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <label className="block">
                      <div className="mb-2 text-sm font-black text-slate-800">영상 제목</div>
                      <input
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                        placeholder="유튜브 제목"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-sm font-black text-slate-800">영상 설명</div>
                      <textarea
                        value={youtubeDescription}
                        onChange={(e) => setYoutubeDescription(e.target.value)}
                        rows={5}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                        placeholder="유튜브 설명"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-sm font-black text-slate-800">태그</div>
                      <input
                        value={youtubeTagsInput}
                        onChange={(e) => setYoutubeTagsInput(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                        placeholder="tag1, tag2, tag3"
                      />
                    </label>
                    {project.uploadErrorMessage ? (
                      <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{project.uploadErrorMessage}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">현재 선택 미리보기</div>
                    <h2 className="mt-2 text-xl font-black text-slate-900">한 화면에서 현재 후보와 추천 문구를 바로 확인</h2>
                  </div>
                  {activeThumbnail ? (
                    <button
                      type="button"
                      onClick={() => setPreviewThumbnailId(activeThumbnail.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      크게 보기
                    </button>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                  <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                    {activeThumbnail ? (
                      <img src={resolveImageSrc(activeThumbnail.imageData)} alt={activeThumbnail.label} className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center px-6 text-center text-sm font-bold text-slate-500">
                        아직 생성된 썸네일이 없습니다. 왼쪽에서 문구와 프롬프트를 정한 뒤 썸네일 만들기 버튼을 눌러 주세요.
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">현재 메인 문구</div>
                      <div className="mt-2 text-lg font-black leading-7 text-slate-900">{thumbnailHeadline.trim() || buildAutoThumbnailHeadline(project)}</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 제목</div>
                      <div className="mt-2 text-sm font-black leading-6 text-slate-900">{activeThumbnail ? buildRecommendedThumbnailTitle(project, activeThumbnail) : '후보 생성 후 자동 추천됩니다.'}</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 설명</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{activeThumbnail ? buildRecommendedThumbnailDescription(project, activeThumbnail) : '후보 생성 후 설명 문구도 함께 제안됩니다.'}</p>
                    </div>
                  </div>
                </div>
              </div>

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

                <div ref={stripRef} onWheel={handleStripWheel} className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
                  {!history.length ? (
                    <div className="flex w-full min-w-[280px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm leading-6 text-slate-500">
                      왼쪽 프롬프트 입력 아래의 썸네일 만들기 버튼으로 첫 후보를 생성해 주세요.
                    </div>
                  ) : null}
                  {history.map((item) => {
                    const isActive = item.id === activeThumbnailId;
                    const isFinal = item.id === selectedThumbnailId;
                    const recommendedTitle = buildRecommendedThumbnailTitle(project, item);
                    const recommendedDescription = buildRecommendedThumbnailDescription(project, item);
                    return (
                      <div
                        key={item.id}
                        ref={(node) => {
                          cardRefs.current[item.id] = node;
                        }}
                        onClick={() => setActiveThumbnailId(item.id)}
                        className={`w-[320px] shrink-0 snap-start overflow-hidden rounded-[28px] border bg-white text-left shadow-sm transition ${isActive ? 'border-fuchsia-400 ring-2 ring-fuchsia-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-fuchsia-200'}`}
                      >
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
                          <p className="line-clamp-3 text-xs leading-5 text-slate-500">{item.note || item.prompt}</p>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 제목</div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleCopyText(recommendedTitle, '추천 제목');
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                                aria-label="추천 제목 복사"
                              >
                                <CopyIcon />
                                복사
                              </button>
                            </div>
                            <div className="mt-2 text-sm font-black leading-6 text-slate-900">{recommendedTitle}</div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">추천 설명</div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleCopyText(recommendedDescription, '추천 설명');
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                                aria-label="추천 설명 복사"
                              >
                                <CopyIcon />
                                복사
                              </button>
                            </div>
                            <p className="mt-2 text-xs leading-6 text-slate-600">{recommendedDescription}</p>
                          </div>

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
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveThumbnailId(item.id);
                                setPreviewThumbnailId(item.id);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              크게 보기
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
