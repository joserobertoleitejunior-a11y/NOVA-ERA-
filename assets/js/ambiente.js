// Separa o app de VERDADE da demonstração. É o primeiro script de cada página.
//
// Regras (a causa do problema antigo era quebrar todas elas):
//  1) A demonstração só existe quando o ENDEREÇO pede: ?demo=exemplo (com dados de exemplo) ou ?demo=vazio.
//     Nada fica "ligado" no aparelho: abrir o app sem isso é, sempre, o app de verdade.
//  2) Tudo da demonstração fica em sessionStorage, com prefixo próprio: some ao fechar a aba e
//     nunca se mistura com o que o app de verdade guarda (ver NE.memoria em ui.js).
//  3) Marcas de teste deixadas por versões antigas são apagadas aqui, em todo aparelho, a cada abertura.
(() => {
  const NE = (window.NE = window.NE || {});

  let pedido = "";
  try { pedido = new URLSearchParams(location.search).get("demo") || ""; } catch { /* sem URL: é o app de verdade */ }
  const demo = {
    ativo: pedido !== "",
    exemplo: pedido !== "vazio",   // ?demo=vazio abre a demonstração sem nenhum dado
    // config.js pode desligar a demonstração de vez (demo: false) antes de entregar ao cliente
    permitir(sim) { if (!sim) demo.ativo = false; },
  };
  NE.demo = demo;

  try {
    // 3) o que as versões antigas deixaram no aparelho: modo teste "ligado", dados de teste e a marca de exemplo
    const velhas = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === "ne-modo-teste" || k === "ne-teste-demo" || /^ne-teste-v\d+$/.test(k)) velhas.push(k);
    }
    velhas.forEach((k) => localStorage.removeItem(k));
    // uma única vez: o vídeo antigo marcava o tutorial como "já visto" no aparelho de quem assistia
    if (!localStorage.getItem("ne-limpeza-1")) {
      ["painel", "vendas", "conferente", "passo"].forEach((t) => localStorage.removeItem(`ne-tour-${t}`));
      localStorage.setItem("ne-limpeza-1", "1");
    }
  } catch { /* sem armazenamento: não há o que limpar */ }
})();
