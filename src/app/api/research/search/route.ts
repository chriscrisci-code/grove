import { z } from "zod";
import { requirePaidFeature } from "@/features/billing/require-feature";

export const runtime = "nodejs";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(400),
});

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
};

export async function POST(request: Request) {
  const gated = await requirePaidFeature("research");
  if (!gated.ok) return gated.response;

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "In-app search is not configured yet." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a search with at least two characters." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: parsed.data.query,
        search_depth: "basic",
        max_results: 8,
        include_answer: false,
        include_images: false,
        include_raw_content: "markdown",
      }),
    });
    if (!response.ok) {
      throw new Error(`Search provider returned HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as { results?: TavilyResult[] };
    const results = (payload.results ?? [])
      .filter((result) => result.title && result.url)
      .map((result) => ({
        title: result.title!.slice(0, 500),
        url: result.url!,
        excerpt: (result.content ?? "").slice(0, 2000),
        readerText: (result.raw_content ?? result.content ?? "").slice(0, 40_000),
        score: result.score ?? 0,
      }));
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Search is temporarily unavailable." },
      { status: 502 },
    );
  }
}
