'use client';

import React, { useState } from 'react';
import { DEFAULT_STORAGE_DIR } from '../services/localFileApi';
import { pickFolderPath } from '../services/folderPicker';
import HelpTip from './HelpTip';

interface StartupWizardProps {
  initialStorageDir?: string;
  onComplete: (payload: {
    storageDir: string;
  }) => void | Promise<void>;
}

const StartupWizard: React.FC<StartupWizardProps> = ({ initialStorageDir, onComplete }) => {
  const [storageDir, setStorageDir] = useState(initialStorageDir || '');
  const [pickedFolderLabel, setPickedFolderLabel] = useState('');
  const canStart = Boolean(storageDir.trim());

  const handleFolderPick = async () => {
    const picked = await pickFolderPath(storageDir);
    if (!picked) return;
    setStorageDir(picked.nextPath);
    setPickedFolderLabel(picked.selectedLabel);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-slate-200 p-8 lg:border-b-0 lg:border-r">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              처음 한 번만 설정
            </div>
            <h2 className="mt-4 text-3xl font-black text-slate-900">JSON 저장 위치부터 먼저 정합니다</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              초기 팝업에서는 JSON 저장 위치만 빠르게 정하도록 단순화했습니다.
              프로젝트 데이터와 프롬프트, 미디어 메타는 이 위치의 단일 JSON 저장소를 기준으로 빠르게 관리됩니다.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                  저장 위치
                  <HelpTip title="저장 위치 안내" compact>
                    처음 지정한 위치는 고정이 아닙니다. 설정 화면에서 다시 바꿀 수 있습니다. 예시는
                    <strong className="text-slate-900"> ./local-data/tubegen-studio</strong> 또는
                    <strong className="text-slate-900"> C:/TubeGenData</strong> 처럼 적으면 됩니다.
                  </HelpTip>
                </div>
                <div className="flex gap-2">
                  <input
                    value={storageDir}
                    onChange={(e) => setStorageDir(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
                    placeholder={DEFAULT_STORAGE_DIR}
                  />
                  <button
                    type="button"
                    onClick={handleFolderPick}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    폴더 선택
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  예시: <code className="text-slate-700">./local-data/tubegen-studio</code>, <code className="text-slate-700">D:/TubeGenProjects</code>
                </p>
                {pickedFolderLabel && (
                  <p className="mt-1 text-xs text-blue-600">최근 선택한 위치명: {pickedFolderLabel}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-slate-50 p-8">
            <h3 className="text-lg font-black text-slate-900">시작 미리보기</h3>
            <div className="mt-4 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Storage</div>
                <div className="mt-2 break-all text-sm text-slate-700">{storageDir || '아직 선택되지 않았습니다'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                시작 후에는 Step 1에서 비율과 유형을 고르고, Step 3이 끝나면 대본에 맞춘 주인공 / 조연 카드가 자동으로 준비됩니다.
                초기 팝업에서는 불필요한 캐릭터 입력을 제거해서 시작 흐름을 더 짧게 만들었습니다.
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                프로젝트는 번호별 폴더를 만들지 않고 <strong>studio-state.json</strong> 중심의 JSON 저장 구조로 관리됩니다. 복사, 삭제, 가져오기가 더 빠르고 안정적으로 동작합니다.
              </div>
            </div>

            <div className="mt-auto pt-8">
              <button
                onClick={() => {
                  if (!storageDir.trim()) return;
                  onComplete({
                    storageDir: storageDir.trim(),
                  });
                }}
                disabled={!canStart}
                className={`w-full rounded-2xl py-4 text-sm font-black text-white transition-colors ${canStart ? 'bg-blue-600 hover:bg-blue-500' : 'cursor-not-allowed bg-slate-300'}`}
              >
                저장 위치 확정하고 mp4Creater 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartupWizard;
