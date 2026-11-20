// Casca do app: login → navegação por rotas (botão "voltar" do celular funciona) → telas.
// Administrador: Início · Notas · Estoque · Cargas · Mais.   Conferente: Fila · Estoque · Avisos.
(() => {
  const NE = window.NE;
  const { el, ic, $ } = NE;
  const C = window.NOVA_ERA || {};
  const raiz = () => $("#conteudo");

  let perfil = null, atual = { rota: null, params: {} }, sondando = null, vistos = new Set(), primeiraSondagem = true;
  NE.rotas = NE.rotas || {};

  const NAV_ADMIN = [["inicio", "Início", "casa"], ["notas", "Notas", "nota"], ["estoque", "Estoque", "caixas"], ["cargas", "Cargas", "caminhao"], ["mais", "Mais", "mais_menu"]];
  const NAV_FUNC = [["notas", "Fila", "nota"], ["estoque", "Estoque", "caixas"], ["alertas", "Avisos", "sino"]];
  const SEM_NAV = new Set(["conferir", "contar", "leitor"]);
  const PAI_NAV = { alertas: "mais", equipe: "mais", cadastros: "mais", config: "mais", exportar: "mais" };
  const ehAdmin = () => perfil?.papel === "admin";

  NE.app = {
    get perfil() { return perfil; },
    get admin() { return ehAdmin(); },
    ir, voltar: () => history.back(), recarregar: () => desenhar(), atualizarSino: () => sondar(),
  };

  function ir(rota, params = {}, { substituir = false } = {}) {
    atual = { rota, params };
    try { history[substituir ? "replaceState" : "pushState"]({ rota, params }, "", `#${rota}`); } catch { /* sem histórico: segue */ }
    desenhar();
  }
  window.addEventListener("popstate", (e) => { if (!perfil) return; atual = e.state?.rota ? e.state : { rota: inicial(), params: {} }; desenhar(); });
  const inicial = () => (ehAdmin() ? "inicio" : "notas");

  function desenhar() {
    NE.fecharJanela?.(); NE.fecharSimples?.();
    const { rota, params } = atual;
    const sem = SEM_NAV.has(rota);
    document.body.classList.toggle("com-nav", !sem);
    $("main").className = ["inicio", "cargas", "estoque", "notas", "equipe", "cadastros", "config", "exportar"].includes(rota) && ehAdmin() ? "largo" : "";
    nav(rota, sem); botaoIA(sem);
    const f = NE.rotas[rota] || NE.rotas[inicial()];
    window.scrollTo({ top: 0 });
    try { f(raiz(), params, NE.app); } catch (e) { console.error(e); raiz().replaceChildren(el("div", { class: "aviso erro" }, ic("alerta"), el("span", {}, "Esta tela não abriu. Volte e tente de novo."))); }
  }

  function nav(rota, esconder) {
    let barra = $("#nav-inferior"); if (barra) barra.remove();
    if (esconder || !perfil) return;
    const itens = ehAdmin() ? NAV_ADMIN : NAV_FUNC; const ativo = PAI_NAV[rota] || rota;
    barra = el("nav", { class: "nav-inferior", id: "nav-inferior", "aria-label": "Menu principal" }, el("div", { class: "nav-inferior-dentro" }, itens.map(([id, nome, icone]) => {
      const b = el("button", { type: "button", class: "nav-item", "data-rota": id, "aria-current": ativo === id ? "page" : false }, ic(icone), el("span", {}, nome));
      b.addEventListener("click", () => ir(id));
      return b;
    })));
    document.body.append(barra); atualizarBadge();
  }

  // ───────────────────────── topo, sino, faixa de teste ─────────────────────────
  function topo() {
    $("#logo").innerHTML = NE.logo;
    const area = $("#usuario"); area.replaceChildren();
    const faixa = $("#faixa-teste");
    if (!perfil) { faixa.hidden = true; return; }
    const sino = el("button", { class: "sino", type: "button", id: "btn-sino", "aria-label": "Avisos" }, ic("sino"), el("span", { class: "nav-n", id: "sino-n", hidden: true }, "0"));
    sino.addEventListener("click", () => ir("alertas"));
    const ajuda = el("button", { class: "btn-ajuda", type: "button", id: "btn-ajuda" }, ic("ajuda"), "Ajuda");
    ajuda.addEventListener("click", abrirAjuda);
    const sair = el("button", { class: "link-acao", type: "button", "aria-label": "Sair" }, ic("sair"));
    sair.addEventListener("click", async () => { pararSondagem(); await NE.dados.sair(); perfil = null; document.body.classList.remove("com-nav"); $("#nav-inferior")?.remove(); $("#fab-ia")?.remove(); iniciar(); });
    area.append(ajuda, el("span", { class: "nome" }, perfil.nome.split(" ")[0]), sino, sair);
    faixaTeste(faixa);
  }
  function faixaTeste(faixa) {
    if (!NE.modoTeste) { faixa.hidden = true; return; }
    faixa.hidden = false;
    const adm = ehAdmin();
    const trocar = el("button", { type: "button", id: "btn-trocar" }, adm ? "Ver como conferente" : "Voltar ao administrador");
    trocar.addEventListener("click", async () => { await NE.dados.trocarPerfil(adm ? "u-carlos" : "u-admin"); perfil = await NE.dados.perfil(); topo(); ir(inicial(), {}, { substituir: true }); sondar(); });
    const zerar = el("button", { type: "button", id: "btn-zerar" }, "Zerar dados de teste");
    zerar.addEventListener("click", async () => { if (!confirm("Apagar os dados de teste e começar de novo com os exemplos?")) return; await NE.dados.reiniciar(); perfil = await NE.dados.perfil(); vistos = new Set(); topo(); ir(inicial(), {}, { substituir: true }); NE.aviso("Dados de teste reiniciados.", "ok"); });
    faixa.replaceChildren(el("span", {}, el("b", {}, "AMBIENTE DE TESTE"), " · dados de exemplo, só neste aparelho. Nada vai para o banco de verdade."), trocar, zerar);
  }

  async function sondar() {
    if (!perfil) return;
    try {
      const lista = await NE.dados.alertas({ soNaoLidos: true });
      const novos = lista.filter((a) => !vistos.has(a.id)); lista.forEach((a) => vistos.add(a.id));
      if (!primeiraSondagem) novos.slice(0, 3).forEach((a) => { NE.aviso(a.titulo, a.severidade === "critico" ? "erro" : "alerta"); NE.notificar?.(a.titulo, a.texto, a.id); });
      primeiraSondagem = false; NE.naoLidos = lista.length; atualizarBadge();
      if (atual.rota === "alertas") NE.rotas.alertas.atualizar?.();
    } catch { /* sem sinal: tenta de novo no próximo ciclo */ }
  }
  function atualizarBadge() {
    const n = NE.naoLidos || 0; const s = $("#sino-n"); if (s) { s.hidden = !n; s.textContent = n > 99 ? "99+" : String(n); }
    const item = document.querySelector('.nav-item[data-rota="alertas"]'); item?.querySelector(".nav-n")?.remove();
    if (item && n) item.append(el("span", { class: "nav-n" }, String(n)));
  }
  function iniciarSondagem() { pararSondagem(); primeiraSondagem = true; vistos = new Set(); sondar(); sondando = setInterval(sondar, 30000); }
  function pararSondagem() { clearInterval(sondando); sondando = null; }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && perfil) sondar(); });

  function botaoIA(esconder) {
    $("#fab-ia")?.remove();
    if (esconder || !perfil || !ehAdmin() || !NE.abrirAssistente) return;
    const b = el("button", { type: "button", class: "fab-ia", id: "fab-ia" }, ic("faisca"), "Perguntar");
    b.addEventListener("click", () => NE.abrirAssistente()); document.body.append(b);
  }

  // ───────────────────────── ajuda e tutorial ─────────────────────────
  const tipoGuia = () => (ehAdmin() ? "painel" : "conferente");
  function abrirDicas() { $("main").className = ""; NE.abrirGuia(tipoGuia(), raiz(), () => ir(inicial()), { novaConferencia: () => ir("conferir") }); }
  function abrirAjuda() {
    NE.fecharJanela?.();
    if (document.querySelector("#btn-seguir")) return NE.iniciarTour("passo");
    if (SEM_NAV.has(atual.rota)) ir(inicial());
    requestAnimationFrame(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }));
  }

  // ───────────────────────── entrada ─────────────────────────
  async function iniciar() {
    try { perfil = await NE.dados.perfil(); } catch { perfil = null; }
    topo();
    if (!perfil) { pararSondagem(); return telaEntrar(); }
    if (!perfil.ativo) { await NE.dados.sair(); perfil = null; topo(); return telaEntrar("Seu acesso está desativado. Fale com a expedição."); }
    if (window.NE_ENTRADA === "admin" && perfil.papel !== "admin") { await NE.dados.sair(); perfil = null; topo(); return telaEntrar("Esta área é só da administração. Entre com um usuário de administrador."); }
    NE.dados.veiculos().catch(() => {}); NE.dados.produtos().catch(() => {});
    NE.dados.sincronizar?.().catch(() => {});
    NE.dados.aoMudarFila = mostrarFila; mostrarFila();
    iniciarSondagem();
    const alvo = (location.hash || "").slice(1);
    const rota = NE.rotas[alvo] && !SEM_NAV.has(alvo) && (ehAdmin() || ["notas", "estoque", "alertas"].includes(alvo)) ? alvo : inicial();
    ir(rota, {}, { substituir: true });
    if (!NE.tourJaVisto(tipoGuia())) setTimeout(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }), 500);
  }
  async function mostrarFila() {
    let n = 0; try { n = (await NE.dados.pendentes?.()) || 0; } catch { /* sem fila */ }
    let b = $("#aviso-fila"); if (!n) { b?.remove(); return; }
    if (!b) { b = el("div", { class: "faixa-teste", id: "aviso-fila" }); $("#faixa-teste").after(b); }
    b.replaceChildren(el("span", {}, `${n} ${n === 1 ? "conferência guardada" : "conferências guardadas"} no aparelho, esperando sinal para enviar.`));
  }

  function telaEntrar(msg) {
    $("main").className = ""; $("#fab-ia")?.remove();
    const usuario = el("input", { class: "entrada", id: "login-usuario", autocomplete: "username", autocapitalize: "none", required: true });
    const senha = el("input", { class: "entrada", id: "login-senha", type: "password", autocomplete: "current-password", required: true });
    const btn = el("button", { class: "btn btn-principal btn-bloco", type: "submit", id: "btn-entrar" }, "Entrar");
    const avisoBox = el("div", {});
    const adm = window.NE_ENTRADA === "admin";
    const teste = C.modoTeste ? el("div", { class: "aviso alerta", style: "margin-top:14px;align-items:center" }, ic("alerta"),
      el("span", {}, el("b", {}, "Modo de teste: "), "usuário ", el("b", {}, "admin"), " e senha ", el("b", {}, "admin"), ". Abre um ambiente com dados de exemplo, só neste aparelho."),
      el("button", { type: "button", class: "link-acao", id: "btn-teste", onclick: () => { usuario.value = "admin"; senha.value = "admin"; form.requestSubmit(); } }, "Entrar agora")) : null;
    const form = el("form", { class: "cartao" },
      el("h1", {}, adm ? "Administração" : "Confere Carga"), el("p", {}, adm ? "Área da expedição e da diretoria. Entre com seu usuário e senha." : "Entre com o usuário e a senha que a expedição te passou."), avisoBox,
      el("div", { class: "campo" }, el("label", { for: "login-usuario" }, "Usuário"), usuario),
      el("div", { class: "campo" }, el("label", { for: "login-senha" }, "Senha"), senha), btn, teste);
    if (msg) NE.aviso(msg, "erro", avisoBox);
    form.addEventListener("submit", (e) => { e.preventDefault(); NE.comCarregando(btn, async () => { await NE.dados.entrar(usuario.value, senha.value); await iniciar(); }); });
    raiz().replaceChildren(el("div", { class: "entrar" }, form));
  }

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
  iniciar();
})();
