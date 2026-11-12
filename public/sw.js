const CACHE_PREFIX = "lector-aln-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = ["/", "/lab/tts", "/manifest.webmanifest", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls, Next.js RSC payloads, or mutation-like requests.
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || request.headers.has("RSC")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const key = url.pathname === "/" ? "/" : url.pathname;
          await cache.put(key, response.clone());
        }
        return response;
      } catch {
        const key = url.pathname === "/" ? "/" : url.pathname;
        const cached = await cache.match(key);
        if (cached) return cached;
        const lab = await cache.match("/lab/tts");
        if (lab) return lab;
        return new Response("La aplicación aún no está disponible sin conexión. Conéctate una vez y vuelve a abrirla.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/pwa-icon.svg" ||
    url.pathname === "/pdf.worker.min.mjs";

  if (isStaticAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
