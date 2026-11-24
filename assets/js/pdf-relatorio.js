// PDF DA PLANILHA: o mesmo painel (números-chave, gráficos e tabela colorida) numa folha A4, com texto selecionável.
// Escrito à mão (sem biblioteca), com as fontes padrão do PDF (Helvetica): leve, nítido, abre em qualquer leitor e no visualizador do app.
// Tabela com mais de 7 colunas sai deitada. Vem de um bloco (ver relatorio-visual.js), igual à tela, ao papel e ao Excel.
(function (raiz) {
  "use strict";
  const V = () => raiz.NERelatorioVisual;
  const ESPECIAIS = { "−": "-", "–": "\x96", "—": "\x97", "…": "\x85", "•": "\x95", "’": "\x92", "‘": "\x91", "“": "\x93", "”": "\x94", "·": "\xb7" };
  // texto -> bytes WinAnsi (acentos do português cabem); o que não existe na fonte some
  const limpo = (t) => String(t == null ? "" : t).replace(/[\r\n\t]+/g, " ").replace(/[−–—…•’‘“”·]/g, (c) => ESPECIAIS[c]).replace(/[^\x20-\x7e\x80-\xff]/g, "");
  const esc = (t) => limpo(t).replace(/[\\()]/g, (c) => `\\${c}`);
  const rgb = (h) => { const x = String(h || "000000").replace("#", ""); return [0, 2, 4].map((i) => (parseInt(x.slice(i, i + 2), 16) / 255).toFixed(3)).join(" "); };
  const escurecer = (h) => { const x = String(h).replace("#", ""); return [0, 2, 4].map((i) => Math.round(parseInt(x.slice(i, i + 2), 16) * 0.66).toString(16).padStart(2, "0")).join(""); };
  const f1 = (n) => Math.round(n * 100) / 100;
  let ctxMedir = null;
  const medirTexto = (t, s, neg) => { ctxMedir = ctxMedir || document.createElement("canvas").getContext("2d"); ctxMedir.font = `${neg ? "bold " : ""}100px Helvetica, Arial, "Liberation Sans", sans-serif`; return ctxMedir.measureText(limpo(t)).width * (s / 100); };
  async function comprimir(u8) {
    if (typeof CompressionStream === "undefined") return null;
    try { const cs = new CompressionStream("deflate"); const w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch { return null; }
  }

  async function gerar(b0, { quem = "", quando = new Date(), medir = medirTexto } = {}) {
    const Vis = V(); const G = raiz.NEGraficos; const b = Vis ? Vis.garantir(b0) : b0; const PAL = Vis ? Vis.PALETA : {}; const CL = Vis ? Vis.CLARA : {};
    const cols = b.colunas || []; const linhas = b.linhas || []; const paisagem = cols.length > 7;
    const PW = paisagem ? 841.89 : 595.28, PH = paisagem ? 595.28 : 841.89, M = 34, LW = PW - 2 * M, RODAPE = 26;
    const paginas = []; let ops = null; let y = M;
    const nova = () => { ops = []; paginas.push(ops); y = M; };
    const Y = (v) => f1(PH - v);
    const cor = (t) => PAL[t] || "8791a8"; const clara = (t) => CL[t] || "eceef3";
    const caixa = (x, yy, w, h, fill, linha, r = 0, lw = 0.6) => {
      const k = r * 0.5523; const X0 = x, X1 = x + w, T = Y(yy), B = Y(yy + h);
      const p = r ? `${f1(X0 + r)} ${T} m ${f1(X1 - r)} ${T} l ${f1(X1 - r + k)} ${T} ${X1} ${f1(T - r + k)} ${X1} ${f1(T - r)} c ${X1} ${f1(B + r)} l ${X1} ${f1(B + r - k)} ${f1(X1 - r + k)} ${B} ${f1(X1 - r)} ${B} c ${f1(X0 + r)} ${B} l ${f1(X0 + r - k)} ${B} ${X0} ${f1(B + r - k)} ${X0} ${f1(B + r)} c ${X0} ${f1(T - r)} l ${X0} ${f1(T - r + k)} ${f1(X0 + r - k)} ${T} ${f1(X0 + r)} ${T} c h` : `${f1(x)} ${B} ${f1(w)} ${f1(h)} re`;
      ops.push(`q ${fill ? `${rgb(fill)} rg ` : ""}${linha ? `${rgb(linha)} RG ${lw} w ` : ""}${p} ${fill && linha ? "B" : fill ? "f" : "S"} Q`);
    };
    const traco = (x1, y1, x2, y2, c, lw = 0.5, tracejado = false) => ops.push(`q ${rgb(c)} RG ${lw} w ${tracejado ? "[2 2] 0 d " : ""}${f1(x1)} ${Y(y1)} m ${f1(x2)} ${Y(y2)} l S Q`);
    const texto = (x, yy, t, s, { neg = false, c = "1c1d21", al = "e" } = {}) => { const w = al === "e" ? 0 : medir(t, s, neg); const xx = al === "d" ? x - w : al === "c" ? x - w / 2 : x; ops.push(`BT ${rgb(c)} rg /${neg ? "F2" : "F1"} ${s} Tf ${f1(xx)} ${Y(yy)} Td (${esc(t)}) Tj ET`); };
    const cabe = (t, w, s, neg) => { t = limpo(t); if (medir(t, s, neg) <= w) return t; while (t.length > 1 && medir(`${t}…`, s, neg) > w) t = t.slice(0, -1); return `${t.trimEnd()}…`; };
    const quebra = (t, w, s, neg, max = 4) => {
      const ls = []; let a = ""; for (const p of limpo(t).split(" ")) { const x = a ? `${a} ${p}` : p; if (medir(x, s, neg) <= w || !a) { a = x; } else { ls.push(a); a = p; } }
      if (a) ls.push(a); const r = ls.slice(0, max); if (ls.length > max) r[max - 1] = cabe(`${r[max - 1]} ${ls.slice(max).join(" ")}`, w, s, neg); return r.map((l) => (medir(l, s, neg) > w ? cabe(l, w, s, neg) : l));
    };
    const garantir = (h) => { if (y + h > PH - M - RODAPE) nova(); };
    nova();

    // ── cabeçalho ──
    texto(M, y + 8, "NOVA ERA · CONFERE CARGA", 8, { neg: true, c: "d9141e" }); y += 26; texto(M, y, b.titulo || "Planilha", 20, { neg: true, c: "1a1f8f" }); y += 14;
    if (b.subtitulo) { texto(M, y + 4, cabe(b.subtitulo, LW, 10), 10, { c: "5d5f66" }); y += 14; }
    traco(M, y + 4, PW - M, y + 4, "1a1f8f", 1.2); y += 16;

    // ── números-chave ──
    const kpis = (b.resumo || []).map((x) => (x.length < 3 ? [x[0], x[1], { tom: "neutro" }] : x));
    if (kpis.length) {
      const porLinha = Math.min(kpis.length, paisagem ? 6 : 4); const gap = 8; const w = (LW - gap * (porLinha - 1)) / porLinha;
      for (let i = 0; i < kpis.length; i += porLinha) {
        garantir(54); kpis.slice(i, i + porLinha).forEach(([rot, val, ex], k) => {
          const x = M + k * (w + gap); const t = ex.tom || "neutro"; caixa(x, y, w, 46, "ffffff", "d9d5d1", 6); caixa(x, y, 5, 46, cor(t), null, 0);
          texto(x + 14, y + 25, cabe(val, w - 20, 20, true), 20, { neg: true }); texto(x + 14, y + 38, cabe(String(rot).toUpperCase(), w - 20, 6.6, true), 6.6, { neg: true, c: "5d5f66" });
        }); y += 54;
      }
    }

    // ── gráficos (dois por linha) ──
    const graficos = (b.graficos || []).filter((g) => g && (g.itens || g.fatias || g.series)).slice(0, 6); const cw = (LW - 10) / 2;
    const alto = (g) => (g.tipo === "barrasH" ? 30 + g.itens.length * 23 + (g.marcaRotulo ? 12 : 0) : g.tipo === "rosca" ? 40 + Math.max(g.fatias.length * 13, 78) : 168);
    const desenhoBarras = (g, x, y0, w, h) => {
      const n = g.categorias.length; const tot = g.categorias.map((_, i) => g.series.reduce((s, r) => s + (r.valores[i] || 0), 0)); const e = G.escala(Math.max(...tot, 0)); const px = x + 26, pw = w - 32, py = y0 + 8, ph = h - 40;
      e.passos.forEach((p) => { const yy = py + ph - (p / e.max) * ph; traco(px, yy, px + pw, yy, "dcd8d4", 0.4, true); texto(px - 4, yy + 2.5, V().fmt(p), 6.4, { al: "d", c: "5d5f66" }); });
      const band = pw / n, bw = Math.min(band * 0.66, 22), passo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 30))));
      g.categorias.forEach((c, i) => { const xx = px + i * band + (band - bw) / 2; let base = py + ph; g.series.forEach((s) => { const v = s.valores[i] || 0; if (v <= 0) return; const hh = Math.max(1.5, (v / e.max) * ph); base -= hh; caixa(xx, base, bw, hh, cor(s.tom), null, 0); });
        if (tot[i] > 0 && n <= 12) texto(xx + bw / 2, base - 2.5, V().fmt(tot[i]), 6.2, { al: "c", neg: true }); if (i % passo === 0) texto(xx + bw / 2, py + ph + 9, c, 6.2, { al: "c", c: "5d5f66" }); });
      let lx = x + 6; if (g.series.length > 1) g.series.forEach((s) => { caixa(lx, y0 + h - 12, 6, 6, cor(s.tom), null, 1); texto(lx + 9, y0 + h - 6.5, s.rotulo, 6.8, { c: "5d5f66", neg: true }); lx += 18 + medir(s.rotulo, 6.8, true); });
    };
    const desenhoBarrasH = (g, x, y0, w) => {
      const maior = Math.max(...g.itens.map((i) => Math.max(i.valor, i.marca || 0)), 0) || 1; const k = (w - 12) / maior;
      g.itens.forEach((it, i) => { const yy = y0 + i * 23; texto(x + 6, yy + 7, cabe(it.rotulo, w - 80, 7, true), 7, { neg: true }); texto(x + w - 6, yy + 7, cabe(it.texto || V().fmt(it.valor), 70, 7, true), 7, { al: "d", neg: true, c: !it.partes && it.tom === "erro" ? cor("erro") : !it.partes && it.tom === "alerta" ? escurecer(cor("alerta")) : "1c1d21" });
        caixa(x + 6, yy + 11, w - 12, 7, "ecebe8", null, 3.5); let xx = x + 6; (it.partes && it.partes.length ? it.partes : [{ valor: it.valor, tom: it.tom }]).forEach((p) => { const bw = p.valor > 0 ? Math.max(2, p.valor * k) : 0; if (bw) { caixa(xx, yy + 11, bw, 7, cor(p.tom), null, 0); xx += bw; } });
        if (it.marca > 0) traco(x + 6 + it.marca * k, yy + 9, x + 6 + it.marca * k, yy + 20, "1c1d21", 1.2); });
      if (g.marcaRotulo) { traco(x + 8, y0 + g.itens.length * 23 + 6, x + 8, y0 + g.itens.length * 23 + 14, "1c1d21", 1.2); texto(x + 13, y0 + g.itens.length * 23 + 12.5, g.marcaRotulo, 6.8, { c: "5d5f66", neg: true }); }
    };
    const desenhoRosca = (g, x, y0, w, h) => {
      const total = g.fatias.reduce((n, f) => n + f.valor, 0); const cx = x + 50, cy = y0 + 40, R = 36, r = 21; let a0 = -Math.PI / 2;
      g.fatias.forEach((f) => { const a1 = a0 + (f.valor / total) * Math.PI * 2; const passos = Math.max(2, Math.ceil((a1 - a0) / 0.08)); const pts = []; for (let i = 0; i <= passos; i++) { const a = a0 + ((a1 - a0) * i) / passos; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } for (let i = passos; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / passos; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        ops.push(`q ${rgb(cor(f.tom))} rg ${rgb("ffffff")} RG 0.8 w ${pts.map(([px, py], i) => `${f1(px)} ${Y(py)} ${i ? "l" : "m"}`).join(" ")} h B Q`); a0 = a1; });
      if (g.centro) { texto(cx, cy + 3, g.centro.valor, 11, { al: "c", neg: true }); if (g.centro.rotulo) texto(cx, cy + 11, g.centro.rotulo, 5.6, { al: "c", c: "5d5f66", neg: true }); }
      g.fatias.forEach((f, i) => { const yy = cy - (g.fatias.length * 13) / 2 + 10 + i * 13; caixa(x + 100, yy - 5, 6, 6, cor(f.tom), null, 1); texto(x + 110, yy, cabe(f.rotulo, w - 175, 7.4, false), 7.4); texto(x + w - 30, yy, V().fmt(f.valor), 7.4, { al: "d", neg: true }); texto(x + w - 8, yy, `${Math.round((f.valor / total) * 100)}%`, 6.6, { al: "d", c: "5d5f66" }); });
    };
    for (let i = 0; i < graficos.length; i += 2) {
      const par = graficos.slice(i, i + 2); const h = Math.max(...par.map(alto)); garantir(h + 8);
      par.forEach((g, k) => { const x = M + k * (cw + 10); caixa(x, y, cw, h, "ffffff", "d9d5d1", 6); texto(x + 8, y + 15, cabe(g.titulo, cw - 16, 9, true), 9, { neg: true });
        if (g.tipo === "barras") desenhoBarras(g, x, y + 22, cw, h - 22); else if (g.tipo === "barrasH") desenhoBarrasH(g, x, y + 26, cw); else if (g.tipo === "rosca") desenhoRosca(g, x, y + 24, cw, h - 24); });
      y += h + 10;
    }

    // ── tabela ──
    if (linhas.length) {
      garantir(60); texto(M, y + 10, "A PLANILHA", 10, { neg: true, c: "5d5f66" }); y += 18;
      const fs = cols.length > 9 ? 6.4 : cols.length > 6 ? 7 : 7.8; const pad = 4;
      const max = cols.map((c, i) => Math.min(190, Math.max(medir(c.rotulo, fs, true), ...linhas.slice(0, 80).map((l) => medir(l[i] == null ? "" : l[i], fs, false))) + 2 * pad + 2));
      const soma = max.reduce((n, x) => n + x, 0); const esc2 = LW / soma; const larg = max.map((x) => Math.max(26, x * esc2));
      const maxV = cols.map((c) => (c.visual === "barra" && Array.isArray(c.valores) ? Math.max(0, ...c.valores.map((x) => (Number.isFinite(x) ? x : 0))) : 0));
      const cabecalho = () => { garantir(24); caixa(M, y, LW, 15, "1a1f8f", null, 0); let x = M; cols.forEach((c, i) => { const dir = c.dir || c.visual === "sinal"; texto(dir ? x + larg[i] - pad : x + pad, y + 10.2, cabe(c.rotulo, larg[i] - 2 * pad, fs - 0.4, true), fs - 0.4, { neg: true, c: "ffffff", al: dir ? "d" : "e" }); x += larg[i]; }); y += 15; };
      cabecalho();
      linhas.forEach((l, r) => {
        const cel = cols.map((c, i) => { const v = l[i] == null ? "" : String(l[i]); return c.visual === "estado" ? [cabe(v, larg[i] - 2 * pad - 8, fs - 0.4, true)] : quebra(v, larg[i] - 2 * pad, fs, false, cols.length > 9 ? 3 : 4); });
        const h = Math.max(...cel.map((c) => c.length)) * (fs + 2.4) + 6; if (y + h > PH - M - RODAPE) { nova(); cabecalho(); }
        if (r % 2 === 1) caixa(M, y, LW, h, "f7f6f4", null, 0); traco(M, y + h, M + LW, y + h, "e5e1dc", 0.4);
        let x = M; cols.forEach((c, i) => { const dir = c.dir || c.visual === "sinal" || (c.visual === "barra" && Array.isArray(c.valores)); const v = l[i] == null ? "" : String(l[i]);
          if (c.visual === "estado" && v) { const t = (c.tons && c.tons[v]) || "neutro"; const tw = medir(cel[i][0], fs - 0.4, true) + 8; caixa(x + pad, y + 2.5, tw, fs + 4.4, clara(t), null, (fs + 4.4) / 2); texto(x + pad + 4, y + 2.5 + fs + 0.6, cel[i][0], fs - 0.4, { neg: true, c: escurecer(cor(t)) }); }
          else { const sv = c.visual === "sinal" && Array.isArray(c.valores) ? c.valores[r] : null; const cc = sv > 0 ? "1d7a46" : sv < 0 ? "b3261e" : "1c1d21";
            cel[i].forEach((ln, k) => texto(dir ? x + larg[i] - pad : x + pad, y + 3 + fs + k * (fs + 2.4), ln, fs, { al: dir ? "d" : "e", c: cc, neg: sv != null && sv !== 0 }));
            if (c.visual === "barra" && Array.isArray(c.valores) && maxV[i] > 0 && Number.isFinite(c.valores[r])) { const bw = Math.max(0, c.valores[r] / maxV[i]) * (larg[i] - 2 * pad); caixa(x + pad, y + h - 4.5, larg[i] - 2 * pad, 2, "ecebe8", null, 1); if (bw > 0) caixa(x + pad, y + h - 4.5, bw, 2, cor(c.valores[r] < 0 ? "erro" : "info"), null, 1); } }
          x += larg[i]; });
        y += h;
      });
    } else { garantir(30); texto(M, y + 12, "Nada para mostrar neste período.", 10, { c: "5d5f66" }); }

    // ── rodapé e montagem do arquivo ──
    const dataTxt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(quando);
    paginas.forEach((p, i) => { ops = p; traco(M, PH - M - 14, PW - M, PH - M - 14, "dcd8d4", 0.4); texto(M, PH - M - 4, "Nova Era · Confere Carga", 7, { neg: true, c: "5d5f66" }); texto(PW - M, PH - M - 4, `Gerado${quem ? ` por ${quem}` : ""} em ${dataTxt} · página ${i + 1} de ${paginas.length}`, 7, { al: "d", c: "5d5f66" }); });
    const enc = new TextEncoder(); const partes = []; let pos = 0; const desloc = [];
    const bytes = (u8) => { partes.push(u8); pos += u8.length; }; const txt = (s) => bytes(enc.encode(s)); const bin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    const obj = (n, cab, fluxo) => { desloc[n] = pos; txt(`${n} 0 obj\n${cab}`); if (fluxo) { txt("\nstream\n"); bytes(fluxo); txt("\nendstream"); } txt("\nendobj\n"); };
    bytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    const total = 5 + paginas.length * 2; const filhos = paginas.map((_, i) => `${5 + i * 2} 0 R`);
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, `<< /Type /Pages /Kids [${filhos.join(" ")}] /Count ${paginas.length} >>`);
    obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    for (let i = 0; i < paginas.length; i++) {
      const bruto = bin(paginas[i].join("\n")); const zip = await comprimir(bruto); const dados = zip || bruto;
      obj(5 + i * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      obj(6 + i * 2, `<< /Length ${dados.length}${zip ? " /Filter /FlateDecode" : ""} >>`, dados);
    }
    const info = total + 1; obj(info, `<< /Title (${esc(b.titulo || "Planilha")}) /Producer (Confere Carga - Nova Era) /Creator (Confere Carga) >>`);
    const xref = pos; txt(`xref\n0 ${info + 1}\n0000000000 65535 f \n`); for (let k = 1; k <= info; k++) txt(`${String(desloc[k]).padStart(10, "0")} 00000 n \n`);
    txt(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const saida = new Uint8Array(pos); let o = 0; for (const p of partes) { saida.set(p, o); o += p.length; } return saida;
  }

  const API = { gerar, limpo };
  raiz.NEPdfRelatorio = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  const NE = raiz.NE; if (NE) {
    // Gera o PDF do bloco e abre no visualizador do app (ver visualizador.js)
    NE.pdfDaPlanilha = async (b) => { const quem = NE.app && NE.app.perfil ? NE.app.perfil.nome : ""; const dados = await gerar(b, { quem }); return NE.verPdf(dados, { titulo: b.titulo, nome: `${b.arquivo || "planilha"}-${NE.hojeISO()}.pdf` }); };
  }
})(typeof window !== "undefined" ? window : globalThis);
