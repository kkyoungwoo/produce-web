'use client';

import React, { useMemo, useState } from 'react';
import { CharacterProfile } from '../types';
import { DEFAULT_STORAGE_DIR } from '../services/localFileApi';

interface StartupWizardProps {
  initialStorageDir?: string;
  onComplete: (payload: {
    storageDir: string;
    characters: CharacterProfile[];
    selectedCharacterId: string;
  }) => void;
}

function createCharacter(name: string, description: string, visualStyle: string): CharacterProfile {
  return {
    id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    visualStyle,
    createdAt: Date.now(),
  };
}

const StartupWizard: React.FC<StartupWizardProps> = ({ initialStorageDir, onComplete }) => {
  const [storageDir, setStorageDir] = useState(initialStorageDir || DEFAULT_STORAGE_DIR);
  const [name, setName] = useState('대표 캐릭터');
  const [description, setDescription] = useState('브랜드의 중심 화자. 친근하고 명확하게 전달한다.');
  const [visualStyle, setVisualStyle] = useState('깔끔한 2D 일러스트, 미니멀한 표정, 밝은 하이라이트');
  const preview = useMemo(() => createCharacter(name, description, visualStyle), [name, description, visualStyle]);

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-xs font-bold mb-4">
              Local-first setup
            </div>
            <h2 className="text-3xl font-black text-white mb-3">첫 시작부터 저장 경로를 먼저 잡습니다</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              이 버전은 프로젝트, 캐릭터, 모델 설정을 브라우저 임시 저장소가 아니라
              Next 서버가 접근 가능한 로컬 JSON 파일에 함께 저장하도록 설계했습니다.
            </p>

            <label className="block text-sm font-bold text-slate-200 mb-2">저장 경로</label>
            <input
              value={storageDir}
              onChange={(e) => setStorageDir(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder={DEFAULT_STORAGE_DIR}
            />
            <p className="text-xs text-slate-500 mt-2">
              예: <code className="text-slate-300">./local-data/tubegen-studio</code> 또는
              <code className="text-slate-300"> C:/TubeGenData</code>
            </p>

            <div className="mt-8">
              <h3 className="text-lg font-bold text-white mb-3">대표 캐릭터 등록</h3>
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="캐릭터 이름"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[96px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="캐릭터 성격 / 화법 / 역할"
                />
                <textarea
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full min-h-[88px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                  placeholder="캐릭터 비주얼 스타일"
                />
              </div>
            </div>
          </div>

          <div className="p-8 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">시작 미리보기</h3>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Storage</div>
                <div className="text-sm text-slate-200 break-all">{storageDir || DEFAULT_STORAGE_DIR}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Character</div>
                <div className="text-lg font-bold text-white">{preview.name}</div>
                <p className="text-sm text-slate-400 mt-1">{preview.description}</p>
                <p className="text-xs text-slate-500 mt-3">{preview.visualStyle}</p>
              </div>
            </div>

            <div className="mt-auto pt-8">
              <button
                onClick={() => onComplete({
                  storageDir: storageDir || DEFAULT_STORAGE_DIR,
                  characters: [preview],
                  selectedCharacterId: preview.id,
                })}
                className="w-full rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-black py-4 transition-colors"
              >
                저장 경로 설정하고 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartupWizard;
