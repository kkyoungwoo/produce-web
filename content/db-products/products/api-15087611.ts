import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15087611",
  collectorKey: "condition-paging",
  title: "등록공장 생산정보 조회",
  summary: "산업단지와 고용인원, 공장 등록일자 조건으로 등록공장 생산정보를 조회할 수 있습니다.",
  description:
    "공공데이터포털 Data ID 15087611 API를 바탕으로 회사명, 주소, 대표자, 생산품, 고용인원, 공장 등록일자를 포함한 등록공장 정보를 조회하는 분석 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "JSON", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15087611",
  priceValue: 390000,
  delivery: "조건 입력 후 바로 조회",
  audience: "산업단지별 공장 등록 현황과 고용 규모를 빠르게 확인하려는 사용자",
  features: [
    "시도 선택 후 산업단지 기준으로 등록공장 생산정보를 안정적으로 조회할 수 있습니다.",
    "고용인원 구간(전체, 1명 미만, 1~4명, 5~49명, 50명 이상) 필터를 제공합니다.",
    "공장 등록일자 시작/종료 입력으로 조회 결과를 좁힐 수 있습니다.",
    "인증키가 없으면 실제 데이터 미리보기 5건만 표시됩니다.",
  ],
  portalDataId: "15087611",
  apiDocUrl: "https://www.data.go.kr/data/15087611/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "등록공장 기본정보 및 업종/생산품 정보",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: "",
      required: true,
    },
    {
      key: "irsttNm",
      label: "산업단지명",
      example: "남동국가산업단지",
      required: false,
    },
    {
      key: "pageNo",
      label: "페이지 번호",
      example: "1",
      required: false,
    },
    {
      key: "numOfRows",
      label: "조회 건수",
      example: "200",
      required: false,
    },
    {
      key: "type",
      label: "응답 형식",
      example: "json",
      required: false,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&type=json&pageNo=1&numOfRows=200&irsttNm=남동국가산업단지`,
  apiCredential: serviceKeyCredential("15087611"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/B550624/fctryRegistInfo/getFctryListInIrsttService_v2",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "200",
      type: "json",
    },
  },
  workbench: {
    columns: [
      { key: "fctryManageNo", label: "공장관리번호" },
      { key: "cmpnyNm", label: "회사명" },
      { key: "rnAdres", label: "도로명주소" },
      { key: "rprsntvNm", label: "대표자" },
      { key: "cvplChrgOrgnztNm", label: "행정기관" },
      { key: "cmpnyTelno", label: "회사전화번호" },
      { key: "cmpnyFxnum", label: "팩스번호" },
      { key: "allEmplyCo", label: "고용인원" },
      { key: "frstFctryRegistDe", label: "공장 등록일자" },
      { key: "indutyNm", label: "업종명" },
      { key: "mainProductCn", label: "주생산품" },
      { key: "hmpadr", label: "홈페이지" },
      { key: "rprsntvIndutyCode", label: "대표업종코드" },
      { key: "indutyCodes", label: "전체업종코드" },
      { key: "irsttNm", label: "산업단지명" },
    ],
    rows: [],
  },
};

export default product;
