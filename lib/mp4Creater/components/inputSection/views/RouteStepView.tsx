import React, { useEffect, useRef, useState } from 'react';
import { StepId } from '../types';
import { STEP_META } from '../constants';
import { OverlayModal } from '../ui';
import Step1Panel from '../steps/Step1Panel';
import Step2Panel from '../steps/Step2Panel';
import Step3Panel from '../steps/Step3Panel';
import Step4Panel from '../steps/Step4Panel';
import Step5Panel from '../steps/Step5Panel';

export default function RouteStepView({ vm }: { vm: any }) {
  const {
    routeStep,
    contentType,
    aspectRatio,
    hasSelectedContentType,
    hasSelectedAspectRatio,
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
    setSelectedCharacterStyleId,
    applyContentTypeSelection,
    setSelectedStyleImageId,
    setAspectRatio,
    setHasSelectedAspectRatio,
    topic,
    isRefreshingTopic,
    topicRecommendations,
    refreshTopicRecommendation,
    isGeneratingScript,
    sceneCount,
    storyScript,
    handleGenerateScriptClick,
    ensureProjectPromptTemplate,
    selectedPromptTemplate,
    syncedPromptTemplates,
    setNotice,
    setPromptPreviewDraft,
    setPromptPreviewId,
    extractedCharacters,
    selectedCharacterIds,
    selectedCharacterStyleId,
    characterStyleOptions,
    isExtracting,
    hydrateCharactersForScript,
    handleCharacterUploadForId,
    openCharacterUploadPicker,
    selectCharacterImageById,
    updateCharacterPrompt,
    createCharacterVariants,
    characterLoadingProgress,
    characterUploadInputRef,
    handleUpload,
    styleGroups,
    selectedStyleImageId,
    newStyleName,
    newStylePrompt,
    ensureStyleRecommendations,
    createNewStyleByPrompt,
    createStyleVariants,
    applyStyleSampleFromPreset,
    setNewStyleName,
    setNewStylePrompt,
    previousRouteStep,
    moveRouteStep,
    goBackFromStep1,
    nextRouteStep,
    completeStage,
    routeStepCompleted,
    handleOpenSceneStudioClick,
    notice,
    promptPreviewId,
    promptPreviewDraft,
    updatePromptTemplate,
    customScriptDurationMinutes,
    customScriptSpeechStyle,
    customScriptLanguage,
    customScriptReferenceText,
    scriptReferenceSuggestions,
    referenceLinks,
    pendingReferenceLinkUrl,
    showReferenceLinkInput,
    isAddingReferenceLink,
    selectedScriptGenerationModel,
    customScriptModelOptions,
    constitutionAnalysis,
    selectedPromptTemplateName,
    selectedPromptTemplateEngine,
    setCustomScriptDurationMinutes,
    setCustomScriptSpeechStyle,
    setCustomScriptLanguage,
    setCustomScriptReferenceText,
    applyScriptReferenceSuggestion,
    refreshScriptReferenceSuggestions,
    setPendingReferenceLinkUrl,
    toggleReferenceLinkInput,
    addReferenceLink,
    removeReferenceLink,
    setSelectedScriptGenerationModel,
    elevenLabsVoices,
    heygenVoices,
    isLoadingVoiceCatalogs,
    projectVoiceProvider,
    projectVoiceSummary,
    voicePreviewCharacterId,
    voicePreviewMessage,
    handleCharacterVoiceProviderChange,
    handleCharacterVoiceChoiceChange,
    handleCharacterVoiceDirectInputChange,
    handlePreviewCharacterVoice,
    getCharacterVoiceSummary,
    step3CastSelectionHighlightTick,
    newCharacterName,
    newCharacterPrompt,
    setNewCharacterName,
    setNewCharacterPrompt,
    createNewCharacterByPrompt,
    createNewCharacterFromForm,
    removeCharacter,
    toggleCharacterSelection,
  } = vm;

  const currentRouteStep = (routeStep || 1) as 1 | 2 | 3 | 4 | 5;
  const [stepShellVisible, setStepShellVisible] = useState(false);
  const [step4LocalStage, setStep4LocalStage] = useState<'style' | 'workspace'>(selectedCharacterStyleId ? 'workspace' : 'style');
  const previousRouteStepRef = useRef(currentRouteStep);

  useEffect(() => {
    if (currentRouteStep === 3) {
      setStepShellVisible(true);
      return;
    }
    setStepShellVisible(false);
    const frame = window.requestAnimationFrame(() => setStepShellVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [currentRouteStep]);

  useEffect(() => {
    const previousRouteStep = previousRouteStepRef.current;
    previousRouteStepRef.current = currentRouteStep;
    if (currentRouteStep !== 4 || previousRouteStep === 4) return;
    setStep4LocalStage(selectedCharacterStyleId ? 'workspace' : 'style');
  }, [currentRouteStep, selectedCharacterStyleId]);

  useEffect(() => {
    if (currentRouteStep !== 4) return;
    if (selectedCharacterStyleId || step4LocalStage !== 'workspace') return;
    setStep4LocalStage('style');
  }, [currentRouteStep, selectedCharacterStyleId, step4LocalStage]);

  if (!routeStep) return null;


  const normalizedSelectedCharacterIds = Array.isArray(selectedCharacterIds)
    ? selectedCharacterIds.filter((characterId: any) => extractedCharacters.some((character: any) => character.id === characterId))
    : [];
  const selectedCharactersForStep4 = extractedCharacters.filter((character: any) => normalizedSelectedCharacterIds.includes(character.id));

  const renderRouteContent = () => {
    if (currentRouteStep === 1) {
      return (
        <Step1Panel
          contentType={contentType}
          aspectRatio={aspectRatio}
          hasSelectedContentType={hasSelectedContentType}
          hasSelectedAspectRatio={hasSelectedAspectRatio}
          onSelectContentType={(value) => {
            if (hasSelectedContentType && contentType === value) {
              setHasSelectedContentType(false);
              return;
            }
            applyContentTypeSelection(value);
            setHasSelectedContentType(true);
          }}
          onSelectAspectRatio={(value) => {
            if (hasSelectedAspectRatio && aspectRatio === value) {
              setHasSelectedAspectRatio(false);
              return;
            }
            setAspectRatio(value);
            setHasSelectedAspectRatio(true);
          }}
        />
      );
    }

    if (currentRouteStep === 2) {
      return (
        <Step2Panel
          topic={topic}
          isRefreshingTopic={isRefreshingTopic}
          isInitialLoadingRecommendations={isRefreshingTopic && topicRecommendations.length === 0}
          topicRecommendations={topicRecommendations}
          customScriptDurationMinutes={customScriptDurationMinutes}
          customScriptSpeechStyle={customScriptSpeechStyle}
          customScriptLanguage={customScriptLanguage}
          onTopicChange={setTopic}
          onRefreshTopic={() => { void refreshTopicRecommendation(); }}
          onSelectTopicRecommendation={(value) => setTopic(value)}
          onCustomScriptDurationChange={setCustomScriptDurationMinutes}
          onCustomScriptSpeechStyleChange={setCustomScriptSpeechStyle}
          onCustomScriptLanguageChange={setCustomScriptLanguage}
        />
      );
    }

    if (currentRouteStep === 3) {
      return (
        <Step3Panel
          contentType={contentType}
          isGeneratingScript={isGeneratingScript}
          sceneCount={sceneCount}
          storyScript={storyScript}
          customScriptReferenceText={customScriptReferenceText}
          scriptReferenceSuggestions={scriptReferenceSuggestions}
          referenceLinks={referenceLinks}
          pendingLinkUrl={pendingReferenceLinkUrl}
          showReferenceLinkInput={showReferenceLinkInput}
          isAddingReferenceLink={isAddingReferenceLink}
          selectedScriptModel={selectedScriptGenerationModel}
          scriptModelOptions={customScriptModelOptions}
          constitutionAnalysis={constitutionAnalysis}
          selectedPromptTemplateName={selectedPromptTemplateName}
          selectedPromptTemplateEngine={selectedPromptTemplateEngine}
          onGenerateScript={handleGenerateScriptClick}
          onViewPrompt={() => {
            const targetTemplate = selectedPromptTemplate || syncedPromptTemplates[0] || null;
            if (!targetTemplate) {
              setNotice('표시할 프롬프트가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
              return;
            }
            setPromptPreviewDraft(targetTemplate.prompt || '');
            setPromptPreviewId(targetTemplate.id);
          }}
          onStoryScriptChange={setStoryScript}
          onSaveStoryScript={() => { void hydrateCharactersForScript({ preserveSelection: true }); }}
          onCustomScriptReferenceTextChange={setCustomScriptReferenceText}
          onApplyScriptReferenceSuggestion={applyScriptReferenceSuggestion}
          onRefreshScriptReferenceSuggestions={refreshScriptReferenceSuggestions}
          onPendingLinkUrlChange={setPendingReferenceLinkUrl}
          onToggleReferenceLinkInput={toggleReferenceLinkInput}
          onAddReferenceLink={addReferenceLink}
          onRemoveReferenceLink={removeReferenceLink}
          onScriptModelChange={setSelectedScriptGenerationModel}
          extractedCharacters={extractedCharacters}
          selectedCharacterIds={normalizedSelectedCharacterIds}
          isHydratingCharacters={isExtracting}
          isLoadingVoiceCatalogs={isLoadingVoiceCatalogs}
          projectVoiceProvider={projectVoiceProvider}
          projectVoiceSummary={projectVoiceSummary}
          elevenLabsVoices={elevenLabsVoices}
          heygenVoices={heygenVoices}
          activeVoicePreviewCharacterId={voicePreviewCharacterId}
          voicePreviewMessage={voicePreviewMessage}
          newCharacterName={newCharacterName}
          newCharacterPrompt={newCharacterPrompt}
          onCharacterToggle={(characterId) => toggleCharacterSelection(characterId)}
          onCharacterRemove={(characterId) => removeCharacter(characterId)}
          onCharacterVoiceProviderChange={handleCharacterVoiceProviderChange}
          onCharacterVoiceChoiceChange={handleCharacterVoiceChoiceChange}
          onCharacterVoiceDirectInputChange={handleCharacterVoiceDirectInputChange}
          onPreviewCharacterVoice={handlePreviewCharacterVoice}
          onNewCharacterNameChange={(value) => setNewCharacterName(value)}
          onNewCharacterPromptChange={(value) => setNewCharacterPrompt(value)}
          onCreateNewCharacter={createNewCharacterByPrompt}
          onCreateCharacterFromForm={createNewCharacterFromForm}
          getCharacterVoiceSummary={getCharacterVoiceSummary}
          castSelectionHighlightTick={step3CastSelectionHighlightTick}
        />
      );
    }

    if (currentRouteStep === 4) {
      return (
        <Step4Panel
          extractedCharacters={selectedCharactersForStep4}
          selectedCharacterIds={normalizedSelectedCharacterIds}
          selectedCharacterStyleId={selectedCharacterStyleId}
          characterStyleOptions={characterStyleOptions}
          localStage={step4LocalStage}
          isExtracting={isExtracting}
          characterLoadingProgress={characterLoadingProgress}
          onHydrateCharacters={() => { void hydrateCharactersForScript({ preserveSelection: true }); }}
          onLocalStageChange={setStep4LocalStage}
          onSelectCharacterStyle={vm.setSelectedCharacterStyleId}
          onUploadCharacterImage={handleCharacterUploadForId}
          onUploadNewCharacterImage={openCharacterUploadPicker}
          onToggleCharacter={toggleCharacterSelection}
          onSelectCharacterImage={selectCharacterImageById}
          onCharacterPromptChange={updateCharacterPrompt}
          onCreateVariants={(character, options) => { void createCharacterVariants(character, options); }}
          uploadInput={<input ref={characterUploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleUpload(e, 'character')} />}
        />
      );
    }

    return (
      <Step5Panel
        styleGroups={styleGroups}
        selectedStyleImageId={selectedStyleImageId}
        newStyleName={newStyleName}
        newStylePrompt={newStylePrompt}
        isExtracting={isExtracting}
        onEnsureStyleRecommendations={() => { void ensureStyleRecommendations('manual'); }}
        onCreateStyle={createNewStyleByPrompt}
        onCreateVariants={(styleCard) => { void createStyleVariants(styleCard); }}
        onApplyStyleSample={applyStyleSampleFromPreset}
        onSelectStyle={setSelectedStyleImageId}
        onStyleNameChange={setNewStyleName}
        onStylePromptChange={setNewStylePrompt}
      />
    );
  };

  const handleNextRouteStep = () => {
    if (currentRouteStep === 5) {
      void handleOpenSceneStudioClick();
      return;
    }
    if (!nextRouteStep) return;
    if (currentRouteStep === 4 && step4LocalStage === 'style') {
      if (!selectedCharacterStyleId) return;
      setStep4LocalStage('workspace');
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }
    if (currentRouteStep === 3) {
      window.requestAnimationFrame(() => {
        void completeStage(currentRouteStep, nextRouteStep as StepId);
      });
      return;
    }
    void completeStage(currentRouteStep, nextRouteStep as StepId);
  };

  const canMoveNext = currentRouteStep === 1
    ? Boolean(hasSelectedContentType && hasSelectedAspectRatio)
    : currentRouteStep === 4 && step4LocalStage === 'style'
      ? Boolean(selectedCharacterStyleId)
    : Boolean(routeStepCompleted[currentRouteStep]);

  return (
    <div className="mx-auto my-6 w-full max-w-[1520px] px-4 pb-32 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">{currentRouteStep}단계</div>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{STEP_META[currentRouteStep - 1]?.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{STEP_META[currentRouteStep - 1]?.subtitle}</p>
      </div>
      {notice && (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900 shadow-sm">
          {notice}
        </div>
      )}
      <div className={`mt-6 min-h-[420px] ${currentRouteStep === 3 ? '' : 'transition-all duration-300'} ${stepShellVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}>{renderRouteContent()}</div>
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-3 shadow-xl shadow-slate-200/70 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              if (currentRouteStep === 4 && step4LocalStage === 'workspace') {
                setStep4LocalStage('style');
                window.requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                return;
              }
              if (previousRouteStep) {
                void moveRouteStep(previousRouteStep);
                return;
              }
              goBackFromStep1();
            }}
            className="min-w-[120px] rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {currentRouteStep === 1 ? '돌아가기' : '이전으로'}
          </button>
          <button
            type="button"
            onClick={handleNextRouteStep}
            disabled={!canMoveNext}
            className={`min-w-[140px] rounded-full px-6 py-3 text-sm font-black transition ${canMoveNext ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-300 text-slate-100 hover:bg-slate-300'} disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100`}
          >
            {currentRouteStep === 5 ? '영상 제작하기' : '다음으로'}
          </button>
        </div>
      </div>

      <OverlayModal
        open={Boolean(promptPreviewId)}
        title={syncedPromptTemplates.find((item: any) => item.id === promptPreviewId)?.name || '프롬프트 보기'}
        description={syncedPromptTemplates.find((item: any) => item.id === promptPreviewId)?.description || '선택한 프롬프트 본문을 팝업에서 크게 확인합니다.'}
        onClose={() => setPromptPreviewId(null)}
        footer={(
          <>
            {promptPreviewId && (
              <button
                type="button"
                onClick={() => {
                  const target = syncedPromptTemplates.find((item: any) => item.id === promptPreviewId);
                  if (!target) return;
                  updatePromptTemplate(target.id, { prompt: promptPreviewDraft });
                  setNotice('프롬프트 수정이 저장되었습니다. 대본생성 시 바로 반영됩니다.');
                  setPromptPreviewId(null);
                }}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500"
              >
                이 프롬프트 수정
              </button>
            )}
          </>
        )}
      >
        <textarea
          value={promptPreviewDraft || syncedPromptTemplates.find((item: any) => item.id === promptPreviewId)?.prompt || selectedPromptTemplate?.prompt || ''}
          onChange={(event) => setPromptPreviewDraft(event.target.value)}
          className="min-h-[420px] w-full rounded-2xl border border-blue-400 bg-blue-600 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-blue-100"
          placeholder="프롬프트를 불러오는 중입니다."
        />
      </OverlayModal>
    </div>
  );
}
