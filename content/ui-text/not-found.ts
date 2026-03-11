import type { Locale } from "@/lib/i18n/config";

type NotFoundCopy = {
  codeLabel: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  tipsTitle: string;
  tips: string[];
};

const koNotFoundCopy: NotFoundCopy = {
  codeLabel: "ERROR 404",
  title: "요청한 페이지를 찾지 못했습니다",
  description: "주소가 변경되었거나 삭제된 페이지입니다. 아래 버튼으로 DB 상품 목록 또는 홈으로 이동해 주세요.",
  primaryCta: "DB 상품 보기",
  secondaryCta: "홈으로 이동",
  tipsTitle: "빠른 이동",
  tips: ["서비스 페이지에서 상품별 상세 확인", "카카오톡 상담으로 요구사항 전달", "사용하기 페이지에서 워크벤치 테스트"],
};

export const notFoundCopyByLocale: Record<Locale, NotFoundCopy> = {
  ko: koNotFoundCopy,
  en: koNotFoundCopy,
  ja: koNotFoundCopy,
  zh: koNotFoundCopy,
};

export type { NotFoundCopy };