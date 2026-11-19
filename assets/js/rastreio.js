// Rastreio para o cliente: página pública (rastreio.html?c=CÓDIGO) que mostra só o necessário:
// situação da carga, horários, itens carregados e a foto do caminhão carregado.
// O código é secreto e impossível de adivinhar; dados internos (conferente, diferenças, motivo) não aparecem.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;
  const C = window.NOVA_ERA || {};

  // Endereço do link que o vendedor manda
  NE.urlRastreio = (token) => {
    if (NE.modoDemo) return `https://SEU-ENDERECO/rastreio.html?c=${token}`;
    const base = C.urlPublica || location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
    return `${base.replace(/\/?$/, "/")}rastreio.html?c=${token}`;
  };

  // Converte uma conferência (modo demonstração) no mesmo formato que o servidor devolve ao cliente
  NE.rastreioDe = (c, urlFotoCarga) => ({
    numero_nota: c.numero_nota, placa: c.placa, conferido_em: c.criado_em,
    itens: (c.itens || []).map((i) => ({ descricao: i.descricao, quantidade: Number(i.qtd_carregada) })),
    foto_carga: urlFotoCarga || null, entregue_em: null,
  });

  // Desenho da página do cliente (usado na página pública e na prévia "Ver como o cliente vê")
  NE.renderRastreio = (d) => {
    const etapas = [
      { titulo: "Carga conferida", texto: "Conferimos cada peça com a sua nota fiscal.", quando: d.conferido_em, feito: true },
      { titulo: "Saiu do nosso pátio", texto: `Caminhão ${d.placa} a caminho da entrega.`, quando: d.conferido_em, feito: true },
      { titulo: "Entregue", texto: d.entregue_em ? "Entrega concluída." : "Aguardando a chegada na obra.", quando: d.entregue_em, feito: !!d.entregue_em },
    ];
    const total = d.itens.reduce((n, i) => n + i.quantidade, 0);
    return el("div", { class: "rastreio" },
      el("div", { class: "rastreio-topo" },
        el("span", { class: "etiqueta ok" }, d.entregue_em ? "Entregue" : "A caminho"),
        el("h1", {}, `Nota ${d.numero_nota}`),
        el("p", {}, "Acompanhe a sua entrega da Nova Era.")),
      el("ol", { class: "linha-tempo" }, etapas.map((e) => el("li", { class: e.feito ? "feito" : "" },
        el("span", { class: "ponto", html: e.feito ? NE.icone.check : "" }),
        el("div", {}, el("strong", {}, e.titulo), el("span", {}, e.texto),
          e.quando && el("small", {}, new Date(e.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })))))),
      d.foto_carga && el("div", {}, el("h2", {}, "Foto da sua carga"),
        el("a", { href: d.foto_carga, target: "_blank", rel: "noopener", class: "rastreio-foto" }, el("img", { src: d.foto_carga, alt: "Caminhão carregado com a sua carga" }))),
      el("h2", {}, `O que foi carregado (${NE.num(total)} ${total === 1 ? "peça" : "peças"})`),
      el("div", { class: "resumo" }, d.itens.map((i) => el("div", { class: "resumo-linha" }, el("span", {}, i.descricao), el("strong", {}, NE.num(i.quantidade))))),
      el("div", { class: "rastreio-contato" },
        el("strong", {}, "Dúvidas sobre a entrega?"),
        el("span", {}, "Fale com o seu vendedor ou ligue para a Nova Era:"),
        el("span", { class: "telefone" }, C.telefoneEmpresa || "(15) 3273-1159")));
  };

  // Página pública
  NE.iniciarRastreioPublico = async (raiz) => {
    const params = new URLSearchParams(location.search);
    const token = params.get("c") || "";
    if (params.has("demo")) { // demonstração: mostra uma entrega de exemplo, sem consultar o banco
      raiz.replaceChildren(NE.renderRastreio({ numero_nota: "48213", placa: "ABC1D23", conferido_em: new Date(Date.now() - 36e5).toISOString(), entregue_em: null,
        itens: [{ descricao: "Meio-fio", quantidade: 40 }, { descricao: "Boca de lobo", quantidade: 4 }], foto_carga: null }));
      return;
    }
    raiz.replaceChildren(el("div", { class: "esqueleto", style: "height:120px" }), el("div", { class: "esqueleto", style: "height:220px" }));
    if (!/^[0-9a-f-]{36}$/i.test(token)) return falha(raiz, "Link incompleto. Peça um novo link ao seu vendedor.");
    try {
      const r = await fetch(`${C.supabaseUrl}/functions/v1/rastreio?c=${encodeURIComponent(token)}`, { headers: { apikey: C.supabaseAnonKey } });
      if (r.status === 404) return falha(raiz, "Não encontramos esta entrega. Confira o link com o seu vendedor.");
      if (!r.ok) throw new Error();
      raiz.replaceChildren(NE.renderRastreio(await r.json()));
    } catch { falha(raiz, "Sem conexão agora. Tente de novo em instantes."); }
  };
  function falha(raiz, texto) {
    const tentar = el("button", { type: "button", class: "btn btn-principal btn-bloco", onclick: () => location.reload() }, "Tentar de novo");
    raiz.replaceChildren(el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, texto)), tentar);
  }

  // Prévia dentro do app: "Ver como o cliente vê"
  NE.verComoCliente = async (c) => {
    const foto = (c.fotos || []).find((f) => f.tipo === "carga");
    const url = foto ? await NE.dados.urlFoto(foto.caminho) : null;
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const tela = el("div", { class: "janela-fundo previa-cliente" },
      el("div", { class: "janela", role: "dialog", "aria-modal": "true", "aria-label": "Como o cliente vê" },
        el("div", { class: "janela-topo" }, el("div", {}, el("span", { class: "etiqueta" }, "Prévia"), el("h2", {}, "Tela do cliente")), fechar),
        el("div", { class: "janela-corpo fundo-concreto" }, el("div", { class: "logo-cliente", html: NE.logo }), NE.renderRastreio(NE.rastreioDe(c, url)))));
    fechar.addEventListener("click", () => tela.remove());
    tela.addEventListener("click", (e) => { if (e.target === tela) tela.remove(); });
    document.body.append(tela);
    fechar.focus({ preventScroll: true });
  };

  // Envio pelo WhatsApp (botão do vendedor)
  NE.enviarRastreio = (c) => {
    const link = NE.urlRastreio(c.token_publico);
    const fone = el("input", { class: "entrada", id: "fone-cliente", inputmode: "tel", autocomplete: "off", placeholder: "(15) 99999-9999" });
    const mensagem = () => `Olá! Aqui é da Nova Era. A carga da sua nota ${c.numero_nota} foi conferida e saiu do nosso pátio às ${NE.hora(c.criado_em)}. Acompanhe a entrega por aqui: ${link}`;
    const abrir = el("a", { class: "btn btn-verde btn-bloco", target: "_blank", rel: "noopener" }, ic("whatsapp"), "Abrir no WhatsApp");
    const atualizar = () => {
      const n = fone.value.replace(/\D/g, "");
      abrir.href = `https://wa.me/${n.length >= 10 ? (n.startsWith("55") ? n : "55" + n) : ""}?text=${encodeURIComponent(mensagem())}`;
    };
    fone.addEventListener("input", atualizar); atualizar();
    const copiar = el("button", { type: "button", class: "link-acao", onclick: async () => {
      try { await navigator.clipboard.writeText(link); NE.aviso("Link copiado.", "ok"); } catch { NE.aviso("Não deu para copiar neste aparelho.", "alerta"); }
    } }, "Copiar só o link");
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const tela = el("div", { class: "janela-fundo" },
      el("div", { class: "janela janela-pequena", role: "dialog", "aria-modal": "true", "aria-labelledby": "titulo-envio" },
        el("div", { class: "janela-topo" }, el("div", {}, el("span", { class: "etiqueta ok" }, "Rastreio ao vivo"), el("h2", { id: "titulo-envio" }, "Enviar ao cliente")), fechar),
        el("div", { class: "janela-corpo" },
          el("p", { style: "margin-top:0" }, `O cliente recebe um link para acompanhar a nota ${c.numero_nota}: situação, horário de saída, o que foi carregado e a foto da carga.`),
          el("div", { class: "campo" }, el("label", { for: "fone-cliente" }, "WhatsApp do cliente (opcional)"),
            el("span", { class: "dica" }, "Sem número, o WhatsApp abre para você escolher o contato."), fone),
          el("div", { class: "previa-mensagem" }, mensagem()),
          NE.modoDemo && el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, "Demonstração: o link passa a funcionar quando o app estiver hospedado.")),
          el("div", { style: "display:grid;gap:10px" }, abrir, copiar,
            el("button", { type: "button", class: "link-acao", onclick: () => { tela.remove(); NE.verComoCliente(c); } }, ic("olho"), "Ver como o cliente vê")))));
    fechar.addEventListener("click", () => tela.remove());
    tela.addEventListener("click", (e) => { if (e.target === tela) tela.remove(); });
    document.body.append(tela);
    fone.focus({ preventScroll: true });
  };
})();
