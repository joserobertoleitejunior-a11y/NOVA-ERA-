// Service worker: abre o app na hora (mesmo com sinal fraco) usando os arquivos guardados no aparelho.
// Dados do Supabase NUNCA passam por aqui (sempre ao vivo e protegidos).
const VERSAO = "confere-carga-20261120k";
const ESSENCIAIS = ["./app.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // dados e fotos: sempre direto, nunca guardados aqui
  const estatico = url.origin === location.origin || ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname);
  if (!estatico) return;
  // Responde na hora com o que está guardado e atualiza por trás
  e.respondWith(caches.open(VERSAO).then(async (cache) => {
    const guardado = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    const rede = fetch(req).then((r) => { if (r.ok || r.type === "opaque") cache.put(req, r.clone()); return r; }).catch(() => guardado);
    return guardado || rede;
  }));
});
