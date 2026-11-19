// Utilitários de interface: criação segura de elementos (sem innerHTML com dados), avisos, botões com carregamento.
(() => {
  const NE = window.NE;
  NE.$ = (sel, raiz = document) => raiz.querySelector(sel);

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

  NE.posicao = () => new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    try {
      navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 7000, enableHighAccuracy: true });
    } catch { ok(null); }
  });

  NE.memoria = {
    ler: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    gravar: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem rascunho */ } },
    apagar: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
})();
