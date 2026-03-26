# STEP4

목표: 선택한 캐릭터 이미지가 이후 씬과 썸네일의 기준 얼굴이 되도록 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/characterStudioService.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`

## 이번 유지 포인트
- 업로드 이미지는 이미지 기반 설명을 뽑아 캐릭터 프롬프트에 반영합니다.
- `비슷하게 재생성`은 반드시 `similar` 모드로 보내 선택 이미지의 정체성을 최대한 유지한 근접 변형을 만듭니다.
- Step6과 썸네일은 최종 선택된 캐릭터 이미지 기준으로 얼굴/실루엣/입모양 구조를 이어받아야 합니다.
