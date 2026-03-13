import { NextResponse } from "next/server";

import { collectArchhubRows } from "@/lib/archhub/collector";
import { expandArchhubTargets } from "@/lib/archhub/regions";
import { FALLBACK_PREVIEW_SERVICE_KEY } from "@/lib/public-data/preview-key";

type ArchhubCollectBody = {
  serviceKey?: string;
  startDate?: string;
  endDate?: string;
  sigunguCodes?: string[];
  legalDongCodes?: string[];
};

const DEFAULT_ARCHHUB_SERVICE_KEY = String(process.env.DATA_GO_KR_SERVICE_KEY_15136560 ?? "").trim();
const PREVIEW_LIMIT = 5;
const MSG_DEFAULT_PREVIEW = "인증키를 입력하지 않아 실제 데이터 샘플 최대 5건을 보여드립니다.";
const MSG_FALLBACK_PREVIEW = "입력한 인증키를 확인하지 못해 실제 데이터 샘플 최대 5건을 보여드립니다.";
const MSG_NO_DEFAULT_KEY = "인증키를 입력하면 전체 데이터를 조회할 수 있습니다. 현재 미리보기용 기본 인증키가 설정되어 있지 않습니다.";
const MSG_INVALID_KEY_NO_DEFAULT = "입력한 인증키를 확인하지 못했습니다. 올바른 인증키를 입력해 주세요.";
const MSG_NO_RESULT = "조회 결과가 없습니다. 날짜 또는 지역 조건을 조정해 다시 시도해 주세요.";

function isYmd(value: string) {
  return /^\d{8}$/.test(value);
}

function shiftDate(value: string, days: number) {
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(4, 6), 10) - 1;
  const day = Number.parseInt(value.slice(6, 8), 10);
  const date = new Date(year, month, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function diffDays(startDate: string, endDate: string) {
  const start = new Date(Number.parseInt(startDate.slice(0, 4), 10), Number.parseInt(startDate.slice(4, 6), 10) - 1, Number.parseInt(startDate.slice(6, 8), 10));
  const end = new Date(Number.parseInt(endDate.slice(0, 4), 10), Number.parseInt(endDate.slice(4, 6), 10) - 1, Number.parseInt(endDate.slice(6, 8), 10));
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function isCredentialErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("service key")
    || normalized.includes("servicekey")
    || normalized.includes("forbidden")
    || normalized.includes("인증")
    || normalized.includes("등록되지")
    || normalized.includes("error code -4")
    || normalized.includes("service_key_is_not_registered_error")
  );
}

function buildPreviewKeys() {
  return Array.from(new Set([
    FALLBACK_PREVIEW_SERVICE_KEY.trim(),
    DEFAULT_ARCHHUB_SERVICE_KEY.trim(),
  ].filter(Boolean)));
}

function mergeRows(targets: Array<Record<string, string | number>>) {
  const map = new Map<string, Record<string, string | number>>();

  for (const row of targets) {
    const key = [
      String(row.permitNo ?? "").trim(),
      String(row.siteLocation ?? "").trim(),
      String(row.dongName ?? "").trim(),
      String(row.buildingName ?? "").trim(),
    ].join("|");

    if (!map.has(key)) map.set(key, row);
  }

  return Array.from(map.values());
}

async function runCollect(options: {
  serviceKey: string;
  startDate: string;
  endDate: string;
  sigunguCodes: string[];
  legalDongCodes: string[];
  previewLimited: boolean;
}) {
  const { serviceKey, startDate, endDate, sigunguCodes, legalDongCodes, previewLimited } = options;
  const targets = expandArchhubTargets({ sigunguCodes, legalDongCodes });
  if (targets.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "선택한 지역에 해당하는 법정동 코드가 없습니다.",
      invalidKey: false,
    };
  }

  const attempts = [{ startDate, endDate, usedDateFallback: false, fallbackDays: 0 }];
  const requestedDays = diffDays(startDate, endDate);

  if (requestedDays <= 14) {
    attempts.push({
      startDate: shiftDate(endDate, previewLimited ? -30 : -90),
      endDate,
      usedDateFallback: true,
      fallbackDays: previewLimited ? 30 : 90,
    });
  }

  if (requestedDays <= 31) {
    attempts.push({
      startDate: shiftDate(endDate, -365),
      endDate,
      usedDateFallback: true,
      fallbackDays: 365,
    });
  }

  const dedupedAttempts = attempts.filter((attempt, index, array) => array.findIndex((item) => item.startDate === attempt.startDate && item.endDate === attempt.endDate) === index);

  let lastError = MSG_NO_RESULT;
  let lastSourceUrl = "";
  let lastResult: Awaited<ReturnType<typeof collectArchhubRows>> | null = null;

  for (const attempt of dedupedAttempts) {
    try {
      const result = await collectArchhubRows({
        serviceKey,
        startDate: attempt.startDate,
        endDate: attempt.endDate,
        targets,
        maxRows: previewLimited ? PREVIEW_LIMIT : undefined,
      });

      lastResult = result;
      lastSourceUrl = result.sourceUrl;

      if (result.rows.length > 0) {
        return {
          ok: true as const,
          rows: previewLimited ? result.rows.slice(0, PREVIEW_LIMIT) : result.rows,
          totalCount: previewLimited ? Math.min(PREVIEW_LIMIT, result.rows.length) : result.rows.length,
          searchedTargetCount: result.searchedTargetCount,
          endpointFamily: result.endpointFamily,
          sourceUrl: result.sourceUrl,
          effectiveStartDate: attempt.startDate,
          effectiveEndDate: attempt.endDate,
          usedDateFallback: attempt.usedDateFallback,
          fallbackDays: attempt.fallbackDays,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "건축HUB 수집 중 오류가 발생했습니다.";
      if (isCredentialErrorMessage(lastError)) {
        return {
          ok: false as const,
          status: 401,
          message: "인증키를 확인하지 못했습니다.",
          invalidKey: true,
        };
      }
    }
  }

  return {
    ok: false as const,
    status: 404,
    message: lastError,
    sourceUrl: lastSourceUrl || lastResult?.sourceUrl || "",
    searchedTargetCount: lastResult?.searchedTargetCount ?? targets.length,
    endpointFamily: lastResult?.endpointFamily,
    invalidKey: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ArchhubCollectBody;
    const serviceKey = body.serviceKey?.trim() ?? "";
    const previewServiceKeys = buildPreviewKeys();
    const startDate = body.startDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";
    const sigunguCodes = Array.isArray(body.sigunguCodes) ? body.sigunguCodes.map((value) => value.trim()).filter(Boolean) : [];
    const legalDongCodes = Array.isArray(body.legalDongCodes) ? body.legalDongCodes.map((value) => value.trim()).filter(Boolean) : [];

    if (!isYmd(startDate) || !isYmd(endDate)) {
      return NextResponse.json({ ok: false, message: "조회 날짜는 YYYYMMDD 형식이어야 합니다." }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({ ok: false, message: "시작일이 종료일보다 늦을 수 없습니다." }, { status: 400 });
    }

    if (sigunguCodes.length === 0) {
      return NextResponse.json({ ok: false, message: "최소 1개 이상의 시군구를 선택해 주세요." }, { status: 400 });
    }

const runPreviewCollect = async () => {
  const mergedRows: Array<Record<string, string | number>> = [];
  let latestMeta: {
    searchedTargetCount?: number;
    endpointFamily?: "hs" | "arch";
    sourceUrl?: string;
    effectiveStartDate?: string;
    effectiveEndDate?: string;
    usedDateFallback?: boolean;
    fallbackDays?: number;
  } = {};

  for (const previewServiceKey of previewServiceKeys) {
    for (const legalDongCode of legalDongCodes) {
      const attempt = await runCollect({
        serviceKey: previewServiceKey,
        startDate,
        endDate,
        sigunguCodes,
        legalDongCodes: [legalDongCode],
        previewLimited: true,
      });

      if (attempt.ok) {
        mergedRows.push(...attempt.rows);
        latestMeta = {
          searchedTargetCount: attempt.searchedTargetCount,
          endpointFamily: attempt.endpointFamily,
          sourceUrl: attempt.sourceUrl,
          effectiveStartDate: attempt.effectiveStartDate,
          effectiveEndDate: attempt.effectiveEndDate,
          usedDateFallback: attempt.usedDateFallback,
          fallbackDays: attempt.fallbackDays,
        };

        const uniqueRows = mergeRows(mergedRows).slice(0, PREVIEW_LIMIT);
        if (uniqueRows.length >= PREVIEW_LIMIT) {
          return {
            kind: "ok" as const,
            attempt: {
              ok: true as const,
              rows: uniqueRows,
              totalCount: uniqueRows.length,
              searchedTargetCount: latestMeta.searchedTargetCount ?? legalDongCodes.length,
              endpointFamily: latestMeta.endpointFamily,
              sourceUrl: latestMeta.sourceUrl ?? "",
              effectiveStartDate: latestMeta.effectiveStartDate ?? startDate,
              effectiveEndDate: latestMeta.effectiveEndDate ?? endDate,
              usedDateFallback: latestMeta.usedDateFallback ?? false,
              fallbackDays: latestMeta.fallbackDays ?? 0,
            },
          };
        }

        continue;
      }

      if (attempt.status === 404) continue;
      if (attempt.invalidKey) continue;
      return { kind: "error" as const, attempt };
    }
  }

  const uniqueRows = mergeRows(mergedRows).slice(0, PREVIEW_LIMIT);
  if (uniqueRows.length > 0) {
    return {
      kind: "ok" as const,
      attempt: {
        ok: true as const,
        rows: uniqueRows,
        totalCount: uniqueRows.length,
        searchedTargetCount: latestMeta.searchedTargetCount ?? legalDongCodes.length,
        endpointFamily: latestMeta.endpointFamily,
        sourceUrl: latestMeta.sourceUrl ?? "",
        effectiveStartDate: latestMeta.effectiveStartDate ?? startDate,
        effectiveEndDate: latestMeta.effectiveEndDate ?? endDate,
        usedDateFallback: latestMeta.usedDateFallback ?? false,
        fallbackDays: latestMeta.fallbackDays ?? 0,
      },
    };
  }

  return null;
};

    if (serviceKey) {
      const fullAttempt = await runCollect({
        serviceKey,
        startDate,
        endDate,
        sigunguCodes,
        legalDongCodes,
        previewLimited: false,
      });

      if (fullAttempt.ok) {
        return NextResponse.json({
          ok: true,
          rows: fullAttempt.rows,
          totalCount: fullAttempt.totalCount,
          searchedTargetCount: fullAttempt.searchedTargetCount,
          endpointFamily: fullAttempt.endpointFamily,
          sourceUrl: fullAttempt.sourceUrl,
          effectiveStartDate: fullAttempt.effectiveStartDate,
          effectiveEndDate: fullAttempt.effectiveEndDate,
          usedDateFallback: fullAttempt.usedDateFallback,
          fallbackDays: fullAttempt.fallbackDays,
          previewLimited: false,
          authStatus: "full",
        });
      }

      if (!fullAttempt.invalidKey) {
        return NextResponse.json({
          ok: false,
          message: fullAttempt.message,
          searchedTargetCount: fullAttempt.searchedTargetCount,
          endpointFamily: fullAttempt.endpointFamily,
          sourceUrl: fullAttempt.sourceUrl,
        }, { status: fullAttempt.status });
      }

      const previewResult = await runPreviewCollect();
      if (previewResult?.kind === "ok") {
        return NextResponse.json({
          ok: true,
          rows: previewResult.attempt.rows,
          totalCount: previewResult.attempt.totalCount,
          searchedTargetCount: previewResult.attempt.searchedTargetCount,
          endpointFamily: previewResult.attempt.endpointFamily,
          sourceUrl: previewResult.attempt.sourceUrl,
          effectiveStartDate: previewResult.attempt.effectiveStartDate,
          effectiveEndDate: previewResult.attempt.effectiveEndDate,
          usedDateFallback: previewResult.attempt.usedDateFallback,
          fallbackDays: previewResult.attempt.fallbackDays,
          previewLimited: true,
          previewCount: PREVIEW_LIMIT,
          authStatus: "fallback-preview",
          message: MSG_FALLBACK_PREVIEW,
        });
      }

      if (previewResult?.kind === "error") {
        return NextResponse.json({ ok: false, message: previewResult.attempt.message, sourceUrl: previewResult.attempt.sourceUrl }, { status: previewResult.attempt.status });
      }

      return NextResponse.json({
        ok: true,
        rows: [],
        totalCount: 0,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "fallback-preview",
        message: `${MSG_FALLBACK_PREVIEW} ${MSG_NO_RESULT}`,
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
        searchedTargetCount: previewResult.attempt.searchedTargetCount,
        endpointFamily: previewResult.attempt.endpointFamily,
        sourceUrl: previewResult.attempt.sourceUrl,
        effectiveStartDate: previewResult.attempt.effectiveStartDate,
        effectiveEndDate: previewResult.attempt.effectiveEndDate,
        usedDateFallback: previewResult.attempt.usedDateFallback,
        fallbackDays: previewResult.attempt.fallbackDays,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "default-preview",
        message: MSG_DEFAULT_PREVIEW,
      });
    }

    if (previewResult?.kind === "error") {
      return NextResponse.json({ ok: false, message: previewResult.attempt.message, sourceUrl: previewResult.attempt.sourceUrl }, { status: previewResult.attempt.status });
    }

    return NextResponse.json({
      ok: true,
      rows: [],
      totalCount: 0,
      previewLimited: true,
      previewCount: PREVIEW_LIMIT,
      authStatus: "default-preview",
      message: `${MSG_DEFAULT_PREVIEW} ${MSG_NO_RESULT}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message: `건축HUB 수집 처리 중 오류가 발생했습니다: ${message}` }, { status: 500 });
  }
}
