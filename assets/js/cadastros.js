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
      const d = { nome: "", funcao: "", papel: "", usuario: "", senha: gerarSenha(), usuarioEditado: false, telefone: "", email_contato: "", admissao: "", cnh_validade: "", observacao: "", fotos: [] };
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
            titulo: "Contato", icone: "whatsapp", ajuda: "Opcional. O WhatsApp aparece como botão na lista da equipe.",
            tela: () => {
              const teste = el("a", { class: "btn btn-verde btn-bloco", id: "cad-zap", target: "_blank", rel: "noopener", style: "margin-top:6px" }, ic("whatsapp"), "Testar no WhatsApp");
              const atualizar = () => { const l = NE.linkWhatsApp(d.telefone); teste.hidden = !l; if (l) teste.href = l; };
              const tel = NE.campoTexto("WhatsApp / celular", { id: "cad-tel", value: d.telefone, inputmode: "tel", placeholder: "(15) 99999-9999" }, (v, inp) => { d.telefone = NE.mascaraTelefone(v); if (inp.value !== d.telefone) inp.value = d.telefone; atualizar(); }, "Com DDD. É por aqui que a expedição fala com a pessoa.");
              atualizar();
              return el("div", {}, tel, teste,
                NE.campoTexto("E-mail (opcional)", { id: "cad-email", value: d.email_contato, type: "email", autocapitalize: "none", placeholder: "nome@empresa.com.br" }, (v) => { d.email_contato = v.trim(); }),
                el("div", { class: "campo" }, el("label", { for: "cad-adm" }, "Data de admissão (opcional)"), el("input", { class: "entrada", id: "cad-adm", type: "date", value: d.admissao, oninput: (e) => { d.admissao = e.target.value; } })),
                d.funcao === "motorista" && el("div", { class: "campo" }, el("label", { for: "cad-cnh" }, "Validade da CNH (opcional)"), el("span", { class: "dica" }, "O app avisa quando estiver perto de vencer."), el("input", { class: "entrada", id: "cad-cnh", type: "date", value: d.cnh_validade, oninput: (e) => { d.cnh_validade = e.target.value; } })),
                NE.campoTexto("Observação (opcional)", { id: "cad-obs", value: d.observacao, placeholder: "Ex.: turno da manhã, opera o munck" }, (v) => { d.observacao = v; }));
            },
            validar: () => (d.telefone && NE.soDigitos(d.telefone).length < 10 ? "O telefone precisa ter DDD e número (10 ou 11 dígitos), ou deixe em branco." : null),
          },
          {
            titulo: "Foto", icone: "camera", ajuda: "Opcional. Aparece ao lado do nome na equipe.",
            tela: (r) => NE.seletorFoto({ titulo: "Foto de perfil", dica: "Rosto de frente, com boa luz.", lista: d.fotos, varias: false, frontal: true, aoMudar: r }),
          },
          {
            titulo: "Acesso", icone: "lista", ajuda: "O que essa pessoa pode ver no app.",
            tela: (r) => el("div", {},
              NE.escolhaUnica([
                { valor: "funcionario", rotulo: "Só conferência", dica: "Faz conferências e vê só as dele" },
                { valor: "admin", rotulo: "Painel completo", dica: "Vê todas as conferências e faz cadastros" },
              ], d.papel, (v) => { d.papel = v; r(); }),
              d.papel === "admin" && el("div", { class: "aviso alerta", style: "margin-top:14px" }, ic("alerta"),
                el("span", {}, "Painel completo vê fotos e dados de todas as cargas e usa o assistente de IA. Dê só para quem é responsável."))),
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
              NE.linhaResumo("Nome", d.nome.trim()), NE.linhaResumo("Função", NE.funcoes[d.funcao]), NE.linhaResumo("WhatsApp", d.telefone || "—"), NE.linhaResumo("Foto", d.fotos.length ? "Sim" : "Sem foto"),
              NE.linhaResumo("Acesso", d.papel === "admin" ? "Painel completo" : "Só conferência"),
              NE.linhaResumo("Usuário", d.usuario), NE.linhaResumo("Senha", d.senha)),
          },
        ],
        async aoConcluir() {
          const foto = d.fotos[0] ? await NE.dados.enviarFoto(d.fotos[0].blob, (NE.app.perfil || {}).id) : null;
          await NE.dados.criarFuncionario({ nome: d.nome.trim(), usuario: d.usuario, senha: d.senha, funcao: d.funcao, papel: d.papel, telefone: NE.soDigitos(d.telefone) || null,
            email_contato: d.email_contato || null, admissao: d.admissao || null, cnh_validade: d.cnh_validade || null, observacao: d.observacao.trim() || null, foto });
          NE.telaFim(raiz, {
            titulo: "Funcionário cadastrado",
            texto: `Passe estes dados para ${d.nome.trim().split(" ")[0]}. Ele vai usar para entrar no app.`,
            extra: cartaoAcesso(d.usuario, d.senha, d.telefone, d.nome),
            botoes: [{ rotulo: "Cadastrar outro", icone: "mais", acao: () => NE.cadastros.funcionario(raiz, voltar) }, { rotulo: "Voltar ao painel", acao: voltar }],
          });
        },
      });
    },

    // ── Caminhão (frota) ─────────────────────────────
    caminhao(raiz, voltar) {
      const d = { placa: "", tipo: "", marca: "", modelo: "", ano: "", cor: "", capacidade_t: "", observacao: "", fotos: { frente: [], lateral: [], traseira: [], placa: [], outras: [] } };
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
            titulo: "Detalhes", icone: "nota", ajuda: "Tudo opcional, mas ajuda a reconhecer o caminhão e controlar a carga.",
            tela: () => el("div", {},
              el("div", { class: "form-linha" }, NE.campoTexto("Marca", { id: "cad-marca", value: d.marca, placeholder: "Ex.: Volkswagen" }, (v) => { d.marca = v; }), NE.campoTexto("Modelo", { id: "cad-modelo", value: d.modelo, placeholder: "Ex.: 24.250" }, (v) => { d.modelo = v; })),
              el("div", { class: "form-linha" }, NE.campoTexto("Ano", { id: "cad-ano", value: d.ano, inputmode: "numeric", maxlength: "4", placeholder: "2019" }, (v, i) => { d.ano = v.replace(/\D/g, "").slice(0, 4); if (i.value !== d.ano) i.value = d.ano; }), NE.campoTexto("Cor", { id: "cad-cor", value: d.cor, placeholder: "Vermelho" }, (v) => { d.cor = v; })),
              NE.campoTexto("Capacidade de carga (toneladas)", { id: "cad-cap", value: d.capacidade_t, inputmode: "decimal", placeholder: "Ex.: 14" }, (v, i) => { d.capacidade_t = v.replace(",", ".").replace(/[^0-9.]/g, ""); if (i.value !== d.capacidade_t) i.value = d.capacidade_t; }, "Usado para avisar se a carga passar do limite."),
              NE.campoTexto("Observação (opcional)", { id: "cad-desc", value: d.observacao, placeholder: "Ex.: munck de 8 t, pneus novos" }, (v) => { d.observacao = v; })),
            validar: () => (d.ano && (Number(d.ano) < 1980 || Number(d.ano) > new Date().getFullYear() + 1) ? "Confira o ano do caminhão." : null),
          },
          {
            titulo: "Fotos", icone: "camera", ajuda: "Opcional. Ajudam a achar o caminhão certo e provam o estado dele.",
            tela: (r) => el("div", {},
              NE.seletorFoto({ titulo: "Frente", lista: d.fotos.frente, varias: false, aoMudar: r }), NE.seletorFoto({ titulo: "Lateral", lista: d.fotos.lateral, varias: false, aoMudar: r }),
              NE.seletorFoto({ titulo: "Traseira", lista: d.fotos.traseira, varias: false, aoMudar: r }), NE.seletorFoto({ titulo: "Placa", lista: d.fotos.placa, varias: false, aoMudar: r }),
              NE.seletorFoto({ titulo: "Outras (avarias, carroceria, munck)", lista: d.fotos.outras, varias: true, aoMudar: r })),
          },
          {
            titulo: "Revisar", icone: "check", ajuda: "Confira antes de cadastrar.",
            tela: () => el("div", { class: "resumo" },
              NE.linhaResumo("Placa", d.placa), NE.linhaResumo("Tipo", NE.tiposVeiculo[d.tipo]), NE.linhaResumo("Veículo", [d.marca, d.modelo, d.ano].filter(Boolean).join(" ") || "—"),
              NE.linhaResumo("Cor", d.cor || "—"), NE.linhaResumo("Capacidade", d.capacidade_t ? `${d.capacidade_t} t` : "—"), NE.linhaResumo("Fotos", String(Object.values(d.fotos).flat().length))),
          },
        ],
        async aoConcluir() {
          const fotos = [];
          for (const [tipo, lista] of Object.entries(d.fotos)) for (const f of lista) fotos.push({ tipo, caminho: await NE.dados.enviarFoto(f.blob, (NE.app.perfil || {}).id) });
          await NE.dados.criarVeiculo({ placa: d.placa, tipo: d.tipo, marca: d.marca.trim() || null, modelo: d.modelo.trim() || null, ano: d.ano ? Number(d.ano) : null, cor: d.cor.trim() || null,
            capacidade_t: d.capacidade_t ? Number(d.capacidade_t) : null, descricao: d.observacao.trim() || null, fotos });
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

  function cartaoAcesso(usuario, senha, telefone, nome) {
    const base = (window.NOVA_ERA || {}).urlPublica || location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
    const texto = `Olá${nome ? ", " + nome.trim().split(" ")[0] : ""}! Seu acesso ao Confere Carga da Nova Era:\nEndereço: ${base.replace(/\/?$/, "/")}app.html\nUsuário: ${usuario}\nSenha: ${senha}`;
    const zap = NE.linkWhatsApp(telefone, texto);
    const copiar = el("button", { type: "button", class: "btn btn-azul btn-bloco", style: "margin-top:12px" }, "Copiar para mandar");
    copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(texto); NE.aviso("Copiado. Cole na conversa com o funcionário.", "ok"); }
      catch { NE.aviso("Não deu para copiar neste aparelho. Anote o usuário e a senha.", "alerta"); }
    });
    const bloco = el("div", { class: "resumo", style: "text-align:left;margin:0" }, NE.linhaResumo("Usuário", usuario), NE.linhaResumo("Senha", senha));
    return el("div", { style: "max-width:420px;margin:0 auto 22px" }, bloco,
      zap && el("a", { class: "btn btn-verde btn-bloco", style: "margin-top:12px", href: zap, target: "_blank", rel: "noopener" }, ic("whatsapp"), "Mandar no WhatsApp dele"), copiar,
      el("p", { style: "font-size:.85rem;margin:10px auto 0" }, "Por segurança, a senha não aparece de novo depois desta tela."));
  }
})();
