import React from 'react';
import { GenerationStep, WorkflowPromptTemplate } from '../../types';
import { StepId } from './types';
import { OverlayModal } from './ui';

interface RouteStepFooterProps {
  routeStep?: 1 | 2 | 3 | 4 | 5 | null;
  previousRouteStep?: StepId | null;
  footerStage: StepId;
  nextRouteStep?: StepId | null;
  routeStepCompleted: Record<StepId, boolean>;
  stepCompleted: Record<StepId, boolean>;
  onMoveRouteStep: (step: StepId) => void | Promise<void>;
  onOpenSceneStudio: () => void | Promise<void>;
  isOpeningSceneStudio?: boolean;
  onCompleteStage: (from: StepId, to: StepId) => void | Promise<void>;
}

export function RouteStepFooter({
  routeStep,
  previousRouteStep,
  footerStage,
  nextRouteStep,
  routeStepCompleted,
  stepCompleted,
  onMoveRouteStep,
  onOpenSceneStudio,
  isOpeningSceneStudio = false,
  onCompleteStage,
}: RouteStepFooterProps) {
  if (!routeStep) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-3 shadow-xl shadow-slate-200/70 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (!previousRouteStep) return;
            void onMoveRouteStep(previousRouteStep);
          }}
          disabled={!previousRouteStep}
          className="min-w-[120px] rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          이전으로
        </button>
        <button
          type="button"
          onClick={() => {
            if (footerStage === 5) {
              void onOpenSceneStudio();
              return;
            }
            if (nextRouteStep) {
              void onCompleteStage(footerStage, nextRouteStep);
            }
          }}
          disabled={isOpeningSceneStudio || !(routeStep ? routeStepCompleted[footerStage] : stepCompleted[footerStage])}
          className="min-w-[140px] rounded-full bg-blue-600 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
        >
          {footerStage === 5 ? (isOpeningSceneStudio ? '이동 중...' : '영상 제작하기') : '다음으로'}
        </button>
      </div>
    </div>
  );
}

interface SampleGuideModalProps {
  open: boolean;
  onClose: () => void;
  onOpenApiModal?: (options?: { title?: string; description?: string; focusField?: 'openRouter' | 'elevenLabs' | null }) => void | Promise<void>;
  onContinueWithSample: () => void;
}

export function SampleGuideModal({
  open,
  onClose,
  onOpenApiModal,
  onContinueWithSample,
}: SampleGuideModalProps) {
  return (
    <OverlayModal
      open={open}
      title="예시는 현재 샘플 데이터로 동작합니다"
      description="지금은 API 연결이 없어 정해진 예시만 채워집니다. 아래에서 OpenRouter를 바로 등록하거나, 샘플로 즉시 계속 진행할 수 있습니다."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">닫기</button>
          <button
            type="button"
            onClick={() => {
              onClose();
              void onOpenApiModal?.({
                title: '지금 바로 필요한 OpenRouter 키 등록',
                description: '텍스트 생성, 스토리 추천, 캐릭터 / 화풍 추천 품질을 한 번에 올리는 가장 빠른 연결입니다.',
                focusField: 'openRouter',
              });
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            OpenRouter 등록
          </button>
          <button
            type="button"
            onClick={() => {
              onContinueWithSample();
              onClose();
            }}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500"
          >
            샘플로 계속 진행
          </button>
        </>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-black text-slate-900">현재 동작 방식</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">연결 전에는 장르, 분위기, 배경, 대본 예시가 미리 준비된 안전한 샘플 데이터로 채워집니다.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-black text-slate-900">키를 등록하면 바뀌는 점</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">선택한 프롬프트 기준 실제 AI 대본 생성과 더 자연스러운 추천 문구를 바로 사용할 수 있습니다.</p>
        </div>
      </div>
    </OverlayModal>
  );
}

interface PromptPreviewModalProps {
  promptPreviewId: string | null;
  templates: WorkflowPromptTemplate[];
  draft: string;
  onClose: () => void;
  onSaveEdit: () => void;
  onDraftChange: (value: string) => void;
}

export function PromptPreviewModal({
  promptPreviewId,
  templates,
  draft,
  onClose,
  onSaveEdit,
  onDraftChange,
}: PromptPreviewModalProps) {
  return (
    <OverlayModal
      open={Boolean(promptPreviewId)}
      title={templates.find((item) => item.id === promptPreviewId)?.name || '프롬프트 보기'}
      description={templates.find((item) => item.id === promptPreviewId)?.description || '선택한 프롬프트 본문을 팝업에서 크게 확인합니다.'}
      onClose={onClose}
      footer={(
        <>
          {promptPreviewId && (
            <button type="button" onClick={onSaveEdit} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              이 프롬프트 수정
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">
            닫기
          </button>
        </>
      )}
    >
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        className="min-h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 outline-none"
        placeholder="프롬프트를 불러오는 중입니다."
      />
    </OverlayModal>
  );
}

interface PromptEditorModalProps {
  editingPromptId: string | null;
  prompt: string;
  onClose: () => void;
  onSave: () => void;
  onPromptChange: (value: string) => void;
}

export function PromptEditorModal({
  editingPromptId,
  prompt,
  onClose,
  onSave,
  onPromptChange,
}: PromptEditorModalProps) {
  return (
    <OverlayModal
      open={Boolean(editingPromptId)}
      title="프롬프트 수정"
      description="이 팝업에서 이름, 설명, 본문 프롬프트를 수정하면 선택한 템플릿에 바로 저장됩니다."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">취소</button>
          <button type="button" onClick={onSave} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500">수정 저장</button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          프롬프트 이름/설명은 유지되고, 본문 텍스트만 수정됩니다.
        </div>
        <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} className="min-h-[360px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-violet-400" placeholder="프롬프트 본문" />
      </div>
    </OverlayModal>
  );
}

export function ProcessingBadge({ step }: { step: GenerationStep }) {
  const isProcessing = step === GenerationStep.SCRIPTING || step === GenerationStep.ASSETS;
  if (!isProcessing) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 w-[300px] rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">진행 중</div>
          <div className="mt-1 text-lg font-black text-slate-900">현재 생성 작업이 실행 중입니다</div>
        </div>
        <div className="text-2xl">🎬</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">작업 중에도 Step 카드 구조와 저장 상태는 유지됩니다.</p>
    </div>
  );
}
