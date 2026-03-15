export type NavKey = "home" | "about" | "services" | "contact" | "dbCleanup";

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

export type LandingTrustItem = {
  kicker: string;
  label: string;
};

export type LandingProcessCard = {
  step: string;
  title: string;
  description: string;
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
  landing: {
    points: string[];
    title: string;
    titleAccent: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    status: string;
    panelTitle: string;
    panelDescription: string;
    trustItems: LandingTrustItem[];
    whyTag: string;
    whyTitle: string;
    whyDescription: string;
    processCards: LandingProcessCard[];
    businessTag: string;
    businessTitle: string;
    businessDescription: string;
    promiseKicker: string;
    promiseTitle: string;
    promiseDescription: string;
    promisePrimary: string;
    promiseSecondary: string;
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
    listStatusLabel: string;
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
    noOtherProducts: string;
    prevLabel: string;
    nextLabel: string;
    relatedStatusLabel: string;
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
    ui: {
      inputTitle: string;
      serviceKeyLabel: string;
      serviceKeyPlaceholder: string;
      serviceKeyHelp: string;
      regionSelectLabel: string;
      selectAllLabel: string;
      clearAllLabel: string;
      permitFromLabel: string;
      permitToLabel: string;
      statRegion: string;
      statCountry: string;
      regionFilterTitle: string;
      allFilterLabel: string;
      totalPrefix: string;
      currentPrefix: string;
      countSuffix: string;
      endpointMissing: string;
      queryFailed: string;
      networkFailed: string;
      allExcelLabel: string;
      filteredExcelLabel: string;
      groupedRegionExcelLabel: string;
      groupedCountryExcelLabel: string;
      salesStatusLabel: string;
      salesStatusHint: string;
      regionRequired: string;
      sidoRequired: string;
      sigunguRequired: string;
      archhubRegionLoadFailed: string;
      archhubLegalDongLoadFailed: string;
      archhubNoLegalDong: string;
      archhubSidoLabel: string;
      archhubSigunguLabel: string;
      archhubSigunguHint: string;
      elevatorConditionLabel: string;
      elevatorPassengerLabel: string;
      elevatorEmergencyLabel: string;
      elevatorHint: string;
      progressPreparing: string;
      progressWaiting: string;
      progressKeepPage: string;
      progressDefaultDetail: string;
      progressSingleRequestDetail: string;
      progressCompletedTitle: string;
      progressCancelled: string;
      regionUnclassified: string;
      previewUsingDefaultKey: string;
      previewUsingFallbackKey: string;
      previewMissingDefaultKey: string;
      previewLimitSuffix: string;
    };
  };
  dbCleanup: {
    metaTitle: string;
    metaDescription: string;
    ogDescription: string;
    twitterDescription: string;
    eyebrow: string;
    heroTitleLines: string[];
    heroDescription: string;
    flowSteps: Array<{
      title: string;
      description: string;
    }>;
    currentStatusTitle: string;
    progress: {
      idle: string;
      existingOnly: string;
      newOnly: string;
      ready: string;
      selecting: string;
      processing: string;
    };
    statusMetrics: {
      existingFile: string;
      newFile: string;
      ready: string;
      waiting: string;
      uploadNeeded: string;
      rowsSuffix: string;
      countSuffix: string;
    };
    infoItems: Array<{
      label: string;
      value: string;
    }>;
    upload: {
      existingTitle: string;
      existingDescription: string;
      newTitle: string;
      newDescription: string;
      dropHintTitle: string;
      dropHintDescription: string;
      uploadedLabel: string;
      columnsLabel: string;
      loadedAtLabel: string;
      changeFileLabel: string;
      removeLabel: string;
      rowsLoadedSuffix: string;
    };
    messages: {
      errorTitle: string;
      infoTitle: string;
      infoLines: string[];
    };

selection: {
  step1: string;
  step2: string;
  newSecondStepLabel: string;
  newTitle: string;
  newDescription: string;
  newSecondTitle: string;
  newSecondDescription: string;
  existingTitle: string;
  existingDescription: string;
  pickedLabel: string;
  selectAllLabel: string;
  clearAllLabel: string;
  blankRowsLabel: string;
  blankRowsKeep: string;
  blankRowsRemove: string;
  showNumberColumns: string;
};
    actionBar: {
      title: string;
      description: string;
      singleDescription: string;
      runLabel: string;
      runningLabel: string;
      resetLabel: string;
    };
    errors: {
      newFileRequired: string;
      filesRequired: string;
      newHeadersRequired: string;
      existingHeadersRequired: string;
      headersMustMatch: string;
      newFileReadFailed: string;
      existingFileReadFailed: string;
      processFailed: string;
    };
    loading: {
      title: string;
      description: string;
    };
    singleMode: {
      progress: string;
      infoLines: string[];
    };
    result: {
      eyebrow: string;
      title: string;
      downloadAllLabel: string;
      newCriteriaLabel: string;
      existingCriteriaLabel: string;
      fileSuffixes: {
        first: string;
        second: string;
      };
      stats: {
        newOriginal: string;
        newRemoved: string;
        newAfterFirstPass: string;
        existingRemoved: string;
        finalNew: string;
        mergedTotal: string;
      };
      cards: {
        firstEyebrow: string;
        firstDescription: string;
        firstButton: string;
        secondEyebrow: string;
        secondDescription: string;
        secondButton: string;
      };
    };
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
