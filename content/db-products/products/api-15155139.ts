import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim() ||
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15155139",
  collectorKey: "condition-paging",
  title: "문화_외국인관광도시민박업 조회/이력 수집기",
  summary: "인증키와 조건값으로 민박업 데이터를 조회하고, 데이터기준일자를 넣으면 이력조회로 자동 전환됩니다.",
  description:
    "행정안전부 OpenAPI(15155139) 기반으로 문화_외국인관광도시민박업의 현재 데이터(/info)와 이력 데이터(/history)를 수집/엑셀 다운로드하는 상품입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "판매 중",
  priceLabel: "360,000원",
  priceValue: 360000,
  delivery: "결제 후 3영업일 내 세팅",
  audience: "민박업 인허가/영업상태 데이터를 분석하는 운영·영업·리서치 팀",
  features: [
    "사용자 입력: serviceKey(인증키) + 조건 필터",
    "코드 기본값: pageNo=1, numOfRows=100, returnType=json",
    "cond[BASE_DATE::EQ] 입력 시 /history 자동 전환",
    "조회 결과 전체 컬럼을 테이블 및 엑셀로 다운로드",
  ],
  portalDataId: "15155139",
  apiDocUrl: "https://www.data.go.kr/data/15155139/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "문화_외국인관광도시민박업 인허가/영업상태 데이터",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: DEFAULT_SERVICE_KEY,
      required: true,
    },
    {
      key: "cond[OPN_ATMY_GRP_CD::EQ]",
      label: "개방자치단체코드(이력조회 시 필수)",
      example: "3020000",
      required: false,
    },
    {
      key: "cond[BASE_DATE::EQ]",
      label: "데이터기준일자(YYYYMMDD, 입력 시 이력조회)",
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
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=100&returnType=json&cond[OPN_ATMY_GRP_CD::EQ]=3020000`,
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
      { key: "OPN_ATMY_GRP_CD", label: "개방자치단체코드" },
      { key: "BPLC_NM", label: "사업장명" },
      { key: "SALS_STTS_CD", label: "영업상태코드" },
      { key: "SALS_STTS_NM", label: "영업상태명" },
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
