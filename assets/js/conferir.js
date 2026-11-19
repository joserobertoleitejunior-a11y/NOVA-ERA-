// Conferência passo a passo (tela do conferente). Uma decisão por tela, texto grande, botão principal embaixo.
(() => {
  const NE = window.NE;
  const { el, ic, $ } = NE;

  const PASSOS = [
    { id: "caminhao", titulo: "Caminhão", icone: "caminhao", ajuda: "Toque no caminhão que vai sair." },
    { id: "nota", titulo: "Nota fiscal", icone: "nota", ajuda: "Digite o número e tire a foto da nota." },
    { id: "itens", titulo: "Itens da nota", icone: "caixas", ajuda: "Marque o que está escrito na nota e a quantidade." },
    { id: "conferir", titulo: "Conferir a carga", icone: "conferir", ajuda: "Olhe o caminhão. Cada item confere com a nota?" },
    { id: "fotos", titulo: "Fotos", icone: "camera", ajuda: "Tire as fotos que comprovam a saída." },
    { id: "revisar", titulo: "Revisar e registrar", icone: "check", ajuda: "Confira o resumo antes de registrar." },
  ];
  const MOTIVOS = ["Nota vai ser corrigida", "Peça extra autorizada pelo responsável", "Peça faltando no estoque", "Outro motivo"];

  let estado, passo, perfil, catalogo, aoTerminar;

  function novoEstado() {
    return { veiculo: null, placa: "", motorista: "", numero_nota: "", itens: [], fotos: { nota: [], carga: [], placa: [], avaria: [] }, motivo: "", observacao: "" };
  }

  NE.iniciarConferencia = async (perfilAtual, raiz, voltarInicio) => {
    perfil = perfilAtual; aoTerminar = voltarInicio;
    estado = novoEstado(); passo = 0;
    raiz.replaceChildren(el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    try {
      const [veiculos, produtos] = await Promise.all([NE.dados.veiculos(), NE.dados.produtos()]);
      catalogo = { veiculos, produtos };
    } catch (e) { NE.aviso(NE.mensagemErro(e)); catalogo = { veiculos: [], produtos: [] }; }
    desenhar(raiz);
  };

  // ── Desenho geral ─────────────────────────────────────
  function desenhar(raiz) {
    const p = PASSOS[passo];
    const avisoBox = el("div", { id: "aviso-passo" });
    const barra = el("div", { class: "passos-barra", style: `--total:${PASSOS.length}` },
      PASSOS.map((_, i) => el("i", { class: i < passo ? "feito" : i === passo ? "atual" : "" })));
    const tela = el("section", { class: "tela", "aria-labelledby": "titulo-passo" },
      el("div", { class: "passos" },
        el("div", { class: "passos-rotulo" }, el("span", {}, `Passo ${passo + 1} de ${PASSOS.length}`), el("span", {}, p.titulo)), barra),
      el("div", { class: "tela-titulo" },
        el("div", { class: "icone-grande", html: NE.icone[p.icone] }),
        el("div", {}, el("h1", { id: "titulo-passo" }, p.titulo), el("p", {}, p.ajuda))),
      avisoBox,
      TELAS[p.id](() => desenhar(raiz)));
    tela.addEventListener("click", (e) => { if (e.target.closest("button, label") && !e.target.closest("#aviso-passo")) avisoBox.replaceChildren(); });
    tela.addEventListener("input", () => avisoBox.replaceChildren());

    const ultimo = passo === PASSOS.length - 1;
    const btnSeguir = el("button", { class: "btn btn-principal", type: "button", id: "btn-seguir" },
      ultimo ? "Registrar conferência" : "Continuar", ic(ultimo ? "check" : "seguir"));
    btnSeguir.addEventListener("click", () => {
      const erro = VALIDAR[p.id]();
      if (erro) { NE.aviso(erro, "erro", avisoBox); avisoBox.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (ultimo) return registrar(btnSeguir, raiz);
      passo++; desenhar(raiz); window.scrollTo({ top: 0 });
    });
    const btnVoltar = el("button", { class: "btn btn-secundario", type: "button", "aria-label": passo === 0 ? "Cancelar conferência" : "Voltar" },
      ic(passo === 0 ? "fechar" : "voltar"));
    btnVoltar.addEventListener("click", () => {
      if (passo === 0) return aoTerminar();
      passo--; desenhar(raiz); window.scrollTo({ top: 0 });
    });
    raiz.replaceChildren(tela, el("div", { class: "acoes" }, el("div", { class: "acoes-dentro" }, btnVoltar, btnSeguir)));
  }

  // ── Telas ─────────────────────────────────────────────
  const TELAS = {
    caminhao(redesenhar) {
      const grade = el("div", { class: "grade-escolha", role: "group", "aria-label": "Caminhões" },
        catalogo.veiculos.map((v) => {
          const b = el("button", { type: "button", class: "escolha", "aria-pressed": String(estado.veiculo?.id === v.id) },
            el("strong", {}, el("span", { class: "placa-br" }, v.placa)), el("span", {}, NE.tiposVeiculo[v.tipo] || v.tipo));
          b.addEventListener("click", () => { estado.veiculo = v; estado.placa = v.placa; redesenhar(); });
          return b;
        }));
      const outra = el("input", { class: "entrada entrada-grande", id: "placa-outra", maxlength: "8", placeholder: "ABC1D23", autocomplete: "off",
        value: estado.veiculo ? "" : estado.placa });
      outra.addEventListener("input", () => {
        estado.veiculo = null; estado.placa = outra.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        document.querySelectorAll(".escolha[aria-pressed='true']").forEach((x) => x.setAttribute("aria-pressed", "false"));
      });
      const motorista = el("input", { class: "entrada", id: "motorista", placeholder: "Nome do motorista (opcional)", value: estado.motorista });
      motorista.addEventListener("input", () => { estado.motorista = motorista.value; });
      return el("div", {},
        catalogo.veiculos.length ? grade : el("p", { class: "vazio" }, "Nenhum caminhão cadastrado. Digite a placa abaixo."),
        el("div", { class: "campo", style: "margin-top:18px" }, el("label", { for: "placa-outra" }, "Não está na lista? Digite a placa"), outra),
        el("div", { class: "campo" }, el("label", { for: "motorista" }, "Motorista"), motorista));
    },

    nota(redesenhar) {
      const num = el("input", { class: "entrada entrada-grande", id: "numero-nota", inputmode: "numeric", placeholder: "Ex.: 48213", value: estado.numero_nota, autocomplete: "off" });
      num.addEventListener("input", () => { estado.numero_nota = num.value.trim(); });
      return el("div", {},
        el("div", { class: "campo" }, el("label", { for: "numero-nota" }, "Número da nota"),
          el("span", { class: "dica" }, "Está no alto da nota, ao lado de \"Nº\"."), num),
        blocoFoto("nota", "Foto da nota fiscal", "Obrigatória", "Enquadre a nota inteira, sem sombra.", false, redesenhar));
    },

    itens(redesenhar) {
      const lista = el("div", {});
      const desenharLista = () => {
        lista.replaceChildren(...(estado.itens.length
          ? estado.itens.map((it, i) => el("div", { class: "item" },
            el("div", { class: "item-topo" }, el("strong", {}, it.descricao),
              el("button", { type: "button", class: "btn btn-leve", "aria-label": `Remover ${it.descricao}`, onclick: () => { estado.itens.splice(i, 1); redesenhar(); } }, ic("fechar"))),
            el("div", { class: "rotulo" }, "Quantidade na nota"),
            contador(it.qtd_nota, (v) => { it.qtd_nota = v; it.situacao = null; }, `qtd-${i}`)))
          : [el("p", { class: "vazio" }, "Nenhum item ainda. Toque nos produtos abaixo para adicionar.")]));
      };
      desenharLista();
      const jaTem = new Set(estado.itens.map((i) => i.descricao));
      const grade = el("div", { class: "grade-escolha" },
        catalogo.produtos.filter((p) => !jaTem.has(p.nome)).map((p) => {
          const b = el("button", { type: "button", class: "escolha" }, el("strong", {}, p.nome), el("span", {}, "Toque para adicionar"));
          b.addEventListener("click", () => { estado.itens.push({ produto_id: p.id, descricao: p.nome, qtd_nota: 1, situacao: null, qtd_carregada: 1 }); redesenhar(); });
          return b;
        }));
      const outro = el("input", { class: "entrada", id: "produto-outro", placeholder: "Outro produto (escreva o nome)" });
      const add = el("button", { type: "button", class: "btn btn-azul", "aria-label": "Adicionar produto" }, ic("mais"));
      add.addEventListener("click", () => {
        const nome = outro.value.trim();
        if (!nome) return outro.focus();
        estado.itens.push({ produto_id: null, descricao: nome, qtd_nota: 1, situacao: null, qtd_carregada: 1 }); redesenhar();
      });
      return el("div", {}, lista,
        el("h2", { class: "secao-titulo" }, "Adicionar produto"), grade,
        el("div", { class: "campo", style: "margin-top:12px" }, el("div", { style: "display:flex;gap:8px" }, outro, add)));
    },

    conferir(redesenhar) {
      return el("div", {}, estado.itens.map((it, i) => {
        const dif = it.situacao === "diferente" ? Number(it.qtd_carregada) - Number(it.qtd_nota) : 0;
        const bConf = el("button", { type: "button", class: "opcao confere", "aria-pressed": String(it.situacao === "confere") }, ic("check"), "Confere");
        const bDif = el("button", { type: "button", class: "opcao diferente", "aria-pressed": String(it.situacao === "diferente") }, ic("alerta"), "Diferente");
        bConf.addEventListener("click", () => { it.situacao = "confere"; it.qtd_carregada = it.qtd_nota; redesenhar(); });
        bDif.addEventListener("click", () => { it.situacao = "diferente"; redesenhar(); });
        return el("div", { class: "item" },
          el("div", { class: "item-topo" }, el("strong", {}, it.descricao), el("span", { class: "item-qtd" }, "Na nota: ", el("b", {}, NE.num(it.qtd_nota)))),
          el("div", { class: "par-botoes" }, bConf, bDif),
          it.situacao === "diferente" && el("div", {},
            el("div", { class: "rotulo", style: "margin-bottom:6px" }, "Quantos subiram no caminhão?"),
            contador(it.qtd_carregada, (v) => {
              it.qtd_carregada = v;
              const s = document.getElementById(`dif-${i}`); const d = v - Number(it.qtd_nota);
              if (s) s.textContent = textoDiferenca(d);
            }, `carregada-${i}`),
            el("p", { class: "diferenca", id: `dif-${i}`, "aria-live": "polite" }, textoDiferenca(dif))));
      }));
    },

    fotos(redesenhar) {
      return el("div", {},
        blocoFoto("carga", "Caminhão carregado", "Obrigatória", "Pegue a carga inteira, de lado ou de trás.", true, redesenhar),
        blocoFoto("placa", "Placa do caminhão", "Obrigatória", "A placa precisa dar para ler.", false, redesenhar),
        blocoFoto("avaria", "Avarias", "Opcional", "Só se tiver peça trincada, quebrada ou dano no caminhão.", true, redesenhar));
    },

    revisar() {
      const difs = estado.itens.filter((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota));
      const motivo = el("textarea", { class: "entrada", id: "motivo", placeholder: "Explique o que aconteceu" }, estado.motivo);
      motivo.addEventListener("input", () => { estado.motivo = motivo.value; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.textContent === motivo.value))); });
      const chips = el("div", { class: "chips" }, MOTIVOS.map((m) => {
        const c = el("button", { type: "button", class: "chip", "aria-pressed": String(estado.motivo === m) }, m);
        c.addEventListener("click", () => {
          estado.motivo = m === "Outro motivo" ? "" : m; motivo.value = estado.motivo;
          chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
          if (m === "Outro motivo") motivo.focus();
        });
        return c;
      }));
      const obs = el("textarea", { class: "entrada", id: "observacao", placeholder: "Alguma observação? (opcional)" }, estado.observacao);
      obs.addEventListener("input", () => { estado.observacao = obs.value; });
      const totalFotos = Object.values(estado.fotos).reduce((n, l) => n + l.length, 0);
      return el("div", {},
        difs.length
          ? el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, `Diferença em ${difs.length} ${difs.length > 1 ? "itens" : "item"}: `,
            difs.map((d) => `${d.descricao} (${textoDiferenca(Number(d.qtd_carregada) - Number(d.qtd_nota)).toLowerCase()})`).join("; ")))
          : el("div", { class: "aviso ok" }, ic("check"), el("span", {}, "Tudo confere com a nota.")),
        el("div", { class: "resumo" },
          linhaResumo("Caminhão", estado.placa), linhaResumo("Motorista", estado.motorista || "—"),
          linhaResumo("Nota", estado.numero_nota), linhaResumo("Itens", String(estado.itens.length)), linhaResumo("Fotos", String(totalFotos))),
        el("div", { class: "tabela-wrap resumo" }, el("table", {},
          el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Nota"), el("th", { class: "num" }, "Subiu"))),
          el("tbody", {}, estado.itens.map((i) => el("tr", { class: Number(i.qtd_carregada) !== Number(i.qtd_nota) ? "dif" : "" },
            el("td", {}, i.descricao), el("td", { class: "num" }, NE.num(i.qtd_nota)), el("td", { class: "num" }, NE.num(i.qtd_carregada))))))),
        difs.length > 0 && el("div", { class: "campo" }, el("label", { for: "motivo" }, "Por que tem diferença?"), chips, motivo),
        el("div", { class: "campo" }, el("label", { for: "observacao" }, "Observação"), obs));
    },
  };

  const VALIDAR = {
    caminhao: () => (estado.placa.length < 7 ? "Escolha o caminhão ou digite a placa completa." : null),
    nota: () => (!estado.numero_nota ? "Digite o número da nota." : !estado.fotos.nota.length ? "Tire a foto da nota fiscal." : null),
    itens: () => (!estado.itens.length ? "Adicione pelo menos um produto da nota."
      : estado.itens.some((i) => !(Number(i.qtd_nota) > 0)) ? "Toda quantidade da nota precisa ser maior que zero." : null),
    conferir: () => {
      const falta = estado.itens.find((i) => !i.situacao);
      return falta ? `Falta conferir: ${falta.descricao}. Toque em "Confere" ou "Diferente".` : null;
    },
    fotos: () => (!estado.fotos.carga.length ? "Tire a foto do caminhão carregado." : !estado.fotos.placa.length ? "Tire a foto da placa." : null),
    revisar: () => {
      const temDif = estado.itens.some((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota));
      return temDif && !estado.motivo.trim() ? "Explique o motivo da diferença." : null;
    },
  };

  // ── Peças reutilizáveis ───────────────────────────────
  function contador(valor, aoMudar, idCampo) {
    const inp = el("input", { type: "number", inputmode: "numeric", min: "0", id: idCampo, value: String(valor), "aria-label": "Quantidade" });
    const mudar = (v) => { const n = Math.max(0, Math.round(Number(v) || 0)); inp.value = String(n); aoMudar(n); };
    inp.addEventListener("change", () => mudar(inp.value));
    return el("div", { class: "contador" },
      el("button", { type: "button", "aria-label": "Diminuir", html: NE.icone.menos, onclick: () => mudar(Number(inp.value) - 1) }),
      inp,
      el("button", { type: "button", "aria-label": "Aumentar", html: NE.icone.mais, onclick: () => mudar(Number(inp.value) + 1) }));
  }

  function blocoFoto(tipo, titulo, exigencia, dica, varias, redesenhar) {
    const lista = estado.fotos[tipo];
    const input = el("input", { type: "file", accept: "image/*", capture: "environment", multiple: varias || false, "aria-label": `Tirar foto: ${titulo}` });
    input.addEventListener("change", async () => {
      for (const arq of input.files) {
        const blob = await NE.reduzirFoto(arq);
        if (!varias) lista.splice(0).forEach((f) => URL.revokeObjectURL(f.url));
        lista.push({ blob, url: URL.createObjectURL(blob) });
      }
      redesenhar();
    });
    const feita = lista.length > 0;
    const obrig = exigencia === "Obrigatória";
    return el("div", { class: `foto-bloco${feita ? " feita" : ""}` },
      el("div", { class: "foto-bloco-topo" }, el("strong", {}, titulo),
        el("span", { class: `etiqueta ${feita ? "ok" : obrig ? "obrigatoria" : ""}` }, feita ? `${lista.length} foto${lista.length > 1 ? "s" : ""}` : exigencia)),
      el("span", { class: "dica" }, dica),
      feita && el("div", { class: "miniaturas" }, lista.map((f, i) => el("figure", {},
        el("img", { src: f.url, alt: `${titulo} ${i + 1}` }),
        el("button", { type: "button", class: "remover", "aria-label": "Apagar esta foto", html: NE.icone.fechar,
          onclick: () => { URL.revokeObjectURL(f.url); lista.splice(i, 1); redesenhar(); } })))),
      el("label", { class: `btn ${feita ? "btn-secundario" : obrig ? "btn-azul" : "btn-secundario"} btn-bloco botao-camera` },
        ic("camera"), feita ? (varias ? "Tirar mais uma" : "Tirar de novo") : "Tirar foto", input));
  }

  const linhaResumo = (k, v) => el("div", { class: "resumo-linha" }, el("span", {}, k), el("strong", {}, v));
  function textoDiferenca(d) {
    if (d === 0) return "Igual à nota";
    return d > 0 ? `${d} a mais que a nota` : `${-d} a menos que a nota`;
  }

  // ── Registro ──────────────────────────────────────────
  async function registrar(btn, raiz) {
    await NE.comCarregando(btn, async () => {
      const pos = await NE.posicao();
      const fotos = [];
      for (const [tipo, lista] of Object.entries(estado.fotos)) {
        for (const f of lista) fotos.push({ tipo, caminho: await NE.dados.enviarFoto(f.blob, perfil.id) });
      }
      await NE.dados.registrarConferencia({
        numero_nota: estado.numero_nota, veiculo_id: estado.veiculo?.id || "", placa: estado.placa, motorista: estado.motorista,
        motivo_divergencia: estado.motivo, observacao: estado.observacao, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null,
        itens: estado.itens.map((i) => ({ produto_id: i.produto_id || "", descricao: i.descricao, qtd_nota: Number(i.qtd_nota), qtd_carregada: Number(i.qtd_carregada) })),
        fotos,
      });
      const temDif = estado.itens.some((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota));
      telaFim(raiz, temDif);
    });
  }

  function telaFim(raiz, temDif) {
    Object.values(estado.fotos).flat().forEach((f) => URL.revokeObjectURL(f.url));
    const nova = el("button", { class: "btn btn-principal btn-bloco btn-gigante", type: "button" }, ic("mais"), "Nova conferência");
    const inicio = el("button", { class: "btn btn-secundario btn-bloco", type: "button", style: "margin-top:10px" }, "Voltar ao início");
    nova.addEventListener("click", () => NE.iniciarConferencia(perfil, raiz, aoTerminar));
    inicio.addEventListener("click", () => aoTerminar());
    raiz.replaceChildren(el("section", { class: "tela fim" },
      el("div", { class: `selo ${temDif ? "alerta" : "ok"}`, html: NE.icone[temDif ? "alerta" : "check"] }),
      el("h1", {}, temDif ? "Registrada com diferença" : "Carga conferida"),
      el("p", {}, temDif
        ? `Nota ${estado.numero_nota} · ${estado.placa}. A diferença e o motivo ficaram registrados para a expedição.`
        : `Nota ${estado.numero_nota} · ${estado.placa}. Tudo confere. O caminhão pode sair.`),
      nova, inicio));
    window.scrollTo({ top: 0 });
  }
})();
