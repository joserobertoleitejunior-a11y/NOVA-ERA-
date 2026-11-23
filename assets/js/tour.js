// Tutorial guiado sobre as telas reais. Simples e objetivo: poucas dicas, frases curtas.
// Enquanto ele está aberto a tela não rola; só avança tocando em "Próximo" ou no botão destacado.
(() => {
  const NE = window.NE;
  const { el } = NE;

  const TOURS = {
    passo: [
      { alvo: ".tela-titulo", titulo: "O que fazer", texto: "Faça o que está escrito aqui." },
      { alvo: "#btn-seguir", titulo: "Continuar", texto: "Terminou? Toque aqui. Se faltar algo, o app avisa." },
    ],
    conferente: [
      { alvo: "#btn-nova", titulo: "Conferir uma carga", texto: "Sem nota na fila? Toque aqui para conferir do zero." },
      { alvo: "#lista-minhas", titulo: "Fila de carga", texto: "Notas esperando conferência. Toque numa para conferir." },
      { alvo: "#nav-inferior", titulo: "Menu", texto: "Fila, estoque (conte rápido) e avisos." },
      { alvo: "#btn-sino", titulo: "Avisos", texto: "O app avisa aqui quando chegar nota ou pedirem contagem." },
    ],
    vendas: [
      { alvo: ".status-simples", titulo: "Suas notas", texto: "Verde: nada pendente. Amarelo: uma carga sua saiu com diferença ou uma nota sua está parada. Toque no botão." },
      { alvo: "#tile-nota", titulo: "O que você quer fazer?", texto: "Lançar nota, ver o estoque, suas notas e suas cargas. Cada botão abre um passo a passo." },
      { alvo: "#nav-inferior", titulo: "Menu", texto: "Notas, estoque (só consulta) e cargas. O resto fica em Mais." },
      { alvo: "#btn-sino", titulo: "Avisos", texto: "Você é avisado quando a carga de uma nota sua sai e, de lá, manda o rastreio ao cliente." },
      { alvo: "#fab-ia", titulo: "Assistente", texto: "Peça para lançar a nota, ver o estoque ou pegar o link de rastreio." },
    ],
    painel: [
      { alvo: ".status-simples", titulo: "Como está a empresa", texto: "Verde: tudo certo. Amarelo ou vermelho: toque em \"Resolver agora\"." },
      { alvo: "#tile-nota", titulo: "O que você quer fazer?", texto: "Cada botão abre um passo a passo. É só seguir as telas." },
      { alvo: "#nav-inferior", titulo: "Menu", texto: "Notas, estoque, cargas e o resto em Mais." },
      { alvo: "#btn-sino", titulo: "Avisos", texto: "Problemas chegam aqui na hora, e no celular." },
      { alvo: "#fab-ia", titulo: "Assistente", texto: "Pergunte qualquer coisa sobre a empresa." },
    ],
  };

  const bloquear = (e) => { if (!e.target.closest(".tour-balao")) e.preventDefault(); };
  const teclas = (e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key) && !e.target.closest(".tour-balao")) e.preventDefault(); };

  NE.iniciarTour = (tipo, { aoFim, verDicas } = {}) => {
    document.querySelector(".tour")?.remove();
    const passos = TOURS[tipo].filter((p) => document.querySelector(p.alvo));
    if (!passos.length) return aoFim?.();
    NE.memoria.gravar(`ne-tour-${tipo}`, true);
    let i = 0;
    const foco = el("div", { class: "tour-foco" });
    const balao = el("div", { class: "tour-balao", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-titulo" });
    const camada = el("div", { class: "tour" }, foco, balao);

    const terminar = () => {
      camada.remove();
      document.documentElement.classList.remove("sem-rolagem");
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("wheel", bloquear, { capture: true });
      window.removeEventListener("touchmove", bloquear, { capture: true });
      window.removeEventListener("keydown", teclas, { capture: true });
      aoFim?.();
    };
    const avancar = () => { if (i < passos.length - 1) { i++; desenhar(); } else terminar(); };

    function posicionar() {
      const alvo = document.querySelector(passos[i].alvo);
      if (!alvo) return;
      const r = alvo.getBoundingClientRect(), m = 6, margem = 12;
      Object.assign(foco.style, { top: `${r.top - m}px`, left: `${r.left - m}px`, width: `${r.width + m * 2}px`, height: `${r.height + m * 2}px` });
      const altura = balao.offsetHeight, tela = innerHeight;
      const cabeAbaixo = r.bottom + 14 + altura <= tela - margem;
      const cabeAcima = r.top - 14 - altura >= margem;
      let topo = cabeAbaixo ? r.bottom + 14 : cabeAcima ? r.top - 14 - altura : tela - altura - margem;
      balao.style.top = `${Math.max(margem, Math.min(topo, tela - altura - margem))}px`;
    }
    function desenhar() {
      const p = passos[i];
      const alvo = document.querySelector(p.alvo);
      // rola só por conta do tutorial (a pessoa não consegue rolar)
      document.documentElement.classList.remove("sem-rolagem");
      if (!alvo.closest(".topo, .acoes, .flutuantes, .nav-inferior, .fab-ia")) alvo.scrollIntoView({ block: "center", behavior: "instant" });
      document.documentElement.classList.add("sem-rolagem");
      const ultimo = i === passos.length - 1;
      balao.replaceChildren(
        el("div", { class: "tour-contagem" }, passos.map((_, k) => el("i", { class: k <= i ? "ativo" : "" }))),
        el("h2", { id: "tour-titulo" }, p.titulo), el("p", {}, p.texto),
        el("div", { class: "tour-botoes" },
          ultimo ? (verDicas ? el("button", { type: "button", class: "btn btn-secundario", onclick: () => { terminar(); verDicas(); } }, "Ver dicas") : null)
                 : el("button", { type: "button", class: "btn btn-secundario", onclick: terminar }, "Pular"),
          el("button", { type: "button", class: "btn btn-principal", id: "tour-proximo", onclick: avancar }, ultimo ? "Entendi" : "Próximo")));
      requestAnimationFrame(posicionar);
      balao.querySelector("#tour-proximo").focus({ preventScroll: true });
    }
    // Toque no botão destacado também avança; fora dele, nada acontece
    camada.addEventListener("click", (e) => {
      if (e.target.closest(".tour-balao")) return;
      const r = document.querySelector(passos[i].alvo)?.getBoundingClientRect();
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) avancar();
      else balao.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 220 });
    });
    window.addEventListener("resize", posicionar);
    window.addEventListener("wheel", bloquear, { capture: true, passive: false });
    window.addEventListener("touchmove", bloquear, { capture: true, passive: false });
    window.addEventListener("keydown", teclas, { capture: true });
    document.body.append(camada);
    desenhar();
  };
  // Na demonstração o tutorial não abre sozinho (os vídeos e as apresentações não podem ser interrompidos por ele)
  NE.tourJaVisto = (tipo) => !!(NE.demo && NE.demo.ativo) || !!NE.memoria.ler(`ne-tour-${tipo}`);
})();
