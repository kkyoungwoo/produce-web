import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15086411",
  collectorKey: "range-batch",
  title: "고용노동부 채용공고 API 수집기",
  summary: "워크넷 채용공고 목록을 날짜/페이지 기준으로 수집",
  description: "고용노동부 OpenAPI(15086411)를 활용해 채용공고 데이터를 안정적으로 적재합니다.",
  stack: ["Node.js", "TypeScript", "REST API", "PostgreSQL"],
  status: "판매 중",
  priceLabel: "390,000원",
  priceValue: 390000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "채용 데이터 서비스, HR 자동화",
  features: ["채용공고 목록 수집", "페이지 기반 반복 수집", "DB 적재 예시 포함"],
  portalDataId: "15086411",
  apiDocUrl: "https://www.data.go.kr/data/15086411/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "채용공고 데이터 수집",
  inputFields: [
    { key: "pageNo", label: "페이지", example: "1", required: true },
    { key: "numOfRows", label: "조회수", example: "20", required: true },
  ],
  sampleRequest: "?serviceKey=YOUR_KEY&pageNo=1&numOfRows=20",
  apiCredential: serviceKeyCredential("15086411"),
  workbench: {
    primaryDateKey: "baseDate",
    columns: [
      { key: "id", label: "번호" },
      { key: "noticeTitle", label: "공고명" },
      { key: "region", label: "지역" },
      { key: "status", label: "상태" },
      { key: "baseDate", label: "기준일" },
    ],
    rows: [
      { id: 1, noticeTitle: "채용공고 A", region: "서울", status: "수집 완료", baseDate: "2026-03-11" },
      { id: 2, noticeTitle: "채용공고 B", region: "경기", status: "검증 중", baseDate: "2026-03-11" },
      { id: 3, noticeTitle: "채용공고 C", region: "부산", status: "적재 완료", baseDate: "2026-03-11" },
    ],
  },
};

export default product;