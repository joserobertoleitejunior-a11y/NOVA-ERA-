# Função `assistente` (IA com Claude)

Publicada no projeto Supabase `kfazxjertfzoeewfsime`. Roda só no servidor: a chave da Anthropic **nunca** vai para o app.

## Ligar
1. Crie a chave na Anthropic (console.anthropic.com → API Keys).
2. Guarde no Supabase: https://supabase.com/dashboard/project/kfazxjertfzoeewfsime/functions/secrets
   → **Add new secret** → Name `ANTHROPIC_API_KEY` → Value a chave → Save.
3. Abra o app como administrador: aparece o botão **Perguntar**. Quem confere carga ganha o botão de **ler a nota pela foto**.

Sem a chave, nenhuma IA aparece para ninguém. Para desligar de vez: apague o segredo, ou `premiumIA: false` em `assets/js/config.js`.

## O que faz
- `perguntar` (só administração): Claude consulta os dados reais por ferramentas de **somente leitura**, com o login de quem perguntou, e recusa assunto fora da empresa.
- `ler_nota` (quem confere e administração): foto da nota → número, cliente e itens.
- `status`: diz se a IA está ligada.

## Opcional
Segredo `ANTHROPIC_MODEL` troca o modelo (padrão `claude-sonnet-5-5`).

## Como foi publicada
O `index.ts` daqui importa `./dominio.js` (cópia das regras do app, para publicar pela CLI). A versão publicada pelo painel/MCP importa o **mesmo arquivo do repositório, preso a um commit exato**:
`https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/assets/js/dominio.js`.
É a única diferença. Se `assets/js/dominio.js` mudar, republique a função apontando para o commit novo.
