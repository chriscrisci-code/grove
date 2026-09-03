/** Used by the local demo and tests. Live requests read billing from Supabase. */
export const UNLOCK_PAID_FOR_TESTING = false;

/**
 * When true, every account gets full feature access. Plus subscription CTAs
 * stay dormant; optional donations support Grove development instead.
 */
export const PAY_TIERS_SUSPENDED = true;

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
  collaboration: "paid",
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
    PAY_TIERS_SUSPENDED ||
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

export function planAccessFromBilling(effectivePlan: "free" | "plus") {
  if (PAY_TIERS_SUSPENDED) {
    return getPlanAccess({ unlockPaid: true, subscribed: false });
  }
  return getPlanAccess({
    unlockPaid: false,
    subscribed: effectivePlan === "plus",
  });
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
  if (PAY_TIERS_SUSPENDED) {
    return "Grove is free for everyone right now. If something looks locked, refresh and try again.";
  }
  switch (feature) {
    case "extraProjects":
      return "Free Grove includes 1 story. Grove Plus unlocks more.";
    case "extraPages":
      return "Free Grove includes 50 pages in a story. Grove Plus unlocks more.";
    case "aiAsk":
      return "Ask AI is a Grove Plus feature.";
    case "research":
      return "Research is a Grove Plus feature.";
    case "relationships":
      return "Relationships is a Grove Plus feature.";
    case "chapterPdf":
      return "Printing chapters or scripts to PDF is a Grove Plus feature.";
    case "covers":
      return "Project covers are a Grove Plus feature.";
    case "nightColors":
      return "Night colors are a Grove Plus feature.";
    case "tags":
      return "Tags are a Grove Plus feature.";
    case "findLinks":
      return "Find Links is a Grove Plus feature.";
    case "spellingThesaurus":
      return "Spelling and synonyms are a Grove Plus feature.";
    case "collaboration":
      return "Inviting reviewers or editors is a Grove Plus feature.";
  }
}

export function paidRequiredResponse(feature: FeatureName) {
  return Response.json(
    { error: planLimitMessage(feature) },
    { status: 402 },
  );
}
