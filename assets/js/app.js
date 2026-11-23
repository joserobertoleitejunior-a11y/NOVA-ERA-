// Casca do app: login → navegação por rotas (botão "voltar" do celular funciona) → telas.
// Administrador: Início · Notas · Estoque · Cargas · Mais.   Conferente: Fila · Estoque · Avisos.
(() => {
  const NE = window.NE;
  const { el, ic, $ } = NE;
  const C = window.NOVA_ERA || {};
  const raiz = () => $("#conteudo");

  let perfil = null, atual = { rota: null, params: {} }, sondando = null, vistos = new Set(), primeiraSondagem = true;
  NE.rotas = NE.rotas || {};

  const SEM_NAV = new Set(["conferir", "contar", "leitor", "guia"]);
  const PAI_NAV = { resumo: "inicio", alertas: "mais", equipe: "mais", cadastros: "mais", config: "mais", exportar: "mais" };
  const ehAdmin = () => perfil?.papel === "admin";

  // ───────────────────────── o painel de cada função ─────────────────────────
  // Cada função tem o seu menu, a sua tela inicial e a sua lista fechada de telas.
  // "telas" vale também quando a pessoa digita o endereço na mão: o que não está aqui, não abre.
  const NOMES_ABA = { inicio: ["Início", "casa"], notas: ["Notas", "nota"], fila: ["Fila", "nota"], estoque: ["Estoque", "caixas"], cargas: ["Cargas", "caminhao"], alertas: ["Avisos", "sino"], mais: ["Mais", "mais_menu"] };
  const TODAS_ADMIN = ["inicio", "resumo", "notas", "estoque", "cargas", "mais", "alertas", "equipe", "cadastros", "config", "exportar", "guia", "contar"];
  const PAPEIS = {
    diretoria:      { nav: ["inicio", "cargas", "estoque", "mais"],                  painel: "empresa", telas: TODAS_ADMIN,                                                              conferir: false, ia: true,  cadastra: true,  lancaNota: false, fluxos: ["ajustes", "pessoa", "veiculo", "produto", "novaPessoa", "novoVeiculo", "novoProduto"] },
    administrativo: { nav: ["inicio", "notas", "estoque", "mais"],                   painel: "escritorio", telas: TODAS_ADMIN,                                                           conferir: false, ia: true,  cadastra: true,  lancaNota: true,  fluxos: null },
    expedicao:      { nav: ["inicio", "notas", "estoque", "cargas", "mais"],         painel: "patio",   telas: TODAS_ADMIN.concat("conferir"),                                           conferir: true,  ia: true,  cadastra: true,  lancaNota: true,  fluxos: null },
    vendedor:       { nav: ["inicio", "notas", "estoque", "cargas", "mais"],         painel: "vendas",  telas: ["inicio", "notas", "estoque", "cargas", "mais", "alertas", "guia"],      conferir: false, ia: true,  cadastra: false, lancaNota: true,  fluxos: ["nota", "xml"] },
    conferente:     { nav: ["notas", "estoque", "alertas"],                          painel: "fila",    telas: ["notas", "estoque", "alertas", "conferir", "contar", "guia", "inicio"],  conferir: true,  ia: false, cadastra: false, lancaNota: false, fluxos: ["resolver"] },
    ajudante:       { nav: ["notas", "estoque", "alertas"],                          painel: "fila",    telas: ["notas", "estoque", "alertas", "conferir", "contar", "guia", "inicio"],  conferir: true,  ia: false, cadastra: false, lancaNota: false, fluxos: ["resolver"] },
    motorista:      { nav: ["inicio", "notas", "alertas"],                           painel: "viagem",  telas: ["inicio", "notas", "alertas"],                                           conferir: false, ia: false, cadastra: false, lancaNota: false, fluxos: [] },
  };
  // Quem tiver uma função fora da lista cai no padrão do papel: administração vê tudo, funcionário confere.
  const PADRAO_ADMIN = { nav: ["inicio", "notas", "estoque", "cargas", "mais"], painel: "patio", telas: TODAS_ADMIN.concat("conferir"), conferir: true, ia: true, cadastra: true, lancaNota: true, fluxos: null };
  const PADRAO_FUNC = { nav: ["notas", "estoque", "alertas"], painel: "fila", telas: ["notas", "estoque", "alertas", "conferir", "contar", "guia", "inicio"], conferir: true, ia: false, cadastra: false, lancaNota: false, fluxos: ["resolver"] };
  const papelDe = () => PAPEIS[perfil?.funcao] || (ehAdmin() ? PADRAO_ADMIN : PADRAO_FUNC);
  const NOMES_FUNCAO = { diretoria: "Diretoria", administrativo: "Administrativo", expedicao: "Expedição", vendedor: "Vendedor", conferente: "Conferente", ajudante: "Ajudante", motorista: "Motorista" };
  NE.rotuloFuncao = (f) => NOMES_FUNCAO[f] || "funcionário";
  const perm = () => {
    const r = papelDe();
    return { nav: r.nav, painel: r.painel, telas: r.telas, fluxos: r.fluxos, conferir: r.conferir, ia: r.ia && ehAdmin(), cadastra: r.cadastra && ehAdmin(), lancaNota: r.lancaNota, limitado: !r.cadastra };
  };
  const podeAbrir = (rota, params = {}) => {
    const r = papelDe();
    if (!r.telas.includes(rota)) return false;
    if (rota === "guia" && r.fluxos && params.fluxo && !r.fluxos.includes(params.fluxo)) return false;
    return true;
  };

  NE.app = {
    get perfil() { return perfil; },
    get admin() { return ehAdmin(); },
    get perm() { return perm(); },
    ir, voltar: () => history.back(), recarregar: () => desenhar(), atualizarSino: () => sondar(),
  };

  function ir(rota, params = {}, { substituir = false } = {}) {
    atual = { rota, params };
    try { history[substituir ? "replaceState" : "pushState"]({ rota, params }, "", `#${rota}`); } catch { /* sem histórico: segue */ }
    desenhar();
  }
  window.addEventListener("popstate", (e) => { if (!perfil) return; atual = e.state?.rota ? e.state : { rota: inicial(), params: {} }; desenhar(); });
  const inicial = () => papelDe().nav[0];

  function desenhar() {
    NE.fecharJanela?.(); NE.fecharSimples?.(); document.querySelectorAll(".janela-fundo, .folha-fundo").forEach((x) => x.remove()); // trocar de tela fecha qualquer janela aberta
    const { rota, params } = atual;
    const sem = SEM_NAV.has(rota);
    document.body.classList.toggle("com-nav", !sem);
    $("main").className = ["resumo", "cargas", "estoque", "notas", "equipe", "cadastros", "config", "exportar"].includes(rota) && ehAdmin() ? "largo" : "";
    nav(rota, sem); botaoIA(sem);
    window.scrollTo({ top: 0 });
    if (!podeAbrir(rota, params)) return semPermissao(rota);   // digitou o endereço de uma tela de outra função
    const f = NE.rotas[rota] || NE.rotas[inicial()];
    try { f(raiz(), params, NE.app); } catch (e) { console.error(e); raiz().replaceChildren(el("div", { class: "aviso erro" }, ic("alerta"), el("span", {}, "Esta tela não abriu. Volte e tente de novo."))); }
  }

  // Tela de outra função: explica e leva de volta, em vez de abrir pela metade.
  function semPermissao() {
    document.body.classList.add("com-nav"); nav(inicial(), false);
    raiz().replaceChildren(el("div", { class: "vazio-grande" },
      el("strong", {}, "Esta tela não é da sua função"),
      el("p", {}, `Você entrou como ${NE.rotuloFuncao(perfil?.funcao)}. Peça à administração se precisar de acesso.`),
      el("button", { type: "button", class: "btn btn-principal", onclick: () => ir(inicial(), {}, { substituir: true }) }, "Voltar para a minha tela")));
  }

  function nav(rota, esconder) {
    let barra = $("#nav-inferior"); if (barra) barra.remove();
    if (esconder || !perfil) return;
    const ids = papelDe().nav; const ativo = PAI_NAV[rota] || rota;
    // o conferente chama a tela de notas de "Fila": é o que ele vê lá
    const rotulo = (id) => (id === "notas" && !perm().lancaNota ? NOMES_ABA.fila : NOMES_ABA[id]) || [id, "casa"];
    barra = el("nav", { class: "nav-inferior", id: "nav-inferior", "aria-label": "Menu principal" }, el("div", { class: "nav-inferior-dentro" }, ids.map((id) => {
      const [nome, icone] = rotulo(id);
      const b = el("button", { type: "button", class: "nav-item", "data-rota": id, "aria-current": ativo === id ? "page" : false }, ic(icone), el("span", {}, nome));
      b.addEventListener("click", () => ir(id));
      return b;
    })));
    document.body.append(barra); atualizarBadge();
  }

  // ───────────────────────── topo, sino, faixa de teste ─────────────────────────
  let ultimoPerfil = null;
  function topo() {
    if ((perfil && perfil.id) !== ultimoPerfil) { ultimoPerfil = perfil && perfil.id; NE.iaReiniciar && NE.iaReiniciar(); }   // outra pessoa: pergunta de novo se a IA está ligada
    $("#logo").innerHTML = NE.logo;
    const area = $("#usuario"); area.replaceChildren();
    const faixa = $("#faixa-teste");
    if (!perfil) { faixa.hidden = true; area.append(el("a", { class: "link-acao", href: "index.html", id: "link-voltar-site" }, ic("voltar"), "Voltar ao site")); return; }
    const sino = el("button", { class: "sino", type: "button", id: "btn-sino", "aria-label": "Avisos" }, ic("sino"), el("span", { class: "nav-n", id: "sino-n", hidden: true }, "0"));
    sino.addEventListener("click", () => ir("alertas"));
    const ajuda = el("button", { class: "btn-ajuda", type: "button", id: "btn-ajuda" }, ic("ajuda"), "Ajuda");
    ajuda.addEventListener("click", abrirAjuda);
    const sair = el("button", { class: "link-acao", type: "button", "aria-label": "Sair" }, ic("sair"));
    sair.addEventListener("click", async () => { pararSondagem(); await NE.dados.sair(); perfil = null; document.body.classList.remove("com-nav"); $("#nav-inferior")?.remove(); $("#fab-ia")?.remove(); $("#fab-teste")?.remove(); $("#menu-teste")?.remove(); iniciar(); });
    area.append(ajuda, el("span", { class: "nome" }, perfil.nome.split(" ")[0]), sino, sair);
    faixaTeste(faixa);
  }
  // No app de verdade não existe nenhuma marca de teste. Na demonstração (?demo= no endereço) uma faixa avisa, sem deixar dúvida,
  // que os dados são fictícios; e um botãozinho discreto (canto esquerdo) traz as ferramentas da demonstração.
  function faixaTeste(faixa) {
    faixa.hidden = true; faixa.classList.remove("faixa-demo"); $("#fab-teste")?.remove(); $("#menu-teste")?.remove();
    if (!NE.modoTeste) return;
    faixa.classList.add("faixa-demo"); faixa.hidden = false;
    faixa.replaceChildren(el("b", {}, "DEMONSTRAÇÃO"), " · dados fictícios. Somem ao fechar esta aba.");
    const adm = ehAdmin();
    const b = el("button", { type: "button", class: "fab-teste", id: "fab-teste", "aria-label": "Alternar visão" }, ic("pessoas"));
    b.addEventListener("click", () => {
      if ($("#menu-teste")) return $("#menu-teste").remove();
      const trocar = el("button", { type: "button", id: "btn-trocar" }, adm ? "Ver como conferente" : "Voltar ao administrador");
      trocar.addEventListener("click", async () => { $("#menu-teste")?.remove(); await NE.dados.trocarPerfil(adm ? "u-t-conf" : "u-admin"); perfil = await NE.dados.perfil(); topo(); ir(inicial(), {}, { substituir: true }); sondar(); });
      const zerar = el("button", { type: "button", id: "btn-zerar" }, "Apagar todos os dados de teste");
      zerar.addEventListener("click", async () => { $("#menu-teste")?.remove(); if (!confirm("Apagar TODOS os dados de teste e começar do zero?")) return; await NE.dados.reiniciar(); perfil = await NE.dados.perfil(); vistos = new Set(); topo(); ir(inicial(), {}, { substituir: true }); NE.aviso("Dados reiniciados.", "ok"); });
      document.body.append(el("div", { class: "menu-teste", id: "menu-teste" }, trocar, zerar));
    });
    document.body.append(b);
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

  let tokenIA = 0;
  function botaoIA(esconder) {
    const vez = ++tokenIA; $("#fab-ia")?.remove();
    if (esconder || !perfil || !perm().ia || !NE.abrirAssistente) return;
    // só aparece se a IA estiver ligada de verdade; o resultado vale para a última tela desenhada
    (NE.iaLigada ? NE.iaLigada() : Promise.resolve(false)).then((ligada) => {
      if (!ligada || vez !== tokenIA || !perfil || $("#fab-ia")) return;
      const b = el("button", { type: "button", class: "fab-ia", id: "fab-ia" }, ic("faisca"), "Perguntar");
      b.addEventListener("click", () => NE.abrirAssistente()); document.body.append(b);
    });
  }

  // ───────────────────────── ajuda e tutorial ─────────────────────────
  const tipoGuia = () => (ehAdmin() ? (perm().painel === "vendas" ? "vendas" : "painel") : "conferente");
  function abrirDicas() { $("main").className = ""; NE.abrirGuia(tipoGuia(), raiz(), () => ir(inicial()), { novaConferencia: () => ir("conferir") }); }
  function abrirAjuda() {
    NE.fecharJanela?.();
    if (document.querySelector("#btn-seguir")) return NE.iniciarTour("passo");
    if (SEM_NAV.has(atual.rota)) ir(inicial());
    requestAnimationFrame(() => NE.iniciarTour(tipoGuia(), { verDicas: abrirDicas }));
  }

  // ───────────────────────── entrada ─────────────────────────
  async function iniciar() {
    perfil = null; topo();   // o topo (logo) aparece NA HORA, antes de esperar o servidor
    // Espera o servidor por no máximo 8 s. Sem resposta, mostra a tela de entrada em vez de ficar em branco.
    try { perfil = await Promise.race([NE.dados.perfil(), new Promise((ok) => setTimeout(() => ok(undefined), 8000))]) || null; } catch { perfil = null; }
    topo();
    if (!perfil) { pararSondagem(); return telaEntrar(); }
    if (!perfil.ativo) { await NE.dados.sair(); perfil = null; topo(); return telaEntrar("Seu acesso está desativado. Fale com a expedição."); }
    if (window.NE_ENTRADA === "admin" && perfil.papel !== "admin") { await NE.dados.sair(); perfil = null; topo(); return telaEntrar("Esta área é só da administração. Entre com um usuário de administrador."); }
    NE.dados.veiculos().catch(() => {}); NE.dados.produtos().catch(() => {});
    NE.dados.sincronizar?.().catch(() => {});
    NE.dados.aoMudarFila = mostrarFila; mostrarFila();
    iniciarSondagem();
    const alvo = (location.hash || "").slice(1);
    const rota = NE.rotas[alvo] && !SEM_NAV.has(alvo) && (ehAdmin() || ["notas", "estoque", "alertas"].includes(alvo)) && (!perm().nav || perm().nav.includes(alvo) || alvo === "alertas") ? alvo : inicial();
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
    const pre = /(?:^|[#&])u=([^&]+)/.exec(location.hash); if (pre) { try { usuario.value = decodeURIComponent(pre[1]); } catch { /* ignora */ } } // vindo da tela de boas-vindas: usuário já preenchido
    const teste = null; // sem dica de login na tela: o acesso de teste é só de quem conhece
    const form = el("form", { class: "cartao" },
      el("h1", {}, adm ? "Administração" : "Confere Carga"), el("p", {}, adm ? "Área da expedição e da diretoria. Entre com o seu e-mail (ou usuário) e a senha." : "Entre com o usuário e a senha que a expedição te passou. A administração entra com o e-mail."), avisoBox,
      el("div", { class: "campo" }, el("label", { for: "login-usuario" }, "Usuário ou e-mail"), usuario),
      el("div", { class: "campo" }, el("label", { for: "login-senha" }, "Senha"), senha), btn, teste,
      el("div", { class: "login-links" }, el("button", { type: "button", class: "link-acao", id: "btn-esqueci", onclick: () => telaEsqueci(usuario.value) }, "Esqueci minha senha"),
        el("a", { class: "link-acao", href: "index.html", id: "btn-voltar-site" }, ic("voltar"), "Voltar ao site")));
    if (msg) NE.aviso(msg, "erro", avisoBox);
    form.addEventListener("submit", (e) => { e.preventDefault(); NE.comCarregando(btn, async () => { await NE.dados.entrar(usuario.value, senha.value); await iniciar(); }); });
    raiz().replaceChildren(el("div", { class: "entrar" }, form));
  }

  // "Esqueci minha senha": manda um aviso direto para os administradores (sino e celular deles)
  function telaEsqueci(usuarioInicial = "") {
    $("main").className = "";
    const usuario = el("input", { class: "entrada", id: "esq-usuario", autocomplete: "username", autocapitalize: "none", value: usuarioInicial.trim(), required: true });
    const nome = el("input", { class: "entrada", id: "esq-nome", autocomplete: "name", placeholder: "Como você é chamado (opcional)" });
    const msg = el("textarea", { class: "entrada", id: "esq-msg", placeholder: "Quer deixar um recado? (opcional)", maxlength: "300" });
    const btn = el("button", { class: "btn btn-principal btn-bloco", type: "submit", id: "btn-enviar-esqueci" }, ic("enviar"), "Avisar o administrador");
    const avisoBox = el("div", {});
    const form = el("form", { class: "cartao" }, el("h1", {}, "Esqueci a senha"), el("p", {}, "Mandamos um aviso direto para a administração. Alguém vai te passar uma senha nova."), avisoBox,
      el("div", { class: "campo" }, el("label", { for: "esq-usuario" }, "Seu usuário"), usuario), el("div", { class: "campo" }, el("label", { for: "esq-nome" }, "Seu nome"), nome), el("div", { class: "campo" }, el("label", { for: "esq-msg" }, "Recado"), msg), btn,
      el("div", { class: "login-links" }, el("button", { type: "button", class: "link-acao", id: "btn-voltar-login", onclick: () => telaEntrar() }, ic("voltar"), "Voltar ao login")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      NE.comCarregando(btn, async () => {
        await NE.dados.pedirAjudaSenha({ usuario: usuario.value, nome: nome.value.trim(), mensagem: msg.value.trim() });
        const texto = `Olá! Esqueci a senha do Confere Carga. Meu usuário é "${usuario.value.trim()}"${nome.value.trim() ? ` (${nome.value.trim()})` : ""}. Pode me passar uma senha nova?`;
        const zap = C.whatsappAdmin || C.whatsapp ? `https://wa.me/${C.whatsappAdmin || C.whatsapp}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
        raiz().replaceChildren(el("div", { class: "entrar" }, el("section", { class: "cartao fim", id: "esqueci-enviado" }, el("div", { class: "selo ok", html: NE.icone.check }), el("h1", {}, "Aviso enviado"),
          el("p", {}, "A administração recebeu o seu pedido. Se for urgente, chame no WhatsApp também."),
          el("div", { style: "display:grid;gap:10px" }, el("a", { class: "btn btn-verde btn-bloco", href: zap, target: "_blank", rel: "noopener" }, ic("whatsapp"), "Chamar no WhatsApp"),
            el("button", { type: "button", class: "btn btn-secundario btn-bloco", onclick: () => telaEntrar() }, "Voltar ao login")))));
      });
    });
    raiz().replaceChildren(el("div", { class: "entrar" }, form));
  }

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
  iniciar();
})();
