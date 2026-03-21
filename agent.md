# agent.md

이 파일은 빠른 진입용 링크 문서입니다.
작업 시작 전에는 항상 `AGENTS.md`를 먼저 읽고, 그 다음 필요한 작업 전용 문서만 읽습니다.

## 시작 순서
1. `AGENTS.md`
2. `CLAUDE.md`
3. 작업 유형별 문서
   - DB: `content/db-products/ADD_PRODUCT_GUIDE.md`
   - mp4Creater: `lib/mp4Creater/AGENTS.md`
4. 세부 참조: `docs/agent/README.md`

## mp4Creater 핵심 원칙
- 사용자는 한국어로 작성해도 됩니다.
- AI로 보내는 프롬프트는 전송 직전에 영어로 번역합니다.
- 번역은 캐시를 우선 사용해 같은 문장에 토큰을 반복 소모하지 않습니다.
- 자막 분리, TTS 본문처럼 원문 보존이 필요한 입력은 번역하지 않습니다.
- 기능이 바뀌면 예전 참고 MD는 남겨두지 않고 최신 문서로 교체합니다.
- 썸네일 제작은 `scene-studio`에 임시로 섞지 말고 `thumbnail-studio` 전용 흐름으로 분리하는 문서를 우선 신뢰합니다.

## 자주 보는 파일
- Step 에이전트 맵: `lib/mp4Creater/agents/stepAgentRegistry.ts`
- 단계별 프롬프트: `lib/mp4Creater/prompts/workflow-agents/*`
- 샘플 카탈로그: `lib/mp4Creater/samples/presetCatalog.ts`
- 프롬프트 번역 레이어: `lib/mp4Creater/services/promptTranslationService.ts`
