import "server-only";

import regionData from "@/lib/archhub/region-data.json";

type RawArchhubRegionData = {
  version: string;
  sidos: Array<{
    code: string;
    name: string;
    sigungus: Array<{
      code: string;
      name: string;
      fullName: string;
      dongs: Array<[string, string]>;
    }>;
  }>;
};

export type ArchhubSidoOption = {
  code: string;
  name: string;
  sigunguCount: number;
};

export type ArchhubSigunguOption = {
  code: string;
  name: string;
  fullName: string;
  sidoCode: string;
  sidoName: string;
  dongCount: number;
};

export type ArchhubBjdongOption = {
  code: string;
  fullCode: string;
  name: string;
  label: string;
  sigunguCode: string;
  sigunguName: string;
  sigunguFullName: string;
  sidoCode: string;
  sidoName: string;
};

export type ArchhubCollectTarget = {
  fullCode: string;
  sigunguCode: string;
  bjdongCode: string;
  dongName: string;
  sigunguName: string;
  sigunguFullName: string;
  sidoCode: string;
  sidoName: string;
};

const data = regionData as RawArchhubRegionData;

const sidoOptions: ArchhubSidoOption[] = [];
const sigunguOptionsBySido = new Map<string, ArchhubSigunguOption[]>();
const sigunguOptionByCode = new Map<string, ArchhubSigunguOption>();
const bjdongOptionsBySigungu = new Map<string, ArchhubBjdongOption[]>();
const collectTargetByFullCode = new Map<string, ArchhubCollectTarget>();

for (const sido of data.sidos) {
  const sigunguOptions = sido.sigungus
    .map<ArchhubSigunguOption>((sigungu) => ({
      code: sigungu.code,
      name: sigungu.name,
      fullName: sigungu.fullName,
      sidoCode: sido.code,
      sidoName: sido.name,
      dongCount: sigungu.dongs.length,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  sidoOptions.push({
    code: sido.code,
    name: sido.name,
    sigunguCount: sigunguOptions.length,
  });

  sigunguOptionsBySido.set(sido.code, sigunguOptions);

  for (const sigungu of sigunguOptions) {
    sigunguOptionByCode.set(sigungu.code, sigungu);
  }

  for (const sigungu of sido.sigungus) {
    const options = sigungu.dongs
      .map<ArchhubBjdongOption>(([dongCode, dongName]) => ({
        code: dongCode,
        fullCode: `${sigungu.code}${dongCode}`,
        name: dongName,
        label: sigungu.name === sido.name ? dongName : `${sigungu.name} ${dongName}`,
        sigunguCode: sigungu.code,
        sigunguName: sigungu.name,
        sigunguFullName: sigungu.fullName,
        sidoCode: sido.code,
        sidoName: sido.name,
      }))
      .sort((a, b) => a.fullCode.localeCompare(b.fullCode));

    bjdongOptionsBySigungu.set(sigungu.code, options);

    for (const option of options) {
      collectTargetByFullCode.set(option.fullCode, {
        fullCode: option.fullCode,
        sigunguCode: option.sigunguCode,
        bjdongCode: option.code,
        dongName: option.name,
        sigunguName: option.sigunguName,
        sigunguFullName: option.sigunguFullName,
        sidoCode: option.sidoCode,
        sidoName: option.sidoName,
      });
    }
  }
}

sidoOptions.sort((a, b) => a.code.localeCompare(b.code));

export function getArchhubRegionDataVersion() {
  return data.version;
}

export function getArchhubSidoOptions() {
  return sidoOptions;
}

export function getArchhubSigunguOptions(sidoCode: string) {
  return sigunguOptionsBySido.get(sidoCode.trim()) ?? [];
}

export function getArchhubBjdongOptions(sigunguCodes: string[]) {
  const seen = new Set<string>();
  const merged: ArchhubBjdongOption[] = [];

  for (const sigunguCode of sigunguCodes) {
    for (const option of bjdongOptionsBySigungu.get(sigunguCode.trim()) ?? []) {
      if (seen.has(option.fullCode)) continue;
      seen.add(option.fullCode);
      merged.push(option);
    }
  }

  return merged.sort((a, b) => a.fullCode.localeCompare(b.fullCode));
}

export function getArchhubSigunguFullName(sigunguCode: string) {
  return sigunguOptionByCode.get(sigunguCode.trim())?.fullName ?? "";
}

export function expandArchhubTargets(input: {
  sigunguCodes?: string[];
  legalDongCodes?: string[];
}) {
  const { sigunguCodes = [], legalDongCodes = [] } = input;
  const targets = new Map<string, ArchhubCollectTarget>();

  if (legalDongCodes.length > 0) {
    for (const fullCode of legalDongCodes) {
      const target = collectTargetByFullCode.get(fullCode.trim());
      if (target) targets.set(target.fullCode, target);
    }
  } else {
    for (const sigunguCode of sigunguCodes) {
      for (const option of bjdongOptionsBySigungu.get(sigunguCode.trim()) ?? []) {
        const target = collectTargetByFullCode.get(option.fullCode);
        if (target) targets.set(target.fullCode, target);
      }
    }
  }

  return Array.from(targets.values()).sort((a, b) => a.fullCode.localeCompare(b.fullCode));
}