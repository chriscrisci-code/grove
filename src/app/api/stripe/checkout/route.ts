import { z } from "zod";
import {
  hasLivePlusSubscription,
  type SubscriptionStatus,
} from "@/features/billing/billing-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  appUrl,
  getStripe,
  isStripeConfigured,
  stripePriceId,
} from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  interval: z.enum(["month", "year"]).default("month"),
});

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json(
      { error: "Payments are not configured yet." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Choose monthly or yearly." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: billing } = await admin
    .from("user_billing")
    .select("subscription_status,stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  let customerId =
    typeof billing?.stripe_customer_id === "string"
      ? billing.stripe_customer_id
      : null;
  const status = (billing?.subscription_status ?? "none") as SubscriptionStatus;

  if (customerId && hasLivePlusSubscription(status)) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl(request)}/account/billing`,
    });
    return Response.json({ url: portal.url });
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    const { error } = await admin.from("user_billing").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
    });
    if (error) {
      return Response.json(
        { error: "Your billing profile could not be prepared." },
        { status: 500 },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: stripePriceId(parsed.data.interval), quantity: 1 }],
    success_url: `${appUrl(request)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl(request)}/pricing`,
    allow_promotion_codes: true,
    metadata: { user_id: user.id },
    subscription_data: {
      metadata: { user_id: user.id },
    },
  });

  if (!session.url) {
    return Response.json(
      { error: "Checkout could not be started." },
      { status: 500 },
    );
  }

  return Response.json({ url: session.url });
}
