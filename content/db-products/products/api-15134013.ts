import type { ProductItem } from "@/lib/i18n/types";

import { ACCOUNT_GUIDE_URL, serviceKeyCredential } from "../shared";

const DEFAULT_SERVICE_KEY =
  process.env.NEXT_PUBLIC_DATA_GO_KR_SERVICE_KEY?.trim() ||
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const product: ProductItem = {
  slug: "api-15134013",
  collectorKey: "condition-paging",
  title: "E-9 외국인 구직정보 검색 수집기",
  summary:
    "인증키만 입력하면 E-9 외국인 구직정보를 조회하고 엑셀로 다운로드할 수 있습니다.",
  description:
    "한국산업인력공단 OpenAPI(15134013, getApiTblResume) 기반 E-9 구직정보 실데이터 조회 상품입니다.",
  stack: ["Node.js", "TypeScript", "REST API", "XML", "XLSX"],
  status: "판매 중",
  priceLabel: "330,000원",
  priceValue: 330000,
  delivery: "결제 후 3영업일 내 세팅",
  audience: "E-9 외국인 구직정보를 검색/분석하려는 운영팀",
  features: [
    "사용자 입력: serviceKey(인증키)",
    "코드 기본값: pageNo=1, numOfRows=100, method=getApiTblResume",
    "실제 API 조회 결과를 테이블 및 엑셀로 제공",
    "접수번호/국적/희망직종/경력/한국어능력 컬럼 제공",
  ],
  portalDataId: "15134013",
  apiDocUrl: "https://www.data.go.kr/data/15134013/openapi.do",
  accountGuideUrl: ACCOUNT_GUIDE_URL,
  collectFocus: "E-9 외국인 구직정보 검색",
  inputFields: [
    {
      key: "serviceKey",
      label: "인증키(serviceKey)",
      example: DEFAULT_SERVICE_KEY,
      required: true,
    },
  ],
  sampleRequest: `?serviceKey=${DEFAULT_SERVICE_KEY}&pageNo=1&numOfRows=100&method=getApiTblResume`,
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