// VISUAL DOS RELATÓRIOS (planilhas): transforma os dados de cada relatório em números-chave, gráficos e destaques da tabela.
// Código puro (sem tela): roda no app, na demonstração e no servidor do assistente, com o mesmo resultado.
//
//   V.estoque(itens) · V.movimentacao(movs) · V.fila(notas) · V.cargas(cargas) · V.contagens(l) · V.atividades(l) · V.diferencas(l) · V.equipe(l)
//   V.resumo(r) · V.funcionarios(l) · V.veiculos(l) · V.sugestao(l)      →  { resumo, graficos, colunas }
//   V.aplicar(bloco, visual)                                             →  bloco com resumo (números-chave), graficos e destaques de coluna
//
//   resumo   [[rótulo, texto, { tom, numero?, sufixo?, icone? }]]   números-chave (o app faz o número subir até `numero`)
//   graficos [{ tipo: "barras" | "barrasH" | "rosca", titulo, ... }] ver graficos.js (desenho) e planilha.js (Excel)
//   colunas  { "Rótulo da coluna": { visual: "estado" | "barra" | "sinal", tons?, icones?, valores? } }  (valores = número de cada linha, na ordem das linhas)
// Tons: ok (verde) · info (azul) · alerta (âmbar) · erro (vermelho) · neutro (cinza) · c1…c6 (categorias, sem sentido bom ou ruim)
(function (raiz) {
  "use strict";
  const MIN = 60000, HORA = 3600000, DIA = 86400000, FUSO = -3 * HORA;   // mesmo fuso do resto do app (Brasília)
  const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const fmt = (n) => nf.format(Number(n) || 0);
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
  const soma = (l, f = (x) => x) => l.reduce((n, x) => n + num(f(x)), 0);
  const ms = (d) => (typeof d === "number" ? d : new Date(d).getTime());
  const duracao = (min) => (raiz.NEDominio && raiz.NEDominio.duracao ? raiz.NEDominio.duracao(min) : `${Math.round(min)} min`);
  const plural = (n, um, varios) => `${fmt(n)} ${Math.abs(n) === 1 ? um : varios}`;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const CORES = ["c1", "c2", "c3", "c4", "c5", "c6"];

  // Cores (a mesma lista pinta a tela, a impressão e o Excel)
  const PALETA = { ok: "#1f9d57", info: "#2f46c8", alerta: "#e69a00", erro: "#d9141e", neutro: "#8791a8", c1: "#1a1f8f", c2: "#d9141e", c3: "#1f9d57", c4: "#e69a00", c5: "#6b7a99", c6: "#8a4fd3" };
  const CLARA = { ok: "#e3f3e9", info: "#e4e9fb", alerta: "#fdf0dc", erro: "#fbe7e5", neutro: "#eceef3", c1: "#e4e5f4", c2: "#fbe7e5", c3: "#e3f3e9", c4: "#fdf0dc", c5: "#eceef3", c6: "#f0e6fa" };

  // número-chave. valor numérico sobe até ele; texto fica como está.
  const k = (rotulo, valor, tom = "info", { sufixo = "", icone = "" } = {}) => [String(rotulo), typeof valor === "number" ? `${fmt(valor)}${sufixo}` : String(valor), { tom, ...(typeof valor === "number" ? { numero: valor, sufixo } : {}), ...(icone ? { icone } : {}) }];
  const comTom = (n, tomSeTem, tomSeNao = "neutro") => (n > 0 ? tomSeTem : tomSeNao);
  const tomPct = (p) => (p >= 90 ? "ok" : p >= 75 ? "alerta" : "erro");
  const curto = (t, n = 26) => { t = String(t || ""); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
  // maiores N + "Outros"
  function topo(mapa, n) {
    const l = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const cab = l.slice(0, n), resto = soma(l.slice(n), (x) => x[1]);
    return resto > 0 ? [...cab, ["Outros", resto]] : cab;
  }
  const contarPor = (l, f) => { const m = new Map(); for (const x of l) { const c = f(x); if (c == null || c === "") continue; m.set(c, (m.get(c) || 0) + 1); } return m; };

  // ───────────── tempo: horas, dias ou semanas, conforme o tamanho do período ─────────────
  function eixoTempo(tempos, { de, ate } = {}) {
    const t = tempos.map(ms).filter(Number.isFinite); if (!t.length) return null;
    const menor = Math.min(...t), maior = Math.max(...t);
    const lo = de != null ? Math.min(ms(de), menor) : menor, hi = ate != null ? Math.max(ms(ate), maior) : maior;
    const gran = hi - lo <= 2 * DIA ? "hora" : hi - lo <= 40 * DIA ? "dia" : "semana";
    const ord = (x) => { const l = ms(x) + FUSO; const d = Math.floor(l / DIA); return gran === "hora" ? Math.floor(l / HORA) : gran === "dia" ? d : Math.floor((d - 4) / 7); };
    const ini = ord(gran === "hora" ? menor : lo), fim = ord(gran === "hora" ? maior : hi);
    if (fim - ini > 60) return null;
    const p2 = (v) => String(v).padStart(2, "0");
    const rotulo = (o) => {
      if (gran === "hora") return `${p2(((o % 24) + 24) % 24)}h`;
      const d = new Date((gran === "dia" ? o : o * 7 + 4) * DIA); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`;
    };
    const cats = []; for (let o = ini; o <= fim; o++) cats.push(o);
    return { gran, categorias: cats.map(rotulo), indice: (x) => ord(x) - ini, n: cats.length };
  }
  // series: [{ rotulo, tom, onde: (x) => bool }]; itens têm `t` (ms) e valor `v` (padrão 1)
  function porTempo(itens, series, periodo) {
    const eixo = eixoTempo(itens.map((x) => x.t), periodo); if (!eixo || eixo.n < 2) return null;
    const out = series.map((s) => ({ rotulo: s.rotulo, tom: s.tom, valores: Array(eixo.n).fill(0) }));
    for (const x of itens) { const i = eixo.indice(x.t); if (i < 0 || i >= eixo.n) continue; series.forEach((s, j) => { if (s.onde(x)) out[j].valores[i] += x.v == null ? 1 : x.v; }); }
    const com = out.filter((s) => s.valores.some((v) => v > 0)); if (!com.length) return null;
    return { categorias: eixo.categorias, series: com, gran: eixo.gran };
  }
  const tituloTempo = (gran, o) => `${o} ${gran === "hora" ? "por hora" : gran === "dia" ? "por dia" : "por semana"}`;

  // ───────────── estoque ─────────────
  const SIT_ESTOQUE = { ok: "OK", baixo: "Baixo", negativo: "Negativo" };
  function estoque(itens) {
    const l = itens.map((x) => { const saldo = num(x.saldo), minimo = num(x.minimo); return { nome: String(x.nome || x.produto || ""), saldo, minimo, unidade: x.unidade || "", sit: x.situacao || (saldo < 0 ? "negativo" : minimo > 0 && saldo < minimo ? "baixo" : "ok") }; });
    const n = (s) => l.filter((x) => x.sit === s).length; const ordem = { negativo: 0, baixo: 1, ok: 2 };
    const ver = [...l].sort((a, b) => ordem[a.sit] - ordem[b.sit] || b.saldo - a.saldo).slice(0, 12);
    return {
      resumo: [k("Produtos", l.length, "info", { icone: "caixas" }), k("Em dia", n("ok"), "ok", { icone: "check" }), k("Abaixo do mínimo", n("baixo"), comTom(n("baixo"), "alerta"), { icone: "alerta" }), k("Negativos", n("negativo"), comTom(n("negativo"), "erro"), { icone: "alerta" })],
      graficos: [
        { tipo: "barrasH", titulo: "Quanto tem de cada produto (o risco marca o mínimo)", marcaRotulo: "mínimo", itens: ver.map((x) => ({ rotulo: curto(x.nome, 30), valor: Math.max(0, x.saldo), texto: `${fmt(x.saldo)}${x.unidade ? ` ${x.unidade}` : ""}`, tom: x.sit === "negativo" ? "erro" : x.sit === "baixo" ? "alerta" : "ok", ...(x.minimo > 0 ? { marca: x.minimo } : {}) })) },
        { tipo: "rosca", titulo: "Como está o estoque", centro: { valor: l.length, rotulo: l.length === 1 ? "produto" : "produtos" }, fatias: [{ rotulo: "Em dia", valor: n("ok"), tom: "ok" }, { rotulo: "Abaixo do mínimo", valor: n("baixo"), tom: "alerta" }, { rotulo: "Negativo", valor: n("negativo"), tom: "erro" }].filter((f) => f.valor > 0) },
      ].filter((g) => (g.itens || g.fatias).length),
      colunas: { "Situação": { visual: "estado", tons: { OK: "ok", Baixo: "alerta", Negativo: "erro" } }, "Saldo": { visual: "barra", valores: l.map((x) => x.saldo) }, "Disponível": { visual: "barra", valores: itens.map((x) => num(x.disponivel_para_vender ?? x.disponivel)) }, "Mínimo": { valores: l.map((x) => x.minimo) } },
    };
  }

  // ───────────── movimentação do estoque ─────────────
  const ROT_TIPO = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste" };
  function movimentacao(movs, periodo) {
    const l = movs.map((m) => ({ t: ms(m.quando), produto: String(m.produto || "Produto"), tipo: m.tipo, q: num(m.quantidade) }));
    const abs = (t) => soma(l.filter((x) => x.tipo === t), (x) => Math.abs(x.q)); const ent = abs("entrada"), sai = abs("saida"), per = abs("perda");
    const liquido = soma(l, (x) => x.q);
    const tempo = porTempo(l.map((x) => ({ ...x, v: Math.abs(x.q) })), [{ rotulo: "Entradas", tom: "ok", onde: (x) => x.tipo === "entrada" }, { rotulo: "Saídas", tom: "info", onde: (x) => x.tipo === "saida" }, { rotulo: "Perdas", tom: "erro", onde: (x) => x.tipo === "perda" }, { rotulo: "Ajustes", tom: "neutro", onde: (x) => x.tipo === "ajuste" }], periodo);
    const por = new Map(); for (const x of l) { const p = por.get(x.produto) || { entrada: 0, saida: 0, perda: 0, ajuste: 0 }; p[x.tipo] = (p[x.tipo] || 0) + Math.abs(x.q); por.set(x.produto, p); }
    const ranking = [...por.entries()].map(([nome, p]) => ({ nome, p, total: soma(Object.values(p)) })).sort((a, b) => b.total - a.total).slice(0, 7);
    return {
      resumo: [k("Lançamentos", l.length, "info", { icone: "lista" }), k("Entradas", ent, "ok", { icone: "mais" }), k("Saídas", sai, "info", { icone: "menos" }), k("Perdas", per, comTom(per, "erro"), { icone: "alerta" }), ...(l.length ? [k("Saldo do período", `${liquido > 0 ? "+" : liquido < 0 ? "−" : ""}${fmt(Math.abs(liquido))}`, liquido >= 0 ? "ok" : "alerta", { icone: "grafico" })] : [])],
      graficos: [
        ...(tempo ? [{ tipo: "barras", titulo: tituloTempo(tempo.gran, "Entradas, saídas e perdas"), empilhar: true, categorias: tempo.categorias, series: tempo.series }] : []),
        ...(ranking.length ? [{ tipo: "barrasH", titulo: "Produtos que mais se mexeram", itens: ranking.map((x) => ({ rotulo: curto(x.nome, 30), valor: x.total, texto: fmt(x.total), partes: [{ rotulo: "Entradas", valor: x.p.entrada, tom: "ok" }, { rotulo: "Saídas", valor: x.p.saida, tom: "info" }, { rotulo: "Perdas", valor: x.p.perda, tom: "erro" }, { rotulo: "Ajustes", valor: x.p.ajuste, tom: "neutro" }].filter((q) => q.valor > 0) })) }] : []),
      ],
      colunas: { "O que foi": { visual: "estado", tons: { Entrada: "ok", "Saída": "info", Perda: "erro", Ajuste: "neutro" }, icones: { Entrada: "▲", "Saída": "▼", Perda: "✖", Ajuste: "⇄" } }, "Qtd": { visual: "sinal", valores: l.map((x) => x.q) } },
    };
  }

  // ───────────── fila de notas ─────────────
  const SIT_NOTA = { "Na fila": "info", Conferindo: "alerta", Conferida: "ok", Cancelada: "neutro" };
  function fila(notas, { limiteMin = 120 } = {}) {
    const l = notas.map((n) => ({ numero: String(n.numero), cliente: n.cliente || "", vendedor: n.vendedor || "", espera: num(n.esperaMin) }));
    const paradas = l.filter((x) => x.espera >= limiteMin); const maior = l.length ? Math.max(...l.map((x) => x.espera)) : 0; const media = l.length ? soma(l, (x) => x.espera) / l.length : 0;
    const ver = [...l].sort((a, b) => b.espera - a.espera).slice(0, 12);
    const vend = topo(contarPor(l, (x) => x.vendedor), 5);
    return {
      resumo: [k("Na fila", l.length, "info", { icone: "nota" }), k("Paradas", paradas.length, comTom(paradas.length, "erro"), { icone: "alerta" }), k("Espera mais longa", l.length ? duracao(maior) : "—", maior >= limiteMin ? "erro" : maior >= limiteMin / 2 ? "alerta" : "neutro", { icone: "relogio" }), k("Espera média", l.length ? duracao(media) : "—", "neutro", { icone: "relogio" })],
      graficos: [
        ...(ver.length ? [{ tipo: "barrasH", titulo: "Há quanto tempo cada nota espera", marcaRotulo: "limite", itens: ver.map((x) => ({ rotulo: curto(`Nota ${x.numero}${x.cliente ? ` · ${x.cliente}` : ""}`, 32), valor: x.espera, texto: duracao(x.espera), tom: x.espera >= limiteMin ? "erro" : x.espera >= limiteMin / 2 ? "alerta" : "info", marca: limiteMin })) }] : []),
        ...(vend.length > 1 ? [{ tipo: "rosca", titulo: "Notas esperando, por vendedor", centro: { valor: l.length, rotulo: "notas" }, fatias: vend.map(([nome, v], i) => ({ rotulo: curto(nome, 22), valor: v, tom: CORES[i % CORES.length] })) }] : []),
      ],
      colunas: { "Espera": { visual: "barra", valores: l.map((x) => x.espera) }, "Situação": { visual: "estado", tons: SIT_NOTA } },
    };
  }

  // ───────────── notas fiscais em geral (fila, conferidas, canceladas) ─────────────
  const ROT_SIT_NOTA = { pendente: "Na fila", em_conferencia: "Conferindo", conferida: "Conferida", cancelada: "Cancelada" };
  function notas(rows, { limiteMin = 120 } = {}) {
    const l = rows.map((n) => ({ numero: String(n.numero), cliente: n.cliente || "", vendedor: n.vendedor || "", sit: ROT_SIT_NOTA[n.situacao] || n.situacao, esperaMin: num(n.esperaMin), naFila: n.situacao === "pendente" || n.situacao === "em_conferencia" }));
    if (l.length && l.every((x) => x.naFila)) return fila(l, { limiteMin });
    const n = (s) => l.filter((x) => x.sit === s).length; const vend = topo(contarPor(l, (x) => x.vendedor), 5); const esperando = l.filter((x) => x.naFila).length;
    return {
      resumo: [k("Notas", l.length, "info", { icone: "nota" }), k("Na fila", esperando, comTom(esperando, "alerta"), { icone: "relogio" }), k("Conferidas", n("Conferida"), "ok", { icone: "check" }), k("Canceladas", n("Cancelada"), "neutro", { icone: "lixeira" })],
      graficos: [
        ...(l.length ? [{ tipo: "rosca", titulo: "Como estão as notas", centro: { valor: l.length, rotulo: l.length === 1 ? "nota" : "notas" }, fatias: Object.keys(SIT_NOTA).map((s) => ({ rotulo: s, valor: n(s), tom: SIT_NOTA[s] })).filter((f) => f.valor > 0) }] : []),
        ...(vend.length > 1 ? [{ tipo: "rosca", titulo: "Notas por vendedor", centro: { valor: l.length, rotulo: "notas" }, fatias: vend.map(([nome, v], i) => ({ rotulo: curto(nome, 22), valor: v, tom: CORES[i % CORES.length] })) }] : []),
      ],
      colunas: { "Situação": { visual: "estado", tons: SIT_NOTA } },
    };
  }

  // ───────────── estoque para o vendedor: o que dá para vender ─────────────
  const SIT_VENDA = { tem: "ok", pouco: "alerta", "sem estoque": "erro" };
  function estoqueVendas(rows) {
    const l = rows.map((x) => ({ nome: String(x.produto || ""), un: x.unidade || "", patio: num(x.no_patio), vendido: num(x.vendido_esperando_carregar), livre: num(x.disponivel_para_vender), sit: x.situacao }));
    const n = (s) => l.filter((x) => x.sit === s).length; const ver = [...l].sort((a, b) => b.patio - a.patio).slice(0, 12);
    return {
      resumo: [k("Produtos", l.length, "info", { icone: "caixas" }), k("Com estoque para vender", l.filter((x) => x.livre > 0).length, "ok", { icone: "check" }), k("Sem estoque para vender", l.filter((x) => x.livre <= 0).length, comTom(l.filter((x) => x.livre <= 0).length, "erro"), { icone: "alerta" }), k("Já vendido, esperando carregar", soma(l, (x) => x.vendido), "info", { icone: "caminhao" })],
      graficos: [
        ...(ver.length ? [{ tipo: "barrasH", titulo: "O que dá para vender (e o que já está vendido)", itens: ver.map((x) => ({ rotulo: curto(x.nome, 30), valor: x.livre + x.vendido, texto: x.livre > 0 ? `${fmt(x.livre)}${x.un ? ` ${x.un}` : ""} livres` : "sem estoque", tom: x.livre > 0 ? "ok" : "erro", partes: [{ rotulo: "Disponível", valor: x.livre, tom: "ok" }, { rotulo: "Já vendido, esperando carregar", valor: x.vendido, tom: "info" }].filter((q) => q.valor > 0) })) }] : []),
        ...(l.length ? [{ tipo: "rosca", titulo: "Situação para vender", centro: { valor: l.length, rotulo: l.length === 1 ? "produto" : "produtos" }, fatias: [{ rotulo: "Tem", valor: n("tem"), tom: "ok" }, { rotulo: "Pouco", valor: n("pouco"), tom: "alerta" }, { rotulo: "Sem estoque", valor: n("sem estoque"), tom: "erro" }].filter((f) => f.valor > 0) }] : []),
      ],
      colunas: { "Situação": { visual: "estado", tons: SIT_VENDA }, "Disponível": { visual: "barra", valores: l.map((x) => x.livre) }, "No pátio": { visual: "barra", valores: l.map((x) => x.patio) } },
    };
  }

  // ───────────── cargas conferidas ─────────────
  function cargas(cs, periodo) {
    const l = cs.map((c) => ({ t: ms(c.quando), bateu: !!c.bateu, conferente: c.conferente || "—", mais: num(c.aMais), menos: num(c.aMenos) }));
    const ok = l.filter((x) => x.bateu).length, dif = l.length - ok; const p = pct(ok, l.length);
    const tempo = porTempo(l, [{ rotulo: "Corretas", tom: "ok", onde: (x) => x.bateu }, { rotulo: "Com diferença", tom: "erro", onde: (x) => !x.bateu }], periodo);
    const por = new Map(); for (const x of l) { const q = por.get(x.conferente) || { ok: 0, dif: 0 }; x.bateu ? q.ok++ : q.dif++; por.set(x.conferente, q); }
    const ranking = [...por.entries()].map(([nome, q]) => ({ nome, q, total: q.ok + q.dif })).sort((a, b) => b.total - a.total).slice(0, 7);
    const mais = soma(l, (x) => x.mais), menos = soma(l, (x) => x.menos);
    return {
      resumo: [k("Cargas", l.length, "info", { icone: "caminhao" }), k("Corretas", ok, "ok", { icone: "check" }), k("Com diferença", dif, comTom(dif, "erro"), { icone: "alerta" }), ...(l.length ? [k("Cargas corretas", p, tomPct(p), { sufixo: "%", icone: "grafico" })] : []), ...(mais > 0 ? [k("Peças a mais", mais, "alerta", { icone: "mais" })] : []), ...(menos > 0 ? [k("Peças a menos", menos, "erro", { icone: "menos" })] : [])],
      graficos: [
        ...(tempo ? [{ tipo: "barras", titulo: tituloTempo(tempo.gran, "Cargas conferidas"), empilhar: true, categorias: tempo.categorias, series: tempo.series }] : []),
        ...(l.length ? [{ tipo: "rosca", titulo: "Bateu com a nota?", centro: { valor: `${p}%`, rotulo: "corretas" }, fatias: [{ rotulo: "Confere", valor: ok, tom: "ok" }, { rotulo: "Com diferença", valor: dif, tom: "erro" }].filter((f) => f.valor > 0) }] : []),
        ...(ranking.length > 1 ? [{ tipo: "barrasH", titulo: "Quem conferiu", itens: ranking.map((x) => ({ rotulo: curto(x.nome, 30), valor: x.total, texto: fmt(x.total), partes: [{ rotulo: "Corretas", valor: x.q.ok, tom: "ok" }, { rotulo: "Com diferença", valor: x.q.dif, tom: "erro" }].filter((q) => q.valor > 0) })) }] : []),
      ],
      colunas: { "Resultado": { visual: "estado", tons: { Confere: "ok", "Com diferença": "erro" }, icones: { Confere: "✔", "Com diferença": "!" } } },
    };
  }

  // ───────────── contagens de estoque ─────────────
  const SIT_CONTAGEM = { Pedida: "info", "Aguardando decisão": "alerta", Aplicada: "ok", Descartada: "neutro" };
  const ROT_SIT_CONTAGEM = { solicitada: "Pedida", aguardando_aprovacao: "Aguardando decisão", aplicada: "Aplicada", descartada: "Descartada" };
  function contagens(cs) {
    const l = cs.map((c) => ({ sit: ROT_SIT_CONTAGEM[c.situacao] || c.situacao, difs: (c.diferencas || []).filter((d) => num(d.diferenca) !== 0) }));
    const n = (s) => l.filter((x) => x.sit === s).length; const comDif = l.filter((x) => x.difs.length).length;
    const por = new Map(); for (const x of l) for (const d of x.difs) { const p = por.get(d.produto) || { mais: 0, menos: 0 }; num(d.diferenca) > 0 ? (p.mais += num(d.diferenca)) : (p.menos += Math.abs(num(d.diferenca))); por.set(d.produto, p); }
    const rank = [...por.entries()].map(([nome, p]) => ({ nome, p, total: p.mais + p.menos })).sort((a, b) => b.total - a.total).slice(0, 8);
    return {
      resumo: [k("Contagens", l.length, "info", { icone: "caixas" }), k("Aplicadas", n("Aplicada"), "ok", { icone: "check" }), k("Aguardando decisão", n("Aguardando decisão"), comTom(n("Aguardando decisão"), "alerta"), { icone: "relogio" }), k("Com diferença", comDif, comTom(comDif, "erro"), { icone: "alerta" })],
      graficos: [
        ...(l.length ? [{ tipo: "rosca", titulo: "Como estão as contagens", centro: { valor: l.length, rotulo: l.length === 1 ? "contagem" : "contagens" }, fatias: Object.keys(SIT_CONTAGEM).map((s) => ({ rotulo: s, valor: n(s), tom: SIT_CONTAGEM[s] })).filter((f) => f.valor > 0) }] : []),
        ...(rank.length ? [{ tipo: "barrasH", titulo: "Onde mais deu diferença (peças)", itens: rank.map((x) => ({ rotulo: curto(x.nome, 30), valor: x.total, texto: fmt(x.total), partes: [{ rotulo: "Tinha a mais", valor: x.p.mais, tom: "alerta" }, { rotulo: "Faltava", valor: x.p.menos, tom: "erro" }].filter((q) => q.valor > 0) })) }] : []),
      ],
      colunas: { "Situação": { visual: "estado", tons: SIT_CONTAGEM } },
    };
  }

  // ───────────── histórico de atividades ─────────────
  const ROT_CATEGORIA = { nota: "Notas", carga: "Cargas", estoque: "Estoque", contagem: "Contagens", produto: "Produtos", caminhao: "Caminhões", pessoa: "Pessoas", ajuste: "Ajustes" };
  const TOM_CATEGORIA = { Notas: "c1", Cargas: "c3", Estoque: "c4", Contagens: "c6", Produtos: "c5", "Caminhões": "c5", Pessoas: "c2", Ajustes: "neutro" };
  function atividades(as, periodo) {
    const l = as.map((a) => ({ t: ms(a.quando), quem: a.quem || "—", cat: ROT_CATEGORIA[a.categoria] || (a.categoria ? String(a.categoria)[0].toUpperCase() + String(a.categoria).slice(1) : "Outros"), nota: a.nota || "" }));
    const pessoas = new Set(l.map((x) => x.quem)); const notas = new Set(l.map((x) => x.nota).filter(Boolean));
    const tempo = porTempo(l, [{ rotulo: "Atividades", tom: "info", onde: () => true }], periodo);
    const porPessoa = topo(contarPor(l, (x) => x.quem), 8); const porCat = topo(contarPor(l, (x) => x.cat), 6);
    return {
      resumo: [k("Atividades", l.length, "info", { icone: "lista" }), k("Pessoas", pessoas.size, "neutro", { icone: "pessoas" }), k("Notas mexidas", notas.size, "neutro", { icone: "nota" }), k("Cargas conferidas", l.filter((x) => x.cat === "Cargas").length, "ok", { icone: "caminhao" })],
      graficos: [
        ...(tempo ? [{ tipo: "barras", titulo: tituloTempo(tempo.gran, "Atividades"), categorias: tempo.categorias, series: tempo.series }] : []),
        ...(porPessoa.length > 1 ? [{ tipo: "barrasH", titulo: "Quem mais fez", itens: porPessoa.map(([nome, v]) => ({ rotulo: curto(nome, 30), valor: v, texto: fmt(v), tom: "info" })) }] : []),
        ...(porCat.length > 1 ? [{ tipo: "rosca", titulo: "O que foi feito", centro: { valor: l.length, rotulo: "atividades" }, fatias: porCat.map(([nome, v], i) => ({ rotulo: nome, valor: v, tom: TOM_CATEGORIA[nome] || CORES[i % CORES.length] })) }] : []),
      ],
      colunas: { "Tipo": { visual: "estado", tons: TOM_CATEGORIA } },
    };
  }

  // ───────────── diferenças por produto, equipe, resumo (assistente) ─────────────
  function diferencas(rows) {
    const l = rows.map((p) => ({ nome: String(p.nome || ""), oc: num(p.ocorrencias), mais: num(p.aMais), menos: num(p.aMenos) })).sort((a, b) => b.mais + b.menos - (a.mais + a.menos));
    return {
      resumo: [k("Produtos com diferença", l.length, "info", { icone: "caixas" }), k("Cargas com diferença", soma(l, (x) => x.oc), "erro", { icone: "alerta" }), k("Peças a mais", soma(l, (x) => x.mais), comTom(soma(l, (x) => x.mais), "alerta"), { icone: "mais" }), k("Peças a menos", soma(l, (x) => x.menos), comTom(soma(l, (x) => x.menos), "erro"), { icone: "menos" })],
      graficos: [{ tipo: "barrasH", titulo: "Onde a carga saiu diferente da nota (peças)", itens: l.slice(0, 8).map((x) => ({ rotulo: curto(x.nome, 30), valor: x.mais + x.menos, texto: fmt(x.mais + x.menos), partes: [{ rotulo: "A mais", valor: x.mais, tom: "alerta" }, { rotulo: "A menos", valor: x.menos, tom: "erro" }].filter((q) => q.valor > 0) })) }],
      colunas: { "A mais": { visual: "barra", valores: rows.map((p) => num(p.aMais)) }, "A menos": { visual: "barra", valores: rows.map((p) => num(p.aMenos)) } },
    };
  }
  function equipe(rows) {
    const l = rows.map((e) => ({ nome: String(e.nome || ""), total: num(e.total), dif: num(e.divergentes), dur: e.duracaoMediaMin == null ? null : num(e.duracaoMediaMin) }));
    const total = soma(l, (x) => x.total), dif = soma(l, (x) => x.dif); const durs = l.filter((x) => x.dur != null).map((x) => x.dur);
    return {
      resumo: [k("Pessoas", l.length, "neutro", { icone: "pessoas" }), k("Conferências", total, "info", { icone: "check" }), k("Com diferença", dif, comTom(dif, "erro"), { icone: "alerta" }), ...(durs.length ? [k("Tempo médio", `${fmt(soma(durs) / durs.length)} min`, "neutro", { icone: "relogio" })] : [])],
      graficos: [{ tipo: "barrasH", titulo: "Conferências de cada pessoa", itens: l.slice(0, 8).map((x) => ({ rotulo: curto(x.nome, 30), valor: x.total, texto: fmt(x.total), partes: [{ rotulo: "Corretas", valor: Math.max(0, x.total - x.dif), tom: "ok" }, { rotulo: "Com diferença", valor: x.dif, tom: "erro" }].filter((q) => q.valor > 0) })) }],
      colunas: { "Conferências": { visual: "barra", valores: l.map((x) => x.total) } },
    };
  }
  function resumo(r) {
    const q = r.kpis || {}; const p = q.acertoPct == null ? null : num(q.acertoPct); const sem = r.semaforo ? ({ verde: "ok", amarelo: "alerta", vermelho: "erro" })[r.semaforo.cor] || "info" : "info";
    return {
      resumo: [...(r.semaforo ? [k("Situação geral", r.semaforo.titulo, sem, { icone: sem === "ok" ? "check" : "alerta" })] : []), k("Conferências", num(q.total), "info", { icone: "check" }), ...(p != null ? [k("Cargas corretas", p, tomPct(p), { sufixo: "%", icone: "grafico" })] : []), k("Com diferença", num(q.divergentes), comTom(num(q.divergentes), "erro"), { icone: "alerta" }), ...(r.fila ? [k("Notas na fila", num(r.fila.total), comTom(num(r.fila.paradas), "alerta", "info"), { icone: "nota" })] : [])],
      graficos: num(q.total) > 0 ? [{ tipo: "rosca", titulo: "Cargas do período", centro: { valor: p == null ? String(num(q.total)) : `${p}%`, rotulo: p == null ? "cargas" : "corretas" }, fatias: [{ rotulo: "Corretas", valor: Math.max(0, num(q.total) - num(q.divergentes)), tom: "ok" }, { rotulo: "Com diferença", valor: num(q.divergentes), tom: "erro" }].filter((f) => f.valor > 0) }] : [],
      colunas: {},
    };
  }

  // ───────────── cadastros: equipe, caminhões, contagem sugerida ─────────────
  function funcionarios(rows) {
    const l = rows.map((p) => ({ funcao: p.funcao || "—", pode: !!p.pode_entrar })); const porFuncao = topo(contarPor(l, (x) => x.funcao), 6); const pode = l.filter((x) => x.pode).length;
    return {
      resumo: [k("Pessoas", l.length, "info", { icone: "pessoas" }), k("Podem entrar", pode, "ok", { icone: "check" }), k("Sem acesso", l.length - pode, comTom(l.length - pode, "alerta"), { icone: "chave" })],
      graficos: porFuncao.length > 1 ? [{ tipo: "rosca", titulo: "Equipe por função", centro: { valor: l.length, rotulo: "pessoas" }, fatias: porFuncao.map(([nome, v], i) => ({ rotulo: nome, valor: v, tom: CORES[i % CORES.length] })) }] : [],
      colunas: { "Pode entrar": { visual: "estado", tons: { Sim: "ok", "Não": "alerta" } } },
    };
  }
  function veiculos(rows) {
    const l = rows.map((v) => ({ tipo: v.tipo || "—", ativo: !!v.ativo, t: num(v.capacidade_t) })); const porTipo = topo(contarPor(l, (x) => x.tipo), 6); const em = l.filter((x) => x.ativo).length;
    return {
      resumo: [k("Caminhões", l.length, "info", { icone: "caminhao" }), k("Em uso", em, "ok", { icone: "check" }), ...(soma(l, (x) => x.t) > 0 ? [k("Capacidade somada", `${fmt(soma(l, (x) => x.t))} t`, "neutro", { icone: "caixas" })] : [])],
      graficos: porTipo.length > 1 ? [{ tipo: "rosca", titulo: "Caminhões por tipo", centro: { valor: l.length, rotulo: "caminhões" }, fatias: porTipo.map(([nome, v], i) => ({ rotulo: nome, valor: v, tom: CORES[i % CORES.length] })) }] : [],
      colunas: { "Em uso": { visual: "estado", tons: { Sim: "ok", "Não": "neutro" } } },
    };
  }
  function sugestao(rows) { return { resumo: [k("Para contar hoje", rows.length, rows.length ? "alerta" : "ok", { icone: "caixas" })], graficos: [], colunas: {} }; }

  // ───────────── junta o visual ao bloco ─────────────
  function aplicar(bloco, v) {
    if (!v) return bloco;
    const colunas = (bloco.colunas || []).map((c) => (v.colunas && v.colunas[c.rotulo] ? { ...c, ...v.colunas[c.rotulo] } : c));
    const linhas = bloco.linhas || [];
    for (const c of colunas) if (c.valores && c.valores.length > linhas.length) c.valores = c.valores.slice(0, linhas.length);
    return { ...bloco, colunas, resumo: v.resumo && v.resumo.length ? v.resumo : bloco.resumo || [], graficos: v.graficos || [] };
  }
  // O mínimo de visual para qualquer bloco: o número de linhas
  const garantir = (bloco) => (bloco.resumo && bloco.resumo.length ? bloco : { ...bloco, resumo: [k("Linhas", (bloco.linhas || []).length, "info", { icone: "lista" })] });

  const API = { PALETA, CLARA, CORES, fmt, k, estoque, estoqueVendas, movimentacao, fila, notas, cargas, contagens, atividades, diferencas, equipe, resumo, funcionarios, veiculos, sugestao, aplicar, garantir, eixoTempo, SIT_ESTOQUE, ROT_TIPO, SIT_NOTA, SIT_CONTAGEM, ROT_SIT_CONTAGEM };
  raiz.NERelatorioVisual = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
