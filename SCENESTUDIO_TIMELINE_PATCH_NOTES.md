# SceneStudio Timeline Patch Notes v2

작성일: 2026-03-29

## 이번 업데이트에서 반영한 범위

이번 수정본은 직전 타임라인 패치를 기준으로 아래 요청을 추가 반영했습니다.

- Step2 예상 길이 선택을 `15초 / 30초 / 45초` 프리셋으로 변경
- 짧은 영상 길이에 맞게 대본 추천 길이와 문단 수 계산 로직 보정
- Step6 안에서 `씬 편집 / 타임라인`을 나누는 **별도 탭 UI** 추가
- 타임라인은 Step6와 같은 데이터에 연결되도록 유지
- 타임라인 드래그 중 상위 state 갱신을 줄여 렉을 낮추는 방향으로 최적화
- 타임라인 UI를 참고 이미지 톤에 맞게 어두운 workbench 형태로 재구성

## 이번 수정에서 직접 바뀐 파일

- `lib/mp4Creater/utils/scriptDuration.ts`
- `lib/mp4Creater/components/inputSection/steps/Step2Panel.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/services/workflowStepContractService.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/services/scriptComposerService.ts`
- `lib/mp4Creater/components/ResultTable.tsx`
- `lib/mp4Creater/components/editor/TimelineWorkbench.tsx`

## 세부 반영 내용

### 1) Step2 길이 선택
- 1분 / 3분 / 5분 위주 흐름 대신 Shorts 기준 `15초 / 30초 / 45초` 선택 카드로 정리
- 기본값도 30초 중심으로 맞춤
- 표시 라벨도 초 단위로 자연스럽게 보이도록 보정

### 2) 대본 길이 계산 보정
- 추천 문단 수 계산이 1분 미만에서도 무너지지 않게 수정
- 문자 수 가이드도 초 단위 길이에 비례하도록 조정
- fallback script 생성 로직도 15초 / 30초 / 45초 기준에 맞춰 정렬

### 3) Step6와 연동되는 타임라인 탭
- `ResultTable.tsx`에 `씬 편집 / 타임라인` 탭 추가
- 타임라인 탭 선택 상태는 localStorage에 저장
- 타임라인에서 길이 조절, 순서 변경, 분할, 범위 미리보기가 기존 Step6 데이터와 이어지도록 연결

### 4) 타임라인 최적화
- `TimelineWorkbench.tsx`에서 trim 중 길이 변경을 부모에 매 move마다 반영하지 않고, 내부 override로 처리하다가 pointer up 시 commit 하도록 변경
- playhead / range / zoom / preview 계산을 로컬 상태 중심으로 유지
- 타임라인 탭은 필요할 때만 mount 되도록 하여 불필요한 작업을 줄임

## 검증 메모

이 환경에서는 전체 프로젝트 의존성이 설치되어 있지 않아 `next build` 전체 검증은 못 했습니다.
대신 아래 변경 파일들은 TypeScript `transpileModule` 기준으로 문법 검사를 통과했습니다.

- `scriptDuration.ts`
- `Step2Panel.tsx`
- `Step3Panel.tsx`
- `InputSection.tsx`
- `App.tsx`
- `workflowDraftService.ts`
- `workflowStepContractService.ts`
- `sceneAssemblyService.ts`
- `scriptComposerService.ts`
- `ResultTable.tsx`
- `TimelineWorkbench.tsx`

## 아직 남은 범위

이번 수정본은 요청하신 방향으로 업데이트한 패치본이지만, 아래는 여전히 후속 고도화가 필요합니다.

- ripple / snap / collision 정교화
- subtitle lane 본격 구현
- multi-select / marquee / context menu
- render hardening 전체
- 더 큰 프로젝트에서의 virtualization 추가 최적화
