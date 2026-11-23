// Regras de pacote (assets/js/pacote.js): o que Básico, Intermediário e Premium ligam.
const test = require("node:test"); const assert = require("node:assert/strict");
const P = require("../assets/js/pacote.js");

test("os pacotes são cumulativos: cada um traz tudo do anterior", () => {
  const b = P.recursos("basico"), i = P.recursos("intermediario"), p = P.recursos("premium");
  assert.deepEqual(b, []);                                  // o Básico é o núcleo: nenhum recurso extra
  for (const r of i) assert.ok(p.includes(r), r);
  assert.deepEqual(p.slice().sort(), Object.keys(P.DESDE).sort());   // o Premium liga tudo
  assert.ok(i.length > 0 && i.length < p.length);
});

test("matriz: o que cada pacote tem", () => {
  const esperado = {
    basico: { estoque: 0, xml: 0, etiquetas: 0, resumo: 0, vendedor: 0, avisos: 0, planilhas: 0, videos: 0, ia: 0, historico: 0 },
    intermediario: { estoque: 1, xml: 1, etiquetas: 1, resumo: 1, vendedor: 1, avisos: 1, planilhas: 1, videos: 1, ia: 0, historico: 0 },
    premium: { estoque: 1, xml: 1, etiquetas: 1, resumo: 1, vendedor: 1, avisos: 1, planilhas: 1, videos: 1, ia: 1, historico: 1 },
  };
  for (const [pacote, linha] of Object.entries(esperado)) for (const [r, v] of Object.entries(linha)) assert.equal(P.tem(pacote, r), !!v, `${pacote}/${r}`);
});

test("recurso desconhecido é do núcleo (vale para todos); pacote desconhecido ou ausente não tira nada", () => {
  assert.equal(P.tem("basico", "conferencia"), true);
  for (const x of [undefined, null, "", "ouro", 7]) { assert.equal(P.tem(x, "ia"), true); assert.equal(P.tem(x, "estoque"), true); }
});

test("avisos: no Básico só os que nascem de uma ação; Intermediário e Premium recebem todos", () => {
  const ESSENCIAIS = ["saida_sem_nota", "divergencia_carga", "nota_nova", "senha_esquecida", "sistema"];
  const TODOS = ["estoque_negativo", "estoque_baixo", "contagem_divergente", "contagem_solicitada", "nota_parada", "fora_horario", "resumo_dia", "minha_carga_saiu", "minha_carga_diferenca", "minha_nota_parada"].concat(ESSENCIAIS);
  for (const t of ESSENCIAIS) assert.equal(P.avisoPermitido("basico", t), true, t);
  for (const t of TODOS.filter((x) => !ESSENCIAIS.includes(x))) { assert.equal(P.avisoPermitido("basico", t), false, t); assert.equal(P.avisoPermitido("intermediario", t), true, t); assert.equal(P.avisoPermitido("premium", t), true, t); }
  // todo aviso que existe no domínio é tratado (nenhum fica de fora da conta)
  const D = require("../assets/js/dominio.js");
  for (const t of Object.keys(D.TIPOS_ALERTA)) assert.ok(TODOS.includes(t), `aviso ${t} sem decisão de pacote`);
});

test("função vendedor só existe do Intermediário para cima", () => {
  assert.equal(P.funcaoDisponivel("basico", "vendedor"), false);
  assert.equal(P.funcaoDisponivel("intermediario", "vendedor"), true);
  assert.equal(P.funcaoDisponivel("premium", "vendedor"), true);
  for (const f of ["conferente", "ajudante", "motorista", "expedicao", "administrativo", "diretoria"]) assert.equal(P.funcaoDisponivel("basico", f), true, f);
});

test("nomes e rótulos: todo recurso tem rótulo e pacote de origem legível", () => {
  for (const r of Object.keys(P.DESDE)) { assert.ok(P.ROTULOS[r], `rótulo de ${r}`); assert.ok(["Intermediário", "Premium"].includes(P.pacoteDe(r)), r); }
  assert.deepEqual(P.ORDEM.map((x) => P.NOMES[x]), ["Básico", "Intermediário", "Premium"]);
});
