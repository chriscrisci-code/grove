import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FREE_BILLING_STATE,
  normalizeBillingState,
  type BillingState,
} from "@/features/billing/billing-state";
import {
  canUseFeature,
  paidRequiredResponse,
  planAccessFromBilling,
  type FeatureName,
  type PlanAccess,
} from "@/features/billing/plan";
import { createClient } from "@/lib/supabase/server";

export async function billingStateForClient(
  supabase: SupabaseClient,
): Promise<BillingState> {
  const { data, error } = await supabase.rpc("get_my_billing_state");
  if (error || !data) return FREE_BILLING_STATE;
  return normalizeBillingState(data);
}

export async function requirePaidFeature(feature: FeatureName): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string; email?: string };
      access: PlanAccess;
    }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const billing = await billingStateForClient(supabase);
  const access = planAccessFromBilling(billing.effectivePlan);
  if (!canUseFeature(feature, access)) {
    return { ok: false, response: paidRequiredResponse(feature) };
  }
  return {
    ok: true,
    supabase,
    user: { id: user.id, email: user.email ?? undefined },
    access,
  };
}
