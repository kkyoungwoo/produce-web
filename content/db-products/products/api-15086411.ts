import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim() ||
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15086411",
  collectorKey: "range-batch",
  title: "외국인근로자 귀국지원 현지 채용공고 수집기",
  summary:
    "인증키만 입력하면 전체 페이지를 자동 순회하여 채용공고 데이터를 조회하고 엑셀로 내려받을 수 있습니다.",
  description:
    "data.go.kr 15086411 OpenAPI(getApiTblRecruit) 기반 실데이터 조회/엑셀 다운로드 상품입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "판매 중",
  priceLabel: "390,000원",
  priceValue: 390000,
  delivery: "결제 후 3영업일 내 제공",
  audience: "해외 채용공고 데이터를 사용하는 영업/마케팅/리서치팀",
  features: [
    "사용자 입력: serviceKey(인증키)",
    "코드 고정값: pageNo=1, numOfRows=100, method=getApiTblRecruit",
    "전체 페이지 자동 수집 및 결과 테이블 출력",
    "조회 결과 전체 컬럼 엑셀 다운로드",
  ],
  portalDataId: "15086411",
  apiDocUrl: "https://www.data.go.kr/data/15086411/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "외국인근로자 귀국지원 관련 현지 채용공고",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: DEFAULT_SERVICE_KEY,
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=100&method=getApiTblRecruit`,
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