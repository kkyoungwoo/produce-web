import { StepId } from './types';

export function getStepCompletionMessages(routeStepMode: boolean): Record<StepId, string> {
  if (routeStepMode) {
    return {
      1: '1단계에서 먼저 시작 유형과 화면 비율을 선택해 주세요.',
      2: '2단계에서 주제와 핵심 선택값을 입력해 주세요.',
      3: '3단계에서 프롬프트와 대본을 확정해 주세요.',
      4: '4단계에서 캐릭터 선택을 완료해 주세요.',
      5: '5단계에서 화풍을 선택한 뒤 다음으로 진행해 주세요.',
    };
  }

  return {
    1: '1단계 설정을 완료하면 다음 단계로 진행할 수 있어요.',
    2: '2단계 주제/분위기 입력을 완료해 주세요.',
    3: '3단계에서 대본과 프롬프트를 확정해 주세요.',
    4: '4단계 캐릭터 준비를 완료해 주세요.',
    5: '5단계 화풍 선택을 완료해 주세요.',
  };
}
