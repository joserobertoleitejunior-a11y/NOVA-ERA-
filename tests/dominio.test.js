const test = require("node:test"); const assert = require("node:assert/strict");
const D = require("../assets/js/dominio.js");
const AGORA = Date.UTC(2026, 10, 20, 15, 0); // sex 12:00 Brasília
const conf = (id, itens, extra = {}) => ({ id, criado_em: AGORA - 3600000, placa: "ABC1D23", numero_nota: "100", itens, conferente: { nome: "Ana" }, duracao_s: 120, ...extra });
const it = (d, n, c, pid = d) => ({ produto_id: pid, descricao: d, qtd_nota: n, qtd_carregada: c });

test("chave NF-e: DV e extração", () => {
  const base = "3526" + "11" + "12345678000195" + "55" + "001" + "000000123" + "1" + "12345678";
  const ch = base.slice(0, 0) + (("35" + "2611" + "12345678000195" + "55" + "001" + "000000123" + "1" + "12345678")); // 43
  assert.equal(ch.length, 43);
  const full = ch + D.dvChave(ch);
  assert.ok(D.validarChave(full));
  assert.ok(!D.validarChave(full.slice(0, 43) + ((D.dvChave(ch) + 1) % 10)));
  assert.equal(D.extrairChave("lixo " + D.formatarChave(full) + " fim"), full);
  assert.equal(D.interpretarChave(full).numero, "123");
});
test("analisar itens", () => {
  const a = D.analisarItens([it("A", 10, 12), it("B", 5, 3), it("C", 1, 1)]);
  assert.equal(a.aMais, 2); assert.equal(a.aMenos, 2); assert.equal(a.itensDif.length, 2);
});
test("pilhas", () => assert.equal(D.totalPilhas({ pilhas: 4, porPilha: 10, soltas: 3 }), 43));
test("casar produto", () => {
  const ps = [{ id: 1, nome: "Meio-fio", codigo: "MF" }, { id: 2, nome: "Boca de lobo" }, { id: 3, nome: "Tubo 400" }];
  assert.equal(D.casarProduto({ codigo: "mf", descricao: "x" }, ps).produto.id, 1);
  assert.equal(D.casarProduto({ descricao: "MEIO FIO 1m" }, ps).produto.id, 1);
  assert.equal(D.casarProduto({ descricao: "Boca-de-lobo grande" }, ps).produto.id, 2);
  assert.equal(D.casarProduto({ descricao: "Parafuso" }, ps).produto, null);
});
test("fuso e expediente", () => {
  assert.equal(D.horaTexto(AGORA), "12:00");
  assert.equal(D.chaveDia(Date.UTC(2026, 10, 20, 2, 0)), "2026-11-19"); // 23h de quinta em Brasília
  assert.ok(!D.foraDoExpediente(AGORA)); assert.ok(D.foraDoExpediente(Date.UTC(2026, 10, 22, 15, 0))); // domingo
  assert.ok(D.foraDoExpediente(Date.UTC(2026, 10, 20, 23, 0)));
});
test("alertas da conferência", () => {
  const n = { numero: "100" }; const c = conf("c1", [it("Meio-fio", 10, 12, 1)]);
  const al = D.alertasDaConferencia({ nota: n, conf: c, itens: c.itens, produtos: [{ id: 1, nome: "Meio-fio", unidade: "un", minimo: 20 }], saldosDepois: { 1: -2 }, config: {}, agora: AGORA });
  assert.deepEqual(al.map((x) => x.tipo).sort(), ["estoque_negativo", "saida_sem_nota"]);
  const ok = D.alertasDaConferencia({ nota: n, conf: conf("c2", [it("A", 1, 1, 1)]), itens: [it("A", 1, 1, 1)], produtos: [{ id: 1, nome: "A", minimo: 0 }], saldosDepois: { 1: 5 }, agora: AGORA });
  assert.equal(ok.length, 0);
});
test("destinatários respeitam preferências", () => {
  const p = [{ id: "a", papel: "admin" }, { id: "b", papel: "admin", alertas: ["estoque_baixo"] }, { id: "c", papel: "funcionario" }, { id: "d", papel: "admin", ativo: false }];
  assert.deepEqual(D.destinatarios("saida_sem_nota", p), ["a"]);
  assert.deepEqual(D.destinatarios("nota_nova", p), ["c"]);
});
test("varredura: nota parada, estoque, resumo", () => {
  const notas = [{ id: "n1", numero: "9", status: "pendente", criado_em: AGORA - 3 * 3600000 }, { id: "n2", numero: "10", status: "pendente", criado_em: AGORA - 600000 }];
  const al = D.alertasDaVarredura({ notas, saldos: [{ produto_id: 1, nome: "A", unidade: "un", saldo: 1, minimo: 5, ultima_contagem: null }], config: {}, agora: AGORA + 7 * 3600000 });
  assert.deepEqual(al.map((x) => x.tipo).sort(), ["estoque_baixo", "nota_parada", "nota_parada", "resumo_dia"]);
});
test("insights e semáforo", () => {
  const cs = [conf("1", [it("Meio-fio", 10, 12, 1)]), conf("2", [it("Meio-fio", 5, 5, 1)])];
  const r = D.resumoDoPeriodo({ conferencias: cs, notas: [], saldos: [], movimentos: [], contagens: [], agora: AGORA }, "hoje");
  assert.equal(r.kpis.total, 2); assert.equal(r.kpis.acertoPct, 50); assert.equal(r.semaforo.cor, "vermelho");
  const ok = D.resumoDoPeriodo({ conferencias: [cs[1]], notas: [], saldos: [], agora: AGORA }, "hoje");
  assert.equal(ok.semaforo.cor, "verde");
  const vazio = D.resumoDoPeriodo({ conferencias: [], agora: AGORA }, "hoje");
  assert.equal(vazio.semaforo.cor, "verde");
});
test("estoque: saldos, cobertura e contagem sugerida", () => {
  const ps = [{ id: 1, nome: "A", unidade: "un", minimo: 10 }, { id: 2, nome: "B", unidade: "un", minimo: 0 }];
  const mov = [{ produto_id: 1, tipo: "entrada", quantidade: 100, criado_em: AGORA - 20 * D.DIA }, { produto_id: 1, tipo: "saida", quantidade: -70, criado_em: AGORA - D.DIA }, { produto_id: 2, tipo: "saida", quantidade: -3, criado_em: AGORA - D.DIA }];
  const s = D.calcularSaldos(ps, mov, []);
  assert.equal(s[0].saldo, 30); assert.equal(s[1].saldo, -3);
  assert.equal(D.coberturaDias(1, mov, 30, AGORA), 6);
  const sug = D.sugerirContagem({ saldos: s, movimentos: mov, conferencias: [], config: {}, agora: AGORA });
  assert.equal(sug[0].produto_id, 2); // negativo vem primeiro
});
test("contagem: alerta só com diferença", () => {
  assert.equal(D.alertasDaContagem({ contagem: { id: "x" }, itens: [{ produto_id: 1, diferenca: 0 }], produtos: [] }).length, 0);
  assert.equal(D.alertasDaContagem({ contagem: { id: "x" }, itens: [{ produto_id: 1, diferenca: -8, esperado: 20 }], produtos: [{ id: 1, nome: "A" }] })[0].severidade, "critico");
});
test("assistente local", () => {
  const ctx = { conferencias: [conf("1", [it("Meio-fio", 10, 12, 1)])], notas: [], saldos: [{ produto_id: 1, nome: "Meio-fio", unidade: "un", saldo: 4, minimo: 10, ultima_contagem: null }], movimentos: [], contagens: [], agora: AGORA };
  assert.match(D.responderLocal("o que saiu a mais hoje?", ctx).texto, /Meio-fio: \+2/);
  assert.match(D.responderLocal("estoque baixo", ctx).texto, /Meio-fio/);
  assert.match(D.responderLocal("qual a receita de bolo de cenoura", ctx).texto, /só ajudo com a Nova Era/);
  assert.match(D.responderLocal("o que significa o semáforo do painel?", ctx).texto, /Como ler o painel/);
  assert.match(D.responderLocal("explica como funciona o estoque", ctx).texto, /Como funciona o estoque/);
});
test("assistente local: diz o que dá para imprimir (e nada quando não há o que mostrar)", () => {
  const ctx = { conferencias: [conf("1", [it("Meio-fio", 10, 12, 1)]), conf("2", [it("Tubo", 5, 3, 2)], { conferente: { nome: "Bia" } })],
    notas: [{ id: "n1", numero: "48172", cliente: "JB Obras", status: "pendente", criado_em: AGORA - 3 * D.HORA, itens: [] }],
    saldos: [{ produto_id: 1, nome: "Meio-fio", unidade: "un", saldo: 4, minimo: 10, ultima_contagem: null }],
    movimentos: [{ produto_id: 1, tipo: "entrada", quantidade: 100, criado_em: AGORA - 2 * D.HORA }, { produto_id: 1, tipo: "saida", quantidade: -60, criado_em: AGORA - 1 * D.HORA }, { produto_id: 1, tipo: "perda", quantidade: -2, criado_em: AGORA - 1 * D.HORA }, { produto_id: 1, tipo: "entrada", quantidade: 999, criado_em: AGORA - 40 * D.DIA }], contagens: [], agora: AGORA };
  const imp = (q) => D.responderLocal(q, ctx).imprimir;
  assert.deepEqual(imp("estoque baixo"), { tipo: "estoque" });
  assert.deepEqual(imp("quais notas estão paradas na fila?"), { tipo: "fila" });
  assert.deepEqual(imp("o que saiu a mais hoje?"), { tipo: "diferencas", chave: "hoje", sentido: "mais" });
  assert.deepEqual(imp("o que faltou esta semana?"), { tipo: "diferencas", chave: "7d", sentido: "menos" });
  assert.deepEqual(imp("resumo do dia"), { tipo: "resumo", chave: "hoje" });
  assert.deepEqual(imp("quem conferiu hoje?"), { tipo: "equipe", chave: "hoje" });
  assert.deepEqual(imp("o que contar hoje?"), { tipo: "contar" });
  // movimentação: o texto conta só o período perguntado (a entrada de 40 dias atrás fica de fora) e oferece imprimir
  const mov = D.responderLocal("movimentação do estoque de hoje", ctx);
  assert.match(mov.texto, /Movimentação do estoque hoje: 3 lançamentos/); assert.match(mov.texto, /Entradas: 100/); assert.match(mov.texto, /Saídas: 60/); assert.match(mov.texto, /Perdas: 2/);
  assert.deepEqual(mov.imprimir, { tipo: "movimentacao", chave: "hoje" });
  assert.equal(D.responderLocal("movimentação do estoque de ontem", ctx).imprimir, undefined, "sem lançamentos no período: nada para imprimir");
  // sem o que mostrar, sem o que imprimir
  assert.equal(D.responderLocal("qual a receita de bolo de cenoura", ctx).imprimir, undefined);
  assert.equal(D.responderLocal("explica como funciona o estoque", ctx).imprimir, undefined);
  assert.equal(D.responderLocal("o que saiu a mais hoje?", { ...ctx, conferencias: [] }).imprimir, undefined);
  assert.equal(D.responderLocal("estoque baixo", { ...ctx, saldos: [{ produto_id: 1, nome: "Meio-fio", unidade: "un", saldo: 50, minimo: 10, ultima_contagem: null }] }).imprimir, undefined);
});
test("csv escapa", () => assert.match(D.csv(["a"], [['x;"y']]), /"x;""y"/));
