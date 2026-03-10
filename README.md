# Produce Web (Next.js)

다국어(ko/en/ja/zh) 라우팅과 한국어 중심 SEO 메타 구성을 포함한 Next.js 최신 버전 기본 세팅 프로젝트입니다.

## Stack

- Next.js (latest, App Router)
- React (latest)
- TypeScript
- Firebase Hosting (`out` 정적 배포)

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

정적 결과물은 `out/` 폴더에 생성됩니다.

## Firebase Deploy

`.firebaserc`의 기본 프로젝트를 확인한 뒤 배포합니다.

```bash
npx firebase-tools deploy --only hosting --project gorhrod-codex --token <FIREBASE_TOKEN>
```

## Routes

- `/ko`, `/en`, `/ja`, `/zh`
- `/{locale}/about`
- `/{locale}/services`
- `/{locale}/contact`

## SEO

- 페이지별 `generateMetadata`
- locale별 `canonical` + `hreflang`
- Open Graph / Twitter Card
- `sitemap.xml`, `robots.txt`