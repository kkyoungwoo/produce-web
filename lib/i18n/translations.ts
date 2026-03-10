import en from "./locales/en";
import ja from "./locales/ja";
import ko from "./locales/ko";
import zh from "./locales/zh";

import type { Locale } from "./config";
import type { DeepPartial, LocaleContent } from "./types";

const overrides: Partial<Record<Locale, DeepPartial<LocaleContent>>> = {
  ko,
  en,
  ja,
  zh,
};

function mergeDeep<T>(base: T, patch?: DeepPartial<T>): T {
  if (!patch) return base;

  if (Array.isArray(base)) {
    if (!Array.isArray(patch) || patch.length === 0) {
      return base;
    }
    return patch as T;
  }

  if (typeof base === "object" && base !== null) {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const key of Object.keys(patch as Record<string, unknown>)) {
      const patchValue = (patch as Record<string, unknown>)[key];
      const baseValue = (base as Record<string, unknown>)[key];

      if (patchValue === undefined) {
        continue;
      }

      if (
        patchValue &&
        typeof patchValue === "object" &&
        !Array.isArray(patchValue) &&
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        result[key] = mergeDeep(baseValue, patchValue as DeepPartial<typeof baseValue>);
      } else {
        result[key] = patchValue;
      }
    }

    return result as T;
  }

  return (patch as T) ?? base;
}

export const content = {
  ko,
  en: mergeDeep(ko, overrides.en),
  ja: mergeDeep(ko, overrides.ja),
  zh: mergeDeep(ko, overrides.zh),
} satisfies Record<Locale, LocaleContent>;

export function getLocaleContent(locale: Locale): LocaleContent {
  return content[locale] ?? ko;
}
