# MP4Creater Architecture

## 화면 축
1. 워크플로우 허브
   - 파일: `lib/mp4Creater/App.tsx`, `lib/mp4Creater/components/InputSection.tsx`
   - 역할: Step 1~5 진행, draft autosave, 프로젝트 진입/복원, gallery 진입/복귀
2. Scene Studio
   - 파일: `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/components/ResultTable.tsx`
   - 역할: 문단 단위 씬 카드 렌더, 이미지/오디오/영상 생성, 품질 선택 기반 최종 출력, CapCut 작업 패키지 export
3. Thumbnail Studio
   - 파일: `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`, `lib/mp4Creater/services/thumbnailService.ts`
   - 역할: 프로젝트의 대본/선택 캐릭터/화풍/장르/갈등/결말 톤을 바탕으로 대표 썸네일 후보를 여러 개 만들고 선택
4. Project Gallery
   - 파일: `lib/mp4Creater/components/ProjectGallery.tsx`
   - 역할: 프로젝트 목록, 이름 hover rename affordance, 프로젝트 상세 진입, 썸네일 제작 진입

## Step 흐름
1. Step 1: 콘셉트 선택
   - 내부 타입은 `music_video`, `story`, `news`, `info_delivery`를 사용하고 UI에서는 `뮤직비디오`, `이야기`, `영화`, `정보 전달`로 보입니다.
   - 콘셉트 변경 시 주제/대본/출연자/스타일과 함께 프로젝트 프롬프트도 해당 콘셉트 기본값으로 재초기화합니다.
2. Step 2: 주제 입력과 생성 옵션 설정
3. Step 3: 프로젝트 프롬프트 확인 → 최종 대본 생성/수정 → 출연자 선택
   - 대본이 있는데 출연자를 고르지 않은 상태로 다음을 누르면, 출연자 선택 영역으로 스크롤하며 다음 작업을 안내합니다.
4. Step 4: 캐릭터 느낌 선택 → 선택 출연자별 대표 이미지 확정
   - 느낌 선택 시 화면 최상단으로 스크롤합니다.
   - 이미 느낌이 저장된 프로젝트는 Step 3 다음 클릭 시 바로 출연자별 캐릭터 제작 구간으로 이어집니다.
   - 캐릭터 후보는 `+` 생성 카드가 첫 칸, 생성 결과는 오른쪽 누적, 좌우 화살표로 탐색하는 UI를 기준으로 합니다.
5. Step 5: 최종 영상 화풍 선택
   - 스타일 선택 상태 동기화는 불필요한 재렌더/새로고침 루프가 없도록 안정적으로 유지합니다.
6. 완료 즉시 `step-6` 자동 진입
7. 부가 흐름: `thumbnail-studio`
   - 갤러리의 `썸네일 제작` 버튼에서 진입합니다.
   - 대본, 선택된 캐릭터 대표 이미지, 화풍, 배경, 주인공, 썸네일 문구, 장르/갈등/결말 톤을 조합해 썸네일 프롬프트를 구성합니다.
   - 최종 선택한 썸네일은 프로젝트 저장소 썸네일로 저장합니다.

## 프롬프트 연결 원칙
- Step 1~5에서 정한 값은 최종 씬의 `visualPrompt`와 썸네일 프롬프트까지 이어져야 합니다.
- 씬 프롬프트는 최소한 다음 값을 직접 반영합니다.
  - `topic`
  - `contentType`
  - `aspectRatio`
  - `genre`
  - `mood`
  - `setting`
  - `protagonist`
  - `conflict`
  - `endingTone`
  - `storyPrompt`
  - `scenePrompt`
  - `actionPrompt`
  - 선택 캐릭터/스타일 프롬프트
- 문단별 씬은 이전/다음 문단 문맥을 함께 받아, 인접 장면이 비슷한 인물/배경/무드 결을 유지하도록 조립합니다.
- `info_delivery`는 이야기형과 분리된 전용 프롬프트 프로필을 사용합니다.

## 생성 파이프라인 원칙
- 기본 제작 흐름은 문단 단위(scene-by-scene)입니다.
- 이미지 생성은 초안 단계에서 토큰 소모를 줄이기 위해 샘플/저부하 흐름을 우선 사용할 수 있습니다.
- 실제 AI 결과와 샘플 결과는 `sourceMode`를 구분해 저장해야 하며, 샘플 이미지를 AI 생성처럼 기록하지 않습니다.
- 대본 장면 계획은 텍스트 API가 준비되어 있으면 실제 JSON 씬 프롬프트를 우선 사용하고, 없으면 로컬 폴백으로 내려갑니다.
- 영상 생성이 없어도 이미지 + 오디오 + 자막만으로 후반 편집을 이어갈 수 있어야 합니다.

## 결과물/내보내기 축
- 최종 출력은 `preview` / `final` 품질 모드를 지원합니다.
  - `preview`: 저화질/저비용 우선
  - `final`: 고화질 우선
- Scene Studio 결과 영역에서는 다음 내보내기 흐름을 유지합니다.
  - 문단별 자산 다운로드
  - 전체 SRT 다운로드
  - 이미지/영상 ZIP export
  - CapCut 작업 패키지 export
- CapCut 패키지는 브라우저에서 데스크톱 앱 자동 임포트까지는 보장하지 않고, 대신 초보자도 바로 가져다 쓸 수 있는 타임라인용 구조를 제공합니다.

## CapCut 패키지 구조
- `timeline_ready/`
  - 문단별로 바로 타임라인에 올리기 쉬운 클립
- `scenes/scene_001/ ...`
  - 문단별 원본 이미지/영상/오디오/자막 텍스트
- `subtitles/project_subtitles.srt`
  - 전체 자막 파일
- `audio/`, `background_music/`
  - 추가 작업용 오디오 자산
- `timeline_import_guide.csv`, `manifest.json`, `README.txt`, `capcut_links.txt`
  - 초보자용 가져오기 순서, 자산 인덱스, 다운로드/설치 안내

## 현재 중요 연결
- `workflowPromptBuilder.ts`: 콘셉트별 기본 프롬프트와 프롬프트 템플릿 구성
- `workflowDraftService.ts`: 프로젝트 복원 시 기본 프롬프트 선택값 보정
- `InputSection.tsx`: 콘셉트 변경 초기화, Step 완료 판정, 출연자 선택 보존, Step 3 안내 스크롤
- `thumbnailService.ts`: 썸네일용 프롬프트 구성과 샘플/폴백 결과 생성
- `geminiService.ts`: 문단 단위 씬 계획 생성, JSON 폴백 정규화
- `sceneAssemblyService.ts`: Step 값과 문단 연속성을 묶어 최종 씬 프롬프트 조립
- `imageService.ts`: 샘플 이미지 모델 판정과 저부하 기본 이미지 흐름
- `falService.ts`: image-to-video, data URL 업로드 fallback, 품질 모드 반영
- `ResultTable.tsx`: 품질 선택, 결과 다운로드, CapCut으로 보내기 버튼
- `exportService.ts`: ZIP export, CapCut 패키지 생성, CapCut 링크/가이드 포함
- `projectService.ts`, `localFileApi.ts`: `thumbnail`, `thumbnailTitle`, `thumbnailPrompt`, `thumbnailHistory`, `selectedThumbnailId` 계열 저장 경로

## 라우팅 원칙
- `step-1` ~ `step-6`, `thumbnail-studio` 이동 시 `projectId` 쿼리를 유지합니다.
- 내부 버튼은 브라우저 뒤로가기와 충돌하지 않도록 `push` 기반 이동을 우선 사용하고, 보정성 redirect만 `replace`를 사용합니다.
- `scene-studio`는 레거시 경로여도 완전히 끊지 말고, 정식 흐름인 `step-6`과 호환되게 유지합니다.
