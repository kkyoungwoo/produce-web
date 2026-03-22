# current-task.md

## 작업명
mp4Creater v3: 첫 진입/신규 생성 안정화 + Step 3 → Step 4 출연자 handoff 문서 기준

## 현재 우선순위
1. `/mp4Creater` 첫 진입과 새 프로젝트 생성 직후 blank screen이 다시 생기지 않게 유지한다.
2. 새 프로젝트 생성 시 저장 지연이 있어도 `step-1?projectId=...`가 즉시 열리도록 optimistic project + navigation cache + project API fallback 흐름을 유지한다.
3. Step 3에서 고른 출연자 id가 Step 4에서 그대로 유지되도록 한다.
4. Step 4에서는 선택된 출연자만 표시하고, 각 출연자별 대표 이미지 선택 흐름이 자동으로 시작되게 유지한다.
5. 문서와 테스트 규칙을 현재 코드 흐름에 맞춰 정리하고, 더 이상 사용하지 않는 폴더형 저장 구조 설명은 제거한다.

## 최신 반영 기준 (v3)

### 첫 진입 / 신규 생성 안정화
- `App.tsx`는 새 프로젝트 생성 시 optimistic project를 만들고 `rememberProjectNavigationProject()`로 먼저 세션 캐시에 넣는다.
- 가능한 경우 `upsertWorkflowProject()`로 실제 프로젝트를 먼저 저장하고, 실패하면 `saveStudioProject()` fallback을 시도한다.
- 둘 다 지연돼도 Step 1은 optimistic project 기준으로 먼저 열 수 있어야 한다.
- `app/[locale]/mp4Creater/loading.tsx`는 `null`이 아니라 skeleton 화면을 반환한다.
- `/api/local-storage/project` GET은 상세 JSON이 없으면 `projectIndex` 요약으로 한 번 더 복원한다.

### Step 3 → Step 4 출연자 handoff
- Step 4 이동 직전에는 현재 `selectedCharacterIds`를 우선 보존한다.
- 현재 추출 목록에 선택된 출연자가 없을 때만 `hydrateCharactersForScript({ preserveSelection: true })`를 다시 시도한다.
- `completeStage(3, 4)`에서 생성하는 navigation draft는 보존된 선택값을 그대로 `selectedCharacterIds`에 넣어 저장한다.

### Step 4 이미지 시작 규칙
- `Step4Panel.tsx`는 `selectedCharacterStyleId`가 있으면 바로 workspace로 열린다.
- workspace 진입 후 선택된 출연자에게 `selectedImageId`가 없고 기존 이미지가 있으면 첫 이미지를 자동 대표값으로 선택한다.
- 기존 이미지도 없으면 그 출연자만 첫 후보 이미지 생성을 자동 시작한다.
- Step 4에는 선택된 출연자만 렌더되고, 선택되지 않은 출연자는 이미지 제작 대상에서 제외된다.

### 저장 구조 기준
- 실제 저장 구조는 `storageDir/studio-state.json` + `storageDir/projects/<projectId>.json`이다.
- 예전의 `project-0001-프로젝트명/metadata/prompts/images/...` 폴더형 저장 규칙은 현재 런타임 기준이 아니다.
- 샘플 라이브러리 문서와 테스트 규칙도 이 저장 구조 기준으로 맞춰야 한다.

## 금지/주의 사항
- `mp4Creater` 외 다른 기능 수정 금지.
- 이미 안정화된 Step 4~6 UI를 불필요하게 다시 건드리지 않는다.
- 저장 구조를 예전 프로젝트 폴더형으로 되돌리지 않는다.
- 샘플 모드 결과를 AI 성공처럼 기록하지 않는다.
- 문서 업데이트는 현재 코드 흐름과 실제 반영 내용을 기준으로만 적는다.

## 검증 명령
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run lint`

## 수동 시나리오 체크
1. `/mp4Creater` 첫 진입 시 빈 화면 대신 skeleton 또는 실제 UI가 바로 보이는지
2. `제작하기`로 새 프로젝트 생성 시 blank screen 없이 Step 1이 열리는지
3. 새로고침 후에도 방금 만든 프로젝트가 `projectId` 기준으로 다시 열리는지
4. Step 3에서 선택한 출연자가 Step 4에 그대로 보이는지
5. Step 4 진입 직후 선택된 출연자별 첫 이미지 생성이 자동 시작되거나, 기존 첫 이미지가 자동 선택되는지
6. Step 5와 `step-6` 진입까지 `projectId` 쿼리가 유지되는지
