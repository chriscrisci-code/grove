import { createClient } from "@/lib/supabase/server";
import { validateCoverBytes } from "@/features/dashboard/cover-validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
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
      { error: "Only the project owner can replace its cover." },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("cover");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a cover image." }, { status: 400 });
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validation = validateCoverBytes(header, file.type, file.size);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error },
      { status: validation.error.includes("5 MB") ? 413 : 415 },
    );
  }

  const path = `${workspaceId}/cover.${validation.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("workspace-covers")
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
    .update({ cover_path: path })
    .eq("id", workspaceId);
  if (updateError) {
    await supabase.storage.from("workspace-covers").remove([path]);
    return Response.json(
      { error: "The project could not be updated." },
      { status: 500 },
    );
  }
  if (workspace.cover_path && workspace.cover_path !== path) {
    await supabase.storage
      .from("workspace-covers")
      .remove([workspace.cover_path]);
  }

  const { data: signed } = await supabase.storage
    .from("workspace-covers")
    .createSignedUrl(path, 3600);
  if (!signed?.signedUrl) {
    return Response.json(
      { error: "The cover was saved but its preview is unavailable." },
      { status: 500 },
    );
  }
  return Response.json({ coverUrl: signed.signedUrl });
}
