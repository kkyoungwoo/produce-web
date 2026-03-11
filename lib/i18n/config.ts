export const allLocales = ["ko", "en", "ja", "zh"] as const;

export type Locale = (typeof allLocales)[number];

export const locales: Locale[] = ["ko"];

export const defaultLocale: Locale = "ko";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
