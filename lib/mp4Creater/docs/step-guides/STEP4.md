# STEP4

목표: 캐릭터 후보와 최종 선택 캐릭터를 같이 보존하면서, 실제 생성에는 선택본만 안정적으로 쓰게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `app/api/local-storage/_shared.ts`

## 안전 수정 포인트
- `selectedCharacterIds`, `selectedImageId`, `generatedImages` 관계를 같이 봅니다.
- 저장 시 후보 이미지를 잃지 않게 media hydrate/persist 경로를 함께 확인합니다.
- Step6에는 선택된 캐릭터만 좁혀 보내되, 프로젝트 저장본에는 후보를 남겨 둡니다.
- Step4 구조가 바뀌면 이 md와 저장 경로를 함께 수정합니다.
