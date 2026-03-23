'use client';

import React from 'react';
import { OverlayModal } from '../inputSection/ui';

type SummarySectionId = 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6';

interface SummarySectionItem {
  id: SummarySectionId;
  label: string;
  description: string;
}

interface SceneStudioHeaderPanelProps {
  isThumbnailStudioRoute: boolean;
  currentProjectNumber?: number | null;
  isGeneratingScenes: boolean;
  isGeneratingAllVideos: boolean;
  step4Open: boolean;
  summarySection: SummarySectionId;
  summarySections: SummarySectionItem[];
  onOpenSummary: () => void;
  onCloseSummary: () => void;
  onSelectSummarySection: (sectionId: SummarySectionId) => void;
  onGenerateImages: () => void | Promise<void>;
  onGenerateImagesWithAudio: () => void | Promise<void>;
  onGenerateAllVideos: () => void | Promise<void>;
  renderSummarySection: () => React.ReactNode;
}

const SceneStudioHeaderPanel: React.FC<SceneStudioHeaderPanelProps> = ({
  isThumbnailStudioRoute,
  currentProjectNumber,
  isGeneratingScenes,
  isGeneratingAllVideos,
  step4Open,
  summarySection,
  summarySections,
  onOpenSummary,
  onCloseSummary,
  onSelectSummarySection,
  onGenerateImages,
  onGenerateImagesWithAudio,
  onGenerateAllVideos,
  renderSummarySection,
}) => {
  return (
    <div className="mp4-glass-hero rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">{isThumbnailStudioRoute ? '썸네일 제작 화면' : '씬 제작 화면'}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900">{isThumbnailStudioRoute ? '프로젝트 썸네일 제작' : '프로젝트 씬 제작'}</h1>
            {currentProjectNumber ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">프로젝트 #{currentProjectNumber}</span> : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{isThumbnailStudioRoute ? '썸네일 생성 버튼과 결과 영역으로 바로 안내하는 전용 페이지입니다. 기존 씬 제작 데이터는 그대로 유지한 채 썸네일 작업만 이어갈 수 있습니다.' : '페이지 자체는 먼저 열고, 필요한 경우에만 짧게 준비 화면을 보여 줍니다. 실제 생성이 시작되면 전체 화면을 막지 않고 제작 중인 씬 카드에만 스켈레톤과 퍼센트를 표시합니다.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenSummary} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">입력 요약 보기</button>
          <button type="button" onClick={() => void onGenerateImages()} disabled={isGeneratingScenes} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500">{isGeneratingScenes ? '전체 이미지 생성 중...' : '전체 이미지 생성'}</button>
          <button type="button" onClick={() => void onGenerateImagesWithAudio()} disabled={isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">이미지 + 오디오 생성</button>
          <button type="button" onClick={() => void onGenerateAllVideos()} disabled={isGeneratingAllVideos || isGeneratingScenes} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">{isGeneratingAllVideos ? '전체 영상 생성 중...' : '모든 씬 영상 생성'}</button>
        </div>
      </div>

      <OverlayModal
        open={step4Open}
        title="입력 요약"
        description="Step1부터 Step6까지 저장된 값과 실제 전달되는 프롬프트를 구분별 버튼으로 확인합니다."
        onClose={onCloseSummary}
        dialogClassName="max-w-6xl"
        bodyClassName="max-h-[76vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {summarySections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSummarySection(section.id)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${summarySection === section.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {section.label}
              </button>
            ))}
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">현재 구분 설명</div>
            <div className="mt-2 text-sm font-black text-slate-900">{summarySections.find((section) => section.id === summarySection)?.label}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{summarySections.find((section) => section.id === summarySection)?.description}</p>
          </div>
          <div className="max-h-[62vh] overflow-auto pr-1">{renderSummarySection()}</div>
        </div>
      </OverlayModal>
    </div>
  );
};

export default SceneStudioHeaderPanel;
