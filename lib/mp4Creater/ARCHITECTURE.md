# MP4Creater Architecture

## 1. 화면 축

1. 워크플로우 허브
   - 파일: `lib/mp4Creater/App.tsx`, `lib/mp4Creater/components/InputSection.tsx`
   - 역할: Step 1~5 진행, draft autosave, 프로젝트 진입/복원

2. Scene Studio
   - 파일: `lib/mp4Creater/pages/SceneStudioPage.tsx`
   - 역할: 씬 카드 렌더, 이미지/오디오/영상 생성, 썸네일 생성/이력 관리, 결과 export

## 2. 라우팅 구조

- `app/[locale]/mp4Creater/step-1/page.tsx`
- `app/[locale]/mp4Creater/step-2/page.tsx`
- `app/[locale]/mp4Creater/step-3/page.tsx`
- `app/[locale]/mp4Creater/step-4/page.tsx`
- `app/[locale]/mp4Creater/step-5/page.tsx`
- `app/[locale]/mp4Creater/step-6/page.tsx`
- `app/[locale]/mp4Creater/scene-studio/page.tsx` (legacy redirect)

Step 5 완료 후에는 별도 중간 단계 없이 `step-6`으로 즉시 이동합니다.
`?view=main` 진입은 더 이상 직접 사용하지 않고 gallery로 리다이렉트합니다.

## 3. Step 흐름 (최신 기준)

1. Step 1: 초기 설정(콘텐츠 유형/비율)
2. Step 2: 콘텐츠 주제 입력 + 추천문장 클릭 즉시 반영
3. Step 3: 프롬프트 선택 → 추천 문구 추가(`promptAdditions`) → 최종 대본 생성
   - `프롬프트 보기` 모달은 기본 프롬프트를 프로젝트 전용 복사본으로 분기한 뒤 수정 저장합니다.
   - 기본 프롬프트 원본은 고정이며, 수정은 프로젝트 복사본에만 반영됩니다.
4. Step 4: 최종 대본 완료 후 캐릭터 카드 제작(주인공/조연/나레이터)
5. Step 5: 화풍 선택
6. 완료 즉시 `step-6`(Scene Studio) 자동 진입

## 4. 상태/저장 구조

핵심 타입
- `lib/mp4Creater/types.ts`
  - `WorkflowDraft`
  - `SavedProject`
  - `PromptedImageAsset`
  - `GeneratedAsset`

저장 서비스
- `lib/mp4Creater/services/workflowDraftService.ts`
  - draft 기본값/복원 보정
- `lib/mp4Creater/services/projectService.ts`
  - IndexedDB + 프로젝트 인덱스 JSON + 프로젝트 상세 JSON 동기화
  - 프로젝트 patch 반영 및 autosave 대상 통합
- `app/api/local-storage/_shared.ts`
  - 전역 인덱스(`studio-state.json`) read/write
  - 프로젝트 상세 JSON(`projects/<projectId>.json`) read/write
  - project number 정규화
  - client summary 직렬화

저장 원칙
- 프로젝트별 물리 폴더는 만들지 않습니다.
- 전역 설정/목록은 `studio-state.json` 하나로 관리합니다.
- 각 프로젝트의 프롬프트/씬/썸네일/에셋 상세는 `projects/<projectId>.json` 개별 파일로 분리합니다.
- 갤러리 목록은 인덱스 JSON만 읽고, 프로젝트 본문은 열 때만 개별 JSON을 읽습니다.
- 생성/복사/삭제/가져오기는 인덱스와 프로젝트 상세 JSON을 분리 갱신합니다.

autosave 범위(워크플로우 + 씬 연결 데이터)
- 콘텐츠 주제
- 프롬프트 선택값
- 추천 문구 추가값(`promptAdditions`)
- 최종 대본
- 캐릭터 카드(주인공/조연/나레이터) 및 선택 상태
- 화풍 선택값
- 썸네일 관련 데이터(`thumbnail`, `thumbnailHistory`, `selectedThumbnailId`, `thumbnailPrompt`)
- 씬 생성 연결 데이터(`assets`, `backgroundMusicTracks`, `previewMix`, `cost`)

## 5. 갤러리 UX

- `ProjectGallery.tsx`에서 프로젝트 카드를 렌더링합니다.
- 카드 좌측 상단에는 개별 선택 체크박스를 둡니다.
- 상단 헤더에는 전체 선택, 가져오기, 선택 내보내기, 선택 삭제 액션을 둡니다.
- 카드 내부 개별 삭제 버튼은 사용하지 않습니다.
- 개별 복사는 카드 우측 상단에서 수행합니다.

## 6. 썸네일 규칙

프로젝트 카드 표시 우선순위
1. 마지막에 생성된 썸네일(`thumbnailHistory` 최신 항목)
2. 첫 번째 씬 이미지
3. fallback 이미지

Scene Studio에서 썸네일은 다회 생성이 가능하며, 생성 이력에서 현재 대표 썸네일을 선택할 수 있습니다.

## 7. Scene Studio 로딩/성능

- `step-6` 진입 시 전체 자동 생성을 시작하지 않습니다.
- 프로젝트 진입 시 텍스트/메타 UI를 먼저 렌더링하고, 씬 카드는 빈 썸네일 상태로 먼저 표시합니다.
- 이미지 생성은 씬 카드의 `이미지 생성` 버튼 또는 `전체 이미지 생성` 버튼을 눌렀을 때만 시작합니다.
- 영상 생성은 해당 씬의 `이미지 + 비주얼 프롬프트`를 기준으로 씬별/일괄 처리합니다.
- 진행률은 퍼센트로 노출하고, 씬 단위 로딩 상태를 분리합니다.
- 미리보기는 요청 시 씬들을 합친 합본 영상(프리뷰 렌더)으로 표시합니다.
- 이미지/영상 생성 이력은 카드 단위로 관리해 필요한 범위만 확인합니다.

## 8. 주요 연계 파일

- `lib/mp4Creater/components/ProjectGallery.tsx` (프로젝트 목록/썸네일 표시)
- `lib/mp4Creater/services/thumbnailService.ts` (썸네일 프롬프트/샘플 생성)
- `lib/mp4Creater/services/sceneAssemblyService.ts` (draft 기반 씬 프롬프트 조립)
- `lib/mp4Creater/services/scriptComposerService.ts` (Step 3 최종 대본 생성)
- `lib/mp4Creater/services/projectNavigationCache.ts` (step/scene 이동 시 프로젝트 문맥 캐시)

## 2026-03 provider/fallback update
- OpenRouter handles text generation, recommendations, and prompt translation.
- ElevenLabs handles premium voice flows.
- qwen3-tts is exposed as the default free TTS choice and falls back to browser/sample audio internally.
- Scene Studio keeps working without API keys by using sample image/audio/video paths.
- Prompt files are split into `musicVideoPrompts.ts`, `storyPrompts.ts`, and `newsPrompts.ts`.

## 2026-03-21 storage/performance update
- 프로젝트 저장 구조를 프로젝트별 폴더 방식에서 단일 JSON 저장소 방식으로 단순화했습니다.
- 생성/복사/삭제 후 강한 force sync 의존을 줄여 갤러리 반응 속도를 높였습니다.
- 선택 내보내기 / 가져오기 / 선택 삭제 UX를 갤러리 헤더 액션으로 통합했습니다.

## 2026-03-21 index-detail split update
- `studio-state.json`은 전역 설정 + `projectIndex`만 보관합니다.
- 프로젝트 본문은 `local-data/tubegen-studio/projects/<projectId>.json`으로 분리했습니다.
- 갤러리는 요약본만 사용하고, 제작하기/복사/내보내기는 필요 시 상세 JSON을 로드합니다.
- 자동 저장은 전체 목록 재기록 대신 현재 프로젝트 상세 JSON 한 개만 갱신합니다.
