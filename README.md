# Nova Era · site institucional + Confere Carga
- `index.html` — site institucional para os clientes (fotos reais da fábrica, produtos, concreto, drenagem, entrega rastreada, contato).
- `app.html` — app Confere Carga (conferentes, no celular). `admin.html` — **painel de administração** (expedição e diretoria: conferências do dia, funcionários, caminhões, produtos, etiquetas, envio do rastreio). `rastreio.html` — página do cliente.
- Demonstração sem login: `app.html?demo` e `admin.html?demo`.
- Visual: Liquid Glass (vidro translúcido) com as cores da Nova Era; versão sólida automática em aparelho sem suporte.

App de **conferência nota × carga** da expedição. Problema definido na reunião de 19/11: sai produto a mais do que está na nota e o estoque fica errado.

## Como funciona
**Conferente (celular), 6 passos:**
1. Caminhão: toca na placa ou digita.
2. Nota fiscal: foto da nota → o número é lido sozinho do código de barras (chave de 44 dígitos, com dígito verificador). Se não ler, digita.
3. Itens da nota: toca nos produtos e informa a quantidade.
4. Conferir: em cada item, "Confere" ou "Diferente" (e quantos subiram).
5. Fotos: caminhão carregado e placa (obrigatórias), avarias (opcional).
6. Revisar: se há diferença, o motivo é obrigatório. Registra.

**Painel (expedição/diretoria):** conferências do dia com totais, filtro "com diferença", detalhe com itens e fotos; cadastro de funcionários, caminhões e produtos.

**Rastreio do cliente:** na janela da conferência, "Enviar ao cliente" abre o WhatsApp com o link `rastreio.html?c=CÓDIGO`. O cliente vê situação, horário de saída, itens carregados e a foto da carga. O código é secreto; a função `rastreio` devolve só esses dados (nada de conferente, diferenças ou motivo).

**Etiquetas:** térmica 100 × 50 mm ou folha A4 (10 por folha), uma por produto ou uma por peça, com QR Code do rastreio.

**Prova:** o registro (itens e fotos) não pode ser alterado nem apagado por ninguém (sem políticas de UPDATE/DELETE). Fotos em bucket privado com link temporário.

## Modo demonstração
`app.html?demo` roda com dados de exemplo, sem login e sem gravar nada.
Gerar o HTML único da demonstração: `python3 scripts/gerar-demo.py saida.html`.

## Rodar local
`python3 -m http.server 8080` → http://localhost:8080 (câmera exige HTTPS ou localhost).

## Supabase
- Migrations em `supabase/migrations/` (001 inicial, 002 Confere Carga).
- Função `criar-funcionario`: cria login e perfil; só admin chama; chave de serviço só no servidor.
- Funcionário entra com **usuário + senha** (não precisa de e-mail).

### Criar o 1º admin (uma vez)
1. Supabase → Authentication → Add user: e-mail `eduardo@func.novaera.app` (ou um e-mail real) + senha.
2. SQL Editor:
   `insert into perfis (id, nome, usuario, funcao, papel) values ('<uuid>', 'Eduardo', 'eduardo', 'expedicao', 'admin');`
3. Daí em diante, os outros funcionários são cadastrados pelo painel.

## Pendências
- Logotipo oficial (o atual é provisório, desenhado a partir da fachada).
- Leitura dos itens da nota (foto com IA ou XML da NF-e) — fase 2. O número da nota já é lido pelo código de barras.
- Lint (Biome), testes automatizados, Sentry, hospedagem (Netlify descartado).
