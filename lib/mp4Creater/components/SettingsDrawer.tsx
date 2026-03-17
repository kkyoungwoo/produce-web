'use client';

import React, { useMemo, useState } from 'react';
import { CharacterProfile, StudioState } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  studioState: StudioState | null;
  onClose: () => void;
  onSave: (nextState: Partial<StudioState>) => void | Promise<void>;
}

function emptyCharacter(): CharacterProfile {
  return {
    id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    description: '',
    visualStyle: '',
    createdAt: Date.now(),
  };
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, studioState, onClose, onSave }) => {
  const [draftCharacter, setDraftCharacter] = useState<CharacterProfile>(emptyCharacter());

  const selectedCharacter = useMemo(() => {
    if (!studioState) return null;
    return studioState.characters.find((item) => item.id === studioState.selectedCharacterId) || null;
  }, [studioState]);

  if (!open || !studioState) return null;

  const updateRouting = (key: string, value: string) => {
    onSave({
      routing: {
        ...studioState.routing,
        [key]: value,
      } as StudioState['routing'],
    });
  };

  const updateProviders = (key: string, value: string) => {
    onSave({
      providers: {
        ...studioState.providers,
        [key]: value,
      },
    });
  };

  const addCharacter = () => {
    if (!draftCharacter.name.trim()) return;
    onSave({
      characters: [...studioState.characters, draftCharacter],
      selectedCharacterId: draftCharacter.id,
    });
    setDraftCharacter(emptyCharacter());
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl h-full overflow-y-auto border-l border-slate-800 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">스튜디오 설정</h2>
            <p className="text-xs text-slate-500 mt-1">저장 위치, 캐릭터, 모델 라우팅을 한 곳에서 관리합니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">닫기</button>
        </div>

        <div className="p-6 space-y-8">
          <section>
            <h3 className="text-sm font-black text-white mb-3">로컬 저장 경로</h3>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm text-slate-200 break-all">{studioState.storageDir}</div>
              <p className="text-xs text-slate-500 mt-2">서버가 이 경로에 JSON 상태 파일과 프로젝트 파일을 저장합니다.</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-white mb-3">캐릭터</h3>
            <div className="space-y-3">
              <select
                value={studioState.selectedCharacterId || ''}
                onChange={(e) => onSave({ selectedCharacterId: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
              >
                {studioState.characters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
              {selectedCharacter && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="font-bold text-white">{selectedCharacter.name}</div>
                  <p className="text-sm text-slate-400 mt-1">{selectedCharacter.description}</p>
                  <p className="text-xs text-slate-500 mt-2">{selectedCharacter.visualStyle}</p>
                </div>
              )}
              <div className="grid gap-2">
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="새 캐릭터 이름"
                  value={draftCharacter.name}
                  onChange={(e) => setDraftCharacter({ ...draftCharacter, name: e.target.value })}
                />
                <textarea
                  className="w-full min-h-[88px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="캐릭터 설명"
                  value={draftCharacter.description}
                  onChange={(e) => setDraftCharacter({ ...draftCharacter, description: e.target.value })}
                />
                <textarea
                  className="w-full min-h-[76px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="비주얼 스타일"
                  value={draftCharacter.visualStyle}
                  onChange={(e) => setDraftCharacter({ ...draftCharacter, visualStyle: e.target.value })}
                />
                <button onClick={addCharacter} className="rounded-xl bg-brand-500 px-4 py-3 font-bold text-white">캐릭터 추가</button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-white mb-3">OpenRouter / 공급자</h3>
            <div className="space-y-3">
              <input
                type="password"
                value={studioState.providers.openRouterApiKey || ''}
                onChange={(e) => updateProviders('openRouterApiKey', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                placeholder="OpenRouter API Key"
              />
              <input
                type="password"
                value={studioState.providers.elevenLabsApiKey || ''}
                onChange={(e) => updateProviders('elevenLabsApiKey', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                placeholder="ElevenLabs API Key"
              />
              <input
                type="password"
                value={studioState.providers.falApiKey || ''}
                onChange={(e) => updateProviders('falApiKey', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                placeholder="FAL API Key"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-white mb-3">작업별 모델 라우팅</h3>
            <div className="grid gap-3">
              {[
                ['scriptModel', '대본 생성 모델'],
                ['sceneModel', '씬 분해 모델'],
                ['imagePromptModel', '이미지 프롬프트 모델'],
                ['motionPromptModel', '움직임 프롬프트 모델'],
                ['imageModel', '이미지 모델'],
                ['audioModel', '오디오 모델'],
                ['videoModel', '영상 모델'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{label}</label>
                  <input
                    value={(studioState.routing as any)[key] || ''}
                    onChange={(e) => updateRouting(key, e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                    placeholder="예: openai/gpt-4.1-mini, google/gemini-2.5-flash"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
