// Notas: fila de conferência, nota nova (digitada, por foto ou por XML) e detalhe da nota.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const VENDEDORES = ["Wesley", "Fábio"];
  let aba = "fila";

  const titulo = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  // Liga cada item da nota a um produto do cadastro (pelo código ou pelo nome parecido)
  const ligarProdutos = (itens, produtos) => itens.map((i) => { const m = D.casarProduto(i, produtos); return { ...i, produto_id: m.produto ? m.produto.id : null, descricao: m.produto ? m.produto.nome : i.descricao, nivel: m.nivel }; });

  NE.rotas.notas = (raiz, params, app) => {
    lista(raiz, app);
  };

  // ───────────────────────── fila ─────────────────────────
  function lista(raiz, app) {
    const admin = app.admin; const box = el("div", { id: "lista-minhas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const chips = el("div", { class: "chips" });
    const nova = el("button", { class: "btn btn-principal btn-bloco btn-gigante", type: "button", id: "btn-nova" }, ic("caminhao"), "Conferir uma carga");
    nova.addEventListener("click", () => app.ir("conferir", {}));
    const lanca = app.perm.lancaNota;
    const cab = el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, lanca ? "Notas" : "Fila de carga"), el("p", {}, lanca ? "O que está esperando conferência e o histórico." : app.perm.conferir ? "Toque numa nota para conferir. Sem nota? Use o botão abaixo." : "Notas esperando conferência.")),
      lanca && el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
        el("button", { type: "button", class: "btn btn-azul", id: "btn-nota-nova", onclick: () => app.ir("guia", { fluxo: "nota" }) }, ic("mais"), "Nova nota"),
        (app.perm.fluxos === null || (app.perm.fluxos || []).includes("xml")) && el("button", { type: "button", class: "btn btn-secundario", id: "btn-importar", onclick: () => app.ir("guia", { fluxo: "xml" }) }, ic("baixar"), "Importar XML")));
    raiz.replaceChildren(cab, app.perm.conferir ? nova : null, el("div", { style: "height:14px" }), admin && chips, box);
    let todas = [];
    const desenharChips = () => chips.replaceChildren(...[["fila", "Na fila"], ["todas", "Todas"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(aba === id), onclick: () => { aba = id; desenharChips(); desenharLista(); } }, nome)));
    const desenharLista = () => {
      const agora = Date.now(); const cfg = D.CONFIG_PADRAO;
      const vis = todas.filter((n) => (admin && aba === "todas" ? true : ["pendente", "em_conferencia"].includes(n.status)));
      if (admin && aba === "todas") vis.sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      box.replaceChildren(...(vis.length ? vis.map((n) => cartao(n, agora, cfg, app)) : [el("div", { class: "vazio-grande" }, el("strong", {}, "Fila vazia"), admin ? "Cadastre uma nota nova ou importe o XML." : "Quando chegar nota nova, ela aparece aqui e você recebe um aviso.")]));
    };
    if (admin) desenharChips();
    NE.dados.notas({ status: admin ? undefined : ["pendente", "em_conferencia"] }).then((n) => { todas = n; desenharLista(); }).catch((e) => { box.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", box); });
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
    const tabela = el("div", { class: "tabela-wrap resumo" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Qtd"))),
      el("tbody", {}, (n.itens || []).map((i) => el("tr", {}, el("td", {}, i.descricao, i.produto_id ? "" : el("span", { class: "etiqueta alerta", style: "margin-left:6px" }, "sem cadastro")), el("td", { class: "num" }, NE.num(i.quantidade ?? i.qtd_nota)))))));
    const linhas = [["Cliente", n.cliente || "—"], ["Vendedor", n.vendedor || "—"], ["Chegou", `${NE.dataHora(n.criado_em)} (${D.tempoRelativo(n.criado_em, Date.now())})`]];
    const botoes = [
      fila && el("button", { type: "button", class: "btn btn-principal", onclick: () => { j.fechar(); app.ir("conferir", { nota_id: n.id }); } }, ic("conferir"), "Conferir"),
      el("button", { type: "button", class: "btn btn-azul", onclick: () => NE.abrirEtiquetas({ ...n, tipo: "nota" }) }, ic("etiqueta"), "Etiquetas"),
      n.conferencia_id && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { const l = await NE.dados.conferencias({ de: 0 }); const c = l.find((x) => x.id === n.conferencia_id); if (c) { j.fechar(); NE.abrirConferencia(c, { podeEnviar: true }); } else NE.aviso("Conferência não encontrada.", "alerta"); } }, ic("olho"), "Ver conferência"),
      fila && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { if (!confirm(`Cancelar a nota ${n.numero}?`)) return; await NE.dados.cancelarNota(n.id); j.fechar(); NE.aviso("Nota cancelada.", "ok"); app.recarregar(); } }, ic("lixeira"), "Cancelar nota"),
    ].filter(Boolean);
    j = NE.janelaSimples({ etiqueta: `Nota ${n.numero}`, titulo: n.cliente || "Nota fiscal", corpo: el("div", {}, el("div", { class: "resumo" }, linhas.map(([k, v]) => NE.linhaResumo(k, v))), el("h3", {}, "Itens"), tabela), rodape: botoes });
  }
})();
