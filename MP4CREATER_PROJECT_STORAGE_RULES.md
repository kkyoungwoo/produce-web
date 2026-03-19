# MP4CREATER Project Storage Rules

`mp4Creater`의 프로젝트 저장/복원 규칙을 한 문서로 고정합니다.
에이전트는 저장 흐름을 수정할 때 이 문서를 기준으로 회귀 여부를 판단합니다.

## 1) 저장 계층
- 1차: IndexedDB (`projects` store)
- 2차: `studio-state.json` (`/api/local-storage/state`)
- 보조: session cache (`projectNavigationCache`) for fast in-app route handoff

원칙:
- 로컬 우선(local-first) 조회를 먼저 시도하고, 필요 시 파일 동기화/재조회로 보강합니다.
- API 파일 저장 실패가 나도 UI가 즉시 중단되지 않게 fallback 경로를 유지합니다.

## 2) 프로젝트 폴더 구조
사용자 `storageDir` 아래에 다음 구조를 유지합니다.

```text
storageDir/
  studio-state.json
  projects/
    project-0001-<project-name>/
      project.json
      metadata/
      prompts/
      images/
      videos/
      audio/
      thumbnails/
      characters/
      styles/
```

## 3) 프로젝트 번호 규칙
- `projectNumber`는 기존 최대값 + 1 규칙으로 생성합니다.
- 중간 번호가 삭제되어도 재사용하지 않고, 중복 없는 증가 번호를 유지합니다.
- 복사 프로젝트도 새 번호를 부여합니다.

## 4) 신규 생성 규칙
- 생성 UX는 optimistic insert를 먼저 적용합니다.
- 저장 완료 후 optimistic 항목을 실제 프로젝트 데이터로 치환합니다.
- 생성 직후 step 진입 URL은 `step-1?projectId=<id>`를 기본으로 합니다.
- 생성 중에는 중복 생성/복사 클릭을 잠금 처리합니다.

## 5) 실시간 저장 규칙
- Step 편집은 다음 두 경로를 모두 유지해야 합니다.
  1. `saveStudioState` (workflow draft 캐시/파일 반영)
  2. `updateProject` (프로젝트 단위 patch 반영)
- step 이동 시에도 `projectId` 문맥을 유지하고, 이동 직전 draft patch 저장을 보장합니다.

## 6) 복원 규칙
- URL에 `projectId`가 있으면 local-first로 프로젝트를 읽고, 없으면 force sync로 보강합니다.
- 상세보기/재진입은 "마지막 진행 step" 기준으로 열어야 합니다.
- 새로고침 후에도 마지막 단계와 주요 입력값(topic/script/prompt/선택값)이 유지되어야 합니다.

## 7) 복사/이름 규칙
- 복사 이름은 `<원본명> 복사(n)` 충돌 회피 규칙을 사용합니다.
- 프로젝트명 길이 제한:
  - 한글 포함: 공백 포함 30자
  - 영문 전용: 공백 포함 50자

## 8) 썸네일/미디어 메타 규칙
- 카드 썸네일 우선순위:
  1. 최신 thumbnail history
  2. 첫 scene image
  3. fallback
- 복사 시 썸네일/미디어 프리뷰 메타는 함께 복제하되 project id/time/number는 새 값으로 갱신합니다.

## 9) 라우팅 연계 규칙
- `?view=main`은 신규 진입점으로 사용하지 않습니다(갤러리로 리다이렉트).
- 최종 씬 제작은 `step-6` 경로를 기준으로 합니다.
- `scene-studio`는 레거시 호환 redirect 전용으로 유지합니다.

## 10) 금지/주의
- 저장 로직 변경 시 `projectService` 단독 변경으로 끝내지 않습니다.
  - `App.tsx`, `localFileApi.ts`, `/api/local-storage/state`를 함께 점검합니다.
- hydration 회귀를 유발하는 구조(`<button>` 중첩, SSR/CSR 텍스트 불일치)를 도입하지 않습니다.

## 11) 최소 검증
- `npx tsc --noEmit --pretty false`
- `npm run build`
- 수동:
  1. 제작하기 → project 1개 생성
  2. step 이동/새로고침 후 데이터 유지
  3. 상세보기 재진입 시 마지막 step 복원
  4. 복사/삭제 후 목록 정렬/애니메이션 자연스러움 확인
