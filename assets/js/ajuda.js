// Guia "Como usar": passo a passo ilustrado para o conferente e para o painel.
// Abre sozinho no primeiro acesso de cada pessoa e fica disponível no botão Ajuda.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;

  const GUIAS = {
    conferente: [
      { icone: "caminhao", titulo: "Antes do caminhão sair", texto: "Toda carga é conferida com a nota antes de sair do pátio. Leva uns 2 minutos e protege você e a empresa.", exemplo: () => botaoFalso("Nova conferência", "caminhao") },
      { icone: "caminhao", titulo: "1. Escolha o caminhão", texto: "Toque na placa do caminhão que vai sair. Se não estiver na lista, digite a placa.", exemplo: () => el("div", { class: "grade-escolha" }, cartaoFalso("ABC1D23", "Caminhão", true), cartaoFalso("RST8U45", "Truck com munck")) },
      { icone: "nota", titulo: "2. Nota fiscal", texto: "Tire uma foto da nota inteira, com o código de barras aparecendo. O app lê o número sozinho. Se não conseguir, é só digitar." },
      { icone: "caixas", titulo: "3. Itens da nota", texto: "Toque nos produtos que estão na nota e coloque a quantidade escrita nela." },
      { icone: "conferir", titulo: "4. Conferir a carga", texto: "Olhe o caminhão. Se a quantidade bate, toque em Confere. Se não bate, toque em Diferente e diga quantos subiram.", exemplo: () => el("div", { class: "par-botoes" }, el("span", { class: "opcao confere", "aria-pressed": "true" }, ic("check"), "Confere"), el("span", { class: "opcao diferente" }, ic("alerta"), "Diferente")) },
      { icone: "camera", titulo: "5. Fotos", texto: "Tire a foto do caminhão carregado e da placa. Se tiver peça quebrada ou dano, tire foto da avaria também." },
      { icone: "check", titulo: "6. Revisar e registrar", texto: "Confira o resumo. Se tiver diferença, explique o motivo. Toque em Registrar e pronto: fica tudo guardado." },
    ],
    painel: [
      { icone: "lista", titulo: "Conferências do dia", texto: "No topo você vê quantas cargas saíram, quantas conferem e quantas tiveram diferença. As com diferença ficam em laranja.", exemplo: () => el("div", { class: "numeros" }, numeroFalso("7", "conferências"), numeroFalso("6", "conferem", "ok"), numeroFalso("1", "com diferença", "alerta")) },
      { icone: "camera", titulo: "Ver itens e fotos", texto: "Toque numa conferência para ver o que estava na nota, o que subiu no caminhão, o motivo e as fotos." },
      { icone: "usuario", titulo: "Funcionários", texto: "Cadastre cada pessoa passo a passo. O app cria usuário e senha para você mandar no WhatsApp. Quando alguém sair da empresa, desligue o acesso." },
      { icone: "caminhao", titulo: "Caminhões e produtos", texto: "Cadastre os caminhões e os produtos com o mesmo nome da nota. Assim a conferência fica rápida." },
      { icone: "chave", titulo: "Registro protegido", texto: "Depois de registrada, nenhuma conferência pode ser alterada ou apagada. Ela vale como prova da carga que saiu." },
    ],
  };

  NE.abrirGuia = (tipo, raiz, aoFechar) => {
    const passos = GUIAS[tipo].map((g) => ({
      titulo: g.titulo, icone: g.icone, ajuda: null,
      tela: () => el("div", { class: "guia" }, el("p", { class: "guia-texto" }, g.texto), g.exemplo && el("div", { class: "guia-exemplo", "aria-hidden": "true" }, g.exemplo())),
    }));
    NE.memoria.gravar(`ne-guia-${tipo}`, true);
    NE.assistente({ raiz, passos, rotuloPasso: "Dica", rotuloFinal: "Entendi", aoConcluir: async () => aoFechar(), aoCancelar: aoFechar });
  };
  NE.guiaJaVisto = (tipo) => !!NE.memoria.ler(`ne-guia-${tipo}`);

  const botaoFalso = (t, i) => el("span", { class: "btn btn-principal btn-bloco btn-gigante" }, ic(i), t);
  const cartaoFalso = (placa, tipo, marcado) => el("span", { class: "escolha", "aria-pressed": String(!!marcado) }, el("strong", {}, el("span", { class: "placa-br" }, placa)), el("span", {}, tipo));
  const numeroFalso = (n, t, c = "") => el("div", { class: `numero ${c}` }, el("b", {}, n), el("span", {}, t));
})();
