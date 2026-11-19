// Tutorial guiado em cima das telas de verdade: destaca cada botão e explica o que ele faz.
(() => {
  const NE = window.NE;
  const { el } = NE;

  const TOURS = {
    // Durante qualquer passo a passo (não perde o que já foi preenchido)
    passo: [
      { alvo: ".passos", titulo: "Onde você está", texto: "Esta barra mostra em qual passo você está e quantos faltam." },
      { alvo: ".tela-titulo", titulo: "O que fazer agora", texto: "O título e a frase embaixo dizem exatamente o que fazer nesta tela." },
      { alvo: "#btn-seguir", titulo: "Continuar", texto: "Quando terminar, toque aqui. Se faltar alguma coisa, o app avisa em vermelho o que é." },
      { alvo: "#btn-voltar", titulo: "Voltar", texto: "Errou algo? Volte um passo. Nada do que você preencheu se perde." },
    ],
    conferente: [
      { alvo: "#btn-nova", titulo: "Comece por aqui", texto: "Toque neste botão sempre que um caminhão for sair. O app te guia passo a passo, uma pergunta por tela." },
      { alvo: ".cartao-guia", titulo: "Dicas com exemplos", texto: "Esqueceu como faz? Aqui tem as 7 dicas da conferência, com exemplos." },
      { alvo: "#lista-minhas", titulo: "Suas conferências", texto: "Tudo que você conferiu hoje fica aqui. Toque numa para abrir a janela com itens, fotos e local." },
      { alvo: "#btn-ajuda", titulo: "Ajuda sempre à mão", texto: "Este tutorial e as dicas ficam neste botão. Pode abrir quando quiser." },
    ],
    painel: [
      { alvo: ".numeros", titulo: "Resumo do dia", texto: "Quantas cargas saíram, quantas conferem e quantas tiveram diferença." },
      { alvo: ".navegador-dia", titulo: "Trocar o dia", texto: "Use as setas para ver outros dias. Toque no meio para voltar para hoje." },
      { alvo: ".filtros .chips", titulo: "Filtrar", texto: "Toque em \"Com diferença\" para ver só as cargas que não bateram com a nota." },
      { alvo: ".conf", titulo: "Abrir uma conferência", texto: "Toque para abrir a janela com tudo: itens, fotos em tela cheia, local, conferente e o resumo para o WhatsApp." },
      { alvo: ".abas", titulo: "Cadastros", texto: "Funcionários, caminhões e produtos. Todo cadastro é passo a passo." },
      { alvo: "#btn-nova-painel", titulo: "Conferir daqui também", texto: "Quem é da expedição também pode fazer conferência por aqui." },
      { alvo: "#btn-ajuda", titulo: "Ajuda sempre à mão", texto: "Este tutorial e as dicas ilustradas ficam neste botão." },
    ],
  };

  NE.iniciarTour = (tipo, { aoFim, verDicas } = {}) => {
    document.querySelector(".tour")?.remove();
    const passos = TOURS[tipo].filter((p) => document.querySelector(p.alvo));
    if (!passos.length) return aoFim?.();
    NE.memoria.gravar(`ne-tour-${tipo}`, true);
    let i = 0;
    const foco = el("div", { class: "tour-foco" });
    const balao = el("div", { class: "tour-balao", role: "dialog", "aria-live": "polite", "aria-labelledby": "tour-titulo" });
    const camada = el("div", { class: "tour" }, foco, balao);
    const terminar = () => { camada.remove(); window.removeEventListener("resize", posicionar); aoFim?.(); };
    function posicionar() {
      const alvo = document.querySelector(passos[i].alvo);
      if (!alvo) return;
      const r = alvo.getBoundingClientRect(), m = 6;
      Object.assign(foco.style, { top: `${r.top - m}px`, left: `${r.left - m}px`, width: `${r.width + m * 2}px`, height: `${r.height + m * 2}px` });
      const abaixo = r.bottom + 12 + balao.offsetHeight < innerHeight - 12;
      balao.style.top = `${abaixo ? r.bottom + 14 : Math.max(12, r.top - balao.offsetHeight - 14)}px`;
    }
    function desenhar() {
      const p = passos[i];
      const alvo = document.querySelector(p.alvo);
      alvo.scrollIntoView({ block: "center", behavior: "instant" });
      const ultimo = i === passos.length - 1;
      balao.replaceChildren(
        el("div", { class: "tour-contagem" }, `${i + 1} de ${passos.length}`),
        el("h2", { id: "tour-titulo" }, p.titulo), el("p", {}, p.texto),
        el("div", { class: "tour-botoes" },
          el("button", { type: "button", class: "btn btn-leve", onclick: terminar }, ultimo ? "Fechar" : "Pular"),
          ultimo && verDicas ? el("button", { type: "button", class: "btn btn-secundario", onclick: () => { terminar(); verDicas(); } }, "Ver dicas") : null,
          el("button", { type: "button", class: "btn btn-principal", id: "tour-proximo", onclick: () => { if (ultimo) return terminar(); i++; desenhar(); } }, ultimo ? "Entendi" : "Próximo")));
      requestAnimationFrame(posicionar);
      balao.querySelector("#tour-proximo").focus({ preventScroll: true });
    }
    camada.addEventListener("click", (e) => { if (e.target === camada || e.target === foco) { if (i < passos.length - 1) { i++; desenhar(); } else terminar(); } });
    window.addEventListener("resize", posicionar);
    document.body.append(camada);
    desenhar();
  };
  NE.tourJaVisto = (tipo) => !!NE.memoria.ler(`ne-tour-${tipo}`);
})();
