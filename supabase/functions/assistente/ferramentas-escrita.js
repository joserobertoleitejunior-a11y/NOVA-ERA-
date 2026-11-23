// FERRAMENTAS DE ESCRITA do assistente. Regra de ouro: NENHUMA escreve na hora.
//  · propor(ctx, entrada)  → valida tudo, acha os registros pelo nome e monta o texto do cartão "Confirmar / Cancelar" (o texto é do SERVIDOR, não da IA).
//  · resumo(args)          → uma linha, sem senhas, para o registro de auditoria.
//  · executar(ctx, args)   → só roda depois do toque em Confirmar, com o login de quem pediu (as regras e travas do banco continuam valendo).
(function (raiz) {
  "use strict";
  const F = raiz.NEFerramentas;
  const { registrar, achar, dom, ErroProposta } = F; const U = F.util; const { linha } = U;
  const D = () => raiz.NEDominio;
  const str = (descricao, extra = {}) => ({ type: "string", description: descricao, ...extra });
  const nmr = (descricao) => ({ type: "number", description: descricao });
  const bool = (descricao) => ({ type: "boolean", description: descricao });
  const esq = (properties = {}, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
  const lista = (items, descricao, maxItems = 50) => ({ type: "array", items, description: descricao, maxItems });
  const escrever = (nome, descricao, schema, def) => registrar({ nome, tipo: "escrever", descricao, schema, ...def });
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;
  const hora2 = (h) => { const [a, b] = h.split(":"); return `${a.padStart(2, "0")}:${b}`; };

  // Separa o que entra do que fica de fora (com o motivo); sem nada válido, devolve o erro à IA.
  function fechar(nomeSing, bons, fora) {
    if (!bons.length) throw new ErroProposta(fora.length ? `Nenhum item ficou válido: ${fora.join(" · ")}` : `Diga o que fazer com ${nomeSing}.`);
    return fora.map((f) => `Ficou de fora — ${f}`);
  }
  // Texto final de um lote: quantos deram certo e o que falhou.
  function relatorio(itens, umFeito, variosFeitos, extra = "") {
    const certos = itens.filter((i) => i.ok).length; const falhas = itens.filter((i) => !i.ok);
    if (!falhas.length) return { ok: true, texto: `Pronto: ${U.plural(certos, umFeito, variosFeitos)}.${extra}` };
    const motivos = falhas.map((f) => `${f.texto} (${f.erro})`).join("; ");
    return { ok: false, texto: certos ? `${certos} de ${itens.length} deram certo. Não deu: ${motivos}.${extra}` : `Não deu certo: ${motivos}.` };
  }
  const tentar = async (texto, fn) => { try { await fn(); return { ok: true, texto }; } catch (er) { return { ok: false, texto, erro: er && er.message ? er.message : "erro" }; } };

  // ═════════════════════════ FUNCIONÁRIOS ═════════════════════════
  escrever("cadastrar_funcionarios",
    "Cadastra um ou VÁRIOS funcionários de uma vez (cada um com nome e função). Usuário e senha saem sozinhos, a menos que a pessoa escolha. Telefone, e-mail, admissão, validade da CNH, observação e foto de perfil (um anexo) são opcionais. Só prepara; a pessoa confirma depois.",
    esq({ pessoas: lista(esq({ nome: str("Nome completo"), funcao: str("Função", { enum: dom.FUNCOES }), telefone: str("Celular com DDD"), email_contato: str("E-mail de contato"), admissao: str("Data de admissão (dd/mm/aaaa)"), cnh_validade: str("Validade da CNH (dd/mm/aaaa), para motoristas"), observacao: str("Observação"), usuario: str("Usuário, só se a pessoa escolheu um"), senha: str("Senha, só se a pessoa escolheu uma (mínimo 6)"), papel: str("admin = painel da administração; funcionario = só conferência. Deixe vazio para o padrão da função.", { enum: ["admin", "funcionario"] }), foto_anexo: str("Id do anexo (foto) para o perfil, ex.: a1") }, ["nome", "funcao"]), "As pessoas a cadastrar") }, ["pessoas"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.pessoas); if (!entrada.length) throw new ErroProposta("Diga quem cadastrar (nome e função).");
        if (entrada.length > 50) throw new ErroProposta("No máximo 50 pessoas por vez. Divida em partes.");
        const existentes = await ctx.perfis(); const usados = new Set(existentes.map((p) => p.usuario).filter(Boolean)); const bons = [], fora = [];
        entrada.forEach((p, i) => {
          const rot = U.txt(p && p.nome) || `pessoa ${i + 1}`;
          try {
            const nome = U.nomeBonito(p.nome); if (nome.length < 2) throw new Error("falta o nome");
            const funcao = dom.funcaoDe(p.funcao); if (!funcao) throw new Error("falta a função (conferente, motorista, ajudante, expedição, vendedor, administrativo ou diretoria)");
            let usuario = U.vazio(p.usuario) ? dom.usuarioDe(nome) : U.txt(p.usuario, 30).toLowerCase();
            if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error("usuário inválido (3 a 30 letras ou números, sem espaço)");
            if (U.vazio(p.usuario)) { const base = usuario; let k = 2; while (usados.has(usuario)) usuario = `${base}${k++}`; } else if (usados.has(usuario)) throw new Error(`o usuário "${usuario}" já existe`);
            const senha = U.vazio(p.senha) ? dom.senhaNova() : String(p.senha); if (senha.length < 6) throw new Error("a senha precisa de 6 caracteres ou mais");
            const telefone = U.digitos(p.telefone) || null; if (telefone && (telefone.length < 10 || telefone.length > 13)) throw new Error("telefone inválido (use DDD e número)");
            const email = U.vazio(p.email_contato) ? null : U.txt(p.email_contato, 120); if (email && !EMAIL.test(email)) throw new Error("e-mail inválido");
            const papel = p.papel === "admin" || p.papel === "funcionario" ? p.papel : dom.papelDe(funcao);
            const foto = U.vazio(p.foto_anexo) ? null : ctx.anexo(p.foto_anexo, "imagem").caminho;
            usados.add(usuario);
            bons.push({ nome, funcao, usuario, senha, papel, telefone, email_contato: email, admissao: U.dataISO(p.admissao, "Admissão"), cnh_validade: U.dataISO(p.cnh_validade, "Validade da CNH"), observacao: U.vazio(p.observacao) ? null : U.txt(p.observacao, 400), foto });
          } catch (er) { fora.push(`${rot}: ${er.message}`); }
        });
        const avisos = fechar("o cadastro", bons, fora); const linhas = [];
        for (const p of bons) {
          linhas.push(linha(`${p.nome} — ${dom.ROTULO_FUNCAO[p.funcao]} · ${dom.acesso(p.papel)}`));
          linhas.push(linha(`    Usuário: ${p.usuario}   Senha: ${p.senha}`, true));
          const extra = [p.telefone && `WhatsApp ${U.telefoneBR(p.telefone)}`, p.email_contato, p.admissao && `admissão ${U.dataBR(p.admissao)}`, p.cnh_validade && `CNH até ${U.dataBR(p.cnh_validade)}`, p.foto && "com foto"].filter(Boolean);
          if (extra.length) linhas.push(linha(`    ${extra.join(" · ")}`));
        }
        const admins = bons.filter((p) => p.papel === "admin");
        if (admins.length) avisos.push(`${U.plural(admins.length, "pessoa vai", "pessoas vão")} ver fotos e dados de todas as cargas (painel da administração): ${D().lista(admins.map((p) => p.nome), 4)}. Confirme que é quem você quer.`);
        avisos.push("A senha aparece só agora e no cartão depois de confirmar. Depois ela não aparece de novo.");
        return { titulo: bons.length === 1 ? `Cadastrar ${bons[0].nome}` : `Cadastrar ${bons.length} pessoas`, linhas, avisos, risco: admins.length ? "alto" : "normal", args: { pessoas: bons } };
      },
      resumo: (a) => `Cadastrar ${U.plural(a.pessoas.length, "pessoa", "pessoas")}: ${D().lista(a.pessoas.map((p) => `${p.nome} (${p.funcao})`), 6)}`,
      async executar(ctx, a) {
        const r = await ctx.repo.chamarFuncao("criar-funcionario", { lote: a.pessoas.map((p) => ({ nome: p.nome, usuario: p.usuario, senha: p.senha, funcao: p.funcao, papel: p.papel, telefone: p.telefone, email_contato: p.email_contato, admissao: p.admissao, cnh_validade: p.cnh_validade, observacao: p.observacao, foto: p.foto })) });
        const res = U.arr(r && r.resultados); const itens = [], acessos = [];
        a.pessoas.forEach((p, i) => { const x = res[i] || {}; if (x.ok) { itens.push({ ok: true, texto: p.nome }); acessos.push({ nome: p.nome, usuario: x.usuario || p.usuario, senha: x.senha || p.senha, funcao: p.funcao, telefone: p.telefone || "" }); } else itens.push({ ok: false, texto: p.nome, erro: x.erro || "não foi possível cadastrar" }); });
        const rel = relatorio(itens, "pessoa cadastrada", "pessoas cadastradas", acessos.length ? " Mande o acesso e o vídeo da função agora: a senha não aparece de novo." : "");
        return { ...rel, itens, acessos };
      },
    });

  escrever("editar_funcionarios",
    "Muda dados de funcionários que já existem: nome, função, acesso (admin ou só conferência), telefone, e-mail, admissão, validade da CNH, observação, foto de perfil (anexo) e se a pessoa pode entrar (pode_entrar=false desativa, true reativa). Aceita várias pessoas de uma vez.",
    esq({ alteracoes: lista(esq({ funcionario: str("Nome, usuário ou id da pessoa"), nome: str("Novo nome"), funcao: str("Nova função", { enum: dom.FUNCOES }), papel: str("admin ou funcionario. Se mudar a função e deixar vazio, o acesso acompanha a função.", { enum: ["admin", "funcionario"] }), telefone: str("Novo celular com DDD (vazio para tirar)"), email_contato: str("Novo e-mail"), admissao: str("Data de admissão dd/mm/aaaa"), cnh_validade: str("Validade da CNH dd/mm/aaaa"), observacao: str("Observação"), pode_entrar: bool("false = impede de entrar no app; true = libera"), foto_anexo: str("Id do anexo (foto) para o perfil, ex.: a1") }, ["funcionario"]), "Quem muda e o quê") }, ["alteracoes"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.alteracoes); if (!entrada.length) throw new ErroProposta("Diga quem mudar e o quê.");
        const pessoas = await ctx.perfis(); const bons = [], fora = []; const linhas = []; let alto = false; const novas = new Map();
        for (const alt of entrada) {
          const ref = U.txt(alt && alt.funcionario); const r = achar.pessoa(pessoas, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const p = r.item; const campos = {}; const mud = [];
          try {
            if (!U.vazio(alt.nome)) { const v = U.nomeBonito(alt.nome); if (v.length < 2) throw new Error("nome curto demais"); if (v !== p.nome) { campos.nome = v; mud.push(`nome: ${p.nome} → ${v}`); } }
            if (!U.vazio(alt.funcao)) { const v = dom.funcaoDe(alt.funcao); if (!v) throw new Error("função inválida"); if (v !== p.funcao) { campos.funcao = v; mud.push(`função: ${dom.ROTULO_FUNCAO[p.funcao] || p.funcao} → ${dom.ROTULO_FUNCAO[v]}`); } }
            const papelNovo = alt.papel === "admin" || alt.papel === "funcionario" ? alt.papel : campos.funcao ? dom.papelDe(campos.funcao) : p.papel;
            if (papelNovo !== p.papel) { campos.papel = papelNovo; mud.push(`acesso: ${dom.acesso(p.papel)} → ${dom.acesso(papelNovo)}`); }
            if (alt.telefone !== undefined && alt.telefone !== null) { const d = U.digitos(alt.telefone) || null; if (d && (d.length < 10 || d.length > 13)) throw new Error("telefone inválido (use DDD e número)"); if (d !== (p.telefone || null)) { campos.telefone = d; mud.push(`telefone: ${U.telefoneBR(p.telefone)} → ${d ? U.telefoneBR(d) : "sem telefone"}`); } }
            if (alt.email_contato !== undefined && alt.email_contato !== null) { const v = U.vazio(alt.email_contato) ? null : U.txt(alt.email_contato, 120); if (v && !EMAIL.test(v)) throw new Error("e-mail inválido"); if (v !== (p.email_contato || null)) { campos.email_contato = v; mud.push(`e-mail: ${p.email_contato || "—"} → ${v || "sem e-mail"}`); } }
            if (alt.admissao !== undefined && alt.admissao !== null) { const v = U.dataISO(alt.admissao, "Admissão"); if (v !== (p.admissao || null)) { campos.admissao = v; mud.push(`admissão: ${U.dataBR(p.admissao)} → ${U.dataBR(v)}`); } }
            if (alt.cnh_validade !== undefined && alt.cnh_validade !== null) { const v = U.dataISO(alt.cnh_validade, "Validade da CNH"); if (v !== (p.cnh_validade || null)) { campos.cnh_validade = v; mud.push(`CNH até: ${U.dataBR(p.cnh_validade)} → ${U.dataBR(v)}`); } }
            if (alt.observacao !== undefined && alt.observacao !== null) { const v = U.vazio(alt.observacao) ? null : U.txt(alt.observacao, 400); if (v !== (p.observacao || null)) { campos.observacao = v; mud.push(`observação: ${v || "(vazia)"}`); } }
            if (typeof alt.pode_entrar === "boolean" && alt.pode_entrar !== (p.ativo !== false)) { campos.ativo = alt.pode_entrar; mud.push(alt.pode_entrar ? "volta a poder entrar no app" : "NÃO poderá mais entrar no app"); }
            if (!U.vazio(alt.foto_anexo)) { campos.foto = ctx.anexo(alt.foto_anexo, "imagem").caminho; mud.push("nova foto de perfil"); }
          } catch (er) { fora.push(`${p.nome}: ${er.message}`); continue; }
          if (!mud.length) { fora.push(`${p.nome}: já está assim, nada para mudar`); continue; }
          if (campos.ativo === false || campos.papel !== undefined) alto = true;
          novas.set(p.id, campos); bons.push({ id: p.id, nome: p.nome, campos });
          linhas.push(linha(p.nome)); mud.forEach((m) => linhas.push(linha(`    ${m}`)));
        }
        const avisos = fechar("a alteração", bons, fora);
        // Nunca deixar o sistema sem administrador, nem tirar o acesso de quem está pedindo.
        const finais = pessoas.map((p) => ({ ...p, ...(novas.get(p.id) || {}) }));
        if (!finais.some((p) => p.papel === "admin" && p.ativo !== false)) throw new ErroProposta("Isso deixaria o sistema sem nenhum administrador ativo. Não vou preparar.");
        const euF = finais.find((p) => p.id === ctx.eu.id); if (!euF || euF.papel !== "admin" || euF.ativo === false) throw new ErroProposta("Isso tiraria o SEU acesso de administração. Peça a outro administrador.");
        return { titulo: bons.length === 1 ? `Alterar ${bons[0].nome}` : `Alterar ${bons.length} pessoas`, linhas, avisos, risco: alto ? "alto" : "normal", args: { alteracoes: bons } };
      },
      resumo: (a) => `Alterar ${D().lista(a.alteracoes.map((x) => `${x.nome} (${Object.keys(x.campos).join(", ")})`), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const x of a.alteracoes) itens.push(await tentar(x.nome, async () => { await ctx.repo.atualizar("perfis", x.id, x.campos); }));
        return { ...relatorio(itens, "pessoa atualizada", "pessoas atualizadas"), itens };
      },
    });

  escrever("redefinir_senhas",
    "Gera uma senha nova para funcionários que esqueceram (a senha antiga deixa de valer). Pode escolher a senha ou deixar sair sozinha.",
    esq({ pessoas: lista(esq({ funcionario: str("Nome, usuário ou id"), senha: str("Senha escolhida (opcional, mínimo 6)") }, ["funcionario"]), "Quem recebe senha nova", 20) }, ["pessoas"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.pessoas); if (!entrada.length) throw new ErroProposta("Diga de quem é a senha nova.");
        const pessoas = await ctx.perfis(); const bons = [], fora = [], linhas = [];
        for (const x of entrada) {
          const ref = U.txt(x && x.funcionario); const r = achar.pessoa(pessoas, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const senha = U.vazio(x.senha) ? dom.senhaNova() : String(x.senha); if (senha.length < 6) { fora.push(`${r.item.nome}: a senha precisa de 6 caracteres ou mais`); continue; }
          bons.push({ id: r.item.id, nome: r.item.nome, usuario: r.item.usuario || null, funcao: r.item.funcao, telefone: r.item.telefone || "", senha });
          linhas.push(linha(`${r.item.nome}${r.item.usuario ? ` (usuário ${r.item.usuario})` : " (entra pelo e-mail)"}`)); linhas.push(linha(`    Nova senha: ${senha}`, true));
        }
        const avisos = fechar("a senha nova", bons, fora); avisos.push("A senha antiga deixa de valer na hora. Mande a nova para a pessoa depois de confirmar.");
        return { titulo: bons.length === 1 ? `Nova senha para ${bons[0].nome}` : `Nova senha para ${bons.length} pessoas`, linhas, avisos, risco: "normal", args: { pessoas: bons } };
      },
      resumo: (a) => `Nova senha para ${D().lista(a.pessoas.map((p) => p.nome), 6)}`,
      async executar(ctx, a) {
        const itens = [], acessos = [];
        for (const p of a.pessoas) { try { const r = await ctx.repo.chamarFuncao("criar-funcionario", { acao: "redefinir", id: p.id, senha: p.senha }); itens.push({ ok: true, texto: p.nome }); acessos.push({ nome: p.nome, usuario: (r && r.usuario) || p.usuario || "", senha: (r && r.senha) || p.senha, funcao: p.funcao, telefone: p.telefone }); } catch (er) { itens.push({ ok: false, texto: p.nome, erro: er.message }); } }
        return { ...relatorio(itens, "senha trocada", "senhas trocadas", acessos.length ? " Mande a senha nova para a pessoa: ela não aparece de novo." : ""), itens, acessos };
      },
    });

  escrever("apagar_funcionarios",
    "APAGA funcionários de vez. Só funciona para quem nunca registrou nada (sem conferência, nota ou lançamento). Quem já tem histórico não pode ser apagado: nesse caso use editar_funcionarios com pode_entrar=false.",
    esq({ funcionarios: lista(str("Nome, usuário ou id"), "Quem apagar", 20) }, ["funcionarios"]),
    {
      async propor(ctx, e) {
        const refs = U.arr(e.funcionarios); if (!refs.length) throw new ErroProposta("Diga quem apagar.");
        const pessoas = await ctx.perfis(); const bons = [], fora = [], linhas = [];
        for (const ref0 of refs) {
          const ref = U.txt(ref0); const r = achar.pessoa(pessoas, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const p = r.item; if (p.id === ctx.eu.id) { fora.push(`${p.nome}: você não pode apagar o seu próprio cadastro`); continue; }
          const usos = [["conferencias", "conferente_id", "conferências"], ["notas", "criado_por", "notas"], ["estoque_movimentos", "usuario_id", "lançamentos de estoque"], ["contagens", "criado_por", "contagens"]];
          const tem = []; for (const [tab, col, rot] of usos) { const l = await ctx.repo.listar(tab, { selecao: "id", eq: { [col]: p.id }, limite: 1 }); if (l.length) tem.push(rot); }
          if (tem.length) { fora.push(`${p.nome}: já tem ${D().lista(tem, 4)} registrados — apagar perderia o histórico. Posso só impedir que ele entre (desativar)`); continue; }
          bons.push({ id: p.id, nome: p.nome }); linhas.push(linha(`${p.nome} — ${dom.ROTULO_FUNCAO[p.funcao] || p.funcao}`));
        }
        const avisos = fechar("a exclusão", bons, fora);
        const restam = pessoas.filter((p) => p.papel === "admin" && p.ativo !== false && !bons.some((b) => b.id === p.id));
        if (!restam.length) throw new ErroProposta("Isso apagaria o último administrador. Não vou preparar.");
        avisos.push("Apagar não tem volta: o login e o cadastro somem de vez.");
        return { titulo: bons.length === 1 ? `Apagar ${bons[0].nome}` : `Apagar ${bons.length} pessoas`, linhas, avisos, risco: "alto", args: { pessoas: bons } };
      },
      resumo: (a) => `Apagar ${D().lista(a.pessoas.map((p) => p.nome), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const p of a.pessoas) itens.push(await tentar(p.nome, async () => { await ctx.repo.chamarFuncao("criar-funcionario", { acao: "apagar", id: p.id }); }));
        return { ...relatorio(itens, "pessoa apagada", "pessoas apagadas"), itens };
      },
    });

  // ═════════════════════════ PRODUTOS ═════════════════════════
  escrever("cadastrar_produtos",
    "Cadastra um ou vários produtos (nome, código, unidade un/m/m3/t, estoque mínimo, peças por pilha). Só prepara; a pessoa confirma.",
    esq({ produtos: lista(esq({ nome: str("Nome do produto"), codigo: str("Código (opcional)"), unidade: str("un (padrão), m, m3 ou t", { enum: ["un", "m", "m3", "t"] }), minimo: nmr("Estoque mínimo (padrão 0)"), por_pilha: nmr("Peças por pilha (opcional)") }, ["nome"]), "Os produtos") }, ["produtos"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.produtos); if (!entrada.length) throw new ErroProposta("Diga quais produtos cadastrar.");
        const existentes = await ctx.produtos(true); const nomes = new Set(existentes.map((p) => U.norm(p.nome))); const codigos = new Map(existentes.filter((p) => p.codigo).map((p) => [String(p.codigo).trim().toLowerCase(), p.nome]));
        const bons = [], fora = [], linhas = [];
        entrada.forEach((p, i) => {
          const rot = U.txt(p && p.nome) || `produto ${i + 1}`;
          try {
            const nome = U.txt(p.nome, 120); if (nome.length < 2) throw new Error("falta o nome"); if (nomes.has(U.norm(nome))) throw new Error("já existe um produto com esse nome");
            const codigo = U.vazio(p.codigo) ? null : U.txt(p.codigo, 40); if (codigo && codigos.has(codigo.toLowerCase())) throw new Error(`o código ${codigo} já é do produto ${codigos.get(codigo.toLowerCase())}`);
            const unidade = U.vazio(p.unidade) ? "un" : dom.unidadeDe(p.unidade); if (!unidade) throw new Error("unidade inválida (use un, m, m3 ou t)");
            const minimo = U.vazio(p.minimo) ? 0 : U.num(p.minimo); if (!(minimo >= 0)) throw new Error("estoque mínimo inválido");
            const porPilha = U.vazio(p.por_pilha) || Number(p.por_pilha) === 0 ? null : U.num(p.por_pilha); if (porPilha !== null && !(porPilha > 0)) throw new Error("peças por pilha inválido");
            nomes.add(U.norm(nome)); if (codigo) codigos.set(codigo.toLowerCase(), nome);
            bons.push({ nome, codigo, unidade, minimo, por_pilha: porPilha });
            linhas.push(linha(`${nome} · ${dom.UNIDADES[unidade]}${codigo ? ` · código ${codigo}` : ""} · mínimo ${U.fmt(minimo)}${porPilha ? ` · ${U.fmt(porPilha)} por pilha` : ""}`));
          } catch (er) { fora.push(`${rot}: ${er.message}`); }
        });
        const avisos = fechar("o cadastro", bons, fora);
        return { titulo: bons.length === 1 ? `Cadastrar o produto ${bons[0].nome}` : `Cadastrar ${bons.length} produtos`, linhas, avisos, risco: "normal", args: { produtos: bons } };
      },
      resumo: (a) => `Cadastrar ${U.plural(a.produtos.length, "produto", "produtos")}: ${D().lista(a.produtos.map((p) => p.nome), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const p of a.produtos) itens.push(await tentar(p.nome, async () => { await ctx.repo.inserir("produtos", { nome: p.nome, unidade: p.unidade, minimo: p.minimo, por_pilha: p.por_pilha, codigo: p.codigo }); }));
        return { ...relatorio(itens, "produto cadastrado", "produtos cadastrados"), itens };
      },
    });

  escrever("editar_produtos",
    "Muda produtos que já existem: nome, código, unidade, estoque mínimo, peças por pilha e se está ativo (ativo=false tira da lista sem perder histórico).",
    esq({ alteracoes: lista(esq({ produto: str("Nome, código ou id do produto"), nome: str("Novo nome"), codigo: str("Novo código"), unidade: str("un, m, m3 ou t", { enum: ["un", "m", "m3", "t"] }), minimo: nmr("Novo estoque mínimo"), por_pilha: nmr("Peças por pilha (0 tira)"), ativo: bool("false desativa, true reativa") }, ["produto"]), "Quais produtos mudar") }, ["alteracoes"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.alteracoes); if (!entrada.length) throw new ErroProposta("Diga qual produto mudar e o quê.");
        const todos = await ctx.produtos(true); const bons = [], fora = [], linhas = [];
        for (const alt of entrada) {
          const ref = U.txt(alt && alt.produto); const r = achar.produto(todos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const p = r.item; const campos = {}; const mud = [];
          try {
            if (!U.vazio(alt.nome)) { const v = U.txt(alt.nome, 120); if (v.length < 2) throw new Error("nome curto demais"); if (v !== p.nome) { if (todos.some((x) => x.id !== p.id && U.norm(x.nome) === U.norm(v))) throw new Error("já existe outro produto com esse nome"); campos.nome = v; mud.push(`nome: ${p.nome} → ${v}`); } }
            if (alt.codigo !== undefined && alt.codigo !== null) { const v = U.vazio(alt.codigo) ? null : U.txt(alt.codigo, 40); if (v !== (p.codigo || null)) { campos.codigo = v; mud.push(`código: ${p.codigo || "—"} → ${v || "sem código"}`); } }
            if (!U.vazio(alt.unidade)) { const v = dom.unidadeDe(alt.unidade); if (!v) throw new Error("unidade inválida (use un, m, m3 ou t)"); if (v !== p.unidade) { campos.unidade = v; mud.push(`unidade: ${dom.UNIDADES[p.unidade] || p.unidade} → ${dom.UNIDADES[v]}`); } }
            if (!U.vazio(alt.minimo)) { const v = U.num(alt.minimo); if (!(v >= 0)) throw new Error("estoque mínimo inválido"); if (v !== Number(p.minimo || 0)) { campos.minimo = v; mud.push(`estoque mínimo: ${U.fmt(p.minimo || 0)} → ${U.fmt(v)}`); } }
            if (alt.por_pilha !== undefined && alt.por_pilha !== null) { const v = Number(alt.por_pilha) === 0 ? null : U.num(alt.por_pilha); if (v !== null && !(v > 0)) throw new Error("peças por pilha inválido"); if (v !== (p.por_pilha ? Number(p.por_pilha) : null)) { campos.por_pilha = v; mud.push(`peças por pilha: ${p.por_pilha ? U.fmt(p.por_pilha) : "—"} → ${v ? U.fmt(v) : "sem pilha"}`); } }
            if (typeof alt.ativo === "boolean" && alt.ativo !== (p.ativo !== false)) { campos.ativo = alt.ativo; mud.push(alt.ativo ? "volta para a lista" : "sai da lista (o histórico fica)"); }
          } catch (er) { fora.push(`${p.nome}: ${er.message}`); continue; }
          if (!mud.length) { fora.push(`${p.nome}: já está assim, nada para mudar`); continue; }
          bons.push({ id: p.id, nome: p.nome, campos }); linhas.push(linha(p.nome)); mud.forEach((m) => linhas.push(linha(`    ${m}`)));
        }
        const avisos = fechar("a alteração", bons, fora);
        return { titulo: bons.length === 1 ? `Alterar o produto ${bons[0].nome}` : `Alterar ${bons.length} produtos`, linhas, avisos, risco: "normal", args: { alteracoes: bons } };
      },
      resumo: (a) => `Alterar produtos: ${D().lista(a.alteracoes.map((x) => `${x.nome} (${Object.keys(x.campos).join(", ")})`), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const x of a.alteracoes) itens.push(await tentar(x.nome, async () => { await ctx.repo.atualizar("produtos", x.id, x.campos); }));
        return { ...relatorio(itens, "produto atualizado", "produtos atualizados"), itens };
      },
    });

  escrever("apagar_produtos",
    "APAGA produtos de vez. Só funciona para produto sem nenhum histórico (nota, conferência, estoque ou contagem). Com histórico, use editar_produtos com ativo=false.",
    esq({ produtos: lista(str("Nome, código ou id"), "Quais produtos apagar", 30) }, ["produtos"]),
    {
      async propor(ctx, e) {
        const refs = U.arr(e.produtos); if (!refs.length) throw new ErroProposta("Diga qual produto apagar.");
        const todos = await ctx.produtos(true); const bons = [], fora = [], linhas = [];
        for (const ref0 of refs) {
          const ref = U.txt(ref0); const r = achar.produto(todos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const p = r.item; const tem = [];
          for (const [tab, rot] of [["nota_itens", "notas"], ["conferencia_itens", "conferências"], ["estoque_movimentos", "lançamentos de estoque"], ["contagem_itens", "contagens"]]) { const l = await ctx.repo.listar(tab, { selecao: "id", eq: { produto_id: p.id }, limite: 1 }); if (l.length) tem.push(rot); }
          if (tem.length) { fora.push(`${p.nome}: já aparece em ${D().lista(tem, 4)} — apagar perderia o histórico. Posso só tirar da lista (desativar)`); continue; }
          bons.push({ id: p.id, nome: p.nome }); linhas.push(linha(p.nome));
        }
        const avisos = fechar("a exclusão", bons, fora); avisos.push("Apagar não tem volta.");
        return { titulo: bons.length === 1 ? `Apagar o produto ${bons[0].nome}` : `Apagar ${bons.length} produtos`, linhas, avisos, risco: "alto", args: { produtos: bons } };
      },
      resumo: (a) => `Apagar produtos: ${D().lista(a.produtos.map((p) => p.nome), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const p of a.produtos) itens.push(await tentar(p.nome, async () => { await ctx.repo.apagar("produtos", p.id); }));
        return { ...relatorio(itens, "produto apagado", "produtos apagados"), itens };
      },
    });

  // ═════════════════════════ CAMINHÕES ═════════════════════════
  const fotosVeiculo = (ctx, lista0) => U.arr(lista0).map((f) => { const tipo = U.vazio(f.tipo) ? "outras" : U.norm(f.tipo); if (!dom.TIPOS_FOTO_VEICULO.includes(tipo)) throw new Error(`tipo de foto inválido (${dom.TIPOS_FOTO_VEICULO.join(", ")})`); return { tipo, caminho: ctx.anexo(f.anexo, "imagem").caminho }; });
  const propFotos = { type: "array", description: "Fotos do caminhão (anexos)", items: esq({ anexo: str("Id do anexo, ex.: a1"), tipo: str("Onde é a foto", { enum: ["frente", "lateral", "traseira", "placa", "outras"] }) }, ["anexo"]) };
  const checarVeiculo = (v) => {
    const ano = U.vazio(v.ano) ? null : Math.round(U.num(v.ano)); if (ano !== null && !(ano >= 1980 && ano <= new Date().getFullYear() + 1)) throw new Error("ano inválido");
    const cap = U.vazio(v.capacidade_t) ? null : U.num(v.capacidade_t); if (cap !== null && !(cap > 0)) throw new Error("capacidade inválida (em toneladas)");
    return { ano, capacidade_t: cap };
  };

  escrever("cadastrar_veiculos",
    "Cadastra um ou vários caminhões (placa obrigatória; tipo, marca, modelo, ano, cor, capacidade em toneladas, observação e fotos por anexo são opcionais).",
    esq({ veiculos: lista(esq({ placa: str("Placa (7 letras e números)"), tipo: str("caminhao (padrão), truck_munck, betoneira, basculante ou outro", { enum: Object.keys(dom.TIPOS_VEICULO) }), marca: str("Marca"), modelo: str("Modelo"), ano: nmr("Ano"), cor: str("Cor"), capacidade_t: nmr("Capacidade em toneladas"), observacao: str("Observação"), fotos: propFotos }, ["placa"]), "Os caminhões", 30) }, ["veiculos"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.veiculos); if (!entrada.length) throw new ErroProposta("Diga a placa do caminhão.");
        const existentes = await ctx.veiculos(true); const placas = new Set(existentes.map((v) => v.placa)); const bons = [], fora = [], linhas = [];
        entrada.forEach((v, i) => {
          const rot = U.txt(v && v.placa) || `caminhão ${i + 1}`;
          try {
            const placa = U.placaDe(v.placa); if (!U.placaValida(placa)) throw new Error("placa inválida (7 letras e números, como ABC1D23)"); if (placas.has(placa)) throw new Error("essa placa já está cadastrada");
            const tipo = U.vazio(v.tipo) ? "caminhao" : dom.tipoVeiculoDe(v.tipo); if (!tipo) throw new Error("tipo inválido");
            const { ano, capacidade_t } = checarVeiculo(v); const fotos = fotosVeiculo(ctx, v.fotos);
            placas.add(placa);
            const item = { placa, tipo, marca: U.vazio(v.marca) ? null : U.txt(v.marca, 60), modelo: U.vazio(v.modelo) ? null : U.txt(v.modelo, 60), ano, cor: U.vazio(v.cor) ? null : U.txt(v.cor, 40), capacidade_t, descricao: U.vazio(v.observacao) ? null : U.txt(v.observacao, 300), fotos };
            bons.push(item); linhas.push(linha(`${placa} · ${dom.TIPOS_VEICULO[tipo]}${[item.marca, item.modelo].filter(Boolean).length ? ` · ${[item.marca, item.modelo].filter(Boolean).join(" ")}` : ""}${ano ? ` · ${ano}` : ""}${item.cor ? ` · ${item.cor}` : ""}${capacidade_t ? ` · ${U.fmt(capacidade_t)} t` : ""}${fotos.length ? ` · ${U.plural(fotos.length, "foto", "fotos")}` : ""}`));
          } catch (er) { fora.push(`${rot}: ${er.message}`); }
        });
        const avisos = fechar("o cadastro", bons, fora);
        return { titulo: bons.length === 1 ? `Cadastrar o caminhão ${bons[0].placa}` : `Cadastrar ${bons.length} caminhões`, linhas, avisos, risco: "normal", args: { veiculos: bons } };
      },
      resumo: (a) => `Cadastrar caminhões: ${D().lista(a.veiculos.map((v) => v.placa), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const v of a.veiculos) itens.push(await tentar(v.placa, async () => { await ctx.repo.inserir("veiculos", v); }));
        return { ...relatorio(itens, "caminhão cadastrado", "caminhões cadastrados"), itens };
      },
    });

  escrever("editar_veiculos",
    "Muda caminhões que já existem: placa, tipo, marca, modelo, ano, cor, capacidade, observação, se está ativo, e ACRESCENTA fotos (anexos).",
    esq({ alteracoes: lista(esq({ veiculo: str("Placa ou id do caminhão"), placa: str("Nova placa"), tipo: str("Novo tipo", { enum: Object.keys(dom.TIPOS_VEICULO) }), marca: str("Marca"), modelo: str("Modelo"), ano: nmr("Ano"), cor: str("Cor"), capacidade_t: nmr("Capacidade em toneladas"), observacao: str("Observação"), ativo: bool("false desativa, true reativa"), adicionar_fotos: propFotos }, ["veiculo"]), "Quais caminhões mudar", 30) }, ["alteracoes"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.alteracoes); if (!entrada.length) throw new ErroProposta("Diga qual caminhão mudar e o quê.");
        const todos = await ctx.veiculos(true); const bons = [], fora = [], linhas = [];
        for (const alt of entrada) {
          const ref = U.txt(alt && alt.veiculo); const r = achar.veiculo(todos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const v = r.item; const campos = {}; const mud = [];
          try {
            if (!U.vazio(alt.placa)) { const pl = U.placaDe(alt.placa); if (!U.placaValida(pl)) throw new Error("placa inválida"); if (pl !== v.placa) { if (todos.some((x) => x.id !== v.id && x.placa === pl)) throw new Error("essa placa já é de outro caminhão"); campos.placa = pl; mud.push(`placa: ${v.placa} → ${pl}`); } }
            if (!U.vazio(alt.tipo)) { const t = dom.tipoVeiculoDe(alt.tipo); if (!t) throw new Error("tipo inválido"); if (t !== v.tipo) { campos.tipo = t; mud.push(`tipo: ${dom.TIPOS_VEICULO[v.tipo] || v.tipo} → ${dom.TIPOS_VEICULO[t]}`); } }
            for (const [k, rot] of [["marca", "marca"], ["modelo", "modelo"], ["cor", "cor"]]) if (alt[k] !== undefined && alt[k] !== null) { const x = U.vazio(alt[k]) ? null : U.txt(alt[k], 60); if (x !== (v[k] || null)) { campos[k] = x; mud.push(`${rot}: ${v[k] || "—"} → ${x || "—"}`); } }
            if (!U.vazio(alt.ano) || !U.vazio(alt.capacidade_t)) { const { ano, capacidade_t } = checarVeiculo(alt); if (ano !== null && ano !== (v.ano || null)) { campos.ano = ano; mud.push(`ano: ${v.ano || "—"} → ${ano}`); } if (capacidade_t !== null && capacidade_t !== (v.capacidade_t ? Number(v.capacidade_t) : null)) { campos.capacidade_t = capacidade_t; mud.push(`capacidade: ${v.capacidade_t || "—"} → ${U.fmt(capacidade_t)} t`); } }
            if (alt.observacao !== undefined && alt.observacao !== null) { const x = U.vazio(alt.observacao) ? null : U.txt(alt.observacao, 300); if (x !== (v.descricao || null)) { campos.descricao = x; mud.push(`observação: ${x || "—"}`); } }
            if (typeof alt.ativo === "boolean" && alt.ativo !== (v.ativo !== false)) { campos.ativo = alt.ativo; mud.push(alt.ativo ? "volta para a lista" : "sai da lista (o histórico fica)"); }
            const novas = fotosVeiculo(ctx, alt.adicionar_fotos); if (novas.length) { campos.fotos = [...(v.fotos || []), ...novas]; mud.push(`${U.plural(novas.length, "foto nova", "fotos novas")} (${U.fmt((v.fotos || []).length + novas.length)} no total)`); }
          } catch (er) { fora.push(`${v.placa}: ${er.message}`); continue; }
          if (!mud.length) { fora.push(`${v.placa}: já está assim, nada para mudar`); continue; }
          bons.push({ id: v.id, placa: v.placa, campos }); linhas.push(linha(v.placa)); mud.forEach((m) => linhas.push(linha(`    ${m}`)));
        }
        const avisos = fechar("a alteração", bons, fora);
        return { titulo: bons.length === 1 ? `Alterar o caminhão ${bons[0].placa}` : `Alterar ${bons.length} caminhões`, linhas, avisos, risco: "normal", args: { alteracoes: bons } };
      },
      resumo: (a) => `Alterar caminhões: ${D().lista(a.alteracoes.map((x) => `${x.placa} (${Object.keys(x.campos).join(", ")})`), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const x of a.alteracoes) itens.push(await tentar(x.placa, async () => { await ctx.repo.atualizar("veiculos", x.id, x.campos); }));
        return { ...relatorio(itens, "caminhão atualizado", "caminhões atualizados"), itens };
      },
    });

  escrever("apagar_veiculos",
    "APAGA caminhões de vez. Só funciona para caminhão sem nenhuma conferência. Com histórico, use editar_veiculos com ativo=false.",
    esq({ veiculos: lista(str("Placa ou id"), "Quais caminhões apagar", 30) }, ["veiculos"]),
    {
      async propor(ctx, e) {
        const refs = U.arr(e.veiculos); if (!refs.length) throw new ErroProposta("Diga qual caminhão apagar.");
        const todos = await ctx.veiculos(true); const bons = [], fora = [], linhas = [];
        for (const ref0 of refs) {
          const ref = U.txt(ref0); const r = achar.veiculo(todos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const v = r.item; const l = await ctx.repo.listar("conferencias", { selecao: "id", eq: { veiculo_id: v.id }, limite: 1 });
          if (l.length) { fora.push(`${v.placa}: já tem conferências registradas — apagar perderia o histórico. Posso só tirar da lista (desativar)`); continue; }
          bons.push({ id: v.id, placa: v.placa }); linhas.push(linha(`${v.placa}${v.modelo ? ` · ${v.modelo}` : ""}`));
        }
        const avisos = fechar("a exclusão", bons, fora); avisos.push("Apagar não tem volta.");
        return { titulo: bons.length === 1 ? `Apagar o caminhão ${bons[0].placa}` : `Apagar ${bons.length} caminhões`, linhas, avisos, risco: "alto", args: { veiculos: bons } };
      },
      resumo: (a) => `Apagar caminhões: ${D().lista(a.veiculos.map((v) => v.placa), 6)}`,
      async executar(ctx, a) {
        const itens = []; for (const v of a.veiculos) itens.push(await tentar(v.placa, async () => { await ctx.repo.apagar("veiculos", v.id); }));
        return { ...relatorio(itens, "caminhão apagado", "caminhões apagados"), itens };
      },
    });

  // ═════════════════════════ NOTAS ═════════════════════════
  const propItensNota = { type: "array", description: "Itens da nota", items: esq({ produto: str("Nome do produto como está na nota"), descricao: str("Descrição (se não houver 'produto')"), codigo: str("Código do produto na nota"), quantidade: nmr("Quantidade") }, ["quantidade"]) };
  escrever("lancar_notas",
    "Coloca uma ou várias notas fiscais na fila de conferência. Pode vir digitada (número, cliente, itens), de uma FOTO da nota (leia a imagem e preencha) ou de um XML anexado (use o campo 'anexo' com o id, ex.: a2: o servidor traz número, cliente, chave e itens do XML sem você copiar). Os itens são ligados aos produtos cadastrados pelo código ou nome.",
    esq({ cadastrar_produtos_faltantes: bool("true = cadastra sozinho os produtos que ainda não existem (como no XML do app)"), notas: lista(esq({ anexo: str("Id do anexo XML (a2…) para ler tudo dele"), numero: str("Número da nota"), cliente: str("Cliente"), vendedor: str("Vendedor"), chave_nfe: str("Chave de 44 dígitos"), itens: propItensNota }, []), "As notas", 40) }, ["notas"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.notas); if (!entrada.length) throw new ErroProposta("Diga o número da nota e os itens (ou anexe o XML/foto).");
        const produtos = await ctx.produtos(false); const faltantes = e.cadastrar_produtos_faltantes === true;
        const nums = entrada.map((n) => U.txt((n && n.numero) || "")).filter(Boolean); const jaTem = await ctx.notasPorNumero(nums.concat(entrada.filter((n) => n && n.anexo).map((n) => { try { return ctx.anexo(n.anexo, "xml").dados.numero; } catch { return ""; } }).filter(Boolean)));
        const igual = (x) => (/^\d+$/.test(x) ? String(Number(x)) : x);   // 048172 e 48172 são a mesma nota
        const vistos = new Set(jaTem.filter((n) => n.status !== "cancelada").map((n) => igual(n.numero))); const bons = [], fora = [], linhas = []; const semCadastro = new Set();
        entrada.forEach((n, i) => {
          try {
            const base = n.anexo ? ctx.anexo(n.anexo, "xml").dados : {};
            const numero = U.txt(U.vazio(n.numero) ? base.numero : n.numero, 20).replace(/^nota\s*/i, "").replace(/\s+/g, ""); if (!numero) throw new Error("falta o número da nota");
            const chaveNum = igual(numero); if (vistos.has(chaveNum)) throw new Error(`a nota ${numero} já está no sistema (ou repetida neste pedido)`);
            const itensBrutos = U.arr(n.itens && n.itens.length ? n.itens : base.itens); if (!itensBrutos.length) throw new Error("faltam os itens");
            const itens = itensBrutos.map((it, k) => {
              const desc = U.txt(it.descricao || it.produto || "", 200); const q = U.num(it.quantidade); if (!desc && U.vazio(it.codigo)) throw new Error(`o item ${k + 1} está sem nome`); if (!(q > 0)) throw new Error(`o item ${k + 1} (${desc || it.codigo}) está sem quantidade`);
              const m = D().casarProduto({ codigo: it.codigo, descricao: desc }, produtos); const prod = m.produto;
              if (!prod) semCadastro.add(desc);
              return { produto_id: prod ? prod.id : null, descricao: prod ? prod.nome : desc, codigo: U.vazio(it.codigo) ? null : U.txt(it.codigo, 40), quantidade: q };
            });
            let chave = U.vazio(n.chave_nfe) ? base.chave_nfe || "" : String(n.chave_nfe); chave = U.digitos(chave); if (chave && !D().validarChave(chave)) chave = "";
            vistos.add(chaveNum);
            const nota = { numero, cliente: U.vazio(n.cliente) ? U.txt(base.cliente || "", 120) : U.txt(n.cliente, 120), vendedor: U.vazio(n.vendedor) ? "" : U.txt(n.vendedor, 60), chave_nfe: chave, itens };
            bons.push(nota);
            linhas.push(linha(`Nota ${numero}${nota.cliente ? ` · ${nota.cliente}` : ""}${nota.vendedor ? ` · vendedor ${nota.vendedor}` : ""}`));
            itens.forEach((it) => linhas.push(linha(`    ${U.fmt(it.quantidade)} × ${it.descricao}${it.produto_id ? "" : "  (sem cadastro)"}`)));
          } catch (er) { fora.push(`${U.txt(n && n.numero) || `nota ${i + 1}`}: ${er.message}`); }
        });
        const avisos = fechar("a nota", bons, fora);
        if (semCadastro.size) avisos.push(faltantes ? `Vou cadastrar estes produtos que ainda não existem: ${D().lista([...semCadastro], 5)}.` : `Sem cadastro (entram só pelo nome, e o estoque dessas peças não é controlado): ${D().lista([...semCadastro], 5)}. Se quiser, peça para cadastrar os produtos que faltam.`);
        avisos.push("A nota entra na fila e os conferentes são avisados.");
        return { titulo: bons.length === 1 ? `Lançar a nota ${bons[0].numero}` : `Lançar ${bons.length} notas`, linhas, avisos, risco: "normal", args: { notas: bons, cadastrar_faltantes: faltantes } };
      },
      resumo: (a) => `Lançar ${U.plural(a.notas.length, "nota", "notas")}: ${D().lista(a.notas.map((n) => n.numero), 8)}`,
      async executar(ctx, a) {
        let produtos = await ctx.produtos(false, true);
        if (a.cadastrar_faltantes) {
          const nomes = new Set(); for (const n of a.notas) for (const it of n.itens) if (!it.produto_id) nomes.add(it.descricao);
          for (const nome of nomes) { try { await ctx.repo.inserir("produtos", { nome: U.tituloProduto(nome), unidade: "un", minimo: 0 }); } catch { /* já existe */ } }
          if (nomes.size) produtos = await ctx.produtos(false, true);
        }
        const itens = [];
        for (const n of a.notas) {
          itens.push(await tentar(`Nota ${n.numero}`, async () => {
            const its = n.itens.map((it) => { if (it.produto_id) return it; const m = D().casarProduto({ codigo: it.codigo, descricao: it.descricao }, produtos); return m.produto ? { ...it, produto_id: m.produto.id, descricao: m.produto.nome } : it; });
            await ctx.repo.rpc("criar_nota", { p: { numero: n.numero, cliente: n.cliente, vendedor: n.vendedor, chave_nfe: n.chave_nfe || null, itens: its.map((it) => ({ produto_id: it.produto_id || null, descricao: it.descricao, codigo: it.codigo || null, quantidade: it.quantidade })) } });
          }));
        }
        return { ...relatorio(itens, "nota na fila", "notas na fila", " Os conferentes já foram avisados."), itens, acoes: [{ rotulo: "Ver a fila de notas", rota: "notas", params: {} }] };
      },
    });

  escrever("cancelar_notas",
    "CANCELA notas que ainda estão na fila (pendentes ou em conferência). Nota já conferida não pode ser cancelada.",
    esq({ notas: lista(str("Número da nota"), "Quais notas cancelar", 30) }, ["notas"]),
    {
      async propor(ctx, e) {
        const refs = U.arr(e.notas); if (!refs.length) throw new ErroProposta("Diga qual nota cancelar.");
        const achadas = await ctx.notasPorNumero(refs.map((r) => U.txt(r).replace(/^nota\s*/i, ""))); const bons = [], fora = [], linhas = [];
        for (const ref0 of refs) {
          const ref = U.txt(ref0); const r = achar.nota(achadas.filter((n) => n.status !== "cancelada").concat(achadas.filter((n) => n.status === "cancelada")), ref); if (r.erro) { fora.push(`${ref}: ${r.erro}`); continue; }
          const n = r.item; if (n.status === "cancelada") { fora.push(`${n.numero}: já está cancelada`); continue; } if (n.status === "conferida") { fora.push(`${n.numero}: já foi conferida e não pode ser cancelada`); continue; }
          if (bons.some((b) => b.id === n.id)) continue;
          bons.push({ id: n.id, numero: n.numero }); linhas.push(linha(`Nota ${n.numero}${n.cliente ? ` · ${n.cliente}` : ""} (${D().plural((n.itens || []).length, "item", "itens")})`));
        }
        const avisos = fechar("o cancelamento", bons, fora); avisos.push("A nota sai da fila de conferência. Para ela voltar, é preciso lançar de novo.");
        return { titulo: bons.length === 1 ? `Cancelar a nota ${bons[0].numero}` : `Cancelar ${bons.length} notas`, linhas, avisos, risco: "alto", args: { notas: bons } };
      },
      resumo: (a) => `Cancelar notas: ${D().lista(a.notas.map((n) => n.numero), 8)}`,
      async executar(ctx, a) {
        const itens = []; for (const n of a.notas) itens.push(await tentar(`Nota ${n.numero}`, async () => { await ctx.repo.atualizar("notas", n.id, { status: "cancelada" }, { em: { status: ["pendente", "em_conferencia"] } }); }));
        return { ...relatorio(itens, "nota cancelada", "notas canceladas"), itens };
      },
    });

  // ═════════════════════════ CONFERÊNCIA DE CARGA ═════════════════════════
  escrever("conferir_carga",
    "Registra a conferência de UMA carga de uma nota que está na fila, como o conferente faz no app: placa, o que foi carregado e as fotos obrigatórias da CARGA e da PLACA (anexos). Se tudo bateu use todos_conforme=true; se algo diferiu, informe 'carregado' só para os itens que diferem e o motivo. NUNCA invente quantidades nem fotos: se faltar algo, pergunte à pessoa.",
    esq({ nota: str("Número da nota (na fila)"), placa: str("Placa do caminhão"), todos_conforme: bool("true = tudo o que está na nota foi carregado exatamente"), carregado: { type: "array", description: "O que foi carregado nos itens que NÃO batem (ou todos, se não usar todos_conforme)", items: esq({ item: str("Produto como aparece na nota, ou o número do item (1, 2…)"), quantidade: nmr("Quantidade carregada") }, ["item", "quantidade"]) }, motivo_divergencia: str("Motivo da diferença (obrigatório se houver)"), observacao: str("Observação"), motorista: str("Nome do motorista"), fotos: { type: "array", description: "Fotos anexadas e o que mostram. Precisa de pelo menos uma 'carga' e uma 'placa'.", items: esq({ anexo: str("Id do anexo, ex.: a1"), tipo: str("O que a foto mostra", { enum: ["carga", "placa", "nota", "avaria"] }) }, ["anexo", "tipo"]) } }, ["nota", "placa", "fotos"]),
    {
      async propor(ctx, e) {
        const numero = U.txt(e.nota).replace(/^nota\s*/i, ""); if (!numero) throw new ErroProposta("Diga o número da nota.");
        const achadas = await ctx.notasPorNumero([numero]); const r = achar.nota(achadas.filter((n) => n.status === "pendente" || n.status === "em_conferencia"), numero);
        if (r.erro) { const outra = achadas.find((n) => n.status === "conferida"); throw new ErroProposta(outra ? `A nota ${outra.numero} já foi conferida.` : `${r.erro} Só dá para conferir notas que estão na fila (use lancar_notas antes).`); }
        const nota = r.item; const placa = U.placaDe(e.placa); if (!U.placaValida(placa)) throw new ErroProposta("A placa precisa ter 7 letras e números (como ABC1D23). Pergunte a placa à pessoa.");
        const base = (nota.itens || []).map((i) => ({ produto_id: i.produto_id || null, descricao: i.descricao, qtd_nota: Number(i.quantidade), qtd_carregada: null }));
        const ajustados = new Set();
        for (const c of U.arr(e.carregado)) {
          const ref = U.txt(c && c.item); const q = U.num(c && c.quantidade); if (!ref) throw new ErroProposta("Informe qual item da nota foi carregado."); if (!(q >= 0)) throw new ErroProposta(`Quantidade inválida para "${ref}".`);
          let idx = -1; if (/^\d+$/.test(ref) && Number(ref) >= 1 && Number(ref) <= base.length) idx = Number(ref) - 1;
          else { const n = U.norm(ref); let ac = base.map((b, k) => k).filter((k) => U.norm(base[k].descricao) === n); if (!ac.length) ac = base.map((b, k) => k).filter((k) => U.norm(base[k].descricao).includes(n) || n.includes(U.norm(base[k].descricao))); if (ac.length > 1) throw new ErroProposta(`"${ref}" combina com mais de um item da nota (${ac.map((k) => base[k].descricao).join(", ")}). Seja mais específico.`); if (!ac.length) throw new ErroProposta(`Não achei "${ref}" entre os itens da nota ${nota.numero}: ${base.map((b) => b.descricao).join(", ")}.`); idx = ac[0]; }
          base[idx].qtd_carregada = q; ajustados.add(idx);
        }
        const faltam = base.filter((b, k) => b.qtd_carregada === null && !e.todos_conforme).map((b) => b.descricao);
        if (faltam.length) throw new ErroProposta(`Faltou dizer quanto foi carregado de: ${faltam.join(", ")}. Pergunte à pessoa (ou, se tudo bateu, use todos_conforme=true).`);
        base.forEach((b) => { if (b.qtd_carregada === null) b.qtd_carregada = b.qtd_nota; });
        const an = D().analisarItens(base); const motivo = U.vazio(e.motivo_divergencia) ? "" : U.txt(e.motivo_divergencia, 300);
        if (an.divergente && !motivo) throw new ErroProposta("Há diferença entre a nota e a carga: pergunte à pessoa o motivo e envie em motivo_divergencia.");
        const fotos = U.arr(e.fotos).map((f) => { const tipo = U.norm(f && f.tipo); if (!["carga", "placa", "nota", "avaria"].includes(tipo)) throw new ErroProposta("Tipo de foto inválido (carga, placa, nota ou avaria)."); return { tipo, caminho: ctx.anexo(f.anexo, "imagem").caminho }; });
        if (!fotos.some((f) => f.tipo === "carga") || !fotos.some((f) => f.tipo === "placa")) throw new ErroProposta("A conferência exige a foto da CARGA e a foto da PLACA. Peça à pessoa para anexar (botão do clipe) e diga qual é qual.");
        const veic = (await ctx.veiculos(true)).find((v) => v.placa === placa);
        const linhas = [linha(`Nota ${nota.numero}${nota.cliente ? ` · ${nota.cliente}` : ""}`), linha(`Caminhão ${placa}${veic ? ` (${[veic.marca, veic.modelo].filter(Boolean).join(" ") || "cadastrado"})` : " (não está no cadastro de caminhões)"}${U.vazio(e.motorista) ? "" : ` · motorista ${U.txt(e.motorista, 80)}`}`)];
        base.forEach((b) => { const dif = b.qtd_carregada - b.qtd_nota; linhas.push(linha(`    ${b.descricao}: nota ${U.fmt(b.qtd_nota)} → carregado ${U.fmt(b.qtd_carregada)}${dif === 0 ? "  ✔" : `  ⚠ ${dif > 0 ? "+" : "−"}${U.fmt(Math.abs(dif))}`}`)); });
        linhas.push(linha(`Fotos: ${D().lista(fotos.map((f) => f.tipo), 6)}`)); if (motivo) linhas.push(linha(`Motivo da diferença: ${motivo}`));
        const avisos = [an.divergente ? `HÁ DIFERENÇA: ${D().lista(an.itensDif.map((i) => `${i.descricao} ${i.dif > 0 ? "+" : "−"}${U.fmt(Math.abs(i.dif))}`), 6)}.` : "Tudo bate com a nota.", "A conferência não pode ser desfeita: fica registrada com as fotos e dá baixa no estoque. A administração recebe o aviso se houver diferença."];
        return { titulo: `Conferir a carga da nota ${nota.numero}`, linhas, avisos, risco: "alto", args: { nota_id: nota.id, numero_nota: nota.numero, cliente: nota.cliente || "", chave_nfe: nota.chave_nfe || "", placa, veiculo_id: veic ? veic.id : null, motorista: U.vazio(e.motorista) ? null : U.txt(e.motorista, 80), motivo_divergencia: motivo || null, observacao: U.vazio(e.observacao) ? null : U.txt(e.observacao, 300), itens: base, fotos } };
      },
      resumo: (a) => `Conferir a carga da nota ${a.numero_nota} (caminhão ${a.placa})${a.motivo_divergencia ? " com diferença" : ""}`,
      async executar(ctx, a, info) {
        const obs = ["Conferência feita por comando ao assistente.", a.observacao].filter(Boolean).join(" ");
        const id = await ctx.repo.rpc("registrar_conferencia", { p: { client_id: info.nonce, nota_id: a.nota_id, numero_nota: a.numero_nota, cliente: a.cliente, chave_nfe: a.chave_nfe || "", placa: a.placa, veiculo_id: a.veiculo_id, motorista: a.motorista, motivo_divergencia: a.motivo_divergencia, observacao: obs, metodo: "passo_a_passo", itens: a.itens, fotos: a.fotos } });
        const dif = a.itens.some((i) => Number(i.qtd_nota) !== Number(i.qtd_carregada));
        return { ok: true, texto: `Conferência da nota ${a.numero_nota} registrada${dif ? " COM diferença (os administradores foram avisados)" : ": tudo bateu"}.`, itens: [{ ok: true, texto: `Nota ${a.numero_nota}` }], acoes: [{ rotulo: "Ver as cargas conferidas", rota: "cargas", params: {} }], id };
      },
    });

  // ═════════════════════════ ESTOQUE ═════════════════════════
  escrever("lancar_movimentos",
    "Lança entradas (produção) ou perdas no estoque. Saída não se lança aqui: ela vem da conferência da carga.",
    esq({ movimentos: lista(esq({ produto: str("Nome, código ou id do produto"), tipo: str("entrada = entrou peça; perda = quebrou/descartou", { enum: ["entrada", "perda"] }), quantidade: nmr("Quantidade (maior que zero)"), motivo: str("Observação (opcional)") }, ["produto", "tipo", "quantidade"]), "Os lançamentos", 40) }, ["movimentos"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.movimentos); if (!entrada.length) throw new ErroProposta("Diga o produto, se foi entrada ou perda e quantas peças.");
        const produtos = await ctx.produtos(false); const saldos = new Map((await ctx.saldos()).map((s) => [s.produto_id, Number(s.saldo)])); const bons = [], fora = [], linhas = []; const avisos0 = [];
        for (const m of entrada) {
          const ref = U.txt(m && m.produto); const r = achar.produto(produtos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const tipo = U.norm(m.tipo); if (!["entrada", "perda"].includes(tipo)) { fora.push(`${r.item.nome}: só dá para lançar entrada ou perda (a saída vem da conferência)`); continue; }
          const q = U.num(m.quantidade); if (!(q > 0)) { fora.push(`${r.item.nome}: a quantidade precisa ser maior que zero`); continue; }
          const antes = saldos.has(r.item.id) ? saldos.get(r.item.id) : 0; const depois = antes + (tipo === "entrada" ? q : -q); saldos.set(r.item.id, depois);
          bons.push({ produto_id: r.item.id, nome: r.item.nome, tipo, quantidade: q, motivo: U.vazio(m.motivo) ? "" : U.txt(m.motivo, 200) });
          linhas.push(linha(`${tipo === "entrada" ? "Entrada" : "Perda"}: ${tipo === "entrada" ? "+" : "−"}${U.fmt(q)} ${r.item.nome}  (estoque ${U.fmt(antes)} → ${U.fmt(depois)})${U.vazio(m.motivo) ? "" : ` · ${U.txt(m.motivo, 80)}`}`));
          if (depois < 0) avisos0.push(`${r.item.nome} ficaria NEGATIVO (${U.fmt(depois)}).`);
        }
        const avisos = fechar("o lançamento", bons, fora).concat(avisos0); avisos.push("O lançamento fica registrado no histórico do estoque e não é apagado.");
        return { titulo: bons.length === 1 ? `${bons[0].tipo === "entrada" ? "Entrada" : "Perda"} de ${bons[0].nome}` : `Lançar ${bons.length} movimentos de estoque`, linhas, avisos, risco: "normal", args: { movimentos: bons } };
      },
      resumo: (a) => `Estoque: ${D().lista(a.movimentos.map((m) => `${m.tipo === "entrada" ? "+" : "−"}${m.quantidade} ${m.nome}`), 8)}`,
      async executar(ctx, a) {
        const itens = []; for (const m of a.movimentos) itens.push(await tentar(`${m.tipo === "entrada" ? "+" : "−"}${U.fmt(m.quantidade)} ${m.nome}`, async () => { await ctx.repo.rpc("registrar_movimento_manual", { p: { produto_id: m.produto_id, tipo: m.tipo, quantidade: m.quantidade, motivo: m.motivo } }); }));
        return { ...relatorio(itens, "lançamento feito", "lançamentos feitos"), itens, acoes: [{ rotulo: "Ver o estoque", rota: "estoque", params: {} }] };
      },
    });

  escrever("pedir_contagem",
    "Pede à equipe para contar produtos no pátio (eles recebem aviso no celular e contam sem ver o saldo do sistema).",
    esq({ produtos: lista(str("Nome, código ou id"), "Produtos a contar", 60), todos: bool("true = todos os produtos ativos"), escopo: str("Observação do pedido (opcional)") }),
    {
      async propor(ctx, e) {
        const ativos = await ctx.produtos(false); let bons = [], fora = [];
        if (e.todos === true) bons = ativos.map((p) => ({ produto_id: p.id, nome: p.nome }));
        else { const refs = U.arr(e.produtos); if (!refs.length) throw new ErroProposta("Diga quais produtos contar (ou todos)."); for (const ref0 of refs) { const ref = U.txt(ref0); const r = achar.produto(ativos, ref); if (r.erro) fora.push(`${ref || "?"}: ${r.erro}`); else if (!bons.some((b) => b.produto_id === r.item.id)) bons.push({ produto_id: r.item.id, nome: r.item.nome }); } }
        if (!bons.length) throw new ErroProposta(fora.length ? fora.join(" · ") : "Não há produtos para contar.");
        const avisos = fora.map((f) => `Ficou de fora — ${f}`); avisos.push("A equipe recebe aviso no celular. Você decide o ajuste quando a contagem chegar.");
        return { titulo: `Pedir contagem de ${bons.length === 1 ? bons[0].nome : `${bons.length} produtos`}`, linhas: bons.slice(0, 40).map((b) => linha(b.nome)).concat(bons.length > 40 ? [linha(`… e mais ${bons.length - 40}`)] : []), avisos, risco: "normal", args: { produtos: bons, escopo: U.vazio(e.escopo) ? "Pedido da administração" : U.txt(e.escopo, 120) } };
      },
      resumo: (a) => `Pedir contagem: ${D().lista(a.produtos.map((p) => p.nome), 6)}${a.produtos.length > 6 ? ` (${a.produtos.length} produtos)` : ""}`,
      async executar(ctx, a) {
        await ctx.repo.rpc("pedir_contagem", { p_produtos: a.produtos.map((p) => p.produto_id), p_escopo: a.escopo });
        return { ok: true, texto: `Contagem pedida: ${U.plural(a.produtos.length, "produto", "produtos")}. A equipe já foi avisada.`, itens: [{ ok: true, texto: "Contagem pedida" }], acoes: [{ rotulo: "Abrir o estoque", rota: "estoque", params: {} }] };
      },
    });

  escrever("registrar_contagem",
    "Registra uma contagem física feita agora (a pessoa disse quanto contou de cada produto). Se bater com o sistema, vira ajuste automático; se não bater, fica aguardando a decisão da administração.",
    esq({ itens: lista(esq({ produto: str("Nome, código ou id"), contado: nmr("Quantidade contada (0 ou mais)") }, ["produto", "contado"]), "O que foi contado", 60), responde_pedido: str("Id do pedido de contagem que está sendo respondido, ou 'pendente' se houver só um pedido aberto"), escopo: str("Observação (opcional)") }, ["itens"]),
    {
      async propor(ctx, e) {
        const entrada = U.arr(e.itens); if (!entrada.length) throw new ErroProposta("Diga quanto foi contado de cada produto.");
        const produtos = await ctx.produtos(false); const saldos = new Map((await ctx.saldos()).map((s) => [s.produto_id, Number(s.saldo)])); const bons = [], fora = [], linhas = []; let dif = 0;
        for (const it of entrada) {
          const ref = U.txt(it && it.produto); const r = achar.produto(produtos, ref); if (r.erro) { fora.push(`${ref || "?"}: ${r.erro}`); continue; }
          const c = U.num(it.contado); if (!(c >= 0)) { fora.push(`${r.item.nome}: quantidade contada inválida`); continue; }
          if (bons.some((b) => b.produto_id === r.item.id)) { fora.push(`${r.item.nome}: apareceu duas vezes`); continue; }
          const esp = saldos.has(r.item.id) ? saldos.get(r.item.id) : 0; const d = c - esp; if (d !== 0) dif++;
          bons.push({ produto_id: r.item.id, nome: r.item.nome, contado: c }); linhas.push(linha(`${r.item.nome}: contado ${U.fmt(c)} · sistema ${U.fmt(esp)} ${d === 0 ? " ✔" : ` ⚠ ${d > 0 ? "+" : "−"}${U.fmt(Math.abs(d))}`}`));
        }
        const avisos = fechar("a contagem", bons, fora); let solicitacao = null;
        if (!U.vazio(e.responde_pedido)) {
          const abertas = (await ctx.contagens()).filter((c) => c.status === "solicitada"); const ref = U.txt(e.responde_pedido);
          const c = ref === "pendente" ? (abertas.length === 1 ? abertas[0] : null) : abertas.find((x) => x.id === ref);
          if (!c) throw new ErroProposta(ref === "pendente" ? `Há ${abertas.length} pedidos de contagem abertos: use a ferramenta contagens e indique o id.` : "Não achei esse pedido de contagem aberto.");
          solicitacao = c.id; avisos.push("Responde ao pedido de contagem que está aberto.");
        }
        avisos.push(dif ? `${U.plural(dif, "produto não bate", "produtos não batem")} com o sistema: a contagem fica aguardando a decisão do ajuste.` : "Tudo bate com o sistema.");
        return { titulo: `Registrar contagem de ${bons.length === 1 ? bons[0].nome : `${bons.length} produtos`}`, linhas, avisos, risco: "normal", args: { itens: bons, solicitacao_id: solicitacao, escopo: U.vazio(e.escopo) ? null : U.txt(e.escopo, 120) } };
      },
      resumo: (a) => `Registrar contagem: ${D().lista(a.itens.map((i) => `${i.nome} ${i.contado}`), 6)}`,
      async executar(ctx, a) {
        const r = await ctx.repo.rpc("concluir_contagem", { p: { itens: a.itens.map((i) => ({ produto_id: i.produto_id, contado: i.contado })), solicitacao_id: a.solicitacao_id, escopo: a.escopo } });
        const aguardando = r && r.status === "aguardando_aprovacao";
        return { ok: true, texto: aguardando ? "Contagem registrada, mas há diferença: ela aguarda a sua decisão (aplicar o ajuste ou contar de novo)." : "Contagem registrada: bateu com o sistema.", itens: [{ ok: true, texto: "Contagem registrada" }], acoes: [{ rotulo: "Abrir o estoque", rota: "estoque", params: {} }] };
      },
    });

  escrever("decidir_contagem",
    "Decide o que fazer com uma contagem que não bateu (status aguardando_aprovacao): aplicar = corrigir o estoque para o número contado; descartar = ignorar; recontar = descartar e pedir contagem de novo dos produtos com diferença.",
    esq({ contagem: str("Id da contagem (veja a ferramenta contagens). Pode omitir se houver só uma aguardando."), decisao: str("aplicar, descartar ou recontar", { enum: ["aplicar", "descartar", "recontar"] }) }, ["decisao"]),
    {
      async propor(ctx, e) {
        const decisao = U.norm(e.decisao); if (!["aplicar", "descartar", "recontar"].includes(decisao)) throw new ErroProposta("A decisão é aplicar, descartar ou recontar.");
        const todas = await ctx.contagens(); let c;
        if (U.vazio(e.contagem)) { const aguardando = todas.filter((x) => x.status === "aguardando_aprovacao"); if (aguardando.length !== 1) throw new ErroProposta(aguardando.length ? `Há ${aguardando.length} contagens aguardando decisão: use a ferramenta contagens e indique o id.` : "Não há contagem aguardando decisão."); c = aguardando[0]; } else c = todas.find((x) => x.id === U.txt(e.contagem));
        if (!c) throw new ErroProposta("Não achei essa contagem.");
        if (decisao === "aplicar" || decisao === "recontar") { if (c.status !== "aguardando_aprovacao") throw new ErroProposta("Essa contagem já foi resolvida."); } else if (!["aguardando_aprovacao", "solicitada"].includes(c.status)) throw new ErroProposta("Essa contagem já foi resolvida.");
        const produtos = await ctx.produtos(true); const nome = (id) => (produtos.find((p) => p.id === id) || {}).nome || "Produto";
        const difs = (c.itens || []).filter((i) => Number(i.diferenca) !== 0 && i.diferenca !== null);
        const linhas = (difs.length ? difs : c.itens || []).map((i) => linha(`${nome(i.produto_id)}: sistema ${i.esperado === null ? "—" : U.fmt(i.esperado)} → contado ${i.contado === null ? "—" : U.fmt(i.contado)}`));
        const txt = { aplicar: "Corrigir o estoque para o número contado", descartar: "Descartar a contagem (o estoque não muda)", recontar: "Pedir para contar de novo" }[decisao];
        const avisos = decisao === "aplicar" ? ["O saldo do estoque passa a valer o número contado. Isso fica registrado e não é apagado."] : decisao === "recontar" ? ["A equipe recebe aviso para contar de novo estes produtos."] : [];
        return { titulo: txt, linhas, avisos, risco: decisao === "aplicar" ? "alto" : "normal", args: { contagem_id: c.id, decisao, produtos: (difs.length ? difs : c.itens || []).map((i) => i.produto_id) } };
      },
      resumo: (a) => `Contagem: ${a.decisao}`,
      async executar(ctx, a) {
        if (a.decisao === "aplicar") await ctx.repo.rpc("aplicar_ajuste_contagem", { p_id: a.contagem_id });
        else if (a.decisao === "descartar") await ctx.repo.rpc("descartar_contagem", { p_id: a.contagem_id });
        else { await ctx.repo.rpc("descartar_contagem", { p_id: a.contagem_id }); await ctx.repo.rpc("pedir_contagem", { p_produtos: a.produtos, p_escopo: "Nova contagem pedida pela administração" }); }
        return { ok: true, texto: { aplicar: "Estoque corrigido: o saldo agora é o que a equipe contou.", descartar: "Contagem descartada.", recontar: "Nova contagem pedida: a equipe foi avisada." }[a.decisao], itens: [{ ok: true, texto: "Feito" }], acoes: [{ rotulo: "Abrir o estoque", rota: "estoque", params: {} }] };
      },
    });

  // ═════════════════════════ AVISOS E AJUSTES ═════════════════════════
  escrever("marcar_avisos",
    "Marca avisos (sino) como lidos ou como resolvidos. Use todos=true para marcar todos os não lidos.",
    esq({ ids: lista(str("Id do aviso"), "Avisos (ids da ferramenta avisos)", 60), todos: bool("true = todos os não lidos"), resolver: bool("true = resolver (some da lista) em vez de só marcar como lido") }),
    {
      async propor(ctx, e) {
        const meus = await ctx.alertas({ soNaoLidos: false }); let alvo;
        if (e.todos === true) { alvo = meus.filter((a) => !a.lido_em); if (!alvo.length && !e.resolver) throw new ErroProposta("Não há avisos não lidos."); if (e.resolver) alvo = meus; }
        else { const ids = U.arr(e.ids).map((x) => U.txt(x)); if (!ids.length) throw new ErroProposta("Diga quais avisos (ou todos)."); alvo = meus.filter((a) => ids.includes(a.id)); if (!alvo.length) throw new ErroProposta("Não achei esses avisos entre os seus."); }
        if (!alvo.length) throw new ErroProposta("Não há avisos para isso.");
        return { titulo: e.resolver ? `Resolver ${U.plural(alvo.length, "aviso", "avisos")}` : `Marcar ${U.plural(alvo.length, "aviso", "avisos")} como lido`, linhas: alvo.slice(0, 12).map((a) => linha(a.titulo)).concat(alvo.length > 12 ? [linha(`… e mais ${alvo.length - 12}`)] : []), avisos: [], risco: "normal", args: { ids: alvo.map((a) => a.id), resolver: !!e.resolver, todos: e.todos === true && !e.resolver } };
      },
      resumo: (a) => `${a.resolver ? "Resolver" : "Marcar como lido"} ${U.plural(a.ids.length, "aviso", "avisos")}`,
      async executar(ctx, a) {
        if (a.resolver) { for (const id of a.ids) await ctx.repo.rpc("resolver_alerta", { p_id: id }); } else await ctx.repo.rpc("marcar_alertas_lidos", { p_ids: a.todos ? null : a.ids });
        return { ok: true, texto: a.resolver ? "Avisos resolvidos." : "Avisos marcados como lidos.", itens: [{ ok: true, texto: "Feito" }] };
      },
    });

  escrever("preferencias_avisos",
    "Escolhe QUAIS avisos a própria pessoa recebe. Pode trocar a lista toda (tipos) ou só acrescentar/tirar alguns (adicionar/remover). Tipos: " + Object.keys(raiz.NEDominio ? raiz.NEDominio.TIPOS_ALERTA : {}).join(", "),
    esq({ tipos: lista(str("Tipo de aviso"), "Lista completa", 20), adicionar: lista(str("Tipo de aviso"), "Tipos a acrescentar", 20), remover: lista(str("Tipo de aviso"), "Tipos a tirar", 20) }),
    {
      async propor(ctx, e) {
        const T = D().TIPOS_ALERTA; const valida = (l) => { const ruim = U.arr(l).filter((t) => !T[t]); if (ruim.length) throw new ErroProposta(`Tipo de aviso desconhecido: ${ruim.join(", ")}. Os tipos são: ${Object.keys(T).join(", ")}.`); return U.arr(l); };
        const atual = ctx.eu.alertas || D().alertasPadrao(ctx.eu.papel); let novo;
        if (U.arr(e.tipos).length) novo = [...new Set(valida(e.tipos))]; else { novo = new Set(atual); valida(e.adicionar).forEach((t) => novo.add(t)); valida(e.remover).forEach((t) => novo.delete(t)); novo = [...novo]; }
        if (novo.length === atual.length && novo.every((t) => atual.includes(t))) throw new ErroProposta("Os avisos já estão assim.");
        const rot = (t) => T[t].rotulo;
        return { titulo: "Mudar os avisos que você recebe", linhas: [linha(`Passa a receber: ${novo.length ? D().lista(novo.map(rot), 12) : "nenhum aviso"}`), ...atual.filter((t) => !novo.includes(t)).map((t) => linha(`    deixa de receber: ${rot(t)}`)), ...novo.filter((t) => !atual.includes(t)).map((t) => linha(`    passa a receber: ${rot(t)}`))], avisos: [], risco: "normal", args: { alertas: novo } };
      },
      resumo: (a) => `Avisos que recebe: ${a.alertas.length} tipos`,
      async executar(ctx, a) { await ctx.repo.rpc("salvar_preferencias", { p_alertas: a.alertas }); return { ok: true, texto: "Pronto: os avisos que você recebe foram atualizados.", itens: [{ ok: true, texto: "Feito" }] }; },
    });

  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const diaDe = (v) => { if (typeof v === "number" && v >= 0 && v <= 6) return Math.round(v); const n = U.norm(v).replace(/ feira$/, ""); const i = DIAS.findIndex((d) => U.norm(d) === n); if (i >= 0) return i; if (/^[0-6]$/.test(String(v))) return Number(v); throw new ErroProposta(`Dia inválido: "${v}". Use domingo…sábado ou 0 a 6.`); };
  escrever("salvar_ajustes",
    "Muda os ajustes dos avisos da empresa: dias e horário de trabalho, minutos para a nota ser considerada parada, dias sem contar o estoque e a hora do resumo diário. Só o que for informado muda.",
    esq({ dias_de_trabalho: { type: "array", items: { type: "string" }, description: "Dias em que a empresa trabalha: domingo, segunda, terça, quarta, quinta, sexta, sábado" }, inicio: str("Hora de começar (HH:MM)"), fim: str("Hora de terminar (HH:MM)"), nota_parada_minutos: nmr("Minutos na fila para avisar nota parada (mínimo 10)"), dias_sem_contar: nmr("Dias sem contar um produto para avisar (mínimo 1)"), resumo_diario_hora: str("Hora do resumo diário (HH:MM)") }),
    {
      async propor(ctx, e) {
        const atual = D().comPadrao(await ctx.config()); const novo = JSON.parse(JSON.stringify(atual)); const linhas = [];
        if (U.arr(e.dias_de_trabalho).length) { novo.expediente.dias = [...new Set(U.arr(e.dias_de_trabalho).map(diaDe))].sort(); linhas.push(linha(`Dias de trabalho: ${atual.expediente.dias.map((d) => DIAS[d]).join(", ")} → ${novo.expediente.dias.map((d) => DIAS[d]).join(", ")}`)); }
        for (const [k, campo, rot] of [["inicio", "inicio", "Começa"], ["fim", "fim", "Termina"]]) if (!U.vazio(e[k])) { const h = U.txt(e[k]); if (!HORA.test(h)) throw new ErroProposta(`${rot}: use o formato HH:MM.`); novo.expediente[campo] = hora2(h); linhas.push(linha(`${rot}: ${atual.expediente[campo]} → ${novo.expediente[campo]}`)); }
        if (!U.vazio(e.nota_parada_minutos)) { const v = Math.round(U.num(e.nota_parada_minutos)); if (!(v >= 10 && v <= 10080)) throw new ErroProposta("Minutos para nota parada: entre 10 e 10080."); novo.limiteNotaParadaMin = v; linhas.push(linha(`Nota parada após: ${atual.limiteNotaParadaMin} min → ${v} min`)); }
        if (!U.vazio(e.dias_sem_contar)) { const v = Math.round(U.num(e.dias_sem_contar)); if (!(v >= 1 && v <= 365)) throw new ErroProposta("Dias sem contar: entre 1 e 365."); novo.diasContagem = v; linhas.push(linha(`Produto sem contar após: ${atual.diasContagem} dias → ${v} dias`)); }
        if (!U.vazio(e.resumo_diario_hora)) { const h = U.txt(e.resumo_diario_hora); if (!HORA.test(h)) throw new ErroProposta("Hora do resumo: use o formato HH:MM."); novo.resumoDiarioHora = hora2(h); linhas.push(linha(`Resumo diário: ${atual.resumoDiarioHora} → ${novo.resumoDiarioHora}`)); }
        if (!linhas.length) throw new ErroProposta("Diga o que mudar nos ajustes.");
        if (novo.expediente.dias.length === 0) throw new ErroProposta("Escolha pelo menos um dia de trabalho.");
        return { titulo: "Mudar os ajustes dos avisos", linhas, avisos: ["O app passa a usar os novos horários e prazos na hora."], risco: "normal", args: { config: novo } };
      },
      resumo: () => "Mudar os ajustes dos avisos",
      async executar(ctx, a) { await ctx.repo.upsert("configuracoes", { id: 1, valor: a.config }); return { ok: true, texto: "Ajustes salvos: o app já usa os novos horários e prazos.", itens: [{ ok: true, texto: "Feito" }] }; },
    });

  if (typeof module !== "undefined" && module.exports) module.exports = raiz.NEFerramentas;
})(typeof window !== "undefined" ? window : globalThis);
