// Assistente da Nova Era (Claude, no servidor). Consulta os dados reais e PREPARA ações por comando: cadastrar, lançar nota, conferir carga, estoque...
// Nada é gravado sem o toque em Confirmar: cada ação vira um cartão que mostra EXATAMENTE o que vai acontecer.
// Sem a chave da Anthropic o app nem oferece o assistente. Na demonstração o chat só consulta (cálculo local, sem anexos nem ações).
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const SUGESTOES = ["Resumo do dia", "O que saiu a mais esta semana?", "Estoque baixo", "Notas paradas", "O que contar hoje?", "Quem conferiu hoje?"];
  // O vendedor usa o assistente só para vender: sugestões e boas-vindas próprias
  const SUGESTOES_VENDAS = ["Minhas notas na fila", "Alguma carga minha saiu hoje?", "Minhas entregas com diferença", "Quanto tem de estoque para vender?"];
  const MODELOS_VENDAS = [["Lançar nota", "Lance a nota número "], ["Rastreio da nota", "Quero o link de rastreio da nota "], ["Cancelar nota", "Cancele a nota "], ["Estoque de um produto", "Quanto tem disponível de "]];
  const MODELOS = [["Cadastrar pessoas", "Cadastre estas pessoas (nome e função, uma por linha):\n"], ["Lançar nota", "Lance a nota número "], ["Entrada no estoque", "Lance uma entrada de "], ["Conferir carga", "Confira a carga da nota "], ["Pedir contagem", "Peça a contagem de "]];
  const SIM = /^(sim|confirmo|confirmar|confirma|pode|pode sim|pode fazer|pode ser|isso|isso mesmo|ok|okay|certo|manda ver|faz|faca|fazer|vai)$/;
  const NAO = /^(nao|cancela|cancelar|cancele|deixa|deixa pra la|esquece|desiste|para)$/;
  const ehRede = (e) => /Failed to (fetch|send)|NetworkError|network|Load failed|Sem internet/i.test(String((e && e.message) || e));
  let historico = [], resultados = [], contador = 0, anexos = [], cartoes = [];

  NE.abrirAssistente = async () => {
    if (document.querySelector(".folha-fundo")) return;
    const status = await NE.dados.iaDisponivel().catch(() => ({ ativo: false }));
    const real = !!(status.ativo && status.modo !== "local");
    const comAcoes = real && status.acoes === true;      // servidor novo: pode anexar e confirmar ações
    const vendas = comAcoes && status.escopo === "vendas";
    historico = []; resultados = []; contador = 0; anexos = []; cartoes = [];
    let enviando = false, subindo = 0;

    const chat = el("div", { class: "chat", id: "chat", "aria-live": "polite" });
    const campo = el("textarea", { class: "entrada", id: "chat-campo", rows: "1", placeholder: comAcoes ? "Escreva aqui…" : "Escreva sobre cargas, estoque, equipe…", autocomplete: "off", enterkeyhint: "send", "aria-label": "Mensagem" });
    const enviar = el("button", { type: "button", class: "btn btn-principal", id: "chat-enviar", "aria-label": "Enviar", html: NE.icone.enviar });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = SR && el("button", { type: "button", class: "btn btn-secundario", id: "chat-mic", "aria-label": "Falar", html: NE.icone.mic });
    const arquivo = comAcoes && el("input", { type: "file", id: "chat-arquivo", accept: "image/*,application/pdf,.pdf,.xml,text/xml,application/xml", multiple: true, hidden: true, "aria-label": "Anexar" });
    const clipe = comAcoes && el("button", { type: "button", class: "btn btn-secundario", id: "chat-anexar", "aria-label": "Anexar foto, PDF ou XML", html: NE.icone.clipe });
    const bandeja = el("div", { class: "chat-anexos", id: "chat-anexos", hidden: true });
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const sugConsulta = el("div", { class: "chat-sugestoes" }, (vendas ? SUGESTOES_VENDAS : SUGESTOES).map((x) => el("button", { type: "button", class: "chip", onclick: () => perguntar(x) }, x)));
    const sugAcao = comAcoes && el("div", { class: "chat-sugestoes" }, (vendas ? MODELOS_VENDAS : MODELOS).map(([rot, modelo]) => el("button", { type: "button", class: "chip chip-acao", onclick: () => { campo.value = modelo; ajustar(); campo.focus(); } }, rot)));
    const sug = el("div", { class: "chat-sugestoes-bloco" }, sugConsulta, sugAcao);
    const fundo = el("div", { class: "folha-fundo" }, el("div", { class: "folha", role: "dialog", "aria-modal": "true", "aria-label": "Assistente" },
      el("div", { class: "folha-topo" }, el("div", {}, el("h2", {}, "Assistente"), el("p", {}, comAcoes ? "Claude · você confirma antes de gravar" : real ? "Claude · responde com os dados da empresa" : "Respostas calculadas com os dados da empresa")), fechar),
      chat, sug, bandeja, el("div", { class: "chat-entrada" }, clipe, mic, campo, enviar, arquivo)));
    let mudou = false;   // alguma ação confirmada mexeu nos dados: a tela que está por baixo é redesenhada ao fechar o chat
    const fecharChat = () => { fundo.remove(); document.removeEventListener("keydown", tecla); };
    const sair = () => { fecharChat(); if (mudou) NE.app.recarregar?.(); };
    const tecla = (e) => { if (e.key === "Escape" && !document.querySelector(".janela-fundo[data-simples]")) sair(); };   // Esc fecha primeiro a janela que estiver por cima
    fechar.addEventListener("click", sair); fundo.addEventListener("click", (e) => { if (e.target === fundo) sair(); }); document.addEventListener("keydown", tecla);
    document.body.append(fundo);
    const rolar = () => { chat.scrollTop = chat.scrollHeight; };
    const ajustar = () => { if (!campo.value) { campo.style.height = ""; return; } campo.style.height = "auto"; campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`; };

    // ───────────── balões ─────────────
    const miniatura = (a) => (a.previa ? el("img", { src: a.previa, alt: a.nome }) : el("span", { class: "arq" }, ic("nota"), a.nome));
    const botaoAcao = (a) => {
      if (a.rastreio) {
        const link = NE.urlRastreio ? NE.urlRastreio(a.rastreio) : a.rastreio;
        const msg = `Olá${a.cliente ? ", " + a.cliente : ""}! Aqui é da Nova Era. A carga da sua nota ${a.numero} foi conferida e saiu do nosso pátio. Acompanhe a entrega por aqui: ${link}`;
        const copiar = el("button", { type: "button", class: "link-acao", onclick: async () => { try { await navigator.clipboard.writeText(link); NE.aviso("Link copiado.", "ok"); } catch { NE.aviso("Não deu para copiar. Toque e segure no link para copiar.", "alerta"); } } }, ic("copiar"), "Copiar link");
        return el("div", { class: "cp-acesso" }, el("div", {}, el("strong", {}, a.rotulo), el("div", { class: "cred" }, link)), copiar, el("a", { class: "link-acao verde", target: "_blank", rel: "noopener", href: `https://wa.me/?text=${encodeURIComponent(msg)}` }, ic("whatsapp"), "WhatsApp"));
      }
      return el("button", { type: "button", class: "link-acao", onclick: () => { fecharChat(); NE.app.ir(a.rota === "contagem" ? "contar" : a.rota, a.params || {}); } }, a.rotulo, ic("seguir"));
    };
    // Texto limpo: sem asteriscos, sem títulos com #, sem traço como marcador (mesmo que o servidor mande markdown)
    const limpo = (t) => String(t || "").replace(/\*\*(.+?)\*\*/gs, "$1").replace(/(^|\s)\*(\S[^*\n]*?)\*(?=\s|$|[.,;:!?])/g, "$1$2").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*•]\s+/gm, "• ").replace(/\s[—–]\s/g, ": ").replace(/\n{3,}/g, "\n\n").trim();
    // Botão "Imprimir" logo abaixo da resposta: o servidor monta a tabela com os MESMOS dados que o assistente mostrou (nunca com texto escrito por ele),
    // e o app abre a janela de impressão de relatórios (A4, A4 deitado, cupom 80/58 mm, planilha). O assistente termina a resposta com "Quer imprimir isto?".
    const blocoValido = (b) => !!b && typeof b.titulo === "string" && Array.isArray(b.colunas) && b.colunas.length > 0 && Array.isArray(b.linhas) && b.linhas.length > 0 && b.linhas.every(Array.isArray);
    const botaoImprimir = (b) => {
      const n = b.linhas.length; const quanto = `${n} ${n === 1 ? "linha" : "linhas"}`;
      const texto = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) : undefined);
      const coluna = (c) => ({ rotulo: String(c.rotulo ?? ""), ...(c.dir ? { dir: true } : {}), ...(["estado", "barra", "sinal"].includes(c.visual) ? { visual: c.visual } : {}), ...(texto(c.tons) ? { tons: texto(c.tons) } : {}), ...(texto(c.icones) ? { icones: texto(c.icones) } : {}), ...(Array.isArray(c.valores) ? { valores: c.valores.slice(0, b.linhas.length).map((v) => (Number.isFinite(v) ? v : null)) } : {}) });
      const bloco = { ...b, colunas: b.colunas.map(coluna), linhas: b.linhas.map((l) => l.map((v) => (v == null ? "" : String(v)))), resumo: Array.isArray(b.resumo) ? b.resumo.filter(Array.isArray) : [], graficos: Array.isArray(b.graficos) ? b.graficos.filter((g) => g && typeof g === "object") : [] };
      return el("button", { type: "button", class: "link-acao btn-imprimir-ia", "data-bloco": String(b.id || b.arquivo || ""), "aria-label": `Imprimir: ${b.titulo} (${quanto})`, title: b.subtitulo || b.titulo,
        onclick: () => (NE.abrirRelatorio ? NE.abrirRelatorio(bloco) : NE.aviso("A impressão não está disponível nesta tela.", "alerta")) }, ic("impressora"), el("span", { class: "imp-txt" }, `Imprimir: ${b.titulo}`, el("span", { class: "quanto" }, quanto)));
    };
    const bolha = (tipo, texto, acoes = [], mini = [], impressoes = []) => {
      const b = el("div", { class: `bolha ${tipo}` }, tipo === "ia" ? limpo(texto) : texto);
      if (mini.length) b.append(el("div", { class: "anexos-mini" }, mini.map(miniatura)));
      const imp = impressoes.filter(blocoValido); if (imp.length) b.append(el("div", { class: "acoes-linha imprimir-ia" }, imp.map(botaoImprimir)));
      if (acoes.length) b.append(el("div", { class: "acoes-linha" }, acoes.map(botaoAcao)));
      chat.append(b); rolar(); return b;
    };

    // ───────────── cartão de confirmação ─────────────
    const acessosEl = (lista) => {
      const U = NE.equipeUtil; if (!U) return null;
      return el("div", { class: "cp-acessos" },
        lista.map((p) => el("div", { class: "cp-acesso" }, el("div", {}, el("strong", {}, p.nome), el("div", { class: "cred" }, `Usuário: ${p.usuario || "(entra pelo e-mail)"} · Senha: ${p.senha}`)), el("a", { class: "link-acao verde", target: "_blank", rel: "noopener", href: U.zapBV(p) }, ic("whatsapp"), "WhatsApp"))),
        el("button", { type: "button", class: "link-acao", onclick: () => U.cartoes(lista, "Cartões de acesso") }, ic("qr"), "Cartões de acesso (QR e impressão)"));
    };
    const resultadoEl = (r) => el("div", { class: "cp-resultado" },
      el("div", { class: `aviso ${r.ok ? "ok" : "alerta"}` }, ic(r.ok ? "check" : "alerta"), el("span", {}, r.texto)),
      (r.itens || []).length > 1 ? el("ul", { class: "cp-itens" }, r.itens.map((i) => el("li", { class: i.ok ? "ok" : "erro" }, `${i.ok ? "✔" : "✘"} ${i.texto}${i.erro ? ` — ${i.erro}` : ""}`))) : null,
      (r.acessos || []).length ? acessosEl(r.acessos) : null,
      (r.acoes || []).length ? el("div", { class: "acoes-linha" }, r.acoes.map(botaoAcao)) : null);

    function cartao(p) {
      const alto = p.risco === "alto"; const estado = { p, fim: false, rodando: false };
      const confirmar = el("button", { type: "button", class: `btn ${alto ? "btn-principal" : "btn-verde"}`, "data-acao": "confirmar" }, ic("check"), "Confirmar");
      const cancelar = el("button", { type: "button", class: "btn btn-secundario", "data-acao": "cancelar" }, "Cancelar");
      const botoes = el("div", { class: "cp-botoes" }, confirmar, cancelar);
      const dica = el("p", { class: "cp-dica" }, alto ? "Esta ação pede o toque no botão." : "Toque em Confirmar ou diga \"sim\".");
      const caixa = el("div", { class: `cartao-proposta${alto ? " alto" : ""}`, role: "group", "aria-label": p.titulo },
        el("div", { class: "cp-topo" }, ic(alto ? "alerta" : "faisca"), el("strong", {}, p.titulo)),
        el("ul", { class: "cp-linhas" }, (p.linhas || []).map((l) => el("li", { class: /^\s{3,}/.test(l.t) ? "sub" : "", ...(l.s ? { "data-segredo": "1" } : {}) }, l.t.trim()))),
        (p.avisos || []).length ? el("div", { class: "cp-avisos" }, p.avisos.map((a) => el("p", {}, a))) : null, botoes, dica);
      const encerrar = (classe, ...filhos) => { estado.fim = true; clearTimeout(estado.timer); caixa.classList.add(classe); botoes.remove(); dica.remove(); caixa.querySelectorAll("[data-segredo], .cp-avisos").forEach((x) => x.remove()); caixa.append(...filhos.filter(Boolean)); rolar(); };
      estado.confirmar = async () => {
        if (estado.fim || estado.rodando) return;
        estado.rodando = true; confirmar.disabled = cancelar.disabled = true; confirmar.classList.add("carregando");
        try {
          const r = await NE.dados.iaExecutar(p.token);
          resultados.push(`${p.titulo}: ${r.ok ? "feito" : "não concluído"} — ${r.texto}`);
          if (r.ok || (r.itens || []).some((i) => i.ok)) mudou = true;
          encerrar(r.ok ? "feito" : "parcial", resultadoEl(r)); NE.app.atualizarSino?.();
        } catch (e) {
          const msg = String((e && e.message) || "");
          if (ehRede(e)) { estado.rodando = false; confirmar.disabled = cancelar.disabled = false; confirmar.classList.remove("carregando"); NE.aviso("Sem internet. Confira o sinal e toque em Confirmar de novo.", "alerta"); return; }
          if (/já foi executada/i.test(msg)) return encerrar("feito", el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, "Esta ação já tinha sido feita antes. Confira nas telas do app.")));
          resultados.push(`${p.titulo}: não feito — ${msg.slice(0, 200)}`);
          encerrar("erro", el("div", { class: "aviso erro" }, ic("alerta"), el("span", {}, /expirou/i.test(msg) ? `${msg}` : `Não foi feito. ${NE.mensagemErro(e)}`)));
        }
      };
      estado.cancelar = () => { if (estado.fim || estado.rodando) return; resultados.push(`${p.titulo}: a pessoa cancelou`); encerrar("cancelado", el("p", { class: "cp-dica" }, "Cancelado. Nada foi feito.")); };
      confirmar.addEventListener("click", () => estado.confirmar()); cancelar.addEventListener("click", () => estado.cancelar());
      estado.timer = setTimeout(() => { if (!estado.fim && !estado.rodando) encerrar("expirado", el("p", { class: "cp-dica" }, "Esta confirmação expirou. Peça de novo ao assistente.")); }, Math.max(1000, new Date(p.expira_em).getTime() - Date.now()));
      cartoes.push(estado); return caixa;
    }
    const pendentes = () => cartoes.filter((c) => !c.fim && !c.rodando);

    // ───────────── anexos ─────────────
    const desenharBandeja = () => {
      const novos = anexos.filter((a) => a.novo);
      bandeja.hidden = !novos.length && !subindo;
      bandeja.replaceChildren(...novos.map((a) => el("span", { class: "anexo-chip" }, a.previa ? el("img", { src: a.previa, alt: "" }) : ic("nota"), el("span", {}, `${a.id} · ${a.nome}`),
        el("button", { type: "button", class: "anexo-x", "aria-label": `Tirar ${a.nome}`, onclick: () => { anexos = anexos.filter((x) => x !== a); desenharBandeja(); } }, ic("fechar")))),
        ...(subindo ? [el("span", { class: "anexo-chip subindo" }, el("span", {}, `Enviando ${subindo}…`))] : []));
      enviar.disabled = subindo > 0;
    };
    async function adicionar(lista) {
      for (const f of lista) {
        if (anexos.length >= 12) { NE.aviso("No máximo 12 anexos por conversa."); break; }
        const id = `a${++contador}`; subindo++; desenharBandeja();
        try {
          if (/\.xml$/i.test(f.name || "") || /xml/i.test(f.type || "")) anexos.push({ id, tipo: "xml", nome: f.name || "nota.xml", dados: await NE.nfeXml.lerArquivo(f), novo: true });
          else {
            const blob = await NE.reduzirFoto(await NE.arquivoImagem(f));
            try { (await createImageBitmap(blob)).close?.(); } catch { throw new Error("Esse arquivo não abriu como imagem. Tire a foto de novo ou escolha outra."); }
            const caminho = await NE.dados.enviarFoto(blob, NE.app.perfil.id);
            anexos.push({ id, tipo: "imagem", nome: f.name && !/^image\.(jpe?g|png)$/i.test(f.name) ? f.name : `foto ${contador}.jpg`, caminho, previa: URL.createObjectURL(blob), novo: true });
          }
        } catch (e) { NE.aviso(`${f.name || "Arquivo"}: ${NE.mensagemErro(e)}`); }
        finally { subindo--; desenharBandeja(); }
      }
    }
    if (clipe) { clipe.addEventListener("click", () => arquivo.click()); arquivo.addEventListener("change", async () => { const l = [...arquivo.files]; arquivo.value = ""; await adicionar(l); }); }

    // ───────────── conversa ─────────────
    bolha("ia", vendas ? "Oi! Eu ajudo na venda: consulto as suas notas e cargas, vejo quanto tem de estoque para vender, lanço a nota (digitada, em foto ou XML) e pego o link de rastreio do cliente. Eu preparo e você confirma no cartão. Para foto ou XML da nota, use o clipe." : comAcoes ? "Oi! Eu respondo com os dados da Nova Era e também faço o trabalho por comando: cadastrar pessoas, lançar notas, conferir cargas, mexer no estoque, pedir contagem. Eu preparo e você confirma no cartão. Para nota, foto ou XML, use o clipe." : "Oi! Eu leio os dados da Nova Era e respondo na hora. Pode perguntar ou tocar numa sugestão.");
    async function perguntar(texto) {
      texto = (texto || campo.value).trim(); const novos = anexos.filter((a) => a.novo);
      if (enviando || subindo || (!texto && !novos.length)) return;
      campo.value = ""; ajustar(); sug.remove();
      const pend = pendentes();
      if (pend.length && !novos.length) {   // "sim" / "não" digitado ou falado vale para os cartões abertos
        const t = D.normalizar(texto);
        if (SIM.test(t)) {
          bolha("eu", texto); const altos = pend.filter((c) => c.p.risco === "alto"), simples = pend.filter((c) => c.p.risco !== "alto");
          for (const c of simples) await c.confirmar();
          if (altos.length) bolha("ia", simples.length ? "As outras pedem o toque no botão Confirmar do próprio cartão." : "Esta ação pede o toque no botão Confirmar do cartão (por segurança, só dizer sim não basta).");
          return;
        }
        if (NAO.test(t)) { bolha("eu", texto); pend.forEach((c) => c.cancelar()); bolha("ia", "Tudo bem, cancelei. Nada foi feito."); return; }
      }
      const pergunta = texto || "Veja os anexos e me diga o que dá para fazer com eles.";
      bolha("eu", texto || "(anexos)", [], novos); const espera = bolha("ia", ""); espera.append(el("span", { class: "pensando" }, el("i"), el("i"), el("i")));
      enviando = true; enviar.disabled = true; const enviados = resultados.splice(0);
      try {
        let r;
        if (real) r = await NE.dados.iaPerguntar(pergunta, historico.slice(-10), comAcoes ? { anexos: anexos.map(({ id, tipo, nome, caminho, dados, novo }) => ({ id, tipo, nome, caminho, dados, novo })), resultados: enviados } : {});
        else if (status.modo === "local") r = await NE.dados.iaPerguntar(pergunta);
        else r = D.responderLocal(pergunta, await NE.dados.contexto());
        novos.forEach((a) => { a.novo = false; }); desenharBandeja();
        historico.push({ papel: "user", texto: pergunta }, { papel: "assistant", texto: r.texto });
        espera.replaceWith(bolha("ia", r.texto, r.acoes || [], [], r.impressoes || [])); (r.propostas || []).forEach((p) => chat.append(cartao(p))); rolar();
      } catch (e) { resultados.unshift(...enviados); espera.replaceWith(bolha("ia", `Não consegui responder agora. ${NE.mensagemErro(e)}`)); }
      finally { enviando = false; enviar.disabled = subindo > 0; }
    }
    enviar.addEventListener("click", () => perguntar());
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); perguntar(); } });
    campo.addEventListener("input", ajustar);
    if (mic) mic.addEventListener("click", () => { try { const r = new SR(); r.lang = "pt-BR"; r.onresult = (e) => { campo.value = e.results[0][0].transcript; perguntar(); }; r.start(); } catch { NE.aviso("Não deu para usar o microfone.", "alerta"); } });
    campo.focus({ preventScroll: true });
  };
})();
