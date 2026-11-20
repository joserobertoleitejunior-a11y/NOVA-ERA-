// Etiquetas para imprimir e colar no carregamento. Cada etiqueta tem nota, produto, quantidade
// (ou "peça X de Y"), caminhão, data e um QR Code que abre o rastreio da entrega.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;
  const QR = "assets/vendor/qrcode.js";
  const FORMATOS = {
    termica: { rotulo: "Térmica 100 × 50 mm", dica: "Impressora de etiqueta (Zebra, Elgin, Argox)", pagina: "100mm 50mm", classe: "fmt-termica" },
    a4: { rotulo: "Folha A4 · 10 por folha", dica: "Impressora comum, folha de etiquetas 99 × 57 mm", pagina: "A4", classe: "fmt-a4" },
  };

  const plural = (n, um, varios) => `${NE.num(n)} ${n === 1 ? um : varios}`;

  NE.abrirEtiquetas = async (c) => {
    let formato = "termica", modo = "item";
    const previa = el("div", { class: "etiquetas-previa" });
    const area = el("div", { id: "area-impressao" });
    let svgQr = "";
    try {
      await NE.carregarScript(QR);
      svgQr = true;
    } catch { /* sem o leitor de QR local: imprime sem ele */ }
    // QR de cada peça: abre o rastreio da nota e diz qual peça é (o leitor do app usa isso para contar na conferência)
    const base = NE.urlRastreio(c.token_publico || c.id);
    const qrDe = (p) => { const q = window.qrcode(0, "M"); q.addData(p ? `${base}&p=${p}` : base); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); };
    const qtdDe = (i) => Number(i.qtd_carregada ?? i.quantidade ?? i.qtd_nota);
    const numeroNota = c.numero_nota || c.numero;
    const rodape = c.placa ? `${c.placa} · ${new Date(c.criado_em).toLocaleDateString("pt-BR")}` : `${c.cliente || "Nova Era"} · ${new Date(c.criado_em).toLocaleDateString("pt-BR")}`;

    const lista = () => {
      const itens = c.itens || [];
      if (modo === "item") return itens.map((i) => ({ produto: i.descricao, linha: `Quantidade: ${NE.num(qtdDe(i))}`, p: "" }));
      const pecas = [];
      itens.forEach((i, idx) => { const n = qtdDe(i); for (let k = 1; k <= n; k++) pecas.push({ produto: i.descricao, linha: `Peça ${k} de ${n}`, p: `${idx}-${k}` }); });
      return pecas;
    };
    const etiqueta = (e) => el("div", { class: "etiqueta-impressa" },
      el("div", { class: "et-texto" },
        el("div", { class: "et-marca", html: NE.logo }),
        el("div", { class: "et-nota" }, `NF ${numeroNota}`),
        el("div", { class: "et-produto" }, e.produto),
        el("div", { class: "et-linha" }, e.linha),
        el("div", { class: "et-rodape" }, rodape)),
      svgQr && el("div", { class: "et-qr" }, el("div", { html: qrDe(e.p) }), el("span", {}, "Rastreio")));

    const opcoes = el("div", {});
    const desenhar = () => {
      const ets = lista();
      opcoes.replaceChildren(
        el("div", { class: "rotulo" }, "Tamanho da etiqueta"),
        NE.escolhaUnica(Object.entries(FORMATOS).map(([valor, f]) => ({ valor, rotulo: f.rotulo, dica: f.dica })), formato, (v) => { formato = v; desenhar(); }),
        el("div", { class: "rotulo", style: "margin-top:14px" }, "Quantas etiquetas"),
        NE.escolhaUnica([
          { valor: "item", rotulo: "Uma por produto", dica: plural((c.itens || []).length, "etiqueta com a quantidade", "etiquetas com a quantidade") },
          { valor: "peca", rotulo: "Uma por peça", dica: plural((c.itens || []).reduce((n, i) => n + qtdDe(i), 0), "etiqueta numerada", "etiquetas numeradas") },
        ], modo, (v) => { modo = v; desenhar(); }));
      previa.className = `etiquetas-previa ${FORMATOS[formato].classe}`;
      previa.replaceChildren(...ets.slice(0, 6).map(etiqueta), ets.length > 6 ? el("p", { class: "suave" }, `+ ${ets.length - 6} etiquetas`) : "");
      area.className = FORMATOS[formato].classe;
      area.replaceChildren(...ets.map(etiqueta));
      contagem.textContent = `Imprimir ${ets.length} etiqueta${ets.length === 1 ? "" : "s"}`;
    };
    const contagem = el("span", {});
    const imprimir = el("button", { type: "button", class: "btn btn-principal", onclick: () => {
      const estilo = el("style", { id: "estilo-pagina" }, `@page { size: ${FORMATOS[formato].pagina}; margin: ${formato === "a4" ? "10mm 6mm" : "0"}; }`);
      document.getElementById("estilo-pagina")?.remove();
      document.head.append(estilo);
      document.body.append(area);
      document.body.classList.add("imprimindo");
      window.print();
      setTimeout(() => { document.body.classList.remove("imprimindo"); area.remove(); }, 500);
    } }, ic("etiqueta"), contagem);
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const tela = el("div", { class: "janela-fundo" },
      el("div", { class: "janela", role: "dialog", "aria-modal": "true", "aria-labelledby": "titulo-etiquetas" },
        el("div", { class: "janela-topo" }, el("div", {}, el("span", { class: "etiqueta" }, `Nota ${numeroNota}`), el("h2", { id: "titulo-etiquetas" }, "Etiquetas")), fechar),
        el("div", { class: "janela-corpo" }, opcoes, el("div", { class: "rotulo", style: "margin-top:18px" }, "Prévia"), previa),
        el("div", { class: "janela-rodape" }, el("button", { type: "button", class: "btn btn-secundario", onclick: () => tela.remove() }, "Voltar"), imprimir)));
    fechar.addEventListener("click", () => tela.remove());
    document.body.append(tela);
    desenhar();
  };
})();
