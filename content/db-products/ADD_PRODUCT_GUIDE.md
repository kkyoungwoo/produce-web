> 이 가이드는 `AGENTS.md`의 필수 규칙과 함께 항상 확인해야 합니다.`n`n# ?좉퇋 DB ?곹뭹 異붽? 媛?대뱶

## 1) ?곹뭹 ?곗씠???뚯씪 異붽?
- ?꾩튂: `content/db-products/products/`
- ?뚯씪紐??덉떆: `api-15199999.ts`
- ?꾩닔: `ProductItem` 援ъ“濡??묒꽦

## 2) ?곹뭹 紐⑸줉???깅줉
- ?뚯씪: `content/db-products/products/index.ts`
- `productCatalog` 諛곗뿴???좉퇋 ?곹뭹 import/異붽?

## 3) ?뚰겕踰ㅼ튂 ?숈옉 ?ㅼ젙(遺꾧린 ?놁씠 ?ㅼ젙?쇰줈 愿由?
- ?뚯씪: `components/workbench/product-config.ts`
- `getWorkbenchProductConfig`??slug蹂??ㅼ젙 異붽?
- ?ㅼ젙 ??ぉ:
  - `inputMode`: `default` | `homestay`
  - `statMode`: `none` | `country:worknational` | `country:nationalName` | `region:homestay` | `region:addr`
  - `hideInputKeys`: ?④만 ?낅젰 ??  - `forceDefaultDates`, `forceBaseDateToYesterday`

## 4) ?섑뵆 ?곗씠??異붽?
- ?뚯씪: `components/workbench/samples.ts`
- `getSampleRows(product)`??slug蹂??섑뵆 5嫄?異붽?
- 洹쒖튃: ?ㅼ젣 異쒕젰 ?뚯씠釉붽낵 理쒕????숈씪?????뺤떇 ?좎?

## 5) 而щ읆 ?쇰꺼(?쒓?) 異붽?
- ?뚯씪: `components/workbench/constants.ts`
- `COLUMN_LABEL_KR`???좉퇋 ???쇰꺼 異붽?

## 6) ?뱀닔 ?щ㎎/留ㅽ븨???꾩슂?섎㈃
- ?뚯씪: `components/workbench/helpers.ts`
- `formatCellValue` ?먮뒗 援??/吏???뚯떛 ?⑥닔留?異붽?

---

## ?뚰겕踰ㅼ튂 ?듭떖 而댄룷?뚰듃
- 硫붿씤 UI + ?숈옉: `components/workbench-collector-client.tsx`
- ??? `components/workbench/types.ts`
- ?띿뒪?? `components/workbench/text.ts`
- ?곸닔/?쇰꺼: `components/workbench/constants.ts`
- ?щ㎎/寃利??좏떥: `components/workbench/helpers.ts`
- ?곹뭹蹂??숈옉 ?ㅼ젙: `components/workbench/product-config.ts`
- ?곹뭹蹂??섑뵆: `components/workbench/samples.ts`