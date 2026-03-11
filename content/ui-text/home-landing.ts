import type { Locale } from "@/lib/i18n/config";

type LandingCopy = {
  points: string[];
  title: string;
  titleAccent: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  status: string;
  panelTitle: string;
  panelDescription: string;
  trustItems: Array<{ kicker: string; label: string }>;
  whyTag: string;
  whyTitle: string;
  whyDescription: string;
  processCards: Array<{ step: string; title: string; description: string }>;
  businessTag: string;
  businessTitle: string;
  businessDescription: string;
  promiseKicker: string;
  promiseTitle: string;
  promiseDescription: string;
  promisePrimary: string;
  promiseSecondary: string;
};

const koLandingCopy: LandingCopy = {
  points: ["맞춤형", "최신 DB", "빠른 상담"],
  title: "필요한 고객 DB를",
  titleAccent: "요청하세요!",
  description:
    "법적 문제가 없는 DB 제작과 인바운드 DB를 생산합니다.",
  primaryCta: "DB 상품 보기",
  secondaryCta: "카카오톡 상담",
  status: "실시간 업데이트 중",
  panelTitle: "DB (=Database)",
  panelDescription: "원하는 DB를 지금 선택하세요!",
  trustItems: [
    { kicker: "DATABASE", label: "상권/업종 DB" },
    { kicker: "COMPANY", label: "기업/사업자 DB" },
    { kicker: "INBOUND", label: "문의/요청 DB" },
    { kicker: "CUSTOM", label: "맞춤 DB 생산" },
  ],
  whyTag: "WHY WORKVISA",
  whyTitle: "최신 DB를 빠르게 생산합니다",
  whyDescription: "영업과 마케팅에 필요한 데이터를 즉시 활용할 수 있도록 정리해드립니다.",
  processCards: [
    { step: "POINT 1", title: "빠른 구매", description: "DB를 선택하시거나 상담을 진행합니다." },
    { step: "POINT 2", title: "DB 생산", description: "구매 후 최소 1일 내 DB 생산을 진행합니다." },
    { step: "POINT 3", title: "즉시 사용", description: "생산된 DB는 영업/마케팅 운영에 바로 적용 가능합니다." },
    { step: "POINT 4", title: "유연한 확장", description: "필요 시 추가 수집과 맞춤 제작까지 확장 지원합니다." },
  ],
  businessTag: "BUSINESS",
  businessTitle: "사업자 DB 생산 전문 업체",
  businessDescription:
    "정확성과 신뢰가 중요한 사업자 DB를 안정적으로 제공합니다. 보유 DB뿐 아니라 원하는 조건의 맞춤형 수집 구조까지 함께 지원합니다.",
  promiseKicker: "WORKVISA PROMISE",
  promiseTitle: "후회 없는 선택이 되도록 결과로 만족을 드리겠습니다.",
  promiseDescription: "필요한 DB를 빠르게 확인하고 상담으로 가장 적합한 방식으로 진행해보세요.",
  promisePrimary: "상품 보러가기",
  promiseSecondary: "지금 상담하기",
};

export const landingCopyByLocale: Record<Locale, LandingCopy> = {
  ko: koLandingCopy,
  en: koLandingCopy,
  ja: koLandingCopy,
  zh: koLandingCopy,
};

export type { LandingCopy };
