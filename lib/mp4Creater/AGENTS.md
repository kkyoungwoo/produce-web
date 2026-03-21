# AGENTS.md for lib/mp4Creater

## 목적
이 문서는 `mp4Creater` 작업용 실행 목차입니다.
필요한 파일만 읽고, 작은 범위로 수정하고, 검증까지 끝내는 것을 기본으로 합니다.

## 시작 순서
1. 루트 `AGENTS.md`
2. 루트 `CLAUDE.md`
3. `lib/mp4Creater/.ai/current-task.md`
4. `lib/mp4Creater/.ai/rules/edit-rules.md`
5. `lib/mp4Creater/.ai/rules/testing-rules.md`
6. `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
7. 필요 시 `lib/mp4Creater/ARCHITECTURE.md`
8. 필요 시 `lib/mp4Creater/.ai/context/*`

## 현재 Step 기준 (v3 문서 기준)
1. Step 1: 콘셉트와 화면 비율 선택
   - 콘셉트는 `뮤직비디오 / 이야기 / 영화 / 정보 전달` 4개입니다.
   - 내부 타입은 `music_video / story / news / info_delivery`를 사용합니다.
   - 콘셉트를 바꾸면 프로젝트 프롬프트는 해당 콘셉트 기본 프롬프트로 재초기화합니다.
2. Step 2: 주제 입력과 생성 옵션 정리
3. Step 3: 프롬프트 확인 → 대본 생성/수정 → 출연자 선택
   - 대본이 채워진 상태에서 출연자 미선택으로 `다음으로`를 누르면, Step 4로 튀지 않고 출연자 선택 영역으로 스크롤 이동하며 안내합니다.
4. Step 4: 캐릭터 느낌 선택 → 선택 출연자별 대표 캐릭터 확정
   - 캐릭터 느낌 카드를 누르면 화면 상단으로 스크롤을 올립니다.
   - 이미 캐릭터 느낌이 저장돼 있는 프로젝트를 다시 열면, Step 3에서 `다음으로` 시 Step 4의 출연자별 제작 영역으로 바로 이어집니다.
   - 캐릭터 후보 카드에서는 `+` 생성 카드가 맨 앞에 있고, 새 생성본은 오른쪽으로 누적됩니다.
   - 좌우 화살표로 후보를 오가며 고를 수 있어야 하고, 새 이미지 생성 직후에는 새로 생긴 후보 쪽으로 포인트가 이동해야 합니다.
   - `재생성`은 완전 다른 캐릭터가 아니라 현재 이미지와 비슷한 느낌을 유지하는 방향을 뜻합니다.
5. Step 5: 최종 영상 화풍 선택
   - 불필요한 상태 동기화 루프로 새로고침처럼 보이는 현상이 없어야 합니다.
6. Step 6: Scene Studio 진입
   - 최종 씬 제작은 `step-6`이 정식 경로이고, `scene-studio`는 레거시/보조 진입으로만 취급합니다.
7. 부가 제작: `thumbnail-studio`
   - 프로젝트에 저장된 대본, 선택 캐릭터 이미지, 화풍을 바탕으로 썸네일을 여러 개 생성합니다.
   - 배경 / 주인공 / 썸네일 문구를 사용자가 조정할 수 있어야 하며, 문구는 직접 수정 가능합니다.
   - 최종 선택한 썸네일은 프로젝트 저장소 카드의 대표 썸네일로 반영됩니다.

## 구현 체크포인트
- Step 1 콘셉트 변경 시 기존 프로젝트 프롬프트 수정본을 유지하지 않습니다.
- Step 2/3 라우트 이동은 한 번 클릭으로 다음 단계로 넘어가야 합니다.
- Step 3 선택 출연자는 Step 4에서 그대로 이어져야 합니다.
- Step 4에서는 선택된 출연자만 이미지 제작 대상으로 표시합니다.
- 프로젝트 저장소에서 이름 변경은 별도 하단 버튼이 아니라 **프로젝트 이름 위치의 hover/focus/click affordance**로 보여야 합니다.
- 프로젝트 저장소의 `썸네일 제작`은 전용 페이지 진입 버튼으로 유지합니다.
- 브라우저 뒤로가기는 내부 `이전으로` 버튼과 충돌하지 않도록 `push` 기반 이동 흐름을 우선 확인합니다.

## 먼저 볼 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/inputSection/views/RouteStepView.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step4Panel.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step5Panel.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`
- `lib/mp4Creater/services/thumbnailService.ts`
