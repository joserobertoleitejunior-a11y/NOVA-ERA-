// Equipe: registrar funcionário em segundos — nome e pronto (usuário e senha saem sozinhos), vários de uma vez,
// e um CARTÃO DE ACESSO com QR para imprimir ou mandar no WhatsApp.
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
    if (params.novo) return cadastroRapido(raiz, app);
    const lista = el("div", { class: "lista-simples" }, el("div", { class: "esqueleto" }));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Equipe"), el("p", {}, "Quem entra no app e o que cada um vê.")),
      el("button", { type: "button", class: "btn btn-principal", id: "btn-cadastrar", onclick: () => app.ir("equipe", { novo: "1" }) }, ic("mais"), "Cadastrar")), lista);
    const pessoas = await NE.dados.funcionarios(); const hoje = Date.now();
    lista.replaceChildren(...pessoas.map((p) => {
      const cnh = p.cnh_validade ? Math.floor((new Date(p.cnh_validade).getTime() - hoje) / D.DIA) : null;
      return el("div", {},
        el("button", { type: "button", class: "pessoa-linha link-acao", style: "text-align:left;font-weight:inherit", onclick: () => editar(p, app) }, NE.avatar(p.nome, p.foto),
          el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, `${NE.funcoes[p.funcao] || p.funcao} · usuário: ${p.usuario || "—"}${p.papel === "admin" ? " · painel completo" : ""}`),
            p.telefone && el("div", { class: "meta" }, NE.mascaraTelefone(p.telefone)), cnh !== null && cnh <= 45 && el("span", { class: `etiqueta ${cnh < 0 ? "erro" : "alerta"}` }, cnh < 0 ? "CNH vencida" : `CNH vence em ${cnh} dias`))),
        el("div", { class: "pessoa-acoes" }, NE.linkWhatsApp(p.telefone) && el("a", { class: "btn-zap", href: NE.linkWhatsApp(p.telefone, `Olá, ${p.nome.split(" ")[0]}!`), target: "_blank", rel: "noopener", "aria-label": `Chamar ${p.nome} no WhatsApp`, html: NE.icone.whatsapp }),
          NE.chave(p.ativo, "Pode entrar", (v) => NE.dados.alterarFuncionario(p.id, { ativo: v }))));
    }));
  };

  // Ficha da pessoa: contato, foto, função e acesso; nova senha
  function editar(p, app) {
    const d = { telefone: NE.mascaraTelefone(p.telefone), email_contato: p.email_contato || "", admissao: p.admissao || "", cnh_validade: p.cnh_validade || "", observacao: p.observacao || "", funcao: p.funcao, papel: p.papel, fotos: [] };
    const corpo = el("div", {}); let j;
    const desenhar = () => {
      const zap = NE.linkWhatsApp(d.telefone);
      corpo.replaceChildren(el("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:14px" }, NE.avatar(p.nome, d.fotos[0] ? null : p.foto, 64), el("div", {}, el("strong", {}, p.nome), el("div", { class: "meta" }, `usuário: ${p.usuario}`))),
        NE.seletorFoto({ titulo: "Foto de perfil", lista: d.fotos, varias: false, frontal: true, aoMudar: desenhar }),
        NE.campoTexto("WhatsApp / celular", { id: "ed-tel", value: d.telefone, inputmode: "tel", placeholder: "(15) 99999-9999" }, (v, i) => { d.telefone = NE.mascaraTelefone(v); if (i.value !== d.telefone) i.value = d.telefone; }),
        zap && el("a", { class: "btn btn-verde btn-bloco", href: zap, target: "_blank", rel: "noopener", style: "margin-bottom:12px" }, ic("whatsapp"), "Abrir conversa no WhatsApp"),
        NE.campoTexto("E-mail", { id: "ed-email", value: d.email_contato, type: "email" }, (v) => { d.email_contato = v.trim(); }),
        el("div", { class: "campo" }, el("label", { for: "ed-adm" }, "Data de admissão"), el("input", { class: "entrada", id: "ed-adm", type: "date", value: d.admissao, oninput: (e) => { d.admissao = e.target.value; } })),
        d.funcao === "motorista" && el("div", { class: "campo" }, el("label", { for: "ed-cnh" }, "Validade da CNH"), el("input", { class: "entrada", id: "ed-cnh", type: "date", value: d.cnh_validade, oninput: (e) => { d.cnh_validade = e.target.value; } })),
        el("div", { class: "campo" }, el("label", {}, "Função"), el("div", { class: "chips" }, FUNCOES.map(([v, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(d.funcao === v), onclick: () => { d.funcao = v; desenhar(); } }, nome)))),
        el("div", { class: "campo" }, el("label", {}, "Acesso"), NE.escolhaUnica([{ valor: "funcionario", rotulo: "Só conferência" }, { valor: "admin", rotulo: "Painel completo" }], d.papel, (v) => { d.papel = v; desenhar(); })),
        NE.campoTexto("Observação", { id: "ed-obs", value: d.observacao }, (v) => { d.observacao = v; }),
        el("button", { type: "button", class: "link-acao", onclick: () => nova(p) }, ic("chave"), "Gerar nova senha"));
    };
    desenhar();
    const salvar = el("button", { type: "button", class: "btn btn-principal", id: "btn-salvar-pessoa" }, ic("check"), "Salvar");
    salvar.addEventListener("click", () => NE.comCarregando(salvar, async () => {
      if (d.telefone && NE.soDigitos(d.telefone).length < 10) return NE.aviso("O telefone precisa ter DDD e número.", "erro");
      const campos = { telefone: NE.soDigitos(d.telefone) || null, email_contato: d.email_contato || null, admissao: d.admissao || null, cnh_validade: d.funcao === "motorista" ? d.cnh_validade || null : null, observacao: d.observacao.trim() || null, funcao: d.funcao, papel: d.papel };
      if (d.fotos[0]) campos.foto = await NE.dados.enviarFoto(d.fotos[0].blob, app.perfil.id);
      await NE.dados.alterarFuncionario(p.id, campos); j.fechar(); NE.aviso("Ficha salva.", "ok"); app.recarregar();
    }));
    j = NE.janelaSimples({ etiqueta: NE.funcoes[p.funcao] || "Equipe", titulo: "Ficha", corpo, rodape: [salvar] });
  }

  async function nova(p) {
    const r = await NE.dados.redefinirSenha(p.id); cartoes([{ nome: p.nome, usuario: r.usuario || p.usuario, senha: r.senha, funcao: p.funcao }], "Nova senha");
  }

  // Cadastro rápido: um nome por linha (ex.: colar do WhatsApp). Função escolhida uma vez para todos.
  function cadastroRapido(raiz, app) {
    let funcao = "conferente"; const area = el("textarea", { class: "entrada lote-area", id: "lote-nomes", placeholder: "Um por linha (telefone é opcional):\nCarlos Souza 15 99999-0001\nMarcos Lima\nJoão Pedro 15 98888-0002" });
    const previa = el("div", { id: "previa-lote", class: "suave" });
    const atualizarPrevia = () => { const n = nomes().length; previa.textContent = n ? `${D.plural(n, "pessoa", "pessoas")} para cadastrar. Usuário e senha são criados sozinhos.` : ""; };
    area.addEventListener("input", atualizarPrevia);
    // cada linha: "Nome" ou "Nome 15 99999-0000" (telefone opcional no fim da linha)
    const nomes = () => area.value.split(/\n|;/).map((x) => x.trim()).filter((x) => x.length > 1).map((linha) => { const m = linha.match(/^(.*?)[\s,\-–]*((?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4})\s*$/); return m && NE.soDigitos(m[2]).length >= 10 ? { nome: m[1].trim(), telefone: NE.soDigitos(m[2]) } : { nome: linha, telefone: null }; }).filter((x) => x.nome.length > 1);
    const chips = el("div", { class: "chips" });
    const desenharChips = () => chips.replaceChildren(...FUNCOES.map(([v, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(funcao === v), onclick: () => { funcao = v; desenharChips(); } }, nome)));
    desenharChips();
    const ok = el("button", { type: "button", class: "btn btn-principal btn-bloco btn-gigante", id: "btn-cadastrar-lote" }, ic("check"), "Cadastrar todos");
    ok.addEventListener("click", () => NE.comCarregando(ok, async () => {
      const ns = nomes(); if (!ns.length) return NE.aviso("Escreva pelo menos um nome.", "erro");
      const existentes = new Set((await NE.dados.funcionarios()).map((p) => p.usuario)); const usados = new Set(existentes);
      const lote = ns.map(({ nome, telefone }) => { let u = usuarioDe(nome) || "usuario"; let k = 2; const base = u; while (usados.has(u)) u = `${base}${k++}`; usados.add(u); return { nome, telefone, usuario: u, senha: senhaNova(), funcao, papel: papelDe(funcao) }; });
      const r = await NE.dados.criarFuncionarios(lote);
      const criados = r.filter((x) => x.ok).map((x) => { const l = lote.find((y) => y.nome === x.nome || y.usuario === x.usuario) || {}; return { nome: x.nome || l.nome, usuario: x.usuario || l.usuario, senha: x.senha || l.senha, funcao, telefone: l.telefone }; });
      const falhas = r.filter((x) => !x.ok);
      if (falhas.length) NE.aviso(`${falhas.length} não foi cadastrado: ${falhas[0].erro}`, "alerta");
      if (criados.length) cartoes(criados, "Cartões de acesso", () => app.ir("equipe", {}, { substituir: true })); else app.ir("equipe", {}, { substituir: true });
    }));
    raiz.replaceChildren(el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Cadastrar equipe"), el("p", {}, "Só o nome. O resto é automático.")), el("button", { type: "button", class: "link-acao", onclick: () => app.voltar() }, ic("voltar"), "Voltar")),
      el("div", { class: "cartao" }, el("div", { class: "campo" }, el("label", {}, "Função de todos"), chips), el("div", { class: "campo" }, el("label", { for: "lote-nomes" }, "Nomes"), area), previa),
      el("div", { style: "height:14px" }), ok);
  }

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
})();
