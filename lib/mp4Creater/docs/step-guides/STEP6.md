# STEP6

목표: 각 문단이 개별 컷이면서도 이전/다음 씬과 연결되는 자연스러운 영상 흐름을 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/components/ResultTable.tsx`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`

## 이번 유지 포인트
- 이미지 프롬프트는 항상 새 컷을 우선하되, 현재 프로젝트 캐릭터/화풍/문단 흐름을 유지합니다.
- 영상 프롬프트는 현재 이미지가 첫 프레임이 되도록 맞추고, 이전/다음 씬을 참고해 자연스럽게 연결합니다.
- 대본 발화 구간은 입모양 싱크를 우선합니다.
- 문단 설정 내부 `해당 내용 적용` 버튼은 현재 문단 편집값으로 이미지와 영상을 다시 생성하는 버튼입니다.
- Thumbnail Studio는 현재 씬 결과를 참조해 새 생성과 유사 재생성을 분리합니다.

## Step6 Save/Render Guard
- Paragraph edit, add/delete, and preview-setting changes must write the Step6 working snapshot immediately.
- On refresh or re-entry, Step6 must prefer the newer state between project JSON `lastSavedAt` and snapshot `savedAt`.
- When Step5 opens Step6, write the latest Step6 draft/assets snapshot before route transition so the first Step6 paint can restore cards immediately.
- While reopening an existing project, do not rebuild draft-based placeholder scenes before the saved Step6 payload finishes hydrating.
- Reopen loading must show visible progress, and if full project detail is delayed, use the latest Step6 snapshot as a temporary fallback instead of leaving the page empty.
- Deleted scenes must not be restored from an older snapshot.
- Preview/final render must flush pending Step6 saves and merge the current paragraph order, duration, and media from the latest working copy.

## Step6 Stable Dev Guard
- Step5 -> Step6 transition currently depends on `App.tsx` writing the newest draft/scene snapshot before route push. Keep this behavior when adding or changing AI features.
- Step6 must restore cards from cache/snapshot/project JSON in that order of immediacy, then prefer the newest payload by timestamp.
- During hydration, keep the loading panel visible only when there is truly no `generatedData` to show yet.
- Scene delete/edit/add, media generation completion, and preview render must all preserve the same latest working copy so refresh/import/export stay aligned.
- If Step6 save flow changes, update `SAVE_TRIGGER_GUIDE.md` in the same patch.

## Step6 Key Files To Preserve
- Route handoff: `lib/mp4Creater/App.tsx`
- Main Step6 logic: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Step6 result rendering UI: `lib/mp4Creater/components/ResultTable.tsx`
- Snapshot storage: `lib/mp4Creater/services/sceneStudioSnapshotCache.ts`
- Navigation cache: `lib/mp4Creater/services/projectNavigationCache.ts`
- Image generation path: `lib/mp4Creater/services/imageService.ts`
