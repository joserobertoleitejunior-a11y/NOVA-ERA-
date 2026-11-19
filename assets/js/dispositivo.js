// Roda no <head>, antes de tudo (engenharia reversa do Império do EPS):
// 1) nível do aparelho em html[data-qualidade] = alta | media | baixa | estatica
//    - estatica: pediu menos movimento, economia de dados ou rede 2G → sem efeitos de rolagem
//    - baixa: ≤ 4 GB ou ≤ 4 núcleos → vidro vira sólido, títulos animam por palavra
// 2) altura estável da tela (--vh): não pula quando a barra de endereço do celular aparece/some
// 3) sem zoom: pinça (iPhone), toque duplo, Ctrl + roda e Ctrl + / − / 0
// Para testar: ?qualidade=baixa (ou alta, media, estatica) na URL.
(() => {
  const html = document.documentElement;
  const forcado = new URLSearchParams(location.search).get("qualidade");
  const nav = navigator, con = nav.connection || {};
  const mem = nav.deviceMemory || 4, nucleos = nav.hardwareConcurrency || 4;
  const toque = matchMedia("(pointer: coarse)").matches;
  let nivel = "media";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || con.saveData || /2g/.test(con.effectiveType || "") || mem <= 2) nivel = "estatica";
  else if (mem <= 4 || nucleos <= 4) nivel = "baixa";
  else if (!toque && mem >= 8 && nucleos >= 8) nivel = "alta";
  if (["alta", "media", "baixa", "estatica"].includes(forcado)) nivel = forcado;
  html.dataset.qualidade = nivel;
  html.dataset.toque = toque ? "sim" : "nao";

  // Altura estável: só muda ao girar o aparelho ou numa mudança grande (teclado não conta)
  let altura = innerHeight, largura = innerWidth;
  const aplicar = () => html.style.setProperty("--vh", `${altura / 100}px`);
  aplicar();
  addEventListener("resize", () => {
    const girou = Math.abs(innerWidth - largura) > 40;
    if (girou || Math.abs(innerHeight - altura) > 160) { altura = innerHeight; largura = innerWidth; aplicar(); }
  }, { passive: true });
  window.NETela = { altura: () => altura, largura: () => largura };

  // Sem zoom
  ["gesturestart", "gesturechange"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault(); });
})();
