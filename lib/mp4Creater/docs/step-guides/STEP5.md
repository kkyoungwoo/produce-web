# STEP5

목표: 선택된 화풍이 Step6 씬 이미지, 씬 영상, 썸네일까지 하나의 스타일 계열로 이어지게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`

## 이번 유지 포인트
- 화풍 후보는 보존하고 실제 생성에는 선택 화풍만 반영합니다.
- 새 생성은 같은 프로젝트 안의 새로운 변주, 유사 생성은 선택 화풍의 핵심 결 유지라는 차이를 명확히 둡니다.
- 썸네일도 Step5 선택 화풍을 그대로 참고합니다.
