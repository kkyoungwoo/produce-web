# mp4Creater Development Guide

## 먼저 확인할 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/components/ResultTable.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`
- `lib/mp4Creater/services/geminiService.ts`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`
- `lib/mp4Creater/services/exportService.ts`
- `lib/mp4Creater/services/falService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/workflowDraftService.ts`

## Step 규칙
### Step 1
- 콘셉트는 `뮤직비디오 / 이야기 / 영화 / 정보 전달` 4개입니다.
- 내부 값은 `music_video / story / news / info_delivery`를 사용합니다.
- 콘셉트를 바꾸면 프로젝트 프롬프트도 해당 콘셉트 기본 프롬프트로 다시 시작해야 합니다.

### Step 2
- 주제 입력과 생성 옵션만 다룹니다.
- 다음 버튼은 정상 상태라면 한 번 클릭으로 Step 3으로 넘어가야 합니다.

### Step 3
- 프롬프트 확인 → 대본 생성/수정 → 출연자 선택 순서를 유지합니다.
- 출연자 카드는 토글 방식입니다.
- 재추출 시 기존 선택 출연자는 이름/역할 기준으로 가능한 한 보존합니다.
- 대본이 이미 있는데 출연자를 선택하지 않은 상태에서 `다음으로`를 누르면, 출연자 선택 영역으로 스크롤하며 자연스럽게 다음 행동을 안내해야 합니다.

### Step 4
- Step3에서 선택한 출연자만 표시합니다.
- 캐릭터 느낌 카드를 누르면 화면 상단으로 스크롤합니다.
- 이미 캐릭터 느낌이 저장된 프로젝트는 Step 3에서 Step 4의 출연자별 제작 영역으로 바로 이어져야 합니다.
- 각 선택 출연자는 대표 이미지가 있어야 다음 단계로 넘어갑니다.
- 캐릭터 후보 UI는 다음 원칙을 유지합니다.
  - `+` 이미지 생성 카드가 첫 번째
  - 새 생성본은 오른쪽으로 누적
  - 좌우 화살표는 카드 좌우에서 후보 탐색용으로 동작
  - 새 생성 직후 새 카드가 보이는 방향으로 포인트 이동
  - `재생성`은 현재 이미지와 비슷한 느낌 유지

### Step 5
- 스타일 선택 후 상태 동기화가 반복 루프를 만들지 않아야 합니다.
- 새로고침처럼 보이는 재마운트/깜빡임이 생기면 state effect 조건을 먼저 점검합니다.

### Step 6 / Scene Studio
- 최종 씬 제작은 `step-6`이 기준 경로입니다.
- `scene-studio`는 레거시 또는 보조 진입으로 취급합니다.
- 씬은 문단 단위로 생성합니다.
- 문단별 프롬프트는 서로 이어져 보여야 하므로, 이전/다음 문단 문맥을 포함해 조립하는 쪽을 우선합니다.
- 영상이 없더라도 이미지/오디오/자막만으로 작업을 계속할 수 있어야 합니다.

### Thumbnail Studio
- 별도 페이지에서 프로젝트의 대본, 선택 캐릭터 이미지, 화풍을 기준으로 썸네일을 생성합니다.
- 사용자는 배경, 주인공, 썸네일 문구를 수정할 수 있어야 합니다.
- 썸네일 프롬프트는 대본 외에도 `genre`, `conflict`, `endingTone`, 프로젝트 프롬프트 맥락을 직접 반영해야 합니다.
- 최종 선택한 썸네일은 프로젝트 저장소 카드 대표 썸네일로 반영돼야 합니다.

## 생성/비용 규칙
- 초안 단계에서는 토큰 절감을 위해 샘플/저부하 이미지 흐름을 허용합니다.
- 샘플 결과는 반드시 `sample`로 기록하고, AI 결과와 비용 계산을 섞지 않습니다.
- 고화질 생성은 최종 출력 시점에만 선택적으로 사용합니다.
- 최종 출력 품질은 `preview`(저화질) / `final`(고화질) 두 모드를 유지합니다.
- 이미지 생성 모델, 텍스트 모델, 영상 모델이 비어 있으면 가능한 fallback을 먼저 시도하되, 사용자를 속이는 가짜 AI 성공 상태는 만들지 않습니다.

## 프롬프트 규칙
- 모든 Step 값은 최종 영상 프롬프트와 썸네일 프롬프트에 최대한 직접 연결합니다.
- `music_video`, `story`, `news(영화)`, `info_delivery` 각각의 차이가 실제 scene prompt에서 드러나야 합니다.
- 특히 `info_delivery`는 이야기형 prompt 재사용으로 끝내지 말고, 설명형/비교형/콜아웃 중심 구성을 유지합니다.
- `sceneAssemblyService.ts`를 건드릴 때는 연속성, 동일 인물 유지, 배경 유지, 무드 유지 규칙이 깨지지 않는지 먼저 점검합니다.

## CapCut 내보내기 규칙
- 결과 영역에는 `CapCut으로 보내기` 흐름을 유지합니다.
- 내보내기 ZIP에는 최소 다음 항목이 있어야 합니다.
  - `timeline_ready/` 문단별 타임라인용 클립
  - `scenes/scene_001/ ...` 문단별 원본 자산
  - `subtitles/project_subtitles.srt`
  - `timeline_import_guide.csv`
  - `manifest.json`
  - `README.txt`
  - `capcut_links.txt`
- 브라우저에서 CapCut 데스크톱 설치 여부를 신뢰성 있게 판별하거나, 데스크톱 앱에 외부 프로젝트를 자동 임포트하는 방식은 전제로 두지 않습니다.
- 가능한 범위는 ZIP 저장 + CapCut 편집기 열기 + 초보자용 가져오기 안내까지입니다.

## 검증
- 콘셉트 변경 후 프롬프트 초기화 여부
- Step 2/3 다음 버튼 1회 동작 여부
- Step 3 출연자 선택 안내 스크롤 여부
- Step 4 캐릭터 느낌 선택 후 상단 스크롤 여부
- Step 4 새 캐릭터 생성 후 새 카드 포커스 이동 여부
- Step 5 선택 시 새로고침 루프/깜빡임 여부
- 문단별 씬 프롬프트에 장르/분위기/배경/갈등/결말 톤이 반영되는지 확인
- 샘플 이미지 생성 시 `sourceMode: sample`로 기록되는지 확인
- Thumbnail Studio에서 여러 썸네일 생성/선택 후 갤러리 대표 썸네일 반영 여부
- 최종 출력 품질 `preview/final` 선택 동작 여부
- 영상이 없는 프로젝트도 CapCut ZIP 생성 가능 여부
- CapCut ZIP 안에 씬 순서와 자막 파일이 빠짐없이 들어가는지 확인
