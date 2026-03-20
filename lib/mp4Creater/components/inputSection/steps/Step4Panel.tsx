import React, { useEffect, useMemo, useState } from 'react';
import { CharacterProfile } from '../../../types';
import { TTS_NARRATOR_OPTIONS } from '../../../config';
import { CHARACTER_SAMPLE_PRESETS } from '../../../samples/presetCatalog';

interface CharacterStyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  accentFrom: string;
  accentTo: string;
}

interface Step4PanelProps {
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  selectedCharacterStyleId: string | null;
  characterStyleOptions: CharacterStyleOption[];
  isExtracting: boolean;
  onHydrateCharacters: (forceSample?: boolean) => void;
  onSelectCharacterStyle: (styleId: string) => void;
  onUploadCharacterImage: (characterId: string) => void;
  onApplyCharacterSampleToCharacter: (characterId: string, sampleId: string) => void;
  onToggleCharacter: (id: string) => void;
  onSelectCharacterImage: (characterId: string, imageId: string) => void;
  onCharacterVoiceChange: (characterId: string, voiceHint: string | null) => void;
  onCharacterPromptChange: (characterId: string, prompt: string) => void;
  onCreateVariants: (character: CharacterProfile) => void;
  uploadInput: React.ReactNode;
}

export default function Step4Panel({
  extractedCharacters,
  selectedCharacterIds,
  selectedCharacterStyleId,
  characterStyleOptions,
  isExtracting,
  onHydrateCharacters,
  onSelectCharacterStyle,
  onUploadCharacterImage,
  onApplyCharacterSampleToCharacter,
  onToggleCharacter,
  onSelectCharacterImage,
  onCharacterVoiceChange,
  onCharacterPromptChange,
  onCreateVariants,
  uploadInput,
}: Step4PanelProps) {
  const resolvedSelectedIds = selectedCharacterIds.length ? selectedCharacterIds : extractedCharacters.map((item) => item.id);
  const [localStage, setLocalStage] = useState<'style' | 'cast' | 'character'>(selectedCharacterStyleId ? 'cast' : 'style');
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(resolvedSelectedIds[0] || extractedCharacters[0]?.id || null);

  const selectedStyle = useMemo(
    () => characterStyleOptions.find((item) => item.id === selectedCharacterStyleId) || null,
    [characterStyleOptions, selectedCharacterStyleId]
  );
  const selectedCharacters = useMemo(
    () => extractedCharacters.filter((item) => resolvedSelectedIds.includes(item.id)),
    [extractedCharacters, resolvedSelectedIds]
  );
  const activeCharacter = useMemo(
    () => selectedCharacters.find((item) => item.id === activeCharacterId) || selectedCharacters[0] || null,
    [selectedCharacters, activeCharacterId]
  );

  useEffect(() => {
    if (!selectedCharacterStyleId) {
      setLocalStage('style');
      return;
    }
    setLocalStage((prev) => (prev === 'style' ? 'cast' : prev));
  }, [selectedCharacterStyleId]);

  useEffect(() => {
    if (!selectedCharacters.length) {
      setActiveCharacterId(null);
      return;
    }
    if (!activeCharacterId || !selectedCharacters.some((item) => item.id === activeCharacterId)) {
      setActiveCharacterId(selectedCharacters[0].id);
    }
  }, [activeCharacterId, selectedCharacters]);

  const openCastSelection = () => {
    if (!selectedCharacterStyleId) {
      setLocalStage('style');
      return;
    }
    setLocalStage('cast');
  };

  const confirmCastSelection = () => {
    if (!resolvedSelectedIds.length) return;
    setLocalStage('character');
  };

  return (
    <div className="space-y-6">
      {localStage === 'style' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">공통 캐릭터 스타일 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">출연자 전체에 먼저 적용할 캐릭터 스타일을 골라주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">여기서 고른 스타일은 Step4 출연자 캐릭터용 공통 기준입니다. Step5 최종 영상 화풍과는 분리되어 유지됩니다.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {characterStyleOptions.map((style) => {
              const selected = style.id === selectedCharacterStyleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    onSelectCharacterStyle(style.id);
                    setLocalStage('cast');
                  }}
                  className={`overflow-hidden rounded-[24px] border text-left shadow-sm transition ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200'}`}
                >
                  <div className={`h-28 bg-gradient-to-br ${style.accentFrom} ${style.accentTo} p-4 text-white`}>
                    <div className="inline-flex rounded-full bg-white/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]">공통 캐릭터</div>
                    <div className="mt-4 text-base font-black">{style.label}</div>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-3 text-xs leading-5 text-slate-600">{style.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">전체 적용</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {selected ? '선택됨' : '선택'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {localStage === 'cast' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">출연자 목록 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">이번 영상에 사용할 출연자를 확정해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">공통 캐릭터 스타일은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>입니다. 출연자를 확정한 뒤 각 출연자별 이미지와 프롬프트를 정리합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLocalStage('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                스타일 다시 선택
              </button>
              <button type="button" onClick={() => onHydrateCharacters(false)} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
                {isExtracting ? '불러오는 중...' : '출연자 다시 불러오기'}
              </button>
              <button type="button" onClick={() => onHydrateCharacters(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                샘플 출연자 불러오기
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {extractedCharacters.map((character) => {
              const selected = resolvedSelectedIds.includes(character.id);
              const preview = (character.generatedImages || []).find((item) => item.id === character.selectedImageId) || character.generatedImages?.[0] || null;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => onToggleCharacter(character.id)}
                  className={`rounded-[24px] border p-4 text-left transition ${selected ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img src={preview?.imageData || '/mp4Creater/flow-character.svg'} alt={character.name} className="aspect-square w-full object-cover" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">{character.roleLabel || (character.role === 'lead' ? '주인공' : '조연')}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {selected ? '선택됨' : '선택'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!extractedCharacters.length && (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
              3단계 대본 기준 출연자를 먼저 불러와 주세요. AI 연결이 없어도 샘플 2명으로 바로 진행할 수 있습니다.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={confirmCastSelection}
              disabled={!resolvedSelectedIds.length}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              출연자 확정하기
            </button>
          </div>
        </section>
      )}

      {localStage === 'character' && activeCharacter && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">출연자별 캐릭터 선택</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">출연자마다 사용할 이미지와 프롬프트를 정리해 주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">공통 캐릭터 스타일은 <span className="font-black text-slate-900">{selectedStyle?.label || '미선택'}</span>로 유지됩니다. 여기서 고른 이미지와 프롬프트는 Step6까지 그대로 전달됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openCastSelection} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                출연자 다시 선택
              </button>
              <button type="button" onClick={() => setLocalStage('style')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                스타일 다시 선택
              </button>
              {uploadInput}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedCharacters.map((character) => {
              const active = character.id === activeCharacter.id;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setActiveCharacterId(character.id)}
                  className={`rounded-full px-4 py-2 text-sm font-black ${active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {character.name}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{activeCharacter.name} 프롬프트</label>
                  <button type="button" onClick={() => onCreateVariants(activeCharacter)} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-500">
                    이미지 다시 만들기
                  </button>
                </div>
                <textarea
                  value={activeCharacter.prompt || ''}
                  onChange={(event) => onCharacterPromptChange(activeCharacter.id, event.target.value)}
                  placeholder="이 출연자 이미지를 어떤 느낌으로 만들지 직접 수정하세요. 수정 후 이미지 다시 만들기를 누르면 비슷한 방향으로 새 후보를 더 만듭니다."
                  className="mt-2 min-h-[170px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400"
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">이미지 수정 및 보이스</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onUploadCharacterImage(activeCharacter.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                      이미지 업로드
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {CHARACTER_SAMPLE_PRESETS.map((preset) => (
                    <button
                      key={`${activeCharacter.id}_${preset.id}`}
                      type="button"
                      onClick={() => onApplyCharacterSampleToCharacter(activeCharacter.id, preset.id)}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <div className="font-black text-slate-900">{preset.name}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{preset.roleLabel}</div>
                    </button>
                  ))}
                </div>
                <select
                  value={activeCharacter.voiceHint || ''}
                  onChange={(event) => onCharacterVoiceChange(activeCharacter.id, event.target.value || null)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400"
                >
                  <option value="">프로젝트 기본 보이스</option>
                  {TTS_NARRATOR_OPTIONS.map((voice) => (
                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{activeCharacter.name} 이미지 후보</div>
              <div className="mt-1 text-sm font-black text-slate-900">출연자별 이미지 스타일 선택</div>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <img
                  src={(activeCharacter.generatedImages || []).find((item) => item.id === activeCharacter.selectedImageId)?.imageData || activeCharacter.generatedImages?.[0]?.imageData || '/mp4Creater/flow-character.svg'}
                  alt={activeCharacter.name}
                  className="aspect-square w-full object-cover"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(activeCharacter.generatedImages || []).map((image, index) => {
                  const selected = image.id === activeCharacter.selectedImageId;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => onSelectCharacterImage(activeCharacter.id, image.id)}
                      className={`rounded-2xl border bg-white p-2 text-left ${selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img src={image.imageData} alt={image.label} className="aspect-square w-full object-cover" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="truncate text-[11px] font-black text-slate-800">후보 {index + 1}</div>
                        {selected && <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">선택</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
