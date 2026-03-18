# current-task.md

## 작업명
mp4Creater 장기 유지보수 구조 정리 + 샘플 자산 분리 규칙 정착

## 현재 우선순위
1. `mp4Creater`에서 사진/영상 샘플을 별도로 관리할 수 있게 구조를 고정한다.
2. 개발자가 샘플을 쉽게 추가/삭제할 수 있게 경로와 규칙을 명확히 한다.
3. 에이전트가 `mp4Creater`를 수정할 때 읽어야 할 파일과 건드리면 안 되는 파일을 명확히 한다.
4. 특히 `videoService.ts`, prompt workflow, API 연동, storage 흐름은 항상 영향 범위를 같이 보게 만든다.

## 현재 상황
- DB 쪽은 기본 정리가 끝났고 API 연동 관점으로 유지하면 된다.
- `mp4Creater`는 앞으로도 계속 변경될 가능성이 높다.
- 특히 아래 영역은 자주 수정될 가능성이 높다.
  - prompt 구조
  - provider/API 연동
  - scene 생성 흐름
  - video render 흐름
  - 저장 폴더 / autosave / project sync

## 반드시 지킬 것
- 기존 기능을 깨는 광범위한 리팩터링 금지
- `db-cleanup`과 `workbench`는 명시적 요청 없으면 수정 금지
- 샘플 자산과 실제 저장 결과물 혼합 금지
- API 미연결 상태의 샘플 fallback 유지
- `types.ts` 변경 시 관련 사용처 동시 점검
- `videoService.ts` 수정 시 SceneStudioPage와 자막/오디오 흐름까지 같이 확인

## 읽어야 할 순서
1. 루트 `AGENTS.md`
2. `lib/mp4Creater/AGENTS.md`
3. `lib/mp4Creater/.ai/rules/edit-rules.md`
4. `lib/mp4Creater/.ai/rules/testing-rules.md`
5. `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
6. 필요 시 `lib/mp4Creater/ARCHITECTURE.md`
7. 필요 시 `lib/mp4Creater/.ai/context/*`

## 샘플 자산 경로
### 공개 샘플
- `public/mp4Creater/samples/characters/`
- `public/mp4Creater/samples/styles/`
- `public/mp4Creater/samples/images/`
- `public/mp4Creater/samples/videos/`
- `public/mp4Creater/samples/audio/`
- `public/mp4Creater/samples/thumbnails/`

### 로컬 개발 샘플
- `local-data/tubegen-studio/sample-library/characters/`
- `local-data/tubegen-studio/sample-library/styles/`
- `local-data/tubegen-studio/sample-library/images/`
- `local-data/tubegen-studio/sample-library/videos/`
- `local-data/tubegen-studio/sample-library/audio/`

## 완료 조건
- 에이전트가 `mp4Creater` 수정 시 읽어야 할 경로가 명확해야 한다.
- 샘플 추가/삭제 규칙이 문서화되어 있어야 한다.
- manifest/check 스크립트로 샘플 구조를 검증할 수 있어야 한다.
- 결과 보고 포맷과 PR 설명 포맷이 고정되어 있어야 한다.
