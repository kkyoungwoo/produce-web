import "server-only";

import type { ArchhubCollectTarget } from "@/lib/archhub/regions";
import { getArchhubSigunguFullName } from "@/lib/archhub/regions";

type ParsedUpstreamResult = {
  resultCode: string;
  resultMsg: string;
  pageNo: number;
  numOfRows: number;
  totalCount: number;
  rows: Record<string, unknown>[];
};

type UpstreamRequestResult =
  | {
      ok: true;
      status: number;
      sourceUrl: string;
      result: ParsedUpstreamResult;
    }
  | {
      ok: false;
      status: number;
      sourceUrl: string;
      upstream: string;
      result?: ParsedUpstreamResult;
    };

type FetchAllRowsResult =
  | {
      ok: true;
      sourceUrl: string;
      totalCount: number;
      rows: Record<string, unknown>[];
    }
  | {
      ok: false;
      status: number;
      sourceUrl: string;
      message: string;
      upstream: string;
    };

type ServiceFamily = {
  key: "hs" | "arch";
  dongEndpoint: string;
  basisEndpoint: string;
};

type CollectArchhubRowsInput = {
  serviceKey: string;
  startDate: string;
  endDate: string;
  targets: ArchhubCollectTarget[];
};

type CollectArchhubRowsResult = {
  endpointFamily: ServiceFamily["key"];
  sourceUrl: string;
  searchedTargetCount: number;
  rows: Array<Record<string, string | number>>;
};

const FETCH_TIMEOUT_MS = 15000;
const PAGE_SIZE = 100;
const MAX_PAGE_FETCH = 200;
const REQUEST_DELAY_MS = 250;
const CONCURRENCY = 1;

const MAX_REQUEST_RETRIES = 3;

const SERVICE_FAMILIES: ServiceFamily[] = [
  {
    key: "hs",
    dongEndpoint: "https://apis.data.go.kr/1613000/HsPmsHubService/getHpDongOulnInfo",
    basisEndpoint: "https://apis.data.go.kr/1613000/HsPmsHubService/getHpBasisOulnInfo",
  },
  {
    key: "arch",
    dongEndpoint: "https://apis.data.go.kr/1613000/ArchPmsHubService/getApDongOulnInfo",
    basisEndpoint: "https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo",
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

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
      row[fieldMatch[1]] = decodeXmlText(fieldMatch[2]);
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

function parseUpstream(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJsonRows(trimmed);
  return parseXmlRows(text);
}

function isCredentialError(result: UpstreamRequestResult | FetchAllRowsResult) {
  if (!result.ok && (result.status === 401 || result.status === 403)) return true;
  const text = result.ok ? "" : `${result.upstream} ${(result as { message?: string }).message ?? ""}`.toLowerCase();
  return (
    text.includes("service key")
    || text.includes("servicekey")
    || text.includes("인증키")
    || text.includes("등록되지 않은")
    || text.includes("forbidden")
  );
}

async function requestUpstream(endpoint: string, query: Record<string, string>): Promise<UpstreamRequestResult> {
  const url = buildUrl(endpoint, query);
  let lastFailure: UpstreamRequestResult | null = null;

  for (let attempt = 0; attempt < MAX_REQUEST_RETRIES; attempt += 1) {
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
        lastFailure = {
          ok: false,
          status: response.status,
          sourceUrl: url.toString(),
          upstream: text.slice(0, 1500),
        };

        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < MAX_REQUEST_RETRIES - 1) {
          await sleep(350 * (attempt + 1));
          continue;
        }

        return lastFailure;
      }

      return {
        ok: true,
        status: response.status,
        sourceUrl: url.toString(),
        result: parseUpstream(text),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      lastFailure = {
        ok: false,
        status: 599,
        sourceUrl: url.toString(),
        upstream: message,
      };

      if (attempt < MAX_REQUEST_RETRIES - 1) {
        await sleep(350 * (attempt + 1));
        continue;
      }

      return lastFailure;
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastFailure ?? {
    ok: false,
    status: 599,
    sourceUrl: url.toString(),
    upstream: "Unknown upstream error",
  };
}

async function fetchAllRows(endpoint: string, params: Record<string, string>): Promise<FetchAllRowsResult> {
  const rows: Record<string, unknown>[] = [];
  let totalCount = 0;
  let sourceUrl = "";

  for (let page = 1; page <= MAX_PAGE_FETCH; page += 1) {
    const response = await requestUpstream(endpoint, {
      ...params,
      _type: "json",
      pageNo: String(page),
      numOfRows: String(PAGE_SIZE),
    });

    sourceUrl = response.sourceUrl;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        sourceUrl: response.sourceUrl,
        message: `공공 API 호출에 실패했습니다. (HTTP ${response.status})`,
        upstream: response.upstream,
      };
    }

    const successCodes = new Set(["", "0", "00"]);
    if (!successCodes.has(response.result.resultCode)) {
      return {
        ok: false,
        status: 502,
        sourceUrl: response.sourceUrl,
        message: `공공 API 오류(${response.result.resultCode}): ${response.result.resultMsg || "알 수 없는 오류"}`,
        upstream: JSON.stringify(response.result),
      };
    }

    totalCount = response.result.totalCount || totalCount;
    if (response.result.rows.length === 0) break;

    rows.push(...response.result.rows);

    const lastItemOnPage = page * PAGE_SIZE;
    if (totalCount > 0 && lastItemOnPage >= totalCount) break;
  }

  return {
    ok: true,
    sourceUrl,
    totalCount,
    rows,
  };
}

async function probeServiceFamily(family: ServiceFamily, params: Record<string, string>): Promise<UpstreamRequestResult> {
  const response = await requestUpstream(family.dongEndpoint, {
    ...params,
    _type: "json",
    pageNo: "1",
    numOfRows: "1",
  });

  if (!response.ok) {
    return response;
  }

  const successCodes = new Set(["", "0", "00"]);
  if (!successCodes.has(response.result.resultCode)) {
    return {
      ok: false,
      status: 502,
      sourceUrl: response.sourceUrl,
      upstream: JSON.stringify(response.result),
      result: response.result,
    };
  }

  return response;
}

async function resolveServiceFamily(serviceKey: string, startDate: string, endDate: string, sampleTarget: ArchhubCollectTarget) {
  const params = {
    serviceKey,
    sigunguCd: sampleTarget.sigunguCode,
    bjdongCd: sampleTarget.bjdongCode,
    startDate,
    endDate,
  };

  let lastFailure: UpstreamRequestResult | null = null;

  for (const family of SERVICE_FAMILIES) {
    const probe = await probeServiceFamily(family, params);
    if (probe.ok) return family;
    lastFailure = probe;
    if (!isCredentialError(probe) && family.key === "arch") {
      throw new Error(`공공 API 연결에 실패했습니다. (HTTP ${probe.status})`);
    }
  }

  throw new Error(lastFailure ? `공공 API 연결에 실패했습니다. (HTTP ${lastFailure.status})` : "사용 가능한 건축HUB 엔드포인트를 찾지 못했습니다.");
}

function buildPermitKey(row: Record<string, unknown>) {
  return (
    toText(row.mgmHsrgstPk)
    || toText(row.mgmPmsrgstPk)
    || [
      toText(row.sigunguCd),
      toText(row.bjdongCd),
      toText(row.bun),
      toText(row.ji),
      toText(row.bldNm),
      toText(row.dongNm),
    ].join("|")
  );
}

function hasPositive(value: unknown) {
  const n = Number.parseFloat(toText(value));
  return Number.isFinite(n) && n > 0;
}

function mapArchhubRow(row: Record<string, unknown>, fallbackAgency: string) {
  const permitNo = toText(row.mgmPmsrgstPk) || toText(row.mgmHsrgstPk);
  const mainPurps = toText(row.mainPurpsCdNm) || toText(row.purpsCdNm);
  const archArea = toText(row.archArea) || toText(row.archGbCdNm);
  const totArea = toText(row.totArea);
  const vlArea = toText(row.vlRatEstmTotArea);
  const sigunguCd = toText(row.sigunguCd);
  const agency = getArchhubSigunguFullName(sigunguCd) || fallbackAgency;

  return {
    permitType: toText(row.pmsGbCdNm) || toText(row.archGbCdNm) || "건축허가",
    permitNo,
    permitReportDate: toText(row.apprvDay) || toText(row.crtnDay),
    agency,
    buildType: toText(row.mainAtchGbCdNm) || "주건축물",
    siteLocation: toText(row.platPlc),
    landCategory: toText(row.jimok),
    siteArea: toText(row.platArea),
    buildingArea1: archArea,
    buildingCoverageRatio: toText(row.bcRat),
    totalFloorArea1: totArea,
    floorAreaForRatio1: vlArea,
    floorAreaRatio: toText(row.vlRat),
    buildingName: toText(row.bldNm),
    mainUsage1: mainPurps,
    mainBuildingCount: toText(row.mainBldCnt),
    annexBuildingCount: toText(row.atchBldCnt),
    parkingAutoIndoor: toText(row.indrAutoUtcnt) || toText(row.indrMechUtcnt),
    parkingAutoOutdoor: toText(row.oudrAutoUtcnt) || toText(row.oudrMechUtcnt),
    parkingAutoNearby: toText(row.indrAutoEtcCnt),
    parkingMachineIndoor: toText(row.indrMechUtcnt),
    parkingMachineOutdoor: toText(row.oudrMechUtcnt),
    parkingMachineNearby: toText(row.oudrAutoEtcCnt),
    parkingExempt: toText(row.pmsDayExemptCnt) || "0",
    constructionType: toText(row.stcnsGbCdNm) || "신축",
    constructionPlannedDate: toText(row.stcnsSchedDay),
    constructionActualDate: toText(row.stcnsDay),
    useApprovalType: toText(row.useAprvGbCdNm) || "사용승인",
    useApprovalDate: toText(row.useInsptDay) || toText(row.useInsptSchedDay),
    dongName: toText(row.dongNm),
    mainUsage2: mainPurps,
    etcUsage: toText(row.etcPurps),
    householdCount: toText(row.hhldCnt) || toText(row.totHhldCnt),
    hoCount: toText(row.hoCnt),
    familyCount: toText(row.fmlyCnt),
    structureMain: toText(row.strctCdNm),
    structureEtc: toText(row.etcStrct),
    roofStructure: toText(row.roofCdNm),
    buildingArea2: archArea,
    totalFloorArea2: totArea,
    floorAreaForRatio2: vlArea,
    undergroundFloors: toText(row.ugrndFlrCnt),
    groundFloors: toText(row.grndFlrCnt),
    heightM: toText(row.heit),
    passengerElevators: toText(row.rideUseElvtCnt),
    emergencyElevators: toText(row.emgenUseElvtCnt),
    hasPassengerElevator: hasPositive(row.rideUseElvtCnt) ? "Y" : "N",
    hasEmergencyElevator: hasPositive(row.emgenUseElvtCnt) ? "Y" : "N",
  };
}

async function collectTargetRows(
  family: ServiceFamily,
  target: ArchhubCollectTarget,
  params: { serviceKey: string; startDate: string; endDate: string },
) {
  const requestParams = {
    serviceKey: params.serviceKey,
    sigunguCd: target.sigunguCode,
    bjdongCd: target.bjdongCode,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  await sleep(REQUEST_DELAY_MS);
  const dongResponse = await fetchAllRows(family.dongEndpoint, requestParams);
  if (!dongResponse.ok) {
    throw new Error(dongResponse.message);
  }

  if (dongResponse.rows.length === 0) {
    return { sourceUrl: dongResponse.sourceUrl, rows: [] as Array<Record<string, string | number>> };
  }

  await sleep(REQUEST_DELAY_MS);
  const basisResponse = await fetchAllRows(family.basisEndpoint, requestParams);
  const basisRows = basisResponse.ok ? basisResponse.rows : [];

  const basisMap = new Map<string, Record<string, unknown>>();
  for (const row of basisRows) {
    basisMap.set(buildPermitKey(row), row);
  }

  const mappedRows = dongResponse.rows.map((row) => {
    const basisRow = basisMap.get(buildPermitKey(row)) ?? {};
    return mapArchhubRow({ ...basisRow, ...row }, target.sigunguFullName);
  });

  return {
    sourceUrl: dongResponse.sourceUrl,
    rows: mappedRows,
  };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  if (items.length === 0) return [] as R[];

  const results = new Array<R>(items.length);
  let index = 0;

  async function runner() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

export async function collectArchhubRows(input: CollectArchhubRowsInput): Promise<CollectArchhubRowsResult> {
  const { serviceKey, startDate, endDate, targets } = input;

  if (targets.length === 0) {
    throw new Error("조회할 법정동 대상이 없습니다.");
  }

  const family = await resolveServiceFamily(serviceKey, startDate, endDate, targets[0]);
  const collected = await runWithConcurrency(targets, CONCURRENCY, async (target) => {
    try {
      const result = await collectTargetRows(family, target, { serviceKey, startDate, endDate });
      return { ...result, error: "" };
    } catch (error) {
      return {
        sourceUrl: "",
        rows: [] as Array<Record<string, string | number>>,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const deduped = new Map<string, Record<string, string | number>>();
  let sourceUrl = "";
  let firstError = "";

  for (const item of collected) {
    if (!sourceUrl && item.sourceUrl) sourceUrl = item.sourceUrl;
    if (!firstError && item.error) firstError = item.error;

    for (const row of item.rows) {
      const key = [
        toText(row.permitNo),
        toText(row.siteLocation),
        toText(row.dongName),
        toText(row.buildingName),
      ].join("|");
      if (!deduped.has(key)) deduped.set(key, row);
    }
  }

  if (deduped.size === 0 && firstError) {
    throw new Error(firstError);
  }

  return {
    endpointFamily: family.key,
    sourceUrl,
    searchedTargetCount: targets.length,
    rows: Array.from(deduped.values()),
  };
}