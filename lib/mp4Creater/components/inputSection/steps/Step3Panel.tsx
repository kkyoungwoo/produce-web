import React from 'react';
import {
  ConstitutionAnalysisSummary,
  ReferenceLinkDraft,
  ScriptLanguageOption,
  ScriptSpeechStyle,
  WorkflowPromptTemplateEngine,
} from '../../../types';

interface Step3PanelProps {
  isGeneratingScript: boolean;
  sceneCount: number;
  storyScript: string;
  customScriptDurationMinutes: number;
  customScriptSpeechStyle: ScriptSpeechStyle;
  customScriptLanguage: ScriptLanguageOption;
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
  onGenerateScript: () => void;
  onViewPrompt: () => void;
  onStoryScriptChange: (value: string) => void;
  onCustomScriptDurationChange: (value: number) => void;
  onCustomScriptSpeechStyleChange: (value: ScriptSpeechStyle) => void;
  onCustomScriptLanguageChange: (value: ScriptLanguageOption) => void;
  onCustomScriptReferenceTextChange: (value: string) => void;
  onApplyScriptReferenceSuggestion: (value: string) => void;
  onRefreshScriptReferenceSuggestions: () => void;
  onPendingLinkUrlChange: (value: string) => void;
  onToggleReferenceLinkInput: () => void;
  onAddReferenceLink: () => void;
  onRemoveReferenceLink: (id: string) => void;
  onScriptModelChange: (value: string) => void;
}

const SCRIPT_LANGUAGE_OPTIONS: Array<{ value: ScriptLanguageOption; label: string }> = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' },
  { value: 'vi', label: '베트남어' },
  { value: 'mn', label: '몽골어' },
  { value: 'th', label: '태국어' },
  { value: 'uz', label: '우즈베크어' },
];

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16];

export default function Step3Panel({
  isGeneratingScript,
  sceneCount,
  storyScript,
  customScriptDurationMinutes,
  customScriptSpeechStyle,
  customScriptLanguage,
  customScriptReferenceText,
  scriptReferenceSuggestions,
  referenceLinks,
  pendingLinkUrl,
  showReferenceLinkInput,
  isAddingReferenceLink,
  selectedScriptModel,
  scriptModelOptions,
  constitutionAnalysis,
  selectedPromptTemplateName,
  selectedPromptTemplateEngine,
  onGenerateScript,
  onViewPrompt,
  onStoryScriptChange,
  onCustomScriptDurationChange,
  onCustomScriptSpeechStyleChange,
  onCustomScriptLanguageChange,
  onCustomScriptReferenceTextChange,
  onApplyScriptReferenceSuggestion,
  onRefreshScriptReferenceSuggestions,
  onPendingLinkUrlChange,
  onToggleReferenceLinkInput,
  onAddReferenceLink,
  onRemoveReferenceLink,
  onScriptModelChange,
}: Step3PanelProps) {
  const hasPendingLinkInput = pendingLinkUrl.trim().length > 0;
  const isConstitutionMode = selectedPromptTemplateEngine === 'channel_constitution_v32';
  const visibleTitles = (constitutionAnalysis?.titles || []).slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">고객 커스텀 대본생성</div>
            <div className="mt-2 text-sm text-slate-600">길이, 말투, 언어, 참고 링크를 먼저 정하면 대본 생성 버튼을 눌렀을 때 결과가 더 또렷해집니다.</div>
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

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-[24px] border border-violet-100 bg-violet-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">영상 예상 길이</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">드래그 없이 바로 눌러 선택합니다.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">{customScriptDurationMinutes}분</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((value) => {
                const selected = customScriptDurationMinutes === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onCustomScriptDurationChange(value)}
                    className={`rounded-2xl px-3 py-2 text-sm font-black transition ${selected ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                  >
                    {value}분
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-900">대화체</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ['yo', '요체'],
                ['da', '다체'],
                ['random', '랜덤'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onCustomScriptSpeechStyleChange(value)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black transition ${customScriptSpeechStyle === value ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-900">대본 언어</div>
            <select
              value={customScriptLanguage}
              onChange={(e) => onCustomScriptLanguageChange(e.target.value as ScriptLanguageOption)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {SCRIPT_LANGUAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-900">대본 참고 내용</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">텍스트와 링크를 섞어서 넣으면 유튜브는 영상 메타를, 일반 링크는 웹페이지 본문을 읽어 함께 반영합니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleReferenceLinkInput}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
              >
                링크 넣기
              </button>
              <button
                type="button"
                onClick={onRefreshScriptReferenceSuggestions}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
              >
                추천 새로고침
              </button>
            </div>
          </div>

          {(showReferenceLinkInput || hasPendingLinkInput || referenceLinks.some((item) => item.status === 'loading')) && (
            <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4 md:flex-row">
              <input
                value={pendingLinkUrl}
                onChange={(e) => onPendingLinkUrlChange(e.target.value)}
                placeholder="유튜브 또는 웹사이트 링크를 붙여 넣으세요"
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
              />
              <button
                type="button"
                onClick={onAddReferenceLink}
                disabled={isAddingReferenceLink || !pendingLinkUrl.trim()}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isAddingReferenceLink ? '분석 중...' : '링크 분석 추가'}
              </button>
            </div>
          )}

          {referenceLinks.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {referenceLinks.map((link) => (
                <div key={link.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${link.kind === 'youtube' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {link.kind === 'youtube' ? '유튜브 분석' : '웹사이트 글 분석'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${link.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : link.status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {link.status === 'ready' ? '반영 준비 완료' : link.status === 'error' ? '분석 실패' : '분석 중'}
                        </span>
                      </div>
                      <div className="mt-3 truncate text-sm font-black text-slate-900">{link.title || link.url}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{link.url}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveReferenceLink(link.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      삭제
                    </button>
                  </div>
                  {link.summary && <p className="mt-3 line-clamp-4 text-xs leading-6 text-slate-600">{link.summary}</p>}
                  {link.error && <p className="mt-3 text-xs leading-5 text-rose-600">{link.error}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {scriptReferenceSuggestions.map((suggestion, index) => (
              <button
                key={`script-reference-${index}`}
                type="button"
                onClick={() => onApplyScriptReferenceSuggestion(suggestion)}
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left text-sm leading-6 text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50"
              >
                <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700">추천 {index + 1}</span>
                <div className="mt-3 line-clamp-4">{suggestion}</div>
              </button>
            ))}
          </div>

          <textarea
            value={customScriptReferenceText}
            onChange={(e) => onCustomScriptReferenceTextChange(e.target.value)}
            className="mt-4 min-h-[150px] w-full rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-violet-400"
            placeholder="예: 초반 5초는 문제 상황을 강하게 보여주고, 중간에는 실제 사례를 넣고, 마지막엔 바로 행동할 수 있는 한 줄로 마무리해 주세요. 링크 분석 내용과 함께 섞여 최종 대본에 반영됩니다."
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">최종 대본</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sceneCount}문단</span>
            <select
              value={selectedScriptModel}
              onChange={(e) => onScriptModelChange(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {scriptModelOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isGeneratingScript ? '대본 생성 중...' : '대본생성'}
            </button>
          </div>
        </div>
        <textarea
          value={storyScript}
          onChange={(e) => onStoryScriptChange(e.target.value)}
          className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-900 outline-none transition focus:border-blue-400"
          placeholder="여기에 최종 대본을 입력하거나 생성해 주세요."
        />
      </section>
    </div>
  );
}
