// NÚCLEO DE REGRAS DA NOVA ERA — sem tela, sem rede, sem relógio escondido.
// Mesma lógica em quatro lugares: app real, ambiente de teste, testes automáticos e assistente no servidor.
// Tudo recebe "agora" por parâmetro para os testes serem exatos. Fuso fixo: Brasília (UTC−3).
(function (raiz) {
  "use strict";
  const MIN = 60000, HORA = 3600000, DIA = 86400000, FUSO = -3 * HORA;

  // ───────────────────────── texto e números ─────────────────────────
  const normalizar = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const arred = (n, d = 2) => Math.round((Number(n) + Number.EPSILON) * 10 ** d) / 10 ** d;
  const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const plural = (n, um, varios) => `${fmt(n)} ${Math.abs(Number(n)) === 1 ? um : varios}`;
  const lista = (nomes, max = 3) => {
    const v = nomes.slice(0, max); const resto = nomes.length - v.length;
    if (!v.length) return "";
    const base = v.length === 1 ? v[0] : `${v.slice(0, -1).join(", ")} e ${v[v.length - 1]}`;
    return resto > 0 ? `${base} e mais ${resto}` : base;
  };

  // ───────────────────────── datas (Brasília) ─────────────────────────
  const aMs = (d) => (typeof d === "number" ? d : new Date(d).getTime());
  const inicioDoDia = (ms) => Math.floor((aMs(ms) + FUSO) / DIA) * DIA - FUSO;
  const chaveDia = (ms) => new Date(aMs(ms) + FUSO).toISOString().slice(0, 10);
  const diaDaSemana = (ms) => new Date(aMs(ms) + FUSO).getUTCDay();
  const minutosDoDia = (ms) => { const d = new Date(aMs(ms) + FUSO); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const rotuloDia = (ms) => { const [, m, d] = chaveDia(ms).split("-"); return `${d}/${m}`; };
  const duracao = (min) => {
    const m = Math.round(min);
    if (m < 1) return "menos de 1 min";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };
  function tempoRelativo(ms, agora) {
    const dif = aMs(agora) - aMs(ms);
    if (dif < MIN) return "agora";
    if (dif < DIA && chaveDia(ms) === chaveDia(agora)) return `há ${duracao(dif / MIN)}`;
    const dias = Math.round((inicioDoDia(agora) - inicioDoDia(ms)) / DIA);
    return dias <= 1 ? "ontem" : `há ${dias} dias`;
  }
  function periodo(chave, agora) {
    const hoje = inicioDoDia(agora);
    if (chave === "ontem") return { chave, rotulo: "ontem", de: hoje - DIA, ate: hoje, dias: 1 };
    if (chave === "7d") return { chave, rotulo: "nos últimos 7 dias", de: hoje - 6 * DIA, ate: hoje + DIA, dias: 7 };
    if (chave === "30d") return { chave, rotulo: "nos últimos 30 dias", de: hoje - 29 * DIA, ate: hoje + DIA, dias: 30 };
    return { chave: "hoje", rotulo: "hoje", de: hoje, ate: hoje + DIA, dias: 1 };
  }

  // ───────────────────────── configuração ─────────────────────────
  const CONFIG_PADRAO = {
    limiteNotaParadaMin: 120,
    diasContagem: 14,
    expediente: { dias: [1, 2, 3, 4, 5, 6], inicio: "06:00", fim: "19:00" },
    resumoDiarioHora: "18:00",
  };
  const comPadrao = (c) => ({ ...CONFIG_PADRAO, ...(c || {}), expediente: { ...CONFIG_PADRAO.expediente, ...((c && c.expediente) || {}) } });
  const hhmm = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  function foraDoExpediente(ms, expediente) {
    const e = (expediente) || CONFIG_PADRAO.expediente;
    if (!e.dias.includes(diaDaSemana(ms))) return true;
    const min = minutosDoDia(ms);
    return min < hhmm(e.inicio) || min >= hhmm(e.fim);
  }

  // ───────────────────────── conferência ─────────────────────────
  const difItem = (i) => arred(Number(i.qtd_carregada) - Number(i.qtd_nota));
  function analisarItens(itens) {
    let aMais = 0, aMenos = 0; const itensDif = [];
    for (const i of itens || []) {
      const d = difItem(i);
      if (d > 0) aMais += d; else if (d < 0) aMenos += -d;
      if (d !== 0) itensDif.push({ ...i, dif: d });
    }
    return { aMais: arred(aMais), aMenos: arred(aMenos), divergente: itensDif.length > 0, itensDif };
  }
  const textoDif = (d) => (d === 0 ? "Igual à nota" : d > 0 ? `${fmt(d)} a mais que a nota` : `${fmt(-d)} a menos que a nota`);
  const totalPilhas = ({ pilhas = 0, porPilha = 0, soltas = 0 }) => arred(Number(pilhas) * Number(porPilha) + Number(soltas));

  // ───────────────────────── chave de acesso da NF-e ─────────────────────────
  // cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
  function dvChave(d43) {
    let soma = 0, peso = 2;
    for (let i = d43.length - 1; i >= 0; i--) { soma += Number(d43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
    const r = 11 - (soma % 11);
    return r >= 10 ? 0 : r;
  }
  const validarChave = (ch) => /^\d{44}$/.test(ch) && dvChave(ch.slice(0, 43)) === Number(ch[43]) && ["55", "65"].includes(ch.slice(20, 22));
  const interpretarChave = (ch) => ({ chave: ch, modelo: ch.slice(20, 22), cnpj: ch.slice(6, 20), serie: String(Number(ch.slice(22, 25))), numero: String(Number(ch.slice(25, 34))), emissao: `${ch.slice(4, 6)}/20${ch.slice(2, 4)}` });
  function extrairChave(texto) {
    const so = String(texto == null ? "" : texto).replace(/\D/g, "");
    for (let i = 0; i + 44 <= so.length; i++) { const c = so.slice(i, i + 44); if (validarChave(c)) return c; }
    return null;
  }
  const formatarChave = (ch) => String(ch).replace(/(\d{4})/g, "$1 ").trim();

  // ───────────────────────── casar item da nota com produto do cadastro ─────────────────────────
  const STOP = new Set(["de", "do", "da", "dos", "das", "com", "em", "para", "e", "a", "o", "un", "und", "pc", "pca"]);
  const palavras = (t) => normalizar(t).split(" ").filter((p) => p && !STOP.has(p));
  function casarProduto(item, produtos) {
    const cod = String(item.codigo == null ? "" : item.codigo).trim().toLowerCase();
    if (cod) {
      const p = produtos.find((x) => x.codigo && String(x.codigo).trim().toLowerCase() === cod);
      if (p) return { produto: p, nivel: "codigo", pontuacao: 1 };
    }
    const nd = normalizar(item.descricao);
    if (!nd) return { produto: null, nivel: null, pontuacao: 0 };
    const exato = produtos.find((x) => normalizar(x.nome) === nd);
    if (exato) return { produto: exato, nivel: "nome", pontuacao: 1 };
    const td = new Set(palavras(item.descricao));
    let melhor = { produto: null, nivel: null, pontuacao: 0 };
    for (const p of produtos) {
      const tp = palavras(p.nome); if (!tp.length) continue;
      const comuns = tp.filter((w) => td.has(w)).length;
      const contido = comuns === tp.length;                        // todas as palavras do cadastro aparecem na descrição
      const jaccard = comuns / new Set([...td, ...tp]).size;
      const pont = contido ? Math.max(0.85, jaccard) : jaccard;
      if (pont > melhor.pontuacao) melhor = { produto: p, nivel: "parecido", pontuacao: arred(pont) };
    }
    return melhor.pontuacao >= 0.6 ? melhor : { produto: null, nivel: null, pontuacao: melhor.pontuacao };
  }

  // ───────────────────────── estoque ─────────────────────────
  // saldos: [{produto_id, nome, unidade, minimo, por_pilha, saldo, ultima_contagem}]
  function calcularSaldos(produtos, movimentos, contagens) {
    const soma = new Map(); const ultima = new Map();
    for (const m of movimentos || []) soma.set(m.produto_id, arred((soma.get(m.produto_id) || 0) + Number(m.quantidade)));
    for (const c of contagens || []) for (const i of c.itens || []) { const t = aMs(c.criado_em); if (!ultima.has(i.produto_id) || t > ultima.get(i.produto_id)) ultima.set(i.produto_id, t); }
    return (produtos || []).map((p) => ({
      produto_id: p.id, nome: p.nome, unidade: p.unidade || "un", minimo: Number(p.minimo || 0), por_pilha: p.por_pilha || null,
      saldo: soma.get(p.id) || 0, ultima_contagem: ultima.has(p.id) ? new Date(ultima.get(p.id)).toISOString() : null, ativo: p.ativo !== false,
    }));
  }
  function situacaoEstoque(s, config, agora) {
    const cfg = comPadrao(config);
    const dias = s.ultima_contagem ? Math.floor((aMs(agora) - aMs(s.ultima_contagem)) / DIA) : null;
    let estado = "ok";
    if (s.saldo < 0) estado = "negativo"; else if (s.minimo > 0 && s.saldo < s.minimo) estado = "baixo";
    return { estado, diasSemContar: dias, precisaContar: dias === null || dias > cfg.diasContagem };
  }
  function coberturaDias(produtoId, movimentos, saldo, agora, janelaDias = 14) {
    const ini = aMs(agora) - janelaDias * DIA; let saidas = 0;
    for (const m of movimentos || []) if (m.produto_id === produtoId && m.tipo === "saida" && aMs(m.criado_em) >= ini && aMs(m.criado_em) <= aMs(agora)) saidas += -Number(m.quantidade);
    const media = saidas / janelaDias;
    return media > 0 && saldo >= 0 ? arred(saldo / media, 1) : null;
  }
  // Contagem inteligente: em vez de contar tudo, conta o que tem mais risco de estar errado.
  function sugerirContagem({ saldos, movimentos, conferencias, config, agora }, n = 5) {
    const cfg = comPadrao(config); const ini = aMs(agora) - 14 * DIA; const giro = new Map(); const difs = new Map();
    for (const m of movimentos || []) if (m.tipo === "saida" && aMs(m.criado_em) >= ini) giro.set(m.produto_id, (giro.get(m.produto_id) || 0) + -Number(m.quantidade));
    for (const c of conferencias || []) if (aMs(c.criado_em) >= ini) for (const i of c.itens || []) if (i.produto_id && difItem(i) !== 0) difs.set(i.produto_id, (difs.get(i.produto_id) || 0) + 1);
    const maxGiro = Math.max(1, ...giro.values());
    return (saldos || []).filter((s) => s.ativo !== false).map((s) => {
      const sit = situacaoEstoque(s, cfg, agora); const motivos = []; let pontos = 0;
      if (sit.estado === "negativo") { pontos += 40; motivos.push("saldo negativo no sistema"); }
      else if (sit.estado === "baixo") { pontos += 15; motivos.push("abaixo do mínimo"); }
      const d = difs.get(s.produto_id) || 0; if (d) { pontos += 6 * Math.min(d, 5); motivos.push(`diferença em ${plural(d, "carga", "cargas")}`); }
      if (sit.diasSemContar === null) { pontos += 20; motivos.push("nunca foi contado"); }
      else if (sit.diasSemContar > cfg.diasContagem) { pontos += Math.min(sit.diasSemContar, 40); motivos.push(`sem contar há ${sit.diasSemContar} dias`); }
      const g = giro.get(s.produto_id) || 0; pontos += 15 * (g / maxGiro); if (g / maxGiro > 0.5) motivos.push("muita saída recente");
      return { ...s, pontos: arred(pontos, 1), motivos };
    }).filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, n);
  }

  // ───────────────────────── alertas ─────────────────────────
  const TIPOS_ALERTA = {
    saida_sem_nota: { rotulo: "Saiu mais do que a nota", severidade: "critico", dica: "Carga conferida com peças a mais do que a nota fiscal." },
    divergencia_carga: { rotulo: "Faltou peça na carga", severidade: "atencao", dica: "Carga conferida com menos peças do que a nota." },
    estoque_negativo: { rotulo: "Estoque negativo", severidade: "critico", dica: "O sistema mostra saldo abaixo de zero." },
    estoque_baixo: { rotulo: "Estoque abaixo do mínimo", severidade: "atencao", dica: "Produto abaixo do mínimo configurado." },
    contagem_divergente: { rotulo: "Contagem com diferença", severidade: "atencao", dica: "A contagem física não bateu com o sistema." },
    nota_parada: { rotulo: "Nota esperando conferência", severidade: "atencao", dica: "Nota na fila há mais tempo que o limite." },
    fora_horario: { rotulo: "Conferência fora do expediente", severidade: "atencao", dica: "Carga conferida fora do horário de trabalho." },
    senha_esquecida: { rotulo: "Pedido de ajuda para entrar", severidade: "atencao", dica: "Alguém esqueceu a senha e pediu ajuda." },
    resumo_dia: { rotulo: "Resumo do dia", severidade: "info", dica: "Resumo enviado no fim do expediente." },
    nota_nova: { rotulo: "Nota nova na fila", severidade: "info", dica: "Chegou uma nota para conferir." },
    contagem_solicitada: { rotulo: "Contagem solicitada", severidade: "info", dica: "A expedição pediu uma contagem de estoque." },
    sistema: { rotulo: "Aviso do sistema", severidade: "info", dica: "Avisos gerais." },
  };
  const ALERTAS_ADMIN = ["saida_sem_nota", "divergencia_carga", "estoque_negativo", "estoque_baixo", "contagem_divergente", "nota_parada", "fora_horario", "senha_esquecida", "resumo_dia", "sistema"];
  const ALERTAS_FUNCIONARIO = ["nota_nova", "contagem_solicitada"];
  const alertasPadrao = (papel) => (papel === "admin" ? ALERTAS_ADMIN.slice() : ALERTAS_FUNCIONARIO.slice());
  const destinatarios = (tipo, perfis) => (perfis || []).filter((p) => p.ativo !== false && (p.alertas || alertasPadrao(p.papel)).includes(tipo)).map((p) => p.id);

  function alertasDaConferencia({ nota, conf, itens, produtos, saldosDepois, config, agora }) {
    const out = []; const a = analisarItens(itens);
    if (a.divergente) {
      const partes = a.itensDif.map((i) => `${i.descricao} ${i.dif > 0 ? "+" : "−"}${fmt(Math.abs(i.dif))}`);
      const maisQue = a.aMais > 0;
      out.push({
        tipo: maisQue ? "saida_sem_nota" : "divergencia_carga", severidade: maisQue ? "critico" : "atencao",
        titulo: maisQue ? `Nota ${nota.numero}: saiu mais do que a nota` : `Nota ${nota.numero}: faltou peça na carga`,
        texto: `${lista(partes, 4)}. Caminhão ${conf.placa}.${conf.motivo_divergencia ? ` Motivo informado: ${conf.motivo_divergencia}.` : ""}`,
        ref_tipo: "conferencia", ref_id: conf.id, chave_dedupe: `conf:${conf.id}:dif`,
      });
    }
    const vistos = new Set();
    for (const i of itens) {
      if (!i.produto_id || vistos.has(i.produto_id)) continue; vistos.add(i.produto_id);
      const s = (saldosDepois || {})[i.produto_id]; const p = (produtos || []).find((x) => x.id === i.produto_id);
      if (s === undefined || !p) continue;
      if (s < 0) out.push({ tipo: "estoque_negativo", severidade: "critico", titulo: `Estoque negativo: ${p.nome}`, texto: `Depois da nota ${nota.numero}, o sistema mostra ${fmt(s)} ${p.unidade || "un"} de ${p.nome}. Saiu mais do que foi lançado de entrada. Faça uma contagem.`, ref_tipo: "produto", ref_id: p.id, chave_dedupe: `estoque_negativo:${p.id}:${chaveDia(agora)}` });
      else if (Number(p.minimo) > 0 && s < Number(p.minimo)) out.push({ tipo: "estoque_baixo", severidade: "atencao", titulo: `Estoque baixo: ${p.nome}`, texto: `Restam ${fmt(s)} ${p.unidade || "un"} (mínimo ${fmt(p.minimo)}). Hora de programar a produção.`, ref_tipo: "produto", ref_id: p.id, chave_dedupe: `estoque_baixo:${p.id}:${chaveDia(agora)}` });
    }
    if (foraDoExpediente(conf.criado_em, comPadrao(config).expediente)) {
      out.push({ tipo: "fora_horario", severidade: "atencao", titulo: `Conferência fora do expediente (nota ${nota.numero})`, texto: `A carga do caminhão ${conf.placa} foi conferida às ${horaTexto(conf.criado_em)}, fora do horário de trabalho.`, ref_tipo: "conferencia", ref_id: conf.id, chave_dedupe: `conf:${conf.id}:horario` });
    }
    return out;
  }
  const horaTexto = (ms) => { const m = minutosDoDia(ms); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

  function alertasDaContagem({ contagem, itens, produtos }) {
    const dif = (itens || []).filter((i) => Number(i.diferenca) !== 0);
    if (!dif.length) return [];
    const nome = (id) => ((produtos || []).find((p) => p.id === id) || {}).nome || "Produto";
    const partes = dif.map((i) => `${nome(i.produto_id)} ${i.diferenca > 0 ? "+" : "−"}${fmt(Math.abs(i.diferenca))}`);
    const grande = dif.some((i) => Math.abs(i.diferenca) >= Math.max(5, 0.1 * Math.abs(i.esperado || 0)));
    return [{ tipo: "contagem_divergente", severidade: grande ? "critico" : "atencao", titulo: `Contagem com diferença em ${plural(dif.length, "produto", "produtos")}`, texto: `${lista(partes, 4)}. Aprove o ajuste ou peça nova contagem.`, ref_tipo: "contagem", ref_id: contagem.id, chave_dedupe: `contagem:${contagem.id}` }];
  }

  // Verificações por tempo (rodam sozinhas no servidor a cada poucos minutos)
  function alertasDaVarredura({ notas, saldos, contagens, config, agora, pushJaEnviadoResumo }) {
    const cfg = comPadrao(config); const out = []; const dia = chaveDia(agora);
    for (const n of notas || []) {
      if (n.status !== "pendente" && n.status !== "em_conferencia") continue;
      const idade = (aMs(agora) - aMs(n.criado_em)) / MIN;
      if (idade >= cfg.limiteNotaParadaMin) out.push({ tipo: "nota_parada", severidade: "atencao", titulo: `Nota ${n.numero} esperando há ${duracao(idade)}`, texto: `${n.cliente ? n.cliente + ". " : ""}Está na fila sem conferência. Limite configurado: ${duracao(cfg.limiteNotaParadaMin)}.`, ref_tipo: "nota", ref_id: n.id, chave_dedupe: `nota_parada:${n.id}` });
    }
    for (const s of saldos || []) {
      if (s.ativo === false) continue;
      const sit = situacaoEstoque(s, cfg, agora);
      if (sit.estado === "negativo") out.push({ tipo: "estoque_negativo", severidade: "critico", titulo: `Estoque negativo: ${s.nome}`, texto: `O sistema mostra ${fmt(s.saldo)} ${s.unidade}. Faça uma contagem para corrigir.`, ref_tipo: "produto", ref_id: s.produto_id, chave_dedupe: `estoque_negativo:${s.produto_id}:${dia}` });
      else if (sit.estado === "baixo") out.push({ tipo: "estoque_baixo", severidade: "atencao", titulo: `Estoque baixo: ${s.nome}`, texto: `Restam ${fmt(s.saldo)} ${s.unidade} (mínimo ${fmt(s.minimo)}).`, ref_tipo: "produto", ref_id: s.produto_id, chave_dedupe: `estoque_baixo:${s.produto_id}:${dia}` });
    }
    const horaResumo = hhmm(cfg.resumoDiarioHora);
    if (minutosDoDia(agora) >= horaResumo && !pushJaEnviadoResumo) out.push({ tipo: "resumo_dia", severidade: "info", titulo: "Resumo do dia", texto: "__RESUMO__", ref_tipo: "painel", ref_id: null, chave_dedupe: `resumo:${dia}` });
    return out;
  }

  // ───────────────────────── indicadores e painel ─────────────────────────
  const noPeriodo = (lst, de, ate) => (lst || []).filter((c) => aMs(c.criado_em) >= de && aMs(c.criado_em) < ate);
  function kpis(conferencias, de, ate) {
    const cs = noPeriodo(conferencias, de, ate);
    let aMais = 0, aMenos = 0, pecas = 0, divergentes = 0, durSoma = 0, durN = 0;
    for (const c of cs) {
      const a = analisarItens(c.itens); aMais += a.aMais; aMenos += a.aMenos; if (a.divergente) divergentes++;
      for (const i of c.itens || []) pecas += Number(i.qtd_carregada);
      if (c.duracao_s != null && c.duracao_s >= 0) { durSoma += c.duracao_s; durN++; }
    }
    const total = cs.length;
    return { total, corretas: total - divergentes, divergentes, acertoPct: total ? Math.round(((total - divergentes) / total) * 100) : null,
      aMais: arred(aMais), aMenos: arred(aMenos), pecas: arred(pecas), duracaoMediaMin: durN ? arred(durSoma / durN / 60, 1) : null };
  }
  function serieDiaria(conferencias, dias, agora) {
    const hoje = inicioDoDia(agora); const out = [];
    for (let k = dias - 1; k >= 0; k--) {
      const de = hoje - k * DIA; const q = kpis(conferencias, de, de + DIA);
      out.push({ dia: chaveDia(de), rotulo: rotuloDia(de), ms: de, total: q.total, corretas: q.corretas, divergentes: q.divergentes, aMais: q.aMais, aMenos: q.aMenos, acertoPct: q.acertoPct });
    }
    return out;
  }
  function rankingProdutos(conferencias, de, ate) {
    const m = new Map();
    for (const c of noPeriodo(conferencias, de, ate)) for (const i of c.itens || []) {
      const d = difItem(i); if (d === 0) continue;
      const k = i.produto_id || normalizar(i.descricao); const x = m.get(k) || { chave: k, produto_id: i.produto_id || null, nome: i.descricao, aMais: 0, aMenos: 0, ocorrencias: 0 };
      if (d > 0) x.aMais += d; else x.aMenos += -d; x.ocorrencias++; m.set(k, x);
    }
    return [...m.values()].sort((a, b) => (b.aMais + b.aMenos) - (a.aMais + a.aMenos));
  }
  function equipe(conferencias, de, ate) {
    const m = new Map();
    for (const c of noPeriodo(conferencias, de, ate)) {
      const nome = (c.conferente && c.conferente.nome) || "—"; const k = c.conferente_id || nome;
      const x = m.get(k) || { id: c.conferente_id, nome, total: 0, divergentes: 0, durSoma: 0, durN: 0 };
      x.total++; if (analisarItens(c.itens).divergente) x.divergentes++; if (c.duracao_s != null) { x.durSoma += c.duracao_s; x.durN++; } m.set(k, x);
    }
    return [...m.values()].map((x) => ({ id: x.id, nome: x.nome, total: x.total, divergentes: x.divergentes, duracaoMediaMin: x.durN ? arred(x.durSoma / x.durN / 60, 1) : null })).sort((a, b) => b.total - a.total);
  }
  const NIVEL = { critico: 3, atencao: 2, info: 1, ok: 0 };

  function insights(ctx) {
    const { conferencias = [], notas = [], saldos = [], movimentos = [], contagens = [], agora } = ctx;
    const cfg = comPadrao(ctx.config); const per = ctx.periodo || periodo("hoje", agora);
    const out = []; const q = kpis(conferencias, per.de, per.ate); const confsPer = noPeriodo(conferencias, per.de, per.ate);
    const rank = rankingProdutos(conferencias, per.de, per.ate);

    if (q.aMais > 0) {
      const nCargas = confsPer.filter((c) => analisarItens(c.itens).aMais > 0).length;
      const top = rank.filter((r) => r.aMais > 0).sort((a, b) => b.aMais - a.aMais)[0];
      out.push({ id: "saida_sem_nota", nivel: "critico", titulo: `${plural(q.aMais, "peça saiu", "peças saíram")} a mais do que nas notas`,
        texto: `Aconteceu em ${plural(nCargas, "carga", "cargas")} (${per.rotulo}).${top ? ` Mais afetado: ${top.nome} (+${fmt(top.aMais)}).` : ""} Peça que sai sem nota não é cobrada e deixa o estoque errado.`,
        acao: { rotulo: "Ver cargas com diferença", rota: "conferencias", params: { dif: "1" } } });
    }
    if (q.aMenos > 0) {
      const nCargas = confsPer.filter((c) => analisarItens(c.itens).aMenos > 0).length;
      out.push({ id: "faltou_peca", nivel: "atencao", titulo: `${plural(q.aMenos, "peça faltou", "peças faltaram")} em ${plural(nCargas, "carga", "cargas")}`,
        texto: `Confira se a peça ficou no pátio. O cliente pode reclamar de falta na entrega.`, acao: { rotulo: "Ver cargas com diferença", rota: "conferencias", params: { dif: "1" } } });
    }
    for (const n of notas) {
      if (n.status !== "pendente" && n.status !== "em_conferencia") continue;
      const idade = (aMs(ctx.agora) - aMs(n.criado_em)) / MIN;
      if (idade >= cfg.limiteNotaParadaMin) out.push({ id: `nota_parada_${n.id}`, nivel: idade >= 2 * cfg.limiteNotaParadaMin ? "critico" : "atencao", titulo: `Nota ${n.numero} espera há ${duracao(idade)}`,
        texto: `${n.cliente ? n.cliente + ". " : ""}Passou do limite de ${duracao(cfg.limiteNotaParadaMin)} sem conferência. O caminhão pode estar parado esperando.`, acao: { rotulo: "Abrir a fila de notas", rota: "notas" } });
    }
    for (const s of saldos) {
      if (s.ativo === false) continue; const sit = situacaoEstoque(s, cfg, agora); const cob = coberturaDias(s.produto_id, movimentos, s.saldo, agora);
      if (sit.estado === "negativo") out.push({ id: `neg_${s.produto_id}`, nivel: "critico", titulo: `${s.nome}: saldo negativo (${fmt(s.saldo)})`, texto: "Saiu mais do que foi lançado de entrada. Provavelmente falta lançar a produção ou saiu peça sem nota. Faça uma contagem.", acao: { rotulo: "Ir para o estoque", rota: "estoque" } });
      else if (sit.estado === "baixo") out.push({ id: `baixo_${s.produto_id}`, nivel: "atencao", titulo: `${s.nome}: abaixo do mínimo`, texto: `Restam ${fmt(s.saldo)} ${s.unidade} (mínimo ${fmt(s.minimo)}).${cob ? ` No ritmo atual dura cerca de ${plural(cob, "dia", "dias")}.` : ""}`, acao: { rotulo: "Ir para o estoque", rota: "estoque" } });
      else if (cob !== null && cob < 3 && s.saldo > 0) out.push({ id: `acaba_${s.produto_id}`, nivel: "info", titulo: `${s.nome} acaba em cerca de ${plural(cob, "dia", "dias")}`, texto: `Restam ${fmt(s.saldo)} ${s.unidade} e a saída média é maior que isso por semana. Vale programar produção.`, acao: { rotulo: "Ir para o estoque", rota: "estoque" } });
    }
    const aguardando = (contagens || []).filter((c) => c.status === "aguardando_aprovacao");
    if (aguardando.length) {
      const c = aguardando[0]; const nDif = (c.itens || []).filter((i) => Number(i.diferenca) !== 0).length;
      out.push({ id: "contagem_pendente", nivel: "atencao", titulo: `Contagem de ${tempoRelativo(c.criado_em, agora)} aguarda sua decisão`, texto: `${plural(nDif, "produto está", "produtos estão")} com diferença entre o que foi contado e o sistema. Aprove o ajuste ou peça nova contagem.`, acao: { rotulo: "Ver a contagem", rota: "estoque", params: { aba: "contagens" } } });
    }
    const velhos = saldos.filter((s) => s.ativo !== false && situacaoEstoque(s, cfg, agora).precisaContar);
    if (velhos.length) out.push({ id: "sem_contagem", nivel: "info", titulo: `${plural(velhos.length, "produto sem contagem recente", "produtos sem contagem recente")}`, texto: `${lista(velhos.map((s) => s.nome), 4)}. A "Contagem do dia" escolhe o que mais vale contar e leva uns 3 minutos.`, acao: { rotulo: "Fazer a contagem do dia", rota: "contagem" } });
    const quinze = aMs(agora) - 14 * DIA; const reinc = new Map();
    for (const c of conferencias) if (aMs(c.criado_em) >= quinze) for (const i of c.itens || []) if (difItem(i) !== 0) { const k = i.produto_id || normalizar(i.descricao); const x = reinc.get(k) || { nome: i.descricao, n: 0 }; x.n++; reinc.set(k, x); }
    for (const x of reinc.values()) if (x.n >= 3) out.push({ id: `reinc_${normalizar(x.nome)}`, nivel: "atencao", titulo: `${x.nome} diverge pela ${x.n}ª vez em 14 dias`, texto: "Quando o mesmo produto erra várias vezes, o problema costuma estar na separação, na embalagem ou no cadastro da nota — não na pessoa.", acao: { rotulo: "Ver as cargas com diferença", rota: "conferencias", params: { dif: "1" } } });
    const fora = confsPer.filter((c) => foraDoExpediente(c.criado_em, cfg.expediente));
    if (fora.length) out.push({ id: "fora_horario", nivel: "atencao", titulo: `${plural(fora.length, "conferência fora", "conferências fora")} do expediente`, texto: `Carga conferida às ${lista(fora.map((c) => horaTexto(c.criado_em)), 3)}. Confirme se foi autorizado.`, acao: { rotulo: "Ver conferências", rota: "conferencias" } });
    if (q.total > 0 && q.divergentes === 0) out.push({ id: "tudo_certo", nivel: "ok", titulo: `Todas as ${plural(q.total, "carga conferiu", "cargas conferiram")} com a nota`, texto: `Nenhuma peça saiu a mais ou a menos ${per.rotulo}.` });
    out.sort((a, b) => NIVEL[b.nivel] - NIVEL[a.nivel]);
    return out;
  }
  function semaforo(lst, q, per) {
    const max = lst.reduce((m, i) => Math.max(m, NIVEL[i.nivel]), 0);
    if (max >= 3) return { cor: "vermelho", titulo: "Ação necessária", texto: lst.find((i) => i.nivel === "critico").titulo + "." };
    if (max === 2) return { cor: "amarelo", titulo: "Atenção", texto: lst.find((i) => i.nivel === "atencao").titulo + "." };
    if (q.total === 0) return { cor: "verde", titulo: "Tudo em ordem", texto: `Nenhuma carga conferida ${per.rotulo} até agora.` };
    return { cor: "verde", titulo: "Tudo em ordem", texto: `${plural(q.total, "carga conferida", "cargas conferidas")} ${per.rotulo}, todas corretas.` };
  }
  function resumoDoPeriodo(ctx, chave) {
    const agora = ctx.agora; const per = periodo(chave || "hoje", agora); const cfg = comPadrao(ctx.config);
    const q = kpis(ctx.conferencias, per.de, per.ate); const ins = insights({ ...ctx, periodo: per });
    const notasFila = (ctx.notas || []).filter((n) => n.status === "pendente" || n.status === "em_conferencia");
    const paradas = notasFila.filter((n) => (aMs(agora) - aMs(n.criado_em)) / MIN >= cfg.limiteNotaParadaMin);
    const saldos = ctx.saldos || [];
    return {
      periodo: per, kpis: q, insights: ins, semaforo: semaforo(ins, q, per), serie: serieDiaria(ctx.conferencias, 14, agora),
      produtos: rankingProdutos(ctx.conferencias, per.de, per.ate), equipe: equipe(ctx.conferencias, per.de, per.ate),
      fila: { total: notasFila.length, paradas: paradas.length, mais_antiga_min: notasFila.length ? Math.max(...notasFila.map((n) => (aMs(agora) - aMs(n.criado_em)) / MIN)) : null },
      estoque: {
        negativos: saldos.filter((s) => s.ativo !== false && s.saldo < 0), baixos: saldos.filter((s) => s.ativo !== false && s.saldo >= 0 && s.minimo > 0 && s.saldo < s.minimo),
        semContar: saldos.filter((s) => s.ativo !== false && situacaoEstoque(s, cfg, agora).precisaContar),
        sugestao: sugerirContagem({ saldos, movimentos: ctx.movimentos, conferencias: ctx.conferencias, config: cfg, agora }, 5),
        aguardando: (ctx.contagens || []).filter((c) => c.status === "aguardando_aprovacao"),
      },
    };
  }

  // ───────────────────────── mensagens e exportação ─────────────────────────
  function mensagemCliente({ nota, conf, link }) {
    const hora = horaTexto(conf.criado_em);
    return `Olá${nota.cliente ? ", " + nota.cliente : ""}! Aqui é da Nova Era. A carga da sua nota ${nota.numero} foi conferida e saiu do nosso pátio às ${hora}. Acompanhe a entrega por aqui: ${link}`;
  }
  function csv(cabecalho, linhas) {
    const esc = (v) => { const s = v == null ? "" : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "\ufeff" + [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n") + "\r\n";
  }
  function csvConferencias(conferencias) {
    return csv(["Data", "Hora", "Nota", "Cliente", "Placa", "Motorista", "Conferente", "Situação", "A mais", "A menos", "Itens (nota → carregado)", "Motivo"],
      conferencias.map((c) => { const a = analisarItens(c.itens); return [chaveDia(c.criado_em).split("-").reverse().join("/"), horaTexto(c.criado_em), c.numero_nota, c.cliente || "", c.placa, c.motorista || "", (c.conferente && c.conferente.nome) || "", a.divergente ? "Com diferença" : "Confere", a.aMais, a.aMenos, (c.itens || []).map((i) => `${i.descricao}: ${fmt(i.qtd_nota)} → ${fmt(i.qtd_carregada)}`).join(" | "), c.motivo_divergencia || ""]; }));
  }
  function csvEstoque(saldos, agora) {
    return csv(["Produto", "Unidade", "Saldo", "Mínimo", "Situação", "Última contagem"], saldos.map((s) => { const sit = situacaoEstoque(s, {}, agora); return [s.nome, s.unidade, s.saldo, s.minimo, sit.estado === "ok" ? "OK" : sit.estado === "baixo" ? "Abaixo do mínimo" : "Negativo", s.ultima_contagem ? chaveDia(s.ultima_contagem).split("-").reverse().join("/") : "nunca"]; }));
  }

  // ───────────────────────── assistente local (sem IA, só cálculo) ─────────────────────────
  function responderLocal(pergunta, ctx) {
    const p = normalizar(pergunta); const agora = ctx.agora; const nada = { texto: "Não entendi essa pergunta. Tente: \"resumo do dia\", \"o que saiu a mais esta semana\", \"estoque baixo\", \"notas paradas\" ou o nome de um produto.", acoes: [] };
    if (!p) return nada;
    const tem = (...ws) => ws.some((w) => p.includes(w));
    const FORA = { texto: "Eu só ajudo com a Nova Era: cargas, notas, estoque, equipe e o painel. Pergunte, por exemplo, \"resumo do dia\", \"o que saiu a mais esta semana\" ou \"o que significa o semáforo?\".", acoes: [] };
    const ASSUNTOS = ["nota", "carga", "estoque", "produto", "caminh", "conferen", "funcionar", "equipe", "painel", "dashboard", "nova era", "expedi", "contag", "aviso", "alerta", "cliente", "entrega", "peca", "saldo", "semaforo", "pilha", "fila", "vendedor", "motorista", "frota", "relatorio", "resumo", "hoje", "ontem", "semana", "kpi", "indicador"];
    const EXPLICA = tem("significa", "explica", "explique", "como funciona", "o que e ", "para que serve", "entender", "como ler");
    if (EXPLICA && tem("semaforo", "painel", "dashboard", "inicio", "indicador", "numero", "kpi", "cor ")) return { texto: "Como ler o painel:\n• Semáforo: verde = tudo certo; amarelo = atenção (algo pede olhar hoje); vermelho = precisa de você agora (ex.: estoque negativo ou peça que saiu a mais).\n• Conferências / % corretas: quantas cargas foram conferidas e quantas bateram com a nota. Abaixo de 90% merece atenção.\n• Com diferença: cargas em que saiu peça a mais (não cobrada!) ou a menos (cliente reclama).\n• Notas na fila: notas esperando conferência; \"parada\" passou do limite de espera.\n• Produtos que pedem atenção: saldo negativo ou abaixo do mínimo.\n• \"O que precisa de você\": cada recado tem um botão que leva direto à tela para resolver.", acoes: [{ rotulo: "Abrir o painel", rota: "inicio" }] };
    if (EXPLICA && tem("estoque", "saldo", "minimo", "contagem", "pilha")) return { texto: "Como funciona o estoque:\n• O saldo é a soma de tudo que entrou (produção) menos o que saiu (cada conferência baixa as peças carregadas).\n• Mínimo: abaixo dele o app avisa a expedição.\n• Contagem do dia: o app escolhe o que mais vale contar (negativos, diferenças recentes, tempo sem contar). A pessoa conta às cegas, por pilhas, e o sistema compara.\n• Se a contagem difere, a administração aprova o ajuste e o saldo é corrigido.", acoes: [{ rotulo: "Ir para o estoque", rota: "estoque" }] };
    const chave = tem("30 dias", "mes") ? "30d" : tem("semana", "7 dias") ? "7d" : tem("ontem") ? "ontem" : "hoje";
    const r = resumoDoPeriodo(ctx, chave);
    if (tem("resumo", "como estamos", "como esta", "situacao", "panorama")) {
      const k = r.kpis;
      const linhas = [`${r.semaforo.titulo}: ${r.semaforo.texto}`, `Conferências ${r.periodo.rotulo}: ${k.total} (${k.acertoPct === null ? "—" : k.acertoPct + "%"} corretas). A mais: ${fmt(k.aMais)} · A menos: ${fmt(k.aMenos)}.`, `Fila de notas: ${r.fila.total}${r.fila.paradas ? ` (${r.fila.paradas} parada${r.fila.paradas > 1 ? "s" : ""})` : ""}.`, `Estoque: ${r.estoque.negativos.length} negativo(s), ${r.estoque.baixos.length} abaixo do mínimo.`];
      return { texto: linhas.join("\n"), acoes: [{ rotulo: "Abrir o painel", rota: "painel" }] };
    }
    if (tem("a mais", "sem nota", "sobrou", "vazamento", "saiu mais")) {
      const itens = r.produtos.filter((x) => x.aMais > 0); if (!itens.length) return { texto: `Nenhuma peça saiu a mais do que a nota ${r.periodo.rotulo}.`, acoes: [] };
      return { texto: `${plural(r.kpis.aMais, "peça saiu", "peças saíram")} a mais ${r.periodo.rotulo}:\n` + itens.slice(0, 6).map((x) => `• ${x.nome}: +${fmt(x.aMais)} (${plural(x.ocorrencias, "carga", "cargas")})`).join("\n"), acoes: [{ rotulo: "Ver as cargas", rota: "conferencias", params: { dif: "1" } }] };
    }
    if (tem("faltou", "a menos", "falta")) {
      const itens = r.produtos.filter((x) => x.aMenos > 0); if (!itens.length) return { texto: `Nenhuma peça faltou ${r.periodo.rotulo}.`, acoes: [] };
      return { texto: `${plural(r.kpis.aMenos, "peça faltou", "peças faltaram")} ${r.periodo.rotulo}:\n` + itens.slice(0, 6).map((x) => `• ${x.nome}: −${fmt(x.aMenos)}`).join("\n"), acoes: [{ rotulo: "Ver as cargas", rota: "conferencias", params: { dif: "1" } }] };
    }
    if (tem("parada", "paradas", "fila", "pendente", "esperando")) {
      const fila = (ctx.notas || []).filter((n) => n.status === "pendente" || n.status === "em_conferencia");
      if (!fila.length) return { texto: "A fila está vazia: todas as notas foram conferidas.", acoes: [] };
      return { texto: `Há ${plural(fila.length, "nota", "notas")} na fila:\n` + fila.slice(0, 8).map((n) => `• Nota ${n.numero}${n.cliente ? " — " + n.cliente : ""} (espera há ${duracao((aMs(agora) - aMs(n.criado_em)) / MIN)})`).join("\n"), acoes: [{ rotulo: "Abrir a fila", rota: "notas" }] };
    }
    if (tem("estoque baixo", "abaixo do minimo", "acabando", "negativo", "repor", "producao")) {
      const l = [...r.estoque.negativos.map((s) => `• ${s.nome}: ${fmt(s.saldo)} (NEGATIVO)`), ...r.estoque.baixos.map((s) => `• ${s.nome}: ${fmt(s.saldo)} (mínimo ${fmt(s.minimo)})`)];
      return { texto: l.length ? `Produtos que pedem atenção:\n${l.join("\n")}` : "Nenhum produto abaixo do mínimo agora.", acoes: [{ rotulo: "Ir para o estoque", rota: "estoque" }] };
    }
    if (tem("contar", "contagem")) {
      const s = r.estoque.sugestao; if (!s.length) return { texto: "Tudo foi contado recentemente. Nada urgente para contar.", acoes: [] };
      return { texto: "Hoje vale contar:\n" + s.map((x) => `• ${x.nome} — ${lista(x.motivos, 2)}`).join("\n"), acoes: [{ rotulo: "Fazer a contagem do dia", rota: "contagem" }] };
    }
    if (tem("quem", "equipe", "conferente", "funcionario")) {
      if (!r.equipe.length) return { texto: `Ninguém conferiu carga ${r.periodo.rotulo}.`, acoes: [] };
      return { texto: `Conferências ${r.periodo.rotulo}:\n` + r.equipe.map((e) => `• ${e.nome}: ${e.total}${e.duracaoMediaMin ? ` (média ${fmt(e.duracaoMediaMin)} min)` : ""}`).join("\n"), acoes: [] };
    }
    const prod = (ctx.saldos || []).find((s) => p.includes(normalizar(s.nome)));
    if (prod) {
      const sit = situacaoEstoque(prod, ctx.config, agora); const cob = coberturaDias(prod.produto_id, ctx.movimentos, prod.saldo, agora);
      return { texto: `${prod.nome}: saldo ${fmt(prod.saldo)} ${prod.unidade} (mínimo ${fmt(prod.minimo)}). ${sit.estado === "baixo" ? "Está abaixo do mínimo. " : sit.estado === "negativo" ? "Saldo NEGATIVO. " : ""}${cob ? `No ritmo dos últimos 14 dias dura cerca de ${plural(cob, "dia", "dias")}. ` : ""}Última contagem: ${prod.ultima_contagem ? tempoRelativo(prod.ultima_contagem, agora) : "nunca"}.`, acoes: [{ rotulo: "Ir para o estoque", rota: "estoque" }] };
    }
    return ASSUNTOS.some((a) => p.includes(a)) ? nada : FORA;
  }

  const API = {
    MIN, HORA, DIA, FUSO, CONFIG_PADRAO, TIPOS_ALERTA, ALERTAS_ADMIN, ALERTAS_FUNCIONARIO,
    normalizar, arred, fmt, plural, lista, aMs, inicioDoDia, chaveDia, diaDaSemana, minutosDoDia, rotuloDia, duracao, tempoRelativo, periodo, horaTexto,
    comPadrao, foraDoExpediente, difItem, analisarItens, textoDif, totalPilhas,
    dvChave, validarChave, interpretarChave, extrairChave, formatarChave, casarProduto,
    calcularSaldos, situacaoEstoque, coberturaDias, sugerirContagem,
    alertasPadrao, destinatarios, alertasDaConferencia, alertasDaContagem, alertasDaVarredura,
    kpis, serieDiaria, rankingProdutos, equipe, insights, semaforo, resumoDoPeriodo,
    mensagemCliente, csv, csvConferencias, csvEstoque, responderLocal,
  };
  raiz.NEDominio = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
