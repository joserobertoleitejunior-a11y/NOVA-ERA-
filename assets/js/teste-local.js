// AMBIENTE DE DEMONSTRAÇÃO. Só é carregado quando o endereço pede ?demo=exemplo ou ?demo=vazio (logins de teste, senha admin).
// Os dados ficam em sessionStorage (NE.memoria, com prefixo ne-demo-): somem ao fechar a aba e nunca tocam o app de verdade.
// Não conversa com o banco e nunca grava nada nele. Usa as mesmas regras do app real (dominio.js).
// Para entregar ao cliente sem a demonstração: config.js → demo: false.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const CHAVE = "ne-teste-v6";
  const MIN = D.MIN, DIA = D.DIA;
  const uid = (p = "t") => `${p}-${(crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "").slice(0, 12)}`;
  const tokenUuid = () => (crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0"));
  const pausa = (ms = 120) => new Promise((ok) => setTimeout(ok, ms));
  const CAMPOS_TEMPO = ["criado_em", "lido_em", "resolvido_em", "concluido_em", "ultima_contagem"];

  function prng(semente) { let a = semente >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ───────────────────────── dados de exemplo ─────────────────────────
  // Estado VAZIO: só os acessos de teste (logins). Nenhum funcionário, produto, caminhão, nota ou conferência de mentira.
  function semearVazio() {
    const agora = Date.now(); const p = (id, nome, usuario, funcao, papel) => ({ id, nome, usuario, funcao, papel, ativo: true, telefone: "" });
    const perfis = [p("u-admin", "Administrador (teste)", "admin", "diretoria", "admin"), p("u-t-vendas", "Vendas (teste)", "adminvendas", "vendedor", "admin"), p("u-t-exped", "Expedição (teste)", "adminexpedicao", "expedicao", "admin"),
      p("u-t-dir", "Diretoria (teste)", "admindiretoria", "diretoria", "admin"), p("u-t-adm", "Administrativo (teste)", "adminadministrativo", "administrativo", "admin"),
      p("u-t-conf", "Conferente (teste)", "conferente", "conferente", "funcionario"), p("u-t-ajud", "Ajudante (teste)", "ajudante", "ajudante", "funcionario"), p("u-t-moto", "Motorista (teste)", "motorista", "motorista", "funcionario")];
    return { v: 6, criadoEm: agora, perfilId: "u-admin", perfis, veiculos: [], produtos: [], notas: [], conferencias: [], movimentos: [], contagens: [], alertas: [], config: { ...D.CONFIG_PADRAO }, vistoResumo: {} };
  }
  const querDemo = () => !!(NE.demo && NE.demo.exemplo);   // ?demo=exemplo: com dados de exemplo · ?demo=vazio: sem nenhum
  // Dados de exemplo (SÓ para os vídeos e para mostrar o app): ligados por ?demo=exemplo.
  function semear() {
    const r = prng(20261120); const agora = Date.now();
    const pick = (l) => l[Math.floor(r() * l.length)];
    const perfis = [
      { id: "u-admin", nome: "Administrador (teste)", usuario: "admin", funcao: "diretoria", papel: "admin", ativo: true, telefone: "15999990000" },
      { id: "u-eduardo", nome: "Eduardo", usuario: "eduardo", funcao: "expedicao", papel: "admin", ativo: true, telefone: "15999990001", observacao: "Responsável pela expedição" },
      { id: "u-carlos", nome: "Carlos Souza", usuario: "carlos", funcao: "conferente", papel: "funcionario", ativo: true, telefone: "15999990002", admissao: "2022-03-14" },
      { id: "u-marcos", nome: "Marcos Lima", usuario: "marcos", funcao: "conferente", papel: "funcionario", ativo: true, telefone: "15999990003", admissao: "2023-08-01" },
      { id: "u-t-vendas", nome: "Vendas (teste)", usuario: "adminvendas", funcao: "vendedor", papel: "admin", ativo: true, telefone: "15999990010" },
      { id: "u-t-exped", nome: "Expedição (teste)", usuario: "adminexpedicao", funcao: "expedicao", papel: "admin", ativo: true, telefone: "15999990011" },
      { id: "u-t-dir", nome: "Diretoria (teste)", usuario: "admindiretoria", funcao: "diretoria", papel: "admin", ativo: true, telefone: "15999990012" },
      { id: "u-t-adm", nome: "Administrativo (teste)", usuario: "adminadministrativo", funcao: "administrativo", papel: "admin", ativo: true, telefone: "15999990013" },
      { id: "u-t-conf", nome: "Conferente (teste)", usuario: "conferente", funcao: "conferente", papel: "funcionario", ativo: true, telefone: "15999990014" },
      { id: "u-t-ajud", nome: "Ajudante (teste)", usuario: "ajudante", funcao: "ajudante", papel: "funcionario", ativo: true, telefone: "15999990015" },
      { id: "u-t-moto", nome: "Motorista (teste)", usuario: "motorista", funcao: "motorista", papel: "funcionario", ativo: true, telefone: "15999990016" },
      { id: "u-wesley", nome: "Wesley Costa", usuario: "wesley", funcao: "vendedor", papel: "admin", ativo: true, telefone: "15999990005" },
      { id: "u-fabio", nome: "Fábio Reis", usuario: "fabio", funcao: "vendedor", papel: "admin", ativo: true, telefone: "15999990006" },
      { id: "u-paulo", nome: "Paulo Dias", usuario: "paulo", funcao: "motorista", papel: "funcionario", ativo: true, telefone: "15999990004", cnh_validade: new Date(agora + 21 * DIA).toISOString().slice(0, 10), observacao: "Opera o truck com munck" },
    ];
    perfis.forEach((p, k) => { if (p.id !== "u-admin") { p.cadastrado_por = "u-admin"; p.criado_em = new Date(agora - (20 + k * 9) * DIA).toISOString(); } });
    const veiculos = [["ABC1D23", "caminhao"], ["BRA2E19", "caminhao"], ["CDE3F45", "caminhao"], ["FGH4I67", "caminhao"], ["IJK5L89", "caminhao"],
      ["LMN6O01", "caminhao"], ["OPQ7R23", "caminhao"], ["RST8U45", "truck_munck"], ["UVW9X67", "truck_munck"]].map(([placa, tipo], i) => ({ id: `v${i + 1}`, placa, tipo, descricao: "", ativo: true,
      marca: ["Volkswagen", "Mercedes-Benz", "Volvo"][i % 3], modelo: tipo === "truck_munck" ? "Truck 6x2 + munck" : ["24.250", "Atego 2426", "VM 270"][i % 3], ano: 2016 + (i % 8), cor: i % 2 ? "Vermelho" : "Branco", capacidade_t: tipo === "truck_munck" ? 12 : 14 + (i % 3) * 2,
      fotos: ["frente", "lateral", "traseira"].map((t) => ({ tipo: t, caminho: `teste/veiculo/${t}/v${i + 1}` })) }));
    const P = [["Boca de lobo", "BL", 20, 4, 6], ["Meio-fio", "MF", 150, 50, 340], ["Guia", "GU", 60, 40, 120], ["Caixa para galeria", "CG", 10, 4, 18], ["Caixa de inspeção", "CI", 10, 2, 40],
      ["Tubo de concreto", "TC", 30, 10, 85], ["Aduela", "AD", 5, 2, -4], ["Dissipador", "DI", 8, 4, 12], ["Ala", "AL", 10, 4, 30], ["Laje", "LJ", 8, 6, 22]];
    const produtos = P.map(([nome, codigo, minimo, por_pilha], i) => ({ id: `p${i + 1}`, nome, codigo, unidade: "un", minimo, por_pilha, ativo: true }));
    const alvo = Object.fromEntries(P.map((p, i) => [`p${i + 1}`, p[4]]));
    const clientes = ["Construtora Alfa", "Prefeitura de Tatuí", "Loteamento Vila Nova", "Saneamento Rio Verde", "JB Obras", "Concreserv Engenharia", "Rodovias do Sul"];
    const vendedores = perfis.filter((p) => p.funcao === "vendedor"); const dono = () => { const v = pick(vendedores); return { vendedor: v.nome, vendedor_id: v.id }; };   // notas de exemplo: de três vendedores, um deles é o login de teste
    const conferentes = [perfis[2], perfis[3]];
    const sorteiaItens = (forcarBL) => {
      const n = 1 + Math.floor(r() * 3); const usados = new Set(forcarBL ? ["p1"] : []); const itens = [];
      if (forcarBL) itens.push({ produto_id: "p1", descricao: "Boca de lobo", qtd_nota: 4 + Math.floor(r() * 4) });
      while (itens.length < n) { const p = pick(produtos); if (usados.has(p.id)) continue; usados.add(p.id); itens.push({ produto_id: p.id, descricao: p.nome, qtd_nota: p.por_pilha * (1 + Math.floor(r() * 3)) / (p.por_pilha > 20 ? 2 : 1) }); }
      return itens.map((i) => ({ ...i, qtd_nota: Math.max(1, Math.round(i.qtd_nota)) }));
    };
    const notas = [], conferencias = [], movimentos = []; let numero = 48100;
    const mover = (produto_id, tipo, quantidade, criado_em, motivo, ref_id) => movimentos.push({ id: uid("m"), produto_id, tipo, quantidade, criado_em: new Date(criado_em).toISOString(), motivo: motivo || null, ref_tipo: ref_id ? "conferencia" : null, ref_id: ref_id || null, usuario_id: "u-admin" });
    const novaConferencia = (quando, forcarBL, divergir, extra = {}) => {
      numero += 1 + Math.floor(r() * 3); const cf = pick(conferentes); const v = pick(veiculos); const cliente = pick(clientes);
      const itensNota = sorteiaItens(forcarBL); const nid = uid("n"), cid = uid("c");
      let alvoDiv = divergir ? Math.floor(r() * itensNota.length) : -1; if (forcarBL) alvoDiv = 0;
      const itens = itensNota.map((i, k) => {
        let c = i.qtd_nota; if (k === alvoDiv) { const dif = forcarBL ? 2 : (r() < 0.65 ? 1 + Math.floor(r() * 3) : -(1 + Math.floor(r() * 2))); c = Math.max(0, i.qtd_nota + dif); }
        return { id: uid("i"), produto_id: i.produto_id, descricao: i.descricao, qtd_nota: i.qtd_nota, qtd_carregada: c };
      });
      const dif = itens.some((i) => i.qtd_nota !== i.qtd_carregada);
      notas.push({ id: nid, numero: String(numero), cliente, ...dono(), status: "conferida", chave_nfe: "", token_publico: tokenUuid(), criado_em: new Date(quando - 40 * MIN).toISOString(), conferencia_id: cid,
        itens: itensNota.map((i) => ({ id: uid("ni"), ...i, quantidade: i.qtd_nota })) });
      conferencias.push({ id: cid, client_id: cid, nota_id: nid, token_publico: tokenUuid(), numero_nota: String(numero), cliente, chave_nfe: "", placa: v.placa, veiculo_id: v.id, motorista: null, conferente_id: cf.id,
        conferente: { nome: cf.nome }, status: dif ? "divergencia" : "ok", motivo_divergencia: dif ? (forcarBL ? "Peças extras separadas por engano" : "Nota vai ser corrigida") : null, observacao: null, latitude: -23.5956, longitude: -48.0532,
        criado_em: new Date(quando).toISOString(), duracao_s: 70 + Math.floor(r() * 150), metodo: "passo_a_passo", itens, fotos: [{ id: uid("f"), tipo: "nota", caminho: `teste/nota/${cid}` }, { id: uid("f"), tipo: "placa", caminho: `teste/placa/${cid}` }, { id: uid("f"), tipo: "carga", caminho: `teste/carga/${cid}` }], ...extra });
      for (const i of itens) if (i.produto_id) mover(i.produto_id, "saida", -i.qtd_carregada, quando, `Nota ${numero}`, cid);
    };
    const inicioHoje = D.inicioDoDia(agora);
    const BL_DIAS = [8, 5, 2]; // Boca de lobo diverge 3 vezes: dispara "reincidência"
    for (let d = 10; d >= 1; d--) {
      const base = inicioHoje - d * DIA; if (D.diaDaSemana(base + 12 * 3600000) === 0) continue;
      const n = 2 + Math.floor(r() * 3); const horas = Array.from({ length: n }, () => 7.5 + r() * 9.5).sort((a, b) => a - b);
      horas.forEach((h, k) => novaConferencia(base + h * 3600000, BL_DIAS.includes(d) && k === 0, r() < 0.15));
    }
    novaConferencia(inicioHoje - 3 * DIA + 20.7 * 3600000, false, true); // fora do expediente (20h40)
    [30, 95, 160].forEach((m, k) => { if (agora - m * MIN > inicioHoje) novaConferencia(agora - m * MIN, false, k === 1); }); // hoje (a demonstração mostra um dia normal, inclusive no fim de semana)
    // fila de notas esperando
    const fila = [[190, "Construtora Alfa"], [75, "Prefeitura de Tatuí"], [40, "Loteamento Vila Nova"], [12, "JB Obras"]];
    fila.forEach(([min, cliente], k) => {
      numero += 2; const itens = sorteiaItens(false).map((i) => ({ id: uid("ni"), ...i, quantidade: i.qtd_nota }));
      notas.push({ id: uid("n"), numero: String(numero), cliente, ...dono(), status: "pendente", chave_nfe: "", token_publico: tokenUuid(), criado_em: new Date(agora - min * MIN).toISOString(), conferencia_id: null, itens });
    });
    // entradas (produção) calculadas para o saldo final ficar no alvo
    for (const p of produtos) {
      const saidas = movimentos.filter((m) => m.produto_id === p.id).reduce((n, m) => n - m.quantidade, 0); const total = Math.max(0, alvo[p.id] + saidas);
      [[0.5, 12], [0.3, 7], [0.2, 3]].forEach(([parte, dias]) => mover(p.id, "entrada", Math.round(total * parte), inicioHoje - dias * DIA + 9 * 3600000, "Produção"));
      const soma = movimentos.filter((m) => m.produto_id === p.id).reduce((n, m) => n + m.quantidade, 0);
      if (soma !== alvo[p.id]) mover(p.id, "entrada", alvo[p.id] - soma, inicioHoje - 3 * DIA + 10 * 3600000, "Produção");
    }
    movimentos.sort((a, b) => D.aMs(a.criado_em) - D.aMs(b.criado_em));
    const itemC = (pid, esperado, contado) => ({ produto_id: pid, esperado, contado, diferenca: contado - esperado });
    const contagens = [
      { id: uid("ct"), criado_em: new Date(inicioHoje - 6 * DIA + 16 * 3600000).toISOString(), criado_por: "u-carlos", status: "aplicada", escopo: "Contagem do dia", itens: ["p2", "p6", "p9", "p10"].map((p) => itemC(p, 0, 0)) },
      { id: uid("ct"), criado_em: new Date(agora - 26 * 3600000).toISOString(), criado_por: "u-marcos", status: "aguardando_aprovacao", escopo: "Contagem do dia", itens: [itemC("p3", 126, 120), itemC("p5", 40, 40)] },
    ];
    // No ambiente de demonstração a empresa "trabalha" todo dia: assim o tutorial e a apresentação
    // mostram um pátio movimentado em qualquer dia da semana, inclusive sábado e domingo.
    const cfg = { ...D.CONFIG_PADRAO, expediente: { ...D.CONFIG_PADRAO.expediente, dias: [0, 1, 2, 3, 4, 5, 6] } };
    const estado = { v: 6, criadoEm: agora, perfilId: "u-admin", perfis, veiculos, produtos, notas, conferencias, movimentos, contagens, alertas: [], config: cfg, vistoResumo: {} };
    // alertas dos últimos dias (as cargas com diferença de hoje e ontem)
    const saldos = D.calcularSaldos(produtos, movimentos, contagens);
    const sd = Object.fromEntries(saldos.map((s) => [s.produto_id, s.saldo]));
    for (const c of conferencias.filter((x) => x.status === "divergencia" && D.aMs(x.criado_em) > agora - 2 * DIA)) {
      const nota = notas.find((n) => n.id === c.nota_id);
      for (const a of D.alertasDaConferencia({ nota, conf: c, itens: c.itens, produtos, saldosDepois: sd, config: cfg, agora: D.aMs(c.criado_em) })) emitir(estado, a, D.aMs(c.criado_em), D.aMs(c.criado_em) < inicioHoje);
    }
    // o vendedor de cada nota é avisado das cargas dele que saíram nos últimos dois dias
    for (const c of conferencias.filter((x) => D.aMs(x.criado_em) > agora - 2 * DIA)) {
      const nota = notas.find((n) => n.id === c.nota_id); const dono = D.donoDaNota(nota, perfis);
      if (dono) emitir(estado, { ...D.alertaMinhaCarga({ nota, conf: c, itens: c.itens }), destinatario_id: dono.id }, D.aMs(c.criado_em), D.aMs(c.criado_em) < inicioHoje);
    }
    varredura(estado, agora);
    return estado;
  }

  // ───────────────────────── alertas ─────────────────────────
  function emitir(e, a, quando, lido = false) {
    const dest = D.destinatarios(a.tipo, a.destinatario_id ? e.perfis.filter((p) => p.id === a.destinatario_id) : e.perfis); const novos = [];
    for (const d of dest) {
      if (a.chave_dedupe && e.alertas.some((x) => x.destinatario_id === d && x.chave_dedupe === a.chave_dedupe)) continue;
      const linha = { id: uid("a"), destinatario_id: d, tipo: a.tipo, severidade: a.severidade || D.TIPOS_ALERTA[a.tipo].severidade, titulo: a.titulo, texto: a.texto, ref_tipo: a.ref_tipo || null, ref_id: a.ref_id || null, chave_dedupe: a.chave_dedupe || null, criado_em: new Date(quando).toISOString(), lido_em: lido ? new Date(quando).toISOString() : null, resolvido_em: null };
      e.alertas.push(linha); novos.push(linha);
    }
    return novos;
  }
  const saldosDe = (e) => D.calcularSaldos(e.produtos, e.movimentos, e.contagens.filter((c) => c.status !== "solicitada" && c.itens.some((i) => i.contado != null)));
  function varredura(e, agora) {
    const saldos = saldosDe(e); const resumoJa = e.alertas.some((a) => a.chave_dedupe === `resumo:${D.chaveDia(agora)}`);
    const lista = D.alertasDaVarredura({ notas: e.notas, saldos, contagens: e.contagens, config: e.config, agora, pushJaEnviadoResumo: resumoJa, perfis: e.perfis });
    for (const a of lista) {
      if (a.tipo === "resumo_dia") { const r = D.resumoDoPeriodo(contextoDe(e, agora), "hoje"); a.texto = `${r.semaforo.titulo}: ${r.semaforo.texto} Conferências: ${r.kpis.total} (${r.kpis.divergentes} com diferença). Fila: ${r.fila.total}.`; }
      emitir(e, a, agora);
    }
  }
  function contextoDe(e, agora = Date.now()) {
    const ini = agora - 31 * DIA; const saldos = saldosDe(e);
    return { agora, config: e.config, notas: e.notas.filter((n) => n.status === "pendente" || n.status === "em_conferencia"), saldos, movimentos: e.movimentos.filter((m) => D.aMs(m.criado_em) >= ini), contagens: e.contagens, conferencias: e.conferencias.filter((c) => D.aMs(c.criado_em) >= ini) };
  }

  // ───────────────────────── a implementação ─────────────────────────
  NE.criarTeste = () => {
    let e = NE.memoria.ler(CHAVE);
    if (!e || e.v !== 6) e = querDemo() ? semear() : semearVazio();
    else { // mantém os dados "de hoje": desloca tudo em dias inteiros
      const dias = Math.floor((Date.now() - e.criadoEm) / DIA);
      if (dias > 0) { const mov = (o) => { if (Array.isArray(o)) o.forEach(mov); else if (o && typeof o === "object") for (const k of Object.keys(o)) { if (CAMPOS_TEMPO.includes(k) && typeof o[k] === "string") o[k] = new Date(D.aMs(o[k]) + dias * DIA).toISOString(); else mov(o[k]); } }; mov(e); e.criadoEm += dias * DIA; }
    }
    const historicoDe = (e) => {
      const por = (id, alt) => { const p = e.perfis.find((x) => x.id === id) || (alt && e.perfis.find((x) => x.funcao === alt)) || null; return { usuario_id: p ? p.id : null, usuario_nome: p ? p.nome : "Sistema", usuario_funcao: p ? p.funcao : null }; };
      const nomeProd = (id, d) => ((e.produtos.find((p) => p.id === id) || {}).nome) || d || "Produto"; const un = (id) => (e.produtos.find((p) => p.id === id) || {}).unidade || "un";
      const L = []; const add = (a) => L.push({ id: `h-${L.length}`, ref_tipo: null, ref_id: null, nota_numero: null, cliente: null, itens: [], detalhes: {}, ...a });
      for (const n of e.notas) {
        const itens = (n.itens || []).map((i) => ({ produto: nomeProd(i.produto_id, i.descricao), quantidade: i.quantidade, unidade: un(i.produto_id) }));
        add({ ...por(n.criado_por, "administrativo"), criado_em: n.criado_em, acao: "nota_lancada", categoria: "nota", resumo: `Lançou a nota ${n.numero}${n.cliente ? " de " + n.cliente : ""} (${D.plural(itens.length, "item", "itens")})`, nota_numero: n.numero, cliente: n.cliente || null, ref_tipo: "nota", ref_id: n.id, itens, detalhes: n.vendedor ? { vendedor: n.vendedor } : {} });
        if (n.status === "cancelada" && n.cancelada_em) add({ ...por(n.cancelada_por), criado_em: n.cancelada_em, acao: "nota_cancelada", categoria: "nota", resumo: `Cancelou a nota ${n.numero}${n.cliente ? " de " + n.cliente : ""}`, nota_numero: n.numero, cliente: n.cliente || null, ref_tipo: "nota", ref_id: n.id, itens, detalhes: n.vendedor ? { vendedor: n.vendedor } : {} });
      }
      for (const c of e.conferencias) {
        const itens = (c.itens || []).map((i) => ({ produto: nomeProd(i.produto_id, i.descricao), nota: i.qtd_nota, carregada: i.qtd_carregada, diferenca: i.qtd_carregada - i.qtd_nota, unidade: un(i.produto_id) })); const dif = itens.filter((i) => i.diferenca !== 0).length;
        const nota = e.notas.find((n) => n.id === c.nota_id);
        add({ ...por(c.conferente_id), criado_em: c.criado_em, acao: dif ? "carga_conferida_diferenca" : "carga_conferida", categoria: "carga", resumo: `Conferiu a carga da nota ${c.numero_nota}${c.cliente ? " de " + c.cliente : ""}, caminhão ${c.placa}${dif ? ` (com diferença em ${D.plural(dif, "item", "itens")})` : " (tudo conforme)"}`, nota_numero: c.numero_nota, cliente: c.cliente || null, ref_tipo: "conferencia", ref_id: c.id, itens,
          detalhes: Object.fromEntries(Object.entries({ placa: c.placa, motorista: c.motorista, situacao: c.status, motivo: c.motivo_divergencia, observacao: c.observacao, metodo: c.metodo, duracao_s: c.duracao_s, fotos: (c.fotos || []).length, vendedor: nota && nota.vendedor }).filter(([, v]) => v !== null && v !== undefined && v !== "")) });
      }
      for (const m of e.movimentos.filter((x) => ["entrada", "perda"].includes(x.tipo) && !x.ref_tipo)) {
        const q = Math.abs(m.quantidade); add({ ...por(m.usuario_id, "expedicao"), criado_em: m.criado_em, acao: m.tipo === "entrada" ? "estoque_entrada" : "estoque_perda", categoria: "estoque", resumo: `${m.tipo === "entrada" ? "Lançou entrada de" : "Lançou perda de"} ${D.fmt(q)} ${un(m.produto_id)} de ${nomeProd(m.produto_id)}${m.motivo ? ` (${m.motivo})` : ""}`, ref_tipo: "produto", ref_id: m.produto_id, itens: [{ produto: nomeProd(m.produto_id), quantidade: q, unidade: un(m.produto_id) }], detalhes: m.motivo ? { motivo: m.motivo } : {} });
      }
      for (const c of e.contagens) {
        if (c.status === "solicitada") { add({ ...por(null, "expedicao"), criado_em: c.criado_em, acao: "contagem_pedida", categoria: "contagem", resumo: `Pediu contagem de ${D.lista((c.itens || []).map((i) => nomeProd(i.produto_id)), 6)}`, ref_tipo: "contagem", ref_id: c.id, itens: (c.itens || []).map((i) => ({ produto: nomeProd(i.produto_id), unidade: un(i.produto_id) })), detalhes: { escopo: c.escopo } }); continue; }
        const itens = (c.itens || []).map((i) => ({ produto: nomeProd(i.produto_id), esperado: i.esperado, contado: i.contado, diferenca: i.diferenca, unidade: un(i.produto_id) })); const dif = itens.filter((i) => i.diferenca).length;
        add({ ...por(c.criado_por), criado_em: c.criado_em, acao: c.status === "descartada" ? "contagem_descartada" : "contagem_feita", categoria: "contagem", resumo: c.status === "descartada" ? "Descartou a contagem" : `Contou o estoque (${D.plural(itens.length, "produto", "produtos")}${dif ? `, diferença em ${dif}` : ", tudo certo"})`, ref_tipo: "contagem", ref_id: c.id, itens, detalhes: { escopo: c.escopo, situacao: c.status } });
      }
      return L.map((a) => ({ ...a, busca: `${a.resumo} ${a.nota_numero || ""} ${a.cliente || ""} ${a.usuario_nome} ${JSON.stringify(a.itens)} ${a.detalhes.placa || ""} ${a.detalhes.motorista || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() })).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em));
    };
    const salvar = () => NE.memoria.gravar(CHAVE, e);
    const eu = () => e.perfis.find((p) => p.id === e.perfilId) || e.perfis[0];
    const fotos = new Map();
    const ocupado = async (f) => { await pausa(); return f(); };
    const saldosAtuais = () => Object.fromEntries(saldosDe(e).map((s) => [s.produto_id, s.saldo]));
    const copia = (o) => JSON.parse(JSON.stringify(o));
    const fotoExemplo = (rotulo, cor = "#d9141e") => {
      const cv = Object.assign(document.createElement("canvas"), { width: 480, height: 360 }); const g = cv.getContext("2d");
      g.fillStyle = "#d9d5d0"; g.fillRect(0, 0, 480, 360); g.fillStyle = "#bdb7b0"; g.fillRect(0, 250, 480, 110); g.fillStyle = cor; g.fillRect(70, 150, 230, 110); g.fillRect(300, 180, 100, 80);
      g.fillStyle = "#9b9590"; for (let i = 0; i < 4; i++) g.fillRect(90 + i * 52, 110, 44, 40);
      g.fillStyle = "#222"; [120, 250, 360].forEach((x) => { g.beginPath(); g.arc(x, 265, 22, 0, 7); g.fill(); });
      g.fillStyle = "#1c1d21cc"; g.fillRect(0, 0, 480, 44); g.fillStyle = "#fff"; g.font = "600 20px Archivo, sans-serif"; g.fillText(`Foto de teste · ${rotulo}`, 14, 29);
      return cv.toDataURL("image/jpeg", 0.7);
    };
    const completaConf = (c) => ({ ...c, conferente: c.conferente || { nome: (e.perfis.find((p) => p.id === c.conferente_id) || {}).nome } });
    const notaItensDeProdutos = (itens) => itens.map((i) => {
      const m = i.produto_id ? { produto: e.produtos.find((p) => p.id === i.produto_id) } : D.casarProduto(i, e.produtos);
      const p = m.produto; return { id: uid("ni"), produto_id: p ? p.id : null, descricao: p ? p.nome : String(i.descricao || "").trim(), codigo: i.codigo || "", quantidade: Number(i.quantidade), qtd_nota: Number(i.quantidade) };
    });
    const novaNota = (n) => {
      const numero = String(n.numero || "").trim(); if (!numero) throw new Error("Digite o número da nota.");
      if (e.notas.some((x) => x.numero === numero && x.status !== "cancelada")) throw new Error(`A nota ${numero} já está no sistema.`);
      const itens = notaItensDeProdutos(n.itens || []); if (!itens.length || itens.some((i) => !(i.quantidade > 0))) throw new Error("A nota precisa de pelo menos um item com quantidade.");
      let vend = null;   // mesmas regras do banco: vendedor só lança em nome dele; a administração indica um vendedor cadastrado
      if (eu().funcao === "vendedor") vend = eu();
      else if (n.vendedor_id) { vend = e.perfis.find((p) => p.id === n.vendedor_id && p.funcao === "vendedor" && p.ativo !== false); if (!vend) throw new Error("Esse vendedor não está cadastrado."); }
      else if (n.vendedor) vend = D.perfilDoVendedor(n.vendedor, e.perfis);
      const nota = { id: uid("n"), numero, cliente: (n.cliente || "").trim(), vendedor: vend ? vend.nome : (n.vendedor || "").trim(), vendedor_id: vend ? vend.id : null, criado_por: eu().id, status: "pendente", chave_nfe: n.chave_nfe || "", token_publico: tokenUuid(), criado_em: new Date().toISOString(), conferencia_id: null, itens };
      e.notas.push(nota);
      emitir(e, { tipo: "nota_nova", severidade: "info", titulo: `Nota ${numero} na fila`, texto: `${nota.cliente ? nota.cliente + ". " : ""}${D.plural(itens.length, "item", "itens")} para conferir.`, ref_tipo: "nota", ref_id: nota.id, chave_dedupe: `nota_nova:${nota.id}` }, Date.now());
      return nota;
    };

    const api = {
      modoTeste: true,
      emCache: () => null,
      // A demonstração também tem sessão: abre na tela de login e só entra quem digita um login de teste (e "Sair" volta ao login).
      async entrar(usuario) { const p = e.perfis.find((x) => x.usuario === String(usuario || "admin").trim().toLowerCase()); if (!p) throw new Error("Usuário ou senha incorretos."); e.perfilId = p.id; e.logado = true; salvar(); },
      async sair() { e.logado = false; salvar(); },
      async perfil() { return e.logado ? copia(eu()) : null; },
      // Só no ambiente de teste: alternar entre administrador e conferente para ver os dois lados
      async trocarPerfil(id) { e.perfilId = id; salvar(); },
      async reiniciar() { NE.memoria.apagar(CHAVE); e = semearVazio(); salvar(); }, // apaga TUDO
      veiculos: async (todos) => copia(e.veiculos.filter((v) => todos || v.ativo)),
      produtos: async (todos) => copia(e.produtos.filter((p) => todos || p.ativo)),
      funcionarios: async () => copia(e.perfis),

      // pessoas
      async criarFuncionario(d) {
        await pausa(); const u = String(d.usuario || "").toLowerCase().trim();
        if (!u || String(d.senha || "").length < 6) throw new Error("Usuário e senha (6+ caracteres) são obrigatórios.");
        if (e.perfis.some((p) => p.usuario === u)) throw new Error(`O usuário "${u}" já existe.`);
        const p = { id: uid("u"), nome: d.nome.trim(), usuario: u, funcao: d.funcao, papel: d.papel || "funcionario", ativo: true, telefone: d.telefone || "", email_contato: d.email_contato || null, admissao: d.admissao || null, cnh_validade: d.cnh_validade || null, observacao: d.observacao || null, foto: d.foto || null, cadastrado_por: eu().id, criado_em: new Date().toISOString() }; e.perfis.push(p); salvar();
        return { id: p.id, usuario: u, senha: d.senha };
      },
      async criarFuncionarios(lista) { const out = []; for (const d of lista) { try { out.push({ ok: true, ...(await api.criarFuncionario(d)), nome: d.nome }); } catch (er) { out.push({ ok: false, nome: d.nome, erro: er.message }); } } return out; },
      async redefinirSenha(id, senha) { const s = senha || `nova${1000 + Math.floor(Math.random() * 9000)}`; const p = e.perfis.find((x) => x.id === id); if (!p) throw new Error("Funcionário não encontrado."); return { usuario: p.usuario, senha: s }; },
      async alterarFuncionario(id, campos) { const { cadastrado_por, criado_em, ...ok } = campos; Object.assign(e.perfis.find((p) => p.id === id), ok); salvar(); }, // quem cadastrou e quando não mudam
      async criarVeiculo(v) { const placa = String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (e.veiculos.some((x) => x.placa === placa)) throw new Error("Essa placa já está cadastrada."); e.veiculos.push({ id: uid("v"), ativo: true, descricao: "", ...v, placa }); salvar(); },
      async alterarVeiculo(id, c) { if (c.placa && e.veiculos.some((x) => x.id !== id && x.placa === c.placa)) throw new Error("Essa placa já está cadastrada."); Object.assign(e.veiculos.find((v) => v.id === id), c); salvar(); },
      async criarProduto(p) { if (e.produtos.some((x) => D.normalizar(x.nome) === D.normalizar(p.nome))) throw new Error("Esse produto já existe."); e.produtos.push({ id: uid("p"), unidade: "un", minimo: 0, por_pilha: null, ativo: true, codigo: "", ...p }); salvar(); },
      async alterarProduto(id, c) { Object.assign(e.produtos.find((p) => p.id === id), c); salvar(); },
      async excluirVeiculo(id) { if (e.conferencias.some((c) => c.veiculo_id === id)) throw Object.assign(new Error("Já tem histórico."), { emUso: true }); e.veiculos = e.veiculos.filter((v) => v.id !== id); salvar(); },
      async excluirProduto(id) { if (e.movimentos.some((m) => m.produto_id === id) || JSON.stringify([e.notas, e.conferencias, e.contagens]).includes(`"produto_id":"${id}"`)) throw Object.assign(new Error("Já tem histórico."), { emUso: true }); e.produtos = e.produtos.filter((p) => p.id !== id); salvar(); },

      // notas
      async notas({ status } = {}) { varredura(e, Date.now()); return copia(e.notas.filter((n) => !status || (Array.isArray(status) ? status.includes(n.status) : n.status === status)).sort((a, b) => D.aMs(a.criado_em) - D.aMs(b.criado_em))); },
      async criarNota(n) { await pausa(); const nota = novaNota(n); salvar(); return copia(nota); },
      async importarNotas(lista) { await pausa(); const out = []; for (const n of lista) { try { out.push({ ok: true, nota: copia(novaNota(n)) }); } catch (er) { out.push({ ok: false, numero: n.numero, erro: er.message }); } } salvar(); return out; },
      async cancelarNota(id) { const n = e.notas.find((x) => x.id === id); if (n && n.status !== "conferida") { n.status = "cancelada"; n.cancelada_em = new Date().toISOString(); n.cancelada_por = eu().id; salvar(); } },

      // fotos
      async enviarFoto(blob) { await pausa(80); const c = `teste/foto/${uid("f")}`; fotos.set(c, URL.createObjectURL(blob)); return c; },
      async urlFoto(c) { if (fotos.has(c)) return fotos.get(c); if (c.startsWith("teste/veiculo/")) return fotoExemplo(`Caminhão · ${c.split("/")[2]}`); const tipo = (c.split("/")[1] || "foto"); const cor = tipo === "placa" ? "#d9141e" : tipo === "nota" ? "#e8e4df" : "#d9141e"; return fotoExemplo(tipo === "nota" ? "Nota fiscal" : tipo === "placa" ? "Placa" : "Carga", cor); },
      fotoExemplo: (rotulo) => new Promise((ok) => { const img = new Image(); img.onload = () => { const cv = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }); cv.getContext("2d").drawImage(img, 0, 0); cv.toBlob(ok, "image/jpeg", 0.8); }; img.src = fotoExemplo(rotulo); }),

      // conferência
      async registrarConferencia(d) {
        await pausa(300);
        d = { ...d, fotos: await Promise.all((d.fotos || []).map(async (f) => ({ tipo: f.tipo, caminho: f.caminho || (await api.enviarFoto(f.blob)) }))) };
        const jaTem = e.conferencias.find((c) => c.client_id && c.client_id === d.client_id); if (jaTem) return jaTem.id;
        if (!d.fotos.some((f) => f.tipo === "carga") || !d.fotos.some((f) => f.tipo === "placa")) throw new Error("As fotos da carga e da placa são obrigatórias.");
        const a = D.analisarItens(d.itens); if (a.divergente && !String(d.motivo_divergencia || "").trim()) throw new Error("Explique o motivo da diferença.");
        const agora = Date.now(); const me = eu(); const id = uid("c");
        let nota = d.nota_id ? e.notas.find((n) => n.id === d.nota_id) : null;
        if (nota && nota.status === "conferida") throw new Error(`A nota ${nota.numero} já foi conferida.`);
        if (!nota) { nota = { id: uid("n"), numero: String(d.numero_nota), cliente: d.cliente || "", vendedor: "", status: "pendente", chave_nfe: d.chave_nfe || "", token_publico: tokenUuid(), criado_em: new Date(agora).toISOString(), conferencia_id: null, itens: [] }; e.notas.push(nota); }
        nota.status = "conferida"; nota.conferencia_id = id;
        const conf = { id, client_id: d.client_id || id, nota_id: nota.id, token_publico: nota.token_publico, numero_nota: nota.numero, cliente: nota.cliente, chave_nfe: d.chave_nfe || nota.chave_nfe || "", placa: String(d.placa).toUpperCase(), veiculo_id: d.veiculo_id || null, motorista: d.motorista || null,
          conferente_id: me.id, conferente: { nome: me.nome }, status: a.divergente ? "divergencia" : "ok", motivo_divergencia: d.motivo_divergencia || null, observacao: d.observacao || null, latitude: d.latitude ?? null, longitude: d.longitude ?? null,
          criado_em: new Date(agora).toISOString(), duracao_s: d.duracao_s ?? null, metodo: d.metodo || "passo_a_passo", itens: d.itens.map((i) => ({ id: uid("i"), ...i, produto_id: i.produto_id || null })), fotos: d.fotos.map((f) => ({ id: uid("f"), ...f })) };
        e.conferencias.push(conf);
        for (const i of conf.itens) if (i.produto_id) e.movimentos.push({ id: uid("m"), produto_id: i.produto_id, tipo: "saida", quantidade: -Number(i.qtd_carregada), criado_em: conf.criado_em, motivo: `Nota ${nota.numero}`, ref_tipo: "conferencia", ref_id: id, usuario_id: me.id });
        for (const al of D.alertasDaConferencia({ nota: { numero: nota.numero }, conf, itens: conf.itens, produtos: e.produtos, saldosDepois: saldosAtuais(), config: e.config, agora })) emitir(e, al, agora);
        const dono = D.donoDaNota(nota, e.perfis); if (dono) emitir(e, { ...D.alertaMinhaCarga({ nota, conf, itens: conf.itens }), destinatario_id: dono.id }, agora);
        salvar(); return id;
      },
      async conferencias({ dia, somenteMinhas, idPerfil, de, ate } = {}) {
        let ini, fim; if (dia) { ini = D.inicioDoDia(new Date(`${dia}T12:00:00-03:00`).getTime()); fim = ini + DIA; } else { ini = de ?? 0; fim = ate ?? Infinity; }
        return copia(e.conferencias.filter((c) => { const t = D.aMs(c.criado_em); return t >= ini && t < fim && (!somenteMinhas || c.conferente_id === idPerfil); }).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)).map(completaConf));
      },
      async pacote() { return NE.pacote ? NE.pacote.id : "premium"; },   // na demonstração: ?pacote=basico, intermediario ou premium
      // Histórico de atividades: na demonstração é montado a partir do que existe (mesmo formato do banco)
      async atividades({ de, ate, categoria, usuario_id, busca, antes, limite = 60 } = {}) {
        if (!["diretoria", "administrativo"].includes(eu().funcao) || (NE.pacote && !NE.pacote.tem("historico"))) throw new Error("O histórico é só da diretoria e do administrativo, no pacote Premium.");
        const lista = historicoDe(e);
        const t = String(busca || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).filter(Boolean);
        const out = lista.filter((a) => { const ms = D.aMs(a.criado_em); return (!de || ms >= de) && (!ate || ms < ate) && (!antes || ms < D.aMs(antes)) && (!categoria || a.categoria === categoria) && (!usuario_id || a.usuario_id === usuario_id) && t.every((p) => a.busca.includes(p)); });
        return copia(out.slice(0, limite).map(({ busca: _b, ...a }) => a));
      },
      async contexto() { varredura(e, Date.now()); return copia(contextoDe(e)); },

      // estoque
      async saldos() { return copia(saldosDe(e)); },
      async movimentos({ produto_id, limite = 60 } = {}) { return copia(e.movimentos.filter((m) => !produto_id || m.produto_id === produto_id).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)).slice(0, limite)); },
      async lancarMovimento({ produto_id, tipo, quantidade, motivo }) {
        await pausa(150); const q = Number(quantidade); if (!(q > 0)) throw new Error("A quantidade precisa ser maior que zero.");
        if (!["entrada", "perda"].includes(tipo)) throw new Error("Tipo de lançamento inválido.");
        e.movimentos.push({ id: uid("m"), produto_id, tipo, quantidade: tipo === "perda" ? -q : q, criado_em: new Date().toISOString(), motivo: motivo || (tipo === "entrada" ? "Produção" : "Perda"), ref_tipo: null, ref_id: null, usuario_id: eu().id });
        varredura(e, Date.now()); salvar();
      },
      async contagens() { return copia([...e.contagens].sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em))); },
      async pedirContagem(ids, escopo = "Pedido da expedição") {
        const c = { id: uid("ct"), criado_em: new Date().toISOString(), criado_por: eu().id, status: "solicitada", escopo, itens: ids.map((p) => ({ produto_id: p, esperado: null, contado: null, diferenca: null })) }; e.contagens.push(c);
        emitir(e, { tipo: "contagem_solicitada", severidade: "info", titulo: "Contagem de estoque pedida", texto: `Contar: ${D.lista(ids.map((p) => (e.produtos.find((x) => x.id === p) || {}).nome), 4)}.`, ref_tipo: "contagem", ref_id: c.id, chave_dedupe: `contagem_pedida:${c.id}` }, Date.now()); salvar(); return c.id;
      },
      async concluirContagem({ itens, solicitacao_id, escopo }) {
        await pausa(250); const sd = saldosAtuais(); const agora = Date.now();
        if (!itens.length) throw new Error("Conte pelo menos um produto.");
        const linhas = itens.map((i) => { const esp = sd[i.produto_id] || 0; return { produto_id: i.produto_id, esperado: esp, contado: Number(i.contado), diferenca: D.arred(Number(i.contado) - esp) }; });
        const dif = linhas.some((l) => l.diferenca !== 0);
        let c = solicitacao_id ? e.contagens.find((x) => x.id === solicitacao_id) : null;
        if (!c) { c = { id: uid("ct"), escopo: escopo || "Contagem rápida" }; e.contagens.push(c); }
        Object.assign(c, { criado_em: new Date(agora).toISOString(), criado_por: eu().id, status: dif ? "aguardando_aprovacao" : "aplicada", itens: linhas });
        if (dif) for (const al of D.alertasDaContagem({ contagem: c, itens: linhas, produtos: e.produtos })) emitir(e, al, agora);
        salvar(); return { id: c.id, status: c.status, itens: copia(linhas) };
      },
      async aplicarAjuste(id) {
        const c = e.contagens.find((x) => x.id === id); if (!c || c.status !== "aguardando_aprovacao") throw new Error("Esta contagem já foi resolvida.");
        for (const i of c.itens) if (i.diferenca) e.movimentos.push({ id: uid("m"), produto_id: i.produto_id, tipo: "ajuste", quantidade: i.diferenca, criado_em: new Date().toISOString(), motivo: "Ajuste da contagem", ref_tipo: "contagem", ref_id: id, usuario_id: eu().id });
        c.status = "aplicada"; e.alertas.filter((a) => a.ref_id === id).forEach((a) => { a.resolvido_em = new Date().toISOString(); }); salvar();
      },
      async descartarContagem(id) { const c = e.contagens.find((x) => x.id === id); if (c) { c.status = "descartada"; e.alertas.filter((a) => a.ref_id === id).forEach((a) => { a.resolvido_em = new Date().toISOString(); }); salvar(); } },

      // alertas e avisos
      async alertas({ soNaoLidos = false, limite = 80 } = {}) {
        varredura(e, Date.now()); salvar();
        return copia(e.alertas.filter((a) => a.destinatario_id === e.perfilId && !a.resolvido_em && (!soNaoLidos || !a.lido_em)).sort((a, b) => D.aMs(b.criado_em) - D.aMs(a.criado_em)).slice(0, limite));
      },
      async marcarLidos(ids) { const t = new Date().toISOString(); e.alertas.forEach((a) => { if (a.destinatario_id === e.perfilId && !a.lido_em && (ids === "todos" || ids.includes(a.id))) a.lido_em = t; }); salvar(); },
      async resolverAlerta(id) { const a = e.alertas.find((x) => x.id === id); if (a) { a.resolvido_em = new Date().toISOString(); a.lido_em = a.lido_em || a.resolvido_em; salvar(); } },
      async preferencias() { const p = eu(); return (p.alertas || D.alertasPadrao(p.papel, p.funcao)).slice(); },
      async salvarPreferencias(lista) { eu().alertas = lista.slice(); salvar(); },
      // "Esqueci minha senha": avisa os administradores (no app de verdade, o banco faz isso e ainda manda push)
      async pedirAjudaSenha({ usuario, nome, mensagem }) {
        const u = String(usuario || "").trim().toLowerCase(); if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error("Digite o seu usuário.");
        const p = e.perfis.find((x) => x.usuario === u); const agora = Date.now(); const janela = Math.floor(agora / 600000);
        emitir(e, { tipo: "senha_esquecida", severidade: "atencao", titulo: "Pedido de ajuda para entrar", texto: `${(p && p.nome) || nome || u} (usuário ${u})${p ? "" : " — usuário NÃO encontrado, confira o nome"} pediu ajuda com a senha.${mensagem ? ` Mensagem: ${String(mensagem).slice(0, 300)}` : ""}`, ref_tipo: "equipe", ref_id: null, chave_dedupe: `senha:${u}:${janela}` }, agora);
        salvar();
      },
      async config() { return copia(D.comPadrao(e.config)); },
      async salvarConfig(c) { e.config = D.comPadrao(c); salvar(); },

      // push: no ambiente de teste os avisos aparecem enquanto o app está aberto
      pushSuportado: () => false, async pushAssinar() { throw new Error("O aviso com o app fechado só funciona no app de verdade (com o banco ligado)."); }, async pushRemover() {}, async pushTestar() {},

      // assistente (no teste responde com cálculo local, sem chave do Claude)
      iaDisponivel: async () => ({ ativo: eu().papel === "admin" && eu().funcao !== "vendedor", modo: "local", leitura: true }),   // o assistente de vendas só existe no app de verdade
      async iaPerguntar(texto) {
        if (eu().papel !== "admin") throw new Error("O assistente é só da administração."); await pausa(400);
        const ctx = contextoDe(e); const { imprimir, ...r } = D.responderLocal(texto, ctx);
        const bloco = imprimir && NE.relatorios ? await NE.relatorios.doAssistente(imprimir, ctx).catch(() => null) : null;   // o mesmo que o servidor real faz: oferece imprimir o que acabou de mostrar
        return bloco ? { ...r, texto: `${r.texto}\n\nQuer imprimir isto?`, impressoes: [bloco], origem: "local" } : { ...r, origem: "local" };
      },
      async iaLerNota() {
        await pausa(900); const ps = e.produtos;
        return { numero: String(48300 + Math.floor(Math.random() * 90)), cliente: "Construtora Exemplo Ltda", itens: [{ descricao: ps[1].nome, quantidade: 60 }, { descricao: ps[0].nome, quantidade: 6 }], origem: "local" };
      },
    };
    return api;
  };
})();
