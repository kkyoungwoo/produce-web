# AGENTS.md for lib/mp4Creater

## 목적
이 문서는 `mp4Creater` 작업용 실행 목차입니다.
필요한 파일만 읽고, 작은 범위로 수정하고, 검증까지 끝내는 것을 기본으로 합니다.

## 시작 순서
1. `CLAUDE.md`
2. `lib/mp4Creater/.ai/current-task.md`
3. `lib/mp4Creater/.ai/rules/edit-rules.md`
4. `lib/mp4Creater/.ai/rules/testing-rules.md`
5. `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
6. 필요 시 `lib/mp4Creater/ARCHITECTURE.md`
7. 필요 시 `lib/mp4Creater/.ai/context/*`

## 프롬프트 운영 규칙
- 사용자의 작성 언어는 한국어 기본으로 유지합니다.
- AI로 보내는 프롬프트는 전송 직전에 영어로 번역합니다.
- 번역 레이어는 `lib/mp4Creater/services/promptTranslationService.ts`를 사용합니다.
- 같은 문장은 캐시를 재사용해 토큰 낭비를 줄입니다.
- 자막 분리, TTS 본문, 원문 그대로 비교해야 하는 입력은 번역하지 않습니다.

## 작업 유형별 읽기 순서
### A. Step/UI 흐름 변경
1. `lib/mp4Creater/.ai/context/change-map.md`
2. `lib/mp4Creater/App.tsx`
3. `lib/mp4Creater/components/InputSection.tsx`
4. `lib/mp4Creater/agents/stepAgentRegistry.ts`
5. `lib/mp4Creater/prompts/workflow-agents/*`
6. `lib/mp4Creater/services/workflowDraftService.ts`
7. `lib/mp4Creater/types.ts`

### B. Prompt/Provider 변경
1. `lib/mp4Creater/services/workflowPromptBuilder.ts`
2. `lib/mp4Creater/services/scriptComposerService.ts`
3. `lib/mp4Creater/services/promptTranslationService.ts`
4. `lib/mp4Creater/services/geminiService.ts`
5. `lib/mp4Creater/services/openRouterService.ts`
6. `lib/mp4Creater/services/falService.ts`
7. `lib/mp4Creater/types.ts`

### C. 저장/프로젝트 열기 변경
1. `MP4CREATER_PROJECT_STORAGE_RULES.md`
2. `lib/mp4Creater/services/localFileApi.ts`
3. `lib/mp4Creater/services/projectService.ts`
4. `app/api/local-storage/_shared.ts`
5. `app/api/local-storage/state/route.ts`

## 작업 수칙
- 현재 작업 범위를 먼저 확인합니다.
- 범위 밖의 대규모 리팩터링은 하지 않습니다.
- API 미연결 상태에서도 샘플/폴백 흐름은 항상 유지합니다.
- `types.ts`를 바꾸면 연관 서비스와 컴포넌트를 함께 점검합니다.
- 프롬프트 번역 규칙을 새 AI 호출부에도 같은 방식으로 적용합니다.
- 기능이 바뀌면 관련 MD를 같은 변경에서 바로 갱신합니다.
- 과거 설명용 MD, 구버전 가이드, 중복 참고문서는 남겨두지 않고 삭제하거나 최신 문서로 통합합니다.

## 자주 보는 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/scriptComposerService.ts`
- `lib/mp4Creater/services/geminiService.ts`
- `lib/mp4Creater/services/falService.ts`
- `lib/mp4Creater/services/promptTranslationService.ts`
- `lib/mp4Creater/services/videoService.ts`

## 현재 Step 기준 (최신)
1. Step 1: 초기 설정
2. Step 2: 콘텐츠 주제 입력 + 추천문장 클릭 즉시 반영
3. Step 3: 프롬프트 선택 → 추천 문구 추가 → 최종 대본 생성
4. Step 4: 최종 대본 완료 후 캐릭터 카드(주인공/조연/나레이터) 제작
5. Step 5: 화풍 선택
6. 완료 즉시: Scene Studio 자동 진입 (별도 "씬 제작 열기" 단계 없음)

## 구현 체크포인트 (최신)
- Step 하단 다음 버튼은 PC/모바일 모두 중앙 정렬로 유지합니다.
- Step 2 추천문장 클릭은 참고 표시가 아니라 `topic` 실제 값 변경이어야 합니다.
- Step 3 추천 문구는 표시용이 아니라 `promptAdditions`에 실제 누적되어야 합니다.
- 캐릭터 카드 UI는 Step 3 최종 대본 준비 전에는 노출하지 않습니다.
- 화풍 추천/추가 시 기존 선택 상태와 리스트 순서가 흔들리지 않게 key/state를 고정합니다.
- autosave는 입력 중 debounce, 단계 전환/핵심 액션 시 즉시 저장을 같이 사용합니다.
- 프로젝트 카드 썸네일은 `마지막 생성 썸네일 → 첫 이미지 → fallback` 우선순위를 따릅니다.
- Scene Studio는 텍스트/메타 먼저 렌더하고, 이미지는 영역 단위 로딩 + 퍼센트 표시로 진행합니다.

## 검증
- `npx tsc --noEmit`
- `npm run build`
- 필요 시 실제 Step 이동과 씬 제작 동선 수동 확인

## 2026-03 provider update
- Text AI: OpenRouter only
- Premium voice/audio: ElevenLabs
- Default free TTS: qwen3-tts label with internal sample/browser fallback
- No API key is treated as normal sample mode
- Prompt bundles are split by content type under `lib/mp4Creater/prompts/*`

## 2026-03-20 continuity snapshot (필독)
- 기본 진입 뷰는 `?view=gallery`입니다. `?view=main`은 더 이상 사용하지 않으며, 서버에서 gallery로 리다이렉트됩니다.
- 워크플로우 라우트는 `step-1`~`step-5`, 최종 씬 제작은 `step-6`이 기준입니다.
- `scene-studio` 경로는 레거시 호환 리다이렉트로만 유지합니다.
- Step 이동 URL에는 가능한 한 `projectId`를 유지합니다. (`/step-n?projectId=...`)
- 신규 프로젝트 생성은 낙관적 UI(optimistic insert) 후 실제 저장 결과로 치환합니다.
- 생성 직후 Step1 이동 시 프로젝트가 실제로 1개만 생성되어야 하며 중복 생성은 회귀 버그로 취급합니다.
- Step 데이터는 draft 저장 + project 저장이 함께 돌아가야 하며, 이동 중에도 데이터 유실이 없어야 합니다.
- Step2 추천 주제는 "초기 1회 + 새로고침 버튼 클릭 시"만 갱신합니다.
- Step3 프롬프트 보기는 모달로 열려야 하며, 프로젝트 전용 프롬프트를 확인/수정할 수 있어야 합니다.
- Gallery 카드 상호작용(생성/복사/삭제)은 중복 클릭 잠금, 스켈레톤, 빠른 정렬 갱신을 유지합니다.
- hydration 회귀 방지: `button` 중첩 금지, SSR/CSR 비결정적 값(`Math.random`, 시간, 브라우저 전용 분기) 주의.
