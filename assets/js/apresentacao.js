// Apresentação em vídeo (HTML): roda o app de verdade dentro do celular, com cursor que clica, legenda e voz.
// Voz: se existir assets/apresentacao/audio/<cena>.mp3 (gerado com o ElevenLabs por scripts/gerar-voz-elevenlabs.mjs), toca o mp3;
// senão usa a voz do navegador (provisória). Os cliques seguem o tempo da fala de cada cena (roteiro.json).
(async () => {
  const $ = (s) => document.querySelector(s);
  const NE = window.NE;
  ["#logo", "#logo2", "#logo3"].forEach((s) => { $(s).innerHTML = NE.logo; });
  const palco = $("#palco"), F = $("#app"), cursor = $("#cursor"), destaque = $("#destaque");
  const ajustar = () => palco.style.setProperty("--escala", Math.min(innerWidth / 1280, innerHeight / 720)); ajustar(); addEventListener("resize", ajustar);
  const R = await (await fetch("assets/apresentacao/roteiro.json")).json(); const C = R.cenas;
  const RAPIDO = new URLSearchParams(location.search).has("rapido"); // ?rapido=1 para conferir o roteiro em velocidade 4x
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // quais cenas têm voz do ElevenLabs (mp3) e quais usam a voz do navegador
  const temMp3 = {}; let lista = []; try { const r = await fetch("assets/apresentacao/audio/lista.json"); if (r.ok) lista = await r.json(); } catch { /* sem áudios ainda */ } C.forEach((c) => { temMp3[c.id] = lista.includes(c.id); });
  const nMp3 = Object.values(temMp3).filter(Boolean).length;
  $("#aviso-voz").textContent = nMp3 === C.length ? "Voz: ElevenLabs. Ative o som do aparelho." : nMp3 ? `Voz: ElevenLabs em ${nMp3} de ${C.length} cenas; nas outras, voz do navegador.` : "Voz do navegador (provisória). Para a voz do ElevenLabs, gere os áudios (veja LEIA-ME da apresentação). Ative o som do aparelho.";

  // barra de progresso por cena
  const prog = $("#progresso"); const segs = C.map((c, k) => { const b = document.createElement("button"); b.type = "button"; b.title = c.titulo; b.setAttribute("aria-label", `Cena ${k + 1}: ${c.titulo}`); b.append(document.createElement("i")); b.addEventListener("click", () => ir(k)); prog.append(b); return b; });

  // ───────────────────────── o app dentro do celular ─────────────────────────
  const W = () => F.contentWindow, Dc = () => F.contentDocument;
  const esperar = (cond, ms = 7000) => new Promise((ok) => { const t0 = performance.now(); (function p() { try { if (cond()) return ok(true); } catch { /* ainda carregando */ } if (performance.now() - t0 > ms) return ok(false); setTimeout(p, 80); })(); });
  const carregar = (url) => new Promise((ok) => { F.onload = () => { F.onload = null; ok(); }; F.src = url; });
  const emApp = () => { try { return W().location.pathname.endsWith("app.html"); } catch { return false; } };
  const marcarTutorialVisto = () => ["painel", "conferente", "passo"].forEach((t) => localStorage.setItem(`ne-tour-${t}`, "true"));
  async function carregarApp() {
    marcarTutorialVisto(); await carregar("app.html"); await esperar(() => W().NE && W().NE.app && (Dc().querySelector("#login-usuario") || Dc().querySelector(".nav-inferior")));
    const st = Dc().createElement("style"); st.textContent = ".fab-teste,.menu-teste{display:none!important} html{scroll-behavior:smooth}"; Dc().head.append(st); await sleep(300);
  }
  const digitarRapido = (sel, v) => { const e = Dc().querySelector(sel); if (!e) return; e.value = v; e.dispatchEvent(new (W().Event)("input", { bubbles: true })); };
  async function sair() { Dc().querySelector('.usuario .link-acao[aria-label="Sair"]')?.click(); await esperar(() => Dc().querySelector("#login-usuario")); }
  async function garantirPerfil(u) {
    if (!emApp()) await carregarApp();
    const atual = W().NE?.app?.perfil?.usuario; const logado = !!atual; // (nas telas de passo a passo a barra de baixo some; por isso o perfil é a prova)
    if (u === null) { if (logado) await sair(); return; }
    if (logado && atual === u) return; if (logado) await sair();
    digitarRapido("#login-usuario", u); digitarRapido("#login-senha", "admin"); Dc().querySelector("#btn-entrar")?.click();
    await esperar(() => Dc().querySelector(".nav-inferior")); await sleep(350);
  }
  async function preparar(c) {
    const p = c.pre || {};
    if (p.reiniciar) { localStorage.setItem("ne-teste-demo", "1"); localStorage.removeItem("ne-teste-v6"); localStorage.removeItem("ne-modo-teste"); await carregarApp(); }
    else if ("perfil" in p) await garantirPerfil(p.perfil === "admin" ? "admin" : p.perfil);
    if (p.rota && W().NE?.app) { W().NE.app.ir(p.rota, p.params || {}); await sleep(650); }
  }

  // ───────────────────────── cursor, destaque e ações ─────────────────────────
  // esp(): espera que ABORTA se a pessoa trocou de cena (assim os cliques da cena anterior nunca vazam para a próxima)
  const CANCELADO = Symbol("cancelado");
  const esp = async (ms) => { const t0 = rodada; await sleep(RAPIDO ? ms / 3 : ms); if (t0 !== rodada) throw CANCELADO; };
  function ponto(el) {
    el.scrollIntoView?.({ block: "center" }); const r = el.getBoundingClientRect(), fr = F.getBoundingClientRect(), pr = palco.getBoundingClientRect(), esc = pr.width / 1280, k = fr.width / F.offsetWidth;
    return { x: (fr.left + (r.left + r.width / 2) * k - pr.left) / esc, y: (fr.top + (r.top + r.height / 2) * k - pr.top) / esc, x0: (fr.left + r.left * k - pr.left) / esc, y0: (fr.top + r.top * k - pr.top) / esc, w: (r.width * k) / esc, h: (r.height * k) / esc };
  }
  async function mover(el) { await esp(120); const p = ponto(el); cursor.style.opacity = "1"; cursor.style.transform = `translate(${p.x - 6}px, ${p.y - 4}px)`; await esp(820); return p; }
  const achar = (sel, texto, idx = 0) => { const d = Dc(); if (!texto) return d.querySelector(sel); return [...d.querySelectorAll(sel)].filter((e) => norm(e.textContent).includes(norm(texto)))[idx] || null; };
  async function clicar(el) { if (!el) return; await mover(el); cursor.classList.remove("toque"); void cursor.offsetWidth; cursor.classList.add("toque"); await esp(160); el.click(); await esp(520); }
  async function digitar(sel, texto) {
    const el = Dc().querySelector(sel); if (!el) return; await mover(el); el.focus({ preventScroll: true }); el.value = "";
    for (const ch of String(texto)) { el.value += ch; el.dispatchEvent(new (W().Event)("input", { bubbles: true })); await esp(55); }
    el.dispatchEvent(new (W().Event)("change", { bubbles: true })); await esp(300);
  }
  async function realcar(sel) { const el = Dc().querySelector(sel); if (!el) return; const p = ponto(el); Object.assign(destaque.style, { left: `${p.x0 - 6}px`, top: `${p.y0 - 6}px`, width: `${p.w + 12}px`, height: `${p.h + 12}px` }); destaque.classList.add("on"); setTimeout(() => destaque.classList.remove("on"), 2600); await esp(400); }
  async function executar(a, token) {
    if (token !== rodada) return;
    try {
      if (a.clicar) await clicar(achar(a.clicar));
      else if (a.clicarTexto) await clicar(achar(a.clicarTexto[0], a.clicarTexto[1], a.clicarTexto[2] || 0));
      else if (a.digitar) await digitar(a.digitar[0], a.digitar[1]);
      else if (a.destacar) await realcar(a.destacar);
      else if (a.ir) { W().NE.app.ir(a.ir[0], a.ir[1] || {}); await esp(600); }
      else if (a.rolar) { Dc().querySelector(a.rolar)?.scrollIntoView({ behavior: "smooth", block: "center" }); await esp(500); }
      else if (a.rastreio) { const ctx = await W().NE.dados.contexto(); const tk = (ctx.conferencias[0] || {}).token_publico; if (tk) { await carregar(`rastreio.html?c=${tk}`); await esperar(() => Dc().querySelector(".rastreio")); } }
      else if (a.site) { await carregar("index.html"); await esperar(() => Dc().querySelector(".produto")); }
      else if (a.siteRolar) { Dc().querySelector(a.siteRolar)?.scrollIntoView({ behavior: "smooth", block: "center" }); await esp(600); }
    } catch (e) { if (e !== CANCELADO) console.warn("ação da apresentação ignorada", a, e); }
  }

  // ───────────────────────── voz, legenda e linha do tempo ─────────────────────────
  const audio = new Audio(); audio.preload = "auto"; let mudo = false;
  const vozes = () => speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang)); const melhorVoz = () => { const v = vozes(); return v.find((x) => /pt-BR/i.test(x.lang) && /Google|Microsoft|Francisca|Antonio|Luciana/i.test(x.name)) || v.find((x) => /pt-BR/i.test(x.lang)) || v[0] || null; };
  let rodada = 0, i = -1, tocando = false, t = 0, dur = 1, pronto = false, fila = Promise.resolve(), pend = 0, feitas = new Set(), usaMp3 = false, ttsFim = true, terminou = false, trechos = [];
  const render = (c, k) => {
    $("#etapa").textContent = `${String(k + 1).padStart(2, "0")} / ${String(C.length).padStart(2, "0")}`; $("#titulo").textContent = c.titulo; $("#subtitulo").textContent = c.subtitulo || "";
    $("#pontos").replaceChildren(...(c.pontos || []).map((p) => { const li = document.createElement("li"); li.textContent = p; return li; }));
    const h = $("#titulo"); h.style.animation = "none"; void h.offsetWidth; h.style.animation = "";
    segs.forEach((s, j) => s.classList.toggle("feita", j < k));
  };
  async function ir(k) {
    if (k < 0 || k >= C.length) return; const token = ++rodada; i = k; const c = C[k]; pronto = false; terminou = false; tocando = false; fila = Promise.resolve(); pend = 0; feitas = new Set(); destaque.classList.remove("on");
    audio.pause(); speechSynthesis.cancel(); $("#fim").hidden = true; render(c, k); $("#legenda").textContent = "";
    await preparar(c); if (token !== rodada) return;
    trechos = c.fala.match(/[^.!?]+[.!?]*/g).map((x) => x.trim()).filter(Boolean); t = 0; usaMp3 = !!temMp3[c.id]; dur = Math.max(6, c.fala.length / 14.5) / (RAPIDO ? 4 : 1);
    if (usaMp3) { audio.src = `assets/apresentacao/audio/${c.id}.mp3`; audio.muted = mudo; await new Promise((ok) => { audio.onloadedmetadata = ok; audio.onerror = ok; setTimeout(ok, 2500); }); if (audio.duration && isFinite(audio.duration)) dur = (audio.duration + 0.4) / (RAPIDO ? 4 : 1); try { await audio.play(); } catch { usaMp3 = false; } }
    if (!usaMp3 && !mudo && !RAPIDO && "speechSynthesis" in window && vozes().length) { const u = new SpeechSynthesisUtterance(c.fala); u.lang = "pt-BR"; u.rate = 1.0; const v = melhorVoz(); if (v) u.voice = v; ttsFim = false; u.onend = u.onerror = () => { ttsFim = true; }; speechSynthesis.speak(u); } else ttsFim = true;
    if (token !== rodada) return; pronto = true; tocando = true; $("#b-play").textContent = "⏸"; $("#b-play").setAttribute("aria-label", "Pausar");
  }
  let ult = performance.now();
  function laco(agora) {
    const dt = Math.min(0.1, (agora - ult) / 1000); ult = agora;
    if (pronto && tocando && i >= 0) {
      t = usaMp3 && !audio.paused ? audio.currentTime : t + dt; const c = C[i], f = t / dur;
      // legenda por trecho (proporcional ao tamanho de cada frase)
      const total = trechos.reduce((n, x) => n + x.length, 0); let acum = 0, ativo = trechos.length - 1; for (let j = 0; j < trechos.length; j++) { acum += trechos[j].length; if (f <= acum / total) { ativo = j; break; } }
      const leg = $("#legenda"); if (leg.textContent !== trechos[ativo]) leg.textContent = trechos[ativo];
      [...$("#pontos").children].forEach((li, j) => li.classList.toggle("mostra", f >= ((j + 0.6) / ((c.pontos || []).length + 0.6)) * 0.78));
      (c.acoes || []).forEach((a, j) => { if (!feitas.has(j) && f >= a.at) { feitas.add(j); pend++; const tk = rodada; fila = fila.then(() => executar(a, tk)).finally(() => { pend--; }); } });
      segs[i].firstChild.style.width = `${Math.min(100, f * 100)}%`;
      if (!ttsFim && t > dur + 5) ttsFim = true; // se o navegador não terminar de falar, não trava a apresentação
      if (f >= 1 && pend === 0 && ttsFim && !terminou && (!usaMp3 || audio.ended || audio.paused)) { terminou = true; setTimeout(() => { if (i === C.indexOf(c)) proxima(); }, 700); }
    }
    requestAnimationFrame(laco);
  }
  const proxima = () => { if (i >= C.length - 1) { segs.forEach((s) => s.classList.add("feita")); $("#fim").hidden = false; tocando = false; return; } ir(i + 1); };
  const pausarOuContinuar = () => { if (!pronto) return; tocando = !tocando; if (tocando) { audio.play().catch(() => {}); speechSynthesis.resume?.(); } else { audio.pause(); speechSynthesis.pause?.(); } $("#b-play").textContent = tocando ? "⏸" : "▶"; $("#b-play").setAttribute("aria-label", tocando ? "Pausar" : "Continuar"); };

  $("#b-play").addEventListener("click", pausarOuContinuar); $("#b-prox").addEventListener("click", () => ir(Math.min(C.length - 1, i + 1))); $("#b-ant").addEventListener("click", () => ir(Math.max(0, i - 1)));
  $("#b-som").addEventListener("click", () => { mudo = !mudo; audio.muted = mudo; if (mudo) speechSynthesis.cancel(); $("#b-som").textContent = mudo ? "🔇" : "🔊"; });
  $("#b-leg").addEventListener("click", () => { document.body.classList.toggle("sem-legenda"); $("#b-leg").classList.toggle("ligado"); });
  $("#b-tela").addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
  const comecar = () => { localStorage.setItem("ne-teste-demo", "1"); localStorage.removeItem("ne-teste-v6"); localStorage.removeItem("ne-modo-teste"); $("#inicio").hidden = true; $("#fim").hidden = true; speechSynthesis.getVoices(); ir(0); };
  $("#b-comecar").addEventListener("click", comecar); $("#b-rever").addEventListener("click", comecar);
  addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); pausarOuContinuar(); } else if (e.key === "ArrowRight") ir(Math.min(C.length - 1, i + 1)); else if (e.key === "ArrowLeft") ir(Math.max(0, i - 1)); else if (e.key.toLowerCase() === "f") $("#b-tela").click(); else if (e.key.toLowerCase() === "c") $("#b-leg").click(); });
  requestAnimationFrame(laco);
  window.NEApresentacao = { ir, cenas: C };
})();
