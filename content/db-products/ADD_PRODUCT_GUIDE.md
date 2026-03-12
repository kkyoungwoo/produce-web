> 신규 작업 전에 `AGENTS.md`를 항상 먼저 확인해야 합니다.

# 신규 DB 상품 추가 가이드

## 1) 상품 데이터 파일 추가
- 위치: `content/db-products/products/`
- 파일명 예시: `api-15199999.ts`
- 필수: `ProductItem` 타입 구조로 작성

## 2) 상품 목록 등록
- 파일: `content/db-products/products/index.ts`
- `productCatalog` 배열에 신규 상품 import 및 등록

## 3) 워크벤치 동작 설정(설정 기반)
- 파일: `components/workbench/product-config.ts`
- `getWorkbenchProductConfig`에 slug별 설정 추가
- 설정 항목 예시:
  - `inputMode`: `default` | `homestay`
  - `statMode`: `none` | `country:worknational` | `country:nationalName` | `region:homestay` | `region:addr`
  - `hideInputKeys`: 입력 UI에서 숨길 필드 키 목록
  - `forceDefaultDates`, `forceBaseDateToYesterday`

## 4) 샘플 데이터 추가
- 파일: `components/workbench/samples.ts`
- `getSampleRows(product)`에 slug별 샘플 5건 추가
- 규칙: 실제 출력 테이블과 최대한 동일한 키/형식 유지

## 5) 컬럼 한글 라벨 추가
- 파일: `components/workbench/constants.ts`
- `COLUMN_LABEL_KR`에 신규 컬럼 키와 한글 라벨 추가

## 6) 특수 포맷/매핑이 필요한 경우
- 파일: `components/workbench/helpers.ts`
- `formatCellValue` 또는 국가/지역 매핑 함수만 최소 범위로 추가

---

## 워크벤치 핵심 파일
- 메인 UI + 동작: `components/workbench-collector-client.tsx`
- 타입: `components/workbench/types.ts`
- 텍스트: `components/workbench/text.ts`
- 상수/라벨: `components/workbench/constants.ts`
- 헬퍼/검증: `components/workbench/helpers.ts`
- 상품별 동작 설정: `components/workbench/product-config.ts`
- 상품별 샘플 데이터: `components/workbench/samples.ts`

## 인코딩 규칙
- 본 문서 및 코드 파일은 UTF-8(권장: BOM 없음)으로 저장합니다.
- 한글 깨짐이 발생하면 먼저 인코딩을 확인하고 문자열을 복구합니다.