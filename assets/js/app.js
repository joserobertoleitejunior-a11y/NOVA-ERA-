// Início do app: login → conferente (passo a passo) ou painel (admin).
(() => {
  const NE = window.NE;
  const { el, ic, $ } = NE;
  const raiz = () => $("#conteudo");
  let perfil, visao;

  function topo() {
    $("#logo").innerHTML = NE.logo;
    const area = $("#usuario");
    area.replaceChildren();
    if (!perfil) return;
    const sair = el("button", { class: "link-acao", type: "button" }, ic("sair"), "Sair");
    sair.addEventListener("click", async () => { await NE.dados.sair(); perfil = null; iniciar(); });
    const ajuda = el("button", { class: "btn-ajuda", type: "button", id: "btn-ajuda" }, ic("ajuda"), "Ajuda");
    ajuda.addEventListener("click", abrirAjuda);
    area.append(ajuda, el("span", {}, perfil.nome), NE.modoDemo ? "" : sair);
  }

  const tipoGuia = () => (visao === "painel" ? "painel" : "conferente");
  const voltarVisao = () => (visao === "painel" ? painel() : inicioConferente());
  function abrirDicas() {
    $("main").className = "";
    NE.abrirGuia(tipoGuia(), raiz(), voltarVisao, { novaConferencia: conferir });
  }
  // Ajuda = tutorial guiado em cima da tela atual (volta para a tela inicial se estiver no meio de um passo a passo)
  function abrirAjuda() {
    NE.fecharJanela?.();
    if (document.querySelector("#btn-seguir")) return NE.iniciarTour("passo");
    if (!document.querySelector("#btn-nova, #btn-nova-painel")) voltarVisao();
    requestAnimationFrame(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }));
  }

  function seloDemo() {
    const box = $("#selo-demo");
    if (!NE.modoDemo) { box.hidden = true; return; }
    box.hidden = false;
    const b = (id, nome) => {
      const x = el("button", { type: "button", "aria-pressed": String(visao === id) }, nome);
      x.addEventListener("click", () => {
        visao = id; seloDemo(); voltarVisao();
        if (!NE.tourJaVisto(tipoGuia())) setTimeout(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }), 300);
      });
      return x;
    };
    box.replaceChildren(el("span", {}, "Demonstração com dados de exemplo · nada é gravado"), b("conferente", "Celular do conferente"), b("painel", "Painel da expedição"));
  }

  async function iniciar() {
    try { perfil = await NE.dados.perfil(); } catch { perfil = null; }
    topo();
    if (!perfil) return telaEntrar();
    if (!perfil.ativo) { await NE.dados.sair(); perfil = null; topo(); return telaEntrar("Seu acesso está desativado. Fale com a expedição."); }
    visao = perfil.papel === "admin" && !NE.modoDemo ? "painel" : "conferente";
    seloDemo();
    // Já busca caminhões e produtos para a conferência abrir na hora
    NE.dados.veiculos().catch(() => {}); NE.dados.produtos().catch(() => {});
    voltarVisao();
    // Primeiro acesso: tutorial guiado automático
    if (!NE.tourJaVisto(tipoGuia())) setTimeout(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }), 400);
  }

  function telaEntrar(msg) {
    $("main").className = "";
    const usuario = el("input", { class: "entrada", id: "login-usuario", autocomplete: "username", autocapitalize: "none", required: true });
    const senha = el("input", { class: "entrada", id: "login-senha", type: "password", autocomplete: "current-password", required: true });
    const btn = el("button", { class: "btn btn-principal btn-bloco", type: "submit" }, "Entrar");
    const avisoBox = el("div", {});
    const form = el("form", { class: "cartao" },
      el("h1", {}, "Confere Carga"), el("p", {}, "Entre com o usuário e a senha que a expedição te passou."), avisoBox,
      el("div", { class: "campo" }, el("label", { for: "login-usuario" }, "Usuário"), usuario),
      el("div", { class: "campo" }, el("label", { for: "login-senha" }, "Senha"), senha), btn);
    if (msg) NE.aviso(msg, "erro", avisoBox);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      NE.comCarregando(btn, async () => { await NE.dados.entrar(usuario.value, senha.value); await iniciar(); });
    });
    raiz().replaceChildren(el("div", { class: "entrar" }, form));
  }

  function inicioConferente() {
    $("main").className = "";
    const primeiroNome = perfil.nome.split(" ")[0];
    const nova = el("button", { class: "btn btn-principal btn-bloco btn-gigante", type: "button", id: "btn-nova" }, ic("caminhao"), "Nova conferência");
    nova.addEventListener("click", conferir);
    const lista = el("div", { id: "lista-minhas" }, el("div", { class: "esqueleto" }), el("div", { class: "esqueleto" }));
    raiz().replaceChildren(el("section", { class: "tela boas-vindas" },
      el("h1", {}, `Olá, ${primeiroNome}`),
      el("p", {}, "Antes do caminhão sair, confira a carga com a nota. Leva uns 2 minutos."),
      nova,
      el("button", { type: "button", class: "cartao-guia", onclick: abrirDicas }, ic("ajuda"), "Treinar a conferência (1 minuto)"),
      el("h2", { class: "secao-titulo" }, "Minhas conferências de hoje", el("small", {}, new Date().toLocaleDateString("pt-BR"))),
      lista));
    const dia = NE.hojeISO(), minhas = !NE.modoDemo;
    NE.carregarRapido(`conf-${dia}-${minhas ? "minhas" : "todas"}`, () => NE.dados.conferencias({ dia, somenteMinhas: minhas, idPerfil: perfil.id }), (lst) => {
      lista.replaceChildren(...(lst.length
        ? lst.map((c) => NE.cartaoConferencia(c, (x) => NE.abrirConferencia(x, { podeEnviar: perfil.papel === "admin" })))
        : [el("p", { class: "vazio" }, "Nenhuma conferência hoje. Toque em \"Nova conferência\" para começar.")]));
    }, (e) => { lista.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", lista); });
  }

  function conferir() {
    $("main").className = "";
    NE.iniciarConferencia(perfil, raiz(), () => (visao === "painel" ? painel() : inicioConferente()));
    window.scrollTo({ top: 0 });
  }

  function painel() {
    $("main").className = "largo";
    NE.iniciarPainel(perfil, raiz(), conferir);
  }

  if (!NE.modoDemo && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  iniciar();
})();
