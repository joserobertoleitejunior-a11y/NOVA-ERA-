// Site institucional Nova Era. Engenharia reversa dos nossos sites:
//  - San: selo "Aberto agora" pelo horário, lista de orçamento (carrinho sem preço) → WhatsApp, FAQ, flutuantes
//  - Humberto: calculadora → orçamento, galeria com foto em tela cheia, motor de rolagem próprio
(() => {
  const NE = window.NE;
  const C = window.NOVA_ERA;
  const { el, ic } = NE;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ── Dados da empresa em todos os lugares (um só ponto: config.js) ──
  $("#logo").innerHTML = NE.logo;
  $("#ano").textContent = new Date().getFullYear();
  $$("[data-link-telefone]").forEach((a) => { a.href = `tel:${C.telefoneLink}`; });
  $$("[data-link-mapa]").forEach((a) => { a.href = C.mapaUrl; });
  $$("[data-telefone]").forEach((e) => { e.textContent = C.telefoneEmpresa; });
  $$("[data-endereco]").forEach((e) => { e.textContent = C.endereco; });
  const ICONES = {
    telefone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    lista: NE.icone.lista,
  };
  $$("[data-icone]").forEach((s) => { s.outerHTML = ICONES[s.dataset.icone] || ""; });
  $$("[data-copiar-telefone]").forEach((b) => b.addEventListener("click", () => copiar(C.telefoneEmpresa, "Telefone copiado.")));

  // ── Selo "Aberto agora" (San) ───────────────────────
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const minutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function horario() {
    const lista = C.horarios || [];
    if (!lista.length) return;
    const agora = new Date(), dia = agora.getDay(), min = agora.getHours() * 60 + agora.getMinutes();
    const hoje = lista.find((h) => h.dias.includes(dia));
    const aberto = !!hoje && min >= minutos(hoje.abre) && min < minutos(hoje.fecha);
    $$("[data-selo-horario]").forEach((s) => {
      s.hidden = false; s.className = `selo-horario ${aberto ? "aberto" : "fechado"}`;
      s.textContent = aberto ? `Aberto até ${hoje.fecha.replace(":00", "h")}` : "Fechado agora";
    });
    const primeiro = lista[0];
    const faixa = primeiro.dias.length === 5 && primeiro.dias[0] === 1 ? "Segunda a sexta" : primeiro.dias.map((d) => DIAS[d]).join(", ");
    $$("[data-texto-horario]").forEach((e) => { e.textContent = `${faixa}, das ${primeiro.abre.replace(":00", "h")} às ${primeiro.fecha.replace(":00", "h")}.`; });
  }
  horario(); setInterval(horario, 60000);

  // ── Lista de orçamento (San) ────────────────────────
  const CHAVE = "ne-lista-orcamento";
  let lista = NE.memoria.ler(CHAVE) || [];
  const salvar = () => { NE.memoria.gravar(CHAVE, lista); contar(); };
  const qtdTexto = (i) => `${String(i.qtd).replace(".", ",")} ${i.unidade === "peças" && i.qtd === 1 ? "peça" : i.unidade}`;
  function contar() {
    const n = lista.length;
    $$("[data-contador-lista]").forEach((c) => { c.hidden = !n; c.textContent = n; });
  }
  function adicionar(nome, qtd = 1, unidade = "un", obs = "") {
    const existente = lista.find((i) => i.nome === nome && i.unidade === unidade && !obs);
    if (existente && !obs) existente.qtd += qtd; else lista.push({ id: Date.now() + Math.random(), nome, qtd, unidade, obs });
    salvar();
    NE.aviso(`${nome} na sua lista.`, "ok");
    $$(".flutuante.principal").forEach((b) => b.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.3,1.6,.5,1)" }));
  }
  const gaveta = $("#gaveta");
  const nomeCliente = () => NE.memoria.ler("ne-cliente") || { nome: "", obra: "" };
  function mensagem() {
    const cli = nomeCliente();
    const linhas = ["Olá, Nova Era! Gostaria de um orçamento:", ""];
    lista.forEach((i) => linhas.push(`• ${i.nome}: ${qtdTexto(i)}${i.obs ? ` (${i.obs})` : ""}`));
    if (cli.nome) linhas.push("", `Nome: ${cli.nome}`);
    if (cli.obra) linhas.push(`Cidade/obra: ${cli.obra}`);
    return linhas.join("\n");
  }
  function desenharGaveta() {
    const corpo = $("#gaveta-corpo"), rodape = $("#gaveta-rodape");
    if (!lista.length) {
      corpo.replaceChildren(el("div", { class: "vazio" }, el("strong", {}, "Sua lista está vazia"), el("p", {}, "Toque em \"Adicionar\" nos produtos ou use a calculadora de concreto.")),
        el("a", { class: "btn btn-azul btn-bloco", href: "#produtos", onclick: fecharLista }, "Ver produtos"));
      rodape.replaceChildren();
      return;
    }
    const cli = nomeCliente();
    const campoNome = el("input", { class: "entrada", id: "cli-nome", autocomplete: "name", value: cli.nome, placeholder: "Seu nome (opcional)" });
    const campoObra = el("input", { class: "entrada", id: "cli-obra", autocomplete: "address-level2", value: cli.obra, placeholder: "Cidade ou endereço da obra (opcional)" });
    const guardarCli = () => NE.memoria.gravar("ne-cliente", { nome: campoNome.value.trim(), obra: campoObra.value.trim() });
    campoNome.addEventListener("input", guardarCli); campoObra.addEventListener("input", guardarCli);
    corpo.replaceChildren(
      ...lista.map((i) => el("div", { class: "item-lista" },
        el("div", {}, el("strong", {}, i.nome), i.obs && el("span", { class: "suave" }, i.obs)),
        el("div", { class: "item-lista-acoes" },
          el("div", { class: "contador contador-p" },
            el("button", { type: "button", "aria-label": `Diminuir ${i.nome}`, html: NE.icone.menos, onclick: () => { i.qtd = Math.max(i.unidade === "m³" ? 0.5 : 1, +(i.qtd - (i.unidade === "m³" ? 0.5 : 1)).toFixed(1)); salvar(); desenharGaveta(); } }),
            el("span", { class: "contador-valor" }, qtdTexto(i)),
            el("button", { type: "button", "aria-label": `Aumentar ${i.nome}`, html: NE.icone.mais, onclick: () => { i.qtd = +(i.qtd + (i.unidade === "m³" ? 0.5 : 1)).toFixed(1); salvar(); desenharGaveta(); } })),
          el("button", { type: "button", class: "link-acao", onclick: () => { lista = lista.filter((x) => x !== i); salvar(); desenharGaveta(); } }, ic("fechar"), "Tirar")))),
      el("div", { class: "campo" }, el("label", { for: "cli-nome" }, "Seu nome"), campoNome),
      el("div", { class: "campo" }, el("label", { for: "cli-obra" }, "Cidade ou obra"), campoObra));
    const zap = C.whatsapp ? el("a", { class: "btn btn-verde btn-bloco", target: "_blank", rel: "noopener", onclick: (e) => { e.currentTarget.href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensagem())}`; } }, ic("whatsapp"), "Enviar pelo WhatsApp") : null;
    rodape.replaceChildren(
      zap || el("p", { class: "suave", style: "margin:0 0 4px" }, "Copie a lista e mande pelo WhatsApp, ou ligue e leia para a equipe."),
      el("div", { class: "rodape-botoes" },
        el("button", { type: "button", class: `btn ${zap ? "btn-secundario" : "btn-principal"}`, onclick: () => copiar(mensagem(), "Lista copiada. Cole no WhatsApp da Nova Era.") }, "Copiar lista"),
        el("a", { class: "btn btn-azul", href: `tel:${C.telefoneLink}` }, "Ligar")));
  }
  let focoAntes = null;
  function abrirLista() {
    focoAntes = document.activeElement;
    desenharGaveta(); gaveta.hidden = false; document.body.classList.add("sem-rolagem");
    requestAnimationFrame(() => gaveta.classList.add("aberta"));
    $("[data-fechar-lista]").focus({ preventScroll: true });
  }
  function fecharLista() {
    gaveta.classList.remove("aberta"); document.body.classList.remove("sem-rolagem");
    setTimeout(() => { gaveta.hidden = true; }, 220);
    focoAntes?.focus?.({ preventScroll: true });
  }
  $("[data-fechar-lista]").innerHTML = NE.icone.fechar;
  $("[data-fechar-lista]").addEventListener("click", fecharLista);
  gaveta.addEventListener("click", (e) => { if (e.target === gaveta) fecharLista(); });
  $$("[data-abrir-lista]").forEach((b) => b.addEventListener("click", abrirLista));
  addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!gaveta.hidden) fecharLista(); if (!$("#lightbox").hidden) fecharFoto(); } });
  contar();

  // ── Produtos ────────────────────────────────────────
  const des = (d) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const PRODUTOS = [
    { nome: "Boca de lobo", texto: "Captação de água da chuva na sarjeta.", d: des('<path d="M8 22h48v26H8z"/><path d="M14 30h36M14 36h36M14 42h36"/><path d="M8 22l6-8h36l6 8"/>') },
    { nome: "Meio-fio e guias", texto: "Acabamento de rua e calçada.", d: des('<path d="M6 40h52v10H6z"/><path d="M6 40l8-12h44v12"/><path d="M22 28v12M38 28v12"/>') },
    { nome: "Caixa para galeria", texto: "Canalização de grandes vazões.", d: des('<rect x="10" y="14" width="44" height="36" rx="3"/><rect x="18" y="22" width="28" height="20" rx="2"/>') },
    { nome: "Caixa de inspeção", texto: "Inspeção e passagem da rede.", d: des('<path d="M14 18h36v32H14z"/><path d="M20 12h24v6H20z"/><circle cx="32" cy="34" r="7"/>') },
    { nome: "Tubos e aduelas", texto: "Concreto armado para drenagem.", d: des('<ellipse cx="18" cy="32" rx="8" ry="14"/><path d="M18 18h28M18 46h28"/><ellipse cx="46" cy="32" rx="8" ry="14"/>') },
    { nome: "Dissipadores e alas", texto: "Saída de bueiros e proteção.", d: des('<path d="M8 48l14-28h20l14 28z"/><path d="M22 48l6-12h8l6 12"/>') },
  ];
  $("#grade-produtos").append(...PRODUTOS.map((p) => el("article", { class: "produto vidro", "data-tilt": true },
    el("span", { class: "produto-desenho", html: p.d }),
    el("h3", {}, p.nome), el("p", {}, p.texto),
    el("div", { class: "produto-acoes" },
      el("button", { type: "button", class: "btn btn-principal", onclick: () => adicionar(p.nome, 1, "peças") }, ic("mais"), "Adicionar"),
      el("button", { type: "button", class: "link-acao", onclick: () => { adicionar(p.nome, 1, "peças"); abrirLista(); } }, "Orçar agora")))));

  // ── Calculadora de concreto (Humberto) ───────────────
  const num = (id) => Number(String($(id).value).replace(",", ".")) || 0;
  const fmt = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  let ultimoCalc = null;
  function calcular() {
    const c = num("#calc-comp"), l = num("#calc-larg"), e = num("#calc-esp") / 100;
    const base = c * l * e, m3 = Math.ceil(base * 1.05 * 2) / 2; // arredonda para cima em meio m³
    const cap = C.capacidadeBetoneiraM3 || 8;
    ultimoCalc = m3 > 0 ? { m3, obs: `${fmt(c)} × ${fmt(l)} m, ${fmt(e * 100)} cm` } : null;
    $("#calc-m3").textContent = m3 > 0 ? `${fmt(m3)} m³` : "—";
    $("#calc-detalhe").textContent = m3 > 0 ? `${fmt(base)} m³ + 5% de folga` : "Preencha as medidas";
    $("#calc-viagens").textContent = m3 > 0 ? String(Math.ceil(m3 / cap)) : "—";
    $("#calc-cap").textContent = `betoneira de até ${cap} m³`;
  }
  $$("#form-calc input").forEach((i) => i.addEventListener("input", calcular));
  $("#form-calc").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ultimoCalc) return NE.aviso("Preencha comprimento, largura e espessura.", "alerta");
    adicionar("Concreto usinado", ultimoCalc.m3, "m³", ultimoCalc.obs);
  });
  calcular();

  // ── Galeria + foto em tela cheia ─────────────────────
  const FOTOS = [
    { src: "assets/img/site/fabrica-silos", alt: "Silos de concreto da Nova Era e o galpão vermelho" },
    { src: "assets/img/site/frota-munck", alt: "Caminhões com munck da frota Nova Era" },
    { src: "assets/img/site/patio-betoneira", alt: "Betoneira e peças pré-moldadas no pátio" },
  ];
  $("#galeria-fotos").append(...FOTOS.map((f, i) => el("button", { type: "button", class: "galeria-item", "aria-label": `Ampliar: ${f.alt}`, onclick: () => abrirFoto(i) },
    el("img", { src: `${f.src}-900.webp`, alt: f.alt, loading: "lazy", decoding: "async" }), el("span", { class: "galeria-legenda" }, f.alt))));
  const lb = $("#lightbox");
  let fotoAtual = 0;
  function abrirFoto(i) {
    fotoAtual = (i + FOTOS.length) % FOTOS.length;
    const f = FOTOS[fotoAtual];
    lb.replaceChildren(
      el("img", { src: `${f.src}-1600.webp`, alt: f.alt }),
      el("button", { type: "button", class: "janela-fechar claro", "aria-label": "Fechar foto", html: NE.icone.fechar, onclick: fecharFoto }),
      el("button", { type: "button", class: "foto-seta esq", "aria-label": "Foto anterior", html: NE.icone.voltar, onclick: () => abrirFoto(fotoAtual - 1) }),
      el("button", { type: "button", class: "foto-seta dir", "aria-label": "Próxima foto", html: NE.icone.seguir, onclick: () => abrirFoto(fotoAtual + 1) }),
      el("div", { class: "foto-tela-rodape" }, el("span", {}, f.alt), el("span", {}, `${fotoAtual + 1} de ${FOTOS.length}`)));
    lb.hidden = false; document.body.classList.add("sem-rolagem");
    lb.querySelector(".janela-fechar").focus({ preventScroll: true });
  }
  function fecharFoto() { lb.hidden = true; document.body.classList.remove("sem-rolagem"); }
  lb.addEventListener("click", (e) => { if (e.target === lb) fecharFoto(); });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) abrirFoto(fotoAtual + (dx < 0 ? 1 : -1)); x0 = null; });

  // ── Perguntas frequentes (San) ───────────────────────
  const FAQ = [
    ["Vocês entregam na obra?", "Sim. Temos frota própria, com caminhões com munck para as peças e betoneiras para o concreto. Consulte o prazo e a sua região com a equipe."],
    ["Como acompanho a minha entrega?", "Quando a carga sai do pátio, você recebe um link no WhatsApp. Nele aparecem o horário de saída, o que foi carregado e a foto da carga."],
    ["Vocês fazem peças sob medida?", "Sim. Além das peças em série, fabricamos sob encomenda. Mande as medidas na lista de orçamento ou ligue."],
    ["Como peço um orçamento?", "Monte a sua lista aqui no site (sem preço e sem compromisso) e envie para a equipe, ou ligue para (15) 3273-1159."],
    ["Quanto concreto eu preciso?", "Use a calculadora de concreto desta página para uma estimativa. A equipe confirma as medidas antes da entrega."],
    ["Quais cidades vocês atendem?", "Itapetininga e região. Fale com a equipe para confirmar a entrega na sua cidade."],
  ];
  $("#faq").append(...FAQ.map(([p, r], k) => {
    const id = `faq-r-${k}`;
    const resposta = el("div", { class: "faq-resposta", id, role: "region" }, el("p", {}, r));
    const botao = el("button", { type: "button", class: "faq-pergunta", "aria-expanded": "false", "aria-controls": id }, el("span", {}, p), el("span", { class: "faq-sinal", html: NE.icone.mais }));
    botao.addEventListener("click", () => { const aberto = botao.getAttribute("aria-expanded") === "true"; botao.setAttribute("aria-expanded", String(!aberto)); });
    return el("div", { class: "faq-item vidro" }, botao, resposta);
  }));

  // ── Rastreio por link ───────────────────────────────
  $("#form-rastrear").addEventListener("submit", (e) => {
    e.preventDefault();
    const m = $("#campo-rastreio").value.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return NE.aviso("Não encontrei o código. Cole o link inteiro que chegou no WhatsApp.", "alerta", $("#aviso-rastreio"));
    location.href = `rastreio.html?c=${m[0]}`;
  });

  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); NE.aviso(msg, "ok"); }
    catch { NE.aviso("Não deu para copiar neste aparelho.", "alerta"); }
  }

  // Efeitos de rolagem depois que o conteúdo dinâmico existe
  window.NEMotion?.iniciar();
})();
