// Início do administrador: o painel "mastigado". Semáforo, números, o que precisa de ação, 14 dias, produtos e equipe.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const fmt = D.fmt;
  let periodoAtual = "hoje";

  const ICONE_SEMAFORO = { vermelho: "alerta", amarelo: "alerta", verde: "check" };

  NE.rotas.resumo = (raiz, params, app) => {
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

    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Resumo completo"), el("p", {}, `${primeiro}, aqui está tudo em detalhe.`)), el("button", { type: "button", class: "link-acao", onclick: () => app.voltar() }, ic("voltar"), "Voltar")),
      chips, sem, kpis, blocoRecados, atalhos, grafico, blocoProdutos, blocoEquipe);
  }
  const atalho = (icone, titulo, sub, acao) => el("button", { type: "button", class: "cartao-guia", onclick: acao }, ic(icone), el("span", {}, titulo, el("small", { style: "display:block" }, sub)));

  // ───────────────────────── INÍCIO: cada função tem o seu painel ─────────────────────────
  // Todos leem os mesmos dados; muda o que importa para quem está olhando.
  // A nota que o vendedor lança cai na fila do conferente; o que o conferente confere vira número aqui.

  // O que mostrar em cada painel: título da situação, os dois números e os botões grandes.
  function montarPainel(tipo, { r, ctx, app, cadastros }) {
    const ir = (rota, p) => () => app.ir(rota, p || {});
    const guia = (fluxo) => () => app.ir("guia", { fluxo });
    const N = (valor, um, varios) => ({ valor: String(valor), texto: valor === 1 ? um : varios });
    const est = r.estoque; const nEst = est.negativos.length + est.baixos.length;

    if (tipo === "empresa") return {                       // diretoria: a empresa de cima
      saudacao: "Como está a empresa hoje",
      numeros: [N(r.kpis.total, "carga conferida hoje", "cargas conferidas hoje"), N(r.kpis.divergentes, "carga com diferença", "cargas com diferença")],
      pergunta: "O que você quer ver?",
      tiles: [
        ["grafico", "Resumo completo", "Números do dia, da semana e do mês", ir("resumo")],
        ["caminhao", "As cargas que saíram", "Com foto e conferência", ir("cargas")],
        ["caixas", "O estoque agora", `${nEst ? `${nEst} produto${nEst > 1 ? "s" : ""} pedindo atenção` : "Tudo dentro do mínimo"}`, ir("estoque")],
        ["pessoas", "A equipe", "Quem confere e quanto erra", ir("equipe")],
      ],
    };
    if (tipo === "patio") return {                         // expedição: o pátio agora
      saudacao: "O pátio agora",
      numeros: [N(r.fila.total, "nota esperando conferência", "notas esperando conferência"), N(r.kpis.total, "carga já saiu hoje", "cargas já saíram hoje")],
      pergunta: "O que você quer fazer?",
      tiles: [
        ["nota", "Lançar uma nota", "A nota chegou? Coloque na fila", guia("nota")],
        ["baixar", "Importar XML", "Várias notas de uma vez", guia("xml")],
        ["conferir", "Conferir uma carga", "Caminhão carregado", ir("conferir")],
        ["raio", "Pedir a contagem do dia", "Leva uns 3 minutos", ir("contar")],
        ["caminhao", "Ver as cargas", "O que já saiu", ir("cargas")],
        ["caixas", "Ver o estoque", "Quanto tem de cada peça", ir("estoque")],
      ],
    };
    if (tipo === "escritorio") return {                    // administrativo: cadastros e papelada
      saudacao: "Os cadastros e as notas",
      numeros: [N(r.fila.total, "nota na fila", "notas na fila"), N(cadastros.pessoas, "pessoa cadastrada", "pessoas cadastradas")],
      pergunta: "O que você quer fazer?",
      tiles: [
        ["baixar", "Importar XML", "Várias notas de uma vez", guia("xml")],
        ["nota", "Lançar uma nota", "Digitando ou por foto", guia("nota")],
        ["usuario", "Cadastrar uma pessoa", "Cria o acesso e manda no WhatsApp", guia("novaPessoa")],
        ["caminhao", "Caminhões", `${cadastros.veiculos} na frota`, ir("cadastros", { aba: "caminhoes" })],
        ["caixas", "Produtos", `${cadastros.produtos} cadastrados`, ir("cadastros", { aba: "produtos" })],
        ["engrenagem", "Ajustes", "Horário e prazos", guia("ajustes")],
      ],
    };
    if (tipo === "vendas") return {                        // vendedor: o que o cliente dele vê
      saudacao: "Suas notas e entregas",
      numeros: [N(r.fila.total, "nota esperando carregar", "notas esperando carregar"), N(r.kpis.total, "entrega saiu hoje", "entregas saíram hoje")],
      pergunta: "O que você quer fazer?",
      tiles: [
        ["nota", "Lançar uma nota", "A venda fechou? Coloque na fila", guia("nota")],
        ["caminhao", "Ver as cargas", "E mandar o rastreio ao cliente", ir("cargas")],
      ],
    };
    if (tipo === "viagem") return {                        // motorista: posso sair?
      saudacao: "Sua viagem de hoje",
      numeros: [N(r.fila.total, "carga esperando conferência", "cargas esperando conferência"), N(r.kpis.total, "carga liberada hoje", "cargas liberadas hoje")],
      pergunta: "O que você quer ver?",
      tiles: [
        ["nota", "A fila de carga", "O que está esperando conferência", ir("notas")],
        ["sino", "Meus avisos", "O que chegou para você", ir("alertas")],
      ],
    };
    return {                                               // conferente e ajudante
      saudacao: "O que conferir agora",
      numeros: [N(r.fila.total, "nota esperando você", "notas esperando você"), N(r.kpis.total, "carga conferida hoje", "cargas conferidas hoje")],
      pergunta: "O que você quer fazer?",
      tiles: [
        ["conferir", "Conferir uma carga", "Caminhão carregado", ir("conferir")],
        ["raio", "Contagem do dia", "Leva uns 3 minutos", ir("contar")],
        ["nota", "Ver a fila", "Tudo que espera conferência", ir("notas")],
      ],
    };
  }

  // Frase de situação: só fala de problema que ESTA pessoa pode resolver.
  // O motorista não resolve nada no app: para ele a frase diz se a carga está liberada.
  function situacao(r, app) {
    if (app.perm.painel === "viagem") {
      const esperando = r.fila.total;
      return { cor: esperando ? "amarelo" : "verde", fixo: true,
        titulo: esperando ? "Ainda tem carga para conferir" : "Nenhuma carga esperando",
        texto: esperando
          ? `${esperando === 1 ? "Uma carga está" : `${esperando} cargas estão`} na fila. Só saia do pátio depois que o conferente liberar a sua.`
          : "Tudo que está carregado já foi conferido. Boa viagem!" };
    }
    const podeVer = (rota) => (app.perm.telas || []).includes(rota === "contagem" ? "contar" : rota);
    const meus = r.insights.filter((i) => i.nivel !== "ok" && (!i.acao || podeVer(i.acao.rota)));
    const topo = meus[0];
    const cor = !topo ? "verde" : meus.some((i) => i.nivel === "erro" || i.nivel === "critico") ? "vermelho" : "amarelo";
    return { topo, cor };
  }

  NE.rotas.inicio = async (raiz, params, app) => {
    raiz.replaceChildren(el("div", { class: "esqueleto", style: "height:110px" }), el("div", { class: "esqueleto", style: "height:260px" }));
    let ctx; try { ctx = await NE.dados.contexto(); } catch (e) { raiz.replaceChildren(); return NE.aviso(NE.mensagemErro(e), "erro", raiz); }
    const r = D.resumoDoPeriodo(ctx, "hoje");
    const primeiro = (app.perfil.nome || "").split(" ")[0];
    const s = situacao(r, app); const cor = s.cor; const topo = s.topo;
    const irPara = (a) => (a.rota === "contagem" ? app.ir("contar", {}) : app.ir(a.rota, a.params || {}));

    const status = el("section", { class: `status-simples ${cor}`, "aria-live": "polite" },
      el("div", { class: "luz", html: NE.icone[cor === "verde" ? "check" : "alerta"] }),
      el("div", { class: "status-texto" },
        el("strong", {}, s.fixo ? s.titulo : cor === "verde" ? "Tudo certo por aqui" : cor === "amarelo" ? "Tem algo para olhar" : "Precisa da sua atenção"),
        el("p", {}, s.fixo ? s.texto : topo ? topo.titulo : "Nenhum problema agora. Quando algo precisar de você, o app avisa."),
        !s.fixo && topo && topo.acao && el("button", { type: "button", class: "btn btn-principal", id: "btn-resolver", onclick: () => irPara(topo.acao) }, "Resolver agora")));

    const cadastros = app.perm.cadastra
      ? { produtos: (await NE.dados.produtos(true)).length, veiculos: (await NE.dados.veiculos(true)).length, pessoas: (await NE.dados.funcionarios()).length }
      : { produtos: 0, veiculos: 0, pessoas: 0 };
    const P = montarPainel(app.perm.painel, { r, ctx, app, cadastros });

    const numeros = el("div", { class: "numeros-simples" }, P.numeros.map((n) => el("div", {}, el("b", {}, n.valor), el("span", {}, n.texto))));
    const tiles = el("div", { class: "tiles" }, P.tiles.map(([icone, nome, sub, acao], i) =>
      el("button", { type: "button", class: "tile", id: i === 0 ? "tile-nota" : null, onclick: acao }, el("span", { class: "tile-icone", html: NE.icone[icone] }), el("strong", {}, nome), el("small", {}, sub))));

    // "Comece por aqui": só para quem cadastra, e só enquanto faltar cadastro
    let comeco = null;
    if (app.perm.cadastra) {
      const passos = [[cadastros.produtos > 0, "Cadastre os produtos", "novoProduto"], [cadastros.veiculos > 0, "Cadastre os caminhões", "novoVeiculo"],
        [cadastros.pessoas > 1, "Cadastre a equipe", "novaPessoa"], [r.kpis.total > 0 || r.fila.total > 0, "Lance a primeira nota", "nota"]];
      if (passos.some(([feito]) => !feito)) comeco = el("section", { class: "primeiros-passos" }, el("h2", {}, "Comece por aqui"), el("p", {}, "Siga na ordem:"),
        passos.map(([feito, nome, fluxo], k) => el("button", { type: "button", class: `passo-comeco${feito ? " feito" : ""}`, onclick: () => app.ir("guia", { fluxo }) }, el("span", { class: "passo-num" }, feito ? "✓" : String(k + 1)), el("strong", {}, nome))));
    }

    raiz.replaceChildren(
      el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, `Olá, ${primeiro}`),
        el("p", {}, `${NE.rotuloFuncao(app.perfil.funcao)} · ${new Date(ctx.agora).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}`))),
      status, comeco, el("h2", { class: "titulo-tiles" }, P.saudacao), numeros,
      el("h2", { class: "titulo-tiles" }, P.pergunta), tiles,
      el("div", { class: "links-fim" },
        (app.perm.telas || []).includes("resumo") && el("button", { type: "button", class: "link-acao", id: "btn-resumo", onclick: () => app.ir("resumo", {}) }, ic("grafico"), "Ver o resumo completo"),
        el("button", { type: "button", class: "link-acao", onclick: () => NE.iniciarTour("painel", { verDicas: () => NE.abrirGuia("painel", raiz, () => app.ir("inicio"), { novaConferencia: () => app.ir("conferir") }) }) }, ic("ajuda"), "Como usar o app (1 minuto)")));
  };
})();
