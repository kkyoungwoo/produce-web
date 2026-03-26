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

## 실제 로직 맵
- Step1~5 프롬프트 상세 규칙: `workflowPromptBuilder.ts`
  - 대본, 캐릭터, 씬, 액션, 썸네일 연계 규칙을 한 번에 묶습니다.
- Step2 추천 새로움: `storyRecommendationService.ts`
  - 최근 추천 히스토리를 보고 같은 주제여도 새 표현을 우선합니다.
- Step4 캐릭터 유사 재생성: `InputSection.tsx` + `characterStudioService.ts`
  - 업로드 이미지는 이미지 기반 설명으로 흡수하고, `비슷하게 재생성`은 `similar` 모드로만 생성합니다.
- Step6 씬 이미지/영상: `SceneStudioPage.tsx` + `imageService.ts` + `ResultTable.tsx`
  - 이미지 프롬프트는 새 컷을 만들되 영상 시작 프레임으로 쓰기 좋게 만들고, 영상 프롬프트는 현재 이미지와 이전/다음 씬을 함께 참고합니다.
- 썸네일: `thumbnailService.ts`
  - 실제 프로젝트 씬, 캐릭터, 화풍, 선택 프롬프트를 기반으로 새 생성/유사 재생성을 나눠 처리합니다.

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

## Step6 Related Save Paths
- Route handoff into Step6: `lib/mp4Creater/App.tsx`
- Step6 working copy + hydrate logic: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Snapshot persistence: `lib/mp4Creater/services/sceneStudioSnapshotCache.ts`
- Navigation handoff cache: `lib/mp4Creater/services/projectNavigationCache.ts`
