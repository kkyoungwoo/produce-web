# File Reference Map

작업 파일을 기준으로 먼저 읽을 문서를 지정합니다.

## DB / Workbench
| 수정 파일 | 먼저 읽기 | 주의 포인트 |
|---|---|---|
| `content/db-products/products/<slug>.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | `ProductItem` 구조 유지, UI 변경 금지 |
| `content/db-products/products/index.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | `productCatalog` 등록 누락 방지 |
| `components/workbench/product-config.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | 분기 코드보다 설정 기반 우선 |
| `components/workbench/samples.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | 실제 출력 스키마와 키/형식 일치 |
| `components/workbench/constants.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | 컬럼 라벨 누락 방지 |
| `components/workbench/helpers.ts` | `content/db-products/ADD_PRODUCT_GUIDE.md` | 최소 범위 포맷/매핑만 추가 |
| `components/workbench-collector-client.tsx` | `content/db-products/ADD_PRODUCT_GUIDE.md`, `docs/agent/task-playbooks.md` | UI 레이아웃은 요청 시에만 변경 |

## mp4Creater (고난도)
| 수정 파일 | 먼저 읽기 | 주의 포인트 |
|---|---|---|
| `lib/mp4Creater/App.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/ARCHITECTURE.md` | step 흐름과 autosave 동시 확인 |
| `lib/mp4Creater/components/InputSection.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/context/change-map.md` | 무한 렌더 루프/상태 동기화 주의 |
| `lib/mp4Creater/components/inputSection/steps/Step1Panel.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/current-task.md` | Step1 콘셉트/비율/돌아가기 규칙 유지 |
| `lib/mp4Creater/components/inputSection/steps/Step2Panel.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/current-task.md` | 추천 주제 갱신 트리거(초기 1회+새로고침) 유지 |
| `lib/mp4Creater/components/inputSection/steps/Step3Panel.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/current-task.md` | 프롬프트 모달/프로젝트별 프롬프트 저장 회귀 주의 |
| `lib/mp4Creater/pages/SceneStudioPage.tsx` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/ARCHITECTURE.md` | draft/scene asset 경계 유지 |
| `app/[locale]/mp4Creater/page.tsx` | `lib/mp4Creater/AGENTS.md`, `docs/agent/task-playbooks.md` | `?view=main` 리다이렉트 규칙 유지 |
| `app/[locale]/mp4Creater/step-6/page.tsx` | `lib/mp4Creater/ARCHITECTURE.md` | 최종 씬 제작 정식 진입점 |
| `lib/mp4Creater/services/workflowPromptBuilder.ts` | `lib/mp4Creater/.ai/context/change-map.md` | built-in/custom 프롬프트 구분 유지 |
| `lib/mp4Creater/services/videoService.ts` | `lib/mp4Creater/AGENTS.md`, `lib/mp4Creater/.ai/rules/testing-rules.md` | 자막/오디오/렌더 프로파일 세트 검증 |
| `lib/mp4Creater/services/localFileApi.ts` | `lib/mp4Creater/AGENTS.md`, `MP4CREATER_PROJECT_STORAGE_RULES.md` | state shape 변경 시 연쇄 영향 점검 |
| `app/api/local-storage/_shared.ts` | `MP4CREATER_PROJECT_STORAGE_RULES.md` | 저장 구조 호환성 유지 |
| `app/api/local-storage/state/route.ts` | `MP4CREATER_PROJECT_STORAGE_RULES.md` | 저장/불러오기 회귀 방지 |
| `app/api/local-storage/config/route.ts` | `MP4CREATER_PROJECT_STORAGE_RULES.md` | storageDir 미설정 처리 유지 |
| `lib/mp4Creater/services/projectNavigationCache.ts` | `lib/mp4Creater/ARCHITECTURE.md`, `lib/mp4Creater/.ai/context/module-map.md` | step/scene 이동 문맥 캐시 유지 |

## 샘플 자산/검증
| 수정 파일 | 먼저 읽기 | 주의 포인트 |
|---|---|---|
| `public/mp4Creater/samples/*` | `lib/mp4Creater/.ai/rules/sample-asset-rules.md` | 공개 샘플만 유지 |
| `local-data/tubegen-studio/sample-library/*` | `lib/mp4Creater/.ai/rules/sample-asset-rules.md` | 로컬 검수 샘플과 분리 |
| `scripts/generate-mp4-sample-manifest.mjs` | `public/mp4Creater/samples/README.md` | manifest 경로 일관성 유지 |
| `scripts/check-mp4-sample-layout.mjs` | `lib/mp4Creater/.ai/rules/sample-asset-rules.md` | 폴더 규칙 기계 검증 유지 |


