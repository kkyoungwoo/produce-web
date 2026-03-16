import { NextResponse } from "next/server";

import {
  getArchhubBjdongOptions,
  getArchhubRegionDataVersion,
  getArchhubSidoOptions,
  getArchhubSigunguOptions,
} from "@/lib/archhub/regions";

type ArchhubRegionsBody = {
  level?: "sido" | "sigungu" | "bjdong";
  sidoCode?: string;
  sigunguCodes?: string[];
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function safeReadJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await safeReadJson<ArchhubRegionsBody>(request);

  if (!body) {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }

  const level = String(body.level ?? "").trim();

  if (level === "sido") {
    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubSidoOptions(),
    });
  }

  if (level === "sigungu") {
    const sidoCode = String(body.sidoCode ?? "").trim();

    if (!sidoCode) {
      return NextResponse.json(
        { ok: false, message: "시도 코드가 필요합니다." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubSigunguOptions(sidoCode),
    });
  }

  if (level === "bjdong") {
    const sigunguCodes = Array.isArray(body.sigunguCodes)
      ? uniqueStrings(body.sigunguCodes)
      : [];

    if (sigunguCodes.length === 0) {
      return NextResponse.json(
        { ok: false, message: "시군구 코드가 필요합니다." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubBjdongOptions(sigunguCodes),
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: "level 값은 sido, sigungu, bjdong 중 하나여야 합니다.",
    },
    { status: 400 },
  );
}
