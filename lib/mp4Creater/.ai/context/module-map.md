# module-map.md

## 상위 구조

### 진입/라우팅
- `app/[locale]/mp4Creater/page.tsx`
  - mp4Creater 메인 진입
- `app/[locale]/mp4Creater/scene-studio/page.tsx`
  - 씬 스튜디오 진입

### 메인 허브
- `lib/mp4Creater/App.tsx`
  - 신규 프로젝트
  - step workflow
  - 프로젝트 목록
  - autosave

### UI
- `lib/mp4Creater/components/Header.tsx`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`
- `lib/mp4Creater/components/SettingsDrawer.tsx`
- `lib/mp4Creater/components/ProviderQuickModal.tsx`
- `lib/mp4Creater/components/ResultTable.tsx`
- `lib/mp4Creater/components/StartupWizard.tsx`

### 페이지
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
- `lib/mp4Creater/pages/CharacterStudioPage.tsx`

### 상태/저장
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/services/projectService.ts`
- `lib/mp4Creater/services/folderPicker.ts`

### draft / prompt / scene assembly
- `lib/mp4Creater/services/workflowDraftService.ts`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/services/sceneAssemblyService.ts`
- `lib/mp4Creater/services/scriptComposerService.ts`

### provider / generation
- `lib/mp4Creater/services/geminiService.ts`
- `lib/mp4Creater/services/openRouterService.ts`
- `lib/mp4Creater/services/imageService.ts`
- `lib/mp4Creater/services/elevenLabsService.ts`
- `lib/mp4Creater/services/falService.ts`
- `lib/mp4Creater/services/videoService.ts`

### 타입/설정
- `lib/mp4Creater/types.ts`
- `lib/mp4Creater/config.ts`
- `lib/mp4Creater/config/workflowUi.ts`

### 샘플 자산
- `public/mp4Creater/samples/*`
- `local-data/tubegen-studio/sample-library/*`

### local-storage API
- `app/api/local-storage/_shared.ts`
- `app/api/local-storage/state/route.ts`
- `app/api/local-storage/config/route.ts`
