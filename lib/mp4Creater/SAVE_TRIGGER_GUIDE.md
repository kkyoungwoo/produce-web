# mp4Creater 저장 트리거 가이드

## 목적
기존처럼 상태 변화가 일어날 때마다 연속 저장하지 않고, 사용자 인터렉션이 발생했을 때만 저장하도록 유지한다.

## 현재 저장 규칙
- 버튼 클릭, 체크/해제, 셀렉트 변경: 짧은 지연 후 저장
- 일반 인풋/텍스트에어리어 입력: 마지막 입력 후 1초 뒤 저장
- 프롬프트 수정 저장 버튼: 버튼 클릭 즉시 저장 큐에 반영
- 업로드 후 캐릭터/화풍 카드가 실제로 반영된 경우: 반영 완료 시점에 저장 큐에 반영

## 적용 위치
- `lib/mp4Creater/components/InputSection.tsx`
  - 워크플로우 드래프트 저장 트리거 관리
  - Step3 실행 전 최신 draft에서 `rolePrompts`를 다시 계산해 실제 모델 요청 `promptAdditions`에 붙이는 경로
  - 긴 AI 대본 생성은 `scriptComposerService.ts` 내부 세그먼트 continuation 경로를 타므로, 관련 수정 시 한 번 생성과 확장 생성이 모두 같은 저장 기준을 유지하는지 확인
- `lib/mp4Creater/App.tsx`
  - 프로젝트 에셋/프리뷰 믹스 저장 트리거 관리

## 기능 추가 시 반드시 같이 확인할 것
새로운 기능이 아래 중 하나에 해당하면 저장 트리거 로직도 함께 업데이트해야 한다.

1. 사용자가 값을 직접 바꾸는 새 입력 UI를 추가한 경우
   - 인풋 성격이면 `input` 저장 규칙(1초 지연)
   - 버튼/토글/체크/셀렉트 성격이면 `action` 저장 규칙

2. 버튼 클릭 후 비동기로 상태가 바뀌는 기능을 추가한 경우
   - 상태 반영이 끝나는 지점에서 `requestWorkflowDraftSave('action')` 또는 `requestProjectSave('action')` 호출

3. 업로드/가져오기/자동 추천처럼 파일 읽기나 AI 응답 이후 상태가 채워지는 기능을 추가한 경우
   - 실제 카드/프로젝트 상태가 반영된 직후 저장 요청을 넣어야 한다.

## 주의
- 자동 추천/초기 hydration 같은 비사용자 트리거는 저장을 직접 유발하지 않게 유지한다.
- mp4Creater 외 영역에는 같은 저장 규칙을 임의로 확장하지 않는다.

## Step6 specific
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
  - paragraph narration/imagePrompt/videoPrompt/visual type/duration edits: immediate snapshot write + debounced project JSON save
  - autosave signature must include paragraph text/prompt changes, selected visual mode, media duration/url changes, and current cost so JSON/export/import stay aligned with the visible Step6 cards
  - Step6 save patch must refresh `workflowDraft.promptStore.rolePrompts` and `project.prompts.rolePrompts` together so prompt-role separation survives reopen/export/import
  - Step6 scene prompt assembly must continue to read `workflowDraft.promptStore.rolePrompts` first so save/reopen 뒤에도 같은 실행 문맥을 재사용할 수 있음
  - Step6 save patch must keep `project.prompts.backgroundMusicPrompt`, `project.prompts.backgroundMusicPromptSections`, and the thumbnail representative prompt summary aligned with the latest visible scene flow
  - paragraph add/delete and audio-clear actions: immediate snapshot write + project JSON sync
  - preview/final render: must call `flushPendingSceneStudioSave(...)` before merging/exporting
  - preview invalidation after scene edits must keep the last rendered preview video payload, and only update the stale message/status until the next explicit render
  - final export must use the ffmpeg route for a finalized MP4; browser preview render is no longer the delivery path
  - legacy browser merged-render code path must stay removed so preview/download divergence does not reappear
  - final export download headers must remain ASCII-safe with UTF-8 `filename*` support so Korean project titles do not break the render response
  - Step6 preview render must use the same ffmpeg path as final export so the visible preview and downloaded MP4 stay identical
  - when a current Step6 preview MP4 already exists, download should reuse that exact preview MP4 instead of silently building a different render
  - deployed final export must prefer `ffmpeg/bin/*`, which is prepared from `ffmpeg-static` during `postinstall`, so Step6 render does not fail when the server has no machine-level ffmpeg install
  - `next.config.ts` must keep the render route tracing include for both `ffmpeg/bin/**/*` and `node_modules/ffmpeg-static/**/*`, otherwise deployment can lose the bundled ffmpeg binary even though local export works
  - when a scene has no real visual media result yet, Step6 preview/export should fall back to a black frame only and must not inject narration subtitles automatically
  - lightweight studio cache writes must strip big inline media payloads and data-URL thumbnails to avoid localStorage quota overflow during Step6 autosave/export
  - existing project reopen: block draft-based scene bootstrap until saved Step6 assets finish hydrating
  - existing project reopen: show progress percent and use latest Step6 snapshot as fallback while detailed project JSON is still loading
- `lib/mp4Creater/App.tsx`
  - Step5 -> Step6 transition: write the latest Step6 snapshot before route push so the first Step6 load can restore draft cards even before JSON re-fetch finishes
  - when reopening Step6 for an existing project, reuse the saved Step6 assets/background music/cost/preview state instead of rebuilding empty scene cards from Step5 draft
- `lib/mp4Creater/services/projectService.ts`
  - project import must recreate the Step6 snapshot cache from imported project JSON so imported Step6 cards can reopen immediately with the same latest structure
- Refresh/re-entry/import/export should use the latest Step6 state by comparing project `lastSavedAt` with snapshot `savedAt`.
- Keep `lib/mp4Creater/App.tsx` Step5 -> Step6 handoff writing the newest Step6 snapshot before route transition.
- Keep `lib/mp4Creater/pages/SceneStudioPage.tsx` showing cached Step6 cards immediately when `generatedData` already exists, even if hydration is still in progress.
- Keep Step6 save triggers aligned with import/export/reopen so the same latest working copy is used everywhere.
- When changing Step6 AI prompt or media logic, update `docs/README.md`, `docs/PROMPT_MANAGEMENT.md`, and `docs/step-guides/STEP6.md` together.

## Thumbnail Studio specific
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`
  - 썸네일 메인 문구 / 추가 요청 저장은 현재 프로젝트 draft에 바로 반영되어야 한다.
  - 썸네일 전용 이미지 모델 선택은 현재 프로젝트 settings snapshot에 즉시 반영되어야 하며, 전역 Header 기본 설정을 덮어쓰면 안 된다.
  - 썸네일 생성 후에는 `thumbnailHistory`, 추천 YouTube 제목/설명, 현재 대표 prompt, 그리고 최신 비용 상태를 같은 저장 패치로 함께 갱신해야 한다.
  - 실제 AI 이미지 응답이 성공한 경우에만 `project.cost.images`, `project.cost.total`, `project.cost.imageCount`를 올린다.
  - 샘플 모델, Google 키 없음, 라이브 실패 후 fallback 이미지 경로는 `sample`로 저장하고 비용을 올리지 않는다.
  - 헤더 / 갤러리 / 프로젝트 카드 비용 표시는 모두 `project.cost.total` 합계에 의존하므로, 썸네일 비용 누락이나 중복 누적이 생기지 않게 저장 패치를 맞춰야 한다.

## Result Preview Save Rules
- Treat the current Step6 preview video as the canonical render output for the current working state.
- When preview render succeeds, persist that preview video, preview status, preview message, title, and duration together.
- Download should reuse the already-rendered preview MP4 whenever it is still the current valid preview.
- Scene edits must not delete the saved preview video immediately; they may only change the stale status/message until the next explicit render.
- Preview/export persistence must reflect only current Step6 media inputs:
- scene image or video
- scene audio
- selected background music
- preview mix
- aspect ratio
- current scene order
- Preview/export persistence must not depend on placeholder SVG cards or narration-only subtitle fallbacks.

## Step6 Tab AI Text Save Rules
- Tab-level `AI 생성` updates in Step6 must be treated exactly like manual text edits for autosave.
- `대사` AI generation must persist into the narration field only.
- `이미지` AI generation must persist into the image prompt field only.
- `영상` AI generation must persist into the video prompt field only.
- Tab-level AI regeneration must not auto-save fake media results, and must not mark image/video/audio generation as completed.

## IndexedDB Save Rules
- Project persistence must start immediately in IndexedDB even when no external storage folder is configured.
- Autosave should write the detailed project record and refresh the lightweight project index separately so gallery rendering stays cheap.
- Summary index writes must include thumbnail, project number, lastSavedAt, cost summary, current step hints, and project-applied settings snapshot needed for gallery restore.
- Detailed project writes must keep script, scene assets, audio/video/image results, subtitle data, thumbnail history, prompts, preview assets, and project-specific AI settings together.
- Optional `/api/local-storage/*` sync must run only when `storageDir` is explicitly configured; otherwise save flows should remain local-cache + IndexedDB only.
- Import/copy/delete should update both IndexedDB detail and IndexedDB summary layers in the same save transaction so project lists and reopen state do not drift apart.
- Any future save trigger added in `App.tsx`, `SceneStudioPage.tsx`, or `projectService.ts` must preserve the split between lightweight gallery index data and detailed project payload data.
