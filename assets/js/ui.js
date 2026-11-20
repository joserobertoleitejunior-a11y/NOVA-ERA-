// Utilitários de interface: criação segura de elementos (sem innerHTML com dados), avisos, botões com carregamento.
(() => {
  const NE = window.NE;
  NE.$ = (sel, raiz = document) => raiz.querySelector(sel);

  // replaceChildren/append ignoram null, undefined e false (senão o navegador escreve "null" ou "false" na tela)
  for (const nome of ["replaceChildren", "append", "prepend"]) {
    const original = Element.prototype[nome];
    Element.prototype[nome] = function (...itens) { return original.apply(this, itens.filter((x) => x != null && x !== false)); };
  }

  // Bloqueia zoom de pinça no iPhone (o Safari ignora user-scalable=no) e o zoom de toque duplo
  ["gesturestart", "gesturechange"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  NE.el = (tag, attrs = {}, ...filhos) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v; // usado SÓ com ícones fixos do NE.icone
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const f of filhos.flat()) if (f != null && f !== false) n.append(f instanceof Node ? f : document.createTextNode(String(f)));
    return n;
  };
  NE.ic = (nome) => NE.el("span", { html: NE.icone[nome], style: "display:contents" });

  NE.aviso = (texto, tipo = "erro", ondeEl = null) => {
    const icone = tipo === "ok" ? "check" : "alerta";
    const box = NE.el("div", { class: `aviso ${tipo}${ondeEl ? "" : " toast"}`, role: tipo === "erro" ? "alert" : "status" }, NE.ic(icone), NE.el("span", {}, texto));
    if (ondeEl) { ondeEl.replaceChildren(box); return box; }
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    document.body.append(box);
    setTimeout(() => box.remove(), tipo === "erro" ? 6000 : 3500);
    return box;
  };

  NE.comCarregando = async (btn, fn) => {
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add("carregando");
    try { return await fn(); }
    catch (e) { console.error(e); NE.aviso(NE.mensagemErro(e)); }
    finally { btn.disabled = false; btn.classList.remove("carregando"); }
  };

  NE.mensagemErro = (e) => {
    const m = e?.message || String(e);
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sem internet. Confira o sinal e tente de novo.";
    if (/JWT|session|login/i.test(m)) return "Sua sessão expirou. Entre de novo.";
    return m.length < 140 ? m : "Algo deu errado. Tente de novo.";
  };

  NE.hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  NE.dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  NE.hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  NE.num = (n) => Number(n).toLocaleString("pt-BR");

  // Reduz a foto para ~1600px em JPEG: economiza dados móveis e espaço.
  NE.reduzirFoto = async (arquivo) => {
    try {
      const bmp = await createImageBitmap(arquivo);
      const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const cv = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * escala), height: Math.round(bmp.height * escala) });
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      return await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.8));
    } catch { return arquivo; }
  };

  // Carrega uma biblioteca só quando ela é necessária (o app abre leve e rápido)
  const scripts = new Map();
  NE.carregarScript = (url) => {
    if (!scripts.has(url)) scripts.set(url, new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = () => { scripts.delete(url); falha(new Error("Sem internet para carregar o leitor.")); };
      document.head.append(s);
    }));
    return scripts.get(url);
  };

  NE.posicao = () => new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    try {
      navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 7000, enableHighAccuracy: true });
    } catch { ok(null); }
  });

  // Contador grande (− número +), usado em notas, conferência e contagem
  NE.contador = (valor, aoMudar, idCampo, { max } = {}) => {
    const inp = NE.el("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off", id: idCampo, value: String(valor), "aria-label": "Quantidade" });
    const mudar = (v) => { let n = Math.max(0, Math.round(Number(v) || 0)); if (max != null) n = Math.min(max, n); inp.value = String(n); aoMudar(n); };
    inp.addEventListener("change", () => mudar(inp.value));
    inp.addEventListener("focus", () => inp.select());
    const caixa = NE.el("div", { class: "contador" },
      NE.el("button", { type: "button", "aria-label": "Diminuir", html: NE.icone.menos, onclick: () => mudar(Number(inp.value) - 1) }), inp,
      NE.el("button", { type: "button", "aria-label": "Aumentar", html: NE.icone.mais, onclick: () => mudar(Number(inp.value) + 1) }));
    caixa.definir = (n) => { inp.value = String(n); };
    return caixa;
  };

  // Janela simples (título, corpo, rodapé). Fecha com X, fora, Esc ou ao trocar de tela.
  NE.janelaSimples = ({ etiqueta, titulo, corpo, rodape, pequena = false }) => {
    const fechar = NE.el("button", { type: "button", class: "janela-fechar", "aria-label": "Fechar", html: NE.icone.fechar });
    const fundo = NE.el("div", { class: "janela-fundo", "data-simples": "1" },
      NE.el("div", { class: `janela${pequena ? " janela-pequena" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": titulo },
        NE.el("div", { class: "janela-topo" }, NE.el("div", {}, etiqueta && NE.el("span", { class: "etiqueta" }, etiqueta), NE.el("h2", {}, titulo)), fechar),
        NE.el("div", { class: "janela-corpo" }, corpo), rodape && NE.el("div", { class: "janela-rodape" }, rodape)));
    const tirar = () => { fundo.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => { if (e.key === "Escape") tirar(); };
    fechar.addEventListener("click", tirar); fundo.addEventListener("click", (e) => { if (e.target === fundo) tirar(); }); document.addEventListener("keydown", tecla);
    document.body.append(fundo); fechar.focus({ preventScroll: true });
    return { fechar: tirar, fundo };
  };
  NE.fecharSimples = () => document.querySelectorAll(".janela-fundo[data-simples]").forEach((x) => x.remove());

  // Aviso do sistema (com o app aberto) — o aviso com o app fechado vem do Web Push
  NE.notificar = async (titulo, texto, tag) => {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) reg.showNotification(titulo, { body: texto, tag, icon: "assets/img/icone-192.png", badge: "assets/img/icone-192.png", data: { url: "app.html#alertas" } });
      else new Notification(titulo, { body: texto, tag });
    } catch { /* sem permissão ou sem suporte */ }
  };

  NE.memoria = {
    ler: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    gravar: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem rascunho */ } },
    apagar: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
})();
