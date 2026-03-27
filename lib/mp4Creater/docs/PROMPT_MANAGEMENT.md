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
- `rolePrompts`는 저장 구조만의 필드가 아니라 Step3 실행 prompt 추가 문맥과 Step6 씬 prompt 조립의 1차 소스여야 합니다.
- 긴 Step3 AI 대본은 한 번에 큰 본문을 요청하지 않고, 현재 draft 문맥 요약과 세그먼트 phase guide를 이용해 여러 구간으로 이어 쓰는 구조를 유지합니다.

## 실제 로직 맵
- Step1~5 프롬프트 상세 규칙: `workflowPromptBuilder.ts`
  - 대본, 캐릭터, 씬, 액션, 썸네일 연계 규칙을 한 번에 묶습니다.
- 역할별 최종 prompt 번들 + Step 연결 요약: `workflowStepContractService.ts`
  - `rolePrompts`에 역할별 base/final prompt와 step source를 넣고, Step6 summary/export JSON까지 연결합니다.
- Step3 실제 대본 생성 입력: `InputSection.tsx` + `scriptComposerService.ts`
  - 최신 draft에서 계산한 `rolePrompts`를 compact한 `promptAdditions`로 변환해 실제 모델 요청에 넣습니다.
  - 긴 분량은 세그먼트 continuation helper로 분할 생성하고 마지막에만 전체 길이를 맞춥니다.
- Step2 추천 새로움: `storyRecommendationService.ts`
  - 최근 추천 히스토리를 보고 같은 주제여도 새 표현을 우선합니다.
- Step4 캐릭터 유사 재생성: `InputSection.tsx` + `characterStudioService.ts`
  - 업로드 이미지는 이미지 기반 설명으로 흡수하고, `비슷하게 재생성`은 `similar` 모드로만 생성합니다.
- Step6 씬 이미지/영상: `sceneAssemblyService.ts` + `SceneStudioPage.tsx` + `imageService.ts` + `ResultTable.tsx`
  - Step6 씬 prompt 조립은 `workflowDraft.promptStore.rolePrompts`를 우선 사용하고, 필요한 부분만 compact하게 잘라 토큰을 억제합니다.
  - 이미지 프롬프트는 새 컷을 만들되 영상 시작 프레임으로 쓰기 좋게 만들고, 영상 프롬프트는 현재 이미지와 이전/다음 씬을 함께 참고합니다.
  - 배경 텍스트가 메인이 되지 않도록 간판/포스터/UI/라벨/로고/자막 생성 금지 규칙을 공통으로 유지합니다.
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
  - `rolePrompts`는 역할별 분리 저장, Step3 실행 추가 문맥, Step6 씬 prompt 조립, export 요약용

## 개별 수정 경로
- 전역 Step1~5 시스템 prompt 규칙: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- 역할별 prompt 번들 조립과 `finalPrompt` 우선순위: `lib/mp4Creater/services/workflowStepContractService.ts`
- Step3 실행 시 `rolePrompts`를 모델 입력에 붙이는 경로: `lib/mp4Creater/components/InputSection.tsx`
- Step3 실제 API 요청 본문 조립: `lib/mp4Creater/services/scriptComposerService.ts`
- Step6 씬별 이미지/영상 prompt 조립: `lib/mp4Creater/services/sceneAssemblyService.ts`
- Step6 이미지 생성 래퍼: `lib/mp4Creater/services/imageService.ts`
- Step6 영상/모션 생성 트리거: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- 배경음 prompt 조립: `lib/mp4Creater/services/musicService.ts`
- 썸네일 대표 prompt 조립: `lib/mp4Creater/services/thumbnailService.ts`

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

## Step6 Tab AI Paths
- Tab-level prompt templates: `lib/mp4Creater/services/sceneEditorPromptService.ts`
- This file controls the AI prompt that rewrites only one Step6 field at a time.
- `narration` mode controls spoken scene text generation.
- `image` mode controls image prompt text regeneration.
- `video` mode controls motion prompt text regeneration.
- Continuity source: current scene + previous scene + next scene + compact `workflowDraft.promptStore.rolePrompts`.
- Step6 UI button path: `lib/mp4Creater/components/ResultTable.tsx`
- Step6 execution/model routing path: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Keep this path separate from media generation. It rewrites prompt text only and must not auto-trigger image/video/audio generation.

## Latest Markdown Prompt Chain
- Active shared markdown helper path: `lib/mp4Creater/services/promptMarkdown.ts`
- Global prompt-pack composition path: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- Step3 live request payload path: `lib/mp4Creater/services/scriptComposerService.ts`
- Step3 role-prompt merge path: `lib/mp4Creater/components/InputSection.tsx`
- Step6 scene image/video continuity assembly path: `lib/mp4Creater/services/sceneAssemblyService.ts`
- Step6 image generation payload path: `lib/mp4Creater/services/imageService.ts`
- Step6 motion fallback/base prompt path: `lib/mp4Creater/services/geminiService.ts`
- Step6 final motion handoff path: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Background music prompt assembly path: `lib/mp4Creater/services/musicService.ts`
- Thumbnail representative-cut prompt path: `lib/mp4Creater/services/thumbnailService.ts`

## Prompt Structure Rules
- Prompt strings should now prefer markdown sections such as `# Goal`, `## Concept Direction`, `## Writing Rules`, `## Transition Rules`, `## Similarity Control`, and `## Do Not`.
- The markdown structure exists for model parsing quality, not visual prettiness.
- Step3, Step6 scene prompts, thumbnail prompts, and background-music prompts should keep the same hierarchy style so maintenance stays predictable.
- Concept fit must be obvious in output quality:
- `music_video`: rhythm, hook, performance, mood, visual punch
- `cinematic`: atmosphere, composition, lingering emotion, motivated transition
- `info_delivery`: clarity, structure, explanation readability, viewer understanding
- `story`: event flow, character reaction, emotional continuity, scene progression
- Freedom must remain inside the concept. Do not turn concept alignment into rigid repeated templates.
- Similarity should only tighten when the user explicitly asks for a similar result.
- Paragraph endings and scene endings should leave a natural handoff into the next beat instead of hard-stopping by default.
