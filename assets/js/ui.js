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

  // ── Contato e fotos (equipe e frota) ──
  NE.soDigitos = (t) => String(t || "").replace(/\D/g, "");
  NE.mascaraTelefone = (t) => { const d = NE.soDigitos(t).slice(0, 11); if (d.length <= 2) return d ? `(${d}` : ""; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
  NE.linkWhatsApp = (tel, texto) => { const d = NE.soDigitos(tel); if (d.length < 10) return ""; return `https://wa.me/${d.startsWith("55") && d.length > 11 ? d : "55" + d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`; };

  // Bolinha com a foto da pessoa (ou as iniciais, se não tiver foto)
  NE.avatar = (nome, caminho, tamanho = 46) => {
    const ini = String(nome || "?").trim().split(/\s+/).filter((x) => /^[A-Za-zÀ-ÿ]/.test(x)).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
    const b = NE.el("span", { class: "avatar", style: `width:${tamanho}px;height:${tamanho}px;font-size:${Math.round(tamanho * 0.38)}px`, "aria-hidden": "true" }, ini);
    if (caminho) NE.dados.urlFoto(caminho).then((u) => { if (u) b.replaceChildren(NE.el("img", { src: u, alt: "", loading: "lazy" })); }).catch(() => {});
    return b;
  };

  // Bloco para tirar/escolher foto: lista = array de { blob, url } alterado no lugar; aoMudar() redesenha
  NE.seletorFoto = ({ titulo, dica, lista, varias = false, frontal = false, aoMudar }) => {
    const adicionar = async (arquivos) => {
      for (const arq of arquivos) { const blob = await NE.reduzirFoto(arq); if (!varias) lista.splice(0).forEach((f) => URL.revokeObjectURL(f.url)); lista.push({ blob, url: URL.createObjectURL(blob) }); }
      aoMudar();
    };
    const entrada = (camera, rotulo) => { const i = NE.el("input", { type: "file", accept: "image/*", capture: camera ? (frontal ? "user" : "environment") : false, multiple: varias || false, "aria-label": `${rotulo}: ${titulo}` }); i.addEventListener("change", () => { if (i.files?.length) adicionar([...i.files]); }); return i; };
    const feita = lista.length > 0;
    return NE.el("div", { class: `foto-bloco${feita ? " feita" : ""}` },
      NE.el("div", { class: "foto-bloco-topo" }, NE.el("strong", {}, titulo), NE.el("span", { class: `etiqueta ${feita ? "ok" : ""}` }, feita ? `${lista.length} foto${lista.length > 1 ? "s" : ""}` : "Opcional")),
      dica && NE.el("span", { class: "dica" }, dica),
      feita && NE.el("div", { class: "miniaturas" }, lista.map((f, i) => NE.el("figure", {}, NE.el("img", { src: f.url, alt: `${titulo} ${i + 1}` }),
        NE.el("button", { type: "button", class: "remover", "aria-label": "Apagar esta foto", html: NE.icone.fechar, onclick: () => { URL.revokeObjectURL(f.url); lista.splice(i, 1); aoMudar(); } })))),
      NE.el("div", { class: "foto-acoes" },
        NE.el("label", { class: "btn btn-secundario botao-camera" }, NE.ic("camera"), feita ? (varias ? "Mais uma" : "Trocar") : "Tirar foto", entrada(true, "Tirar foto")),
        NE.el("label", { class: "btn btn-secundario botao-camera" }, NE.ic("galeria"), "Galeria", entrada(false, "Escolher da galeria"))));
  };

  NE.memoria = {
    ler: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    gravar: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem rascunho */ } },
    apagar: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
})();
