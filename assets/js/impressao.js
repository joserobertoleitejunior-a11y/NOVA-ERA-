// IMPRESSÃO UNIVERSAL. Um motor só para etiquetas, cartões de acesso e relatórios.
//
//  1. IMPRIMIR  → abre o diálogo de impressão do aparelho. Serve para QUALQUER impressora que o aparelho já enxerga:
//                 laser, jato de tinta, térmica com driver, Wi-Fi, USB, Bluetooth com serviço de impressão, AirPrint, "Salvar como PDF".
//  2. PDF/IMAGEM → arquivo no tamanho exato do papel, para abrir no aplicativo da própria impressora ou mandar pelo WhatsApp.
//  3. DIRETO     → (beta) Bluetooth ou USB, falando ESC/POS ou ZPL, para térmica que não tem driver no aparelho. Só onde o navegador deixa.
// A etiqueta é desenhada uma vez (etiqueta-layout.js) e pintada por três caminhos: SVG (prévia e diálogo), canvas → bitmap (PDF, PNG, direto).
(() => {
  const NE = window.NE;
  const Lay = window.NEEtiquetaLayout;
  const { el, ic } = NE;
  const FAM = Lay.FAMILIA;
  const imp = (NE.imp = {});
  const CHAVE = "ne-impressora";
  const PADRAO = { formato: Lay.FORMATO_PADRAO, outroW: 100, outroH: 60, linguagem: "escpos", dpi: 203, cabeca: 0 };

  imp.config = () => ({ ...PADRAO, ...(NE.memoria.ler(CHAVE) || {}) });
  imp.guardar = (parte) => NE.memoria.gravar(CHAVE, { ...imp.config(), ...parte });
  imp.formatoDe = (cfg = imp.config()) => (cfg.formato === "outro" ? Lay.personalizado(Math.max(20, Math.min(300, Number(cfg.outroW) || 100)), Math.max(15, Math.min(400, Number(cfg.outroH) || 60))) : Lay.FORMATOS[cfg.formato] || Lay.FORMATOS[Lay.FORMATO_PADRAO]);

  // ───────────── QR e medida de texto ─────────────
  let qrPronto = null; const caches = new Map();
  const prontoQr = () => (window.qrcode ? Promise.resolve() : (qrPronto = qrPronto || NE.carregarScript("assets/vendor/qrcode.js")));
  function matriz(texto, nivel) {
    const k = `${nivel}|${texto}`; if (caches.has(k)) return caches.get(k);
    if (caches.size > 400) caches.clear();
    const q = window.qrcode(0, nivel); q.addData(texto); q.make(); const n = q.getModuleCount();
    const m = { n, escuro: (r, c) => q.isDark(r, c) }; caches.set(k, m); return m;
  }
  const modulos = (texto, nivel) => matriz(texto, nivel).n;
  let ctxMedir = null;
  const medir = (t, s, neg) => { ctxMedir = ctxMedir || document.createElement("canvas").getContext("2d"); ctxMedir.font = `${neg ? 800 : 600} 100px ${FAM}`; return ctxMedir.measureText(String(t)).width * (s / 100); };
  const fontesProntas = async () => { try { await Promise.all([document.fonts.load(`800 20px "Archivo NE"`), document.fonts.load(`600 20px "Archivo NE"`)]); } catch { /* segue com a fonte do sistema */ } };

  // Monta os layouts de uma lista de etiquetas (aguarda o QR e a fonte).
  imp.montar = async (especs, formato) => { await Promise.all([prontoQr(), fontesProntas()]); return especs.map((e) => Lay.afinarQr(Lay.layout(e, formato, medir), modulos)); };
  imp.legibilidade = (lay, dpi) => Lay.legibilidade(lay, modulos, dpi);

  // ───────────── desenhista 1: SVG ─────────────
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const n2 = (v) => Math.round(v * 1000) / 1000;
  function qrSvg(q) {
    const m = matriz(q.texto, q.nivel); const mod = q.size / (m.n + 2 * q.quiet); const x0 = q.x + q.quiet * mod; const y0 = q.y + q.quiet * mod; let d = "";
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) { if (!m.escuro(r, c)) continue; let f = c; while (f + 1 < m.n && m.escuro(r, f + 1)) f++; d += `M${n2(x0 + c * mod)} ${n2(y0 + r * mod)}h${n2((f - c + 1) * mod)}v${n2(mod)}h-${n2((f - c + 1) * mod)}z`; c = f; }
    return `<rect x="${n2(q.x)}" y="${n2(q.y)}" width="${n2(q.size)}" height="${n2(q.size)}" fill="#fff"/><path d="${d}" fill="#000" shape-rendering="crispEdges"/>`;
  }
  imp.svg = (lay, { mm = true, rotulo = "Etiqueta" } = {}) => {
    const p = lay.itens.map((i) => {
      if (i.k === "r") return `<rect x="${n2(i.x)}" y="${n2(i.y)}" width="${n2(i.w)}" height="${n2(i.h)}" fill="${i.f}"/>`;
      if (i.k === "l") return `<line x1="${n2(i.x1)}" y1="${n2(i.y1)}" x2="${n2(i.x2)}" y2="${n2(i.y2)}" stroke="#000" stroke-width="${i.sw}"/>`;
      if (i.k === "q") return qrSvg(i);
      return `<text x="${n2(i.x)}" y="${n2(i.y)}" font-size="${n2(i.s)}" font-weight="${i.b ? 800 : 600}" font-family='${FAM.replace(/'/g, "&#39;")}' text-anchor="${i.a}" fill="${i.c}">${esc(i.t)}</text>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lay.w} ${lay.h}"${mm ? ` width="${lay.w}mm" height="${lay.h}mm"` : ""} role="img" aria-label="${esc(rotulo)}"><rect width="${lay.w}" height="${lay.h}" fill="#fff"/>${p}</svg>`;
  };

  // ───────────── desenhista 2: canvas (e daí o bitmap) ─────────────
  function pintar(ctx, lay, pxMm, ox, oy, semQr = false) {
    for (const i of lay.itens) {
      if (semQr && i.k === "q") continue;   // o PDF leva o QR em vetor (ver imp.pdf)
      if (i.k === "r") { ctx.fillStyle = i.f; const x = Math.round(ox + i.x * pxMm), y = Math.round(oy + i.y * pxMm); ctx.fillRect(x, y, Math.round(ox + (i.x + i.w) * pxMm) - x, Math.round(oy + (i.y + i.h) * pxMm) - y); }
      else if (i.k === "l") { ctx.strokeStyle = "#000"; ctx.lineWidth = Math.max(1, i.sw * pxMm); ctx.beginPath(); ctx.moveTo(ox + i.x1 * pxMm, oy + i.y1 * pxMm); ctx.lineTo(ox + i.x2 * pxMm, oy + i.y2 * pxMm); ctx.stroke(); }
      else if (i.k === "t") { ctx.fillStyle = i.c; ctx.font = `${i.b ? 800 : 600} ${i.s * pxMm}px ${FAM}`; ctx.textAlign = i.a === "end" ? "right" : i.a === "middle" ? "center" : "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(i.t, ox + i.x * pxMm, oy + i.y * pxMm); }
      else if (i.k === "q") {
        // módulos com número INTEIRO de pontos: borda nítida em qualquer resolução (é o que deixa o QR legível na impressora)
        const m = matriz(i.texto, i.nivel); const total = i.size * pxMm; const mp = Math.max(1, Math.floor(total / (m.n + 2 * i.quiet))); const lado = mp * (m.n + 2 * i.quiet);
        const x = Math.round(ox + i.x * pxMm + (total - lado) / 2), y = Math.round(oy + i.y * pxMm + (total - lado) / 2);
        ctx.fillStyle = "#fff"; ctx.fillRect(x, y, lado, lado); ctx.fillStyle = "#000";
        for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) { if (!m.escuro(r, c)) continue; let f = c; while (f + 1 < m.n && m.escuro(r, f + 1)) f++; ctx.fillRect(x + (c + i.quiet) * mp, y + (r + i.quiet) * mp, (f - c + 1) * mp, mp); c = f; }
      }
    }
  }
  // Uma página inteira vira um bitmap de 1 bit (1 = ponto preto). dpi: 203 e 300 são as térmicas; 300 serve para PDF.
  imp.bitmap = (pagina, dpi, { semQr = false } = {}) => {
    const px = dpi / 25.4; const W = Math.round(pagina.w * px), H = Math.round(pagina.h * px);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    for (const it of pagina.itens) pintar(ctx, it.lay, px, it.x * px, it.y * px, semQr);
    const rgba = ctx.getImageData(0, 0, W, H).data; const bpl = Math.ceil(W / 8); const bits = new Uint8Array(bpl * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if ((rgba[k] * 299 + rgba[k + 1] * 587 + rgba[k + 2] * 114) / 1000 < 160) bits[y * bpl + (x >> 3)] |= 0x80 >> (x & 7); }
    return { largura: W, altura: H, bytesPorLinha: bpl, bits, canvas: cv };
  };

  // ───────────── PDF no tamanho exato do papel ─────────────
  // Cada página é uma imagem de 1 bit (nítida e leve) e o QR vai POR CIMA, em vetor: a impressora (203, 300, 600 dpi...) refaz a borda de cada
  // módulo na própria resolução, em vez de reamostrar uma imagem e borrar o QR. Escrevemos o PDF à mão: não precisa de biblioteca.
  async function comprimir(u8) {
    if (typeof CompressionStream === "undefined") return null;
    try { const cs = new CompressionStream("deflate"); const w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch { return null; }
  }
  imp.pdf = async (paginas, dpi = 300, titulo = "Confere Carga") => {
    const enc = new TextEncoder(); const partes = []; let pos = 0; const desloc = [];
    const bytes = (u8) => { partes.push(u8); pos += u8.length; }; const txt = (s) => bytes(enc.encode(s));
    const pt = (mm) => Math.round((mm * 72 / 25.4) * 100) / 100;
    // Módulos escuros como retângulos de UM caminho só (sem frestas entre linhas: as bordas de cima e de baixo usam o mesmo número)
    const vetorQr = (p) => {
      const hPt = pt(p.h); let d = "";
      for (const it of p.itens) for (const i of it.lay.itens) {
        if (i.k !== "q") continue;
        const m = matriz(i.texto, i.nivel); const mod = i.size / (m.n + 2 * i.quiet); const x0 = it.x + i.x + i.quiet * mod, y0 = it.y + i.y + i.quiet * mod;
        const X = (c) => pt(x0 + c * mod); const Y = (r) => n2(hPt - pt(y0 + r * mod));
        for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) { if (!m.escuro(r, c)) continue; let f = c; while (f + 1 < m.n && m.escuro(r, f + 1)) f++; d += `${X(c)} ${Y(r + 1)} ${n2(X(f + 1) - X(c))} ${n2(Y(r) - Y(r + 1))} re `; c = f; }
      }
      return d ? ` q 0 g ${d}f Q` : "";
    };
    bytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    const objeto = (num, cabecalho, fluxo) => { desloc[num] = pos; txt(`${num} 0 obj\n${cabecalho}`); if (fluxo) { txt("\nstream\n"); bytes(fluxo); txt("\nendstream"); } txt("\nendobj\n"); };
    const total = 3 + paginas.length * 3; const filhos = [];
    for (let i = 0; i < paginas.length; i++) {
      const p = paginas[i]; const bm = imp.bitmap(p, dpi, { semQr: true }); const branco = bm.bits.map((b) => (~b) & 0xff);   // no PDF, 1 = branco
      const pagina = 3 + i * 3, conteudo = 4 + i * 3, imagem = 5 + i * 3; filhos.push(`${pagina} 0 R`);
      const zip = await comprimir(branco); const dados = zip || branco;
      const w = pt(p.w), h = pt(p.h); const desenho = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q${vetorQr(p)}`);
      objeto(pagina, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imagem} 0 R >> >> /Contents ${conteudo} 0 R >>`);
      objeto(conteudo, `<< /Length ${desenho.length} >>`, desenho);
      objeto(imagem, `<< /Type /XObject /Subtype /Image /Width ${bm.largura} /Height ${bm.altura} /ColorSpace /DeviceGray /BitsPerComponent 1${zip ? " /Filter /FlateDecode" : ""} /Length ${dados.length} >>`, dados);
    }
    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
    objeto(2, `<< /Type /Pages /Kids [${filhos.join(" ")}] /Count ${paginas.length} >>`);
    const info = total; const tituloPdf = String(titulo).normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, " ");
    objeto(info, `<< /Title (${tituloPdf}) /Producer (Confere Carga - Nova Era) >>`);
    const xref = pos; txt(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
    for (let k = 1; k <= total; k++) txt(`${String(desloc[k]).padStart(10, "0")} 00000 n \n`);
    txt(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(partes, { type: "application/pdf" });
  };

  // ───────────── arquivo: baixar ou compartilhar ─────────────
  imp.baixar = (blob, nome) => { const a = el("a", { href: URL.createObjectURL(blob), download: nome }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  imp.compartilhar = async (blobs, nomes, titulo) => {
    const arqs = blobs.map((b, i) => new File([b], nomes[i], { type: b.type }));
    if (navigator.canShare && navigator.canShare({ files: arqs })) { try { await navigator.share({ files: arqs, title: titulo }); return "compartilhado"; } catch (e) { if (e && e.name === "AbortError") return "cancelado"; } }
    arqs.forEach((a, i) => imp.baixar(blobs[i], nomes[i])); return "baixado";
  };
  imp.png = (bm) => new Promise((ok) => bm.canvas.toBlob(ok, "image/png"));

  // ───────────── impressão do aparelho (qualquer impressora) ─────────────
  function quitarArea() { document.getElementById("area-impressao")?.remove(); document.getElementById("estilo-pagina-imp")?.remove(); document.body.classList.remove("tem-impressao"); }
  imp.quitar = quitarArea;
  function areaDeEtiquetas(paginas) {
    const area = el("div", { id: "area-impressao" });
    for (const p of paginas) {
      const pg = el("section", { class: "imp-pagina", style: `width:${p.w}mm;height:${p.h - 0.4}mm` });
      for (const it of p.itens) pg.append(el("div", { class: "imp-etiqueta", style: `left:${it.x}mm;top:${it.y}mm;width:${it.lay.w}mm;height:${it.lay.h}mm`, html: imp.svg(it.lay, { rotulo: "Etiqueta" }) }));
      area.append(pg);
    }
    return area;
  }
  // `conteudo`: o DOM já pronto da área de impressão; `pagina`: { w, h } em mm (ou "A4" / "A4 landscape")
  imp.imprimirArea = (area, tamanhoPagina, margem = "0") => {
    quitarArea();
    document.head.append(el("style", { id: "estilo-pagina-imp" }, `@page { size: ${tamanhoPagina}; margin: ${margem}; }`));
    document.body.append(area); document.body.classList.add("tem-impressao");
    // espera o navegador desenhar a área antes de abrir o diálogo: evita prévia em branco no celular
    requestAnimationFrame(() => setTimeout(() => { try { window.print(); } catch { NE.aviso("Este aparelho não abriu a impressão. Use \"Salvar PDF\" e imprima por lá.", "erro"); } }, 80));
  };
  imp.imprimirEtiquetas = (paginas) => imp.imprimirArea(areaDeEtiquetas(paginas), `${paginas[0].w}mm ${paginas[0].h}mm`);

  // ───────────── impressora direta (beta): ESC/POS e ZPL por Bluetooth ou USB ─────────────
  const hex = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16); return s.toUpperCase(); };
  // GS v 0: imagem raster (1 = preto). Em faixas de 255 linhas, porque algumas térmicas travam com imagem alta.
  imp.escpos = (bm, { avanco = 3, corte = false } = {}) => {
    const out = [0x1b, 0x40]; const bpl = bm.bytesPorLinha;
    for (let y0 = 0; y0 < bm.altura; y0 += 255) {
      const h = Math.min(255, bm.altura - y0);
      out.push(0x1d, 0x76, 0x30, 0x00, bpl & 255, bpl >> 8, h & 255, h >> 8);
      for (let i = y0 * bpl; i < (y0 + h) * bpl; i++) out.push(bm.bits[i]);
    }
    out.push(0x1b, 0x64, avanco); if (corte) out.push(0x1d, 0x56, 0x42, 0x00);
    return Uint8Array.from(out);
  };
  // ^GFA: imagem em hexadecimal (1 = preto), no tamanho exato da etiqueta
  imp.zpl = (bm) => { const total = bm.bytesPorLinha * bm.altura; return new TextEncoder().encode(`^XA^PW${bm.largura}^LL${bm.altura}^LH0,0^FO0,0^GFA,${total},${total},${bm.bytesPorLinha},${hex(bm.bits)}^FS^XZ\n`); };
  imp.codificar = (bm, linguagem) => (linguagem === "zpl" ? imp.zpl(bm) : imp.escpos(bm));

  // Serviços de impressora Bluetooth mais comuns (o navegador só deixa usar o que for listado aqui)
  const SERVICOS_BLE = ["000018f0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb", "0000fff0-0000-1000-8000-00805f9b34fb", "0000ae30-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "38eb4a80-c570-11e3-9507-0002a5d5c51b"];
  imp.direto = {
    suporta: () => !!(navigator.bluetooth || navigator.usb),
    suportaBluetooth: () => !!navigator.bluetooth, suportaUsb: () => !!navigator.usb,
    async bluetooth() {
      const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICOS_BLE });
      const gatt = await dev.gatt.connect(); let alvo = null;
      for (const s of await gatt.getPrimaryServices()) { for (const c of await s.getCharacteristics()) { if (c.properties.writeWithoutResponse || c.properties.write) { if (!alvo || (c.properties.writeWithoutResponse && !alvo.sem)) alvo = { c, sem: !!c.properties.writeWithoutResponse }; } } }
      if (!alvo) { try { dev.gatt.disconnect(); } catch { /* já caiu */ } throw new Error("Essa impressora não mostrou onde receber a etiqueta. Use Imprimir ou o PDF."); }
      return { nome: dev.name || "Impressora Bluetooth", async enviar(dados, progresso) {
        for (let i = 0; i < dados.length; i += 100) { const parte = dados.slice(i, i + 100); if (alvo.sem) await alvo.c.writeValueWithoutResponse(parte); else await alvo.c.writeValue(parte); await new Promise((r) => setTimeout(r, 14)); progresso?.(Math.min(1, (i + 100) / dados.length)); }
      }, fechar() { try { dev.gatt.disconnect(); } catch { /* já caiu */ } } };
    },
    async usb() {
      const dev = await navigator.usb.requestDevice({ filters: [] }); await dev.open(); if (!dev.configuration) await dev.selectConfiguration(1);
      let ifc = null, ep = null;
      for (const cfg of dev.configurations) for (const i of cfg.interfaces) for (const a of i.alternates) { const saida = a.endpoints.find((e) => e.direction === "out"); if (saida && (a.interfaceClass === 7 || ifc === null)) { ifc = i.interfaceNumber; ep = saida.endpointNumber; } }
      if (ifc === null) throw new Error("Essa impressora USB não tem por onde receber. Use Imprimir ou o PDF.");
      await dev.claimInterface(ifc);
      return { nome: dev.productName || "Impressora USB", async enviar(dados, progresso) { for (let i = 0; i < dados.length; i += 4096) { await dev.transferOut(ep, dados.slice(i, i + 4096)); progresso?.(Math.min(1, (i + 4096) / dados.length)); } }, async fechar() { try { await dev.releaseInterface(ifc); await dev.close(); } catch { /* já caiu */ } } };
    },
  };

  // ───────────── a janela de impressão de etiquetas ─────────────
  // opcoes: { titulo, etiqueta, tipo, gerar(valores) → especs, controles: [{ id, rotulo, tipo: "escolha"|"numero", itens, valor, min, max }], nomeArquivo }
  imp.janelaEtiquetas = async (opcoes) => {
    const cfg0 = imp.config(); const est = { formato: cfg0.formato, outroW: cfg0.outroW, outroH: cfg0.outroH, pular: 0, valores: {} };
    const formatosOk = Lay.formatosPara(opcoes.tipo); if (!formatosOk.some((f) => f.id === est.formato) && est.formato !== "outro") est.formato = formatosOk.some((f) => f.id === Lay.FORMATO_PADRAO) ? Lay.FORMATO_PADRAO : formatosOk[0].id;
    (opcoes.controles || []).forEach((c) => { est.valores[c.id] = c.valor; });
    const corpo = el("div", {}); const previa = el("div", { class: "imp-previa", id: "imp-previa" }); const aviso = el("div", { id: "imp-aviso", "aria-live": "polite" }); const info = el("p", { class: "suave", id: "imp-info" });
    let paginas = [], lays = [], vida = 0;

    const desenharControles = () => {
      const f = imp.formatoDe({ formato: est.formato, outroW: est.outroW, outroH: est.outroH });
      const blocos = [];
      for (const c of (opcoes.controles || []).filter((x) => !x.quando || x.quando(est.valores))) {
        blocos.push(el("div", { class: "rotulo", style: "margin-top:12px" }, c.rotulo));
        if (c.tipo === "numero") blocos.push(NE.contador(est.valores[c.id], (v) => { est.valores[c.id] = Math.max(c.min || 1, Math.min(c.max || 99, v)); recalcular(); }, `imp-${c.id}`, { max: c.max }));
        else blocos.push(NE.escolhaUnica(c.itens, est.valores[c.id], (v) => { est.valores[c.id] = v; desenharControles(); recalcular(); }));
      }
      const chips = el("div", { class: "chips rolagem", role: "radiogroup", "aria-label": "Tamanho da etiqueta" }, [...formatosOk, { id: "outro", rotulo: "Outro tamanho" }].map((x) =>
        el("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(est.formato === x.id), "aria-pressed": String(est.formato === x.id), "data-formato": x.id, onclick: () => { est.formato = x.id; imp.guardar({ formato: x.id }); desenharControles(); recalcular(); } }, x.rotulo)));
      const medidas = est.formato === "outro" ? el("div", { class: "form-linha", style: "margin-top:8px" },
        el("div", { class: "campo" }, el("label", { for: "imp-w" }, "Largura (mm)"), el("input", { class: "entrada", id: "imp-w", type: "number", inputmode: "decimal", min: "20", max: "300", value: est.outroW, onchange: (e) => { est.outroW = Number(e.target.value) || 100; imp.guardar({ outroW: est.outroW }); recalcular(); } })),
        el("div", { class: "campo" }, el("label", { for: "imp-h" }, "Altura (mm)"), el("input", { class: "entrada", id: "imp-h", type: "number", inputmode: "decimal", min: "15", max: "400", value: est.outroH, onchange: (e) => { est.outroH = Number(e.target.value) || 60; imp.guardar({ outroH: est.outroH }); recalcular(); } }))) : null;
      const dicaFmt = (formatosOk.find((x) => x.id === est.formato) || {}).dica;
      const pular = f.tipo === "folha" ? el("div", { style: "margin-top:10px" }, el("div", { class: "rotulo" }, "Começar na etiqueta nº (para reaproveitar uma folha já usada)"), NE.contador(est.pular + 1, (v) => { est.pular = Math.max(0, Math.min(Lay.porPagina(f) - 1, v - 1)); recalcular(); }, "imp-pular", { max: Lay.porPagina(f) })) : null;
      corpo.replaceChildren(...blocos, el("div", { class: "rotulo", style: "margin-top:14px" }, "Tamanho do papel"), chips, medidas, dicaFmt ? el("p", { class: "suave", style: "margin:6px 0 0" }, dicaFmt) : null, pular,
        el("div", { class: "rotulo", style: "margin-top:16px" }, "Prévia (tamanho real na impressão)"), previa, info, aviso);
    };

    const recalcular = async () => {
      const meu = ++vida; const f = imp.formatoDe({ formato: est.formato, outroW: est.outroW, outroH: est.outroH });
      let especs = []; try { especs = opcoes.gerar(est.valores, f); } catch (e) { aviso.replaceChildren(el("div", { class: "aviso erro" }, ic("alerta"), el("span", {}, NE.mensagemErro(e)))); return; }
      if (especs.length > Dados().MAX_ETIQUETAS) { paginas = []; lays = []; previa.replaceChildren(); aviso.replaceChildren(el("div", { class: "aviso erro" }, ic("alerta"), el("span", {}, `São ${especs.length} etiquetas: é demais de uma vez (o limite é ${Dados().MAX_ETIQUETAS}). Escolha "uma por produto" ou menos cópias.`))); info.textContent = ""; atualizarBotoes(); return; }
      lays = await imp.montar(especs, f); if (meu !== vida) return;
      paginas = Lay.paginar(lays, f, est.pular);
      previa.replaceChildren(...lays.slice(0, 4).map((l) => el("div", { class: "imp-previa-item", style: `max-width:${Math.min(420, l.w * 3.8)}px`, html: imp.svg(l, { mm: false, rotulo: `Etiqueta ${l.itens.find((i) => i.k === "t")?.t || ""}` }) })),
        lays.length > 4 ? el("p", { class: "suave" }, `+ ${lays.length - 4} etiquetas iguais a estas, com os dados de cada uma`) : "");
      const leg = lays.length ? imp.legibilidade(lays[0], cfg().dpi) : null;
      info.textContent = `${lays.length === 1 ? "1 etiqueta" : `${lays.length} etiquetas`} · ${paginas.length === 1 ? "1 página" : `${paginas.length} páginas`}${f.tipo === "folha" ? ` de ${Lay.porPagina(f)} por folha` : ` de ${f.w} × ${f.h} mm`}`;
      aviso.replaceChildren(...(leg && !leg.semQr ? [el("div", { class: `aviso ${leg.ok ? "ok" : "alerta"}`, id: "imp-legivel" }, ic(leg.ok ? "check" : "alerta"), el("span", {}, leg.ok ? `QR legível: cada ponto do QR tem ${leg.moduloMm.toFixed(2).replace(".", ",")} mm (${leg.pontos.toFixed(1).replace(".", ",")} pontos de impressora a ${leg.dpi} dpi).` : `QR pequeno demais neste tamanho: cada ponto tem ${leg.moduloMm.toFixed(2).replace(".", ",")} mm (${leg.pontos.toFixed(1).replace(".", ",")} pontos a ${leg.dpi} dpi). Escolha um papel maior, ou use impressora de 300 dpi.`))] : []));
      atualizarBotoes();
    };
    const cfg = () => imp.config(); const Dados = () => window.NEEtiquetaDados;

    // botões
    const bImprimir = el("button", { type: "button", class: "btn btn-principal", id: "imp-imprimir" }, ic("etiqueta"), "Imprimir");
    const bPdf = el("button", { type: "button", class: "btn btn-azul", id: "imp-pdf" }, ic("baixar"), "Salvar ou enviar PDF");
    const bPng = el("button", { type: "button", class: "link-acao", id: "imp-png" }, ic("galeria"), "Enviar como imagem");
    const atualizarBotoes = () => { const sem = !paginas.length; bImprimir.disabled = bPdf.disabled = bPng.disabled = sem; };
    const nomeArq = (ext) => `${opcoes.nomeArquivo || "etiquetas"}-${NE.hojeISO()}.${ext}`;
    bImprimir.addEventListener("click", () => imp.imprimirEtiquetas(paginas));
    bPdf.addEventListener("click", () => NE.comCarregando(bPdf, async () => { const blob = await imp.pdf(paginas, 300, opcoes.titulo); const r = await imp.compartilhar([blob], [nomeArq("pdf")], opcoes.titulo); if (r === "baixado") NE.aviso("PDF salvo no aparelho. Abra no aplicativo da sua impressora.", "ok"); }));
    bPng.addEventListener("click", () => NE.comCarregando(bPng, async () => {
      if (paginas.length > 12) return NE.aviso("São muitas páginas para mandar como imagem. Use o PDF.", "alerta");
      const bms = paginas.map((p) => imp.bitmap(p, 300)); const blobs = await Promise.all(bms.map(imp.png));
      await imp.compartilhar(blobs, blobs.map((_, i) => `${opcoes.nomeArquivo || "etiqueta"}-${i + 1}.png`), opcoes.titulo);
    }));

    // impressora direta (beta)
    const direto = imp.direto.suporta() ? diretoPainel() : el("p", { class: "suave", id: "imp-sem-direto" }, "Ligar a térmica direto (Bluetooth ou USB) só existe no Chrome ou no Edge, no Android ou no computador. O botão Imprimir funciona em qualquer aparelho.");
    function diretoPainel() {
      const sel = (id, rot, opts, atual, aoMudar) => el("div", { class: "campo" }, el("label", { for: id }, rot), el("select", { class: "entrada", id, onchange: (e) => aoMudar(e.target.value) }, opts.map(([v, t]) => el("option", { value: v, ...(String(v) === String(atual) ? { selected: "" } : {}) }, t))));
      const estado = el("p", { class: "suave", id: "imp-direto-estado", "aria-live": "polite" }, "Escolha a impressora quando o aparelho pedir.");
      const c = cfg(); let conexao = null;
      const enviar = async (tipo) => {
        const f = imp.formatoDe({ formato: est.formato, outroW: est.outroW, outroH: est.outroH }); const cc = cfg();
        if (!paginas.length) return;
        if (cc.linguagem === "escpos" && cc.cabeca && f.tipo === "rolo" && f.w > cc.cabeca - 6) return NE.aviso(`O papel escolhido tem ${f.w} mm, e a impressora de ${cc.cabeca} mm só imprime ${cc.cabeca - 6} mm. Troque o tamanho da etiqueta ou a largura do papel.`, "alerta");
        if (f.tipo === "folha") return NE.aviso("Impressão direta é para etiqueta de rolo. Para folha A4 use o botão Imprimir.", "alerta");
        estado.textContent = "Conectando…"; if (!conexao) conexao = await imp.direto[tipo]();
        for (let i = 0; i < paginas.length; i++) { estado.textContent = `${conexao.nome}: enviando ${i + 1} de ${paginas.length}…`; await conexao.enviar(imp.codificar(imp.bitmap(paginas[i], cc.dpi), cc.linguagem)); }
        estado.textContent = `${conexao.nome}: ${paginas.length === 1 ? "etiqueta enviada" : `${paginas.length} etiquetas enviadas`}.`;
      };
      const botao = (tipo, rot, ok) => ok && el("button", { type: "button", class: "btn btn-secundario", id: `imp-${tipo}`, onclick: (ev) => NE.comCarregando(ev.currentTarget, async () => { try { await enviar(tipo); } catch (e) { conexao = null; estado.textContent = ""; NE.aviso(e && e.name === "NotFoundError" ? "Nenhuma impressora foi escolhida." : NE.mensagemErro(e), "alerta"); } }) }, rot);
      return el("details", { class: "imp-direto", id: "imp-direto" }, el("summary", {}, "Impressora térmica direta (beta)"),
        el("p", { class: "suave", style: "margin:8px 0" }, "Para térmica que o aparelho não reconhece. Não substitui o botão Imprimir, que serve para qualquer impressora."),
        sel("imp-ling", "A impressora fala", [["escpos", "ESC/POS (a maioria das térmicas de cupom e Bluetooth)"], ["zpl", "ZPL (Zebra e compatíveis)"]], c.linguagem, (v) => imp.guardar({ linguagem: v })),
        sel("imp-dpi", "Resolução", [[203, "203 dpi (padrão)"], [300, "300 dpi"], [600, "600 dpi"]], c.dpi, (v) => { imp.guardar({ dpi: Number(v) }); recalcular(); }),
        sel("imp-cabeca", "Largura do papel da impressora (ESC/POS)", [[0, "Não limitar (térmica de etiqueta)"], [58, "58 mm"], [80, "80 mm"], [112, "112 mm"]], c.cabeca, (v) => imp.guardar({ cabeca: Number(v) })),
        el("div", { class: "acoes-linha" }, botao("bluetooth", "Bluetooth: conectar e imprimir", imp.direto.suportaBluetooth()), botao("usb", "USB: conectar e imprimir", imp.direto.suportaUsb())), estado);
    }

    const sessao = NE.janelaSimples({ etiqueta: opcoes.etiqueta || "Etiquetas", titulo: opcoes.titulo || "Imprimir etiquetas",
      corpo: el("div", {}, corpo, el("div", { class: "imp-como" }, ic("ajuda"), el("span", {}, "Imprimir abre a impressão do aparelho e serve para qualquer impressora que ele já enxerga (comum, térmica com driver, Wi-Fi, USB, Bluetooth, AirPrint). Na térmica, escolha o mesmo tamanho de papel.")),
        el("div", { class: "imp-mais" }, bPdf, bPng), direto),
      rodape: [bImprimir] });
    // ao fechar a janela, tira da página o que foi montado para imprimir
    new MutationObserver((_, o) => { if (!document.body.contains(sessao.fundo)) { quitarArea(); o.disconnect(); } }).observe(document.body, { childList: true });
    desenharControles(); atualizarBotoes(); recalcular();
    return sessao;
  };

  // Cartões de acesso (equipe): mesma janela, mesmo motor
  imp.cartoesDeAcesso = (pessoas, { link, funcaoRotulo }) => imp.janelaEtiquetas({ titulo: "Imprimir cartões de acesso", etiqueta: "Equipe", tipo: "acesso", nomeArquivo: "cartoes-de-acesso",
    gerar: () => pessoas.flatMap((p) => window.NEEtiquetaDados.deAcesso(p, { link: link(p), funcaoRotulo: funcaoRotulo(p) })) });

  // Teste: confere escala, margem e se o QR sai legível na impressora de verdade
  imp.teste = () => imp.janelaEtiquetas({ titulo: "Teste de impressão", etiqueta: "Impressora", tipo: "teste", nomeArquivo: "teste-impressao",
    gerar: (_, formato) => [window.NEEtiquetaDados.teste(formato)] });
})();
