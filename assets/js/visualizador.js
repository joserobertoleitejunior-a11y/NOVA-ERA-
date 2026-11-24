// VISUALIZADOR DE PDF DO APP: abre um PDF (o da planilha ou um arquivo que a pessoa já baixou) sem sair do app.
// Rola, aproxima e afasta, ajusta à largura, baixa, compartilha e imprime. Usa o pdf.js que já vem no app.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;
  const MIN = 0.6, MAX = 3.2;

  NE.verPdf = async (fonte, { titulo = "Documento", nome = "documento.pdf" } = {}) => {
    if (document.querySelector(".pdf-vista")) document.querySelector(".pdf-vista").remove();
    const bruto = fonte instanceof Blob ? new Uint8Array(await fonte.arrayBuffer()) : fonte;
    const area = el("div", { class: "pdf-area", tabindex: "0" }, el("p", { class: "pdf-aviso" }, "Abrindo o PDF…"));
    const rotuloZoom = el("span", { class: "pdf-zoom" }, "100%");
    const info = el("span", { class: "pdf-info" }, "");
    const btn = (id, icone, rotulo, fn, extra = "") => el("button", { type: "button", class: `pdf-btn ${extra}`, id, "aria-label": rotulo, title: rotulo, onclick: fn }, ic(icone), el("span", {}, rotulo));
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const fundo = el("div", { class: "pdf-vista", role: "dialog", "aria-modal": "true", "aria-label": `PDF: ${titulo}` },
      el("div", { class: "pdf-topo" }, el("div", { class: "pdf-titulo" }, el("strong", {}, titulo), info), fechar),
      area,
      el("div", { class: "pdf-ferramentas" },
        el("button", { type: "button", class: "pdf-lupa", id: "pdf-menos", "aria-label": "Afastar", onclick: () => zoom(zoomAtual / 1.25), html: NE.icone.menos }), rotuloZoom,
        el("button", { type: "button", class: "pdf-lupa", id: "pdf-mais", "aria-label": "Aproximar", onclick: () => zoom(zoomAtual * 1.25), html: NE.icone.mais }),
        el("button", { type: "button", class: "pdf-btn", id: "pdf-ajustar", onclick: () => zoom(1) }, "Ajustar"),
        btn("pdf-baixar", "baixar", "Baixar", () => NE.imp.baixar(new Blob([bruto], { type: "application/pdf" }), nome)),
        btn("pdf-compartilhar", "enviar", "Compartilhar", async () => { const r = await NE.imp.compartilhar([new Blob([bruto], { type: "application/pdf" })], [nome], titulo); if (r === "baixado") NE.aviso("Este aparelho não compartilha arquivos: o PDF foi baixado.", "ok"); }),
        btn("pdf-imprimir", "impressora", "Imprimir", () => imprimir())));
    document.body.append(fundo);
    const sair = () => { fundo.remove(); document.removeEventListener("keydown", tecla); try { pdf && pdf.destroy(); } catch { /* já fechado */ } };
    const tecla = (e) => { if (e.key === "Escape" && !document.querySelector(".janela-fundo[data-simples]")) sair(); };
    fechar.addEventListener("click", sair); document.addEventListener("keydown", tecla); area.focus({ preventScroll: true });

    let pdf = null; let zoomAtual = 1; const paginas = [];
    const larguraBase = () => Math.max(220, Math.min(area.clientWidth - 24, 900));
    const desenhar = async (p) => {   // desenha uma página só quando ela aparece na tela
      if (p.feito === zoomAtual) return; p.feito = zoomAtual; const pg = await pdf.getPage(p.n); const v0 = pg.getViewport({ scale: 1 }); const largura = larguraBase() * zoomAtual; const dpr = Math.min(2, window.devicePixelRatio || 1);
      const v = pg.getViewport({ scale: (largura / v0.width) * dpr }); const cv = el("canvas", { class: "pdf-folha", width: Math.round(v.width), height: Math.round(v.height), role: "img", "aria-label": `Página ${p.n}` }); cv.style.width = `${Math.round(largura)}px`; cv.style.height = `${Math.round((v0.height * largura) / v0.width)}px`;
      await pg.render({ canvasContext: cv.getContext("2d"), viewport: v }).promise; if (p.feito === zoomAtual) p.caixa.replaceChildren(cv);
    };
    const observador = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) desenhar(e.target.__p).catch(() => {}); }), { root: area, rootMargin: "600px 0px" });
    const medidas = async () => { for (const p of paginas) { const pg = await pdf.getPage(p.n); const v0 = pg.getViewport({ scale: 1 }); const largura = larguraBase() * zoomAtual; p.caixa.style.width = `${Math.round(largura)}px`; p.caixa.style.height = `${Math.round((v0.height * largura) / v0.width)}px`; p.feito = null; } };
    const zoom = async (z) => { zoomAtual = Math.max(MIN, Math.min(MAX, z)); rotuloZoom.textContent = `${Math.round(zoomAtual * 100)}%`; await medidas(); paginas.forEach((p) => { const r = p.caixa.getBoundingClientRect(), a = area.getBoundingClientRect(); if (r.bottom > a.top - 600 && r.top < a.bottom + 600) desenhar(p).catch(() => {}); }); };
    const imprimir = () => {
      const url = URL.createObjectURL(new Blob([bruto], { type: "application/pdf" })); const f = el("iframe", { style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0", src: url });
      f.addEventListener("load", () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { NE.aviso("Este aparelho não abriu a impressão. Use Compartilhar e imprima por lá.", "alerta"); } setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 60000); }); document.body.append(f);
    };
    // pinça e Ctrl+rolagem também aproximam
    area.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); zoom(zoomAtual * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
    let d0 = 0, z0 = 1; area.addEventListener("touchstart", (e) => { if (e.touches.length === 2) { d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); z0 = zoomAtual; } }, { passive: true });
    area.addEventListener("touchmove", (e) => { if (e.touches.length === 2 && d0) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); clearTimeout(area.__t); area.__t = setTimeout(() => zoom(z0 * (d / d0)), 60); } }, { passive: false });
    try {
      await NE.carregarScript("assets/vendor/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdf.worker.min.js";
      pdf = await window.pdfjsLib.getDocument({ data: bruto.slice() }).promise; info.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? "página" : "páginas"}`;
      area.replaceChildren(); for (let n = 1; n <= pdf.numPages; n++) { const caixa = el("div", { class: "pdf-pg" }); const p = { n, caixa, feito: null }; caixa.__p = p; paginas.push(p); area.append(caixa); observador.observe(caixa); }
      await zoom(1);
    } catch (e) { console.error(e); area.replaceChildren(el("p", { class: "pdf-aviso" }, "Não consegui abrir este PDF. Ele pode estar danificado ou protegido por senha.")); }
    return { fechar: sair };
  };

  // Abrir um PDF que já está no aparelho (ex.: a planilha que a pessoa baixou antes)
  NE.abrirPdfDoAparelho = () => {
    const entrada = el("input", { type: "file", accept: "application/pdf,.pdf", hidden: true, id: "pdf-arquivo" });
    entrada.addEventListener("change", async () => { const a = entrada.files[0]; entrada.remove(); if (!a) return; if (!/pdf/i.test(a.type) && !/\.pdf$/i.test(a.name)) { NE.aviso("Esse arquivo não é um PDF.", "alerta"); return; } await NE.verPdf(a, { titulo: a.name.replace(/\.pdf$/i, ""), nome: a.name }); });
    document.body.append(entrada); entrada.click();
  };
})();
