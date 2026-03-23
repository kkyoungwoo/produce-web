
export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function buildQueryString(searchParams?: SearchParamsRecord) {
  const query = new URLSearchParams();
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) return value.forEach((item) => typeof item === 'string' && item && query.append(key, item));
    if (typeof value === 'string' && value) query.set(key, value);
  });
  const built = query.toString();
  return built ? `?${built}` : '';
}
