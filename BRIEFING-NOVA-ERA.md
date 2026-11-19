# BRIEFING — NOVA ERA (preparação para a reunião)

## 1. O que sabemos
- Transportadora em Itapetininga-SP; indicação de um funcionário.
- Necessidade: app para funcionários na **carga e descarga** de caminhões — check-in com fotos, cadastro de funcionários, painel admin para a administração acompanhar as cargas.
- Origem: conversa com o funcionário (prints/áudios ainda serão enviados — **vídeo grande não cabe no GitHub**; usar Google Drive/WeTransfer e só anotar o resumo aqui).

## 2. Pesquisa pública sobre a empresa (honesta: NÃO confirmada)
Busquei na web e **não achei uma transportadora "Nova Era" sediada em Itapetininga**. Homônimas encontradas (nenhuma confirmada como o cliente):
- Nova Era em Itapetininga — CNPJ 07.030.782/0001-50, Rod. Raposo Tavares, 620 — mas é **pré-moldados/drenagem**, não transporte.
- Transportes Nova Era Ltda — CNPJ 00.103.768/0001-90 (CNAE produtos perigosos; cidade não informada).
- Nova Era Transportes — CNPJ 49.883.996/0001-10 (São Paulo/SP); 07.918.499/0001-60 (Uberaba/MG); 12.001.402/0001-90 (Maceió/AL); 54.868.228/0001-27 (Nuporanga/SP).
- SA Transporte de Logística (fantasia "Nova Era") — CNPJ 58.536.875/0001-92.

➡️ **Ação:** pedir o CNPJ/razão social na reunião (ou ao funcionário) para consultar Receita Federal e RNTRC/ANTT (frota). Não usar dado de homônimo como se fosse do cliente.

## 3. Perguntas para a reunião
**Operação**
1. Quantos funcionários usam no pátio? Quais funções (motorista, ajudante, conferente)? Quantos caminhões e cargas/dia?
2. Como é o processo hoje (papel, WhatsApp, planilha)? Onde dói mais (extravio, avaria, disputa com cliente, hora extra)?
3. Quais etapas registrar: chegada, início, fim, ocorrência/avaria? Quantas fotos e de quê (lacre, carga, canhoto, avaria, placa)?
4. Precisa de geolocalização/hora oficial? Assinatura do conferente/cliente?
5. Cargas virão de onde? Digitadas pela administração, ou integração com o sistema/ERP/TMS deles (qual)?
**Administração**
6. O que o gestor precisa ver: cargas do dia, status, quem fez, fotos, tempo de descarga, relatório/PDF/Excel, alertas?
7. Quantos administradores e níveis de acesso?
**Dados e segurança**
8. Quem é o dono dos dados? Por quanto tempo guardar fotos? Já há exigência de LGPD/contrato?
9. Funcionários têm celular próprio (Android/iOS) e internet no pátio? Precisa funcionar **offline** e sincronizar depois?
**Negócio**
10. Prazo, orçamento, mensalidade vs. projeto fechado, quem aprova. Marca/logo/cores da empresa.

## 4. Escopo proposto (MVP)
- **Funcionário (PWA no celular):** login, ver suas cargas do dia, check-in (chegada/início/fim/ocorrência) com foto(s) + localização + observação.
- **Admin:** cadastrar/ativar funcionários, veículos e cargas, escalar funcionários, ver painel de status e galeria de fotos por carga.
- **Depois:** modo offline, relatórios PDF/Excel, notificações, assinatura digital, integração com sistema deles.

## 5. Estado técnico (feito nesta sessão)
- Supabase "Nova Era Transportes" (sa-east-1) criado, schema + RLS + bucket privado `fotos-cargas` aplicados; advisor de segurança sem pendência crítica.
- Esqueleto do app (login + check-in com foto) e painel admin neste repositório.
