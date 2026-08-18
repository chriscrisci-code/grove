import { createClient } from "@/lib/supabase/server";
import { appUrl, getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json(
      { error: "Payments are not configured yet." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: billing } = await supabase
    .from("user_billing")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = billing?.stripe_customer_id;
  if (!customerId) {
    return Response.json(
      { error: "No payment method is on file yet." },
      { status: 400 },
    );
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl(request)}/account/billing`,
  });
  return Response.json({ url: portal.url });
}
