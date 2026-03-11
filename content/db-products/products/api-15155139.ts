import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15155139",
  collectorKey: "condition-paging",
  title: "관광 미박 업소 조회 API 수집기",
  summary: "관광 미박 업소 정보를 수집",
  description: "관광 관련 허가 업소 데이터를 페이지 기반으로 수집합니다.",
  stack: ["Node.js", "TypeScript", "REST API"],
  status: "판매 중",
  priceLabel: "450,000원",
  priceValue: 450000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "관광/숙박 데이터 서비스",
  features: ["목록 데이터 수집", "조건 기반 조회", "DB 적재 예시 포함"],
  portalDataId: "15155139",
  apiDocUrl: "https://www.data.go.kr/data/15155139/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "관광 업소 데이터 수집",
  inputFields: [{ key: "pageNo", label: "페이지", example: "1", required: false },{ key: "numOfRows", label: "조회수", example: "100", required: false }],
  sampleRequest: "?serviceKey=YOUR_KEY&pageNo=1&numOfRows=100",
  apiCredential: serviceKeyCredential("15155139"),
};

export default product;