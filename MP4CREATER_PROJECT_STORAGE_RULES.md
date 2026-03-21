# MP4CREATER Project Storage Rules

`mp4Creater`의 프로젝트 저장/복원 규칙을 한 문서로 고정합니다.
에이전트는 저장 흐름을 수정할 때 이 문서를 기준으로 회귀 여부를 판단합니다.

## 1) 저장 계층
- 1차: IndexedDB (`projects` store)
- 2차: `studio-state.json` 전역 인덱스 JSON (`/api/local-storage/state`)
- 3차: `projects/<projectId>.json` 프로젝트 상세 JSON (`/api/local-storage/project`)
- 보조: session cache (`projectNavigationCache`) for fast in-app route handoff

원칙:
- 로컬 우선(local-first) 조회를 먼저 시도하고, 필요 시 JSON 저장소 재조회로 보강합니다.
- 프로젝트별 폴더, 이미지/오디오/비디오 파일 분산 저장, 폴더 복제/삭제 동기화는 사용하지 않습니다.
- API 저장 실패가 나도 UI가 즉시 중단되지 않게 fallback 경로를 유지합니다.

## 2) 저장 구조
사용자 `storageDir` 아래에는 다음 구조만 유지합니다.

```text
storageDir/
  studio-state.json
  projects/
    <projectId>.json
```

`studio-state.json`에는 다음 데이터만 저장합니다.
- studio routing / provider 설정
- workflow draft
- project index summary

`projects/<projectId>.json`에는 다음 데이터를 저장합니다.
- 프로젝트 전체 상세 데이터
- 프롬프트, 썸네일, 씬 메타, 선택 상태
- assets / backgroundMusicTracks / previewMix / cost

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
  1. `saveStudioState` (workflow draft / studio 설정 저장)
  2. `updateProject` (프로젝트 단위 patch 저장)
- Step 이동 시에도 `projectId` 문맥을 유지하고, 이동 직전 draft patch 저장을 보장합니다.
- 프로젝트 변경은 폴더 sync가 아니라 인덱스 JSON + 프로젝트 상세 JSON 반영을 기준으로 합니다.
- autosave는 전체 목록 재저장이 아니라 현재 프로젝트 상세 JSON 한 개 갱신을 우선합니다.

## 6) 복원 규칙
- URL에 `projectId`가 있으면 local-first로 프로젝트를 읽고, 없으면 상세 JSON force sync로 보강합니다.
- 갤러리 목록은 인덱스 JSON만 읽고, 제작하기/복사/내보내기/불러오기는 필요 시 상세 JSON을 조회합니다.
- 상세보기/재진입은 "마지막 진행 step" 기준으로 열어야 합니다.
- 새로고침 후에도 마지막 단계와 주요 입력값(topic/script/prompt/선택값)이 유지되어야 합니다.

## 7) 복사/이름 규칙
- 복사 이름은 `<원본명> 복사(n)` 충돌 회피 규칙을 사용합니다.
- 프로젝트명 길이 제한:
  - 한글 포함: 공백 포함 30자
  - 영문 전용: 공백 포함 50자
- 복사 시 `workflowDraft`, `promptTemplates`, `promptPack`, 썸네일/씬 메타를 함께 deep clone 해야 합니다.

## 8) 썸네일/미디어 메타 규칙
- 카드 썸네일 우선순위:
  1. 최신 thumbnail history
  2. 첫 scene image
  3. fallback
- 복사 시 썸네일/미디어 프리뷰 메타는 함께 복제하되 project id/time/number는 새 값으로 갱신합니다.

## 9) 갤러리 규칙
- 썸네일 좌측 상단에 개별 선택 체크박스를 둡니다.
- 상단 헤더에는 전체 선택 체크박스를 둡니다.
- `가져오기` 버튼은 선택 여부와 무관하게 항상 노출합니다.
- `내보내기`, `삭제` 버튼은 선택 항목이 있을 때만 노출합니다.
- 카드 내부의 개별 삭제 버튼은 두지 않습니다.
- 선택 내보내기는 JSON 파일 하나로 다운로드합니다.

## 10) 라우팅 연계 규칙
- `?view=main`은 신규 진입점으로 사용하지 않습니다(갤러리로 리다이렉트).
- 최종 씬 제작은 `step-6` 경로를 기준으로 합니다.
- `scene-studio`는 레거시 호환 redirect 전용으로 유지합니다.

## 11) 금지/주의
- 저장 로직 변경 시 `projectService` 단독 변경으로 끝내지 않습니다.
  - `App.tsx`, `localFileApi.ts`, `/api/local-storage/state`, `ProjectGallery.tsx`를 함께 점검합니다.
- hydration 회귀를 유발하는 구조(`<button>` 중첩, SSR/CSR 텍스트 불일치)를 도입하지 않습니다.
- 프로젝트별 물리 폴더 생성/삭제/복사 로직을 다시 넣지 않습니다.

## 12) 최소 검증
- `npx tsc --noEmit --pretty false`
- `npm run build`
- 수동:
  1. 제작하기 → project 1개 생성
  2. step 이동/새로고침 후 데이터 유지
  3. 상세보기 재진입 시 마지막 step 복원
  4. 복사/삭제 후 목록 반응 속도 확인
  5. 선택 내보내기 / 가져오기 / 선택 삭제 확인
