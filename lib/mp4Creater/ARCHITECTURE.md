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
  - IndexedDB + studio-state 동기화
  - 프로젝트 patch 반영 및 autosave 대상 통합

autosave 범위(워크플로우 + 씬 연결 데이터)
- 콘텐츠 주제
- 프롬프트 선택값
- 추천 문구 추가값(`promptAdditions`)
- 최종 대본
- 캐릭터 카드(주인공/조연/나레이터) 및 선택 상태
- 화풍 선택값
- 썸네일 관련 데이터(`thumbnail`, `thumbnailHistory`, `selectedThumbnailId`, `thumbnailPrompt`)
- 씬 생성 연결 데이터(`assets`, `backgroundMusicTracks`, `previewMix`, `cost`)

## 5. 썸네일 규칙

프로젝트 카드 표시 우선순위
1. 마지막에 생성된 썸네일(`thumbnailHistory` 최신 항목)
2. 첫 번째 씬 이미지
3. fallback 이미지

Scene Studio에서 썸네일은 다회 생성이 가능하며, 생성 이력에서 현재 대표 썸네일을 선택할 수 있습니다.

## 6. Scene Studio 로딩/성능

- 프로젝트 진입 시 텍스트/메타 UI를 먼저 렌더링합니다.
- 무거운 이미지 생성은 씬 카드 영역에서 자동 시작하며, 전체 화면을 막지 않습니다.
- 진행률은 퍼센트로 노출하고, 씬 단위 로딩 상태를 분리합니다.
- 이미지/영상 생성 이력은 카드 단위로 관리해 필요한 범위만 확인합니다.

## 7. 주요 연계 파일

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

## 2026-03-20 persistence/performance update
- 신규 프로젝트 생성은 optimistic UI로 즉시 반영한 뒤 저장 결과로 치환합니다.
- Step 이동 URL에 `projectId`를 유지해 스텝 간 데이터 문맥이 끊기지 않게 유지합니다.
- draft 저장과 project 저장을 동시에 유지하는 실시간 동기화 경로를 사용합니다.
- project 목록/상세 로딩은 local-first 경로를 우선해 체감 지연을 줄입니다.
