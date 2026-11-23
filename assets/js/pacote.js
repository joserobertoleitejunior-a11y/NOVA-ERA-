// PACOTES do Confere Carga: o que cada versão liga. É o único lugar onde isso está escrito.
//   Básico         conferir carga, lançar nota digitando, rastreio ao cliente, equipe, caminhões e produtos
//   Intermediário  + estoque, XML, etiquetas, resumo da diretoria, vendedor, avisos completos, planilhas e vídeos
//   Premium        + assistente com IA e histórico de atividades
// Qual pacote vale vem do BANCO (tabela `licenca`, que só o dono do sistema altera). Aqui só se traduz isso em telas e botões.
// Na demonstração (?demo=) dá para ver cada pacote com ?pacote=basico, ?pacote=intermediario ou ?pacote=premium.
(function (raiz) {
  "use strict";

  const ORDEM = ["basico", "intermediario", "premium"];
  const NOMES = { basico: "Básico", intermediario: "Intermediário", premium: "Premium" };

  // recurso → primeiro pacote que o inclui. O que não está aqui é do Básico (vale para todos).
  const DESDE = {
    estoque: "intermediario",     // aba Estoque, contagem, mínimo, entrada e perda, "disponível" do vendedor
    xml: "intermediario",         // importar várias notas pelo XML
    etiquetas: "intermediario",   // etiquetas com QR e contagem lendo a câmera
    resumo: "intermediario",      // resumo completo e indicadores da diretoria
    vendedor: "intermediario",    // função vendedor e o painel dele
    avisos: "intermediario",      // avisos automáticos completos (estoque, nota parada, fora do horário, resumo do dia) e WhatsApp de 1 toque
    planilhas: "intermediario",   // planilhas (cargas e estoque)
    videos: "intermediario",      // vídeo tutorial por função na tela de boas-vindas
    ia: "premium",                // assistente com IA, leitura da nota por foto, assistente de vendas
    historico: "premium",         // histórico de atividades (quem fez o quê, quando, mercadoria e nota)
  };

  const ROTULOS = {
    estoque: "Estoque e contagem", xml: "Importar notas por XML", etiquetas: "Etiquetas com QR e contagem pela câmera", resumo: "Resumo e indicadores da diretoria",
    vendedor: "Painel do vendedor", avisos: "Avisos automáticos completos", planilhas: "Planilhas de cargas e estoque", videos: "Vídeo tutorial por função",
    ia: "Assistente com IA", historico: "Histórico de atividades",
  };

  // No Básico só chegam os avisos que nascem de uma ação de alguém (carga conferida, nota lançada, pedido de senha).
  const AVISOS_ESSENCIAIS = ["saida_sem_nota", "divergencia_carga", "nota_nova", "senha_esquecida", "sistema"];

  const valido = (id) => (ORDEM.includes(id) ? id : null);
  const tem = (pacote, recurso) => {
    const desde = DESDE[recurso]; if (!desde) return true;
    const p = valido(pacote) || "premium";           // sem informação: não tira nada de quem já usa
    return ORDEM.indexOf(p) >= ORDEM.indexOf(desde);
  };
  const avisoPermitido = (pacote, tipo) => tem(pacote, "avisos") || AVISOS_ESSENCIAIS.includes(tipo);
  const funcaoDisponivel = (pacote, funcao) => (funcao === "vendedor" ? tem(pacote, "vendedor") : true);
  // Menor pacote que traz um recurso (para dizer "faz parte do Intermediário")
  const pacoteDe = (recurso) => NOMES[DESDE[recurso] || "basico"];
  const recursos = (pacote) => Object.keys(DESDE).filter((r) => tem(pacote, r));

  const API = { ORDEM, NOMES, ROTULOS, DESDE, AVISOS_ESSENCIAIS, valido, tem, avisoPermitido, funcaoDisponivel, pacoteDe, recursos };
  raiz.NEPacoteRegras = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ── no navegador: o pacote em uso ──
  const NE = raiz.NE;
  if (!NE) return;
  let atual = null;
  const doEndereco = () => {      // só na demonstração: ?pacote=basico para mostrar cada versão na reunião
    try { if (NE.demo && NE.demo.ativo) return valido(new URLSearchParams(raiz.location.search).get("pacote")); } catch { /* sem endereço */ }
    return null;
  };
  NE.pacote = {
    get id() { return atual || doEndereco() || "premium"; },
    get nome() { return NOMES[this.id]; },
    definir(id) { atual = valido(id); try { raiz.document.documentElement.dataset.pacote = this.id; } catch { /* sem página */ } return this.id; },
    tem(recurso) { return tem(this.id, recurso); },
    avisoPermitido(tipo) { return avisoPermitido(this.id, tipo); },
    funcaoDisponivel(funcao) { return funcaoDisponivel(this.id, funcao); },
    recursos() { return recursos(this.id); },
    pacoteDe, ROTULOS,
  };
  NE.pacote.definir(doEndereco());
})(typeof window !== "undefined" ? window : globalThis);
