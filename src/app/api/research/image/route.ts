import { z } from "zod";
import { validateCoverBytes } from "@/features/dashboard/cover-validation";
import { requirePaidFeature } from "@/features/billing/require-feature";
import {
  RESEARCH_IMAGE_URL,
  RESEARCH_IMAGES_BUCKET,
  researchImageTitle,
} from "@/features/research/research-images";

export const runtime = "nodejs";

const pageIdSchema = z.string().uuid();

export async function POST(request: Request) {
  const gated = await requirePaidFeature("research");
  if (!gated.ok) return gated.response;

  const form = await request.formData();
  const pageId = pageIdSchema.safeParse(form.get("pageId"));
  const file = form.get("image");
  if (!pageId.success) {
    return Response.json({ error: "Choose a page before saving an image." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Drop a JPEG, PNG, or WebP image." }, { status: 400 });
  }

  const { data: page } = await gated.supabase
    .from("pages")
    .select("id, workspace_id")
    .eq("id", pageId.data)
    .single();
  if (!page) {
    return Response.json({ error: "That page could not be found." }, { status: 404 });
  }

  const { data: canWrite } = await gated.supabase.rpc(
    "caller_can_write_workspace",
    { check_workspace_id: page.workspace_id },
  );
  if (!canWrite) {
    return Response.json(
      { error: "This story is read-only." },
      { status: 403 },
    );
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validation = validateCoverBytes(header, file.type, file.size);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error.replace("Cover images", "Research images") },
      { status: validation.error.includes("5 MB") ? 413 : 415 },
    );
  }

  const storagePath = `${page.workspace_id}/${page.id}/${crypto.randomUUID()}.${validation.extension}`;
  const { error: uploadError } = await gated.supabase.storage
    .from(RESEARCH_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: validation.mimeType,
      upsert: false,
      cacheControl: "3600",
    });
  if (uploadError) {
    const missingBucket = /bucket not found/i.test(uploadError.message);
    return Response.json(
      {
        error: missingBucket
          ? "Research image storage is not set up yet. Run migration 017_research_images.sql in Supabase."
          : uploadError.message,
      },
      { status: 500 },
    );
  }

  const title = researchImageTitle(file.name);
  const { data, error } = await gated.supabase
    .from("research_links")
    .insert({
      page_id: page.id,
      created_by: gated.user.id,
      kind: "image",
      url: RESEARCH_IMAGE_URL,
      title,
      description: null,
      image_url: null,
      favicon_url: null,
      storage_path: storagePath,
    })
    .select("id,kind,url,title,description,image_url,favicon_url,storage_path,created_at")
    .single();
  if (error || !data) {
    await gated.supabase.storage.from(RESEARCH_IMAGES_BUCKET).remove([storagePath]);
    return Response.json(
      { error: "The image could not be saved to this page." },
      { status: 500 },
    );
  }

  const { data: signed } = await gated.supabase.storage
    .from(RESEARCH_IMAGES_BUCKET)
    .createSignedUrl(storagePath, 3600);

  return Response.json({
    id: data.id,
    kind: data.kind,
    url: data.url,
    title: data.title,
    description: data.description,
    imageUrl: signed?.signedUrl ?? null,
    faviconUrl: data.favicon_url,
    storagePath: data.storage_path,
    createdAt: data.created_at,
  });
}
