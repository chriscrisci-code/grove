import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { requirePaidFeature } from "@/features/billing/require-feature";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().url().max(2048),
});

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
  );
}

async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS pages can be saved.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials cannot be saved.");
  }
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network pages cannot be saved.");
  }
}

function attribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string, base: URL) {
  if (!value) return null;
  try {
    const resolved = new URL(value, base);
    return ["http:", "https:"].includes(resolved.protocol)
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

async function fetchHtml(initialUrl: URL) {
  let current = initialUrl;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "GroveResearch/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The page returned an invalid redirect.");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`The page returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error("That link is not an HTML webpage.");
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > 1_500_000) throw new Error("The webpage is too large to preview.");
    const html = await response.text();
    if (html.length > 1_500_000) throw new Error("The webpage is too large to preview.");
    return { html, finalUrl: current };
  }
  throw new Error("The page redirected too many times.");
}

export async function POST(request: Request) {
  const gated = await requirePaidFeature("research");
  if (!gated.ok) return gated.response;

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a complete webpage URL." }, { status: 400 });
  }

  try {
    const { html, finalUrl } = await fetchHtml(new URL(parsed.data.url));
    const metaTags = html.match(/<meta\s[^>]*>/gi) ?? [];
    const links = html.match(/<link\s[^>]*>/gi) ?? [];
    const meta = (key: string) => {
      const tag = metaTags.find((candidate) => {
        const identity = attribute(candidate, "property") || attribute(candidate, "name");
        return identity.toLowerCase() === key.toLowerCase();
      });
      return tag ? cleanText(attribute(tag, "content")) : "";
    };
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title =
      meta("og:title") ||
      meta("twitter:title") ||
      cleanText(titleMatch?.[1] ?? "") ||
      finalUrl.hostname;
    const description =
      meta("og:description") || meta("description") || meta("twitter:description");
    const iconTag = links.find((tag) =>
      attribute(tag, "rel").toLowerCase().split(/\s+/).includes("icon"),
    );

    return Response.json({
      url: finalUrl.toString(),
      title: title.slice(0, 500),
      description: description.slice(0, 2000),
      imageUrl: absoluteUrl(
        meta("og:image") || meta("twitter:image"),
        finalUrl,
      ),
      faviconUrl:
        absoluteUrl(iconTag ? attribute(iconTag, "href") : "", finalUrl) ||
        new URL("/favicon.ico", finalUrl).toString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The page could not be previewed." },
      { status: 422 },
    );
  }
}
