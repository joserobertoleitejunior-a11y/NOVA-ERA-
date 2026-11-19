# PADRÕES-AGENCIA.md
### VIBE CODING PROCESS — arquivo mestre de padrões
> Criado por José. Regras fixas de **todo projeto** da agência, independente de cliente ou de qual agente/IA executa o código. Se uma sugestão contradiz este arquivo, este arquivo vence.

## 0. Contexto do projeto

```
Projeto: NOVA ERA — App de check-in de carga/descarga + painel admin
Cliente: Nova Era (transportadora, Itapetininga-SP) — CNPJ/razão social: A CONFIRMAR na reunião
Tipo: aplicativo web instalável (PWA) para celular + painel administrativo
Stack: HTML/CSS/JS puro (sem build) + Supabase (Auth, Postgres com RLS, Storage privado) + Netlify
Supabase: projeto "Nova Era Transportes" (sa-east-1) — ref kfazxjertfzoeewfsime
Repositório: github.com/joserobertoleitejunior-a11y/NOVA-ERA-
Projetos-base (SOMENTE LEITURA): Humberto-Imperio-dos-EPS, San-comercio, remop-retifica
Responsável técnico: José (VIBE CODING PROCESS)
Início: 2026-11-19
```

## 1. Governança
- Toda tarefa nasce como **Issue** (`bug`, `melhoria`, `feature`) com critério de pronto.
- Commit: `tipo(escopo): descrição` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Nada direto na `main`: branch de trabalho + PR (só quando o José pedir o PR).
- Pronto = revisado + testado manualmente + sem erro novo + Issue fechada.

## 2. Motion e loading
- Skeleton em tudo que vem do banco; botão com estado "carregando" e desabilitado em ações >300 ms (evita check-in duplicado).
- Estado de erro sempre visível ao usuário (nunca só `console.log`).
- Animações respeitam `prefers-reduced-motion`. Sem libs pesadas: app de campo roda em celular simples e rede ruim.

## 3. Observabilidade, qualidade e testes
- Sentry (DSN em `config.js`, a configurar) + alerta por e-mail em erro crítico.
- Biome para lint; sem `onclick` inline; arquivos separados por responsabilidade.
- Testes: unitários nas regras de negócio, teste de RLS no banco, E2E Playwright do fluxo principal (login → escolher carga → foto → check-in).

## 4. Segurança (não negociável) — reforçada neste projeto
Dados de empresa e de funcionários (CPF, telefone, fotos, localização) são **sigilosos**:
- Nenhum segredo no código. Só a chave pública (publishable/anon) no front; `service_role` jamais.
- **RLS em toda tabela**, escrita junto com a migration.
- Fotos em **bucket privado**; acesso por URL assinada de curta duração, nunca link público.
- Papel `admin` verificado no banco (`is_admin()`), não só escondendo tela.
- Funcionário só vê/cria o que é dele (cargas em que está escalado).
- LGPD: coletar o mínimo (CPF/telefone só se a empresa exigir), aviso de uso de câmera e localização, política de retenção de fotos definida com o cliente.
- Backup do banco configurado e restauração testada antes de entrar em produção.
- 2FA ligado na conta Supabase/GitHub/Netlify do projeto.

## 5. Acessibilidade e responsividade
- Mobile-first (uso real: celular, no pátio, com luva/sol). Botões grandes (≥48 px), contraste AA, HTML semântico, `alt`/`aria-label`.

## 6. Deploy e rollback
- Deploy via Netlify rodando lint + testes antes. Tag da última versão estável sempre identificável.
- Migrations testadas em branch/staging; nunca alterar schema de produção "na mão".

## 7. Checklist de início
- [x] Repositório e este arquivo
- [x] Projeto Supabase criado, schema + RLS aplicados, advisors de segurança verificados
- [x] Sem segredo no código
- [ ] Criar 1º usuário admin (ver README)
- [ ] Sentry, lint (Biome), testes
- [ ] Domínio próprio, Netlify, backup testado
- [ ] Definir com o cliente: quem é admin, política de retenção de fotos, funções dos funcionários

*Arquivo vivo — atualizar conforme o VIBE CODING PROCESS evoluir.*
