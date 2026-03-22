# AGENTS.md (produce-web)

이 문서는 백과사전이 아니라 **작업 목차(Entry Map)** 입니다.  
큰 문서를 한 번에 읽지 말고, 작업 파일에 맞는 문서만 순서대로 읽습니다.

## 1) 공통 골든 룰
- DB 상품 작업 전에는 반드시 `content/db-products/ADD_PRODUCT_GUIDE.md`를 먼저 읽습니다.
- `mp4Creater` 작업 전에는 반드시 `lib/mp4Creater/AGENTS.md`와 `lib/mp4Creater/.ai/current-task.md`를 먼저 읽습니다.
- 토큰 최적화 운영은 `CLAUDE.md`의 컨텍스트/질문 전략을 우선 적용합니다.
- 사용자가 요청하지 않은 UI 레이아웃/디자인은 변경하지 않습니다.
- 코드 변경은 역할별로 분리합니다: UI / 로직 / 텍스트 / 상품 데이터.
- 상품별 예외 처리는 컴포넌트 분기보다 설정(`components/workbench/product-config.ts`)을 우선합니다.
- 불확실하면 범위를 줄여 작은 변경으로 진행하고, 영향 파일을 명시합니다.
- `mp4Creater`의 사용자 입력은 한국어를 기본으로 유지하되, AI로 보내는 프롬프트는 전송 직전에 영어로 번역합니다.
- 자막 분리, TTS 본문처럼 원문 보존이 필요한 입력은 번역하지 않습니다.
- 기능이 바뀌면 관련 MD도 같은 작업에서 함께 갱신하고, 과거 기준 설명은 남겨두지 않습니다.

## 2) 인코딩 룰 (필수)
- `.ts`, `.tsx`, `.js`, `.json`, `.css`, `.md`는 UTF-8(권장: BOM 없음)으로 저장합니다.
- ANSI/EUC-KR/CP949 저장은 금지합니다.
- 한글 깨짐(모지바케) 발견 시 로직을 바꾸지 말고 인코딩/문자열만 복구합니다.

## 3) 작업별 읽기 순서
### A. DB 생성/워크벤치 작업
1. `content/db-products/ADD_PRODUCT_GUIDE.md`
2. `docs/agent/task-playbooks.md` (DB 섹션)
3. `docs/agent/file-reference-map.md` (DB 표)

### B. mp4Creater 작업
1. `lib/mp4Creater/AGENTS.md`
2. `lib/mp4Creater/.ai/current-task.md`
3. `lib/mp4Creater/.ai/rules/edit-rules.md`
4. `lib/mp4Creater/.ai/rules/testing-rules.md`
5. `lib/mp4Creater/ARCHITECTURE.md`
6. `docs/agent/task-playbooks.md` (mp4Creater 섹션)

### C. 공통/운영 하네스 작업
1. `docs/agent/README.md`
2. `docs/agent/harness-operating-model.md`
3. `docs/agent/file-reference-map.md`

## 4) 파일별 빠른 문서 맵
상세판은 `docs/agent/file-reference-map.md`를 사용합니다.

| 작업 파일 | 먼저 읽을 문서 |
|---|---|
| `content/db-products/products/<slug>.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` |
| `components/workbench/product-config.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md`, `docs/agent/task-playbooks.md` |
| `components/workbench/samples.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md`, `docs/agent/task-playbooks.md` |
| `components/workbench/constants.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` |
| `lib/mp4Creater/components/ProjectGallery.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/current-task.md`, `lib/mp4Creater/.ai/context/change-map.md` |
| `lib/mp4Creater/pages/ThumbnailStudioPage.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/ARCHITECTURE.md`, `lib/mp4Creater/.ai/rules/testing-rules.md` |
| `lib/mp4Creater/services/thumbnailService.ts` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/context/change-map.md`, `lib/mp4Creater/.ai/rules/testing-rules.md` |
| `lib/mp4Creater/services/videoService.ts` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/ARCHITECTURE.md`, `lib/mp4Creater/.ai/rules/testing-rules.md` |
| `lib/mp4Creater/services/workflowPromptBuilder.ts` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/context/change-map.md` |
| `app/api/local-storage/*` | `lib/mp4Creater/AGENTS.md`, `MP4CREATER_PROJECT_STORAGE_RULES.md` |

## 5) 문서 정리 원칙 (Entropy Control)
- 오래된/중복 문서는 제거하고, 살아있는 문서만 유지합니다.
- 기능이 업데이트되면 과거 기준의 MD는 남겨두지 말고 삭제하거나 새 문서로 대체합니다.
- 같은 주제를 설명하는 MD가 2개 이상 생기면 최신 기준 문서 1개만 남기고 나머지는 정리합니다.
- 규칙이 바뀌면 코드와 문서를 같은 PR에서 함께 갱신합니다.
- 에이전트 품질 목표: 짧은 지시 + 정확한 경로 + 검증 가능한 체크리스트.

## 6) 결과 보고 기본 형식
- 수정 파일 목록
- 변경 이유
- 영향 범위
- 실행한 검증 명령(`lint`, `build`, 수동 시나리오)
- 남은 리스크(있다면)

## 7) 구현 에이전트 운영 기준 (추가)
- 구현 에이전트 기본 운영 문서는 `docs/agent/IMPLEMENTATION_AGENT_RULES.md`를 기준으로 합니다.
- 기본 동작은 **짧은 계획 + 최소 파일 수정 + hook 결과 기반 수정**입니다.
- 보안/정형 검사는 대화 체크리스트가 아니라 **bash hook 우선**으로 처리합니다.
- `mp4Creater` 변경 시 `step-3 ↔ step-4 ↔ step-5 ↔ step-6 ↔ thumbnail-studio ↔ projectId` 흐름을 항상 보존합니다.
- AI/API 미연결 상태에서도 샘플/폴백 UI로 끝까지 진행 가능해야 합니다.
