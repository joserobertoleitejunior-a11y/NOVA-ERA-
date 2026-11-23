// Notas: fila de conferência, nota nova (digitada, por foto ou por XML) e detalhe da nota.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  let aba = "fila", escopo = "minhas";

  const titulo = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  // Liga cada item da nota a um produto do cadastro (pelo código ou pelo nome parecido)
  const ligarProdutos = (itens, produtos) => itens.map((i) => { const m = D.casarProduto(i, produtos); return { ...i, produto_id: m.produto ? m.produto.id : null, descricao: m.produto ? m.produto.nome : i.descricao, nivel: m.nivel }; });

  NE.rotas.notas = (raiz, params, app) => {
    lista(raiz, app);
  };

  // ───────────────────────── fila ─────────────────────────
  // Vendedor: começa só nas notas DELE ("Minhas"), com a opção de ver as de todos. Quem tem acesso de administração pode buscar por número ou cliente.
  function lista(raiz, app) {
    const admin = app.admin; const vendedor = app.perm.painel === "vendas";
    const box = el("div", { id: "lista-minhas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const chips = el("div", { class: "chips" }); const chipsDono = el("div", { class: "chips" });
    const busca = el("input", { class: "entrada busca", id: "busca-notas", type: "search", inputmode: "search", autocomplete: "off", placeholder: "Buscar nota ou cliente" });
    const resumo = el("div", {});
    const nova = el("button", { class: "btn btn-principal btn-bloco btn-gigante", type: "button", id: "btn-nova" }, ic("caminhao"), "Conferir uma carga");
    nova.addEventListener("click", () => app.ir("conferir", {}));
    const lanca = app.perm.lancaNota;
    const cab = el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, vendedor ? "Minhas notas" : lanca ? "Notas" : "Fila de carga"), el("p", {}, vendedor ? "As notas que você lançou: o que espera carregar e o que já saiu." : lanca ? "O que está esperando conferência e o histórico." : app.perm.conferir ? "Toque numa nota para conferir. Sem nota? Use o botão abaixo." : "Notas esperando conferência.")),
      lanca && el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
        el("button", { type: "button", class: "btn btn-azul", id: "btn-nota-nova", onclick: () => app.ir("guia", { fluxo: "nota" }) }, ic("mais"), "Nova nota"),
        NE.pacote.tem("xml") && (app.perm.fluxos === null || (app.perm.fluxos || []).includes("xml")) && el("button", { type: "button", class: "btn btn-secundario", id: "btn-importar", onclick: () => app.ir("guia", { fluxo: "xml" }) }, ic("baixar"), "Importar XML")));
    raiz.replaceChildren(cab, app.perm.conferir ? nova : null, el("div", { style: "height:14px" }), admin && el("div", { class: "busca-linha" }, busca), vendedor && chipsDono, admin && chips, resumo, box);
    let todas = [];
    const desenharChips = () => chips.replaceChildren(...[["fila", "Na fila"], ["todas", "Todas"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(aba === id), onclick: () => { aba = id; desenharChips(); desenharLista(); } }, nome)));
    const desenharDono = () => chipsDono.replaceChildren(...[["minhas", "Minhas"], ["todos", "De todos"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(escopo === id), onclick: () => { escopo = id; desenharDono(); desenharLista(); } }, nome)));
    const desenharLista = () => {
      const agora = Date.now(); const cfg = D.CONFIG_PADRAO; const q = D.normalizar(busca.value);
      let vis = todas.filter((n) => !vendedor || escopo === "todos" || D.ehMinhaNota(n, app.perfil));
      if (q) vis = vis.filter((n) => D.normalizar(`${n.numero} ${n.cliente || ""}`).includes(q)).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));   // a busca olha todas as situações
      else { vis = vis.filter((n) => (admin && aba === "todas" ? true : ["pendente", "em_conferencia"].includes(n.status))); if (admin && aba === "todas") vis.sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)); }
      resumo.replaceChildren(q ? el("div", { class: "filtro-ativo" }, el("span", {}, resumoBusca(vis, busca.value.trim()))) : "");
      box.replaceChildren(...(vis.length ? vis.map((n) => cartao(n, agora, cfg, app)) : [el("div", { class: "vazio-grande" }, el("strong", {}, q ? "Nada encontrado" : vendedor && escopo === "minhas" ? "Nenhuma nota sua na fila" : "Fila vazia"),
        q ? "Confira o número ou o nome do cliente." : vendedor && escopo === "minhas" ? "Lance uma nota nova ou toque em \"De todos\" para ver as dos outros vendedores." : admin ? (NE.pacote.tem("xml") ? "Cadastre uma nota nova ou importe o XML." : "Cadastre uma nota nova.") : "Quando chegar nota nova, ela aparece aqui e você recebe um aviso.")]));
    };
    busca.addEventListener("input", desenharLista);
    if (admin) desenharChips(); if (vendedor) desenharDono();
    NE.dados.notas({ status: admin ? undefined : ["pendente", "em_conferencia"] }).then((n) => { todas = n; desenharLista(); }).catch((e) => { box.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", box); });
  }

  // "JB Obras": 5 notas · 3 entregues · 1 na fila · 1 cancelada
  function resumoBusca(vis, termo) {
    if (!vis.length) return `Nenhuma nota para “${termo}”.`;
    const c = (f) => vis.filter(f).length; const partes = [[c((n) => n.status === "conferida"), "entregue", "entregues"], [c((n) => ["pendente", "em_conferencia"].includes(n.status)), "na fila", "na fila"], [c((n) => n.status === "cancelada"), "cancelada", "canceladas"]].filter(([n]) => n > 0).map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`);
    return `“${termo}”: ${D.plural(vis.length, "nota", "notas")} · ${partes.join(" · ")}`;
  }

  function cartao(n, agora, cfg, app) {
    const idade = (agora - D.aMs(n.criado_em)) / D.MIN; const fila = ["pendente", "em_conferencia"].includes(n.status);
    const parada = fila && idade >= cfg.limiteNotaParadaMin;
    const stat = { pendente: ["Aguardando", ""], em_conferencia: ["Conferindo", "azul"], conferida: ["Conferida", "ok"], cancelada: ["Cancelada", "erro"] }[n.status] || ["", ""];
    const b = el("button", { type: "button", class: `linha-cartao ${parada ? "critico" : fila ? "atencao" : n.status === "conferida" ? "ok" : ""}` },
      el("strong", {}, `Nota ${n.numero}`, n.cliente ? ` · ${n.cliente}` : ""),
      el("span", { class: "meta" }, `${D.plural((n.itens || []).length, "item", "itens")}${n.vendedor ? ` · ${n.vendedor}` : ""} · ${fila ? `espera há ${D.duracao(idade)}` : D.tempoRelativo(n.criado_em, agora)}`),
      el("span", { class: "lado" }, el("span", { class: `etiqueta ${parada ? "erro" : stat[1]}` }, parada ? "Parada" : stat[0])));
    b.addEventListener("click", () => (app.admin ? detalhe(n, app) : !app.perm.conferir ? NE.aviso("Esta nota espera conferência. Quem confere a carga é o conferente.", "alerta") : fila ? app.ir("conferir", { nota_id: n.id }) : null));
    return b;
  }

  // ───────────────────────── detalhe ─────────────────────────
  function detalhe(n, app) {
    const fila = ["pendente", "em_conferencia"].includes(n.status); let j;
    const vendedor = app.perm.painel === "vendas"; const minha = D.ehMinhaNota(n, app.perfil);
    const tabela = el("div", { class: "tabela-wrap resumo" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Qtd"))),
      el("tbody", {}, (n.itens || []).map((i) => el("tr", {}, el("td", {}, i.descricao, i.produto_id ? "" : el("span", { class: "etiqueta alerta", style: "margin-left:6px" }, "sem cadastro")), el("td", { class: "num" }, NE.num(i.quantidade ?? i.qtd_nota)))))));
    const situacao = n.status === "conferida" ? "Carga conferida e liberada" : n.status === "cancelada" ? "Cancelada" : `Esperando conferência há ${D.duracao((Date.now() - D.aMs(n.criado_em)) / D.MIN)}`;
    const linhas = [["Cliente", n.cliente || "—"], ["Vendedor", n.vendedor || "—"], ["Situação", situacao], ["Lançada", `${NE.dataHora(n.criado_em)} (${D.tempoRelativo(n.criado_em, Date.now())})`]];
    const botoes = [
      fila && app.perm.conferir && el("button", { type: "button", class: "btn btn-principal", onclick: () => { j.fechar(); app.ir("conferir", { nota_id: n.id }); } }, ic("conferir"), "Conferir"),
      !vendedor && NE.pacote.tem("etiquetas") && el("button", { type: "button", class: "btn btn-azul", onclick: () => NE.abrirEtiquetas({ ...n, tipo: "nota" }) }, ic("etiqueta"), "Etiquetas"),
      n.conferencia_id && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { const l = await NE.dados.conferencias({ de: 0 }); const c = l.find((x) => x.id === n.conferencia_id); if (c) { j.fechar(); NE.abrirConferencia(c, { podeEnviar: true }); } else NE.aviso("Conferência não encontrada.", "alerta"); } }, ic("olho"), vendedor ? "Ver a carga e mandar o rastreio" : "Ver conferência"),
      fila && (!vendedor || minha) && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { if (!confirm(`Cancelar a nota ${n.numero}?`)) return; await NE.dados.cancelarNota(n.id); j.fechar(); NE.aviso("Nota cancelada.", "ok"); app.recarregar(); } }, ic("lixeira"), "Cancelar nota"),
    ].filter(Boolean);
    j = NE.janelaSimples({ etiqueta: `Nota ${n.numero}`, titulo: n.cliente || "Nota fiscal", corpo: el("div", {}, el("div", { class: "resumo" }, linhas.map(([k, v]) => NE.linhaResumo(k, v))), el("h3", {}, "Itens"), tabela, vendedor && fila ? el("p", { class: "suave" }, "Você recebe um aviso quando a carga desta nota sair.") : null), rodape: botoes });
  }
})();
