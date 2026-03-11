import type { CollectorKey, CollectorProfile } from "@/lib/i18n/types";

const collectorProfiles: Record<CollectorKey, CollectorProfile> = {
  "range-batch": {
    key: "range-batch",
    title: "기간 배치 수집",
    shortDescription: "시작일/종료일 기반으로 안전하게 누적 수집",
    runStrategy: "기간 범위를 분할해 배치로 수집하고, 중복 키 기준으로 업서트 저장",
    runtimeHints: [
      { key: "date-window", label: "기간 분할", description: "월/주 단위로 구간을 분할해 누락 없이 수집" },
      { key: "dedupe", label: "중복 제거", description: "사업자 고유키 기준으로 중복 행 제거" },
      { key: "retry", label: "재시도", description: "타임아웃/429 발생 시 점진적 재시도" },
    ],
  },
  "condition-paging": {
    key: "condition-paging",
    title: "조건 + 페이징 수집",
    shortDescription: "키워드/조건 필터와 페이지 탐색을 결합한 수집",
    runStrategy: "조건 템플릿으로 질의하고 pageNo를 증가시키며 마지막 페이지까지 병합",
    runtimeHints: [
      { key: "query-template", label: "조건 템플릿", description: "저장된 조건셋을 재사용해 반복 실행" },
      { key: "page-crawl", label: "페이지 탐색", description: "현재 페이지/총 페이지를 확인하며 순차 수집" },
      { key: "merge", label: "결과 병합", description: "페이지별 결과를 표준 스키마로 병합" },
    ],
  },
  "schema-validated": {
    key: "schema-validated",
    title: "스키마 검증 수집",
    shortDescription: "API 가이드 기준으로 필드 검증 후 저장",
    runStrategy: "응답 필드를 정의 스키마와 대조해 검증 후 오류 행 분리 저장",
    runtimeHints: [
      { key: "schema-check", label: "필드 검증", description: "필수 필드 누락/타입 오류를 사전 차단" },
      { key: "error-bucket", label: "오류 분리", description: "오류 데이터는 별도 테이블에 분리" },
      { key: "normalization", label: "정규화", description: "표준 칼럼 구조로 정규화 후 적재" },
    ],
  },
  "realtime-filter": {
    key: "realtime-filter",
    title: "실시간 필터 수집",
    shortDescription: "단일 기준일/필터 기반 빠른 조회 수집",
    runStrategy: "짧은 주기의 조회형 요청을 수행하고 캐시 키로 결과를 즉시 재사용",
    runtimeHints: [
      { key: "fast-query", label: "즉시 조회", description: "요청 즉시 데이터 확인에 최적화" },
      { key: "cache-key", label: "캐시 키", description: "조건 조합을 캐시 키로 구성" },
      { key: "ttl", label: "만료 정책", description: "시간 기반 TTL로 결과 자동 갱신" },
    ],
  },
  "scheduled-pipeline": {
    key: "scheduled-pipeline",
    title: "스케줄 파이프라인",
    shortDescription: "정기 배치로 자동 수집 + DB 적재",
    runStrategy: "스케줄러가 시간 단위로 수집 작업을 실행하고 실패 로그를 남기며 복구",
    runtimeHints: [
      { key: "scheduler", label: "정기 실행", description: "크론/큐 기반 자동 실행" },
      { key: "audit-log", label: "실행 로그", description: "성공/실패 이력과 소요 시간을 기록" },
      { key: "fallback", label: "복구 실행", description: "실패 구간만 재실행하도록 분리" },
    ],
  },
};

export function getCollectorProfile(key: CollectorKey): CollectorProfile {
  return collectorProfiles[key];
}

export function getCollectorProfiles(): CollectorProfile[] {
  return Object.values(collectorProfiles);
}
