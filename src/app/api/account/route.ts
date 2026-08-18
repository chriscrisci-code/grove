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
    .select("cover_path,geography_background_path")
    .eq("owner_id", user.id);

  const coverPaths = (workspaces ?? [])
    .map((workspace) => workspace.cover_path)
    .filter((path): path is string => Boolean(path));
  const geographyPaths = (workspaces ?? [])
    .map((workspace) => workspace.geography_background_path)
    .filter((path): path is string => Boolean(path));

  const [coverRemoval, geographyRemoval] = await Promise.all([
    coverPaths.length
      ? supabase.storage.from("workspace-covers").remove(coverPaths)
      : Promise.resolve({ error: null }),
    geographyPaths.length
      ? supabase.storage.from("workspace-geography").remove(geographyPaths)
      : Promise.resolve({ error: null }),
  ]);
  if (coverRemoval.error || geographyRemoval.error) {
    return Response.json(
      { error: "Story images could not be removed. Please try again." },
      { status: 500 },
    );
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
