// Central de avisos: o app avisa a pessoa certa, na hora, sem ninguém precisar abrir para procurar problema.
// Canais: sino no app · aviso do aparelho (app aberto ou fechado) · WhatsApp de 1 toque.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const ROTA = { conferencia: ["cargas", { dif: "1" }], nota: ["notas", {}], produto: ["estoque", {}], contagem: ["estoque", { aba: "contagens" }], painel: ["inicio", {}], equipe: ["equipe", {}] };

  NE.rotas.alertas = (raiz, params, app) => {
    const lista = el("div", { id: "lista-alertas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    const todos = el("button", { type: "button", class: "link-acao", id: "btn-ler-todos" }, ic("check"), "Marcar tudo como lido");
    const prefs = el("button", { type: "button", class: "link-acao", onclick: () => preferencias(app) }, ic("engrenagem"), "Quais avisos eu quero");
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Avisos"), el("p", {}, "O que aconteceu e precisa de você."))), el("div", { class: "acoes-linha", style: "margin-bottom:12px" }, todos, prefs), cartaoPush(app), lista);
    const carregar = async () => {
      const itens = await NE.dados.alertas({});
      lista.replaceChildren(...(itens.length ? itens.map((a) => item(a, app, carregar)) : [el("div", { class: "vazio-grande" }, el("strong", {}, "Tudo em dia"), "Nenhum aviso. Quando algo der errado, você é avisado aqui.")]));
    };
    todos.addEventListener("click", async () => { await NE.dados.marcarLidos("todos"); NE.naoLidos = 0; app.atualizarSino(); carregar(); });
    NE.rotas.alertas.atualizar = carregar;
    carregar().catch((e) => { lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); });
  };

  function item(a, app, recarregar) {
    const minha = String(a.tipo || "").startsWith("minha_");   // avisos do vendedor sobre as notas dele
    const destino = minha ? (a.ref_tipo === "conferencia" ? ["cargas", {}] : ["notas", {}]) : ROTA[a.ref_tipo];
    const rastreio = (a.tipo === "minha_carga_saiu" || a.tipo === "minha_carga_diferenca") && a.ref_tipo === "conferencia" && el("button", { type: "button", class: "link-acao verde", onclick: (ev) => NE.comCarregando(ev.currentTarget, async () => {
      const t = D.aMs(a.criado_em); const c = (await NE.dados.conferencias({ de: t - D.DIA, ate: t + D.DIA })).find((x) => x.id === a.ref_id);
      if (!c) return NE.aviso("Não achei essa carga. Abra Minhas cargas.", "alerta");
      await NE.dados.marcarLidos([a.id]); app.atualizarSino(); NE.enviarRastreio(c);
    }) }, ic("whatsapp"), "Mandar rastreio ao cliente");
    const abrir = destino && el("button", { type: "button", class: "link-acao", onclick: async () => { await NE.dados.marcarLidos([a.id]); app.atualizarSino(); app.ir(destino[0], destino[1]); } }, "Abrir", ic("seguir"));
    const zap = a.severidade !== "info" && !minha && NE.pacote.tem("avisos") && el("a", { class: "link-acao verde", target: "_blank", rel: "noopener", href: `https://wa.me/?text=${encodeURIComponent(`Nova Era · ${a.titulo}\n${a.texto}`)}` }, ic("whatsapp"), "Mandar no WhatsApp");
    const feito = el("button", { type: "button", class: "link-acao", onclick: async () => { await NE.dados.resolverAlerta(a.id); app.atualizarSino(); recarregar(); } }, ic("check"), "Resolvido");
    return el("div", { class: `alerta-item ${a.severidade}${a.lido_em ? "" : " nao-lido"}`, role: "group" },
      el("strong", {}, a.titulo), el("p", {}, a.texto), el("span", { class: "quando" }, `${D.tempoRelativo(a.criado_em, Date.now())} · ${(D.TIPOS_ALERTA[a.tipo] || {}).rotulo || ""}`),
      el("div", { class: "acoes-linha" }, rastreio, abrir, zap, feito));
  }

  function cartaoPush(app) {
    const caixa = el("div", { class: "cartao-guia", style: "cursor:default;flex-wrap:wrap" });
    const suportado = NE.dados.pushSuportado?.();
    const permissao = "Notification" in window ? Notification.permission : "denied";
    const botao = (rotulo, fn) => el("button", { type: "button", class: "btn btn-azul", style: "min-height:44px", onclick: fn }, rotulo);
    if (NE.modoTeste) {
      caixa.append(ic("sino"), el("span", { style: "flex:1" }, "Avisos no aparelho", el("small", { style: "display:block;color:var(--texto-suave);font-weight:500" }, permissao === "granted" ? "Ligados: avisos aparecem na tela enquanto o app está aberto." : "Permita para ver os avisos aparecerem como notificação.")),
        permissao !== "granted" && botao("Permitir", async () => { await Notification.requestPermission(); app.recarregar(); }),
        permissao === "granted" && botao("Testar", () => NE.notificar("Aviso de teste", "É assim que o aviso aparece no seu aparelho.", "teste")));
    } else if (suportado) {
      caixa.append(ic("sino"), el("span", { style: "flex:1" }, "Avisos mesmo com o app fechado", el("small", { style: "display:block;color:var(--texto-suave);font-weight:500" }, "Ligue neste aparelho para receber na hora, sem abrir o app.")),
        botao("Ligar", () => NE.comCarregando(caixa.querySelector("button"), async () => { await NE.dados.pushAssinar(); NE.aviso("Pronto! Este aparelho vai receber os avisos.", "ok"); await NE.dados.pushTestar().catch(() => {}); })));
    } else return el("div", {});
    return caixa;
  }

  async function preferencias(app) {
    const atual = new Set(await NE.dados.preferencias()); const admin = app.admin;
    const tipos = (app.perfil.funcao === "vendedor" ? D.ALERTAS_VENDEDOR : admin ? D.ALERTAS_ADMIN.concat(D.ALERTAS_FUNCIONARIO) : D.ALERTAS_FUNCIONARIO).filter((t, i, v) => v.indexOf(t) === i && NE.pacote.avisoPermitido(t));
    const corpo = el("div", {}, el("p", { style: "margin-top:0" }, "Ligue só o que importa para você."), tipos.map((t) => el("div", { style: "margin-bottom:10px" }, NE.chave(atual.has(t), D.TIPOS_ALERTA[t].rotulo, async (v) => { v ? atual.add(t) : atual.delete(t); await NE.dados.salvarPreferencias([...atual]); }), el("div", { class: "suave", style: "font-size:.85rem;margin:2px 0 0 62px" }, D.TIPOS_ALERTA[t].dica))));
    NE.janelaSimples({ etiqueta: "Avisos", titulo: "O que quero receber", corpo });
  }
})();
