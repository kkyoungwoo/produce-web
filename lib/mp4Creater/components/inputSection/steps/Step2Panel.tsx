import React from 'react';

interface Step2PanelProps {
  topic: string;
  isRefreshingTopic: boolean;
  isInitialLoadingRecommendations?: boolean;
  topicRecommendations: string[];
  onTopicChange: (value: string) => void;
  onRefreshTopic: () => void;
  onSelectTopicRecommendation: (value: string) => void;
}

export default function Step2Panel({
  topic,
  isRefreshingTopic,
  isInitialLoadingRecommendations = false,
  topicRecommendations,
  onTopicChange,
  onRefreshTopic,
  onSelectTopicRecommendation,
}: Step2PanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
          placeholder="예: 네온 야경 아래 다시 시작되는 후렴"
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
    </div>
  );
}
