# STEP1

목표: 콘텐츠 타입과 화면 비율이 뒤 Step 전체의 고정 축이 되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`

## 이번 유지 포인트
- Step1 선택값은 Step3 대본, Step4 캐릭터, Step5 화풍, Step6 씬, 썸네일까지 계속 전달됩니다.
- 콘텐츠 타입이 바뀌면 대본 문체뿐 아니라 립싱크 규칙과 썸네일 방향도 같이 바뀌어야 합니다.
- 화면 비율은 Step6 이미지/영상 생성 기준과 함께 유지합니다.
