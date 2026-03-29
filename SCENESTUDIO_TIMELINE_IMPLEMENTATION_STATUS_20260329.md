# SceneStudio Timeline Update Status

작성일: 2026-03-29

## 이번 수정에서 반영한 항목

### 1) 즉시 오류 수정
- `workflowDraftService.ts`에서 빠져 있던 `normalizeExpectedDurationMinutes` import 복구
- Step2의 15초 / 30초 / 45초 preset 흐름이 다시 runtime에서 끊기지 않도록 정리

### 2) 타임라인 고도화
- Step6와 연결된 별도 타임라인 탭 유지
- scene / narration / subtitle / bgm lane 표시
- drag reorder
- trim left / trim right
- playhead scrub
- range preview
- split at playhead
- right click context menu
- multi-select
- marquee select
- snap mode 토글 (`off / scene / beat / frame`)
- ripple mode 토글
- collision 경고 표시

### 3) 렉 완화 / 최적화
- viewport 기준 visible clip만 렌더링
- scrollLeft / width만 가볍게 추적
- 타임라인 UI snapshot 유지
- timeline telemetry 기록 추가

### 4) subtitle lane 본격 구현
- 나레이션 문장 기준 subtitle block 자동 분절
- subtitle inspector 탭 추가
- subtitle lane on/off 토글 추가

### 5) global asset library / continuity / derivation
- 로컬 저장 프로젝트 기준 cross-project asset library 수집 서비스 추가
- 현재 씬에 다른 프로젝트 asset 적용 버튼 추가
- continuity / derivation inspector 탭 추가
- lineage 정보 표시 추가

### 6) telemetry / QA
- editor action telemetry local storage 기록
- timeline QA summary 추가
- collision / orphan link / invalid duration / duplicate id 점검 요약 표시

## 새로 추가된 파일
- `lib/mp4Creater/services/timelineSnapService.ts`
- `lib/mp4Creater/services/timelineCollisionService.ts`
- `lib/mp4Creater/services/timelineRippleService.ts`
- `lib/mp4Creater/services/assetLibraryService.ts`
- `lib/mp4Creater/services/editorTelemetryService.ts`
- `lib/mp4Creater/services/timelineQaService.ts`

## 수정된 주요 파일
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/components/editor/TimelineWorkbench.tsx`
- `lib/mp4Creater/components/ResultTable.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`

## 남아 있을 수 있는 제한 사항
- 현재 asset replace는 SceneStudio 경로에서만 실제 scene data에 반영됨
- ripple / collision / snap은 실사용 수준으로 고도화했지만 NLE급 완전 규칙 엔진은 아님
- telemetry / QA는 local 기반이며 서버 수집까지는 아직 아님
- 자막 타이밍은 narration 기반 자동 분절이며 개별 자막 drag 편집까지는 아직 아님

## 2026-03-29 follow-up patch

- Fixed missing `normalizeExpectedDurationMinutes` runtime import in `Step3Panel.tsx`.
- Restored long-form expected duration presets up to 30 minutes while keeping new 15s / 30s / 45s shorts options in Step2.
- Added an explicit top-level workspace switch in `SceneStudioPage.tsx` so Step6 card editing and the timeline open as separate but linked tabs.
- Synchronized `ResultTable` workspace tab state with the new SceneStudio-level tab.
- Throttled timeline viewport scroll updates with `requestAnimationFrame` to reduce scroll/drag jank.
