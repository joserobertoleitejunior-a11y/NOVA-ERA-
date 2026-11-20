// Notas: fila de conferência, nota nova (digitada, por foto ou por XML) e detalhe da nota.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const VENDEDORES = ["Wesley", "Fábio"];
  let aba = "fila";

  const titulo = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  // Liga cada item da nota a um produto do cadastro (pelo código ou pelo nome parecido)
  const ligarProdutos = (itens, produtos) => itens.map((i) => { const m = D.casarProduto(i, produtos); return { ...i, produto_id: m.produto ? m.produto.id : null, descricao: m.produto ? m.produto.nome : i.descricao, nivel: m.nivel }; });

  NE.rotas.notas = (raiz, params, app) => {
    if (params.nova) return formNota(raiz, app, params);
    if (params.importar) return importar(raiz, app);
    lista(raiz, app);
  };

  // ───────────────────────── fila ─────────────────────────
  function lista(raiz, app) {
    const admin = app.admin; const box = el("div", { id: "lista-minhas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const chips = el("div", { class: "chips" });
    const nova = el("button", { class: "btn btn-principal btn-bloco btn-gigante", type: "button", id: "btn-nova" }, ic("caminhao"), "Conferir uma carga");
    nova.addEventListener("click", () => app.ir("conferir", {}));
    const cab = el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, admin ? "Notas" : "Fila de carga"), el("p", {}, admin ? "O que está esperando conferência e o histórico." : "Toque numa nota para conferir. Sem nota? Use o botão abaixo.")),
      admin && el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
        el("button", { type: "button", class: "btn btn-azul", id: "btn-nota-nova", onclick: () => app.ir("notas", { nova: "1" }) }, ic("mais"), "Nova nota"),
        el("button", { type: "button", class: "btn btn-secundario", id: "btn-importar", onclick: () => app.ir("notas", { importar: "1" }) }, ic("baixar"), "Importar XML")));
    raiz.replaceChildren(cab, nova, el("div", { style: "height:14px" }), admin && chips, box);
    let todas = [];
    const desenharChips = () => chips.replaceChildren(...[["fila", "Na fila"], ["todas", "Todas"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(aba === id), onclick: () => { aba = id; desenharChips(); desenharLista(); } }, nome)));
    const desenharLista = () => {
      const agora = Date.now(); const cfg = D.CONFIG_PADRAO;
      const vis = todas.filter((n) => (admin && aba === "todas" ? true : ["pendente", "em_conferencia"].includes(n.status)));
      if (admin && aba === "todas") vis.sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
      box.replaceChildren(...(vis.length ? vis.map((n) => cartao(n, agora, cfg, app)) : [el("div", { class: "vazio-grande" }, el("strong", {}, "Fila vazia"), admin ? "Cadastre uma nota nova ou importe o XML." : "Quando chegar nota nova, ela aparece aqui e você recebe um aviso.")]));
    };
    if (admin) desenharChips();
    NE.dados.notas({ status: admin ? undefined : ["pendente", "em_conferencia"] }).then((n) => { todas = n; desenharLista(); }).catch((e) => { box.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", box); });
  }

  function cartao(n, agora, cfg, app) {
    const idade = (agora - D.aMs(n.criado_em)) / D.MIN; const fila = ["pendente", "em_conferencia"].includes(n.status);
    const parada = fila && idade >= cfg.limiteNotaParadaMin;
    const stat = { pendente: ["Aguardando", ""], em_conferencia: ["Conferindo", "azul"], conferida: ["Conferida", "ok"], cancelada: ["Cancelada", "erro"] }[n.status] || ["", ""];
    const b = el("button", { type: "button", class: `linha-cartao ${parada ? "critico" : fila ? "atencao" : n.status === "conferida" ? "ok" : ""}` },
      el("strong", {}, `Nota ${n.numero}`, n.cliente ? ` · ${n.cliente}` : ""),
      el("span", { class: "meta" }, `${D.plural((n.itens || []).length, "item", "itens")}${n.vendedor ? ` · ${n.vendedor}` : ""} · ${fila ? `espera há ${D.duracao(idade)}` : D.tempoRelativo(n.criado_em, agora)}`),
      el("span", { class: "lado" }, el("span", { class: `etiqueta ${parada ? "erro" : stat[1]}` }, parada ? "Parada" : stat[0])));
    b.addEventListener("click", () => (app.admin ? detalhe(n, app) : fila ? app.ir("conferir", { nota_id: n.id }) : null));
    return b;
  }

  // ───────────────────────── detalhe ─────────────────────────
  function detalhe(n, app) {
    const fila = ["pendente", "em_conferencia"].includes(n.status); let j;
    const tabela = el("div", { class: "tabela-wrap resumo" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Qtd"))),
      el("tbody", {}, (n.itens || []).map((i) => el("tr", {}, el("td", {}, i.descricao, i.produto_id ? "" : el("span", { class: "etiqueta alerta", style: "margin-left:6px" }, "sem cadastro")), el("td", { class: "num" }, NE.num(i.quantidade ?? i.qtd_nota)))))));
    const linhas = [["Cliente", n.cliente || "—"], ["Vendedor", n.vendedor || "—"], ["Chegou", `${NE.dataHora(n.criado_em)} (${D.tempoRelativo(n.criado_em, Date.now())})`]];
    const botoes = [
      fila && el("button", { type: "button", class: "btn btn-principal", onclick: () => { j.fechar(); app.ir("conferir", { nota_id: n.id }); } }, ic("conferir"), "Conferir"),
      el("button", { type: "button", class: "btn btn-azul", onclick: () => NE.abrirEtiquetas({ ...n, tipo: "nota" }) }, ic("etiqueta"), "Etiquetas"),
      n.conferencia_id && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { const l = await NE.dados.conferencias({ de: 0 }); const c = l.find((x) => x.id === n.conferencia_id); if (c) { j.fechar(); NE.abrirConferencia(c, { podeEnviar: true }); } else NE.aviso("Conferência não encontrada.", "alerta"); } }, ic("olho"), "Ver conferência"),
      fila && el("button", { type: "button", class: "btn btn-secundario", onclick: async () => { if (!confirm(`Cancelar a nota ${n.numero}?`)) return; await NE.dados.cancelarNota(n.id); j.fechar(); NE.aviso("Nota cancelada.", "ok"); app.recarregar(); } }, ic("lixeira"), "Cancelar nota"),
    ].filter(Boolean);
    j = NE.janelaSimples({ etiqueta: `Nota ${n.numero}`, titulo: n.cliente || "Nota fiscal", corpo: el("div", {}, el("div", { class: "resumo" }, linhas.map(([k, v]) => NE.linhaResumo(k, v))), el("h3", {}, "Itens"), tabela), rodape: botoes });
  }

  // ───────────────────────── nota nova ─────────────────────────
  async function formNota(raiz, app, params) {
    const produtos = await NE.dados.produtos();
    const n = { numero: "", cliente: "", vendedor: "", itens: [] }; let pre = null;
    if (params.pre) pre = NE.memoria.ler("ne-nota-pre");
    if (pre) { Object.assign(n, pre); NE.memoria.apagar("ne-nota-pre"); }
    const caixa = el("div", {});
    const avisoBox = el("div", {});
    const desenhar = () => {
      const tem = new Set(n.itens.map((i) => i.produto_id).filter(Boolean));
      const num = NE.campoTexto("Número da nota", { id: "nn-numero", inputmode: "numeric", value: n.numero, placeholder: "Ex.: 48213" }, (v) => { n.numero = v.trim(); });
      const cli = NE.campoTexto("Cliente (opcional)", { id: "nn-cliente", value: n.cliente, placeholder: "Nome do cliente" }, (v) => { n.cliente = v; });
      const vend = el("div", { class: "campo" }, el("label", {}, "Vendedor (opcional)"), el("div", { class: "chips" }, VENDEDORES.map((v) => el("button", { type: "button", class: "chip", "aria-pressed": String(n.vendedor === v), onclick: () => { n.vendedor = n.vendedor === v ? "" : v; desenhar(); } }, v))));
      const itens = n.itens.length ? n.itens.map((i, k) => el("div", { class: "item" }, el("div", { class: "item-topo" }, el("strong", {}, i.descricao), el("button", { type: "button", class: "link-acao", onclick: () => { n.itens.splice(k, 1); desenhar(); } }, ic("fechar"), "Tirar")),
        NE.contador(i.quantidade, (v) => { i.quantidade = v; }, `nn-q-${k}`))) : [el("p", { class: "vazio" }, "Toque nos produtos abaixo para adicionar à nota.")];
      const grade = el("div", { class: "grade-escolha" }, produtos.filter((p) => !tem.has(p.id)).map((p) => el("button", { type: "button", class: "escolha", onclick: () => { n.itens.push({ produto_id: p.id, descricao: p.nome, quantidade: p.por_pilha || 1 }); desenhar(); } }, el("strong", {}, p.nome), el("span", {}, "Toque para adicionar"))));
      const foto = el("label", { class: "btn btn-secundario botao-camera", id: "btn-ler-foto" }, ic("faisca"), "Ler da foto com o assistente",
        el("input", { type: "file", accept: "image/*", capture: "environment", "aria-label": "Foto da nota" }));
      foto.querySelector("input").addEventListener("change", async (ev) => {
        const arq = ev.target.files?.[0]; if (!arq) return;
        try { NE.aviso("Lendo a nota…", "ok"); const r = await NE.dados.iaLerNota(await NE.reduzirFoto(arq)); n.numero = r.numero || n.numero; n.cliente = r.cliente || n.cliente; n.itens = ligarProdutos((r.itens || []).map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })), produtos).map((i) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade })); desenhar(); NE.aviso("Pronto. Confira os dados antes de salvar.", "ok"); }
        catch (e) { NE.aviso(NE.mensagemErro(e)); }
      });
      const salvar = el("button", { type: "button", class: "btn btn-principal btn-bloco", id: "btn-salvar-nota" }, ic("check"), "Salvar na fila");
      salvar.addEventListener("click", () => NE.comCarregando(salvar, async () => {
        if (!n.numero) return NE.aviso("Digite o número da nota.", "erro", avisoBox);
        if (!n.itens.length) return NE.aviso("Adicione pelo menos um produto.", "erro", avisoBox);
        await NE.dados.criarNota({ numero: n.numero, cliente: n.cliente, vendedor: n.vendedor, itens: n.itens.map((i) => ({ produto_id: i.produto_id || null, descricao: i.descricao, quantidade: i.quantidade })) });
        NE.aviso(`Nota ${n.numero} entrou na fila.`, "ok"); app.ir("notas", {}, { substituir: true });
      }));
      caixa.replaceChildren(avisoBox, el("div", { class: "cartao" }, num, cli, vend), el("div", { class: "bloco-titulo" }, el("h2", {}, "Itens")), ...itens, el("h2", { class: "secao-titulo" }, "Adicionar produto"), grade, el("div", { style: "display:grid;gap:10px;margin-top:16px" }, foto, salvar));
    };
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Nota nova"), el("p", {}, "Cai direto na fila de conferência.")), el("button", { type: "button", class: "link-acao", onclick: () => app.voltar() }, ic("voltar"), "Voltar")), caixa);
    desenhar();
  }

  // ───────────────────────── importar XML ─────────────────────────
  function importar(raiz, app) {
    const area = el("div", {}); let achadas = []; let criarProdutos = true;
    const entrada = el("input", { type: "file", accept: ".xml,text/xml,application/xml", multiple: true, "aria-label": "Arquivos XML" });
    entrada.addEventListener("change", async () => {
      const resultados = []; const produtos = await NE.dados.produtos(true);
      for (const arq of [...entrada.files]) {
        try { const x = await NE.nfeXml.lerArquivo(arq); resultados.push({ ok: true, arq: arq.name, ...x, itens: ligarProdutos(x.itens, produtos) }); }
        catch (e) { resultados.push({ ok: false, arq: arq.name, erro: e.message }); }
      }
      achadas = resultados; mostrar();
    });
    const mostrar = () => {
      const boas = achadas.filter((x) => x.ok); const semCad = new Set(boas.flatMap((x) => x.itens.filter((i) => !i.produto_id).map((i) => i.descricao)));
      const importarBtn = el("button", { type: "button", class: "btn btn-principal btn-bloco", id: "btn-confirmar-xml" }, ic("check"), `Colocar ${D.plural(boas.length, "nota", "notas")} na fila`);
      importarBtn.addEventListener("click", () => NE.comCarregando(importarBtn, async () => {
        let produtos = await NE.dados.produtos(true);
        if (criarProdutos && semCad.size) { for (const nome of semCad) { try { await NE.dados.criarProduto({ nome: titulo(nome), unidade: "un", minimo: 0 }); } catch { /* já existe */ } } produtos = await NE.dados.produtos(true); }
        const envio = boas.map((x) => ({ numero: x.numero, cliente: x.cliente, chave_nfe: x.chave_nfe, itens: ligarProdutos(x.itens, produtos).map((i) => ({ produto_id: i.produto_id, descricao: i.descricao, codigo: i.codigo, quantidade: i.quantidade })) }));
        const r = await NE.dados.importarNotas(envio); const ok = r.filter((x) => x.ok).length; const falhas = r.filter((x) => !x.ok);
        NE.aviso(`${D.plural(ok, "nota entrou", "notas entraram")} na fila.${falhas.length ? ` ${falhas.length} não entrou: ${falhas[0].erro}` : ""}`, falhas.length ? "alerta" : "ok");
        app.ir("notas", {}, { substituir: true });
      }));
      area.replaceChildren(...achadas.map((x) => x.ok ? el("div", { class: "linha-cartao ok", role: "group" }, el("strong", {}, `Nota ${x.numero}${x.cliente ? " · " + x.cliente : ""}`),
        el("span", { class: "meta" }, x.itens.map((i) => `${i.descricao} ×${NE.num(i.quantidade)}${i.produto_id ? "" : " ⚠"}`).join(" · ")), el("span", { class: "lado" }, el("span", { class: "etiqueta ok" }, "Lida")))
        : el("div", { class: "linha-cartao critico", role: "group" }, el("strong", {}, x.arq), el("span", { class: "meta" }, x.erro))),
        semCad.size ? el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, `${D.plural(semCad.size, "produto não está", "produtos não estão")} no cadastro: ${D.lista([...semCad], 3)}. `), NE.chave(criarProdutos, "Cadastrar automaticamente", (v) => { criarProdutos = v; })) : null,
        boas.length ? importarBtn : null);
    };
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Importar XML"), el("p", {}, "Selecione um ou vários XML de NF-e. O sistema lê número, cliente e itens.")), el("button", { type: "button", class: "link-acao", onclick: () => app.voltar() }, ic("voltar"), "Voltar")),
      el("label", { class: "btn btn-azul btn-bloco btn-gigante botao-camera", id: "btn-escolher-xml" }, ic("baixar"), "Escolher arquivos XML", entrada), el("div", { style: "height:14px" }), area);
  }
})();
