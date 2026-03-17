'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import StartupWizard from './components/StartupWizard';
import SettingsDrawer from './components/SettingsDrawer';
import InputSection from './components/InputSection';
import ResultTable from './components/ResultTable';
import ProjectGallery from './components/ProjectGallery';

import {
  GeneratedAsset,
  GenerationStep,
  ScriptScene,
  CostBreakdown,
  ReferenceImages,
  DEFAULT_REFERENCE_IMAGES,
  SavedProject,
  StudioState,
} from './types';

import {
  generateScript,
  generateScriptChunked,
  findTrendingTopics,
  generateAudioForScene,
  generateMotionPrompt,
} from './services/geminiService';

import { generateImage, getSelectedImageModel } from './services/imageService';
import { generateAudioWithElevenLabs } from './services/elevenLabsService';
import { generateVideo } from './services/videoService';
import { generateVideoFromImage, getFalApiKey } from './services/falService';
import {
  saveProject,
  getSavedProjects,
  deleteProject,
  migrateFromLocalStorage,
} from './services/projectService';
import {
  fetchStudioState,
  configureStorage,
  saveStudioState,
  createDefaultStudioState,
} from './services/localFileApi';

import { CONFIG, PRICING, formatKRW } from './config';
import * as FileSaver from 'file-saver';

const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ViewMode = 'main' | 'gallery';

const App: React.FC = () => {
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generatedData, setGeneratedData] = useState<GeneratedAsset[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);

  const [currentReferenceImages, setCurrentReferenceImages] =
    useState<ReferenceImages>(DEFAULT_REFERENCE_IMAGES);

  const [needsKey, setNeedsKey] = useState(false);
  const [animatingIndices, setAnimatingIndices] = useState<Set<number>>(new Set());

  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [studioState, setStudioState] = useState<StudioState | null>(null);
  const [showStartupWizard, setShowStartupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [, setCurrentTopic] = useState<string>('');
  const [, setCurrentCost] = useState<CostBreakdown | null>(null);

  const costRef = useRef<CostBreakdown>({
    images: 0,
    tts: 0,
    videos: 0,
    total: 0,
    imageCount: 0,
    ttsCharacters: 0,
    videoCount: 0,
  });

  const usedTopicsRef = useRef<string[]>([]);
  const assetsRef = useRef<GeneratedAsset[]>([]);
  const isAbortedRef = useRef(false);
  const isProcessingRef = useRef(false);

  const checkApiKeyStatus = useCallback(async () => {
    if ((window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setNeedsKey(!hasKey);
      return hasKey;
    }
    return true;
  }, []);

  useEffect(() => {
    checkApiKeyStatus();

    (async () => {
      try {
        const state = await fetchStudioState();
        setStudioState(state);
        setShowStartupWizard(!state.storageDir);
        if (!state.selectedCharacterId || state.characters.length === 0) {
          setShowStartupWizard(true);
        }

        if (state.providers?.openRouterApiKey) {
          localStorage.setItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY, state.providers.openRouterApiKey);
        }
      } catch {
        const fallback = createDefaultStudioState();
        setStudioState(fallback);
        setShowStartupWizard(true);
      }

      await migrateFromLocalStorage();
      const projects = await getSavedProjects();
      setSavedProjects(projects);
    })();

    return () => {
      isAbortedRef.current = true;
    };
  }, [checkApiKeyStatus]);

  const refreshProjects = useCallback(async () => {
    const projects = await getSavedProjects();
    setSavedProjects(projects);
    try {
      const state = await fetchStudioState();
      setStudioState(state);
    } catch {}
  }, []);

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setNeedsKey(false);
    }
  };

  const updateAssetAt = (index: number, updates: Partial<GeneratedAsset>) => {
    if (isAbortedRef.current) return;

    if (assetsRef.current[index]) {
      assetsRef.current[index] = { ...assetsRef.current[index], ...updates };
      setGeneratedData([...assetsRef.current]);
    }
  };

  const addCost = (type: 'image' | 'tts' | 'video', amount: number, count: number = 1) => {
    if (type === 'image') {
      costRef.current.images += amount;
      costRef.current.imageCount += count;
    } else if (type === 'tts') {
      costRef.current.tts += amount;
      costRef.current.ttsCharacters += count;
    } else if (type === 'video') {
      costRef.current.videos += amount;
      costRef.current.videoCount += count;
    }

    costRef.current.total =
      costRef.current.images + costRef.current.tts + costRef.current.videos;

    setCurrentCost({ ...costRef.current });
  };

  const resetCost = () => {
    costRef.current = {
      images: 0,
      tts: 0,
      videos: 0,
      total: 0,
      imageCount: 0,
      ttsCharacters: 0,
      videoCount: 0,
    };
    setCurrentCost(null);
  };

  const handleAbort = () => {
    isAbortedRef.current = true;
    isProcessingRef.current = false;
    setProgressMessage('🛑 작업 중단됨.');
    setStep(GenerationStep.COMPLETED);
  };

  const handleGenerate = useCallback(
    async (topic: string, refImgs: ReferenceImages, sourceText: string | null) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      isAbortedRef.current = false;

      setStep(GenerationStep.SCRIPTING);
      setProgressMessage('V9.2 Ultra 엔진 부팅 중...');

      try {
        const hasKey = await checkApiKeyStatus();
        if (!hasKey && (window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
        }

        setGeneratedData([]);
        assetsRef.current = [];
        setCurrentReferenceImages(refImgs);
        setCurrentTopic(topic);
        resetCost();

        const hasRefImages =
          (refImgs.character?.length || 0) + (refImgs.style?.length || 0) > 0;

        console.log(
          `[App] 참조 이미지 - 캐릭터: ${refImgs.character?.length || 0}개, 스타일: ${
            refImgs.style?.length || 0
          }개`
        );

        let targetTopic = topic;

        if (topic === 'Manual Script Input' && sourceText) {
          setProgressMessage('대본 분석 및 시각화 설계 중...');
        } else if (sourceText) {
          setProgressMessage('외부 콘텐츠 분석 중...');
          targetTopic = 'Custom Analysis Topic';
        } else {
          setProgressMessage('글로벌 경제 트렌드 탐색 중...');
          const trends = await findTrendingTopics(topic, usedTopicsRef.current);
          if (isAbortedRef.current) return;
          targetTopic = trends[0].topic;
          usedTopicsRef.current.push(targetTopic);
        }

        setProgressMessage('스토리보드 및 메타포 생성 중...');

        const inputLength = sourceText?.length || 0;
        const CHUNK_THRESHOLD = 3000;

        let scriptScenes: ScriptScene[];

        if (inputLength > CHUNK_THRESHOLD) {
          console.log(
            `[App] 긴 대본 감지: ${inputLength.toLocaleString()}자 → 청크 분할 처리`
          );
          setProgressMessage(
            `긴 대본(${inputLength.toLocaleString()}자) 청크 분할 처리 중...`
          );

          scriptScenes = await generateScriptChunked(
            targetTopic,
            hasRefImages,
            sourceText!,
            2500,
            setProgressMessage
          );
        } else {
          scriptScenes = await generateScript(targetTopic, hasRefImages, sourceText);
        }

        if (isAbortedRef.current) return;

        const initialAssets = scriptScenes.map(scene => ({
          ...scene,
          imageData: null,
          audioData: null,
          audioDuration: null,
          subtitleData: null,
          videoData: null,
          videoDuration: null,
          status: 'pending' as const,
        }));

        assetsRef.current = initialAssets;
        setGeneratedData(initialAssets);
        setStep(GenerationStep.ASSETS);

        const runAudio = async () => {
          const TTS_DELAY = 1500;
          const MAX_TTS_RETRIES = 2;

          for (let i = 0; i < initialAssets.length; i++) {
            if (isAbortedRef.current) break;

            setProgressMessage(`씬 ${i + 1}/${initialAssets.length} 음성 생성 중...`);
            let success = false;

            for (let attempt = 0; attempt <= MAX_TTS_RETRIES && !success; attempt++) {
              if (isAbortedRef.current) break;

              try {
                if (attempt > 0) {
                  console.log(
                    `[TTS] 씬 ${i + 1} 재시도 중... (${attempt}/${MAX_TTS_RETRIES})`
                  );
                  await wait(3000);
                }

                const elResult = await generateAudioWithElevenLabs(
                  assetsRef.current[i].narration
                );

                if (isAbortedRef.current) break;

                if (elResult.audioData) {
                  updateAssetAt(i, {
                    audioData: elResult.audioData,
                    subtitleData: elResult.subtitleData,
                    audioDuration: elResult.estimatedDuration,
                  });

                  const charCount = assetsRef.current[i].narration.length;
                  addCost('tts', charCount * PRICING.TTS.perCharacter, charCount);
                  success = true;

                  console.log(`[TTS] 씬 ${i + 1} 음성 생성 완료`);
                } else {
                  throw new Error('ElevenLabs 응답 없음');
                }
              } catch (e: any) {
                console.error(
                  `[TTS] 씬 ${i + 1} 실패 (시도 ${attempt + 1}):`,
                  e.message
                );

                if (e.message?.includes('429') || e.message?.includes('rate')) {
                  await wait(5000);
                }
              }
            }

            if (!success && !isAbortedRef.current) {
              try {
                console.log(`[TTS] 씬 ${i + 1} Gemini 폴백 시도...`);
                const fallbackAudio = await generateAudioForScene(
                  assetsRef.current[i].narration
                );
                updateAssetAt(i, { audioData: fallbackAudio });
              } catch (fallbackError) {
                console.error(`[TTS] 씬 ${i + 1} Gemini 폴백도 실패:`, fallbackError);
              }
            }

            if (i < initialAssets.length - 1 && !isAbortedRef.current) {
              await wait(TTS_DELAY);
            }
          }
        };

        const runImages = async () => {
          const MAX_RETRIES = 2;
          const imageModel = getSelectedImageModel();
          const imagePrice =
            PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;

          for (let i = 0; i < initialAssets.length; i++) {
            if (isAbortedRef.current) break;

            updateAssetAt(i, { status: 'generating' });
            let success = false;
            let lastError: any = null;

            for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
              if (isAbortedRef.current) break;

              try {
                if (attempt > 0) {
                  setProgressMessage(
                    `씬 ${i + 1} 이미지 재생성 시도 중... (${attempt}/${MAX_RETRIES})`
                  );
                  await wait(2000);
                }

                const img = await generateImage(assetsRef.current[i], refImgs);
                if (isAbortedRef.current) break;

                if (img) {
                  updateAssetAt(i, { imageData: img, status: 'completed' });
                  addCost('image', imagePrice, 1);
                  success = true;
                } else {
                  throw new Error('이미지 데이터가 비어있습니다');
                }
              } catch (e: any) {
                lastError = e;
                console.error(
                  `씬 ${i + 1} 이미지 생성 실패 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
                  e.message
                );

                if (e.message?.includes('API key not valid') || e.status === 400) {
                  setNeedsKey(true);
                  break;
                }
              }
            }

            if (!success && !isAbortedRef.current) {
              updateAssetAt(i, { status: 'error' });
              console.error(`씬 ${i + 1} 이미지 생성 최종 실패:`, lastError?.message);
            }

            await wait(50);
          }
        };

        setProgressMessage('시각 에셋 및 오디오 합성 중...');
        await Promise.all([runAudio(), runImages()]);

        if (isAbortedRef.current) return;

        setStep(GenerationStep.COMPLETED);

        const cost = costRef.current;
        const costMsg = `이미지 ${cost.imageCount}장 ${formatKRW(
          cost.images
        )} + TTS ${cost.ttsCharacters}자 ${formatKRW(cost.tts)} = 총 ${formatKRW(
          cost.total
        )}`;

        setProgressMessage(`생성 완료! ${costMsg}`);

        try {
          const savedProject = await saveProject(
            targetTopic,
            assetsRef.current,
            undefined,
            costRef.current
          );
          refreshProjects();
          setProgressMessage(`"${savedProject.name}" 저장됨 | ${costMsg}`);
        } catch (e) {
          console.error('프로젝트 자동 저장 실패:', e);
        }
      } catch (error: any) {
        if (!isAbortedRef.current) {
          setStep(GenerationStep.ERROR);
          setProgressMessage(`오류: ${error.message}`);
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [checkApiKeyStatus, refreshProjects]
  );

  const handleRegenerateImage = useCallback(
    async (idx: number) => {
      if (isProcessingRef.current) return;

      const MAX_RETRIES = 2;
      updateAssetAt(idx, { status: 'generating' });
      setProgressMessage(`씬 ${idx + 1} 이미지 재생성 중...`);

      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
        if (isAbortedRef.current) break;

        try {
          if (attempt > 0) {
            setProgressMessage(
              `씬 ${idx + 1} 이미지 재생성 재시도 중... (${attempt}/${MAX_RETRIES})`
            );
            await wait(2000);
          }

          const img = await generateImage(
            assetsRef.current[idx],
            currentReferenceImages
          );

          if (img && !isAbortedRef.current) {
            updateAssetAt(idx, { imageData: img, status: 'completed' });

            const imageModel = getSelectedImageModel();
            const imagePrice =
              PRICING.IMAGE[imageModel as keyof typeof PRICING.IMAGE] || 0.01;

            addCost('image', imagePrice, 1);
            setProgressMessage(
              `씬 ${idx + 1} 이미지 재생성 완료! (+${formatKRW(imagePrice)})`
            );
            success = true;
          } else if (!img) {
            throw new Error('이미지 데이터가 비어있습니다');
          }
        } catch (e: any) {
          console.error(
            `씬 ${idx + 1} 재생성 실패 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
            e.message
          );

          if (e.message?.includes('API key not valid') || e.status === 400) {
            setNeedsKey(true);
            break;
          }
        }
      }

      if (!success && !isAbortedRef.current) {
        updateAssetAt(idx, { status: 'error' });
        setProgressMessage(`씬 ${idx + 1} 이미지 생성 실패. 다시 시도해주세요.`);
      }
    },
    [currentReferenceImages]
  );

  const handleGenerateAnimation = useCallback(
    async (idx: number) => {
      const falKey = getFalApiKey();

      if (!falKey) {
        alert(
          'FAL API 키를 먼저 등록해주세요.\n설정 패널에서 "FAL.ai 애니메이션 엔진"을 열어 키를 입력하세요.'
        );
        return;
      }

      if (animatingIndices.has(idx)) return;

      if (!assetsRef.current[idx]?.imageData) {
        alert('이미지가 먼저 생성되어야 합니다.');
        return;
      }

      try {
        setAnimatingIndices(prev => new Set(prev).add(idx));
        setProgressMessage(`씬 ${idx + 1} 움직임 분석 중...`);

        const motionPrompt = await generateMotionPrompt(
          assetsRef.current[idx].narration,
          assetsRef.current[idx].visualPrompt
        );

        setProgressMessage(`씬 ${idx + 1} 영상 변환 중...`);

        const videoUrl = await generateVideoFromImage(
          assetsRef.current[idx].imageData!,
          motionPrompt,
          falKey
        );

        if (videoUrl) {
          updateAssetAt(idx, {
            videoData: videoUrl,
            videoDuration: CONFIG.ANIMATION.VIDEO_DURATION,
          });

          addCost('video', PRICING.VIDEO.perVideo, 1);
          setProgressMessage(
            `씬 ${idx + 1} 영상 변환 완료! (+${formatKRW(PRICING.VIDEO.perVideo)})`
          );
        } else {
          setProgressMessage(`씬 ${idx + 1} 영상 변환 실패`);
        }
      } catch (e: any) {
        console.error('영상 변환 실패:', e);
        setProgressMessage(`씬 ${idx + 1} 오류: ${e.message}`);
      } finally {
        setAnimatingIndices(prev => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [animatingIndices]
  );

  const triggerVideoExport = async (enableSubtitles: boolean = true) => {
    if (isVideoGenerating) return;

    try {
      setIsVideoGenerating(true);

      const suffix = enableSubtitles ? 'sub' : 'nosub';
      const timestamp = Date.now();

      const result = await generateVideo(
        assetsRef.current,
        msg => setProgressMessage(`[Render] ${msg}`),
        isAbortedRef,
        { enableSubtitles }
      );

      if (result) {
        saveAs(result.videoBlob, `tubegen_v92_${suffix}_${timestamp}.mp4`);
        setProgressMessage(
          `✨ MP4 렌더링 완료! (${enableSubtitles ? '자막 O' : '자막 X'})`
        );
      }
    } catch (error: any) {
      setProgressMessage(`렌더링 실패: ${error.message}`);
    } finally {
      setIsVideoGenerating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    await refreshProjects();
  };

  const handleLoadProject = (project: SavedProject) => {
    const safeAssets = Array.isArray(project?.assets) ? project.assets : [];

    assetsRef.current = safeAssets;
    setGeneratedData([...safeAssets]);
    setCurrentTopic(project?.topic || project?.name || '');
    setStep(GenerationStep.COMPLETED);
    setProgressMessage(`"${project.name}" 프로젝트 불러옴`);
    setViewMode('main');
  };


  const handleStartupComplete = async (payload: {
    storageDir: string;
    characters: StudioState['characters'];
    selectedCharacterId: string;
  }) => {
    const configured = await configureStorage(payload.storageDir);
    const nextState = await saveStudioState({
      ...configured,
      characters: payload.characters,
      selectedCharacterId: payload.selectedCharacterId,
    });
    setStudioState(nextState);
    setShowStartupWizard(false);
    await refreshProjects();
  };

  const handleSaveStudioState = async (partial: Partial<StudioState>) => {
    const nextState = await saveStudioState({
      ...studioState,
      ...partial,
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
  };

  const selectedCharacterName =
    studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Header
        projectCount={savedProjects.length}
        selectedCharacterName={selectedCharacterName}
        storageDir={studioState?.storageDir}
        onOpenSettings={() => setShowSettings(true)}
        onGoMain={() => setViewMode('main')}
        onGoGallery={() => setViewMode('gallery')}
        viewMode={viewMode}
      />

      {showStartupWizard && (
        <StartupWizard
          initialStorageDir={studioState?.storageDir}
          onComplete={handleStartupComplete}
        />
      )}

      <SettingsDrawer
        open={showSettings}
        studioState={studioState}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveStudioState}
      />

      {needsKey && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 flex items-center justify-center gap-4 animate-in fade-in slide-in-from-top-4">
          <span className="text-amber-400 text-xs font-bold">
            Gemini 3 Pro 엔진을 위해 API 키 설정이 필요합니다.
          </span>
          <button
            onClick={handleOpenKeySelector}
            className="px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg hover:bg-amber-400 transition-colors uppercase"
          >
            API 키 설정
          </button>
        </div>
      )}

      {viewMode === 'gallery' && (
        <ProjectGallery
          projects={savedProjects}
          onBack={() => setViewMode('main')}
          onDelete={handleDeleteProject}
          onRefresh={refreshProjects}
          onLoad={handleLoadProject}
        />
      )}

      {viewMode === 'main' && (
        <main className="py-8">
          <InputSection onGenerate={handleGenerate} step={step} />

          {step !== GenerationStep.IDLE && (
            <div className="max-w-7xl mx-auto px-4 text-center mb-12">
              <div className="inline-flex items-center gap-4 px-6 py-3 rounded-2xl border bg-slate-900 border-slate-800 shadow-2xl">
                {step === GenerationStep.SCRIPTING || step === GenerationStep.ASSETS ? (
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
                ) : (
                  <div
                    className={`w-2 h-2 rounded-full ${
                      step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-green-500'
                    }`}
                  />
                )}

                <span className="text-sm font-bold text-slate-300">
                  {progressMessage}
                </span>

                {(step === GenerationStep.SCRIPTING ||
                  step === GenerationStep.ASSETS) && (
                  <button
                    onClick={handleAbort}
                    className="ml-2 px-3 py-1 rounded-lg bg-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/30"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}

          <ResultTable
            data={generatedData}
            onRegenerateImage={handleRegenerateImage}
            onExportVideo={triggerVideoExport}
            isExporting={isVideoGenerating}
            animatingIndices={animatingIndices}
            onGenerateAnimation={handleGenerateAnimation}
          />
        </main>
      )}
    </div>
  );
};

export default App;
