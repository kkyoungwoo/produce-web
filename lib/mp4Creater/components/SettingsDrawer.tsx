'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { StudioState } from '../types';
import { pickFolderPath } from '../services/folderPicker';
import { ELEVENLABS_MODELS, IMAGE_MODELS, SCRIPT_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS } from '../config';
import HelpTip from './HelpTip';

interface SettingsDrawerProps {
  open: boolean;
  studioState: StudioState | null;
  onClose: () => void;
  onSave: (nextState: Partial<StudioState>) => void | Promise<void>;
}

const cardClass = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400';

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, studioState, onClose, onSave }) => {
  const [storageDir, setStorageDir] = useState('');
  const [pickedFolderLabel, setPickedFolderLabel] = useState('');
  const [providerValues, setProviderValues] = useState({
    openRouterApiKey: '',
    elevenLabsApiKey: '',
    falApiKey: '',
  });
  const [routing, setRouting] = useState({
    scriptModel: 'openrouter/auto',
    sceneModel: 'openrouter/auto',
    imagePromptModel: 'openrouter/auto',
    motionPromptModel: 'openrouter/auto',
    imageProvider: 'gemini',
    imageModel: 'gemini-2.5-flash-image',
    audioProvider: 'elevenlabs',
    audioModel: 'eleven_multilingual_v2',
    videoProvider: 'fal',
    videoModel: 'pixverse/v5.5',
  });
  const [revealSecrets, setRevealSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !studioState) return;
    setStorageDir(studioState.storageDir || '');
    setProviderValues({
      openRouterApiKey: studioState.providers.openRouterApiKey || '',
      elevenLabsApiKey: studioState.providers.elevenLabsApiKey || '',
      falApiKey: studioState.providers.falApiKey || '',
    });
    setRouting((prev) => ({ ...prev, ...studioState.routing }));
    setPickedFolderLabel('');
  }, [open, studioState]);

  const providerStatus = useMemo(() => ({
    text: Boolean(providerValues.openRouterApiKey.trim()),
    image: Boolean(providerValues.openRouterApiKey.trim()),
    audio: Boolean(providerValues.elevenLabsApiKey.trim()),
    video: Boolean(providerValues.falApiKey.trim()),
  }), [providerValues]);

  if (!open || !studioState) return null;

  const handleFolderPick = async () => {
    const picked = await pickFolderPath(storageDir);
    if (!picked) return;
    setStorageDir(picked.nextPath);
    setPickedFolderLabel(picked.selectedLabel);
  };

  const clearApiKey = (key: 'openRouterApiKey' | 'elevenLabsApiKey' | 'falApiKey') => {
    setProviderValues((prev) => ({ ...prev, [key]: '' }));
    setRevealSecrets((prev) => ({ ...prev, [key]: true }));
  };

  const handleSave = async () => {
    await onSave({
      storageDir: storageDir.trim(),
      isStorageConfigured: Boolean(storageDir.trim()),
      selectedCharacterId: studioState.selectedCharacterId,
      characters: studioState.characters,
      providers: {
        ...studioState.providers,
        openRouterApiKey: providerValues.openRouterApiKey.trim(),
        elevenLabsApiKey: providerValues.elevenLabsApiKey.trim(),
        falApiKey: providerValues.falApiKey.trim(),
      },
      routing: {
        ...studioState.routing,
        ...routing,
      },
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-slate-950/30 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-black text-slate-900">mp4Creater 설정</h2>
            <p className="mt-1 text-xs text-slate-500">폴더, API 키, 작업별 모델만 단순하게 관리합니다.</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">닫기</button>
        </div>

        <div className="space-y-8 p-6">
          <section className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">저장 폴더</h3>
              <HelpTip title="폴더는 언제든 바꿀 수 있나요?" compact>
                가능합니다. 저장 버튼을 눌러야 반영됩니다.
              </HelpTip>
            </div>
            <div className="flex gap-2">
              <input
                value={storageDir}
                onChange={(e) => setStorageDir(e.target.value)}
                className={inputClass}
                placeholder="예: ./local-data/tubegen-studio 또는 D:/TubeGenProjects"
              />
              <button type="button" onClick={handleFolderPick} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">폴더 선택</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">프로젝트는 이 폴더 아래 <strong className="text-slate-700">projects/project-0001-이름</strong> 형태로 정리됩니다. 비워 두면 프로젝트 파일 저장은 진행되지 않습니다.</p>
            {pickedFolderLabel && <p className="mt-1 text-xs text-blue-600">최근 선택한 폴더명: {pickedFolderLabel}</p>}
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">API 키</h3>
              <HelpTip title="어디서 입력해도 여기로 모입니다" compact>
                프로젝트 진행 중 빠른 등록으로 넣은 키도 설정에 자동으로 반영됩니다. 삭제는 여기서 하면 됩니다.
              </HelpTip>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { id: 'openRouterApiKey', title: 'OpenRouter', caption: '대본 / 프롬프트 / 추천', placeholder: '예: sk-or-v1-...' },
                { id: 'elevenLabsApiKey', title: 'ElevenLabs', caption: '나레이션 / TTS', placeholder: '예: sk_...' },
                { id: 'falApiKey', title: 'FAL / 영상 API', caption: '영상 변환', placeholder: '예: Key ...' },
              ].map((item) => {
                const value = (providerValues as Record<string, string>)[item.id] || '';
                const hasValue = Boolean(value.trim());
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.caption}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${hasValue ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {hasValue ? '연결됨' : '미연결'}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setRevealSecrets((prev) => ({ ...prev, [item.id]: !prev[item.id] }))} className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-white">
                        {revealSecrets[item.id] ? '숨기기' : hasValue ? '수정 / 보기' : '입력'}
                      </button>
                      {hasValue && (
                        <button type="button" onClick={() => clearApiKey(item.id as 'openRouterApiKey' | 'elevenLabsApiKey' | 'falApiKey')} className="rounded-xl border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50">
                          삭제
                        </button>
                      )}
                    </div>
                    {revealSecrets[item.id] && (
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => setProviderValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className={`${inputClass} mt-3 bg-white`}
                        placeholder={item.placeholder}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">작업별 모델</h3>
              <HelpTip title="연결되지 않은 모델도 고를 수는 있지만" compact>
                필요한 API가 없으면 실제 생성 대신 샘플 모드나 안내 메시지로 동작합니다.
              </HelpTip>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">대본 생성 모델</div>
                <select value={routing.scriptModel} onChange={(e) => setRouting((prev) => ({ ...prev, scriptModel: e.target.value }))} className={inputClass}>
                  {SCRIPT_MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <p className={`mt-2 text-xs leading-5 ${providerStatus.text ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.text ? '실제 AI 대본 생성 가능' : 'OpenRouter 연결 필요. 현재는 샘플 대본 생성으로 동작합니다.'}
                </p>
              </label>
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">씬 / 분해 모델</div>
                <input value={routing.sceneModel} onChange={(e) => setRouting((prev) => ({ ...prev, sceneModel: e.target.value }))} className={inputClass} placeholder="예: openrouter/auto" />
                <p className={`mt-2 text-xs leading-5 ${providerStatus.text ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.text ? '스토리 기반 씬 정리에 사용 가능' : 'OpenRouter 연결이 필요합니다.'}
                </p>
              </label>
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">이미지 프롬프트 모델</div>
                <input value={routing.imagePromptModel} onChange={(e) => setRouting((prev) => ({ ...prev, imagePromptModel: e.target.value }))} className={inputClass} placeholder="예: openrouter/auto" />
                <p className={`mt-2 text-xs leading-5 ${providerStatus.image ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.image ? '캐릭터 / 화풍 추천 품질에 반영' : '추천 카드는 샘플 기준으로 먼저 동작합니다.'}
                </p>
              </label>
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">움직임 프롬프트 모델</div>
                <input value={routing.motionPromptModel} onChange={(e) => setRouting((prev) => ({ ...prev, motionPromptModel: e.target.value }))} className={inputClass} placeholder="예: openrouter/auto" />
                <p className={`mt-2 text-xs leading-5 ${providerStatus.text ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.text ? '장면 액션 프롬프트에 사용 가능' : 'OpenRouter 연결이 필요합니다.'}
                </p>
              </label>
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">이미지 모델</div>
                <select value={routing.imageModel} onChange={(e) => setRouting((prev) => ({ ...prev, imageModel: e.target.value }))} className={inputClass}>
                  {IMAGE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <p className={`mt-2 text-xs leading-5 ${providerStatus.image ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.image ? '캐릭터 / 화풍 추천에 반영됩니다.' : '현재는 샘플 카드 중심으로 확인 가능합니다.'}
                </p>
              </label>
              <label>
                <div className="mb-1 text-xs font-bold text-slate-500">오디오 모델</div>
                <select value={routing.audioModel} onChange={(e) => setRouting((prev) => ({ ...prev, audioModel: e.target.value }))} className={inputClass}>
                  {ELEVENLABS_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <p className={`mt-2 text-xs leading-5 ${providerStatus.audio ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.audio ? '실제 나레이션 생성 가능' : 'ElevenLabs 연결 필요'}
                </p>
              </label>
              <label className="md:col-span-2">
                <div className="mb-1 text-xs font-bold text-slate-500">영상 모델</div>
                <select value={routing.videoModel} onChange={(e) => setRouting((prev) => ({ ...prev, videoModel: e.target.value }))} className={inputClass}>
                  {VIDEO_MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <p className={`mt-2 text-xs leading-5 ${providerStatus.video ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {providerStatus.video ? '실제 영상 변환 가능' : 'FAL / 영상 API 연결 필요'}
                </p>
              </label>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <p className="text-xs leading-5 text-slate-500">고급 기능은 제작 화면 안에서만 노출하고, 설정은 꼭 필요한 항목만 남겼습니다.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">취소</button>
            <button onClick={handleSave} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-500">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
