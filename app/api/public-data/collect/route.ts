import { NextResponse } from "next/server";

import { getPreviewServiceKeys } from "@/lib/public-data/preview-key";

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

type CollectAttemptSuccess = {
  ok: true;
  rows: Array<Record<string, string | number>>;
  totalCount: number;
  sourceUrl: string;
};

type CollectAttemptFailure = {
  ok: false;
  status: number;
  message: string;
  sourceUrl: string;
  upstream?: string;
  invalidKey: boolean;
};

type CollectAttemptResult = CollectAttemptSuccess | CollectAttemptFailure;

const MIN_INTERVAL_MS = 250;
const MAX_PAGE_FETCH = 400;
const FETCH_TIMEOUT_MS = 30000;
const MAX_TOTAL_ROWS = 300_000;
const PREVIEW_LIMIT = 5;

const lastRequestMap = new Map<string, number>();

const MSG_TOO_FAST = "요청 간격이 너무 짧습니다. 잠시 후 다시 시도해 주세요.";
const MSG_NO_ENDPOINT = "서버 설정 오류: 엔드포인트가 없습니다.";
const MSG_UPSTREAM_CONNECT_FAIL = "공공 API 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
const MSG_NO_RESULT = "조회 결과가 없습니다. 날짜/지역 조건을 확인해 주세요.";
const MSG_DEFAULT_PREVIEW = "인증키를 입력하지 않아 기본 인증키로 실제 데이터 미리보기 5건을 보여드립니다.";
const MSG_FALLBACK_PREVIEW = "입력한 인증키를 확인하지 못해 기본 인증키로 실제 데이터 미리보기 5건을 보여드립니다.";
const MSG_NO_DEFAULT_KEY = "인증키를 입력하면 전체 데이터를 조회할 수 있습니다. 현재 기본 인증키가 설정되어 있지 않습니다.";
const MSG_INVALID_KEY_NO_DEFAULT = "입력한 인증키를 확인하지 못했습니다. 올바른 인증키를 입력해 주세요.";

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

  return { resultCode, resultMsg, pageNo, numOfRows, totalCount, rows };
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
    header?: { resultCode?: string | number; resultMsg?: string };
    body?: {
      pageNo?: string | number;
      numOfRows?: string | number;
      totalCount?: string | number;
      items?: { item?: Record<string, unknown> | Record<string, unknown>[] };
    };
  };

  const header = parsed.response?.header ?? parsed.header ?? {};
  const body = parsed.response?.body ?? parsed.body ?? {};
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
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJsonRows(trimmed);
  return parseXmlRows(text);
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, MAX_TOTAL_ROWS).map((row) => {
    const normalized: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number") normalized[key] = value;
      else if (typeof value === "string") normalized[key] = value;
      else if (value === null || value === undefined) normalized[key] = "";
      else normalized[key] = JSON.stringify(value);
    }
    return normalized;
  });
}

function getClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return forwarded.split(",")[0].trim();
}

function isCredentialErrorMessage(text: string, status?: number) {
  const normalized = text.toLowerCase();
  if (status === 401 || status === 403) return true;

  return (
    normalized.includes("service key") ||
    normalized.includes("servicekey") ||
    normalized.includes("service key is not registered") ||
    normalized.includes("invalid service key") ||
    normalized.includes("forbidden") ||
    normalized.includes("인증키") ||
    normalized.includes("오류(-4)") ||
    normalized.includes("error code(-4)")
  );
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

    if (!response.ok) return { ok: false as const, status: response.status, text };
    return { ok: true as const, text };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeRows(rows: Record<string, unknown>[]) {
  return Array.from(
    new Map(
      rows.map((row) => {
        const normalizedRow = row as Record<string, unknown>;

        const keyParts = [
          String(normalizedRow.MNG_NO ?? normalizedRow.fctryManageNo ?? ""),
          String(normalizedRow.BPLC_NM ?? normalizedRow.cmpnyNm ?? ""),
          String(normalizedRow.LCPMT_YMD ?? normalizedRow.frstFctryRegistDe ?? ""),
          String(
            normalizedRow.ROAD_NM_ADDR ??
              normalizedRow.rnAdres ??
              normalizedRow.LOTNO_ADDR ??
              "",
          ),
          String(normalizedRow.irsttNm ?? ""),
        ];

        const key = keyParts.some(Boolean) ? keyParts.join("|") : JSON.stringify(row);
        return [key, row] as const;
      }),
    ).values(),
  );
}

async function collectWithKey(options: {
  endpoint: string;
  historyEndpoint?: string;
  historySwitchParamKey?: string;
  params: Record<string, string>;
  previewLimited: boolean;
}): Promise<CollectAttemptResult> {
  const { endpoint, historyEndpoint, historySwitchParamKey, params, previewLimited } = options;

  const historyKey = historySwitchParamKey?.trim();
  const hasBaseDate = Boolean(historyKey && params[historyKey]);
  const hasRegionForHistory = Boolean(String(params["cond[OPN_ATMY_GRP_CD::EQ]"] ?? "").trim());
  const useHistory = Boolean(
    hasBaseDate && (!historyKey || historyKey !== "cond[BASE_DATE::EQ]" || hasRegionForHistory),
  );
  const selectedEndpoint = useHistory && historyEndpoint ? historyEndpoint : endpoint;

  const requestedPageNo = previewLimited ? 1 : Math.max(1, asInt(params.pageNo || "1", 1));
const endpointLimit =
  selectedEndpoint.includes("foreigner_city_homestays") ||
  selectedEndpoint.includes("foreigners_entertainment_restaurants")
    ? 100
    : selectedEndpoint.includes("fctryRegistInfo")
      ? 500
      : 500;

  const requestedNumOfRows = previewLimited
    ? Math.min(PREVIEW_LIMIT, endpointLimit)
    : Math.min(Math.max(asInt(params.numOfRows || "50", 50), 1), endpointLimit);

  const regionKey = "cond[OPN_ATMY_GRP_CD::EQ]";
  const regionTokens = String(params[regionKey] ?? "")
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

    for (let pageIndex = 0; pageIndex < (previewLimited ? 1 : MAX_PAGE_FETCH); pageIndex += 1) {
      const baseParams = { ...params };

      if (!useHistory && historyKey) delete baseParams[historyKey];
      if (regionCode) baseParams[regionKey] = regionCode;

      const pageParams = {
        ...baseParams,
        pageNo: String(currentPage),
        numOfRows: String(requestedNumOfRows),
      };

      const targetUrl = buildUrl(selectedEndpoint, pageParams);
      if (!firstUrl) firstUrl = targetUrl.toString();

      let upstream;
      try {
        upstream = await requestUpstream(targetUrl);
      } catch {
        return {
          ok: false,
          status: 502,
          message: MSG_UPSTREAM_CONNECT_FAIL,
          sourceUrl: targetUrl.toString(),
          invalidKey: false,
        };
      }

      if (!upstream.ok) {
        const invalidKey = isCredentialErrorMessage(upstream.text, upstream.status);
        return {
          ok: false,
          status: invalidKey ? 401 : 502,
          message: invalidKey
            ? "인증키를 확인하지 못했습니다."
            : `공공 API 호출에 실패했습니다. (HTTP ${upstream.status})`,
          sourceUrl: targetUrl.toString(),
          upstream: upstream.text.slice(0, 1000),
          invalidKey,
        };
      }

      const parsed = parseUpstream(upstream.text);
      const successCodes = new Set(["", "0", "00"]);

      if (!successCodes.has(parsed.resultCode)) {
        const detail = `${parsed.resultCode} ${parsed.resultMsg || ""}`;
        const invalidKey = isCredentialErrorMessage(detail);

        return {
          ok: false,
          status: invalidKey ? 401 : 502,
          message: invalidKey
            ? "인증키를 확인하지 못했습니다."
            : `공공 API 오류(${parsed.resultCode}): ${parsed.resultMsg || "알 수 없는 오류"}`,
          sourceUrl: targetUrl.toString(),
          invalidKey,
        };
      }

      if (parsed.totalCount > 0) perRegionCount = parsed.totalCount;
      if (parsed.rows.length === 0) break;

      allRows.push(...parsed.rows);

      if (allRows.length >= (previewLimited ? PREVIEW_LIMIT : MAX_TOTAL_ROWS)) break;

      if (previewLimited) {
        break;
      }

      if (
        perRegionCount > 0 &&
        (currentPage - requestedPageNo + 1) * requestedNumOfRows >= perRegionCount
      ) {
        break;
      }

      currentPage += 1;
    }

    totalCount += perRegionCount;
    if (allRows.length >= (previewLimited ? PREVIEW_LIMIT : MAX_TOTAL_ROWS)) break;
  }

  const normalizedRows = normalizeRows(dedupeRows(allRows)).slice(
    0,
    previewLimited ? PREVIEW_LIMIT : MAX_TOTAL_ROWS,
  );

  if (normalizedRows.length === 0) {
    return {
      ok: false,
      status: 404,
      message: MSG_NO_RESULT,
      sourceUrl: firstUrl,
      invalidKey: false,
    };
  }

  return {
    ok: true,
    rows: normalizedRows,
    totalCount: previewLimited ? normalizedRows.length : totalCount || normalizedRows.length,
    sourceUrl: firstUrl,
  };
}

export async function POST(request: Request) {
  try {
    const clientKey = getClientKey(request);
    const now = Date.now();
    const last = lastRequestMap.get(clientKey) ?? 0;

    if (now - last < MIN_INTERVAL_MS) {
      return NextResponse.json({ ok: false, message: MSG_TOO_FAST }, { status: 429 });
    }
    lastRequestMap.set(clientKey, now);

    const body = (await request.json()) as CollectBody;

    if (!body.endpoint) {
      return NextResponse.json({ ok: false, message: MSG_NO_ENDPOINT }, { status: 400 });
    }

    const params: Record<string, string> = {
      ...(body.params ?? {}),
      ...(body.forcedQuery ?? {}),
    };

    const serviceKeyQueryKey = body.serviceKeyQueryKey || "serviceKey";
    const userServiceKey = String(params[serviceKeyQueryKey] ?? "").trim();
    const envServiceKey = body.serviceKeyEnvVar
      ? String(process.env[body.serviceKeyEnvVar] ?? "").trim()
      : "";

    const previewServiceKeys = getPreviewServiceKeys(envServiceKey);

    const runCollect = async (serviceKey: string, previewLimited: boolean) =>
      collectWithKey({
        endpoint: body.endpoint!,
        historyEndpoint: body.historyEndpoint,
        historySwitchParamKey: body.historySwitchParamKey,
        params: {
          ...params,
          [serviceKeyQueryKey]: serviceKey,
        },
        previewLimited,
      });

    const runPreviewCollect = async () => {
      for (const previewServiceKey of previewServiceKeys) {
        const attempt = await runCollect(previewServiceKey, true);

        if (attempt.ok) {
          return { kind: "ok" as const, attempt };
        }
        if (attempt.status === 404) {
          return { kind: "empty" as const, attempt };
        }
        if (attempt.invalidKey) {
          continue;
        }

        return { kind: "error" as const, attempt };
      }

      return null;
    };

    if (userServiceKey) {
      const userAttempt = await runCollect(userServiceKey, false);

      if (userAttempt.ok) {
        return NextResponse.json({
          ok: true,
          rows: userAttempt.rows,
          totalCount: userAttempt.totalCount,
          sourceUrl: userAttempt.sourceUrl,
          previewLimited: false,
          authStatus: "full",
        });
      }

      if (!userAttempt.invalidKey) {
        return NextResponse.json(
          {
            ok: false,
            message: userAttempt.message,
            sourceUrl: userAttempt.sourceUrl,
            upstream: userAttempt.upstream,
          },
          { status: userAttempt.status },
        );
      }

      const previewResult = await runPreviewCollect();

      if (previewResult?.kind === "ok") {
        return NextResponse.json({
          ok: true,
          rows: previewResult.attempt.rows,
          totalCount: previewResult.attempt.totalCount,
          sourceUrl: previewResult.attempt.sourceUrl,
          previewLimited: true,
          previewCount: PREVIEW_LIMIT,
          authStatus: "fallback-preview",
          message: MSG_FALLBACK_PREVIEW,
        });
      }

      if (previewResult?.kind === "empty") {
        return NextResponse.json({
          ok: true,
          rows: [],
          totalCount: 0,
          sourceUrl: previewResult.attempt.sourceUrl,
          previewLimited: true,
          previewCount: PREVIEW_LIMIT,
          authStatus: "fallback-preview",
          message: `${MSG_FALLBACK_PREVIEW} ${MSG_NO_RESULT}`,
        });
      }

      if (previewResult?.kind === "error") {
        return NextResponse.json(
          {
            ok: false,
            message: previewResult.attempt.message,
            sourceUrl: previewResult.attempt.sourceUrl,
            upstream: previewResult.attempt.upstream,
          },
          { status: previewResult.attempt.status },
        );
      }

      return NextResponse.json({
        ok: true,
        rows: [],
        totalCount: 0,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "missing-preview",
        message: MSG_INVALID_KEY_NO_DEFAULT,
      });
    }

    if (previewServiceKeys.length === 0) {
      return NextResponse.json({
        ok: true,
        rows: [],
        totalCount: 0,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "missing-preview",
        message: MSG_NO_DEFAULT_KEY,
      });
    }

    const previewResult = await runPreviewCollect();

    if (previewResult?.kind === "ok") {
      return NextResponse.json({
        ok: true,
        rows: previewResult.attempt.rows,
        totalCount: previewResult.attempt.totalCount,
        sourceUrl: previewResult.attempt.sourceUrl,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "default-preview",
        message: MSG_DEFAULT_PREVIEW,
      });
    }

    if (previewResult?.kind === "empty") {
      return NextResponse.json({
        ok: true,
        rows: [],
        totalCount: 0,
        sourceUrl: previewResult.attempt.sourceUrl,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "default-preview",
        message: `${MSG_DEFAULT_PREVIEW} ${MSG_NO_RESULT}`,
      });
    }

    if (previewResult?.kind === "error") {
      return NextResponse.json(
        {
          ok: false,
          message: previewResult.attempt.message,
          sourceUrl: previewResult.attempt.sourceUrl,
          upstream: previewResult.attempt.upstream,
        },
        { status: previewResult.attempt.status },
      );
    }

    return NextResponse.json({
      ok: true,
      rows: [],
      totalCount: 0,
      previewLimited: true,
      previewCount: PREVIEW_LIMIT,
      authStatus: "missing-preview",
      message: MSG_NO_DEFAULT_KEY,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
}
