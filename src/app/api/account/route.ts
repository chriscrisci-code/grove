import {
  RESEARCH_IMAGES_BUCKET,
  researchImagePathsForWorkspaces,
} from "@/features/research/research-images";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,cover_path,geography_background_path")
    .eq("owner_id", user.id);

  const coverPaths = (workspaces ?? [])
    .map((workspace) => workspace.cover_path)
    .filter((path): path is string => Boolean(path));
  const geographyPaths = (workspaces ?? [])
    .map((workspace) => workspace.geography_background_path)
    .filter((path): path is string => Boolean(path));
  const researchPaths = await researchImagePathsForWorkspaces(
    supabase,
    (workspaces ?? []).map((workspace) => workspace.id),
  );

  const [coverRemoval, geographyRemoval, researchRemoval] = await Promise.all([
    coverPaths.length
      ? supabase.storage.from("workspace-covers").remove(coverPaths)
      : Promise.resolve({ error: null }),
    geographyPaths.length
      ? supabase.storage.from("workspace-geography").remove(geographyPaths)
      : Promise.resolve({ error: null }),
    researchPaths.length
      ? supabase.storage.from(RESEARCH_IMAGES_BUCKET).remove(researchPaths)
      : Promise.resolve({ error: null }),
  ]);
  if (coverRemoval.error || geographyRemoval.error || researchRemoval.error) {
    return Response.json(
      { error: "Story images could not be removed. Please try again." },
      { status: 500 },
    );
  }

  if (isStripeConfigured()) {
    const { data: billing } = await supabase
      .from("user_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = billing?.stripe_customer_id;
    if (customerId) {
      try {
        const stripe = getStripe();
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
        });
        await Promise.all(
          subscriptions.data
            .filter((subscription) =>
              ["active", "trialing", "past_due", "unpaid"].includes(
                subscription.status,
              ),
            )
            .map((subscription) => stripe.subscriptions.cancel(subscription.id)),
        );
      } catch {
        return Response.json(
          { error: "Your subscription could not be canceled. Please try again." },
          { status: 500 },
        );
      }
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return Response.json(
      { error: "Your account could not be deleted. Please try again." },
      { status: 500 },
    );
  }
  return new Response(null, { status: 204 });
}
