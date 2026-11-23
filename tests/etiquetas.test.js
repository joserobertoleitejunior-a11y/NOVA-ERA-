// Etiquetas: o padrão cabe em todo tamanho de papel, o QR é legível e o que o QR diz é o que o app entende ao ler.
const test = require("node:test"); const assert = require("node:assert/strict");
require("../assets/js/codigos.js");
const K = require("../assets/js/codigos.js");
const Dados = require("../assets/js/etiqueta-dados.js");
const Lay = require("../assets/js/etiqueta-layout.js");
const qrcode = require("../assets/vendor/qrcode.js");

const BASE = "https://joserobertoleitejunior-a11y.github.io/NOVA-ERA-/";
const TOKEN = "3f9a1c2e-1111-4222-8333-444455556666";
const PROD = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
// Medidor conservador (letra larga): se cabe com ele, cabe em qualquer fonte sem serifa parecida com a do app
const medir = (t, s, neg) => String(t).length * s * (neg ? 0.64 : 0.58);
const modulos = (texto, nivel) => { const q = qrcode(0, nivel); q.addData(texto); q.make(); return q.getModuleCount(); };

const conferencia = { numero_nota: "48213", token_publico: TOKEN, placa: "ABC1D23", cliente: "Construtora Alfa Engenharia e Obras Ltda", criado_em: "2026-11-23T15:00:00Z",
  itens: [{ descricao: "Meio-fio 30 x 12 x 100 reforçado", qtd_carregada: 60 }, { descricao: "Boca de lobo", qtd_carregada: 4 }, { descricao: "Tubo de concreto armado ponta e bolsa DN 1000 PA-2 classe 3", qtd_carregada: 12 }] };
const nota = { tipo: "nota", numero: "48214", token_publico: TOKEN, vendedor: "Wesley Costa", cliente: "JB Obras", criado_em: "2026-11-23T15:00:00Z", itens: [{ descricao: "Aduela", quantidade: 6 }] };
const produto = { id: PROD, nome: "Caixa para galeria 1,50 x 1,50 x 1,00 m com misula e tampa", codigo: "CXG-150", unidade: "un", minimo: 5, por_pilha: 2 };
const pessoa = { nome: "Maria Aparecida de Souza Lima", usuario: "maria.lima", senha: "carga4821", funcao: "conferente" };

const especs = () => [
  ...Dados.daNota(conferencia, { modo: "item", base: BASE }), ...Dados.daNota(conferencia, { modo: "peca", base: BASE }).slice(0, 3), ...Dados.daNota(nota, { modo: "item", base: BASE }),
  ...Dados.doProduto(produto, { base: BASE }), ...Dados.deAcesso(pessoa, { link: `${BASE}boas-vindas.html#${Buffer.from(JSON.stringify({ n: pessoa.nome, u: pessoa.usuario, s: pessoa.senha, f: "conferente", k: "premium" })).toString("base64url")}`, funcaoRotulo: "Conferente" }),
];

test("códigos: o QR da peça, da nota e do produto voltam inteiros ao serem lidos", () => {
  const peca = K.interpretar(K.nota(BASE, TOKEN, "2-17")); assert.deepEqual(peca, { tipo: "peca", token: TOKEN, p: "2-17", idx: 2, k: 17 });
  assert.deepEqual(K.interpretar(K.nota(BASE, TOKEN)), { tipo: "nota", token: TOKEN });
  assert.deepEqual(K.interpretar(K.produto(BASE, PROD)), { tipo: "produto", id: PROD });
  // etiquetas antigas (código em maiúsculas, endereço de outro site) continuam valendo
  assert.equal(K.interpretar(`https://outro.site/x/rastreio.html?c=${TOKEN.toUpperCase()}&p=0-1`).token, TOKEN);
});
test("códigos: o que se digita à mão e o que não é nosso", () => {
  assert.deepEqual(K.interpretar("48213"), { tipo: "numero", numero: "48213" });
  assert.deepEqual(K.interpretar("  NF 48213 "), { tipo: "numero", numero: "48213" });
  assert.equal(K.interpretar("nota: 77").numero, "77");
  assert.equal(K.interpretar("P-9B1DEB4D").tipo, "codigo");
  assert.equal(K.interpretar("").tipo, "vazio"); assert.equal(K.interpretar(null).tipo, "vazio");
  assert.equal(K.interpretar("https://www.google.com/search?q=oi").tipo, "desconhecido");
  assert.equal(K.interpretar(`${BASE}rastreio.html?c=nao-e-codigo`).tipo, "desconhecido");
  assert.deepEqual(K.interpretar(K.produto(BASE, "p3")), { tipo: "produto", id: "p3" }, "a demonstração usa código curto de produto");
  assert.equal(K.interpretar(`${BASE}app.html#u=maria`).tipo, "desconhecido", "link de boas-vindas não é produto");
  assert.equal(K.interpretar("texto qualquer 123").tipo, "codigo");
});
test("códigos: código curto do produto casa com o começo do id, o código do cadastro e nada mais", () => {
  assert.equal(K.codigoCurto.produto(PROD), "P-9B1DEB4D");
  assert.ok(K.casaProduto("P-9B1DEB4D", { id: PROD })); assert.ok(K.casaProduto("9b1deb4d", { id: PROD })); assert.ok(K.casaProduto("cxg-150", { id: PROD, codigo: "CXG-150" }));
  assert.ok(!K.casaProduto("9b1d", { id: PROD }), "curto demais para não confundir"); assert.ok(!K.casaProduto("ffffffff", { id: PROD })); assert.ok(!K.casaProduto("", { id: PROD }));
  assert.equal(K.codigoCurto.peca("48213", 3, 40), "NF 48213 · 3/40");
});

test("dados: uma etiqueta por produto (com cópias) e uma por peça (numerada), cada uma com o QR certo", () => {
  const itens = Dados.daNota(conferencia, { modo: "item", copias: 2, base: BASE }); assert.equal(itens.length, 6);
  assert.deepEqual(itens[0].cab, ["NF 48213", "QTD 60"]); assert.equal(K.interpretar(itens[0].qr.texto).tipo, "nota"); assert.equal(itens[0].qr.codigo, "NF 48213");
  const pecas = Dados.daNota(conferencia, { modo: "peca", base: BASE }); assert.equal(pecas.length, 76);
  assert.deepEqual(pecas[0].cab, ["NF 48213", "PEÇA 1 DE 60"]); assert.equal(pecas[0].qr.codigo, "NF 48213 · 1/60");
  assert.deepEqual(K.interpretar(pecas[75].qr.texto), { tipo: "peca", token: TOKEN, p: "2-12", idx: 2, k: 12 }); assert.deepEqual(pecas[75].cab, ["NF 48213", "PEÇA 12 DE 12"]);
  assert.equal(new Set(pecas.map((p) => p.qr.texto)).size, 76, "cada peça tem um QR diferente");
  const n = Dados.daNota(nota, { modo: "item", base: BASE })[0]; assert.deepEqual(n.campos.map((c) => c[0]), ["Cliente", "Vendedor", "Data"], "nota sem caminhão mostra o vendedor");
  assert.deepEqual(Dados.daNota(conferencia, { modo: "item", base: BASE })[0].campos.map((c) => c[0]), ["Cliente", "Caminhão", "Data"]);
  const p = Dados.doProduto(produto, { base: BASE, copias: 3 }); assert.equal(p.length, 3); assert.deepEqual(p[0].cab, ["PRODUTO", "PILHA DE 2"]); assert.deepEqual(K.interpretar(p[0].qr.texto), { tipo: "produto", id: PROD });
  assert.equal(Dados.daNota({ ...conferencia, itens: [] }, { modo: "peca", base: BASE }).length, 0);
});

test("layout: tudo cabe dentro da etiqueta, em todos os tamanhos e tipos (nomes longos incluídos)", () => {
  for (const f of Object.values(Lay.FORMATOS)) for (const e of especs()) {
    const lay = Lay.layout(e, f, medir); const tag = `${f.id}/${e.tipo}/${e.cab[1]}`;
    for (const i of lay.itens) {
      if (i.k === "r") { assert.ok(i.x >= -0.01 && i.y >= -0.01 && i.x + i.w <= f.w + 0.01 && i.y + i.h <= f.h + 0.01, `${tag}: retângulo fora`); }
      if (i.k === "q") { assert.ok(i.x >= 0 && i.y >= 0 && i.x + i.size <= f.w + 0.01 && i.y + i.size <= f.h + 0.01, `${tag}: QR fora (${i.x},${i.y},${i.size})`); }
      if (i.k === "t") {
        const w = medir(i.t, i.s, i.b); const x0 = i.a === "end" ? i.x - w : i.a === "middle" ? i.x - w / 2 : i.x;
        assert.ok(x0 >= -0.01 && x0 + w <= f.w + 0.01, `${tag}: texto "${i.t}" passa da borda (${x0.toFixed(1)}..${(x0 + w).toFixed(1)} de ${f.w})`);
        assert.ok(i.y <= f.h + 0.01 && i.y - i.s >= -0.5, `${tag}: texto "${i.t}" fora na vertical (y=${i.y.toFixed(1)})`);
      }
    }
  }
});

test("layout: margem de segurança de 2 mm para a impressora térmica não cortar nada", () => {
  for (const f of Object.values(Lay.FORMATOS)) for (const e of especs()) {
    const lay = Lay.layout(e, f, medir);
    for (const i of lay.itens) {
      if (i.k === "r") assert.ok(i.x >= 1.99 && i.y >= 1.99 && i.x + i.w <= f.w - 1.99, `${f.id}/${e.tipo}: faixa colada na borda`);
      if (i.k === "q") assert.ok(i.x + (i.size / 2) * 0 >= 1.9 && i.x + i.size <= f.w - 1.9 && i.y + i.size <= f.h - 1.9, `${f.id}/${e.tipo}: QR colado na borda`);
    }
  }
});

test("layout: nenhuma forma sobrepõe outra de outro tipo (texto sobre texto, texto sobre QR)", () => {
  const caixa = (i, f) => { if (i.k === "q") return [i.x, i.y, i.x + i.size, i.y + i.size]; const w = medir(i.t, i.s, i.b); const x0 = i.a === "end" ? i.x - w : i.a === "middle" ? i.x - w / 2 : i.x; return [x0, i.y - i.s * 0.75, x0 + w, i.y + i.s * 0.2]; };
  const bate = (a, b) => a[0] < b[2] - 0.05 && b[0] < a[2] - 0.05 && a[1] < b[3] - 0.05 && b[1] < a[3] - 0.05;
  for (const f of Object.values(Lay.FORMATOS)) for (const e of especs()) {
    const lay = Lay.layout(e, f, medir); const formas = lay.itens.filter((i) => i.k === "q" || (i.k === "t" && i.c !== Lay.BRANCO));   // texto branco está sobre a faixa preta de propósito
    for (let a = 0; a < formas.length; a++) for (let b = a + 1; b < formas.length; b++) if (e.tipo !== "teste") assert.ok(!bate(caixa(formas[a]), caixa(formas[b])), `${f.id}/${e.tipo}/${e.cab[1]}: "${formas[a].t || "QR"}" bate em "${formas[b].t || "QR"}"`);
  }
});

test("QR legível: em todo tamanho o módulo tem pelo menos 0,38 mm (3 pontos a 203 dpi) e a etiqueta padrão passa de 0,5 mm", () => {
  const piores = {};
  for (const f of Object.values(Lay.FORMATOS)) for (const e of especs()) {
    if (e.tipo === "acesso" && !Lay.formatosPara("acesso").includes(f)) continue;   // o cartão de acesso (QR de ~190 caracteres) só é oferecido em etiqueta maior
    const lay = Lay.afinarQr(Lay.layout(e, f, medir), modulos); const l = Lay.legibilidade(lay, modulos, 203);
    assert.ok(l.ok, `${f.id}/${e.tipo}: módulo de ${l.moduloMm.toFixed(2)} mm (${l.pontos.toFixed(1)} pontos) é pequeno demais`);
    if (e.tipo !== "acesso") piores[f.id] = Math.min(piores[f.id] ?? 9, l.moduloMm);   // o cartão tem QR longo: só precisa passar do mínimo
  }
  assert.ok(piores.t100x50 >= 0.5, `100×50: ${piores.t100x50}`); assert.ok(piores.t100x150 >= 1.0); assert.ok(piores.a4x10 >= 0.5);
});

test("QR legível: o nível de correção cai de M para L só quando isso salva o tamanho do módulo", () => {
  const url = K.nota(BASE, TOKEN, "12-34");
  assert.equal(Lay.nivelDoQr(url, 30, modulos), "M", "etiqueta grande fica com a correção maior");
  assert.equal(Lay.nivelDoQr(url, 17, modulos), "L", "etiqueta pequena troca por menos módulos");
  assert.equal(Lay.nivelDoQr("NE", 17, modulos), "M");
});

test("texto: encolhe antes de cortar, quebra em linhas e só usa reticências em último caso", () => {
  const a = Lay.ajustar(medir, "Meio-fio", { largura: 60, tamanho: 6, minimo: 3, linhas: 2, negrito: true }); assert.equal(a.tamanho, 6); assert.deepEqual(a.linhas, ["Meio-fio"]);
  const b = Lay.ajustar(medir, "Tubo de concreto armado ponta e bolsa", { largura: 40, tamanho: 6, minimo: 3, linhas: 2, negrito: true }); assert.ok(b.tamanho < 6 && b.linhas.length <= 2 && !b.linhas.join("").includes("…"));
  const c = Lay.ajustar(medir, "x".repeat(200), { largura: 30, tamanho: 6, minimo: 3, linhas: 2, negrito: true }); assert.ok(c.linhas.at(-1).endsWith("…") && c.linhas.length <= 2 && medir(c.linhas.at(-1), c.tamanho, true) <= 30.01);
  assert.deepEqual(Lay.ajustar(medir, "", { largura: 30, tamanho: 6, minimo: 3 }).linhas, []);
  assert.ok(Lay.quebrar(medir, "Supercalifragilisticexpialidocious", 20, 5, false).every((l) => medir(l, 5, false) <= 20.01), "palavra gigante é cortada por letras");
});

test("folhas: A4 de 10 etiquetas leva 10 por página, 'pular' reaproveita folha usada e rolo é uma por página", () => {
  const base = especs(); const lays = Array.from({ length: 25 }, (_, i) => Lay.layout(base[i % base.length], Lay.FORMATOS.a4x10, medir));
  const p = Lay.paginar(lays, Lay.FORMATOS.a4x10, 0); assert.deepEqual(p.map((x) => x.itens.length), [10, 10, 5]);
  assert.deepEqual([p[0].itens[0].x, p[0].itens[0].y, p[0].itens[1].x, p[0].itens[2].y], [6, 6, 105, 63], "grade 2 colunas: 99 mm de largura, 57 de altura");
  const q = Lay.paginar(lays.slice(0, 4), Lay.FORMATOS.a4x10, 3); assert.equal(q[0].itens.length, 4); assert.deepEqual([q[0].itens[0].x, q[0].itens[0].y], [105, 63], "começa na 4ª posição: 2ª coluna da 2ª linha");
  const r = Lay.paginar(lays.slice(0, 3), Lay.FORMATOS.t100x50); assert.equal(r.length, 3); assert.deepEqual([r[0].w, r[0].h], [100, 50]);
  const f = Lay.FORMATOS.a4x24; const ult = Lay.paginar(Array(24).fill(lays[0]), f)[0].itens.at(-1); assert.ok(ult.x + f.w <= 210 && ult.y + f.h <= 297, "a última etiqueta da folha de 24 cabe no papel");
  for (const fo of Object.values(Lay.FORMATOS)) if (fo.tipo === "folha") assert.ok(fo.margemX * 2 + fo.colunas * fo.w <= 210.01 && fo.margemY * 2 + fo.linhas * fo.h <= 297.01, `${fo.id} cabe no A4`);
});
