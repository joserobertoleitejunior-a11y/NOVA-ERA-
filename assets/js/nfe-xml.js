// Lê o XML da NF-e (o arquivo que a empresa já tem). Tira número, chave, cliente e itens: zero digitação.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const tag = (no, nome) => { const e = no.getElementsByTagName(nome)[0]; return e ? e.textContent.trim() : ""; };

  function ler(texto) {
    const doc = new DOMParser().parseFromString(texto, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("Este arquivo não é um XML válido.");
    const inf = doc.getElementsByTagName("infNFe")[0];
    if (!inf) throw new Error("Não parece uma NF-e (faltou o bloco infNFe).");
    const ide = inf.getElementsByTagName("ide")[0]; const dest = inf.getElementsByTagName("dest")[0];
    const chaveId = (inf.getAttribute("Id") || "").replace(/\D/g, "");
    const chave = D.validarChave(chaveId) ? chaveId : tag(doc, "chNFe");
    const itens = [...inf.getElementsByTagName("det")].map((d) => {
      const p = d.getElementsByTagName("prod")[0];
      return { codigo: tag(p, "cProd"), descricao: tag(p, "xProd"), quantidade: Number(tag(p, "qCom").replace(",", ".")) || 0 };
    }).filter((i) => i.descricao && i.quantidade > 0);
    const numero = ide ? tag(ide, "nNF") : "";
    if (!numero || !itens.length) throw new Error("A nota veio sem número ou sem itens.");
    return { numero: String(Number(numero)), cliente: dest ? tag(dest, "xNome") : "", chave_nfe: D.validarChave(chave) ? chave : "", itens };
  }

  NE.nfeXml = { ler, lerArquivo: async (arq) => ler(await arq.text()) };
})();
