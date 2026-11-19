// Rastreio público do cliente: recebe o código secreto do link e devolve SÓ o que o cliente pode ver
// (nota, placa, horário, itens carregados e um link temporário da foto da carga).
// Não devolve conferente, diferenças, motivos, localização nem outras fotos.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const resp = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return resp(405, { erro: "Método não permitido." });
  const token = new URL(req.url).searchParams.get("c") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return resp(404, { erro: "Não encontrado." });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c, error } = await admin.from("conferencias")
      .select("numero_nota, placa, criado_em, itens:conferencia_itens(descricao, qtd_carregada), fotos:conferencia_fotos(tipo, caminho)")
      .eq("token_publico", token).maybeSingle();
    if (error) throw error;
    if (!c) return resp(404, { erro: "Não encontrado." });
    const foto = (c.fotos ?? []).find((f: { tipo: string }) => f.tipo === "carga");
    let fotoCarga: string | null = null;
    if (foto) {
      const { data } = await admin.storage.from("fotos-cargas").createSignedUrl(foto.caminho, 900); // vale 15 min
      fotoCarga = data?.signedUrl ?? null;
    }
    return resp(200, {
      numero_nota: c.numero_nota, placa: c.placa, conferido_em: c.criado_em, entregue_em: null,
      itens: (c.itens ?? []).map((i: { descricao: string; qtd_carregada: number }) => ({ descricao: i.descricao, quantidade: Number(i.qtd_carregada) })),
      foto_carga: fotoCarga,
    });
  } catch (e) {
    console.error("rastreio", e);
    return resp(500, { erro: "Erro ao buscar a entrega." });
  }
});
