# AGENTS.md (produce-web)

## Mandatory Workflow
- Always read `content/db-products/ADD_PRODUCT_GUIDE.md` before adding or changing DB products.
- Keep existing UI layout/design unless the user explicitly requests design change.
- Separate code by role: UI, logic, text, and product data.
- Do not hardcode per-product behavior in large component branches if config-driven mapping is possible.

## DB Product Rules
- Product file: `content/db-products/products/<slug>.ts`
- Product list registration: `content/db-products/products/index.ts`
- Workbench behavior config: `components/workbench/product-config.ts`
- Sample rows: `components/workbench/samples.ts`
- Column labels/constants: `components/workbench/constants.ts`
- Parsing/format helpers: `components/workbench/helpers.ts`
- Main workbench component: `components/workbench-collector-client.tsx`

## Encoding Rules
- Use UTF-8 for `.ts`, `.tsx`, `.js`, `.json`, `.css`, `.md`.
- Do not save files with ANSI/EUC-KR/CP949.
- If mojibake text appears, fix text only (do not change business logic unless requested).

## Product Change Checklist
1. Keep layout and interaction behavior unchanged unless asked.
2. Update product data/config/sample in designated files.
3. Ensure sample rows match real output schema and Korean-friendly text.
4. Build check: `npm run build` must pass.