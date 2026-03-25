import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15120791",
  collectorKey: "condition-paging",
  title: "외국인근로자 취업교육 교육장 안내",
  summary: "인증키를 입력하면 취업교육 교육장 정보를 조회하고 엑셀로 다운로드할 수 있습니다.",
  description: "공공데이터포털 Data ID 15120791 API를 바탕으로 외국인근로자 취업교육 교육장 정보를 조회하는 분석 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15120791",
  priceValue: 290000,
  delivery: "조건 입력 후 바로 조회",
  audience: "교육장 위치, 연락처, 기관 정보를 빠르게 확인해야 하는 사용자",
  features: [
    "실제 API 응답 기준으로 교육장 정보를 조회합니다.",
    "교육장명, 기관명, 연락처, 주소를 표로 확인할 수 있습니다.",
    "조회 결과는 엑셀 파일로 바로 저장할 수 있습니다.",
    "인증키가 없으면 실제 데이터 미리보기 5건만 표시됩니다.",
  ],
  portalDataId: "15120791",
  apiDocUrl: "https://www.data.go.kr/data/15120791/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인근로자 취업교육 교육장 안내",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: "",
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&pageNo=1&numOfRows=100&method=getApiTbEduPlcList`,
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
