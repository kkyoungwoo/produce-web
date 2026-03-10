import type { Locale } from "./config";

type NavKey = "home" | "about" | "services" | "contact";

type SeoItem = {
  title: string;
  description: string;
  keywords: string[];
};

type LocaleContent = {
  brand: string;
  localeName: string;
  nav: Record<NavKey, string>;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  sections: {
    strengthsTitle: string;
    strengths: string[];
    processTitle: string;
    process: string[];
  };
  about: {
    title: string;
    description: string;
  };
  services: {
    title: string;
    items: { title: string; description: string }[];
  };
  contact: {
    title: string;
    description: string;
    emailLabel: string;
    phoneLabel: string;
    addressLabel: string;
  };
  footer: string;
  seo: {
    home: SeoItem;
    about: SeoItem;
    services: SeoItem;
    contact: SeoItem;
  };
};

export const content: Record<Locale, LocaleContent> = {
  ko: {
    brand: "글로벌 프로듀스",
    localeName: "한국어",
    nav: {
      home: "홈",
      about: "소개",
      services: "서비스",
      contact: "문의",
    },
    hero: {
      eyebrow: "GLOBAL WEB STARTER",
      title: "다국어 반응형 홈페이지를 빠르게 시작하세요",
      description:
        "Next.js 최신 버전 기반으로 한국어 중심 SEO, 메타태그, 다국어 페이지 구조를 기본 탑재했습니다.",
      ctaPrimary: "서비스 보기",
      ctaSecondary: "문의하기",
    },
    sections: {
      strengthsTitle: "핵심 강점",
      strengths: [
        "한국어 기준의 명확한 메타 정보와 검색 엔진 노출 구조",
        "모바일/태블릿/데스크톱 대응 반응형 레이아웃",
        "페이지별 다국어 전환과 hreflang 자동 구성",
      ],
      processTitle: "진행 프로세스",
      process: ["요구사항 정리", "다국어 콘텐츠 배치", "SEO 점검 및 배포"],
    },
    about: {
      title: "소개",
      description:
        "글로벌 프로듀스는 다국어 웹사이트 구축을 간단하고 빠르게 진행할 수 있도록 기본 템플릿과 구조를 제공합니다.",
    },
    services: {
      title: "서비스",
      items: [
        {
          title: "다국어 페이지 구축",
          description: "언어별 경로와 콘텐츠 관리를 체계적으로 구성합니다.",
        },
        {
          title: "SEO 고도화",
          description: "검색 노출 최적화를 위한 메타/구조화 전략을 적용합니다.",
        },
        {
          title: "배포 자동화",
          description: "Firebase Hosting 기반으로 빠르고 안정적인 배포를 제공합니다.",
        },
      ],
    },
    contact: {
      title: "문의",
      description: "프로젝트 범위와 일정, 예산을 공유해 주시면 빠르게 답변드리겠습니다.",
      emailLabel: "이메일",
      phoneLabel: "전화",
      addressLabel: "주소",
    },
    footer: "모든 권리 보유",
    seo: {
      home: {
        title: "글로벌 프로듀스 | 다국어 반응형 홈페이지",
        description: "한국어 중심 SEO와 다국어 페이지를 갖춘 Next.js 기반 홈페이지 기본 세팅",
        keywords: ["Next.js", "다국어 홈페이지", "반응형 웹", "한국어 SEO", "Firebase Hosting"],
      },
      about: {
        title: "소개 | 글로벌 프로듀스",
        description: "글로벌 프로듀스의 다국어 웹사이트 구축 철학과 기본 구성 소개",
        keywords: ["회사 소개", "다국어 웹사이트", "글로벌 프로듀스"],
      },
      services: {
        title: "서비스 | 글로벌 프로듀스",
        description: "다국어 페이지 구축, SEO 최적화, Firebase 배포까지 제공하는 서비스 안내",
        keywords: ["웹 개발", "SEO", "Firebase 배포", "Next.js 개발"],
      },
      contact: {
        title: "문의 | 글로벌 프로듀스",
        description: "프로젝트 문의 및 협업 상담 페이지",
        keywords: ["문의", "웹사이트 제작 문의", "협업"],
      },
    },
  },
  en: {
    brand: "Global Produce",
    localeName: "English",
    nav: {
      home: "Home",
      about: "About",
      services: "Services",
      contact: "Contact",
    },
    hero: {
      eyebrow: "GLOBAL WEB STARTER",
      title: "Launch a multilingual responsive site faster",
      description:
        "Built on the latest Next.js, this starter includes Korean-first SEO, metadata, and multilingual routing.",
      ctaPrimary: "View Services",
      ctaSecondary: "Contact",
    },
    sections: {
      strengthsTitle: "Core Strengths",
      strengths: [
        "Clear metadata model optimized for Korean-first search strategy",
        "Responsive layout for mobile, tablet, and desktop",
        "Per-page language switching with hreflang structure",
      ],
      processTitle: "Workflow",
      process: ["Scope alignment", "Localized content setup", "SEO review and deployment"],
    },
    about: {
      title: "About",
      description:
        "Global Produce provides a practical baseline for building multilingual websites quickly and consistently.",
    },
    services: {
      title: "Services",
      items: [
        {
          title: "Multilingual Page Setup",
          description: "We structure locale routes and content for scalable expansion.",
        },
        {
          title: "SEO Optimization",
          description: "We implement metadata and indexing strategy for better search visibility.",
        },
        {
          title: "Deployment Automation",
          description: "We deliver fast and stable Firebase Hosting deployment flows.",
        },
      ],
    },
    contact: {
      title: "Contact",
      description: "Share your goals, timeline, and budget and we will get back quickly.",
      emailLabel: "Email",
      phoneLabel: "Phone",
      addressLabel: "Address",
    },
    footer: "All rights reserved",
    seo: {
      home: {
        title: "Global Produce | Multilingual Responsive Website",
        description: "Next.js starter with Korean-first SEO and multilingual page architecture",
        keywords: ["Next.js", "multilingual website", "responsive web", "SEO", "Firebase Hosting"],
      },
      about: {
        title: "About | Global Produce",
        description: "Learn about the multilingual website baseline from Global Produce",
        keywords: ["about", "multilingual", "website"],
      },
      services: {
        title: "Services | Global Produce",
        description: "Multilingual setup, SEO optimization, and Firebase deployment support",
        keywords: ["web development", "SEO", "Firebase", "Next.js"],
      },
      contact: {
        title: "Contact | Global Produce",
        description: "Project inquiry and collaboration contact page",
        keywords: ["contact", "project inquiry"],
      },
    },
  },
  ja: {
    brand: "グローバルプロデュース",
    localeName: "日本語",
    nav: {
      home: "ホーム",
      about: "紹介",
      services: "サービス",
      contact: "お問い合わせ",
    },
    hero: {
      eyebrow: "GLOBAL WEB STARTER",
      title: "多言語対応レスポンシブサイトを迅速に構築",
      description:
        "最新のNext.jsを基盤に、韓国語中心SEO・メタタグ・多言語ルーティングを標準搭載しています。",
      ctaPrimary: "サービスを見る",
      ctaSecondary: "お問い合わせ",
    },
    sections: {
      strengthsTitle: "主な強み",
      strengths: [
        "韓国語基準の明確なメタ情報と検索最適化構造",
        "モバイル・タブレット・デスクトップ対応のレスポンシブ設計",
        "ページ単位の言語切替とhreflang構成",
      ],
      processTitle: "進行プロセス",
      process: ["要件整理", "多言語コンテンツ配置", "SEO確認とデプロイ"],
    },
    about: {
      title: "紹介",
      description:
        "グローバルプロデュースは、多言語Webサイトを素早く安定して構築するための基本テンプレートを提供します。",
    },
    services: {
      title: "サービス",
      items: [
        {
          title: "多言語ページ構築",
          description: "言語別ルートとコンテンツ運用を体系的に設計します。",
        },
        {
          title: "SEO最適化",
          description: "検索流入を高めるメタ戦略と構造を実装します。",
        },
        {
          title: "デプロイ自動化",
          description: "Firebase Hostingで高速かつ安定した公開を実現します。",
        },
      ],
    },
    contact: {
      title: "お問い合わせ",
      description: "プロジェクト内容、期間、予算をご共有いただければ迅速にご案内します。",
      emailLabel: "メール",
      phoneLabel: "電話",
      addressLabel: "住所",
    },
    footer: "無断転載を禁じます",
    seo: {
      home: {
        title: "グローバルプロデュース | 多言語レスポンシブWeb",
        description: "韓国語中心SEOと多言語ページを備えたNext.js基盤のWebスターター",
        keywords: ["Next.js", "多言語サイト", "レスポンシブ", "SEO", "Firebase"],
      },
      about: {
        title: "紹介 | グローバルプロデュース",
        description: "多言語Web構築の基本方針とテンプレート構成の紹介",
        keywords: ["会社紹介", "多言語", "Web"],
      },
      services: {
        title: "サービス | グローバルプロデュース",
        description: "多言語構築、SEO最適化、Firebaseデプロイ支援",
        keywords: ["開発", "SEO", "Firebase", "Next.js"],
      },
      contact: {
        title: "お問い合わせ | グローバルプロデュース",
        description: "プロジェクト相談ページ",
        keywords: ["お問い合わせ", "相談"],
      },
    },
  },
  zh: {
    brand: "Global Produce",
    localeName: "中文",
    nav: {
      home: "首页",
      about: "介绍",
      services: "服务",
      contact: "联系",
    },
    hero: {
      eyebrow: "GLOBAL WEB STARTER",
      title: "快速搭建多语言响应式网站",
      description: "基于最新Next.js，默认包含韩语优先SEO、Meta标签与多语言路由结构。",
      ctaPrimary: "查看服务",
      ctaSecondary: "联系我们",
    },
    sections: {
      strengthsTitle: "核心优势",
      strengths: [
        "以韩语为基准的清晰元信息与搜索结构",
        "适配手机、平板、桌面的响应式布局",
        "页面级语言切换与hreflang配置",
      ],
      processTitle: "实施流程",
      process: ["需求梳理", "多语言内容配置", "SEO检查与部署"],
    },
    about: {
      title: "介绍",
      description: "Global Produce 提供多语言网站快速落地所需的基础模板与结构。",
    },
    services: {
      title: "服务",
      items: [
        {
          title: "多语言页面搭建",
          description: "系统化配置语言路由与内容结构，便于后续扩展。",
        },
        {
          title: "SEO优化",
          description: "落地面向搜索引擎的元信息与索引策略。",
        },
        {
          title: "部署自动化",
          description: "基于Firebase Hosting实现稳定快速上线。",
        },
      ],
    },
    contact: {
      title: "联系",
      description: "欢迎提供项目范围、时间计划与预算，我们会尽快回复。",
      emailLabel: "邮箱",
      phoneLabel: "电话",
      addressLabel: "地址",
    },
    footer: "版权所有",
    seo: {
      home: {
        title: "Global Produce | 多语言响应式网站",
        description: "基于Next.js的多语言网站基础方案，包含韩语优先SEO设置",
        keywords: ["Next.js", "多语言网站", "响应式", "SEO", "Firebase Hosting"],
      },
      about: {
        title: "介绍 | Global Produce",
        description: "了解Global Produce多语言网站基础模板",
        keywords: ["介绍", "多语言", "网站"],
      },
      services: {
        title: "服务 | Global Produce",
        description: "多语言搭建、SEO优化与Firebase部署支持",
        keywords: ["网站开发", "SEO", "Firebase", "Next.js"],
      },
      contact: {
        title: "联系 | Global Produce",
        description: "项目咨询与合作沟通页面",
        keywords: ["联系", "咨询"],
      },
    },
  },
};
