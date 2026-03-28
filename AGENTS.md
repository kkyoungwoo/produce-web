# 에이전트 공통 안내서

이 문서는 이 프로젝트를 수정하는 AI 작업자를 위한 공통 규칙이다.

## 1) 작업 원칙
- 항상 **최신 반영본 기준**으로 이어서 수정한다.
- 수정 범위는 **요청 범위로 최소화**한다.
- 정상 동작 중인 기존 기능은 건드리지 않는다.
- 관련 없는 리팩토링, 폴더 정리, 파일명 변경, 구조 변경, 포맷팅 정리 금지.
- 새 파일은 꼭 필요할 때만 만든다.
- 요청하지 않은 UI 변경 금지.
- 문제가 있어도 전체 재작성 대신 **국소 패치**를 우선한다.

## 2) MD 확인 규칙
사용자가 작업을 요청하면 먼저 아래 순서로 관련 문서를 찾는다.

1. **수정 대상 파일과 같은 폴더의 md**
2. **상위 폴더의 md**
3. 프로젝트 루트의 md
4. 요청과 직접 관련된 특정 가이드 md

## 3) mp4Creater 프롬프트 작업 시 핵심 경로
### 주요 파일 경로
- Step1~5 프롬프트 묶음: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- 역할별 final prompt 묶음 / rolePrompts 저장 구조: `lib/mp4Creater/services/workflowStepContractService.ts`
- Step2 추천/새로움 제어: `lib/mp4Creater/services/storyRecommendationService.ts`
- Step3 대본 생성 prompt / 긴 대본 분할 생성: `lib/mp4Creater/services/scriptComposerService.ts`
- Step3 실행 입력에 어떤 prompt/context를 붙일지: `lib/mp4Creater/components/InputSection.tsx`
- Step4 캐릭터 업로드/유사 재생성: `lib/mp4Creater/components/InputSection.tsx`, `lib/mp4Creater/services/characterStudioService.ts`
- Step6 씬별 이미지/영상 continuity prompt 조립: `lib/mp4Creater/services/sceneAssemblyService.ts`
- Step6 대사/이미지/영상 탭 AI 생성용 prompt template: `lib/mp4Creater/services/sceneEditorPromptService.ts`
- Step6 실제 이미지 생성 직전 최종 image prompt 가공: `lib/mp4Creater/services/imageService.ts`
- Step6 씬 이미지/영상 연결 및 영상 prompt handoff, 탭 AI 실행, 저장 반영: `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/components/ResultTable.tsx`
- 배경음 prompt: `lib/mp4Creater/services/musicService.ts`
- Thumbnail Studio 연결 / 썸네일 대표 prompt: `lib/mp4Creater/services/thumbnailService.ts`, `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`

### 관련 폴더 경로
- `lib/mp4Creater/services`
- `lib/mp4Creater/components`
- `lib/mp4Creater/pages`

### 프롬프트 수정 시 주의
- 프롬프트 문구만 바꿀지, 실제 실행 시 전달되는 context까지 바꿔야 할지 먼저 확인한다.
- 같은 단계라도 **prompt 작성 파일**과 **실행 시 주입 파일**이 다를 수 있으므로 둘 다 확인한다.
- Step6 계열은 이미지 prompt, 영상 prompt, continuity prompt, 탭 AI prompt가 서로 연결되므로 한 군데만 수정하지 말고 연결 흐름을 같이 본다.
- 썸네일, 음악, 씬, 대본은 각각 별도 서비스 파일에서 최종 prompt가 가공될 수 있으므로 공통 문구 수정 시 영향 범위를 확인한다.

## 4) 이번 프로젝트 유지 규칙
- 사용자가 고른 값으로 프롬프트가 자동 연결되어야 한다.
- 기본 동작은 항상 **새로운 추천 / 새로운 프롬프트 / 새로운 이미지 / 새로운 영상**이다.
- 사용자가 `비슷하게 재생성`을 누른 경우에만 선택된 기준 이미지, 썸네일, 프롬프트의 핵심 정체성을 유지한 근접 변형을 만든다.
- 썸네일 페이지도 Step처럼 **현재 프로젝트 기준 이미지 모델**을 따로 고를 수 있어야 하며, 이 값은 프로젝트 설정에 저장되어 이후 썸네일 생성에 우선 적용된다.
- 썸네일은 `샘플 모델 선택` 또는 `Google AI Studio 미연결`이면 샘플 경로로 생성하고, 실제 AI 응답이 성공한 경우에만 `ai` 결과와 비용 누적을 반영한다.
- 헤더 / 메인 저장된 프로젝트 요약 / 개별 프로젝트 카드에 보이는 비용은 모두 `API 생성비용` 기준이며, 프로젝트 `cost.total`과 전체 합계를 그대로 따라가야 한다.
- Step6 영상 프롬프트는 현재 이미지와 이전/다음 씬을 함께 참고해 자연스럽게 이어져야 한다.
- 대본 발화 구간은 영상 입모양과 맞는 문장 길이로 유지한다.
- 문단 설정의 `해당 내용 적용`은 현재 편집 중인 문단 내용 기준으로 이미지와 영상을 다시 생성하는 버튼이다.

## 5) 전달 원칙
- 이후 추가 수정도 항상 **직전 최신 수정본 기준**으로 덮어쓴다.
