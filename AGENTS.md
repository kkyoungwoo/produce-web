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
- Step1~5 프롬프트 묶음: `lib/mp4Creater/services/workflowPromptBuilder.ts`
- Step2 추천/새로움 제어: `lib/mp4Creater/services/storyRecommendationService.ts`
- Step4 캐릭터 업로드/유사 재생성: `lib/mp4Creater/components/InputSection.tsx`, `lib/mp4Creater/services/characterStudioService.ts`
- Step6 씬 이미지/영상 연결: `lib/mp4Creater/pages/SceneStudioPage.tsx`, `lib/mp4Creater/services/imageService.ts`, `lib/mp4Creater/components/ResultTable.tsx`
- Thumbnail Studio 연결: `lib/mp4Creater/services/thumbnailService.ts`, `lib/mp4Creater/pages/ThumbnailStudioPage.tsx`

## 4) 이번 프로젝트 유지 규칙
- 사용자가 고른 값으로 프롬프트가 자동 연결되어야 한다.
- 기본 동작은 항상 **새로운 추천/새로운 프롬프트/새로운 이미지/새로운 영상**이다.
- 사용자가 `비슷하게 재생성`을 누른 경우에만 선택된 기준 이미지/썸네일/프롬프트의 핵심 정체성을 유지한 근접 변형을 만든다.
- Step6 영상 프롬프트는 현재 이미지와 이전/다음 씬을 함께 참고해 자연스럽게 이어져야 한다.
- 대본 발화 구간은 영상 입모양과 맞는 문장 길이로 유지한다.
- 문단 설정의 `해당 내용 적용`은 현재 편집 중인 문단 내용 기준으로 이미지와 영상을 다시 생성하는 버튼이다.

## 5) 전달 원칙
- 이후 추가 수정도 항상 **직전 최신 수정본** 기준으로 덮어쓴다.
