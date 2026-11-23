// Conferência passo a passo (tela do conferente). Uma decisão por tela, texto grande, botão principal embaixo.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  const PASSOS = [
    { id: "caminhao", titulo: "Caminhão", icone: "caminhao", ajuda: "Toque no caminhão que vai sair." },
    { id: "nota", titulo: "Nota fiscal", icone: "nota", ajuda: "Tire a foto da nota. O número aparece sozinho." },
    { id: "itens", titulo: "Itens da nota", icone: "caixas", ajuda: "Marque o que está escrito na nota e a quantidade." },
    { id: "conferir", titulo: "Conferir a carga", icone: "conferir", ajuda: "Olhe o caminhão. Cada item confere com a nota?" },
    { id: "fotos", titulo: "Fotos", icone: "camera", ajuda: "Tire as fotos que comprovam a saída." },
    { id: "revisar", titulo: "Revisar e registrar", icone: "check", ajuda: "Confira o resumo antes de registrar." },
  ];
  const MOTIVOS = ["Nota vai ser corrigida", "Peça extra autorizada pelo responsável", "Peça faltando no estoque", "Outro motivo"];

  let estado, perfil, catalogo, aoTerminar, aberta = {};

  function novoEstado() {
    return { veiculo: null, placa: "", motorista: "", numero_nota: "", chave_nfe: "", leitura: null, itens: [], fotos: { nota: [], carga: [], placa: [], avaria: [] }, motivo: "", observacao: "",
      nota: null, cliente: "", inicio: Date.now(), client_id: (crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random()}`), metodo: "passo_a_passo" };
  }

  // opcoes.nota_id: conferir uma nota da fila (itens já vêm da nota: só falta olhar o caminhão)
  let iaOn = false;
  NE.iniciarConferencia = async (perfilAtual, raiz, voltarInicio, opcoes = {}) => {
    perfil = perfilAtual; aoTerminar = voltarInicio; aberta = opcoes;
    estado = novoEstado(); if (opcoes.preenchido) Object.assign(estado, opcoes.preenchido);   // ao ler o QR da nota no meio do caminho, o caminhão escolhido fica
    // Abre na hora com a lista guardada no aparelho; atualiza em segundo plano
    const cv = NE.dados.emCache("veiculos"), cp = NE.dados.emCache("produtos");
    if (cv && cp) {
      catalogo = { veiculos: cv, produtos: cp };
      NE.dados.veiculos().catch(() => {}); NE.dados.produtos().catch(() => {});
    } else {
      raiz.replaceChildren(el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
      try {
        const [veiculos, produtos] = await Promise.all([NE.dados.veiculos(), NE.dados.produtos()]);
        catalogo = { veiculos, produtos };
      } catch (e) { NE.aviso(NE.mensagemErro(e)); catalogo = { veiculos: [], produtos: [] }; }
    }
    iaOn = NE.iaLeitura ? await NE.iaLeitura().catch(() => false) : false;   // o botão de ler a nota por IA só existe se a IA estiver ligada
    if (opcoes.nota_id) {
      try {
        const nota = (await NE.dados.notas({ status: ["pendente", "em_conferencia"] })).find((n) => n.id === opcoes.nota_id);
        if (!nota) { NE.aviso("Essa nota não está mais na fila.", "alerta"); return voltarInicio(); }
        estado.nota = nota; estado.numero_nota = nota.numero; estado.cliente = nota.cliente || ""; estado.chave_nfe = nota.chave_nfe || "";
        estado.itens = (nota.itens || []).map((i) => ({ produto_id: i.produto_id || null, descricao: i.descricao, qtd_nota: Number(i.quantidade ?? i.qtd_nota), qtd_carregada: Number(i.quantidade ?? i.qtd_nota), situacao: null }));
      } catch (e) { NE.aviso(NE.mensagemErro(e)); return voltarInicio(); }
    }
    const lista = estado.nota ? PASSOS.filter((p) => !["nota", "itens"].includes(p.id)) : PASSOS;
    NE.assistente({
      raiz,
      passos: lista.map((p) => ({ ...p, tela: TELAS[p.id], validar: VALIDAR[p.id] })),
      rotuloFinal: "Registrar conferência",
      aoConcluir: () => registrar(raiz),
      aoCancelar: () => aoTerminar(),
    });
  };

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
      num.addEventListener("input", () => {
        estado.numero_nota = num.value.trim();
        // Digitou um número diferente do código de barras: a chave lida não vale mais
        if (estado.leitura?.status === "ok" && estado.numero_nota !== estado.leitura.numero) { estado.chave_nfe = ""; estado.leitura = null; status.replaceChildren(); }
      });
      const status = el("div", { id: "leitura-nota", "aria-live": "polite" }, statusLeitura());
      // QR da etiqueta da nota: acha a nota na fila e recomeça já com os itens dela (o caminhão escolhido continua)
      const lerQr = NE.pacote.tem("etiquetas") && NE.botaoLerQR({ titulo: "Ler a etiqueta da nota", aceita: ["peca", "nota"], digitar: "Número da nota", aoLer: async (obj) => {
        const n = NE.lerQR.acharNota(obj, await NE.dados.notas({ status: ["pendente", "em_conferencia"] })); if (!n) { NE.aviso("Essa nota não está na fila de conferência.", "alerta"); return false; }
        NE.iniciarConferencia(perfil, document.querySelector("#conteudo"), aoTerminar, { nota_id: n.id, preenchido: { veiculo: estado.veiculo, placa: estado.placa, motorista: estado.motorista } });
      } }, { rotulo: "Ler QR da etiqueta da nota", id: "btn-ler-qr-conferir", classe: "btn btn-azul btn-bloco" });
      const aoNovaFoto = async (arquivo) => {
        estado.leitura = { status: "lendo" };
        const r = await NE.nfe.lerDaFoto(arquivo);
        if (r) { estado.leitura = { status: "ok", ...r }; estado.numero_nota = r.numero; estado.chave_nfe = r.chave; }
        else estado.leitura = { status: "falhou" };
        if (document.getElementById("numero-nota")) redesenhar(); // só redesenha se ainda estiver neste passo
      };
      const ia = iaOn && el("button", { type: "button", class: "btn btn-azul btn-bloco", id: "btn-ia-nota", style: "margin-top:10px", onclick: (ev) => NE.comCarregando(ev.currentTarget, async () => {
        const f = estado.fotos.nota[0]; if (!f) return NE.aviso("Tire a foto da nota primeiro.", "alerta");
        const r = await NE.dados.iaLerNota(f.blob); const prods = catalogo.produtos;
        estado.numero_nota = r.numero || estado.numero_nota; estado.cliente = r.cliente || estado.cliente;
        estado.itens = (r.itens || []).map((i) => { const m = window.NEDominio.casarProduto({ descricao: i.descricao, codigo: i.codigo }, prods); const q = Number(i.quantidade) || 1; return { produto_id: m.produto ? m.produto.id : null, descricao: m.produto ? m.produto.nome : i.descricao, qtd_nota: q, qtd_carregada: q, situacao: null }; });
        NE.aviso(`Nota ${estado.numero_nota}: ${estado.itens.length} ${estado.itens.length === 1 ? "item lido" : "itens lidos"}. Confira no próximo passo.`, "ok"); redesenhar();
      }) }, ic("faisca"), "Ler a nota inteira com IA · Premium");
      return el("div", {},
        lerQr ? el("div", { style: "margin-bottom:14px" }, lerQr) : null,
        blocoFoto("nota", "Foto da nota fiscal", "Obrigatória", "Enquadre a nota inteira, com o código de barras aparecendo. O número é lido sozinho.", false, redesenhar, aoNovaFoto), ia,
        el("div", { class: "campo", style: "margin-top:16px" }, el("label", { for: "numero-nota" }, "Número da nota"),
          el("span", { class: "dica" }, "Preenchido pela foto. Se não der, digite: fica no alto da nota, ao lado de \"Nº\"."), num, status));
    },

    itens(redesenhar) {
      const lista = el("div", {});
      const desenharLista = () => {
        lista.replaceChildren(...(estado.itens.length
          ? estado.itens.map((it, i) => el("div", { class: "item" },
            el("div", { class: "item-topo" }, el("strong", {}, it.descricao),
              el("button", { type: "button", class: "link-acao", "aria-label": `Tirar ${it.descricao}`, onclick: () => { estado.itens.splice(i, 1); redesenhar(); } }, ic("fechar"), "Tirar")),
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
      const tudo = el("button", { type: "button", class: "btn btn-verde btn-bloco btn-gigante", id: "btn-tudo-confere" }, ic("check"), "Tudo confere");
      tudo.addEventListener("click", () => { estado.itens.forEach((it) => { it.situacao = "confere"; it.qtd_carregada = it.qtd_nota; }); redesenhar(); });
      const ler = estado.nota && NE.pacote.tem("etiquetas") && el("button", { type: "button", class: "btn btn-azul btn-bloco", id: "btn-ler-etiquetas", onclick: () => lerEtiquetas(redesenhar) }, ic("qr"), "Ler o QR das peças (conta sozinho)");
      const todosOk = estado.itens.length > 0 && estado.itens.every((i) => i.situacao === "confere");
      return el("div", {}, el("div", { style: "display:grid;gap:10px;margin-bottom:16px" }, todosOk ? el("div", { class: "aviso ok" }, ic("check"), el("span", {}, "Tudo marcado como conferido. Toque em Continuar, ou ajuste algum item abaixo.")) : tudo, ler),
        ...estado.itens.map((it, i) => {
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
    nota: () => (estado.leitura?.status === "lendo" ? "Aguarde um instante: estou lendo o número da nota na foto." : !estado.numero_nota ? "Digite o número da nota." : !estado.fotos.nota.length ? "Tire a foto da nota fiscal." : null),
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
    const inp = el("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off", id: idCampo, value: String(valor), "aria-label": "Quantidade" });
    const mudar = (v) => { const n = Math.max(0, Math.round(Number(v) || 0)); inp.value = String(n); aoMudar(n); };
    inp.addEventListener("change", () => mudar(inp.value));
    return el("div", { class: "contador" },
      el("button", { type: "button", "aria-label": "Diminuir", html: NE.icone.menos, onclick: () => mudar(Number(inp.value) - 1) }),
      inp,
      el("button", { type: "button", "aria-label": "Aumentar", html: NE.icone.mais, onclick: () => mudar(Number(inp.value) + 1) }));
  }

  function blocoFoto(tipo, titulo, exigencia, dica, varias, redesenhar, aoNovaFoto) {
    const lista = estado.fotos[tipo];
    const adicionar = async (arquivos) => {
      for (let k = 0; k < arquivos.length; k++) {
        try { arquivos[k] = await NE.arquivoImagem(arquivos[k]); } catch (e) { NE.aviso(e.message, "erro"); continue; }
        const blob = await NE.reduzirFoto(arquivos[k]);
        if (!varias) lista.splice(0).forEach((f) => URL.revokeObjectURL(f.url));
        lista.push({ blob, url: URL.createObjectURL(blob) });
      }
      const original = arquivos[arquivos.length - 1];
      if (aoNovaFoto && original) estado.leitura = { status: "lendo" };
      redesenhar();
      if (aoNovaFoto && original) aoNovaFoto(original); // lê da foto original, em alta resolução
    };
    // Duas entradas: câmera direta e galeria (se o aparelho bloquear a câmera, a galeria ainda funciona)
    const entrada = (comCamera, rotulo) => {
      const inp = el("input", { type: "file", accept: !comCamera && /nota/i.test(titulo) ? "image/*,application/pdf" : "image/*", capture: comCamera ? "environment" : false, multiple: varias || false, "aria-label": `${rotulo}: ${titulo}` });
      inp.addEventListener("change", () => { if (inp.files?.length) adicionar([...inp.files]); });
      return inp;
    };
    const feita = lista.length > 0;
    const obrig = exigencia === "Obrigatória";
    const rotuloCamera = feita ? (varias ? "Mais uma" : "Tirar outra") : "Tirar foto";
    const exemplo = NE.modoTeste && el("button", { type: "button", class: "link-acao", style: "justify-self:center",
      onclick: async () => adicionar([tipo === "nota" ? await NE.nfe.gerarExemplo() : await NE.dados.fotoExemplo(titulo)]) }, "Usar foto de teste");
    return el("div", { class: `foto-bloco${feita ? " feita" : ""}` },
      el("div", { class: "foto-bloco-topo" }, el("strong", {}, titulo),
        el("span", { class: `etiqueta ${feita ? "ok" : obrig ? "obrigatoria" : ""}` }, feita ? `${lista.length} foto${lista.length > 1 ? "s" : ""}` : exigencia)),
      el("span", { class: "dica" }, dica),
      feita && el("div", { class: "miniaturas" }, lista.map((f, i) => el("figure", {},
        el("img", { src: f.url, alt: `${titulo} ${i + 1}` }),
        el("button", { type: "button", class: "remover", "aria-label": "Apagar esta foto", html: NE.icone.fechar,
          onclick: () => { URL.revokeObjectURL(f.url); lista.splice(i, 1); redesenhar(); } })))),
      el("div", { class: "foto-acoes" },
        el("label", { class: `btn ${!feita && obrig ? "btn-azul" : "btn-secundario"} botao-camera` }, ic("camera"), rotuloCamera, entrada(true, "Tirar foto")),
        el("label", { class: "btn btn-secundario botao-camera" }, ic("galeria"), /nota/i.test(titulo) ? "Galeria ou PDF" : "Galeria", entrada(false, "Escolher da galeria"))),
      exemplo);
  }

  // Contagem lendo o QR de cada peça: aponta a câmera e o app conta sozinho (e avisa se for etiqueta de outra nota)
  function lerEtiquetas(redesenhar) {
    const lidas = new Set(); const contagem = estado.itens.map(() => 0); const lista = el("div", { class: "progresso-pecas" }); const msg = el("div", { "aria-live": "polite" }); const onde = el("div", {}); let leitor;
    const desenhar = () => lista.replaceChildren(...estado.itens.map((it, i) => el("div", { class: "linha" }, el("strong", {}, it.descricao), el("span", { class: `etiqueta ${contagem[i] === Number(it.qtd_nota) ? "ok" : contagem[i] > Number(it.qtd_nota) ? "alerta" : ""}` }, `${contagem[i]} de ${NE.num(it.qtd_nota)}`))));
    const aoLer = (texto) => {
      let u; try { u = new URL(texto); } catch { return; }
      const token = u.searchParams.get("c"); const p = u.searchParams.get("p");
      if (estado.nota?.token_publico && token !== estado.nota.token_publico) { NE.aviso("Essa etiqueta é de outra nota.", "erro", msg); return; }
      if (!p) { NE.aviso("Etiqueta sem número de peça (é a etiqueta por produto).", "alerta", msg); return; }
      if (lidas.has(p)) return; const [idx] = p.split("-").map(Number); if (!(idx in contagem)) return;
      lidas.add(p); contagem[idx]++; msg.replaceChildren(); desenhar();
    };
    const usar = el("button", { type: "button", class: "btn btn-principal", id: "btn-usar-contagem" }, ic("check"), "Usar esta contagem");
    const j = NE.janelaSimples({ etiqueta: "Etiquetas", titulo: "Contar com a câmera", corpo: el("div", {}, onde, msg, lista), rodape: [usar] });
    const encerrar = () => leitor?.parar();
    j.fundo.addEventListener("remove", encerrar); new MutationObserver((_, o) => { if (!document.body.contains(j.fundo)) { encerrar(); o.disconnect(); } }).observe(document.body, { childList: true });
    usar.addEventListener("click", () => {
      estado.itens.forEach((it, i) => { if (contagem[i] > 0) { it.qtd_carregada = contagem[i]; it.situacao = contagem[i] === Number(it.qtd_nota) ? "confere" : "diferente"; } });
      estado.metodo = "scanner"; encerrar(); j.fechar(); redesenhar();
    });
    desenhar(); NE.scanner(onde, aoLer).then((l) => { leitor = l; });
  }

  function statusLeitura() {
    const l = estado.leitura;
    if (!l) return "";
    if (l.status === "lendo") return el("div", { class: "leitura lendo" }, el("span", { class: "girando" }), "Lendo o número da nota na foto…");
    if (l.status === "ok") return el("div", { class: "leitura ok" }, ic("check"), el("span", {}, `Número ${l.numero} lido do código de barras (série ${l.serie}). Confira com a nota.`));
    return el("div", { class: "leitura falhou" }, ic("alerta"), el("span", {}, "Não consegui ler o código de barras. Digite o número ou tire outra foto mais perto, sem sombra."));
  }

  const linhaResumo = NE.linhaResumo;
  function textoDiferenca(d) {
    if (d === 0) return "Igual à nota";
    return d > 0 ? `${d} a mais que a nota` : `${-d} a menos que a nota`;
  }

  // ── Registro ──────────────────────────────────────────
  async function registrar(raiz) {
    const pos = await NE.posicao();
    const fotos = []; for (const [tipo, lista] of Object.entries(estado.fotos)) for (const f of lista) fotos.push({ tipo, blob: f.blob });
    const temDif = estado.itens.some((i) => Number(i.qtd_carregada) !== Number(i.qtd_nota));
    const r = await NE.dados.registrarConferencia({
      client_id: estado.client_id, nota_id: estado.nota?.id || null, numero_nota: estado.numero_nota, cliente: estado.cliente, chave_nfe: estado.chave_nfe, veiculo_id: estado.veiculo?.id || "", placa: estado.placa, motorista: estado.motorista,
      motivo_divergencia: estado.motivo, observacao: estado.observacao, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null, duracao_s: Math.round((Date.now() - estado.inicio) / 1000), metodo: estado.metodo,
      itens: estado.itens.map((i) => ({ produto_id: i.produto_id || "", descricao: i.descricao, qtd_nota: Number(i.qtd_nota), qtd_carregada: Number(i.qtd_carregada) })), fotos,
    });
    telaFim(raiz, temDif, !!r?.pendente);
  }

  function telaFim(raiz, temDif, pendente) {
    Object.values(estado.fotos).flat().forEach((f) => URL.revokeObjectURL(f.url));
    NE.telaFim(raiz, {
      tipo: temDif ? "alerta" : "ok",
      titulo: temDif ? "Registrada com diferença" : "Carga conferida",
      texto: pendente ? `Sem sinal agora: a conferência da nota ${estado.numero_nota} ficou guardada no aparelho e sobe sozinha quando a internet voltar.`
        : temDif
        ? `Nota ${estado.numero_nota} · ${estado.placa}. A expedição foi avisada da diferença e do motivo.`
        : `Nota ${estado.numero_nota} · ${estado.placa}. Tudo confere. O caminhão pode sair.`,
      botoes: [
        { rotulo: "Próxima nota da fila", icone: "mais", acao: () => aoTerminar() },
        { rotulo: "Conferir carga sem nota", acao: () => NE.iniciarConferencia(perfil, raiz, aoTerminar) },
      ],
    });
  }
})();

// Rota: conferir uma nota da fila (params.nota_id) ou uma carga sem nota
(() => {
  const NE = window.NE;
  NE.rotas = NE.rotas || {};
  NE.rotas.conferir = (raiz, params, app) => NE.iniciarConferencia(app.perfil, raiz, () => app.ir("notas", {}, { substituir: true }), { nota_id: params.nota_id });
})();
