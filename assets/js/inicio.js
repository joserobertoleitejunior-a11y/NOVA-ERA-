// Início do administrador: o painel "mastigado". Semáforo, números, o que precisa de ação, 14 dias, produtos e equipe.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const fmt = D.fmt;
  let periodoAtual = "hoje";

  const ICONE_SEMAFORO = { vermelho: "alerta", amarelo: "alerta", verde: "check" };

  NE.rotas.inicio = (raiz, params, app) => {
    raiz.replaceChildren(el("div", { class: "esqueleto", style: "height:90px" }), el("div", { class: "esqueleto", style: "height:140px" }), el("div", { class: "esqueleto", style: "height:200px" }));
    NE.dados.contexto().then((ctx) => desenhar(raiz, ctx, app)).catch((e) => { raiz.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", raiz); });
  };

  function desenhar(raiz, ctx, app) {
    const r = D.resumoDoPeriodo(ctx, periodoAtual); const k = r.kpis;
    const primeiro = (app.perfil.nome || "").split(" ")[0];
    const chips = el("div", { class: "faixa-periodo", role: "group", "aria-label": "Período" }, [["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "7 dias"], ["30d", "30 dias"]].map(([id, nome]) =>
      el("button", { type: "button", class: "chip", "aria-pressed": String(id === periodoAtual), onclick: () => { periodoAtual = id; desenhar(raiz, ctx, app); } }, nome)));
    const sem = el("section", { class: `semaforo ${r.semaforo.cor}`, "aria-live": "polite" },
      el("div", { class: "luz", html: NE.icone[ICONE_SEMAFORO[r.semaforo.cor]] }),
      el("div", {}, el("h1", {}, r.semaforo.titulo), el("p", {}, r.semaforo.texto)));
    const ir = (rota, p) => () => app.ir(rota, p || {});
    const kpi = (valor, rotulo, sub, classe, rota, p) => el("button", { type: "button", class: `kpi ${classe || ""}`, onclick: ir(rota, p) }, el("b", {}, valor), el("span", {}, rotulo), sub && el("small", { class: classe }, sub));
    const est = r.estoque; const nEst = est.negativos.length + est.baixos.length;
    const kpis = el("div", { class: "kpis" },
      kpi(String(k.total), "conferências", k.acertoPct === null ? "nenhuma ainda" : `${k.acertoPct}% corretas`, k.acertoPct === null || k.acertoPct >= 90 ? "ok" : "alerta", "cargas"),
      kpi(String(k.divergentes), "com diferença", k.divergentes ? `${fmt(k.aMais)} a mais · ${fmt(k.aMenos)} a menos` : "tudo certo", k.divergentes ? "erro" : "ok", "cargas", { dif: "1" }),
      kpi(String(r.fila.total), "notas na fila", r.fila.paradas ? `${r.fila.paradas} parada${r.fila.paradas > 1 ? "s" : ""} há tempo` : r.fila.total ? "dentro do prazo" : "fila vazia", r.fila.paradas ? "alerta" : "ok", "notas"),
      kpi(String(nEst), "produtos pedem atenção", nEst ? `${est.negativos.length} negativo · ${est.baixos.length} baixo` : "estoque saudável", nEst ? "alerta" : "ok", "estoque"));

    const recados = r.insights.filter((i) => i.nivel !== "ok").slice(0, 6);
    const blocoRecados = el("div", {}, el("div", { class: "bloco-titulo" }, el("h2", {}, "O que precisa de você")),
      recados.length ? recados.map((i) => el("div", { class: `recado ${i.nivel}` }, el("div", { class: "recado-corpo" }, el("strong", {}, i.titulo), el("p", {}, i.texto),
        i.acao && el("button", { type: "button", class: "link-acao", onclick: () => (i.acao.rota === "contagem" ? app.ir("contar", {}) : app.ir(i.acao.rota, i.acao.params || {})) }, i.acao.rotulo, ic("seguir")))))
        : el("div", { class: "recado ok" }, el("div", { class: "recado-corpo" }, el("strong", {}, "Nada urgente agora"), el("p", {}, "Quando algo precisar de você, aparece aqui e chega no seu celular."))));

    const max = Math.max(1, ...r.serie.map((s) => s.total));
    const grafico = el("div", {}, el("div", { class: "bloco-titulo" }, el("h2", {}, "Últimos 14 dias")),
      el("div", { class: "barras", role: "img", "aria-label": "Conferências por dia: corretas e com diferença" }, r.serie.map((s) => el("div", { class: "col", title: `${s.rotulo}: ${s.total} conferências, ${s.divergentes} com diferença` },
        el("div", { class: "pilha" }, el("div", { class: "b-ok", style: `height:${(s.corretas / max) * 100}%` }), s.divergentes ? el("div", { class: "b-div", style: `height:${(s.divergentes / max) * 100}%` }) : null),
        el("span", {}, s.rotulo.slice(0, 2))))),
      el("div", { class: "legenda" }, el("span", {}, el("i", { style: "background:var(--ok)" }), "Confere"), el("span", {}, el("i", { style: "background:var(--erro)" }), "Com diferença")));

    const prod30 = D.rankingProdutos(ctx.conferencias, D.periodo("30d", ctx.agora).de, D.periodo("30d", ctx.agora).ate).slice(0, 4);
    const blocoProdutos = el("div", {}, el("div", { class: "bloco-titulo" }, el("h2", {}, "Onde mais erra (30 dias)")),
      prod30.length ? prod30.map((p) => el("div", { class: "linha-cartao atencao", role: "group" }, el("strong", {}, p.nome), el("span", { class: "meta" }, `${D.plural(p.ocorrencias, "carga", "cargas")} com diferença`),
        el("span", { class: "lado" }, p.aMais ? `+${fmt(p.aMais)}` : "", p.aMais && p.aMenos ? " / " : "", p.aMenos ? `−${fmt(p.aMenos)}` : "")))
        : el("p", { class: "vazio" }, "Nenhuma diferença nos últimos 30 dias."));

    const eq = D.equipe(ctx.conferencias, r.periodo.de, r.periodo.ate);
    const blocoEquipe = el("div", {}, el("div", { class: "bloco-titulo" }, el("h2", {}, "Equipe"), el("button", { type: "button", class: "link-acao", onclick: ir("equipe") }, "Ver equipe")),
      eq.length ? eq.map((e) => el("div", { class: "linha-cartao", role: "group" }, el("strong", {}, e.nome), el("span", { class: "meta" }, e.duracaoMediaMin ? `média de ${fmt(e.duracaoMediaMin)} min por carga` : "—"),
        el("span", { class: "lado" }, String(e.total), el("small", {}, e.divergentes ? `${e.divergentes} com dif.` : "sem dif."))))
        : el("p", { class: "vazio" }, `Ninguém conferiu carga ${r.periodo.rotulo}.`));

    const atalhos = el("div", { class: "menu-grade", style: "margin-top:18px" },
      atalho("nota", "Nova nota", "Digitar ou importar XML", ir("notas", { nova: "1" })),
      atalho("raio", "Contagem do dia", "3 minutos, o que mais importa", ir("contar")),
      atalho("pessoas", "Cadastrar equipe", "Várias pessoas de uma vez", ir("equipe", { novo: "1" })));

    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, `Olá, ${primeiro}`), el("p", {}, new Date(ctx.agora).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })))),
      chips, sem, kpis, blocoRecados, atalhos, grafico, blocoProdutos, blocoEquipe);
  }
  const atalho = (icone, titulo, sub, acao) => el("button", { type: "button", class: "cartao-guia", onclick: acao }, ic(icone), el("span", {}, titulo, el("small", { style: "display:block" }, sub)));
})();
