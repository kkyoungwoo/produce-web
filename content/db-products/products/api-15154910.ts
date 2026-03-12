import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim() ||
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15154910",
  collectorKey: "condition-paging",
  title: "식품_외국인전용유흥음식점업 조회 수집기",
  summary: "인증키와 인허가 날짜만 선택하면 지역별 데이터 조회/필터/엑셀 다운로드를 지원합니다.",
  description:
    "행정안전부 OpenAPI(15154910) 기반으로 외국인전용유흥음식점업 인허가 데이터를 조회합니다. 기본 3일 범위로 과부하를 줄이고, 지역별 필터를 제공해 빠르게 확인할 수 있습니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "판매 중",
  priceLabel: "360,000원",
  priceValue: 360000,
  delivery: "결제 후 3영업일 내 세팅",
  audience: "지역별 인허가 현황을 확인하는 운영·마케팅·리서치 팀",
  features: [
    "사용자 입력: 인증키 + 인허가일자(시작/종료)",
    "기본 설정: pageNo=1, numOfRows=50, returnType=json",
    "과부하 방지: 3일 기본 범위 + 페이지 제한 수집",
    "지역별 통계/필터 + 전체 컬럼 엑셀 다운로드",
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
      key: "cond[BPLC_NM::LIKE]",
      label: "사업장명 포함",
      example: "",
      required: false,
    },
    {
      key: "cond[ROAD_NM_ADDR::LIKE]",
      label: "도로명주소 포함",
      example: "",
      required: false,
    },
    {
      key: "cond[LAST_MDFCN_PNT::GTE]",
      label: "최종수정시점 시작",
      example: "",
      required: false,
    },
    {
      key: "cond[LAST_MDFCN_PNT::LT]",
      label: "최종수정시점 종료",
      example: "",
      required: false,
    },
  ],
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=50&returnType=json&cond[LCPMT_YMD::GTE]=20260309&cond[LCPMT_YMD::LT]=20260312`,
  apiCredential: serviceKeyCredential("15154910"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/1741000/foreigners_entertainment_restaurants/info",
    historyEndpoint: "https://apis.data.go.kr/1741000/foreigners_entertainment_restaurants/history",
    historySwitchParamKey: "cond[BASE_DATE::EQ]",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "50",
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