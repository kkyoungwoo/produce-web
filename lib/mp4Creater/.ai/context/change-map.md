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

## 7. sample asset 추가/삭제
반드시 같이 볼 파일:
- `public/mp4Creater/samples/README.md`
- `public/mp4Creater/samples/manifest.template.json`
- `scripts/generate-mp4-sample-manifest.mjs`
- `scripts/check-mp4-sample-layout.mjs`
- `lib/mp4Creater/.ai/rules/sample-asset-rules.md`
