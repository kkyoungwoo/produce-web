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

export async function POST(request: Request) {
  const body = (await request.json()) as ArchhubRegionsBody;
  const level = body.level?.trim();

  if (level === "sido") {
    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubSidoOptions(),
    });
  }

  if (level === "sigungu") {
    const sidoCode = body.sidoCode?.trim() ?? "";
    if (!sidoCode) {
      return NextResponse.json({ ok: false, message: "시도 코드가 필요합니다." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubSigunguOptions(sidoCode),
    });
  }

  if (level === "bjdong") {
    const sigunguCodes = Array.isArray(body.sigunguCodes) ? body.sigunguCodes.map((value) => value.trim()).filter(Boolean) : [];
    if (sigunguCodes.length === 0) {
      return NextResponse.json({ ok: false, message: "시군구 코드가 필요합니다." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      version: getArchhubRegionDataVersion(),
      options: getArchhubBjdongOptions(sigunguCodes),
    });
  }

  return NextResponse.json(
    { ok: false, message: "level 값은 sido, sigungu, bjdong 중 하나여야 합니다." },
    { status: 400 },
  );
}