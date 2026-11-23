// Motor do passo a passo: toda operação do app usa as mesmas telas (barra de progresso,
// título com ícone, uma decisão por tela, botão principal embaixo, aviso claro do que falta).
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  /**
   * passos: [{ titulo, icone, ajuda, tela(redesenhar) => Node, validar?() => string|null }]
   * aoConcluir(btn): async — chamado no último passo (com carregamento e tratamento de erro)
   * aoCancelar(): volta para onde estava
   */
  NE.assistente = ({ raiz, passos, rotuloFinal = "Concluir", iconeFinal = "check", aoConcluir, aoCancelar, rotuloPasso = "Passo" }) => {
    let atual = 0;
    // Tocar numa opção redesenha o passo, mas a tela fica onde estava (não volta para o topo)
    const redesenhar = () => { const y = window.scrollY; desenhar(); window.scrollTo(0, y); };
    const desenhar = () => {
      const p = passos[atual];
      const avisoBox = el("div", { id: "aviso-passo" });
      const tela = el("section", { class: "tela", "aria-labelledby": "titulo-passo" },
        el("div", { class: "passos" },
          el("div", { class: "passos-rotulo" }, el("span", {}, `${rotuloPasso} ${atual + 1} de ${passos.length}`), el("span", {}, p.titulo)),
          el("div", { class: "passos-barra", style: `--total:${passos.length}` },
            passos.map((_, i) => el("i", { class: i < atual ? "feito" : i === atual ? "atual" : "" })))),
        el("div", { class: "tela-titulo" },
          el("div", { class: "icone-grande", html: NE.icone[p.icone] || NE.icone.check }),
          el("div", {}, el("h1", { id: "titulo-passo" }, p.titulo), p.ajuda && el("p", {}, p.ajuda))),
        avisoBox,
        p.tela(redesenhar));
      // Qualquer toque ou digitação apaga o aviso antigo
      tela.addEventListener("click", (e) => { if (e.target.closest("button, label") && !e.target.closest("#aviso-passo")) avisoBox.replaceChildren(); });
      tela.addEventListener("input", () => avisoBox.replaceChildren());

      const ultimo = atual === passos.length - 1;
      const seguir = el("button", { class: "btn btn-principal", type: "button", id: "btn-seguir" },
        ultimo ? rotuloFinal : "Continuar", ic(ultimo ? iconeFinal : "seguir"));
      seguir.addEventListener("click", () => {
        const erro = p.validar ? p.validar() : null;
        if (erro) { NE.aviso(erro, "erro", avisoBox); avisoBox.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        if (ultimo) return NE.comCarregando(seguir, () => aoConcluir(seguir));
        atual++; desenhar(); window.scrollTo({ top: 0 });
      });
      const voltar = el("button", { class: "btn btn-secundario", type: "button", id: "btn-voltar", "aria-label": atual === 0 ? "Cancelar" : "Voltar" },
        ic(atual === 0 ? "fechar" : "voltar"));
      voltar.addEventListener("click", () => {
        if (atual === 0) return aoCancelar();
        atual--; desenhar(); window.scrollTo({ top: 0 });
      });
      raiz.replaceChildren(tela, el("div", { class: "acoes" }, el("div", { class: "acoes-dentro" }, voltar, seguir)));
      const foco = tela.querySelector("input.entrada, textarea.entrada");
      if (foco && !foco.value && window.matchMedia("(min-width: 700px)").matches) foco.focus();
    };
    desenhar();
    window.scrollTo({ top: 0 });
  };

  // Tela final padrão (sucesso ou alerta) com botões de próxima ação
  NE.telaFim = (raiz, { tipo = "ok", titulo, texto, extra, botoes = [] }) => {
    raiz.replaceChildren(el("section", { class: "tela fim" },
      el("div", { class: `selo ${tipo}`, html: NE.icone[tipo === "ok" ? "check" : "alerta"] }),
      el("h1", {}, titulo), texto && el("p", {}, texto), extra,
      el("div", { style: "display:grid;gap:10px" }, botoes.map((b, i) =>
        el("button", { type: "button", class: `btn btn-bloco ${i === 0 ? "btn-principal btn-gigante" : "btn-secundario"}`, onclick: b.acao },
          b.icone && ic(b.icone), b.rotulo)))));
    window.scrollTo({ top: 0 });
  };

  // Cartões grandes de escolha única (função, tipo, unidade...)
  NE.escolhaUnica = (opcoes, valorAtual, aoEscolher) => el("div", { class: "grade-escolha", role: "radiogroup" },
    opcoes.map((o) => {
      const b = el("button", { type: "button", class: "escolha", role: "radio", "aria-checked": String(valorAtual === o.valor), "aria-pressed": String(valorAtual === o.valor) },
        el("strong", {}, o.rotulo), o.dica && el("span", {}, o.dica));
      b.addEventListener("click", () => aoEscolher(o.valor));
      return b;
    }));

  NE.campoTexto = (rotulo, attrs, aoMudar, dica) => {
    const inp = el("input", { class: "entrada", autocomplete: "off", ...attrs });
    inp.addEventListener("input", () => aoMudar(inp.value, inp));
    return el("div", { class: "campo" }, el("label", { for: attrs.id }, rotulo), dica && el("span", { class: "dica" }, dica), inp);
  };

  NE.linhaResumo = (k, v) => el("div", { class: "resumo-linha" }, el("span", {}, k), el("strong", {}, v));
})();
