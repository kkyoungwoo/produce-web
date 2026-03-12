import type { ProductItem } from "@/lib/i18n/types";

export function getSampleRows(product: ProductItem): Array<Record<string, string | number>> {
  if (product.slug === "api-15086411") {
    return [
      { worknational: "101", localCompanyName: "CERAGEM INTERNATIONAL CHINA", recruitNum: 2 },
      { worknational: "108", localCompanyName: "HANOI GLOBAL VINA", recruitNum: 3 },
      { worknational: "111", localCompanyName: "KATHMANDU WORK LINK", recruitNum: 1 },
      { worknational: "106", localCompanyName: "THAI LOGI GROUP", recruitNum: 4 },
      { worknational: "125", localCompanyName: "CENTRAL ASIA JOB HUB", recruitNum: 2 },
    ];
  }

  if (product.slug === "api-15120791") {
    return [
      {
        plcNm: "수원교육장",
        orgHanNm: "경인지역본부(수원)",
        telNo: "031-249-1266",
        faxNo: "0505-174-2255",
        addr: "경기도 수원시 권선구 서부로 46-68",
        etcAd: "평일 09:00~18:00 운영",
      },
      {
        plcNm: "인천교육장",
        orgHanNm: "인천지사",
        telNo: "032-820-8664",
        faxNo: "0505-174-2245",
        addr: "인천광역시 남동구 남동서로205번길 32",
        etcAd: "사전 예약 후 방문",
      },
      {
        plcNm: "성남교육장",
        orgHanNm: "경기동부지사",
        telNo: "031-750-6233",
        faxNo: "0505-174-2273",
        addr: "경기도 성남시 수정구 성남대로 1214",
        etcAd: "주차 가능",
      },
      {
        plcNm: "부산교육장",
        orgHanNm: "부산지역본부",
        telNo: "051-330-1832",
        faxNo: "0505-174-2075",
        addr: "부산광역시 북구 금곡대로 441",
        etcAd: "오전/오후 반 운영",
      },
      {
        plcNm: "광주교육장",
        orgHanNm: "광주지역본부",
        telNo: "062-970-1752",
        faxNo: "0505-174-2154",
        addr: "광주광역시 북구 첨단벚꽃로 82",
        etcAd: "주요 도심 운영",
      },
    ];
  }

  if (product.slug === "api-15134013") {
    return [
      {
        regTime: "2026-01-26 12:10:30",
        receiptNo: "KH03-2601024",
        nationalName: "캄보디아",
        worktypeMain1Name: "금속",
        worktypeSub1Name: "금속가공",
        worktypeSub2Name: "",
        worktypeSub3Name: "",
        careerMonth: 157,
        koreanAbility: "중",
      },
      {
        regTime: "2026-01-26 12:09:32",
        receiptNo: "KH03-2601023",
        nationalName: "캄보디아",
        worktypeMain1Name: "금속",
        worktypeSub1Name: "금속가공",
        worktypeSub2Name: "",
        worktypeSub3Name: "",
        careerMonth: 67,
        koreanAbility: "중",
      },
      {
        regTime: "2026-01-26 12:08:45",
        receiptNo: "KH03-2601022",
        nationalName: "베트남",
        worktypeMain1Name: "금속",
        worktypeSub1Name: "금속가공",
        worktypeSub2Name: "",
        worktypeSub3Name: "",
        careerMonth: 92,
        koreanAbility: "중",
      },
      {
        regTime: "2026-01-26 12:07:56",
        receiptNo: "KH03-2601021",
        nationalName: "태국",
        worktypeMain1Name: "금속",
        worktypeSub1Name: "금속가공",
        worktypeSub2Name: "",
        worktypeSub3Name: "",
        careerMonth: 80,
        koreanAbility: "중",
      },
      {
        regTime: "2026-01-26 12:07:08",
        receiptNo: "KH03-2601020",
        nationalName: "네팔",
        worktypeMain1Name: "금속",
        worktypeSub1Name: "금속가공",
        worktypeSub2Name: "",
        worktypeSub3Name: "",
        careerMonth: 111,
        koreanAbility: "중",
      },
    ];
  }

  if (product.slug === "api-15155139" || product.slug === "api-15154910") {
    return [
      {
        OPN_ATMY_GRP_CD: "6110000",
        MNG_NO: "6110000-2024-0000123",
        BPLC_NM: "서울 명동 글로벌 라운지",
        ROAD_NM_ADDR: "서울특별시 중구 명동길 21",
        LOTNO_ADDR: "서울특별시 중구 명동2가 45-3",
        SALS_STTS_NM: "영업",
        SALS_STTS_CD: "01",
        DTL_SALS_STTS_NM: "정상영업",
        DTL_SALS_STTS_CD: "0101",
        LCPMT_YMD: "20240215",
        TELNO: "02-1234-5678",
        LAST_MDFCN_PNT: "20260311133000",
      },
      {
        OPN_ATMY_GRP_CD: "6260000",
        MNG_NO: "6260000-2024-0000421",
        BPLC_NM: "부산 중앙 글로벌 라운지",
        ROAD_NM_ADDR: "부산광역시 중구 중앙대로 220",
        LOTNO_ADDR: "부산광역시 중구 중앙동 111-4",
        SALS_STTS_NM: "영업",
        SALS_STTS_CD: "01",
        DTL_SALS_STTS_NM: "정상영업",
        DTL_SALS_STTS_CD: "0101",
        LCPMT_YMD: "20231110",
        TELNO: "051-123-7788",
        LAST_MDFCN_PNT: "20260310113000",
      },
      {
        OPN_ATMY_GRP_CD: "6270000",
        MNG_NO: "6270000-2025-0000199",
        BPLC_NM: "대구 동성로 라운지",
        ROAD_NM_ADDR: "대구광역시 중구 동성로 10",
        LOTNO_ADDR: "대구광역시 중구 동성로가 22-2",
        SALS_STTS_NM: "영업",
        SALS_STTS_CD: "01",
        DTL_SALS_STTS_NM: "정상영업",
        DTL_SALS_STTS_CD: "0101",
        LCPMT_YMD: "20250114",
        TELNO: "053-223-4578",
        LAST_MDFCN_PNT: "20260309103000",
      },
      {
        OPN_ATMY_GRP_CD: "6410000",
        MNG_NO: "6410000-2023-0000788",
        BPLC_NM: "분당 정자 라운지",
        ROAD_NM_ADDR: "경기도 성남시 분당구 정자로 95",
        LOTNO_ADDR: "경기도 성남시 분당구 정자동 45-7",
        SALS_STTS_NM: "영업",
        SALS_STTS_CD: "01",
        DTL_SALS_STTS_NM: "정상영업",
        DTL_SALS_STTS_CD: "0101",
        LCPMT_YMD: "20230908",
        TELNO: "031-700-8877",
        LAST_MDFCN_PNT: "20260308180000",
      },
      {
        OPN_ATMY_GRP_CD: "6500000",
        MNG_NO: "6500000-2025-0000031",
        BPLC_NM: "제주 애월 라운지",
        ROAD_NM_ADDR: "제주특별자치도 제주시 애월읍 애월로 77",
        LOTNO_ADDR: "제주특별자치도 제주시 애월읍 애월리 77-2",
        SALS_STTS_NM: "영업",
        SALS_STTS_CD: "01",
        DTL_SALS_STTS_NM: "정상영업",
        DTL_SALS_STTS_CD: "0101",
        LCPMT_YMD: "20250220",
        TELNO: "064-711-1212",
        LAST_MDFCN_PNT: "20260307123000",
      },
    ];
  }

  return [];
}