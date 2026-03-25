# 프롬프트 관리 가이드

이 문서는 mp4Creater에서 프롬프트를 어디서 관리하고, 무엇을 같이 수정해야 하는지 빠르게 찾기 위한 안내입니다.

## 먼저 볼 파일
- `lib/mp4Creater/config/promptEditGuides.ts`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/inputSection/overlays.tsx`
- `lib/mp4Creater/services/workflowStepContractService.ts`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`

## 관리 원칙
- 프롬프트는 화면 문구가 아니라 **저장 가능한 데이터**로 다룹니다.
- Step별 프롬프트를 바꾸면 **요약보기, 저장, export/import, 최종 생성 반영**까지 같이 확인합니다.
- 선택형 결과는 후보와 선택본을 구분해서 유지합니다.
- 새 프롬프트 항목을 추가하면 관련 md와 실제 파일을 함께 수정합니다.

## 자주 수정하는 곳
- Step1 콘셉트/가이드 문구: `promptEditGuides.ts`, `InputSection.tsx`
- Step3 대본/이미지/영상 프롬프트: `InputSection.tsx`, `overlays.tsx`
- Step4 캐릭터 프롬프트: `promptEditGuides.ts`, Step4 생성 경로
- Step5 화풍 프롬프트: `promptEditGuides.ts`, Step5 선택/생성 경로
- Step6 최종 조합 프롬프트 확인: `SceneStudioPage.tsx`

짧게 말하면, 프롬프트를 바꾸면 **저장 구조와 최종 반영 경로도 같이 본다**가 핵심입니다.


## Step별 프롬프트 전달 경로
- `workflowStepContractService.ts`
  - `commonPrompts`: 공통 저장용 프롬프트 묶음
  - `stepPrompts.step1~step6`: 각 단계에서 **실제로 선택되어 다음 단계로 전달되는 프롬프트**
  - `finalPrompts`: 최종 이미지/영상 생성에 다시 쓰는 합성 프롬프트
- `SceneStudioPage.tsx`
  - Step6에서 최종 씬 카드 생성 시 대본, 이미지 프롬프트, 영상 프롬프트, 배경음 프롬프트를 다시 저장/복원합니다.
- `workflowDraftService.ts`
  - 화면에서 수정한 프롬프트가 JSON 저장/복원 시 유지되도록 기본값과 복원 규칙을 담당합니다.

## 지금 수정할 때 같이 보면 좋은 포인트
- Step2 무음 모드면 Step6에서 대사/오디오 프롬프트가 숨겨지는지
- Step3 대본/씬 프롬프트를 수정하면 Step6 재생성에도 반영되는지
- Step4 캐릭터/보이스 선택을 바꾸면 `castAudioMap`과 음성 생성 제공자가 같이 바뀌는지
- Step6 배경음 5섹션 프롬프트를 수정하면 `backgroundMusicScene.promptSections`와 생성 이력 저장 JSON이 같이 갱신되는지
