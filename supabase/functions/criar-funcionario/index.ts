// Cria o login de um funcionário (Supabase Auth) + perfil. Só um admin ativo pode chamar.
// A chave de serviço existe apenas aqui no servidor; nunca vai para o app.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const FUNCOES = ["conferente", "motorista", "ajudante", "expedicao", "diretoria", "administrativo"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ehAdmin, error: e1 } = await comoUsuario.rpc("is_admin");
    if (e1 || ehAdmin !== true) return resp(403, { erro: "Só a administração pode cadastrar funcionários." });

    const b = await req.json();
    const nome = String(b.nome ?? "").trim();
    const usuario = String(b.usuario ?? "").trim().toLowerCase();
    const senha = String(b.senha ?? "");
    const funcao = FUNCOES.includes(b.funcao) ? b.funcao : "conferente";
    const papel = b.papel === "admin" ? "admin" : "funcionario";
    if (nome.length < 2) return resp(400, { erro: "Digite o nome do funcionário." });
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return resp(400, { erro: "Usuário inválido: use de 3 a 30 letras ou números." });
    if (senha.length < 6) return resp(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: criado, error: e2 } = await admin.auth.admin.createUser({
      email: `${usuario}@func.novaera.app`, password: senha, email_confirm: true, user_metadata: { nome },
    });
    if (e2) return resp(400, { erro: /registered|exists/i.test(e2.message) ? "Esse usuário já existe." : "Não foi possível criar o login." });

    const { error: e3 } = await admin.from("perfis").insert({ id: criado.user.id, nome, usuario, funcao, papel, ativo: true });
    if (e3) {
      await admin.auth.admin.deleteUser(criado.user.id); // desfaz para não sobrar login sem perfil
      return resp(400, { erro: "Não foi possível salvar o perfil." });
    }
    return resp(200, { id: criado.user.id });
  } catch (e) {
    console.error("criar-funcionario", e);
    return resp(500, { erro: "Erro inesperado. Tente de novo." });
  }
});
