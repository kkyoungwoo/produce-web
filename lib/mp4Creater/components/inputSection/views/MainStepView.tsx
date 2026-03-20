// @ts-nocheck
import React from 'react';
import HelpTip from '../../HelpTip';
import { IMAGE_MODELS, SCRIPT_MODEL_OPTIONS } from '../../../config';
import { ASPECT_RATIO_OPTIONS, getAspectRatioClass, getAspectRatioDescription } from '../../../utils/aspectRatio';
import { handleHorizontalWheel, scrollContainerBy } from '../../../utils/horizontalScroll';
import { getTopicSuggestion } from '../../../services/storyRecommendationService';
import { buildWorkflowPromptPack, resolveWorkflowPromptTemplates } from '../../../services/workflowPromptBuilder';
import { WorkflowPromptTemplate } from '../../../types';
import { CONTENT_TYPE_CARDS, FIELD_OPTIONS_BY_TYPE, STEP_META } from '../constants';
import {
  AccordionSection,
  ArrowButton,
  GuidedActionButton,
  LoadingSlide,
  StepChip,
  SummaryChip,
} from '../ui';

export default function MainStepView({ vm }: { vm: any }) {
  const {
    routeStep,
    completion,
    notice,
    openStage,
    activeStage,
    toggleStage,
    stageStatus,
    step1Summary,
    step2Summary,
    step3Summary,
    step4Summary,
    step3GuideItems,
    contentType,
    hasSelectedContentType,
    hasSelectedAspectRatio,
    aspectRatio,
    setHasSelectedContentType,
    setContentType,
    setTopic,
    setStoryScript,
    setGenre,
    setMood,
    setEndingTone,
    setSetting,
    setProtagonist,
    setConflict,
    setExtractedCharacters,
    setStyleImages,
    setSelectedCharacterIds,
    setSelectedStyleImageId,
    setHasSelectedAspectRatio,
    setAspectRatio,
    topic,
    isRefreshingTopic,
    refreshTopicRecommendation,
    topicRecommendations,
    fieldConfigs,
    refreshField,
    loadingFields,
    selectedPromptTemplate,
    selectedPromptTemplateId,
    syncedPromptTemplates,
    focusPromptTemplate,
    openPromptEditor,
    deleteCustomPromptTemplate,
    addCustomPromptTemplate,
    handleGenerateScriptClick,
    createDraftFromSelections,
    isGeneratingScript,
    customScriptDurationMinutes,
    customScriptSpeechStyle,
    customScriptLanguage,
    customScriptReferenceText,
    scriptReferenceSuggestions,
    setCustomScriptDurationMinutes,
    setCustomScriptSpeechStyle,
    setCustomScriptLanguage,
    setCustomScriptReferenceText,
    applyScriptReferenceSuggestion,
    refreshScriptReferenceSuggestions,
    ensureProjectPromptTemplate,
    setPromptPreviewDraft,
    setPromptPreviewId,
    storyScript,
    sceneCount,
    selectedCharacters,
    selectedStyle,
    connectionSummary,
    selectedScriptModel,
    selectedImageModel,
    onOpenApiModal,
    hydrateCharactersForScript,
    isExtracting,
    characterUploadInputRef,
    handleUpload,
    newCharacterName,
    setNewCharacterName,
    newCharacterPrompt,
    setNewCharacterPrompt,
    createNewCharacterByPrompt,
    extractedCharacters,
    characterStripRef,
    characterCarouselIndices,
    setCharacterCarouselIndices,
    characterLoadingProgress,
    chooseCharacterImage,
    toggleCharacterSelection,
    createCharacterVariants,
    expandedCharacterEditorId,
    setExpandedCharacterEditorId,
    updateCharacterName,
    updateCharacterPrompt,
    updateCharacterRole,
    updateCharacterRoleLabel,
    removeCharacter,
    selectedCharacterIds,
    ensureStyleRecommendations,
    newStyleName,
    setNewStyleName,
    newStylePrompt,
    setNewStylePrompt,
    createNewStyleByPrompt,
    styleGroups,
    styleStripRef,
    styleCarouselIndices,
    setStyleCarouselIndices,
    styleLoadingProgress,
    createStyleVariants,
    expandedStyleEditorId,
    setExpandedStyleEditorId,
    updateStylePrompt,
    stepCompleted,
    handleOpenSceneStudioClick,
    visibleStepIds,
    setCharacterLoadingProgress,
    setStyleLoadingProgress,
    autoRecommendSignatureRef,
    setPromptTemplates,
    setSelectedPromptTemplateId,
    setPromptDetailId,
    setNotice,
    completeStage,
    openExampleGuide,
    normalizedScript,
    setShowPromptPack,
    showPromptPack,
    onUpdateRouting,
    textModelReady,
    step3PanelMode,
    setStep3PanelMode,
    activePromptSlide,
    selectedPromptIndex,
    generateScriptByPrompt,
    promptDetailTemplate,
    promptPack,
    onOpenSettings,
    studioState,
    imageModelReady,
    openStageWithIntent,
    step4CharacterStripRef,
    styleUploadInputRef,
    selectedStyleImageId,
  } = vm;

  return (
    <>
      <div className={`${routeStep ? 'hidden ' : ''}overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm`}>
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-8 text-white md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-blue-100">제작 흐름</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">한 화면에서 1단계부터 캐릭터 / 화풍 선택까지</h1>
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

      <div className={`${routeStep ? 'hidden ' : ''}mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">순서 가이드</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">처음 쓰는 사용자도 길을 잃지 않도록</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">1단계부터 4단계까지는 아래 순서대로 진행하면 됩니다. 비어 있는 항목이 있으면 씬 제작으로 넘어가기 전에 해당 단계로 다시 안내합니다.</p>
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
            <p className="mt-2 text-sm leading-6 text-slate-600">출연자 선택은 자동 보정되고, 화풍은 첫 카드가 기본으로 이어집니다. 현재 화풍 {selectedStyle ? '선택됨' : '미선택'}.</p>
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
              const active = hasSelectedContentType && contentType === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    if (contentType === card.id && hasSelectedContentType) {
                      setHasSelectedContentType(false);
                      return;
                    }
                    const defaults = FIELD_OPTIONS_BY_TYPE[card.id];
                    const nextTopic = getTopicSuggestion(card.id, '');
                    setContentType(card.id);
                    setHasSelectedContentType(true);
                    setTopic(nextTopic);
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
                    const nextSelections = {
                      genre: defaults.genre[0],
                      mood: defaults.mood[0],
                      endingTone: defaults.endingTone[0],
                      setting: defaults.setting[0],
                      protagonist: defaults.protagonist[0],
                      conflict: defaults.conflict[0],
                    };
                    const nextPromptPack = buildWorkflowPromptPack({
                      contentType: card.id,
                      topic: nextTopic,
                      selections: nextSelections,
                      script: '',
                    });
                    const nextTemplates = resolveWorkflowPromptTemplates(card.id, nextPromptPack, []);
                    const coreTemplate = nextTemplates.find((item) => item.engine === 'channel_constitution_v32') || nextTemplates.find((item) => item.id === 'builtin-core-script') || nextTemplates[0];
                    if (coreTemplate) {
                      const projectTemplateId = `project_prompt_${coreTemplate.id}`;
                      const projectTemplate: WorkflowPromptTemplate = {
                        ...coreTemplate,
                        id: projectTemplateId,
                        name: `${coreTemplate.name} (프로젝트)`,
                        description: '이 프로젝트 전용 프롬프트',
                        builtIn: false,
                        engine: coreTemplate.engine || 'default',
                        isCustomized: true,
                        updatedAt: Date.now(),
                      };
                      const mergedTemplates = [...nextTemplates.filter((item) => item.id !== projectTemplateId), projectTemplate];
                      setPromptTemplates(mergedTemplates);
                      setSelectedPromptTemplateId(projectTemplateId);
                      setPromptDetailId(projectTemplateId);
                    }
                    setNotice(card.id === 'music_video' ? '뮤직비디오 모드로 전환했습니다. 1단계 완료 버튼을 누르면 2단계로 넘어갑니다.' : '콘텐츠 유형을 변경했습니다. 1단계 완료 버튼으로 다음 단계로 진행해 주세요.');
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
                <p className="mt-2 text-sm leading-6 text-slate-600">1단계에서 고른 비율이 추천 카드, 씬 생성, 씬 미리보기까지 그대로 이어집니다.</p>
              </div>
              <SummaryChip accent="blue">현재 {hasSelectedAspectRatio ? aspectRatio : '미선택'}</SummaryChip>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const active = hasSelectedAspectRatio && aspectRatio === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (aspectRatio === option.id && hasSelectedAspectRatio) {
                        setHasSelectedAspectRatio(false);
                        return;
                      }
                      setAspectRatio(option.id);
                      setHasSelectedAspectRatio(true);
                    }}
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
            <GuidedActionButton ready={stepCompleted[1]} onClick={() => void completeStage(1, 2)}>
              1단계 완료하고 2단계로
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
              <button type="button" onClick={() => { void refreshTopicRecommendation(); }} disabled={isRefreshingTopic} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                {isRefreshingTopic ? '추천 중...' : '주제 새로고침'}
              </button>
            </div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              placeholder="예: 새벽 네온 아래 다시 시작되는 후렴, 막차에서 시작된 반전, 도시 재개발 핵심 브리핑"
            />
            <div className="mt-4 space-y-2">
              <div className="text-xs font-black text-slate-600">추천 주제</div>
              <div className="flex flex-col gap-2">
                {isRefreshingTopic && topicRecommendations.length === 0 ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={`accordion-step2-topic-skeleton-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="h-4 w-[82%] animate-pulse rounded bg-slate-200" />
                    </div>
                  ))
                ) : (
                  topicRecommendations.map((item, index) => (
                    <button
                      key={`accordion-step2-topic-${index}-${item}`}
                      type="button"
                      onClick={() => setTopic(item)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      {item}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 md:col-span-2 xl:col-span-3">
              2단계에서는 콘텐츠 주제만 입력합니다. 장르/분위기/엔딩톤/배경/주인공/갈등 항목은 숨김 처리되었습니다.
            </div>
            {false ? fieldConfigs.map((field) => (
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
            )) : null}
          </div>

          <div className="mt-5 flex justify-center pt-8">
            <GuidedActionButton ready={stepCompleted[2]} disabled={!stepCompleted[2]} onClick={() => void completeStage(2, 3)}>
              2단계 완료하고 3단계로
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
              <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">3단계 작업 집중 보기</div>
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
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">3단계 집중 체크</span>
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

                        <div className="mt-4 rounded-[24px] border border-violet-100 bg-violet-50/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">고객 커스텀 대본생성</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">길이, 말투, 언어, 참고 내용을 먼저 정하고 생성 버튼을 누르면 초안 방향이 더 안정적으로 잡힙니다.</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">{customScriptDurationMinutes}분 목표</span>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-[20px] border border-white/70 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-black text-slate-900">영상 예상 길이</div>
                                <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{customScriptDurationMinutes}분</div>
                              </div>
                              <input type="range" min={1} max={16} step={1} value={customScriptDurationMinutes} onChange={(e) => setCustomScriptDurationMinutes(Number(e.target.value))} className="mt-4 h-2 w-full cursor-pointer accent-violet-600" />
                              <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-400"><span>1분</span><span>8분</span><span>16분</span></div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                              <div className="rounded-[20px] border border-white/70 bg-white p-4">
                                <div className="text-sm font-black text-slate-900">대화체</div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {([['yo', '요체'], ['da', '다체']] as const).map(([value, label]) => (
                                    <button key={value} type="button" onClick={() => setCustomScriptSpeechStyle(value)} className={`rounded-2xl px-4 py-3 text-sm font-black transition ${customScriptSpeechStyle === value ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-white/70 bg-white p-4">
                                <div className="text-sm font-black text-slate-900">대본 언어</div>
                                <select value={customScriptLanguage} onChange={(e) => setCustomScriptLanguage(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400">
                                  <option value="ko">한국어</option>
                                  <option value="en">영어</option>
                                  <option value="ja">일본어</option>
                                  <option value="zh">중국어</option>
                                  <option value="vi">베트남어</option>
                                  <option value="mn">몽골어</option>
                                  <option value="th">태국어</option>
                                  <option value="uz">우즈베크어</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-[20px] border border-white/70 bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-900">대본 참고 내용</div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">2단계 선택값을 바탕으로 초안 문구를 3개씩 추천합니다. 눌러 넣은 뒤 직접 수정하면 됩니다.</p>
                              </div>
                              <button type="button" onClick={refreshScriptReferenceSuggestions} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100">추천 새로고침</button>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                              {scriptReferenceSuggestions.map((suggestion, index) => (
                                <button key={`main-script-reference-${index}`} type="button" onClick={() => applyScriptReferenceSuggestion(suggestion)} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm leading-6 text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50">
                                  <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700">추천 {index + 1}</span>
                                  <div className="mt-3 line-clamp-4">{suggestion}</div>
                                </button>
                              ))}
                            </div>
                            <textarea value={customScriptReferenceText} onChange={(e) => setCustomScriptReferenceText(e.target.value)} placeholder="예: 시작 10초 안에 문제를 선명하게 보여주고, 중간에는 구체 사례를 1개 넣고, 마지막은 한 줄 행동 제안으로 끝내 주세요." className="mt-4 min-h-[150px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-violet-400" />
                          </div>
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
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">3단계 출연자 관리</div>
                        <div className="mt-2 text-lg font-black text-slate-900">주인공 / 조연 / 나레이터 카드 제작</div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">화풍 카드와 같은 방식으로 각 출연자마다 이미지 카드 가족을 만들고, 마음에 들 때까지 각자 반복 생성할 수 있게 맞췄습니다. 여기서 선택한 카드가 4단계와 씬 제작 참조 이미지로 그대로 넘어갑니다.</p>
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
                                  출연 순서 {character.castOrder || characterIndex + 1} · 선택한 카드의 이미지와 프롬프트가 4단계 / 씬 제작 참조로 이어집니다.
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
                <GuidedActionButton tone="violet" ready={stepCompleted[3]} disabled={!stepCompleted[3]} onClick={() => void completeStage(3, 4)}>
                  3단계 완료하고 4단계로
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
          description="캐릭터 선택은 3단계에서 끝내고, 여기서는 화풍만 고른 뒤 바로 씬 제작 작업 화면으로 이동합니다. 선택한 스타일 프롬프트가 그대로 프로젝트 씬 생성에 반영됩니다."
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
              <div className="text-sm font-black text-slate-900">3단계 확정 캐릭터</div>
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
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">출연자 요약</div>
                  <h3 className="mt-2 text-xl font-black text-slate-900">씬 이미지에 이어질 출연자 카드</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">3단계에서 확정한 캐릭터의 현재 선택 이미지와 프롬프트가 4단계 이후 씬 이미지 프롬프트에 그대로 묶여 들어갑니다. 마음에 들지 않으면 3단계에서 추천 +1로 계속 다시 뽑을 수 있습니다.</p>
                </div>
                <button type="button" onClick={() => openStageWithIntent(3)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  3단계 다시 열기
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
                      아직 선택된 출연자가 없습니다. 3단계에서 주인공, 조연, 나레이터를 추가하고 대표 이미지를 고른 뒤 다시 오면 씬 프롬프트에 연결됩니다.
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
                    3단계 대본과 선택 프롬프트를 준비한 뒤 추천 생성 버튼을 누르면 화풍 카드가 채워집니다. 업로드한 이미지에서도 바로 화풍 프롬프트를 저장할 수 있습니다.
                  </div>
                )}
                </div>
              </div>
            </section>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">다음 단계</div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">씬 제작 시작</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">4단계를 마치면 현재 선택값을 프로젝트에 자동 추가하고, 바로 프로젝트 기준 씬 제작 화면으로 이동합니다.</p>
              <div className="mt-4 flex justify-center pt-8">
                <GuidedActionButton ready={stepCompleted[4]} disabled={!stepCompleted[4]} onClick={() => void handleOpenSceneStudioClick()} className="px-6 py-4 text-base">
                  영상 제작하기
                </GuidedActionButton>
              </div>
            </div>
          </div>
        </AccordionSection>
        )}
      </div>
    </>
  );
}

