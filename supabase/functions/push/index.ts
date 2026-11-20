// Avisos no celular (Web Push), com o app fechado.
//  · { acao:"chave" }                      → chave pública (cria as chaves VAPID e o segredo interno na 1ª vez)
//  · { acao:"assinar", assinatura, ... }   → guarda o aparelho de quem está logado
//  · { acao:"remover", endpoint }          → tira o aparelho
//  · { acao:"testar" }                     → manda um aviso de teste para os aparelhos de quem pediu
//  · { acao:"enviar", usuario_id, ... }    → chamado SÓ pelo banco (pg_net) com o segredo interno, quando nasce um aviso
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-segredo", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resp = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const aleatorio = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const pegar = async (nome: string) => (await admin.from("config_segredos").select("valor").eq("nome", nome).maybeSingle()).data?.valor as string | undefined;
    const guardar = (nome: string, valor: string) => admin.from("config_segredos").upsert({ nome, valor });
    const garantir = async () => {
      let pub = await pegar("vapid_publica"), priv = await pegar("vapid_privada");
      if (!pub || !priv) { const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey; await guardar("vapid_publica", pub); await guardar("vapid_privada", priv); }
      if (!(await pegar("push_segredo"))) await guardar("push_segredo", aleatorio());
      await guardar("push_url", `${url}/functions/v1/push`);
      webpush.setVapidDetails("mailto:contato@novaeradrenagem.com.br", pub, priv); return pub;
    };
    const b = await req.json();

    const enviarPara = async (usuarioId: string, carga: unknown) => {
      const { data: subs } = await admin.from("push_assinaturas").select("*").eq("usuario_id", usuarioId); let enviados = 0;
      for (const s of subs ?? []) {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.chaves }, JSON.stringify(carga), { TTL: 3600, urgency: "high" }); enviados++; }
        catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await admin.from("push_assinaturas").delete().eq("endpoint", s.endpoint); else console.error("push", code); }
      }
      return enviados;
    };

    if (b.acao === "enviar") { // só o banco chama, com o segredo interno
      const seg = await pegar("push_segredo"); if (!seg || req.headers.get("x-push-segredo") !== seg) return resp(403, { erro: "Sem permissão." });
      await garantir();
      return resp(200, { enviados: await enviarPara(String(b.usuario_id), { titulo: String(b.titulo ?? "Confere Carga").slice(0, 120), texto: String(b.texto ?? "").slice(0, 300), severidade: b.severidade, tag: b.tag, url: "app.html#alertas" }) });
    }

    const c = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: uid, error } = await c.rpc("exigir_ativo"); if (error || !uid) return resp(401, { erro: "Faça login novamente." });

    if (b.acao === "chave") return resp(200, { chave: await garantir() });
    if (b.acao === "assinar") {
      const a = b.assinatura; if (!a?.endpoint || !a?.keys?.p256dh || !a?.keys?.auth || !String(a.endpoint).startsWith("https://")) return resp(400, { erro: "Assinatura inválida." });
      await admin.from("push_assinaturas").upsert({ endpoint: a.endpoint, usuario_id: uid, chaves: a.keys, aparelho: String(b.aparelho ?? "").slice(0, 120) }); return resp(200, { ok: true });
    }
    if (b.acao === "remover") { await admin.from("push_assinaturas").delete().eq("endpoint", String(b.endpoint)).eq("usuario_id", uid); return resp(200, { ok: true }); }
    if (b.acao === "testar") { await garantir(); return resp(200, { enviados: await enviarPara(uid as string, { titulo: "Aviso de teste", texto: "Pronto! Este aparelho vai receber os avisos do Confere Carga.", tag: "teste", url: "app.html#alertas" }) }); }
    return resp(400, { erro: "Ação inválida." });
  } catch (e) { console.error("push", e); return resp(500, { erro: "Erro inesperado." }); }
});
