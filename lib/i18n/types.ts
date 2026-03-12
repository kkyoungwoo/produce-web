export type NavKey = "home" | "about" | "services" | "contact";

export type SeoItem = {
  title: string;
  description: string;
  keywords: string[];
};

export type CollectorKey =
  | "range-batch"
  | "condition-paging"
  | "schema-validated"
  | "realtime-filter"
  | "scheduled-pipeline";

export type CollectorRuntimeHint = {
  key: string;
  label: string;
  description: string;
};

export type CollectorProfile = {
  key: CollectorKey;
  title: string;
  shortDescription: string;
  runStrategy: string;
  runtimeHints: CollectorRuntimeHint[];
};

export type ProductInputField = {
  key: string;
  label: string;
  example: string;
  required: boolean;
};

export type ProductApiCredential = {
  envVarName: string;
  queryKey: string;
  placeholder: string;
};

export type ProductApiRuntime = {
  endpoint: string;
  historyEndpoint?: string;
  historySwitchParamKey?: string;
  responsePathHint?: string;
  forcedQuery?: Record<string, string>;
};

export type ProductWorkbenchColumn = {
  key: string;
  label: string;
};

export type ProductWorkbenchRow = Record<string, string | number>;

export type ProductWorkbenchConfig = {
  columns: ProductWorkbenchColumn[];
  rows: ProductWorkbenchRow[];
  primaryDateKey?: string;
};

export type ProductItem = {
  slug: string;
  collectorKey: CollectorKey;
  title: string;
  summary: string;
  description: string;
  stack: string[];
  status: string;
  priceLabel: string;
  priceValue: number;
  delivery: string;
  audience: string;
  features: string[];
  portalDataId: string;
  apiDocUrl: string;
  apiGuideUrl?: string;
  accountGuideUrl: string;
  collectFocus: string;
  inputFields: ProductInputField[];
  sampleRequest: string;
  apiCredential?: ProductApiCredential;
  apiRuntime?: ProductApiRuntime;
  workbench?: ProductWorkbenchConfig;
};

export type LocaleContent = {
  brand: string;
  localeName: string;
  nav: Record<NavKey, string>;
  store: {
    detailLabel: string;
    buyLabel: string;
    useLabel: string;
    buySubLabel: string;
    priceLabel: string;
    deliveryLabel: string;
    audienceLabel: string;
    includedLabel: string;
  };
  hero: {
    badge: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  home: {
    marketTitle: string;
    marketDescription: string;
    marketHighlights: string[];
    featuredTitle: string;
    featuredProducts: ProductItem[];
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
    guaranteeTitle: string;
    guarantee: string[];
    items: ProductItem[];
    badge: string;
    lead: string;
    registeredLabel: string;
    realtimeLabel: string;
    realtimeValue: string;
    listDetailCta: string;
  };
  serviceDetail: {
    badge: string;
    apiSourcesTitle: string;
    apiDocLabel: string;
    apiGuideLabel: string;
    apiAccountLabel: string;
    apiChatLabel: string;
    openLabel: string;
    inputGuideBadge: string;
    sampleRequestBadge: string;
    sampleCodeLabel: string;
    includesBadge: string;
    otherProductsTitle: string;
    allProductsLabel: string;
    cardCollectLabel: string;
    cardInputLabel: string;
    cardDocLabel: string;
    cardGuideLabel: string;
    cardAccountLabel: string;
  };
  workbench: {
    metaTitleSuffix: string;
    metaDescriptionSuffix: string;
    badge: string;
    titleSuffix: string;
    description: string;
    backToDetailLabel: string;
    consultLabel: string;
    collectorModeLabel: string;
    apiKeyConfigLabel: string;
    envVarLabel: string;
    queryKeyLabel: string;
    inputConfigBadge: string;
    inputParamsTitle: string;
    inputConfigHint: string;
    previewRunLabel: string;
    resetInputsLabel: string;
    autoFillPreviewBadge: string;
    autoFillReadyTitle: string;
    autoFillDescription: string;
    pcPreviewBadge: string;
    resultTableTitle: string;
    excelDownloadLabel: string;
    baseDateLabel: string;
    expectedRowsLabel: string;
    statusLabel: string;
    statusReadyValue: string;
    endpointLabel: string;
    endpointHint: string;
    queryResultLabel: string;
    queryErrorLabel: string;
    noDataLabel: string;
    sourceUrlLabel: string;
  };
  contact: {
    title: string;
    description: string;
    purchaseTitle: string;
    purchaseDescription: string;
    purchaseStepsTitle: string;
    purchaseSteps: string[];
    responseLabel: string;
    responseValue: string;
    kakaoLabel: string;
    kakaoHint: string;
    kakaoValue: string;
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