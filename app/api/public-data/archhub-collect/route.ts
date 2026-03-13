import { NextResponse } from "next/server";

import { collectArchhubRows } from "@/lib/archhub/collector";
import { expandArchhubTargets } from "@/lib/archhub/regions";

type ArchhubCollectBody = {
  serviceKey?: string;
  startDate?: string;
  endDate?: string;
  sigunguCodes?: string[];
  legalDongCodes?: string[];
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ArchhubCollectBody;
    const serviceKey = body.serviceKey?.trim() ?? "";
    const startDate = body.startDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";
    const sigunguCodes = Array.isArray(body.sigunguCodes) ? body.sigunguCodes.map((value) => value.trim()).filter(Boolean) : [];
    const legalDongCodes = Array.isArray(body.legalDongCodes) ? body.legalDongCodes.map((value) => value.trim()).filter(Boolean) : [];

    if (!serviceKey) {
      return NextResponse.json({ ok: false, message: "인증키(serviceKey)를 입력해 주세요." }, { status: 400 });
    }

    if (!isYmd(startDate) || !isYmd(endDate)) {
      return NextResponse.json({ ok: false, message: "조회 날짜는 YYYYMMDD 형식이어야 합니다." }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({ ok: false, message: "시작일은 종료일보다 늦을 수 없습니다." }, { status: 400 });
    }

    if (sigunguCodes.length === 0) {
      return NextResponse.json({ ok: false, message: "최소 1개 이상의 시군구를 선택해 주세요." }, { status: 400 });
    }

    const targets = expandArchhubTargets({ sigunguCodes, legalDongCodes });
    if (targets.length === 0) {
      return NextResponse.json({ ok: false, message: "선택한 지역에 해당하는 법정동 코드가 없습니다." }, { status: 400 });
    }

    const attempts = [{ startDate, endDate, usedDateFallback: false, fallbackDays: 0 }];
    const requestedDays = diffDays(startDate, endDate);

    if (requestedDays <= 14) {
      attempts.push({
        startDate: shiftDate(endDate, -90),
        endDate,
        usedDateFallback: true,
        fallbackDays: 90,
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

    let lastResult: Awaited<ReturnType<typeof collectArchhubRows>> | null = null;

    for (const attempt of dedupedAttempts) {
      const result = await collectArchhubRows({
        serviceKey,
        startDate: attempt.startDate,
        endDate: attempt.endDate,
        targets,
      });

      lastResult = result;
      if (result.rows.length > 0) {
        return NextResponse.json({
          ok: true,
          rows: result.rows,
          totalCount: result.rows.length,
          searchedTargetCount: result.searchedTargetCount,
          endpointFamily: result.endpointFamily,
          sourceUrl: result.sourceUrl,
          effectiveStartDate: attempt.startDate,
          effectiveEndDate: attempt.endDate,
          usedDateFallback: attempt.usedDateFallback,
          fallbackDays: attempt.fallbackDays,
        });
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: "조회 결과가 없습니다. 날짜 또는 지역 범위를 조금 넓혀 다시 시도해 주세요.",
        searchedTargetCount: lastResult?.searchedTargetCount ?? targets.length,
        endpointFamily: lastResult?.endpointFamily,
        sourceUrl: lastResult?.sourceUrl,
      },
      { status: 404 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message: `건축HUB 수집 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
}