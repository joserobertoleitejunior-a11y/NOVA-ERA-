// Menu hambúrguer e CARROSSEL DE ATALHOS do site.
// Engenharia reversa dos outros projetos: menu em tela cheia com trava de rolagem (Rafael), botões flutuantes (San),
// grade do Instagram com chamada para seguir (Humberto), página de localização com mapa e rota (Remop/San).
(() => {
  const NE = window.NE;
  const C = window.NOVA_ERA || {};
  const { el, ic } = NE;
  const $ = (s) => document.querySelector(s);
  const site = () => NE.site || { FOTOS: [], abrirFoto() {}, abrirLista() {}, quantidade: () => 0 };
  const endereco = () => C.endereco || "";
  const rota = () => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`Nova Era Drenagem e Pré-Moldados, ${endereco()}`)}`;
  const zap = (texto) => (C.whatsapp ? `https://wa.me/${C.whatsapp}${texto ? `?text=${encodeURIComponent(texto)}` : ""}` : "");
  const IC = {
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor"/></svg>',
    mapa: NE.icone.mapa, fone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    foto: NE.icone.galeria, lista: NE.icone.lista, caminhao: NE.icone.caminhao, grade: NE.icone.grade, zap: NE.icone.whatsapp,
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  };
  const trava = (sim) => document.body.classList.toggle("sem-rolagem", sim);
  const aberto = () => { const l = (C.horarios || [])[0]; if (!l) return null; const d = new Date(), m = d.getHours() * 60 + d.getMinutes(); const mm = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; }; return l.dias.includes(d.getDay()) && m >= mm(l.abre) && m < mm(l.fecha) ? `Aberto agora · até ${l.fecha.replace(":00", "h")}` : `Fechado agora · abre ${l.abre.replace(":00", "h")}`; };

  // ───────────────────────── MENU HAMBÚRGUER ─────────────────────────
  const botao = el("button", { type: "button", class: "btn-hamburguer", id: "btn-hamburguer", "aria-label": "Abrir menu", "aria-expanded": "false", "aria-controls": "menu-site", html: IC.menu });
  $(".site-topo-dentro").append(botao);
  const LINKS = [["#inicio", "Início"], ["#sobre", "Sobre a Nova Era"], ["#produtos", "Produtos"], ["#concreto", "Concreto usinado"], ["#drenagem", "Drenagem"], ["#instagram", "Fotos e Instagram"], ["#entrega", "Acompanhar entrega"], ["#duvidas", "Dúvidas"], ["#contato", "Contato"]];
  const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar menu", html: NE.icone.fechar });
  const painel = el("div", { class: "menu-painel", role: "dialog", "aria-modal": "true", "aria-label": "Menu do site" },
    el("div", { class: "menu-topo" }, el("span", { class: "menu-logo", html: NE.logo }), fechar),
    el("nav", { class: "menu-links", "aria-label": "Seções do site" }, LINKS.map(([h, t]) => el("a", { href: h }, t))),
    el("div", { class: "menu-info" },
      el("h3", {}, "Sobre"), el("p", {}, "Mais de 40 anos em saneamento e infraestrutura. Fábrica de pré-moldados, usina de concreto e frota própria em Itapetininga/SP."),
      el("h3", {}, "Onde e quando"), el("p", {}, endereco()), el("p", { class: "menu-horario" }, aberto() || ""),
      el("div", { class: "menu-acoes" },
        el("a", { class: "menu-chip", href: C.mapaUrl || "#", target: "_blank", rel: "noopener" }, el("span", { html: IC.mapa }), "Ver no mapa"),
        el("a", { class: "menu-chip", href: rota(), target: "_blank", rel: "noopener" }, el("span", { html: IC.mapa }), "Como chegar"),
        el("a", { class: "menu-chip", href: `tel:${C.telefoneLink || ""}` }, el("span", { html: IC.fone }), C.telefoneEmpresa || "Ligar"),
        C.whatsapp ? el("a", { class: "menu-chip", href: zap("Olá! Vim pelo site da Nova Era."), target: "_blank", rel: "noopener" }, el("span", { html: IC.zap }), "WhatsApp") : null,
        el("a", { class: "menu-chip", href: C.instagram || "#", target: "_blank", rel: "noopener" }, el("span", { html: IC.insta }), "Instagram"))),
    el("div", { class: "menu-acesso" }, el("h3", {}, "Acesso restrito"), el("p", {}, "Para a equipe e a administração da Nova Era."),
      el("a", { class: "menu-botao", href: "app.html" }, el("span", { html: NE.icone.conferir }), "Área da equipe", el("small", {}, "Conferência de cargas")),
      el("a", { class: "menu-botao escuro", href: "admin.html" }, el("span", { html: NE.icone.chave }), "Administração", el("small", {}, "Painel, estoque e equipe"))));
  const fundo = el("div", { class: "menu-fundo", id: "menu-site", hidden: true }, painel);
  document.body.append(fundo);
  let foco;
  const abrirMenu = () => { foco = document.activeElement; fundo.hidden = false; requestAnimationFrame(() => fundo.classList.add("aberto")); botao.setAttribute("aria-expanded", "true"); trava(true); fechar.focus({ preventScroll: true }); };
  const fecharMenu = (restaurar = true) => { fundo.classList.remove("aberto"); botao.setAttribute("aria-expanded", "false"); trava(false); setTimeout(() => { fundo.hidden = true; }, 260); if (restaurar) foco?.focus?.({ preventScroll: true }); };
  botao.addEventListener("click", abrirMenu); fechar.addEventListener("click", () => fecharMenu());
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fecharMenu(); });
  painel.querySelectorAll("a[href^='#']").forEach((a) => a.addEventListener("click", () => fecharMenu(false)));

  // ───────────────────────── FAIXA DE CONTATOS NO TOPO (rola sozinha e pode ser arrastada) ─────────────────────────
  // Copiada do San e da Remop: faixa transparente logo abaixo do cabeçalho, com ícones brancos que andam sozinhos,
  // podem ser arrastados com o dedo/mouse (com inércia) e fazem loop infinito nos dois sentidos (dois conjuntos iguais).
  const hero = $("#inicio");
  if (hero) {
    const ITENS = [
      C.whatsapp && { rotulo: "WhatsApp", icone: IC.zap, href: zap("Olá! Vim pelo site da Nova Era.") },
      { rotulo: "Telefone", icone: IC.fone, href: `tel:${C.telefoneLink || ""}` },
      { rotulo: "Instagram", icone: IC.insta, href: C.instagram || "#", fora: true },
      { rotulo: "Localização no mapa", icone: IC.mapa, href: C.mapaUrl || "#", fora: true },
      { rotulo: "Como chegar", icone: NE.icone.local, href: rota(), fora: true },
      { rotulo: "Pedir orçamento", icone: IC.lista, acao: () => site().abrirLista() },
      { rotulo: "Fotos da fábrica e das obras", icone: IC.foto, href: "#instagram" },
      { rotulo: "Acompanhar minha entrega", icone: IC.caminhao, href: "#entrega" },
    ].filter(Boolean);
    const trilha = el("div", { class: "hero-faixa-trilha", id: "faixa-trilha" });
    const faixa = el("div", { class: "hero-faixa", "aria-label": "Contatos e atalhos" }, trilha);
    hero.append(faixa);
    const icone = (it, copia) => {
      const a = it.acao ? el("button", { type: "button", class: "hero-faixa-icone", "aria-label": it.rotulo, title: it.rotulo, html: it.icone }) : el("a", { class: "hero-faixa-icone", href: it.href, "aria-label": it.rotulo, title: it.rotulo, html: it.icone, ...(it.fora ? { target: "_blank", rel: "noopener" } : {}) });
      if (it.acao) a.addEventListener("click", it.acao);
      if (copia) { a.setAttribute("aria-hidden", "true"); a.tabIndex = -1; }
      return a;
    };
    // repete os ícones até um conjunto ser mais largo que a tela; depois duplica o conjunto (loop infinito sem emenda)
    const passo = () => (innerWidth >= 900 ? 98 : 64);
    const vezes = Math.max(1, Math.ceil((innerWidth * 1.15) / (ITENS.length * passo())));
    for (let c = 0; c < 2; c++) for (let v = 0; v < vezes; v++) ITENS.forEach((it) => trilha.append(icone(it, c === 1 || v > 0)));

    const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const VEL = 0.035, ATRITO = 0.94, LIMIAR = 6; // px/ms · atrito da inércia · px para considerar arrasto (e não toque)
    let largura = trilha.scrollWidth / 2, pos = 0, arrastando = false, moveu = false, soma = 0, px = 0, pt = 0, vel = 0, quadro = null, ultAuto = null, ultMom = null, visivel = true;
    addEventListener("resize", () => { largura = trilha.scrollWidth / 2; });
    const normalizar = () => { if (largura <= 0) return; while (pos <= -largura) pos += largura; while (pos > 0) pos -= largura; };
    const desenhar = () => { normalizar(); trilha.style.transform = `translateX(${pos}px)`; };
    const cancelar = () => { if (quadro) cancelAnimationFrame(quadro); quadro = null; };
    function auto(agora) {
      if (!visivel) { quadro = null; ultAuto = null; return; }
      if (ultAuto === null) ultAuto = agora; const dt = agora - ultAuto; ultAuto = agora;
      if (!arrastando && !reduz) { pos -= VEL * dt; desenhar(); }
      quadro = requestAnimationFrame(auto);
    }
    function inercia(agora) {
      if (ultMom === null) ultMom = agora; const dt = agora - ultMom; ultMom = agora;
      pos += vel * dt; vel *= ATRITO; desenhar();
      if (Math.abs(vel) > 0.01) quadro = requestAnimationFrame(inercia); else { ultMom = null; ultAuto = null; quadro = requestAnimationFrame(auto); }
    }
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { const antes = visivel; visivel = es[0].isIntersecting; if (visivel && !antes && !arrastando && !quadro) quadro = requestAnimationFrame(auto); }).observe(trilha);
    trilha.addEventListener("pointerdown", (e) => { arrastando = true; moveu = false; soma = 0; cancelar(); px = e.clientX; pt = performance.now(); vel = 0; trilha.classList.add("arrastando"); try { trilha.setPointerCapture(e.pointerId); } catch { /* ok */ } });
    trilha.addEventListener("pointermove", (e) => { if (!arrastando) return; const agora = performance.now(), dx = e.clientX - px, dt = Math.max(agora - pt, 1); pos += dx; vel = dx / dt; soma += Math.abs(dx); if (soma > LIMIAR) moveu = true; px = e.clientX; pt = agora; desenhar(); });
    const soltar = () => { if (!arrastando) return; arrastando = false; trilha.classList.remove("arrastando"); cancelar(); ultMom = null; if (Math.abs(vel) > 0.02 && !reduz) quadro = requestAnimationFrame(inercia); else { ultAuto = null; quadro = requestAnimationFrame(auto); } };
    trilha.addEventListener("pointerup", soltar); trilha.addEventListener("pointercancel", soltar);
    trilha.addEventListener("pointerleave", (e) => { if (arrastando && e.buttons === 0) soltar(); });
    trilha.addEventListener("click", (e) => { if (moveu) { e.preventDefault(); e.stopPropagation(); } }, true); // depois de arrastar, o clique que sobra não abre o link
    quadro = requestAnimationFrame(auto);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !fundo.hidden) fecharMenu(); });
})();
