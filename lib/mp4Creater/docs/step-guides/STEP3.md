# STEP3

## Script Generation Progress Guard
- Keep the Step3 textarea locked while AI generation is running.
- Do not write partial segmented output into the textarea; only commit the final merged script after generation finishes.
- `lib/mp4Creater/components/InputSection.tsx` starts and clears the progress state.
- `lib/mp4Creater/services/scriptComposerService.ts` reports long-script progress during initial draft, segmented continuation, and final merge.
- `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx` shows the progress card and keeps Save / Revert disabled during generation.

## Shared Voice / Model Picker Rules
- Step3 script model selection must use the shared option catalog from `lib/mp4Creater/services/aiOptionCatalog.ts`.
- Step3 cast voice selection must open `lib/mp4Creater/components/TtsSelectionModal.tsx`, while script model selection continues to use `lib/mp4Creater/components/AiOptionPickerModal.tsx`.
- Step3 project default TTS summary must stay aligned with `lib/mp4Creater/components/SettingsDrawer.tsx`.
- If you change cost / quality / badge copy for Step3 voice or model cards, update `aiOptionCatalog.ts` first.
- Step3 cast voice selection should not auto-apply on first card click; keep the shared confirm button flow so the user can compare before saving the choice.
- Step3 cast voice selection should use the same grouped `무료 / 유료 / 프리미엄` model-card step and follow-up voice step as Settings, and the current project voice sample/reference should be passed into the shared TTS modal when available.
- Voice preview in the Step3 picker should use the shared option metadata when a preview clip exists.
- Step3 voice picker labels should stay Korean for actions and guidance text, even when the voice/model name itself is English.
- Step3 script-model cards must keep API-missing entries disabled/gray, with sample/no-AI remaining selectable just like the other shared picker flows.
- For `music_video`, Step3 writes lyrics only. Those lyrics must later feed Step6 background-music prompting and performer lip-sync timing instead of becoming scene narration audio.

목표: Step2에서 선택한 콘텐츠 주제와 톤을 유지한 채, 바로 읽거나 부를 수 있는 최종 대본만 생성되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/services/scriptComposerService.ts`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowStepContractService.ts`

## 이번 유지 포인트
- Step3 대본은 Step2의 주제, 장르, 분위기, 배경, 주인공, 갈등, 결말 톤을 직접 반영해야 합니다.
- 뮤직비디오는 가사만 작성합니다. 줄거리 설명, 장면 해설, 상황 설명서처럼 보이는 산문형 문장은 금지합니다.
- 뮤직비디오가 아닌 경우에는 실제로 읽을 낭독 대본만 작성합니다. 화면 연출 지시, 카메라 지시, 메타 문구는 넣지 않습니다.
- 문단은 개별 씬으로 잘릴 수 있어야 하지만 앞뒤 감정선은 이어져야 합니다.
- Step3 프롬프트를 바꾸면 Step4 캐릭터 추출, Step6 이미지/영상, 썸네일에도 같은 축이 이어지는지 봅니다.
