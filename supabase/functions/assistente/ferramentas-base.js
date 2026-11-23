// FERRAMENTAS DO ASSISTENTE — base comum: erros, pequenos utilitários e os "achadores" (nome → registro).
// Sem rede e sem Deno: roda igual no servidor (função do Supabase) e no Node (testes automáticos).
// O assistente consulta (ferramentas-leitura.js) e PROPÕE ações (ferramentas-escrita.js). Executar só depois do toque em Confirmar.
(function (raiz) {
  "use strict";
  const D = () => raiz.NEDominio;

  class ErroAssistente extends Error {
    constructor(mensagem, status = 400, extra = {}) { super(mensagem); this.name = "ErroAssistente"; this.status = status; this.extra = extra; }
  }
  // Erro de uma PROPOSTA: a IA lê a mensagem, corrige o pedido ou pergunta o que falta à pessoa.
  class ErroProposta extends ErroAssistente {
    constructor(mensagem) { super(mensagem, 422); this.name = "ErroProposta"; }
  }

  const catalogo = {};
  const registrar = (def) => { catalogo[def.nome] = def; return def; };

  // ───────────────────────── utilitários ─────────────────────────
  const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const txt = (v, max = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  const vazio = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  // Aceita 12, "12,5", "12.5" e "1.200" / "1.200,5" (ponto de milhar do jeito brasileiro).
  const num = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const s = String(v == null ? "" : v).trim(); if (s === "") return NaN;
    const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
    return Number(limpo);
  };
  const digitos = (v) => String(v == null ? "" : v).replace(/\D/g, "");
  const semAcento = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = (t) => D().normalizar(t);
  const fmt = (n) => D().fmt(n);
  const linha = (t, segredo = false) => (segredo ? { t, s: true } : { t });
  const plural = (n, um, varios) => D().plural(n, um, varios);

  // "carlos da silva" → "Carlos da Silva" (só mexe quando veio tudo em minúsculas ou tudo em maiúsculas)
  const nomeBonito = (t) => {
    const s = txt(t, 80); if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
    const peq = new Set(["da", "de", "do", "das", "dos", "e"]);
    return s.toLowerCase().split(" ").map((w, i) => (i > 0 && peq.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  };
  const tituloProduto = (t) => String(t).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());   // igual ao importar XML do app

  const dataISO = (v, rotulo) => {
    if (vazio(v)) return null; const s = String(v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); let a, mm, d;
    if (m) { a = +m[1]; mm = +m[2]; d = +m[3]; } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { d = +m[1]; mm = +m[2]; a = +m[3]; } else throw new ErroProposta(`${rotulo}: use o formato dia/mês/ano.`);
    const t = new Date(Date.UTC(a, mm - 1, d)); if (t.getUTCFullYear() !== a || t.getUTCMonth() !== mm - 1 || t.getUTCDate() !== d) throw new ErroProposta(`${rotulo}: essa data não existe.`);
    return `${String(a).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
  const telefoneBR = (d) => {
    const s = digitos(d); if (!s) return "—"; const l = s.length > 11 && s.startsWith("55") ? s.slice(2) : s;
    if (l.length === 11) return `(${l.slice(0, 2)}) ${l.slice(2, 7)}-${l.slice(7)}`;
    if (l.length === 10) return `(${l.slice(0, 2)}) ${l.slice(2, 6)}-${l.slice(6)}`;
    return s;
  };

  // ───────────────────────── funções da empresa ─────────────────────────
  const FUNCOES = ["conferente", "motorista", "ajudante", "expedicao", "vendedor", "administrativo", "diretoria"];
  const ROTULO_FUNCAO = { conferente: "Conferente", motorista: "Motorista", ajudante: "Ajudante", expedicao: "Expedição", vendedor: "Vendedor", administrativo: "Administrativo", diretoria: "Diretoria" };
  const SINONIMOS_FUNCAO = { conferente: "conferente", conferencia: "conferente", motorista: "motorista", caminhoneiro: "motorista", ajudante: "ajudante", auxiliar: "ajudante", expedicao: "expedicao", expedidor: "expedicao", vendedor: "vendedor", vendedora: "vendedor", vendas: "vendedor", comercial: "vendedor", administrativo: "administrativo", administrativa: "administrativo", adm: "administrativo", escritorio: "administrativo", diretoria: "diretoria", diretor: "diretoria", diretora: "diretoria", socio: "diretoria" };
  const funcaoDe = (v) => { const k = norm(v); return FUNCOES.includes(k) ? k : SINONIMOS_FUNCAO[k] || null; };
  // Quem vê o painel da administração (mesma regra do cadastro guiado do app). "Administrativo" e "Diretoria" veem tudo.
  const papelDe = (f) => (["expedicao", "diretoria", "vendedor", "administrativo"].includes(f) ? "admin" : "funcionario");
  const FUNCOES_DO_ASSISTENTE = ["diretoria", "administrativo", "expedicao"];   // quem usa o chat (mesma regra de PAPEIS.ia no app)
  const podeUsarAssistente = (eu) => !!eu && eu.papel === "admin" && eu.ativo !== false && (FUNCOES_DO_ASSISTENTE.includes(eu.funcao) || !FUNCOES.includes(eu.funcao));
  const acesso = (papel) => (papel === "admin" ? "Painel da administração" : "Só a conferência");

  const PAL = ["carga", "nota", "silo", "patio", "caixa", "tubo", "laje", "munck", "brita", "areia"];
  const senhaNova = () => { const n = new Uint32Array(2); globalThis.crypto.getRandomValues(n); return `${PAL[n[0] % PAL.length]}${1000 + (n[1] % 9000)}`; };
  const usuarioDe = (nome) => {
    const palavras = semAcento(nome).toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
    let u = palavras[0] || ""; if (u.length < 3) u = palavras.join(""); if (u.length < 3) u = `${u || "usuario"}01`;
    return u.slice(0, 28);
  };

  const TIPOS_VEICULO = { caminhao: "Caminhão", truck_munck: "Truck com munck", betoneira: "Betoneira", basculante: "Basculante", outro: "Outro" };
  const tipoVeiculoDe = (v) => { const k = norm(v).replace(/ /g, "_"); if (TIPOS_VEICULO[k]) return k; if (/munck/.test(k)) return "truck_munck"; if (/betoneira/.test(k)) return "betoneira"; if (/basculante|cacamba/.test(k)) return "basculante"; if (/caminhao|truck/.test(k)) return "caminhao"; return null; };
  const TIPOS_FOTO_VEICULO = ["frente", "lateral", "traseira", "placa", "outras"];
  const UNIDADES = { un: "unidade", m: "metro", m3: "metro cúbico", t: "tonelada" };
  const unidadeDe = (v) => { const k = norm(v).replace(/ /g, ""); if (UNIDADES[k]) return k; if (/^(unidade|unidades|und|pc|peca|pecas)$/.test(k)) return "un"; if (/^(metro|metros|mt)$/.test(k)) return "m"; if (/^(m3|metrocubico|metroscubicos|metro3)$/.test(k)) return "m3"; if (/^(tonelada|toneladas|ton)$/.test(k)) return "t"; return null; };

  const TELAS = { inicio: "Início", notas: "Notas", estoque: "Estoque", cargas: "Cargas", alertas: "Avisos", equipe: "Equipe", cadastros: "Produtos e caminhões", config: "Ajustes", exportar: "Exportar relatórios", mais: "Mais opções", contar: "Contagem de estoque", resumo: "Resumo" };
  const FLUXOS = { nota: "Lançar uma nota", xml: "Importar notas por XML", mov: "Lançar entrada ou perda", contagem: "Pedir contagem", novaPessoa: "Cadastrar uma pessoa", novoVeiculo: "Cadastrar um caminhão", novoProduto: "Cadastrar um produto", ajustes: "Ajustes dos avisos" };

  const placaDe = (v) => String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const placaValida = (p) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);

  // ───────────────────────── achadores: nome → registro (único) ─────────────────────────
  const unico = (achados, ref, rotulo, nomeDe) => {
    if (achados.length === 1) return { item: achados[0] };
    if (achados.length > 1) return { erro: `Mais de um ${rotulo} combina com "${ref}": ${achados.slice(0, 6).map(nomeDe).join(", ")}. Diga qual (o nome completo).`, candidatos: achados.slice(0, 6) };
    return { erro: `Não achei ${rotulo} "${ref}".` };
  };
  const todasPalavras = (alvo, ref) => { const pa = norm(alvo).split(" "); const pr = norm(ref).split(" ").filter(Boolean); return pr.length > 0 && pr.every((w) => pa.some((x) => x.startsWith(w))); };

  const achar = {
    pessoa(lista, ref) {
      const r = txt(ref); if (!r) return { erro: "Diga qual funcionário." };
      const n = norm(r);
      let a = lista.filter((p) => p.id === r);
      if (!a.length) a = lista.filter((p) => p.usuario && norm(p.usuario) === n);
      if (!a.length) a = lista.filter((p) => norm(p.nome) === n);
      if (!a.length) a = lista.filter((p) => todasPalavras(p.nome, r) || (p.usuario && norm(p.usuario).startsWith(n)));
      return unico(a, r, "funcionário", (p) => p.nome);
    },
    produto(lista, ref) {
      const r = txt(ref); if (!r) return { erro: "Diga qual produto." };
      const n = norm(r); const cod = r.toLowerCase();
      let a = lista.filter((p) => p.id === r);
      if (!a.length) a = lista.filter((p) => p.codigo && String(p.codigo).trim().toLowerCase() === cod);
      if (!a.length) a = lista.filter((p) => norm(p.nome) === n);
      if (!a.length) a = lista.filter((p) => todasPalavras(p.nome, r));
      if (!a.length) { const m = D().casarProduto({ descricao: r }, lista); if (m.produto) a = [m.produto]; }
      return unico(a, r, "produto", (p) => p.nome);
    },
    veiculo(lista, ref) {
      const r = txt(ref); if (!r) return { erro: "Diga qual caminhão (a placa)." };
      const pl = placaDe(r);
      let a = lista.filter((v) => v.id === r);
      if (!a.length && pl) a = lista.filter((v) => v.placa === pl);
      if (!a.length) a = lista.filter((v) => norm(`${v.marca || ""} ${v.modelo || ""} ${v.placa}`).includes(norm(r)));
      return unico(a, r, "caminhão", (v) => v.placa);
    },
    nota(lista, ref) {
      const r = txt(ref); if (!r) return { erro: "Diga o número da nota." };
      const num0 = r.replace(/^nota\s*/i, "").trim();
      let a = lista.filter((x) => x.id === r || x.numero === num0);
      if (!a.length && /^\d+$/.test(num0)) a = lista.filter((x) => String(Number(x.numero)) === String(Number(num0)));
      return unico(a, r, "nota", (x) => x.numero);
    },
  };

  raiz.NEFerramentas = {
    ErroAssistente, ErroProposta, catalogo, registrar, achar,
    util: { arr, txt, vazio, num, digitos, semAcento, norm, fmt, linha, plural, nomeBonito, tituloProduto, dataISO, dataBR, telefoneBR, placaDe, placaValida },
    dom: { FUNCOES, ROTULO_FUNCAO, funcaoDe, papelDe, acesso, podeUsarAssistente, FUNCOES_DO_ASSISTENTE, senhaNova, usuarioDe, TIPOS_VEICULO, tipoVeiculoDe, TIPOS_FOTO_VEICULO, UNIDADES, unidadeDe, TELAS, FLUXOS },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.NEFerramentas;
})(typeof window !== "undefined" ? window : globalThis);
