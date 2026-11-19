// Painel da expedição/diretoria: conferências do dia (abre em janela) e cadastros passo a passo.
(() => {
  const NE = window.NE;
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
    buscar().then((novo) => { if (JSON.stringify(novo) !== JSON.stringify(guardado)) desenhar(novo); })
      .catch((e) => { if (!guardado) aoErro(e); });
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

  NE.iniciarPainel = (perfil, raiz, abrirConferencia, abaInicial = "hoje") => {
    const abas = [["hoje", "Conferências"], ["funcionarios", "Funcionários"], ["caminhoes", "Caminhões"], ["produtos", "Produtos"]];
    let atual = abaInicial;
    const conteudo = el("div", {});
    const barra = el("div", { class: "abas", role: "tablist" });
    const abrirCadastro = (tipo) => {
      document.querySelector("main").className = "";
      NE.cadastros[tipo](raiz, () => { document.querySelector("main").className = "largo"; NE.iniciarPainel(perfil, raiz, abrirConferencia, atual); });
    };
    const trocar = (id) => {
      atual = id;
      barra.querySelectorAll(".aba").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
      ABAS[id](conteudo, abrirCadastro);
    };
    abas.forEach(([id, nome]) => barra.append(el("button", { class: "aba", type: "button", role: "tab", "data-id": id, "aria-selected": String(id === atual), onclick: () => trocar(id) }, nome)));
    const nova = el("button", { class: "btn btn-principal", type: "button", id: "btn-nova-painel" }, ic("mais"), "Nova conferência");
    nova.addEventListener("click", abrirConferencia);
    raiz.replaceChildren(el("div", { class: "painel-topo" }, el("h1", {}, "Expedição"), nova), barra, conteudo);
    trocar(atual);
  };

  const ABAS = {
    hoje(raiz) {
      let dia = NE.hojeISO(), situacao = "todas", filtroExtra = null, todas = [], busca = "";
      const numeros = el("div", { class: "numeros" });
      const navDia = el("div", { class: "navegador-dia" });
      const chips = el("div", { class: "chips" });
      const campoBusca = el("input", { class: "entrada busca", id: "busca-nota", type: "search", inputmode: "search", autocomplete: "off", placeholder: "Buscar nota ou placa" });
      campoBusca.addEventListener("input", () => { busca = campoBusca.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); desenhar(); });
      const extra = el("div", {});
      const lista = el("div", { class: "lista-conf" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
      raiz.replaceChildren(numeros, el("div", { class: "filtros" }, navDia, campoBusca, chips), extra, lista);

      const mudarDia = (d) => { dia = d; carregar(); };
      const desenharNav = () => {
        const hoje = NE.hojeISO();
        const data = new Date(`${dia}T12:00:00`);
        const rotulo = dia === hoje ? "Hoje" : data.toLocaleDateString("pt-BR", { weekday: "long" });
        const somar = (n) => { const x = new Date(data); x.setDate(x.getDate() + n); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
        navDia.replaceChildren(
          el("button", { type: "button", class: "nav-seta", "aria-label": "Dia anterior", html: NE.icone.voltar, onclick: () => mudarDia(somar(-1)) }),
          el("button", { type: "button", class: "nav-dia", "aria-label": "Voltar para hoje", onclick: () => mudarDia(hoje) },
            el("strong", {}, rotulo), el("span", {}, data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))),
          el("button", { type: "button", class: "nav-seta", "aria-label": "Próximo dia", html: NE.icone.seguir, disabled: dia >= hoje, onclick: () => mudarDia(somar(1)) }));
      };
      const desenharChips = () => chips.replaceChildren(...[["todas", "Todas"], ["divergencia", "Com diferença"], ["ok", "Confere"]].map(([id, nome]) =>
        el("button", { type: "button", class: "chip", "aria-pressed": String(id === situacao), onclick: () => { situacao = id; desenharChips(); desenhar(); } }, nome)));
      const aoFiltrar = (tipo, valor, rotulo) => { filtroExtra = { tipo, valor, rotulo }; desenhar(); window.scrollTo({ top: 0 }); };

      function desenhar() {
        const base = filtroExtra ? todas.filter((c) => (filtroExtra.tipo === "placa" ? c.placa === filtroExtra.valor : c.conferente_id === filtroExtra.valor)) : todas;
        const div = base.filter((c) => c.status === "divergencia").length;
        numeros.replaceChildren(
          el("div", { class: "numero" }, el("b", {}, String(base.length)), el("span", {}, "conferências")),
          el("div", { class: "numero ok" }, el("b", {}, String(base.length - div)), el("span", {}, "conferem")),
          el("div", { class: "numero alerta" }, el("b", {}, String(div)), el("span", {}, "com diferença")));
        extra.replaceChildren(filtroExtra ? el("div", { class: "filtro-ativo" }, el("span", {}, "Mostrando: ", el("strong", {}, filtroExtra.rotulo)),
          el("button", { type: "button", class: "link-acao", onclick: () => { filtroExtra = null; desenhar(); } }, ic("fechar"), "Tirar filtro")) : "");
        const vis = base.filter((c) => (situacao === "todas" || c.status === situacao)
          && (!busca || String(c.numero_nota).includes(busca) || c.placa.includes(busca)));
        lista.replaceChildren(...(vis.length ? vis.map((c) => NE.cartaoConferencia(c, (x) => NE.abrirConferencia(x, { aoFiltrar, podeEnviar: true })))
          : [el("p", { class: "vazio" }, situacao === "divergencia" ? "Nenhuma diferença neste dia." : "Nenhuma conferência neste dia.")]));
      }
      function carregar() {
        desenharNav();
        NE.carregarRapido(`conf-${dia}-todas`, () => NE.dados.conferencias({ dia }), (d) => { todas = d; desenhar(); },
          (e) => { lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); });
      }
      desenharChips();
      carregar();
    },

    funcionarios(raiz, abrirCadastro) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      raiz.replaceChildren(cabecalhoAba("Funcionários", "Quem pode entrar no app.", "Cadastrar funcionário", () => abrirCadastro("funcionario")), lista);
      NE.carregarRapido("funcionarios", () => NE.dados.funcionarios(), (pessoas) => {
        lista.replaceChildren(...(pessoas.length ? pessoas.map((p) => el("div", {},
          el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, `${NE.funcoes[p.funcao] || p.funcao} · usuário: ${p.usuario || "—"}${p.papel === "admin" ? " · painel completo" : ""}`)),
          NE.chave(p.ativo, "Pode entrar", (v) => NE.dados.alterarFuncionario(p.id, { ativo: v }))))
          : [vazio("Nenhum funcionário ainda.")]));
      }, (e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    },

    caminhoes(raiz, abrirCadastro) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      raiz.replaceChildren(cabecalhoAba("Caminhões", "Aparecem na hora de escolher o caminhão.", "Cadastrar caminhão", () => abrirCadastro("caminhao")), lista);
      NE.carregarRapido("veiculos-todos", () => NE.dados.veiculos(true), (vs) => {
        lista.replaceChildren(...(vs.length ? vs.map((v) => el("div", {},
          el("div", {}, el("span", { class: "placa-br" }, v.placa), el("div", { class: "meta" }, `${NE.tiposVeiculo[v.tipo] || v.tipo}${v.descricao ? " · " + v.descricao : ""}`)),
          NE.chave(v.ativo, "Em uso", (x) => NE.dados.alterarVeiculo(v.id, { ativo: x }))))
          : [vazio("Nenhum caminhão ainda.")]));
      }, (e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    },

    produtos(raiz, abrirCadastro) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      raiz.replaceChildren(cabecalhoAba("Produtos", "Use o mesmo nome que aparece na nota.", "Cadastrar produto", () => abrirCadastro("produto")), lista);
      NE.carregarRapido("produtos-todos", () => NE.dados.produtos(true), (ps) => {
        lista.replaceChildren(...(ps.length ? ps.map((p) => el("div", {},
          el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, NE.unidades[p.unidade] || p.unidade)),
          NE.chave(p.ativo, "Aparece na conferência", (x) => NE.dados.alterarProduto(p.id, { ativo: x }))))
          : [vazio("Nenhum produto ainda.")]));
      }, (e) => NE.aviso(NE.mensagemErro(e), "erro", lista));
    },
  };

  function cabecalhoAba(titulo, dica, rotulo, acao) {
    return el("div", { class: "cabecalho-aba" },
      el("div", {}, el("h2", {}, titulo), el("p", {}, dica)),
      el("button", { type: "button", class: "btn btn-azul", onclick: acao }, ic("mais"), rotulo));
  }
  const vazio = (t) => el("p", { class: "vazio", style: "flex:1" }, t);
})();
