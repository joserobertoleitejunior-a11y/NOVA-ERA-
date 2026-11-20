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

  // ───────────────────────── CARROSSEL DE ATALHOS ─────────────────────────
  const fotos = () => site().FOTOS || [];
  const miniaturas = (qtd, inicio = 0) => el("div", { class: "car-fotos" }, fotos().slice(inicio, inicio + qtd).map((f, i) => el("button", { type: "button", class: "car-foto", "aria-label": `Ampliar: ${f.alt}`, onclick: () => { fecharAtalhos(); site().abrirFoto(inicio + i); } },
    el("img", { src: `${f.src}-540.webp`, alt: "", loading: "lazy", decoding: "async" }))));
  const CARTOES = () => [
    { id: "insta", icone: IC.insta, titulo: "Instagram", sub: "@novaeradrenagem", corpo: [miniaturas(3, 0), el("p", {}, "Obras, fábrica e frota no dia a dia.")], acao: el("a", { class: "car-botao", href: C.instagram || "#", target: "_blank", rel: "noopener" }, "Seguir no Instagram") },
    { id: "local", icone: IC.mapa, titulo: "Localização", sub: aberto() || "Itapetininga/SP", corpo: [el("p", { class: "car-forte" }, endereco()), el("p", {}, "Fábrica, usina de concreto e pátio no mesmo endereço. Entregamos com frota própria.")], acao: el("div", { class: "car-duplo" }, el("a", { class: "car-botao", href: rota(), target: "_blank", rel: "noopener" }, "Como chegar"), el("a", { class: "car-botao claro", href: C.mapaUrl || "#", target: "_blank", rel: "noopener" }, "Ver no mapa")) },
    { id: "orc", icone: IC.lista, titulo: "Orçamento", sub: site().quantidade() ? `${site().quantidade()} na sua lista` : "Sem preço e sem compromisso", corpo: [el("p", {}, "Monte a lista com as peças e a calculadora de concreto. A equipe responde com valores e prazo.")], acao: el("div", { class: "car-duplo" }, el("button", { type: "button", class: "car-botao", onclick: () => { fecharAtalhos(); site().abrirLista(); } }, "Abrir minha lista"), el("a", { class: "car-botao claro", href: "#produtos", onclick: () => fecharAtalhos() }, "Ver produtos")) },
    { id: "img", icone: IC.foto, titulo: "Imagens", sub: `${fotos().length} fotos reais`, corpo: [miniaturas(3, 3), el("p", {}, "Peças, pátio e obras entregues, sem banco de imagem.")], acao: el("a", { class: "car-botao", href: "#instagram", onclick: () => fecharAtalhos() }, "Ver todas as fotos") },
    { id: "ent", icone: IC.caminhao, titulo: "Minha entrega", sub: "Rastreio ao vivo", corpo: [el("p", {}, "Recebeu um link no WhatsApp? Cole aqui e veja o horário de saída, o que foi carregado e a foto da carga.")], acao: el("a", { class: "car-botao", href: "#entrega", onclick: () => fecharAtalhos() }, "Acompanhar entrega") },
    { id: "fala", icone: IC.fone, titulo: "Fale conosco", sub: C.telefoneEmpresa || "", corpo: [el("p", {}, "Atendimento comercial para obras, prefeituras e construtoras.")], acao: el("div", { class: "car-duplo" }, el("a", { class: "car-botao", href: `tel:${C.telefoneLink || ""}` }, "Ligar agora"), C.whatsapp ? el("a", { class: "car-botao zap", href: zap("Olá! Quero um orçamento."), target: "_blank", rel: "noopener" }, "WhatsApp") : el("a", { class: "car-botao claro", href: "#contato", onclick: () => fecharAtalhos() }, "Mais contatos")) },
  ];
  const faixa = el("div", { class: "car-faixa", tabindex: "0", "aria-label": "Atalhos do site, deslize para o lado" });
  const pontos = el("div", { class: "car-pontos", "aria-hidden": "true" });
  const setaE = el("button", { type: "button", class: "car-seta", "aria-label": "Atalho anterior", html: NE.icone.voltar }), setaD = el("button", { type: "button", class: "car-seta", "aria-label": "Próximo atalho", html: NE.icone.seguir });
  const fecharA = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar atalhos", html: NE.icone.fechar });
  const folha = el("div", { class: "car-folha", role: "dialog", "aria-modal": "true", "aria-label": "Atalhos" }, el("div", { class: "car-topo" }, el("div", {}, el("p", { class: "sobre-titulo" }, "Atalhos"), el("h2", {}, "O que você procura?")), fecharA),
    el("div", { class: "car-palco" }, setaE, faixa, setaD), pontos);
  const fundoA = el("div", { class: "car-fundo", id: "atalhos", hidden: true }, folha); document.body.append(fundoA);
  let cartoes = [];
  const desenharCartoes = () => {
    cartoes = CARTOES().map((c) => el("article", { class: "car-cartao", "data-id": c.id }, el("div", { class: "car-icone", html: c.icone }), el("h3", {}, c.titulo), el("p", { class: "car-sub" }, c.sub), ...c.corpo, el("div", { class: "car-acao" }, c.acao)));
    faixa.replaceChildren(...cartoes); pontos.replaceChildren(...cartoes.map((_, i) => el("i", { class: i === 0 ? "ativo" : "" })));
  };
  const indice = () => Math.round(faixa.scrollLeft / (cartoes[0].offsetWidth + 14));
  const ir = (i) => cartoes[Math.max(0, Math.min(cartoes.length - 1, i))].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  faixa.addEventListener("scroll", () => { const i = indice(); [...pontos.children].forEach((p, k) => p.classList.toggle("ativo", k === i)); setaE.disabled = i <= 0; setaD.disabled = i >= cartoes.length - 1; }, { passive: true });
  setaE.addEventListener("click", () => ir(indice() - 1)); setaD.addEventListener("click", () => ir(indice() + 1));
  faixa.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); ir(indice() + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); ir(indice() - 1); } });
  const abrirAtalhos = () => { desenharCartoes(); fundoA.hidden = false; requestAnimationFrame(() => { fundoA.classList.add("aberto"); faixa.scrollLeft = 0; setaE.disabled = true; setaD.disabled = false; }); trava(true); fecharA.focus({ preventScroll: true }); };
  function fecharAtalhos() { fundoA.classList.remove("aberto"); trava(false); setTimeout(() => { fundoA.hidden = true; }, 260); }
  fecharA.addEventListener("click", fecharAtalhos); fundoA.addEventListener("click", (e) => { if (e.target === fundoA) fecharAtalhos(); });
  const pilha = $(".flutuantes");
  if (pilha) { const b = el("button", { class: "flutuante atalhos", type: "button", id: "btn-atalhos", "aria-label": "Atalhos: Instagram, localização, orçamento e fotos", html: IC.grade }); b.addEventListener("click", abrirAtalhos); pilha.prepend(b); }
  document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (!fundo.hidden) fecharMenu(); if (!fundoA.hidden) fecharAtalhos(); });
})();
