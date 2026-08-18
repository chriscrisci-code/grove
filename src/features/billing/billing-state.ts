export type BillingState = {
  effectivePlan: "free" | "plus";
  previewMode: boolean;
  activeWorkspaceId: string | null;
  activeWorkspaceChangedAt: string | null;
  nextActiveSwitchAt: string | null;
  activeSelectionGraceUntil: string | null;
};

export const PREVIEW_BILLING_STATE: BillingState = {
  effectivePlan: "plus",
  previewMode: true,
  activeWorkspaceId: null,
  activeWorkspaceChangedAt: null,
  nextActiveSwitchAt: null,
  activeSelectionGraceUntil: null,
};

export function normalizeBillingState(value: unknown): BillingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return PREVIEW_BILLING_STATE;
  }
  const raw = value as Record<string, unknown>;
  return {
    effectivePlan: raw.effectivePlan === "free" ? "free" : "plus",
    previewMode: raw.previewMode !== false,
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
