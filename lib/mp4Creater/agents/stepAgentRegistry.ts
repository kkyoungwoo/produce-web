export type WorkflowAgentStep = 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'final-scene';

export interface StepAgentProfile {
  id: string;
  step: WorkflowAgentStep;
  name: string;
  mission: string;
  promptPath: string;
  editableFiles: string[];
  reviewChecklist: string[];
}

export const STEP_AGENT_REGISTRY: StepAgentProfile[] = [
  {
    id: 'agent-intake',
    step: 'step1',
    name: '입력 정리 에이전트',
    mission: '콘텐츠 타입, 주제, 화면 비율을 빠르게 확정하고 다음 단계로 넘깁니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/step1-intake.md',
    editableFiles: ['components/InputSection.tsx'],
    reviewChecklist: ['주제 입력 1회', '비율 선택 1회', '다음 버튼 활성화']
  },
  {
    id: 'agent-script',
    step: 'step2',
    name: '대본 구조 에이전트',
    mission: '짧고 명확한 대본을 문단 기준 씬으로 나눌 수 있게 준비합니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/step2-script.md',
    editableFiles: ['components/InputSection.tsx', 'services/scriptComposerService.ts'],
    reviewChecklist: ['문단 수 계산', '대본 비어 있음 검증', '다음 버튼 유도']
  },
  {
    id: 'agent-cast',
    step: 'step3',
    name: '출연자 에이전트',
    mission: '주인공/조연 중심으로 출연자 카드를 정리하고 선택을 단순화합니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/step3-cast.md',
    editableFiles: ['components/InputSection.tsx', 'services/characterStudioService.ts'],
    reviewChecklist: ['나레이터 미노출', '출연자 선택 동작', '샘플 카드 단일 선택']
  },
  {
    id: 'agent-style',
    step: 'step4',
    name: '화풍 에이전트',
    mission: '화풍 샘플을 보고 바로 1개 선택할 수 있게 구성합니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/step4-style.md',
    editableFiles: ['components/InputSection.tsx', 'samples/presetCatalog.ts'],
    reviewChecklist: ['화풍 1개 선택', '샘플 카드 미리보기', '고급은 접힘']
  },
  {
    id: 'agent-bridge',
    step: 'step5',
    name: '씬 진입 에이전트',
    mission: '프로젝트 저장 후 씬 제작 화면으로 자연스럽게 연결합니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/step5-handoff.md',
    editableFiles: ['components/InputSection.tsx', 'App.tsx'],
    reviewChecklist: ['프로젝트 저장', '씬 제작 이동', '스크롤 포커스 정렬']
  },
  {
    id: 'agent-scene-final',
    step: 'final-scene',
    name: '최종 제작 에이전트',
    mission: '씬 카드 생성부터 최종 영상 제작까지 버튼 흐름을 단순화합니다.',
    promptPath: '/lib/mp4Creater/prompts/workflow-agents/final-scene-production.md',
    editableFiles: ['pages/SceneStudioPage.tsx', 'components/ResultTable.tsx'],
    reviewChecklist: ['짧은 버튼 문구', '생성 상태 표시', '최종 영상 내보내기']
  }
];

const STEP_TO_INDEX: Record<WorkflowAgentStep, number> = {
  step1: 1,
  step2: 2,
  step3: 3,
  step4: 4,
  step5: 5,
  'final-scene': 6,
};

export function getAgentByStep(step: WorkflowAgentStep): StepAgentProfile {
  return STEP_AGENT_REGISTRY.find((agent) => agent.step === step) || STEP_AGENT_REGISTRY[0];
}

export function getAgentByStage(stage: number): StepAgentProfile {
  if (stage <= 1) return getAgentByStep('step1');
  if (stage === 2) return getAgentByStep('step2');
  if (stage === 3) return getAgentByStep('step3');
  if (stage === 4) return getAgentByStep('step4');
  if (stage === 5) return getAgentByStep('step5');
  return getAgentByStep('final-scene');
}

export function sortAgentsByFlow() {
  return [...STEP_AGENT_REGISTRY].sort((a, b) => STEP_TO_INDEX[a.step] - STEP_TO_INDEX[b.step]);
}
