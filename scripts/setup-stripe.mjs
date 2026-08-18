import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("Set STRIPE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const stripe = new Stripe(secret);

const product = await stripe.products.create({
  name: "Grove Plus",
  description:
    "Unlimited stories and pages, research, review, Ask AI, and manuscript PDF export.",
});

const monthly = await stripe.prices.create({
  product: product.id,
  currency: "usd",
  unit_amount: 900,
  recurring: { interval: "month" },
});

const yearly = await stripe.prices.create({
  product: product.id,
  currency: "usd",
  unit_amount: 9000,
  recurring: { interval: "year" },
});

console.log("Add these to .env.local and your Vercel environment:");
console.log(`STRIPE_PLUS_MONTHLY_PRICE_ID=${monthly.id}`);
console.log(`STRIPE_PLUS_YEARLY_PRICE_ID=${yearly.id}`);
