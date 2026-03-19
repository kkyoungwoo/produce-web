# mp4Creater Development Guide

## 1. 이번 기준에서 먼저 확인할 것

필수 파일
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/types.ts`

## 2. Step 동작 규칙

### Step 2
- 추천문장 클릭 시 `나의 콘텐츠 주제` 입력값이 즉시 바뀌어야 합니다.
- 표시 전용 텍스트가 아니라 실제 state/draft 값이어야 합니다.

### Step 3
- 순서 고정: 프롬프트 선택 → 추천 문구 추가 → 최종 대본 생성
- 추천 문구는 `promptAdditions`로 누적 저장됩니다.
- 중복 문구는 자동으로 막아 순서/상태 흔들림을 줄입니다.

### Step 4
- Step 3 최종 대본 완료 전에는 캐릭터 카드 UI를 노출하지 않습니다.
- 주인공/조연/나레이터 역할이 모두 준비되어야 Step 5 진행이 가능합니다.

### Step 5
- 추천 화풍과 커스텀 화풍은 하나의 리스트 안에서 관리합니다.
- 추천 +1은 기존 그룹 내부에 추가되어 리스트 순서와 선택 상태를 유지합니다.
- 완료 즉시 Scene Studio로 이동합니다.

## 3. autosave / 복원 규칙

- 입력 중 저장은 debounce 기반으로 처리합니다.
- Step 이동/핵심 액션(씬 제작 진입, 썸네일 선택/생성)에서는 즉시 저장을 병행합니다.
- 프로젝트 재열기 시 아래 값이 복원되어야 합니다.
  - 주제, 프롬프트, 추천 문구 추가, 최종 대본
  - 캐릭터/화풍 선택
  - 썸네일 이력 및 현재 선택
  - 씬 자산/배경음/믹스/비용

## 4. 썸네일 처리 규칙

프로젝트 목록 표시 우선순위
1. 마지막 생성 썸네일
2. 첫 번째 씬 이미지
3. fallback

Scene Studio 내 썸네일
- 여러 번 생성 가능
- 생성 이력 확인 가능
- 현재 선택 썸네일 구분 가능
- 프롬프트/스타일 문구를 사용자가 수정 가능

## 5. Scene Studio 성능 규칙

- 진입 직후 텍스트/핵심 메타를 먼저 보여 줍니다.
- 이미지는 카드 영역에서 자동 생성하며, 전체 화면 블로킹 로딩을 피합니다.
- 로딩은 씬 단위로 분리하고 퍼센트를 표시합니다.
- 이력/대용량 미디어는 카드 단위 접근으로 필요 시점에 확인합니다.

## 6. 안정성 가이드

- 리스트 key는 고정 ID를 사용하고, 재정렬을 최소화합니다.
- 추천 버튼 클릭 시 전체 배열 재생성으로 선택 상태가 흔들리지 않게 합니다.
- 저장 실패 시 현재 메모리 상태를 유지하고 재시도 가능한 메시지를 남깁니다.
- 모든 코드/문서는 UTF-8로 유지하고 한글 깨짐을 금지합니다.

## 7. 검증 체크리스트

명령
- `npx tsc --noEmit`
- `npm run lint`

수동
- Step 1~5 흐름이 끊기지 않고 Scene Studio로 자동 이동하는지
- Step 2 추천문장 클릭 즉시 반영/복원 여부
- Step 3 추천 문구 추가 후 대본 생성 반영 여부
- Step 4 카드 노출 게이트(대본 완료 전 비노출) 여부
- Scene Studio 진입 시 텍스트 선노출 + 이미지 영역만 로딩 + 퍼센트 표시 여부
- 썸네일 다회 생성/이력/선택 및 프로젝트 목록 우선순위 표시 여부

## 2026-03 quick rules
- Do not block createMp4 when API keys are missing.
- Keep sample mode usable from start to finish.
- Store OpenRouter model, TTS provider, preview/final audio references, BGM, and music-video references in workflow/project state.
- Prefer OpenRouter for text and ElevenLabs/qwen3-tts for audio flows.

## 2026-03-20 update (route/save/perf)
- `?view=main`은 폐기 경로이며 gallery로 리다이렉트됩니다.
- 최종 씬 제작은 `step-6`이 정식 경로입니다.
- Step URL에는 `projectId`를 유지해 단계 이동/새로고침 시 문맥을 복원합니다.
- 신규 생성은 optimistic UI를 먼저 반영하고 저장 결과로 교체합니다.
- 생성/복사/삭제 중복 클릭 잠금과 스켈레톤 피드백을 유지합니다.
