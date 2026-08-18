/** Flip to false when Stripe is live and free limits should apply. */
export const UNLOCK_PAID_FOR_TESTING = true;

export const FREE_LIMITS = {
  projects: 1,
  pagesPerProject: 50,
} as const;

export const FEATURE_REQUIRED_PLAN = {
  extraProjects: "paid",
  extraPages: "paid",
  aiAsk: "paid",
  research: "paid",
  relationships: "free",
  chapterPdf: "paid",
  nightColors: "free",
  covers: "free",
  tags: "free",
  findLinks: "free",
  spellingThesaurus: "free",
} as const;

export type FeatureName = keyof typeof FEATURE_REQUIRED_PLAN;

export type PlanAccess = {
  isPaid: boolean;
  limits: {
    projects: number;
    pagesPerProject: number;
  };
  features: Record<FeatureName, boolean>;
};

export function getPlanAccess(options?: {
  subscribed?: boolean;
  unlockPaid?: boolean;
}): PlanAccess {
  const isPaid =
    (options?.unlockPaid ?? UNLOCK_PAID_FOR_TESTING) ||
    Boolean(options?.subscribed);
  const features = {} as Record<FeatureName, boolean>;
  for (const [name, required] of Object.entries(FEATURE_REQUIRED_PLAN)) {
    features[name as FeatureName] = required === "free" || isPaid;
  }
  return {
    isPaid,
    limits: isPaid
      ? { projects: Number.POSITIVE_INFINITY, pagesPerProject: Number.POSITIVE_INFINITY }
      : { ...FREE_LIMITS },
    features,
  };
}

export function canUseFeature(
  feature: FeatureName,
  access = getPlanAccess(),
) {
  return access.features[feature];
}

export function canCreateProject(
  currentCount: number,
  access = getPlanAccess(),
) {
  return access.isPaid || currentCount < access.limits.projects;
}

export function canCreatePage(
  currentCount: number,
  access = getPlanAccess(),
) {
  return access.isPaid || currentCount < access.limits.pagesPerProject;
}

export function planLimitMessage(feature: FeatureName) {
  switch (feature) {
    case "extraProjects":
      return "Free Grove includes 1 story. Grove Paid unlocks more.";
    case "extraPages":
      return "Free Grove includes 50 pages in a story. Grove Paid unlocks more.";
    case "aiAsk":
      return "Ask AI is a Grove Paid feature.";
    case "research":
      return "Research is a Grove Paid feature.";
    case "relationships":
      return "Relationships is a Grove Paid feature.";
    case "chapterPdf":
      return "Printing chapters to PDF is a Grove Paid feature.";
    case "covers":
      return "Project covers are a Grove Paid feature.";
    case "nightColors":
      return "Night colors are a Grove Paid feature.";
    case "tags":
      return "Tags are a Grove Paid feature.";
    case "findLinks":
      return "Find Links is a Grove Paid feature.";
    case "spellingThesaurus":
      return "Spelling and synonyms are a Grove Paid feature.";
  }
}

export function paidRequiredResponse(feature: FeatureName) {
  return Response.json(
    { error: planLimitMessage(feature) },
    { status: 402 },
  );
}
