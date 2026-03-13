export const CHUNK_SIZE = 50;

export const HIDDEN_META_KEYS = new Set([
  "resultCode",
  "resultMsg",
  "numOfRows",
  "pageNo",
  "totalCount",
]);

export const REGION_OPTIONS = [
  { code: "6110000", name: "서울특별시" },
  { code: "6260000", name: "부산광역시" },
  { code: "6270000", name: "대구광역시" },
  { code: "6280000", name: "인천광역시" },
  { code: "6290000", name: "광주광역시" },
  { code: "6300000", name: "대전광역시" },
  { code: "6310000", name: "울산광역시" },
  { code: "5690000", name: "세종특별자치시" },
  { code: "6410000", name: "경기도" },
  { code: "6530000", name: "강원특별자치도" },
  { code: "6430000", name: "충청북도" },
  { code: "6440000", name: "충청남도" },
  { code: "6540000", name: "전북특별자치도" },
  { code: "6460000", name: "전라남도" },
  { code: "6470000", name: "경상북도" },
  { code: "6480000", name: "경상남도" },
  { code: "6500000", name: "제주특별자치도" },
] as const;

export const REGION_OPTIONS_8 = [
  { code: "6110000", name: "서울특별시" },
  { code: "6260000", name: "부산광역시" },
  { code: "6270000", name: "대구광역시" },
  { code: "6410000", name: "경기도" },
  { code: "6430000", name: "충청북도" },
  { code: "6460000", name: "전라남도" },
  { code: "6470000", name: "경상북도" },
  { code: "6480000", name: "경상남도" },
] as const;

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
  { code: joinRegionCodes("3000000", "3010000", "3020000", "3030000", "3040000", "3050000", "3060000", "3070000", "3080000", "3090000", "3100000", "3110000", "3120000", "3130000", "3140000", "3150000", "3160000", "3170000", "3180000", "3190000", "3200000", "3210000", "3220000", "3230000", "3240000"), name: "서울특별시" },
  { code: joinRegionCodes("3250000", "3260000", "3270000", "3280000", "3290000", "3300000", "3310000", "3320000", "3330000", "3340000", "3350000", "3360000", "3370000", "3380000", "3390000"), name: "부산광역시" },
  { code: joinRegionCodes("3410000", "3420000", "3430000", "3440000", "3450000", "3460000", "3470000"), name: "대구광역시" },
  { code: joinRegionCodes("3490000", "3500000", "3510500", "3520000", "3530000", "3540000", "3550000", "3560000"), name: "인천광역시" },
  { code: joinRegionCodes("3590000", "3600000", "3610000", "3620000", "3630000"), name: "광주광역시" },
  { code: joinRegionCodes("3640000", "3650000", "3660000", "3670000", "3680000"), name: "대전광역시" },
  { code: joinRegionCodes("3690000", "3700000", "3710000", "3720000", "3730000"), name: "울산광역시" },
  { code: "5690000", name: "세종특별자치시" },
  { code: joinRegionCodes("3740000", "3780000", "3820000", "3830000", "3860000", "3910000", "3920000", "3930000", "3940000", "3970000", "3980000", "3990000", "4000000", "4010000", "4020000", "4030000", "4040000", "4050000", "4060000", "4070000", "4080000", "4090000", "5530000", "5540000", "5590000", "5700000"), name: "경기도" },
  { code: joinRegionCodes("4181000", "4191000", "4201000", "4211000", "4221000", "4231000", "4241000", "4291000"), name: "강원특별자치도" },
  { code: joinRegionCodes("4390000", "4400000", "4450000", "5710000"), name: "충청북도" },
  { code: joinRegionCodes("4490000", "4500000", "4510000", "4520000", "4530000", "4540000", "4580000", "4600000", "4620000", "5580000", "5680000"), name: "충청남도" },
  { code: joinRegionCodes("4641000", "4671000", "4681000", "4691000", "4701000"), name: "전북특별자치도" },
  { code: joinRegionCodes("4800000", "4810000", "4820000", "4830000", "4840000", "4870000", "4880000", "4950000"), name: "전라남도" },
  { code: joinRegionCodes("5020000", "5050000", "5060000", "5070000", "5080000", "5090000", "5100000", "5120000", "5130000", "5160000"), name: "경상북도" },
  { code: joinRegionCodes("5310000", "5330000", "5340000", "5350000", "5360000", "5370000", "5380000", "5450000", "5670000"), name: "경상남도" },
] as const;

export const REGION_OPTIONS_15154910 = [
  { code: joinRegionCodes("3020000", "3110000", "3200000", "3230000", "3240000"), name: "서울특별시" },
  { code: joinRegionCodes("3250000", "3270000", "3330000", "3350000", "3370000", "3390000"), name: "부산광역시" },
  { code: joinRegionCodes("3410000", "3420000", "3430000", "3440000", "3450000", "3460000", "3470000", "3480000"), name: "대구광역시" },
  { code: joinRegionCodes("3490000", "3550000"), name: "인천광역시" },
  { code: joinRegionCodes("3590000", "3600000", "3620000", "3630000"), name: "광주광역시" },
  { code: joinRegionCodes("3640000", "3660000", "3670000", "3680000"), name: "대전광역시" },
  { code: joinRegionCodes("3690000", "3700000", "3710000"), name: "울산광역시" },
  { code: joinRegionCodes("3740000", "3780000", "3820000", "3860000", "3910000", "3920000", "3930000", "3980000", "4010000", "4040000", "4050000", "4060000", "4070000", "4090000", "5530000", "5590000"), name: "경기도" },
  { code: joinRegionCodes("4181000", "4191000", "4201000", "4211000", "4221000", "4231000", "4251000", "4291000"), name: "강원특별자치도" },
  { code: joinRegionCodes("4390000", "4470000", "5710000"), name: "충청북도" },
  { code: joinRegionCodes("4490000", "4520000", "4540000", "4620000", "5680000"), name: "충청남도" },
  { code: joinRegionCodes("4641000", "4671000", "4701000", "4721000", "4731000"), name: "전북특별자치도" },
  { code: joinRegionCodes("4800000", "4810000", "4820000", "4940000"), name: "전라남도" },
  { code: joinRegionCodes("5020000", "5050000", "5060000", "5070000", "5080000", "5100000", "5110000", "5130000", "5210000", "5220000", "5260000"), name: "경상북도" },
  { code: joinRegionCodes("5310000", "5340000", "5350000", "5370000", "5380000", "5410000", "5460000", "5470000", "5670000"), name: "경상남도" },
  { code: joinRegionCodes("6510000", "6520000"), name: "제주특별자치도" },
] as const;

export const ARCH_REGION_OPTIONS = [
  { code: "11680|00000", name: "서울특별시" },
  { code: "26350|00000", name: "부산광역시" },
  { code: "27110,27140,27170,27200,27230,27260,27290,27710,27720|00000", name: "대구광역시" },
  { code: "28237|00000", name: "인천광역시" },
  { code: "29140|00000", name: "광주광역시" },
  { code: "30110|00000", name: "대전광역시" },
  { code: "31140|00000", name: "울산광역시" },
  { code: "36110|00000", name: "세종특별자치시" },
] as const;

export const REGION_NAME_MAP = {
  ...expandRegionNameMap(REGION_OPTIONS),
  ...expandRegionNameMap(REGION_OPTIONS_15155139),
  ...expandRegionNameMap(REGION_OPTIONS_15154910),
};

export const ARCH_SIGUNGU_NAME_MAP: Record<string, string> = {
  "11680": "서울특별시",
  "26350": "부산광역시",
  "27290": "대구광역시",
  "27720": "대구광역시",
  "28237": "인천광역시",
  "29140": "광주광역시",
  "30110": "대전광역시",
  "31140": "울산광역시",
  "36110": "세종특별자치시",
};

export const WORKNATIONAL_MAP: Record<string, string> = {
  "101": "중국",
  "102": "몽골",
  "103": "우즈베키스탄",
  "104": "카자흐스탄",
  "105": "인도네시아",
  "106": "태국",
  "108": "베트남",
  "109": "캄보디아",
  "110": "파키스탄",
  "111": "네팔",
  "112": "미얀마",
  "113": "방글라데시",
  "125": "중앙아시아",
  "134": "동남아시아",
  "138": "남아시아",
  "145": "동아시아",
  "148": "네팔",
  "153": "인도네시아",
  "155": "서유럽",
  "156": "중국",
  "170": "태국",
  "181": "서아시아",
  "185": "베트남",
};

export const SALS_STATUS_MAP: Record<string, string> = {
  "01": "영업",
  "02": "휴업",
  "03": "폐업",
  "04": "취소/말소/만료/정지/중지",
};

export const SALES_STATUS_OPTIONS = [
  { code: "01", label: "영업/정상" },
  { code: "02", label: "휴업" },
  { code: "03", label: "폐업" },
  { code: "04", label: "취소/말소/만료/정지/중지" },
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
