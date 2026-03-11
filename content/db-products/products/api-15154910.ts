import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15154910",
  collectorKey: "condition-paging",
  title: "전통주 업소 조회 API 수집기",
  summary: "전통주/음식점 허가 업소를 수집",
  description: "전통주 업소 허가 정보를 조건별로 수집합니다.",
  stack: ["Node.js", "TypeScript", "REST API"],
  status: "판매 중",
  priceLabel: "520,000원",
  priceValue: 520000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "식음료 데이터 서비스",
  features: ["목록 데이터 수집", "조건 기반 조회", "DB 적재 예시 포함"],
  portalDataId: "15154910",
  apiDocUrl: "https://www.data.go.kr/data/15154910/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "전통주 업소 데이터 수집",
  inputFields: [{ key: "pageNo", label: "페이지", example: "1", required: false },{ key: "numOfRows", label: "조회수", example: "100", required: false }],
  sampleRequest: "?serviceKey=YOUR_KEY&pageNo=1&numOfRows=100",
  apiCredential: serviceKeyCredential("15154910"),
};

export default product;