// PLANILHA EM EXCEL (.xlsx): a mesma planilha da tela, organizada, para abrir no Excel, no Google Planilhas, no Numbers ou no LibreOffice.
// Sem biblioteca: o arquivo .xlsx é um zip de arquivos XML, escrito aqui. Duas abas:
//   Resumo    números-chave coloridos e os gráficos de verdade (barras e rosca), com os números deles ao lado
//   Planilha  cabeçalho colorido, filtros, primeira linha fixa, números como número, selos de situação coloridos e barras dentro das células
// Roda no navegador e nos testes (Node).
(function (raiz) {
  "use strict";
  const V = () => raiz.NERelatorioVisual;
  const esc = (t) => String(t == null ? "" : t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hex = (h) => String(h || "000000").replace("#", "").toUpperCase();
  const letra = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const ref = (c, r) => `${letra(c)}${r + 1}`;                                  // colunas e linhas começam em 0
  const NS = { main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main", rel: "http://schemas.openxmlformats.org/officeDocument/2006/relationships", pkg: "http://schemas.openxmlformats.org/package/2006/relationships", ch: "http://schemas.openxmlformats.org/drawingml/2006/chart", a: "http://schemas.openxmlformats.org/drawingml/2006/main", xdr: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" };
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const COR_MARCA = "D9141E", COR_AZUL = "1A1F8F", COR_LINHA = "E5E1DC", COR_ZEBRA = "F7F6F4", COR_SUAVE = "5D5F66";

  // ───────────── zip (só o necessário: arquivos com nome UTF-8, comprimidos quando o navegador sabe) ─────────────
  const TABELA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function deflate(u8) {
    if (typeof CompressionStream === "undefined") return null;
    try { const cs = new CompressionStream("deflate-raw"); const w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch { return null; }
  }
  async function zip(arquivos) {
    const enc = new TextEncoder(); const partes = []; const central = []; let pos = 0;
    const agora = new Date(); const dosHora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1); const dosData = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    for (const a of arquivos) {
      const nome = enc.encode(a.nome); const dados = typeof a.dados === "string" ? enc.encode(a.dados) : a.dados; const crc = crc32(dados);
      const zipado = await deflate(dados); const usar = zipado && zipado.length < dados.length ? zipado : dados; const metodo = usar === dados ? 0 : 8;
      const cab = new DataView(new ArrayBuffer(30)); cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(8, metodo, true); cab.setUint16(10, dosHora, true); cab.setUint16(12, dosData, true);
      cab.setUint32(14, crc, true); cab.setUint32(18, usar.length, true); cab.setUint32(22, dados.length, true); cab.setUint16(26, nome.length, true); cab.setUint16(28, 0, true);
      partes.push(new Uint8Array(cab.buffer), nome, usar);
      const ent = new DataView(new ArrayBuffer(46)); ent.setUint32(0, 0x02014b50, true); ent.setUint16(4, 20, true); ent.setUint16(6, 20, true); ent.setUint16(8, 0x0800, true); ent.setUint16(10, metodo, true); ent.setUint16(12, dosHora, true); ent.setUint16(14, dosData, true);
      ent.setUint32(16, crc, true); ent.setUint32(20, usar.length, true); ent.setUint32(24, dados.length, true); ent.setUint16(28, nome.length, true); ent.setUint32(42, pos, true);
      central.push(new Uint8Array(ent.buffer), nome); pos += 30 + nome.length + usar.length;
    }
    const tamCentral = central.reduce((n, p) => n + p.length, 0); const fim = new DataView(new ArrayBuffer(22)); fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
    const todas = [...partes, ...central, new Uint8Array(fim.buffer)]; const saida = new Uint8Array(todas.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of todas) { saida.set(p, o); o += p.length; } return saida;
  }

  // ───────────── estilos (cada combinação de fonte, cor, borda e formato vira um número) ─────────────
  function criarEstilos() {
    const fontes = ['<font><sz val="11"/><color rgb="FF1C1D21"/><name val="Calibri"/><family val="2"/></font>']; const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const bordas = ["<border><left/><right/><top/><bottom/><diagonal/></border>"]; const formatos = []; const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']; const cache = new Map();
    const idx = (lista, xml) => { let i = lista.indexOf(xml); if (i < 0) { lista.push(xml); i = lista.length - 1; } return i; };
    const lado = (nome, b) => (b ? `<${nome} style="${b[0]}"><color rgb="FF${hex(b[1])}"/></${nome}>` : `<${nome}/>`);
    function estilo({ b = false, i = false, sz = 11, cor = "1C1D21", fill = null, h = null, v = "center", wrap = false, fmt = null, esq = null, base = null, topo = null, dir = null } = {}) {
      const chave = JSON.stringify([b, i, sz, cor, fill, h, v, wrap, fmt, esq, base, topo, dir]); if (cache.has(chave)) return cache.get(chave);
      const f = idx(fontes, `<font>${b ? "<b/>" : ""}${i ? "<i/>" : ""}<sz val="${sz}"/><color rgb="FF${hex(cor)}"/><name val="Calibri"/><family val="2"/></font>`);
      const fl = fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex(fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      const bo = esq || base || topo || dir ? idx(bordas, `<border>${lado("left", esq)}${lado("right", dir)}${lado("top", topo)}${lado("bottom", base)}<diagonal/></border>`) : 0;
      let nf = 0; if (fmt) { let k = formatos.indexOf(fmt); if (k < 0) { formatos.push(fmt); k = formatos.length - 1; } nf = 164 + k; }
      const al = h || v !== "bottom" || wrap ? `<alignment${h ? ` horizontal="${h}"` : ""} vertical="${v}"${wrap ? ' wrapText="1"' : ""}/>` : "";
      const xf = `<xf numFmtId="${nf}" fontId="${f}" fillId="${fl}" borderId="${bo}" xfId="0" applyNumberFormat="${nf ? 1 : 0}" applyFont="1" applyFill="${fl ? 1 : 0}" applyBorder="${bo ? 1 : 0}" applyAlignment="1">${al}</xf>`;
      xfs.push(xf); const n = xfs.length - 1; cache.set(chave, n); return n;
    }
    const xml = () => `${XML}<styleSheet xmlns="${NS.main}">${formatos.length ? `<numFmts count="${formatos.length}">${formatos.map((c, k) => `<numFmt numFmtId="${164 + k}" formatCode="${esc(c)}"/>`).join("")}</numFmts>` : ""}<fonts count="${fontes.length}">${fontes.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${bordas.length}">${bordas.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
    return { estilo, xml };
  }

  // ───────────── uma aba ─────────────
  function criarAba(textos) {
    const linhas = new Map(); const alturas = new Map(); let maxC = 0, maxR = 0;
    const celula = (r, c) => { if (!linhas.has(r)) linhas.set(r, new Map()); return linhas.get(r); };
    return {
      alturas,
      p(c, r, valor, s = 0) { celula(r).set(c, { valor, s }); maxC = Math.max(maxC, c); maxR = Math.max(maxR, r); },
      xml({ colunas, congelar, filtro, juntar = [], barras = [], cor, grade = true, ativa = false, retrato = false, desenho = false, umaFolha = false }) {
        const rows = [...linhas.keys()].sort((a, b) => a - b).map((r) => {
          const cs = [...linhas.get(r).entries()].sort((a, b) => a[0] - b[0]).map(([c, { valor, s }]) => {
            const a = ref(c, r);
            if (valor == null || valor === "") return `<c r="${a}" s="${s}"/>`;
            if (typeof valor === "number") return Number.isFinite(valor) ? `<c r="${a}" s="${s}"><v>${valor}</v></c>` : `<c r="${a}" s="${s}"/>`;
            return `<c r="${a}" s="${s}" t="s"><v>${textos(String(valor))}</v></c>`;
          }).join("");
          const ht = alturas.get(r); return `<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cs}</row>`;
        }).join("");
        const cols = colunas.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
        const painel = congelar ? `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>` : "";
        const cf = barras.map((b, i) => `<conditionalFormatting sqref="${b.faixa}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FF${hex(b.cor)}"/></dataBar></cfRule></conditionalFormatting>`).join("");
        return `${XML}<worksheet xmlns="${NS.main}" xmlns:r="${NS.rel}"><sheetPr><tabColor rgb="FF${hex(cor)}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(maxC, maxR)}"/><sheetViews><sheetView workbookViewId="0"${grade ? "" : ' showGridLines="0"'}${ativa ? ' tabSelected="1"' : ""}>${painel}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${filtro ? `<autoFilter ref="${filtro}"/>` : ""}${juntar.length ? `<mergeCells count="${juntar.length}">${juntar.map((j) => `<mergeCell ref="${j}"/>`).join("")}</mergeCells>` : ""}${cf}<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${retrato ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="${umaFolha ? 1 : 0}"/><headerFooter><oddFooter>&amp;L&amp;8Nova Era · Confere Carga&amp;R&amp;8Página &amp;P de &amp;N</oddFooter></headerFooter>${desenho ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
      },
    };
  }

  // ───────────── números dentro do texto ("340 un", "+200", "1.250,5") ─────────────
  function lerNumero(t) {
    const m = /^([+\-−–]?)\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*([^\d\s].*)?$/.exec(String(t == null ? "" : t).trim()); if (!m) return null;
    const n = Number(`${m[2].replace(/\./g, "")}${m[3] ? `.${m[3]}` : ""}`); return { n: /[\-−–]/.test(m[1]) ? -n : n, unid: (m[4] || "").trim() };
  }
  function tipoColuna(c, linhas, i) {
    const dado = linhas.map((l) => (l[i] == null ? "" : String(l[i])));
    const lidos = dado.map(lerNumero); const unids = new Set(lidos.filter(Boolean).map((x) => x.unid));
    const unid = unids.size === 1 ? [...unids][0] : "";
    const valores = c.valores && c.valores.length >= linhas.length ? c.valores.slice(0, linhas.length) : null;
    if (valores && valores.every((x) => x == null || Number.isFinite(x))) return { numeros: valores, unid, inteiro: valores.every((x) => x == null || Number.isInteger(x)) };
    if (c.dir && dado.every((t, r) => !t.trim() || lidos[r])) return { numeros: lidos.map((x) => (x ? x.n : null)), unid, inteiro: lidos.every((x) => !x || Number.isInteger(x.n)) };
    return null;
  }
  const formatoNumero = (t, sinal) => `${sinal ? "+" : ""}${t.inteiro ? "#,##0" : "#,##0.00"}${t.unid ? ` "${t.unid.replace(/"/g, "")}"` : ""}${sinal ? `;-${t.inteiro ? "#,##0" : "#,##0.00"}${t.unid ? ` "${t.unid.replace(/"/g, "")}"` : ""};0` : ""}`;

  // ───────────── gráficos do Excel (barras, barras na horizontal e rosca) ─────────────
  const rich = (texto, sz, b) => `<c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="${sz}" b="${b ? 1 : 0}"/><a:t>${esc(texto)}</a:t></a:r></a:p></c:rich>`;
  const cacheXml = (valores, tipo) => (tipo === "txt" ? `<c:strCache><c:ptCount val="${valores.length}"/>${valores.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:strCache>` : `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${valores.length}"/>${valores.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join("")}</c:numCache>`);
  const refCat = (f, v) => `<c:cat><c:strRef><c:f>${esc(f)}</c:f>${cacheXml(v, "txt")}</c:strRef></c:cat>`;
  const refVal = (f, v) => `<c:val><c:numRef><c:f>${esc(f)}</c:f>${cacheXml(v, "num")}</c:numRef></c:val>`;
  const refTx = (f, t) => `<c:tx><c:strRef><c:f>${esc(f)}</c:f>${cacheXml([t], "txt")}</c:strRef></c:tx>`;
  const preencher = (cor) => `<c:spPr><a:solidFill><a:srgbClr val="${hex(cor)}"/></a:solidFill></c:spPr>`;
  const eixoTxt = '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="5D5F66"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>';
  function graficoXml(g, dados, paleta) {
    const { aba, c0, r0, cats, series } = dados; const n = cats.length;   // r0 = linha do cabecalho (1 = primeira linha do Excel)
    const faixa = (c, a, z) => `${aba}!$${letra(c)}$${a}:$${letra(c)}$${z}`; const ultima = r0 + n;
    const titulo = `<c:title><c:tx>${rich(g.titulo, 1200, true)}</c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
    let corpo = "";
    if (g.tipo === "rosca") {
      const s = series[0];
      corpo = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${refTx(`${aba}!$${letra(c0 + 1)}$${r0}`, s.rotulo)}${g.fatias.map((f, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/>${preencher(paleta[f.tom] || "8791A8")}</c:dPt>`).join("")}<c:dLbls><c:spPr><a:noFill/></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>${refCat(faixa(c0, r0 + 1, ultima), cats)}${refVal(faixa(c0 + 1, r0 + 1, ultima), s.valores)}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
    } else {
      const horizontal = g.tipo === "barrasH"; const empilhar = g.tipo === "barras" ? true : series.length > 1 && !series.some((s) => s.marca);
      const unica = series.length === 1 && g.tipo === "barrasH";
      const sers = series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${refTx(`${aba}!$${letra(c0 + 1 + i)}$${r0}`, s.rotulo)}${preencher(s.cor)}<c:invertIfNegative val="0"/>${unica ? g.itens.map((it, k) => `<c:dPt><c:idx val="${k}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>${preencher(paleta[it.tom] || "2F46C8")}</c:dPt>`).join("") : ""}${!empilhar ? `<c:dLbls><c:spPr><a:noFill/></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` : ""}${refCat(faixa(c0, r0 + 1, ultima), cats)}${refVal(faixa(c0 + 1 + i, r0 + 1, ultima), s.valores)}</c:ser>`).join("");
      const grade = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="DDDAD6"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
      corpo = `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${empilhar ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${horizontal ? 45 : 60}"/>${empilhar ? '<c:overlap val="100"/>' : ""}<c:axId val="50010"/><c:axId val="50020"/></c:barChart>`
        + `<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BDB9B4"/></a:solidFill></a:ln></c:spPr>${eixoTxt}<c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>${n > 12 ? `<c:tickLblSkip val="${Math.ceil(n / 12)}"/>` : ""}<c:noMultiLvlLbl val="0"/></c:catAx>`
        + `<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "t" : "l"}"/>${grade}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${eixoTxt}<c:crossAx val="50010"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
    }
    const legenda = g.tipo === "rosca" || series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : "";
    return `${XML}<c:chartSpace xmlns:c="${NS.ch}" xmlns:a="${NS.a}" xmlns:r="${NS.rel}"><c:roundedCorners val="0"/><c:chart>${titulo}<c:plotArea><c:layout/>${corpo}</c:plotArea>${legenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="DCD8D4"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
  }
  // os números que cada gráfico desenha (vão numa tabelinha ao lado, para quem quiser conferir ou refazer o gráfico)
  function dadosDoGrafico(g, paleta) {
    if (g.tipo === "barras") return { cabecalho: "Período", cats: g.categorias, series: g.series.map((s) => ({ rotulo: s.rotulo, cor: paleta[s.tom] || "2F46C8", valores: s.valores })) };
    if (g.tipo === "rosca") return { cabecalho: "Fatia", cats: g.fatias.map((f) => f.rotulo), series: [{ rotulo: "Quantidade", cor: "2F46C8", valores: g.fatias.map((f) => f.valor) }] };
    const cats = g.itens.map((i) => i.rotulo); const comPartes = g.itens.some((i) => i.partes && i.partes.length);
    if (comPartes) { const nomes = []; for (const it of g.itens) for (const p of it.partes || []) if (!nomes.some((x) => x.rotulo === p.rotulo)) nomes.push({ rotulo: p.rotulo, tom: p.tom }); return { cabecalho: "Item", cats, series: nomes.map((nm) => ({ rotulo: nm.rotulo, cor: paleta[nm.tom] || "2F46C8", valores: g.itens.map((it) => ((it.partes || []).find((p) => p.rotulo === nm.rotulo) || { valor: 0 }).valor) })) }; }
    const base = [{ rotulo: "Quantidade", cor: "2F46C8", valores: g.itens.map((i) => i.valor), marca: false }];
    if (g.itens.some((i) => i.marca)) base.push({ rotulo: (g.marcaRotulo || "referência").replace(/^./, (m) => m.toUpperCase()), cor: "8791A8", valores: g.itens.map((i) => i.marca || 0), marca: true });
    return { cabecalho: "Item", cats, series: base };
  }

  // ───────────── a planilha inteira ─────────────
  async function xlsx(b, { quem = "", quando = new Date() } = {}) {
    const vis = V(); const paleta = vis ? vis.PALETA : {}; const clara = vis ? vis.CLARA : {};
    const linhas = b.linhas || []; const colunas = b.colunas || []; const textos = []; const mapa = new Map();
    const t = (s) => { if (!mapa.has(s)) { mapa.set(s, textos.length); textos.push(s); } return mapa.get(s); };
    const E = criarEstilos(); const est = E.estilo;
    const tom = (x) => hex(paleta[x] || "8791A8"); const fundoTom = (x) => hex(clara[x] || "ECEEF3");
    const escuro = (x) => { const h = tom(x); const c = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, "0")); return c.join("").toUpperCase(); };
    const graficos = (b.graficos || []).filter((g) => g && (g.itens || g.fatias || g.series)).slice(0, 4); const kpis = (b.resumo || []).map((x) => (x.length < 3 ? [x[0], x[1], { tom: "neutro" }] : x));
    const arquivos = [];

    // ── aba Planilha ──
    const plan = criarAba(t); const nCol = Math.max(1, colunas.length); const tipos = colunas.map((c, i) => tipoColuna(c, linhas, i));
    colunas.forEach((c, i) => plan.p(i, 0, c.rotulo, est({ b: true, cor: "FFFFFF", fill: COR_AZUL, h: c.visual === "estado" ? "center" : c.dir || tipos[i] ? "right" : "left", wrap: true, base: ["medium", COR_MARCA] })));
    plan.alturas.set(0, 26);
    const barras = []; const largura = colunas.map((c, i) => Math.min(46, Math.max(10, Math.ceil(Math.max(String(c.rotulo).length + 3, ...linhas.map((l) => String(l[i] == null ? "" : l[i]).length)) * 1.08) + 2)));
    linhas.forEach((l, r) => {
      const zebra = r % 2 === 1 ? COR_ZEBRA : null;
      colunas.forEach((c, i) => {
        const v = l[i] == null ? "" : String(l[i]); const lado = { base: ["thin", COR_LINHA] };
        if (c.visual === "estado" && v) { const x = (c.tons && c.tons[v]) || "neutro"; plan.p(i, r + 1, `${c.icones && c.icones[v] ? `${c.icones[v]} ` : ""}${v}`, est({ b: true, cor: escuro(x), fill: fundoTom(x), h: "center", ...lado })); return; }
        const tp = tipos[i];
        if (tp) { const x = tp.numeros[r]; const sinal = c.visual === "sinal"; plan.p(i, r + 1, x == null ? "" : x, est({ h: "right", fmt: formatoNumero(tp, sinal), fill: zebra, b: sinal, cor: sinal && x ? (x > 0 ? "1D7A46" : "B3261E") : "1C1D21", ...lado })); return; }
        plan.p(i, r + 1, v, est({ fill: zebra, h: "left", wrap: v.length > 38, ...lado }));
      });
    });
    colunas.forEach((c, i) => { if (c.visual === "barra" && tipos[i] && linhas.length) barras.push({ faixa: `${ref(i, 1)}:${ref(i, linhas.length)}`, cor: "2F46C8" }); });
    const aba2 = plan.xml({ colunas: largura, congelar: true, filtro: `A1:${ref(nCol - 1, linhas.length)}`, barras, cor: COR_AZUL, ativa: false, grade: false });

    // ── aba Resumo ──
    const res = criarAba(t); const NC = 12; const dataTxt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(quando);
    res.p(0, 0, "NOVA ERA · CONFERE CARGA", est({ b: true, sz: 9, cor: COR_MARCA })); res.p(0, 1, b.titulo, est({ b: true, sz: 22, cor: COR_AZUL })); res.alturas.set(1, 32);
    if (b.subtitulo) res.p(0, 2, b.subtitulo, est({ sz: 11, cor: COR_SUAVE })); res.p(0, 3, `Gerado em ${dataTxt}${quem ? ` por ${quem}` : ""} · ${linhas.length} ${linhas.length === 1 ? "linha" : "linhas"} na aba Planilha`, est({ i: true, sz: 9, cor: COR_SUAVE }));
    const juntar = []; let linhaK = 5;
    kpis.forEach(([rotulo, texto, ex], k) => {
      const c0 = (k % 6) * 2; const r0 = 5 + Math.floor(k / 6) * 3; linhaK = r0 + 3; const x = ex.tom || "neutro";
      const sRot = est({ b: true, sz: 8, cor: COR_SUAVE, fill: fundoTom(x), h: "left", esq: ["thick", tom(x)], topo: ["thin", COR_LINHA] }); const sVal = est({ b: true, sz: 20, cor: escuro(x), fill: fundoTom(x), h: "left", esq: ["thick", tom(x)], base: ["thin", COR_LINHA], fmt: ex.numero != null ? `${Number.isInteger(ex.numero) ? "#,##0" : "#,##0.0"}${ex.sufixo ? (ex.sufixo.trim() === "%" ? '"%"' : ` "${ex.sufixo.trim().replace(/"/g, "")}"`) : ""}` : null });
      res.p(c0, r0, String(rotulo).toUpperCase(), sRot); res.p(c0 + 1, r0, null, sRot); res.p(c0, r0 + 1, ex.numero != null ? ex.numero : String(texto), sVal); res.p(c0 + 1, r0 + 1, null, sVal);
      juntar.push(`${ref(c0, r0)}:${ref(c0 + 1, r0)}`, `${ref(c0, r0 + 1)}:${ref(c0 + 1, r0 + 1)}`); res.alturas.set(r0, 19); res.alturas.set(r0 + 1, 36);
    });
    // gráficos e as tabelinhas dos números deles (colunas N em diante)
    const colDados = NC + 1; let linhaDados = 6; const desenhos = []; const abaNome = "Resumo";
    res.p(colDados, 3, "Números dos gráficos", est({ b: true, sz: 10, cor: COR_SUAVE }));
    graficos.forEach((g, k) => {
      const d = dadosDoGrafico(g, paleta); const r0 = linhaDados; res.p(colDados, r0 - 1, g.titulo, est({ b: true, sz: 9, cor: COR_MARCA }));
      res.p(colDados, r0, d.cabecalho, est({ b: true, cor: "FFFFFF", fill: COR_AZUL, h: "left" })); d.series.forEach((s, i) => res.p(colDados + 1 + i, r0, s.rotulo, est({ b: true, cor: "FFFFFF", fill: COR_AZUL, h: "right" })));
      d.cats.forEach((cat, i) => { res.p(colDados, r0 + 1 + i, cat, est({ base: ["thin", COR_LINHA] })); d.series.forEach((s, j) => res.p(colDados + 1 + j, r0 + 1 + i, s.valores[i] || 0, est({ h: "right", fmt: "#,##0.##", base: ["thin", COR_LINHA] }))); });
      linhaDados = r0 + d.cats.length + 4; desenhos.push({ g, dados: { aba: abaNome, c0: colDados, r0: r0 + 1, cats: d.cats, series: d.series }, k });
    });
    const larguraRes = [...Array(NC).fill(13), 3, 26, 13, 13, 13, 13];
    const altoDe = ({ g, dados }) => (g.tipo === "barrasH" ? Math.min(34, Math.max(15, Math.round(5 + dados.cats.length * (dados.series.length > 1 ? 2.1 : 1.5)))) : 15);
    const faixas = []; for (let k = 0; k < desenhos.length; k += 2) faixas.push(Math.max(...desenhos.slice(k, k + 2).map(altoDe)));
    const inicioFaixa = faixas.map((_, i) => linhaK + 1 + faixas.slice(0, i).reduce((n, h) => n + h + 2, 0));
    const ancoras = desenhos.map((d, k) => ({ de: [(k % 2) * 6, inicioFaixa[Math.floor(k / 2)]], ate: [(k % 2) * 6 + 6, inicioFaixa[Math.floor(k / 2)] + altoDe(d)] }));
    const ultimaLinhaRes = graficos.length ? inicioFaixa[inicioFaixa.length - 1] + faixas[faixas.length - 1] + 1 : linhaK + 3;
    if (!graficos.length) res.p(0, linhaK + 1, "Esta planilha não tem gráficos: veja os números na aba Planilha.", est({ i: true, cor: COR_SUAVE }));
    const aba1 = res.xml({ colunas: larguraRes, juntar, cor: COR_MARCA, grade: false, ativa: true, retrato: false, desenho: graficos.length > 0, umaFolha: true });

    // ── partes do arquivo ──
    const estiloXml = E.xml();
    const compartilhadas = `${XML}<sst xmlns="${NS.main}" count="${textos.length}" uniqueCount="${textos.length}">${textos.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;
    const nomeFiltro = `'Planilha'!$A$1:$${letra(nCol - 1)}$${linhas.length + 1}`;
    arquivos.push({ nome: "[Content_Types].xml", dados: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${graficos.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""}${graficos.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join("")}</Types>` });
    arquivos.push({ nome: "_rels/.rels", dados: `${XML}<Relationships xmlns="${NS.pkg}"><Relationship Id="rId1" Type="${NS.rel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${NS.rel}/extended-properties" Target="docProps/app.xml"/></Relationships>` });
    arquivos.push({ nome: "docProps/core.xml", dados: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(b.titulo)}</dc:title><dc:creator>Confere Carga · Nova Era</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${quando.toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>` });
    arquivos.push({ nome: "docProps/app.xml", dados: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Confere Carga</Application><Company>Nova Era</Company></Properties>` });
    arquivos.push({ nome: "xl/workbook.xml", dados: `${XML}<workbook xmlns="${NS.main}" xmlns:r="${NS.rel}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/><sheet name="Planilha" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">${esc(nomeFiltro)}</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">Resumo!$A$1:$L$${ultimaLinhaRes}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="1">'Planilha'!$1:$1</definedName></definedNames><calcPr calcId="191029"/></workbook>` });
    arquivos.push({ nome: "xl/_rels/workbook.xml.rels", dados: `${XML}<Relationships xmlns="${NS.pkg}"><Relationship Id="rId1" Type="${NS.rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS.rel}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${NS.rel}/styles" Target="styles.xml"/><Relationship Id="rId4" Type="${NS.rel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>` });
    arquivos.push({ nome: "xl/styles.xml", dados: estiloXml }, { nome: "xl/sharedStrings.xml", dados: compartilhadas }, { nome: "xl/worksheets/sheet1.xml", dados: aba1 }, { nome: "xl/worksheets/sheet2.xml", dados: aba2 });
    if (graficos.length) {
      arquivos.push({ nome: "xl/worksheets/_rels/sheet1.xml.rels", dados: `${XML}<Relationships xmlns="${NS.pkg}"><Relationship Id="rId1" Type="${NS.rel}/drawing" Target="../drawings/drawing1.xml"/></Relationships>` });
      arquivos.push({ nome: "xl/drawings/_rels/drawing1.xml.rels", dados: `${XML}<Relationships xmlns="${NS.pkg}">${graficos.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS.rel}/chart" Target="../charts/chart${i + 1}.xml"/>`).join("")}</Relationships>` });
      arquivos.push({ nome: "xl/drawings/drawing1.xml", dados: `${XML}<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}" xmlns:r="${NS.rel}" xmlns:c="${NS.ch}">${ancoras.map((an, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${an.de[0]}</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>${an.de[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${an.ate[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${an.ate[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS.ch}"><c:chart r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join("")}</xdr:wsDr>` });
      desenhos.forEach(({ g, dados }, i) => arquivos.push({ nome: `xl/charts/chart${i + 1}.xml`, dados: graficoXml(g, dados, Object.fromEntries(Object.entries(paleta).map(([k, v]) => [k, hex(v)]))) }));
    }
    return zip(arquivos);
  }

  const API = { xlsx, lerNumero, crc32, zip, MIME: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  raiz.NEPlanilha = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  const NE = raiz.NE; if (NE) {
    NE.planilha = {
      ...API,
      // Baixa o .xlsx do bloco (o mesmo que está na tela). Devolve o nome do arquivo.
      async baixar(b) { const quem = NE.app && NE.app.perfil ? NE.app.perfil.nome : ""; const dados = await xlsx(b, { quem }); const nome = `${b.arquivo || "planilha"}-${NE.hojeISO()}.xlsx`; NE.imp.baixar(new Blob([dados], { type: API.MIME }), nome); return nome; },
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
