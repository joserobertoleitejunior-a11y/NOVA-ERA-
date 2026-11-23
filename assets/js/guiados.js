// OPERAÇÕES GUIADAS: toda tarefa da administração é um passo a passo.
// Regras de didática: uma decisão por tela · pergunta em português simples · exemplo na própria tela ·
// botão grande · o app diz exatamente o que falta · no fim, diz o que aconteceu e qual o próximo passo.
(() => {
  const NE = window.NE;
  const D = window.NEDominio;
  const C = window.NOVA_ERA || {};
  const { el, ic } = NE;
  const G = (NE.guiados = {});
  // Quem vende e quanto tem para vender. O vendedor logado lança sempre em nome dele; a administração escolhe entre os vendedores cadastrados.
  const contextoVenda = async (app) => {
    const ehVendedor = app.perfil.funcao === "vendedor";
    const comEstoque = NE.pacote.tem("estoque");   // sem estoque no pacote não há "disponível" nem aviso de falta
    const [pessoas, saldos, fila] = await Promise.all([ehVendedor ? Promise.resolve([]) : NE.dados.funcionarios().catch(() => []), comEstoque ? NE.dados.saldos().catch(() => []) : Promise.resolve([]), comEstoque ? NE.dados.notas({ status: ["pendente", "em_conferencia"] }).catch(() => []) : Promise.resolve([])]);
    return { ehVendedor, vendedores: pessoas.filter((p) => p.funcao === "vendedor" && p.ativo !== false), disp: D.disponivelPorProduto(saldos, fila) };
  };
  const campoVendedor = (cv, app, n, r) => (cv.ehVendedor ? el("div", { class: "campo" }, el("label", {}, "Vendedor"), el("p", { class: "suave", id: "nn-vendedor-fixo" }, `${app.perfil.nome} (você)`))
    : cv.vendedores.length ? el("div", { class: "campo" }, el("label", {}, "Vendedor (opcional)"), el("div", { class: "chips" }, cv.vendedores.map((v) => el("button", { type: "button", class: "chip", "aria-pressed": String(n.vendedor_id === v.id), onclick: () => { const igual = n.vendedor_id === v.id; n.vendedor_id = igual ? null : v.id; n.vendedor = igual ? "" : v.nome; r(); } }, v.nome)))) : null);
  const avisoFalta = (faltas) => (faltas.length ? el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, `Estoque insuficiente para ${D.lista(faltas.map((f) => `${f.nome} (pedido ${NE.num(f.pedido)}, disponível ${NE.num(f.disponivel)})`), 3)}. A nota entra na fila mesmo assim: confira se a produção cobre.`)) : null);
  const titulo = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const ligar = (itens, produtos) => itens.map((i) => { const m = D.casarProduto(i, produtos); return { ...i, produto_id: m.produto ? m.produto.id : null, descricao: m.produto ? m.produto.nome : i.descricao }; });
  const dica = (t) => el("p", { class: "guia-dica" }, t);

  NE.rotas.guia = (raiz, params, app) => { const f = G[params.fluxo]; if (!f) return app.ir("inicio", {}, { substituir: true }); f(raiz, app, params); };

  // ───────────────────────── 1. Lançar uma nota ─────────────────────────
  G.nota = async (raiz, app) => {
    const produtos = await NE.dados.produtos();
    const iaOn = NE.iaLeitura ? await NE.iaLeitura().catch(() => false) : false;   // só promete ler a nota por IA se ela estiver ligada de verdade
    const cv = await contextoVenda(app);
    const n = { como: "", numero: "", cliente: "", vendedor: cv.ehVendedor ? app.perfil.nome : "", vendedor_id: cv.ehVendedor ? app.perfil.id : null, itens: [], fotos: [] };
    NE.assistente({
      raiz, rotuloFinal: "Colocar na fila", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "Como a nota chegou?", icone: "nota", ajuda: "Escolha o jeito mais fácil para você.",
          tela: (r) => NE.escolhaUnica([
            { valor: "xml", rotulo: "Tenho o arquivo XML", dica: "O mais rápido: lê várias notas de uma vez" },
            { valor: "foto", rotulo: "Tenho a foto da nota", dica: iaOn ? "O assistente lê o número e os itens (Premium)" : "Eu tiro a foto e digito os dados" },
            { valor: "digitar", rotulo: "Vou digitar", dica: "Número, cliente e itens" }].filter((o) => o.valor !== "xml" || NE.pacote.tem("xml")), n.como, (v) => { if (v === "xml") return app.ir("guia", { fluxo: "xml" }, { substituir: true }); n.como = v; r(); }),
          validar: () => (!n.como ? "Toque em uma das opções." : null) },
        { titulo: "Número e cliente", icone: "conferir", ajuda: "O número fica no alto da nota, ao lado de \"Nº\".",
          tela: (r) => el("div", {},
            n.como === "foto" && el("div", {}, NE.seletorFoto({ titulo: "Foto da nota", dica: "Pegue a nota inteira, sem sombra.", lista: n.fotos, varias: false, aoMudar: r }),
              iaOn && n.fotos.length > 0 && el("button", { type: "button", class: "btn btn-azul btn-bloco", id: "btn-ler-foto", style: "margin-bottom:14px", onclick: (ev) => NE.comCarregando(ev.currentTarget, async () => {
                const res = await NE.dados.iaLerNota(n.fotos[0].blob); n.numero = res.numero || n.numero; n.cliente = res.cliente || n.cliente;
                n.itens = ligar((res.itens || []).map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, codigo: i.codigo })), produtos).map((i) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade }));
                NE.aviso("Pronto! Confira os dados nos próximos passos.", "ok"); r();
              }) }, ic("faisca"), "Ler a nota para mim · Premium")),
            NE.campoTexto("Número da nota", { id: "nn-numero", inputmode: "numeric", value: n.numero, placeholder: "Ex.: 48213" }, (v) => { n.numero = v.trim(); }),
            NE.campoTexto("Nome do cliente (opcional)", { id: "nn-cliente", value: n.cliente, placeholder: "Ex.: Construtora Alfa" }, (v) => { n.cliente = v; }),
            campoVendedor(cv, app, n, r)),
          validar: () => (!n.numero ? "Digite o número da nota." : null) },
        { titulo: "O que tem na nota?", icone: "caixas", ajuda: "Toque no produto para adicionar e ajuste a quantidade.",
          tela: (r) => {
            const tem = new Set(n.itens.map((i) => i.produto_id).filter(Boolean));
            const dispLinha = (p) => { const d = cv.disp.get(p.id); return d ? el("small", { class: d.disponivel > 0 ? "lp-disp" : "lp-sem" }, d.disponivel > 0 ? `Disponível ${NE.num(d.disponivel)}` : "Sem estoque disponível") : null; };
            const itemNota = (i, k) => { const aviso = el("p", { class: "aviso-estoque", hidden: true }); const atualizar = () => { const d = i.produto_id && cv.disp.get(i.produto_id); const falta = d && Number(i.quantidade) > d.disponivel; aviso.hidden = !falta; if (falta) aviso.textContent = `Só tem ${NE.num(Math.max(0, d.disponivel))} disponíveis (pátio ${NE.num(d.saldo)}${d.reservado ? `, ${NE.num(d.reservado)} já vendidos esperando carregar` : ""}). Lance mesmo assim só se a produção cobre.`; }; atualizar();
              return el("div", { class: "item" }, el("div", { class: "item-topo" }, el("strong", {}, i.descricao), el("button", { type: "button", class: "link-acao", onclick: () => { n.itens.splice(k, 1); r(); } }, ic("fechar"), "Tirar")), NE.contador(i.quantidade, (v) => { i.quantidade = v; atualizar(); }, `nn-q-${k}`), aviso); };
            const busca = el("input", { class: "entrada", id: "nn-busca", type: "search", placeholder: "Buscar produto…", autocomplete: "off", "aria-label": "Buscar produto" });
            const linhas = produtos.filter((p) => !tem.has(p.id)).map((p) => { const b = el("button", { type: "button", class: "lp-linha", "data-nome": NE.semAcento ? NE.semAcento(p.nome).toLowerCase() : p.nome.toLowerCase(), onclick: () => { n.itens.push({ produto_id: p.id, descricao: p.nome, quantidade: p.por_pilha || 1 }); r(); } }, el("span", { class: "lp-nome" }, el("strong", {}, p.nome), dispLinha(p)), el("span", { class: "lp-mais" }, ic("mais"), "Incluir")); return b; });
            const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const vazia = dica("Nenhum produto com esse nome. Use o campo \"Outro produto\" abaixo.");
            vazia.hidden = true;
            busca.addEventListener("input", () => { const q = norm(busca.value.trim()); let achou = 0; linhas.forEach((l) => { const ok = !q || norm(l.textContent).includes(q); l.hidden = !ok; if (ok) achou++; }); vazia.hidden = achou > 0 || !linhas.length; });
            return el("div", {},
              n.itens.length ? [el("h2", { class: "secao-titulo" }, `Na nota (${n.itens.length})`), ...n.itens.map(itemNota)] : [dica("Nenhum produto ainda. Busque ou toque em um produto abaixo.")],
              produtos.length ? [el("h2", { class: "secao-titulo" }, "Adicionar produto"), linhas.length > 6 ? busca : null, el("div", { class: "lista-produtos" }, linhas), vazia] : null,
              (() => { const nome = el("input", { class: "entrada", id: "nn-outro", placeholder: produtos.length ? "Outro produto (escreva o nome)" : "Nome do produto" }); const add = el("button", { type: "button", class: "btn btn-azul", id: "nn-outro-add", "aria-label": "Adicionar produto" }, ic("mais")); add.addEventListener("click", () => { const t = nome.value.trim(); if (!t) return nome.focus(); n.itens.push({ produto_id: null, descricao: t, quantidade: 1 }); r(); }); return el("div", { class: "campo", style: "margin-top:12px" }, el("div", { style: "display:flex;gap:8px" }, nome, add)); })());
          },
          validar: () => (!n.itens.length ? "Adicione pelo menos um produto." : n.itens.some((i) => !(i.quantidade > 0)) ? "Toda quantidade precisa ser maior que zero." : null) },
        { titulo: "Conferiu? Então envie", icone: "check", ajuda: "Ao confirmar, a nota entra na fila e os conferentes são avisados.",
          tela: () => el("div", {}, avisoFalta(D.faltaEstoque(n.itens, cv.disp)), el("div", { class: "resumo" }, NE.linhaResumo("Nota", n.numero), NE.linhaResumo("Cliente", n.cliente || "—"), NE.linhaResumo("Vendedor", n.vendedor || "—"), n.itens.map((i) => NE.linhaResumo(i.descricao, NE.num(i.quantidade))))) },
      ],
      async aoConcluir() {
        await NE.dados.criarNota({ numero: n.numero, cliente: n.cliente, vendedor: n.vendedor, vendedor_id: n.vendedor_id || null, itens: n.itens.map((i) => ({ produto_id: i.produto_id || null, descricao: i.descricao, quantidade: i.quantidade })) });
        NE.telaFim(raiz, { titulo: "Nota na fila", texto: `A nota ${n.numero} já aparece para os conferentes. Quando o caminhão for carregado, eles conferem e você é avisado se algo não bater.`,
          botoes: [{ rotulo: "Lançar outra nota", icone: "mais", acao: () => G.nota(raiz, app) }, { rotulo: "Ver a fila", acao: () => app.ir("notas", {}, { substituir: true }) }] });
      },
    });
  };

  // ───────────────────────── 2. Importar XML ─────────────────────────
  G.xml = async (raiz, app) => {
    const cv = await contextoVenda(app); const vend = { vendedor: cv.ehVendedor ? app.perfil.nome : "", vendedor_id: cv.ehVendedor ? app.perfil.id : null };
    let achadas = [], criar = true; const entrada = el("input", { type: "file", accept: ".xml,text/xml,application/xml", multiple: true, "aria-label": "Arquivos XML" });
    NE.assistente({
      raiz, rotuloFinal: "Colocar na fila", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "Escolha os arquivos XML", icone: "baixar", ajuda: "São os arquivos da nota que o escritório já tem. Pode escolher vários de uma vez.",
          tela: (r) => {
            entrada.onchange = async () => { const prod = await NE.dados.produtos(true); const res = []; for (const arq of [...entrada.files]) { try { const x = await NE.nfeXml.lerArquivo(arq); res.push({ ok: true, arq: arq.name, ...x, itens: ligar(x.itens, prod) }); } catch (e) { res.push({ ok: false, arq: arq.name, erro: e.message }); } } achadas = res; r(); };
            return el("div", {}, el("label", { class: "btn btn-azul btn-bloco btn-gigante botao-camera", id: "btn-escolher-xml" }, ic("baixar"), achadas.length ? "Escolher outros arquivos" : "Escolher arquivos XML", entrada),
              achadas.length ? el("div", { style: "margin-top:14px" }, achadas.map((x) => el("div", { class: `aviso ${x.ok ? "ok" : "erro"}` }, ic(x.ok ? "check" : "alerta"), el("span", {}, x.ok ? `Nota ${x.numero} lida (${D.plural(x.itens.length, "item", "itens")})` : `${x.arq}: ${x.erro}`)))) : dica("Nenhum arquivo escolhido ainda."));
          },
          validar: () => (!achadas.some((x) => x.ok) ? "Escolha pelo menos um arquivo XML de nota fiscal." : null) },
        { titulo: "Confira o que foi lido", icone: "conferir", ajuda: "O sistema ligou cada item ao seu produto cadastrado.",
          tela: (r) => { const boas = achadas.filter((x) => x.ok); const sem = new Set(boas.flatMap((x) => x.itens.filter((i) => !i.produto_id).map((i) => i.descricao)));
            return el("div", {}, boas.map((x) => el("div", { class: "linha-cartao ok", role: "group" }, el("strong", {}, `Nota ${x.numero}${x.cliente ? " · " + x.cliente : ""}`), el("span", { class: "meta" }, x.itens.map((i) => `${i.descricao} ×${NE.num(i.quantidade)}${i.produto_id ? "" : " ⚠"}`).join(" · ")))),
              sem.size ? el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, `${D.plural(sem.size, "produto ainda não está", "produtos ainda não estão")} cadastrado: ${D.lista([...sem], 3)}.`), NE.chave(criar, "Cadastrar sozinho", (v) => { criar = v; })) : null,
              avisoFalta(D.faltaEstoque(boas.flatMap((x) => x.itens), cv.disp))); } },
        { titulo: "Pronto para enviar", icone: "check", ajuda: "As notas entram na fila de conferência.", tela: (r) => el("div", {}, el("div", { class: "resumo" }, NE.linhaResumo("Notas", String(achadas.filter((x) => x.ok).length)), cv.ehVendedor ? NE.linhaResumo("Vendedor", `${app.perfil.nome} (você)`) : null), campoVendedor(cv, app, vend, r)) },
      ],
      async aoConcluir() {
        const boas = achadas.filter((x) => x.ok); let produtos = await NE.dados.produtos(true);
        const sem = new Set(boas.flatMap((x) => x.itens.filter((i) => !i.produto_id).map((i) => i.descricao)));
        if (criar && sem.size) { for (const nome of sem) { try { await NE.dados.criarProduto({ nome: titulo(nome), unidade: "un", minimo: 0 }); } catch { /* já existe */ } } produtos = await NE.dados.produtos(true); }
        const r = await NE.dados.importarNotas(boas.map((x) => ({ numero: x.numero, cliente: x.cliente, vendedor: vend.vendedor, vendedor_id: vend.vendedor_id || null, chave_nfe: x.chave_nfe, itens: ligar(x.itens, produtos).map((i) => ({ produto_id: i.produto_id, descricao: i.descricao, codigo: i.codigo, quantidade: i.quantidade })) })));
        const ok = r.filter((x) => x.ok).length, falhas = r.filter((x) => !x.ok);
        NE.telaFim(raiz, { tipo: falhas.length ? "alerta" : "ok", titulo: `${D.plural(ok, "nota entrou", "notas entraram")} na fila`, texto: falhas.length ? `${falhas.length} não entrou: ${falhas[0].erro}` : "Os conferentes já podem conferir.",
          botoes: [{ rotulo: "Ver a fila", acao: () => app.ir("notas", {}, { substituir: true }) }, { rotulo: "Importar mais", icone: "mais", acao: () => G.xml(raiz, app) }] });
      },
    });
  };

  // ───────────────────────── 3. Lançar entrada ou perda de estoque ─────────────────────────
  G.mov = async (raiz, app, params) => {
    const produtos = (await NE.dados.produtos()).filter((p) => p.ativo); const m = { produto_id: params.produto_id || "", tipo: "", quantidade: 1, motivo: "" };
    const nome = () => (produtos.find((p) => p.id === m.produto_id) || {}).nome || "";
    NE.assistente({
      raiz, rotuloFinal: "Registrar", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "De qual produto?", icone: "caixas", ajuda: "Toque no produto.", tela: (r) => el("div", { class: "grade-escolha" }, produtos.map((p) => el("button", { type: "button", class: "escolha", "aria-pressed": String(m.produto_id === p.id), onclick: () => { m.produto_id = p.id; r(); } }, el("strong", {}, p.nome)))), validar: () => (!m.produto_id ? "Toque no produto." : null) },
        { titulo: "O que aconteceu?", icone: "conferir", ajuda: "Isso corrige o saldo do estoque.", tela: (r) => NE.escolhaUnica([{ valor: "entrada", rotulo: "Entrou peça nova", dica: "Ex.: a fábrica produziu hoje" }, { valor: "perda", rotulo: "Perdeu peça", dica: "Ex.: quebrou ou foi descartada" }], m.tipo, (v) => { m.tipo = v; r(); }), validar: () => (!m.tipo ? "Escolha o que aconteceu." : null) },
        { titulo: "Quantas peças?", icone: "mais", ajuda: "Use os botões + e − ou digite o número.", tela: () => el("div", {}, NE.contador(m.quantidade, (v) => { m.quantidade = v; }, "lc-q"), NE.campoTexto("Observação (opcional)", { id: "lc-motivo", value: m.motivo, placeholder: m.tipo === "entrada" ? "Ex.: produção do turno" : "Ex.: peça trincada" }, (v) => { m.motivo = v; })), validar: () => (!(m.quantidade > 0) ? "A quantidade precisa ser maior que zero." : null) },
        { titulo: "Confirme", icone: "check", ajuda: "O saldo do estoque será corrigido agora.", tela: () => el("div", { class: "resumo" }, NE.linhaResumo("Produto", nome()), NE.linhaResumo("O que aconteceu", m.tipo === "entrada" ? "Entrou" : "Perdeu"), NE.linhaResumo("Quantidade", String(m.quantidade))) },
      ],
      async aoConcluir() { await NE.dados.lancarMovimento({ produto_id: m.produto_id, tipo: m.tipo, quantidade: m.quantidade, motivo: m.motivo }); NE.telaFim(raiz, { titulo: "Estoque atualizado", texto: `${nome()}: ${m.tipo === "entrada" ? "+" : "−"}${m.quantidade}.`, botoes: [{ rotulo: "Ver o estoque", acao: () => app.ir("estoque", {}, { substituir: true }) }, { rotulo: "Lançar outro", icone: "mais", acao: () => G.mov(raiz, app, {}) }] }); },
    });
  };

  // ───────────────────────── 4. Pedir contagem à equipe ─────────────────────────
  G.contagem = async (raiz, app) => {
    const produtos = (await NE.dados.produtos()).filter((p) => p.ativo); const sel = new Set();
    NE.assistente({
      raiz, rotuloFinal: "Avisar a equipe", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "O que a equipe deve contar?", icone: "raio", ajuda: "Toque em todos os produtos que quiser. Eles recebem um aviso no celular.", tela: (r) => el("div", { class: "grade-escolha" }, produtos.map((p) => el("button", { type: "button", class: "escolha", "aria-pressed": String(sel.has(p.id)), onclick: () => { sel.has(p.id) ? sel.delete(p.id) : sel.add(p.id); r(); } }, el("strong", {}, p.nome)))), validar: () => (!sel.size ? "Toque em pelo menos um produto." : null) },
        { titulo: "Confirme", icone: "check", ajuda: "A equipe conta sem ver o saldo do sistema e você decide o ajuste depois.", tela: () => el("div", { class: "resumo" }, NE.linhaResumo("Contar", D.lista(produtos.filter((p) => sel.has(p.id)).map((p) => p.nome), 6))) },
      ],
      async aoConcluir() { await NE.dados.pedirContagem([...sel]); NE.telaFim(raiz, { titulo: "Equipe avisada", texto: "Quando a contagem chegar, você recebe um aviso para decidir o ajuste.", botoes: [{ rotulo: "Voltar ao estoque", acao: () => app.ir("estoque", {}, { substituir: true }) }] }); },
    });
  };

  // ───────────────────────── 5. Decidir uma contagem com diferença ─────────────────────────
  G.resolver = async (raiz, app, params) => {
    const [cs, produtos] = await Promise.all([NE.dados.contagens(), NE.dados.produtos(true)]);
    const c = cs.find((x) => x.id === params.id); const nome = (id) => (produtos.find((p) => p.id === id) || {}).nome || "Produto";
    if (!c || c.status !== "aguardando_aprovacao") return NE.telaFim(raiz, { titulo: "Esta contagem já foi resolvida", botoes: [{ rotulo: "Voltar ao estoque", acao: () => app.ir("estoque", {}, { substituir: true }) }] });
    const dif = c.itens.filter((i) => Number(i.diferenca) !== 0);
    const decide = (rotulo, icone, classe, texto, fn) => el("button", { type: "button", class: `btn btn-bloco ${classe}`, onclick: (ev) => NE.comCarregando(ev.currentTarget, fn) }, ic(icone), rotulo);
    raiz.replaceChildren(el("section", { class: "tela" },
      el("div", { class: "tela-titulo" }, el("div", { class: "icone-grande", html: NE.icone.alerta }), el("div", {}, el("h1", {}, "A contagem não bateu"), el("p", {}, "O sistema achava que tinha um número e a equipe contou outro. Veja e decida."))),
      el("div", { class: "resumo" }, dif.map((i) => el("div", { class: "resumo-linha" }, el("span", {}, nome(i.produto_id)), el("strong", {}, `Sistema ${D.fmt(i.esperado)} → Contado ${D.fmt(i.contado)}`)))),
      dica("Se a contagem estiver certa, corrija o estoque (ele passa a valer o número contado). Se você duvida, peça para contar de novo."),
      el("div", { style: "display:grid;gap:10px;margin-top:16px" },
        decide("Corrigir o estoque", "check", "btn-principal btn-gigante", "", async () => { await NE.dados.aplicarAjuste(c.id); NE.app.atualizarSino(); NE.telaFim(raiz, { titulo: "Estoque corrigido", texto: "O saldo agora é o que a equipe contou.", botoes: [{ rotulo: "Ver o estoque", acao: () => app.ir("estoque", {}, { substituir: true }) }] }); }),
        decide("Pedir para contar de novo", "raio", "btn-azul", "", async () => { await NE.dados.descartarContagem(c.id); await NE.dados.pedirContagem(dif.map((i) => i.produto_id)); NE.app.atualizarSino(); NE.telaFim(raiz, { titulo: "Nova contagem pedida", texto: "A equipe foi avisada.", botoes: [{ rotulo: "Voltar ao estoque", acao: () => app.ir("estoque", {}, { substituir: true }) }] }); }),
        el("button", { type: "button", class: "btn btn-secundario btn-bloco", onclick: () => app.voltar() }, "Decidir depois"))));
  };

  // ───────────────────────── 6. Cadastrar uma pessoa (uma pergunta por tela) ─────────────────────────
  G.novaPessoa = async (raiz, app, params = {}) => {
    const U = NE.equipeUtil; const existentes = new Set((await NE.dados.funcionarios()).map((p) => p.usuario));
    const d = { nome: "", funcao: params.funcao || "", telefone: "", fotos: [], senha: U.senhaNova() };
    const usuario = () => { let u = U.usuarioDe(d.nome) || "usuario"; let k = 2; const base = u; while (existentes.has(u)) u = `${base}${k++}`; return u; };
    const DESCR = { conferente: "Confere a carga antes de sair", motorista: "Dirige o caminhão", ajudante: "Ajuda a carregar", expedicao: "Organiza as saídas · vê tudo", vendedor: "Comercial · vê notas e cargas", administrativo: "Escritório · vê tudo", diretoria: "Gestão · vê tudo" };
    NE.assistente({
      raiz, rotuloFinal: "Cadastrar", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "Qual é o nome?", icone: "usuario", ajuda: "Como a pessoa é chamada no dia a dia.", tela: () => NE.campoTexto("Nome", { id: "cad-nome", value: d.nome, placeholder: "Ex.: Carlos Souza", autocapitalize: "words" }, (v) => { d.nome = v; }), validar: () => (d.nome.trim().length < 2 ? "Digite o nome da pessoa." : null) },
        { get titulo() { return `O que ${d.nome.trim().split(" ")[0] || "a pessoa"} faz?`; }, icone: "caixas", ajuda: "Toque na função. Ela define o que a pessoa vê no app.", tela: (r) => NE.escolhaUnica(U.FUNCOES.map(([v, nome]) => ({ valor: v, rotulo: nome, dica: DESCR[v] })), d.funcao, (v) => { d.funcao = v; r(); }), validar: () => (!d.funcao ? "Toque na função da pessoa." : null) },
        { titulo: "Qual é o WhatsApp?", icone: "whatsapp", ajuda: "Opcional. Aparece como botão verde na lista da equipe.",
          tela: () => { const teste = el("a", { class: "btn btn-verde btn-bloco", id: "cad-zap", target: "_blank", rel: "noopener", style: "margin-top:6px" }, ic("whatsapp"), "Testar no WhatsApp"); const atualizar = () => { const l = NE.linkWhatsApp(d.telefone); teste.hidden = !l; if (l) teste.href = l; }; atualizar();
            return el("div", {}, NE.campoTexto("Celular com DDD", { id: "cad-tel", value: d.telefone, inputmode: "tel", placeholder: "(15) 99999-9999" }, (v, i) => { d.telefone = NE.mascaraTelefone(v); if (i.value !== d.telefone) i.value = d.telefone; atualizar(); }), teste, dica("Não sabe agora? Deixe em branco e toque em Continuar.")); },
          validar: () => (d.telefone && NE.soDigitos(d.telefone).length < 10 ? "O celular precisa ter DDD e número (10 ou 11 dígitos), ou deixe em branco." : null) },
        { titulo: "Quer colocar uma foto?", icone: "camera", ajuda: "Opcional. Aparece ao lado do nome na equipe.", tela: (r) => el("div", {}, NE.seletorFoto({ titulo: "Foto de perfil", dica: "Rosto de frente, com boa luz.", lista: d.fotos, varias: false, frontal: true, aoMudar: r }), dica("Pode pular: toque em Continuar.")) },
        { titulo: "Confirme o cadastro", icone: "check", ajuda: "Usuário e senha foram criados sozinhos. Você recebe o cartão de acesso no fim.",
          tela: (r) => el("div", {}, el("div", { class: "resumo" }, NE.linhaResumo("Nome", d.nome.trim()), NE.linhaResumo("Função", NE.funcoes[d.funcao]), NE.linhaResumo("Vê no app", U.papelDe(d.funcao) === "admin" ? "Painel da administração" : "Só a conferência"), NE.linhaResumo("WhatsApp", d.telefone || "—"), NE.linhaResumo("Foto", d.fotos.length ? "Sim" : "Sem foto"), NE.linhaResumo("Usuário", usuario()), NE.linhaResumo("Senha", d.senha), NE.linhaResumo("Cadastrado por", `${app.perfil.nome} (você)`)),
            U.papelDe(d.funcao) === "admin" && el("div", { class: "aviso alerta" }, ic("alerta"), el("span", {}, "Esta função vê fotos e dados de todas as cargas. Confirme que é a pessoa certa.")),
            el("button", { type: "button", class: "link-acao", onclick: () => { d.senha = U.senhaNova(); r(); } }, ic("chave"), "Gerar outra senha")) },
      ],
      async aoConcluir() {
        const foto = d.fotos[0] ? await NE.dados.enviarFoto(d.fotos[0].blob, app.perfil.id) : null; const u = usuario();
        await NE.dados.criarFuncionario({ nome: d.nome.trim(), usuario: u, senha: d.senha, funcao: d.funcao, papel: U.papelDe(d.funcao), telefone: NE.soDigitos(d.telefone) || null, foto });
        const cartao = { nome: d.nome.trim(), usuario: u, senha: d.senha, funcao: d.funcao, telefone: NE.soDigitos(d.telefone) };
        NE.telaFim(raiz, { titulo: "Pessoa cadastrada", texto: `${d.nome.trim().split(" ")[0]} já pode entrar no app. O cadastro ficou registrado em nome de ${app.perfil.nome}. Mande o acesso${NE.pacote.tem("videos") ? " e o vídeo tutorial da função" : ""} pelo WhatsApp agora: a senha não aparece de novo.`,
          botoes: [{ rotulo: NE.pacote.tem("videos") ? "Mandar acesso e vídeo no WhatsApp" : "Mandar acesso no WhatsApp", icone: "whatsapp", acao: () => window.open(U.zapBV(cartao), "_blank", "noopener") }, { rotulo: "Mostrar o cartão de acesso", icone: "qr", acao: () => U.cartoes([cartao], "Cartão de acesso") }, { rotulo: "Cadastrar outra pessoa", icone: "mais", acao: () => G.novaPessoa(raiz, app, { funcao: d.funcao }) }, { rotulo: "Voltar à equipe", acao: () => app.ir("equipe", {}, { substituir: true }) }] });
      },
    });
  };

  // ───────────────────────── 7. Mudar algo de uma pessoa ─────────────────────────
  G.pessoa = async (raiz, app, params) => {
    const U = NE.equipeUtil; const p = (await NE.dados.funcionarios()).find((x) => x.id === params.id); if (!p) return app.ir("equipe", {}, { substituir: true });
    const d = { oque: "", telefone: NE.mascaraTelefone(p.telefone), email_contato: p.email_contato || "", admissao: p.admissao || "", cnh_validade: p.cnh_validade || "", funcao: p.funcao, papel: p.papel, fotos: [], novaSenha: "" };
    const opcoes = [{ valor: "contato", rotulo: "WhatsApp e contato", dica: "Telefone, e-mail" }, { valor: "foto", rotulo: "Foto de perfil", dica: "Aparece ao lado do nome" }, { valor: "funcao", rotulo: "Função e acesso", dica: "O que a pessoa pode ver" }, { valor: "senha", rotulo: "Nova senha", dica: "Para quem esqueceu" }];
    NE.assistente({
      raiz, rotuloFinal: "Salvar", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: `O que mudar em ${p.nome.split(" ")[0]}?`, icone: "usuario", ajuda: "Escolha uma coisa de cada vez.", tela: (r) => NE.escolhaUnica(opcoes, d.oque, (v) => { d.oque = v; r(); }), validar: () => (!d.oque ? "Toque no que você quer mudar." : null) },
        { titulo: (opcoes.find((o) => o.valor === d.oque) || {}).rotulo || "Alterar", icone: "conferir", ajuda: "Confira e toque em Salvar.",
          tela: (r) => {
            if (d.oque === "contato") { const zap = NE.linkWhatsApp(d.telefone); return el("div", {}, NE.campoTexto("WhatsApp / celular", { id: "ed-tel", value: d.telefone, inputmode: "tel", placeholder: "(15) 99999-9999" }, (v, i) => { d.telefone = NE.mascaraTelefone(v); if (i.value !== d.telefone) i.value = d.telefone; }), zap && el("a", { class: "btn btn-verde btn-bloco", href: zap, target: "_blank", rel: "noopener", style: "margin-bottom:12px" }, ic("whatsapp"), "Abrir conversa"), NE.campoTexto("E-mail", { id: "ed-email", value: d.email_contato, type: "email" }, (v) => { d.email_contato = v.trim(); })); }
            if (d.oque === "foto") return NE.seletorFoto({ titulo: "Foto de perfil", dica: "Rosto de frente, com boa luz.", lista: d.fotos, varias: false, frontal: true, aoMudar: r });
            if (d.oque === "funcao") return el("div", {}, el("div", { class: "campo" }, el("label", {}, "Função"), el("div", { class: "chips" }, U.FUNCOES.map(([v, nome]) => el("button", { type: "button", class: "chip", "aria-pressed": String(d.funcao === v), onclick: () => { d.funcao = v; r(); } }, nome)))), NE.escolhaUnica([{ valor: "funcionario", rotulo: "Só conferência" }, { valor: "admin", rotulo: "Painel completo" }], d.papel, (v) => { d.papel = v; r(); }));
            return dica("Vamos gerar uma senha nova e mostrar o cartão de acesso para você entregar. A senha antiga deixa de valer.");
          },
          validar: () => (d.oque === "contato" && d.telefone && NE.soDigitos(d.telefone).length < 10 ? "O telefone precisa ter DDD e número." : d.oque === "foto" && !d.fotos.length ? "Tire ou escolha uma foto." : null) },
      ],
      async aoConcluir() {
        if (d.oque === "senha") { const r = await NE.dados.redefinirSenha(p.id); return U.cartoes([{ nome: p.nome, usuario: r.usuario || p.usuario, senha: r.senha, funcao: p.funcao, telefone: p.telefone }], "Nova senha", () => app.ir("equipe", {}, { substituir: true })); }
        const campos = d.oque === "contato" ? { telefone: NE.soDigitos(d.telefone) || null, email_contato: d.email_contato || null } : d.oque === "foto" ? { foto: await NE.dados.enviarFoto(d.fotos[0].blob, app.perfil.id) } : { funcao: d.funcao, papel: d.papel };
        await NE.dados.alterarFuncionario(p.id, campos); NE.telaFim(raiz, { titulo: "Pronto!", texto: `Os dados de ${p.nome.split(" ")[0]} foram atualizados.`, botoes: [{ rotulo: "Voltar à equipe", acao: () => app.ir("equipe", {}, { substituir: true }) }] });
      },
    });
  };

  // ───────────────────────── 8. Mudar algo de um caminhão ─────────────────────────
  G.veiculo = async (raiz, app, params) => {
    const v = (await NE.dados.veiculos(true)).find((x) => x.id === params.id); if (!v) return app.ir("cadastros", { aba: "caminhoes" }, { substituir: true });
    const NOMES = { frente: "Frente", lateral: "Lateral", traseira: "Traseira", placa: "Placa", outras: "Outras" };
    const d = { oque: "", placa: v.placa || "", marca: v.marca || "", modelo: v.modelo || "", ano: v.ano ? String(v.ano) : "", cor: v.cor || "", capacidade_t: v.capacidade_t ? String(v.capacidade_t) : "", descricao: v.descricao || "", novas: { frente: [], lateral: [], traseira: [], placa: [], outras: [] } };
    NE.assistente({
      raiz, rotuloFinal: "Salvar", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: `O que mudar em ${v.placa}?`, icone: "caminhao", ajuda: "Escolha uma coisa de cada vez.", tela: (r) => NE.escolhaUnica([{ valor: "dados", rotulo: "Dados do caminhão", dica: "Marca, modelo, ano, cor, capacidade" }, { valor: "fotos", rotulo: "Fotos", dica: `${(v.fotos || []).length} fotos hoje` }], d.oque, (x) => { d.oque = x; r(); }), validar: () => (!d.oque ? "Toque no que você quer mudar." : null) },
        { titulo: d.oque === "fotos" ? "Fotos do caminhão" : "Dados do caminhão", icone: "conferir", ajuda: "Confira e toque em Salvar.",
          tela: (r) => d.oque === "fotos" ? el("div", {}, (v.fotos || []).length ? el("div", { class: "galeria-frota" }, v.fotos.map((f) => { const b = el("button", { type: "button", "aria-label": `Ver foto: ${NOMES[f.tipo] || f.tipo}` }, el("span", {}, NOMES[f.tipo] || f.tipo)); NE.dados.urlFoto(f.caminho).then((u) => { if (u) b.prepend(el("img", { src: u, alt: "", loading: "lazy" })); }).catch(() => {}); return b; })) : dica("Sem fotos ainda."), el("h3", {}, "Adicionar"), ...Object.keys(NOMES).map((k) => NE.seletorFoto({ titulo: NOMES[k], lista: d.novas[k], varias: k === "outras", aoMudar: r })))
            : el("div", {}, NE.campoTexto("Placa", { id: "fv-placa", value: d.placa, maxlength: "8", autocapitalize: "characters", autocomplete: "off" }, (x, i) => { d.placa = x.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7); if (i.value !== d.placa) i.value = d.placa; }), el("div", { class: "form-linha" }, NE.campoTexto("Marca", { id: "fv-marca", value: d.marca }, (x) => { d.marca = x; }), NE.campoTexto("Modelo", { id: "fv-modelo", value: d.modelo }, (x) => { d.modelo = x; })), el("div", { class: "form-linha" }, NE.campoTexto("Ano", { id: "fv-ano", value: d.ano, inputmode: "numeric", maxlength: "4" }, (x, i) => { d.ano = x.replace(/\D/g, "").slice(0, 4); if (i.value !== d.ano) i.value = d.ano; }), NE.campoTexto("Cor", { id: "fv-cor", value: d.cor }, (x) => { d.cor = x; })), NE.campoTexto("Capacidade (toneladas)", { id: "fv-cap", value: d.capacidade_t, inputmode: "decimal" }, (x, i) => { d.capacidade_t = x.replace(",", ".").replace(/[^0-9.]/g, ""); if (i.value !== d.capacidade_t) i.value = d.capacidade_t; }), NE.campoTexto("Observação", { id: "fv-obs", value: d.descricao }, (x) => { d.descricao = x; })),
          validar: () => (d.oque === "dados" && d.placa.length !== 7 ? "A placa tem 7 letras e números." : d.oque === "dados" && d.ano && (Number(d.ano) < 1980 || Number(d.ano) > new Date().getFullYear() + 1) ? "Confira o ano do caminhão." : d.oque === "fotos" && !Object.values(d.novas).flat().length ? "Tire ou escolha pelo menos uma foto." : null) },
      ],
      async aoConcluir() {
        let campos; if (d.oque === "fotos") { const fotos = [...(v.fotos || [])]; for (const [tipo, lista] of Object.entries(d.novas)) for (const f of lista) fotos.push({ tipo, caminho: await NE.dados.enviarFoto(f.blob, app.perfil.id) }); campos = { fotos }; }
        else campos = { placa: d.placa, marca: d.marca.trim() || null, modelo: d.modelo.trim() || null, ano: d.ano ? Number(d.ano) : null, cor: d.cor.trim() || null, capacidade_t: d.capacidade_t ? Number(d.capacidade_t) : null, descricao: d.descricao.trim() || null };
        await NE.dados.alterarVeiculo(v.id, campos); NE.telaFim(raiz, { titulo: "Pronto!", texto: `${d.placa || v.placa} foi atualizado.`, botoes: [{ rotulo: "Voltar aos caminhões", acao: () => app.ir("cadastros", { aba: "caminhoes" }, { substituir: true }) }] });
      },
    });
  };

  // ───────────────────────── 9. Mudar algo de um produto ─────────────────────────
  G.produto = async (raiz, app, params) => {
    const p = (await NE.dados.produtos(true)).find((x) => x.id === params.id); if (!p) return app.ir("cadastros", { aba: "produtos" }, { substituir: true });
    const d = { oque: "", nome: p.nome, minimo: Number(p.minimo || 0), por_pilha: Number(p.por_pilha || 0) };
    NE.assistente({
      raiz, rotuloFinal: "Salvar", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: `O que mudar em ${p.nome}?`, icone: "caixas", ajuda: "Escolha uma coisa.", tela: (r) => NE.escolhaUnica([{ valor: "nome", rotulo: "Nome do produto", dica: "Corrigir como aparece na lista" }, { valor: "minimo", rotulo: "Estoque mínimo", dica: "Abaixo disso o app avisa" }, { valor: "pilha", rotulo: "Peças por pilha", dica: "Deixa a contagem mais rápida" }], d.oque, (x) => { d.oque = x; r(); }), validar: () => (!d.oque ? "Toque no que você quer mudar." : null) },
        { get titulo() { return d.oque === "nome" ? "Qual é o nome certo?" : d.oque === "pilha" ? "Quantas peças tem cada pilha?" : "Qual o estoque mínimo?"; }, icone: "conferir", validar: () => (d.oque === "nome" && d.nome.trim().length < 2 ? "Digite o nome do produto." : null), ajuda: d.oque === "nome" ? "É o nome que aparece nas notas e no estoque." : d.oque === "pilha" ? "Assim a equipe conta pilhas, e não peça por peça. Use 0 se o produto não fica em pilha." : "Quando o saldo ficar abaixo desse número, a expedição recebe um aviso.", tela: () => (d.oque === "nome" ? NE.campoTexto("Nome do produto", { id: "ep-nome", value: d.nome, autocomplete: "off" }, (x) => { d.nome = x; }) : d.oque === "pilha" ? NE.contador(d.por_pilha, (v) => { d.por_pilha = v; }, "ep-pilha") : NE.contador(d.minimo, (v) => { d.minimo = v; }, "ep-min")) },
      ],
      async aoConcluir() { await NE.dados.alterarProduto(p.id, d.oque === "nome" ? { nome: d.nome.trim() } : d.oque === "pilha" ? { por_pilha: d.por_pilha || null } : { minimo: d.minimo }); NE.telaFim(raiz, { titulo: "Pronto!", texto: `${p.nome} foi atualizado.`, botoes: [{ rotulo: "Voltar aos produtos", acao: () => app.ir("cadastros", { aba: "produtos" }, { substituir: true }) }] }); },
    });
  };

  // Cadastros completos (um por vez) — o passo a passo já existe em cadastros.js; aqui só entram na rota "guia" (sem a barra de baixo)
  G.novoVeiculo = (raiz, app) => NE.cadastros.caminhao(raiz, () => app.ir("cadastros", { aba: "caminhoes" }, { substituir: true }));
  G.novoProduto = (raiz, app) => NE.cadastros.produto(raiz, () => app.ir("cadastros", { aba: "produtos" }, { substituir: true }));

  // ───────────────────────── 10. Ajustes: quando o app deve avisar ─────────────────────────
  G.ajustes = async (raiz, app) => {
    const c = await NE.dados.config(); const nomesDia = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    NE.assistente({
      raiz, rotuloFinal: "Salvar ajustes", aoCancelar: () => app.voltar(),
      passos: [
        { titulo: "Quando a empresa trabalha?", icone: "relogio", ajuda: "Conferência fora desse horário gera um aviso.", tela: (r) => {
          const hora = (rot, ch, id) => { const i = el("input", { class: "entrada", type: "time", id, value: c.expediente[ch] }); i.addEventListener("change", () => { c.expediente[ch] = i.value; }); return el("div", { class: "campo" }, el("label", { for: id }, rot), i); };
          return el("div", {}, el("div", { class: "chips" }, nomesDia.map((n, i) => el("button", { type: "button", class: "chip", "aria-pressed": String(c.expediente.dias.includes(i)), onclick: () => { const s = new Set(c.expediente.dias); s.has(i) ? s.delete(i) : s.add(i); c.expediente.dias = [...s].sort(); r(); } }, n))), el("div", { class: "form-linha", style: "margin-top:14px" }, hora("Começa", "inicio", "cf-ini"), hora("Termina", "fim", "cf-fim"))); } },
        { titulo: "Quando o app deve avisar?", icone: "sino", ajuda: "Você pode deixar como está.", tela: () => el("div", {}, el("div", { class: "campo" }, el("label", { for: "cf-parada" }, "Nota esperando conferência há mais de (minutos)"), NE.contador(c.limiteNotaParadaMin, (v) => { c.limiteNotaParadaMin = Math.max(10, v); }, "cf-parada")), el("div", { class: "campo" }, el("label", { for: "cf-contagem" }, "Produto sem contar há mais de (dias)"), NE.contador(c.diasContagem, (v) => { c.diasContagem = Math.max(1, v); }, "cf-contagem"))) },
        { titulo: "Resumo do dia", icone: "check", ajuda: "Todo dia, nesse horário, o app manda um resumo para a administração.", tela: () => { const i = el("input", { class: "entrada", type: "time", id: "cf-resumo", value: c.resumoDiarioHora }); i.addEventListener("change", () => { c.resumoDiarioHora = i.value; }); return el("div", { class: "campo" }, el("label", { for: "cf-resumo" }, "Hora do resumo"), i); } },
      ],
      async aoConcluir() { await NE.dados.salvarConfig(c); NE.telaFim(raiz, { titulo: "Ajustes salvos", texto: "O app já usa os novos horários e prazos.", botoes: [{ rotulo: "Voltar", acao: () => app.ir("mais", {}, { substituir: true }) }] }); },
    });
  };
})();
