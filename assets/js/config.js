// ★ Configuração única (site + app). Chaves PÚBLICAS: a segurança vem do RLS no banco.
// Nunca colocar service_role aqui.
window.NOVA_ERA = {
  supabaseUrl: "https://kfazxjertfzoeewfsime.supabase.co",
  supabaseAnonKey: "sb_publishable_yJEGtaiNkJiyHjh7KyYZ3g_z1NRnbyK",
  bucketFotos: "fotos-cargas",
  // ★ DEMONSTRAÇÃO: com `true`, o endereço app.html?demo=exemplo (ou ?demo=vazio) abre um ambiente de DEMONSTRAÇÃO,
  // com os logins de teste, só naquela aba (some ao fechar). Nada é gravado no banco de verdade e nada fica no aparelho.
  // Sem ?demo= no endereço o app é sempre o de verdade. Para entregar ao cliente sem a demonstração, troque para `false`.
  demo: true,
  // ★ PREMIUM IA: `true` liga a leitura da nota por IA (foto → número, cliente e itens) e o assistente com Claude.
  // Só vira botão na tela quando a função `assistente` do Supabase responde com a chave (ANTHROPIC_API_KEY) guardada.
  // Sem a chave, nada de IA aparece para ninguém.
  premiumIA: true,
  urlPublica: "", // endereço do site quando for hospedado (ex.: "https://www.novaera.com.br/") — usado nos links de rastreio

  // Contato (aparece no site inteiro)
  telefoneEmpresa: "(15) 3273-1159",
  telefoneLink: "+551532731159",
  // Suporte do app (Confere Carga): quem resolve problemas. Aparece em Mais → Suporte e na tela "Esqueci a senha".
  suporteNome: "José Roberto",
  whatsappAdmin: "5515991441475",
  whatsapp: "", // ← WhatsApp comercial só com números, ex.: "5515999999999". Vazio = o site oferece ligar/copiar
  instagram: "https://www.instagram.com/novaeradrenagem/",
  endereco: "Rodovia Raposo Tavares (SP-270), km 167 · Itapetininga/SP",
  mapaUrl: "https://www.google.com/maps/search/?api=1&query=Nova+Era+Drenagem+e+Pr%C3%A9-Moldados+Itapetininga",

  // Horário (0 = domingo … 6 = sábado). A CONFIRMAR COM O CLIENTE: o Google mostra "fecha às 18h".
  // Alimenta o selo "Aberto agora / Fechado" e a linha de horário do site.
  horarios: [
    { dias: [1, 2, 3, 4, 5], abre: "07:00", fecha: "18:00" },
  ],

  // Calculadora de concreto
  capacidadeBetoneiraM3: 8, // A CONFIRMAR: capacidade usada para estimar quantas viagens
};

// Se a demonstração estiver desligada, o endereço ?demo= deixa de valer (ambiente.js já rodou antes deste arquivo).
if (window.NE && window.NE.demo) window.NE.demo.permitir(window.NOVA_ERA.demo !== false);
