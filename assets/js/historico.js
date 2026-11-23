// Histórico de atividades: quem fez, quando, qual mercadoria e os dados da nota.
// Só diretoria e administrativo abrem (o banco recusa os outros). Ninguém edita nem apaga: o registro é automático.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const { el, ic } = NE;

  const TIPOS = [["", "Tudo"], ["nota", "Notas"], ["carga", "Cargas"], ["estoque", "Estoque"], ["contagem", "Contagens"], ["produto", "Produtos"], ["caminhao", "Caminhões"], ["pessoa", "Pessoas"], ["ajuste", "Ajustes"]];
  const NOME_TIPO = Object.fromEntries(TIPOS);
  const PERIODOS = [["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["tudo", "Tudo"]];
  const POR_PAGINA = 60;
  const CAMPOS = { nome: "Nome", unidade: "Unidade", codigo: "Código", minimo: "Mínimo", por_pilha: "Peças por pilha", ativo: "Em uso", placa: "Placa", descricao: "Descrição", tipo: "Tipo", marca: "Marca", modelo: "Modelo", ano: "Ano", cor: "Cor", capacidade_t: "Capacidade (t)",
    funcao: "Função", papel: "Acesso", usuario: "Usuário", admissao: "Admissão", cnh_validade: "Validade da CNH", foto: "Foto", contato: "Contato" };

  const diaTexto = (ms) => {
    const hoje = D.inicioDoDia(Date.now()); const ini = D.inicioDoDia(ms);
    if (ini === hoje) return "Hoje"; if (ini === hoje - D.DIA) return "Ontem";
    return new Date(ms).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  };
  const quem = (a) => `${a.usuario_nome}${a.usuario_funcao ? ` · ${NE.rotuloFuncao(a.usuario_funcao)}` : ""}`;
  const un = (i) => (i.unidade && i.unidade !== "un" ? ` ${i.unidade}` : "");
  const sinal = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + NE.num(Math.abs(n));

  // Uma linha por mercadoria, no formato certo para cada tipo de atividade
  function textoItem(i) {
    if (i.carregada !== undefined) return `${i.produto}: nota ${NE.num(i.nota)} → carregou ${NE.num(i.carregada)}${i.diferenca ? ` (${sinal(i.diferenca)})` : ""}`;
    if (i.contado !== undefined && i.contado !== null) return `${i.produto}: sistema ${NE.num(i.esperado)} → contou ${NE.num(i.contado)}${i.diferenca ? ` (${sinal(i.diferenca)})` : ""}`;
    if (i.quantidade !== undefined && i.quantidade !== null) return `${NE.num(i.quantidade)}${un(i)} ${i.produto}`;
    return i.produto;
  }
  const resumoItens = (a) => { const l = (a.itens || []).map(textoItem); if (!l.length) return ""; return l.length > 2 ? `${l.slice(0, 2).join(" · ")} · +${l.length - 2}` : l.join(" · "); };
  const valor = (k, v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Sim" : "Não") : k === "papel" ? (v === "admin" ? "Administração" : "Funcionário") : k === "funcao" ? NE.rotuloFuncao(v) : typeof v === "object" ? JSON.stringify(v) : String(v));
  const classeEtiqueta = (a) => (a.acao === "carga_conferida_diferenca" || /cancel|apagad|desativ/.test(a.acao) ? "erro" : a.categoria === "carga" ? "ok" : a.categoria === "nota" ? "azul" : a.categoria === "contagem" ? "alerta" : "");

  function csvDe(lista) {
    return D.csv(["Data", "Hora", "Quem", "Função", "Tipo", "O que fez", "Nota", "Cliente", "Mercadoria", "Caminhão", "Motorista", "Motivo"],
      lista.map((a) => { const d = new Date(a.criado_em); const dd = a.detalhes || {};
        return [d.toLocaleDateString("pt-BR"), NE.hora(d), a.usuario_nome, a.usuario_funcao ? NE.rotuloFuncao(a.usuario_funcao) : "", NOME_TIPO[a.categoria] || a.categoria, a.resumo, a.nota_numero || "", a.cliente || "", (a.itens || []).map(textoItem).join(" | "), dd.placa || "", dd.motorista || "", dd.motivo || ""]; }));
  }
  const baixar = (nome, texto) => { const a = el("a", { href: URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })), download: nome }); document.body.append(a); a.click(); a.remove(); };

  // Detalhe completo de uma atividade
  function detalhe(a) {
    const d = a.detalhes || {}; const t = D.aMs(a.criado_em);
    const linhas = [["Quem fez", quem(a)], ["Quando", `${new Date(t).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}, às ${NE.hora(t)}`]];
    if (a.nota_numero) linhas.push(["Nota", a.nota_numero]); if (a.cliente) linhas.push(["Cliente", a.cliente]); if (d.vendedor) linhas.push(["Vendedor", d.vendedor]);
    if (d.placa) linhas.push(["Caminhão", d.placa]); if (d.motorista) linhas.push(["Motorista", d.motorista]);
    if (d.situacao && a.categoria === "carga") linhas.push(["Situação", d.situacao === "divergencia" ? "Com diferença" : "Tudo conforme"]);
    if (d.motivo) linhas.push(["Motivo", d.motivo]); if (d.observacao) linhas.push(["Observação", d.observacao]);
    if (d.escopo) linhas.push(["Pedido", d.escopo]);
    if (d.metodo) linhas.push(["Como conferiu", d.metodo === "scanner" ? "Leitura das etiquetas" : "Passo a passo"]);
    if (d.duracao_s) linhas.push(["Tempo", D.duracao(d.duracao_s / 60)]); if (d.fotos) linhas.push(["Fotos", String(d.fotos)]);
    if (d.chave_nfe) linhas.push(["Chave da NF-e", d.chave_nfe]);
    const corpo = el("div", {}, el("p", { style: "font-weight:700;margin:0 0 10px" }, a.resumo), el("div", { class: "resumo" }, linhas.map(([k, v]) => NE.linhaResumo(k, v))));
    if ((a.itens || []).length) corpo.append(el("h3", { style: "margin:14px 0 6px" }, "Mercadoria"), el("ul", { class: "lista-historico" }, a.itens.map((i) => el("li", {}, textoItem(i)))));
    const mudou = Object.entries(d.mudou || {});
    if (mudou.length) corpo.append(el("h3", { style: "margin:14px 0 6px" }, "O que mudou"), el("div", { class: "resumo" }, mudou.map(([k, v]) => NE.linhaResumo(CAMPOS[k] || k, v && typeof v === "object" && "antes" in v ? `${valor(k, v.antes)} → ${valor(k, v.depois)}` : valor(k, v)))));
    NE.janelaSimples({ etiqueta: NOME_TIPO[a.categoria] || "Atividade", titulo: "Detalhe da atividade", corpo });
  }

  NE.rotas.historico = (raiz, params, app) => {
    const f = { periodo: "7", tipo: "", pessoa: "", busca: "" };
    let lista = []; let fim = false; let seq = 0;
    const chipsPeriodo = el("div", { class: "chips rolagem" }); const chipsTipo = el("div", { class: "chips rolagem" });
    const pessoa = el("select", { class: "entrada", id: "hist-pessoa", "aria-label": "Quem fez" }, el("option", { value: "" }, "Todas as pessoas"));
    const busca = el("input", { class: "entrada", id: "hist-busca", type: "search", placeholder: "Buscar por nota, cliente, mercadoria, placa…", autocomplete: "off", "aria-label": "Buscar no histórico" });
    const resumo = el("div", { class: "filtro-ativo meta", id: "hist-resumo" }); const caixa = el("div", { id: "hist-lista" }); const mais = el("button", { type: "button", class: "btn btn-secundario btn-bloco", id: "hist-mais", hidden: true }, "Carregar mais");
    const planilha = el("button", { type: "button", class: "link-acao", id: "hist-planilha" }, ic("baixar"), "Baixar planilha");

    const intervalo = () => { const hoje = D.inicioDoDia(Date.now()); return f.periodo === "hoje" ? { de: hoje } : f.periodo === "7" ? { de: hoje - 6 * D.DIA } : f.periodo === "30" ? { de: hoje - 29 * D.DIA } : {}; };
    const consulta = (extra = {}) => ({ ...intervalo(), categoria: f.tipo || undefined, usuario_id: f.pessoa || undefined, busca: f.busca || undefined, ...extra });

    const chips = (alvo, itens, chave) => alvo.replaceChildren(...itens.map(([id, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(f[chave] === id), onclick: () => { f[chave] = id; desenharChips(); carregar(); } }, nome)));
    const desenharChips = () => { chips(chipsPeriodo, PERIODOS, "periodo"); chips(chipsTipo, TIPOS, "tipo"); };

    function linha(a) {
      const itens = resumoItens(a);
      const b = el("button", { type: "button", class: `linha-cartao hist ${classeEtiqueta(a) === "erro" ? "critico" : ""}` },
        el("strong", {}, a.resumo),
        el("span", { class: "meta" }, `${NE.hora(a.criado_em)} · ${quem(a)}`),
        itens ? el("span", { class: "meta hist-itens" }, itens) : null,
        el("span", { class: "lado" }, el("span", { class: `etiqueta ${classeEtiqueta(a)}` }, NOME_TIPO[a.categoria] || a.categoria)));
      b.addEventListener("click", () => detalhe(a));
      return b;
    }
    function desenhar() {
      const filhos = []; let dia = null;
      for (const a of lista) { const ms = D.inicioDoDia(D.aMs(a.criado_em)); if (ms !== dia) { dia = ms; filhos.push(el("h2", { class: "hist-dia" }, diaTexto(ms))); } filhos.push(linha(a)); }
      caixa.replaceChildren(...(filhos.length ? filhos : [el("div", { class: "vazio-grande" }, el("strong", {}, "Nada por aqui"), f.busca || f.tipo || f.pessoa || f.periodo !== "tudo" ? "Nenhuma atividade com esses filtros. Tente outro período ou limpe a busca." : "Quando alguém lançar uma nota, conferir uma carga ou mexer no estoque, aparece aqui.")]));
      resumo.textContent = lista.length ? `${D.plural(lista.length, "atividade", "atividades")}${fim ? "" : " (as mais recentes)"}` : "";
      mais.hidden = fim || !lista.length;
    }
    async function carregar() {
      const meu = ++seq; caixa.replaceChildren(el("div", { class: "esqueleto" }, ""), el("div", { class: "esqueleto" }, "")); mais.hidden = true;
      try { const r = await NE.dados.atividades(consulta({ limite: POR_PAGINA })); if (meu !== seq) return; lista = r; fim = r.length < POR_PAGINA; desenhar(); }
      catch (e) { if (meu !== seq) return; caixa.replaceChildren(); NE.aviso(NE.mensagemErro(e), "erro", caixa); }
    }
    mais.addEventListener("click", () => NE.comCarregando(mais, async () => {
      const meu = seq; const r = await NE.dados.atividades(consulta({ limite: POR_PAGINA, antes: lista[lista.length - 1].criado_em })); if (meu !== seq) return;
      const vistos = new Set(lista.map((x) => x.id)); const novos = r.filter((x) => !vistos.has(x.id)); lista = lista.concat(novos); fim = r.length < POR_PAGINA || !novos.length; desenhar();
    }));
    planilha.addEventListener("click", () => NE.comCarregando(planilha, async () => { const tudo = await NE.dados.atividades(consulta({ limite: 2000 })); baixar(`historico-${NE.hojeISO()}.csv`, csvDe(tudo)); NE.aviso(`Planilha com ${D.plural(tudo.length, "atividade", "atividades")} baixada.`, "ok"); }));
    let espera; busca.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(() => { f.busca = busca.value.trim(); carregar(); }, 350); });
    pessoa.addEventListener("change", () => { f.pessoa = pessoa.value; carregar(); });

    raiz.replaceChildren(
      el("div", { class: "cabeca-pagina" }, el("div", {}, el("h1", {}, "Histórico"), el("p", {}, "Quem fez o quê, a que horas, com qual mercadoria. Só a administração vê."))),
      el("div", { class: "hist-filtros" }, chipsPeriodo, chipsTipo, el("div", { class: "hist-campos" }, pessoa, busca), el("div", { class: "acoes-linha" }, resumo, planilha)),
      caixa, mais);
    desenharChips(); carregar();
    NE.dados.funcionarios().then((ps) => pessoa.append(...ps.map((p) => el("option", { value: p.id }, p.nome)))).catch(() => {});
  };
  NE.historicoUtil = { textoItem, csvDe };
})();
