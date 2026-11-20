// Estoque: saldos em tempo real, entradas e perdas, contagens e a CONTAGEM RÁPIDA (às cegas, por pilhas, só o que importa).
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const fmt = D.fmt;
  let aba = "saldos", filtro = "todos";

  const ESTADO = { ok: ["OK", "ok"], baixo: ["Baixo", "alerta"], negativo: ["Negativo", "erro"] };

  NE.rotas.estoque = async (raiz, params, app) => {
    if (params.aba) aba = params.aba;
    raiz.replaceChildren(el("div", { class: "esqueleto", style: "height:60px" }), el("div", { class: "esqueleto", style: "height:200px" }));
    let ctx; try { ctx = await NE.dados.contexto(); } catch (e) { raiz.replaceChildren(); return NE.aviso(NE.mensagemErro(e), "erro", raiz); }
    const produtos = await NE.dados.produtos(true);
    const admin = app.admin; const caixa = el("div", {}); const barra = el("div", { class: "chips" });
    const rotulos = admin ? [["saldos", "Saldos"], ["contagens", `Contagens${ctx.contagens.filter((c) => c.status === "aguardando_aprovacao").length ? " •" : ""}`], ["movimentos", "Movimentos"]] : [["saldos", "Saldos"]];
    const desenharAbas = () => barra.replaceChildren(...rotulos.map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(aba === id), onclick: () => { aba = id; desenharAbas(); corpo(); } }, nome)));
    const contar = el("button", { type: "button", class: "btn btn-principal", id: "btn-contagem", onclick: () => app.ir("contar", {}) }, ic("raio"), "Contagem do dia");
    const entrada = admin && el("button", { type: "button", class: "btn btn-azul", id: "btn-lancar", onclick: () => lancar(produtos, app) }, ic("mais"), "Lançar");
    const exportar = admin && el("button", { type: "button", class: "link-acao", onclick: () => baixar(`estoque-${D.chaveDia(ctx.agora)}.csv`, D.csvEstoque(ctx.saldos, ctx.agora)) }, ic("baixar"), "Baixar planilha");
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Estoque"), el("p", {}, "Quanto tem de cada produto, agora.")), el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, contar, entrada)), barra, caixa);
    const corpo = () => ({ saldos: () => saldos(caixa, ctx, produtos, app, exportar), contagens: () => contagens(caixa, ctx, produtos, app), movimentos: () => movimentos(caixa, ctx, produtos) })[aba]();
    desenharAbas(); corpo();
  };

  function baixar(nome, texto) { const a = el("a", { href: URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })), download: nome }); document.body.append(a); a.click(); a.remove(); }
  const nomeDe = (produtos, id) => (produtos.find((p) => p.id === id) || {}).nome || "Produto";

  function saldos(caixa, ctx, produtos, app, exportar) {
    const busca = el("input", { class: "entrada", type: "search", id: "busca-estoque", placeholder: "Buscar produto", autocomplete: "off" });
    const chips = el("div", { class: "chips rolagem" }); const lista = el("div", {});
    const linhas = ctx.saldos.filter((s) => s.ativo !== false).map((s) => ({ s, sit: D.situacaoEstoque(s, ctx.config, ctx.agora), cob: D.coberturaDias(s.produto_id, ctx.movimentos, s.saldo, ctx.agora) }))
      .sort((a, b) => ({ negativo: 0, baixo: 1, ok: 2 })[a.sit.estado] - ({ negativo: 0, baixo: 1, ok: 2 })[b.sit.estado] || a.s.nome.localeCompare(b.s.nome));
    const desenhar = () => {
      const q = D.normalizar(busca.value);
      chips.replaceChildren(...[["todos", "Todos"], ["atencao", "Pedem atenção"], ["contar", "Sem contagem"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(filtro === id), onclick: () => { filtro = id; desenhar(); } }, nome)));
      const vis = linhas.filter((l) => (!q || D.normalizar(l.s.nome).includes(q)) && (filtro === "todos" || (filtro === "atencao" && l.sit.estado !== "ok") || (filtro === "contar" && l.sit.precisaContar)));
      lista.replaceChildren(...(vis.length ? vis.map((l) => linha(l, app, ctx, produtos)) : [el("div", { class: "vazio-grande" }, el("strong", {}, "Nada por aqui"), "Nenhum produto neste filtro.")]));
    };
    busca.addEventListener("input", desenhar);
    caixa.replaceChildren(el("div", { class: "busca-linha" }, busca), chips, lista, exportar ? el("div", { style: "margin-top:10px" }, exportar) : null); desenhar();
  }

  function linha({ s, sit, cob }, app, ctx, produtos) {
    const [rot, cls] = ESTADO[sit.estado]; const teto = Math.max(s.minimo * 2, s.saldo, 1);
    const b = el("button", { type: "button", class: `linha-cartao ${sit.estado === "negativo" ? "critico" : sit.estado === "baixo" ? "atencao" : ""}` },
      el("strong", {}, s.nome),
      el("span", { class: "meta" }, `mínimo ${fmt(s.minimo)} · ${s.ultima_contagem ? `contado ${D.tempoRelativo(s.ultima_contagem, ctx.agora)}` : "nunca contado"}${cob ? ` · dura ~${fmt(cob)} dias` : ""}`),
      el("span", { class: "lado" }, `${fmt(s.saldo)}`, el("small", {}, el("span", { class: `etiqueta ${cls === "erro" ? "erro" : cls}` }, rot))),
      el("div", { class: `nivel ${sit.estado === "ok" ? "" : sit.estado}` }, el("i", { style: `width:${Math.max(0, Math.min(100, (s.saldo / teto) * 100))}%` })));
    if (app.admin) b.addEventListener("click", () => detalhe(s, produtos, app, ctx));
    return b;
  }

  async function detalhe(s, produtos, app) {
    const movs = await NE.dados.movimentos({ produto_id: s.produto_id, limite: 12 }); let j;
    const tab = el("div", { class: "tabela-wrap resumo" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Quando"), el("th", {}, "O quê"), el("th", { class: "num" }, "Qtd"))),
      el("tbody", {}, movs.map((m) => el("tr", {}, el("td", {}, NE.dataHora(m.criado_em)), el("td", {}, m.motivo || m.tipo), el("td", { class: "num" }, m.quantidade > 0 ? `+${fmt(m.quantidade)}` : fmt(m.quantidade)))))));
    j = NE.janelaSimples({ etiqueta: "Estoque", titulo: s.nome, corpo: el("div", {}, el("div", { class: "resumo" }, NE.linhaResumo("Saldo no sistema", `${fmt(s.saldo)} ${s.unidade}`), NE.linhaResumo("Mínimo", fmt(s.minimo)), NE.linhaResumo("Última contagem", s.ultima_contagem ? NE.dataHora(s.ultima_contagem) : "nunca")), el("h3", {}, "Últimos movimentos"), movs.length ? tab : el("p", { class: "vazio" }, "Sem movimentos.")),
      rodape: [el("button", { type: "button", class: "btn btn-azul", onclick: () => { j.fechar(); lancar(produtos, app, s.produto_id); } }, ic("mais"), "Lançar"), el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { await NE.dados.pedirContagem([s.produto_id]); j.fechar(); NE.aviso("A equipe foi avisada para contar este produto.", "ok"); } }, ic("raio"), "Pedir para contar")] });
  }

  const lancar = (produtos, app, produtoId) => app.ir("guia", { fluxo: "mov", produto_id: produtoId || "" });

  function contagens(caixa, ctx, produtos, app) {
    const lista = ctx.contagens.filter((c) => c.status !== "descartada");
    caixa.replaceChildren(el("div", { style: "margin-bottom:12px" }, el("button", { type: "button", class: "btn btn-secundario", onclick: () => pedir(produtos, app) }, ic("raio"), "Pedir contagem à equipe")),
      ...(lista.length ? lista.map((c) => {
        const pend = c.status === "aguardando_aprovacao"; const dif = (c.itens || []).filter((i) => Number(i.diferenca) !== 0);
        const rot = { aguardando_aprovacao: ["Aguardando você", "alerta"], aplicada: ["Aplicada", "ok"], solicitada: ["Pedida", "azul"] }[c.status] || [c.status, ""];
        return el("div", { class: `alerta-item ${pend ? "atencao" : ""}` }, el("strong", {}, `${c.escopo || "Contagem"} · ${NE.dataHora(c.criado_em)}`, " ", el("span", { class: `etiqueta ${rot[1]}` }, rot[0])),
          el("p", {}, c.status === "solicitada" ? `Pedido para contar: ${D.lista((c.itens || []).map((i) => nomeDe(produtos, i.produto_id)), 4)}.` : dif.length ? dif.map((i) => `${nomeDe(produtos, i.produto_id)}: contado ${fmt(i.contado)} (sistema ${fmt(i.esperado)}, ${i.diferenca > 0 ? "+" : "−"}${fmt(Math.abs(i.diferenca))})`).join(" · ") : `${D.plural((c.itens || []).length, "produto contado", "produtos contados")}, tudo bateu.`),
          pend && el("button", { type: "button", class: "btn btn-principal", style: "margin-top:8px", id: "btn-decidir", onclick: () => app.ir("guia", { fluxo: "resolver", id: c.id }) }, ic("check"), "Resolver esta contagem"));
      }) : [el("div", { class: "vazio-grande" }, el("strong", {}, "Sem contagens ainda"), "Faça a Contagem do dia: leva uns 3 minutos.")]));
  }

  const pedir = (produtos, app) => app.ir("guia", { fluxo: "contagem" });

  function movimentos(caixa, ctx, produtos) {
    const ms = [...ctx.movimentos].sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)).slice(0, 80);
    caixa.replaceChildren(el("div", { class: "tabela-wrap resumo" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Quando"), el("th", {}, "Produto"), el("th", {}, "O quê"), el("th", { class: "num" }, "Qtd"))),
      el("tbody", {}, ms.map((m) => el("tr", {}, el("td", {}, NE.dataHora(m.criado_em)), el("td", {}, nomeDe(produtos, m.produto_id)), el("td", {}, m.motivo || m.tipo), el("td", { class: "num" }, m.quantidade > 0 ? `+${fmt(m.quantidade)}` : fmt(m.quantidade))))))));
  }

  // ───────────────────────── CONTAGEM RÁPIDA ─────────────────────────
  // Às cegas (não mostra o saldo do sistema, para ninguém "chutar" o número), por pilhas, só os produtos que mais valem.
  NE.rotas.contar = async (raiz, params, app) => {
    const [ctx, produtos] = await Promise.all([NE.dados.contexto(), NE.dados.produtos()]);
    const pedidos = ctx.contagens.filter((c) => c.status === "solicitada");
    let pedido = params.solicitacao_id ? pedidos.find((c) => c.id === params.solicitacao_id) : pedidos[0];
    const sugestao = D.sugerirContagem({ saldos: ctx.saldos, movimentos: ctx.movimentos, conferencias: ctx.conferencias, config: ctx.config, agora: ctx.agora }, 5);
    let ids = pedido ? pedido.itens.map((i) => i.produto_id) : sugestao.map((s) => s.produto_id);
    if (!ids.length) ids = produtos.slice(0, 5).map((p) => p.id);
    const motivos = Object.fromEntries(sugestao.map((s) => [s.produto_id, s.motivos]));
    if (!produtos.length) return NE.telaFim(raiz, { tipo: "alerta", titulo: "Ainda não tem produtos", texto: "Cadastre os produtos primeiro. Depois a contagem do estoque funciona.", botoes: [{ rotulo: "Cadastrar um produto", icone: "mais", acao: () => app.ir("guia", { fluxo: "novoProduto" }) }, { rotulo: "Voltar", acao: () => app.ir("estoque", {}, { substituir: true }) }] });
    let fase = "escolher", pos = 0; const val = {};
    const estado = { selecao: new Set(ids) };
    const sair = () => app.ir(app.admin ? "estoque" : "estoque", {}, { substituir: true });
    const ordem = () => produtos.filter((p) => estado.selecao.has(p.id));

    const telaEscolha = () => {
      const lista = produtos.map((p) => el("button", { type: "button", class: "escolha", "aria-pressed": String(estado.selecao.has(p.id)), onclick: () => { estado.selecao.has(p.id) ? estado.selecao.delete(p.id) : estado.selecao.add(p.id); desenhar(); } },
        el("strong", {}, p.nome), el("span", {}, (motivos[p.id] || [])[0] || "Toque para incluir")));
      return [el("div", { class: "tela-titulo" }, el("div", { class: "icone-grande", html: NE.icone.raio }), el("div", {}, el("h1", {}, pedido ? "Contagem pedida" : "Contagem do dia"), el("p", {}, pedido ? "A expedição pediu para contar estes produtos." : "Escolhemos o que mais vale contar hoje. Leva uns 3 minutos."))),
        el("div", { class: "grade-escolha" }, lista)];
    };
    const telaProduto = () => {
      const p = ordem()[pos]; const v = val[p.id] || (val[p.id] = { pilhas: 0, soltas: 0, total: null });
      const total = p.por_pilha ? D.totalPilhas({ pilhas: v.pilhas, porPilha: p.por_pilha, soltas: v.soltas }) : (v.total ?? 0);
      const mostrar = el("div", { class: "total-grande", id: "total-contado" }, fmt(total), el("small", {}, `${p.unidade === "un" ? "unidades" : p.unidade} contadas`));
      const atualizar = () => { const t = p.por_pilha ? D.totalPilhas({ pilhas: v.pilhas, porPilha: p.por_pilha, soltas: v.soltas }) : (v.total ?? 0); mostrar.firstChild.textContent = fmt(t); };
      const ajuda = el("p", { class: "suave", style: "margin:0" }, (motivos[p.id] || []).length ? `Por que contar: ${D.lista(motivos[p.id], 2)}.` : "Conte o que está fisicamente no pátio.");
      const campos = p.por_pilha
        ? el("div", { class: "par-contador" }, el("div", {}, el("div", { class: "rotulo" }, `Pilhas de ${p.por_pilha}`), NE.contador(v.pilhas, (n) => { v.pilhas = n; atualizar(); }, "ct-pilhas")), el("div", {}, el("div", { class: "rotulo" }, "Peças soltas"), NE.contador(v.soltas, (n) => { v.soltas = n; atualizar(); }, "ct-soltas")))
        : el("div", {}, el("div", { class: "rotulo" }, "Quantidade contada"), NE.contador(v.total ?? 0, (n) => { v.total = n; atualizar(); }, "ct-total"));
      return [el("div", { class: "contar-card" }, el("div", {}, el("span", { class: "etiqueta azul" }, `Produto ${pos + 1} de ${ordem().length}`)), el("h2", {}, p.nome), ajuda, campos, mostrar)];
    };
    const telaRevisar = () => [el("div", { class: "tela-titulo" }, el("div", { class: "icone-grande", html: NE.icone.check }), el("div", {}, el("h1", {}, "Revisar contagem"), el("p", {}, "Confira os números. Depois de enviar, o sistema compara com o estoque."))),
      el("div", { class: "resumo" }, ordem().map((p) => { const v = val[p.id]; const t = v ? (p.por_pilha ? D.totalPilhas({ pilhas: v.pilhas, porPilha: p.por_pilha, soltas: v.soltas }) : (v.total ?? 0)) : 0; return NE.linhaResumo(p.nome, `${fmt(t)} ${p.unidade}`); }))];

    const desenhar = () => {
      const lista = ordem(); const total = lista.length + 2; const passo = fase === "escolher" ? 0 : fase === "contar" ? pos + 1 : lista.length + 1;
      const aviso = el("div", { id: "aviso-passo" });
      const conteudo = fase === "escolher" ? telaEscolha() : fase === "contar" ? telaProduto() : telaRevisar();
      const seguir = el("button", { class: "btn btn-principal", type: "button", id: "btn-seguir" }, fase === "revisar" ? "Enviar contagem" : "Continuar", ic(fase === "revisar" ? "check" : "seguir"));
      seguir.addEventListener("click", () => {
        if (fase === "escolher") { if (!estado.selecao.size) return NE.aviso("Escolha pelo menos um produto.", "erro", aviso); fase = "contar"; pos = 0; return desenhar(); }
        if (fase === "contar") { if (pos < lista.length - 1) pos++; else fase = "revisar"; return desenhar(); }
        NE.comCarregando(seguir, async () => {
          const itens = lista.map((p) => { const v = val[p.id] || { pilhas: 0, soltas: 0, total: 0 }; return { produto_id: p.id, contado: p.por_pilha ? D.totalPilhas({ pilhas: v.pilhas, porPilha: p.por_pilha, soltas: v.soltas }) : (v.total ?? 0) }; });
          const r = await NE.dados.concluirContagem({ itens, solicitacao_id: pedido?.id, escopo: pedido ? "Pedido da expedição" : "Contagem do dia" }); fim(r);
        });
      });
      const voltar = el("button", { class: "btn btn-secundario", type: "button", id: "btn-voltar", "aria-label": "Voltar" }, ic(fase === "escolher" ? "fechar" : "voltar"));
      voltar.addEventListener("click", () => { if (fase === "escolher") return sair(); if (fase === "revisar") { fase = "contar"; pos = lista.length - 1; } else if (pos > 0) pos--; else fase = "escolher"; desenhar(); });
      raiz.replaceChildren(el("section", { class: "tela" }, el("div", { class: "progresso-fino" }, el("i", { style: `width:${(passo / (total - 1)) * 100}%` })), aviso, ...conteudo), el("div", { class: "acoes" }, el("div", { class: "acoes-dentro" }, voltar, seguir)));
      window.scrollTo({ top: 0 });
    };
    const fim = (r) => {
      const dif = r.itens.filter((i) => i.diferenca !== 0); const nome = (id) => nomeDe(produtos, id);
      const extra = dif.length ? el("div", { class: "resumo", style: "text-align:left" }, dif.map((i) => NE.linhaResumo(nome(i.produto_id), `contou ${fmt(i.contado)} · sistema ${fmt(i.esperado)} (${i.diferenca > 0 ? "+" : "−"}${fmt(Math.abs(i.diferenca))})`))) : null;
      const botoes = [];
      if (dif.length && app.admin) botoes.push({ rotulo: "Aprovar ajuste agora", icone: "check", acao: async () => { await NE.dados.aplicarAjuste(r.id); NE.aviso("Estoque ajustado.", "ok"); app.ir("estoque", {}, { substituir: true }); } });
      botoes.push({ rotulo: "Ver estoque", acao: () => app.ir("estoque", {}, { substituir: true }) });
      NE.telaFim(raiz, { tipo: dif.length ? "alerta" : "ok", titulo: dif.length ? "Contagem enviada com diferença" : "Tudo bateu!", texto: dif.length ? (app.admin ? "Aprove o ajuste para corrigir o estoque, ou deixe para decidir depois." : "A expedição foi avisada e vai decidir o ajuste.") : "A contagem confere com o sistema. Estoque certo.", extra, botoes });
    };
    desenhar();
  };
})();
