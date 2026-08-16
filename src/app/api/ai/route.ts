import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { decryptSecret } from "@/features/ai/server/encryption";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(10).max(500).optional(),
  prompt: z.string().min(1).max(12_000),
  context: z.string().max(30_000).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid AI request." }, { status: 400 });
  }

  let { provider, model, apiKey } = parsed.data;
  const { prompt, context } = parsed.data;

  if (!apiKey) {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: settings } = await supabase
      .from("ai_settings")
      .select("provider,model,key_ciphertext,key_iv,key_auth_tag")
      .eq("user_id", user.id)
      .single();
    if (!settings) {
      return Response.json(
        { error: "Connect an AI provider in Settings first." },
        { status: 400 },
      );
    }
    try {
      apiKey = decryptSecret({
        ciphertext: settings.key_ciphertext,
        iv: settings.key_iv,
        authTag: settings.key_auth_tag,
      });
      provider = settings.provider;
      model = settings.model;
    } catch {
      return Response.json(
        { error: "Your saved AI connection could not be decrypted." },
        { status: 500 },
      );
    }
  }

  const languageModel =
    provider === "openai"
      ? createOpenAI({ apiKey })(model)
      : provider === "anthropic"
        ? createAnthropic({ apiKey })(model)
        : createGoogleGenerativeAI({ apiKey })(model);

  try {
    const result = streamText({
      model: languageModel,
      system:
        "You are Grove, a thoughtful writing partner. Help the writer develop their own intent. Be concise, concrete, and preserve the writer's voice. Never claim to have edited the document.",
      prompt: context
        ? `Relevant passage:\n${context}\n\nWriter's request:\n${prompt}`
        : prompt,
      maxOutputTokens: 1800,
      abortSignal: request.signal,
    });
    return result.toTextStreamResponse();
  } catch {
    return Response.json(
      { error: "The selected AI provider could not start this request." },
      { status: 502 },
    );
  }
}
