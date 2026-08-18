import { validateCoverBytes } from "@/features/dashboard/cover-validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function ownedWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id,owner_id,geography_background_path")
    .eq("id", workspaceId)
    .single();
  if (!workspace || workspace.owner_id !== user.id) {
    return {
      error: "Only the project owner can change the map background.",
      status: 403,
    } as const;
  }
  const { data: editable } = await supabase.rpc("workspace_is_editable", {
    check_workspace_id: workspaceId,
  });
  if (editable === false) {
    return {
      error: "Make this your Active Free Story before changing its map.",
      status: 403,
    } as const;
  }
  return { supabase, workspace } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const result = await ownedWorkspace(workspaceId);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const { supabase, workspace } = result;
  const form = await request.formData();
  const file = form.get("background");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a map image." }, { status: 400 });
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validation = validateCoverBytes(header, file.type, file.size);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error.replace("Cover images", "Map images") },
      { status: validation.error.includes("5 MB") ? 413 : 415 },
    );
  }

  const path = `${workspaceId}/background.${validation.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("workspace-geography")
    .upload(path, file, {
      contentType: validation.mimeType,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }
  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ geography_background_path: path })
    .eq("id", workspaceId);
  if (updateError) {
    await supabase.storage.from("workspace-geography").remove([path]);
    return Response.json(
      { error: "The map background could not be saved." },
      { status: 500 },
    );
  }
  if (
    workspace.geography_background_path &&
    workspace.geography_background_path !== path
  ) {
    await supabase.storage
      .from("workspace-geography")
      .remove([workspace.geography_background_path]);
  }
  const { data: signed } = await supabase.storage
    .from("workspace-geography")
    .createSignedUrl(path, 3600);
  return Response.json({ backgroundUrl: signed?.signedUrl ?? null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const result = await ownedWorkspace(workspaceId);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const { supabase, workspace } = result;
  if (workspace.geography_background_path) {
    const { error } = await supabase.storage
      .from("workspace-geography")
      .remove([workspace.geography_background_path]);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  const { error } = await supabase
    .from("workspaces")
    .update({ geography_background_path: null })
    .eq("id", workspaceId);
  if (error) {
    return Response.json(
      { error: "The map background could not be removed." },
      { status: 500 },
    );
  }
  return new Response(null, { status: 204 });
}
