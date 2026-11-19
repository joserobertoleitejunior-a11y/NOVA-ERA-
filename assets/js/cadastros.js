// Cadastros passo a passo (funcionário, caminhão, produto) — mesmo jeito da conferência.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sugerirUsuario = (nome) => semAcento(nome.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const gerarSenha = () => {
    const pal = ["carga", "nota", "silo", "pátio", "caixa", "tubo", "laje", "munck"].map(semAcento);
    const n = new Uint32Array(2); crypto.getRandomValues(n);
    return `${pal[n[0] % pal.length]}${1000 + (n[1] % 9000)}`;
  };

  NE.cadastros = {
    // ── Funcionário ──────────────────────────────────
    funcionario(raiz, voltar) {
      const d = { nome: "", funcao: "", papel: "", usuario: "", senha: gerarSenha(), usuarioEditado: false };
      NE.assistente({
        raiz, rotuloFinal: "Cadastrar funcionário", aoCancelar: voltar,
        passos: [
          {
            titulo: "Nome", icone: "usuario", ajuda: "Como o funcionário é chamado no dia a dia.",
            tela: () => NE.campoTexto("Nome do funcionário", { id: "cad-nome", value: d.nome, placeholder: "Ex.: Carlos Souza", autocapitalize: "words" },
              (v) => { d.nome = v; if (!d.usuarioEditado) d.usuario = sugerirUsuario(v); }),
            validar: () => (d.nome.trim().length < 2 ? "Digite o nome do funcionário." : null),
          },
          {
            titulo: "Função", icone: "caixas", ajuda: "O que essa pessoa faz na empresa.",
            tela: (r) => NE.escolhaUnica([
              { valor: "conferente", rotulo: "Conferente", dica: "Confere a carga antes de sair" },
              { valor: "expedicao", rotulo: "Expedição", dica: "Organiza as saídas" },
              { valor: "vendedor", rotulo: "Vendedor", dica: "Manda o rastreio ao cliente" },
              { valor: "motorista", rotulo: "Motorista", dica: "Dirige o caminhão" },
              { valor: "ajudante", rotulo: "Ajudante", dica: "Ajuda a carregar" },
              { valor: "administrativo", rotulo: "Administrativo", dica: "Escritório" },
              { valor: "diretoria", rotulo: "Diretoria", dica: "Gestão" },
            ], d.funcao, (v) => { d.funcao = v; if (!d.papel) d.papel = ["expedicao", "diretoria", "vendedor"].includes(v) ? "admin" : "funcionario"; r(); }),
            validar: () => (!d.funcao ? "Toque na função do funcionário." : null),
          },
          {
            titulo: "Acesso", icone: "lista", ajuda: "O que essa pessoa pode ver no app.",
            tela: (r) => el("div", {},
              NE.escolhaUnica([
                { valor: "funcionario", rotulo: "Só conferência", dica: "Faz conferências e vê só as dele" },
                { valor: "admin", rotulo: "Painel completo", dica: "Vê todas as conferências e faz cadastros" },
              ], d.papel, (v) => { d.papel = v; r(); }),
              d.papel === "admin" && el("div", { class: "aviso alerta", style: "margin-top:14px" }, ic("alerta"),
                el("span", {}, "Painel completo vê fotos e dados de todas as cargas. Dê só para quem é responsável."))),
            validar: () => (!d.papel ? "Escolha o tipo de acesso." : null),
          },
          {
            titulo: "Usuário e senha", icone: "chave", ajuda: "É com isso que o funcionário entra no app.",
            tela: (r) => {
              const novaSenha = el("button", { type: "button", class: "btn btn-secundario", style: "min-height:48px;font-size:1rem" }, "Gerar outra senha");
              novaSenha.addEventListener("click", () => { d.senha = gerarSenha(); r(); });
              return el("div", {},
                NE.campoTexto("Usuário", { id: "cad-usuario", value: d.usuario, autocapitalize: "none", placeholder: "ex.: carlos" },
                  (v, inp) => { d.usuarioEditado = true; d.usuario = v.toLowerCase().replace(/[^a-z0-9._-]/g, ""); if (inp.value !== d.usuario) inp.value = d.usuario; },
                  "Sem espaço e sem acento. Sugerimos o primeiro nome."),
                NE.campoTexto("Senha", { id: "cad-senha", value: d.senha }, (v) => { d.senha = v; }, "Pelo menos 6 caracteres. Já deixamos uma pronta."),
                novaSenha);
            },
            validar: () => (!/^[a-z0-9._-]{3,30}$/.test(d.usuario) ? "O usuário precisa ter de 3 a 30 letras ou números."
              : d.senha.length < 6 ? "A senha precisa ter pelo menos 6 caracteres." : null),
          },
          {
            titulo: "Revisar", icone: "check", ajuda: "Confira antes de cadastrar.",
            tela: () => el("div", { class: "resumo" },
              NE.linhaResumo("Nome", d.nome.trim()), NE.linhaResumo("Função", NE.funcoes[d.funcao]),
              NE.linhaResumo("Acesso", d.papel === "admin" ? "Painel completo" : "Só conferência"),
              NE.linhaResumo("Usuário", d.usuario), NE.linhaResumo("Senha", d.senha)),
          },
        ],
        async aoConcluir() {
          await NE.dados.criarFuncionario({ nome: d.nome.trim(), usuario: d.usuario, senha: d.senha, funcao: d.funcao, papel: d.papel });
          NE.telaFim(raiz, {
            titulo: "Funcionário cadastrado",
            texto: `Passe estes dados para ${d.nome.trim().split(" ")[0]}. Ele vai usar para entrar no app.`,
            extra: cartaoAcesso(d.usuario, d.senha),
            botoes: [{ rotulo: "Cadastrar outro", icone: "mais", acao: () => NE.cadastros.funcionario(raiz, voltar) }, { rotulo: "Voltar ao painel", acao: voltar }],
          });
        },
      });
    },

    // ── Caminhão ─────────────────────────────────────
    caminhao(raiz, voltar) {
      const d = { placa: "", tipo: "", descricao: "" };
      NE.assistente({
        raiz, rotuloFinal: "Cadastrar caminhão", aoCancelar: voltar,
        passos: [
          {
            titulo: "Placa", icone: "caminhao", ajuda: "Digite a placa como está no caminhão.",
            tela: () => {
              const inp = el("input", { class: "entrada entrada-grande", id: "cad-placa", maxlength: "8", placeholder: "ABC1D23", value: d.placa, autocomplete: "off", autocapitalize: "characters" });
              inp.addEventListener("input", () => { d.placa = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
              return el("div", { class: "campo" }, el("label", { for: "cad-placa" }, "Placa"), el("span", { class: "dica" }, "Modelo Mercosul (ABC1D23) ou antigo (ABC1234)."), inp);
            },
            validar: () => (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(d.placa) ? "Placa inválida. Confira as letras e os números." : null),
          },
          {
            titulo: "Tipo", icone: "caminhao", ajuda: "Que caminhão é esse?",
            tela: (r) => NE.escolhaUnica([
              { valor: "caminhao", rotulo: "Caminhão", dica: "Carroceria comum" },
              { valor: "truck_munck", rotulo: "Truck com munck", dica: "Com guindaste" },
              { valor: "betoneira", rotulo: "Betoneira", dica: "Concreto" },
              { valor: "basculante", rotulo: "Basculante", dica: "Caçamba" },
              { valor: "outro", rotulo: "Outro" },
            ], d.tipo, (v) => { d.tipo = v; r(); }),
            validar: () => (!d.tipo ? "Toque no tipo do caminhão." : null),
          },
          {
            titulo: "Descrição", icone: "nota", ajuda: "Opcional. Ajuda a reconhecer o caminhão.",
            tela: () => NE.campoTexto("Descrição (opcional)", { id: "cad-desc", value: d.descricao, placeholder: "Ex.: VW 24.250 vermelho" }, (v) => { d.descricao = v; }),
          },
          {
            titulo: "Revisar", icone: "check", ajuda: "Confira antes de cadastrar.",
            tela: () => el("div", { class: "resumo" },
              NE.linhaResumo("Placa", d.placa), NE.linhaResumo("Tipo", NE.tiposVeiculo[d.tipo]), NE.linhaResumo("Descrição", d.descricao.trim() || "—")),
          },
        ],
        async aoConcluir() {
          await NE.dados.criarVeiculo({ placa: d.placa, tipo: d.tipo, descricao: d.descricao.trim() || null });
          NE.telaFim(raiz, {
            titulo: "Caminhão cadastrado", texto: `${d.placa} já aparece na lista da conferência.`,
            botoes: [{ rotulo: "Cadastrar outro", icone: "mais", acao: () => NE.cadastros.caminhao(raiz, voltar) }, { rotulo: "Voltar ao painel", acao: voltar }],
          });
        },
      });
    },

    // ── Produto ──────────────────────────────────────
    produto(raiz, voltar) {
      const d = { nome: "", unidade: "un" };
      NE.assistente({
        raiz, rotuloFinal: "Cadastrar produto", aoCancelar: voltar,
        passos: [
          {
            titulo: "Nome do produto", icone: "caixas", ajuda: "Escreva igual aparece na nota fiscal.",
            tela: () => NE.campoTexto("Nome", { id: "cad-produto", value: d.nome, placeholder: "Ex.: Caixa para galeria 1,00 x 1,00" }, (v) => { d.nome = v; },
              "Nome igual ao da nota deixa a conferência mais rápida."),
            validar: () => (d.nome.trim().length < 2 ? "Digite o nome do produto." : null),
          },
          {
            titulo: "Unidade", icone: "conferir", ajuda: "Como esse produto é contado na nota.",
            tela: (r) => NE.escolhaUnica([
              { valor: "un", rotulo: "Unidade", dica: "Peças (padrão)" },
              { valor: "m", rotulo: "Metro", dica: "Ex.: meio-fio por metro" },
              { valor: "m3", rotulo: "Metro cúbico", dica: "Ex.: concreto" },
              { valor: "t", rotulo: "Tonelada" },
            ], d.unidade, (v) => { d.unidade = v; r(); }),
          },
          {
            titulo: "Revisar", icone: "check", ajuda: "Confira antes de cadastrar.",
            tela: () => el("div", { class: "resumo" }, NE.linhaResumo("Produto", d.nome.trim()), NE.linhaResumo("Unidade", NE.unidades[d.unidade])),
          },
        ],
        async aoConcluir() {
          await NE.dados.criarProduto({ nome: d.nome.trim(), unidade: d.unidade });
          NE.telaFim(raiz, {
            titulo: "Produto cadastrado", texto: `"${d.nome.trim()}" já aparece na conferência.`,
            botoes: [{ rotulo: "Cadastrar outro", icone: "mais", acao: () => NE.cadastros.produto(raiz, voltar) }, { rotulo: "Voltar ao painel", acao: voltar }],
          });
        },
      });
    },
  };

  NE.unidades = { un: "Unidade", m: "Metro", m3: "Metro cúbico", t: "Tonelada" };

  function cartaoAcesso(usuario, senha) {
    const texto = `Confere Carga · Nova Era\nUsuário: ${usuario}\nSenha: ${senha}`;
    const copiar = el("button", { type: "button", class: "btn btn-azul btn-bloco", style: "margin-top:12px" }, "Copiar para mandar no WhatsApp");
    copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(texto); NE.aviso("Copiado. Cole na conversa com o funcionário.", "ok"); }
      catch { const s = getSelection(); const r = document.createRange(); r.selectNodeContents(bloco); s.removeAllRanges(); s.addRange(r); NE.aviso("Texto selecionado. Copie pelo menu do celular.", "alerta"); }
    });
    const bloco = el("div", { class: "resumo", style: "text-align:left;margin:0" }, NE.linhaResumo("Usuário", usuario), NE.linhaResumo("Senha", senha));
    return el("div", { style: "max-width:420px;margin:0 auto 22px" }, bloco, copiar,
      el("p", { style: "font-size:.85rem;margin:10px auto 0" }, "Por segurança, a senha não aparece de novo depois desta tela."));
  }
})();
