import {
  RESEARCH_IMAGES_BUCKET,
  researchImagePathsForWorkspaces,
} from "@/features/research/research-images";
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
    .select("id,owner_id,cover_path,geography_background_path")
    .eq("id", workspaceId)
    .single();
  if (!workspace || workspace.owner_id !== user.id) {
    return Response.json(
      { error: "Only the project owner can delete this project." },
      { status: 403 },
    );
  }

  const researchPaths = await researchImagePathsForWorkspaces(supabase, [
    workspaceId,
  ]);
  const [coverRemoval, geographyRemoval, researchRemoval] = await Promise.all([
    workspace.cover_path
      ? supabase.storage.from("workspace-covers").remove([workspace.cover_path])
      : Promise.resolve({ error: null }),
    workspace.geography_background_path
      ? supabase.storage
          .from("workspace-geography")
          .remove([workspace.geography_background_path])
      : Promise.resolve({ error: null }),
    researchPaths.length
      ? supabase.storage.from(RESEARCH_IMAGES_BUCKET).remove(researchPaths)
      : Promise.resolve({ error: null }),
  ]);
  if (coverRemoval.error || geographyRemoval.error || researchRemoval.error) {
    return Response.json(
      { error: "The project images could not be removed. Try again." },
      { status: 500 },
    );
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
