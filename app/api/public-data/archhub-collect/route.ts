import { NextResponse } from "next/server";

import { collectArchhubRows } from "@/lib/archhub/collector";
import { expandArchhubTargets } from "@/lib/archhub/regions";
import { getPreviewServiceKeys } from "@/lib/public-data/preview-key";

type ArchhubCollectBody = {
  serviceKey?: string;
  startDate?: string;
  endDate?: string;
  sigunguCodes?: string[];
  legalDongCodes?: string[];
};

const DEFAULT_ARCHHUB_SERVICE_KEY = String(process.env.DATA_GO_KR_SERVICE_KEY_15136560 ?? "").trim();
const PREVIEW_LIMIT = 5;
const MSG_DEFAULT_PREVIEW = "???? ???? ?? ?? ???? ?? ??? ???? 5?? ??????.";
const MSG_FALLBACK_PREVIEW = "??? ???? ???? ?? ?? ???? ?? ??? ???? 5?? ??????.";
const MSG_NO_DEFAULT_KEY = "???? ???? ?? ???? ??? ? ????. ?? ?? ???? ???? ?? ????.";
const MSG_INVALID_KEY_NO_DEFAULT = "??? ???? ???? ?????. ??? ???? ??? ???.";

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
    || normalized.includes("???")
    || normalized.includes("????")
    || normalized.includes("??(-4)")
  );
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
      message: "??? ??? ???? ??? ??? ????.",
      invalidKey: false,
    };
  }

  const attempts = [{ startDate, endDate, usedDateFallback: false, fallbackDays: 0 }];
  const requestedDays = diffDays(startDate, endDate);

  if (!previewLimited && requestedDays <= 14) {
    attempts.push({
      startDate: shiftDate(endDate, -90),
      endDate,
      usedDateFallback: true,
      fallbackDays: 90,
    });
  }

  if (!previewLimited && requestedDays <= 31) {
    attempts.push({
      startDate: shiftDate(endDate, -365),
      endDate,
      usedDateFallback: true,
      fallbackDays: 365,
    });
  }

  const dedupedAttempts = attempts.filter((attempt, index, array) => array.findIndex((item) => item.startDate === attempt.startDate && item.endDate === attempt.endDate) === index);

  let lastError = "?? ??? ????. ?? ?? ?? ??? ??? ?? ??? ???.";
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
      lastError = error instanceof Error ? error.message : "??HUB ?? ? ??? ??????.";
      if (isCredentialErrorMessage(lastError)) {
        return {
          ok: false as const,
          status: 401,
          message: "???? ???? ?????.",
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
    const previewServiceKeys = getPreviewServiceKeys(DEFAULT_ARCHHUB_SERVICE_KEY);
    const startDate = body.startDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";
    const sigunguCodes = Array.isArray(body.sigunguCodes) ? body.sigunguCodes.map((value) => value.trim()).filter(Boolean) : [];
    const legalDongCodes = Array.isArray(body.legalDongCodes) ? body.legalDongCodes.map((value) => value.trim()).filter(Boolean) : [];

    if (!isYmd(startDate) || !isYmd(endDate)) {
      return NextResponse.json({ ok: false, message: "?? ??? YYYYMMDD ????? ???." }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({ ok: false, message: "???? ????? ?? ? ????." }, { status: 400 });
    }

    if (sigunguCodes.length === 0) {
      return NextResponse.json({ ok: false, message: "?? 1? ??? ???? ??? ???." }, { status: 400 });
    }

    const runPreviewCollect = async () => {
      for (const previewServiceKey of previewServiceKeys) {
        const attempt = await runCollect({
          serviceKey: previewServiceKey,
          startDate,
          endDate,
          sigunguCodes,
          legalDongCodes,
          previewLimited: true,
        });

        if (attempt.ok) return { kind: "ok" as const, attempt };
        if (attempt.status === 404) return { kind: "empty" as const, attempt };
        if (attempt.invalidKey) continue;
        return { kind: "error" as const, attempt };
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

      if (previewResult?.kind === "empty") {
        return NextResponse.json({
          ok: true,
          rows: [],
          totalCount: 0,
          previewLimited: true,
          previewCount: PREVIEW_LIMIT,
          authStatus: "fallback-preview",
          message: `${MSG_FALLBACK_PREVIEW} ?? ??? ????.`,
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

    if (previewResult?.kind === "empty") {
      return NextResponse.json({
        ok: true,
        rows: [],
        totalCount: 0,
        previewLimited: true,
        previewCount: PREVIEW_LIMIT,
        authStatus: "default-preview",
        message: `${MSG_DEFAULT_PREVIEW} ?? ??? ????.`,
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
      authStatus: "missing-preview",
      message: MSG_NO_DEFAULT_KEY,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message: `??HUB ?? ?? ? ??? ??????: ${message}` }, { status: 500 });
  }
}
