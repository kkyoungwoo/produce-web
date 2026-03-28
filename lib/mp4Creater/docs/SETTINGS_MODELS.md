# SETTINGS / MODELS

## Shared Picker Rules
- Settings must be the source of truth for project-default text, image, video, and TTS routing.
- Model / TTS cards must use `lib/mp4Creater/services/aiOptionCatalog.ts`.
- The card modal UI must use `lib/mp4Creater/components/AiOptionPickerModal.tsx`.
- `lib/mp4Creater/components/TtsSelectionModal.tsx` model step must mirror the same grouped card language as the shared AI picker so TTS also reads as `무료 / 유료 / 프리미엄` sections.
- Step3 and Step6 should read the same option metadata instead of hardcoding separate cost / quality labels.
- Thumbnail Studio image-model selection must also come from the same shared option catalog / modal flow.
- Thumbnail Studio image-model changes are project-scoped overrides. They should save into the current project settings snapshot and must not overwrite the global header defaults for unrelated projects.

## TTS Consistency Guard
- `lib/mp4Creater/components/SettingsDrawer.tsx` sets the project default TTS provider, default voice, and default premium TTS model.
- Header Settings should expose TTS through one `기본 TTS` entry card only. Provider/model/voice sub-panels should not be duplicated outside the shared popup.
- Step3 should surface the same default summary and allow cast-level overrides through the shared picker modal.
- Step6 audio quick selection should reuse the same option catalog so quality / cost labels stay aligned with Settings.
- If voice badges, descriptions, or quality tiers change, update `aiOptionCatalog.ts` first.
- TTS provider / voice / model pickers should stage the choice first and only apply it after the modal confirm button is pressed.
- Settings, Step3, and Step6 should all use `lib/mp4Creater/components/TtsSelectionModal.tsx` for the final `tiered model cards -> voice list -> save` flow instead of maintaining separate voice pickers.
- HeyGen is no longer part of the active TTS picker flow. The supported TTS choices are `Qwen3-TTS` and `ElevenLabs`.
- The shared picker should show estimated dollar cost from `aiOptionCatalog.ts` and allow preview playback when the option has a preview clip or the Settings preview callback can generate one.
- TTS Settings flow should guide the user in this order: grouped model section -> model card -> voice. When ElevenLabs is chosen, selecting the model card should move inside the same popup to that model's voice list.
- Choosing a TTS model does not finalize the narrator. The final TTS voice is only fixed after the voice picker confirm step.
- For TTS specifically, clicking a model card should move the same modal directly into that model's voice list. The save/confirm button is only required on the final voice step.
- TTS model cards should keep paid providers visible for comparison, but disable them with a Korean reason message when API keys or paid mode are not ready.
- TTS does not currently have a real persisted sample runtime model. Sample behavior is preview fallback only, so the grouped model view may start at `무료 / 유료 / 프리미엄` while still using sample/browser fallback for free preview failures.
- TTS card descriptions, helper copy, and action labels should be written in Korean for the user-facing UI. English model names may stay as-is.
- TTS price labels should use the user-friendly tiers `무료 / 보통 / 높음`, while `costHint` can still show the approximate dollar estimate.
- Voice cards should expose the essentials needed for the final choice: `이름 / 설명 / 특징 / 가격 수준 / 미리듣기`.
- Preview playback should be shown on voice cards, not on the model cards themselves.
- Free voice preview should use the Google AI Studio speech path when that key is connected. Only when it is missing or fails should the picker fall back to local/sample preview.
- If a free preview falls back to the sample-tone path, the picker should prefer a browser speech preview over exposing only a tone-like sample.
- The shared picker cards should keep all visible content inside the 16:9 card frame without hover-only overflow.
- Shared picker modals should render above the full page through the common modal layer so they do not get pinned inside a scrolled step container.
- The selected free-voice id must stay consistent across Settings, Step3 cast preview, Step6 scene preview, and actual Step6 audio generation.
- Unstable custom-voice/free local TTS paths should stay hidden from the active picker until they produce the same spoken result in preview and real scene generation.
- Header Settings should remain the default template for future/new projects. Per-project detailed routing changes should be handled inside the project flow, not by overwriting the global defaults from the header.
- Step3 cast voice changes and Step6 scene audio changes must reuse the same `TtsSelectionModal.tsx` flow while staying scoped to the current project / cast / scene override.
- Step3 should keep character-level `TTS 선택` buttons on each cast card as the primary entry point. Do not move detailed voice selection back to a top-of-page shared card.
- Image / video model pickers should also wait for the modal confirm button before saving and closing.
- Thumbnail Studio image-model picker should also wait for the same confirm interaction before saving the current project override.
- Settings cards that only open modals should use plain block containers instead of nested `<label>` wrappers when click conflicts appear.

## Recent UI Notes
- TTS voice cards should stay in a one-row list layout instead of the generic multi-column AI model grid.
- Header Settings background music selection should reuse the shared AI picker card flow so users compare BGM model options with the same interaction pattern as text/image/video model selection.
- Sample background-music preview should reuse `public/mp4Creater/samples/audio/loop_main.wav`.
- Active background-music picker choices should now be `sample-ambient-v1`, `lyria-3-clip-preview`, and `lyria-3-pro-preview`; legacy `lyria-002` ids must normalize into the Lyria 3 clip path instead of staying visible in UI.
- Header Settings save must persist API keys first and then close the drawer in the same action so the saved key can immediately unlock the matching AI model picker options.
- The top-level storage-folder block is intentionally hidden from Header Settings; hosted/server runtimes should not require that UI before AI settings can be saved.

## 2026-03 Runtime Notes
- `lib/mp4Creater/services/googleAiStudioService.ts` is the shared Google key resolver used by script, image, video, and Google background-music flows.
- Thumbnail Studio live image readiness should use the same shared Google key resolver instead of a separate ad-hoc key check.
- Background-music model routing is execution-based, not UI-only:
- sample background-music models => `createSampleBackgroundTrack(...)`
- legacy `lyria-002` plus `lyria-3-clip-preview` / `lyria-3-pro-preview` => `createBackgroundMusicTrack(...)` live Google music path after normalization
- If Google background-music generation fails or no Google key exists, the runtime must fall back to the sample loop track without breaking Settings preview or Step6 export.
- Sample background-music defaults are now intentionally reduced to one baseline sample model. Older removed sample ids should normalize back to `sample-ambient-v1`.
- Free TTS providers should prefer the live Google TTS route when the Google AI Studio key is connected, because that is the stable real-speech path for current runtime.
- When Google TTS is available, the selected free provider/preset must still decide which mapped live voice is used. Do not collapse all free presets into one live narrator.
- Free TTS presets should stay audibly distinct so `qwen-default / qwen-soft` do not collapse into one identical narrator.
- Google live TTS preview audio arrives as `audio/L16;codec=pcm;rate=24000`, and the runtime must wrap it using the same `s16le` interpretation as the official Google example. Byte-swapping that payload produces noise instead of speech.
- If no Google key is available, free preview should prefer browser speech preview rather than exposing a tone-like fallback.
- Hidden local/custom free TTS experiments must not reappear in the active picker until they produce the same spoken output quality as live generation.
- Hosted/server Header Settings saves must stay browser-first. Failure to persist the optional YouTube OAuth file must not block normal AI settings save or close behavior.
- Thumbnail generation should pass the selected thumbnail image model id into `imageService.ts`, and the runtime should record `ai / sample / fallback` source accurately so project cost and gallery cost summary do not drift.
- Thumbnail image cost must be added only when the live route returns an actual AI image. Sample model and fallback recovery outputs should not increase `project.cost.total`.
- Adding a new model requires three aligned updates:
- user-facing option metadata: `lib/mp4Creater/services/aiOptionCatalog.ts`
- persisted default id / constants: `lib/mp4Creater/config.ts`
- real execution service: one of `textAiService.ts`, `imageService.ts`, `falService.ts`, `musicService.ts`, `ttsService.ts`

## Step6 Tab AI Routing
- `대사` tab AI generation uses `draft.customScriptSettings.scriptModel`, then `routing.scriptModel`, then `routing.textModel`.
- `이미지` tab AI generation uses `routing.imagePromptModel`, then `routing.sceneModel`, then the Step3 script model chain.
- `영상` tab AI generation uses `routing.motionPromptModel`, then `routing.sceneModel`, then the Step3 script model chain.
- Shared option labels still come from `lib/mp4Creater/services/aiOptionCatalog.ts`.
- Step6 tab-level prompt generation logic lives in `lib/mp4Creater/services/sceneEditorPromptService.ts`.

목표: 설정에서 고른 모델이 실제 라우팅에 반영되고, 오래된 값이나 잘못된 값은 안전한 기본값으로 정리되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/SettingsDrawer.tsx`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/config.ts`

## 안전 수정 포인트
- 저장 시 routing 값이 실제 지원 모델 목록으로 정규화되는지 확인합니다.
- 키가 없을 때는 샘플 provider로 부드럽게 내려오게 유지합니다.
- text/image/video/tts 모델은 각각 다른 fallback 규칙을 갖도록 두는 편이 안정적입니다.
- 설정 항목이 추가되면 이 문서와 실제 저장 로직을 함께 갱신합니다.
