// SEÇÃO "IMPRIMIR" (Mais → Imprimir): etiquetas de nota, etiquetas de produto, relatórios, leitor de QR e ajustes da impressora.
// Tudo passa pelo mesmo motor (impressao.js), que funciona com qualquer impressora que o aparelho enxergue.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const normal = (t) => D.normalizar(t);

  // ───────────── etiquetas de uma nota ─────────────
  async function escolherNota(app) {
    const caixa = el("div", { id: "imp-lista-notas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const busca = el("input", { class: "entrada busca", id: "imp-busca-nota", type: "search", inputmode: "search", autocomplete: "off", placeholder: "Número da nota ou cliente" });
    let notas = [];
    // nota já conferida: a etiqueta leva o que FOI carregado e a placa (vem da conferência)
    const abrir = async (n) => {
      let c = { ...n, tipo: "nota" };
      if (n.status === "conferida" && n.conferencia_id) { try { const l = await NE.dados.conferencias({ de: Date.now() - 62 * D.DIA }); const conf = l.find((x) => x.id === n.conferencia_id); if (conf) c = { ...conf, vendedor: n.vendedor }; } catch { /* usa a nota mesmo */ } }
      j.fechar(); NE.abrirEtiquetas(c);
    };
    const desenhar = () => {
      const q = normal(busca.value); const vis = notas.filter((n) => !q || normal(`${n.numero} ${n.cliente || ""}`).includes(q)).slice(0, 40);
      caixa.replaceChildren(...(vis.length ? vis.map((n) => { const b = el("button", { type: "button", class: "linha-cartao" }, el("strong", {}, `Nota ${n.numero}${n.cliente ? ` · ${n.cliente}` : ""}`), el("span", { class: "meta" }, `${D.plural((n.itens || []).length, "item", "itens")} · ${n.status === "conferida" ? "conferida" : n.status === "cancelada" ? "cancelada" : "na fila"} · ${D.tempoRelativo(n.criado_em, Date.now())}`)); b.addEventListener("click", () => abrir(n)); return b; })
        : [el("div", { class: "vazio-grande" }, el("strong", {}, "Nenhuma nota"), "Confira o número ou o nome do cliente.")]));
    };
    const ler = NE.botaoLerQR({ titulo: "Ler a etiqueta da nota", aceita: ["peca", "nota"], digitar: "Número da nota", aoLer: (obj) => { const n = NE.lerQR.acharNota(obj, notas); if (!n) { NE.aviso("Não achei essa nota. Confira se é do mesmo sistema.", "alerta"); return false; } abrir(n); } }, { rotulo: "Ler QR da etiqueta", id: "imp-ler-nota" });
    const j = NE.janelaSimples({ etiqueta: "Etiquetas", titulo: "De qual nota?", corpo: el("div", {}, el("div", { class: "busca-linha" }, busca), el("div", { style: "margin:8px 0 12px" }, ler), caixa) });
    busca.addEventListener("input", desenhar);
    try { notas = (await NE.dados.notas()).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)); desenhar(); } catch (e) { caixa.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", caixa); }
  }

  // ───────────── etiquetas de produtos ─────────────
  async function escolherProdutos() {
    const caixa = el("div", { id: "imp-lista-produtos" }, el("div", { class: "esqueleto" }));
    const busca = el("input", { class: "entrada busca", id: "imp-busca-produto", type: "search", autocomplete: "off", placeholder: "Buscar produto" });
    let produtos = []; const marcados = new Set();
    const continuar = el("button", { type: "button", class: "btn btn-principal", id: "imp-produtos-seguir", disabled: true }, ic("etiqueta"), "Continuar");
    const todos = el("button", { type: "button", class: "link-acao", id: "imp-produtos-todos" }, "Marcar todos");
    const atualizar = () => { continuar.disabled = !marcados.size; continuar.lastChild.textContent = marcados.size ? `Continuar com ${marcados.size}` : "Continuar"; };
    const desenhar = () => {
      const q = normal(busca.value); const vis = produtos.filter((p) => !q || normal(p.nome).includes(q));
      caixa.replaceChildren(...(vis.length ? vis.map((p) => el("button", { type: "button", class: "escolha", "aria-pressed": String(marcados.has(p.id)), "data-produto": p.id, onclick: () => { marcados.has(p.id) ? marcados.delete(p.id) : marcados.add(p.id); desenhar(); atualizar(); } }, el("strong", {}, p.nome), el("span", {}, p.por_pilha ? `pilha de ${D.fmt(p.por_pilha)}` : p.unidade || "un")))
        : [el("div", { class: "vazio-grande" }, el("strong", {}, produtos.length ? "Nada com esse nome" : "Nenhum produto"), produtos.length ? "Tente outro nome." : "Cadastre os produtos primeiro.")]));
    };
    const ler = NE.botaoLerQR({ titulo: "Ler a etiqueta do produto", aceita: ["produto"], digitar: "Código do produto (P-1A2B3C4D)", continuo: true, aoLer: (obj) => { const p = NE.lerQR.acharProduto(obj, produtos); if (!p) { NE.aviso("Não achei esse produto.", "alerta"); return false; } marcados.add(p.id); desenhar(); atualizar(); NE.aviso(`${p.nome} marcado.`, "ok"); } }, { rotulo: "Marcar lendo o QR", id: "imp-ler-produto", classe: "btn btn-secundario" });
    const j = NE.janelaSimples({ etiqueta: "Etiquetas", titulo: "De quais produtos?", corpo: el("div", {}, el("div", { class: "busca-linha" }, busca), el("div", { style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0 12px" }, ler, todos), caixa), rodape: [continuar] });
    busca.addEventListener("input", desenhar);
    todos.addEventListener("click", () => { const q = normal(busca.value); const vis = produtos.filter((p) => !q || normal(p.nome).includes(q)); const tudo = vis.every((p) => marcados.has(p.id)); vis.forEach((p) => (tudo ? marcados.delete(p.id) : marcados.add(p.id))); desenhar(); atualizar(); });
    continuar.addEventListener("click", () => { const sel = produtos.filter((p) => marcados.has(p.id)); j.fechar(); NE.etiquetasDeProduto(sel); });
    try { produtos = (await NE.dados.produtos(true)).filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)); desenhar(); atualizar(); } catch (e) { caixa.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", caixa); }
  }

  // ───────────── relatórios ─────────────
  async function escolherRelatorio() {
    const catalogo = NE.relatorios.catalogo(); const est = { id: catalogo[0].id, dias: null, produto: "" }; let produtos = [];
    const corpo = el("div", {}); const abrir = el("button", { type: "button", class: "btn btn-principal", id: "imp-rel-abrir" }, ic("lista"), "Ver e imprimir");
    const desenhar = () => {
      const c = catalogo.find((x) => x.id === est.id); if (c.periodo && !c.periodo.includes(est.dias)) est.dias = c.periodo.includes(7) ? 7 : c.periodo[0];
      corpo.replaceChildren(
        NE.escolhaUnica(catalogo.map((x) => ({ valor: x.id, rotulo: x.rotulo, dica: x.dica })), est.id, (v) => { est.id = v; desenhar(); }),
        c.periodo ? el("div", { style: "margin-top:14px" }, el("div", { class: "rotulo" }, "Período"), el("div", { class: "chips", id: "imp-rel-periodo" }, c.periodo.map((d) => el("button", { type: "button", class: "chip", "aria-pressed": String(est.dias === d), onclick: () => { est.dias = d; desenhar(); } }, d === 1 ? "Hoje e ontem" : `${d} dias`)))) : null,
        c.produto ? el("div", { class: "campo", style: "margin-top:12px" }, el("label", { for: "imp-rel-produto" }, "Produto (opcional)"), el("select", { class: "entrada", id: "imp-rel-produto", onchange: (e) => { est.produto = e.target.value; } }, el("option", { value: "" }, "Todos os produtos"), produtos.map((p) => el("option", { value: p.id, ...(p.id === est.produto ? { selected: "" } : {}) }, p.nome)))) : null);
    };
    abrir.addEventListener("click", () => NE.comCarregando(abrir, async () => { const c = catalogo.find((x) => x.id === est.id); const b = await NE.relatorios[est.id]({ dias: est.dias || undefined, produtoId: c.produto ? est.produto || undefined : undefined }); j.fechar(); NE.abrirRelatorio(b); }));
    const j = NE.janelaSimples({ etiqueta: "Relatórios", titulo: "O que imprimir?", corpo, rodape: [abrir] });
    try { produtos = (await NE.dados.produtos(true)).filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)); } catch { /* sem a lista de produtos o filtro some */ }
    desenhar();
  }

  // ───────────── ler qualquer QR ─────────────
  // Lê o que a etiqueta mostra e leva para o lugar certo: nota → detalhe da nota; produto → estoque do produto
  function lerQualquer(app) {
    NE.lerQR({ titulo: "Ler QR code", aceita: ["peca", "nota", "produto"], digitar: "Número da nota ou código do produto", aoLer: async (obj) => {
      if (obj.tipo === "produto" || obj.tipo === "codigo") { const p = NE.lerQR.acharProduto(obj, await NE.dados.produtos(true)); if (!p) { NE.aviso("Não achei esse produto.", "alerta"); return false; } NE.abrirProduto ? NE.abrirProduto(p.id) : app.ir("estoque", {}); return; }
      const n = NE.lerQR.acharNota(obj, await NE.dados.notas()); if (!n) { NE.aviso("Não achei essa nota.", "alerta"); return false; }
      app.ir("notas", { abrir: n.id });
    } });
  }

  // ───────────── impressora ─────────────
  function impressora() {
    const f = NE.imp.formatoDe();
    const passos = [["Imprimir", "abre a impressão do aparelho. Funciona com qualquer impressora que o celular ou o computador já enxerga: comum, térmica com driver, Wi-Fi, USB, Bluetooth, AirPrint."],
      ["Salvar ou enviar PDF", "gera o arquivo no tamanho exato do papel. Abra no aplicativo da sua impressora (Zebra, Elgin, Brother, HP, Epson…) ou mande para outro aparelho."],
      ["Impressora direta (beta)", "Bluetooth ou USB, para térmica sem driver. Só no Chrome ou no Edge."]];
    const teste = el("button", { type: "button", class: "btn btn-principal", id: "imp-teste", onclick: () => { j.fechar(); NE.imp.teste(); } }, ic("etiqueta"), "Imprimir página de teste");
    const j = NE.janelaSimples({ etiqueta: "Impressora", titulo: "Como imprimir", corpo: el("div", {},
      el("ol", { class: "imp-legenda" }, passos.map(([t, d]) => el("li", {}, el("span", {}, el("b", {}, `${t}: `), d)))),
      el("div", { class: "imp-como" }, ic("ajuda"), el("span", {}, `Antes de imprimir um rolo, faça a página de teste: a régua deve medir 10 mm entre os traços, a borda não pode ser cortada e o QR deve sair nítido. Papel escolhido agora: ${f.rotulo}.`))), rodape: [teste] });
  }

  NE.rotas.imprimir = (raiz, params, app) => {
    const P = NE.pacote; const item = (icone, titulo, sub, acao, id) => el("button", { type: "button", class: "cartao-guia", id, onclick: acao }, ic(icone), el("span", {}, titulo, el("small", { style: "display:block" }, sub)));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Imprimir"), el("p", {}, "Etiquetas, relatórios e QR code. Funciona com qualquer impressora."))),
      el("div", { class: "menu-grade" },
        P.tem("etiquetas") && item("nota", "Etiquetas de uma nota", "Uma por produto ou por peça", () => escolherNota(app), "imp-nota"),
        P.tem("etiquetas") && item("caixas", "Etiquetas de produtos", "Para pilha e prateleira", () => escolherProdutos(), "imp-produtos"),
        P.tem("planilhas") && item("lista", "Relatórios", "Movimentação, estoque, notas, cargas", () => escolherRelatorio(), "imp-relatorios"),
        P.tem("etiquetas") && item("qr", "Ler um QR code", "A câmera abre a nota ou o produto", () => lerQualquer(app), "imp-ler"),
        item("engrenagem", "Impressora", "Teste de impressão e como ligar", () => impressora(), "imp-impressora"),
        P.tem("etiquetas") && item("ajuda", "Como ler uma etiqueta", "Para quem vê pela primeira vez", () => NE.legendaEtiqueta(), "imp-legenda"),
        item("olho", "Abrir um arquivo", "PDF, imagem, XML, CSV, Excel ou texto: o app abre", () => NE.abrirArquivoDoAparelho(), "imp-abrir-pdf")));
  };
  NE.lerQualquerQR = lerQualquer;
})();
