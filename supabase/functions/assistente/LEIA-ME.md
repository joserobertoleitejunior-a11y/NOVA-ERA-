# Função `assistente` (IA com Claude)

Publicada no projeto Supabase `kfazxjertfzoeewfsime`. Roda só no servidor: a chave da Anthropic **nunca** vai para o app.

## Ligar
1. Crie a chave na Anthropic (console.anthropic.com → API Keys).
2. Guarde no Supabase: https://supabase.com/dashboard/project/kfazxjertfzoeewfsime/functions/secrets
   → **Add new secret** → Name `ANTHROPIC_API_KEY` → Value a chave → Save.
3. Aplique a migração `supabase/migrations/007_assistente_acoes.sql` (ou rode `supabase/EXECUTAR-TUDO.sql` de novo): cria o registro de auditoria e a trava de repetição.
4. Abra o app como administrador: aparece o botão **Assistente**. Quem confere carga ganha o botão de **ler a nota pela foto**.

Sem a chave, nenhuma IA aparece para ninguém. Para desligar de vez: apague o segredo, ou `premiumIA: false` em `assets/js/config.js`.

## O que faz
- `perguntar` — administração (função diretoria, administrativo ou expedição, com acesso de administrador) e vendedor, que usa um **escopo de vendas** (veja abaixo). O Claude **consulta** os dados reais e **prepara ações** por comando. Nada é gravado nesta etapa.
- `executar` — roda UMA ação preparada, só com o token assinado do botão **Confirmar**.
- `ler_nota` — quem confere carga (e a administração): foto da nota → número, cliente e itens.
- `status` — diz se a IA está ligada e para quem (`ativo`, `leitura`, `acoes`).

Ferramentas de **leitura**: resumo, diferenças, estoque, contagem sugerida, desempenho da equipe, funcionários, produtos, caminhões, notas, conferências, movimentos, contagens, avisos, ajustes, histórico do assistente, abrir tela, link de rastreio.
Ferramentas de **ação** (sempre viram um cartão Confirmar/Cancelar):
cadastrar / editar / apagar funcionários · redefinir senhas · cadastrar / editar / apagar produtos · cadastrar / editar / apagar caminhões (com fotos) ·
lançar notas (digitadas, de foto ou de XML) · cancelar notas · **conferir carga** (fotos da carga e da placa obrigatórias) ·
lançar entrada/perda · pedir contagem · registrar contagem · decidir contagem (aplicar, descartar, recontar) · marcar avisos · escolher avisos que recebe · mudar ajustes.

## Escopo de vendas (vendedor)
O vendedor recebe só 11 ferramentas (`estoque`, `produtos`, `notas`, `conferencias`, `avisos`, `abrir_tela`, `link_rastreio`, `lancar_notas`, `cancelar_notas`, `marcar_avisos`, `preferencias_avisos`) e um prompt próprio. Nas consultas, `notas`, `conferencias` e `link_rastreio` só devolvem o que é dele; `estoque` devolve só o disponível para vender. Lançar nota grava sempre em nome dele (o banco também força isso) e cancelar só vale para nota dele. A trava vale no servidor em três pontos: lista de ferramentas enviada à IA, preparo da proposta e execução do token (um token de outra função é recusado com 403).

## Como a IA nunca escreve sozinha
1. As ferramentas de ação só **propõem**: o servidor valida tudo, acha os registros pelo nome e monta o texto do cartão (o texto é do servidor, não da IA).
2. Cada proposta recebe um **token assinado (HMAC-SHA256)** com: quem pediu, qual ação, os dados já validados, validade de 10 minutos e um código único. A chave de assinatura é derivada da chave de serviço e nunca sai do servidor.
3. `executar` confere assinatura, dono, validade e **reserva o código** (tabela `assistente_acoes`): o mesmo Confirmar nunca roda duas vezes. A conferência de carga ainda usa o código como `client_id`.
4. A execução usa o **login de quem confirmou**. As travas do banco (RLS e funções `SECURITY DEFINER`) continuam valendo; o assistente não ganha poder extra.
5. Ações de risco alto (apagar, cancelar, conferir carga, dar acesso de administrador, aplicar ajuste) só valem pelo **botão**; "sim" digitado ou falado só vale para as comuns.
6. Travas: ninguém apaga o próprio cadastro nem tira o próprio acesso; o sistema nunca fica sem administrador; apagar só quem não tem histórico; foto só da própria pasta de quem pergunta.
7. Tudo que foi confirmado fica registrado (quem, o quê, quando, resultado), **sem senhas**. A própria IA consulta com `historico_do_assistente`.
8. Texto vindo de dados, nomes, fotos ou XML é tratado como **dado**, nunca como instrução.

## Opcional
Segredo `ANTHROPIC_MODEL` troca o modelo (padrão `claude-sonnet-5-5`).

## Arquivos
- `index.ts` — casca de 15 linhas que liga na plataforma (`Deno.serve`).
- `nucleo.js` — assinatura, conversa com o Claude, propor/executar, acesso ao Supabase, entrada HTTP.
- `ferramentas-base.js` — erros, utilitários, "achadores" (nome → registro).
- `ferramentas-leitura.js` / `ferramentas-escrita.js` — o que a IA consulta e o que ela pode propor.
- `dominio.js` — cópia das regras do app (`assets/js/dominio.js`), para publicar pela CLI.
- Testes: `node --test tests/assistente.test.js` (41 testes, sem rede) e `tests/dominio.test.js`.

## Como publicar
Pela CLI: `supabase functions deploy assistente` (os arquivos acima já estão na pasta).
Pelo painel/MCP: o `index.ts` publicado importa os **mesmos arquivos do repositório, presos a um commit exato**, em vez de copiá-los:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import "https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/assets/js/dominio.js";
import "https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/supabase/functions/assistente/ferramentas-base.js";
import "https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/supabase/functions/assistente/ferramentas-leitura.js";
import "https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/supabase/functions/assistente/ferramentas-escrita.js";
import "https://raw.githubusercontent.com/joserobertoleitejunior-a11y/NOVA-ERA-/<commit>/supabase/functions/assistente/nucleo.js";
const { montar } = (globalThis as any).NENucleo;
Deno.serve(montar({ createClient, env: Deno.env, fetch }));
```
A ordem dos imports importa (o domínio e a base vêm antes). Se algum desses arquivos mudar, republique apontando para o commit novo.

A função `criar-funcionario` (cadastrar, redefinir senha e **apagar** funcionário) também precisa estar publicada na versão mais recente.
