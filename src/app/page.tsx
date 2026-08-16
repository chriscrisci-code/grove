import { AuthScreen } from "@/features/auth/auth-screen";
import { Workspace, type StoryPage } from "@/features/workspace/workspace";
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single();

  if (!workspace) {
    return <AuthScreen />;
  }

  const { data: rows } = await supabase
    .from("pages")
    .select("id,parent_id,title,content,updated_at")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("position");

  const pages: StoryPage[] = (rows ?? []).map((page) => {
    const content = page.content as { html?: string } | string | null;
    return {
      id: page.id,
      parentId: page.parent_id,
      title: page.title,
      content:
        typeof content === "string"
          ? content
          : content?.html || "<p>Begin writing your story…</p>",
      updatedAt: new Date(page.updated_at).getTime(),
    };
  });

  return (
    <Workspace
      initialCloudPages={pages}
      workspaceId={workspace.id}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
