import type { LocaleContent } from "../types";

const ko: LocaleContent = {
  brand: "GORHROD LAB",
  localeName: "한국어",
  nav: {
    home: "홈",
    about: "프로필",
    services: "포트폴리오",
    contact: "연락",
  },
  hero: {
    badge: "DB CRAWLING · AUTOMATION · PRODUCT BUILD",
    title: "데이터 수집부터 생산 자동화까지, 개발 결과물을 보관하는 포트폴리오 허브",
    description:
      "이 사이트는 제가 실제로 개발한 DB 크롤링 및 생산 프로그램을 정리하고 검증 기록까지 남기는 개인 포트폴리오입니다. 모든 페이지는 한국어를 기본으로 하며, 언어 파일이 준비되지 않은 경우에도 콘텐츠가 안정적으로 표시됩니다.",
    primaryCta: "포트폴리오 보기",
    secondaryCta: "협업 문의",
  },
  home: {
    focusTitle: "핵심 작업 영역",
    focusCards: [
      {
        title: "DB 크롤링 파이프라인",
        description: "웹 수집, 정제, 적재까지 이어지는 자동화 흐름을 프로젝트 단위로 관리합니다.",
      },
      {
        title: "생산 자동화 프로그램",
        description: "반복 작업을 도구화해 업무 생산성을 높인 내부형 프로그램 사례를 축적합니다.",
      },
      {
        title: "운영/배포 이력",
        description: "버전, 배포 방식, 실패 원인과 개선 내역까지 개발 기록으로 남깁니다.",
      },
    ],
    featuredTitle: "대표 포트폴리오",
    featuredProjects: [
      {
        title: "Crawler Control Center",
        description: "타깃 사이트별 수집 규칙과 스케줄을 중앙에서 관리하는 크롤링 관제 도구",
        stack: ["Next.js", "TypeScript", "Playwright", "Firebase"],
        status: "운영 중",
      },
      {
        title: "DB Production Batch",
        description: "수집 데이터 전처리와 배치 생성을 자동화해 생산 시간을 단축한 파이프라인",
        stack: ["Node.js", "PostgreSQL", "Python", "Cloud Scheduler"],
        status: "고도화 진행",
      },
      {
        title: "Quality Audit Dashboard",
        description: "생산 결과의 품질 지표를 추적하고 이상치를 빠르게 탐지하는 내부 대시보드",
        stack: ["Next.js", "Chart.js", "SQL", "BigQuery"],
        status: "기획/검증",
      },
    ],
    workflowTitle: "개발 워크플로우",
    workflow: [
      "요구사항 정의 및 수집 대상 분석",
      "크롤링/정제/적재 파이프라인 구현",
      "운영 자동화와 모니터링 구성",
      "회고 기반 성능 튜닝 및 재배포",
    ],
  },
  about: {
    title: "프로필",
    summary:
      "DB 기반 자동화 서비스를 직접 설계하고 운영하는 개발자입니다. 웹에서 데이터를 안정적으로 수집하고, 실제 업무에 연결되는 생산 프로그램으로 전환하는 데 집중합니다.",
    strengthsTitle: "작업 강점",
    strengths: [
      "복잡한 수집 조건을 코드로 표준화해 재사용 가능한 구조로 전환",
      "프로토타입을 빠르게 만들고 운영 환경까지 이어지는 실행력",
      "문제 상황을 로그와 지표로 분석해 개선 사이클을 짧게 유지",
    ],
    timelineTitle: "최근 진행 흐름",
    timeline: [
      "2025 Q4: 크롤링 공통 모듈 정리 및 템플릿화",
      "2026 Q1: 다국어/SEO 포트폴리오 사이트 개편",
      "2026 Q2 목표: DB 생산 자동화 SaaS 형태로 확장",
    ],
  },
  services: {
    title: "포트폴리오 아카이브",
    description:
      "아래 항목은 실제 개발 또는 검증 중인 프로젝트입니다. 데이터 수집, DB 적재, 자동화 운영을 중심으로 지속 업데이트합니다.",
    items: [
      {
        title: "Site-Specific Web Crawler",
        description: "도메인별 차단 패턴을 고려한 수집 로직과 재시도 전략을 적용한 크롤러 세트",
        stack: ["TypeScript", "Playwright", "Proxy Rotation", "Queue"],
        status: "운영 중",
      },
      {
        title: "Data Normalization Engine",
        description: "비정형 수집 데이터를 스키마 기준으로 정규화해 DB 입력 품질을 보장하는 엔진",
        stack: ["Python", "Pandas", "PostgreSQL", "Validation"],
        status: "운영 중",
      },
      {
        title: "Auto Publish Worker",
        description: "생산 완료 데이터를 규칙 기반으로 배포 채널에 자동 반영하는 배치 워커",
        stack: ["Node.js", "Cron", "Firebase", "Webhook"],
        status: "개발 중",
      },
      {
        title: "Monitoring & Alert Bot",
        description: "크롤링 실패율과 지연 시간을 감시해 즉시 알림을 보내는 운영 보조 봇",
        stack: ["Cloud Functions", "Slack API", "Logs", "Metrics"],
        status: "기획/PoC",
      },
    ],
  },
  contact: {
    title: "연락",
    description: "프로젝트 협업, 자동화 개발 의뢰, 기술 검토 요청은 아래 채널로 남겨주세요.",
    emailLabel: "이메일",
    githubLabel: "GitHub",
    noteLabel: "메모",
    emailValue: "gorhrod.dev@gmail.com",
    githubValue: "https://github.com/gorhr",
    noteValue: "DB 크롤링/생산 자동화 중심 프로젝트를 우선 협업합니다.",
  },
  footer: "Personal Portfolio for DB Automation Projects",
  seo: {
    home: {
      title: "GORHROD LAB | DB 크롤링·생산 자동화 포트폴리오",
      description:
        "웹 DB 크롤링, 데이터 생산 자동화, 운영 기록을 정리한 개인 개발 포트폴리오. 한국어 기본 및 다국어 확장 구조 지원.",
      keywords: [
        "DB 크롤링",
        "데이터 생산 자동화",
        "개인 포트폴리오",
        "Next.js 포트폴리오",
        "한국어 SEO",
        "데이터 파이프라인",
        "Firebase Hosting",
      ],
    },
    about: {
      title: "프로필 | GORHROD LAB",
      description: "DB 수집 및 자동화 프로그램 중심 개발자의 역량, 방식, 최근 작업 흐름 소개",
      keywords: ["개발자 프로필", "자동화 개발", "데이터 엔지니어링", "포트폴리오"],
    },
    services: {
      title: "포트폴리오 아카이브 | GORHROD LAB",
      description: "웹 크롤러, 정규화 엔진, 자동 배포 워커 등 DB 생산 프로그램 포트폴리오 목록",
      keywords: ["크롤러", "배치 자동화", "DB 프로그램", "프로젝트 아카이브"],
    },
    contact: {
      title: "연락 | GORHROD LAB",
      description: "협업 및 개발 의뢰 문의 채널 안내",
      keywords: ["개발 문의", "협업", "자동화 프로젝트"],
    },
  },
};

export default ko;
