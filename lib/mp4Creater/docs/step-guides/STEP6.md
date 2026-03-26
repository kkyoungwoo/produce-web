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
- Step6 저장본은 `rolePrompts` 기준으로 대본 / 캐릭터 / 스타일 / 장면 / 영상 / 배경음 / 썸네일 프롬프트를 각각 분리해 남겨야 합니다.
- 배경음은 Step2 분위기, Step3 감정선, Step6 실제 scene flow를 따로 유지한 채 prompt를 조립해야 합니다.
- 썸네일은 Step1~Step6 전체를 종합한 프로젝트 대표 결과물로 저장되어야 하며, 현재 실제 씬 결과와 이질감이 나면 안 됩니다.

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
- Step6 project save must keep `project.prompts.backgroundMusicPrompt`, `project.prompts.backgroundMusicPromptSections`, `project.prompts.rolePrompts`, and the latest thumbnail prompt summary aligned with the visible cards.

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
- Final MP4 export must go through `app/api/mp4Creater/render/route.ts` so the delivered file is ffmpeg-rendered, seekable, and finalized with `faststart`.
- Final MP4 download response must keep `Content-Disposition` ASCII-safe and send the real UTF-8 project filename through `filename*` so Korean titles do not fail before the browser receives the file.
- Step6 result preview must use the same ffmpeg render path as final download so the preview video shown in the UI and the saved MP4 do not diverge.
- If the user already has a rendered Step6 preview MP4, final download should reuse that exact preview MP4 instead of creating a different render.
- `scripts/ensure-ffmpeg-binary.mjs` must copy the installed `ffmpeg-static` binary into `ffmpeg/bin` during `postinstall`, and `app/api/mp4Creater/render/route.ts` must prefer that path before falling back to system ffmpeg lookup.
- `next.config.ts` must include `outputFileTracingIncludes['/api/mp4Creater/render'] = ['./ffmpeg/bin/**/*', './node_modules/ffmpeg-static/**/*']` so Vercel keeps the bundled ffmpeg binary with the route.
- If a scene has `selectedVisualType === 'video'` and `videoData`, final export must use that scene video instead of collapsing back to a still image.
- If a scene has no real image/video result yet, preview/export must fall back to a black frame only; do not inject random sample style backgrounds.
- Once Step6 preview render succeeds, reopen must keep showing that last rendered preview until the user clicks render again; edit invalidation can change the message, but must not clear the stored preview video itself.
- The preview page progress card must appear only during preview render or final MP4 export, not merely because the page reopened with a saved render result.
- The Step6 preview modal must not expose DaVinci auto-import or DaVinci package ZIP actions anymore.
- Step6 autosave must keep the local browser cache small enough to avoid `QuotaExceededError`; inline preview binaries, background audio blobs, and data-URL thumbnails must be stripped from lightweight cache writes.
- Step6 preview/export should only burn in actual Step6 media state: scene image/video, scene audio, and selected background music. Narration text should not be auto-converted into subtitles.
- Result preview is the canonical current render product for Step6.
- The preview player and final MP4 download must stay visually identical.
- If a preview MP4 already exists, final download should reuse that same preview MP4 payload first.
- If a new render is required, preview and download must share the same ffmpeg input contract.
- Allowed render inputs:
- current scene order
- current scene image or current scene video
- current selected visual type
- current scene audio
- current selected background music
- current preview mix
- current aspect ratio
- Disallowed inputs:
- placeholder SVG scene cards as real visuals
- random sample backgrounds
- narration text automatically burned into subtitles
- any media not present in the current Step6 working state
- If a scene has no real visual media, render a black frame for that scene duration.
- If a scene has no audio, keep the scene duration and render silence.
- Reopen must preserve the last successful preview video.
- Scene edits may only mark the preview stale; they must not replace the saved preview with a different video until the user renders again.
- Scene cards exist하면 이미지, 영상, 오디오가 하나도 없어도 결과보기의 `합본 영상 렌더링` 버튼은 반드시 동작해야 합니다.
- 비주얼 우선순위는 `씬 영상 > 씬 이미지 > 검정 화면`입니다. 이미지와 영상이 모두 없으면 해당 씬은 검정 화면으로 `targetDuration` 또는 계산된 씬 길이만큼 유지합니다.
- 오디오 우선순위는 `씬 나레이션 오디오 + 배경음`이며, 둘 다 없어도 무음 상태로 합본이 계속 진행되어야 합니다. 오디오가 전혀 없어도 MediaRecorder/브라우저 캡처가 깨지지 않도록 무음 트랙을 유지합니다.
- 결과보기 웹 플레이어와 다운로드 파일은 같은 최신 렌더 결과를 기준으로 갱신해야 합니다. 새 다운로드 렌더가 끝나면 결과보기 플레이어도 같은 렌더 결과로 즉시 교체합니다.
- 렌더 길이는 개별 씬의 계산된 재생 시간을 모두 더한 총 길이를 기준으로 맞춰야 합니다. 특정 씬에 미디어가 없다고 해서 타임라인에서 빠지면 안 됩니다.
- 이 규칙들은 Step6 렌더 관련 AI 수정 이후에도 유지되어야 하며, 렌더 경로를 바꿀 때는 이 섹션도 함께 갱신합니다.
