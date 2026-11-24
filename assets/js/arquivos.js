// ARQUIVOS: a pessoa ESCOLHE o formato da planilha (PDF, imagem, Excel, CSV, XML ou JSON) e o próprio app abre o arquivo:
// PDF, imagem, XML, CSV, JSON, texto e Excel (.xlsx). Ver no app, baixar ou compartilhar, sem depender de outro programa.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const CHAVE = "ne-formato-arquivo";
  const esc = (t) => String(t == null ? "" : t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MIME = { pdf: "application/pdf", png: "image/png", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv;charset=utf-8", xml: "application/xml;charset=utf-8", json: "application/json;charset=utf-8" };
  const FORMATOS = [
    { id: "pdf", rotulo: "PDF", icone: "nota", dica: "A folha pronta, com gráficos. Bom para ler, imprimir e mandar no WhatsApp." },
    { id: "png", rotulo: "Imagem", icone: "galeria", dica: "Uma figura (PNG) da folha inteira. Bom para colar em mensagem ou apresentação." },
    { id: "xlsx", rotulo: "Excel", icone: "grafico", dica: "Planilha organizada, com resumo e gráficos. Para trabalhar os números no computador." },
    { id: "csv", rotulo: "CSV", icone: "lista", dica: "Só os dados, em texto. Abre em qualquer programa de planilha." },
    { id: "xml", rotulo: "XML", icone: "copiar", dica: "Os dados em XML, para outros sistemas lerem." },
    { id: "json", rotulo: "JSON", icone: "chave", dica: "Os dados em JSON, para programas e integrações." },
  ];

  // ───────────── gerar cada formato a partir do bloco da planilha ─────────────
  const xmlDe = (b) => {
    const q = (t) => esc(t).replace(/'/g, "&apos;");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<planilha titulo="${q(b.titulo)}" arquivo="${q(b.arquivo || "")}" geradoEm="${new Date().toISOString()}">\n  <resumo>\n${(b.resumo || []).map((r) => `    <indicador nome="${q(r[0])}" valor="${q(r[1])}"${r[2] && r[2].tom ? ` tom="${q(r[2].tom)}"` : ""}/>`).join("\n")}\n  </resumo>\n  <linhas total="${b.linhas.length}">\n${b.linhas.map((l, i) => `    <linha n="${i + 1}">${l.map((v, k) => `<campo nome="${q(b.colunas[k].rotulo)}">${esc(v)}</campo>`).join("")}</linha>`).join("\n")}\n  </linhas>\n</planilha>\n`;
  };
  const jsonDe = (b) => JSON.stringify({ titulo: b.titulo, subtitulo: b.subtitulo || "", geradoEm: new Date().toISOString(), resumo: (b.resumo || []).map((r) => ({ nome: r[0], valor: r[1], ...(r[2] && r[2].numero != null ? { numero: r[2].numero } : {}) })), linhas: b.linhas.map((l) => Object.fromEntries(b.colunas.map((c, k) => [c.rotulo, l[k]]))) }, null, 2);
  const quem = () => (NE.app && NE.app.perfil ? NE.app.perfil.nome : "");
  async function pdfParaPng(bytes) {   // todas as páginas do PDF, uma embaixo da outra, numa figura só (até ~14.000 pontos de altura)
    await NE.carregarScript("assets/vendor/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise; const largura = 1240; const cvs = []; let alto = 0;
    for (let n = 1; n <= pdf.numPages; n++) { const pg = await pdf.getPage(n); const v0 = pg.getViewport({ scale: 1 }); const v = pg.getViewport({ scale: largura / v0.width }); if (cvs.length && alto + v.height > 14000) break; const cv = document.createElement("canvas"); cv.width = largura; cv.height = Math.round(v.height); await pg.render({ canvasContext: cv.getContext("2d"), viewport: v }).promise; cvs.push(cv); alto += cv.height + 16; }
    const tudo = document.createElement("canvas"); tudo.width = largura; tudo.height = alto - 16; const g = tudo.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, tudo.width, tudo.height); let y = 0; for (const c of cvs) { g.drawImage(c, 0, y); y += c.height + 16; }
    pdf.destroy(); return new Promise((ok) => tudo.toBlob(ok, "image/png"));
  }
  NE.gerarArquivo = async (b, formato) => {
    const base = `${b.arquivo || "planilha"}-${NE.hojeISO()}`; const csv = () => D.csv(b.colunas.map((c) => c.rotulo), b.linhas);
    if (formato === "pdf") return { blob: new Blob([await window.NEPdfRelatorio.gerar(b, { quem: quem() })], { type: MIME.pdf }), nome: `${base}.pdf` };
    if (formato === "png") return { blob: await pdfParaPng(await window.NEPdfRelatorio.gerar(b, { quem: quem() })), nome: `${base}.png` };
    if (formato === "xlsx") return { blob: new Blob([await window.NEPlanilha.xlsx(b, { quem: quem() })], { type: MIME.xlsx }), nome: `${base}.xlsx` };
    if (formato === "csv") return { blob: new Blob([csv()], { type: MIME.csv }), nome: `${base}.csv` };
    if (formato === "xml") return { blob: new Blob([xmlDe(b)], { type: MIME.xml }), nome: `${base}.xml` };
    if (formato === "json") return { blob: new Blob([jsonDe(b)], { type: MIME.json }), nome: `${base}.json` };
    throw new Error("Formato desconhecido.");
  };

  // ───────────── janela "Salvar como…" ─────────────
  NE.escolherFormato = (b) => {
    let fid = NE.memoria.ler(CHAVE); if (!FORMATOS.some((f) => f.id === fid)) fid = "pdf";
    const chips = el("div", { class: "fmt-grade", role: "radiogroup", "aria-label": "Formato do arquivo" }); const dica = el("p", { class: "suave fmt-dica", id: "fmt-dica" });
    const desenhar = () => { chips.replaceChildren(...FORMATOS.map((f) => el("button", { type: "button", class: "fmt-opcao", id: `fmt-${f.id}`, role: "radio", "aria-checked": String(f.id === fid), onclick: () => { fid = f.id; NE.memoria.gravar(CHAVE, fid); desenhar(); } }, ic(f.icone), el("b", {}, f.rotulo)))); dica.textContent = FORMATOS.find((f) => f.id === fid).dica; };
    const pronto = async () => NE.gerarArquivo(b, fid);
    const ver = el("button", { type: "button", class: "btn btn-azul", id: "fmt-ver" }, ic("olho"), "Ver no app");
    const baixar = el("button", { type: "button", class: "btn btn-principal", id: "fmt-baixar" }, ic("baixar"), "Baixar");
    const enviar = el("button", { type: "button", class: "btn btn-secundario", id: "fmt-compartilhar" }, ic("enviar"), "Compartilhar");
    ver.addEventListener("click", () => NE.comCarregando(ver, async () => { const a = await pronto(); j.fechar(); await NE.abrirArquivo(a.blob, { titulo: `${b.titulo} · ${FORMATOS.find((f) => f.id === fid).rotulo}`, nome: a.nome }); }));
    baixar.addEventListener("click", () => NE.comCarregando(baixar, async () => { const a = await pronto(); NE.imp.baixar(a.blob, a.nome); j.fechar(); NE.aviso(`${a.nome} baixado.`, "ok"); }));
    enviar.addEventListener("click", () => NE.comCarregando(enviar, async () => { const a = await pronto(); const r = await NE.imp.compartilhar([a.blob], [a.nome], b.titulo); if (r === "baixado") NE.aviso("Este aparelho não compartilha arquivos: o arquivo foi baixado.", "ok"); j.fechar(); }));
    desenhar(); let j;
    j = NE.janelaSimples({ etiqueta: "Salvar como", titulo: "Escolha o formato", corpo: el("div", {}, el("p", { class: "suave", style: "margin:0 0 10px" }, "O app faz o arquivo no formato que você escolher e também abre ele aqui mesmo."), chips, dica), rodape: [ver, baixar, enviar], pequena: true }); return j;
  };

  // ───────────── abrir qualquer arquivo no app ─────────────
  const tipoDe = (a) => { const n = String(a.name || "").toLowerCase(); const t = String(a.type || "").toLowerCase(); return /pdf/.test(t) || n.endsWith(".pdf") ? "pdf" : /^image\//.test(t) || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n) ? "imagem" : /xlsx|spreadsheetml/.test(t) || n.endsWith(".xlsx") ? "xlsx" : /xml/.test(t) || n.endsWith(".xml") ? "xml" : /csv/.test(t) || n.endsWith(".csv") ? "csv" : /json/.test(t) || n.endsWith(".json") ? "json" : /^text\//.test(t) || n.endsWith(".txt") ? "texto" : ""; };
  const identar = (xml) => { let nivel = 0; return xml.replace(/>\s*</g, ">\n<").split("\n").map((l) => { if (/^<\//.test(l)) nivel = Math.max(0, nivel - 1); const r = `${"  ".repeat(nivel)}${l}`; if (/^<[^!?\/][^>]*[^\/]>$/.test(l) && !/<\/[^>]+>$/.test(l)) nivel++; return r; }).join("\n"); };
  const lerCsv = (t) => { const sep = (t.split("\n")[0].match(/;/g) || []).length >= (t.split("\n")[0].match(/,/g) || []).length ? ";" : ","; const linhas = []; let cel = "", lin = [], asp = false; t = t.replace(/^﻿/, ""); for (let i = 0; i < t.length; i++) { const c = t[i]; if (asp) { if (c === '"' && t[i + 1] === '"') { cel += '"'; i++; } else if (c === '"') asp = false; else cel += c; } else if (c === '"') asp = true; else if (c === sep) { lin.push(cel); cel = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; lin.push(cel); cel = ""; linhas.push(lin); lin = []; } else cel += c; } if (cel || lin.length) { lin.push(cel); linhas.push(lin); } return linhas; };
  async function lerXlsx(u8) {   // lê o .xlsx (zip + XML): primeira aba de dados
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("zip");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const arqs = new Map(); const dec = new TextDecoder();
    for (let i = 0; i < n; i++) { const met = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true); const nome = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (!/^xl\/(worksheets\/sheet\d+|sharedStrings)\.xml$/.test(nome)) continue; const ini = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); let d = u8.subarray(ini, ini + cs); if (met === 8) d = new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); arqs.set(nome, dec.decode(d)); }
    const xml = (s) => new DOMParser().parseFromString(s, "application/xml"); const comp = arqs.has("xl/sharedStrings.xml") ? [...xml(arqs.get("xl/sharedStrings.xml")).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
    const nomeAba = arqs.has("xl/worksheets/sheet2.xml") ? "xl/worksheets/sheet2.xml" : [...arqs.keys()].find((k) => /sheet\d/.test(k)); if (!nomeAba) throw new Error("sem aba");
    const col = (r) => { let c = 0; for (const ch of r.replace(/\d+/g, "")) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
    return [...xml(arqs.get(nomeAba)).getElementsByTagName("row")].slice(0, 1200).map((row) => { const l = []; for (const c of row.getElementsByTagName("c")) { const v = c.getElementsByTagName("v")[0]; const t = c.getAttribute("t"); l[col(c.getAttribute("r"))] = t === "s" && v ? comp[Number(v.textContent)] : t === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent).join("") : v ? v.textContent : ""; } return Array.from(l, (x) => x ?? ""); });
  }
  const tabela = (linhas) => { const t = el("table", { class: "imp-tabela gf-tabela gf-larga" }); const [cab, ...resto] = linhas; t.append(el("thead", {}, el("tr", {}, (cab || []).map((c) => el("th", {}, c)))), el("tbody", {}, resto.slice(0, 1000).map((l) => el("tr", {}, (cab || l).map((_, i) => el("td", {}, l[i] == null ? "" : l[i])))))); return el("div", { class: "arq-papel arq-tabela" }, el("div", { class: "tabela-wrap" }, t), resto.length > 1000 ? el("p", { class: "suave" }, `Mostrando 1.000 de ${resto.length} linhas.`) : null); };

  NE.abrirArquivo = async (fonte, { titulo, nome } = {}) => {
    const arq = fonte instanceof Blob ? fonte : new Blob([fonte]); const nm = nome || fonte.name || "arquivo"; const tipo = tipoDe({ name: nm, type: arq.type || (fonte && fonte.type) });
    const tit = titulo || nm.replace(/\.[a-z0-9]+$/i, "");
    if (tipo === "pdf") return NE.verPdf(arq, { titulo: tit, nome: nm });
    if (!tipo) { NE.aviso("O app abre PDF, imagem, XML, CSV, JSON, texto e Excel. Este arquivo é de outro tipo.", "alerta"); return null; }
    const area = el("div", { class: "pdf-area", tabindex: "0" }); const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const info = el("span", { class: "pdf-info" }, `${{ imagem: "Imagem", xlsx: "Excel", xml: "XML", csv: "CSV", json: "JSON", texto: "Texto" }[tipo]} · ${nm}`);
    const fundo = el("div", { class: "pdf-vista", role: "dialog", "aria-modal": "true", "aria-label": tit }, el("div", { class: "pdf-topo" }, el("div", { class: "pdf-titulo" }, el("strong", {}, tit), info), fechar), area,
      el("div", { class: "pdf-ferramentas" }, ...(tipo === "imagem" ? [el("button", { type: "button", class: "pdf-lupa", id: "pdf-menos", "aria-label": "Afastar", html: NE.icone.menos, onclick: () => zoom(0.8) }), el("button", { type: "button", class: "pdf-lupa", id: "pdf-mais", "aria-label": "Aproximar", html: NE.icone.mais, onclick: () => zoom(1.25) })] : []),
        el("button", { type: "button", class: "pdf-btn", id: "arq-baixar", onclick: () => NE.imp.baixar(arq, nm) }, ic("baixar"), el("span", {}, "Baixar")), el("button", { type: "button", class: "pdf-btn", id: "arq-compartilhar", onclick: async () => { const r = await NE.imp.compartilhar([arq], [nm], tit); if (r === "baixado") NE.aviso("Este aparelho não compartilha arquivos: o arquivo foi baixado.", "ok"); } }, ic("enviar"), el("span", {}, "Compartilhar"))));
    document.body.append(fundo); let z = 1; let img = null; const zoom = (f) => { z = Math.max(0.4, Math.min(5, z * f)); if (img) img.style.width = `${Math.round(z * 100)}%`; };
    const sair = () => { fundo.remove(); window.removeEventListener("keydown", tecla, true); if (img) URL.revokeObjectURL(img.src); }; const tecla = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); sair(); } }; fechar.addEventListener("click", sair); window.addEventListener("keydown", tecla, true);
    try {
      if (tipo === "imagem") { img = el("img", { class: "arq-imagem", alt: tit, src: URL.createObjectURL(arq) }); img.style.width = "100%"; area.append(img); }
      else if (tipo === "xlsx") area.append(tabela(await lerXlsx(new Uint8Array(await arq.arrayBuffer()))));
      else if (tipo === "csv") area.append(tabela(lerCsv(await arq.text())));
      else { let t = await arq.text(); if (tipo === "xml") { const d = new DOMParser().parseFromString(t, "application/xml"); t = d.getElementsByTagName("parsererror").length ? t : identar(t.replace(/^﻿/, "").replace(/<\?xml[^>]*\?>\s*/, (m) => `${m}\n`)); } else if (tipo === "json") { try { t = JSON.stringify(JSON.parse(t), null, 2); } catch { /* mostra como veio */ } } area.append(el("pre", { class: "arq-papel arq-texto" }, t.slice(0, 400000))); }
    } catch (e) { console.error(e); area.replaceChildren(el("p", { class: "pdf-aviso" }, "Não consegui abrir este arquivo. Ele pode estar danificado.")); }
    return { fechar: sair };
  };
  // Escolher um arquivo do aparelho e abrir
  NE.abrirArquivoDoAparelho = () => {
    const entrada = el("input", { type: "file", accept: "application/pdf,.pdf,image/*,.xml,text/xml,application/xml,.csv,text/csv,.json,application/json,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", hidden: true, id: "arq-arquivo" });
    entrada.addEventListener("change", async () => { const a = entrada.files[0]; entrada.remove(); if (a) await NE.abrirArquivo(a, { nome: a.name }); }); document.body.append(entrada); entrada.click();
  };
  NE.abrirPdfDoAparelho = NE.abrirArquivoDoAparelho;
  // Arquivo que chegou pelo "Compartilhar" do celular (service worker guarda) ou pelo "Abrir com" do computador
  NE.abrirCompartilhado = async () => {
    try {
      const cache = await caches.open("ne-compartilhado"); const ks = await cache.keys(); let n = 0;
      for (const k of ks) { const r = await cache.match(k); const nome = decodeURIComponent(k.url.split("/").pop()); const b = await r.blob(); await cache.delete(k); if (!n++) await NE.abrirArquivo(new File([b], nome, { type: b.type }), { nome }); }
      return n;
    } catch { return 0; }
  };
  const params = new URLSearchParams(location.search);
  if (params.get("abrir") === "compartilhado") { params.delete("abrir"); try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash); } catch { /* ok */ } setTimeout(NE.abrirCompartilhado, 700); }
  if ("launchQueue" in window) window.launchQueue.setConsumer(async (l) => { for (const h of l.files || []) { const f = await h.getFile(); NE.abrirArquivo(f, { nome: f.name }); break; } });
})();
