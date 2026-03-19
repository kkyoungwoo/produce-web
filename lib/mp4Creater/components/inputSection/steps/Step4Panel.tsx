import React from 'react';
import { CharacterProfile } from '../../../types';

interface Step4PanelProps {
  extractedCharacters: CharacterProfile[];
  selectedCharacterIds: string[];
  newCharacterName: string;
  newCharacterPrompt: string;
  isExtracting: boolean;
  onHydrateCharacters: (forceSample?: boolean) => void;
  onUploadClick: () => void;
  onCreateCharacter: () => void;
  onToggleCharacter: (id: string) => void;
  onCreateVariants: (character: CharacterProfile) => void;
  onNewCharacterName: (value: string) => void;
  onNewCharacterPrompt: (value: string) => void;
  uploadInput: React.ReactNode;
}

export default function Step4Panel({
  extractedCharacters,
  selectedCharacterIds,
  newCharacterName,
  newCharacterPrompt,
  isExtracting,
  onHydrateCharacters,
  onUploadClick,
  onCreateCharacter,
  onToggleCharacter,
  onCreateVariants,
  onNewCharacterName,
  onNewCharacterPrompt,
  uploadInput,
}: Step4PanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">대본에서 추출된 출연자 후보입니다. 출연자로 남기지 않을 인물은 선택 해제로 제외할 수 있습니다.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onHydrateCharacters(false)} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500">
            {isExtracting ? '준비 중...' : '대본 기반 캐릭터 준비'}
          </button>
          <button type="button" onClick={() => onHydrateCharacters(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            샘플로 채우기
          </button>
          <button type="button" onClick={onUploadClick} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            이미지 업로드
          </button>
          {uploadInput}
        </div>

        <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[0.75fr_1.25fr_auto]">
          <input value={newCharacterName} onChange={(e) => onNewCharacterName(e.target.value)} placeholder="출연자 이름" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" />
          <textarea value={newCharacterPrompt} onChange={(e) => onNewCharacterPrompt(e.target.value)} placeholder="출연자 설명 또는 프롬프트" className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-violet-400" />
          <div className="flex items-center justify-center">
            <button type="button" onClick={onCreateCharacter} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">출연자 추가</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {extractedCharacters.map((character) => {
          const active = selectedCharacterIds.includes(character.id);
          const selectedImage = (character.generatedImages || []).find((image) => image.id === character.selectedImageId) || character.generatedImages?.[0] || null;
          return (
            <div key={character.id} className={`rounded-[24px] border p-4 shadow-sm ${active ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {selectedImage?.imageData ? (
                    <img src={selectedImage.imageData} alt={character.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-400">없음</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-900">{character.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{character.role === 'lead' ? '주인공' : character.role === 'narrator' ? '내레이터' : '조연'}</div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{selectedImage?.prompt || character.prompt || character.description || '프롬프트 없음'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onToggleCharacter(character.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                  {active ? '선택 해제' : '선택'}
                </button>
                <button type="button" onClick={() => onCreateVariants(character)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  이미지 생성 +1
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
