import { SITE_URL } from "@/lib/site";

const REACHABLE_TIMEOUT_MS = 4_000;

export async function checkGroveReachable() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      REACHABLE_TIMEOUT_MS,
    );
    const response = await fetch(`${SITE_URL}/robots.txt`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

export function openFullGrove(path = "/dashboard") {
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  window.location.assign(url);
}
