import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim()
  || "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15154910",
  collectorKey: "condition-paging",
  title: "식품_외국인전용유흥음식점업 조회 수집기",
  summary: "인증키, 인허가일자, 지역만 선택해 실데이터를 조회하고 엑셀로 내려받을 수 있습니다.",
  description:
    "행정안전부 OpenAPI(15154910) 기반으로 식품_외국인전용유흥음식점업 데이터를 조회하는 상품입니다. 테이블/엑셀 컬럼은 한국어 라벨로 표시됩니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "판매 중",
  priceLabel: "360,000원",
  priceValue: 360000,
  delivery: "결제 후 3영업일 내 세팅",
  audience: "식품 인허가/영업상태 데이터를 빠르게 확인해야 하는 운영·분석 팀",
  features: [
    "사용자 입력: 인증키 + 지역(복수 선택) + 인허가일자",
    "실데이터 조회 후 지역별 통계/필터 제공",
    "조회 결과 전체 컬럼을 한국어 라벨로 표시",
    "엑셀 다운로드 시 컬럼명을 한국어로 저장",
  ],
  portalDataId: "15154910",
  apiDocUrl: "https://www.data.go.kr/data/15154910/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "식품_외국인전용유흥음식점업 인허가/영업상태 데이터",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: DEFAULT_SERVICE_KEY,
      required: true,
    },
    {
      key: "cond[OPN_ATMY_GRP_CD::EQ]",
      label: "개방자치단체코드",
      example: "3020000",
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
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=100&returnType=json&cond[OPN_ATMY_GRP_CD::EQ]=3020000`,
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
