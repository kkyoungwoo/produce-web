# testing-rules.md

## 기본 검증
- `npm run lint`
- 가능하면 `npm run build`
- 가능하면 `npx tsc --noEmit --pretty false`

## mp4Creater 수동 검증 최소 세트
1. `/mp4Creater` 진입 시 초기 화면이 blank screen 없이 로딩 skeleton 또는 실제 UI로 보이는지
2. 신규 프로젝트 시작 후 Step 1이 자연스럽게 열리고 Step 진행이 가능한지
3. API 키가 없어도 샘플/폴백 안내가 보이는지
4. 프로젝트 저장/불러오기/autosave가 유지되는지
5. `step-6` 진입 후 이미지/오디오/영상 생성 버튼 흐름이 끊기지 않는지 (`scene-studio`는 redirect/보조 경로)
6. `thumbnail-studio` 진입 후 썸네일 생성/선택 흐름이 끊기지 않는지
7. 저장 폴더 정보가 의도치 않게 초기화되지 않는지

## Step 3~5 / Thumbnail Studio 회귀 검증 (필수)
1. Step 3에서 대본 입력 후 출연자 미선택 상태로 `다음으로`를 누르면 출연자 선택 섹션으로 스크롤되는지
2. Step 3에서 선택한 출연자 id가 Step 4에 그대로 유지되는지
3. Step 4에서 캐릭터 느낌 카드 클릭 시 화면 상단으로 스크롤되는지
4. 이미 캐릭터 느낌이 저장된 프로젝트를 다시 열면 Step 3 다음 클릭 시 Step 4 출연자별 제작 영역으로 이어지는지
5. Step 4에는 선택된 출연자만 보이는지
6. Step 4 진입 시 기존 이미지가 있는 출연자는 첫 이미지가 자동 선택되는지
7. Step 4 진입 시 이미지가 없는 선택 출연자는 자동으로 첫 후보 생성이 시작되는지
8. Step 4 캐릭터 후보 UI에서 `+` 카드가 첫 칸에 있는지
9. 새 캐릭터 이미지 생성 시 새 카드가 오른쪽에 추가되고, 포인트가 새 카드 쪽으로 이동하는지
10. 좌우 화살표로 캐릭터 후보를 이동하며 선택할 수 있는지
11. Step 5 화풍 선택 시 새로고침처럼 보이는 무한 effect/깜빡임이 없는지
12. Project Gallery에서 프로젝트 이름 hover/focus/click 시 이름 위치에 `이름 변경` affordance가 보이는지
13. Project Gallery의 `썸네일 제작` 버튼이 `thumbnail-studio` 전용 페이지로 이동하는지
14. Thumbnail Studio에서 배경/주인공/썸네일 문구를 수정해 여러 개 생성할 수 있는지
15. Thumbnail Studio에서 최종 선택한 썸네일이 프로젝트 저장소 카드 대표 썸네일로 보이는지
16. 갤러리 진입/상세 진입/뒤로가기에서 브라우저 히스토리가 자연스럽게 동작하는지

## hydration/콘솔 에러 확인
- `In HTML, <button> cannot be a descendant of <button>` 오류가 없는지
- SSR/CSR 텍스트/속성 mismatch 경고가 없는지
- `Math.random()/Date.now()`로 인한 렌더 불일치가 없는지
- Step 5, Gallery, Thumbnail Studio에서 effect 루프 경고가 없는지

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
- `projects/<projectId>.json` 상세 저장 여부
- `/api/local-storage/project` GET fallback이 `projectIndex` 요약까지 자연스럽게 읽는지
- `thumbnail`, `thumbnailTitle`, `thumbnailPrompt`, `thumbnailHistory`, `selectedThumbnailId` 저장 여부
- IndexedDB 백업 유지 여부
- 새 프로젝트 / 기존 프로젝트 / query 기반 로드 흐름
- `storageDir` 미설정 상태에서 저장 시도 시 폴더 선택 안내가 뜨는지
- 첫 진입 / 새 프로젝트 생성 직후 loading route가 빈 화면을 만들지 않는지

## 결과 기록 형식
- 실행 명령
- 성공/실패
- 실패 원인
- 수동 검증 항목
- 남은 리스크
