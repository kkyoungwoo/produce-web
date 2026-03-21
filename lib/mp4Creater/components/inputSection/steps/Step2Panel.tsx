import React, { useMemo, useState } from 'react';
import { ScriptLanguageOption, ScriptSpeechStyle } from '../../../types';
import { OverlayModal } from '../ui';

interface Step2PanelProps {
  topic: string;
  isRefreshingTopic: boolean;
  isInitialLoadingRecommendations?: boolean;
  topicRecommendations: string[];
  customScriptDurationMinutes: number;
  customScriptSpeechStyle: ScriptSpeechStyle;
  customScriptLanguage: ScriptLanguageOption;
  onTopicChange: (value: string) => void;
  onRefreshTopic: () => void;
  onSelectTopicRecommendation: (value: string) => void;
  onCustomScriptDurationChange: (value: number) => void;
  onCustomScriptSpeechStyleChange: (value: ScriptSpeechStyle) => void;
  onCustomScriptLanguageChange: (value: ScriptLanguageOption) => void;
}

const SCRIPT_LANGUAGE_OPTIONS: Array<{ value: ScriptLanguageOption; label: string; flag: string; hint: string }> = [
  { value: 'ko', label: '한국어', flag: '🇰🇷', hint: '자연스러운 한국어 대본' },
  { value: 'en', label: '영어', flag: '🇺🇸', hint: '글로벌 타깃 영어 대본' },
  { value: 'ja', label: '일본어', flag: '🇯🇵', hint: '일본어 흐름 반영' },
  { value: 'zh', label: '중국어', flag: '🇨🇳', hint: '중국어 톤 반영' },
  { value: 'vi', label: '베트남어', flag: '🇻🇳', hint: '베트남어 말맛 반영' },
  { value: 'mn', label: '몽골어', flag: '🇲🇳', hint: '몽골어 문장 흐름 반영' },
  { value: 'th', label: '태국어', flag: '🇹🇭', hint: '태국어 표현 반영' },
  { value: 'uz', label: '우즈베크어', flag: '🇺🇿', hint: '우즈베크어 리듬 반영' },
];

const QUICK_DURATION_OPTIONS = [1, 3, 5, 10, 15] as const;
const DURATION_MARK_OPTIONS = [1, 3, 5, 8, 10, 15, 20, 25, 30] as const;
const SPEECH_STYLE_OPTIONS: Array<{ value: ScriptSpeechStyle; label: string; hint: string }> = [
  { value: 'default', label: '기본', hint: '가장 무난한 기본 대화체' },
  { value: 'yo', label: '요체', hint: '부드럽고 친근한 말투' },
  { value: 'da', label: '다체', hint: '단정하고 서술형인 말투' },
  { value: 'eum', label: '음슴체', hint: '짧고 건조한 리듬감' },
];

function MoreButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
    >
      {children}
    </button>
  );
}

function CompactOption({
  active,
  onClick,
  title,
  subtitle,
  leading,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border px-3.5 py-3 text-left transition ${active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
      <div className="flex items-center gap-3">
        {leading ? <div className="text-xl leading-none">{leading}</div> : null}
        <div className="min-w-0">
          <div className={`text-[13px] font-black ${active ? 'text-violet-700' : 'text-slate-900'}`}>{title}</div>
          {subtitle ? <div className="mt-1 text-[11px] leading-5 text-slate-500">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}

function SettingCard({
  eyebrow,
  title,
  value,
  description,
  children,
  accent = 'slate',
}: {
  eyebrow: string;
  title: string;
  value: React.ReactNode;
  description: string;
  children: React.ReactNode;
  accent?: 'violet' | 'slate';
}) {
  const accentClass = accent === 'violet'
    ? 'border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50'
    : 'border-slate-200 bg-slate-50';

  return (
    <div className={`rounded-[22px] border p-4 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
          <div className="mt-1.5 text-base font-black text-slate-900">{title}</div>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{description}</p>
        </div>
        <div className="shrink-0 rounded-[18px] bg-white px-3.5 py-2.5 text-right shadow-sm">
          {value}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function Step2Panel({
  topic,
  isRefreshingTopic,
  isInitialLoadingRecommendations = false,
  topicRecommendations,
  customScriptDurationMinutes,
  customScriptSpeechStyle,
  customScriptLanguage,
  onTopicChange,
  onRefreshTopic,
  onSelectTopicRecommendation,
  onCustomScriptDurationChange,
  onCustomScriptSpeechStyleChange,
  onCustomScriptLanguageChange,
}: Step2PanelProps) {
  const [openModal, setOpenModal] = useState<'language' | 'speech' | 'duration' | null>(null);

  const selectedLanguage = useMemo(
    () => SCRIPT_LANGUAGE_OPTIONS.find((item) => item.value === customScriptLanguage) || SCRIPT_LANGUAGE_OPTIONS[0],
    [customScriptLanguage]
  );
  const selectedSpeech = useMemo(
    () => SPEECH_STYLE_OPTIONS.find((item) => item.value === customScriptSpeechStyle) || SPEECH_STYLE_OPTIONS[0],
    [customScriptSpeechStyle]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">대본 설정</div>
            <h2 className="mt-1.5 text-lg font-black text-slate-900">대본 길이, 대화체, 언어를 먼저 고르세요</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">주제보다 먼저 틀을 잡아 두면 Step3 대본 생성 결과가 더 안정적으로 맞춰집니다.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SettingCard
            eyebrow="영상 예상 길이"
            title="몇 분짜리로 만들지 먼저 정하기"
            description="자주 쓰는 길이는 바로 누르고, 길게 만들 때는 팝업에서 슬라이드로 고릅니다."
            accent="violet"
            value={
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-500">선택됨</div>
                <div className="mt-1 text-2xl font-black text-violet-700">{customScriptDurationMinutes}<span className="ml-1 text-base">분</span></div>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_DURATION_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onCustomScriptDurationChange(value)}
                  className={`rounded-full px-3 py-2 text-xs font-black transition ${customScriptDurationMinutes === value ? 'scale-[1.04] bg-violet-600 text-white shadow-lg shadow-violet-200' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {value}분
                </button>
              ))}
              <MoreButton onClick={() => setOpenModal('duration')}>전체 길이 보기</MoreButton>
            </div>
          </SettingCard>

          <SettingCard
            eyebrow="대화체"
            title="말투 톤 먼저 고르기"
            description="기본, 요체까지만 먼저 보이고 나머지는 팝업에서 고릅니다."
            value={
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">현재 말투</div>
                <div className="mt-1 text-lg font-black text-slate-900">{selectedSpeech.label}</div>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SPEECH_STYLE_OPTIONS.slice(0, 2).map((item) => (
                <CompactOption
                  key={item.value}
                  active={customScriptSpeechStyle === item.value}
                  onClick={() => onCustomScriptSpeechStyleChange(item.value)}
                  title={item.label}
                  subtitle={item.hint}
                />
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <MoreButton onClick={() => setOpenModal('speech')}>다른 대화체 보기</MoreButton>
            </div>
          </SettingCard>

          <SettingCard
            eyebrow="대본 언어"
            title="출력 언어 먼저 고르기"
            description="한국어, 영어까지만 먼저 보이고 나머지는 팝업에서 확인합니다."
            value={
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{selectedLanguage.flag}</span>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">현재 언어</div>
                  <div className="mt-1 text-lg font-black text-slate-900">{selectedLanguage.label}</div>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SCRIPT_LANGUAGE_OPTIONS.slice(0, 2).map((item) => (
                <CompactOption
                  key={item.value}
                  active={customScriptLanguage === item.value}
                  onClick={() => onCustomScriptLanguageChange(item.value)}
                  title={item.label}
                  subtitle={item.hint}
                  leading={item.flag}
                />
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <MoreButton onClick={() => setOpenModal('language')}>전체 언어 보기</MoreButton>
            </div>
          </SettingCard>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-black text-slate-900">콘텐츠 주제</label>
          <button
            type="button"
            onClick={onRefreshTopic}
            disabled={isRefreshingTopic}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshingTopic ? '추천 중...' : '주제 새로고침'}
          </button>
        </div>
        <input
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
          placeholder="예: 비 오는 도시 골목에서 다시 만난 두 사람"
        />
        <p className="mt-3 text-xs text-slate-500">
          입력한 텍스트를 기준으로 주제를 추천합니다. AI 미연결 상태에서는 샘플 추천이 랜덤으로 적용됩니다.
        </p>
        <div className="mt-4 space-y-2">
          <div className="text-xs font-black text-slate-600">추천 주제</div>
          <div className="flex flex-col gap-2">
            {isInitialLoadingRecommendations ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={`topic-skeleton-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="h-4 w-[82%] animate-pulse rounded bg-slate-200" />
                </div>
              ))
            ) : (
              topicRecommendations.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  type="button"
                  onClick={() => onSelectTopicRecommendation(item)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white"
                >
                  {item}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <OverlayModal
        open={openModal === 'duration'}
        title="영상 예상 길이 선택"
        description="마우스로 움직이며 1분부터 30분까지 원하는 길이를 바로 고를 수 있습니다."
        onClose={() => setOpenModal(null)}
      >
        <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-500">현재 선택</div>
          <div className="mt-2 text-5xl font-black text-violet-700">{customScriptDurationMinutes}<span className="ml-2 text-2xl">분</span></div>
          <div className="mt-5 px-1">
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={customScriptDurationMinutes}
              onChange={(event) => onCustomScriptDurationChange(Number(event.target.value))}
              className="h-3 w-full cursor-pointer accent-violet-600"
            />
            <div className="mt-3 flex items-center justify-between text-[11px] font-black text-slate-400">
              <span>1분</span>
              <span>10분</span>
              <span>20분</span>
              <span>30분</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {DURATION_MARK_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onCustomScriptDurationChange(value)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${customScriptDurationMinutes === value ? 'scale-[1.06] bg-violet-600 text-white shadow-lg shadow-violet-200' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {value}분
              </button>
            ))}
          </div>
        </div>
      </OverlayModal>

      <OverlayModal
        open={openModal === 'speech'}
        title="대화체 선택"
        description="기본을 포함한 전체 대화체에서 원하는 톤을 고릅니다."
        onClose={() => setOpenModal(null)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {SPEECH_STYLE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onCustomScriptSpeechStyleChange(item.value);
                setOpenModal(null);
              }}
              className={`rounded-[24px] border px-4 py-4 text-left transition ${customScriptSpeechStyle === item.value ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="text-base font-black text-slate-900">{item.label}</div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</div>
            </button>
          ))}
        </div>
      </OverlayModal>

      <OverlayModal
        open={openModal === 'language'}
        title="대본 언어 선택"
        description="지원하는 언어 전체 목록에서 원하는 언어를 선택합니다."
        onClose={() => setOpenModal(null)}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCRIPT_LANGUAGE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onCustomScriptLanguageChange(item.value);
                setOpenModal(null);
              }}
              className={`rounded-[24px] border px-4 py-4 text-left transition ${customScriptLanguage === item.value ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="text-2xl">{item.flag}</div>
              <div className="mt-2 text-sm font-black text-slate-900">{item.label}</div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</div>
            </button>
          ))}
        </div>
      </OverlayModal>
    </div>
  );
}
