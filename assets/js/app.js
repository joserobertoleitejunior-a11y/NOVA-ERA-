import { sb, $, el, aviso, comCarregando, perfilAtual, telaLogin, sair, fmt } from "./base.js";
const C = window.NOVA_ERA;
let perfil, cargaAtual;

async function iniciar() {
  perfil = await perfilAtual();
  if (!perfil) return telaLogin(iniciar);
  if (!perfil.ativo) { await sair(); return; }
  $("#login").classList.add("hide"); $("#app").classList.remove("hide");
  $("#quem").textContent = perfil.nome;
  if (perfil.papel === "admin") $("#link-admin").classList.remove("hide");
  $("#sair").onclick = sair;
  listarCargas();
}

async function listarCargas() {
  const box = $("#cargas"); box.replaceChildren(el("div", { class: "skel" }), el("div", { class: "skel" }));
  const { data, error } = await sb.from("cargas").select("*").in("status", ["agendada", "em_andamento", "ocorrencia"]).order("agendada_para");
  if (error) return aviso("Não foi possível carregar as cargas.");
  box.replaceChildren(...(data.length ? data.map(cartao) : [el("p", {}, "Nenhuma carga para você agora.")]));
}
const cartao = (c) => el("div", { class: "card" },
  el("strong", {}, `${c.tipo === "carga" ? "Carga" : "Descarga"} ${c.codigo}`), " ", el("span", { class: "tag" }, c.status),
  el("div", {}, [c.cliente, c.destino].filter(Boolean).join(" → ") || ""),
  el("div", {}, fmt(c.agendada_para)),
  el("button", { onclick: () => abrir(c) }, "Fazer check-in"));

function abrir(c) {
  cargaAtual = c;
  $("#lista").classList.add("hide"); $("#checkin").classList.remove("hide");
  $("#titulo-carga").textContent = `${c.tipo === "carga" ? "Carga" : "Descarga"} ${c.codigo}`;
}
$("#voltar").onclick = () => { $("#checkin").classList.add("hide"); $("#lista").classList.remove("hide"); listarCargas(); };

function posicao() {
  return new Promise((ok) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 8000, enableHighAccuracy: true })
    : ok(null));
}
async function reduzir(file) { // reduz foto p/ ~1600px: economiza dados móveis
  const bmp = await createImageBitmap(file); const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = Object.assign(document.createElement("canvas"), { width: bmp.width * s, height: bmp.height * s });
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
}
$("#fotos").onchange = (e) => {
  const prev = $("#previa"); prev.replaceChildren();
  for (const f of e.target.files) prev.append(el("img", { src: URL.createObjectURL(f), alt: "Pré-visualização da foto" }));
};
$("#form-checkin").onsubmit = (e) => {
  e.preventDefault();
  comCarregando($("#enviar"), async () => {
    const files = [...$("#fotos").files];
    if (!files.length && $("#etapa").value !== "ocorrencia") throw new Error("Tire pelo menos uma foto.");
    const pos = await posicao();
    const { data: ck, error } = await sb.from("checkins").insert({
      carga_id: cargaAtual.id, funcionario_id: perfil.id, etapa: $("#etapa").value,
      observacao: $("#obs").value.trim() || null, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null,
    }).select().single();
    if (error) throw new Error("Falha ao registrar. Você está escalado nesta carga?");
    for (const f of files) {
      const blob = await reduzir(f);
      const caminho = `${perfil.id}/${ck.id}-${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from(C.bucketFotos).upload(caminho, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error("Falha ao enviar foto. Tente de novo.");
      await sb.from("checkin_fotos").insert({ checkin_id: ck.id, caminho });
    }
    aviso("Check-in registrado!", "ok"); e.target.reset(); $("#previa").replaceChildren();
  });
};
iniciar();
