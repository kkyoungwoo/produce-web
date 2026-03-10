# Produce Web (Next.js)

이 프로젝트는 Create React App에서 Next.js(App Router)로 마이그레이션되었습니다.

## 로컬에서 화면 확인하기

```bash
yarn install
yarn start
```

개발 서버는 `0.0.0.0:3000`으로 열리며, 브라우저에서 아래 주소로 확인할 수 있습니다.

- http://localhost:3000

> 포트 충돌 시: `PORT=3001 yarn start`로 실행 후 `http://localhost:3001` 접속

## 실행 스크립트

```bash
yarn dev
```

개발 서버 실행 (`yarn start`와 동일)

```bash
yarn build
```

프로덕션 빌드 생성

```bash
yarn test
```

현재 테스트 전략은 `eslint .` 기반 정적 검증입니다.
