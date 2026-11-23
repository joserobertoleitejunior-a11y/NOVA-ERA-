// ETIQUETAS: o que imprimir e para quem. O desenho está em etiqueta-layout.js, o motor de impressão em impressao.js.
//   · etiqueta de NOTA ou CARGA: uma por produto (com a quantidade) ou uma por peça ("PEÇA 3 DE 40"). O QR abre o rastreio e o app conta peça por peça.
//   · etiqueta de PRODUTO: para pilha ou prateleira. O QR abre o produto no app (contagem, entrada, saída).
//   · cartão de ACESSO da equipe (ver equipe.js) e página de TESTE usam o mesmo motor.
(() => {
  const NE = window.NE;
  const Dados = window.NEEtiquetaDados;
  const { el } = NE;
  const C = window.NOVA_ERA || {};

  const base = () => C.urlPublica || location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  NE.urlBase = base;
  const plural = (n, um, varios) => `${NE.num(n)} ${n === 1 ? um : varios}`;
  const qtdDe = (i) => Number(i.qtd_carregada ?? i.quantidade ?? i.qtd_nota) || 0;

  // c: conferência (tem placa e o que foi carregado) ou nota (tipo "nota")
  NE.abrirEtiquetas = (c) => {
    const itens = c.itens || []; const total = itens.reduce((n, i) => n + qtdDe(i), 0); const numero = c.numero_nota || c.numero;
    return NE.imp.janelaEtiquetas({
      titulo: `Etiquetas da nota ${numero}`, etiqueta: `Nota ${numero}`, tipo: "nota", nomeArquivo: `etiquetas-nf-${numero}`,
      controles: [
        { id: "modo", rotulo: "Quantas etiquetas", tipo: "escolha", valor: "item", itens: [
          { valor: "item", rotulo: "Uma por produto", dica: plural(itens.length, "etiqueta com a quantidade", "etiquetas com a quantidade") },
          { valor: "peca", rotulo: "Uma por peça", dica: plural(total, "etiqueta numerada", "etiquetas numeradas") }] },
        { id: "copias", rotulo: "Cópias de cada etiqueta", tipo: "numero", valor: 1, min: 1, max: 10, quando: (v) => v.modo === "item" },
      ],
      gerar: (v) => Dados.daNota(c, { modo: v.modo, copias: v.copias, base: base() }),
    });
  };

  // produtos: lista de { id, nome, codigo, unidade, minimo, por_pilha }
  NE.etiquetasDeProduto = (produtos) => NE.imp.janelaEtiquetas({
    titulo: produtos.length === 1 ? `Etiqueta de ${produtos[0].nome}` : `Etiquetas de ${produtos.length} produtos`, etiqueta: "Produtos", tipo: "produto", nomeArquivo: "etiquetas-produtos",
    controles: [{ id: "copias", rotulo: "Cópias de cada produto", tipo: "numero", valor: 1, min: 1, max: 20 }],
    gerar: (v) => produtos.flatMap((p) => Dados.doProduto(p, { base: base(), copias: v.copias })),
  });

  // Para quem vê a etiqueta pela primeira vez
  NE.legendaEtiqueta = async () => {
    const f = window.NEEtiquetaLayout.FORMATOS.t100x50;
    const [lay] = await NE.imp.montar([{ tipo: "nota", cab: ["NF 48213", "PEÇA 3 DE 40"], nome: "Meio-fio 30 × 12", legenda: "LER NO APP", campos: [["Cliente", "JB Obras"], ["Caminhão", "ABC1D23"], ["Data", "23/11/2026"]], qr: { texto: window.NECodigos.nota(base(), "3f9a1c2e-1111-4222-8333-444455556666", "0-3"), codigo: "NF 48213 · 3/40" } }], f);
    const linhas = [["Faixa preta", "o número da nota e a peça (\"peça 3 de 40\") ou a quantidade."], ["Nome grande", "o produto que está na peça."], ["Campos pequenos", "cliente, caminhão e data."],
      ["QR code", "aponte a câmera do app em \"Ler QR\". Quem recebe a carga também pode ler com a câmera do celular e vê a entrega."], ["Código embaixo do QR", "se o QR estiver rasgado ou sujo, digite esse código no leitor."]];
    NE.janelaSimples({ etiqueta: "Etiquetas", titulo: "Como ler uma etiqueta", corpo: el("div", {},
      el("div", { class: "imp-previa" }, el("div", { class: "imp-previa-item", style: "max-width:380px", html: NE.imp.svg(lay, { mm: false, rotulo: "Exemplo de etiqueta" }) })),
      el("ol", { class: "imp-legenda", style: "margin-top:14px" }, linhas.map(([t, d]) => el("li", {}, el("span", {}, el("b", {}, `${t}: `), d)))),
      el("p", { class: "suave" }, "Todas as etiquetas seguem este mesmo desenho, em preto e branco, de qualquer tamanho.")) });
  };
})();
