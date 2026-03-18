# MP4Creater AI 작업 세팅 추가 파일 안내

이 압축 파일은 **기존 파일을 덮어쓰지 않고 추가만 하는 세트**입니다.  
repo 루트에 그대로 풀면 아래 경로로 파일이 들어가도록 구성했습니다.

## 이 세트가 해결하려는 문제

1. `mp4Creater`는 계속 변경되는 영역이라서, 에이전트가 어디를 읽고 어디를 건드려야 하는지 자주 흔들립니다.
2. 사진/영상 샘플이 앞으로 더 늘어날 가능성이 높아서, 개발용 샘플과 실제 저장 결과물을 섞지 않는 규칙이 필요합니다.
3. DB 쪽은 기본 정리가 끝났고 API 연동 위주로 유지하면 되지만, `mp4Creater`는 프롬프트 / API / 렌더링 / 저장 흐름이 계속 바뀔 수 있습니다.
4. 그래서 **문서 구조 + 샘플 관리 구조 + 체크 스크립트**를 같이 두는 것이 안전합니다.

## 적용 방법

1. 이 zip 파일을 **프로젝트 루트**에 풉니다.
2. 아래 순서로 읽습니다.
   - 루트 `AGENTS.md`
   - `lib/mp4Creater/AGENTS.md`
   - `lib/mp4Creater/.ai/current-task.md`
   - `lib/mp4Creater/ARCHITECTURE.md`
   - 필요한 경우 `lib/mp4Creater/.ai/context/*`
3. 샘플 자산을 추가/삭제한 뒤 아래 스크립트를 실행합니다.
   - `node scripts/generate-mp4-sample-manifest.mjs`
   - `node scripts/check-mp4-sample-layout.mjs`

## 샘플 자산 관리 원칙

### 1) 공개 샘플
경로: `public/mp4Creater/samples/`

- UI에서 바로 참조 가능한 샘플
- 예시 카드, 기본 미리보기, 문서용 데모 자산
- 배포 산출물에 포함되어도 괜찮은 파일만 둡니다

### 2) 로컬 개발 샘플
경로: `local-data/tubegen-studio/sample-library/`

- 개발/검수용 샘플
- 실제 사용자 저장 결과물과 분리
- 브라우저 표시용 고정 public 자산과 분리

### 3) 실제 저장 결과물
경로: 사용자가 선택한 `storageDir`

- 현재 코드 기준으로 실제 저장 상태는 `app/api/local-storage/*`와 `local-data/tubegen-studio/studio-state.json`을 통해 유지됩니다
- 이 결과물은 샘플 라이브러리에 다시 섞지 않습니다

## 특히 중요한 곳

`mp4Creater`에서 가장 민감한 곳은 아래입니다.

- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/videoService.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/folderPicker.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/types.ts`

특히 **`videoService.ts`와 씬 생성 흐름**, 그리고 **local storage / project sync / prompt workflow**는 같이 봐야 합니다.

## 추가된 파일 목록

### 루트
- `MP4CREATER_AI_SETUP_README.md`

### mp4Creater 전용 규칙/문서
- `lib/mp4Creater/AGENTS.md`
- `lib/mp4Creater/ARCHITECTURE.md`
- `lib/mp4Creater/.ai/current-task.md`
- `lib/mp4Creater/.ai/task-template.md`
- `lib/mp4Creater/.ai/rules/edit-rules.md`
- `lib/mp4Creater/.ai/rules/testing-rules.md`
- `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
- `lib/mp4Creater/.ai/context/module-map.md`
- `lib/mp4Creater/.ai/context/change-map.md`
- `lib/mp4Creater/.ai/templates/result-summary.md`
- `lib/mp4Creater/.ai/templates/pr-description.md`

### 샘플 자산 관리
- `public/mp4Creater/samples/README.md`
- `public/mp4Creater/samples/manifest.template.json`
- `public/mp4Creater/samples/images/.gitkeep`
- `public/mp4Creater/samples/videos/.gitkeep`
- `public/mp4Creater/samples/audio/.gitkeep`
- `public/mp4Creater/samples/characters/.gitkeep`
- `public/mp4Creater/samples/styles/.gitkeep`
- `public/mp4Creater/samples/thumbnails/.gitkeep`

### 로컬 개발 샘플 저장소
- `local-data/tubegen-studio/README.md`
- `local-data/tubegen-studio/sample-library/README.md`
- `local-data/tubegen-studio/sample-library/images/.gitkeep`
- `local-data/tubegen-studio/sample-library/videos/.gitkeep`
- `local-data/tubegen-studio/sample-library/audio/.gitkeep`
- `local-data/tubegen-studio/sample-library/characters/.gitkeep`
- `local-data/tubegen-studio/sample-library/styles/.gitkeep`

### 관리 스크립트
- `scripts/generate-mp4-sample-manifest.mjs`
- `scripts/check-mp4-sample-layout.mjs`

## 빠른 사용 순서

### 새 작업 시작
1. `lib/mp4Creater/.ai/current-task.md`를 현재 작업에 맞게 수정
2. 에이전트에게 아래 순서로 읽게 지시
   - 루트 `AGENTS.md`
   - `lib/mp4Creater/AGENTS.md`
   - `lib/mp4Creater/.ai/current-task.md`
3. 작업 후
   - `npm run lint`
   - 가능하면 `npm run build`
   - 결과 요약과 PR 설명을 템플릿에 맞춰 작성

### 샘플 추가/삭제
1. 파일을 `public/mp4Creater/samples/*` 또는 `local-data/tubegen-studio/sample-library/*`에 넣거나 제거
2. `node scripts/generate-mp4-sample-manifest.mjs`
3. `node scripts/check-mp4-sample-layout.mjs`
4. manifest와 경로가 의도대로 나왔는지 확인

## 주의

- 이 세트는 **추가 파일만** 만들었습니다
- 기존 코드 파일은 수정하지 않았습니다
- 현재 업로드된 압축 안에서는 별도의 `agent.ts` 파일을 찾지 못해서, 실제 분석 기준은 **기존 루트 `AGENTS.md` + `lib/mp4Creater` 코드 구조**였습니다
