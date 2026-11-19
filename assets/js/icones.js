// Ícones em linha (SVG) e logotipo PROVISÓRIO — trocar pelo arquivo oficial da Nova Era quando o cliente enviar.
(() => {
  const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  window.NE = window.NE || {};
  NE.icone = {
    caminhao: s('<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    nota: s('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>'),
    caixas: s('<path d="M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8z"/>'),
    conferir: s('<path d="M9 5H6v16h12V5h-3"/><path d="M9 3h6v4H9z"/><path d="m9 14 2 2 4-4"/>'),
    camera: s('<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    check: s('<path d="m5 12.5 4.5 4.5L19 7"/>'),
    alerta: s('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>'),
    mais: s('<path d="M12 5v14M5 12h14"/>'),
    menos: s('<path d="M5 12h14"/>'),
    voltar: s('<path d="M15 5l-7 7 7 7"/>'),
    seguir: s('<path d="M9 5l7 7-7 7"/>'),
    fechar: s('<path d="M6 6l12 12M18 6 6 18"/>'),
    sair: s('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
    lista: s('<path d="M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01"/>'),
    usuario: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    chave: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    ajuda: s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01"/>'),
    galeria: s('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/>'),
    whatsapp: s('<path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.1 1.8.9-.4 1.4c-3.2.4-7.3-3.7-6.9-6.9l1.4-.4.9 1.8z"/>'),
    olho: s('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    etiqueta: s('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
    local: s('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  };
  // Logo oficial NE (redesenhado em vetor a partir do logo da empresa) — arquivos em assets/img/marca/
  const N = "M21 33 L49 33 L87 85 L87 33 L111 33 L111 110 L84 110 L46 58 L46 104 L21 127 Z";
  const E = "M126 33 L193 33 L193 52 L150 52 L150 62 L186 62 L186 80 L150 80 L150 91 L195 91 L195 110 L126 110 Z";
  let seq = 0;
  NE.marca = (letra = "#E3121B", elipse = "#16168C", recorte = false) => {
    const id = `ne-m${++seq}`;
    const corte = recorte ? `<path d="${N}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/><path d="${E}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/>` : "";
    return `<svg viewBox="0 0 220 140" role="img" aria-label="Nova Era"><defs><mask id="${id}" maskUnits="userSpaceOnUse"><rect width="220" height="140" fill="#fff"/><rect x="86" y="-2" width="12" height="30" fill="#000"/><rect x="124" y="104" width="12" height="40" fill="#000"/>${corte}</mask></defs><path mask="url(#${id})" fill="${elipse}" fill-rule="evenodd" d="M4 72 A106 66 0 1 0 216 72 A106 66 0 1 0 4 72 Z M24 71 A87 45 -13 1 0 200 71 A87 45 -13 1 0 24 71 Z"/><path fill="${letra}" d="${N}"/><path fill="${letra}" d="${E}"/></svg>`;
  };
  // Logo com nome (topo do app e do site)
  Object.defineProperty(NE, "logo", { get: () => `<span class="logo-ne">${NE.marca()}<span class="logo-nome"><b>NOVA ERA</b><small>Drenagem e pré-moldados</small></span></span>` });
})();
