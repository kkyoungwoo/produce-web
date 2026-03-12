# AGENTS.md (produce-web)

## 필수 작업 규칙
- DB 상품을 추가/수정하기 전에 반드시 `content/db-products/ADD_PRODUCT_GUIDE.md`를 먼저 확인합니다.
- 사용자가 별도로 요청하지 않은 기존 UI 레이아웃/디자인은 변경하지 않습니다.
- 코드는 역할별로 분리합니다: UI, 로직, 텍스트, 상품 데이터.
- 상품별 예외 처리는 컴포넌트 분기보다 설정 기반(`product-config`)을 우선 사용합니다.

## DB 상품 파일 규칙
- 상품 파일: `content/db-products/products/<slug>.ts`
- 상품 목록 등록: `content/db-products/products/index.ts`
- 워크벤치 동작 설정: `components/workbench/product-config.ts`
- 샘플 데이터: `components/workbench/samples.ts`
- 컬럼 라벨/상수: `components/workbench/constants.ts`
- 포맷/파싱 헬퍼: `components/workbench/helpers.ts`
- 메인 워크벤치 컴포넌트: `components/workbench-collector-client.tsx`

## 인코딩 규칙 (중요)
- `.ts`, `.tsx`, `.js`, `.json`, `.css`, `.md`는 모두 UTF-8(권장: BOM 없음)으로 저장합니다.
- ANSI/EUC-KR/CP949 저장을 금지합니다.
- 한글 깨짐(모지바케) 발견 시 로직을 바꾸지 말고 텍스트 인코딩과 문자열만 복구합니다.
- 편집기 기본 인코딩은 UTF-8로 고정합니다.

## 상품 변경 체크리스트
1. 레이아웃/인터랙션 유지 여부 확인 (요청 시에만 변경)
2. 지정된 파일에 상품 데이터/설정/샘플 반영
3. 샘플 데이터는 실제 출력 스키마와 최대한 동일하게 구성
4. `npm run build` 통과 확인