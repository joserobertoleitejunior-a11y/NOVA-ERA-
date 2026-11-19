import { sb, $, el, aviso, comCarregando, perfilAtual, telaLogin, sair, fmt } from "./base.js";
const C = window.NOVA_ERA;

async function iniciar() {
  const p = await perfilAtual();
  if (!p) return telaLogin(iniciar);
  if (p.papel !== "admin") { $("#login").classList.add("hide"); $("#app").classList.add("hide"); return aviso("Acesso restrito à administração."); }
  $("#login").classList.add("hide"); $("#app").classList.remove("hide"); $("#sair").onclick = sair;
  painel(); formCarga();
}
async function painel() {
  const box = $("#painel"); box.replaceChildren(el("div", { class: "skel" }));
  const { data, error } = await sb.from("cargas").select("*, veiculos(placa)").order("criado_em", { ascending: false }).limit(50);
  if (error) return aviso("Erro ao carregar cargas.");
  const t = el("table", {}, el("tr", {}, ["Código", "Tipo", "Cliente", "Status", "Agendada", ""].map((h) => el("th", {}, h))),
    data.map((c) => el("tr", {}, el("td", {}, c.codigo), el("td", {}, c.tipo), el("td", {}, c.cliente ?? ""),
      el("td", {}, el("span", { class: "tag" }, c.status)), el("td", {}, fmt(c.agendada_para)),
      el("td", {}, el("button", { class: "sec", onclick: () => detalhe(c) }, "Ver")))));
  box.replaceChildren(t);
}
async function detalhe(c) {
  const box = $("#detalhe"); box.classList.remove("hide"); box.replaceChildren(el("div", { class: "skel" }));
  const { data } = await sb.from("checkins").select("*, perfis(nome), checkin_fotos(caminho)").eq("carga_id", c.id).order("criado_em");
  const itens = [];
  for (const k of data ?? []) {
    const urls = [];
    for (const f of k.checkin_fotos) {
      const { data: s } = await sb.storage.from(C.bucketFotos).createSignedUrl(f.caminho, 300); // link expira em 5 min
      if (s) urls.push(el("a", { href: s.signedUrl, target: "_blank", rel: "noopener" }, el("img", { src: s.signedUrl, alt: "Foto do check-in", loading: "lazy" })));
    }
    itens.push(el("div", { class: "card" }, el("strong", {}, `${k.etapa} — ${k.perfis?.nome ?? ""}`), el("div", {}, fmt(k.criado_em)),
      k.observacao ? el("div", {}, k.observacao) : "", el("div", { class: "fotos" }, urls)));
  }
  box.replaceChildren(el("h2", {}, `Carga ${c.codigo}`), ...(itens.length ? itens : [el("p", {}, "Sem check-ins ainda.")]));
}
async function formCarga() {
  const [{ data: func }, { data: veic }] = await Promise.all([
    sb.from("perfis").select("id,nome").eq("ativo", true).order("nome"), sb.from("veiculos").select("id,placa").eq("ativo", true)]);
  $("#f-func").replaceChildren(...(func ?? []).map((f) => el("option", { value: f.id }, f.nome)));
  $("#f-veic").replaceChildren(el("option", { value: "" }, "—"), ...(veic ?? []).map((v) => el("option", { value: v.id }, v.placa)));
  $("#form-carga").onsubmit = (e) => {
    e.preventDefault();
    comCarregando($("#salvar-carga"), async () => {
      const { data: c, error } = await sb.from("cargas").insert({
        codigo: $("#f-cod").value.trim(), tipo: $("#f-tipo").value, cliente: $("#f-cli").value.trim() || null,
        destino: $("#f-dest").value.trim() || null, veiculo_id: $("#f-veic").value || null,
        agendada_para: $("#f-data").value ? new Date($("#f-data").value).toISOString() : null }).select().single();
      if (error) throw new Error("Não foi possível salvar (código repetido?).");
      const ids = [...$("#f-func").selectedOptions].map((o) => o.value);
      if (ids.length) await sb.from("carga_funcionarios").insert(ids.map((id) => ({ carga_id: c.id, funcionario_id: id })));
      aviso("Carga criada.", "ok"); e.target.reset(); painel();
    });
  };
}
iniciar();
