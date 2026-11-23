// LEITOR DE QR: uma janela só, igual em todas as telas que precisam ler uma etiqueta.
// Três jeitos de ler, para nunca travar ninguém no pátio:
//   1. a câmera (aponta e lê);   2. uma foto do QR (galeria ou foto tirada na hora);   3. digitar o número da nota ou o código curto embaixo do QR.
// O que foi lido chega pronto para a tela: { tipo: "peca" | "nota" | "produto" | "numero" | "codigo", … } (ver codigos.js).
(() => {
  const NE = window.NE;
  const K = () => window.NECodigos;
  const { el, ic } = NE;

  // Procura a nota ou o produto que o código aponta. Quem chamou passa as listas que já tem.
  const acharNota = (obj, notas) => (notas || []).find((n) => (obj.token && n.token_publico === obj.token) || (obj.numero && String(n.numero ?? n.numero_nota) === String(obj.numero))) || null;
  const acharProduto = (obj, produtos) => {
    const ps = produtos || [];
    if (obj.id) return ps.find((p) => p.id === obj.id) || null;
    if (obj.texto) { const um = ps.find((p) => K().casaProduto(obj.texto, p)); if (um) return um; const N = window.NEDominio.normalizar; const t = N(obj.texto); const lista = ps.filter((p) => N(p.nome).includes(t)); return lista.length === 1 ? lista[0] : null; }
    return null;
  };

  // Lê o QR de uma foto (câmera nativa do celular tira a foto e o app decodifica).
  async function decodificarFoto(arquivo) {
    const img = await createImageBitmap(await NE.arquivoImagem(arquivo));
    if ("BarcodeDetector" in window) { try { const r = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(img); if (r[0]) return r[0].rawValue; } catch { /* tenta o outro leitor */ } }
    await NE.carregarScript("assets/vendor/zxing.min.js"); const Z = window.ZXing;
    const cv = document.createElement("canvas"); const k = Math.min(1, 1600 / Math.max(img.width, img.height)); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const leitor = new Z.MultiFormatReader(); leitor.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE]], [Z.DecodeHintType.TRY_HARDER, true]]));
    try { return leitor.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText(); } catch { return null; }
  }

  const QUE_E = { peca: "uma peça de nota", nota: "uma nota", produto: "um produto", numero: "um número de nota", codigo: "um texto que não é número de nota", desconhecido: "outra coisa" };
  const PEDE = { peca: "a etiqueta de uma peça", nota: "a etiqueta de uma nota", produto: "a etiqueta de um produto" };

  // opcoes: { titulo, dica, aceita: ["peca","nota","produto"], continuo, digitar: "Digite o número da nota", aoLer(obj, texto) → false para manter aberto }
  NE.lerQR = (opcoes = {}) => {
    const aceita = opcoes.aceita || ["peca", "nota", "produto"]; const continuo = !!opcoes.continuo;
    const onde = el("div", { id: "leitor-onde" }); const msg = el("div", { id: "leitor-msg", "aria-live": "polite" }); let leitor = null; let ocupado = false; let janela = null;
    const campo = el("input", { class: "entrada", id: "leitor-digitar", type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "characters", placeholder: opcoes.digitar || "Número da nota ou código do produto", "aria-label": "Digitar o código" });
    const buscar = el("button", { type: "button", class: "btn btn-azul", id: "leitor-buscar" }, "Buscar");
    const arq = el("input", { type: "file", accept: "image/*", capture: "environment", id: "leitor-foto", hidden: true, "aria-label": "Foto do QR" });
    const foto = el("label", { class: "btn btn-secundario botao-camera", id: "leitor-foto-rotulo" }, ic("camera"), "Ler de uma foto", arq);
    const parar = () => { leitor?.parar(); leitor = null; };
    const fechar = () => { parar(); janela?.fechar(); };

    // aceita se o tipo lido serve para esta tela; "número" vale como nota e "código" como produto
    const serve = (obj) => aceita.includes(obj.tipo) || (obj.tipo === "numero" && (aceita.includes("nota") || aceita.includes("peca"))) || (obj.tipo === "codigo" && aceita.includes("produto"));
    async function tratar(texto) {
      if (ocupado) return; const obj = K().interpretar(texto); if (obj.tipo === "vazio") return;
      if (!serve(obj)) { NE.aviso(`Esse QR é de ${QUE_E[obj.tipo] || "outra coisa"}. Aqui eu leio ${aceita.map((t) => PEDE[t]).join(" ou ")}.`, "alerta", msg); return; }
      ocupado = true;
      try { const r = await opcoes.aoLer?.(obj, texto); msg.replaceChildren(); if (r !== false && !continuo) fechar(); } catch (e) { NE.aviso(NE.mensagemErro(e), "erro", msg); } finally { ocupado = false; }
    }
    buscar.addEventListener("click", () => { const t = campo.value.trim(); if (!t) return campo.focus(); tratar(t); });
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscar.click(); } });
    arq.addEventListener("change", async () => {
      const f = arq.files?.[0]; arq.value = ""; if (!f) return;
      try { const t = await decodificarFoto(f); if (!t) return NE.aviso("Não achei um QR nessa foto. Chegue mais perto, sem sombra, e tire de novo.", "alerta", msg); await tratar(t); } catch (e) { NE.aviso(NE.mensagemErro(e), "erro", msg); }
    });
    janela = NE.janelaSimples({ etiqueta: "QR code", titulo: opcoes.titulo || "Ler QR code",
      corpo: el("div", {}, onde, msg, el("p", { class: "suave", style: "margin:0 0 10px" }, opcoes.dica || `Aponte a câmera para ${aceita.map((t) => PEDE[t]).join(" ou ")}.`),
        el("div", { class: "campo" }, el("label", { for: "leitor-digitar" }, "Não lê? Digite o código"), el("div", { style: "display:flex;gap:8px" }, campo, buscar)), foto) });
    new MutationObserver((_, o) => { if (!document.body.contains(janela.fundo)) { parar(); o.disconnect(); } }).observe(document.body, { childList: true });
    NE.scanner(onde, tratar, { dica: "Aponte para o QR da etiqueta" }).then((l) => { if (!document.body.contains(janela.fundo)) l.parar(); else leitor = l; });
    return { fechar };
  };
  NE.lerQR.acharNota = acharNota; NE.lerQR.acharProduto = acharProduto; NE.lerQR.decodificarFoto = decodificarFoto;

  // Botão padrão de "Ler QR" para qualquer tela
  NE.botaoLerQR = (opcoes, { rotulo = "Ler QR", id = "btn-ler-qr", classe = "btn btn-azul" } = {}) =>
    el("button", { type: "button", class: classe, id, onclick: () => NE.lerQR(opcoes) }, ic("qr"), rotulo);
})();
