import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim() ||
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15120791",
  collectorKey: "condition-paging",
  title: "외국인근로자 취업교육 교육장 안내 수집기",
  summary: "인증키만 입력하면 취업교육 교육장 정보를 조회하고 엑셀로 다운로드할 수 있습니다.",
  description:
    "한국산업인력공단 OpenAPI(15120791, getApiTbEduPlcList) 실데이터를 조회하는 상품입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "판매 중",
  priceLabel: "290,000원",
  priceValue: 290000,
  delivery: "결제 후 3영업일 내 세팅",
  audience: "취업교육 교육장 정보를 조회/관리하려는 운영팀",
  features: [
    "사용자 입력: serviceKey(인증키)",
    "코드 기본값: pageNo=1, numOfRows=100, method=getApiTbEduPlcList",
    "실제 API 조회 결과를 테이블 및 엑셀로 제공",
    "교육장명/기관명/연락처/주소 컬럼 한글 라벨 출력",
  ],
  portalDataId: "15120791",
  apiDocUrl: "https://www.data.go.kr/data/15120791/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인근로자 취업교육 교육장 안내",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: DEFAULT_SERVICE_KEY,
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=100&method=getApiTbEduPlcList`,
  apiCredential: serviceKeyCredential("15120791"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/B490007/TbEduPlc/getApiTbEduPlcList",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "100",
      method: "getApiTbEduPlcList",
    },
  },
  workbench: {
    columns: [
      { key: "plcNm", label: "교육장명" },
      { key: "orgHanNm", label: "기관명" },
      { key: "telNo", label: "전화번호" },
      { key: "faxNo", label: "팩스번호" },
      { key: "addr", label: "주소" },
      { key: "etcAd", label: "기타 안내" },
    ],
    rows: [],
  },
};

export default product;
