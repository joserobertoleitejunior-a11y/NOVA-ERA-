// CÓDIGOS das etiquetas: o que vai dentro de cada QR e como o app entende o que leu.
// Uma regra só, usada ao imprimir (etiquetas.js) e ao ler (leitor.js). Sem dependência de tela: roda igual nos testes.
//
//   Peça da nota      https://…/rastreio.html?c=<código da nota>&p=<produto>-<peça>   (o cliente também lê: abre o rastreio)
//   Nota inteira      https://…/rastreio.html?c=<código da nota>
//   Produto           https://…/app.html#p=<código do produto>                       (abre o produto no app de quem está logado)
//   Digitado à mão    48213  (número da nota) ou o código curto impresso embaixo do QR
(function (raiz) {
  "use strict";

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const comBarra = (base) => `${String(base || "").replace(/\/?$/, "/")}`;

  const nota = (base, token, p) => `${comBarra(base)}rastreio.html?c=${token}${p ? `&p=${p}` : ""}`;
  const produto = (base, id) => `${comBarra(base)}app.html#p=${id}`;

  // Texto curto que vai impresso embaixo do QR: serve para achar a etiqueta mesmo se o QR estiver rasgado
  const codigoCurto = { nota: (numero) => `NF ${numero}`, peca: (numero, k, n) => `NF ${numero} · ${k}/${n}`, produto: (id) => `P-${String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}` };

  // O que o QR (ou o que foi digitado) quer dizer.
  //   { tipo: "peca", token, p, idx, k }   uma peça de uma nota
  //   { tipo: "nota", token }              a nota inteira
  //   { tipo: "produto", id }              um produto
  //   { tipo: "numero", numero }           número de nota digitado
  //   { tipo: "codigo", texto }            código curto de produto digitado (P-1A2B3C4D) ou outro texto sem endereço
  //   { tipo: "desconhecido", texto }      QR de outra coisa
  //   { tipo: "vazio" }
  function interpretar(texto) {
    const t = String(texto == null ? "" : texto).trim();
    if (!t) return { tipo: "vazio" };
    let u = null; if (/^https?:\/\//i.test(t)) { try { u = new URL(t); } catch { u = null; } }   // "nota: 77" também é um endereço válido para o navegador: só vale http(s)
    if (u) {
      const c = u.searchParams.get("c");
      if (c && UUID.test(c)) {
        const p = u.searchParams.get("p") || ""; const m = /^(\d+)-(\d+)$/.exec(p);
        return m ? { tipo: "peca", token: c.toLowerCase(), p, idx: Number(m[1]), k: Number(m[2]) } : { tipo: "nota", token: c.toLowerCase() };
      }
      const h = /(?:^|[#&])p=([A-Za-z0-9_-]{1,64})(?:&|$)/.exec(u.hash || "");   // o código do produto (no app de verdade é um UUID; na demonstração, algo curto como p3)
      if (h) return { tipo: "produto", id: UUID.test(h[1]) ? h[1].toLowerCase() : h[1] };
      return { tipo: "desconhecido", texto: t };
    }
    const n = /^(?:nf|nota|nº|n°)?\s*[-:.]?\s*(\d{1,9})$/i.exec(t.replace(/\s+/g, " "));
    if (n) return { tipo: "numero", numero: n[1] };
    return { tipo: "codigo", texto: t };
  }

  // Quando o QR é de produto digitado como código curto: P-1A2B3C4D casa com o começo do id
  const casaProduto = (texto, p) => {
    const t = String(texto || "").trim().toLowerCase().replace(/^p-/, "").replace(/-/g, "");
    if (!t) return false;
    if (p.codigo && String(p.codigo).trim().toLowerCase() === String(texto).trim().toLowerCase()) return true;
    return t.length >= 6 && /^[0-9a-f]+$/.test(t) && String(p.id).replace(/-/g, "").toLowerCase().startsWith(t);
  };

  const API = { UUID, nota, produto, codigoCurto, interpretar, casaProduto };
  raiz.NECodigos = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (raiz.NE) raiz.NE.codigos = API;
})(typeof window !== "undefined" ? window : globalThis);
