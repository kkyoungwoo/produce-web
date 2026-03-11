import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15120791",
  collectorKey: "condition-paging",
  title: "고용노동부 취업교육 안내 API 수집기",
  summary: "취업교육 과정/일정 정보를 수집",
  description: "취업교육 안내 OpenAPI 데이터를 조건별로 수집합니다.",
  stack: ["Node.js", "TypeScript", "REST API"],
  status: "판매 중",
  priceLabel: "430,000원",
  priceValue: 430000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "교육 데이터 서비스",
  features: ["목록 데이터 수집", "조건 기반 조회", "DB 적재 예시 포함"],
  portalDataId: "15120791",
  apiDocUrl: "https://www.data.go.kr/data/15120791/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "취업교육 안내 데이터 수집",
  inputFields: [{ key: "pageNo", label: "페이지", example: "1", required: false },{ key: "numOfRows", label: "조회수", example: "20", required: false }],
  sampleRequest: "?serviceKey=YOUR_KEY&pageNo=1&numOfRows=20",
  apiCredential: serviceKeyCredential("15120791"),
};

export default product;