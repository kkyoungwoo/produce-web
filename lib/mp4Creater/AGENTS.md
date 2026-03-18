# AGENTS.md for lib/mp4Creater

## 목적
이 폴더에서 작업하는 에이전트는 `mp4Creater`의 흐름을 깨지 않고, 필요한 파일만 읽고, 필요한 범위만 수정한다.

## 항상 먼저 읽기
1. `lib/mp4Creater/.ai/current-task.md`
2. `lib/mp4Creater/.ai/rules/edit-rules.md`
3. `lib/mp4Creater/.ai/rules/testing-rules.md`
4. `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
5. 필요한 경우 `lib/mp4Creater/ARCHITECTURE.md`
6. 필요한 경우 `lib/mp4Creater/.ai/context/*`

## 작업 원칙
- `mp4Creater` 수정 시 먼저 현재 작업 범위를 확인한다.
- 작업 범위 밖의 UI 전면 변경, 파일 이동, 대규모 리팩터링은 금지한다.
- `db-cleanup` 관련 영역은 사용자가 명시적으로 요청하지 않으면 건드리지 않는다.
- DB 관련 작업은 API 연동 관점만 유지하고, 기존 정리된 구조를 다시 흔들지 않는다.
- 샘플 자산과 실제 저장 결과물을 섞지 않는다.
- API 미연결 상태에서도 폴백/샘플 흐름이 유지되게 한다.
- `videoService.ts` 수정 시 자막, 해상도, 오디오 합성, 씬 길이 계산, 메모리 부담을 함께 확인한다.
- `localFileApi.ts`나 `app/api/local-storage/*` 수정 시 state shape 변경 여부를 기록한다.
- `types.ts`를 바꾸면 관련 컴포넌트/서비스를 반드시 같이 점검한다.

## 우선 점검 파일
### 화면 흐름
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`

### 상태/저장
- `lib/mp4Creater/types.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `app/api/local-storage/_shared.ts`
- `app/api/local-storage/state/route.ts`
- `app/api/local-storage/config/route.ts`

### 프롬프트/생성
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/scriptComposerService.ts`
- `lib/mp4Creater/services/geminiService.ts`
- `lib/mp4Creater/services/openRouterService.ts`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/videoService.ts`
- `lib/mp4Creater/services/falService.ts`

### 샘플 자산
- `public/mp4Creater/samples/*`
- `local-data/tubegen-studio/sample-library/*`
- `scripts/generate-mp4-sample-manifest.mjs`
- `scripts/check-mp4-sample-layout.mjs`

## 작업 후 필수 출력
- 수정한 파일 목록
- 왜 수정했는지
- 영향 범위
- 실행한 검증 명령
- 수동 확인 시나리오
- 남은 리스크
- PR 설명 초안
