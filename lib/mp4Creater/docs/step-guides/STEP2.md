# STEP2

목표: 주제와 추천 선택값이 매번 새롭게 제안되면서도 현재 프로젝트 의도에 맞게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/storyRecommendationService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`

## 이번 유지 포인트
- 기본 동작은 항상 새 추천입니다. 같은 입력이어도 최근 추천 히스토리와 겹치지 않게 합니다.
- 무음 모드면 시각 전개 중심으로, 일반 모드면 대사/립싱크 가능한 주제로 확장합니다.
- Step2에서 정한 값은 Step3 이후 프롬프트 팩의 기준값이므로 저장과 복원이 같이 유지되어야 합니다.
