import type { SupabaseClient } from "@supabase/supabase-js";

export const RESEARCH_IMAGE_URL = "grove:image";
export const RESEARCH_IMAGES_BUCKET = "research-images";
export const RESEARCH_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export type ResearchKind = "link" | "image";

export type ResearchItem = {
  id: string;
  kind: ResearchKind;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  storagePath: string | null;
  createdAt: string;
};

export function isResearchImage(item: {
  kind?: string | null;
  url: string;
}) {
  return item.kind === "image" || item.url === RESEARCH_IMAGE_URL;
}

export function researchImageTitle(fileName: string) {
  const name = fileName.split(/[/\\]/).pop()?.trim() ?? "";
  return (name || "Research image").slice(0, 500);
}

export function collectImageFiles(files: Iterable<File>) {
  return [...files].filter((file) => {
    if (
      ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)
    ) {
      return true;
    }
    return /\.(jpe?g|png|webp)$/i.test(file.name);
  });
}

export function attachSignedImageUrls(
  items: ResearchItem[],
  signed: { path: string; signedUrl: string }[],
) {
  const urls = new Map(
    signed
      .filter((entry) => entry.path && entry.signedUrl)
      .map((entry) => [entry.path, entry.signedUrl]),
  );
  return items.map((item) => {
    if (!item.storagePath) return item;
    const signedUrl = urls.get(item.storagePath);
    return signedUrl ? { ...item, imageUrl: signedUrl } : item;
  });
}

type ResearchPathRow = { storage_path: string | null };

export async function researchImagePathsForPages(
  supabase: Pick<SupabaseClient, "from">,
  pageIds: string[],
) {
  if (!pageIds.length) return [];
  const { data } = await supabase
    .from("research_links")
    .select("storage_path")
    .in("page_id", pageIds)
    .not("storage_path", "is", null);
  return ((data ?? []) as ResearchPathRow[])
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));
}

export async function researchImagePathsForWorkspaces(
  supabase: Pick<SupabaseClient, "from">,
  workspaceIds: string[],
) {
  if (!workspaceIds.length) return [];
  const { data: pages } = await supabase
    .from("pages")
    .select("id")
    .in("workspace_id", workspaceIds);
  return researchImagePathsForPages(
    supabase,
    ((pages ?? []) as { id: string }[]).map((page) => page.id),
  );
}
