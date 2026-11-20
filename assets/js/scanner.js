// Leitor de QR/código pela câmera. Usa o leitor nativo do aparelho (BarcodeDetector) e, onde não existe, o ZXing local.
(() => {
  const NE = window.NE;
  const { el } = NE;

  // Abre a câmera dentro de `onde`. aoLer(texto) é chamado a cada leitura nova (com trava anti-repetição de 1,2 s).
  NE.scanner = async (onde, aoLer, { dica = "Aponte para o QR da etiqueta" } = {}) => {
    const video = el("video", { playsinline: true, muted: true, autoplay: true, "aria-label": "Câmera" });
    const moldura = el("div", { class: "moldura" });
    const caixa = el("div", { class: "leitor" }, video, moldura, el("div", { class: "dica-leitor" }, dica));
    onde.replaceChildren(caixa);
    let ativo = true, fluxo = null, ultimo = "", ultimoT = 0;
    const parar = () => { ativo = false; fluxo?.getTracks().forEach((t) => t.stop()); };
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
    } catch { caixa.replaceChildren(el("div", { class: "aviso alerta", style: "margin:16px" }, "Não consegui abrir a câmera. Libere a câmera nas permissões do navegador, ou conte sem ela.")); return { parar }; }
    video.srcObject = fluxo; await video.play().catch(() => {});
    const aceitar = (texto) => { const t = Date.now(); if (texto === ultimo && t - ultimoT < 1200) return; ultimo = texto; ultimoT = t; moldura.classList.add("lido"); setTimeout(() => moldura.classList.remove("lido"), 350); navigator.vibrate?.(40); aoLer(texto); };
    if ("BarcodeDetector" in window) {
      const det = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
      const volta = async () => { if (!ativo) return; try { const r = await det.detect(video); if (r[0]) aceitar(r[0].rawValue); } catch { /* quadro ruim */ } setTimeout(volta, 120); };
      volta();
    } else {
      await NE.carregarScript("assets/vendor/zxing.min.js"); const Z = window.ZXing;
      const leitor = new Z.MultiFormatReader(); leitor.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.CODE_128]], [Z.DecodeHintType.TRY_HARDER, true]]));
      const cv = document.createElement("canvas"); const g = cv.getContext("2d", { willReadFrequently: true });
      const volta = () => {
        if (!ativo) return;
        if (video.videoWidth) {
          const w = Math.min(video.videoWidth, 720); cv.width = w; cv.height = Math.round(video.videoHeight * (w / video.videoWidth)); g.drawImage(video, 0, 0, cv.width, cv.height);
          try { aceitar(leitor.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText()); } catch { /* nada neste quadro */ }
        }
        setTimeout(volta, 150);
      };
      volta();
    }
    return { parar };
  };
})();
