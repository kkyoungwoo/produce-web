# Task Playbooks

## 1) DB 생성/수정 플레이북
### 실행 절차
1. `content/db-products/ADD_PRODUCT_GUIDE.md`를 먼저 읽습니다.
2. 아래 파일에 역할별로 반영합니다.
   - 데이터: `content/db-products/products/<slug>.ts`
   - 등록: `content/db-products/products/index.ts`
   - 동작 설정: `components/workbench/product-config.ts`
   - 샘플: `components/workbench/samples.ts`
   - 라벨/상수: `components/workbench/constants.ts`
   - 포맷/매핑: `components/workbench/helpers.ts`
3. 메인 UI 레이아웃은 요청 시에만 변경합니다.

### 검증 절차
1. 샘플 키/형식이 실제 출력 스키마와 일치하는지 확인
2. `npm run build`
3. 결과 보고: 수정 파일 / 이유 / 영향 범위

## 2) mp4Creater 플레이북 (안정성 우선)
### 실행 절차
1. 먼저 읽기:
   - `lib/mp4Creater/AGENTS.md`
   - `lib/mp4Creater/.ai/current-task.md`
   - `lib/mp4Creater/.ai/rules/edit-rules.md`
   - `lib/mp4Creater/.ai/rules/testing-rules.md`
   - `MP4CREATER_PROJECT_STORAGE_RULES.md`
2. 변경 범위를 한 화면/한 서비스 단위로 고정
3. 고위험 파일 수정 시 연관 파일을 세트로 점검
   - `videoService.ts` <-> `SceneStudioPage.tsx` <-> `types.ts`
   - `localFileApi.ts` <-> `app/api/local-storage/*` <-> `projectService.ts`
   - `workflowPromptBuilder.ts` <-> `InputSection.tsx` <-> `types.ts`
4. 라우팅 규칙 확인
   - `?view=main` 신규 사용 금지
   - 최종 씬 제작은 `step-6`
   - step 라우팅 시 `projectId` 쿼리 유지

### 검증 절차
1. `npm run lint`
2. 가능하면 `npm run build`
3. 최소 수동 확인:
   - 프로젝트 시작/불러오기/autosave
   - API 키 없음 상태 폴백
   - step1~5 이동 후 `step-6` 진입
   - 생성/복사/삭제 중복 클릭 잠금
   - hydration 경고/콘솔 에러 없음
4. 저장 구조가 `MP4CREATER_PROJECT_STORAGE_RULES.md`와 일치하는지 확인

## 3) 문서/하네스 정리 플레이북
### 실행 절차
1. `AGENTS.md`는 짧은 목차만 유지
2. 상세 규칙은 `docs/agent/*` 또는 도메인 문서로 분리
3. 쓰지 않는 중복 문서는 정리

### 검증 절차
1. 링크/경로 오타 확인
2. 오래된 문서가 최신 규칙과 충돌하지 않는지 확인
3. 변경 내용을 `AGENTS.md`에서 바로 탐색 가능한지 확인


