import { z } from "zod";
import { normalizeDonateAmountCents } from "@/features/billing/donate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  appUrl,
  getStripe,
  isStripeDonateConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountCents: z.number().int(),
});

export async function POST(request: Request) {
  if (!isStripeDonateConfigured()) {
    return Response.json(
      { error: "Donations are not configured yet." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Choose a donation amount." }, { status: 400 });
  }

  const amountCents = normalizeDonateAmountCents(parsed.data.amountCents);
  if (amountCents == null) {
    return Response.json(
      { error: "Donations must be between $1 and $500." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripe = getStripe();
  const base = appUrl(request);
  let customerId: string | undefined;

  if (user) {
    try {
      const admin = createAdminClient();
      const { data: billing } = await admin
        .from("user_billing")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      customerId =
        typeof billing?.stripe_customer_id === "string"
          ? billing.stripe_customer_id
          : undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await admin.from("user_billing").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
        });
      }
    } catch {
      customerId = undefined;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(customerId
      ? { customer: customerId }
      : user?.email
        ? { customer_email: user.email }
        : {}),
    client_reference_id: user?.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Grove donation",
            description: "Support Grove development",
          },
        },
      },
    ],
    success_url: `${base}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
    metadata: {
      kind: "donation",
      ...(user ? { user_id: user.id } : {}),
    },
  });

  if (!session.url) {
    return Response.json(
      { error: "Donation checkout could not be started." },
      { status: 500 },
    );
  }

  return Response.json({ url: session.url });
}
