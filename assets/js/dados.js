// Camada de dados. Uma interface (NE.dados), duas implementações:
//  - real: Supabase (Auth + Postgres com RLS + Storage privado + funções no servidor)
//  - teste: ambiente local do login admin/admin (teste-local.js), isolado do banco de verdade
// As telas nunca sabem qual está ativa.
(() => {
  const NE = window.NE;
  const C = window.NOVA_ERA || {};
  const D = window.NEDominio;
  const FLAG_TESTE = "ne-modo-teste";
  const emailDe = (usuario) => (usuario.includes("@") ? usuario.trim() : `${usuario.trim().toLowerCase()}@func.novaera.app`);
  const ehRede = (e) => /Failed to fetch|NetworkError|network|Load failed|fetch/i.test(String(e?.message || e));

  // ───────────────────────── fila offline (IndexedDB) ─────────────────────────
  // Conferência feita sem sinal fica guardada no aparelho (com as fotos) e sobe sozinha quando a internet volta.
  const fila = (() => {
    const abrir = () => new Promise((ok, falha) => {
      const r = indexedDB.open("confere-carga", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("fila", { keyPath: "client_id" });
      r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error);
    });
    const tx = async (modo, fn) => { const db = await abrir(); return new Promise((ok, falha) => { const t = db.transaction("fila", modo); const out = fn(t.objectStore("fila")); t.oncomplete = () => ok(out.result); t.onerror = () => falha(t.error); }); };
    return {
      guardar: (item) => tx("readwrite", (s) => s.put(item)),
      remover: (id) => tx("readwrite", (s) => s.delete(id)),
      todos: () => tx("readonly", (s) => s.getAll()).catch(() => []),
    };
  })();

  // ───────────────────────── REAL ─────────────────────────
  function real() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    const cacheUrl = new Map();
    const mem = new Map();
    const cache = {
      ler(k) { if (mem.has(k)) return mem.get(k); const v = NE.memoria.ler(`ne-c-${k}`); if (v) mem.set(k, v); return v; },
      gravar(k, v) { mem.set(k, v); NE.memoria.gravar(`ne-c-${k}`, v); return v; },
      limpar() { mem.clear(); try { Object.keys(localStorage).filter((k) => k.startsWith("ne-c-")).forEach((k) => localStorage.removeItem(k)); } catch { /* ok */ } },
    };
    let meuId = null;
    const buscarPerfil = async (id) => { const { data } = await sb.from("perfis").select("*").eq("id", id).maybeSingle(); if (data) cache.gravar("perfil", data); return data; };
    const funcao = async (nome, body) => {
      const { data, error } = await sb.functions.invoke(nome, { body });
      if (error) { let m = error.message; try { m = (await error.context.json()).erro || m; } catch { /* mantém */ } throw new Error(m); }
      return data;
    };
    const SEL_CONF = "*, conferente:perfis(nome), itens:conferencia_itens(*), fotos:conferencia_fotos(*)";
    const enviarFotoReal = async (blob, idPerfil) => {
      const caminho = `${idPerfil}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
      ok(await sb.storage.from(C.bucketFotos).upload(caminho, blob, { contentType: "image/jpeg", upsert: false }));
      return caminho;
    };
    const subirConferencia = async (item) => {
      const fotos = [];
      for (const f of item.fotos) fotos.push({ tipo: f.tipo, caminho: f.caminho || await enviarFotoReal(f.blob, item.perfil_id) });
      const { perfil_id, ...resto } = item; // eslint-disable-line no-unused-vars
      return ok(await sb.rpc("registrar_conferencia", { p: { ...resto, fotos } }));
    };
    const api = {
      modoTeste: false,
      emCache: (k) => cache.ler(k),
      async entrar(usuario, senha) {
        const { error } = await sb.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
        if (error) throw new Error("Usuário ou senha incorretos.");
      },
      async sair() { cache.limpar(); await sb.auth.signOut(); },
      async perfil() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null; meuId = session.user.id;
        const guardado = cache.ler("perfil");
        if (guardado?.id === meuId) { buscarPerfil(meuId).catch(() => {}); return guardado; }
        return buscarPerfil(meuId);
      },
      veiculos: async (todos = false) => cache.gravar(todos ? "veiculos-todos" : "veiculos", ok(await (todos ? sb.from("veiculos").select("*") : sb.from("veiculos").select("*").eq("ativo", true)).order("placa"))),
      produtos: async (todos = false) => cache.gravar(todos ? "produtos-todos" : "produtos", ok(await (todos ? sb.from("produtos").select("*") : sb.from("produtos").select("*").eq("ativo", true)).order("nome"))),
      funcionarios: async () => cache.gravar("funcionarios", ok(await sb.from("perfis").select("*").order("nome"))),
      criarFuncionario: (d) => funcao("criar-funcionario", d),
      criarFuncionarios: async (lista) => (await funcao("criar-funcionario", { lote: lista })).resultados,
      redefinirSenha: (id, senha) => funcao("criar-funcionario", { acao: "redefinir", id, senha }),
      alterarFuncionario: async (id, campos) => ok(await sb.from("perfis").update(campos).eq("id", id)),
      criarVeiculo: async (v) => ok(await sb.from("veiculos").insert(v)),
      alterarVeiculo: async (id, c) => ok(await sb.from("veiculos").update(c).eq("id", id)),
      criarProduto: async (p) => ok(await sb.from("produtos").insert(p)),
      alterarProduto: async (id, c) => ok(await sb.from("produtos").update(c).eq("id", id)),

      async notas({ status } = {}) {
        let q = sb.from("notas").select("*, itens:nota_itens(*)").order("criado_em", { ascending: true }).limit(300);
        if (status) q = Array.isArray(status) ? q.in("status", status) : q.eq("status", status);
        return cache.gravar(`notas-${[].concat(status || "todas").join("+")}`, ok(await q));
      },
      criarNota: async (n) => ok(await sb.rpc("criar_nota", { p: n })),
      importarNotas: async (lista) => { const out = []; for (const n of lista) { try { out.push({ ok: true, nota: await api.criarNota(n) }); } catch (er) { out.push({ ok: false, numero: n.numero, erro: er.message }); } } return out; },
      cancelarNota: async (id) => ok(await sb.from("notas").update({ status: "cancelada" }).eq("id", id).neq("status", "conferida")),

      enviarFoto: (blob, idPerfil) => enviarFotoReal(blob, idPerfil),
      async urlFoto(caminho) {
        const c = cacheUrl.get(caminho); if (c && c.expira > Date.now()) return c.url;
        const { data } = await sb.storage.from(C.bucketFotos).createSignedUrl(caminho, 600);
        if (data) cacheUrl.set(caminho, { url: data.signedUrl, expira: Date.now() + 540e3 });
        return data?.signedUrl || "";
      },
      // Tenta enviar agora; sem sinal, guarda no aparelho e devolve { pendente: true }
      async registrarConferencia(d) {
        const item = { ...d, client_id: d.client_id || crypto.randomUUID(), perfil_id: meuId };
        try { return await subirConferencia(item); }
        catch (er) {
          if (!ehRede(er)) throw er;
          await fila.guardar(item); api.aoMudarFila?.(); return { pendente: true, client_id: item.client_id };
        }
      },
      async sincronizar() {
        let enviadas = 0;
        for (const item of await fila.todos()) { try { await subirConferencia(item); await fila.remover(item.client_id); enviadas++; } catch (er) { if (ehRede(er)) break; if (!/já foi conferida/i.test(er.message)) { console.warn("Conferência da fila recusada", er.message); } await fila.remover(item.client_id); } }
        api.aoMudarFila?.(); return enviadas;
      },
      pendentes: async () => (await fila.todos()).length,
      async conferencias({ dia, somenteMinhas, idPerfil, de, ate } = {}) {
        const ini = dia ? new Date(`${dia}T00:00:00`) : new Date(de ?? 0); const fim = dia ? new Date(ini.getTime() + 864e5) : new Date(ate ?? Date.now() + 864e5);
        let q = sb.from("conferencias").select(SEL_CONF).gte("criado_em", ini.toISOString()).lt("criado_em", fim.toISOString()).order("criado_em", { ascending: false }).limit(1000);
        if (somenteMinhas) q = q.eq("conferente_id", idPerfil);
        return cache.gravar(dia ? `conf-${dia}-${somenteMinhas ? "minhas" : "todas"}` : "conf-periodo", ok(await q));
      },
      async contexto() {
        const agora = Date.now(); const desde = new Date(agora - 31 * D.DIA).toISOString();
        const [conferencias, notas, saldos, movimentos, contagens, config] = await Promise.all([
          sb.from("conferencias").select(SEL_CONF).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(2000).then(ok),
          sb.from("notas").select("*, itens:nota_itens(*)").in("status", ["pendente", "em_conferencia"]).then(ok),
          api.saldos(),
          sb.from("estoque_movimentos").select("*").gte("criado_em", desde).limit(5000).then(ok),
          api.contagens(), api.config(),
        ]);
        return { agora, config, conferencias, notas, saldos, movimentos, contagens };
      },

      saldos: async () => ok(await sb.from("estoque_saldos").select("*")),
      movimentos: async ({ produto_id, limite = 60 } = {}) => { let q = sb.from("estoque_movimentos").select("*").order("criado_em", { ascending: false }).limit(limite); if (produto_id) q = q.eq("produto_id", produto_id); return ok(await q); },
      lancarMovimento: async (m) => ok(await sb.rpc("registrar_movimento_manual", { p: m })),
      contagens: async () => ok(await sb.from("contagens").select("*, itens:contagem_itens(*)").order("criado_em", { ascending: false }).limit(60)),
      pedirContagem: async (ids, escopo) => ok(await sb.rpc("pedir_contagem", { p_produtos: ids, p_escopo: escopo || "Pedido da expedição" })),
      concluirContagem: async (p) => ok(await sb.rpc("concluir_contagem", { p })),
      aplicarAjuste: async (id) => ok(await sb.rpc("aplicar_ajuste_contagem", { p_id: id })),
      descartarContagem: async (id) => ok(await sb.rpc("descartar_contagem", { p_id: id })),

      async alertas({ soNaoLidos = false, limite = 80 } = {}) {
        let q = sb.from("alertas").select("*").eq("destinatario_id", meuId).is("resolvido_em", null).order("criado_em", { ascending: false }).limit(limite);
        if (soNaoLidos) q = q.is("lido_em", null);
        return cache.gravar("alertas", ok(await q));
      },
      marcarLidos: async (ids) => ok(await sb.rpc("marcar_alertas_lidos", { p_ids: ids === "todos" ? null : ids })),
      resolverAlerta: async (id) => ok(await sb.rpc("resolver_alerta", { p_id: id })),
      async preferencias() { const p = await api.perfil(); return p.alertas || D.alertasPadrao(p.papel); },
      salvarPreferencias: async (lista) => ok(await sb.rpc("salvar_preferencias", { p_alertas: lista })),
      async config() { const { data } = await sb.from("configuracoes").select("valor").eq("id", 1).maybeSingle(); return D.comPadrao(data?.valor); },
      salvarConfig: async (c) => ok(await sb.from("configuracoes").upsert({ id: 1, valor: c })),

      pushSuportado: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
      async pushAssinar() {
        if (!api.pushSuportado()) throw new Error("Este aparelho não aceita avisos com o app fechado.");
        if ((await Notification.requestPermission()) !== "granted") throw new Error("Você não permitiu os avisos. Libere nas configurações do navegador.");
        const reg = await navigator.serviceWorker.ready; const { chave } = await funcao("push", { acao: "chave" });
        const bin = atob(chave.replace(/-/g, "+").replace(/_/g, "/")); const chaveBytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes });
        await funcao("push", { acao: "assinar", assinatura: sub.toJSON(), aparelho: navigator.userAgent.slice(0, 120) });
      },
      async pushRemover() { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await funcao("push", { acao: "remover", endpoint: sub.endpoint }); await sub.unsubscribe(); } },
      pushTestar: () => funcao("push", { acao: "testar" }),

      iaDisponivel: async () => { try { return await funcao("assistente", { acao: "status" }); } catch { return { ativo: false }; } },
      iaPerguntar: (pergunta, historico) => funcao("assistente", { acao: "perguntar", pergunta, historico }),
      async iaLerNota(blob) {
        const base64 = await new Promise((res) => { const l = new FileReader(); l.onload = () => res(String(l.result).split(",")[1]); l.readAsDataURL(blob); });
        return funcao("assistente", { acao: "ler_nota", imagem: base64 });
      },
    };
    window.addEventListener("online", () => api.sincronizar().catch(() => {}));
    return api;
  }

  // ───────────────────────── escolha da implementação ─────────────────────────
  let ativa = null; let tentouTeste = false;
  const testeAtivo = () => { try { return localStorage.getItem(FLAG_TESTE) === "1"; } catch { return false; } };
  const ligar = () => {
    if (ativa) return ativa;
    if (C.modoTeste && testeAtivo()) { ativa = NE.criarTeste(); NE.modoTeste = true; }
    else { ativa = real(); NE.modoTeste = false; }
    return ativa;
  };
  const trocarPara = (teste) => {
    try { teste ? localStorage.setItem(FLAG_TESTE, "1") : localStorage.removeItem(FLAG_TESTE); } catch { /* sem armazenamento: vale só nesta página */ }
    ativa = null; tentouTeste = teste; ligar();
  };

  const USUARIOS_TESTE = ["admin", "adminvendas", "adminexpedicao", "admindiretoria", "adminadministrativo", "conferente", "ajudante", "motorista"];
  const nomes = ["emCache", "perfil", "veiculos", "produtos", "funcionarios", "criarFuncionario", "criarFuncionarios", "redefinirSenha", "alterarFuncionario", "criarVeiculo", "alterarVeiculo", "criarProduto", "alterarProduto",
    "notas", "criarNota", "importarNotas", "cancelarNota", "enviarFoto", "urlFoto", "fotoExemplo", "registrarConferencia", "sincronizar", "pendentes", "conferencias", "contexto",
    "saldos", "movimentos", "lancarMovimento", "contagens", "pedirContagem", "concluirContagem", "aplicarAjuste", "descartarContagem", "alertas", "marcarLidos", "resolverAlerta", "preferencias", "salvarPreferencias", "config", "salvarConfig",
    "pushSuportado", "pushAssinar", "pushRemover", "pushTestar", "iaDisponivel", "iaPerguntar", "iaLerNota", "trocarPerfil", "reiniciar"];
  const dados = {
    get modoTeste() { return !!ligar().modoTeste; },
    // login: admin/admin abre o ambiente de teste (se estiver ligado em config.js); qualquer outro usuário vai ao banco de verdade
    async entrar(usuario, senha) {
      if (C.modoTeste && senha === "admin" && USUARIOS_TESTE.includes(usuario.trim().toLowerCase())) { trocarPara(true); return ligar().entrar(usuario); }
      trocarPara(false); return ligar().entrar(usuario, senha);
    },
    async sair() { const a = ligar(); await a.sair(); if (a.modoTeste) trocarPara(false); },
  };
  for (const n of nomes) dados[n] = (...a) => { const f = ligar()[n]; if (!f) { if (n === "sincronizar" || n === "pendentes") return Promise.resolve(0); throw new Error("Isto não está disponível aqui."); } return f.apply(ligar(), a); };
  Object.defineProperty(dados, "aoMudarFila", { get: () => ligar().aoMudarFila, set: (f) => { ligar().aoMudarFila = f; } });
  void tentouTeste;

  NE.dados = dados;
  Object.defineProperty(NE, "modoTeste", { get: () => !!ligar().modoTeste, set() {}, configurable: true });
  NE.tiposVeiculo = { caminhao: "Caminhão", truck_munck: "Truck com munck", betoneira: "Betoneira", basculante: "Basculante", outro: "Outro" };
  NE.funcoes = { conferente: "Conferente", expedicao: "Expedição", vendedor: "Vendedor", motorista: "Motorista", ajudante: "Ajudante", diretoria: "Diretoria", administrativo: "Administrativo" };
})();
