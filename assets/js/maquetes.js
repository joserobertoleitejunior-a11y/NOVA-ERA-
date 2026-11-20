// Maquetes 3D dos produtos — feitas só com HTML/CSS (nenhuma imagem, nenhuma biblioteca).
// Cada peça é um prisma extrudado de verdade (contorno + profundidade, com furos), sombreado pela luz.
// As peças se montam com a rolagem da página e a cena gira devagar. Em "reduzir movimento", fica montada e parada.
(() => {
  const NE = window.NE;
  const { el } = NE;
  const r2 = (n) => Math.round(n * 100) / 100;
  const LUZ = (() => { const v = [-0.45, -0.85, 0.5]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
  const COR = { concreto: [191, 187, 180], claro: [214, 210, 203], asfalto: [62, 65, 73], terra: [156, 144, 124], grama: [126, 150, 108], escuro: [52, 56, 65], vermelho: [217, 20, 30], azul: [26, 31, 143] };
  const rgb = (c, s) => `rgb(${c.map((v) => Math.round(Math.min(255, v * s))).join(",")})`;
  const circ = (cx, cy, r, n = 18) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const ret = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

  // Prisma: contornos[0] = contorno externo, os demais = furos. Extrude ao longo de Z (de -prof/2 a +prof/2).
  function prisma(contornos, prof, cor = COR.concreto) {
    const g = el("div", { class: "mp-g" });
    const ext = contornos[0]; const xs = ext.map((p) => p[0]), ys = ext.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), W = Math.max(...xs) - x0, H = Math.max(...ys) - y0;
    const d = contornos.map((c) => `M ${c.map((p) => `${r2(p[0] - x0)} ${r2(p[1] - y0)}`).join(" L ")} Z`).join(" ");
    [[1, 0.9], [-1, 0.52]].forEach(([s, brilho]) => g.append(el("div", { class: "mf", style: `left:${r2(x0)}px;top:${r2(y0)}px;width:${r2(W)}px;height:${r2(H)}px;background-color:${rgb(cor, brilho)};clip-path:path(evenodd,'${d}');-webkit-clip-path:path(evenodd,'${d}');transform:translateZ(${r2((s * prof) / 2)}px)` })));
    contornos.forEach((c, k) => {
      const cx = c.reduce((n, p) => n + p[0], 0) / c.length, cy = c.reduce((n, p) => n + p[1], 0) / c.length;
      c.forEach((A, i) => {
        const B = c[(i + 1) % c.length]; const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 0.01) return;
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; let nx = dy / L, ny = -dx / L; const para = (mx - cx) * nx + (my - cy) * ny;
        if ((k === 0 && para < 0) || (k > 0 && para > 0)) { nx = -nx; ny = -ny; }
        const brilho = 0.5 + 0.5 * Math.max(0, nx * LUZ[0] + ny * LUZ[1]) + 0.06;
        g.append(el("div", { class: "mf", style: `left:${r2(-L / 2 - 0.3)}px;top:${r2(-prof / 2 - 0.3)}px;width:${r2(L + 0.6)}px;height:${r2(prof + 0.6)}px;background-color:${rgb(cor, brilho)};transform:translate3d(${r2(mx)}px,${r2(my)}px,0) rotateZ(${r2((Math.atan2(dy, dx) * 180) / Math.PI)}deg) rotateX(90deg)` }));
      });
    });
    return g;
  }
  const caixa = (w, h, d, cor) => prisma([ret(w, h)], d, cor);
  const plano = (w, h, css) => el("div", { class: "mf mp-plano", style: `left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;${css}` });
  const junta = (...filhos) => el("div", { class: "mp-g" }, filhos);
  const em = (no, z) => { const w = el("div", { class: "mp-g", style: `transform:translateZ(${z}px)` }, no); return w; };

  // ───────────────────────── cenas ─────────────────────────
  const CENAS = {
    "boca-de-lobo": (c) => {
      c.add(caixa(200, 8, 130, COR.asfalto), [0, 4, 26], null, [0, 70, 0], 0);
      c.add(caixa(200, 22, 56, COR.claro), [0, -11, -62], null, [0, 70, 0], 0.08);
      c.add(caixa(70, 22, 16, COR.concreto), [-65, -11, -30], null, [-130, -50, 0], 0.22);
      c.add(caixa(70, 22, 16, COR.concreto), [65, -11, -30], null, [130, -50, 0], 0.22);
      c.add(caixa(64, 22, 34, [200, 196, 189]), [0, -11, -36], null, [0, -140, 0], 0.42);
      c.add(plano(46, 11, "background:repeating-linear-gradient(90deg,#10121a 0 6px,#4a5060 6px 8px);box-shadow:inset 0 0 0 2px #2a2e38,0 0 0 1px rgba(255,255,255,.25)"), [0, -9, -18.6], null, [0, 0, 40], 0.72);
      c.add(plano(90, 34, "border-radius:50%;background:radial-gradient(closest-side,rgba(96,165,230,.62),rgba(96,165,230,.18) 70%,transparent)"), [0, -0.6, -4], [90, 0, 0], [0, 0, 0], 0.8);
    },
    "meio-fio": (c) => {
      c.add(caixa(210, 8, 110, COR.asfalto), [0, 4, 36], null, [0, 70, 0], 0);
      c.add(caixa(210, 22, 58, COR.claro), [0, -11, -64], null, [0, 70, 0], 0.08);
      const perfil = [[-8, 0], [-8, -15], [-5, -22], [8, -22], [8, 0]];
      [-78, -26, 26, 78].forEach((x, i) => c.add(prisma([perfil], 49, COR.concreto), [x, 0, -30], [0, 90, 0], [190, -60, 0], 0.22 + i * 0.16));
      c.add(plano(190, 4, "background:repeating-linear-gradient(90deg,#f1c40f 0 22px,transparent 22px 44px)"), [0, -0.5, 70], [90, 0, 0], [0, 0, 0], 0.9);
    },
    "caixa-galeria": (c) => {
      const un = () => prisma([ret(104, 84), ret(80, 60)], 82, COR.concreto);
      c.add(caixa(200, 6, 200, COR.terra), [0, 3, 0], null, [0, 70, 0], 0);
      c.add(un(), [0, -42, -46], null, [0, -90, 0], 0.18);
      c.add(un(), [0, -42, 46], null, [0, 0, 170], 0.42);
      [-34, 34].forEach((x) => { c.add(caixa(10, 8, 10, COR.vermelho), [x, -88, -46], null, [0, -60, 0], 0.8); c.add(caixa(10, 8, 10, COR.vermelho), [x, -88, 46], null, [0, -60, 0], 0.86); });
      c.add(plano(76, 80, "background:linear-gradient(rgba(96,165,230,.0),rgba(96,165,230,.45))"), [0, -29, 0], [90, 0, 0], [0, 0, 0], 0.95);
    },
    "caixa-inspecao": (c) => {
      c.add(caixa(120, 8, 120, COR.concreto), [0, 4, 0], null, [0, 70, 0], 0);
      c.add(prisma([ret(92, 92), ret(76, 76)], 66, COR.concreto), [0, -33, 0], [90, 0, 0], [0, -60, 0], 0.16);
      c.add(prisma([ret(104, 104), circ(0, 0, 25)], 10, COR.claro), [0, -71, 0], [90, 0, 0], [0, -110, 0], 0.4);
      c.add(prisma([circ(0, 0, 31), circ(0, 0, 25)], 14, COR.concreto), [0, -83, 0], [90, 0, 0], [0, -140, 0], 0.58);
      c.add(prisma([circ(0, 0, 28)], 6, COR.escuro), [0, -93, 0], [90, 0, 0], [0, -190, 0], 0.78);
      c.add(prisma([circ(0, 0, 16), circ(0, 0, 10)], 30, COR.concreto), [62, -30, 0], [0, 90, 0], [150, 0, 0], 0.5);
    },
    "tubos-aduelas": (c) => {
      const tubo = () => junta(prisma([circ(0, 0, 34, 20), circ(0, 0, 26, 20)], 74, COR.concreto), em(prisma([circ(0, 0, 38, 20), circ(0, 0, 31, 20)], 16, COR.claro), 35));
      c.add(caixa(210, 6, 170, COR.terra), [0, 3, 0], null, [0, 70, 0], 0);
      c.add(tubo(), [-48, -38, 42], [0, 90, 0], [-120, 0, 0], 0.16);
      c.add(tubo(), [40, -38, 42], [0, 90, 0], [170, 0, 0], 0.42);
      c.add(prisma([ret(84, 66), ret(62, 44)], 76, COR.concreto), [0, -33, -48], [0, 90, 0], [0, -120, 0], 0.64);
    },
    muros: (c) => {
      const I = [[-14, -14], [14, -14], [14, -10], [4, -10], [4, 10], [14, 10], [14, 14], [-14, 14], [-14, 10], [-4, 10], [-4, -10], [-14, -10]];
      c.add(caixa(240, 6, 100, COR.grama), [0, 3, 0], null, [0, 70, 0], 0);
      [-80, 0, 80].forEach((x, i) => c.add(prisma([I], 104, COR.claro), [x, -52, 0], [90, 0, 0], [0, 0, 0], 0.08 + i * 0.05));
      [-40, 40].forEach((x, k) => [0, 1, 2, 3].forEach((n) => c.add(caixa(58, 24, 7, COR.concreto), [x, -12 - n * 25.4, 0], null, [0, -190, 0], 0.3 + (k * 4 + n) * 0.075)));
    },
    "dissipadores-alas": (c) => {
      c.add(caixa(210, 6, 190, COR.terra), [0, 3, 0], null, [0, 70, 0], 0);
      c.add(prisma([ret(94, 74), ret(72, 52)], 62, COR.concreto), [0, -37, -42], null, [0, -80, -60], 0.14);
      const ala = [[0, 0], [0, -74], [78, -22], [78, 0]];
      c.add(prisma([ala], 11, COR.concreto), [-52, 0, -12], [0, -125, 0], [-130, -50, 0], 0.36);
      c.add(prisma([ala], 11, COR.concreto), [52, 0, -12], [0, -55, 0], [130, -50, 0], 0.44);
      const degraus = [[0, 0], [0, -26], [26, -26], [26, -18], [52, -18], [52, -10], [78, -10], [78, 0]];
      c.add(prisma([degraus], 84, COR.claro), [-42, 0, 4], [0, -90, 0], [0, -70, 120], 0.66);
      c.add(plano(84, 60, "background:linear-gradient(90deg,rgba(96,165,230,.5),rgba(96,165,230,.12))"), [0, -0.8, 62], [90, 0, 0], [0, 0, 0], 0.92);
    },
  };

  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vivas = new Set();
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function montar(host, slug) {
    const giro = el("div", { class: "maq-giro" }); const mao = el("div", { class: "maq-mao" }, giro);
    const cena = el("div", { class: "maq-cena" }, mao);
    const mais = el("button", { type: "button", class: "maq-zoom", "aria-label": "Aproximar a peça" }, "+"); const menos = el("button", { type: "button", class: "maq-zoom", "aria-label": "Afastar a peça" }, "−");
    const raiz = el("div", { class: "maq", role: "img", "aria-label": "Maquete 3D da peça: arraste para girar, pince para aproximar" }, cena, el("div", { class: "maq-botoes" }, mais, menos));
    giro.append(el("div", { class: "mf maq-disco", style: "left:-150px;top:-150px;width:300px;height:300px;transform:translate3d(0,9px,0) rotateX(90deg)" }));
    const pecas = [];
    CENAS[slug]({ add(no, pos, rot, de, atraso) { const p = el("div", { class: "mp" }, no); giro.append(p); pecas.push({ p, pos, rot: rot || [0, 0, 0], de: de || [0, -60, 0], atraso }); } });
    const FIM = 1.4;
    const m = { alvo: reduzir ? FIM : 0, atual: reduzir ? FIM : 0, raiz, pecas, travada: reduzir };
    const pintar = () => pecas.forEach(({ p, pos, rot, de, atraso }) => {
      const t = Math.max(0, Math.min(1, (m.atual - atraso) / 0.34)); const k = 1 - ease(t);
      p.style.transform = `translate3d(${r2(pos[0] + de[0] * k)}px,${r2(pos[1] + de[1] * k)}px,${r2(pos[2] + de[2] * k)}px) rotateX(${rot[0]}deg) rotateY(${rot[1]}deg) rotateZ(${rot[2]}deg)`;
      p.style.opacity = String(Math.min(1, t * 2.2));
    });
    m.pintar = pintar; m.FIM = FIM; pintar(); host.append(raiz);

    // Gestos SÓ na peça: arrastar gira, pinça/roda/botões aproximam. A página não rola nem dá zoom por cima da maquete.
    let yaw = 0, pitch = -24, zoom = 1, ocioso;
    const aplicar = () => { mao.style.transform = `rotateX(${r2(pitch + 24)}deg) rotateY(${r2(yaw)}deg) scale(${r2(zoom)})`; };
    const pausar = () => { raiz.classList.add("mexendo"); clearTimeout(ocioso); ocioso = setTimeout(() => raiz.classList.remove("mexendo"), 3500); };
    const ponteiros = new Map(); let distAnt = 0;
    raiz.addEventListener("pointerdown", (e) => { raiz.setPointerCapture(e.pointerId); ponteiros.set(e.pointerId, [e.clientX, e.clientY]); distAnt = 0; pausar(); raiz.classList.add("agarrada"); });
    raiz.addEventListener("pointermove", (e) => {
      if (!ponteiros.has(e.pointerId)) return; const ant = ponteiros.get(e.pointerId); ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
      if (ponteiros.size === 1) { yaw += (e.clientX - ant[0]) * 0.7; pitch = Math.max(-72, Math.min(-4, pitch + (e.clientY - ant[1]) * 0.45)); }
      else if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (distAnt) zoom = Math.max(0.6, Math.min(2.4, zoom * (d / distAnt))); distAnt = d; }
      pausar(); aplicar();
    });
    const soltar = (e) => { ponteiros.delete(e.pointerId); distAnt = 0; if (!ponteiros.size) raiz.classList.remove("agarrada"); };
    raiz.addEventListener("pointerup", soltar); raiz.addEventListener("pointercancel", soltar);
    raiz.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(0.6, Math.min(2.4, zoom * Math.exp(-e.deltaY * 0.0018))); pausar(); aplicar(); }, { passive: false });
    raiz.addEventListener("dblclick", () => { yaw = 0; pitch = -24; zoom = 1; aplicar(); });
    mais.addEventListener("click", () => { zoom = Math.min(2.4, zoom * 1.25); pausar(); aplicar(); }); menos.addEventListener("click", () => { zoom = Math.max(0.6, zoom / 1.25); pausar(); aplicar(); });
    ["pointerdown"].forEach((ev) => raiz.querySelector(".maq-botoes").addEventListener(ev, (e) => e.stopPropagation()));

    if (!reduzir) {
      new IntersectionObserver((es) => es.forEach((e) => { raiz.classList.toggle("parada", !e.isIntersecting); if (e.isIntersecting && !m.travada) vivas.add(m); else vivas.delete(m); }), { rootMargin: "120px" }).observe(raiz);
    } else raiz.classList.add("estatica");
    return m;
  }

  // Um laço só: calcula o quanto cada maquete já "montou" pela posição na tela e suaviza o movimento
  let rodando = false;
  function laco() {
    let mexeu = false; const vh = innerHeight;
    vivas.forEach((m) => {
      const r = m.raiz.getBoundingClientRect(); const meio = r.top + r.height / 2;
      m.alvo = Math.max(0, Math.min(1.4, ((vh * 0.98 - meio) / (vh * 0.55)) * 1.4));
      const dif = m.alvo - m.atual; if (Math.abs(dif) > 0.002) { m.atual += dif * 0.1; m.pintar(); mexeu = true; }
      if (m.atual >= m.FIM - 0.02) { m.atual = m.FIM; m.pintar(); m.travada = true; vivas.delete(m); } // montada: trava e não desmonta mais
    });
    if (vivas.size) requestAnimationFrame(laco); else rodando = false;
    void mexeu;
  }
  const acordar = () => { if (!rodando && vivas.size) { rodando = true; requestAnimationFrame(laco); } };
  addEventListener("scroll", acordar, { passive: true }); addEventListener("resize", acordar);

  NE.maquete = (host, slug) => (CENAS[slug] ? montar(host, slug) : null);
})();
