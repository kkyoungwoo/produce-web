# mp4Creater Redesign Log

## 2026-03-22 (Fresh Generation / Variation Rules)
- 반복 생성 억제 규칙 추가:
  - `lib/mp4Creater/config/creativeVariance.ts`를 신설해 fresh/similar 규칙, shot/light/palette/subtitle 변주, generation signature를 중앙 관리.
  - 기본값을 `fresh`로 두고, 사용자가 직접 비슷함을 요구할 때만 similarity 모드로 해석하도록 정리.
- 대본 / 씬 / 영상 프롬프트 연결 업데이트:
  - `scriptComposerService.ts`와 `geminiService.ts`가 직전 결과 답습 금지와 새 관점 유도 블록을 공통 적용.
  - `sceneAssemblyService.ts`가 continuity를 유지하면서도 이전 씬과 똑같은 framing/hook 반복을 피하는 규칙을 추가.
- sample fallback 다양화:
  - `storyHelpers.ts` sample image가 고정 카드 한 장에서 벗어나 prompt seed 기준의 gradient / shot / caption tone 변주를 사용.
  - `falService.ts` sample video도 고정 zoom 대신 pan/zoom/motion seed를 달리해 흐름 테스트가 가능하도록 조정.
- Step4 새 후보 생성 의미 조정:
  - `characterStudioService.ts`의 기본 후보 생성이 유사안 중심이 아니라 fresh candidate 중심으로 바뀜.

## 2026-03-22 (Step3 Persistence / Step4 Character Restore)
- route step 재진입 안정화:
  - `App.tsx`가 프로젝트 summary보다 `projectNavigationCache`와 local detail을 먼저 읽도록 정리.
  - route step에서 `projectId`가 준비되기 전에는 InputSection을 열지 않고 복원 대기 화면을 먼저 보여 줌.
  - 같은 project 재진입 시 partial workflowDraft가 들어와도 현재 draft의 캐릭터/이미지 데이터를 보존하도록 merge 로직 추가.
- Step3 선택 캐릭터 유지:
  - `projectNavigationCache`가 workflowDraft의 출연자 이미지/대표 이미지 데이터를 유지하도록 조정.
  - `handleSaveWorkflowDraft`와 step 이동 직전 snapshot이 최신 draft를 cache에 다시 기록하도록 보강.
  - 대본 재추출 시 같은 이름/역할 캐릭터는 기존 generatedImages, selectedImageId, voice 설정을 우선 승계.
- Step4 작업 흐름 정리:
  - `출연자 갱신` 버튼 제거.
  - 이미지 등록은 출연자 카드 단위 업로드 흐름만 유지.
  - Step3에서 고른 출연자만 Step4에 남고, 뒤로 가기/재진입 후에도 대표 이미지 상태가 유지되도록 보강.

## 2026-03-22 (First Entry / Step4 Handoff Stability)
- 첫 진입과 신규 생성 안정화:
  - `/mp4Creater` loading route가 `null` 대신 skeleton을 반환하도록 정리.
  - 새 프로젝트 생성 시 optimistic project + navigation cache를 먼저 붙이고, 가능한 경우 실제 저장을 끝낸 뒤 `step-1`로 이동하도록 정리.
  - `/api/local-storage/project` GET이 상세 JSON이 없을 때 `projectIndex` 요약 fallback을 반환하도록 보강.
  - `storageDir`가 비어 있는 경우에도 기본 저장 경로 fallback을 우선 고려하도록 project API 정리.
- Step 3 → Step 4 출연자 handoff 안정화:
  - Step 4 이동 직전 현재 선택 출연자 id를 우선 보존.
  - 재추출이 필요한 경우에만 `preserveSelection` 기반 hydrate를 사용.
  - Step 4는 선택된 출연자만 렌더하고, 첫 이미지 자동 선택 / 첫 생성 자동 시작 흐름을 추가.
- 문서 정리:
  - 예전 프로젝트 폴더형 저장 구조 설명을 현재 JSON 저장 구조 기준으로 정리.
  - sample docs, storage rules, testing rules를 현재 코드와 맞춤.

## 2026-03-19
- 목표: 초보 사용자도 설명문을 많이 읽지 않고 바로 제작 흐름을 따라갈 수 있도록 UI를 간소화.
- 적용:
  - 루팅/설정 모델 확장: `TTS 모델`, `나레이터`, `배경음악 모델` 선택 추가.
  - Step 전환 시 스크롤 탑 동작 강화.
  - Step 3의 콘텐츠 잘림(숨김/오버플로) 문제 완화.
  - 씬 제작 화면의 입력 요약을 인라인 카드에서 모달 방식으로 변경.
  - 씬 카드 기본 노출 수를 6개로 제한하고 `더보기`로 확장 가능하게 구성.
  - 캐릭터/화풍 샘플 3종(총 6개) 파일 추가 및 빠른 불러오기 버튼 연결.
- 메모:
  - API 미연결 상태에서도 샘플 경로로 전체 흐름을 테스트할 수 있게 유지.
  - 다음 단계에서 버튼 정렬/간격 규칙을 한 번 더 통일할 예정.
  - 씬 카드 과밀 구간은 기본 6개만 노출하고 나머지는 `더보기` 팝업으로 열도록 조정.
  - 파일 저장 실패(OneDrive 잠금/UNKNOWN) 시 재시도 로직을 추가하고, 실패 프로젝트는 다음 저장 주기로 넘겨 앱 중단을 방지.
  - 자동저장 주기를 완화(0.5s → 1.8s)하고 프로젝트 목록 강제 새로고침을 제거해 체감 속도 개선.
  - 캐릭터 카드 영역은 휠 스크롤 이동을 제거하고 버튼 클릭 이동만 허용.

## 2026-03-19 (Scene Open Performance Follow-up)
- Added a `localOnly` fast-load path in `projectService` so scene open can use IndexedDB first without waiting for server sync fallback.
- Updated `SceneStudioPage` to avoid duplicate `getProjectById` calls and verify cached navigation project with a soft timeout.
- Updated `App` scene-open flow to apply workflow draft state optimistically and persist in background (non-blocking).
- Hardened `/api/local-storage/state` POST to return a safe fallback payload even when file writes fail, preventing UI-breaking `500` runtime interruptions.

## 2026-03-20 (Workflow/Storage/Route Consolidation)
- Canonical routing was finalized:
  - `/ko/mp4Creater?view=main` is deprecated and redirected to gallery.
  - final scene page is `step-6`.
  - `scene-studio` path remains as legacy redirect only.
- Step routes now preserve `projectId` query to keep context and reduce reload/mismatch issues between steps.
- New project creation latency was reduced by removing unnecessary blocking waits and keeping optimistic insertion.
- Draft autosave and project patch save were tightened for near-real-time persistence to project folders.
- Gallery interaction rules were stabilized:
  - create/copy in-progress lock
  - duplicate-click prevention
  - skeleton-first feedback while loading
- Hydration regression guardrails were documented after repeated issues:
  - no nested button structure
  - avoid SSR/CSR text drift for storage/path labels
  - avoid non-deterministic SSR attributes/styles
