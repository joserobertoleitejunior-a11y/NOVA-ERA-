// Cria o login de funcionários (Supabase Auth) + ficha (perfil). Só um admin ativo pode chamar.
// Modos: { nome, usuario, senha, ... } (um)  ·  { lote: [...] } (vários)  ·  { acao: "redefinir", id, senha? } (nova senha)
//        { acao: "apagar", id } (apaga o login e a ficha; recusa quem já tem histórico, a si mesmo e o último administrador)
// A chave de serviço existe apenas aqui no servidor; nunca vai para o app.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const FUNCOES = ["conferente", "motorista", "ajudante", "expedicao", "vendedor", "diretoria", "administrativo"];
const PAL = ["carga", "nota", "silo", "patio", "caixa", "tubo", "laje", "munck", "brita", "areia"];
const senhaNova = () => { const n = new Uint32Array(2); crypto.getRandomValues(n); return `${PAL[n[0] % PAL.length]}${1000 + (n[1] % 9000)}`; };
const dataOk = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const texto = (v: unknown, max = 200) => { const t = String(v ?? "").trim().slice(0, max); return t === "" ? null : t; };

// deno-lint-ignore no-explicit-any
async function criarUm(admin: any, b: any, cadastradoPor: string) {
  const nome = String(b.nome ?? "").trim();
  const usuario = String(b.usuario ?? "").trim().toLowerCase();
  const senha = String(b.senha ?? "");
  const funcao = FUNCOES.includes(b.funcao) ? b.funcao : "conferente";
  const papel = b.papel === "admin" ? "admin" : "funcionario";
  const telefone = String(b.telefone ?? "").replace(/\D/g, "") || null;
  if (nome.length < 2) throw new Error("Digite o nome do funcionário.");
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error("Usuário inválido: use de 3 a 30 letras ou números.");
  if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  if (telefone && (telefone.length < 10 || telefone.length > 13)) throw new Error("Telefone inválido: use DDD e número.");
  const { data: criado, error: e2 } = await admin.auth.admin.createUser({ email: `${usuario}@func.novaera.app`, password: senha, email_confirm: true, user_metadata: { nome } });
  if (e2) throw new Error(/registered|exists/i.test(e2.message) ? `O usuário "${usuario}" já existe.` : "Não foi possível criar o login.");
  const { error: e3 } = await admin.from("perfis").insert({
    id: criado.user.id, nome, usuario, funcao, papel, ativo: true, telefone, cadastrado_por: cadastradoPor, // quem cadastrou (auditoria)
    email_contato: texto(b.email_contato), admissao: dataOk(b.admissao), cnh_validade: dataOk(b.cnh_validade), observacao: texto(b.observacao, 400), foto: texto(b.foto, 300),
  });
  if (e3) { await admin.auth.admin.deleteUser(criado.user.id); throw new Error("Não foi possível salvar o perfil."); } // desfaz para não sobrar login sem perfil
  return { id: criado.user.id, usuario, senha, nome };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ehAdmin, error: e1 } = await comoUsuario.rpc("is_admin");
    if (e1 || ehAdmin !== true) return resp(403, { erro: "Só a administração cadastra funcionários." });
    const { data: quem } = await comoUsuario.auth.getUser(); const euId = quem?.user?.id; if (!euId) return resp(401, { erro: "Faça login novamente." });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json();

    if (b.acao === "redefinir") {
      const id = String(b.id ?? ""); const senha = String(b.senha ?? "") || senhaNova();
      if (senha.length < 6) return resp(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });
      const { data: p } = await admin.from("perfis").select("usuario").eq("id", id).maybeSingle();
      if (!p) return resp(404, { erro: "Funcionário não encontrado." });
      const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
      if (error) return resp(400, { erro: "Não foi possível trocar a senha." });
      return resp(200, { usuario: p.usuario, senha });
    }
    if (b.acao === "apagar") {
      const id = String(b.id ?? ""); if (!id) return resp(400, { erro: "Diga quem apagar." });
      if (id === euId) return resp(400, { erro: "Você não pode apagar o seu próprio cadastro." });
      const { data: p } = await admin.from("perfis").select("id, nome, papel, ativo").eq("id", id).maybeSingle();
      if (!p) return resp(404, { erro: "Funcionário não encontrado." });
      if (p.papel === "admin" && p.ativo) { // nunca ficar sem administrador
        const { count } = await admin.from("perfis").select("id", { count: "exact", head: true }).eq("papel", "admin").eq("ativo", true).neq("id", id);
        if (!count) return resp(400, { erro: "Este é o último administrador ativo: não dá para apagar." });
      }
      // Quem já registrou algo não é apagado: o histórico (conferências, notas, estoque) precisa continuar com nome. Nesse caso só se desativa.
      const usos: [string, string, string][] = [["conferencias", "conferente_id", "conferências"], ["notas", "criado_por", "notas"], ["estoque_movimentos", "usuario_id", "lançamentos de estoque"], ["contagens", "criado_por", "contagens"]];
      for (const [tabela, coluna, rotulo] of usos) {
        const { count } = await admin.from(tabela).select("id", { count: "exact", head: true }).eq(coluna, id);
        if (count) return resp(409, { erro: `${p.nome} já tem ${rotulo} registrados. Para não perder o histórico, só dá para impedir que a pessoa entre (desativar).`, emUso: true });
      }
      const { error } = await admin.auth.admin.deleteUser(id); // a ficha (perfis) some junto: perfis.id → auth.users ON DELETE CASCADE
      if (error) return resp(400, { erro: "Não foi possível apagar. Desative a pessoa em vez de apagar." });
      return resp(200, { ok: true });
    }
    if (Array.isArray(b.lote)) {
      if (b.lote.length > 50) return resp(400, { erro: "No máximo 50 pessoas por vez." });
      const resultados = [];
      for (const item of b.lote) {
        try { resultados.push({ ok: true, ...(await criarUm(admin, item, euId)) }); }
        catch (e) { resultados.push({ ok: false, nome: String(item?.nome ?? ""), erro: (e as Error).message }); }
      }
      return resp(200, { resultados });
    }
    try { return resp(200, await criarUm(admin, b, euId)); }
    catch (e) { return resp(400, { erro: (e as Error).message }); }
  } catch (e) {
    console.error("criar-funcionario", e);
    return resp(500, { erro: "Erro inesperado. Tente de novo." });
  }
});
