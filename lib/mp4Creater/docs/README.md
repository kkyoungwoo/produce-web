# mp4Creater 메인 가이드

이 문서는 mp4Creater를 수정할 때 가장 먼저 읽는 안내서입니다.

## 기본 원칙
- 수정은 항상 **최신 반영본** 기준으로 이어서 진행합니다.
- 기능을 추가하거나 흐름을 바꾸면 **해당 md와 실제 파일을 함께 수정**해야 합니다.
- 저장, 불러오기, export, import, Step 간 전달은 한 세트로 보고 확인합니다.
- 후보 데이터는 보존하고, 실제 생성에는 선택한 데이터만 반영하는 원칙을 유지합니다.
- mp4Creater 외 경로는 꼭 필요한 경우가 아니면 건드리지 않습니다.

## 먼저 읽을 문서
- `lib/mp4Creater/docs/PROMPT_MANAGEMENT.md`
- `lib/mp4Creater/docs/SETTINGS_MODELS.md`
- `lib/mp4Creater/docs/step-guides/README.md`

## 이번 프롬프트 연계의 핵심 경로
- Step1~5 프롬프트 팩: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- Step2 추천 새로움: `lib/mp4Creater/services/storyRecommendationService.ts`
- Step4 캐릭터 유사 재생성/업로드 기반 프롬프트: `lib/mp4Creater/components/InputSection.tsx`, `lib/mp4Creater/services/characterStudioService.ts`
- Step6 문단별 이미지/영상 재생성: `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/components/ResultTable.tsx`, `lib/mp4Creater/services/imageService.ts`
- Thumbnail Studio: `lib/mp4Creater/services/thumbnailService.ts`, `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`

## 최신 구현 메모
- 기본 생성은 항상 새 결과를 우선합니다. 동일 선택값이어도 추천/대본/이미지/영상/썸네일은 최근 결과를 반복하지 않도록 설계합니다.
- `비슷하게 재생성`은 선택된 기준 이미지나 썸네일의 핵심 정체성만 유지한 근접 변형입니다.
- Step6은 각 문단이 개별 컷이지만 이전/다음 씬과 연결되는 하나의 영상 흐름처럼 유지해야 합니다.
- 문단 설정 내부의 `해당 내용 적용` 버튼은 현재 문단 편집값으로 이미지와 영상을 다시 반영하는入口입니다.
- 썸네일은 실제 씬/캐릭터/화풍/대본을 기반으로 만들고, 새 생성과 유사 재생성을 분리해서 다룹니다.

## Step6 Latest Stable Flow
- Step5 -> Step6 handoff must stay centered on `lib/mp4Creater/App.tsx` `handleOpenSceneStudio`.
- Before route push, the latest `workflowDraft`, initial scene cards, background tracks, and preview mix must be written to both `projectNavigationCache` and `sceneStudioSnapshotCache`.
- Step6 first paint must prefer the newest source among navigation cache, scene snapshot, and saved project JSON.
- If `generatedData` already exists, Step6 must keep the result panel visible even while project hydration is still running.
- Reopen logic must not recreate draft placeholder scenes before saved Step6 payload hydration finishes.
- Latest Step6 state is decided by comparing project `lastSavedAt` and snapshot `savedAt`.

## Prompt Path Preserve Rules
- Step1~5 prompt chain: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- Step2 freshness / recommendation logic: `lib/mp4Creater/services/storyRecommendationService.ts`
- Step4 character upload / selection / similar-regeneration logic: `lib/mp4Creater/components/InputSection.tsx`, `lib/mp4Creater/services/characterStudioService.ts`
- Step6 paragraph image/video continuity logic: `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/services/imageService.ts`, `lib/mp4Creater/components/ResultTable.tsx`
- Workflow contract / summary JSON structure: `lib/mp4Creater/services/workflowStepContractService.ts`
- If any of these paths or responsibilities change, update this md and the matching step guide in the same patch.
