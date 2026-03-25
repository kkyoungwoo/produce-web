'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Header from '../components/Header';
import SettingsDrawer from '../components/SettingsDrawer';
import ProviderQuickModal from '../components/ProviderQuickModal';
import {
  CharacterProfile,
  PromptedImageAsset,
  StudioState,
  WorkflowDraft,
} from '../types';
import { fetchStudioState, saveStudioState } from '../services/localFileApi';
import { ensureWorkflowDraft } from '../services/workflowDraftService';
import {
  buildImageAwareUploadPrompt,
  buildStyleRecommendations,
  createPromptVariants,
  extractCharactersFromScript,
} from '../services/characterStudioService';

function mergeCharacters(a: CharacterProfile[], b: CharacterProfile[]) {
  const map = new Map<string, CharacterProfile>();
  [...a, ...b].forEach((item) => {
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

const CharacterStudioPage: React.FC = () => {
  const pathname = usePathname();
  const basePath = useMemo(() => pathname.replace(/\/character-studio$/, ''), [pathname]);
  const [studioState, setStudioState] = useState<StudioState | null>(null);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [notice, setNotice] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const state = await fetchStudioState();
      setStudioState(state);
      setDraft(ensureWorkflowDraft(state));
    })();
  }, []);

  const selectedCharacterName = useMemo(
    () => studioState?.characters?.find((item) => item.id === studioState.selectedCharacterId)?.name || '',
    [studioState]
  );

  const selectedCharacters = useMemo(
    () => draft?.extractedCharacters?.filter((item) => draft.selectedCharacterIds.includes(item.id)) || [],
    [draft]
  );

  const selectedStyle = useMemo(
    () => draft?.styleImages?.find((item) => item.id === draft.selectedStyleImageId) || null,
    [draft]
  );

  const persist = async (nextDraft: WorkflowDraft, nextCharacters?: CharacterProfile[]) => {
    if (!studioState) return;
    const mergedCharacters = nextCharacters ? mergeCharacters(studioState.characters || [], nextCharacters) : studioState.characters;
    const nextState = await saveStudioState({
      ...studioState,
      characters: mergedCharacters,
      selectedCharacterId: nextDraft.selectedCharacterIds[0] || studioState.selectedCharacterId || mergedCharacters[0]?.id || null,
      workflowDraft: {
        ...nextDraft,
        completedSteps: {
          ...nextDraft.completedSteps,
          step3: Boolean(nextDraft.script.trim()),
          step4: Boolean(nextDraft.selectedCharacterIds.length && nextDraft.selectedStyleImageId),
          step5: Boolean(nextDraft.completedSteps?.step5),
        },
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    setStudioState(nextState);
    setDraft(ensureWorkflowDraft(nextState));
  };

  const handleExtract = async () => {
    if (!draft?.script.trim()) {
      setNotice('먼저 메인 제작 페이지에서 1단계부터 3단계까지 저장해 주세요.');
      return;
    }
    setIsExtracting(true);
    try {
      const characters = await extractCharactersFromScript({
        script: draft.script,
        selections: draft.selections,
        contentType: draft.contentType,
        model: studioState?.routing?.scriptModel,
        allowAi: Boolean(studioState?.providers?.openRouterApiKey),
        styleLabel: selectedStyle?.label || selectedStyle?.groupLabel || draft.selectedCharacterStyleLabel || '',
        stylePrompt: selectedStyle?.prompt || draft.selectedCharacterStylePrompt || '',
        language: draft.customScriptSettings?.language || 'ko',
      });
      const styleImages = draft.styleImages?.length ? draft.styleImages : buildStyleRecommendations(draft.script, draft.contentType);
      const characterImages = characters.flatMap((character) => character.generatedImages || []).slice(0, 16);
      const nextDraft: WorkflowDraft = {
        ...draft,
        extractedCharacters: characters,
        characterImages,
        styleImages,
        selectedCharacterIds: draft.selectedCharacterIds?.length ? draft.selectedCharacterIds : [characters[0]?.id].filter(Boolean) as string[],
        selectedStyleImageId: draft.selectedStyleImageId || styleImages[0]?.id || null,
        activeStage: 4,
      };
      await persist(nextDraft, characters);
      setNotice(Boolean(studioState?.providers?.openRouterApiKey) ? '대본 기준 캐릭터와 화풍 추천을 갱신했습니다.' : 'AI 연결이 없어 임시 추천 카드로 채웠습니다. 프롬프트를 바꿔 다시 변형할 수 있습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateCharacterPrompt = async (characterId: string, prompt: string) => {
    if (!draft) return;
    const nextCharacters = draft.extractedCharacters.map((item) => item.id === characterId ? { ...item, prompt } : item);
    await persist({ ...draft, extractedCharacters: nextCharacters });
  };

  const createCharacterVariants = async (character: CharacterProfile) => {
    if (!draft) return;
    const variants = createPromptVariants({ title: character.name, prompt: character.prompt || character.description, kind: 'character' });
    const nextCharacters = draft.extractedCharacters.map((item) => item.id === character.id ? {
      ...item,
      generatedImages: variants,
      selectedImageId: variants[0]?.id || item.selectedImageId,
      imageData: variants[0]?.imageData || item.imageData,
    } : item);
    const nextDraft = {
      ...draft,
      extractedCharacters: nextCharacters,
      characterImages: [...draft.characterImages.filter((item) => !variants.some((variant) => variant.id === item.id)), ...variants],
    };
    await persist(nextDraft, nextCharacters);
    setNotice(`${character.name} 프롬프트 기준 변형 이미지 4장을 만들었습니다.`);
  };

  const createStyleVariants = async (styleCard: PromptedImageAsset) => {
    if (!draft) return;
    const variants = createPromptVariants({ title: styleCard.label, prompt: styleCard.prompt, kind: 'style' });
    await persist({
      ...draft,
      styleImages: [...draft.styleImages.filter((item) => item.id !== styleCard.id), ...variants],
      selectedStyleImageId: variants[0]?.id || styleCard.id,
    });
    setNotice(`${styleCard.label} 화풍 변형 카드 4장을 만들었습니다.`);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !draft) return;
    const images = await Promise.all(
      Array.from(files as FileList)
        .slice(0, 4)
        .map((file: File) => new Promise<PromptedImageAsset>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageData = String(reader.result);
            const label = file.name.replace(/\.[^.]+$/, '');
            Promise.resolve(buildImageAwareUploadPrompt({
              imageData,
              label,
              kind: 'character',
              topic: draft.topic || '',
              mood: draft.selections?.mood || '',
              setting: draft.selections?.setting || '',
              protagonist: draft.selections?.protagonist || '',
              contentType: draft.contentType,
              aspectRatio: draft.aspectRatio,
            }))
              .catch(() => '사용자 업로드 이미지')
              .then((prompt) => {
                resolve({
                  id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  label,
                  prompt,
                  imageData,
                  createdAt: Date.now(),
                  kind: 'character',
                  sourceMode: 'upload',
                });
              });
          };
          reader.readAsDataURL(file);
        }))
    );

    const appendedCharacters = images.map((image, index) => ({
      id: `manual_char_${Date.now()}_${index}`,
      name: image.label,
      description: '사용자 업로드 캐릭터',
      visualStyle: '사용자 업로드 기반',
      createdAt: Date.now(),
      role: 'support' as const,
      prompt: image.prompt,
      imageData: image.imageData,
      generatedImages: [image],
      selectedImageId: image.id,
    }));
    const nextCharacters = [
      ...(draft.extractedCharacters || []),
      ...appendedCharacters,
    ];

    await persist({
      ...draft,
      extractedCharacters: nextCharacters,
      characterImages: [...draft.characterImages, ...images],
      selectedCharacterIds: [...new Set([...draft.selectedCharacterIds, ...appendedCharacters.map((item) => item.id)])].filter(Boolean),
    }, nextCharacters);

    e.target.value = '';
    setNotice('업로드한 이미지를 분석해 캐릭터 프롬프트까지 함께 저장했습니다.');
  };

  if (!studioState || !draft) {
    return <div className="p-10 text-center text-sm text-slate-500">캐릭터 스튜디오를 불러오는 중...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        projectCount={studioState.projects?.length || 0}
        selectedCharacterName={selectedCharacterName}
        storageDir={studioState.storageDir}
        onOpenSettings={() => setShowSettings(true)}
        basePath={basePath}
        currentSection="characters"
      />

      <SettingsDrawer open={showSettings} studioState={studioState} onClose={() => setShowSettings(false)} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} />
      <ProviderQuickModal open={showApiModal} studioState={studioState} title="API 키 빠른 등록" description="텍스트 연결이 있으면 캐릭터 추출과 추천이 더 정교해집니다." onClose={() => setShowApiModal(false)} onSave={async (partial) => setStudioState(await saveStudioState({ ...studioState, ...partial, updatedAt: Date.now() }))} onOpenFullSettings={() => { setShowApiModal(false); setShowSettings(true); }} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">캐릭터 작업실</div>
              <h1 className="mt-2 text-3xl font-black text-slate-900">대본 기준 캐릭터 / 화풍 정리</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">1단계부터 3단계까지 저장한 대본을 기준으로 주인공과 조연을 추출하고, 화풍 추천 카드와 프롬프트 변형 이미지를 선택할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowApiModal(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">API 빠른 등록</button>
              <button type="button" onClick={handleExtract} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">{isExtracting ? '추천 생성 중...' : '대본 기준 추천 실행'}</button>
              <button type="button" onClick={() => uploadInputRef.current?.click()} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">이미지 업로드</button>
              <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-3 py-2 ${draft.script.trim() ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>대본 {draft.script.trim() ? '준비됨' : '없음'}</span>
            <span className={`rounded-full px-3 py-2 ${studioState.providers?.openRouterApiKey ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>텍스트 AI {studioState.providers?.openRouterApiKey ? '연결됨' : '임시 추천 모드'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">선택된 캐릭터 {selectedCharacters.length}명</span>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">선택된 화풍 {selectedStyle ? 1 : 0}개</span>
          </div>
          {notice && <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div>}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">주인공 / 조연</div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">캐릭터 선택</h2>
              </div>
              <a href={`${basePath}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">제작 페이지로 돌아가기</a>
            </div>

            <div className="mt-5 space-y-5">
              {(draft.extractedCharacters || []).map((character) => {
                const selected = draft.selectedCharacterIds.includes(character.id);
                const previewImage = character.generatedImages?.find((image) => image.id === character.selectedImageId) || character.generatedImages?.[0];
                return (
                  <div key={character.id} className={`rounded-[24px] border p-4 ${selected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img src={previewImage?.imageData || character.imageData || '/mp4Creater/flow-character.svg'} alt={character.name} className="aspect-[4/5] w-full object-cover" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-lg font-black text-slate-900">{character.name}</div>
                            <div className="mt-1 text-sm text-slate-600">{character.description}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => persist({ ...draft, selectedCharacterIds: selected ? draft.selectedCharacterIds.filter((id) => id !== character.id) : [...new Set([...draft.selectedCharacterIds, character.id])] })} className={`rounded-2xl px-4 py-2 text-sm font-black ${selected ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                              {selected ? '선택됨' : '캐릭터 선택'}
                            </button>
                            <button type="button" onClick={() => createCharacterVariants(character)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">프롬프트로 4장 변형</button>
                          </div>
                        </div>
                        <textarea value={character.prompt || ''} onChange={(e) => updateCharacterPrompt(character.id, e.target.value)} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-700 outline-none focus:border-blue-400" />
                        <div className="grid gap-3 sm:grid-cols-4">
                          {(character.generatedImages || []).map((image) => (
                            <button key={image.id} type="button" onClick={() => persist({ ...draft, extractedCharacters: draft.extractedCharacters.map((item) => item.id === character.id ? { ...item, selectedImageId: image.id, imageData: image.imageData } : item) })} className={`overflow-hidden rounded-2xl border text-left ${character.selectedImageId === image.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200 bg-white'}`}>
                              <img src={image.imageData} alt={image.label} className="aspect-[4/5] w-full object-cover" />
                              <div className="p-2 text-[11px] font-bold text-slate-600">{image.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">화풍 추천</div>
              <h2 className="mt-2 text-2xl font-black text-slate-900">스타일 카드</h2>
              <div className="mt-5 grid gap-4">
                {(draft.styleImages || []).map((styleCard) => (
                  <div key={styleCard.id} className={`rounded-[24px] border p-4 ${draft.selectedStyleImageId === styleCard.id ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200 bg-slate-50'}`}>
                    <img src={styleCard.imageData} alt={styleCard.label} className="aspect-video w-full rounded-2xl object-cover" />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">{styleCard.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{styleCard.prompt}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => persist({ ...draft, selectedStyleImageId: styleCard.id })} className={`rounded-2xl px-4 py-2 text-sm font-black ${draft.selectedStyleImageId === styleCard.id ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{draft.selectedStyleImageId === styleCard.id ? '선택됨' : '화풍 선택'}</button>
                        <button type="button" onClick={() => createStyleVariants(styleCard)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">프롬프트 변형</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">다음 단계</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">4단계 생성 페이지로 이동</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">선택된 캐릭터와 화풍은 자동 저장됩니다. 4단계 페이지에서 안내 드롭다운을 보고 씬 생성을 시작하면 자동으로 접히고, 다시 열 수도 있습니다.</p>
              <a href={`${basePath}/step-6`} className={`mt-4 inline-flex rounded-2xl px-5 py-4 text-base font-black text-white ${selectedCharacters.length && selectedStyle ? 'bg-blue-600 hover:bg-blue-500' : 'pointer-events-none bg-slate-300 text-slate-500'}`}>Step6 씬 제작 열기</a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CharacterStudioPage;
