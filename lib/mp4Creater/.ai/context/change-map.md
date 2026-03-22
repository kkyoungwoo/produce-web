# change-map.md

## 1. Step 순서 / UI 흐름 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/types.ts`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`

## 2. 저장 폴더 / 저장 전략 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/services/folderPicker.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/services/projectService.ts`
- `app/api/local-storage/_shared.ts`
- `app/api/local-storage/state/route.ts`
- `app/api/local-storage/config/route.ts`
- `app/api/local-storage/project/route.ts`

핵심 포인트:
- 실제 저장 구조는 `studio-state.json` + `projects/<projectId>.json`
- `storageDir`가 비어 있어도 기본 저장 경로 fallback을 우선 고려
- 상세 JSON이 잠시 없어도 `projectIndex` 요약 fallback으로 첫 진입 복원 가능해야 함

## 3. prompt 구조 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/promptProfiles/*`
- `lib/mp4Creater/types.ts`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`

## 4. 이미지 생성 흐름 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/geminiService.ts`
- `lib/mp4Creater/services/characterStudioService.ts`
- `lib/mp4Creater/services/thumbnailService.ts`
- `lib/mp4Creater/types.ts`

## 5. 영상 API / 렌더링 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/services/videoService.ts`
- `lib/mp4Creater/services/falService.ts`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/types.ts`

## 6. project autosave / reload 이슈
반드시 같이 볼 파일:
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `app/api/local-storage/*`

핵심 포인트:
- 새 프로젝트 생성 시 optimistic project와 실제 저장 결과를 자연스럽게 치환
- first-entry blank screen을 막기 위해 로딩 skeleton과 navigation cache를 같이 확인
- query 기반 `projectId` 복원은 cache → localOnly → forceSync 순으로 점검

## 7. sample asset 추가/삭제
반드시 같이 볼 파일:
- `public/mp4Creater/samples/README.md`
- `public/mp4Creater/samples/project-folder-template/README.md`
- `scripts/generate-mp4-sample-manifest.mjs`
- `scripts/check-mp4-sample-layout.mjs`
- `lib/mp4Creater/.ai/rules/sample-asset-rules.md`

## 8. Gallery 생성/복사/삭제 성능/애니메이션 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/localFileApi.ts`

핵심 포인트:
- optimistic insert 후 실제 저장 결과로 치환
- 생성/복사 중 중복 클릭 잠금
- 스켈레톤과 실제 카드 레이아웃 동기화
- 삭제/정렬 애니메이션이 "저릿함" 없이 자연스럽게 동작해야 함
- 이름 변경 affordance는 프로젝트 이름 위치에 붙여 관리
- Gallery → 상세 → 뒤로가기 히스토리 흐름 유지

## 9. Step 라우팅/복원 규칙 변경
반드시 같이 볼 파일:
- `app/[locale]/mp4Creater/page.tsx`
- `app/[locale]/mp4Creater/loading.tsx`
- `app/[locale]/mp4Creater/step-1/page.tsx`
- `app/[locale]/mp4Creater/step-6/page.tsx`
- `app/[locale]/mp4Creater/scene-studio/page.tsx`
- `app/[locale]/mp4Creater/thumbnail-studio/page.tsx`
- `lib/mp4Creater/App.tsx`

핵심 포인트:
- `?view=main`은 사용 금지(서버 리다이렉트)
- Step 이동 시 `projectId` 쿼리 유지
- 최종 씬 제작은 `step-6` 기준
- `scene-studio`는 레거시 redirect/보조 진입으로만 유지
- 썸네일 제작은 `thumbnail-studio` 전용 페이지 기준
- 첫 진입/신규 생성 직후 loading route가 `null`을 반환하지 않도록 유지

## 10. hydration/SSR 회귀 대응
반드시 같이 볼 파일:
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/components/Header.tsx`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`

핵심 포인트:
- `<button>` 내부에 `<button>` 중첩 금지
- SSR/CSR 문자열 불일치(저장 폴더 상태, 난수/시간 기반 style) 방지
- client 전용 값은 hydration 이후에만 반영
- Step 5 / Thumbnail Studio에서 effect 루프가 생기지 않게 조건부 상태 갱신 유지

## 11. Step 3 / Step 4 캐릭터 UX 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/inputSection/views/RouteStepView.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx`
- `lib/mp4Creater/components/inputSection/steps/Step4Panel.tsx`

핵심 포인트:
- Step 3 대본 입력 후 출연자 미선택이면 Step 4로 넘어가지 않고 출연자 선택 영역으로 안내 스크롤
- Step 4 캐릭터 느낌 선택 시 상단 스크롤
- 복원된 프로젝트는 저장된 캐릭터 느낌 상태를 유지한 채 출연자별 제작 영역으로 바로 이어짐
- Step 4에는 선택된 출연자만 표시
- Step 4 workspace 진입 시 첫 이미지 자동 선택 또는 자동 첫 생성 시작
- 캐릭터 후보는 `+` 카드 선두, 새 카드 오른쪽 누적, 화살표 탐색, 생성 직후 포커스 이동

## 12. Thumbnail Studio / 대표 썸네일 저장 변경
반드시 같이 볼 파일:
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/services/thumbnailService.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/types.ts`

핵심 포인트:
- 프로젝트의 대본, 선택 캐릭터, 화풍을 썸네일 프롬프트에 반영
- 배경 / 주인공 / 썸네일 문구 직접 수정 가능
- 썸네일 여러 개 생성 및 유사 재생성 지원
- 최종 선택 썸네일이 갤러리 대표 썸네일로 반영
