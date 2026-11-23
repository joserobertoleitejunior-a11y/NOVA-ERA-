// FERRAMENTAS DE LEITURA do assistente: só consultam (com o login de quem perguntou) e devolvem dados para a IA responder.
// Nada aqui altera o banco. As de "navegação" só mandam o app abrir uma tela.
(function (raiz) {
  "use strict";
  const F = raiz.NEFerramentas;
  const { registrar, achar, dom } = F; const U = F.util;
  const D = () => raiz.NEDominio;
  const PERIODOS = ["hoje", "ontem", "7d", "30d"];
  const str = (descricao, extra = {}) => ({ type: "string", description: descricao, ...extra });
  const esq = (properties = {}, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
  const ler = (nome, descricao, schema, fn, tipo = "ler") => registrar({ nome, tipo, descricao, schema, ler: fn });
  const periodoProp = { type: "string", enum: PERIODOS, description: "hoje, ontem, 7d (7 dias) ou 30d (30 dias)" };
  const lim = (v, padrao, max) => Math.min(Math.max(Number(v) || padrao, 1), max);
  const situacao = (v) => (["ativos", "inativos", "todos"].includes(v) ? v : "ativos");
  const passa = (ativo, s) => (s === "todos" ? true : s === "inativos" ? ativo === false : ativo !== false);

  // ───────────────────────── panorama (mesmas contas do painel) ─────────────────────────
  ler("resumo", "Resumo do período: conferências, % corretas, peças a mais/menos, fila de notas, estoque, recados do painel.", esq({ periodo: periodoProp }, ["periodo"]), async (ctx, e) => {
    const c = await ctx.dominio(); const r = D().resumoDoPeriodo(c, e.periodo || "hoje");
    return { periodo: r.periodo.rotulo, semaforo: r.semaforo, kpis: r.kpis, fila: r.fila,
      estoque: { negativos: r.estoque.negativos.map((s) => `${s.nome} (${s.saldo})`), baixos: r.estoque.baixos.map((s) => `${s.nome} (${s.saldo}/${s.minimo})`) },
      recados: r.insights.slice(0, 8).map((i) => `${i.titulo} — ${i.texto}`) };
  });
  ler("diferencas", "Produtos com diferença entre a nota e a carga no período (a mais = saiu sem nota; a menos = faltou).", esq({ periodo: periodoProp }, ["periodo"]), async (ctx, e) => {
    const c = await ctx.dominio(); const per = D().periodo(e.periodo || "hoje", c.agora); return D().rankingProdutos(c.conferencias, per.de, per.ate).slice(0, 15);
  });
  ler("estoque", "Saldos de estoque, mínimo, situação e cobertura em dias. Opcional: filtrar por nome de produto.", esq({ produto: str("Parte do nome do produto") }), async (ctx, e) => {
    const c = await ctx.dominio(); const f = D().normalizar(e.produto ?? ""); const disp = D().disponivelPorProduto(c.saldos, c.notas);
    const lista = c.saldos.filter((s) => s.ativo !== false && (!f || D().normalizar(s.nome).includes(f)));
    const dd = (s) => disp.get(s.produto_id) || { saldo: Number(s.saldo), reservado: 0, disponivel: Number(s.saldo) };
    if (dom.escopoDe(ctx.eu) === "vendas") return lista.map((s) => ({ produto: s.nome, unidade: s.unidade, no_patio: Math.max(0, dd(s).saldo), vendido_esperando_carregar: dd(s).reservado, disponivel_para_vender: Math.max(0, dd(s).disponivel), situacao: dd(s).disponivel <= 0 ? "sem estoque" : Number(s.minimo) > 0 && dd(s).disponivel <= Number(s.minimo) ? "pouco" : "tem" }));
    return lista.map((s) => ({ produto: s.nome, saldo: s.saldo, reservado_em_notas_na_fila: dd(s).reservado, disponivel_para_vender: dd(s).disponivel, minimo: s.minimo, unidade: s.unidade, situacao: D().situacaoEstoque(s, c.config, c.agora).estado, cobertura_dias: D().coberturaDias(s.produto_id, c.movimentos, s.saldo, c.agora), ultima_contagem: s.ultima_contagem }));
  });
  ler("contagem_sugerida", "Produtos que mais valem contar hoje e por quê.", esq(), async (ctx) => {
    const c = await ctx.dominio(); return D().sugerirContagem({ saldos: c.saldos, movimentos: c.movimentos, conferencias: c.conferencias, config: c.config, agora: c.agora }, 6).map((s) => ({ produto: s.nome, motivos: s.motivos }));
  });
  ler("desempenho_equipe", "Conferências por pessoa no período (quantidade, diferenças, tempo médio). Para a lista de funcionários use a ferramenta funcionarios.", esq({ periodo: periodoProp }, ["periodo"]), async (ctx, e) => {
    const c = await ctx.dominio(); const per = D().periodo(e.periodo || "hoje", c.agora); return D().equipe(c.conferencias, per.de, per.ate);
  });

  // ───────────────────────── cadastros ─────────────────────────
  ler("funcionarios", "Lista os funcionários (nome, usuário, função, acesso, telefone, e-mail, admissão, validade da CNH, se pode entrar). Use para achar alguém antes de mudar, ou para responder quem trabalha aqui.",
    esq({ busca: str("Parte do nome ou usuário"), funcao: str("Filtrar por função", { enum: dom.FUNCOES }), situacao: str("ativos (padrão), inativos ou todos", { enum: ["ativos", "inativos", "todos"] }) }), async (ctx, e) => {
      const todos = await ctx.perfis(); const s = situacao(e.situacao); const b = U.norm(e.busca || ""); const f = e.funcao ? dom.funcaoDe(e.funcao) : null;
      const nome = (id) => (todos.find((p) => p.id === id) || {}).nome || null;
      const lista = todos.filter((p) => passa(p.ativo, s) && (!f || p.funcao === f) && (!b || U.norm(p.nome).includes(b) || (p.usuario && U.norm(p.usuario).includes(b))));
      return { total: lista.length, funcionarios: lista.slice(0, 100).map((p) => ({ id: p.id, nome: p.nome, usuario: p.usuario || "(entra pelo e-mail)", funcao: dom.ROTULO_FUNCAO[p.funcao] || p.funcao, acesso: dom.acesso(p.papel), pode_entrar: p.ativo !== false, telefone: p.telefone || null, email: p.email_contato || null, admissao: p.admissao || null, cnh_validade: p.cnh_validade || null, observacao: p.observacao || null, tem_foto: !!p.foto, cadastrado_por: nome(p.cadastrado_por), cadastrado_em: p.criado_em })) };
    });
  ler("produtos", "Lista os produtos cadastrados (nome, código, unidade, estoque mínimo, peças por pilha, saldo atual).", esq({ busca: str("Parte do nome ou código"), situacao: str("ativos (padrão), inativos ou todos", { enum: ["ativos", "inativos", "todos"] }) }), async (ctx, e) => {
    const ps = await ctx.produtos(true); const saldos = await ctx.saldos(); const s = situacao(e.situacao); const b = U.norm(e.busca || "");
    const saldo = new Map(saldos.map((x) => [x.produto_id, x.saldo]));
    const lista = ps.filter((p) => passa(p.ativo, s) && (!b || U.norm(p.nome).includes(b) || (p.codigo && U.norm(p.codigo).includes(b))));
    return { total: lista.length, produtos: lista.slice(0, 150).map((p) => ({ id: p.id, nome: p.nome, codigo: p.codigo || null, unidade: p.unidade, minimo: p.minimo, por_pilha: p.por_pilha || null, ativo: p.ativo !== false, saldo: saldo.has(p.id) ? saldo.get(p.id) : 0 })) };
  });
  ler("veiculos", "Lista os caminhões cadastrados (placa, tipo, marca, modelo, ano, cor, capacidade, quantas fotos).", esq({ busca: str("Parte da placa, marca ou modelo"), situacao: str("ativos (padrão), inativos ou todos", { enum: ["ativos", "inativos", "todos"] }) }), async (ctx, e) => {
    const vs = await ctx.veiculos(true); const s = situacao(e.situacao); const b = U.norm(e.busca || "");
    const lista = vs.filter((v) => passa(v.ativo, s) && (!b || U.norm(`${v.placa} ${v.marca || ""} ${v.modelo || ""}`).includes(b)));
    return { total: lista.length, caminhoes: lista.slice(0, 100).map((v) => ({ id: v.id, placa: v.placa, tipo: dom.TIPOS_VEICULO[v.tipo] || v.tipo, marca: v.marca || null, modelo: v.modelo || null, ano: v.ano || null, cor: v.cor || null, capacidade_t: v.capacidade_t || null, observacao: v.descricao || null, ativo: v.ativo !== false, fotos: (v.fotos || []).length })) };
  });

  // ───────────────────────── notas e conferências ─────────────────────────
  ler("notas", "Notas fiscais: por padrão as que estão na fila esperando conferência. Também as conferidas ou canceladas. Mostra itens e tempo de espera.",
    esq({ status: str("fila (padrão), conferida, cancelada ou todas", { enum: ["fila", "conferida", "cancelada", "todas"] }), busca: str("Parte do número ou do nome do cliente"), limite: { type: "number", description: "Quantas listar (padrão 30, máximo 100)" } }), async (ctx, e) => {
      const st = e.status || "fila"; const b = U.norm(e.busca || ""); const agora = ctx.agora;
      const produtos = await ctx.produtos(true); const nomeProd = new Map(produtos.map((p) => [p.id, p.nome]));
      const rows = await ctx.notas({ status: st === "todas" ? null : st === "fila" ? ["pendente", "em_conferencia"] : [st], ordemAsc: st === "fila", limite: 300 });
      const meus = dom.escopoDe(ctx.eu) === "vendas" ? rows.filter((n) => D().ehMinhaNota(n, ctx.eu)) : rows;   // vendedor só enxerga as notas dele
      const lista = meus.filter((n) => !b || U.norm(`${n.numero} ${n.cliente || ""}`).includes(b)).slice(0, lim(e.limite, 30, 100));
      return { total: lista.length, notas: lista.map((n) => ({ id: n.id, numero: n.numero, cliente: n.cliente || null, vendedor: n.vendedor || null, situacao: n.status, criada_em: n.criado_em, espera: n.status === "pendente" || n.status === "em_conferencia" ? D().duracao((agora - D().aMs(n.criado_em)) / D().MIN) : null, itens: (n.itens || []).map((i) => ({ produto: nomeProd.get(i.produto_id) || i.descricao, quantidade: i.quantidade, cadastrado: !!i.produto_id })) })) };
    });
  ler("conferencias", "Conferências de carga já feitas: nota, cliente, placa, quem conferiu, se bateu, diferenças e motivo.",
    esq({ periodo: periodoProp, busca: str("Parte do número da nota, cliente, placa ou conferente"), so_diferencas: { type: "boolean", description: "Só as que tiveram diferença" }, limite: { type: "number", description: "Quantas listar (padrão 20, máximo 60)" } }), async (ctx, e) => {
      const c = await ctx.dominio(); const per = D().periodo(e.periodo || "7d", c.agora); const b = U.norm(e.busca || "");
      const minhas = dom.escopoDe(ctx.eu) === "vendas" ? await ctx.minhasNotasIds() : null;   // vendedor só enxerga as cargas das notas dele
      const lista = c.conferencias.filter((x) => { const t = D().aMs(x.criado_em); return t >= per.de && t < per.ate && (!minhas || minhas.has(x.nota_id)) && (!e.so_diferencas || x.status === "divergencia") && (!b || U.norm(`${x.numero_nota} ${x.cliente || ""} ${x.placa} ${(x.conferente || {}).nome || ""}`).includes(b)); }).slice(0, lim(e.limite, 20, 60));
      return { periodo: per.rotulo, total: lista.length, conferencias: lista.map((x) => ({ nota: x.numero_nota, cliente: x.cliente || null, placa: x.placa, conferente: (x.conferente || {}).nome || null, quando: x.criado_em, resultado: x.status === "ok" ? "bateu" : "teve diferença", motivo: x.motivo_divergencia || null, diferencas: (x.itens || []).filter((i) => Number(i.qtd_nota) !== Number(i.qtd_carregada)).map((i) => ({ produto: i.descricao, na_nota: i.qtd_nota, carregado: i.qtd_carregada })) })) };
    });

  // ───────────────────────── estoque, contagens, avisos, ajustes ─────────────────────────
  ler("movimentos", "Últimos lançamentos de estoque (entrada, saída, perda, ajuste), de todos os produtos ou de um produto.", esq({ produto: str("Nome do produto (opcional)"), limite: { type: "number", description: "Quantos listar (padrão 30, máximo 100)" } }), async (ctx, e) => {
    const ps = await ctx.produtos(true); let pid = null;
    if (e.produto) { const r = achar.produto(ps, e.produto); if (r.erro) return { erro: r.erro }; pid = r.item.id; }
    const nome = new Map(ps.map((p) => [p.id, p.nome])); const lista = await ctx.movimentos({ produto_id: pid, limite: lim(e.limite, 30, 100) });
    return { total: lista.length, movimentos: lista.map((m) => ({ produto: nome.get(m.produto_id) || m.produto_id, tipo: m.tipo, quantidade: m.quantidade, motivo: m.motivo || null, quando: m.criado_em })) };
  });
  ler("contagens", "Contagens de estoque: pedidas, aguardando decisão (com diferença) e já resolvidas. Traz o id de cada uma.", esq({ status: str("solicitada, aguardando_aprovacao, aplicada, descartada ou todas (padrão)", { enum: ["solicitada", "aguardando_aprovacao", "aplicada", "descartada", "todas"] }) }), async (ctx, e) => {
    const ps = await ctx.produtos(true); const nome = new Map(ps.map((p) => [p.id, p.nome]));
    const lista = (await ctx.contagens()).filter((c) => !e.status || e.status === "todas" || c.status === e.status).slice(0, 30);
    return { total: lista.length, contagens: lista.map((c) => ({ id: c.id, situacao: c.status, escopo: c.escopo || null, criada_em: c.criado_em, itens: (c.itens || []).map((i) => ({ produto: nome.get(i.produto_id) || i.produto_id, esperado: i.esperado, contado: i.contado, diferenca: i.diferenca })) })) };
  });
  ler("avisos", "Os avisos (sino) de quem está falando: título, texto e se já foi lido. Traz o id de cada um.", esq({ somente_nao_lidos: { type: "boolean" } }), async (ctx, e) => {
    const lista = await ctx.alertas({ soNaoLidos: !!e.somente_nao_lidos });
    return { total: lista.length, avisos: lista.slice(0, 40).map((a) => ({ id: a.id, tipo: a.tipo, gravidade: a.severidade, titulo: a.titulo, texto: a.texto, quando: a.criado_em, lido: !!a.lido_em })) };
  });
  ler("ajustes", "Os ajustes dos avisos: expediente (dias e horário), tempo para nota parada, dias sem contar e hora do resumo diário.", esq(), async (ctx) => {
    const c = D().comPadrao(await ctx.config());
    return { dias_de_trabalho: c.expediente.dias.map((d) => ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][d]), inicio: c.expediente.inicio, fim: c.expediente.fim, nota_parada_minutos: c.limiteNotaParadaMin, dias_sem_contar: c.diasContagem, resumo_diario_hora: c.resumoDiarioHora };
  });
  ler("historico_do_assistente", "O que o assistente já fez (ações confirmadas): quem pediu, o quê, quando e como terminou.", esq({ limite: { type: "number", description: "Quantas listar (padrão 15, máximo 50)" } }), async (ctx, e) => {
    const lista = await ctx.repo.listar("assistente_acoes", { selecao: "ferramenta, resumo, status, usuario_nome, criado_em", ordem: ["criado_em", false], limite: lim(e.limite, 15, 50) });
    return { total: lista.length, acoes: lista.map((a) => ({ quando: a.criado_em, quem: a.usuario_nome, ferramenta: a.ferramenta, resumo: a.resumo, resultado: a.status })) };
  });

  ler("historico_de_atividades", "Histórico de atividades da empresa: quem fez, quando, qual mercadoria e dados da nota (nota lançada ou cancelada, carga conferida, entrada/perda de estoque, contagem, produtos, caminhões, pessoas, ajustes). Só diretoria e administrativo.",
    esq({ periodo: periodoProp, tipo: str("Tipo de atividade", { enum: ["nota", "carga", "estoque", "contagem", "produto", "caminhao", "pessoa", "ajuste"] }), pessoa: str("Parte do nome de quem fez"), busca: str("Parte do número da nota, cliente, mercadoria ou placa"), limite: { type: "number", description: "Quantas listar (padrão 20, máximo 60)" } }), async (ctx, e) => {
      if (!["diretoria", "administrativo"].includes(ctx.eu && ctx.eu.funcao)) return { erro: "O histórico de atividades é só da diretoria e do administrativo." };
      const per = D().periodo(e.periodo || "7d", ctx.agora); const b = U.norm(e.busca || ""); const p = U.norm(e.pessoa || "");
      const lista = await ctx.repo.listar("atividades", { selecao: "criado_em, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, itens, detalhes, busca", gte: { criado_em: new Date(per.de).toISOString() }, lt: { criado_em: new Date(per.ate).toISOString() }, ...(e.tipo ? { eq: { categoria: e.tipo } } : {}), ordem: ["criado_em", false], limite: 1000 });
      const bate = lista.filter((a) => (!b || b.split(/\s+/).every((w) => U.norm(a.busca || a.resumo).includes(w))) && (!p || U.norm(a.usuario_nome).includes(p)));
      return { periodo: per.rotulo, total: bate.length, atividades: bate.slice(0, lim(e.limite, 20, 60)).map((a) => ({ quando: a.criado_em, quem: a.usuario_nome, funcao: dom.ROTULO_FUNCAO[a.usuario_funcao] || a.usuario_funcao || null, tipo: a.categoria, o_que_fez: a.resumo, nota: a.nota_numero || null, cliente: a.cliente || null, mercadoria: a.itens, detalhes: a.detalhes })) };
    });

  // ───────────────────────── navegação (só manda o app abrir algo) ─────────────────────────
  ler("abrir_tela", "Mostra um botão para a pessoa abrir uma tela do app (ou um passo a passo). Use quando ela quiser ver ou fazer algo na tela.",
    esq({ tela: str("Tela do app", { enum: Object.keys(dom.TELAS) }), aba: str("Só para cadastros: produtos ou caminhoes", { enum: ["produtos", "caminhoes"] }), passo_a_passo: str("Abrir um passo a passo guiado em vez de uma tela", { enum: Object.keys(dom.FLUXOS) }) }), async (ctx, e) => {
      if (e.passo_a_passo) { if (!dom.FLUXOS[e.passo_a_passo]) return { erro: "Passo a passo desconhecido." }; ctx.acoes.push({ rotulo: dom.FLUXOS[e.passo_a_passo], rota: "guia", params: { fluxo: e.passo_a_passo } }); return { ok: true, mostrado: dom.FLUXOS[e.passo_a_passo] }; }
      if (!dom.TELAS[e.tela]) return { erro: "Tela desconhecida." };
      ctx.acoes.push({ rotulo: `Abrir ${dom.TELAS[e.tela]}`, rota: e.tela, params: e.tela === "cadastros" && e.aba ? { aba: e.aba } : {} }); return { ok: true, mostrado: dom.TELAS[e.tela] };
    }, "nav");
  ler("link_rastreio", "Prepara o link de rastreio que o cliente recebe (mostra a carga conferida). Só existe depois que a nota foi conferida.", esq({ nota: str("Número da nota") }, ["nota"]), async (ctx, e) => {
    const numero = U.txt(e.nota).replace(/^nota\s*/i, ""); const r = achar.nota(await ctx.notasPorNumero([numero]), numero); if (r.erro) return { erro: r.erro };
    const n = r.item; if (dom.escopoDe(ctx.eu) === "vendas" && !D().ehMinhaNota(n, ctx.eu)) return { erro: `A nota ${n.numero} não é sua. Você só consegue o rastreio das suas notas.` };
    if (n.status !== "conferida") return { erro: `A nota ${n.numero} ainda não foi conferida (situação: ${n.status}). O link só mostra a carga depois da conferência.` };
    ctx.acoes.push({ rotulo: `Link de rastreio da nota ${n.numero}`, rastreio: n.token_publico, numero: n.numero, cliente: n.cliente || "" }); return { ok: true, nota: n.numero };
  }, "nav");

  if (typeof module !== "undefined" && module.exports) module.exports = raiz.NEFerramentas;
})(typeof window !== "undefined" ? window : globalThis);
