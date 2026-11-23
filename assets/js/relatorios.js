// RELATÓRIOS PARA IMPRIMIR: movimentação de estoque, estoque agora, notas na fila, cargas, contagens e histórico.
// Todos viram um "bloco" { titulo, subtitulo, colunas:[{rotulo, dir}], linhas:[[…]], resumo:[[rótulo, valor]] } e passam pela mesma janela de impressão.
// O assistente (ia.js) manda o mesmo formato: o que ele mostrou na conversa é o que imprime.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const fmt = D.fmt;
  const TIPO = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste" };
  const sinal = (q) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q))}`;
  const doPeriodo = (dias) => Date.now() - dias * D.DIA;
  const rotuloDias = (dias) => (dias === 1 ? "hoje e ontem" : `últimos ${dias} dias`);
  const nomes = (lista) => new Map(lista.map((p) => [p.id, p.nome]));
  const resumoItens = (itens) => (itens || []).map((i) => `${fmt(i.quantidade ?? i.qtd_nota)} ${i.descricao}`).join(" · ");

  const R = (NE.relatorios = {
    async movimentacao({ produtoId, dias = 30, de: desde, ate, rotulo } = {}) {   // período: "dias" para trás, ou de/ate exatos (o assistente usa "hoje", "ontem"...)
      const [ps, mov, pessoas] = await Promise.all([NE.dados.produtos(true), NE.dados.movimentos({ produto_id: produtoId || undefined, limite: 1000 }), NE.dados.funcionarios().catch(() => [])]);
      const produto = nomes(ps); const quem = nomes(pessoas); const de = desde ?? doPeriodo(dias); const fim = ate ?? Infinity;
      const lista = mov.filter((m) => D.aMs(m.criado_em) >= de && D.aMs(m.criado_em) < fim).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      const soma = (t) => lista.filter((m) => m.tipo === t).reduce((n, m) => n + Math.abs(m.quantidade), 0);
      return { titulo: "Movimentação de estoque", subtitulo: `${produtoId ? produto.get(produtoId) || "Produto" : "Todos os produtos"} · ${rotulo || rotuloDias(dias)}`,
        colunas: [{ rotulo: "Quando" }, { rotulo: "Produto" }, { rotulo: "O que foi" }, { rotulo: "Qtd", dir: true }, { rotulo: "Motivo" }, { rotulo: "Quem" }],
        linhas: lista.map((m) => [NE.dataHora(m.criado_em), produto.get(m.produto_id) || "Produto", TIPO[m.tipo] || m.tipo, sinal(m.quantidade), m.motivo || "", quem.get(m.usuario_id) || ""]),
        resumo: [["Lançamentos", String(lista.length)], ["Entradas", fmt(soma("entrada"))], ["Saídas", fmt(soma("saida"))], ["Perdas", fmt(soma("perda"))]], arquivo: "movimentacao-de-estoque" };
    },
    async estoque() {
      const ctx = await NE.dados.contexto(); const lista = ctx.saldos.filter((s) => s.ativo !== false).map((s) => ({ s, sit: D.situacaoEstoque(s, ctx.config, ctx.agora) })).sort((a, b) => ({ negativo: 0, baixo: 1, ok: 2 })[a.sit.estado] - ({ negativo: 0, baixo: 1, ok: 2 })[b.sit.estado] || a.s.nome.localeCompare(b.s.nome));
      const ROT = { ok: "OK", baixo: "Baixo", negativo: "Negativo" };
      return { titulo: "Estoque agora", subtitulo: `${lista.length} produtos · ${NE.dataHora(ctx.agora)}`, colunas: [{ rotulo: "Produto" }, { rotulo: "Saldo", dir: true }, { rotulo: "Mínimo", dir: true }, { rotulo: "Situação" }, { rotulo: "Última contagem" }],
        linhas: lista.map(({ s, sit }) => [s.nome, `${fmt(s.saldo)} ${s.unidade || ""}`.trim(), fmt(s.minimo), ROT[sit.estado] || sit.estado, s.ultima_contagem ? D.tempoRelativo(s.ultima_contagem, ctx.agora) : "nunca contado"]),
        resumo: [["Produtos", String(lista.length)], ["Abaixo do mínimo", String(lista.filter((x) => x.sit.estado === "baixo").length)], ["Negativos", String(lista.filter((x) => x.sit.estado === "negativo").length)]], arquivo: "estoque" };
    },
    async notas() {
      const lista = (await NE.dados.notas({ status: ["pendente", "em_conferencia"] })).sort((a, b) => D.aMs(a.criado_em) - D.aMs(b.criado_em)); const agora = Date.now();
      return { titulo: "Notas na fila", subtitulo: `Esperando conferência · ${NE.dataHora(agora)}`, colunas: [{ rotulo: "Nota" }, { rotulo: "Cliente" }, { rotulo: "Vendedor" }, { rotulo: "Itens" }, { rotulo: "Espera" }],
        linhas: lista.map((n) => [n.numero, n.cliente || "", n.vendedor || "", resumoItens(n.itens), `há ${D.duracao((agora - D.aMs(n.criado_em)) / D.MIN)}`]), resumo: [["Notas na fila", String(lista.length)]], arquivo: "notas-na-fila" };
    },
    async cargas({ dias = 7 } = {}) {
      const lista = (await NE.dados.conferencias({ de: doPeriodo(dias) })).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      const dif = (c) => (c.itens || []).filter((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota)).map((i) => `${i.descricao} ${sinal(Number(i.qtd_carregada) - Number(i.qtd_nota))}`).join(" · ");
      return { titulo: "Cargas conferidas", subtitulo: rotuloDias(dias), colunas: [{ rotulo: "Quando" }, { rotulo: "Nota" }, { rotulo: "Cliente" }, { rotulo: "Placa" }, { rotulo: "Conferiu" }, { rotulo: "Resultado" }, { rotulo: "Diferença" }],
        linhas: lista.map((c) => [NE.dataHora(c.criado_em), c.numero_nota, c.cliente || "", c.placa, (c.conferente || {}).nome || "", c.status === "ok" ? "Confere" : "Com diferença", dif(c)]),
        resumo: [["Cargas", String(lista.length)], ["Com diferença", String(lista.filter((c) => c.status !== "ok").length)]], arquivo: "cargas-conferidas" };
    },
    async contagens() {
      const [ps, lista] = await Promise.all([NE.dados.produtos(true), NE.dados.contagens()]); const produto = nomes(ps); const ROT = { solicitada: "Pedida", aguardando_aprovacao: "Aguardando decisão", aplicada: "Aplicada", descartada: "Descartada" };
      const dif = (c) => (c.itens || []).filter((i) => Number(i.diferenca) !== 0 && i.diferenca != null).map((i) => `${produto.get(i.produto_id) || "Produto"} ${sinal(i.diferenca)}`).join(" · ");
      return { titulo: "Contagens de estoque", subtitulo: "As 30 mais recentes", colunas: [{ rotulo: "Quando" }, { rotulo: "Pedido" }, { rotulo: "Situação" }, { rotulo: "Produtos" }, { rotulo: "Diferenças" }],
        linhas: lista.slice(0, 30).map((c) => [NE.dataHora(c.criado_em), c.escopo || "Contagem", ROT[c.status] || c.status, (c.itens || []).map((i) => produto.get(i.produto_id) || "Produto").join(" · "), dif(c)]), arquivo: "contagens" };
    },
    async historico({ dias = 7 } = {}) {
      const lista = await NE.dados.atividades({ de: doPeriodo(dias), limite: 1000 });
      return { titulo: "Histórico de atividades", subtitulo: rotuloDias(dias), colunas: [{ rotulo: "Quando" }, { rotulo: "Quem" }, { rotulo: "O que fez" }, { rotulo: "Nota" }, { rotulo: "Cliente" }],
        linhas: lista.map((a) => [NE.dataHora(a.criado_em), a.usuario_nome, a.resumo, a.nota_numero || "", a.cliente || ""]), resumo: [["Atividades", String(lista.length)]], arquivo: "historico-de-atividades" };
    },
  });
  // Assistente da DEMONSTRAÇÃO (cálculo local): o que ele ofereceu para imprimir, montado com os MESMOS dados da resposta.
  // No app de verdade o servidor faz o mesmo (supabase/functions/assistente/ferramentas-impressao.js) e manda blocos neste mesmo formato.
  R.doAssistente = async (dica, ctx) => {
    if (!dica) return null; const per = D.periodo(dica.chave || "hoje", ctx.agora); const bloco = (id, titulo, subtitulo, colunas, linhas, resumo = []) => ({ id, titulo, subtitulo, colunas: colunas.map(([rotulo, dir]) => ({ rotulo, ...(dir ? { dir: true } : {}) })), linhas, resumo, arquivo: id });
    let b = null;
    if (dica.tipo === "estoque") b = await R.estoque();
    else if (dica.tipo === "fila") b = await R.notas();
    else if (dica.tipo === "movimentacao") b = await R.movimentacao({ de: per.de, ate: per.ate, rotulo: per.rotulo });
    else if (dica.tipo === "resumo") {
      const r = D.resumoDoPeriodo(ctx, dica.chave); const k = r.kpis; const linhas = [["Situação geral", `${r.semaforo.titulo}: ${r.semaforo.texto}`], ["Conferências", `${fmt(k.total)}${k.acertoPct == null ? "" : ` (${k.acertoPct}% corretas)`}`], ["Cargas com diferença", fmt(k.divergentes)], ["Peças a mais / a menos", `${fmt(k.aMais)} / ${fmt(k.aMenos)}`], ["Notas na fila", `${fmt(r.fila.total)}${r.fila.paradas ? ` (${r.fila.paradas} paradas)` : ""}`]];
      if (r.estoque.negativos.length) linhas.push(["Estoque negativo", r.estoque.negativos.map((s) => s.nome).join(" · ")]); if (r.estoque.baixos.length) linhas.push(["Estoque baixo", r.estoque.baixos.map((s) => s.nome).join(" · ")]);
      b = bloco("resumo", "Resumo", per.rotulo, [["Assunto"], ["Situação"]], linhas);
    } else if (dica.tipo === "diferencas") {
      const mais = dica.sentido !== "menos"; const l = D.resumoDoPeriodo(ctx, dica.chave).produtos.filter((x) => (mais ? x.aMais : x.aMenos) > 0);
      b = bloco("diferencas-por-produto", "Diferenças por produto", `Peças ${mais ? "a mais" : "a menos"} ${per.rotulo}`, [["Produto"], ["Cargas com diferença", 1], ["A mais", 1], ["A menos", 1]], l.map((x) => [x.nome, fmt(x.ocorrencias), fmt(x.aMais), fmt(x.aMenos)]));
    } else if (dica.tipo === "contar") {
      b = bloco("o-que-contar", "O que contar hoje", "Produtos que mais valem contar", [["Produto"], ["Por que contar"]], D.resumoDoPeriodo(ctx, "hoje").estoque.sugestao.map((x) => [x.nome, (x.motivos || []).join(" · ")]));
    } else if (dica.tipo === "equipe") {
      const l = D.resumoDoPeriodo(ctx, dica.chave).equipe; b = bloco("desempenho-da-equipe", "Desempenho da equipe", `Conferências ${per.rotulo}`, [["Pessoa"], ["Conferências", 1], ["Com diferença", 1], ["Tempo médio (min)", 1]], l.map((x) => [x.nome, fmt(x.total), fmt(x.divergentes), x.duracaoMediaMin ? fmt(x.duracaoMediaMin) : ""]));
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

  // ───────────── a janela do relatório ─────────────
  const FORMATOS = [
    { id: "a4", rotulo: "A4 em pé", pagina: "A4 portrait", margem: "12mm", dica: "Folha comum" },
    { id: "a4h", rotulo: "A4 deitado", pagina: "A4 landscape", margem: "10mm", dica: "Folha comum, mais largura para as colunas" },
    { id: "c80", rotulo: "Cupom 80 mm", pagina: "80mm 297mm", margem: "3mm", dica: "Impressora de cupom (térmica)", cupom: true },
    { id: "c58", rotulo: "Cupom 58 mm", pagina: "58mm 297mm", margem: "2mm", dica: "Impressora de cupom pequena", cupom: true },
  ];
  const CHAVE = "ne-relatorio-formato";
  function areaDoRelatorio(b, f) {
    const quem = NE.app && NE.app.perfil ? NE.app.perfil.nome : ""; const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const topo = el("header", {}, el("div", { class: "marca" }, "Nova Era · Confere Carga"), el("h1", {}, b.titulo), b.subtitulo ? el("p", {}, b.subtitulo) : null);
    const resumo = (b.resumo || []).length ? el("div", { class: "resumo-imp" }, b.resumo.map(([k, v]) => el("div", {}, el("b", {}, v), k))) : null;
    const rodape = el("footer", {}, `Impresso${quem ? ` por ${quem}` : ""} em ${agora}`);
    const corpo = f.cupom
      ? el("div", {}, b.linhas.map((l) => el("div", { class: "reg" }, el("b", {}, l[0]), ...l.slice(1).map((v, i) => (v ? el("span", {}, `${b.colunas[i + 1].rotulo}: ${v}`) : null)))))
      : el("table", {}, el("thead", {}, el("tr", {}, b.colunas.map((c) => el("th", { class: c.dir ? "dir" : "" }, c.rotulo)))), el("tbody", {}, b.linhas.map((l) => el("tr", {}, l.map((v, i) => el("td", { class: b.colunas[i].dir ? "dir" : "" }, v))))));
    return el("div", { id: "area-impressao" }, el("section", { class: `imp-rel${f.cupom ? " cupom" : ""}` }, topo, resumo, b.linhas.length ? corpo : el("p", {}, "Nada para mostrar neste período."), rodape));
  }
  NE.abrirRelatorio = (b) => {
    let fid = (NE.memoria.ler(CHAVE) || "a4"); if (!FORMATOS.some((x) => x.id === fid)) fid = "a4";
    const caixa = el("div", {}); const chips = el("div", { class: "chips rolagem", role: "radiogroup", "aria-label": "Papel" });
    const bImprimir = el("button", { type: "button", class: "btn btn-principal", id: "rel-imprimir" }, ic("impressora"), "Imprimir");
    const bCsv = el("button", { type: "button", class: "btn btn-azul", id: "rel-csv" }, ic("baixar"), "Baixar planilha");
    const desenhar = () => {
      const f = FORMATOS.find((x) => x.id === fid);
      chips.replaceChildren(...FORMATOS.map((x) => el("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(x.id === fid), "aria-pressed": String(x.id === fid), "data-formato": x.id, onclick: () => { fid = x.id; NE.memoria.gravar(CHAVE, fid); desenhar(); } }, x.rotulo)));
      const mostra = b.linhas.slice(0, 40);
      caixa.replaceChildren(
        el("p", { class: "suave", style: "margin:0 0 8px" }, `${b.subtitulo || ""}${b.linhas.length ? ` · ${b.linhas.length} ${b.linhas.length === 1 ? "linha" : "linhas"}` : ""}`),
        (b.resumo || []).length ? el("div", { class: "resumo" }, b.resumo.map(([k, v]) => NE.linhaResumo(k, v))) : null,
        b.linhas.length ? el("div", { class: "tabela-wrap", id: "rel-previa" }, el("table", { class: "imp-tabela" }, el("thead", {}, el("tr", {}, b.colunas.map((c) => el("th", { class: c.dir ? "dir" : "" }, c.rotulo)))), el("tbody", {}, mostra.map((l) => el("tr", {}, l.map((v, i) => el("td", { class: b.colunas[i].dir ? "dir" : "" }, v))))))) : el("div", { class: "vazio-grande" }, el("strong", {}, "Nada para mostrar"), "Não há dados neste período."),
        b.linhas.length > 40 ? el("p", { class: "suave" }, `Mostrando 40 de ${b.linhas.length}. A impressão leva todas.`) : null,
        el("div", { class: "rotulo", style: "margin-top:14px" }, "Papel"), chips, el("p", { class: "suave", style: "margin:6px 0 0" }, f.dica),
        el("div", { class: "imp-como" }, ic("ajuda"), el("span", {}, "Imprimir abre a impressão do aparelho e serve para qualquer impressora. Para guardar em PDF, escolha \"Salvar como PDF\" nela.")));
      bImprimir.disabled = bCsv.disabled = !b.linhas.length;
    };
    bImprimir.addEventListener("click", () => { const f = FORMATOS.find((x) => x.id === fid); NE.imp.imprimirArea(areaDoRelatorio(b, f), f.pagina, f.margem); });
    bCsv.addEventListener("click", () => { const csv = D.csv(b.colunas.map((c) => c.rotulo), b.linhas); NE.imp.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${b.arquivo || "relatorio"}-${NE.hojeISO()}.csv`); });
    const j = NE.janelaSimples({ etiqueta: "Relatório", titulo: b.titulo, corpo: caixa, rodape: [bCsv, bImprimir] });
    new MutationObserver((_, o) => { if (!document.body.contains(j.fundo)) { NE.imp.quitar(); o.disconnect(); } }).observe(document.body, { childList: true });
    desenhar(); return j;
  };
})();
