// ★ Configuração única (site + app). Chaves PÚBLICAS: a segurança vem do RLS no banco.
// Nunca colocar service_role aqui.
window.NOVA_ERA = {
  supabaseUrl: "https://kfazxjertfzoeewfsime.supabase.co",
  supabaseAnonKey: "sb_publishable_yJEGtaiNkJiyHjh7KyYZ3g_z1NRnbyK",
  bucketFotos: "fotos-cargas",
  // ★ MODO TESTE: com `true`, o login admin / admin abre um ambiente de TESTE, só neste aparelho, com dados de exemplo.
  // Nada é gravado no banco de verdade. Antes de entregar ao cliente, troque para `false`.
  modoTeste: true,
  urlPublica: "", // endereço do site quando for hospedado (ex.: "https://www.novaera.com.br/") — usado nos links de rastreio

  // Contato (aparece no site inteiro)
  telefoneEmpresa: "(15) 3273-1159",
  telefoneLink: "+551532731159",
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
