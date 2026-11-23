// Assistente da Nova Era (Claude). Roda SÓ no servidor: a chave da Anthropic nunca vai para o app.
// Toda a lógica está em nucleo.js e ferramentas-*.js (testada em Node: tests/assistente.test.js). Este arquivo só liga na plataforma.
//   · "perguntar" — só administração. Consulta dados reais e PREPARA ações (cadastrar, lançar nota, conferir carga...). Nada é gravado na pergunta.
//   · "executar"  — roda uma ação preparada, só com o token assinado do botão Confirmar, com o login de quem confirmou.
//   · "ler_nota"  — quem confere carga (e a administração): foto da nota → número, cliente e itens.
//   · "status"    — diz se a IA está ligada (chave configurada) e para quem.
import { createClient } from "jsr:@supabase/supabase-js@2";
import "./dominio.js";
import "./pacote.js";
import "./ferramentas-base.js";
import "./ferramentas-leitura.js";
import "./ferramentas-escrita.js";
import "./nucleo.js";

// deno-lint-ignore no-explicit-any
const { montar } = (globalThis as any).NENucleo;
Deno.serve(montar({ createClient, env: Deno.env, fetch }));
