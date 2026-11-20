// Assistente da Nova Era (Claude, no servidor). Responde com dados reais da empresa e leva direto à tela certa.
// Sem a chave da Anthropic configurada, o mesmo chat responde com cálculo local (resumo, estoque, notas, equipe).
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;
  const SUGESTOES = ["Resumo do dia", "O que saiu a mais esta semana?", "Estoque baixo", "Notas paradas", "O que contar hoje?", "Quem conferiu hoje?"];
  let historico = [];

  NE.abrirAssistente = async () => {
    if (document.querySelector(".folha-fundo")) return;
    const status = await NE.dados.iaDisponivel().catch(() => ({ ativo: false }));
    const chat = el("div", { class: "chat", id: "chat", "aria-live": "polite" });
    const campo = el("input", { class: "entrada", id: "chat-campo", placeholder: "Pergunte sobre cargas, estoque, equipe…", autocomplete: "off", enterkeyhint: "send" });
    const enviar = el("button", { type: "button", class: "btn btn-principal", id: "chat-enviar", "aria-label": "Enviar", html: NE.icone.enviar });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = SR && el("button", { type: "button", class: "btn btn-secundario", id: "chat-mic", "aria-label": "Falar", html: NE.icone.mic });
    const fechar = el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const sug = el("div", { class: "chat-sugestoes" }, SUGESTOES.map((s) => el("button", { type: "button", class: "chip", onclick: () => perguntar(s) }, s)));
    const fundo = el("div", { class: "folha-fundo" }, el("div", { class: "folha", role: "dialog", "aria-modal": "true", "aria-label": "Assistente" },
      el("div", { class: "folha-topo" }, el("div", {}, el("h2", {}, "Assistente"), el("p", {}, status.ativo && status.modo !== "local" ? "Claude · responde com os dados da empresa" : "Respostas calculadas com os dados da empresa")), fechar),
      chat, sug, el("div", { class: "chat-entrada" }, mic, campo, enviar)));
    const sair = () => { fundo.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => { if (e.key === "Escape") sair(); };
    fechar.addEventListener("click", sair); fundo.addEventListener("click", (e) => { if (e.target === fundo) sair(); }); document.addEventListener("keydown", tecla);
    document.body.append(fundo);

    const bolha = (tipo, texto, acoes = []) => {
      const b = el("div", { class: `bolha ${tipo}` }, texto);
      if (acoes.length) b.append(el("div", { class: "acoes-linha" }, acoes.map((a) => el("button", { type: "button", class: "link-acao", onclick: () => { sair(); NE.app.ir(a.rota === "contagem" ? "contar" : a.rota, a.params || {}); } }, a.rotulo, ic("seguir")))));
      chat.append(b); chat.scrollTop = chat.scrollHeight; return b;
    };
    bolha("ia", `Oi! Eu leio os dados da Nova Era e respondo na hora. Pode perguntar ou tocar numa sugestão.`);
    async function perguntar(texto) {
      texto = (texto || campo.value).trim(); if (!texto) return; campo.value = ""; sug.remove();
      bolha("eu", texto); const espera = bolha("ia", ""); espera.append(el("span", { class: "pensando" }, el("i"), el("i"), el("i")));
      try {
        let r;
        if (status.ativo && status.modo !== "local") r = await NE.dados.iaPerguntar(texto, historico.slice(-8));
        else if (status.modo === "local") r = await NE.dados.iaPerguntar(texto);
        else r = D.responderLocal(texto, await NE.dados.contexto());
        historico.push({ papel: "user", texto }, { papel: "assistant", texto: r.texto });
        espera.replaceWith(bolha("ia", r.texto, r.acoes || []));
      } catch (e) { espera.replaceWith(bolha("ia", `Não consegui responder agora. ${NE.mensagemErro(e)}`)); }
    }
    enviar.addEventListener("click", () => perguntar()); campo.addEventListener("keydown", (e) => { if (e.key === "Enter") perguntar(); });
    if (mic) mic.addEventListener("click", () => { try { const r = new SR(); r.lang = "pt-BR"; r.onresult = (e) => { campo.value = e.results[0][0].transcript; perguntar(); }; r.start(); } catch { NE.aviso("Não deu para usar o microfone.", "alerta"); } });
    campo.focus({ preventScroll: true });
  };
})();
