// Dicas passo a passo com TREINO: cada exemplo é funcional (os botões respondem de verdade),
// para a pessoa praticar antes de usar no caminhão. Textos curtos e diretos.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  const certo = (caixa, texto) => caixa.replaceChildren(el("div", { class: "leitura ok" }, ic("check"), el("span", {}, texto)));

  // ── Treinos (exemplos funcionais) ────────────────────
  const treino = {
    comecar: (acoes) => el("button", { type: "button", class: "btn btn-principal btn-bloco btn-gigante", onclick: () => acoes.novaConferencia?.() }, ic("caminhao"), "Começar uma agora"),

    caminhao() {
      const fb = el("div", { "aria-live": "polite" });
      const grade = el("div", { class: "grade-escolha" });
      const cartoes = [["ABC1D23", "Caminhão"], ["RST8U45", "Truck com munck"]].map(([placa, tipo]) => {
        const b = el("button", { type: "button", class: "escolha", "aria-pressed": "false" }, el("strong", {}, el("span", { class: "placa-br" }, placa)), el("span", {}, tipo));
        b.addEventListener("click", () => { cartoes.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); certo(fb, `Isso! Caminhão ${placa} escolhido.`); });
        return b;
      });
      grade.append(...cartoes);
      return el("div", { class: "treino" }, grade, fb);
    },

    nota() {
      const fb = el("div", { "aria-live": "polite" });
      const ler = async (arquivo) => {
        fb.replaceChildren(el("div", { class: "leitura lendo" }, el("span", { class: "girando" }), "Lendo o número da nota…"));
        const r = await NE.nfe.lerDaFoto(arquivo);
        if (r) certo(fb, `Número ${r.numero} encontrado. É assim que funciona.`);
        else fb.replaceChildren(el("div", { class: "leitura falhou" }, ic("alerta"), el("span", {}, "Não achei o código de barras. Tente mais perto, sem sombra.")));
      };
      const entrada = (camera) => {
        const i = el("input", { type: "file", accept: "image/*", capture: camera ? "environment" : false, "aria-label": camera ? "Tirar foto da nota" : "Escolher foto da nota" });
        i.addEventListener("change", () => i.files?.[0] && ler(i.files[0]));
        return i;
      };
      return el("div", { class: "treino" },
        el("div", { class: "foto-acoes" },
          el("label", { class: "btn btn-azul botao-camera" }, ic("camera"), "Tirar foto", entrada(true)),
          el("label", { class: "btn btn-secundario botao-camera" }, ic("galeria"), "Galeria", entrada(false))),
        NE.modoTeste && el("button", { type: "button", class: "link-acao", onclick: async () => ler(await NE.nfe.gerarExemplo()) }, "Treinar com nota de teste"),
        fb);
    },

    itens() {
      const fb = el("div", { "aria-live": "polite" });
      const qtd = { "Meio-fio": 0, "Boca de lobo": 0 };
      const corpo = el("div", { class: "treino" });
      const desenhar = () => corpo.replaceChildren(
        ...Object.keys(qtd).map((nome) => el("div", { class: "item" },
          el("div", { class: "item-topo" }, el("strong", {}, nome), el("span", { class: "item-qtd" }, "Na nota: ", el("b", {}, String(qtd[nome])))),
          el("div", { class: "contador" },
            el("button", { type: "button", "aria-label": `Diminuir ${nome}`, html: NE.icone.menos, onclick: () => { qtd[nome] = Math.max(0, qtd[nome] - 1); desenhar(); } }),
            el("span", { class: "contador-valor" }, String(qtd[nome])),
            el("button", { type: "button", "aria-label": `Aumentar ${nome}`, html: NE.icone.mais, onclick: () => { qtd[nome]++; desenhar(); if (Object.values(qtd).every((v) => v > 0)) certo(fb, "Pronto! É só colocar o que está escrito na nota."); } })))),
        fb);
      desenhar();
      return corpo;
    },

    conferir() {
      const fb = el("div", { "aria-live": "polite" });
      let subiu = 10, escolha = null;
      const corpo = el("div", { class: "treino" });
      const desenhar = () => {
        const d = subiu - 10;
        corpo.replaceChildren(el("div", { class: "item" },
          el("div", { class: "item-topo" }, el("strong", {}, "Meio-fio"), el("span", { class: "item-qtd" }, "Na nota: ", el("b", {}, "10"))),
          el("div", { class: "par-botoes" },
            el("button", { type: "button", class: "opcao confere", "aria-pressed": String(escolha === "c"), onclick: () => { escolha = "c"; subiu = 10; desenhar(); certo(fb, "Confere: bateu com a nota."); } }, ic("check"), "Confere"),
            el("button", { type: "button", class: "opcao diferente", "aria-pressed": String(escolha === "d"), onclick: () => { escolha = "d"; desenhar(); } }, ic("alerta"), "Diferente")),
          escolha === "d" && el("div", { class: "contador" },
            el("button", { type: "button", "aria-label": "Diminuir", html: NE.icone.menos, onclick: () => { subiu = Math.max(0, subiu - 1); desenhar(); } }),
            el("span", { class: "contador-valor" }, String(subiu)),
            el("button", { type: "button", "aria-label": "Aumentar", html: NE.icone.mais, onclick: () => { subiu++; desenhar(); } })),
          escolha === "d" && el("p", { class: "diferenca" }, d === 0 ? "Igual à nota" : d > 0 ? `${d} a mais que a nota` : `${-d} a menos que a nota`)), fb);
      };
      desenhar();
      return corpo;
    },

    fotos() {
      const fb = el("div", { "aria-live": "polite" });
      const mini = el("div", { class: "miniaturas" });
      const i = el("input", { type: "file", accept: "image/*", capture: "environment", "aria-label": "Tirar foto da carga" });
      i.addEventListener("change", () => {
        const f = i.files?.[0]; if (!f) return;
        mini.replaceChildren(el("figure", {}, el("img", { src: URL.createObjectURL(f), alt: "Foto de treino" })));
        certo(fb, "Foto tirada! Na conferência, faça o mesmo com a carga e a placa.");
      });
      return el("div", { class: "treino" }, mini,
        el("label", { class: "btn btn-azul btn-bloco botao-camera" }, ic("camera"), "Tirar foto de treino", i), fb);
    },

    resumo() {
      const fb = el("div", { "aria-live": "polite" });
      let filtro = "todas";
      const corpo = el("div", { class: "treino" });
      const cargas = [["48213", "ABC1D23", "ok"], ["48207", "RST8U45", "divergencia"], ["48199", "FGH4I67", "ok"]];
      const desenhar = () => corpo.replaceChildren(
        el("div", { class: "chips" }, [["todas", "Todas"], ["divergencia", "Com diferença"]].map(([id, nome]) =>
          el("button", { type: "button", class: "chip", "aria-pressed": String(filtro === id), onclick: () => { filtro = id; desenhar(); if (id === "divergencia") certo(fb, "Isso! Só as cargas com diferença."); } }, nome))),
        ...cargas.filter((c) => filtro === "todas" || c[2] === filtro).map(([n, p, s]) =>
          el("div", { class: `conf${s === "divergencia" ? " divergencia" : ""}`, style: "cursor:default" }, el("strong", {}, `Nota ${n} · `, el("span", { class: "placa-br" }, p)),
            el("span", { class: "meta" }, s === "divergencia" ? "Com diferença" : "Confere"))),
        fb);
      desenhar();
      return corpo;
    },

    abrir: () => el("div", { class: "treino" },
      el("button", { type: "button", class: "btn btn-azul btn-bloco", onclick: () => NE.abrirConferencia(exemplo(), { podeEnviar: true }) }, ic("olho"), "Abrir uma conferência de exemplo")),

    etiquetasCliente: () => el("div", { class: "treino", style: "display:grid;gap:10px" },
      el("button", { type: "button", class: "btn btn-azul btn-bloco", onclick: () => NE.abrirEtiquetas(exemplo()) }, ic("etiqueta"), "Ver etiquetas de exemplo"),
      el("button", { type: "button", class: "btn btn-verde btn-bloco", onclick: () => NE.enviarRastreio(exemplo()) }, ic("whatsapp"), "Enviar ao cliente (exemplo)")),

    acesso() {
      const fb = el("div", { "aria-live": "polite" });
      return el("div", { class: "treino" }, el("div", { class: "lista-simples", style: "margin:0" },
        el("div", {}, el("div", {}, el("strong", {}, "Carlos (exemplo)"), el("div", { class: "meta" }, "Conferente")),
          NE.chave(true, "Pode entrar", async (v) => certo(fb, v ? "Acesso ligado: ele entra no app." : "Acesso desligado: ele não entra mais.")))), fb);
    },
  };

  function exemplo() {
    return {
      id: "exemplo-treino", token_publico: "00000000-0000-4000-8000-000000000000", numero_nota: "48213", placa: "ABC1D23", motorista: "Exemplo",
      criado_em: new Date().toISOString(), status: "divergencia", conferente: { nome: "Exemplo" }, conferente_id: "exemplo",
      motivo_divergencia: "Nota vai ser corrigida", latitude: null, longitude: null, fotos: [],
      itens: [{ descricao: "Meio-fio", qtd_nota: 40, qtd_carregada: 40 }, { descricao: "Caixa para galeria", qtd_nota: 6, qtd_carregada: 8 }],
    };
  }

  const GUIAS = {
    conferente: [
      { icone: "caminhao", titulo: "Antes de sair", texto: "Todo caminhão é conferido antes de sair. Leva 2 minutos.", treino: "comecar" },
      { icone: "caminhao", titulo: "1. Caminhão", texto: "Toque na placa. Experimente:", treino: "caminhao" },
      { icone: "nota", titulo: "2. Nota fiscal", texto: "Tire a foto da nota. O número aparece sozinho. Experimente:", treino: "nota" },
      { icone: "caixas", titulo: "3. Itens", texto: "Coloque a quantidade escrita na nota. Experimente:", treino: "itens" },
      { icone: "conferir", titulo: "4. Conferir", texto: "Bateu? Confere. Não bateu? Diferente. Experimente:", treino: "conferir" },
      { icone: "camera", titulo: "5. Fotos e registrar", texto: "Foto da carga e da placa. Depois, Registrar. Experimente:", treino: "fotos" },
    ],
    painel: [
      { icone: "lista", titulo: "Resumo do dia", texto: "Laranja é carga com diferença. Experimente o filtro:", treino: "resumo" },
      { icone: "olho", titulo: "Ver tudo", texto: "Toque numa conferência para ver itens, fotos e local.", treino: "abrir" },
      { icone: "etiqueta", titulo: "Etiquetas e cliente", texto: "Imprima etiquetas e mande o rastreio no WhatsApp.", treino: "etiquetasCliente" },
      { icone: "usuario", titulo: "Funcionários", texto: "Saiu da empresa? Desligue o acesso. Experimente:", treino: "acesso" },
    ],
  };

  NE.abrirGuia = (tipo, raiz, aoFechar, acoes = {}) => {
    const passos = GUIAS[tipo].map((g) => ({
      titulo: g.titulo, icone: g.icone, ajuda: null,
      tela: () => el("div", { class: "guia" }, el("p", { class: "guia-texto" }, g.texto), treino[g.treino](acoes)),
    }));
    NE.memoria.gravar(`ne-guia-${tipo}`, true);
    NE.assistente({ raiz, passos, rotuloPasso: "Dica", rotuloFinal: "Entendi", aoConcluir: async () => aoFechar(), aoCancelar: aoFechar });
  };
  NE.guiaJaVisto = (tipo) => !!NE.memoria.ler(`ne-guia-${tipo}`);
})();
