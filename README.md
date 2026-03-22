# Produce Web (Next.js)

다국어(ko/en/ja/zh) 라우팅과 한국어 중심 SEO 메타 구성을 포함한 Next.js 최신 버전 기본 세팅 프로젝트입니다.

## Stack

- Next.js (latest, App Router)
- React (latest)
- TypeScript
- Firebase Hosting 설정 파일 포함

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

현재 `package.json`의 build 스크립트는 `next build` 이므로, 기본 빌드 결과물은 정적 export용 `out/`이 아니라 Next.js 빌드 산출물(`.next/`) 기준으로 이해해야 합니다.

## Firebase Deploy 주의

현재 저장소에는 `firebase.json`의 Hosting public 경로가 `out`으로 설정되어 있습니다.
하지만 `next.config.ts`에는 `output: 'export'` 설정이 없고, `build` 스크립트도 `next export` 흐름을 포함하지 않습니다.

즉, **문서 기준으로는 Firebase Hosting 배포 설정과 Next.js 빌드 설정이 아직 완전히 정렬되어 있지 않습니다.**
배포 전에 아래 둘 중 하나로 맞춰야 합니다.

1. 정적 export 방식으로 운영할 경우
   - `next.config.ts`에 `output: 'export'`를 추가
   - `out/` 산출물 기준으로 배포
2. SSR/기본 Next.js 빌드 방식으로 운영할 경우
   - Firebase Hosting 설정과 배포 문서를 `.next` 또는 해당 배포 타깃 기준으로 다시 정리

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
