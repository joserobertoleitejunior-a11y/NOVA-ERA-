// Utilitários comuns (cliente Supabase, DOM seguro, sessão)
const C = window.NOVA_ERA;
export const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
export const $ = (s, r = document) => r.querySelector(s);
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) n.append(k instanceof Node ? k : document.createTextNode(k ?? ""));
  return n;
}
export function aviso(texto, tipo = "err") {
  const box = $("#aviso"); box.className = `msg ${tipo}`; box.textContent = texto; box.classList.remove("hide");
  if (tipo === "ok") setTimeout(() => box.classList.add("hide"), 4000);
}
export async function comCarregando(btn, fn) {
  btn.disabled = true;
  try { return await fn(); } catch (e) { aviso(e.message || "Erro inesperado"); } finally { btn.disabled = false; }
}
export async function perfilAtual() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from("perfis").select("*").eq("id", session.user.id).single();
  return data;
}
export function telaLogin(onOk) {
  $("#login").classList.remove("hide"); $("#app").classList.add("hide");
  $("#form-login").onsubmit = async (e) => {
    e.preventDefault();
    await comCarregando($("#form-login button"), async () => {
      const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#senha").value });
      if (error) throw new Error("E-mail ou senha incorretos.");
      onOk();
    });
  };
}
export async function sair() { await sb.auth.signOut(); location.reload(); }
export const fmt = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";
