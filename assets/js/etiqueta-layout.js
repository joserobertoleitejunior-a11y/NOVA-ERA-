// LAYOUT das etiquetas: onde fica cada coisa, em milímetros. Só cálculo (sem tela, sem impressora), por isso é testado em Node.
// O resultado é uma lista de formas (retângulo, texto, QR, linha) que três desenhistas sabem pintar:
// SVG (prévia e impressão do aparelho), canvas (PDF, imagem e impressora direta) — assim o que se vê é o que sai.
//
// O PADRÃO DA ETIQUETA (igual em todo tamanho, sem cor: sai bem em impressora térmica preto e branco)
//   1. FAIXA PRETA no alto ........ o que é + número: "NF 48213" à esquerda, "PEÇA 3 DE 40" ou "QTD 40" à direita
//   2. NOME GRANDE ................ o produto (ou a pessoa, no cartão de acesso)
//   3. CAMPOS PEQUENOS ............ CLIENTE · CAMINHÃO · DATA, sempre com o título em cima e o dado embaixo
//   4. QR CODE com a legenda ...... "LER NO APP" e o código curto embaixo (dá para digitar se o QR rasgar)
//   5. RODAPÉ ..................... "NOVA ERA · CONFERE CARGA"
(function (raiz) {
  "use strict";

  const PRETO = "#000", BRANCO = "#fff";
  const FAMILIA = '"Archivo NE", Arial, Helvetica, sans-serif';
  const MODULO_MIN_MM = 0.38;     // abaixo disso o QR deixa de ser confiável em impressora de 203 dpi (menos de 3 pontos por módulo)
  const MODULO_BOM_MM = 0.5;      // a partir daqui lê fácil, até com a câmera a uma distância de braço

  // ───────────── tamanhos de papel ─────────────
  // rolo: uma etiqueta por página (o tamanho da página é o da etiqueta). folha: A4 com várias etiquetas, cada uma no seu retângulo.
  const FORMATOS = {
    t100x50:  { id: "t100x50", rotulo: "Térmica 100 × 50 mm", dica: "Rolo de etiqueta: Zebra, Elgin, Argox, TSC e parecidas", tipo: "rolo", w: 100, h: 50 },
    t100x150: { id: "t100x150", rotulo: "Térmica 100 × 150 mm", dica: "Etiqueta grande, com o QR bem grande", tipo: "rolo", w: 100, h: 150 },
    t60x40:   { id: "t60x40", rotulo: "Térmica 60 × 40 mm", dica: "Etiqueta pequena de rolo", tipo: "rolo", w: 60, h: 40 },
    t50x30:   { id: "t50x30", rotulo: "Térmica 50 × 30 mm", dica: "Etiqueta mínima: só o essencial", tipo: "rolo", w: 50, h: 30 },
    a4x10:    { id: "a4x10", rotulo: "Folha A4 · 10 por folha", dica: "Impressora comum, folha de etiquetas 99 × 57 mm", tipo: "folha", w: 99, h: 57, pagina: { w: 210, h: 297 }, colunas: 2, linhas: 5, margemX: 6, margemY: 6 },
    a4x24:    { id: "a4x24", rotulo: "Folha A4 · 24 por folha", dica: "Impressora comum, folha de etiquetas 63,5 × 33,9 mm", tipo: "folha", w: 63.5, h: 33.9, pagina: { w: 210, h: 297 }, colunas: 3, linhas: 8, margemX: 9.75, margemY: 12.9 },
    a4cheio:  { id: "a4cheio", rotulo: "Folha A4 · uma por folha", dica: "Impressora comum, etiqueta grande em papel comum", tipo: "folha", w: 190, h: 140, pagina: { w: 210, h: 297 }, colunas: 1, linhas: 2, margemX: 10, margemY: 6 },
  };
  const FORMATO_PADRAO = "t100x50";
  // O cartão de acesso leva um QR longo (link de boas-vindas): só cabe com folga em etiqueta maior
  const formatosPara = (tipo) => Object.values(FORMATOS).filter((f) => tipo !== "acesso" || f.w >= 90);
  const personalizado = (w, h) => ({ id: "outro", rotulo: `Outro tamanho · ${w} × ${h} mm`, dica: "Tamanho que você digitou", tipo: "rolo", w, h });
  const porPagina = (f) => (f.tipo === "folha" ? f.colunas * f.linhas : 1);

  // ───────────── formas ─────────────
  const R = (x, y, w, h, f = PRETO) => ({ k: "r", x, y, w, h, f });
  const L = (x1, y1, x2, y2, sw = 0.25) => ({ k: "l", x1, y1, x2, y2, sw });
  const T = (x, y, t, s, o = {}) => ({ k: "t", x, y, t: String(t), s, b: !!o.b, a: o.a || "start", c: o.c || PRETO });
  const Q = (x, y, size, texto, quiet = 4, nivel = "M") => ({ k: "q", x, y, size, texto, quiet, nivel });

  // ───────────── texto que cabe ─────────────
  function elipse(medir, texto, largura, s, neg) {
    let t = String(texto);
    while (t.length > 1 && medir(`${t}…`, s, neg) > largura) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }
  function quebrar(medir, texto, largura, s, neg) {
    const linhas = []; let atual = "";
    for (const palavra of String(texto).split(" ")) {
      const tent = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tent, s, neg) <= largura) { atual = tent; continue; }
      if (atual) { linhas.push(atual); atual = ""; }
      if (medir(palavra, s, neg) <= largura) { atual = palavra; continue; }
      let pedaco = "";                                    // palavra maior que a linha: corta por letras
      for (const ch of palavra) { if (pedaco && medir(pedaco + ch, s, neg) > largura) { linhas.push(pedaco); pedaco = ch; } else pedaco += ch; }
      atual = pedaco;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }
  // Escolhe o maior tamanho em que o texto cabe em `linhas` linhas; se nem no menor couber, corta com reticências.
  function ajustar(medir, texto, { largura, tamanho, minimo, linhas = 1, negrito = false }) {
    const t = String(texto == null ? "" : texto).trim().replace(/\s+/g, " ");
    if (!t) return { linhas: [], tamanho };
    for (let s = Math.max(tamanho, minimo); s >= minimo - 1e-6; s -= 0.2) {   // se o tamanho pedido é menor que o mínimo, vale o mínimo (e só corta se nem assim couber)
      const ls = quebrar(medir, t, largura, s, negrito);
      if (ls.length <= linhas) return { linhas: ls, tamanho: Math.round(s * 100) / 100 };
    }
    const ls = quebrar(medir, t, largura, minimo, negrito).slice(0, linhas);
    ls[ls.length - 1] = elipse(medir, ls[ls.length - 1], largura, minimo, negrito);
    return { linhas: ls, tamanho: minimo };
  }

  // ───────────── blocos comuns ─────────────
  // Faixa preta com o que é a etiqueta. Escreve branco sobre preto: não depende de cor nem de cinza.
  function faixa({ x, y, w, h, esq, dir, tamEsq, tamDir, medir }) {
    const itens = [R(x, y, w, h)]; const pad = Math.max(1.2, h * 0.2); const livre = w - 2 * pad;
    let dirT = dir ? String(dir) : ""; let sd = tamDir;
    while (dirT && sd > h * 0.3 && medir(dirT, sd, true) > livre * 0.55) sd -= 0.2;
    if (dirT && medir(dirT, sd, true) > livre * 0.55) dirT = elipse(medir, dirT, livre * 0.55, sd, true);
    const wd = dirT ? medir(dirT, sd, true) + pad : 0;
    let esqT = String(esq || ""); let se = tamEsq;
    while (se > h * 0.36 && medir(esqT, se, true) > livre - wd) se -= 0.2;
    if (medir(esqT, se, true) > livre - wd) esqT = elipse(medir, esqT, livre - wd, se, true);
    itens.push(T(x + pad, y + h / 2 + se * 0.36, esqT, se, { b: true, c: BRANCO }));
    if (dirT) itens.push(T(x + w - pad, y + h / 2 + sd * 0.36, dirT, sd, { b: true, a: "end", c: BRANCO }));
    return itens;
  }
  // Campo pequeno: título em cima (maiúsculas) e o dado embaixo. Devolve as formas e a altura que ocupou.
  function campo({ x, y, w, rotulo, valor, tc, tv, medir }) {
    const v = ajustar(medir, valor, { largura: w, tamanho: tv, minimo: Math.max(2.2, tv * 0.62), linhas: 1, negrito: true });
    if (!v.linhas.length) return { itens: [], h: 0 };
    const yc = y + tc * 0.78; const yv = yc + v.tamanho + 0.2;
    return { itens: [T(x, yc, String(rotulo).toUpperCase(), tc, { b: true }), T(x, yv, v.linhas[0], v.tamanho, { b: true })], h: yv - y + 0.45 };
  }
  const rodapeMarca = (x, y, medir, s) => T(x, y, "NOVA ERA · CONFERE CARGA", s, { b: true });

  // QR com legenda (“LER NO APP” + código curto). `lado` = quadrado inteiro, já contando a margem branca (4 módulos) em volta.
  function blocoQR({ x, y, lado, texto, legenda, codigo, tl, tc, nivel }) {
    const itens = [Q(x, y, lado, texto, 4, nivel || "M")];
    if (legenda) itens.push(T(x + lado / 2, y + lado + tl, legenda, tl, { b: true, a: "middle" }));
    if (codigo) itens.push(T(x + lado / 2, y + lado + tl + tc * 1.25, codigo, tc, { b: true, a: "middle" }));
    return itens;
  }

  // ───────────── modelos ─────────────
  // spec: { tipo, cab: [esquerda, direita], nome, campos: [[rotulo, valor], …], qr: { texto, codigo }, legenda }
  function horizontal(spec, W, H, medir) {
    const u = Math.min(W / 100, H / 50); const itens = [];
    const m = Math.max(2, 2.2 * u); const barH = Math.max(5.4, 8.6 * u);
    itens.push(...faixa({ x: m, y: m, w: W - 2 * m, h: barH, esq: spec.cab[0], dir: spec.cab[1], tamEsq: barH * 0.62, tamDir: barH * 0.5, medir }));
    const topo = m + barH + 1.2 * u; const comLegenda = W >= 60 && !!spec.legenda;
    const legH = comLegenda ? 2.4 * u + (spec.qr.codigo ? 2.1 * u * 1.25 : 0) + 0.8 : 0;   // sem código curto (cartão de acesso) a linha dele não ocupa lugar: o QR cresce
    const lado = Math.max(8, Math.min(H - topo - m - legH, W < 70 ? W * 0.46 : W * 0.37));   // etiqueta pequena: o QR ganha mais espaço, porque é ele que não pode ficar miúdo
    const xq = W - m - lado; const tw = xq - 1.6 * u - m;
    itens.push(...blocoQR({ x: xq, y: topo, lado, texto: spec.qr.texto, legenda: comLegenda ? spec.legenda : "", codigo: comLegenda ? spec.qr.codigo : "", tl: 2.4 * u, tc: 2.1 * u, nivel: spec.qr.nivel }));
    // nome grande
    const nome = ajustar(medir, spec.nome, { largura: tw, tamanho: 6.4 * u, minimo: Math.max(2.8, 3.4 * u), linhas: H >= 28 ? 2 : 1, negrito: true });
    let y = topo + nome.tamanho * 0.8;
    for (const ln of nome.linhas) { itens.push(T(m, y, ln, nome.tamanho, { b: true })); y += nome.tamanho * 1.08; }
    y += 0.5 * u - nome.tamanho * 0.08 + 0.2;
    // campos pequenos. Etiqueta de nota: o primeiro (cliente) ocupa a linha toda e os outros dividem a de baixo.
    // Cartão de acesso (spec.emLinha): usuário e senha lado a lado, os dois importam igual.
    const tc = Math.max(1.5, 2.0 * u), tv = Math.max(2.2, 3.5 * u); const fim = H - m - (u >= 0.6 ? 2.4 * u : 0) - 0.4; const altura = tc * 0.78 + tv + 0.65;   // letra miúda demais não sai na térmica: títulos >= 1,5 mm, dados >= 2,2 mm
    // etiqueta pequena: data com ano de 2 dígitos (23/11/26) para não ser cortada
    const curto = (v) => (W < 70 && /^\d{2}\/\d{2}\/\d{4}$/.test(String(v)) ? String(v).replace(/\/\d{2}(\d{2})$/, "/$1") : v);
    const campos = (spec.campos || []).filter(([, v]) => v);
    let linha;
    if (spec.emLinha) linha = campos.slice(0, 3);
    else { const [c1, ...resto] = campos; if (c1) { const c = campo({ x: m, y, w: tw, rotulo: c1[0], valor: curto(c1[1]), tc, tv, medir }); if (y + c.h <= fim) { itens.push(...c.itens); y += c.h + 1.4 * u; } } linha = resto.slice(0, 2); }
    if (linha.length && y + altura <= fim) {
      const larg = (tw - 2 * u * (linha.length - 1)) / linha.length;
      linha.forEach(([r, v], i) => itens.push(...campo({ x: m + i * (larg + 2 * u), y, w: larg, rotulo: r, valor: curto(v), tc, tv, medir }).itens));
    }
    if (u >= 0.6) itens.push(rodapeMarca(m, H - m, medir, 2.0 * u));
    return itens;
  }

  function vertical(spec, W, H, medir) {
    const u = W / 100; const itens = []; const m = Math.max(2.5, 4 * u); const barH = 15 * u;
    itens.push(...faixa({ x: m, y: m, w: W - 2 * m, h: barH, esq: spec.cab[0], dir: spec.cab[1], tamEsq: 9.5 * u, tamDir: 7 * u, medir }));
    const tl = 4.6 * u, tc = 4 * u; const legH = spec.legenda ? tl + tc * 1.25 + 1.5 * u : 0; const rodapeH = 6 * u;
    const campos = (spec.campos || []).filter(([, v]) => v);
    const linhasCampos = campos.length ? 1 + Math.ceil((campos.length - 1) / 2) : 0; const alturaCampo = 3.2 * u * 0.78 + 6 * u + 0.65 + 1.6 * u; const camposH = linhasCampos * alturaCampo;
    // o nome pode ocupar até 3 linhas, mas o QR grande e os campos têm prioridade: se não sobrar espaço, o nome perde linhas
    let nome, yNome, sobra;
    for (const linhas of [3, 2, 1]) {
      nome = ajustar(medir, spec.nome, { largura: W - 2 * m, tamanho: 10 * u, minimo: 5.5 * u, linhas, negrito: true });
      yNome = m + barH + 5 * u; const hNome = nome.tamanho * 0.86 + nome.linhas.length * nome.tamanho * 1.1 + 2 * u - nome.tamanho * 0.1;
      sobra = H - m - rodapeH - (yNome + hNome) - legH - camposH;
      if (sobra >= 45 * u || linhas === 1) break;
    }
    let y = yNome + nome.tamanho * 0.86;
    for (const ln of nome.linhas) { itens.push(T(m, y, ln, nome.tamanho, { b: true })); y += nome.tamanho * 1.1; }
    y += 2 * u - nome.tamanho * 0.1;
    const lado = Math.max(20, Math.min(W - 2 * m, H * 0.4, sobra)); const xq = (W - lado) / 2;
    itens.push(...blocoQR({ x: xq, y, lado, texto: spec.qr.texto, legenda: spec.legenda, codigo: spec.qr.codigo, tl, tc, nivel: spec.qr.nivel }));
    y += lado + legH + 1.5 * u;
    const fim = H - m - rodapeH; const largura = (W - 2 * m - 3 * u) / 2;
    campos.forEach(([r, v], i) => {      // o primeiro (cliente) ocupa a linha toda; os outros, duas colunas
      const col = i === 0 ? 0 : (i - 1) % 2; const linha = i === 0 ? 0 : 1 + Math.floor((i - 1) / 2);
      const c = campo({ x: m + col * (largura + 3 * u), y: y + linha * alturaCampo, w: i === 0 ? W - 2 * m : largura, rotulo: r, valor: v, tc: 3.2 * u, tv: 6 * u, medir });
      if (y + linha * alturaCampo + c.h <= fim) itens.push(...c.itens);
    });
    itens.push(rodapeMarca(m, H - m, medir, 3.6 * u));
    return itens;
  }

  // Página de teste: borda no tamanho exato, cantos, régua de 10 em 10 mm e um QR. Serve para conferir escala, margem e legibilidade.
  function teste(spec, W, H, medir) {
    const itens = []; const m = 1.2; const sw = 0.35;
    itens.push(L(m, m, W - m, m, sw), L(W - m, m, W - m, H - m, sw), L(W - m, H - m, m, H - m, sw), L(m, H - m, m, m, sw));
    for (let mm = 10; mm < W - 6; mm += 10) { itens.push(L(mm, m, mm, m + (mm % 50 === 0 ? 3.4 : 2.2), sw)); itens.push(T(mm + 0.5, m + 5.2, String(mm), 2.2, { b: true })); }
    const u = Math.min(W / 100, H / 50); const lado = Math.min(H * 0.55, W * 0.34);
    itens.push(Q(W - m - 3 - lado, H - m - 3 - lado, lado, spec.qr.texto, 4, "M"));
    const t = ajustar(medir, "TESTE DE IMPRESSÃO", { largura: W - lado - 12, tamanho: 6 * u, minimo: 3, linhas: 2, negrito: true });
    let y = m + 9 + t.tamanho * 0.8; for (const ln of t.linhas) { itens.push(T(4, y, ln, t.tamanho, { b: true })); y += t.tamanho * 1.1; }
    // as frases ficam na coluna da esquerda (nunca embaixo do QR, que precisa de espaço em branco em volta)
    const larg = W - lado - 4 - 3 - m - 3; const nm = ajustar(medir, spec.nome, { largura: larg, tamanho: Math.max(2.4, 3.4 * u), minimo: 2, linhas: 1, negrito: true });
    if (nm.linhas.length && y + 1 + nm.tamanho < H - m) { itens.push(T(4, y + 1, nm.linhas[0], nm.tamanho, { b: true })); y += 1 + nm.tamanho * 1.3; }
    const dica = ajustar(medir, "A régua acima deve medir 10 mm entre os traços.", { largura: larg, tamanho: Math.max(2, 2.5 * u), minimo: 1.8, linhas: 2 });
    for (const ln of dica.linhas) { if (y + dica.tamanho > H - m - 1) break; itens.push(T(4, y, ln, dica.tamanho, {})); y += dica.tamanho * 1.2; }
    return itens;
  }

  function layout(spec, formato, medir) {
    const W = formato.w, H = formato.h;
    const modelo = spec.tipo === "teste" ? teste : H > W * 1.1 ? vertical : horizontal;
    const itens = modelo(spec, W, H, medir);
    return { w: W, h: H, itens, qr: itens.find((i) => i.k === "q") || null };
  }

  // ───────────── legibilidade do QR ─────────────
  // modulos(texto, nivel) → quantos módulos tem de lado. Devolve o tamanho de cada módulo no papel e o que isso significa em pontos.
  function legibilidade(lay, modulos, dpi = 203) {
    const q = lay.qr; if (!q) return { ok: true, semQr: true };
    const n = modulos(q.texto, q.nivel); const moduloMm = q.size / (n + 2 * q.quiet); const pontos = moduloMm * dpi / 25.4;
    return { ok: moduloMm >= MODULO_MIN_MM, bom: moduloMm >= MODULO_BOM_MM, modulos: n, moduloMm, pontos, dpi };
  }
  // Escolhe o nível de correção: o mais robusto (M) que ainda deixa o módulo legível; senão o L, que tem menos módulos.
  function nivelDoQr(texto, lado, modulos, quiet = 4) {
    const mm = (nivel) => lado / (modulos(texto, nivel) + 2 * quiet);
    return mm("M") >= MODULO_BOM_MM || mm("L") <= mm("M") ? "M" : "L";
  }
  // Põe o nível certo em todos os QR de um layout
  function afinarQr(lay, modulos) {
    for (const i of lay.itens) if (i.k === "q") { i.nivel = nivelDoQr(i.texto, i.size, modulos, i.quiet); }
    return lay;
  }

  // ───────────── folhas ─────────────
  // Distribui as etiquetas em páginas. rolo: uma por página. folha: grade colunas × linhas; `pular` deixa as primeiras posições em branco
  // (para reaproveitar uma folha adesiva já usada pela metade).
  function paginar(layouts, formato, pular = 0) {
    if (formato.tipo === "rolo") return layouts.map((l) => ({ w: formato.w, h: formato.h, itens: [{ x: 0, y: 0, lay: l }] }));
    const cap = porPagina(formato); const fila = [...Array(Math.max(0, Math.min(pular, cap - 1))).fill(null), ...layouts]; const paginas = [];
    for (let i = 0; i < fila.length; i += cap) {
      const fatia = fila.slice(i, i + cap);
      const folhaW = formato.pagina.w, folhaH = formato.pagina.h;
      const gx = formato.colunas > 1 ? 0 : 0;
      paginas.push({ w: folhaW, h: folhaH, itens: fatia.map((lay, k) => (lay ? { x: formato.margemX + (k % formato.colunas) * formato.w + gx, y: formato.margemY + Math.floor(k / formato.colunas) * formato.h, lay } : null)).filter(Boolean) });
    }
    return paginas;
  }

  const API = { PRETO, BRANCO, FAMILIA, MODULO_MIN_MM, MODULO_BOM_MM, FORMATOS, FORMATO_PADRAO, formatosPara, personalizado, porPagina, ajustar, quebrar, elipse, layout, legibilidade, nivelDoQr, afinarQr, paginar };
  raiz.NEEtiquetaLayout = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
