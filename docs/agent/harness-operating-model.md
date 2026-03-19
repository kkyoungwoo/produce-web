# Harness Operating Model

## 목적
- 에이전트가 필요한 정보만 빠르게 읽고
- 변경 범위를 안정적으로 제한하며
- 오류/할루시네이션 가능성을 낮추는 작업 환경을 유지합니다.

## 핵심 운영 원칙
1. `AGENTS.md`는 목차로 유지합니다.
2. 상세 규칙은 도메인 문서로 분리합니다.
3. 규칙은 코드/문서/검증 스크립트로 함께 강제합니다.
4. 변경 후 문서 드리프트를 즉시 정리합니다.

## 정보 구조 (Map -> Rule -> File)
1. Map: 루트 `AGENTS.md`
2. Rule: 도메인 문서 (`content/db-products/ADD_PRODUCT_GUIDE.md`, `lib/mp4Creater/AGENTS.md`)
3. File: 실제 수정 파일
4. History: 도메인 변경 로그(`docs/agent/mp4creater-redesign-log.md`)

## 긍정적 실행 패턴
- 작은 작업 단위로 나누고 즉시 검증합니다.
- "어디를 수정할지"보다 먼저 "무엇을 건드리면 안 되는지"를 확인합니다.
- 리스크가 큰 영역(`videoService.ts`, local-storage state shape)은 연관 파일을 세트로 점검합니다.

## 엔트로피 관리 (Garbage Collection)
- 사용되지 않는 중복 문서는 제거합니다.
- 과거 맥락성 메모는 인덱스 문서로 흡수하고 원본을 정리합니다.
- 각 작업에서 문서 링크가 실제 파일과 맞는지 확인합니다.


