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
- Autosave comparison must watch narration/image prompt/video prompt edits, selected visual mode, media duration/url changes, and cost updates; otherwise visible Step6 edits can be skipped during JSON save/export/import.
- On refresh or re-entry, Step6 must prefer the newer state between project JSON `lastSavedAt` and snapshot `savedAt`.
- When Step5 opens Step6, write the latest Step6 draft/assets snapshot before route transition so the first Step6 paint can restore cards immediately.
- Step5 -> Step6 reopen must preserve any existing Step6 assets/background music/preview/cost payload instead of rebuilding empty cards from the draft when a saved Step6 project already exists.
- While reopening an existing project, do not rebuild draft-based placeholder scenes before the saved Step6 payload finishes hydrating.
- Reopen loading must show visible progress, and if full project detail is delayed, use the latest Step6 snapshot as a temporary fallback instead of leaving the page empty.
- Deleted scenes must not be restored from an older snapshot.
- Preview/final render must flush pending Step6 saves and merge the current paragraph order, duration, and media from the latest working copy.
- Project import must rebuild the Step6 snapshot cache from imported project JSON so imported Step6 scene cards reopen with the same structure before later rehydration finishes.

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

## Final Render Invariants
- Scene cards exist하면 이미지, 영상, 오디오가 하나도 없어도 결과보기의 `합본 영상 렌더링` 버튼은 반드시 동작해야 합니다.
- 비주얼 우선순위는 `씬 영상 > 씬 이미지 > 검정 화면`입니다. 이미지와 영상이 모두 없으면 해당 씬은 검정 화면으로 `targetDuration` 또는 계산된 씬 길이만큼 유지합니다.
- 오디오 우선순위는 `씬 나레이션 오디오 + 배경음`이며, 둘 다 없어도 무음 상태로 합본이 계속 진행되어야 합니다. 오디오가 전혀 없어도 MediaRecorder/브라우저 캡처가 깨지지 않도록 무음 트랙을 유지합니다.
- 결과보기 웹 플레이어와 다운로드 파일은 같은 최신 렌더 결과를 기준으로 갱신해야 합니다. 새 다운로드 렌더가 끝나면 결과보기 플레이어도 같은 렌더 결과로 즉시 교체합니다.
- 렌더 길이는 개별 씬의 계산된 재생 시간을 모두 더한 총 길이를 기준으로 맞춰야 합니다. 특정 씬에 미디어가 없다고 해서 타임라인에서 빠지면 안 됩니다.
- 이 규칙들은 Step6 렌더 관련 AI 수정 이후에도 유지되어야 하며, 렌더 경로를 바꿀 때는 이 섹션도 함께 갱신합니다.
