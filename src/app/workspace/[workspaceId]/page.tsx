import { notFound, redirect } from "next/navigation";
import {
  Workspace,
  type StoryPage,
  type StoryTag,
} from "@/features/workspace/workspace";
import {
  normalizeFamilyRelationshipKind,
  normalizePageFields,
  normalizePageType,
  type StoryRelationship,
} from "@/features/workspace/page-types";
import { normalizeGeographyDocument } from "@/features/relationships/geography";
import { normalizeTagColor } from "@/features/workspace/tags";
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
  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/workspace/${workspaceId}`)}`,
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id,name,geography,geography_background_path")
    .eq("id", workspaceId)
    .single();
  if (!workspace) notFound();
  const [{ data: canEdit }, { data: workspaceRole }] = await Promise.all([
    supabase.rpc("caller_can_edit_workspace", {
      check_workspace_id: workspace.id,
    }),
    supabase.rpc("workspace_role_for", {
      check_workspace_id: workspace.id,
    }),
  ]);

  const { data: rows } = await supabase
    .from("pages")
    .select("id,parent_id,title,content,updated_at,page_type,fields")
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
      pageType: normalizePageType(page.page_type),
      fields: normalizePageFields(page.fields),
      updatedAt: new Date(page.updated_at).getTime(),
    };
  });

  const [{ data: tagRows }, { data: pageTagRows }, { data: relationshipRows }] =
    await Promise.all([
      supabase
        .from("tags")
        .select("id,name,color")
        .eq("workspace_id", workspace.id)
        .order("name"),
      pages.length
        ? supabase
            .from("page_tags")
            .select("page_id,tag_id")
            .in(
              "page_id",
              pages.map((page) => page.id),
            )
        : Promise.resolve({ data: [] }),
      supabase
        .from("page_relationships")
        .select("id,from_page_id,to_page_id,label,kind")
        .eq("workspace_id", workspace.id),
    ]);
  const tags: StoryTag[] = (tagRows ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: normalizeTagColor(tag.color),
  }));
  const pageTags = (pageTagRows ?? []).reduce<Record<string, string[]>>(
    (assignments, assignment) => {
      assignments[assignment.page_id] ??= [];
      assignments[assignment.page_id].push(assignment.tag_id);
      return assignments;
    },
    {},
  );
  const initialRelationships: StoryRelationship[] = (
    relationshipRows ?? []
  ).map((item) => ({
    id: item.id,
    fromPageId: item.from_page_id,
    toPageId: item.to_page_id,
    label: item.label,
    kind: normalizeFamilyRelationshipKind(item.kind),
  }));
  const geographyBackgroundUrl = workspace.geography_background_path
    ? (
        await supabase.storage
          .from("workspace-geography")
          .createSignedUrl(workspace.geography_background_path, 3600)
      ).data?.signedUrl ?? null
    : null;

  return (
    <Workspace
      initialCloudPages={pages}
      initialTags={tags}
      initialPageTags={pageTags}
      initialRelationships={initialRelationships}
      initialGeography={normalizeGeographyDocument(workspace.geography)}
      initialGeographyBackgroundUrl={geographyBackgroundUrl}
      readOnly={canEdit === false}
      workspaceRole={
        workspaceRole === "owner" ||
        workspaceRole === "editor" ||
        workspaceRole === "viewer"
          ? workspaceRole
          : undefined
      }
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
