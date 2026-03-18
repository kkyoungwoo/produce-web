# MP4Creater Architecture

## 1. 현재 구조 요약

`mp4Creater`는 크게 두 화면 축으로 움직입니다.

1. **워크플로우/프로젝트 진입 화면**
   - 파일: `lib/mp4Creater/App.tsx`
   - 역할:
     - 신규 프로젝트 시작
     - 워크플로우 Step 1~4 진행
     - 프로젝트 목록 보기
     - 현재 draft / 프로젝트 autosave

2. **씬 스튜디오 화면**
   - 파일: `lib/mp4Creater/pages/SceneStudioPage.tsx`
   - 역할:
     - 대본을 씬 단위로 분해
     - 이미지 / 오디오 / 영상 생성
     - 자막 / 배경음 / 최종 영상 렌더링
     - project asset autosave

## 2. 라우팅 구조

- `app/[locale]/mp4Creater/page.tsx`
  - `ClientOnlyApp` 렌더
- `lib/mp4Creater/App.tsx`
  - 메인 제작/프로젝트 허브
- `app/[locale]/mp4Creater/scene-studio/page.tsx`
  - `SceneStudioPage` 렌더
- `lib/mp4Creater/pages/CharacterStudioPage.tsx`
  - 캐릭터 중심 편집/선택 관련 페이지

## 3. 상태 저장 구조

### 브라우저 측
- `lib/mp4Creater/services/localFileApi.ts`
  - `/api/local-storage/*` 호출
  - localStorage 캐시 동기화
- `lib/mp4Creater/services/projectService.ts`
  - IndexedDB 백업
  - 저장 프로젝트 목록 유지

### 서버 측
- `app/api/local-storage/_shared.ts`
  - `studio-state.json` 스키마 정의
  - 기본 state 생성
  - 파일 저장 경로 계산
- `app/api/local-storage/state/route.ts`
  - state 읽기/쓰기
- `app/api/local-storage/config/route.ts`
  - storageDir 초기 설정

### 기본 저장 위치
- 기본값: `./local-data/tubegen-studio`
- state 파일: `local-data/tubegen-studio/studio-state.json`

## 4. 워크플로우 draft 구조

핵심 타입:
- `lib/mp4Creater/types.ts`
- `WorkflowDraft`
- `GeneratedAsset`
- `CharacterProfile`
- `PromptedImageAsset`

draft 생성/보정:
- `lib/mp4Creater/services/workflowDraftService.ts`

중요한 점:
- `WorkflowDraft`는 Step 1~4 진행 상태와 선택 결과를 잡고 있음
- `SceneStudioPage`는 이 draft를 바탕으로 실제 씬 asset 작업으로 넘어감
- 따라서 step UI를 바꾸면 draft shape와 씬 생성 로직까지 같이 봐야 함

## 5. 생성 파이프라인

### 텍스트/스토리
- `geminiService.ts`
- `openRouterService.ts`
- `scriptComposerService.ts`
- `workflowPromptBuilder.ts`

### 캐릭터/스타일/썸네일
- `characterStudioService.ts`
- `imageService.ts`
- `thumbnailService.ts`

### 오디오
- `elevenLabsService.ts`
- `musicService.ts`
- `srtService.ts`

### 비디오
- `videoService.ts`
- `falService.ts`

## 6. `videoService.ts`를 건드릴 때 꼭 확인할 것

`videoService.ts`는 아래가 서로 얽혀 있습니다.

- 씬 개수 기반 렌더 프로파일
- 비율별 width / height / fps / bitrate
- 이미지 씬 vs 영상 씬 처리
- 자막 청크 생성과 타이밍 유지
- 오디오 디코딩과 믹싱
- 최종 브라우저 렌더링 부하

따라서 여기 수정은 단일 함수만 보면 안 되고,
- `GeneratedAsset`
- `SubtitleData`
- `PreviewMixSettings`
- `SceneStudioPage.tsx`
- `falService.ts`
를 같이 봐야 합니다.

## 7. 샘플 자산 분리 원칙

### 공개 샘플
경로: `public/mp4Creater/samples/`

용도:
- UI 미리보기
- 고정 예시 카드
- 배포 가능한 샘플

### 로컬 개발 샘플
경로: `local-data/tubegen-studio/sample-library/`

용도:
- 개발/검수용 이미지, 영상, 오디오
- 실험용 파일
- 공개 배포에 넣지 않을 자산

### 실제 사용자 저장 결과물
경로: 사용자가 설정한 `storageDir`

용도:
- 실제 프로젝트 저장 결과
- 워크플로우 산출물
- 샘플 라이브러리와 분리 유지

## 8. 자주 흔들리는 변경 포인트

1. Step UI 순서 변경
   - `App.tsx`
   - `InputSection.tsx`
   - `workflowDraftService.ts`
   - `types.ts`
   - `SceneStudioPage.tsx`

2. 저장 폴더 / 저장 방식 변경
   - `folderPicker.ts`
   - `localFileApi.ts`
   - `app/api/local-storage/*`
   - `projectService.ts`

3. 프롬프트 구조 변경
   - `workflowPromptBuilder.ts`
   - `types.ts`
   - `InputSection.tsx`
   - 각 provider service

4. 영상 API 연결 변경
   - `videoService.ts`
   - `falService.ts`
   - `types.ts`
   - 설정 UI / provider registry

## 9. 추천 작업 방식

- 먼저 `current-task.md`에서 수정 범위 고정
- 그 다음 변경 유형에 맞는 파일만 읽기
- `types.ts` 변경은 가장 마지막에 하지 말고 초기에 확인
- API가 없을 때 샘플/폴백 동작이 유지되는지 수동 검증
- 저장/불러오기/autosave가 깨지지 않는지 같이 검증
