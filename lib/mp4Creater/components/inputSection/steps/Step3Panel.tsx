import React, { useEffect, useMemo, useState } from 'react';
import {
  CharacterProfile,
  ConstitutionAnalysisSummary,
  ContentType,
  ReferenceLinkDraft,
  WorkflowPromptTemplateEngine,
} from '../../../types';
import { OverlayModal } from '../ui';

interface Step3PanelProps {
  contentType: ContentType;
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
  onExpandScript: (chars: number) => void;
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
  onCreateCharacterFromForm: (payload: { name: string; position: string; description: string }) => void;
  getCharacterVoiceSummary: (character: CharacterProfile) => string;
}

const QWEN_VOICE_OPTIONS = [
  { id: 'qwen-default', name: 'qwen3-tts 기본 보이스' },
  { id: 'qwen-soft', name: 'qwen3-tts 부드러운 보이스' },
];


export default function Step3Panel({
  contentType,
  isGeneratingScript,
  sceneCount,
  storyScript,
  selectedScriptModel,
  scriptModelOptions,
  selectedPromptTemplateName,
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
  onExpandScript,
  onViewPrompt,
  onStoryScriptChange,
  onSaveStoryScript,
  onScriptModelChange,
  onCharacterToggle,
  onCharacterRemove,
  onCharacterVoiceProviderChange,
  onCharacterVoiceChoiceChange,
  onPreviewCharacterVoice,
  onCreateCharacterFromForm,
  getCharacterVoiceSummary,
}: Step3PanelProps) {
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [manualCharacterName, setManualCharacterName] = useState('');
  const [manualCharacterPosition, setManualCharacterPosition] = useState('');
  const [manualCharacterDescription, setManualCharacterDescription] = useState('');
  const selectedCount = selectedCharacterIds.length;
  const isMusicVideo = contentType === 'music_video';
  const scriptCharacterCount = Array.from(storyScript || '').length;
  const canSubmitManualCharacter = manualCharacterName.trim().length > 0 && manualCharacterPosition.trim().length > 0 && manualCharacterDescription.trim().length > 0;
  const currentRoleLabel = useMemo(() => manualCharacterPosition.trim() || '포지션', [manualCharacterPosition]);

  useEffect(() => {
    if (isGeneratingScript) {
      setIsEditingScript(false);
    }
  }, [isGeneratingScript]);

  const closeCharacterModal = () => {
    setIsCharacterModalOpen(false);
    setManualCharacterName('');
    setManualCharacterPosition('');
    setManualCharacterDescription('');
  };

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">

<div className="flex items-center justify-between gap-4">
  <div className="text-[20px] font-black uppercase text-violet-900 whitespace-nowrap">
    AI 설정
  </div>

  <div className="flex flex-row flex-nowrap items-center gap-3 overflow-x-auto">
    <select
      value={selectedScriptModel}
      onChange={(e) => onScriptModelChange(e.target.value)}
      className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
    >
      {scriptModelOptions.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}{item.id === 'sample-script' ? ' · 무료' : ' · 유료'}
        </option>
      ))}
    </select>

    <button
      type="button"
      onClick={onViewPrompt}
      className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      프롬프트 보기
    </button>

    <button
      type="button"
      onClick={onGenerateScript}
      disabled={isGeneratingScript}
      className="shrink-0 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sceneCount}문단</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{scriptCharacterCount}자</span>
              {storyScript.trim() ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[500, 1000, 2000].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onExpandScript(count)}
                        disabled={isGeneratingScript}
                        className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        +{count}자
                      </button>
                    ))}
                  </div>
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
                </>
              ) : null}
            </div>
          </div>
          {storyScript.trim() ? <p className="mb-3 text-xs leading-6 text-slate-500">짧게 느껴지면 +500자, +1000자, +2000자로 현재 대본을 이어서 확장할 수 있습니다. 새로 생성하지 않고 지금 텍스트 뒤를 자연스럽게 이어갑니다.</p> : null}
          <textarea
            value={storyScript}
            onChange={(e) => onStoryScriptChange(e.target.value)}
            readOnly={!isEditingScript}
            className={`min-h-[420px] w-full rounded-3xl border px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition ${isEditingScript ? 'border-blue-300 bg-white focus:border-blue-400' : 'border-slate-200 bg-slate-50'}`}
            placeholder="여기에 최종 대본을 입력하거나 생성해 주세요."
          />
        </section>

        <section data-step3-cast-section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">출연자 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Step4로 넘길 출연자만 가볍게 고르세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">카드를 누르면 선택, 다시 누르면 해제됩니다. 출연자는 여기서 직접 추가하거나 삭제할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-black">
              <button
                type="button"
                onClick={() => setIsCharacterModalOpen(true)}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
              >
                출연자 추가
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">선택된 출연자 {selectedCount}명</span>
              {isMusicVideo ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">뮤직비디오는 보이스 선택 없음</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">현재 프로젝트 기본 · {projectVoiceSummary}</span>
              )}
            </div>
          </div>

          {extractedCharacters.length > 0 && !selectedCount ? (
            <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
              출연자를 1명 이상 선택해야 다음 단계로 넘어갈 수 있습니다. 자동 추출 후에도 기본 선택은 하지 않습니다. 대본을 다 쓴 뒤 다음으로를 누르면 이 구역으로 다시 안내됩니다.
            </div>
          ) : null}

          {!extractedCharacters.length ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm leading-6 text-slate-500">
              대본이 준비되면 출연자를 자동으로 불러옵니다. 지금은 오른쪽 위 출연자 추가 버튼으로 먼저 직접 등록할 수 있습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {extractedCharacters.map((character) => {
                const voiceProvider = character.voiceProvider || 'project-default';
                const qwenVoiceId = character.voiceProvider === 'qwen3Tts' ? (character.voiceId || character.voiceHint || 'qwen-default') : 'qwen-default';
                const elevenVoiceId = character.voiceProvider === 'elevenLabs' ? (character.voiceId || character.voiceHint || elevenLabsVoices[0]?.voice_id || '') : (elevenLabsVoices[0]?.voice_id || '');
                const heygenVoiceId = character.voiceProvider === 'heygen' ? (character.voiceId || character.voiceHint || heygenVoices[0]?.voice_id || '') : (heygenVoices[0]?.voice_id || '');
                const isPreviewing = activeVoicePreviewCharacterId === character.id;
                const selected = selectedCharacterIds.includes(character.id);

                return (
                  <div
                    key={character.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onCharacterToggle(character.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onCharacterToggle(character.id);
                      }
                    }}
                    className={`rounded-[22px] border px-4 py-3 transition ${selected ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900">{character.name}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : character.role === 'support' ? '조연' : '내레이터')}</div>
                        {character.description ? <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{character.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCharacterRemove(character.id);
                          }}
                          className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-black text-rose-600 transition hover:bg-rose-50"
                        >
                          삭제
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCharacterToggle(character.id);
                          }}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${selected ? 'bg-blue-600 text-white hover:bg-blue-500' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                        >
                          {selected ? '출연자 선택됨' : '출연자 선택하기'}
                        </button>
                      </div>
                    </div>

                    {!isMusicVideo && selected ? (
                      <>
                        <div className="mt-3 grid gap-2">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-black text-slate-700">보이스 API</div>
                            <select
                              value={voiceProvider}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(e) => onCharacterVoiceProviderChange(character.id, e.target.value as 'project-default' | 'qwen3Tts' | 'elevenLabs' | 'heygen')}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                            >
                              <option value="project-default">프로젝트 기본값 사용</option>
                              <option value="qwen3Tts">qwen3-tts</option>
                              <option value="elevenLabs">ElevenLabs</option>
                              <option value="heygen">HeyGen</option>
                            </select>
                          </label>

                          <label className="block">
                            <div className="mb-1 text-[11px] font-black text-slate-700">보이스 선택</div>
                            {voiceProvider === 'project-default' ? (
                              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500">{projectVoiceSummary}</div>
                            ) : voiceProvider === 'qwen3Tts' ? (
                              <select
                                value={qwenVoiceId}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'qwen3Tts', e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                              >
                                {QWEN_VOICE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            ) : voiceProvider === 'elevenLabs' ? (
                              <select
                                value={elevenVoiceId}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'elevenLabs', e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                              >
                                {elevenLabsVoices.length ? elevenLabsVoices.map((item) => <option key={item.voice_id} value={item.voice_id}>{item.name}</option>) : <option value="">연결된 보이스 없음</option>}
                              </select>
                            ) : (
                              <select
                                value={heygenVoiceId}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(e) => onCharacterVoiceChoiceChange(character.id, 'heygen', e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                              >
                                {heygenVoices.length ? heygenVoices.map((item) => <option key={item.voice_id} value={item.voice_id}>{item.name}{item.language ? ` · ${item.language}` : ''}</option>) : <option value="">연결된 보이스 없음</option>}
                              </select>
                            )}
                          </label>
                        </div>

                        <div className="mt-2 rounded-[18px] border border-white bg-white px-3 py-2 text-[11px] leading-5 text-slate-600">
                          {getCharacterVoiceSummary(character)}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2 text-[10px] font-black">
                            <span className={`rounded-full px-2 py-1 ${projectVoiceProvider === 'qwen3Tts' ? 'bg-violet-100 text-violet-700' : projectVoiceProvider === 'elevenLabs' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>기본 API · {projectVoiceProvider}</span>
                            {isLoadingVoiceCatalogs ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">동기화 중</span> : null}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPreviewCharacterVoice(character.id);
                            }}
                            className="rounded-2xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white hover:bg-slate-800"
                          >
                            {isPreviewing ? '미리듣기 정지' : '미리듣기'}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {isHydratingCharacters ? <p className="mt-4 text-xs leading-6 text-violet-600">대본 변경을 기준으로 출연자를 다시 정리하고 있습니다.</p> : null}
          {!isMusicVideo && voicePreviewMessage ? <p className="mt-2 text-xs leading-6 text-slate-500">{voicePreviewMessage}</p> : null}
        </section>
      </div>

      <OverlayModal
        open={isCharacterModalOpen}
        title="출연자 추가"
        description="이름, 포지션, 설명을 직접 입력하면 현재 프로젝트 출연자 카드에 바로 추가됩니다. 추가된 출연자는 자동 선택 상태로 Step4까지 이어집니다."
        onClose={closeCharacterModal}
        footer={(
          <>
            <button
              type="button"
              onClick={closeCharacterModal}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canSubmitManualCharacter}
              onClick={() => {
                if (!canSubmitManualCharacter) return;
                onCreateCharacterFromForm({
                  name: manualCharacterName.trim(),
                  position: manualCharacterPosition.trim(),
                  description: manualCharacterDescription.trim(),
                });
                closeCharacterModal();
              }}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
            >
              출연자 추가하기
            </button>
          </>
        )}
      >
        <div className="grid gap-4">
          <label className="block">
            <div className="mb-2 text-sm font-black text-slate-900">이름</div>
            <input
              value={manualCharacterName}
              onChange={(event) => setManualCharacterName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              placeholder="예: 민서"
            />
          </label>
          <label className="block">
            <div className="mb-2 text-sm font-black text-slate-900">포지션</div>
            <input
              value={manualCharacterPosition}
              onChange={(event) => setManualCharacterPosition(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              placeholder="예: 메인 진행자, 브랜드 담당자, 내레이션"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-black text-slate-900">설명</div>
            <textarea
              value={manualCharacterDescription}
              onChange={(event) => setManualCharacterDescription(event.target.value)}
              className="min-h-[132px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400"
              placeholder={`${currentRoleLabel}의 분위기, 성격, 외형, 말투 등을 간단히 적어 주세요.`}
            />
          </label>
        </div>
      </OverlayModal>
    </>
  );
}
