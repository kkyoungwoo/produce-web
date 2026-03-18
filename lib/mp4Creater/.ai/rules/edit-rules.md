# edit-rules.md

## 기본
- 현재 작업과 직접 관련된 파일만 읽고 수정한다.
- 전체 구조를 한 번에 뒤집지 않는다.
- 기존 동작을 유지하는 작은 수정과 명시적 연결을 우선한다.

## `mp4Creater` 전용 규칙
- Step 흐름 수정 시 `App.tsx`, `InputSection.tsx`, `workflowDraftService.ts`, `types.ts`, `SceneStudioPage.tsx`를 같이 점검한다.
- prompt 구조 변경 시 `workflowPromptBuilder.ts`, `types.ts`, 생성 service를 같이 본다.
- provider/API 연동 변경 시 `localFileApi.ts`, `SettingsDrawer.tsx`, provider service, `types.ts`를 같이 본다.
- 저장 관련 변경 시 `folderPicker.ts`, `localFileApi.ts`, `projectService.ts`, `app/api/local-storage/*`를 같이 본다.
- 비디오 관련 변경 시 `videoService.ts` 단독 수정으로 끝내지 않는다.

## 수정 금지 기본선
- `db-cleanup` 재구성 금지
- unrelated UI 리디자인 금지
- 타입 이름을 이유 없이 전면 변경 금지
- state shape를 바꾸고도 문서/검증을 생략하는 행동 금지

## 권장 방식
- 서비스 로직은 서비스 파일에서 수정
- UI 상태는 컴포넌트/페이지에서 관리
- 공통 타입은 `types.ts`에서만 수정
- 기본값은 `localFileApi.ts`, `config.ts`, `workflowDraftService.ts` 중 책임이 맞는 곳에 둔다

## 변경 후 기록
반드시 아래를 남긴다.
- 왜 이 파일을 바꿨는지
- 어떤 사용자 플로우가 바뀌는지
- 어떤 플로우는 그대로인지
- 후속 확인이 필요한 부분
