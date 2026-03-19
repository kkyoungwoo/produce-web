# current-task.md

## 작업명
mp4Creater 장기 유지보수 구조 정리 + 샘플 자산 분리 규칙 정착

## 현재 우선순위
1. `mp4Creater`에서 사진/영상 샘플을 별도로 관리할 수 있게 구조를 고정한다.
2. 개발자가 샘플을 쉽게 추가/삭제할 수 있게 경로와 규칙을 명확히 한다.
3. 에이전트가 `mp4Creater`를 수정할 때 읽어야 할 파일과 건드리면 안 되는 파일을 명확히 한다.
4. 특히 `videoService.ts`, prompt workflow, API 연동, storage 흐름은 항상 영향 범위를 같이 보게 만든다.

## 현재 상황
- DB 쪽은 기본 정리가 끝났고 API 연동 관점으로 유지하면 된다.
- `mp4Creater`는 앞으로도 계속 변경될 가능성이 높다.
- 특히 아래 영역은 자주 수정될 가능성이 높다.
  - prompt 구조
  - provider/API 연동
  - scene 생성 흐름
  - video render 흐름
  - 저장 폴더 / autosave / project sync

## 반드시 지킬 것
- 기존 기능을 깨는 광범위한 리팩터링 금지
- `db-cleanup`과 `workbench`는 명시적 요청 없으면 수정 금지
- 샘플 자산과 실제 저장 결과물 혼합 금지
- API 미연결 상태의 샘플 fallback 유지
- `types.ts` 변경 시 관련 사용처 동시 점검
- `videoService.ts` 수정 시 SceneStudioPage와 자막/오디오 흐름까지 같이 확인

## 읽어야 할 순서
1. 루트 `AGENTS.md`
2. `lib/mp4Creater/AGENTS.md`
3. `lib/mp4Creater/.ai/rules/edit-rules.md`
4. `lib/mp4Creater/.ai/rules/testing-rules.md`
5. `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
6. 필요 시 `lib/mp4Creater/ARCHITECTURE.md`
7. 필요 시 `lib/mp4Creater/.ai/context/*`

## 샘플 자산 경로
### 공개 샘플
- `public/mp4Creater/samples/characters/`
- `public/mp4Creater/samples/styles/`
- `public/mp4Creater/samples/images/`
- `public/mp4Creater/samples/videos/`
- `public/mp4Creater/samples/audio/`
- `public/mp4Creater/samples/thumbnails/`

### 로컬 개발 샘플
- `local-data/tubegen-studio/sample-library/characters/`
- `local-data/tubegen-studio/sample-library/styles/`
- `local-data/tubegen-studio/sample-library/images/`
- `local-data/tubegen-studio/sample-library/videos/`
- `local-data/tubegen-studio/sample-library/audio/`

## 완료 조건
- 에이전트가 `mp4Creater` 수정 시 읽어야 할 경로가 명확해야 한다.
- 샘플 추가/삭제 규칙이 문서화되어 있어야 한다.
- manifest/check 스크립트로 샘플 구조를 검증할 수 있어야 한다.
- 결과 보고 포맷과 PR 설명 포맷이 고정되어 있어야 한다.
## 2026-03-19 update
- InputSection route-step render path split:
  - `lib/mp4Creater/components/inputSection/steps/Step1Panel.tsx`
  - `lib/mp4Creater/components/inputSection/steps/Step2Panel.tsx`
  - `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx`
  - `lib/mp4Creater/components/inputSection/steps/Step4Panel.tsx`
  - `lib/mp4Creater/components/inputSection/steps/Step5Panel.tsx`
- Common step modules extracted:
  - `lib/mp4Creater/components/inputSection/constants.ts`
  - `lib/mp4Creater/components/inputSection/ui.tsx`
  - `lib/mp4Creater/components/inputSection/helpers.ts`
  - `lib/mp4Creater/components/inputSection/types.ts`
- Settings/project gallery follow-up:
  - Free badge is shown for free TTS/BGM options, and per-option paid text labels were removed.
  - Free BGM preview is playable even in paid mode (API key is required only for ElevenLabs BGM models).
  - Gallery viewport height now uses fixed header-based min-height (`100dvh - 150px`) to keep footer visible on sparse project lists.
- Gallery loading state now renders card skeletons before project data arrives.
- Header project count now includes an immediate pending-create delta while new project creation is in progress.

## 2026-03-19 latest patch
- Project gallery skeleton card action area updated to match current card layout:
  - wide primary action placeholder + compact secondary action placeholder
- During loading, real project cards are now rendered together with skeleton cards
  so newly created projects can be visible immediately without waiting for loading to finish.
- Removed redundant `onRefresh()` call right after create-modal submit to reduce
  delayed overwrite/flicker after optimistic project insertion.
- Creation flow keeps optimistic insert first, then replaces with saved project data.
- Validation executed:
  - `npx tsc --noEmit --pretty false`

## 2026-03-19 concept prompt update
- Step1 concept taxonomy was aligned to 4 explicit types:
  - `music_video`, `story`, `news`, `info_delivery`
- Added a dedicated concept prompt file for info-delivery:
  - `lib/mp4Creater/prompts/infoDeliveryPrompts.ts` (temporary/editable baseline)
- Prompt bundle routing now resolves concept-specific prompt files per type:
  - `lib/mp4Creater/prompts/index.ts`
- Aspect ratio wording in Step1 now explicitly states it is shared by image/video generation.
- Concept-selected values continue to flow into later steps and prompt pack generation through workflow draft state.

## 2026-03-19 project copy update
- Saved project cards now support direct copy from the thumbnail top-right `복사` button.
- Copy behavior duplicates full saved payload (assets, workflowDraft, prompt edits, preview/final media metadata, costs, thumbnail history, BGM/TTS preview fields).
- Copied project name is auto-generated as `<원본이름> 복사(n)` with collision-safe numbering.
- Copied projects receive a new project id, created time, and next project number to avoid collisions.

## 2026-03-20 latest continuity update
- 라우팅 정리:
  - `?view=main`은 서버에서 `?view=gallery`로 리다이렉트.
  - 최종 씬 제작 경로는 `step-6`이 정식 경로.
  - Step 라우트 이동 시 `projectId`를 유지해 프로젝트 문맥이 끊기지 않게 유지.
- 프로젝트 생성/로딩 성능:
  - 신규 생성 시 `saveStudioState` 완료 대기를 줄이고 즉시 진행(체감 지연 완화).
  - 생성 직후 optimistic card를 먼저 반영하고 저장 결과로 치환.
  - 세션 내 재진입 시 초기 부트스트랩을 과도하게 반복하지 않도록 최적화.
- 실시간 저장:
  - Step 편집 시 workflow draft 저장과 project patch 저장을 동시 유지.
  - 저장 디바운스는 빠른 반영 기준으로 조정됨(회귀 시 체감 지연 발생).
- Step 동작 규칙(회귀 금지):
  1. Step1: 초기 진입 페이지는 1개만 사용(로딩용 가짜 페이지 금지), 돌아가기 버튼 유지.
  2. Step2: 추천 주제는 초기 1회 + "주제 새로고침" 클릭 시에만 갱신.
  3. Step2: 추천 클릭은 input 치환(append 금지), 사용자가 직접 입력한 텍스트는 새로고침으로 강제 변경하지 않음.
  4. Step3: "프롬프트 보기"는 모달로 즉시 열리고 편집 가능해야 함.
  5. Step3: 프로젝트별 프롬프트를 저장/재사용, Step1 콘셉트 변경 시 프롬프트 재초기화.
  6. Step6: 씬 제작은 프로젝트 ID 기준으로 이어서 열림.
- Gallery/카드 규칙:
  - 카드 생성/복사 중에는 중복 액션 잠금.
  - 복사 진행 중 재클릭 시 안내 모달 노출.
  - 스켈레톤은 실제 카드 레이아웃과 동일한 액션 비율 유지.
- 반드시 검증:
  - `npx tsc --noEmit --pretty false`
  - `npm run build`
  - 수동: 생성→step 이동→새로고침 복원→상세보기 재진입→step6 이동
