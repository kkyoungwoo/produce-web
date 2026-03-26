# STEP2

목표: 사용자가 입력한 콘텐츠 주제를 중심축으로 잡고, AI 추천값이 그 주제에서 벗어나지 않게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/storyRecommendationService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`

## 이번 유지 포인트
- Step2 주제 추천은 사용자가 입력한 대상, 상황, 감정, 행동을 최대한 살린 상태로 한 줄 주제로 정리합니다.
- 장르/분위기/배경/주인공/갈등/결말 톤 추천도 현재 주제와 직접 연결되어야 하며, 입력과 무관한 범용 추천으로 새면 안 됩니다.
- 무음 모드면 시각 전개 중심으로, 일반 모드면 낭독/노래/TTS에 어울리는 흐름으로 확장합니다.
- 같은 주제라도 직전 추천 히스토리와 표현이 겹치지 않도록 새 디테일을 유지합니다.
- Step2에서 정한 값은 Step3 이후 프롬프트 팩의 기준값이므로 저장과 복원이 같이 유지되어야 합니다.
