// Site institucional: produtos, rastreio por link, copiar telefone, topo que fica de vidro ao rolar.
(() => {
  const NE = window.NE;
  const { el, ic } = NE;
  document.getElementById("logo").innerHTML = NE.logo;
  document.getElementById("ano").textContent = new Date().getFullYear();

  // Desenho simples de cada peça (linha), para os cartões de produto
  const des = (d) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const PRODUTOS = [
    { nome: "Boca de lobo", texto: "Captação de água da chuva na sarjeta.", d: des('<path d="M8 22h48v26H8z"/><path d="M14 30h36M14 36h36M14 42h36"/><path d="M8 22l6-8h36l6 8"/>') },
    { nome: "Meio-fio e guias", texto: "Acabamento de rua e calçada.", d: des('<path d="M6 40h52v10H6z"/><path d="M6 40l8-12h44v12"/><path d="M22 28v12M38 28v12"/>') },
    { nome: "Caixas para galeria", texto: "Canalização de grandes vazões.", d: des('<rect x="10" y="14" width="44" height="36" rx="3"/><rect x="18" y="22" width="28" height="20" rx="2"/>') },
    { nome: "Caixas de inspeção", texto: "Inspeção e passagem da rede.", d: des('<path d="M14 18h36v32H14z"/><path d="M20 12h24v6H20z"/><circle cx="32" cy="34" r="7"/>') },
    { nome: "Tubos e aduelas", texto: "Concreto armado para drenagem.", d: des('<ellipse cx="18" cy="32" rx="8" ry="14"/><path d="M18 18h28M18 46h28"/><ellipse cx="46" cy="32" rx="8" ry="14"/>') },
    { nome: "Dissipadores e alas", texto: "Saída de bueiros e proteção.", d: des('<path d="M8 48l14-28h20l14 28z"/><path d="M22 48l6-12h8l6 12"/>') },
  ];
  document.getElementById("grade-produtos").append(...PRODUTOS.map((p) =>
    el("a", { class: "produto vidro", href: "#contato" },
      el("span", { class: "produto-desenho", html: p.d }),
      el("strong", {}, p.nome), el("span", {}, p.texto),
      el("span", { class: "link-acao" }, "Pedir orçamento"))));

  // Rastreio: aceita o link inteiro ou só o código
  const form = document.getElementById("form-rastrear");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = document.getElementById("campo-rastreio").value.trim();
    const m = v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return NE.aviso("Não encontrei o código. Cole o link inteiro que chegou no WhatsApp.", "alerta", document.getElementById("aviso-rastreio"));
    location.href = `rastreio.html?c=${m[0]}`;
  });

  document.getElementById("copiar-telefone").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("(15) 3273-1159"); NE.aviso("Telefone copiado.", "ok"); }
    catch { NE.aviso("Não deu para copiar. O número é (15) 3273-1159.", "alerta"); }
  });

  // Topo ganha mais vidro depois que a pessoa rola
  const topo = document.getElementById("topo");
  const aoRolar = () => topo.classList.toggle("rolou", scrollY > 24);
  addEventListener("scroll", aoRolar, { passive: true }); aoRolar();
})();
