// Motor de efeitos de rolagem (próprio, ~5 KB, sem GSAP) — mesma linha do motion.js do Império do EPS.
// Tudo é desligado no nível "estatica" (menos movimento / economia de dados) e o conteúdo aparece normal.
//   [data-revelar]          surge ao entrar na tela  (valores: sobe | esq | dir | zoom | cortina)
//   [data-revelar-grupo]    filhos surgem em sequência
//   [data-letras]           título que se monta (por letra no PC forte, por palavra nos outros)
//   [data-faixa="1|-1"]     faixa de texto que anda na horizontal com a rolagem
//   [data-parallax="0.25"]  profundidade (move mais devagar que a página)
//   [data-linha-progresso]  linha que enche conforme a seção passa (passo a passo)
//   [data-tilt]             card inclina com o mouse (só PC)
//   [data-magnetico]        botão "puxado" pelo mouse (só PC)
//   .progresso-leitura      barra no topo · header [data-esconde] some ao descer
(() => {
  const html = document.documentElement;
  const nivel = html.dataset.qualidade || "media";
  const estatico = nivel === "estatica";
  const pc = html.dataset.toque !== "sim" && matchMedia("(hover: hover)").matches;
  const porLetra = pc && nivel !== "baixa";
  html.classList.add(estatico ? "sem-efeitos" : "com-efeitos");

  // ── Letras / palavras ───────────────────────────────
  function quebrar(el) {
    const texto = el.textContent.trim().replace(/\s+/g, " ");
    el.setAttribute("aria-label", texto);
    el.textContent = "";
    let i = 0;
    texto.split(" ").forEach((palavra, k, arr) => {
      const p = document.createElement("span");
      p.className = "palavra"; p.setAttribute("aria-hidden", "true");
      if (porLetra) for (const ch of palavra) { const l = document.createElement("span"); l.className = "letra"; l.style.setProperty("--i", i++); l.textContent = ch; p.append(l); }
      else { p.style.setProperty("--i", i++); p.textContent = palavra; }
      el.append(p);
      if (k < arr.length - 1) el.append(" ");
    });
    el.classList.add(porLetra ? "por-letra" : "por-palavra");
  }

  // ── Surgir ao entrar na tela ────────────────────────
  // Só prepara o que está ABAIXO da primeira tela: o que já aparece ao abrir fica visível na hora.
  const observador = !estatico && "IntersectionObserver" in window ? new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visto"); e.target.classList.remove("pre"); observador.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }) : null;

  function preparar() {
    const alturaTela = innerHeight;
    document.querySelectorAll("[data-letras]").forEach((el) => { if (!estatico) quebrar(el); });
    document.querySelectorAll("[data-revelar-grupo]").forEach((g) => [...g.children].forEach((f, k) => { f.dataset.revelar = f.dataset.revelar || "sobe"; f.style.setProperty("--atraso", `${k * 80}ms`); }));
    document.querySelectorAll("[data-revelar], [data-letras]").forEach((el) => {
      if (!observador) { el.classList.add("visto"); return; }
      if (el.getBoundingClientRect().top < alturaTela * 0.92) { requestAnimationFrame(() => el.classList.add("visto")); return; }
      el.classList.add("pre"); observador.observe(el);
    });
  }

  // ── Efeitos ligados à rolagem (um só laço por quadro) ─
  const ativos = new Set();
  const vigia = !estatico && "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? ativos.add(e.target) : ativos.delete(e.target))), { rootMargin: "20% 0px" }) : null;
  const barra = document.querySelector(".progresso-leitura");
  const topo = document.querySelector("[data-esconde]");
  let ultimoY = scrollY, pedido = false;

  function quadro() {
    pedido = false;
    const y = scrollY, h = innerHeight, total = document.documentElement.scrollHeight - h;
    if (barra) barra.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
    if (topo) {
      if (y > 140 && y > ultimoY + 4) topo.classList.add("escondido");
      else if (y < ultimoY - 4 || y < 140) topo.classList.remove("escondido");
      topo.classList.toggle("rolou", y > 24);
    }
    ultimoY = y;
    if (estatico) return;
    for (const el of ativos) {
      const r = el.getBoundingClientRect();
      if (el.dataset.faixa) {
        const d = Number(el.dataset.faixa) || 1;
        el.style.transform = `translate3d(${(((r.top + r.height / 2) - h / 2) * 0.35 * d).toFixed(1)}px,0,0)`;
      } else if (el.dataset.parallax) {
        el.style.transform = `translate3d(0,${(-r.top * Number(el.dataset.parallax)).toFixed(1)}px,0) scale(1.08)`;
      } else if (el.hasAttribute("data-linha-progresso")) {
        const p = Math.min(1, Math.max(0, (h * 0.7 - r.top) / (r.height || 1)));
        el.style.setProperty("--progresso", p.toFixed(3));
      }
    }
  }
  const agendar = () => { if (!pedido) { pedido = true; requestAnimationFrame(quadro); } };

  // ── PC: inclinar e magnético ────────────────────────
  function ligarPC() {
    if (!pc || estatico) return;
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, yy = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-yy * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
        el.style.setProperty("--brilho-x", `${((x + 0.5) * 100).toFixed(0)}%`); el.style.setProperty("--brilho-y", `${((yy + 0.5) * 100).toFixed(0)}%`);
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
    document.querySelectorAll("[data-magnetico]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  function iniciar() {
    preparar();
    if (vigia) document.querySelectorAll("[data-faixa], [data-parallax], [data-linha-progresso]").forEach((el) => vigia.observe(el));
    addEventListener("scroll", agendar, { passive: true });
    addEventListener("resize", agendar, { passive: true });
    ligarPC();
    quadro();
  }
  window.NEMotion = { iniciar, quebrar };
})();
