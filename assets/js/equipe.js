// Equipe: lista simples (toque numa pessoa para mudar algo) e cartão de acesso. Cadastro e edição são passo a passo (guiados.js).
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const usuarioDe = (nome) => semAcento(nome.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const PAL = ["carga", "nota", "silo", "patio", "caixa", "tubo", "laje", "munck", "brita", "areia"];
  const senhaNova = () => { const n = new Uint32Array(2); crypto.getRandomValues(n); return `${PAL[n[0] % PAL.length]}${1000 + (n[1] % 9000)}`; };
  const FUNCOES = [["conferente", "Conferente"], ["motorista", "Motorista"], ["ajudante", "Ajudante"], ["expedicao", "Expedição"], ["vendedor", "Vendedor"], ["administrativo", "Administrativo"], ["diretoria", "Diretoria"]];
  const papelDe = (f) => (["expedicao", "diretoria", "vendedor"].includes(f) ? "admin" : "funcionario");
  const urlApp = () => { const b = (window.NOVA_ERA || {}).urlPublica || location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, ""); return `${b.replace(/\/?$/, "/")}app.html`; };

  NE.rotas.equipe = async (raiz, params, app) => {
    const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Equipe"), el("p", {}, "Toque numa pessoa para mudar algo."))),
      el("button", { type: "button", class: "btn btn-principal btn-bloco", id: "btn-cadastrar", onclick: () => app.ir("guia", { fluxo: "novaPessoa" }) }, ic("mais"), "Cadastrar uma pessoa"), el("div", { style: "height:10px" }), lista);
    const pessoas = await NE.dados.funcionarios(); const hoje = Date.now();
    lista.replaceChildren(...pessoas.map((p) => {
      const cnh = p.cnh_validade ? Math.floor((new Date(p.cnh_validade).getTime() - hoje) / D.DIA) : null;
      return el("div", {},
        el("button", { type: "button", class: "pessoa-linha link-acao", style: "text-align:left;font-weight:inherit", onclick: () => app.ir("guia", { fluxo: "pessoa", id: p.id }) }, NE.avatar(p.nome, p.foto),
          el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, `${NE.funcoes[p.funcao] || p.funcao}${p.papel === "admin" ? " · administração" : ""}`), cnh !== null && cnh <= 45 && el("span", { class: `etiqueta ${cnh < 0 ? "erro" : "alerta"}` }, cnh < 0 ? "CNH vencida" : `CNH vence em ${cnh} dias`))),
        el("div", { class: "pessoa-acoes" }, NE.linkWhatsApp(p.telefone) && el("a", { class: "btn-zap", href: NE.linkWhatsApp(p.telefone, `Olá, ${p.nome.split(" ")[0]}!`), target: "_blank", rel: "noopener", "aria-label": `Chamar ${p.nome} no WhatsApp`, html: NE.icone.whatsapp }),
          NE.chave(p.ativo, "Pode entrar", (v) => NE.dados.alterarFuncionario(p.id, { ativo: v }))));
    }));
  };

  // Cartão de acesso: nome, usuário, senha e QR que abre o app já com o usuário preenchido
  async function cartoes(lista, titulo, aoFechar) {
    let svgs = []; try { await NE.carregarScript("assets/vendor/qrcode.js"); svgs = lista.map((p) => { const q = window.qrcode(0, "M"); q.addData(`${urlApp()}#u=${encodeURIComponent(p.usuario)}`); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); }); } catch { /* sem QR */ }
    const card = (p, i) => el("div", { class: "cartao-acesso" }, el("div", {}, el("h3", {}, p.nome), el("div", { class: "cred" }, `Usuário: ${p.usuario}`), el("div", { class: "cred" }, `Senha: ${p.senha}`), el("small", {}, `${NE.funcoes[p.funcao] || ""} · Nova Era · Confere Carga`), el("small", {}, urlApp().replace(/^https?:\/\//, ""))), svgs[i] && el("div", { class: "qr", html: svgs[i] }));
    const zap = (p) => NE.linkWhatsApp(p.telefone, `Olá, ${p.nome.split(" ")[0]}! Seu acesso ao Confere Carga da Nova Era:\nEndereço: ${urlApp()}\nUsuário: ${p.usuario}\nSenha: ${p.senha}`) || `https://wa.me/?text=${encodeURIComponent(`Olá, ${p.nome.split(" ")[0]}! Seu acesso ao Confere Carga da Nova Era:\nEndereço: ${urlApp()}\nUsuário: ${p.usuario}\nSenha: ${p.senha}`)}`;
    const grade = el("div", { class: "grade-cartoes" }, lista.map(card));
    const envios = el("div", { style: "display:grid;gap:8px;margin-top:12px" }, lista.map((p) => el("a", { class: "link-acao verde", target: "_blank", rel: "noopener", href: zap(p) }, ic("whatsapp"), `Mandar para ${p.nome.split(" ")[0]} no WhatsApp`)));
    const imprimir = el("button", { type: "button", class: "btn btn-azul", onclick: () => { const area = el("div", { id: "area-cartoes" }, lista.map(card)); document.body.append(area); document.body.classList.add("imprimindo-cartoes"); window.print(); setTimeout(() => { document.body.classList.remove("imprimindo-cartoes"); area.remove(); }, 500); } }, ic("etiqueta"), "Imprimir cartões");
    const j = NE.janelaSimples({ etiqueta: "Pronto", titulo, corpo: el("div", {}, el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, "Guarde ou entregue agora: a senha não aparece de novo.")), grade, envios), rodape: [imprimir] });
    j.fundo.addEventListener("click", (e) => { if (e.target === j.fundo) aoFechar?.(); });
    j.fundo.querySelector(".janela-fechar").addEventListener("click", () => aoFechar?.());
  }

  NE.equipeUtil = { cartoes, usuarioDe, senhaNova, papelDe, FUNCOES };
})();
