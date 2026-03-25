# STEP5

목표: 화풍 후보는 보존하고, 최종 선택 화풍만 Step6 생성에 정확히 반영되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `app/api/local-storage/_shared.ts`

## 안전 수정 포인트
- `selectedStyleImageId`와 `styleImages`의 매칭이 핵심입니다.
- 저장 후 다시 열었을 때 이전 선택 카드가 바로 보이는지 확인합니다.
- 샘플 화풍과 AI 화풍이 같은 prompt 저장 규칙을 쓰게 유지하면 수정이 쉬워집니다.
- Step5 구조가 바뀌면 이 md와 선택/저장 경로를 함께 갱신합니다.
