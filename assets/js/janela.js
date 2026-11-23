// Janela da conferência: todas as informações, tudo clicável (fotos em tela cheia, filtros por caminhão
// e por conferente, mapa, copiar nota e resumo). Fecha com X, tocando fora, Esc ou o "voltar" do celular.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;
  const NOMES_FOTO = { nota: "Nota fiscal", placa: "Placa", carga: "Caminhão carregado", avaria: "Avaria" };
  const ORDEM_FOTO = { nota: 0, placa: 1, carga: 2, avaria: 3 };

  let aberta = null;

  NE.abrirConferencia = (c, { aoFiltrar, podeEnviar } = {}) => {
    fechar(true);
    const origemFoco = document.activeElement;
    const div = c.status === "divergencia";
    const fotos = [...(c.fotos || [])].sort((a, b) => ORDEM_FOTO[a.tipo] - ORDEM_FOTO[b.tipo]);
    const itens = c.itens || [];
    const totNota = itens.reduce((n, i) => n + Number(i.qtd_nota), 0);
    const totSubiu = itens.reduce((n, i) => n + Number(i.qtd_carregada), 0);

    const btnFechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const filtro = (tipo, valor, rotulo) => aoFiltrar
      ? el("button", { type: "button", class: "link-acao", onclick: () => { fechar(); aoFiltrar(tipo, valor, rotulo); } }, ic("lista"), "Ver todas")
      : null;

    const galeria = el("div", { class: "miniaturas janela-fotos" }, fotos.map((f, i) => {
      const fig = el("button", { type: "button", class: "foto-botao", "aria-label": `Abrir foto: ${NOMES_FOTO[f.tipo]}` },
        el("span", { class: "esqueleto foto-esqueleto" }), el("span", { class: "foto-legenda" }, NOMES_FOTO[f.tipo] || f.tipo));
      fig.addEventListener("click", () => abrirFoto(fotos, i));
      NE.dados.urlFoto(f.caminho).then((url) => { if (url) fig.firstChild.replaceWith(el("img", { src: url, alt: "", loading: "lazy", decoding: "async" })); });
      return fig;
    }));

    const linhas = [
      ["Data e hora", el("span", {}, new Date(c.criado_em).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }))],
      ["Caminhão", el("span", { class: "linha-acoes" }, el("span", { class: "placa-br" }, c.placa), filtro("placa", c.placa, `Caminhão ${c.placa}`))],
      ["Motorista", el("span", {}, c.motorista || "Não informado")],
      ["Conferido por", el("span", { class: "linha-acoes" }, el("span", {}, c.conferente?.nome || "—"), filtro("conferente", c.conferente_id, c.conferente?.nome || "Conferente"))],
      ["Nota fiscal", el("span", { class: "linha-acoes" }, el("strong", {}, c.numero_nota), botaoCopiar(c.numero_nota, "Número da nota copiado."))],
      c.chave_nfe && ["Chave de acesso", el("span", { class: "linha-acoes" },
        el("span", { class: "chave-nfe" }, NE.nfe.formatarChave(c.chave_nfe)), botaoCopiar(c.chave_nfe, "Chave de acesso copiada."),
        el("span", { class: "etiqueta ok" }, "Lida da foto"))],
      ["Local do registro", c.latitude != null
        ? el("a", { class: "link-acao", href: `https://www.google.com/maps?q=${c.latitude},${c.longitude}`, target: "_blank", rel: "noopener" }, ic("local"), "Abrir no mapa")
        : el("span", { class: "suave" }, "Localização não autorizada no celular")],
    ];

    const corpo = el("div", { class: "janela-corpo" },
      el("div", { class: `faixa-status ${div ? "alerta" : "ok"}` }, ic(div ? "alerta" : "check"),
        el("span", {}, div ? textoDif(itens.filter((i) => Number(i.qtd_nota) !== Number(i.qtd_carregada)).length) : "Tudo confere com a nota")),
      el("div", { class: "resumo" }, linhas.filter(Boolean).map(([k, v]) => el("div", { class: "resumo-linha" }, el("span", {}, k), v))),
      el("h3", {}, `Itens (${itens.length})`),
      el("div", { class: "tabela-wrap resumo" }, el("table", {},
        el("thead", {}, el("tr", {}, el("th", {}, "Produto"), el("th", { class: "num" }, "Nota"), el("th", { class: "num" }, "Subiu"), el("th", { class: "num" }, "Dif."))),
        el("tbody", {}, itens.map((i) => {
          const d = Number(i.qtd_carregada) - Number(i.qtd_nota);
          return el("tr", { class: d ? "dif" : "" }, el("td", {}, i.descricao), el("td", { class: "num" }, NE.num(i.qtd_nota)),
            el("td", { class: "num" }, NE.num(i.qtd_carregada)), el("td", { class: "num" }, d ? el("strong", {}, d > 0 ? `+${d}` : String(d)) : "—"));
        })),
        el("tfoot", {}, el("tr", {}, el("th", {}, "Total"), el("th", { class: "num" }, NE.num(totNota)), el("th", { class: "num" }, NE.num(totSubiu)),
          el("th", { class: "num" }, totSubiu - totNota ? (totSubiu - totNota > 0 ? `+${totSubiu - totNota}` : String(totSubiu - totNota)) : "—"))))),
      c.motivo_divergencia && el("div", {}, el("h3", {}, "Motivo da diferença"), el("p", { class: "caixa-texto" }, c.motivo_divergencia)),
      c.observacao && el("div", {}, el("h3", {}, "Observação"), el("p", { class: "caixa-texto" }, c.observacao)),
      el("h3", {}, `Fotos (${fotos.length})`), fotos.length ? galeria : el("p", { class: "suave" }, "Sem fotos."),
      el("p", { class: "registro-protegido" }, ic("chave"), `Registro protegido: não pode ser alterado nem apagado. Código ${String(c.id).slice(0, 8).toUpperCase()}`));

    const rodape = el("div", { class: "janela-rodape grade-acoes" },
      podeEnviar && c.token_publico && el("button", { type: "button", class: "btn btn-verde", onclick: () => NE.enviarRastreio(c) }, ic("whatsapp"), "Enviar ao cliente"),
      !(NE.app && NE.app.perm && NE.app.perm.painel === "vendas") && el("button", { type: "button", class: "btn btn-azul", onclick: () => NE.abrirEtiquetas(c) }, ic("etiqueta"), "Etiquetas"),   // etiqueta é do pátio, não do vendedor
      el("button", { type: "button", class: "btn btn-secundario", onclick: () => copiar(resumoTexto(c), "Resumo copiado. Cole no WhatsApp.") }, "Copiar resumo"),
      el("button", { type: "button", class: "btn btn-secundario", onclick: () => fechar() }, "Fechar"));

    const janela = el("div", { class: "janela", role: "dialog", "aria-modal": "true", "aria-labelledby": "janela-titulo" },
      el("div", { class: "janela-topo" },
        el("div", {}, el("span", { class: `etiqueta ${div ? "alerta" : "ok"}` }, div ? "Com diferença" : "Confere"),
          el("h2", { id: "janela-titulo" }, `Nota ${c.numero_nota}`)),
        btnFechar),
      corpo, rodape);
    const fundo = el("div", { class: "janela-fundo" }, janela);
    fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
    btnFechar.addEventListener("click", () => fechar());
    document.body.append(fundo);
    document.body.classList.add("sem-rolagem");
    aberta = { fundo, origemFoco, comHistorico: false };
    try { history.pushState({ neJanela: true }, ""); aberta.comHistorico = true; } catch { /* sem histórico: segue */ }
    btnFechar.focus({ preventScroll: true });
  };

  function fechar(silencioso) {
    if (!aberta) return;
    const { fundo, origemFoco, comHistorico } = aberta;
    aberta = null;
    fundo.remove();
    document.querySelector(".foto-tela")?.remove();
    document.body.classList.remove("sem-rolagem");
    if (comHistorico && !silencioso && history.state?.neJanela) { try { history.back(); } catch { /* ok */ } }
    origemFoco?.focus?.({ preventScroll: true });
  }
  NE.fecharJanela = fechar;
  window.addEventListener("popstate", () => { if (document.querySelector(".foto-tela")) return document.querySelector(".foto-tela").remove(); if (aberta) { aberta.comHistorico = false; fechar(); } });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const ft = document.querySelector(".foto-tela");
    if (ft) ft.remove(); else fechar();
  });

  // ── Foto em tela cheia (deslizar para o lado troca a foto) ──
  function abrirFoto(fotos, inicio) {
    let i = inicio;
    const img = el("img", { alt: "" });
    const legenda = el("div", { class: "foto-tela-legenda" });
    const original = el("a", { class: "link-acao claro", target: "_blank", rel: "noopener" }, "Abrir original");
    const mostrar = async () => {
      const f = fotos[i];
      legenda.textContent = `${NOMES_FOTO[f.tipo] || f.tipo} · ${i + 1} de ${fotos.length}`;
      const url = await NE.dados.urlFoto(f.caminho);
      img.src = url; img.alt = NOMES_FOTO[f.tipo] || "Foto"; original.href = url;
    };
    const ir = (d) => { i = (i + d + fotos.length) % fotos.length; mostrar(); };
    const tela = el("div", { class: "foto-tela", role: "dialog", "aria-modal": "true", "aria-label": "Foto em tela cheia" },
      el("button", { type: "button", class: "janela-fechar claro", "aria-label": "Fechar foto", html: NE.icone.fechar, onclick: () => tela.remove() }),
      img,
      fotos.length > 1 && el("button", { type: "button", class: "foto-seta esq", "aria-label": "Foto anterior", html: NE.icone.voltar, onclick: () => ir(-1) }),
      fotos.length > 1 && el("button", { type: "button", class: "foto-seta dir", "aria-label": "Próxima foto", html: NE.icone.seguir, onclick: () => ir(1) }),
      el("div", { class: "foto-tela-rodape" }, legenda, original));
    let x0 = null;
    tela.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    tela.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50 && fotos.length > 1) ir(dx < 0 ? 1 : -1); x0 = null; });
    tela.addEventListener("click", (e) => { if (e.target === tela) tela.remove(); });
    document.body.append(tela);
    tela.querySelector(".janela-fechar").focus({ preventScroll: true });
    mostrar();
  }

  const textoDif = (n) => (n === 1 ? "1 item não bate com a nota" : `${n} itens não batem com a nota`);

  function resumoTexto(c) {
    const linhas = [
      `*Conferência de carga · Nova Era*`,
      `Nota: ${c.numero_nota}`, `Caminhão: ${c.placa}${c.motorista ? ` · Motorista: ${c.motorista}` : ""}`,
      `Data: ${NE.dataHora(c.criado_em)} · Conferido por: ${c.conferente?.nome || "—"}`,
      `Situação: ${c.status === "divergencia" ? "COM DIFERENÇA" : "Confere"}`, "",
      ...(c.itens || []).map((i) => {
        const d = Number(i.qtd_carregada) - Number(i.qtd_nota);
        return `• ${i.descricao}: nota ${i.qtd_nota}, subiu ${i.qtd_carregada}${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}`;
      }),
    ];
    if (c.motivo_divergencia) linhas.push("", `Motivo: ${c.motivo_divergencia}`);
    return linhas.join("\n");
  }

  function botaoCopiar(texto, msg) {
    return el("button", { type: "button", class: "link-acao", onclick: () => copiar(texto, msg) }, "Copiar");
  }
  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); NE.aviso(msg, "ok"); }
    catch { NE.aviso("Não deu para copiar neste aparelho. Segure o texto e copie pelo menu.", "alerta"); }
  }
})();
