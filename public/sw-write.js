const CACHE = "grove-write-v2";

const OFFLINE_FALLBACK = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grove Write</title>
  <style>
    body { font-family: Georgia, serif; background: #f4f1ea; color: #2f4a37; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { max-width: 420px; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 12px; }
    p { color: #5f6660; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>Grove Write is not ready offline yet</h1>
    <p>Open Grove Write once while online so this device can save the app. Then you can write offline from the desktop icon.</p>
  </main>
</body>
</html>`;

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

function isWriteRoute(pathname) {
  return pathname === "/write" || pathname.startsWith("/write/");
}

function isSameOriginAsset(url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname === "/favicon.ico"
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

async function networkFirstWrite(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const writeShell = await caches.match("/write");
      if (writeShell) return writeShell;
      return new Response(OFFLINE_FALLBACK, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return caches.match(request);
  }
}

async function precacheUrls(urls) {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(
    urls.map(async (rawUrl) => {
      try {
        const request = new Request(rawUrl, { credentials: "same-origin" });
        const existing = await cache.match(request);
        if (existing) return;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch {
        /* skip failed precache entries */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/write"]).catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(precacheUrls(data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url.pathname) || (request.destination === "style" && isSameOriginAsset(url))) {
    event.respondWith(
      cacheFirst(request).then(
        (response) =>
          response ||
          new Response("", { status: 503, statusText: "Offline" }),
      ),
    );
    return;
  }

  if (isWriteRoute(url.pathname)) {
    event.respondWith(
      networkFirstWrite(request).then(
        (response) =>
          response ||
          (request.mode === "navigate"
            ? new Response(OFFLINE_FALLBACK, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              })
            : new Response("", { status: 503, statusText: "Offline" })),
      ),
    );
    return;
  }

  if (request.destination === "script" && url.pathname.startsWith("/_next/")) {
    event.respondWith(
      cacheFirst(request).then(
        (response) =>
          response ||
          new Response("", { status: 503, statusText: "Offline" }),
      ),
    );
  }
});
