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
- `workflowDraft.promptStore.rolePrompts`와 `project.prompts.rolePrompts`에 대본/캐릭터/스타일/장면/영상/배경음/썸네일 프롬프트를 역할별로 분리 저장합니다.
- `rolePrompts`는 저장용 요약이 아니라 Step3 실제 대본 생성과 Step6 씬 이미지/영상 prompt 실행의 공통 기준으로 재사용해야 합니다.
- `project.prompts`는 기존 `scriptPrompt/scenePrompt/imagePrompt/videoPrompt/motionPrompt/thumbnailPrompt`를 유지하면서 `characterPrompt/stylePrompt/backgroundMusicPrompt/backgroundMusicPromptSections/rolePrompts`를 추가로 보존합니다.
- 썸네일은 별도 부가 산출물이 아니라 Step1~Step6 전체와 현재 Step6 실제 씬을 요약한 프로젝트 대표 결과물로 저장합니다.
- Step3 AI 대본 생성은 긴 분량일 때 한 번에 몰아 쓰지 않고, 동일 콘셉트와 흐름을 유지한 여러 세그먼트로 나눠 이어 쓰는 경로를 유지합니다.
- Step6 이미지/영상 프롬프트는 행동과 감정 변화를 우선하고, 읽어야 하는 배경 텍스트나 간판/포스터/UI/로고를 새로 만들지 않는 규칙을 유지합니다.

## Step6 Latest Stable Flow
- Step5 -> Step6 handoff must stay centered on `lib/mp4Creater/App.tsx` `handleOpenSceneStudio`.
- Before route push, the latest `workflowDraft`, initial scene cards, background tracks, and preview mix must be written to both `projectNavigationCache` and `sceneStudioSnapshotCache`.
- If the target project already has saved Step6 payload, reopen must reuse that payload first instead of recreating empty scene cards from the Step5 draft.
- Step6 first paint must prefer the newest source among navigation cache, scene snapshot, and saved project JSON.
- If `generatedData` already exists, Step6 must keep the result panel visible even while project hydration is still running.
- Reopen logic must not recreate draft placeholder scenes before saved Step6 payload hydration finishes.
- Latest Step6 state is decided by comparing project `lastSavedAt` and snapshot `savedAt`.
- Step6 autosave must track text/prompt edits, media generation results, paragraph add/delete, and cost changes so refresh/back/import/export all reuse the same latest working copy.
- Imported projects must recreate Step6 snapshot cache immediately from imported JSON.
- Step6 preview render must stay visible after reopen until the user explicitly renders again; scene edits may mark the preview stale, but must not silently delete the last rendered preview video.
- Same-session Step6 reopen should prefer the in-memory navigation cache when available so a rendered preview video does not disappear during route re-entry.
- Final MP4 export must use the ffmpeg render route and return a faststart MP4 instead of the browser `MediaRecorder` blob path.
- Remove and do not revive the legacy browser merged-render path in `SceneStudioPage.tsx`; preview and final download must share the ffmpeg route only.
- Final MP4 download headers must stay ASCII-safe in `Content-Disposition` and carry the UTF-8 filename through `filename*`, otherwise Korean project names can break the render response before download starts.
- Step6 result preview must also be rendered through the ffmpeg route so the visible preview video and the downloaded MP4 come from the same renderer.
- When a Step6 preview MP4 already exists, the download action should reuse that exact current preview MP4 instead of building a different video behind the scenes.
- The ffmpeg render route must prefer the project-level `ffmpeg/bin` copy prepared from `ffmpeg-static` so Vercel/server deploys do not depend on a machine-level ffmpeg install; `FFMPEG_PATH` remains the manual override.
- `scripts/ensure-ffmpeg-binary.mjs` must keep copying the installed `ffmpeg-static` binary into `ffmpeg/bin` during `postinstall`.
- `next.config.ts` must keep `outputFileTracingIncludes['/api/mp4Creater/render']` pointing at `ffmpeg/bin/**/*` and `node_modules/ffmpeg-static/**/*` so the deployed route bundle keeps the ffmpeg binary.
- Step6 result preview no longer offers DaVinci auto-import or DaVinci package ZIP actions; the supported delivery path is the finalized MP4 export plus XLSX / CSV-ZIP / SRT.
- Local studio cache must stay lightweight by stripping large inline media payloads and data-URL thumbnails before writing `tubegen_studio_state_cache`, or Step6 autosave can hit browser storage quota and interrupt export flows.
- Step6 preview/export should render only the media actually prepared in Step6: scene image/video, scene audio, and selected background music. Narration text must not be auto-burned in as subtitles.
- If a scene has no real image or video yet, preview/export should fall back to a black frame only. Do not swap in random sample style backgrounds.

## Step6 Result Preview Logic
- Result preview is the canonical current render product for Step6.
- The preview player in the UI and the downloaded final MP4 must stay visually identical.
- If a current preview MP4 already exists, download must reuse that same preview MP4 instead of creating a different render behind the scenes.
- If a new render is required, preview and download must use the same ffmpeg render input.
- Allowed render inputs are only the current Step6 state:
- current scene order
- current selected visual type per scene
- current scene image or current scene video
- current scene audio
- current selected background music
- current preview mix
- current aspect ratio
- Disallowed preview/export inputs:
- random sample backgrounds
- placeholder SVG scene cards treated as real visuals
- narration text automatically burned into subtitles
- any media not present in the current visible Step6 working state
- If a scene has no real visual media, render a black frame for that scene duration.
- If a scene has no audio, keep the scene duration and render silence instead of changing the timeline.
- After a successful preview render, reopen must keep showing that last preview until the user explicitly renders again.
- Scene edits may mark preview stale, but must not silently replace the last successful preview video with another output.

## Prompt Path Preserve Rules
- Step1~5 prompt chain: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- 역할별 prompt 저장/Step 연결 요약: `lib/mp4Creater/services/workflowStepContractService.ts`
- Step3 실행 prompt 추가 규칙: `lib/mp4Creater/components/InputSection.tsx`
- Step3 모델 요청 본문 조립: `lib/mp4Creater/services/scriptComposerService.ts`
- Step2 freshness / recommendation logic: `lib/mp4Creater/services/storyRecommendationService.ts`
- Step4 character upload / selection / similar-regeneration logic: `lib/mp4Creater/components/InputSection.tsx`, `lib/mp4Creater/services/characterStudioService.ts`
- Step6 paragraph image/video continuity logic: `lib/mp4Creater/services/sceneAssemblyService.ts`, `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/services/imageService.ts`, `lib/mp4Creater/components/ResultTable.tsx`
- 배경음 prompt 분리/scene flow 반영: `lib/mp4Creater/services/musicService.ts`
- 썸네일 최종 대표 prompt 조립: `lib/mp4Creater/services/thumbnailService.ts`
- Workflow contract / summary JSON structure: `lib/mp4Creater/services/workflowStepContractService.ts`
- If any of these paths or responsibilities change, update this md and the matching step guide in the same patch.

## Step3 Script Generation Guard
- Step3 script generation must keep the textarea locked until the final result is complete.
- Partial AI output must not be written into the editor while generation is still running.
- `lib/mp4Creater/components/InputSection.tsx` owns the generation progress state and only applies the script after `composeScriptDraft(...)` completes.
- `lib/mp4Creater/services/scriptComposerService.ts` is the only place that should emit long-script progress updates for segmented generation.
- `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx` must show the progress card and keep the editor `readOnly` while `isGeneratingScript` is true.

## Shared AI Picker Rules
- Settings, Step3, and Step6 must use the same option metadata source for model / TTS cards.
- Shared picker catalog path: `lib/mp4Creater/services/aiOptionCatalog.ts`
- Shared picker modal path: `lib/mp4Creater/components/AiOptionPickerModal.tsx`
- Shared TTS multi-step picker path: `lib/mp4Creater/components/TtsSelectionModal.tsx`
- Settings default model / TTS picker path: `lib/mp4Creater/components/SettingsDrawer.tsx`
- Step3 script model / cast voice picker path: `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx`
- Step6 image / video / audio picker path: `lib/mp4Creater/components/ResultTable.tsx`
- Step6 quick selector wiring path: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Active TTS picker choices are `Qwen3-TTS` and `ElevenLabs`; HeyGen and unstable custom/free local paths should stay out of the shared picker flow.
- Header Settings background music selection should use the same card picker pattern as the other AI model settings.
- If cost / quality / provider labels change, update them in `aiOptionCatalog.ts` first rather than hardcoding different descriptions in each screen.
- TTS pickers must not auto-close on first click. The user should choose a card, optionally preview it, then confirm with the modal action button.
- The visible `선택하기` action inside each 16:9 picker card must be a real clickable button, not just decorative text.
- TTS cards should expose estimated cost in dollars and preview playback when a clip or preview render path is available.
- Settings TTS flow should move in the order `provider -> model -> voice`, especially for ElevenLabs.
- Picking a TTS model alone must not finalize the narrator. The final TTS voice is fixed only after the voice picker confirm step.
- Paid TTS model cards should stay visible for comparison, but remain disabled with a Korean reason message when the required API key or paid mode is not ready.
- Free TTS preview should prefer the Google AI Studio speech path when a key exists, so the user hears a real voice sample instead of a fallback tone.
- Free TTS preview, Step3 character preview, and Step6 real audio generation should all resolve the same selected free voice id. Do not let preview-only labels drift away from the actual generation preset.
- If a free/custom local TTS path cannot match real spoken output, keep it hidden from the active user-facing picker.
- User-facing TTS labels should stay Korean, while model ids/names may remain English.
- Header Settings must behave as the default configuration source for newly created projects.
- Header Settings should keep TTS editing behind one `기본 TTS` card, and Qwen/Eleven voice choice should happen inside the shared TTS popup instead of separate inline boxes.
- Step-level and project-level model/voice changes must stay scoped to the current project instead of mutating the global default settings.
- Settings, Step3, and Step6 should all keep the same TTS modal sequence: `모델 선택 -> 목소리 선택 -> 확인`, with `이전으로` available inside the same popup.
- In the TTS modal, model cards should move directly to the matching voice list, and only the final voice step should require the save/confirm action.
- In Step3, the primary voice-picking entry should stay on each character card so cast members can be assigned different voices without leaving the cast area.
- Settings cards that open modal pickers should avoid nested `<label>` wrappers when that causes button-click collisions.

## Thumbnail Studio Guard
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx` must stay scroll-safe on shorter desktop heights and smaller widths; thumbnail input and history panels should not hide content behind fixed-height clipping.
- Thumbnail Studio should pass the live project API cost into `lib/mp4Creater/components/Header.tsx` so the header dollar badge matches the rest of the editor flow.
- `lib/mp4Creater/components/ProjectGallery.tsx` should show the project estimated cost in dollars for quick comparison before entering the project.
- Thumbnail candidate history should use a normal responsive grid, not a horizontal scroll strip with custom arrow controls.
- The main `썸네일 생성` action belongs in the left `thumbnail inputs` header area, while the YouTube upload card stays in the right generation area.
- Sample thumbnail candidates should reuse the real style background images under `public/mp4Creater/samples/styles` so fallback previews still match the product mood.
- Sample Step6 scene images should reuse the same `public/mp4Creater/samples/styles/*` pool whenever the image route is in sample mode.
- Sample background music should reuse `public/mp4Creater/samples/audio/loop_main.wav` and loop to the requested duration in Settings preview and Step6 export.
- Header Settings background-music picker should expose `Google Lyria 2 (lyria-002)` in the same shared card flow and keep it disabled until the Google AI Studio key is connected.

## Step6 Tab AI Generation
- Step6 `대사 / 이미지 / 영상` editor tabs must keep the `AI 생성` button on the same row, aligned to the right edge of the tab group.
- The button must regenerate only the currently selected field:
- `대사`: narration text only
- `이미지`: image prompt text only
- `영상`: video prompt text only
- Button UI path: `lib/mp4Creater/components/ResultTable.tsx`
- Execution path: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Prompt-template path: `lib/mp4Creater/services/sceneEditorPromptService.ts`
- Continuity input must stay compact and use current / previous / next scene plus compact `rolePrompts` context.
- Repeated clicks should keep producing fresh variations without repeating the exact latest wording.
- Duplicate clicks must stay blocked while the current scene+tab generation is running.

## Latest Concept Prompt Upgrade
- Prompt execution now uses markdown-first sections across the live generation path.
- Shared helper: `lib/mp4Creater/services/promptMarkdown.ts`
- Global concept pack: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- Step3 live request body: `lib/mp4Creater/services/scriptComposerService.ts`
- Step3 role prompt merge: `lib/mp4Creater/components/InputSection.tsx`
- Step6 scene continuity assembly: `lib/mp4Creater/services/sceneAssemblyService.ts`
- Step6 image prompt handoff: `lib/mp4Creater/services/imageService.ts`
- Step6 motion base/fallback: `lib/mp4Creater/services/geminiService.ts`
- Step6 final motion handoff: `lib/mp4Creater/pages/SceneStudioPage.tsx`
- Background music prompt assembly: `lib/mp4Creater/services/musicService.ts`
- Thumbnail representative prompt: `lib/mp4Creater/services/thumbnailService.ts`
- Core rule: keep freedom and freshness, but keep script, image, motion, thumbnail, and background music clearly inside the selected concept.
- Core rule: paragraph endings and scene endings should leave a natural transition handoff unless the edit intentionally wants a hard break.

## Project Persistence Rules
- Primary project persistence is browser IndexedDB, not `/api/local-storage/*`.
- IndexedDB must keep `projectIndex`-style lightweight summaries for gallery restore and separate full project detail records for reopen/export/import/copy.
- Gallery/project list loads should prefer the IndexedDB summary index so large scene media does not get loaded just to paint cards.
- Project reopen, export, import, and copy must always resolve against the full detailed project payload so thumbnails, prompts, scene media, TTS, preview state, and project-applied AI settings stay intact.
- `saveStudioState(...)` and project autosave must still work when no storage folder is configured; front-only deploys should not require `storageDir` before project persistence starts.
- `/api/local-storage/*` is now an optional external JSON mirror only. If no external storage is configured, project saves must stay in IndexedDB/local cache without throwing.
- Project-level saved settings must contain only the values that affected that project result: script/image/video/TTS/BGM model choices, selected voice preset, prompt bundles, output mode, aspect ratio, and scene/thumbnail state.
- Global app settings, API keys, and shared provider secrets must stay outside project export/import payloads.
- Import/export payloads must stay versioned and standalone enough to restore a project on another browser or PC with thumbnail history, prompts, generated media, and project settings snapshot intact.

## 2026-03 Runtime Baseline
- Browser-first operation is the default baseline: project persistence lives in IndexedDB, and `/api/local-storage/*` is only an optional mirror.
- `lib/mp4Creater/services/googleAiStudioService.ts` is the shared key resolver for Google-backed live paths.
- Current live AI execution paths:
- script: `lib/mp4Creater/services/textAiService.ts`
- image: `lib/mp4Creater/services/imageService.ts`
- video: `lib/mp4Creater/services/falService.ts`
- background music: `lib/mp4Creater/services/musicService.ts`
- TTS: `lib/mp4Creater/services/ttsService.ts`
- Sample fallback must remain product-safe and playable when no API key is connected.
- Sample image fallback pool: `public/mp4Creater/samples/styles/*`
- Sample background-music loop: `public/mp4Creater/samples/audio/loop_main.wav`
- Free TTS providers should prefer the live Google TTS route when a Google AI Studio key is connected, because that path produces real spoken narration instead of a synthetic fallback tone.
- If no Google key is available, free TTS preview may fall back to browser speech preview, but actual scene audio generation should not silently succeed with a fake tone/sample asset.
- Google live TTS currently returns `audio/L16;codec=pcm;rate=24000`; runtime must wrap that PCM payload exactly as the official `s16le` decode example expects. Swapping the byte order corrupts speech into metallic/effect-like noise.
- Free TTS preview without a Google key should prefer browser speech preview rather than exposing a tone-like fallback first.
- Step6 single-scene audio regeneration should use the same soft-timeout guard as bulk scene generation so an unavailable TTS path does not leave the UI stuck in loading.
- Step6 preview and final MP4 download must continue to share the same ffmpeg render route.
- The render route must accept current Step6 media as data URLs, remote URLs, or public asset paths so sample and live outputs behave the same in preview/export.
- Unstable local/custom free TTS paths must stay hidden from the active picker until they can generate the same spoken output quality as the live path.

## Future Extension Points
- Add or change prompt text in:
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/scriptComposerService.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/services/sceneEditorPromptService.ts`
- `lib/mp4Creater/services/musicService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`
- Add or change model catalogs in:
- `lib/mp4Creater/config.ts`
- `lib/mp4Creater/services/aiOptionCatalog.ts`
- Add or change live execution routes in:
- `lib/mp4Creater/services/textAiService.ts`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/falService.ts`
- `lib/mp4Creater/services/musicService.ts`
- `lib/mp4Creater/services/ttsService.ts`
