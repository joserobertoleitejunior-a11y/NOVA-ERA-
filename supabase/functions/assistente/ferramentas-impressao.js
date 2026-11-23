// IMPRESSÃO PELO ASSISTENTE: cada consulta sabe virar uma tabela para imprimir.
// O servidor monta a tabela com os MESMOS dados que a consulta devolveu ao Claude (nunca com texto escrito por ele),
// e o app mostra o botão "Imprimir" logo abaixo da resposta. Assim o papel sempre bate com o que o assistente mostrou.
// Formato do bloco (o mesmo de assets/js/relatorios.js): { id, titulo, subtitulo, colunas: [{ rotulo, dir? }], linhas: [[…]], resumo: [[rótulo, valor]], arquivo }
(function (raiz) {
  "use strict";
  const F = raiz.NEFerramentas; const D = () => raiz.NEDominio; const { dom } = F;
  const FUSO = "America/Sao_Paulo";
  const quando = (iso) => (iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const agoraTxt = (ms) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
  const num = (n) => (n == null || n === "" ? "" : D().fmt(Number(n)));
  const sinal = (q) => `${Number(q) > 0 ? "+" : Number(q) < 0 ? "−" : ""}${num(Math.abs(Number(q)))}`;
  const bloco = (id, titulo, subtitulo, colunas, linhas, resumo = []) => ({ id, titulo, subtitulo, colunas: colunas.map(([rotulo, dir]) => ({ rotulo, ...(dir ? { dir: true } : {}) })), linhas, resumo, arquivo: id });
  const lista = (r, chave) => (r && !r.erro && Array.isArray(r[chave]) ? r[chave] : []);
  const SITUACAO_NOTA = { pendente: "Na fila", em_conferencia: "Conferindo", conferida: "Conferida", cancelada: "Cancelada" };
  const TIPO_MOV = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste" };
  const SITUACAO_CONTAGEM = { solicitada: "Pedida", aguardando_aprovacao: "Aguardando decisão", aplicada: "Aplicada", descartada: "Descartada" };

  const FORMATADORES = {
    estoque(r, ctx) {
      if (!Array.isArray(r) || !r.length) return null;
      if (dom.escopoDe(ctx.eu) === "vendas") {
        return bloco("estoque", "Estoque para vender", "O disponível já desconta o que está vendido esperando carregar", [["Produto"], ["No pátio", 1], ["Já vendido", 1], ["Disponível", 1], ["Situação"]],
          r.map((x) => [x.produto, `${num(x.no_patio)} ${x.unidade || ""}`.trim(), num(x.vendido_esperando_carregar), num(x.disponivel_para_vender), x.situacao]));
      }
      const ROT = { ok: "OK", baixo: "Baixo", negativo: "Negativo" };
      return bloco("estoque", "Estoque agora", `${r.length} ${r.length === 1 ? "produto" : "produtos"} · ${agoraTxt(ctx.agora)}`, [["Produto"], ["Saldo", 1], ["Disponível", 1], ["Mínimo", 1], ["Situação"], ["Última contagem"]],
        r.map((x) => [x.produto, `${num(x.saldo)} ${x.unidade || ""}`.trim(), num(x.disponivel_para_vender), num(x.minimo), ROT[x.situacao] || x.situacao, x.ultima_contagem ? quando(x.ultima_contagem) : "nunca contado"]),
        [["Produtos", String(r.length)], ["Abaixo do mínimo", String(r.filter((x) => x.situacao === "baixo").length)], ["Negativos", String(r.filter((x) => x.situacao === "negativo").length)]]);
    },
    movimentos(r) {
      const l = lista(r, "movimentos"); if (!l.length) return null;
      const soma = (t) => l.filter((m) => m.tipo === t).reduce((n, m) => n + Math.abs(Number(m.quantidade) || 0), 0);
      return bloco("movimentacao-de-estoque", "Movimentação de estoque", `Últimos ${l.length} ${l.length === 1 ? "lançamento" : "lançamentos"}`, [["Quando"], ["Produto"], ["O que foi"], ["Qtd", 1], ["Motivo"]],
        l.map((m) => [quando(m.quando), m.produto, TIPO_MOV[m.tipo] || m.tipo, sinal(m.quantidade), m.motivo || ""]),
        [["Lançamentos", String(l.length)], ["Entradas", num(soma("entrada"))], ["Saídas", num(soma("saida"))], ["Perdas", num(soma("perda"))]]);
    },
    notas(r) {
      const l = lista(r, "notas"); if (!l.length) return null; const fila = l.every((n) => n.situacao === "pendente" || n.situacao === "em_conferencia");
      return bloco(fila ? "notas-na-fila" : "notas", fila ? "Notas na fila" : "Notas", `${l.length} ${l.length === 1 ? "nota" : "notas"}`, [["Nota"], ["Cliente"], ["Vendedor"], ["Situação"], ["Itens"], ["Espera"]],
        l.map((n) => [n.numero, n.cliente || "", n.vendedor || "", SITUACAO_NOTA[n.situacao] || n.situacao, (n.itens || []).map((i) => `${num(i.quantidade)} ${i.produto}`).join(" · "), n.espera ? `há ${n.espera}` : ""]), [["Notas", String(l.length)]]);
    },
    conferencias(r) {
      const l = lista(r, "conferencias"); if (!l.length) return null;
      return bloco("cargas-conferidas", "Cargas conferidas", r.periodo || "", [["Quando"], ["Nota"], ["Cliente"], ["Placa"], ["Conferiu"], ["Resultado"], ["Diferença"]],
        l.map((c) => [quando(c.quando), c.nota, c.cliente || "", c.placa, c.conferente || "", c.resultado === "bateu" ? "Confere" : "Com diferença", (c.diferencas || []).map((d) => `${d.produto}: nota ${num(d.na_nota)}, carregado ${num(d.carregado)}`).join(" · ") + (c.motivo ? ` (${c.motivo})` : "")]),
        [["Cargas", String(l.length)], ["Com diferença", String(l.filter((c) => c.resultado !== "bateu").length)]]);
    },
    diferencas(r) {
      if (!Array.isArray(r) || !r.length) return null;
      return bloco("diferencas-por-produto", "Diferenças por produto", "Onde a carga saiu diferente da nota", [["Produto"], ["Cargas com diferença", 1], ["A mais", 1], ["A menos", 1]], r.map((p) => [p.nome, num(p.ocorrencias), num(p.aMais), num(p.aMenos)]));
    },
    desempenho_equipe(r) {
      if (!Array.isArray(r) || !r.length) return null;
      return bloco("desempenho-da-equipe", "Desempenho da equipe", "Conferências por pessoa", [["Pessoa"], ["Conferências", 1], ["Com diferença", 1], ["Tempo médio (min)", 1]], r.map((e) => [e.nome, num(e.total), num(e.divergentes), e.duracaoMediaMin ? num(e.duracaoMediaMin) : ""]));
    },
    funcionarios(r) {
      const l = lista(r, "funcionarios"); if (!l.length) return null;
      return bloco("equipe", "Equipe", `${l.length} ${l.length === 1 ? "pessoa" : "pessoas"}`, [["Nome"], ["Função"], ["Acesso"], ["Pode entrar"], ["Telefone"]], l.map((p) => [p.nome, p.funcao, p.acesso, p.pode_entrar ? "Sim" : "Não", p.telefone || ""]));
    },
    produtos(r) {
      const l = lista(r, "produtos"); if (!l.length) return null;
      return bloco("produtos", "Produtos", `${l.length} ${l.length === 1 ? "produto" : "produtos"}`, [["Produto"], ["Código"], ["Unidade"], ["Mínimo", 1], ["Por pilha", 1], ["Saldo", 1]], l.map((p) => [p.nome, p.codigo || "", p.unidade || "", num(p.minimo), p.por_pilha ? num(p.por_pilha) : "", num(p.saldo)]));
    },
    veiculos(r) {
      const l = lista(r, "caminhoes"); if (!l.length) return null;
      return bloco("caminhoes", "Caminhões", `${l.length} ${l.length === 1 ? "caminhão" : "caminhões"}`, [["Placa"], ["Tipo"], ["Marca e modelo"], ["Ano", 1], ["Capacidade (t)", 1], ["Em uso"]], l.map((v) => [v.placa, v.tipo, [v.marca, v.modelo].filter(Boolean).join(" "), v.ano ? String(v.ano) : "", v.capacidade_t ? num(v.capacidade_t) : "", v.ativo ? "Sim" : "Não"]));
    },
    contagens(r) {
      const l = lista(r, "contagens"); if (!l.length) return null;
      return bloco("contagens", "Contagens de estoque", `${l.length} ${l.length === 1 ? "contagem" : "contagens"}`, [["Quando"], ["Pedido"], ["Situação"], ["Produtos"], ["Diferenças"]],
        l.map((c) => [quando(c.criada_em), c.escopo || "Contagem", SITUACAO_CONTAGEM[c.situacao] || c.situacao, (c.itens || []).map((i) => i.produto).join(" · "), (c.itens || []).filter((i) => i.diferenca != null && Number(i.diferenca) !== 0).map((i) => `${i.produto} ${sinal(i.diferenca)}`).join(" · ")]));
    },
    contagem_sugerida(r) {
      if (!Array.isArray(r) || !r.length) return null;
      return bloco("o-que-contar", "O que contar hoje", "Produtos que mais valem contar", [["Produto"], ["Por que contar"]], r.map((s) => [s.produto, (s.motivos || []).join(" · ")]));
    },
    resumo(r) {
      if (!r || r.erro || !r.kpis) return null; const k = r.kpis; const linhas = [];
      if (r.semaforo) linhas.push(["Situação geral", `${r.semaforo.titulo}${r.semaforo.texto ? `: ${r.semaforo.texto}` : ""}`]);
      linhas.push(["Conferências", `${num(k.total)}${k.acertoPct == null ? "" : ` (${k.acertoPct}% corretas)`}`], ["Cargas com diferença", num(k.divergentes)], ["Peças a mais / a menos", `${num(k.aMais)} / ${num(k.aMenos)}`]);
      if (r.fila) linhas.push(["Notas na fila", `${num(r.fila.total)}${r.fila.paradas ? ` (${r.fila.paradas} paradas)` : ""}`]);
      if (r.estoque) { if ((r.estoque.negativos || []).length) linhas.push(["Estoque negativo", r.estoque.negativos.join(" · ")]); if ((r.estoque.baixos || []).length) linhas.push(["Estoque baixo", r.estoque.baixos.join(" · ")]); }
      for (const t of r.recados || []) linhas.push(["Recado", t]);
      return bloco("resumo", "Resumo", r.periodo || "", [["Assunto"], ["Situação"]], linhas);
    },
    historico_de_atividades(r) {
      const l = lista(r, "atividades"); if (!l.length) return null;
      return bloco("historico-de-atividades", "Histórico de atividades", r.periodo || "", [["Quando"], ["Quem"], ["O que fez"], ["Nota"], ["Cliente"]], l.map((a) => [quando(a.quando), a.quem, a.o_que_fez, a.nota || "", a.cliente || ""]), [["Atividades", String(l.length)]]);
    },
  };
  for (const [nome, fn] of Object.entries(FORMATADORES)) if (F.catalogo[nome]) F.catalogo[nome].imprimir = fn;

  // Chamado a cada consulta feita na conversa: junta no ctx o que dá para imprimir (no máximo 3 por resposta, sem repetir)
  F.coletarImpressao = (ctx, def, resultado) => {
    if (!def || typeof def.imprimir !== "function") return;
    try {
      const b = def.imprimir(resultado, ctx); if (!b || !b.linhas || !b.linhas.length) return;
      ctx.impressoes = ctx.impressoes || []; const chave = `${b.id}|${b.subtitulo}`;
      if (ctx.impressoes.some((x) => `${x.id}|${x.subtitulo}` === chave) || ctx.impressoes.length >= 3) return;
      ctx.impressoes.push({ ...b, linhas: b.linhas.slice(0, 600) });
    } catch (e) { console.error("impressão", def.nome, e && e.message); }
  };
  F.FORMATADORES_IMPRESSAO = FORMATADORES;
})(typeof window !== "undefined" ? window : globalThis);
