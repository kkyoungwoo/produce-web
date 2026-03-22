# MP4CREATER index/detail split patch notes

이 문서는 현재 저장 구조의 요약 메모입니다.
현재 기준의 저장 구조 진실은 **`studio-state.json` + `projects/<projectId>.json` 분리 저장**입니다.

## 핵심 변경
- `studio-state.json`은 전역 설정 + `projectIndex`만 저장
- 각 프로젝트 전체 데이터는 `projects/<projectId>.json` 개별 파일로 저장
- 갤러리 목록은 요약본만 사용
- `제작하기` / 프로젝트 열기 / 복사 / 내보내기는 필요 시 상세 JSON 로드
- autosave는 현재 프로젝트 상세 JSON 한 개만 갱신

## 포함 파일
- `app/api/local-storage/_shared.ts`
- `app/api/local-storage/project/route.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/types.ts`
- `lib/mp4Creater/ARCHITECTURE.md`
- `MP4CREATER_PROJECT_STORAGE_RULES.md`

## 기대 효과
- 프로젝트가 많아도 갤러리 진입 시 전체 상세 JSON을 한 번에 다시 읽지 않음
- 복사/삭제/가져오기/내보내기 시 인덱스와 상세를 분리 처리
- autosave 때 전체 목록을 다시 저장하지 않아 체감 지연 완화

## 확인한 것
- 수정 파일들은 TypeScript transpile parse 기준으로 문법 오류 없이 통과
- 이 메모는 저장 구조 설명용 문서이며, 실제 규칙의 상세판은 `MP4CREATER_PROJECT_STORAGE_RULES.md`를 우선합니다.
