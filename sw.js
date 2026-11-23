// Service worker: (1) abre o app na hora, mesmo com sinal fraco, usando os arquivos guardados no aparelho;
// (2) recebe os AVISOS (Web Push) com o app fechado e abre a tela certa ao tocar.
// Dados do Supabase NUNCA passam por aqui (sempre ao vivo e protegidos).
const VERSAO = "confere-carga-20261123c1";
const ESSENCIAIS = ["./app.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  // Se a rede estiver ruim, o pré-carregamento falha em silêncio: o service worker novo entra do mesmo jeito
  // (antes, uma falha aqui deixava o antigo no comando para sempre).
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // dados e fotos: sempre direto, nunca guardados aqui
  if (url.origin !== location.origin) return;       // tudo o que o app usa está dentro do próprio projeto
  if (req.headers.has("range") || /\.(mp4|webm)$/i.test(url.pathname)) return; // vídeo: o navegador cuida (e o cache não guarda resposta parcial)

  // Páginas (HTML): REDE primeiro. Assim uma correção publicada chega na PRIMEIRA abertura; sem sinal, abre a última guardada.
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSAO).then((cache) => cache.put(req, c)); } return r; })
      .catch(() => caches.open(VERSAO).then((cache) => cache.match(req, { ignoreSearch: true })).then((g) => g || caches.match("./app.html"))));
    return;
  }
  // Scripts, estilos e imagens: o que está guardado abre na hora e se atualiza por baixo (os endereços já mudam a cada versão: ?v=)
  e.respondWith(caches.open(VERSAO).then(async (cache) => {
    const guardado = await cache.match(req);
    const rede = fetch(req).then((r) => { if (r.ok && r.status === 200) cache.put(req, r.clone()); return r; }).catch(() => guardado);
    return guardado || rede;
  }));
});

self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: "Confere Carga", texto: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Confere Carga", {
    body: d.texto || "", tag: d.tag || undefined, icon: "assets/img/icone-192.png", badge: "assets/img/icone-192.png",
    data: { url: d.url || "app.html#alertas" }, requireInteraction: d.severidade === "critico",
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = new URL(e.notification.data?.url || "app.html#alertas", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    for (const c of lista) if ("focus" in c) { c.navigate?.(alvo); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
