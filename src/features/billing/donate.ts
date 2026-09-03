export const DONATE_MIN_CENTS = 100;
export const DONATE_MAX_CENTS = 50_000;
export const DONATE_SUGGESTED_CENTS = [500, 1000, 2500, 5000] as const;

/** Normalize a donation amount; returns null when out of range. */
export function normalizeDonateAmountCents(value: unknown): number | null {
  const cents =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(cents)) return null;
  const rounded = Math.round(cents);
  if (rounded < DONATE_MIN_CENTS || rounded > DONATE_MAX_CENTS) return null;
  return rounded;
}

export function dollarsToCents(dollars: string | number): number | null {
  const n =
    typeof dollars === "number" ? dollars : Number(String(dollars).trim());
  if (!Number.isFinite(n)) return null;
  return normalizeDonateAmountCents(Math.round(n * 100));
}
