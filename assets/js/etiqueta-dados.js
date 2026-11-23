// DADOS das etiquetas: transforma nota, conferência, produto ou pessoa no que a etiqueta mostra (ver etiqueta-layout.js para o desenho).
// Só montagem de texto e de código QR; roda igual no navegador e nos testes.
(function (raiz) {
  "use strict";
  const K = () => raiz.NECodigos;
  const num = (n) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(n) || 0);
  const dataBR = (iso) => { try { return new Date(iso || Date.now()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return ""; } };
  const MAX_ETIQUETAS = 600;

  // c = conferência (numero_nota, placa, itens com qtd_carregada) ou nota (numero, vendedor, itens com quantidade).
  // modo "item": uma etiqueta por produto com a quantidade · modo "peca": uma por peça, numerada ("PEÇA 3 DE 40").
  function daNota(c, { modo = "item", copias = 1, base } = {}) {
    const numero = String(c.numero_nota || c.numero || ""); const token = c.token_publico || c.id || "";
    const qtd = (i) => Number(i.qtd_carregada ?? i.quantidade ?? i.qtd_nota) || 0;
    const campos = [["Cliente", c.cliente || ""], c.placa ? ["Caminhão", c.placa] : ["Vendedor", c.vendedor || ""], ["Data", dataBR(c.criado_em)]];
    const especs = [];
    (c.itens || []).forEach((i, idx) => {
      const n = qtd(i);
      if (modo === "peca") {
        for (let k = 1; k <= n; k++) especs.push({ tipo: "nota", cab: [`NF ${numero}`, `PEÇA ${k} DE ${num(n)}`], nome: i.descricao, campos, legenda: "LER NO APP", qr: { texto: K().nota(base, token, `${idx}-${k}`), codigo: K().codigoCurto.peca(numero, k, num(n)) } });
      } else {
        for (let k = 0; k < copias; k++) especs.push({ tipo: "nota", cab: [`NF ${numero}`, `QTD ${num(n)}`], nome: i.descricao, campos, legenda: "LER NO APP", qr: { texto: K().nota(base, token, ""), codigo: K().codigoCurto.nota(numero) } });
      }
    });
    return especs;
  }

  function doProduto(p, { base, copias = 1 } = {}) {
    const un = String(p.unidade || "un");
    const e = { tipo: "produto", cab: ["PRODUTO", p.por_pilha ? `PILHA DE ${num(p.por_pilha)}` : un.toUpperCase()], nome: p.nome, legenda: "LER NO APP",
      campos: [["Código", p.codigo || ""], ["Mínimo", Number(p.minimo) > 0 ? num(p.minimo) : ""], ["Unidade", un]], qr: { texto: K().produto(base, p.id), codigo: K().codigoCurto.produto(p.id) } };
    return Array.from({ length: Math.max(1, copias) }, () => e);
  }

  // Cartão de acesso: usuário, senha e o QR que abre o app (link de boas-vindas)
  function deAcesso(p, { link, funcaoRotulo } = {}) {
    return [{ tipo: "acesso", emLinha: true, cab: ["ACESSO · CONFERE CARGA", String(funcaoRotulo || "").toUpperCase()], nome: p.nome, legenda: "ABRA COM O CELULAR",
      campos: [["Usuário", p.usuario || "(entra pelo e-mail)"], ["Senha", p.senha || ""]], qr: { texto: link, codigo: "" } }];
  }

  const teste = (formato) => ({ tipo: "teste", cab: ["TESTE", ""], nome: formato.rotulo, qr: { texto: "NOVA ERA · TESTE DE IMPRESSAO", codigo: "" } });

  const API = { MAX_ETIQUETAS, num, dataBR, daNota, doProduto, deAcesso, teste };
  raiz.NEEtiquetaDados = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
