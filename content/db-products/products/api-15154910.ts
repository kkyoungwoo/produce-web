import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15154910",
  collectorKey: "condition-paging",
  title: "외국인전용유흥음식점 조회",
  summary: "지역과 인허가일자를 기준으로 외국인전용유흥음식점 데이터를 조회할 수 있습니다.",
  description: "공공데이터포털 Data ID 15154910 API를 바탕으로 외국인전용유흥음식점 정보를 조회하고 지역별/영업상태별로 분석할 수 있는 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15154910",
  priceValue: 360000,
  delivery: "조건 입력 후 바로 조회",
  audience: "지역별 영업 현황과 영업상태를 빠르게 확인해야 하는 사용자",
  features: [
    "지역을 여러 개 선택해 실제 API 데이터를 조회할 수 있습니다.",
    "영업상태를 한국어 기준으로 필터링할 수 있습니다.",
    "지역별 통계와 전체/필터 엑셀 다운로드를 지원합니다.",
    "인증키가 없으면 실제 데이터 미리보기 5건만 표시됩니다.",
  ],
  portalDataId: "15154910",
  apiDocUrl: "https://www.data.go.kr/data/15154910/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인전용유흥음식점 인허가 및 영업상태 데이터",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: "",
      required: true,
    },
    {
      key: "cond[OPN_ATMY_GRP_CD::EQ]",
      label: "개방자치단체코드",
      example: "",
      required: false,
    },
    {
      key: "cond[LCPMT_YMD::GTE]",
      label: "인허가일자 시작(YYYYMMDD)",
      example: "",
      required: false,
    },
    {
      key: "cond[LCPMT_YMD::LT]",
      label: "인허가일자 종료(YYYYMMDD)",
      example: "",
      required: false,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&pageNo=1&numOfRows=100&returnType=json&cond[OPN_ATMY_GRP_CD::EQ]=3020000`,
  apiCredential: serviceKeyCredential("15154910"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/1741000/foreigners_entertainment_restaurants/info",
    historyEndpoint: "https://apis.data.go.kr/1741000/foreigners_entertainment_restaurants/history",
    historySwitchParamKey: "cond[BASE_DATE::EQ]",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "100",
      returnType: "json",
    },
  },
  workbench: {
    columns: [
      { key: "OPN_ATMY_GRP_CD", label: "개방자치단체" },
      { key: "BPLC_NM", label: "사업장명" },
      { key: "SALS_STTS_NM", label: "영업상태" },
      { key: "LCPMT_YMD", label: "인허가일자" },
      { key: "ROAD_NM_ADDR", label: "도로명주소" },
      { key: "LOTNO_ADDR", label: "지번주소" },
      { key: "TELNO", label: "전화번호" },
      { key: "LAST_MDFCN_PNT", label: "최종수정시점" },
    ],
    rows: [],
  },
};

export default product;
