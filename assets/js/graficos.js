// GRÁFICOS DAS PLANILHAS: desenha em SVG os números-chave e os gráficos que relatorio-visual.js calcula. Sem biblioteca.
//   Na tela: números que sobem, barras que crescem, rosca que se desenha, selos de situação e barras dentro da tabela.
//   No papel: o mesmo desenho parado (A4 em cor; cupom em preto e branco com texto em tudo, para não depender de cor).
// As funções que montam texto (barras, barrasH, rosca, kpis) não usam a tela: rodam igual nos testes.
(function (raiz) {
  "use strict";
  const V = () => raiz.NERelatorioVisual;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const n1 = (v) => Math.round(v * 10) / 10;
  const fmt = (n) => (V() ? V().fmt(n) : String(n));
  const tom = (t) => (/^(ok|info|alerta|erro|neutro|c[1-6])$/.test(t) ? t : "neutro");

  // escala "redonda" (0, 50, 100, 150…) para o eixo
  function escala(max, divisoes = 3) {
    if (!(max > 0)) return { max: 1, passos: [0, 1] };
    const bruto = max / divisoes; const pot = 10 ** Math.floor(Math.log10(bruto)); const f = bruto / pot;
    const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot; const topo = Math.ceil(max / passo) * passo;
    const passos = []; for (let v = 0; v <= topo + 1e-9; v += passo) passos.push(Math.round(v * 1e6) / 1e6);
    return { max: topo, passos };
  }
  const resumoTexto = (g) => {
    if (g.tipo === "rosca") return `${g.titulo}: ${g.fatias.map((f) => `${f.rotulo} ${fmt(f.valor)}`).join(", ")}`;
    if (g.tipo === "barrasH") return `${g.titulo}: ${g.itens.map((i) => `${i.rotulo} ${i.texto || fmt(i.valor)}`).join("; ")}`;
    return `${g.titulo}: ${g.categorias.map((c, i) => `${c} ${fmt(g.series.reduce((n, s) => n + s.valores[i], 0))}`).join("; ")}`;
  };
  const legenda = (itens, marca) => `<ul class="gf-leg">${itens.map((s) => `<li><i class="gf-dot t-${tom(s.tom)}"></i>${esc(s.rotulo)}</li>`).join("")}${marca ? `<li><i class="gf-risco"></i>${esc(marca)}</li>` : ""}</ul>`;

  // ───────────── barras na vertical, empilhadas (um dia, uma hora ou uma semana por coluna) ─────────────
  function barras(g, { largura = 360 } = {}) {
    const W = largura, H = 186, ml = 30, mr = 6, mt = 16, mb = 24; const pw = W - ml - mr, ph = H - mt - mb; const n = g.categorias.length;
    const totais = g.categorias.map((_, i) => g.series.reduce((s, x) => s + (x.valores[i] || 0), 0)); const e = escala(Math.max(...totais, 0));
    const band = pw / n, bw = Math.min(band * 0.66, 36); const passo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 38))));   // rótulos do eixo sem encostar um no outro
    let s = e.passos.map((p) => { const y = mt + ph - (p / e.max) * ph; return `<line class="gf-grade" x1="${ml}" x2="${W - mr}" y1="${n1(y)}" y2="${n1(y)}"/><text class="gf-y" x="${ml - 5}" y="${n1(y + 3.5)}" text-anchor="end">${fmt(p)}</text>`; }).join("");
    g.categorias.forEach((c, i) => {
      const x = ml + i * band + (band - bw) / 2; let base = mt + ph; let blocos = "";
      g.series.forEach((sr) => { const v = sr.valores[i] || 0; if (v <= 0) return; const h = Math.max(2, (v / e.max) * ph); base -= h; blocos += `<rect class="gf-seg t-${tom(sr.tom)}" x="${n1(x)}" y="${n1(base)}" width="${n1(bw)}" height="${n1(h)}" rx="2.5"><title>${esc(sr.rotulo)}: ${fmt(v)}</title></rect>`; });
      s += `<g class="gf-pilha" style="--i:${i}">${blocos}</g>`;
      if (totais[i] > 0 && n <= 14) s += `<text class="gf-v gf-surge" style="--i:${i}" x="${n1(x + bw / 2)}" y="${n1(base - 4)}" text-anchor="middle">${fmt(totais[i])}</text>`;
      if (i % passo === 0) s += `<text class="gf-x" x="${n1(x + bw / 2)}" y="${H - 7}" text-anchor="middle">${esc(c)}</text>`;
    });
    return `<svg class="gf-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(resumoTexto(g))}">${s}</svg>${g.series.length > 1 ? legenda(g.series) : ""}`;
  }

  // ───────────── barras na horizontal: ranking, com risco opcional (mínimo, limite) ─────────────
  function barrasH(g, { largura = 360 } = {}) {
    const W = largura, linha = 38, ini = 4; const H = g.itens.length * linha + 6;
    const maior = Math.max(...g.itens.map((i) => Math.max(i.valor, i.marca || 0)), 0) || 1; const k = W / maior; let s = "";
    g.itens.forEach((it, idx) => {
      const y = ini + idx * linha; let x = 0; let barra = "";
      const partes = it.partes && it.partes.length ? it.partes : [{ rotulo: "", valor: it.valor, tom: it.tom }];
      partes.forEach((p, j) => { const w = p.valor > 0 ? Math.max(3, p.valor * k) : 0; if (w) { barra += `<rect class="gf-h t-${tom(p.tom)}" x="${n1(x)}" y="${y + 18}" width="${n1(w)}" height="13" rx="${partes.length > 1 ? 2 : 6.5}"><title>${esc(p.rotulo ? `${p.rotulo}: ${fmt(p.valor)}` : it.texto || fmt(it.valor))}</title></rect>`; x += w; } });
      s += `<text class="gf-l" x="0" y="${y + 12}">${esc(it.rotulo)}</text><text class="gf-v${!it.partes && (it.tom === "erro" || it.tom === "alerta") ? ` gf-v-${it.tom}` : ""}" x="${W}" y="${y + 12}" text-anchor="end">${esc(it.texto || fmt(it.valor))}</text><rect class="gf-trilho" x="0" y="${y + 18}" width="${W}" height="13" rx="6.5"/><g class="gf-lado" style="--i:${idx}">${barra}</g>`;
      if (it.marca > 0) s += `<line class="gf-marca" x1="${n1(it.marca * k)}" x2="${n1(it.marca * k)}" y1="${y + 15}" y2="${y + 34}"/>`;
    });
    const tonsUsados = []; for (const it of g.itens) for (const p of it.partes && it.partes.length ? it.partes : []) if (p.rotulo && !tonsUsados.some((t) => t.rotulo === p.rotulo)) tonsUsados.push({ rotulo: p.rotulo, tom: p.tom });
    return `<svg class="gf-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(resumoTexto(g))}">${s}</svg>${tonsUsados.length > 1 || g.marcaRotulo ? legenda(tonsUsados.length > 1 ? tonsUsados : [], g.marcaRotulo) : ""}`;
  }

  // ───────────── rosca com o total no meio e a legenda ao lado ─────────────
  function rosca(g) {
    const r = 44, C = 2 * Math.PI * r; const total = g.fatias.reduce((n, f) => n + f.valor, 0); const folga = g.fatias.length > 1 ? 2 : 0; let acum = 0; let arcos = "";
    g.fatias.forEach((f, i) => { const bruto = (f.valor / total) * C; const len = Math.max(1.5, bruto - folga); arcos += `<circle class="gf-arco t-${tom(f.tom)}" cx="60" cy="60" r="${r}" transform="rotate(-90 60 60)" stroke-dasharray="${n1(len)} ${n1(C - len)}" stroke-dashoffset="${n1(-acum)}" style="--i:${i};--len:${n1(len)};--resto:${n1(C - len)};--c:${n1(C)}"><title>${esc(f.rotulo)}: ${fmt(f.valor)}</title></circle>`; acum += bruto; });
    const centro = g.centro ? `<text class="gf-cn" x="60" y="${g.centro.rotulo ? 63 : 67}" text-anchor="middle">${esc(g.centro.valor)}</text>${g.centro.rotulo ? `<text class="gf-cr" x="60" y="77" text-anchor="middle">${esc(g.centro.rotulo)}</text>` : ""}` : "";
    const leg = `<ul class="gf-leg gf-leg-col">${g.fatias.map((f) => `<li><i class="gf-dot t-${tom(f.tom)}"></i><span>${esc(f.rotulo)}</span><b>${fmt(f.valor)}</b><small>${Math.round((f.valor / total) * 100)}%</small></li>`).join("")}</ul>`;
    return `<div class="gf-rosca"><svg class="gf-svg gf-svg-rosca" viewBox="0 0 120 120" role="img" aria-label="${esc(resumoTexto(g))}"><circle class="gf-fundo" cx="60" cy="60" r="${r}"/>${arcos}${centro}</svg>${leg}</div>`;
  }

  const desenhos = { barras, barrasH, rosca };
  const figura = (g, opc) => (desenhos[g.tipo] ? `<figure class="gf-card gf-fig-${g.tipo}"><figcaption>${esc(g.titulo)}</figcaption>${desenhos[g.tipo](g, opc)}</figure>` : "");

  // ───────────── números-chave ─────────────
  function kpis(resumo, { icone = () => "" } = {}) {
    return `<div class="gf-kpis">${resumo.map(([rotulo, texto, ex = {}], i) => `<div class="gf-kpi t-${tom(ex.tom)}" style="--i:${i}">${ex.icone ? `<span class="gf-ic">${icone(ex.icone)}</span>` : ""}<b class="gf-num"${ex.numero != null ? ` data-alvo="${ex.numero}" data-sufixo="${esc(ex.sufixo || "")}"` : ""}>${esc(texto)}</b><small>${esc(rotulo)}</small></div>`).join("")}</div>`;
  }

  const API = { escala, barras, barrasH, rosca, figura, kpis, esc };
  raiz.NEGraficos = Object.assign(raiz.NEGraficos || {}, API);
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ───────────── na tela: animação, tabela e painel ─────────────
  const NE = raiz.NE; if (!NE || typeof document === "undefined") return;
  const G = raiz.NEGraficos;
  const semMovimento = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.qualidade === "estatica"; } catch { return false; } };

  // as cores vêm da mesma lista do Excel (relatorio-visual.js)
  (() => { const v = V(); if (!v || document.getElementById("gf-paleta")) return; const css = Object.keys(v.PALETA).map((t) => `.t-${t}{--cor:${v.PALETA[t]};--clara:${v.CLARA[t]}}`).join(""); const st = document.createElement("style"); st.id = "gf-paleta"; st.textContent = css; document.head.append(st); })();

  // número que sobe até o valor (a pessoa vê que é número de verdade, não texto)
  G.animar = (raizEl) => {
    const nums = [...raizEl.querySelectorAll(".gf-num[data-alvo]")]; const parado = semMovimento();
    for (const el of nums) {
      const alvo = Number(el.dataset.alvo); const suf = el.dataset.sufixo || ""; const ini = Number(getComputedStyle(el.closest(".gf-kpi") || el).getPropertyValue("--i")) || 0;
      const texto = (v) => `${fmt(Number.isInteger(alvo) ? Math.round(v) : v)}${suf}`;
      if (parado || !Number.isFinite(alvo) || alvo === 0) { el.textContent = texto(alvo); continue; }
      el.textContent = texto(0); const dur = 900; const t0 = performance.now() + ini * 70 + 120;
      const passo = (t) => { const p = Math.min(1, Math.max(0, (t - t0) / dur)); el.textContent = texto(alvo * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(passo); else el.textContent = texto(alvo); };
      requestAnimationFrame(passo);
    }
  };

  const iconeSvg = (nome) => (NE.icone && NE.icone[nome]) || "";
  const html = (s) => { const t = document.createElement("template"); t.innerHTML = s.trim(); return t.content.firstElementChild; };

  // KPIs + gráficos de um bloco. opc: { papel, cupom, cor }
  G.painel = (bloco, { papel = false, cupom = false, cor = true } = {}) => {
    const caixa = document.createElement("div"); caixa.className = `gf${papel ? " gf-papel" : ""}${cupom ? " gf-cupom" : ""}${papel && !cor ? " gf-pb" : ""}`;
    const v = V(); const resumo = bloco.resumo && bloco.resumo.length ? bloco.resumo : v ? v.garantir(bloco).resumo : [];
    if (resumo.length) caixa.append(html(kpis(resumo.map((x) => (x.length < 3 ? [x[0], x[1], { tom: "neutro" }] : x)), { icone: iconeSvg })));
    const graficos = (bloco.graficos || []).slice(0, cupom ? 2 : 4);
    if (graficos.length) { const grade = document.createElement("div"); grade.className = "gf-graficos"; grade.innerHTML = graficos.map((g) => { try { return figura(g, { largura: cupom ? 240 : 360 }); } catch (e) { console.warn("gráfico ignorado", e && e.message); return ""; } }).join(""); caixa.append(grade); }
    return caixa;
  };

  // Tabela: selos de situação, barras dentro da célula e sinais coloridos
  G.tabela = (bloco, { limite = 40, papel = false } = {}) => {
    const cols = bloco.colunas || []; const mostra = (bloco.linhas || []).slice(0, limite);
    const max = cols.map((c) => (c.visual === "barra" && Array.isArray(c.valores) ? Math.max(0, ...c.valores.map((x) => (Number.isFinite(x) ? x : 0))) : 0));
    const celula = (v, i, r) => {
      const c = cols[i]; const td = document.createElement("td"); td.className = c.dir ? "dir" : "";
      if (c.visual === "estado" && v) { const t = (c.tons && c.tons[v]) || "neutro"; const ic = c.icones && c.icones[v]; td.innerHTML = `<span class="gf-pill t-${tom(t)}">${ic ? `<i>${esc(ic)}</i>` : ""}${esc(v)}</span>`; }
      else if (c.visual === "barra" && c.valores && Number.isFinite(c.valores[r])) { const p = max[i] > 0 ? Math.max(0, Math.min(100, (c.valores[r] / max[i]) * 100)) : 0; td.innerHTML = `<span class="gf-n">${esc(v)}</span><span class="gf-trilho-c"><i class="gf-prog ${c.valores[r] < 0 ? "t-erro" : "t-info"}" style="--p:${n1(p)}%"></i></span>`; }
      else if (c.visual === "sinal" && c.valores && Number.isFinite(c.valores[r])) { td.innerHTML = `<span class="gf-sinal ${c.valores[r] > 0 ? "mais" : c.valores[r] < 0 ? "menos" : ""}">${esc(v)}</span>`; }
      else td.textContent = v;
      if (String(v).length > 36) { td.classList.add("gf-longo"); if (!papel && !td.children.length) { const c = document.createElement("div"); c.className = "gf-clip"; c.title = String(v); c.textContent = String(v); td.textContent = ""; td.append(c); } }
      return td;
    };
    const t = document.createElement("table"); t.className = `${papel ? "gf-tabela" : "imp-tabela gf-tabela"}${cols.length > 6 ? " gf-larga" : ""}`;
    const th = document.createElement("thead"); const trh = document.createElement("tr"); cols.forEach((c) => { const x = document.createElement("th"); x.className = c.dir ? "dir" : ""; x.textContent = c.rotulo; trh.append(x); }); th.append(trh);
    const tb = document.createElement("tbody");
    mostra.forEach((l, r) => { const tr = document.createElement("tr"); tr.style.setProperty("--i", Math.min(r, 14)); l.forEach((v, i) => tr.append(celula(v, i, r))); tb.append(tr); });
    t.append(th, tb); return t;
  };
})(typeof window !== "undefined" ? window : globalThis);
