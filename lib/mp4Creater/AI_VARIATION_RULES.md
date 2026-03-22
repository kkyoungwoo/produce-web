# MP4Creater AI Variation Rules

## 목적
- 기본값은 **새 결과**입니다.
- 사용자가 `비슷하게`, `같은 느낌`, `유사안`을 직접 요구한 경우에만 similarity 모드로 갑니다.
- 선택한 콘셉트, 주제, 출연자, 화풍, 비율은 유지하되 결과의 전개 / 샷 / 조명 / 자막 리듬 / 모션은 매번 새로 제안해야 합니다.

## 중앙 규칙 파일
- 코드 기준 파일: `lib/mp4Creater/config/creativeVariance.ts`
- 이 파일은 다음 항목을 한 곳에서 관리합니다.
  - fresh 기본 규칙
  - similarity 예외 규칙
  - generation signature
  - shot / camera / lighting / palette / subtitle rhythm 변주
  - sample gradient/theme 변주

## 적용 대상
- 대본 생성: `scriptComposerService.ts`
- 씬 계획 생성: `geminiService.ts`
- 씬 프롬프트 조립: `sceneAssemblyService.ts`
- 로컬 visual prompt / sample image: `storyHelpers.ts`
- 캐릭터/화풍 새 후보 생성: `characterStudioService.ts`
- 샘플 영상과 image-to-video motion prompt: `falService.ts`, `geminiService.ts`

## 유지해야 하는 원칙
- fresh 모드에서는 직전 시도와 같은 후킹 문장, 같은 장면 배치, 같은 샷 언어, 같은 자막 리듬, 같은 모션 문구를 그대로 반복하지 않습니다.
- continuity가 필요한 값은 유지합니다.
  - 선택 출연자 identity
  - 선택 화풍 방향
  - Step 1 콘셉트
  - 스토리의 앞뒤 문맥
- sample fallback도 정적인 한 장짜리 결과로 끝내지 않고, prompt seed 기준으로 매번 다른 결이 보이게 유지합니다.

## 구현 메모
- scene continuity와 fresh generation은 동시에 필요합니다.
- 따라서 `같은 프로젝트 = 같은 인물/화풍`, `같은 시도 = 같은 답안`이 아니라,
  `같은 프로젝트 안에서도 새 샷/새 아이디어` 원칙으로 해석합니다.
