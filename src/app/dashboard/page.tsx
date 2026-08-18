import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Dashboard,
  type DashboardProject,
} from "@/features/dashboard/dashboard";
import { normalizeBillingState } from "@/features/billing/billing-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your projects · Grove",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/demo");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const [{ data: workspaces }, { data: rawBilling }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id,name,description,genre,cover_path,updated_at,owner_id")
      .order("updated_at", { ascending: false }),
    supabase.rpc("get_my_billing_state"),
  ]);
  const billing = normalizeBillingState(rawBilling);

  const projects: DashboardProject[] = await Promise.all(
    (workspaces ?? []).map(async (workspace) => {
      let coverUrl: string | null = null;
      const [{ data: editable }, { data: role }, signedCover] = await Promise.all([
        supabase.rpc("caller_can_edit_workspace", {
          check_workspace_id: workspace.id,
        }),
        supabase.rpc("workspace_role_for", {
          check_workspace_id: workspace.id,
        }),
        workspace.cover_path
          ? supabase.storage
              .from("workspace-covers")
              .createSignedUrl(workspace.cover_path, 3600)
          : Promise.resolve({ data: null }),
      ]);
      coverUrl = signedCover.data?.signedUrl ?? null;
      return {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        genre: workspace.genre,
        coverUrl,
        updatedAt: workspace.updated_at,
        canDelete: workspace.owner_id === user.id,
        memberRole:
          role === "owner" || role === "editor" || role === "viewer"
            ? role
            : undefined,
        isEditable: editable ?? true,
        isActiveFree:
          billing.effectivePlan === "free" &&
          workspace.owner_id === user.id &&
          workspace.id === billing.activeWorkspaceId,
      };
    }),
  );

  return (
    <Dashboard
      initialProjects={projects}
      userEmail={user.email}
      initialBilling={billing}
    />
  );
}
