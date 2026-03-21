import React, { useEffect, useState } from 'react';
import {
  CharacterProfile,
  ConstitutionAnalysisSummary,
  ReferenceLinkDraft,
  WorkflowPromptTemplateEngine,
} from '../../../types';

interface Step3PanelProps {
  isGeneratingScript: boolean;
  sceneCount: number;
  storyScript: string;
  customScriptReferenceText: string;
  scriptReferenceSuggestions: string[];
  referenceLinks: ReferenceLinkDraft[];
  pendingLinkUrl: string;
  showReferenceLinkInput: boolean;
  isAddingReferenceLink: boolean;
  selectedScriptModel: string;
  scriptModelOptions: Array<{ id: string; name: string }>;
  constitutionAnalysis: ConstitutionAnalysisSummary | null;
  selectedPromptTemplateName: string;
  selectedPromptTemplateEngine: WorkflowPromptTemplateEngine;
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  isHydratingCharacters: boolean;
  isLoadingVoiceCatalogs: boolean;
  projectVoiceProvider: 'qwen3Tts' | 'elevenLabs' | 'heygen';
  projectVoiceSummary: string;
  elevenLabsVoices: Array<{ voice_id: string; name: string; preview_url?: string; labels?: { accent?: string; gender?: string; description?: string } }>;
  heygenVoices: Array<{ voice_id: string; name: string; language?: string; gender?: string; preview_audio_url?: string; preview_audio?: string }>;
  activeVoicePreviewCharacterId: string | null;
  voicePreviewMessage: string;
  newCharacterName: string;
  newCharacterPrompt: string;
  onGenerateScript: () => void;
  onViewPrompt: () => void;
  onStoryScriptChange: (value: string) => void;
  onSaveStoryScript: () => void;
  onCustomScriptReferenceTextChange: (value: string) => void;
  onApplyScriptReferenceSuggestion: (value: string) => void;
  onRefreshScriptReferenceSuggestions: () => void;
  onPendingLinkUrlChange: (value: string) => void;
  onToggleReferenceLinkInput: () => void;
  onAddReferenceLink: () => void;
  onRemoveReferenceLink: (id: string) => void;
  onScriptModelChange: (value: string) => void;
  onCharacterToggle: (characterId: string) => void;
  onCharacterRemove: (characterId: string) => void;
  onCharacterVoiceProviderChange: (characterId: string, provider: 'project-default' | 'qwen3Tts' | 'elevenLabs' | 'heygen') => void;
  onCharacterVoiceChoiceChange: (characterId: string, provider: 'qwen3Tts' | 'elevenLabs' | 'heygen', value: string) => void;
  onPreviewCharacterVoice: (characterId: string) => void;
  onNewCharacterNameChange: (value: string) => void;
  onNewCharacterPromptChange: (value: string) => void;
  onCreateNewCharacter: () => void;
  getCharacterVoiceSummary: (character: CharacterProfile) => string;
}

const QWEN_VOICE_OPTIONS = [
  { id: 'qwen-default', name: 'qwen3-tts 기본 보이스' },
  { id: 'qwen-soft', name: 'qwen3-tts 부드러운 보이스' },
];

export default function Step3Panel({
  isGeneratingScript,
  sceneCount,
  storyScript,
  selectedScriptModel,
  scriptModelOptions,
  constitutionAnalysis,
  selectedPromptTemplateName,
  selectedPromptTemplateEngine,
  extractedCharacters,
  selectedCharacterIds,
  isHydratingCharacters,
  isLoadingVoiceCatalogs,
  projectVoiceProvider,
  projectVoiceSummary,
  elevenLabsVoices,
  heygenVoices,
  activeVoicePreviewCharacterId,
  voicePreviewMessage,
  onGenerateScript,
  onViewPrompt,
  onStoryScriptChange,
  onSaveStoryScript,
  onScriptModelChange,
  onCharacterToggle,
  onCharacterRemove,
  onCharacterVoiceProviderChange,
  onCharacterVoiceChoiceChange,
  onPreviewCharacterVoice,
  getCharacterVoiceSummary,
}: Step3PanelProps) {
  const [isEditingScript, setIsEditingScript] = useState(false);
  const isConstitutionMode = selectedPromptTemplateEngine === 'channel_constitution_v32';
  const visibleTitles = (constitutionAnalysis?.titles || []).slice(0, 6);
  const selectedCount = selectedCharacterIds.length;

  useEffect(() => {
    if (isGeneratingScript) {
      setIsEditingScript(false);
    }
  }, [isGeneratingScript]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">AI 대본 생성</div>
            <div className="mt-2 text-sm text-slate-600">프롬프트를 확인한 뒤 모델을 선택하고 바로 대본을 생성할 수 있습니다.</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">현재 프롬프트 · {selectedPromptTemplateName || '미선택'}</span>
              {isConstitutionMode && <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">채널 헌법 v32 분석형</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onViewPrompt}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            프롬프트 보기
          </button>
        </div>

        {(isConstitutionMode || constitutionAnalysis) && (
          <div className="mt-5 rounded-[24px] border border-violet-200 bg-violet-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">채널 헌법 브리핑</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">타겟, 안전성, 구조, 제목 초안을 함께 정리해 대본 방향을 흔들리지 않게 잡습니다.</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-violet-700">
                {constitutionAnalysis ? (constitutionAnalysis.source === 'ai' ? 'AI 분석 반영' : '샘플 분석 반영') : '생성 후 자동 표시'}
              </div>
            </div>

            {constitutionAnalysis ? (
              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                <div className="rounded-[20px] border border-white/80 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">타겟</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{constitutionAnalysis.targetProfile.name}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{constitutionAnalysis.targetProfile.identity}</p>
                </div>
                <div className="rounded-[20px] border border-white/80 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">안전 / 수익화</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black">
                    <span className={`rounded-full px-2.5 py-1 ${constitutionAnalysis.safetyReview.grade === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {constitutionAnalysis.safetyReview.grade === 'danger' ? '위험' : '안전'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 ${constitutionAnalysis.monetizationReview.grade === 'red' ? 'bg-rose-100 text-rose-700' : constitutionAnalysis.monetizationReview.grade === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      광고 {constitutionAnalysis.monetizationReview.grade === 'red' ? '부적합' : constitutionAnalysis.monetizationReview.grade === 'yellow' ? '제한 가능' : '적합'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{constitutionAnalysis.monetizationReview.solution || constitutionAnalysis.safetyReview.details}</p>
                </div>
                <div className="rounded-[20px] border border-white/80 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">선택 구조</div>
                  <div className="mt-2 text-sm font-black text-slate-900">모델 {constitutionAnalysis.selectedStructure.id}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{constitutionAnalysis.selectedStructure.reason}</p>
                </div>
                <div className="rounded-[20px] border border-white/80 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">관심 키워드</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {constitutionAnalysis.targetProfile.interests.slice(0, 4).map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-violet-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
                지금 생성하면 타겟 페르소나, 안전 / 광고 적합도, 선택한 60초 구조, 제목 초안과 함께 최종 대본이 정리됩니다.
              </div>
            )}

            {constitutionAnalysis && visibleTitles.length > 0 && (
              <div className="mt-4 rounded-[20px] border border-white/80 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">제목 초안</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleTitles.map((title) => (
                    <span key={title} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{title}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 rounded-[24px] border border-violet-100 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">AI 설정 및 생성</div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">대본 생성 모델</div>
              <select
                value={selectedScriptModel}
                onChange={(e) => onScriptModelChange(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
              >
                {scriptModelOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isGeneratingScript ? '대본 생성 중...' : '대본 생성'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">최종 대본</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">대본 생성 후 자동으로 출연자를 다시 정리합니다. 직접 수정할 때는 저장하기를 눌러 다시 반영하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sceneCount}문단</span>
            {storyScript.trim() ? (
              <button
                type="button"
                onClick={() => {
                  if (isEditingScript) {
                    onSaveStoryScript();
                    setIsEditingScript(false);
                    return;
                  }
                  setIsEditingScript(true);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {isEditingScript ? (isHydratingCharacters ? '저장 중...' : '저장하기') : '수정하기'}
              </button>
            ) : null}
          </div>
        </div>
        <textarea
          value={storyScript}
          onChange={(e) => onStoryScriptChange(e.target.value)}
          readOnly={!isEditingScript}
          className={`min-h-[420px] w-full rounded-3xl border px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition ${isEditingScript ? 'border-blue-300 bg-white focus:border-blue-400' : 'border-slate-200 bg-slate-50'}`}
          placeholder="여기에 최종 대본을 입력하거나 생성해 주세요."
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">출연자 관리 및 보이스</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">최종 대본 아래에서 출연자와 보이스를 같이 정리합니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">선택된 출연자만 Step4에서 이미지 후보를 고르게 됩니다. 필요하면 제외만 해 주세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">영상에 사용할 출연자 {selectedCount}명</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">현재 프로젝트 기본 · {projectVoiceSummary}</span>
          </div>
        </div>

        {extractedCharacters.length > 0 && !selectedCount ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            출연자를 1명 이상 선택해야 다음 단계로 넘어갈 수 있습니다. 자동 생성된 출연자는 기본 선택 상태가 되도록 보정했습니다.
          </div>
        ) : null}

        {!extractedCharacters.length ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm leading-6 text-slate-500">
            대본이 준비되면 출연자를 자동으로 불러옵니다.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {extractedCharacters.map((character) => {
              const voiceProvider = character.voiceProvider || 'project-default';
              const qwenVoiceId = character.voiceProvider === 'qwen3Tts' ? (character.voiceId || character.voiceHint || 'qwen-default') : 'qwen-default';
              const elevenVoiceId = character.voiceProvider === 'elevenLabs' ? (character.voiceId || character.voiceHint || elevenLabsVoices[0]?.voice_id || '') : (elevenLabsVoices[0]?.voice_id || '');
              const heygenVoiceId = character.voiceProvider === 'heygen' ? (character.voiceId || character.voiceHint || heygenVoices[0]?.voice_id || '') : (heygenVoices[0]?.voice_id || '');
              const isPreviewing = activeVoicePreviewCharacterId === character.id;
              const selected = selectedCharacterIds.includes(character.id);
              const preview = (character.generatedImages || []).find((item) => item.id === character.selectedImageId) || character.generatedImages?.[0] || null;

              return (
                <div key={character.id} className={`rounded-[24px] border p-4 ${selected ? 'border-violet-300 bg-violet-50/60 ring-2 ring-violet-100' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img src={preview?.imageData || '/mp4Creater/flow-character.svg'} alt={character.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-black text-slate-900">{character.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : character.role === 'support' ? '조연' : '내레이터')}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onCharacterToggle(character.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-black ${selected ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {selected ? '영상 사용 중' : '영상에 포함'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCharacterRemove(character.id)}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
                    <label className="block">
                      <div className="mb-1 text-xs font-black text-slate-700">API 선택</div>
                      <select
                        value={voiceProvider}
                        onChange={(e) => onCharacterVoiceProviderChange(character.id, e.target.value as 'project-default' | 'qwen3Tts' | 'elevenLabs' | 'heygen')}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                      >
                        <option value="project-default">프로젝트 기본값 사용</option>
                        <option value="qwen3Tts">qwen3-tts</option>
                        <option value="elevenLabs">ElevenLabs</option>
                        <option value="heygen">HeyGen</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-black text-slate-700">보이스 선택</div>
                      {voiceProvider === 'project-default' ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{projectVoiceSummary}</div>
                      ) : voiceProvider === 'qwen3Tts' ? (
                        <select
                          value={qwenVoiceId}
                          onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'qwen3Tts', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                        >
                          {QWEN_VOICE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      ) : voiceProvider === 'elevenLabs' ? (
                        <select
                          value={elevenVoiceId}
                          onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'elevenLabs', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                        >
                          {elevenLabsVoices.length ? elevenLabsVoices.map((item) => <option key={item.voice_id} value={item.voice_id}>{item.name}</option>) : <option value="">연결된 보이스 없음</option>}
                        </select>
                      ) : (
                        <select
                          value={heygenVoiceId}
                          onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'heygen', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                        >
                          {heygenVoices.length ? heygenVoices.map((item) => <option key={item.voice_id} value={item.voice_id}>{item.name}{item.language ? ` · ${item.language}` : ''}</option>) : <option value="">연결된 보이스 없음</option>}
                        </select>
                      )}
                    </label>
                  </div>

                  <div className="mt-3 rounded-[20px] border border-white bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                    {getCharacterVoiceSummary(character)}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-[11px] font-black">
                      <span className={`rounded-full px-2.5 py-1 ${projectVoiceProvider === 'qwen3Tts' ? 'bg-violet-100 text-violet-700' : projectVoiceProvider === 'elevenLabs' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>프로젝트 기본 API · {projectVoiceProvider}</span>
                      {isLoadingVoiceCatalogs ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">보이스 목록 동기화 중</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewCharacterVoice(character.id)}
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800"
                    >
                      {isPreviewing ? '미리듣기 정지' : '미리듣기'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isHydratingCharacters ? <p className="mt-4 text-xs leading-6 text-violet-600">대본 변경을 기준으로 출연자를 다시 정리하고 있습니다.</p> : null}
        {voicePreviewMessage ? <p className="mt-2 text-xs leading-6 text-slate-500">{voicePreviewMessage}</p> : null}
      </section>
    </div>
  );
}
