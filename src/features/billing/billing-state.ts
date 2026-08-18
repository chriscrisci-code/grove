export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type BillingState = {
  effectivePlan: "free" | "plus";
  previewMode: boolean;
  subscriptionStatus: SubscriptionStatus;
  hasStripeCustomer: boolean;
  activeWorkspaceId: string | null;
  activeWorkspaceChangedAt: string | null;
  nextActiveSwitchAt: string | null;
  activeSelectionGraceUntil: string | null;
};

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
];

export const PREVIEW_BILLING_STATE: BillingState = {
  effectivePlan: "plus",
  previewMode: true,
  subscriptionStatus: "none",
  hasStripeCustomer: false,
  activeWorkspaceId: null,
  activeWorkspaceChangedAt: null,
  nextActiveSwitchAt: null,
  activeSelectionGraceUntil: null,
};

export const FREE_BILLING_STATE: BillingState = {
  ...PREVIEW_BILLING_STATE,
  effectivePlan: "free",
  previewMode: false,
};

function asSubscriptionStatus(value: unknown): SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : "none";
}

export function normalizeBillingState(value: unknown): BillingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return PREVIEW_BILLING_STATE;
  }
  const raw = value as Record<string, unknown>;
  return {
    effectivePlan: raw.effectivePlan === "free" ? "free" : "plus",
    previewMode: raw.previewMode !== false,
    subscriptionStatus: asSubscriptionStatus(raw.subscriptionStatus),
    hasStripeCustomer: raw.hasStripeCustomer === true,
    activeWorkspaceId:
      typeof raw.activeWorkspaceId === "string"
        ? raw.activeWorkspaceId
        : null,
    activeWorkspaceChangedAt:
      typeof raw.activeWorkspaceChangedAt === "string"
        ? raw.activeWorkspaceChangedAt
        : null,
    nextActiveSwitchAt:
      typeof raw.nextActiveSwitchAt === "string"
        ? raw.nextActiveSwitchAt
        : null,
    activeSelectionGraceUntil:
      typeof raw.activeSelectionGraceUntil === "string"
        ? raw.activeSelectionGraceUntil
        : null,
  };
}

export function hasLivePlusSubscription(status: SubscriptionStatus) {
  return (
    status === "active" || status === "trialing" || status === "past_due"
  );
}

export function canSwitchActiveStory(
  nextActiveSwitchAt: string | null,
  activeSelectionGraceUntil: string | null = null,
  now = Date.now(),
) {
  if (activeSelectionGraceUntil) {
    const graceEnd = new Date(activeSelectionGraceUntil).getTime();
    if (Number.isFinite(graceEnd) && now <= graceEnd) return true;
  }
  if (!nextActiveSwitchAt) return true;
  const next = new Date(nextActiveSwitchAt).getTime();
  return !Number.isFinite(next) || now >= next;
}

export function formatActiveStorySwitchDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
