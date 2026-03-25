import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15134013",
  collectorKey: "condition-paging",
  title: "E-9 외국인 구직정보 검색",
  summary: "인증키를 입력하면 E-9 외국인 구직정보를 조회하고 엑셀로 내려받을 수 있습니다.",
  description: "공공데이터포털 Data ID 15134013 API를 바탕으로 E-9 외국인 구직정보를 조회하는 분석 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15134013",
  priceValue: 330000,
  delivery: "조건 입력 후 바로 조회",
  audience: "구직자 국적, 희망직종, 경력을 빠르게 검토해야 하는 사용자",
  features: [
    "실제 API 응답 기준으로 구직자 목록을 조회합니다.",
    "접수번호, 국적, 희망직종, 경력, 한국어능력을 확인할 수 있습니다.",
    "조회 결과는 전체 엑셀과 필터 엑셀로 저장할 수 있습니다.",
    "인증키가 없으면 실제 데이터 미리보기 5건만 표시됩니다.",
  ],
  portalDataId: "15134013",
  apiDocUrl: "https://www.data.go.kr/data/15134013/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "E-9 외국인 구직정보",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: "",
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&pageNo=1&numOfRows=100&method=getApiTblResume`,
  apiCredential: serviceKeyCredential("15134013"),
  apiRuntime: {
    endpoint: "https://apis.data.go.kr/B490007/tblResume/getApiTblResume",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "100",
      method: "getApiTblResume",
    },
  },
  workbench: {
    columns: [
      { key: "regTime", label: "등록시간" },
      { key: "receiptNo", label: "접수번호" },
      { key: "nationalName", label: "국적" },
      { key: "worktypeMain1Name", label: "희망직종(대)" },
      { key: "worktypeSub1Name", label: "희망직종(중)" },
      { key: "worktypeSub2Name", label: "희망직종(소)" },
      { key: "worktypeSub3Name", label: "희망직종(세부)" },
      { key: "careerMonth", label: "경력(개월)" },
      { key: "koreanAbility", label: "한국어능력" },
    ],
    rows: [],
  },
};

export default product;
