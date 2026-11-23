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
  // Editar e apagar um cadastro (caminhão ou produto). Apagar pede confirmação; se já tem histórico, o app não apaga: só tira de uso.
  const acoesCadastro = ({ nome, editar, apagar, desativar, aoFim }) => el("div", { class: "acoes-cadastro" },
    el("button", { type: "button", class: "btn-mini", "aria-label": `Editar ${nome}`, onclick: editar }, ic("editar"), "Editar"),
    el("button", { type: "button", class: "btn-mini perigo", "aria-label": `Apagar ${nome}`, onclick: () => {
      const confirmar = el("button", { type: "button", class: "btn btn-principal" }, ic("lixeira"), "Apagar");
      const cancelar = el("button", { type: "button", class: "btn btn-secundario" }, "Cancelar");
      const j = NE.janelaSimples({ etiqueta: "Atenção", titulo: `Apagar ${nome}?`, pequena: true,
        corpo: el("p", {}, "Só apague se foi cadastrado por engano. Se já foi usado em notas ou cargas, o app não apaga: ele só tira da lista de uso, e o histórico fica guardado."), rodape: [cancelar, confirmar] });
      cancelar.addEventListener("click", j.fechar);
      confirmar.addEventListener("click", () => NE.comCarregando(confirmar, async () => {
        try { await apagar(); j.fechar(); NE.aviso(`${nome} foi apagado.`, "ok"); aoFim(); }
        catch (e) {
          if (e && e.emUso) { await desativar(); j.fechar(); NE.aviso(`${nome} já tem histórico, então não foi apagado. Ficou como fora de uso.`, "ok"); aoFim(); }
          else NE.aviso(NE.mensagemErro(e), "erro");
        }
      }));
    } }, ic("lixeira"), "Apagar"));
  const vazio = (t) => el("p", { class: "vazio", style: "flex:1" }, t);

  // ───────────────────────── CARGAS ─────────────────────────
  // Vendedor: "Minhas cargas" (as das notas dele) com a opção "De todos". Qualquer um pode buscar por nota, cliente ou placa:
  // buscando, o app olha os últimos 31 dias em vez de um dia só.
  NE.rotas.cargas = (raiz, params, app) => {
    const vendedor = app.perm.painel === "vendas";
    let dia = NE.hojeISO(), situacao = params.dif ? "divergencia" : "todas", filtroExtra = null, todas = [], busca = "", escopo = vendedor ? "minhas" : "todos", minhasIds = null, modoPeriodo = false, seq = 0;
    const numeros = el("div", { class: "numeros" }); const navDia = el("div", { class: "navegador-dia" }); const chips = el("div", { class: "chips" }); const chipsDono = el("div", { class: "chips" });
    const campoBusca = el("input", { class: "entrada busca", id: "busca-nota", type: "search", inputmode: "search", autocomplete: "off", placeholder: "Buscar nota, cliente ou placa" });
    campoBusca.addEventListener("input", () => { busca = campoBusca.value.trim(); const quer = busca.length > 0; if (quer !== modoPeriodo) { modoPeriodo = quer; carregar(); } else desenhar(); });
    const extra = el("div", {}); const lista = el("div", { class: "lista-conf" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const planilha = el("button", { type: "button", class: "link-acao", onclick: async () => { const c = await NE.dados.conferencias({ de: Date.now() - 31 * D.DIA }); baixar(`cargas-${NE.hojeISO()}.csv`, D.csvConferencias(c)); } }, ic("baixar"), "Baixar planilha (30 dias)");
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, vendedor ? "Minhas cargas" : "Cargas"), el("p", {}, vendedor ? "As entregas das suas notas: confira e mande o rastreio ao cliente." : "Tudo que saiu, com fotos e conferência.")),
      app.perm.conferir && el("button", { class: "btn btn-principal", type: "button", id: "btn-nova-painel", onclick: () => app.ir("conferir", {}) }, ic("mais"), "Nova conferência")),
      numeros, el("div", { class: "filtros" }, navDia, campoBusca, vendedor && chipsDono, chips), extra, lista, vendedor ? null : el("div", { style: "margin-top:12px" }, planilha));

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
    const desenharDono = () => chipsDono.replaceChildren(...[["minhas", "Minhas"], ["todos", "De todos"]].map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(escopo === id), onclick: () => { escopo = id; desenharDono(); desenhar(); } }, nome)));
    const aoFiltrar = (tipo, valor, rotulo) => { filtroExtra = { tipo, valor, rotulo }; desenhar(); window.scrollTo({ top: 0 }); };
    function desenhar() {
      if (vendedor && escopo === "minhas" && !minhasIds) return;   // ainda sabendo quais notas são dele
      let base = filtroExtra ? todas.filter((c) => (filtroExtra.tipo === "placa" ? c.placa === filtroExtra.valor : c.conferente_id === filtroExtra.valor)) : todas;
      if (vendedor && escopo === "minhas") base = base.filter((c) => minhasIds.has(c.nota_id));
      const div = base.filter((c) => c.status === "divergencia").length;
      numeros.replaceChildren(el("div", { class: "numero" }, el("b", {}, String(base.length)), el("span", {}, "conferências")), el("div", { class: "numero ok" }, el("b", {}, String(base.length - div)), el("span", {}, "conferem")), el("div", { class: "numero alerta" }, el("b", {}, String(div)), el("span", {}, "com diferença")));
      extra.replaceChildren(modoPeriodo ? el("div", { class: "filtro-ativo" }, el("span", {}, "Buscando nos ", el("strong", {}, "últimos 31 dias"))) : "", filtroExtra ? el("div", { class: "filtro-ativo" }, el("span", {}, "Mostrando: ", el("strong", {}, filtroExtra.rotulo)), el("button", { type: "button", class: "link-acao", onclick: () => { filtroExtra = null; desenhar(); } }, ic("fechar"), "Tirar filtro")) : "");
      const qa = busca.toUpperCase().replace(/[^A-Z0-9]/g, ""), qn = D.normalizar(busca);
      const bate = (c) => !busca || (qa && (String(c.numero_nota).toUpperCase().includes(qa) || String(c.placa).includes(qa))) || (qn && D.normalizar(c.cliente || "").includes(qn));
      const vis = base.filter((c) => (situacao === "todas" || c.status === situacao) && bate(c));
      const vazioTxt = busca ? "Nenhuma entrega encontrada nos últimos 31 dias." : situacao === "divergencia" ? "Nenhuma diferença neste dia." : vendedor && escopo === "minhas" ? "Nenhuma carga sua neste dia." : "Nenhuma conferência neste dia.";
      lista.replaceChildren(...(vis.length ? vis.map((c) => NE.cartaoConferencia(c, (x) => NE.abrirConferencia(x, { aoFiltrar, podeEnviar: true }))) : [el("p", { class: "vazio" }, vazioTxt)]));
    }
    function carregar() {
      navDia.hidden = modoPeriodo; if (!modoPeriodo) desenharNav();
      const meu = ++seq; const chave = modoPeriodo ? "conf-periodo" : `conf-${dia}-todas`;
      const buscar = modoPeriodo ? () => NE.dados.conferencias({ de: Date.now() - 31 * D.DIA }) : () => NE.dados.conferencias({ dia });
      NE.carregarRapido(chave, buscar, (d) => { if (meu !== seq) return; todas = d; desenhar(); }, (e) => { if (meu !== seq) return; lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); });
    }
    if (vendedor) { desenharDono(); NE.dados.notas().then((l) => { minhasIds = new Set(l.filter((n) => D.ehMinhaNota(n, app.perfil)).map((n) => n.id)); desenhar(); }).catch((e) => { minhasIds = new Set(); NE.aviso(NE.mensagemErro(e), "erro", lista); }); }
    desenharChips(); carregar();
  };

  // ───────────────────────── MAIS ─────────────────────────
  NE.rotas.mais = (raiz, params, app) => {
    const item = (icone, titulo, sub, acao, id) => el("button", { type: "button", class: "cartao-guia", id, onclick: acao }, ic(icone), el("span", {}, titulo, el("small", { style: "display:block" }, sub)));
    const pode = (r) => (app.perm.telas || []).includes(r); const tutorial = app.perm.painel === "vendas" ? "vendas" : "painel";
    // O tutorial mostra as telas de verdade: vai para o Início e começa quando ele terminou de desenhar
    const abrirTutorial = () => { app.ir("inicio"); const t0 = Date.now(); const esperar = () => { if (document.querySelector(".tiles") || Date.now() - t0 > 4000) NE.iniciarTour(tutorial, { verDicas: () => NE.abrirGuia(tutorial, raiz, () => app.ir("mais"), { novaConferencia: () => app.ir("conferir") }) }); else setTimeout(esperar, 150); }; esperar(); };
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Mais"), el("p", {}, `${NE.rotuloFuncao(app.perfil.funcao)} · o que mais você pode fazer aqui.`))),
      el("div", { class: "menu-grade" },
        pode("alertas") && item("sino", "Avisos", "O que aconteceu", () => app.ir("alertas")),
        pode("equipe") && app.perm.cadastra && item("pessoas", "Equipe", "Funcionários e acesso", () => app.ir("equipe")),
        pode("cadastros") && app.perm.cadastra && item("caminhao", "Caminhões", "Placas da frota", () => app.ir("cadastros", { aba: "caminhoes" })),
        pode("cadastros") && app.perm.cadastra && item("caixas", "Produtos", "Mínimo e pilha", () => app.ir("cadastros", { aba: "produtos" })),
        pode("guia") && app.perm.cadastra && item("engrenagem", "Ajustes", "Horário e prazos", () => app.ir("guia", { fluxo: "ajustes" })),
        item("ajuda", "Tutorial", "Aprender em 1 minuto", abrirTutorial, "mais-tutorial"),
        pode("cargas") && app.perm.painel !== "vendas" && item("baixar", "Planilha de cargas", "30 dias em CSV", async () => baixar(`cargas-${NE.hojeISO()}.csv`, D.csvConferencias(await NE.dados.conferencias({ de: Date.now() - 31 * D.DIA })))),
        item("mapa", "Ver o site", "Abre em outra aba", () => window.open("index.html", "_blank", "noopener"))));
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
      conteudo.replaceChildren(cabecalhoAba("Caminhões", "Aparecem na hora de escolher o caminhão.", "Cadastrar caminhão", () => app.ir("guia", { fluxo: "novoVeiculo" })), lista);
      NE.dados.veiculos(true).then((vs) => lista.replaceChildren(...(vs.length ? vs.map((v) => {
        const detalhes = [[v.marca, v.modelo, v.ano].filter(Boolean).join(" "), v.cor, v.capacidade_t ? `${D.fmt(v.capacidade_t)} t` : ""].filter(Boolean).join(" · ");
        const miniatura = el("span", { class: "veiculo-miniatura", html: NE.icone.caminhao }); const f0 = (v.fotos || [])[0]; if (f0) NE.dados.urlFoto(f0.caminho).then((u) => { if (u) miniatura.replaceChildren(el("img", { src: u, alt: "" })); }).catch(() => {});
        return el("div", {}, el("button", { type: "button", class: "pessoa-linha link-acao", style: "text-align:left;font-weight:inherit", onclick: () => app.ir("guia", { fluxo: "veiculo", id: v.id }) }, miniatura,
          el("div", {}, el("span", { class: "placa-br" }, v.placa), el("div", { class: "meta" }, `${NE.tiposVeiculo[v.tipo] || v.tipo}${detalhes ? " · " + detalhes : ""}`), (v.fotos || []).length ? el("div", { class: "meta" }, `${D.plural(v.fotos.length, "foto", "fotos")}`) : null)),
          el("div", { class: "linha-cadastro" }, NE.chave(v.ativo, "Em uso", (x) => NE.dados.alterarVeiculo(v.id, { ativo: x })),
            acoesCadastro({ nome: v.placa, editar: () => app.ir("guia", { fluxo: "veiculo", id: v.id }), apagar: () => NE.dados.excluirVeiculo(v.id), desativar: () => NE.dados.alterarVeiculo(v.id, { ativo: false }), aoFim: () => app.ir("cadastros", { aba: "caminhoes" }, { substituir: true }) })));
      }) : [vazio("Nenhum caminhão ainda.")]))).catch((e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    } else {
      conteudo.replaceChildren(cabecalhoAba("Produtos", "Mínimo e peças por pilha deixam o estoque e a contagem mais inteligentes.", "Cadastrar produto", () => app.ir("guia", { fluxo: "novoProduto" })), lista);
      NE.dados.produtos(true).then((ps) => lista.replaceChildren(...(ps.length ? ps.map((p) => el("div", {}, el("button", { type: "button", class: "link-acao", style: "text-align:left;display:block", onclick: () => app.ir("guia", { fluxo: "produto", id: p.id }) }, el("strong", {}, p.nome), el("div", { class: "meta" }, `mínimo ${D.fmt(p.minimo || 0)}${p.por_pilha ? ` · ${p.por_pilha} por pilha` : ""} · toque para ajustar`)), el("div", { class: "linha-cadastro" }, NE.chave(p.ativo, "Em uso", (x) => NE.dados.alterarProduto(p.id, { ativo: x })),
        acoesCadastro({ nome: p.nome, editar: () => app.ir("guia", { fluxo: "produto", id: p.id }), apagar: () => NE.dados.excluirProduto(p.id), desativar: () => NE.dados.alterarProduto(p.id, { ativo: false }), aoFim: () => app.ir("cadastros", { aba: "produtos" }, { substituir: true }) })))) : [vazio("Nenhum produto ainda.")]))).catch((e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    }
  };
  // ───────────────────────── CONFIGURAÇÕES ─────────────────────────
  NE.rotas.config = (raiz, params, app) => app.ir("guia", { fluxo: "ajustes" }, { substituir: true });
})();
