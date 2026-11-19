// Painel da expedição/diretoria: conferências do dia, detalhe com fotos, cadastros.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  // Detalhe de uma conferência (usado no painel e na lista do conferente)
  NE.renderDetalhe = (c) => {
    const div = c.status === "divergencia";
    const galeria = el("div", { class: "miniaturas" });
    const nomes = { nota: "Nota fiscal", placa: "Placa", carga: "Carga", avaria: "Avaria" };
    const ordem = { nota: 0, placa: 1, carga: 2, avaria: 3 };
    [...(c.fotos || [])].sort((a, b) => ordem[a.tipo] - ordem[b.tipo]).forEach(async (f) => {
      const fig = el("figure", {}, el("div", { class: "esqueleto", style: "height:auto;aspect-ratio:1" }), el("figcaption", {}, nomes[f.tipo] || f.tipo));
      galeria.append(fig);
      const url = await NE.dados.urlFoto(f.caminho);
      if (url) fig.firstChild.replaceWith(el("a", { href: url, target: "_blank", rel: "noopener" }, el("img", { src: url, alt: `Foto: ${nomes[f.tipo] || f.tipo}`, loading: "lazy" })));
    });
    const mapa = c.latitude != null
      ? el("a", { href: `https://www.google.com/maps?q=${c.latitude},${c.longitude}`, target: "_blank", rel: "noopener", class: "btn btn-leve" }, ic("local"), "Ver local do registro")
      : null;
    return el("div", {},
      el("span", { class: `etiqueta ${div ? "alerta" : "ok"}` }, div ? "Com diferença" : "Confere"),
      el("h2", { style: "margin-top:8px" }, `Nota ${c.numero_nota}`),
      el("p", { style: "margin:0;color:var(--texto-suave)" }, `${NE.dataHora(c.criado_em)} · conferido por ${c.conferente?.nome || "—"}`),
      el("div", { class: "resumo", style: "margin-top:14px" },
        el("div", { class: "resumo-linha" }, el("span", {}, "Caminhão"), el("strong", {}, el("span", { class: "placa-br" }, c.placa))),
        el("div", { class: "resumo-linha" }, el("span", {}, "Motorista"), el("strong", {}, c.motorista || "—"))),
      el("h3", {}, "Itens"),
      el("div", { class: "tabela-wrap" }, el("table", {},
        el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Nota"), el("th", { class: "num" }, "Subiu"), el("th", { class: "num" }, "Dif."))),
        el("tbody", {}, (c.itens || []).map((i) => {
          const d = Number(i.qtd_carregada) - Number(i.qtd_nota);
          return el("tr", { class: d ? "dif" : "" }, el("td", {}, i.descricao), el("td", { class: "num" }, NE.num(i.qtd_nota)),
            el("td", { class: "num" }, NE.num(i.qtd_carregada)), el("td", { class: "num" }, d ? (d > 0 ? `+${d}` : String(d)) : "—"));
        })))),
      c.motivo_divergencia && el("div", {}, el("h3", {}, "Motivo da diferença"), el("p", { style: "margin:0" }, c.motivo_divergencia)),
      c.observacao && el("div", {}, el("h3", {}, "Observação"), el("p", { style: "margin:0" }, c.observacao)),
      el("h3", {}, "Fotos"), galeria, mapa,
      el("p", { style: "font-size:.85rem;color:var(--texto-suave);margin-top:16px" }, "Registro protegido: não pode ser alterado nem apagado."));
  };

  NE.cartaoConferencia = (c, aoAbrir) => {
    const b = el("button", { type: "button", class: `conf${c.status === "divergencia" ? " divergencia" : ""}` },
      el("strong", {}, `Nota ${c.numero_nota} · `, el("span", { class: "placa-br" }, c.placa)),
      el("span", { class: "hora" }, NE.hora(c.criado_em)),
      el("span", { class: "meta" }, c.status === "divergencia" ? "Com diferença" : "Confere", " · ", c.conferente?.nome || ""),
      el("span", { class: "meta", style: "text-align:right" }, `${(c.itens || []).length} ${(c.itens || []).length === 1 ? "item" : "itens"}`));
    b.addEventListener("click", () => aoAbrir(c));
    return b;
  };

  // ── Painel ────────────────────────────────────────────
  NE.iniciarPainel = (perfil, raiz, abrirConferencia) => {
    const abas = [["hoje", "Conferências"], ["funcionarios", "Funcionários"], ["caminhoes", "Caminhões"], ["produtos", "Produtos"]];
    let atual = "hoje";
    const conteudo = el("div", {});
    const barra = el("div", { class: "abas", role: "tablist" });
    const trocar = (id) => {
      atual = id;
      barra.querySelectorAll(".aba").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
      ABAS[id](conteudo, perfil);
    };
    abas.forEach(([id, nome]) => barra.append(el("button", { class: "aba", role: "tab", "data-id": id, "aria-selected": String(id === atual), onclick: () => trocar(id) }, nome)));
    const nova = el("button", { class: "btn btn-principal", type: "button" }, ic("mais"), "Nova conferência");
    nova.addEventListener("click", abrirConferencia);
    raiz.replaceChildren(
      el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px" },
        el("h1", { style: "font-size:2rem;text-transform:uppercase;font-weight:800" }, "Expedição"), nova),
      barra, conteudo);
    trocar(atual);
  };

  const ABAS = {
    async hoje(raiz, perfil) {
      const data = el("input", { type: "date", class: "entrada", id: "filtro-dia", value: NE.hojeISO(), "aria-label": "Dia" });
      let filtro = "todas";
      const fBtns = [["todas", "Todas"], ["divergencia", "Com diferença"], ["ok", "Confere"]].map(([id, nome]) => {
        const b = el("button", { type: "button", class: "chip", "aria-pressed": String(id === filtro) }, nome);
        b.addEventListener("click", () => { filtro = id; fBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); desenhar(); });
        return b;
      });
      const numeros = el("div", { class: "numeros" });
      const lista = el("div", {}, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
      const detalhe = el("aside", { class: "detalhe" }, el("p", { class: "vazio", style: "border:0" }, "Toque numa conferência para ver os itens e as fotos."));
      raiz.replaceChildren(numeros, el("div", { class: "filtros" }, data, el("div", { class: "chips", style: "margin:0" }, fBtns)),
        el("div", { class: "colunas" }, lista, detalhe));
      let todas = [];
      const abrir = (c) => {
        detalhe.replaceChildren(NE.renderDetalhe(c));
        if (window.matchMedia("(max-width: 860px)").matches) detalhe.scrollIntoView({ behavior: "smooth" });
      };
      const desenhar = () => {
        const div = todas.filter((c) => c.status === "divergencia").length;
        numeros.replaceChildren(
          el("div", { class: "numero" }, el("b", {}, String(todas.length)), el("span", {}, "conferências")),
          el("div", { class: "numero ok" }, el("b", {}, String(todas.length - div)), el("span", {}, "conferem")),
          el("div", { class: "numero alerta" }, el("b", {}, String(div)), el("span", {}, "com diferença")));
        const vis = todas.filter((c) => filtro === "todas" || c.status === filtro);
        lista.replaceChildren(...(vis.length ? vis.map((c) => NE.cartaoConferencia(c, abrir)) : [el("p", { class: "vazio" }, "Nenhuma conferência neste dia.")]));
      };
      const carregar = async () => {
        try { todas = await NE.dados.conferencias({ dia: data.value }); desenhar(); if (todas[0]) abrir(todas.find((c) => c.status === "divergencia") || todas[0]); }
        catch (e) { lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); }
      };
      data.addEventListener("change", carregar);
      carregar();
    },

    async funcionarios(raiz) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      const f = {
        nome: el("input", { class: "entrada", id: "f-nome", required: true, autocomplete: "off" }),
        usuario: el("input", { class: "entrada", id: "f-usuario", required: true, autocomplete: "off", placeholder: "ex.: carlos" }),
        senha: el("input", { class: "entrada", id: "f-senha", required: true, minlength: "6", type: "text", autocomplete: "new-password" }),
        funcao: el("select", { class: "entrada", id: "f-funcao" }, Object.entries(NE.funcoes).map(([v, n]) => el("option", { value: v }, n))),
        papel: el("select", { class: "entrada", id: "f-papel" }, el("option", { value: "funcionario" }, "Só faz conferência"), el("option", { value: "admin" }, "Vê o painel (admin)")),
      };
      const btn = el("button", { class: "btn btn-principal", type: "submit" }, ic("mais"), "Cadastrar");
      const form = el("form", { class: "cartao" },
        el("h2", { style: "font-size:1.4rem;text-transform:uppercase;margin-bottom:12px" }, "Cadastrar funcionário"),
        el("div", { class: "form-linha" },
          campo("Nome", f.nome), campo("Usuário (para entrar)", f.usuario), campo("Senha (mín. 6)", f.senha),
          campo("Função", f.funcao), campo("Acesso", f.papel), btn));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        NE.comCarregando(btn, async () => {
          const usuario = f.usuario.value.trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error("Usuário: use de 3 a 30 letras ou números, sem espaço e sem acento.");
          if (f.senha.value.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
          await NE.dados.criarFuncionario({ nome: f.nome.value.trim(), usuario, senha: f.senha.value, funcao: f.funcao.value, papel: f.papel.value });
          NE.aviso(`${f.nome.value.trim()} cadastrado. Entra com o usuário "${usuario}".`, "ok");
          form.reset(); carregar();
        });
      });
      raiz.replaceChildren(form, lista);
      const carregar = async () => {
        try {
          const pessoas = await NE.dados.funcionarios();
          lista.replaceChildren(...pessoas.map((p) => el("div", {},
            el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, `${NE.funcoes[p.funcao] || p.funcao} · usuário: ${p.usuario || "—"}${p.papel === "admin" ? " · vê o painel" : ""}`)),
            interruptor(p.ativo, "Ativo", (v) => NE.dados.alterarFuncionario(p.id, { ativo: v })))));
        } catch (e) { NE.aviso(NE.mensagemErro(e), "erro", lista); }
      };
      carregar();
    },

    async caminhoes(raiz) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      const placa = el("input", { class: "entrada", id: "v-placa", required: true, maxlength: "8", placeholder: "ABC1D23", autocomplete: "off" });
      const tipo = el("select", { class: "entrada", id: "v-tipo" }, Object.entries(NE.tiposVeiculo).map(([v, n]) => el("option", { value: v }, n)));
      const desc = el("input", { class: "entrada", id: "v-desc", placeholder: "Ex.: VW 24.250 vermelho" });
      const btn = el("button", { class: "btn btn-principal", type: "submit" }, ic("mais"), "Cadastrar");
      const form = el("form", { class: "cartao" }, el("h2", { style: "font-size:1.4rem;text-transform:uppercase;margin-bottom:12px" }, "Cadastrar caminhão"),
        el("div", { class: "form-linha" }, campo("Placa", placa), campo("Tipo", tipo), campo("Descrição", desc), btn));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        NE.comCarregando(btn, async () => {
          const p = placa.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p)) throw new Error("Placa inválida. Use o formato ABC1D23 ou ABC1234.");
          await NE.dados.criarVeiculo({ placa: p, tipo: tipo.value, descricao: desc.value.trim() || null });
          NE.aviso(`Caminhão ${p} cadastrado.`, "ok"); form.reset(); carregar();
        });
      });
      raiz.replaceChildren(form, lista);
      const carregar = async () => {
        try {
          const vs = await NE.dados.veiculos(true);
          lista.replaceChildren(...vs.map((v) => el("div", {},
            el("div", {}, el("span", { class: "placa-br" }, v.placa), el("div", { class: "meta" }, `${NE.tiposVeiculo[v.tipo] || v.tipo}${v.descricao ? " · " + v.descricao : ""}`)),
            interruptor(v.ativo, "Em uso", (x) => NE.dados.alterarVeiculo(v.id, { ativo: x })))));
        } catch (e) { NE.aviso(NE.mensagemErro(e), "erro", lista); }
      };
      carregar();
    },

    async produtos(raiz) {
      const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
      const nome = el("input", { class: "entrada", id: "p-nome", required: true, placeholder: "Ex.: Caixa 1x1", autocomplete: "off" });
      const btn = el("button", { class: "btn btn-principal", type: "submit" }, ic("mais"), "Cadastrar");
      const form = el("form", { class: "cartao" }, el("h2", { style: "font-size:1.4rem;text-transform:uppercase;margin-bottom:6px" }, "Cadastrar produto"),
        el("p", { style: "margin:0 0 12px;color:var(--texto-suave)" }, "Use o mesmo nome que aparece na nota. Fica mais rápido para quem confere."),
        el("div", { class: "form-linha" }, campo("Nome do produto", nome), btn));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        NE.comCarregando(btn, async () => {
          if (!nome.value.trim()) throw new Error("Digite o nome do produto.");
          await NE.dados.criarProduto({ nome: nome.value.trim() });
          NE.aviso("Produto cadastrado.", "ok"); form.reset(); carregar();
        });
      });
      raiz.replaceChildren(form, lista);
      const carregar = async () => {
        try {
          const ps = await NE.dados.produtos(true);
          lista.replaceChildren(...ps.map((p) => el("div", {}, el("strong", {}, p.nome),
            interruptor(p.ativo, "Aparece na conferência", (x) => NE.dados.alterarProduto(p.id, { ativo: x })))));
        } catch (e) { NE.aviso(NE.mensagemErro(e), "erro", lista); }
      };
      carregar();
    },
  };

  function campo(rotulo, entrada) {
    return el("div", { class: "campo" }, el("label", { for: entrada.id }, rotulo), entrada);
  }
  function interruptor(ligado, rotulo, aoMudar) {
    const cb = el("input", { type: "checkbox", checked: !!ligado });
    cb.addEventListener("change", async () => {
      cb.disabled = true;
      try { await aoMudar(cb.checked); } catch (e) { cb.checked = !cb.checked; NE.aviso(NE.mensagemErro(e)); } finally { cb.disabled = false; }
    });
    return el("label", { class: "interruptor" }, cb, rotulo);
  }
})();
