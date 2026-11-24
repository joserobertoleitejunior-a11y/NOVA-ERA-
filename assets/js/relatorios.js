// PLANILHAS E RELATÓRIOS: movimentação de estoque, estoque agora, notas na fila, cargas, contagens e histórico.
// Todos viram um "bloco" { titulo, subtitulo, colunas, linhas, resumo, graficos, arquivo } (ver relatorio-visual.js) e passam pela mesma janela:
// números-chave que sobem, gráficos que crescem e a tabela colorida; dali dá para baixar a planilha (Excel) ou imprimir.
// O assistente (ia.js) manda o mesmo formato: o que ele mostrou na conversa é o que abre e imprime.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const fmt = D.fmt;
  const Vis = window.NERelatorioVisual;
  const G = window.NEGraficos;
  const TIPO = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste" };
  const sinal = (q) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q))}`;
  const doPeriodo = (dias) => Date.now() - dias * D.DIA;
  const rotuloDias = (dias) => (dias === 1 ? "hoje e ontem" : `últimos ${dias} dias`);
  const nomes = (lista) => new Map(lista.map((p) => [p.id, p.nome]));
  const resumoItens = (itens) => (itens || []).map((i) => `${fmt(i.quantidade ?? i.qtd_nota)} ${i.descricao}`).join(" · ");
  const bloco = (id, titulo, subtitulo, colunas, linhas) => ({ id, titulo, subtitulo, colunas: colunas.map(([rotulo, dir]) => ({ rotulo, ...(dir ? { dir: true } : {}) })), linhas, resumo: [], arquivo: id });

  const R = (NE.relatorios = {
    async movimentacao({ produtoId, dias = 30, de: desde, ate, rotulo } = {}) {   // período: "dias" para trás, ou de/ate exatos (o assistente usa "hoje", "ontem"...)
      const [ps, mov, pessoas] = await Promise.all([NE.dados.produtos(true), NE.dados.movimentos({ produto_id: produtoId || undefined, limite: 1000 }), NE.dados.funcionarios().catch(() => [])]);
      const produto = nomes(ps); const quem = nomes(pessoas); const de = desde ?? doPeriodo(dias); const fim = ate ?? Infinity;
      const lista = mov.filter((m) => D.aMs(m.criado_em) >= de && D.aMs(m.criado_em) < fim).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      const b = bloco("movimentacao-de-estoque", "Movimentação de estoque", `${produtoId ? produto.get(produtoId) || "Produto" : "Todos os produtos"} · ${rotulo || rotuloDias(dias)}`, [["Quando"], ["Produto"], ["O que foi"], ["Qtd", 1], ["Motivo"], ["Quem"]],
        lista.map((m) => [NE.dataHora(m.criado_em), produto.get(m.produto_id) || "Produto", TIPO[m.tipo] || m.tipo, sinal(m.quantidade), m.motivo || "", quem.get(m.usuario_id) || ""]));
      return Vis.aplicar(b, Vis.movimentacao(lista.map((m) => ({ quando: D.aMs(m.criado_em), produto: produto.get(m.produto_id) || "Produto", tipo: m.tipo, quantidade: m.quantidade })), { de, ate: fim === Infinity ? Date.now() : fim }));
    },
    async estoque() {
      const ctx = await NE.dados.contexto(); const lista = ctx.saldos.filter((s) => s.ativo !== false).map((s) => ({ s, sit: D.situacaoEstoque(s, ctx.config, ctx.agora) })).sort((a, b) => ({ negativo: 0, baixo: 1, ok: 2 })[a.sit.estado] - ({ negativo: 0, baixo: 1, ok: 2 })[b.sit.estado] || a.s.nome.localeCompare(b.s.nome));
      const ROT = { ok: "OK", baixo: "Baixo", negativo: "Negativo" };
      const b = bloco("estoque", "Estoque agora", `${lista.length} produtos · ${NE.dataHora(ctx.agora)}`, [["Produto"], ["Saldo", 1], ["Mínimo", 1], ["Situação"], ["Última contagem"]],
        lista.map(({ s, sit }) => [s.nome, `${fmt(s.saldo)} ${s.unidade || ""}`.trim(), fmt(s.minimo), ROT[sit.estado] || sit.estado, s.ultima_contagem ? D.tempoRelativo(s.ultima_contagem, ctx.agora) : "nunca contado"]));
      return Vis.aplicar(b, Vis.estoque(lista.map(({ s, sit }) => ({ nome: s.nome, saldo: s.saldo, minimo: s.minimo, unidade: s.unidade, situacao: sit.estado }))));
    },
    async notas() {
      const [todas, cfg] = await Promise.all([NE.dados.notas({ status: ["pendente", "em_conferencia"] }), NE.dados.config().catch(() => ({}))]);
      const lista = todas.sort((a, b) => D.aMs(a.criado_em) - D.aMs(b.criado_em)); const agora = Date.now();
      const b = bloco("notas-na-fila", "Notas na fila", `Esperando conferência · ${NE.dataHora(agora)}`, [["Nota"], ["Cliente"], ["Vendedor"], ["Itens"], ["Espera"]],
        lista.map((n) => [n.numero, n.cliente || "", n.vendedor || "", resumoItens(n.itens), `há ${D.duracao((agora - D.aMs(n.criado_em)) / D.MIN)}`]));
      return Vis.aplicar(b, Vis.fila(lista.map((n) => ({ numero: n.numero, cliente: n.cliente, vendedor: n.vendedor, esperaMin: (agora - D.aMs(n.criado_em)) / D.MIN })), { limiteMin: D.comPadrao(cfg).limiteNotaParadaMin }));
    },
    async cargas({ dias = 7, lista: dada, subtitulo } = {}) {   // `lista`: quando a tela já tem as cargas (ex.: filtradas)
      const lista = (dada || (await NE.dados.conferencias({ de: doPeriodo(dias) }))).slice().sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      const dif = (c) => (c.itens || []).filter((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota)).map((i) => `${i.descricao} ${sinal(Number(i.qtd_carregada) - Number(i.qtd_nota))}`).join(" · ");
      const b = bloco("cargas-conferidas", "Cargas conferidas", subtitulo || rotuloDias(dias), [["Quando"], ["Nota"], ["Cliente"], ["Placa"], ["Conferiu"], ["Resultado"], ["Diferença"]],
        lista.map((c) => [NE.dataHora(c.criado_em), c.numero_nota, c.cliente || "", c.placa, (c.conferente || {}).nome || "", c.status === "ok" ? "Confere" : "Com diferença", dif(c)]));
      return Vis.aplicar(b, Vis.cargas(lista.map((c) => { const a = D.analisarItens(c.itens || []); return { quando: D.aMs(c.criado_em), bateu: c.status === "ok", conferente: (c.conferente || {}).nome || "—", aMais: a.aMais, aMenos: a.aMenos }; }), dada ? undefined : { de: doPeriodo(dias), ate: Date.now() }));
    },
    async contagens() {
      const [ps, lista] = await Promise.all([NE.dados.produtos(true), NE.dados.contagens()]); const produto = nomes(ps); const ROT = Vis.ROT_SIT_CONTAGEM;
      const dif = (c) => (c.itens || []).filter((i) => Number(i.diferenca) !== 0 && i.diferenca != null).map((i) => `${produto.get(i.produto_id) || "Produto"} ${sinal(i.diferenca)}`).join(" · ");
      const recentes = lista.slice(0, 30);
      const b = bloco("contagens", "Contagens de estoque", "As 30 mais recentes", [["Quando"], ["Pedido"], ["Situação"], ["Produtos"], ["Diferenças"]],
        recentes.map((c) => [NE.dataHora(c.criado_em), c.escopo || "Contagem", ROT[c.status] || c.status, (c.itens || []).map((i) => produto.get(i.produto_id) || "Produto").join(" · "), dif(c)]));
      return Vis.aplicar(b, Vis.contagens(recentes.map((c) => ({ situacao: c.status, diferencas: (c.itens || []).map((i) => ({ produto: produto.get(i.produto_id) || "Produto", diferenca: i.diferenca })) }))));
    },
    async historico({ dias = 7, lista: dada, subtitulo } = {}) {   // `lista`: quando a tela já tem as atividades (com os filtros dela)
      const lista = dada || (await NE.dados.atividades({ de: doPeriodo(dias), limite: 1000 }));
      const t = NE.historicoTabela ? NE.historicoTabela(lista) : null;   // a tela do histórico sabe escrever mercadoria, função e tipo
      const b = t ? bloco("historico-de-atividades", "Histórico de atividades", subtitulo || rotuloDias(dias), t.colunas, t.linhas)
        : bloco("historico-de-atividades", "Histórico de atividades", subtitulo || rotuloDias(dias), [["Quando"], ["Quem"], ["O que fez"], ["Nota"], ["Cliente"]], lista.map((a) => [NE.dataHora(a.criado_em), a.usuario_nome, a.resumo, a.nota_numero || "", a.cliente || ""]));
      return Vis.aplicar(b, Vis.atividades(lista.map((a) => ({ quando: D.aMs(a.criado_em), quem: a.usuario_nome, categoria: a.categoria, nota: a.nota_numero })), dada ? undefined : { de: doPeriodo(dias), ate: Date.now() }));
    },
  });
  // Assistente da DEMONSTRAÇÃO (cálculo local): o que ele ofereceu para imprimir, montado com os MESMOS dados da resposta.
  // No app de verdade o servidor faz o mesmo (supabase/functions/assistente/ferramentas-impressao.js) e manda blocos neste mesmo formato.
  R.doAssistente = async (dica, ctx) => {
    if (!dica) return null; const per = D.periodo(dica.chave || "hoje", ctx.agora); let b = null;
    if (dica.tipo === "estoque") b = await R.estoque();
    else if (dica.tipo === "fila") b = await R.notas();
    else if (dica.tipo === "movimentacao") b = await R.movimentacao({ de: per.de, ate: per.ate, rotulo: per.rotulo });
    else if (dica.tipo === "resumo") {
      const r = D.resumoDoPeriodo(ctx, dica.chave); const k = r.kpis; const linhas = [["Situação geral", `${r.semaforo.titulo}: ${r.semaforo.texto}`], ["Conferências", `${fmt(k.total)}${k.acertoPct == null ? "" : ` (${k.acertoPct}% corretas)`}`], ["Cargas com diferença", fmt(k.divergentes)], ["Peças a mais / a menos", `${fmt(k.aMais)} / ${fmt(k.aMenos)}`], ["Notas na fila", `${fmt(r.fila.total)}${r.fila.paradas ? ` (${r.fila.paradas} paradas)` : ""}`]];
      if (r.estoque.negativos.length) linhas.push(["Estoque negativo", r.estoque.negativos.map((s) => s.nome).join(" · ")]); if (r.estoque.baixos.length) linhas.push(["Estoque baixo", r.estoque.baixos.map((s) => s.nome).join(" · ")]);
      b = Vis.aplicar(bloco("resumo", "Resumo", per.rotulo, [["Assunto"], ["Situação"]], linhas), Vis.resumo(r));
    } else if (dica.tipo === "diferencas") {
      const mais = dica.sentido !== "menos"; const l = D.resumoDoPeriodo(ctx, dica.chave).produtos.filter((x) => (mais ? x.aMais : x.aMenos) > 0);
      b = Vis.aplicar(bloco("diferencas-por-produto", "Diferenças por produto", `Peças ${mais ? "a mais" : "a menos"} ${per.rotulo}`, [["Produto"], ["Cargas com diferença", 1], ["A mais", 1], ["A menos", 1]], l.map((x) => [x.nome, fmt(x.ocorrencias), fmt(x.aMais), fmt(x.aMenos)])), Vis.diferencas(l.map((x) => ({ nome: x.nome, ocorrencias: x.ocorrencias, aMais: x.aMais, aMenos: x.aMenos }))));
    } else if (dica.tipo === "contar") {
      const s = D.resumoDoPeriodo(ctx, "hoje").estoque.sugestao; b = Vis.aplicar(bloco("o-que-contar", "O que contar hoje", "Produtos que mais valem contar", [["Produto"], ["Por que contar"]], s.map((x) => [x.nome, (x.motivos || []).join(" · ")])), Vis.sugestao(s));
    } else if (dica.tipo === "equipe") {
      const l = D.resumoDoPeriodo(ctx, dica.chave).equipe; b = Vis.aplicar(bloco("desempenho-da-equipe", "Desempenho da equipe", `Conferências ${per.rotulo}`, [["Pessoa"], ["Conferências", 1], ["Com diferença", 1], ["Tempo médio (min)", 1]], l.map((x) => [x.nome, fmt(x.total), fmt(x.divergentes), x.duracaoMediaMin ? fmt(x.duracaoMediaMin) : ""])), Vis.equipe(l));
    }
    return b && b.linhas && b.linhas.length ? b : null;
  };
  // O que aparece na lista de relatórios (e o que cada um precisa)
  R.catalogo = () => [
    { id: "movimentacao", rotulo: "Movimentação de estoque", dica: "Entradas, saídas, perdas e ajustes, com quem lançou", periodo: [1, 7, 30, 90], produto: true },
    { id: "estoque", rotulo: "Estoque agora", dica: "Saldo, mínimo e situação de cada produto" },
    { id: "notas", rotulo: "Notas na fila", dica: "O que está esperando conferência" },
    { id: "cargas", rotulo: "Cargas conferidas", dica: "O que saiu, com e sem diferença", periodo: [1, 7, 30] },
    { id: "contagens", rotulo: "Contagens de estoque", dica: "Pedidas, com diferença e resolvidas" },
    ...(NE.pacote.tem("historico") ? [{ id: "historico", rotulo: "Histórico de atividades", dica: "Quem fez o quê, quando", periodo: [1, 7, 30] }] : []),
  ];

  // ───────────── a janela da planilha ─────────────
  const FORMATOS = [
    { id: "a4", rotulo: "A4 em pé", pagina: "A4 portrait", margem: "12mm", dica: "Folha comum, em cores" },
    { id: "a4h", rotulo: "A4 deitado", pagina: "A4 landscape", margem: "10mm", dica: "Folha comum, mais largura para as colunas, em cores" },
    { id: "c80", rotulo: "Cupom 80 mm", pagina: "80mm 297mm", margem: "3mm", dica: "Impressora de cupom (térmica), em preto e branco", cupom: true },
    { id: "c58", rotulo: "Cupom 58 mm", pagina: "58mm 297mm", margem: "2mm", dica: "Impressora de cupom pequena, em preto e branco", cupom: true },
  ];
  const CHAVE = "ne-relatorio-formato";
  const csvDe = (b) => D.csv(b.colunas.map((c) => c.rotulo), b.linhas);
  // O que vai para o papel: números-chave e gráficos parados (A4 em cor; cupom em preto e branco) e a tabela inteira
  function areaDoRelatorio(b, f) {
    const quem = NE.app && NE.app.perfil ? NE.app.perfil.nome : ""; const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const topo = el("header", {}, el("div", { class: "marca" }, "Nova Era · Confere Carga"), el("h1", {}, b.titulo), b.subtitulo ? el("p", {}, b.subtitulo) : null);
    const visual = G ? G.painel(b, { papel: true, cupom: !!f.cupom, cor: !f.cupom }) : null;
    const rodape = el("footer", {}, `Impresso${quem ? ` por ${quem}` : ""} em ${agora}`);
    const corpo = f.cupom
      ? el("div", {}, b.linhas.map((l) => el("div", { class: "reg" }, el("b", {}, l[0]), ...l.slice(1).map((v, i) => (v ? el("span", {}, `${b.colunas[i + 1].rotulo}: ${v}`) : null)))))
      : G ? G.tabela(b, { limite: Infinity, papel: true }) : el("table", {}, el("thead", {}, el("tr", {}, b.colunas.map((c) => el("th", { class: c.dir ? "dir" : "" }, c.rotulo)))), el("tbody", {}, b.linhas.map((l) => el("tr", {}, l.map((v, i) => el("td", { class: b.colunas[i].dir ? "dir" : "" }, v))))));
    return el("div", { id: "area-impressao" }, el("section", { class: `imp-rel${f.cupom ? " cupom" : ""}` }, topo, visual, b.linhas.length ? corpo : el("p", {}, "Nada para mostrar neste período."), rodape));
  }
  NE.abrirRelatorio = (b0) => {
    const b = Vis ? Vis.garantir(b0) : b0; const n = b.linhas.length;
    let fid = (NE.memoria.ler(CHAVE) || "a4"); if (!FORMATOS.some((x) => x.id === fid)) fid = "a4";
    const bImprimir = el("button", { type: "button", class: "btn btn-principal", id: "rel-imprimir" }, ic("impressora"), "Imprimir");
    const bPlanilha = el("button", { type: "button", class: "btn btn-azul", id: "rel-xlsx" }, ic("baixar"), "Baixar planilha");
    const bCsv = el("button", { type: "button", class: "link-acao", id: "rel-csv" }, ic("baixar"), "Baixar CSV simples");
    const bPdf = el("button", { type: "button", class: "link-acao", id: "rel-pdf" }, ic("olho"), "Ver em PDF");
    // o painel visual e a tabela são desenhados UMA vez (a animação não recomeça quando a pessoa troca o papel)
    const painel = G ? G.painel(b) : null;
    const tabela = n ? el("div", { class: "tabela-wrap", id: "rel-previa" }, G ? G.tabela(b, { limite: 40 }) : el("p", {}, "")) : el("div", { class: "vazio-grande" }, el("strong", {}, "Nada para mostrar"), "Não há dados neste período.");
    const papel = el("div", {}); const chips = el("div", { class: "chips rolagem", role: "radiogroup", "aria-label": "Papel" });
    const desenhar = () => {
      const f = FORMATOS.find((x) => x.id === fid);
      chips.replaceChildren(...FORMATOS.map((x) => el("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(x.id === fid), "aria-pressed": String(x.id === fid), "data-formato": x.id, onclick: () => { fid = x.id; NE.memoria.gravar(CHAVE, fid); desenhar(); } }, x.rotulo)));
      papel.replaceChildren(el("div", { class: "rotulo", style: "margin-top:14px" }, "Papel para imprimir"), chips, el("p", { class: "suave", style: "margin:6px 0 0" }, f.dica),
        el("div", { class: "imp-como" }, ic("ajuda"), el("span", {}, "Imprimir abre a impressão do aparelho e serve para qualquer impressora. Os gráficos vão junto no papel. Para guardar em PDF, escolha \"Salvar como PDF\" nela.")),
        el("div", { class: "imp-como" }, ic("grafico"), el("span", {}, "A planilha abre no Excel e no Google Planilhas, já organizada e com os gráficos. Quer ver como folha? Abra o PDF aqui mesmo no app. Prefere os dados puros? Baixe o CSV simples.")), el("div", { class: "acoes-linha", style: "margin-top:10px" }, bPdf, bCsv));
      bImprimir.disabled = bPlanilha.disabled = bCsv.disabled = bPdf.disabled = !n;
    };
    const caixa = el("div", { class: "rel-corpo" }, el("p", { class: "suave", style: "margin:0 0 10px" }, `${b.subtitulo || ""}${n ? ` · ${n} ${n === 1 ? "linha" : "linhas"}` : ""}`), painel,
      n ? el("h3", { class: "gf-titulo-tabela" }, "A planilha") : null, tabela, n > 40 ? el("p", { class: "suave" }, `Mostrando 40 de ${n}. A impressão e a planilha levam todas.`) : null, papel);
    bImprimir.addEventListener("click", () => { const f = FORMATOS.find((x) => x.id === fid); NE.imp.imprimirArea(areaDoRelatorio(b, f), f.pagina, f.margem); });
    bPlanilha.addEventListener("click", () => NE.comCarregando(bPlanilha, async () => { const nome = await NE.planilha.baixar(b); NE.aviso(`Planilha ${nome} baixada.`, "ok"); }));
    bPdf.addEventListener("click", () => NE.comCarregando(bPdf, async () => { await NE.pdfDaPlanilha(b); }));
    bCsv.addEventListener("click", () => NE.imp.baixar(new Blob([csvDe(b)], { type: "text/csv;charset=utf-8" }), `${b.arquivo || "relatorio"}-${NE.hojeISO()}.csv`));
    const j = NE.janelaSimples({ etiqueta: "Planilha", titulo: b.titulo, corpo: caixa, rodape: [bPlanilha, bImprimir] });
    new MutationObserver((_, o) => { if (!document.body.contains(j.fundo)) { NE.imp.quitar(); o.disconnect(); } }).observe(document.body, { childList: true });
    desenhar(); if (G) G.animar(caixa); return j;
  };
})();
