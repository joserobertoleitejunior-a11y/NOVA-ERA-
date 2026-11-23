// Planilhas visuais: os números-chave e os gráficos de cada relatório saem certos, sem NaN, e batem com os dados.
const test = require("node:test"); const assert = require("node:assert/strict");
const D = require("../assets/js/dominio.js"); globalThis.NEDominio = D;
const V = require("../assets/js/relatorio-visual.js");
const T = (iso) => new Date(iso).getTime();
const AGORA = T("2026-11-23T15:00:00Z");

// qualquer gráfico válido: tipo conhecido, números de verdade, tamanhos que fecham
function validar(v, nome) {
  assert.ok(Array.isArray(v.resumo) && v.resumo.length >= 1, `${nome}: sem números-chave`);
  for (const [rot, texto, ex] of v.resumo) { assert.ok(rot && typeof texto === "string" && !/NaN|undefined/.test(texto), `${nome}: número-chave ruim ${rot}=${texto}`); assert.ok(["ok", "info", "alerta", "erro", "neutro"].includes(ex.tom), `${nome}: tom ${ex.tom}`); if (ex.numero != null) assert.ok(Number.isFinite(ex.numero), `${nome}: numero de ${rot}`); }
  for (const g of v.graficos) {
    assert.ok(["barras", "barrasH", "rosca"].includes(g.tipo), `${nome}: tipo ${g.tipo}`); assert.ok(g.titulo, `${nome}: gráfico sem título`);
    if (g.tipo === "barras") { assert.ok(g.categorias.length >= 2 && g.series.length >= 1, `${nome}: barras vazias`); for (const s of g.series) { assert.equal(s.valores.length, g.categorias.length, `${nome}: série ${s.rotulo}`); assert.ok(s.valores.every((x) => Number.isFinite(x) && x >= 0)); assert.ok(s.valores.some((x) => x > 0), `${nome}: série ${s.rotulo} toda zero`); } }
    if (g.tipo === "barrasH") { assert.ok(g.itens.length >= 1); for (const i of g.itens) { assert.ok(i.rotulo && Number.isFinite(i.valor) && i.valor >= 0 && !/NaN|undefined/.test(i.texto || ""), `${nome}: item ${i.rotulo}`); if (i.partes) assert.equal(i.partes.reduce((n, p) => n + p.valor, 0), i.valor, `${nome}: partes de ${i.rotulo} não somam o total`); } }
    if (g.tipo === "rosca") { assert.ok(g.fatias.length >= 1 && g.fatias.every((f) => f.valor > 0 && f.rotulo)); assert.ok(!/NaN|undefined/.test(String(g.centro && g.centro.valor))); }
  }
}

test("estoque: números-chave, risco do mínimo, rosca e valores na ordem das linhas", () => {
  const itens = [{ nome: "Meio-fio", saldo: 340, minimo: 150, unidade: "un" }, { nome: "Boca de lobo", saldo: 6, minimo: 20, unidade: "un" }, { nome: "Aduela", saldo: -4, minimo: 5, unidade: "un" }, { nome: "Guia", saldo: 120, minimo: 60, unidade: "un" }];
  const v = V.estoque(itens); validar(v, "estoque");
  assert.deepEqual(v.resumo.map((x) => [x[0], x[2].numero, x[2].tom]), [["Produtos", 4, "info"], ["Em dia", 2, "ok"], ["Abaixo do mínimo", 1, "alerta"], ["Negativos", 1, "erro"]]);
  const barras = v.graficos[0]; assert.deepEqual(barras.itens.map((i) => i.rotulo), ["Aduela", "Boca de lobo", "Meio-fio", "Guia"], "o pior primeiro, depois do maior para o menor");
  assert.equal(barras.itens[0].valor, 0, "saldo negativo vira barra vazia"); assert.equal(barras.itens[0].texto, "-4 un"); assert.equal(barras.itens[0].tom, "erro"); assert.equal(barras.itens[2].marca, 150);
  assert.deepEqual(v.graficos[1].fatias.map((f) => [f.rotulo, f.valor]), [["Em dia", 2], ["Abaixo do mínimo", 1], ["Negativo", 1]]);
  assert.deepEqual(v.colunas["Saldo"].valores, [340, 6, -4, 120], "valores seguem a ordem das linhas, não a do gráfico");
  assert.deepEqual(V.estoque([{ nome: "A", saldo: 5, minimo: 0, situacao: "ok" }]).graficos.map((g) => g.tipo), ["barrasH", "rosca"]);
});

test("movimentação: totais, saldo do período, gráfico por dia e ranking por produto", () => {
  const mv = [
    { quando: T("2026-11-20T12:00:00Z"), produto: "Meio-fio", tipo: "entrada", quantidade: 200 }, { quando: T("2026-11-21T12:00:00Z"), produto: "Meio-fio", tipo: "saida", quantidade: -60 },
    { quando: T("2026-11-21T14:00:00Z"), produto: "Tubo", tipo: "saida", quantidade: -30 }, { quando: T("2026-11-22T12:00:00Z"), produto: "Boca de lobo", tipo: "perda", quantidade: -2 }, { quando: T("2026-11-23T12:00:00Z"), produto: "Tubo", tipo: "entrada", quantidade: 50 }];
  const v = V.movimentacao(mv, { de: T("2026-11-17T03:00:00Z"), ate: AGORA }); validar(v, "movimentação");
  const k = Object.fromEntries(v.resumo.map((x) => [x[0], x[2].numero ?? x[1]]));
  assert.equal(k["Lançamentos"], 5); assert.equal(k["Entradas"], 250); assert.equal(k["Saídas"], 90); assert.equal(k["Perdas"], 2); assert.equal(k["Saldo do período"], "+158", "200 − 60 − 30 − 2 + 50");
  const tempo = v.graficos.find((g) => g.tipo === "barras"); assert.equal(tempo.categorias.length, 7, "7 dias, com os dias sem lançamento em zero"); assert.equal(tempo.categorias.at(-1), "23/11");
  const ent = tempo.series.find((s) => s.rotulo === "Entradas"); assert.equal(ent.valores.reduce((a, b) => a + b, 0), 250); assert.equal(ent.valores[3], 200, "20/11 é o 4º dia");
  assert.ok(!tempo.series.some((s) => s.rotulo === "Ajustes"), "série sem nenhum valor não aparece");
  const rank = v.graficos.find((g) => g.tipo === "barrasH"); assert.deepEqual(rank.itens.map((i) => [i.rotulo, i.valor]), [["Meio-fio", 260], ["Tubo", 80], ["Boca de lobo", 2]]);
  assert.deepEqual(rank.itens[0].partes.map((p) => [p.rotulo, p.valor]), [["Entradas", 200], ["Saídas", 60]]);
  assert.deepEqual(v.colunas["Qtd"].valores, [200, -60, -30, -2, 50]); assert.equal(v.colunas["O que foi"].tons["Perda"], "erro");
  // um dia só: por hora
  const hoje = V.movimentacao([{ quando: T("2026-11-23T12:10:00Z"), produto: "A", tipo: "entrada", quantidade: 1 }, { quando: T("2026-11-23T17:40:00Z"), produto: "A", tipo: "saida", quantidade: -1 }]);
  assert.deepEqual(hoje.graficos[0].categorias, ["09h", "10h", "11h", "12h", "13h", "14h"], "09h a 14h de Brasília, hora a hora"); assert.match(hoje.graficos[0].titulo, /por hora/);
  // sem nada
  const vazio = V.movimentacao([]); assert.deepEqual(vazio.graficos, []); assert.equal(vazio.resumo.find((x) => x[0] === "Lançamentos")[2].numero, 0);
});

test("fila de notas: paradas, espera, vendedor e o limite marcado", () => {
  const notas = [{ numero: "48160", cliente: "Prefeitura de Itapetininga", vendedor: "Wesley", esperaMin: 200 }, { numero: "48156", cliente: "JB Obras", vendedor: "Fábio", esperaMin: 70 }, { numero: "48154", cliente: "Alfa", vendedor: "Wesley", esperaMin: 20 }];
  const v = V.fila(notas, { limiteMin: 120 }); validar(v, "fila");
  assert.deepEqual(v.resumo.map((x) => x[0]), ["Na fila", "Paradas", "Espera mais longa", "Espera média"]); assert.equal(v.resumo[1][2].numero, 1); assert.equal(v.resumo[1][2].tom, "erro"); assert.equal(v.resumo[2][1], "3 h 20 min");
  const g = v.graficos[0]; assert.deepEqual(g.itens.map((i) => [i.valor, i.tom]), [[200, "erro"], [70, "alerta"], [20, "info"]]); assert.ok(g.itens.every((i) => i.marca === 120)); assert.ok(g.itens[0].rotulo.length <= 32 && g.itens[0].rotulo.endsWith("…"));
  assert.deepEqual(v.graficos[1].fatias.map((f) => [f.rotulo, f.valor]), [["Wesley", 2], ["Fábio", 1]]);
  assert.deepEqual(V.fila([]).graficos, []); assert.equal(V.fila([]).resumo[2][1], "—");
});

test("cargas: % corretas, gráfico por dia, rosca e quem conferiu", () => {
  const cs = [{ quando: T("2026-11-21T12:00:00Z"), bateu: true, conferente: "Marcos" }, { quando: T("2026-11-21T15:00:00Z"), bateu: false, conferente: "Marcos", aMais: 2 }, { quando: T("2026-11-22T12:00:00Z"), bateu: true, conferente: "Bia" }, { quando: T("2026-11-23T12:00:00Z"), bateu: true, conferente: "Bia" }];
  const v = V.cargas(cs, { de: T("2026-11-21T03:00:00Z"), ate: AGORA }); validar(v, "cargas");
  const k = Object.fromEntries(v.resumo.map((x) => [x[0], x[2]])); assert.equal(k["Cargas"].numero, 4); assert.equal(k["Corretas"].numero, 3); assert.equal(k["Com diferença"].numero, 1); assert.equal(k["Cargas corretas"].numero, 75); assert.equal(k["Cargas corretas"].sufixo, "%"); assert.equal(k["Cargas corretas"].tom, "alerta"); assert.equal(k["Peças a mais"].numero, 2);
  const tempo = v.graficos[0]; assert.deepEqual(tempo.categorias, ["21/11", "22/11", "23/11"]); assert.deepEqual(tempo.series.find((s) => s.rotulo === "Corretas").valores, [1, 1, 1]); assert.deepEqual(tempo.series.find((s) => s.rotulo === "Com diferença").valores, [1, 0, 0]);
  assert.equal(v.graficos[1].centro.valor, "75%"); assert.deepEqual(v.graficos[1].fatias.map((f) => f.valor), [3, 1]);
  assert.deepEqual(v.graficos[2].itens.map((i) => [i.rotulo, i.valor]), [["Marcos", 2], ["Bia", 2]]);
  const todas = V.cargas([{ quando: T("2026-11-23T12:00:00Z"), bateu: true, conferente: "Bia" }]); assert.equal(todas.resumo.find((x) => x[0] === "Cargas corretas")[2].tom, "ok");
});

test("contagens, atividades, diferenças, equipe, resumo e cadastros", () => {
  const c = V.contagens([{ situacao: "aplicada", diferencas: [{ produto: "Tubo", diferenca: -3 }, { produto: "Guia", diferenca: 0 }] }, { situacao: "aguardando_aprovacao", diferencas: [{ produto: "Tubo", diferenca: 5 }] }, { situacao: "solicitada", diferencas: [] }, { situacao: "descartada" }]); validar(c, "contagens");
  assert.deepEqual(c.resumo.map((x) => x[2].numero), [4, 1, 1, 2]); assert.deepEqual(c.graficos[0].fatias.map((f) => f.rotulo), ["Pedida", "Aguardando decisão", "Aplicada", "Descartada"]); assert.deepEqual(c.graficos[1].itens[0].partes.map((p) => [p.rotulo, p.valor]), [["Tinha a mais", 5], ["Faltava", 3]]);
  const a = V.atividades([{ quando: T("2026-11-21T12:00:00Z"), quem: "Eduardo", categoria: "carga", nota: "1" }, { quando: T("2026-11-22T12:00:00Z"), quem: "Eduardo", categoria: "nota", nota: "2" }, { quando: T("2026-11-23T12:00:00Z"), quem: "José", categoria: "pessoa" }], { de: T("2026-11-21T03:00:00Z"), ate: AGORA }); validar(a, "atividades");
  assert.deepEqual(a.resumo.map((x) => x[2].numero), [3, 2, 2, 1]); assert.deepEqual(a.graficos[1].itens.map((i) => [i.rotulo, i.valor]), [["Eduardo", 2], ["José", 1]]); assert.deepEqual(a.graficos[2].fatias.map((f) => f.rotulo), ["Cargas", "Notas", "Pessoas"]);
  const d = V.diferencas([{ nome: "Meio-fio", ocorrencias: 3, aMais: 6, aMenos: 0 }, { nome: "Tubo", ocorrencias: 1, aMais: 0, aMenos: 2 }]); validar(d, "diferenças"); assert.deepEqual(d.resumo.map((x) => x[2].numero), [2, 4, 6, 2]); assert.equal(d.graficos[0].itens[0].rotulo, "Meio-fio");
  const e = V.equipe([{ nome: "Marcos", total: 10, divergentes: 2, duracaoMediaMin: 4 }, { nome: "Bia", total: 6, divergentes: 0, duracaoMediaMin: 2 }]); validar(e, "equipe"); assert.equal(e.resumo.find((x) => x[0] === "Tempo médio")[1], "3 min"); assert.deepEqual(e.graficos[0].itens[0].partes.map((p) => p.valor), [8, 2]);
  const r = V.resumo({ kpis: { total: 10, divergentes: 2, acertoPct: 80 }, semaforo: { cor: "amarelo", titulo: "Atenção", texto: "x" }, fila: { total: 3, paradas: 1 } }); validar(r, "resumo"); assert.equal(r.resumo[0][2].tom, "alerta"); assert.equal(r.graficos[0].centro.valor, "80%");
  assert.deepEqual(V.resumo({ kpis: { total: 0, divergentes: 0, acertoPct: null } }).graficos, [], "sem carga, sem rosca");
  const f = V.funcionarios([{ funcao: "Conferente", pode_entrar: true }, { funcao: "Conferente", pode_entrar: false }, { funcao: "Motorista", pode_entrar: true }]); validar(f, "funcionários"); assert.deepEqual(f.resumo.map((x) => x[2].numero), [3, 2, 1]);
  const ve = V.veiculos([{ tipo: "Truck", ativo: true, capacidade_t: 14 }, { tipo: "Truck", ativo: false, capacidade_t: 14 }, { tipo: "Toco", ativo: true, capacidade_t: 8 }]); validar(ve, "caminhões"); assert.equal(ve.resumo.find((x) => x[0] === "Capacidade somada")[1], "36 t");
  validar(V.sugestao([{}, {}]), "sugestão");
});

test("aplicar: junta o visual ao bloco, corta valores que passam das linhas e garante ao menos um número", () => {
  const bloco = { id: "x", titulo: "T", colunas: [{ rotulo: "Produto" }, { rotulo: "Saldo", dir: true }], linhas: [["A", "1"], ["B", "2"]], resumo: [["Produtos", "2"]], arquivo: "x" };
  const out = V.aplicar(bloco, { resumo: [V.k("Produtos", 2)], graficos: [], colunas: { Saldo: { visual: "barra", valores: [1, 2, 3] }, Outra: { visual: "estado" } } });
  assert.deepEqual(out.colunas[1].valores, [1, 2]); assert.equal(out.colunas[1].dir, true); assert.equal(out.colunas[0].visual, undefined); assert.equal(out.resumo[0][2].numero, 2); assert.equal(bloco.resumo[0].length, 2, "o original não muda");
  assert.equal(V.aplicar(bloco, null), bloco); assert.equal(V.garantir({ linhas: [[1], [2], [3]] }).resumo[0][2].numero, 3); assert.equal(V.garantir(bloco), bloco);
});

test("tempo: semanas quando o período é longo e nada quando não dá para desenhar", () => {
  const t = (d) => T(`2026-${d}T12:00:00Z`);
  const e = V.eixoTempo([t("09-01"), t("11-20")]); assert.equal(e.gran, "semana"); assert.ok(e.n >= 10 && e.n <= 60);
  assert.equal(V.eixoTempo([t("11-20")], {}).n, 1, "um ponto só: o gráfico fica de fora"); assert.equal(V.eixoTempo([]), null);
  assert.equal(V.eixoTempo([T("2025-01-01T12:00:00Z"), t("11-20")]), null, "mais de 60 semanas (quase 2 anos): não desenha");
});
