# STEP2

목표: 주제, 길이, 대화체, 언어가 Step3 대본 품질에 바로 반영되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/storyRecommendationService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`

## 안전 수정 포인트
- Step2 값은 Step3의 핵심 입력입니다.
- 주제가 바뀌면 뒤 step 결과와 충돌할 수 있으니 재생성 유도 흐름을 같이 확인합니다.
- referenceLinks 같은 입력은 export/import 때도 그대로 남는지 함께 보면 좋습니다.
- Step2 구조가 바뀌면 이 md와 저장 필드도 같이 맞춥니다.
