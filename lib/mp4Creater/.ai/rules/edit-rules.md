# edit-rules.md

## 기본
- 현재 작업과 직접 관련된 파일만 읽고 수정한다.
- 전체 구조를 한 번에 뒤집지 않는다.
- 기존 동작을 유지하는 작은 수정과 명시적 연결을 우선한다.
- 기능이 바뀌면 관련 MD도 같은 턴/같은 PR에서 함께 갱신한다.

## `mp4Creater` 전용 규칙
- Step 흐름 수정 시 `App.tsx`, `InputSection.tsx`, `workflowDraftService.ts`, `types.ts`, `SceneStudioPage.tsx`를 같이 점검한다.
- Step 3/4/5 UX 수정 시 `RouteStepView.tsx`, `Step3Panel.tsx`, `Step4Panel.tsx`, `Step5Panel.tsx`를 우선 묶어 확인한다.
- 썸네일 전용 흐름 수정 시 `ProjectGallery.tsx`, `ThumbnailStudioPage.tsx`, `thumbnailService.ts`, `projectService.ts`, `localFileApi.ts`, `types.ts`를 같이 본다.
- prompt 구조 변경 시 `workflowPromptBuilder.ts`, `types.ts`, 생성 service를 같이 본다.
- provider/API 연동 변경 시 `localFileApi.ts`, `SettingsDrawer.tsx`, provider service, `types.ts`를 같이 본다.
- 저장 관련 변경 시 `folderPicker.ts`, `localFileApi.ts`, `projectService.ts`, `app/api/local-storage/*`를 같이 본다.
- 비디오 관련 변경 시 `videoService.ts` 단독 수정으로 끝내지 않는다.
- Step/Studio 라우팅은 `projectId` 쿼리를 유지하는 방향으로 수정한다.
- `?view=main` 신규 사용/의존 코드를 추가하지 않는다.
- 최종 씬 제작 경로는 `step-6`, 썸네일 제작 경로는 `thumbnail-studio`를 기준으로 유지한다.

## 수정 금지 기본선
- `db-cleanup` 재구성 금지
- unrelated UI 리디자인 금지
- 타입 이름을 이유 없이 전면 변경 금지
- state shape를 바꾸고도 문서/검증을 생략하는 행동 금지
- hydration 위험 패턴 도입 금지 (`button` 중첩, SSR/CSR 불일치 문자열, 무분별한 랜덤 style)

## 권장 방식
- 서비스 로직은 서비스 파일에서 수정
- UI 상태는 컴포넌트/페이지에서 관리
- 공통 타입은 `types.ts`에서만 수정
- 기본값은 `localFileApi.ts`, `config.ts`, `workflowDraftService.ts` 중 책임이 맞는 곳에 둔다
- 생성/복사/삭제처럼 UX 체감이 큰 동작은 optimistic UI + 백그라운드 동기화를 우선한다.
- Step 입력값은 draft 저장과 project 저장 경로가 동시에 살아 있는지 확인한다.
- 캐릭터/썸네일 후보 UI는 `+` 카드 선두 배치, 새 생성본 오른쪽 누적, 선택 포커스 이동 규칙을 깨지 않는 방향으로 수정한다.

## 변경 후 기록
반드시 아래를 남긴다.
- 왜 이 파일을 바꿨는지
- 어떤 사용자 플로우가 바뀌는지
- 어떤 플로우는 그대로인지
- 후속 확인이 필요한 부분
