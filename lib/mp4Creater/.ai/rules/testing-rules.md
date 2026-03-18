# testing-rules.md

## 기본 검증
- `npm run lint`
- 가능하면 `npm run build`

## mp4Creater 수동 검증 최소 세트
1. `/mp4Creater` 진입 시 초기 화면이 깨지지 않는지
2. 신규 프로젝트 시작 후 step 진행이 가능한지
3. API 키가 없어도 샘플/폴백 안내가 보이는지
4. 프로젝트 저장/불러오기/autosave가 유지되는지
5. `scene-studio` 진입 후 이미지/오디오/영상 생성 버튼 흐름이 끊기지 않는지
6. 최종 렌더링 또는 샘플 영상 미리보기가 동작하는지
7. 저장 폴더 정보가 의도치 않게 초기화되지 않는지

## `videoService.ts` 수정 시 추가 확인
- 씬 수가 적을 때/많을 때 렌더 프로파일이 무리 없는지
- 자막이 깜빡이지 않는지
- 오디오가 완전히 사라지지 않는지
- 영상이 없고 이미지만 있을 때도 동작하는지
- 브라우저 탭이 멈출 정도의 과부하가 없는지

## prompt/API 수정 시 추가 확인
- API 연결 있음 / 없음 두 경우 모두 확인
- 프롬프트 수정 후 다시 덮어씌워지지 않는지
- built-in prompt와 custom prompt가 구분 유지되는지

## 저장 흐름 수정 시 추가 확인
- `studio-state.json` 스키마 호환성
- `projects/project-0001-*` 구조 생성 여부
- 프로젝트 번호가 UI와 폴더 이름에 동일하게 반영되는지
- 프로젝트별 `project.json`, `metadata/`, `prompts/`, `images/`, `videos/`, `audio/`, `thumbnails/`, `characters/`, `styles/` 저장 여부
- IndexedDB 백업 유지 여부
- 새 프로젝트 / 기존 프로젝트 / query 기반 로드 흐름
- `storageDir` 미설정 상태에서 저장 시도 시 폴더 선택 안내가 뜨는지

## 결과 기록 형식
- 실행 명령
- 성공/실패
- 실패 원인
- 수동 검증 항목
- 남은 리스크
