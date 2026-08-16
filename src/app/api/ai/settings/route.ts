import { z } from "zod";
import { encryptSecret } from "@/features/ai/server/encryption";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const settingsSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(10).max(500),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ai_settings")
    .select("provider,model")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return Response.json({ error: "Settings unavailable." }, { status: 500 });
  return Response.json(data ? { ...data, hasKey: true } : { hasKey: false });
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid AI settings." }, { status: 400 });
  }

  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let encrypted;
  try {
    encrypted = encryptSecret(parsed.data.apiKey);
  } catch {
    return Response.json(
      { error: "Server encryption is not configured correctly." },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("ai_settings").upsert({
    user_id: user.id,
    provider: parsed.data.provider,
    model: parsed.data.model,
    key_ciphertext: encrypted.ciphertext,
    key_iv: encrypted.iv,
    key_auth_tag: encrypted.authTag,
    key_version: 1,
  });
  if (error) return Response.json({ error: "Settings could not be saved." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase
    .from("ai_settings")
    .delete()
    .eq("user_id", user.id);
  if (error) return Response.json({ error: "Settings could not be removed." }, { status: 500 });
  return new Response(null, { status: 204 });
}
