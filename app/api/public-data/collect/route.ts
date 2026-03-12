import { NextResponse } from "next/server";

type CollectBody = {
  endpoint?: string;
  historyEndpoint?: string;
  historySwitchParamKey?: string;
  params?: Record<string, string>;
  serviceKeyEnvVar?: string;
  serviceKeyQueryKey?: string;
  forcedQuery?: Record<string, string>;
};

type ParsedUpstreamResult = {
  resultCode: string;
  resultMsg: string;
  pageNo: number;
  numOfRows: number;
  totalCount: number;
  rows: Record<string, unknown>[];
};

const MIN_INTERVAL_MS = 1200;
const FETCH_TIMEOUT_MS = 15000;
const MAX_PAGE_FETCH = 400;
const MAX_TOTAL_ROWS = 200_000;

const lastRequestMap = new Map<string, number>();

function buildUrl(endpoint: string, query: Record<string, string>) {
  const url = new URL(endpoint);

  for (const [key, value] of Object.entries(query)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }

  return url;
}

function decodeXmlText(input: string) {
  return input
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readTagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return decodeXmlText(match[1]);
}

function asInt(value: string | number, defaultValue = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseXmlRows(xml: string): ParsedUpstreamResult {
  const resultCode = readTagValue(xml, "resultCode");
  const resultMsg = readTagValue(xml, "resultMsg");
  const pageNo = asInt(readTagValue(xml, "pageNo"), 1);
  const numOfRows = asInt(readTagValue(xml, "numOfRows"), 0);
  const totalCount = asInt(readTagValue(xml, "totalCount"), 0);

  const itemsSectionMatch = xml.match(/<items>([\s\S]*?)<\/items>/i);
  const itemsSection = itemsSectionMatch?.[1] ?? "";
  const itemMatches = Array.from(itemsSection.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  const rows = itemMatches.map((itemMatch) => {
    const rowXml = itemMatch[1];
    const row: Record<string, unknown> = {};

    const fieldMatches = Array.from(rowXml.matchAll(/<([a-zA-Z0-9_:-]+)>([\s\S]*?)<\/\1>/g));
    for (const fieldMatch of fieldMatches) {
      const key = fieldMatch[1];
      const value = decodeXmlText(fieldMatch[2]);
      row[key] = value;
    }

    return row;
  });

  return {
    resultCode,
    resultMsg,
    pageNo,
    numOfRows,
    totalCount,
    rows,
  };
}

function parseJsonRows(raw: string): ParsedUpstreamResult {
  const parsed = JSON.parse(raw) as {
    response?: {
      header?: { resultCode?: string | number; resultMsg?: string };
      body?: {
        pageNo?: string | number;
        numOfRows?: string | number;
        totalCount?: string | number;
        items?: { item?: Record<string, unknown> | Record<string, unknown>[] };
      };
    };
  };

  const header = parsed.response?.header ?? {};
  const body = parsed.response?.body ?? {};
  const rawItems = body.items?.item;

  const rows = Array.isArray(rawItems)
    ? rawItems
    : rawItems && typeof rawItems === "object"
      ? [rawItems]
      : [];

  return {
    resultCode: String(header.resultCode ?? ""),
    resultMsg: String(header.resultMsg ?? ""),
    pageNo: asInt(body.pageNo ?? 1, 1),
    numOfRows: asInt(body.numOfRows ?? 0, 0),
    totalCount: asInt(body.totalCount ?? 0, 0),
    rows,
  };
}

function parseUpstream(text: string): ParsedUpstreamResult {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonRows(trimmed);
  }

  return parseXmlRows(text);
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, MAX_TOTAL_ROWS).map((row) => {
    const normalized: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number") {
        normalized[key] = value;
      } else if (typeof value === "string") {
        normalized[key] = value;
      } else if (value === null || value === undefined) {
        normalized[key] = "";
      } else {
        normalized[key] = JSON.stringify(value);
      }
    }

    return normalized;
  });
}

function getClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return forwarded.split(",")[0].trim();
}

async function requestUpstream(url: URL) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: abortController.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        text,
      };
    }

    return {
      ok: true as const,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const clientKey = getClientKey(request);
    const now = Date.now();
    const last = lastRequestMap.get(clientKey) ?? 0;

    if (now - last < MIN_INTERVAL_MS) {
      return NextResponse.json({ ok: false, message: "요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    lastRequestMap.set(clientKey, now);

    const body = (await request.json()) as CollectBody;
    if (!body.endpoint) {
      return NextResponse.json({ ok: false, message: "서버 설정 오류: 엔드포인트가 없습니다." }, { status: 400 });
    }

    const mergedParams: Record<string, string> = {
      ...(body.params ?? {}),
      ...(body.forcedQuery ?? {}),
    };

    const serviceKeyQueryKey = body.serviceKeyQueryKey || "serviceKey";
    if (!mergedParams[serviceKeyQueryKey] && body.serviceKeyEnvVar) {
      const envKey = process.env[body.serviceKeyEnvVar];
      if (envKey) {
        mergedParams[serviceKeyQueryKey] = envKey;
      }
    }

    if (!mergedParams[serviceKeyQueryKey]) {
      return NextResponse.json({ ok: false, message: "인증키(serviceKey)가 없습니다. 인증키를 입력해 주세요." }, { status: 400 });
    }

    const historyKey = body.historySwitchParamKey?.trim();
    const hasBaseDate = Boolean(historyKey && mergedParams[historyKey]);
    const hasRegionForHistory = Boolean(String(mergedParams["cond[OPN_ATMY_GRP_CD::EQ]"] ?? "").trim());
    const useHistory = Boolean(hasBaseDate && (!historyKey || historyKey !== "cond[BASE_DATE::EQ]" || hasRegionForHistory));
    const selectedEndpoint = useHistory && body.historyEndpoint ? body.historyEndpoint : body.endpoint;

    const requestedPageNo = Math.max(1, asInt(mergedParams.pageNo || "1", 1));
    const endpointLimit = (
      selectedEndpoint.includes("foreigner_city_homestays")
      || selectedEndpoint.includes("foreigners_entertainment_restaurants")
    ) ? 100 : 500;
    const requestedNumOfRows = Math.min(Math.max(asInt(mergedParams.numOfRows || "50", 50), 1), endpointLimit);

    const regionKey = "cond[OPN_ATMY_GRP_CD::EQ]";
    const regionTokens = String(mergedParams[regionKey] ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    const targetRegions = regionTokens.length > 0 ? Array.from(new Set(regionTokens)) : [""];

    let totalCount = 0;
    const allRows: Record<string, unknown>[] = [];
    let firstUrl = "";

    for (const regionCode of targetRegions) {
      let currentPage = requestedPageNo;
      let perRegionCount = 0;

      for (let pageIndex = 0; pageIndex < MAX_PAGE_FETCH; pageIndex += 1) {
        const baseParams = { ...mergedParams };
        if (!useHistory && historyKey) delete baseParams[historyKey];
        if (regionCode) baseParams[regionKey] = regionCode;

        const pageParams = {
          ...baseParams,
          pageNo: String(currentPage),
          numOfRows: String(requestedNumOfRows),
        };
        const targetUrl = buildUrl(selectedEndpoint, pageParams);
        if (!firstUrl) {
          firstUrl = targetUrl.toString();
        }

        let upstream;
        try {
          upstream = await requestUpstream(targetUrl);
        } catch {
          return NextResponse.json(
            {
              ok: false,
              message: "공공 API 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
              sourceUrl: targetUrl.toString(),
            },
            { status: 502 },
          );
        }

        if (!upstream.ok) {
          return NextResponse.json(
            {
              ok: false,
              message: `공공 API 호출에 실패했습니다. (HTTP ${upstream.status})`,
              sourceUrl: targetUrl.toString(),
              upstream: upstream.text.slice(0, 1000),
            },
            { status: 502 },
          );
        }

        const parsed = parseUpstream(upstream.text);

        const successCodes = new Set(["", "0", "00"]);
        if (!successCodes.has(parsed.resultCode)) {
          return NextResponse.json(
            {
              ok: false,
              message: `공공 API 오류(${parsed.resultCode}): ${parsed.resultMsg || "알 수 없는 오류"}`,
              sourceUrl: targetUrl.toString(),
            },
            { status: 502 },
          );
        }

        if (parsed.totalCount > 0) {
          perRegionCount = parsed.totalCount;
        }

        if (parsed.rows.length === 0) {
          break;
        }

        allRows.push(...parsed.rows);

        if (allRows.length >= MAX_TOTAL_ROWS) {
          break;
        }

        if (perRegionCount > 0 && (currentPage - requestedPageNo + 1) * requestedNumOfRows >= perRegionCount) {
          break;
        }

        currentPage += 1;
      }

      totalCount += perRegionCount;

      if (allRows.length >= MAX_TOTAL_ROWS) {
        break;
      }
    }

    const dedupedRows = Array.from(
      new Map(
        allRows.map((row) => {
          const keyParts = [
            String((row as Record<string, unknown>).MNG_NO ?? ""),
            String((row as Record<string, unknown>).BPLC_NM ?? ""),
            String((row as Record<string, unknown>).LCPMT_YMD ?? ""),
            String((row as Record<string, unknown>).ROAD_NM_ADDR ?? ""),
          ];
          const key = keyParts.some(Boolean) ? keyParts.join("|") : JSON.stringify(row);
          return [key, row] as const;
        }),
      ).values(),
    );

    const normalizedRows = normalizeRows(dedupedRows);

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: false, message: "조회 결과가 없습니다. 날짜/지역 조건을 확인해 주세요.", sourceUrl: firstUrl }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      rows: normalizedRows,
      totalCount: totalCount || normalizedRows.length,
      sourceUrl: firstUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message: `서버 처리 중 오류가 발생했습니다: ${message}` }, { status: 500 });
  }
}