// Telas do administrador: Cargas (conferências por dia), Mais (menu), Cadastros (caminhões e produtos) e Configurações.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;

  NE.cartaoConferencia = (c, aoAbrir) => {
    const n = (c.itens || []).length;
    const b = el("button", { type: "button", class: `conf${c.status === "divergencia" ? " divergencia" : ""}` },
      el("strong", {}, `Nota ${c.numero_nota} · `, el("span", { class: "placa-br" }, c.placa)),
      el("span", { class: "hora" }, NE.hora(c.criado_em)),
      el("span", { class: "meta" }, c.status === "divergencia" ? "Com diferença" : "Confere", " · ", c.conferente?.nome || ""),
      el("span", { class: "meta", style: "text-align:right" }, `${n} ${n === 1 ? "item" : "itens"}`));
    b.addEventListener("click", () => aoAbrir(c));
    return b;
  };

  // Mostra na hora o que já está guardado no aparelho e atualiza quando a resposta chega
  NE.carregarRapido = (chave, buscar, desenhar, aoErro) => {
    const guardado = NE.dados.emCache(chave);
    if (guardado) desenhar(guardado);
    buscar().then((novo) => { if (JSON.stringify(novo) !== JSON.stringify(guardado)) desenhar(novo); }).catch((e) => { if (!guardado) aoErro(e); });
  };

  // Chave liga/desliga desenhada (sem caixa de marcar do sistema)
  NE.chave = (ligado, rotulo, aoMudar) => {
    const b = el("button", { type: "button", class: "chave", role: "switch", "aria-checked": String(!!ligado) }, el("span", { class: "chave-trilho" }, el("span", { class: "chave-bola" })), el("span", {}, rotulo));
    b.addEventListener("click", async () => {
      const novo = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", String(novo)); b.disabled = true;
      try { await aoMudar(novo); } catch (e) { b.setAttribute("aria-checked", String(!novo)); NE.aviso(NE.mensagemErro(e)); } finally { b.disabled = false; }
    });
    return b;
  };

  const baixar = (nome, texto) => { const a = el("a", { href: URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })), download: nome }); document.body.append(a); a.click(); a.remove(); };
  const cabecalhoAba = (titulo, dica, rotulo, acao) => el("div", { class: "cabecalho-aba" }, el("div", {}, el("h2", {}, titulo), el("p", {}, dica)), el("button", { type: "button", class: "btn btn-azul", onclick: acao }, ic("mais"), rotulo));
  const vazio = (t) => el("p", { class: "vazio", style: "flex:1" }, t);

  // ───────────────────────── CARGAS ─────────────────────────
  NE.rotas.cargas = (raiz, params, app) => {
    let dia = NE.hojeISO(), situacao = params.dif ? "divergencia" : "todas", filtroExtra = null, todas = [], busca = "";
    const numeros = el("div", { class: "numeros" }); const navDia = el("div", { class: "navegador-dia" }); const chips = el("div", { class: "chips" });
    const campoBusca = el("input", { class: "entrada busca", id: "busca-nota", type: "search", inputmode: "search", autocomplete: "off", placeholder: "Buscar nota ou placa" });
    campoBusca.addEventListener("input", () => { busca = campoBusca.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); desenhar(); });
    const extra = el("div", {}); const lista = el("div", { class: "lista-conf" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const planilha = el("button", { type: "button", class: "link-acao", onclick: async () => { const c = await NE.dados.conferencias({ de: Date.now() - 31 * D.DIA }); baixar(`cargas-${NE.hojeISO()}.csv`, D.csvConferencias(c)); } }, ic("baixar"), "Baixar planilha (30 dias)");
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Cargas"), el("p", {}, "Tudo que saiu, com fotos e conferência.")),
      el("button", { class: "btn btn-principal", type: "button", id: "btn-nova-painel", onclick: () => app.ir("conferir", {}) }, ic("mais"), "Nova conferência")),
      numeros, el("div", { class: "filtros" }, navDia, campoBusca, chips), extra, lista, el("div", { style: "margin-top:12px" }, planilha));

    const mudarDia = (d) => { dia = d; carregar(); };
    const desenharNav = () => {
      const hoje = NE.hojeISO(); const data = new Date(`${dia}T12:00:00`); const rotulo = dia === hoje ? "Hoje" : data.toLocaleDateString("pt-BR", { weekday: "long" });
      const somar = (n) => { const x = new Date(data); x.setDate(x.getDate() + n); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
      navDia.replaceChildren(
        el("button", { type: "button", class: "nav-seta", "aria-label": "Dia anterior", html: NE.icone.voltar, onclick: () => mudarDia(somar(-1)) }),
        el("button", { type: "button", class: "nav-dia", "aria-label": "Voltar para hoje", onclick: () => mudarDia(hoje) }, el("strong", {}, rotulo), el("span", {}, data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))),
        el("button", { type: "button", class: "nav-seta", "aria-label": "Próximo dia", html: NE.icone.seguir, disabled: dia >= hoje, onclick: () => mudarDia(somar(1)) }));
    };
    const desenharChips = () => chips.replaceChildren(...[["todas", "Todas"], ["divergencia", "Com diferença"], ["ok", "Confere"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(id === situacao), onclick: () => { situacao = id; desenharChips(); desenhar(); } }, nome)));
    const aoFiltrar = (tipo, valor, rotulo) => { filtroExtra = { tipo, valor, rotulo }; desenhar(); window.scrollTo({ top: 0 }); };
    function desenhar() {
      const base = filtroExtra ? todas.filter((c) => (filtroExtra.tipo === "placa" ? c.placa === filtroExtra.valor : c.conferente_id === filtroExtra.valor)) : todas;
      const div = base.filter((c) => c.status === "divergencia").length;
      numeros.replaceChildren(el("div", { class: "numero" }, el("b", {}, String(base.length)), el("span", {}, "conferências")), el("div", { class: "numero ok" }, el("b", {}, String(base.length - div)), el("span", {}, "conferem")), el("div", { class: "numero alerta" }, el("b", {}, String(div)), el("span", {}, "com diferença")));
      extra.replaceChildren(filtroExtra ? el("div", { class: "filtro-ativo" }, el("span", {}, "Mostrando: ", el("strong", {}, filtroExtra.rotulo)), el("button", { type: "button", class: "link-acao", onclick: () => { filtroExtra = null; desenhar(); } }, ic("fechar"), "Tirar filtro")) : "");
      const vis = base.filter((c) => (situacao === "todas" || c.status === situacao) && (!busca || String(c.numero_nota).includes(busca) || c.placa.includes(busca)));
      lista.replaceChildren(...(vis.length ? vis.map((c) => NE.cartaoConferencia(c, (x) => NE.abrirConferencia(x, { aoFiltrar, podeEnviar: true }))) : [el("p", { class: "vazio" }, situacao === "divergencia" ? "Nenhuma diferença neste dia." : "Nenhuma conferência neste dia.")]));
    }
    function carregar() { desenharNav(); NE.carregarRapido(`conf-${dia}-todas`, () => NE.dados.conferencias({ dia }), (d) => { todas = d; desenhar(); }, (e) => { lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); }); }
    desenharChips(); carregar();
  };

  // ───────────────────────── MAIS ─────────────────────────
  NE.rotas.mais = (raiz, params, app) => {
    const item = (icone, titulo, sub, acao, id) => el("button", { type: "button", class: "cartao-guia", id, onclick: acao }, ic(icone), el("span", {}, titulo, el("small", { style: "display:block" }, sub)));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Mais"), el("p", {}, "Cadastros, ajustes e ajuda."))),
      el("div", { class: "menu-grade" },
        item("sino", "Avisos", "O que aconteceu", () => app.ir("alertas")),
        item("pessoas", "Equipe", "Funcionários e acesso", () => app.ir("equipe")),
        item("caminhao", "Caminhões", "Placas da frota", () => app.ir("cadastros", { aba: "caminhoes" })),
        item("caixas", "Produtos", "Mínimo e pilha", () => app.ir("cadastros", { aba: "produtos" })),
        item("engrenagem", "Ajustes", "Horário e prazos", () => app.ir("config")),
        item("ajuda", "Tutorial", "Aprender em 1 minuto", () => NE.iniciarTour("painel", { verDicas: () => NE.abrirGuia("painel", raiz, () => app.ir("mais"), { novaConferencia: () => app.ir("conferir") }) }), "mais-tutorial"),
        item("baixar", "Planilha de cargas", "30 dias em CSV", async () => baixar(`cargas-${NE.hojeISO()}.csv`, D.csvConferencias(await NE.dados.conferencias({ de: Date.now() - 31 * D.DIA })))),
        item("mapa", "Ver o site", "Como o cliente vê", () => { location.href = "index.html"; })));
  };

  // ───────────────────────── CADASTROS (caminhões e produtos) ─────────────────────────
  NE.rotas.cadastros = (raiz, params, app) => {
    const aba = params.aba || "caminhoes";
    const voltar = () => app.ir("cadastros", { aba }, { substituir: true });
    const abrir = (tipo) => { $main().className = ""; NE.cadastros[tipo](raiz, voltar); };
    const $main = () => document.querySelector("main");
    const barra = el("div", { class: "abas", role: "tablist" }, [["caminhoes", "Caminhões"], ["produtos", "Produtos"]].map(([id, nome]) => el("button", { class: "aba", type: "button", role: "tab", "aria-selected": String(id === aba), onclick: () => app.ir("cadastros", { aba: id }, { substituir: true }) }, nome)));
    const conteudo = el("div", {});
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Cadastros"))), barra, conteudo);
    const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
    if (aba === "caminhoes") {
      conteudo.replaceChildren(cabecalhoAba("Caminhões", "Aparecem na hora de escolher o caminhão.", "Cadastrar caminhão", () => abrir("caminhao")), lista);
      NE.dados.veiculos(true).then((vs) => lista.replaceChildren(...(vs.length ? vs.map((v) => el("div", {}, el("div", {}, el("span", { class: "placa-br" }, v.placa), el("div", { class: "meta" }, `${NE.tiposVeiculo[v.tipo] || v.tipo}${v.descricao ? " · " + v.descricao : ""}`)), NE.chave(v.ativo, "Em uso", (x) => NE.dados.alterarVeiculo(v.id, { ativo: x })))) : [vazio("Nenhum caminhão ainda.")]))).catch((e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    } else {
      conteudo.replaceChildren(cabecalhoAba("Produtos", "Mínimo e peças por pilha deixam o estoque e a contagem mais inteligentes.", "Cadastrar produto", () => abrir("produto")), lista);
      NE.dados.produtos(true).then((ps) => lista.replaceChildren(...(ps.length ? ps.map((p) => el("div", {}, el("button", { type: "button", class: "link-acao", style: "text-align:left;display:block", onclick: () => editarProduto(p, app) }, el("strong", {}, p.nome), el("div", { class: "meta" }, `mínimo ${D.fmt(p.minimo || 0)}${p.por_pilha ? ` · ${p.por_pilha} por pilha` : ""} · toque para ajustar`)), NE.chave(p.ativo, "Em uso", (x) => NE.dados.alterarProduto(p.id, { ativo: x })))) : [vazio("Nenhum produto ainda.")]))).catch((e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    }
  };
  function editarProduto(p, app) {
    const e = { minimo: Number(p.minimo || 0), por_pilha: Number(p.por_pilha || 0) }; let j;
    const ok = el("button", { type: "button", class: "btn btn-principal", onclick: () => NE.comCarregando(ok, async () => { await NE.dados.alterarProduto(p.id, { minimo: e.minimo, por_pilha: e.por_pilha || null }); j.fechar(); NE.aviso("Produto atualizado.", "ok"); app.recarregar(); }) }, ic("check"), "Salvar");
    j = NE.janelaSimples({ etiqueta: "Produto", titulo: p.nome, corpo: el("div", {}, el("div", { class: "campo" }, el("label", { for: "ep-min" }, "Estoque mínimo"), el("span", { class: "dica" }, "Abaixo disso o app avisa a expedição."), NE.contador(e.minimo, (v) => { e.minimo = v; }, "ep-min")),
      el("div", { class: "campo" }, el("label", { for: "ep-pilha" }, "Peças por pilha"), el("span", { class: "dica" }, "Deixa a contagem mais rápida: conta pilhas, não peça por peça. 0 = não usa pilha."), NE.contador(e.por_pilha, (v) => { e.por_pilha = v; }, "ep-pilha"))), rodape: [ok] });
  }

  // ───────────────────────── CONFIGURAÇÕES ─────────────────────────
  NE.rotas.config = async (raiz, params, app) => {
    const c = await NE.dados.config(); const nomesDia = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; const aviso = el("div", {});
    const caixa = el("div", {});
    const desenhar = () => {
      const dias = el("div", { class: "chips" }, nomesDia.map((n, i) => el("button", { type: "button", class: "chip", "aria-pressed": String(c.expediente.dias.includes(i)), onclick: () => { const s = new Set(c.expediente.dias); s.has(i) ? s.delete(i) : s.add(i); c.expediente.dias = [...s].sort(); desenhar(); } }, n)));
      const hora = (rot, chave, id) => { const inp = el("input", { class: "entrada", type: "time", id, value: c.expediente[chave] }); inp.addEventListener("change", () => { c.expediente[chave] = inp.value; }); return el("div", { class: "campo" }, el("label", { for: id }, rot), inp); };
      const resumo = el("input", { class: "entrada", type: "time", id: "cf-resumo", value: c.resumoDiarioHora }); resumo.addEventListener("change", () => { c.resumoDiarioHora = resumo.value; });
      caixa.replaceChildren(aviso, el("div", { class: "cartao" }, el("h2", {}, "Expediente"), el("p", { class: "suave" }, "Conferência fora desse horário gera um aviso."), dias, el("div", { class: "form-linha", style: "margin-top:12px" }, hora("Começa", "inicio", "cf-ini"), hora("Termina", "fim", "cf-fim"))),
        el("div", { style: "height:12px" }), el("div", { class: "cartao" }, el("h2", {}, "Prazos"),
          el("div", { class: "campo" }, el("label", { for: "cf-parada" }, "Nota parada na fila depois de (minutos)"), NE.contador(c.limiteNotaParadaMin, (v) => { c.limiteNotaParadaMin = Math.max(10, v); }, "cf-parada")),
          el("div", { class: "campo" }, el("label", { for: "cf-contagem" }, "Pedir contagem de produto parado há (dias)"), NE.contador(c.diasContagem, (v) => { c.diasContagem = Math.max(1, v); }, "cf-contagem")),
          el("div", { class: "campo" }, el("label", { for: "cf-resumo" }, "Hora do resumo do dia"), resumo)));
    };
    const salvar = el("button", { type: "button", class: "btn btn-principal btn-bloco", id: "btn-salvar-config" }, ic("check"), "Salvar ajustes");
    salvar.addEventListener("click", () => NE.comCarregando(salvar, async () => { await NE.dados.salvarConfig(c); NE.aviso("Ajustes salvos.", "ok"); }));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Ajustes"), el("p", {}, "Quando o app deve avisar."))), caixa, el("div", { style: "height:14px" }), salvar);
    desenhar();
  };
})();
