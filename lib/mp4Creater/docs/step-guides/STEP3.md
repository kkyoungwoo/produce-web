# STEP3

목표: 샘플과 AI 생성이 같은 저장 구조를 쓰고, 선택한 프롬프트와 대본만 다음 단계에 또렷하게 전달되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/textAiService.ts`
- `lib/mp4Creater/services/openRouterService.ts`
- `lib/mp4Creater/config/promptEditGuides.ts`

## 안전 수정 포인트
- 프롬프트 카드는 선택본과 후보를 함께 저장합니다.
- 샘플 fallback도 workflowDraft 형식을 맞추면 Step6 재현성이 좋아집니다.
- PromptEditorModal 경로는 `lib/mp4Creater/components/inputSection/overlays.tsx` 입니다.
- Step3 프롬프트 항목이 늘어나면 이 md와 프롬프트 가이드도 함께 수정합니다.
