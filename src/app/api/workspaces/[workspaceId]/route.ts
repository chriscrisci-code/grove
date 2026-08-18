import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id,owner_id,cover_path")
    .eq("id", workspaceId)
    .single();
  if (!workspace || workspace.owner_id !== user.id) {
    return Response.json(
      { error: "Only the project owner can delete this project." },
      { status: 403 },
    );
  }

  if (workspace.cover_path) {
    const { error: coverError } = await supabase.storage
      .from("workspace-covers")
      .remove([workspace.cover_path]);
    if (coverError) {
      return Response.json(
        { error: "The project cover could not be removed. Try again." },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);
  if (deleteError) {
    return Response.json(
      { error: "The project could not be deleted." },
      { status: 500 },
    );
  }

  return new Response(null, { status: 204 });
}
