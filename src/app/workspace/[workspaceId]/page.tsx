import { notFound, redirect } from "next/navigation";
import { Workspace, type StoryPage } from "@/features/workspace/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .single();
  if (!workspace) notFound();

  const { data: rows } = await supabase
    .from("pages")
    .select("id,parent_id,title,content,updated_at")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("position");

  const pages: StoryPage[] = (rows ?? []).map((page) => {
    const content = page.content as
      | { html?: string; unvisited?: boolean }
      | string
      | null;
    return {
      id: page.id,
      parentId: page.parent_id,
      title: page.title,
      content:
        typeof content === "string"
          ? content
          : content?.html || "<p>Begin writing your story…</p>",
      unvisited:
        typeof content === "object" && content?.unvisited === true,
      updatedAt: new Date(page.updated_at).getTime(),
    };
  });

  return (
    <Workspace
      initialCloudPages={pages}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
