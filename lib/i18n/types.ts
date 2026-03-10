export type NavKey = "home" | "about" | "services" | "contact";

export type SeoItem = {
  title: string;
  description: string;
  keywords: string[];
};

export type FocusCard = {
  title: string;
  description: string;
};

export type ProjectItem = {
  title: string;
  description: string;
  stack: string[];
  status: string;
};

export type LocaleContent = {
  brand: string;
  localeName: string;
  nav: Record<NavKey, string>;
  hero: {
    badge: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  home: {
    focusTitle: string;
    focusCards: FocusCard[];
    featuredTitle: string;
    featuredProjects: ProjectItem[];
    workflowTitle: string;
    workflow: string[];
  };
  about: {
    title: string;
    summary: string;
    strengthsTitle: string;
    strengths: string[];
    timelineTitle: string;
    timeline: string[];
  };
  services: {
    title: string;
    description: string;
    items: ProjectItem[];
  };
  contact: {
    title: string;
    description: string;
    emailLabel: string;
    githubLabel: string;
    noteLabel: string;
    emailValue: string;
    githubValue: string;
    noteValue: string;
  };
  footer: string;
  seo: {
    home: SeoItem;
    about: SeoItem;
    services: SeoItem;
    contact: SeoItem;
  };
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};
