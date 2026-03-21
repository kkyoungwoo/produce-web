# MP4CREATER Change Log (2026-03-21)

## 핵심 변경
- 프로젝트 저장 구조를 프로젝트별 폴더 방식에서 `studio-state.json` 단일 JSON 저장소 방식으로 단순화했습니다.
- 갤러리에 개별 선택 체크박스, 전체 선택, 선택 내보내기(JSON), 선택 삭제, 항상 노출되는 가져오기 버튼을 추가했습니다.
- 카드 내부 삭제 버튼은 제거하고 상단 선택 삭제 흐름으로 통일했습니다.
- 생성/복사/삭제 후 불필요한 강제 재동기화를 줄여 체감 반응 속도를 개선했습니다.
- 초기 `local-data/tubegen-studio/studio-state.json`을 빈 상태로 재정리했습니다.

## 수정 파일
- `app/api/local-storage/_shared.ts`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/components/StartupWizard.tsx`
- `lib/mp4Creater/components/SettingsDrawer.tsx`
- `lib/mp4Creater/components/Header.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/ARCHITECTURE.md`
- `MP4CREATER_PROJECT_STORAGE_RULES.md`
- `local-data/tubegen-studio/studio-state.json`

## 제거한 불필요 항목
- `local-data/tubegen-studio/projects/`
- `local-data/tubegen-studio/project-folder-template/`

## 남겨둔 항목
- `local-data/tubegen-studio/sample-library/`
  - 로컬 샘플 자산과 관련 스크립트가 여전히 참조하므로 유지했습니다.
