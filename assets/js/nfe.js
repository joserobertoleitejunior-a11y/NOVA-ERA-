// Leitura do número da nota pela foto: decodifica o código de barras da DANFE (chave de acesso de 44 dígitos),
// confere o dígito verificador e extrai número, série e CNPJ do emitente. Sem internet de IA, sem custo.
(() => {
  const NE = window.NE;
  const ZXING = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
  const JSBARCODE = "https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js";

  // Chave: cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
  const dvChave = (d43) => {
    let soma = 0, peso = 2;
    for (let i = d43.length - 1; i >= 0; i--) { soma += Number(d43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
    const r = 11 - (soma % 11);
    return r >= 10 ? 0 : r;
  };
  const validarChave = (ch) => /^\d{44}$/.test(ch) && dvChave(ch.slice(0, 43)) === Number(ch[43]) && ["55", "65"].includes(ch.slice(20, 22));
  const interpretar = (ch) => ({
    chave: ch, modelo: ch.slice(20, 22), cnpj: ch.slice(6, 20),
    serie: String(Number(ch.slice(22, 25))), numero: String(Number(ch.slice(25, 34))),
    emissao: `${ch.slice(4, 6)}/20${ch.slice(2, 4)}`,
  });
  const extrairChave = (texto) => {
    const so = String(texto || "").replace(/\D/g, "");
    for (let i = 0; i + 44 <= so.length; i++) { const c = so.slice(i, i + 44); if (validarChave(c)) return c; }
    return null;
  };

  function canvasDe(bmp, larguraMax, girar) {
    const esc = Math.min(1, larguraMax / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
    const cv = document.createElement("canvas");
    cv.width = girar ? h : w; cv.height = girar ? w : h;
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (girar) { g.translate(h, 0); g.rotate(Math.PI / 2); }
    g.drawImage(bmp, 0, 0, w, h);
    return cv;
  }

  // Acha na imagem as faixas com muitas listras finas seguidas (o código de barras), para recortar
  // só ele: nas DANFEs o código fica dentro de um quadro, e a linha da borda atrapalha o leitor.
  // Dentro de um trecho listrado, nenhum espaço do código passa de 4 módulos: corta onde houver
  // espaço bem maior que o módulo (ex.: a borda do quadro grudada nas barras numa foto de longe).
  function dividirPorModulo(trans, ini, fim, w, y) {
    const gaps = [];
    for (let k = ini + 1; k < fim; k++) gaps.push(trans[k] - trans[k - 1]);
    const ord = [...gaps].sort((a, b) => a - b);
    const modulo = Math.max(1, ord[Math.floor(ord.length * 0.25)]);
    const saida = [];
    let a = ini;
    for (let k = ini + 1; k <= fim; k++) {
      if (k === fim || trans[k] - trans[k - 1] > modulo * 6) {
        if (k - a >= 50) saida.push({ y, x0: trans[a], x1: trans[k - 1], n: k - a, esq: a > 0 ? trans[a - 1] : 0, dir: k < trans.length ? trans[k] : w });
        a = k;
      }
    }
    return saida;
  }

  function regioesDeBarras(cv, sensibilidade) {
    const w = cv.width, h = cv.height;
    const px = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w), acum = new Float64Array(w + 1);
    const janela = Math.max(15, Math.round(w / 30)), folgaMax = Math.max(6, Math.round(w / 90));
    const achados = [];
    for (let y = 2; y < h - 2; y += Math.max(3, Math.round(h / 160))) {
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; lum[x] = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; acum[x + 1] = acum[x] + lum[x]; }
      const trans = [];
      let antes = null;
      for (let x = 0; x < w; x++) {
        const a0 = Math.max(0, x - janela), a1 = Math.min(w, x + janela);
        const media = (acum[a1] - acum[a0]) / (a1 - a0);
        const escuro = lum[x] < media - sensibilidade;
        if (antes !== null && escuro !== antes) trans.push(x);
        antes = escuro;
      }
      let ini = 0;
      for (let k = 1; k <= trans.length; k++) {
        if (k === trans.length || trans[k] - trans[k - 1] > folgaMax) {
          if (k - ini >= 50) achados.push(...dividirPorModulo(trans, ini, k, w, y));
          ini = k;
        }
      }
    }
    // junta linhas vizinhas que cobrem o mesmo código
    const grupos = [];
    for (const a of achados) {
      const g = grupos.find((g) => Math.abs(g.x0 - a.x0) < 30 && Math.abs(g.x1 - a.x1) < 30 && a.y - g.y1 < h / 40);
      if (g) { g.y1 = a.y; g.linhas++; g.esq = Math.max(g.esq, a.esq); g.dir = Math.min(g.dir, a.dir); }
      else grupos.push({ ...a, y0: a.y, y1: a.y, linhas: 1 });
    }
    return grupos.sort((a, b) => b.linhas * b.n - a.linhas * a.n).slice(0, 6);
  }

  function decodificar(Z, leitor, cv) {
    for (const Binarizador of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
      try {
        const r = leitor.decode(new Z.BinaryBitmap(new Binarizador(new Z.HTMLCanvasElementLuminanceSource(cv))));
        const c = extrairChave(r.getText());
        if (c) return c;
      } catch { /* tenta o outro método de contraste */ }
    }
    return null;
  }

  function recortar(cv, g) {
    const larg = g.x1 - g.x0, folga = Math.round(larg * 0.06);
    const x0 = Math.max(g.esq + 2, g.x0 - folga), x1 = Math.min(g.dir - 2, g.x1 + folga);
    const altura = Math.max(30, g.y1 - g.y0);
    const y0 = Math.max(0, g.y0 - altura * 0.2), y1 = Math.min(cv.height, g.y1 + altura * 0.2);
    const escala = larg < 400 ? 3 : larg < 700 ? 2 : 1; // código pequeno na foto: amplia
    const c = document.createElement("canvas");
    c.width = Math.round((x1 - x0) * escala) + 40; c.height = Math.round((y1 - y0) * escala) + 40;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, 20, 20, (x1 - x0) * escala, (y1 - y0) * escala);
    return c;
  }

  // Realce de nitidez (para foto tremida/fora de foco): reforça a borda de cada listra
  function nitidez(c, forca = 1) {
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const { width: w, height: h } = c;
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const l = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) l[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        // reforço só na horizontal: o código de barras só varia de lado
        const v = Math.max(0, Math.min(255, l[i] + forca * (2 * l[i] - l[i - 1] - l[i + 1]) + forca * (2 * l[i] - l[i - 2 < y * w ? i : i - 2] - l[i + 2 >= (y + 1) * w ? i : i + 2]) * 0.5));
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  async function lerDaFoto(arquivo) {
    let bmp;
    try { bmp = await createImageBitmap(arquivo); } catch { return null; }
    // 1) Leitor nativo do celular (Android/Chrome) — mais rápido
    if ("BarcodeDetector" in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ["code_128"] });
        for (const r of await det.detect(bmp)) { const c = extrairChave(r.rawValue); if (c) return interpretar(c); }
      } catch { /* segue para o leitor da biblioteca */ }
    }
    // 2) Biblioteca ZXing (qualquer aparelho, inclusive iPhone): localiza as barras, recorta e lê
    try {
      await NE.carregarScript(ZXING);
      const Z = window.ZXing;
      const leitor = new Z.MultiFormatReader();
      leitor.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128]], [Z.DecodeHintType.TRY_HARDER, true]]));
      for (const [larg, girar] of [[1800, false], [1800, true], [4000, false], [4000, true]]) {
        const cv = canvasDe(bmp, larg, girar);
        for (const sens of [8, 3]) { // contraste normal e foto apagada/borrada
          for (const g of regioesDeBarras(cv, sens)) {
            const rec = recortar(cv, g);
            const c = decodificar(Z, leitor, rec) || decodificar(Z, leitor, nitidez(rec, 1)) || decodificar(Z, leitor, nitidez(rec, 1.5));
            if (c) return interpretar(c);
          }
        }
        const c = decodificar(Z, leitor, cv); // imagem inteira, como última tentativa neste tamanho
        if (c) return interpretar(c);
        await new Promise((ok) => setTimeout(ok)); // não trava a tela entre tentativas
      }
    } catch (e) { console.warn("Leitor de código de barras indisponível", e); }
    return null;
  }

  // Demonstração: gera uma "foto" de DANFE com código de barras real e chave válida
  async function gerarExemplo(numero = 48231) {
    await NE.carregarScript(JSBARCODE);
    const base = `3526111122233300018155001${String(numero).padStart(9, "0")}1${"12345678"}`;
    const chave = base + dvChave(base);
    const barras = document.createElement("canvas");
    window.JsBarcode(barras, chave, { format: "CODE128C", displayValue: false, height: 90, width: 2, margin: 0 });
    const cv = Object.assign(document.createElement("canvas"), { width: 1400, height: 1000 });
    const g = cv.getContext("2d");
    g.fillStyle = "#8f8a84"; g.fillRect(0, 0, 1400, 1000);
    g.fillStyle = "#fff"; g.fillRect(80, 60, 1240, 880);
    g.strokeStyle = "#222"; g.lineWidth = 3; g.strokeRect(110, 90, 1180, 820);
    g.fillStyle = "#222"; g.font = "700 46px Arial"; g.fillText("DANFE", 140, 160);
    g.font = "24px Arial"; g.fillText("Documento Auxiliar da Nota Fiscal Eletrônica", 140, 200);
    g.font = "700 34px Arial"; g.fillText(`Nº ${String(numero).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")}   SÉRIE 001`, 140, 260);
    g.font = "22px Arial"; g.fillText("EXEMPLO PARA DEMONSTRAÇÃO · SEM VALOR FISCAL", 140, 300);
    g.drawImage(barras, 140, 340, Math.min(barras.width, 1120), 110);
    g.font = "700 22px Arial"; g.fillText("CHAVE DE ACESSO", 140, 490);
    g.font = "26px monospace"; g.fillText(chave.replace(/(\d{4})/g, "$1 ").trim(), 140, 530);
    g.strokeRect(140, 580, 1120, 280);
    g.font = "22px Arial"; g.fillText("PRODUTO                      QTD", 160, 620);
    g.fillText("MEIO-FIO                      40", 160, 660); g.fillText("BOCA DE LOBO                   4", 160, 700);
    return new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.9));
  }

  NE.nfe = { lerDaFoto, gerarExemplo, validarChave, interpretar, extrairChave, dvChave,
    formatarChave: (ch) => ch.replace(/(\d{4})/g, "$1 ").trim() };
})();
