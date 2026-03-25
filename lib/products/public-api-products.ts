import { productCatalog } from "@/content/db-products";
import type { Locale } from "@/lib/i18n/config";
import type {
  CollectorKey,
  ProductApiCredential,
  ProductInputField,
  ProductItem,
  ProductWorkbenchConfig,
} from "@/lib/i18n/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCollectorKey(value: unknown): value is CollectorKey {
  return value === "range-batch"
    || value === "condition-paging"
    || value === "schema-validated"
    || value === "realtime-filter"
    || value === "scheduled-pipeline";
}

function isValidInputField(field: unknown): field is ProductInputField {
  if (!field || typeof field !== "object") return false;
  const candidate = field as ProductInputField;
  return isNonEmptyString(candidate.key) && isNonEmptyString(candidate.label) && typeof candidate.example === "string";
}

function isValidApiCredential(credential: ProductApiCredential | undefined): boolean {
  if (!credential) return true;
  return isNonEmptyString(credential.envVarName) && isNonEmptyString(credential.queryKey) && isNonEmptyString(credential.placeholder);
}

function isValidWorkbenchConfig(workbench: ProductWorkbenchConfig | undefined): boolean {
  if (!workbench) return true;
  return Array.isArray(workbench.columns) && workbench.columns.length > 0 && Array.isArray(workbench.rows);
}

function isValidProductItem(item: unknown): item is ProductItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as ProductItem;
  return (
    isNonEmptyString(candidate.slug)
    && isCollectorKey(candidate.collectorKey)
    && isNonEmptyString(candidate.title)
    && isNonEmptyString(candidate.summary)
    && isNonEmptyString(candidate.description)
    && isNonEmptyString(candidate.status)
    && isNonEmptyString(candidate.priceLabel)
    && Number.isFinite(candidate.priceValue)
    && candidate.priceValue > 0
    && isNonEmptyString(candidate.delivery)
    && isNonEmptyString(candidate.audience)
    && isNonEmptyString(candidate.portalDataId)
    && isNonEmptyString(candidate.apiDocUrl)
    && isNonEmptyString(candidate.accountGuideUrl)
    && isNonEmptyString(candidate.collectFocus)
    && isNonEmptyString(candidate.sampleRequest)
    && Array.isArray(candidate.stack)
    && candidate.stack.length > 0
    && candidate.stack.every(isNonEmptyString)
    && Array.isArray(candidate.features)
    && candidate.features.length > 0
    && candidate.features.every(isNonEmptyString)
    && Array.isArray(candidate.inputFields)
    && candidate.inputFields.length > 0
    && candidate.inputFields.every(isValidInputField)
    && isValidApiCredential(candidate.apiCredential)
    && isValidWorkbenchConfig(candidate.workbench)
  );
}


function normalizeProductCopy(product: ProductItem): ProductItem {
  return {
    ...product,
    status: product.status || "분석 가능",
    priceLabel: product.priceLabel || `Data ID ${product.portalDataId}`,
    delivery: product.delivery || "조건 입력 후 바로 조회",
    audience: product.audience || "시장 조사, 운영 분석, 지역 비교, 영업 기회 탐색",
    summary:
      product.summary ||
      `Data ID ${product.portalDataId} 기반 데이터를 날짜와 조건 중심으로 빠르게 확인할 수 있는 분석 페이지입니다.`,
    description:
      product.description ||
      `공공데이터포털 Data ID ${product.portalDataId} API를 바탕으로 필요한 조건의 데이터를 조회하고 표와 엑셀로 확인할 수 있습니다.`,
  };
}

const validProductsKo = productCatalog.filter(isValidProductItem).map(normalizeProductCopy);
const primaryProductSlug = validProductsKo[0]?.slug ?? "api-15086411";
const legacySlugs = ["api-15136267"];

function normalizeSlug(slug: string): string {
  if (slug === primaryProductSlug) return slug;
  if (legacySlugs.includes(slug)) return primaryProductSlug;
  return slug;
}

export function getPublicApiProducts(locale: Locale): ProductItem[] {
  void locale;
  return validProductsKo;
}

export function getPublicApiProductBySlug(locale: Locale, slug: string): ProductItem | undefined {
  return getPublicApiProducts(locale).find((item) => item.slug === normalizeSlug(slug));
}

export function getPublicApiProductSlugs(locale: Locale): string[] {
  const currentSlugs = getPublicApiProducts(locale).map((item) => item.slug);
  return Array.from(new Set([...currentSlugs, ...legacySlugs]));
}

export function getApiCredentialBySlug(locale: Locale, slug: string): ProductApiCredential | undefined {
  return getPublicApiProductBySlug(locale, slug)?.apiCredential;
}
