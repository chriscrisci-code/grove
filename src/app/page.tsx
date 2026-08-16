import { AuthScreen } from "@/features/auth/auth-screen";
import {
  Dashboard,
  type DashboardProject,
} from "@/features/dashboard/dashboard";
import { Workspace } from "@/features/workspace/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return <Workspace />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <AuthScreen />;

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name,description,genre,cover_path,updated_at")
    .order("updated_at", { ascending: false });

  const projects: DashboardProject[] = await Promise.all(
    (workspaces ?? []).map(async (workspace) => {
      let coverUrl: string | null = null;
      if (workspace.cover_path) {
        const { data } = await supabase.storage
          .from("workspace-covers")
          .createSignedUrl(workspace.cover_path, 3600);
        coverUrl = data?.signedUrl ?? null;
      }
      return {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        genre: workspace.genre,
        coverUrl,
        updatedAt: workspace.updated_at,
      };
    }),
  );

  return <Dashboard initialProjects={projects} userEmail={user.email} />;
}
