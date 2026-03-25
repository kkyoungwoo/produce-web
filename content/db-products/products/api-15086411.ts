import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const SERVICE_KEY_SAMPLE = "YOUR_DATA_GO_KR_SERVICE_KEY";

const product: ProductItem = {
  slug: "api-15086411",
  collectorKey: "range-batch",
  title: "외국인근로자 구인 업체 채용공고 조회",
  summary: "인증키를 입력하고 조회하면 외국인근로자 채용공고 데이터를 바로 확인할 수 있습니다.",
  description: "공공데이터포털 Data ID 15086411 API를 바탕으로 외국인근로자 구인 업체 채용공고를 조회하고 엑셀로 정리할 수 있는 분석 페이지입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "분석 가능",
  priceLabel: "Data ID 15086411",
  priceValue: 390000,
  delivery: "조건 입력 후 바로 조회",
  audience: "채용공고 비교, 국가별 수요 확인, 영업 대상 탐색이 필요한 사용자",
  features: [
    "인증키 입력 후 전체 공고를 자동으로 수집합니다.",
    "국가별 데이터를 표와 엑셀로 정리할 수 있습니다.",
    "실제 API 응답 기준으로 데이터를 확인할 수 있습니다.",
    "조회 결과는 전체 엑셀과 필터 엑셀로 저장할 수 있습니다.",
  ],
  portalDataId: "15086411",
  apiDocUrl: "https://www.data.go.kr/data/15086411/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인근로자 구인 업체 채용공고",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: "",
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${SERVICE_KEY_SAMPLE}&pageNo=1&numOfRows=100&method=getApiTblRecruit`,
  apiCredential: serviceKeyCredential("15086411"),
  apiRuntime: {
    endpoint: "http://apis.data.go.kr/B490007/tblRecruitInfo/getApiTblRecruit",
    responsePathHint: "response.body.items.item",
    forcedQuery: {
      pageNo: "1",
      numOfRows: "100",
      method: "getApiTblRecruit",
    },
  },
  workbench: {
    columns: [
      { key: "worknational", label: "근무국가" },
      { key: "localCompanyName", label: "현지업체명" },
      { key: "recruitNum", label: "채용인원" },
    ],
    rows: [],
  },
};

export default product;
