// Camada de dados. Dois modos com a mesma interface:
//  - real: Supabase (Auth + Postgres com RLS + Storage privado)
//  - demonstração: dados de exemplo na memória (para apresentar sem login e sem gravar nada)
(() => {
  const NE = window.NE;
  const C = window.NOVA_ERA || {};
  const params = new URLSearchParams(location.search);
  const modoDemo = C.demo === true || params.has("demo") || !window.supabase;
  NE.modoDemo = modoDemo;

  const emailDe = (usuario) => (usuario.includes("@") ? usuario.trim() : `${usuario.trim().toLowerCase()}@func.novaera.app`);

  // ───────────────────────── MODO REAL ─────────────────────────
  function real() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    const cacheUrl = new Map();
    // Memória local: as telas abrem na hora com o último dado e atualizam quando a internet responde.
    const mem = new Map();
    const cache = {
      ler(k) { if (mem.has(k)) return mem.get(k); const v = NE.memoria.ler(`ne-c-${k}`); if (v) mem.set(k, v); return v; },
      gravar(k, v) { mem.set(k, v); NE.memoria.gravar(`ne-c-${k}`, v); return v; },
      limpar() { mem.clear(); try { Object.keys(localStorage).filter((k) => k.startsWith("ne-c-")).forEach((k) => localStorage.removeItem(k)); } catch { /* ok */ } },
    };
    const buscarPerfil = async (id) => {
      const { data } = await sb.from("perfis").select("*").eq("id", id).maybeSingle();
      if (data) cache.gravar("perfil", data);
      return data;
    };
    return {
      emCache: (k) => cache.ler(k),
      async entrar(usuario, senha) {
        const { error } = await sb.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
        if (error) throw new Error("Usuário ou senha incorretos.");
      },
      async sair() { cache.limpar(); await sb.auth.signOut(); },
      async perfil() {
        const { data: { session } } = await sb.auth.getSession(); // lê do aparelho, sem esperar a rede
        if (!session) return null;
        const guardado = cache.ler("perfil");
        if (guardado?.id === session.user.id) { buscarPerfil(session.user.id).catch(() => {}); return guardado; }
        return buscarPerfil(session.user.id);
      },
      veiculos: async (todos = false) => cache.gravar(todos ? "veiculos-todos" : "veiculos",
        ok(await (todos ? sb.from("veiculos").select("*") : sb.from("veiculos").select("*").eq("ativo", true)).order("placa"))),
      produtos: async (todos = false) => cache.gravar(todos ? "produtos-todos" : "produtos",
        ok(await (todos ? sb.from("produtos").select("*") : sb.from("produtos").select("*").eq("ativo", true)).order("nome"))),
      funcionarios: async () => cache.gravar("funcionarios", ok(await sb.from("perfis").select("*").order("nome"))),
      async enviarFoto(blob, idPerfil) {
        const caminho = `${idPerfil}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
        ok(await sb.storage.from(C.bucketFotos).upload(caminho, blob, { contentType: "image/jpeg", upsert: false }));
        return caminho;
      },
      registrarConferencia: async (dados) => ok(await sb.rpc("registrar_conferencia", { p: dados })),
      async conferencias({ dia, somenteMinhas, idPerfil }) {
        const ini = new Date(`${dia}T00:00:00`), fim = new Date(ini.getTime() + 864e5);
        let q = sb.from("conferencias")
          .select("*, conferente:perfis(nome), itens:conferencia_itens(*), fotos:conferencia_fotos(*)")
          .gte("criado_em", ini.toISOString()).lt("criado_em", fim.toISOString())
          .order("criado_em", { ascending: false });
        if (somenteMinhas) q = q.eq("conferente_id", idPerfil);
        return cache.gravar(`conf-${dia}-${somenteMinhas ? "minhas" : "todas"}`, ok(await q));
      },
      async urlFoto(caminho) {
        const c = cacheUrl.get(caminho);
        if (c && c.expira > Date.now()) return c.url;
        const { data } = await sb.storage.from(C.bucketFotos).createSignedUrl(caminho, 600); // link vale 10 min
        if (data) cacheUrl.set(caminho, { url: data.signedUrl, expira: Date.now() + 540e3 });
        return data?.signedUrl || "";
      },
      async criarFuncionario(dados) {
        const { data, error } = await sb.functions.invoke("criar-funcionario", { body: dados });
        if (error) { let m = error.message; try { m = (await error.context.json()).erro || m; } catch { /* mantém */ } throw new Error(m); }
        return data;
      },
      alterarFuncionario: async (id, campos) => ok(await sb.from("perfis").update(campos).eq("id", id)),
      criarVeiculo: async (v) => ok(await sb.from("veiculos").insert(v)),
      alterarVeiculo: async (id, campos) => ok(await sb.from("veiculos").update(campos).eq("id", id)),
      criarProduto: async (p) => ok(await sb.from("produtos").insert(p)),
      alterarProduto: async (id, campos) => ok(await sb.from("produtos").update(campos).eq("id", id)),
    };
  }

  // ─────────────────────── MODO DEMONSTRAÇÃO ───────────────────────
  function demo() {
    const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    const fotoExemplo = (rotulo, cor) => {
      const cv = Object.assign(document.createElement("canvas"), { width: 480, height: 360 });
      const g = cv.getContext("2d");
      g.fillStyle = "#d9d5d0"; g.fillRect(0, 0, 480, 360);
      g.fillStyle = "#bdb7b0"; g.fillRect(0, 250, 480, 110);
      g.fillStyle = cor; g.fillRect(70, 150, 230, 110); g.fillRect(300, 180, 100, 80);
      g.fillStyle = "#9b9590"; for (let i = 0; i < 4; i++) g.fillRect(90 + i * 52, 110, 44, 40);
      g.fillStyle = "#222"; [120, 250, 360].forEach((x) => { g.beginPath(); g.arc(x, 265, 22, 0, 7); g.fill(); });
      g.fillStyle = "#1c1d21cc"; g.fillRect(0, 0, 480, 44);
      g.fillStyle = "#fff"; g.font = "600 20px Barlow, sans-serif"; g.fillText(`Foto de exemplo · ${rotulo}`, 14, 29);
      return cv.toDataURL("image/jpeg", 0.7);
    };
    const eu = { id: "demo-eduardo", nome: "Eduardo (demonstração)", usuario: "eduardo", funcao: "expedicao", papel: "admin", ativo: true };
    const funcionarios = [
      eu,
      { id: id(), nome: "Carlos (exemplo)", usuario: "carlos", funcao: "conferente", papel: "funcionario", ativo: true },
      { id: id(), nome: "Marcos (exemplo)", usuario: "marcos", funcao: "conferente", papel: "funcionario", ativo: true },
      { id: id(), nome: "Paulo (exemplo)", usuario: "paulo", funcao: "motorista", papel: "funcionario", ativo: false },
    ];
    const veiculos = [
      ["ABC1D23", "caminhao"], ["BRA2E19", "caminhao"], ["CDE3F45", "caminhao"], ["FGH4I67", "caminhao"],
      ["IJK5L89", "caminhao"], ["LMN6O01", "caminhao"], ["OPQ7R23", "caminhao"], ["RST8U45", "truck_munck"], ["UVW9X67", "truck_munck"],
    ].map(([placa, tipo]) => ({ id: id(), placa, tipo, descricao: "Placa de exemplo", ativo: true }));
    const produtos = ["Boca de lobo", "Meio-fio", "Guia", "Caixa para galeria", "Caixa de inspeção", "Tubo de concreto", "Aduela", "Dissipador", "Ala", "Laje"]
      .map((nome) => ({ id: id(), nome, unidade: "un", ativo: true }));
    const urls = new Map();
    const fotoFake = (tipo, rotulo, cor) => { const c = `demo/${id()}`; urls.set(c, fotoExemplo(rotulo, cor)); return { id: id(), tipo, caminho: c }; };
    const agora = Date.now();
    const exemplo = (minAtras, nota, v, conferente, itens, motivo) => {
      const div = itens.some((i) => i.qtd_nota !== i.qtd_carregada);
      return {
        id: id(), numero_nota: nota, placa: v.placa, veiculo_id: v.id, motorista: null, conferente_id: conferente.id,
        conferente: { nome: conferente.nome }, status: div ? "divergencia" : "ok", motivo_divergencia: motivo || null, observacao: null,
        latitude: -23.5956, longitude: -48.0532, criado_em: new Date(agora - minAtras * 6e4).toISOString(),
        itens: itens.map((i) => ({ id: id(), ...i })),
        fotos: [fotoFake("nota", "Nota fiscal", "#e8e4df"), fotoFake("placa", "Placa", "#c8202a"), fotoFake("carga", "Carga", "#c8202a")],
      };
    };
    const conferencias = [
      exemplo(35, "48213", veiculos[0], funcionarios[1], [{ descricao: "Meio-fio", qtd_nota: 40, qtd_carregada: 40 }, { descricao: "Boca de lobo", qtd_nota: 4, qtd_carregada: 4 }]),
      exemplo(95, "48207", veiculos[7], funcionarios[2], [{ descricao: "Caixa para galeria", qtd_nota: 6, qtd_carregada: 8 }], "Peças extras autorizadas, nota vai ser corrigida"),
      exemplo(160, "48199", veiculos[3], funcionarios[1], [{ descricao: "Tubo de concreto", qtd_nota: 12, qtd_carregada: 12 }, { descricao: "Aduela", qtd_nota: 2, qtd_carregada: 2 }]),
    ];
    const espera = () => Promise.resolve(); // demonstração: resposta imediata
    let logado = eu;
    return {
      emCache: () => null,
      entrar: async () => { await espera(); logado = eu; },
      sair: async () => { logado = null; },
      perfil: async () => logado,
      veiculos: async (todos) => veiculos.filter((v) => todos || v.ativo),
      produtos: async (todos) => produtos.filter((p) => todos || p.ativo),
      funcionarios: async () => funcionarios,
      async enviarFoto(blob) { await espera(200); const c = `demo/${id()}`; urls.set(c, URL.createObjectURL(blob)); return c; },
      async registrarConferencia(d) {
        await espera(700);
        if (!d.fotos.some((f) => f.tipo === "carga") || !d.fotos.some((f) => f.tipo === "placa")) throw new Error("As fotos da carga e da placa são obrigatórias.");
        const div = d.itens.some((i) => Number(i.qtd_nota) !== Number(i.qtd_carregada));
        if (div && !d.motivo_divergencia?.trim()) throw new Error("Explique o motivo da diferença.");
        const c = { ...d, id: id(), placa: d.placa.toUpperCase(), conferente_id: logado.id, conferente: { nome: logado.nome }, status: div ? "divergencia" : "ok", criado_em: new Date().toISOString(),
          itens: d.itens.map((i) => ({ id: id(), ...i })), fotos: d.fotos.map((f) => ({ id: id(), ...f })) };
        conferencias.unshift(c);
        return c.id;
      },
      async conferencias({ somenteMinhas, idPerfil }) { await espera(); return conferencias.filter((c) => !somenteMinhas || c.conferente_id === idPerfil); },
      urlFoto: async (c) => urls.get(c) || "",
      async criarFuncionario(d) { await espera(); if (funcionarios.some((f) => f.usuario === d.usuario)) throw new Error("Esse usuário já existe."); funcionarios.push({ id: id(), ativo: true, ...d }); },
      alterarFuncionario: async (fid, campos) => Object.assign(funcionarios.find((f) => f.id === fid), campos),
      criarVeiculo: async (v) => { veiculos.push({ id: id(), ativo: true, ...v }); },
      alterarVeiculo: async (vid, campos) => Object.assign(veiculos.find((v) => v.id === vid), campos),
      criarProduto: async (p) => { if (produtos.some((x) => x.nome.toLowerCase() === p.nome.toLowerCase())) throw new Error("Esse produto já existe."); produtos.push({ id: id(), unidade: "un", ativo: true, ...p }); },
      alterarProduto: async (pid, campos) => Object.assign(produtos.find((p) => p.id === pid), campos),
    };
  }

  NE.dados = modoDemo ? demo() : real();
  NE.tiposVeiculo = { caminhao: "Caminhão", truck_munck: "Truck com munck", betoneira: "Betoneira", basculante: "Basculante", outro: "Outro" };
  NE.funcoes = { conferente: "Conferente", expedicao: "Expedição", motorista: "Motorista", ajudante: "Ajudante", diretoria: "Diretoria", administrativo: "Administrativo" };
})();
