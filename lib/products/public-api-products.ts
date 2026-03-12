import { productCatalog } from "@/content/db-products";
import type { Locale } from "@/lib/i18n/config";
import type { CollectorKey, ProductApiCredential, ProductInputField, ProductItem, ProductWorkbenchConfig } from "@/lib/i18n/types";

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

  return (
    isNonEmptyString(candidate.key)
    && isNonEmptyString(candidate.label)
    && typeof candidate.example === "string"
  );
}

function isValidApiCredential(credential: ProductApiCredential | undefined): boolean {
  if (!credential) return true;

  return isNonEmptyString(credential.envVarName)
    && isNonEmptyString(credential.queryKey)
    && isNonEmptyString(credential.placeholder);
}

function isValidWorkbenchConfig(workbench: ProductWorkbenchConfig | undefined): boolean {
  if (!workbench) return true;

  const hasColumns = Array.isArray(workbench.columns) && workbench.columns.length > 0;
  const hasRows = Array.isArray(workbench.rows);

  return hasColumns && hasRows;
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

const validProductsKo = productCatalog.filter(isValidProductItem);
const primaryProductSlug = validProductsKo[0]?.slug ?? "api-15086411";

const legacySlugs = [
  "api-15154910",
  "api-15136267",
];

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
  const normalizedSlug = normalizeSlug(slug);
  return getPublicApiProducts(locale).find((item) => item.slug === normalizedSlug);
}

export function getPublicApiProductSlugs(locale: Locale): string[] {
  const currentSlugs = getPublicApiProducts(locale).map((item) => item.slug);
  return Array.from(new Set([...currentSlugs, ...legacySlugs]));
}

export function getApiCredentialBySlug(locale: Locale, slug: string): ProductApiCredential | undefined {
  return getPublicApiProductBySlug(locale, slug)?.apiCredential;
}