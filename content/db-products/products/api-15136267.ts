import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const product: ProductItem = {
  slug: "api-15136267",
  collectorKey: "condition-paging",
  title: "건축 허가 정보 API 수집기",
  summary: "건축 허가 데이터 수집",
  description: "건축 허가 OpenAPI를 기준으로 지역별 데이터를 수집합니다.",
  stack: ["Node.js", "TypeScript", "REST API"],
  status: "판매 중",
  priceLabel: "890,000원",
  priceValue: 890000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "부동산/건축 데이터 서비스",
  features: ["목록 데이터 수집", "조건 기반 조회", "DB 적재 예시 포함"],
  portalDataId: "15136267",
  apiDocUrl: "https://www.data.go.kr/data/15136267/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "건축 허가 데이터 수집",
  inputFields: [{ key: "sigunguCd", label: "시군구코드", example: "11680", required: false },{ key: "pageNo", label: "페이지", example: "1", required: false }],
  sampleRequest: "?serviceKey=YOUR_KEY&sigunguCd=11680&pageNo=1",
  apiCredential: serviceKeyCredential("15136267"),
};

export default product;