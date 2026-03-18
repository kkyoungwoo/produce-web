# MP4CREATER V6 검증 메모

## 이번 버전에서 잡은 실제 원인

### 1) 씬 제작 페이지가 안 열리던 핵심 원인
- `tubegen_studio_state_cache` 에 전체 `StudioState` 를 그대로 넣고 있었음
- 프로젝트/씬 이미지, 오디오, 영상 base64가 같이 들어가면서 브라우저 `localStorage` 한도를 초과함
- 결과적으로 `QuotaExceededError` 가 발생하고, 저장/이동 흐름이 중간에서 끊기면서 프로젝트 로드와 씬 페이지 진입이 불안정해짐

### 2) 씬 제작 시 서버가 다운되는 것처럼 보이던 핵심 원인
- `saveStudioState()` 가 작은 변경에도 전체 state + 전체 projects 를 다시 POST 하던 구조였음
- Scene Studio 자동 저장도 매우 짧은 주기로 실행되며 큰 base64 payload 를 반복 전송/저장하고 있었음
- `studio-state.json` 자체에도 프로젝트 전체가 같이 저장되어 파일이 비대해질 수 있었음

### 3) 프로젝트 씬 제작 열기 실패 가능 원인
- 저장 후 서버 응답이 요약 형태로 바뀌거나 캐시가 summary 상태일 때,
  잘못하면 그 summary 가 IndexedDB 를 덮어써 실제 assets/workflowDraft 가 비어 있는 프로젝트처럼 보일 수 있었음
- 이번 버전에서는 전체 프로젝트 로드는 항상 폴더 기반 full project 를 다시 읽도록 보강함

## 적용한 수정

### 상태 캐시 / 저장 구조
- `localFileApi.ts`
  - 브라우저 `localStorage` 캐시를 **lightweight state** 로 변경
  - 프로젝트 전체/씬 자산/base64 는 캐시에서 제외
  - `QuotaExceededError` 발생 시 emergency fallback 캐시만 남기고 안전하게 복구
- `saveStudioState()`
  - 전체 state 를 재전송하지 않고 **필요한 필드만 lean payload** 로 전송
- `fetchStudioProjects()` 추가
  - 프로젝트 전체 로드는 `/api/local-storage/state?includeProjects=1` 로 따로 수행

### API / 파일 저장
- `app/api/local-storage/_shared.ts`
  - `serializeStateForClient()` 추가
  - `studio-state.json` 에는 프로젝트 요약만 저장하도록 변경
  - 실제 전체 프로젝트 데이터는 각 프로젝트 폴더의 `project.json` 에 유지
- `app/api/local-storage/state/route.ts`
  - 기본 응답은 summary
  - `includeProjects=1` 일 때만 full project 반환
- `app/api/local-storage/config/route.ts`
  - 설정 응답도 summary 기준으로 통일

### 프로젝트 로드 안정화
- `projectService.ts`
  - 프로젝트 저장 후 summary 응답으로 IndexedDB 를 다시 덮어쓰지 않도록 수정
  - `getSavedProjects()` 는 IndexedDB 우선, 없으면 full project fetch
  - `getProjectById()` 는 필요 시 `forceSync` 로 실제 프로젝트 폴더 기반 재조회
- `App.tsx`, `SceneStudioPage.tsx`
  - `projectId` 로 열 때 `getProjectById(..., { forceSync: true })` 사용

### Scene Studio 부하 완화
- 자동 저장 signature 에서 base64 본문 비교 제거
- 자동 저장은 생성/영상/썸네일 진행 중에는 쉬도록 조정
- 자동 저장 debounce 시간 증가 (`500ms -> 1800ms`)

### Step 3 작업 집중 보기
- `InputSection.tsx`
  - `5:5 균형`
  - `대본 크게`
  - `캐릭터 크게`
  모드 추가
- 대본 입력 textarea 는 집중 모드에서 크게 확장
- 출연자 카드 영역도 집중 모드에서 더 크게 보고 작업 가능

## 확인한 항목
- mp4Creater 관련 TS/TSX 구문 파싱 통과
- 샘플 manifest 생성 통과
- 샘플 레이아웃 체크 통과
- `_shared.ts` 직접 호출로 테스트 시
  - 프로젝트 폴더 생성됨
  - `studio-state.json` 은 summary 만 저장됨
  - `ensureState()` 는 full project 를 다시 읽음

## 참고
- 업로드 원본에 `package.json` 이 없어서 이 환경에서는 실제 `npm run build` 전체 런타임 빌드는 수행하지 못함
- 대신 문법 검증, 저장 구조 검증, state 요약/풀프로젝트 분리 흐름은 확인함
