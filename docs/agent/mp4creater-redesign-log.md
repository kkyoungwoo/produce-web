# mp4Creater Redesign Log

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
