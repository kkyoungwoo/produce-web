# MP4CREATER Change Log (2026-03-21)

## 핵심 변경
- 프로젝트 저장 구조를 프로젝트별 폴더 방식에서 `studio-state.json` 단일 JSON 저장소 방식으로 단순화했습니다.
- 갤러리에 개별 선택 체크박스, 전체 선택, 선택 내보내기(JSON), 선택 삭제, 항상 노출되는 가져오기 버튼을 추가했습니다.
- 카드 내부 삭제 버튼은 제거하고 상단 선택 삭제 흐름으로 통일했습니다.
- 생성/복사/삭제 후 불필요한 강제 재동기화를 줄여 체감 반응 속도를 개선했습니다.
- 초기 `local-data/tubegen-studio/studio-state.json`을 빈 상태로 재정리했습니다.

## 추가 반영 사항 (최신 동작 기준 문서 동기화)
- Step 1~5에서 정한 값이 최종 씬 프롬프트와 썸네일 프롬프트까지 직접 이어지도록 구조를 정리했습니다.
- 문단 단위 씬 제작 기준을 강화해, 이전/다음 문단 맥락을 반영하는 연속형 scene prompt 조립 흐름을 반영했습니다.
- `info_delivery` 전용 scene prompt profile을 별도로 두는 구조를 문서에 반영했습니다.
- 샘플/저부하 이미지 흐름과 실제 AI 생성 흐름의 `sourceMode` 구분 원칙을 문서에 반영했습니다.
- 최종 출력 품질을 `preview` / `final`로 다루는 흐름과, 영상이 없어도 이미지/오디오/자막 기반 후반 작업을 이어갈 수 있는 구조를 정리했습니다.
- CapCut 작업 패키지 export 구조를 문서에 반영했습니다.
  - `timeline_ready/`
  - `scenes/scene_001/...`
  - `subtitles/project_subtitles.srt`
  - `timeline_import_guide.csv`
  - `manifest.json`
  - `README.txt`
  - `capcut_links.txt`
- 브라우저에서 CapCut 데스크톱 설치 여부 확인 및 외부 프로젝트 자동 임포트는 전제로 두지 않고, ZIP 저장 + 편집기 열기 + 가져오기 안내를 기준 흐름으로 정리했습니다.

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
- `lib/mp4Creater/DEVELOPMENT_GUIDE.md`
- `MP4CREATER_PROJECT_STORAGE_RULES.md`
- `local-data/tubegen-studio/studio-state.json`

## 제거한 불필요 항목
- `local-data/tubegen-studio/projects/`
- `local-data/tubegen-studio/project-folder-template/`

## 남겨둔 항목
- `local-data/tubegen-studio/sample-library/`
  - 로컬 샘플 자산과 관련 스크립트가 여전히 참조하므로 유지했습니다.
