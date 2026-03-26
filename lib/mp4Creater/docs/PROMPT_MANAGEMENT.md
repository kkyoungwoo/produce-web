# 프롬프트 관리 가이드

이 문서는 mp4Creater에서 프롬프트를 어디서 관리하고, 무엇을 같이 수정해야 하는지 빠르게 찾기 위한 안내입니다.

## 먼저 볼 파일
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/storyRecommendationService.ts`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`
- `lib/mp4Creater/services/workflowStepContractService.ts`

## 관리 원칙
- 프롬프트는 화면 문구가 아니라 **저장 가능한 데이터**로 다룹니다.
- Step별 프롬프트를 바꾸면 **저장/복원/다음 Step 전달/썸네일 반영**까지 같이 확인합니다.
- 기본 모드는 항상 새 결과이고, `비슷하게 재생성` 요청일 때만 유사 모드로 전환합니다.
- 문단별 이미지와 영상은 서로 분리된 결과가 아니라 같은 씬의 연속 작업으로 다룹니다.
- 대본 / 캐릭터 / 스타일 / 장면 / 영상 / 배경음 / 썸네일 프롬프트를 섞지 않고 `rolePrompts`로 역할별 분리 저장합니다.
- Step6 저장 시 `workflowDraft.promptStore.rolePrompts`와 `project.prompts.rolePrompts`가 함께 갱신되어야 저장/복원/내보내기/썸네일 진입 시 같은 기준을 재사용할 수 있습니다.

## 실제 로직 맵
- Step1~5 프롬프트 상세 규칙: `workflowPromptBuilder.ts`
  - 대본, 캐릭터, 씬, 액션, 썸네일 연계 규칙을 한 번에 묶습니다.
- 역할별 최종 prompt 번들 + Step 연결 요약: `workflowStepContractService.ts`
  - `rolePrompts`에 역할별 base/final prompt와 step source를 넣고, Step6 summary/export JSON까지 연결합니다.
- Step2 추천 새로움: `storyRecommendationService.ts`
  - 최근 추천 히스토리를 보고 같은 주제여도 새 표현을 우선합니다.
- Step4 캐릭터 유사 재생성: `InputSection.tsx` + `characterStudioService.ts`
  - 업로드 이미지는 이미지 기반 설명으로 흡수하고, `비슷하게 재생성`은 `similar` 모드로만 생성합니다.
- Step6 씬 이미지/영상: `SceneStudioPage.tsx` + `imageService.ts` + `ResultTable.tsx`
  - 이미지 프롬프트는 새 컷을 만들되 영상 시작 프레임으로 쓰기 좋게 만들고, 영상 프롬프트는 현재 이미지와 이전/다음 씬을 함께 참고합니다.
- 배경음: `musicService.ts`
  - Step2 분위기, Step3 대본 감정, Step6 scene flow를 따로 묶어 `backgroundMusicPromptSections`와 최종 prompt로 저장합니다.
- 썸네일: `thumbnailService.ts`
  - 실제 프로젝트 씬, 캐릭터, 화풍, 선택 프롬프트를 기반으로 새 생성/유사 재생성을 나눠 처리하고, Step1~Step6 전체를 대표하는 최종 prompt로 조립합니다.

## 저장 구조 메모
- 빠른 접근용: `project.prompts`
  - 기존 필드: `scriptPrompt`, `scenePrompt`, `imagePrompt`, `videoPrompt`, `motionPrompt`, `thumbnailPrompt`
  - 추가 필드: `characterPrompt`, `stylePrompt`, `backgroundMusicPrompt`, `backgroundMusicPromptSections`, `rolePrompts`
- 상세 연결용: `workflowDraft.promptStore`
  - `stepPrompts`는 Step 편집 재진입용
  - `finalPrompts`는 Step6에서 실제로 묶인 최종 대본/이미지/영상 prompt
  - `rolePrompts`는 역할별 분리 저장과 export 요약용

## 점검 포인트
- Step2 추천이 연속 클릭 때도 같은 문구로 고정되지 않는지
- Step4 `비슷하게 재생성`이 fresh가 아니라 similar 모드로 동작하는지
- Step6 `해당 내용 적용`이 현재 문단 편집값으로 이미지와 영상을 다시 만드는지
- Step6 영상 프롬프트가 현재 이미지 기준으로 자연스럽게 이어지는지
- Thumbnail Studio에서 새 생성과 유사 재생성의 방향이 분리되는지

## Step6 Prompt Preserve Memo
- Keep Step6 continuity logic anchored in `lib/mp4Creater/pages/SceneStudioPage.tsx`.
- Image prompt continuity must continue to use the current paragraph plus selected project character/style context.
- Video prompt continuity must continue to reference the current image and previous/next scenes so the cut flow stays natural.
- Do not move Step6 prompt assembly away from the current path unless the new path is documented here and in `STEP6.md`.
- Step6 save/reopen logic is now part of prompt safety because stale payload restore can break the real paragraph order seen by prompt generation.
- Step6 autosave comparison must include narration/image prompt/video prompt edits so prompt text shown in UI, saved project JSON, and import/export payload stay identical.
- Step5 -> Step6 reopen must preserve existing Step6 prompt-bearing assets instead of recreating blank draft scenes when a saved Step6 project already exists.

## Step6 Related Save Paths
- Route handoff into Step6: `lib/mp4Creater/App.tsx`
- Step6 working copy + hydrate logic: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Snapshot persistence: `lib/mp4Creater/services/sceneStudioSnapshotCache.ts`
- Navigation handoff cache: `lib/mp4Creater/services/projectNavigationCache.ts`
- Project import snapshot rebuild: `lib/mp4Creater/services/projectService.ts`
