import Stripe from "stripe";

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PLUS_MONTHLY_PRICE_ID &&
      process.env.STRIPE_PLUS_YEARLY_PRICE_ID &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(key);
}

export function stripePriceId(interval: "month" | "year") {
  const priceId =
    interval === "year"
      ? process.env.STRIPE_PLUS_YEARLY_PRICE_ID
      : process.env.STRIPE_PLUS_MONTHLY_PRICE_ID;
  if (!priceId) {
    throw new Error("Stripe price IDs are not configured.");
  }
  return priceId;
}

export function appUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}
