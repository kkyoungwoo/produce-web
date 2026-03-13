import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15155139",
  collectorKey: "condition-paging",
  title: "외국인관광도시민박업 조회",
  summary: "지역과 날짜 조건으로 외국인관광도시민박업 데이터를 조회하고 이력 데이터까지 확인할 수 있습니다.",
  description: "공공데이터포털 Data ID 15155139 API를 바탕으로 외국인관광도시민박업 인허가 및 영업상태 데이터를 조회하는 분석 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15155139",
  priceValue: 360000,
  delivery: "조건 입력 후 바로 조회",
  audience: "민박업 현황, 이력, 영업상태를 지역 기준으로 분석하려는 사용자",
  features: [
    "지역별 코드 묶음을 자동으로 처리해 실제 데이터를 조회합니다.",
    "영업상태를 한국어 기준으로 필터링할 수 있습니다.",
    "이력 기준일을 입력하면 history API로 자동 전환됩니다.",
    "인증키가 없으면 실제 데이터 미리보기 5건만 표시됩니다.",
  ],
  portalDataId: "15155139",
  apiDocUrl: "https://www.data.go.kr/data/15155139/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인관광도시민박업 인허가 및 영업상태 데이터",
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
      key: "cond[BASE_DATE::EQ]",
      label: "데이터기준일자(YYYYMMDD)",
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
    {
      key: "cond[SALS_STTS_CD::EQ]",
      label: "영업상태코드",
      example: "",
      required: false,
    },
    {
      key: "cond[GRND_NOFL::GTE]",
      label: "지상층수 이상",
      example: "",
      required: false,
    },
    {
      key: "cond[UDGD_NOFL::GTE]",
      label: "지하층수 이상",
      example: "",
      required: false,
    },
    {
      key: "cond[LAST_MDFCN_PNT::GTE]",
      label: "최종수정시점 시작(YYYYMMDDHHMMSS)",
      example: "",
      required: false,
    },
    {
      key: "cond[LAST_MDFCN_PNT::LT]",
      label: "최종수정시점 종료(YYYYMMDDHHMMSS)",
      example: "",
      required: false,
    },
    {
      key: "cond[BPLC_NM::LIKE]",
      label: "사업장명 포함 검색",
      example: "",
      required: false,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&pageNo=1&numOfRows=100&returnType=json&cond[OPN_ATMY_GRP_CD::EQ]=3020000`,
  apiCredential: serviceKeyCredential("15155139"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/1741000/foreigner_city_homestays/info",
    historyEndpoint: "https://apis.data.go.kr/1741000/foreigner_city_homestays/history",
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
      { key: "SALS_STTS_CD", label: "영업상태코드" },
      { key: "SALS_STTS_NM", label: "영업상태" },
      { key: "LCPMT_YMD", label: "인허가일자" },
      { key: "ROAD_NM_ADDR", label: "도로명주소" },
      { key: "LOTNO_ADDR", label: "지번주소" },
      { key: "TELNO", label: "전화번호" },
      { key: "GRND_NOFL", label: "지상층수" },
      { key: "UDGD_NOFL", label: "지하층수" },
      { key: "TOTAL_NOFL", label: "총층수" },
      { key: "LAST_MDFCN_PNT", label: "최종수정시점" },
    ],
    rows: [],
  },
};

export default product;
