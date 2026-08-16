import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(10).max(500),
  prompt: z.string().min(1).max(12_000),
  context: z.string().max(30_000).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid AI request." }, { status: 400 });
  }

  const { provider, model, apiKey, prompt, context } = parsed.data;
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
        "You are StoryTree, a thoughtful writing partner. Help the writer develop their own intent. Be concise, concrete, and preserve the writer's voice. Never claim to have edited the document.",
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
