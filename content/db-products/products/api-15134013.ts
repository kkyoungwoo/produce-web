import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15134013",
  collectorKey: "condition-paging",
  title: "구직정보 검색 API 수집기",
  summary: "구직자 검색 결과를 조건 기반으로 수집",
  description: "키워드/페이지 조건으로 구직정보 결과를 수집합니다.",
  stack: ["Node.js", "TypeScript", "REST API"],
  status: "판매 중",
  priceLabel: "490,000원",
  priceValue: 490000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "구인구직 서비스",
  features: ["목록 데이터 수집", "조건 기반 조회", "DB 적재 예시 포함"],
  portalDataId: "15134013",
  apiDocUrl: "https://www.data.go.kr/data/15134013/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "구직정보 데이터 수집",
  inputFields: [{ key: "keyword", label: "검색어", example: "면접", required: false },{ key: "pageNo", label: "페이지", example: "1", required: false }],
  sampleRequest: "?serviceKey=YOUR_KEY&keyword=면접&pageNo=1",
  apiCredential: serviceKeyCredential("15134013"),
};

export default product;