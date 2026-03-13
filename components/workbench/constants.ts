export const CHUNK_SIZE = 50;

export const HIDDEN_META_KEYS = new Set([
  "resultCode",
  "resultMsg",
  "numOfRows",
  "pageNo",
  "totalCount",
]);

export const REGION_OPTIONS = [
  { code: "6110000", name: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC" },
  { code: "6260000", name: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "6270000", name: "\uB300\uAD6C\uAD11\uC5ED\uC2DC" },
  { code: "6280000", name: "\uC778\uCC9C\uAD11\uC5ED\uC2DC" },
  { code: "6290000", name: "\uAD11\uC8FC\uAD11\uC5ED\uC2DC" },
  { code: "6300000", name: "\uB300\uC804\uAD11\uC5ED\uC2DC" },
  { code: "6310000", name: "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "5690000", name: "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC" },
  { code: "6410000", name: "\uACBD\uAE30\uB3C4" },
  { code: "6530000", name: "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: "6430000", name: "\uCDA9\uCCAD\uBD81\uB3C4" },
  { code: "6440000", name: "\uCDA9\uCCAD\uB0A8\uB3C4" },
  { code: "6540000", name: "\uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: "6460000", name: "\uC804\uB77C\uB0A8\uB3C4" },
  { code: "6470000", name: "\uACBD\uC0C1\uBD81\uB3C4" },
  { code: "6480000", name: "\uACBD\uC0C1\uB0A8\uB3C4" },
  { code: "6500000", name: "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
] as const;

export const REGION_OPTIONS_8 = [
  { code: "6110000", name: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC" },
  { code: "6260000", name: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "6270000", name: "\uB300\uAD6C\uAD11\uC5ED\uC2DC" },
  { code: "6410000", name: "\uACBD\uAE30\uB3C4" },
  { code: "6430000", name: "\uCDA9\uCCAD\uBD81\uB3C4" },
  { code: "6460000", name: "\uC804\uB77C\uB0A8\uB3C4" },
  { code: "6470000", name: "\uACBD\uC0C1\uBD81\uB3C4" },
  { code: "6480000", name: "\uACBD\uC0C1\uB0A8\uB3C4" },
] as const;

// These two APIs use multiple OPN_ATMY_GRP_CD values per top-level region, so we bundle live codes here.
const joinRegionCodes = (...codes: string[]) => codes.join(",");

function expandRegionNameMap(options: ReadonlyArray<{ code: string; name: string }>) {
  const map: Record<string, string> = {};

  for (const option of options) {
    for (const code of option.code.split(",").map((item) => item.trim()).filter(Boolean)) {
      map[code] = option.name;
    }
  }

  return map;
}

export const REGION_OPTIONS_15155139 = [
  { code: joinRegionCodes("3000000", "3010000", "3020000", "3030000", "3040000", "3050000", "3060000", "3070000", "3080000", "3090000", "3100000", "3110000", "3120000", "3130000", "3140000", "3150000", "3160000", "3170000", "3180000", "3190000", "3200000", "3210000", "3220000", "3230000", "3240000"), name: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC" },
  { code: joinRegionCodes("3250000", "3260000", "3270000", "3280000", "3290000", "3300000", "3310000", "3320000", "3330000", "3340000", "3350000", "3360000", "3370000", "3380000", "3390000"), name: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3410000", "3420000", "3430000", "3440000", "3450000", "3460000", "3470000"), name: "\uB300\uAD6C\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3490000", "3500000", "3510500", "3520000", "3530000", "3540000", "3550000", "3560000"), name: "\uC778\uCC9C\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3590000", "3600000", "3610000", "3620000", "3630000"), name: "\uAD11\uC8FC\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3640000", "3650000", "3660000", "3670000", "3680000"), name: "\uB300\uC804\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3690000", "3700000", "3710000", "3720000", "3730000"), name: "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "5690000", name: "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC" },
  { code: joinRegionCodes("3740000", "3780000", "3820000", "3830000", "3860000", "3910000", "3920000", "3930000", "3940000", "3970000", "3980000", "3990000", "4000000", "4010000", "4020000", "4030000", "4040000", "4050000", "4060000", "4070000", "4080000", "4090000", "5530000", "5540000", "5590000", "5700000"), name: "\uACBD\uAE30\uB3C4" },
  { code: joinRegionCodes("4181000", "4191000", "4201000", "4211000", "4221000", "4231000", "4241000", "4291000"), name: "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: joinRegionCodes("4390000", "4400000", "4450000", "5710000"), name: "\uCDA9\uCCAD\uBD81\uB3C4" },
  { code: joinRegionCodes("4490000", "4500000", "4510000", "4520000", "4530000", "4540000", "4580000", "4600000", "4620000", "5580000", "5680000"), name: "\uCDA9\uCCAD\uB0A8\uB3C4" },
  { code: joinRegionCodes("4641000", "4671000", "4681000", "4691000", "4701000"), name: "\uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: joinRegionCodes("4800000", "4810000", "4820000", "4830000", "4840000", "4870000", "4880000", "4950000"), name: "\uC804\uB77C\uB0A8\uB3C4" },
  { code: joinRegionCodes("5020000", "5050000", "5060000", "5070000", "5080000", "5090000", "5100000", "5120000", "5130000", "5160000"), name: "\uACBD\uC0C1\uBD81\uB3C4" },
  { code: joinRegionCodes("5310000", "5330000", "5340000", "5350000", "5360000", "5370000", "5380000", "5450000", "5670000"), name: "\uACBD\uC0C1\uB0A8\uB3C4" },
] as const;

export const REGION_OPTIONS_15154910 = [
  { code: joinRegionCodes("3020000", "3110000", "3200000", "3230000", "3240000"), name: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC" },
  { code: joinRegionCodes("3250000", "3270000", "3330000", "3350000", "3370000", "3390000"), name: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3410000", "3420000", "3430000", "3440000", "3450000", "3460000", "3470000", "3480000"), name: "\uB300\uAD6C\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3490000", "3550000"), name: "\uC778\uCC9C\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3590000", "3600000", "3620000", "3630000"), name: "\uAD11\uC8FC\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3640000", "3660000", "3670000", "3680000"), name: "\uB300\uC804\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3690000", "3700000", "3710000"), name: "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: joinRegionCodes("3740000", "3780000", "3820000", "3860000", "3910000", "3920000", "3930000", "3980000", "4010000", "4040000", "4050000", "4060000", "4070000", "4090000", "5530000", "5590000"), name: "\uACBD\uAE30\uB3C4" },
  { code: joinRegionCodes("4181000", "4191000", "4201000", "4211000", "4221000", "4231000", "4251000", "4291000"), name: "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: joinRegionCodes("4390000", "4470000", "5710000"), name: "\uCDA9\uCCAD\uBD81\uB3C4" },
  { code: joinRegionCodes("4490000", "4520000", "4540000", "4620000", "5680000"), name: "\uCDA9\uCCAD\uB0A8\uB3C4" },
  { code: joinRegionCodes("4641000", "4671000", "4701000", "4721000", "4731000"), name: "\uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
  { code: joinRegionCodes("4800000", "4810000", "4820000", "4940000"), name: "\uC804\uB77C\uB0A8\uB3C4" },
  { code: joinRegionCodes("5020000", "5050000", "5060000", "5070000", "5080000", "5100000", "5110000", "5130000", "5210000", "5220000", "5260000"), name: "\uACBD\uC0C1\uBD81\uB3C4" },
  { code: joinRegionCodes("5310000", "5340000", "5350000", "5370000", "5380000", "5410000", "5460000", "5470000", "5670000"), name: "\uACBD\uC0C1\uB0A8\uB3C4" },
  { code: joinRegionCodes("6510000", "6520000"), name: "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4" },
] as const;
export const ARCH_REGION_OPTIONS = [
  { code: "11680|00000", name: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC" },
  { code: "26350|00000", name: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "27110,27140,27170,27200,27230,27260,27290,27710,27720|00000", name: "\uB300\uAD6C\uAD11\uC5ED\uC2DC" },
  { code: "28237|00000", name: "\uC778\uCC9C\uAD11\uC5ED\uC2DC" },
  { code: "29140|00000", name: "\uAD11\uC8FC\uAD11\uC5ED\uC2DC" },
  { code: "30110|00000", name: "\uB300\uC804\uAD11\uC5ED\uC2DC" },
  { code: "31140|00000", name: "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC" },
  { code: "36110|00000", name: "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC" },
] as const;

export const REGION_NAME_MAP = {
  ...expandRegionNameMap(REGION_OPTIONS),
  ...expandRegionNameMap(REGION_OPTIONS_15155139),
  ...expandRegionNameMap(REGION_OPTIONS_15154910),
};

export const ARCH_SIGUNGU_NAME_MAP: Record<string, string> = {
  "11680": "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC",
  "26350": "\uBD80\uC0B0\uAD11\uC5ED\uC2DC",
  "27290": "\uB300\uAD6C\uAD11\uC5ED\uC2DC",
  "27720": "\uB300\uAD6C\uAD11\uC5ED\uC2DC",
  "28237": "\uC778\uCC9C\uAD11\uC5ED\uC2DC",
  "29140": "\uAD11\uC8FC\uAD11\uC5ED\uC2DC",
  "30110": "\uB300\uC804\uAD11\uC5ED\uC2DC",
  "31140": "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC",
  "36110": "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC",
};

export const WORKNATIONAL_MAP: Record<string, string> = {
  "101": "\uC911\uAD6D",
  "102": "\uBABD\uACE8",
  "103": "\uC6B0\uC988\uBCA0\uD0A4\uC2A4\uD0C4",
  "104": "\uCE74\uC790\uD750\uC2A4\uD0C4",
  "105": "\uC778\uB3C4\uB124\uC2DC\uC544",
  "106": "\uD0DC\uAD6D",
  "108": "\uBCA0\uD2B8\uB0A8",
  "109": "\uCEA0\uBCF4\uB514\uC544",
  "110": "\uD30C\uD0A4\uC2A4\uD0C4",
  "111": "\uB124\uD314",
  "112": "\uBBF8\uC58C\uB9C8",
  "113": "\uBC29\uAE00\uB77C\uB370\uC2DC",
  "125": "\uC911\uC559\uC544\uC2DC\uC544",
  "134": "\uB3D9\uB0A8\uC544\uC2DC\uC544",
  "138": "\uB0A8\uC544\uC2DC\uC544",
  "145": "\uB3D9\uC544\uC2DC\uC544",
  "148": "\uB124\uD314",
  "153": "\uC778\uB3C4\uB124\uC2DC\uC544",
  "155": "\uC11C\uC720\uB7FD",
  "156": "\uC911\uAD6D",
  "170": "\uD0DC\uAD6D",
  "181": "\uC11C\uC544\uC2DC\uC544",
  "185": "\uBCA0\uD2B8\uB0A8",
};

export const SALS_STATUS_MAP: Record<string, string> = {
  "01": "\uC601\uC5C5",
  "02": "\uD734\uC5C5",
  "03": "\uD3D0\uC5C5",
  "04": "\uCDE8\uC18C/\uB9D0\uC18C/\uB9CC\uB8CC/\uC815\uC9C0/\uC911\uC9C0",
};

export const SALES_STATUS_OPTIONS = [
  { code: "01", label: "\uC601\uC5C5/\uC815\uC0C1" },
  { code: "02", label: "\uD734\uC5C5" },
  { code: "03", label: "\uD3D0\uC5C5" },
  { code: "04", label: "\uCDE8\uC18C/\uB9D0\uC18C/\uB9CC\uB8CC/\uC815\uC9C0/\uC911\uC9C0" },
] as const;

export const COLUMN_LABEL_KR: Record<string, string> = {
  worknational: "근무국가",
  localCompanyName: "현지업체명",
  recruitNum: "채용인원",
  plcNm: "교육장명",
  orgHanNm: "기관명",
  telNo: "전화번호",
  faxNo: "팩스번호",
  addr: "주소",
  etcAd: "기타 안내",
  regTime: "등록시간",
  receiptNo: "접수번호",
  nationalName: "국적",
  OPN_ATMY_GRP_CD: "개방자치단체",
  BPLC_NM: "사업장명",
  SALS_STTS_NM: "영업상태명",
  SALS_STTS_CD: "영업상태코드",
  LCPMT_YMD: "인허가일자",
  ROAD_NM_ADDR: "도로명주소",
  LOTNO_ADDR: "지번주소",
  TELNO: "전화번호",
  LAST_MDFCN_PNT: "최종수정시점",
  sigunguCd: "시군구코드",
  bjdongCd: "법정동코드",
  platPlc: "대지위치",
  bldNm: "건물명",
  mainPurpsCdNm: "주용도명",
  archArea: "건축면적",
  totArea: "연면적",
  grndFlrCnt: "지상층수",
  ugrndFlrCnt: "지하층수",
  rideUseElvtCnt: "승용승강기수",
  emgenUseElvtCnt: "비상용승강기수",
  crtnDay: "생성일자",
};
