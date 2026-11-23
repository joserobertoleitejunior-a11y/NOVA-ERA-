-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- CONFERE CARGA · NOVA ERA — SQL COMPLETO (rode UMA vez no SQL Editor do Supabase)
-- Pode rodar de novo sem medo: tudo é "se não existir" / "substitui". Não apaga dados de ninguém,
-- exceto a linha final que limpa o catálogo de produtos de exemplo (veja o fim do arquivo).
-- Inclui: 003 (notas, estoque, contagens, avisos, varredura), 005 (esqueci minha senha), 006 (quem cadastrou), 007 (registro do assistente), 008 (painel do vendedor).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- [003] Fila de notas, estoque (razão), contagens, avisos, configuração e varredura automática.
-- Regras: toda tabela com RLS; ESCRITA só por funções SECURITY DEFINER que validam quem chama;
-- movimentos e conferências são imutáveis (prova). Nada aqui apaga dados.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ───────── Configuração (linha única) e segredos ─────────
create table if not exists public.configuracoes (
  id int primary key default 1 check (id = 1),
  valor jsonb not null default '{"limiteNotaParadaMin":120,"diasContagem":14,"expediente":{"dias":[1,2,3,4,5,6],"inicio":"06:00","fim":"19:00"},"resumoDiarioHora":"18:00"}'::jsonb
);
insert into public.configuracoes (id) values (1) on conflict do nothing;
alter table public.configuracoes enable row level security;
drop policy if exists cfg_ler on public.configuracoes;
create policy cfg_ler on public.configuracoes for select to authenticated using (true);
drop policy if exists cfg_admin on public.configuracoes;
create policy cfg_admin on public.configuracoes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- segredos do servidor (chaves VAPID do push, segredo interno): sem política = ninguém lê pelo app
create table if not exists public.config_segredos (nome text primary key, valor text not null);
alter table public.config_segredos enable row level security;

-- ───────── Notas (fila de conferência) ─────────
create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  cliente text,
  vendedor text,
  chave_nfe text check (chave_nfe is null or chave_nfe ~ '^[0-9]{44}$'),
  status text not null default 'pendente' check (status in ('pendente','em_conferencia','conferida','cancelada')),
  conferencia_id uuid,
  token_publico uuid not null default gen_random_uuid() unique,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis(id)
);
create unique index if not exists notas_numero_ativa on public.notas (numero) where status <> 'cancelada';
create index if not exists notas_status_criado_em_idx on public.notas (status, criado_em);
create table if not exists public.nota_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas(id) on delete cascade,
  produto_id uuid references public.produtos(id),
  descricao text not null,
  codigo text,
  quantidade numeric not null check (quantidade > 0)
);
create index if not exists nota_itens_nota_id_idx on public.nota_itens (nota_id);
do $$ begin alter table public.conferencias add constraint conferencias_nota_fk foreign key (nota_id) references public.notas(id); exception when duplicate_object then null; end $$;
do $$ begin alter table public.notas add constraint notas_conferencia_fk foreign key (conferencia_id) references public.conferencias(id); exception when duplicate_object then null; end $$;

-- ───────── Estoque: razão imutável + saldos ─────────
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id),
  tipo text not null check (tipo in ('entrada','saida','ajuste','perda')),
  quantidade numeric not null check (quantidade <> 0),
  motivo text,
  ref_tipo text,
  ref_id uuid,
  usuario_id uuid default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now()
);
create index if not exists estoque_movimentos_produto_id_criado_em_desc_idx on public.estoque_movimentos (produto_id, criado_em desc);
create index if not exists estoque_movimentos_criado_em_desc_idx on public.estoque_movimentos (criado_em desc);

create table if not exists public.contagens (
  id uuid primary key default gen_random_uuid(),
  escopo text,
  status text not null check (status in ('solicitada','aguardando_aprovacao','aplicada','descartada')),
  criado_por uuid default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now()
);
create table if not exists public.contagem_itens (
  id uuid primary key default gen_random_uuid(),
  contagem_id uuid not null references public.contagens(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  esperado numeric, contado numeric, diferenca numeric
);
create index if not exists contagem_itens_contagem_id_idx on public.contagem_itens (contagem_id);
create index if not exists contagem_itens_produto_id_idx on public.contagem_itens (produto_id);

create or replace view public.estoque_saldos with (security_invoker = true) as
select p.id as produto_id, p.nome, p.unidade, p.minimo, p.por_pilha, p.ativo,
       coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.produto_id = p.id), 0) as saldo,
       (select max(c.criado_em) from public.contagem_itens ci join public.contagens c on c.id = ci.contagem_id
         where ci.produto_id = p.id and ci.contado is not null and c.status in ('aplicada','aguardando_aprovacao')) as ultima_contagem
from public.produtos p;

-- ───────── Avisos e push ─────────
create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.perfis(id) on delete cascade,
  tipo text not null,
  severidade text not null check (severidade in ('critico','atencao','info')),
  titulo text not null,
  texto text not null,
  ref_tipo text, ref_id uuid,
  chave_dedupe text not null default gen_random_uuid()::text,
  criado_em timestamptz not null default now(),
  lido_em timestamptz, resolvido_em timestamptz,
  unique (destinatario_id, chave_dedupe)
);
create index if not exists alertas_destinatario_id_criado_em_desc_idx on public.alertas (destinatario_id, criado_em desc);
create table if not exists public.push_assinaturas (
  endpoint text primary key,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  chaves jsonb not null,
  aparelho text,
  criado_em timestamptz not null default now()
);
create index if not exists push_assinaturas_usuario_id_idx on public.push_assinaturas (usuario_id);

-- ───────── RLS ─────────
alter table public.notas enable row level security;
alter table public.nota_itens enable row level security;
alter table public.estoque_movimentos enable row level security;
alter table public.contagens enable row level security;
alter table public.contagem_itens enable row level security;
alter table public.alertas enable row level security;
alter table public.push_assinaturas enable row level security;

drop policy if exists notas_ler on public.notas;
create policy notas_ler on public.notas for select to authenticated using (true);
drop policy if exists notas_itens_ler on public.nota_itens;
create policy notas_itens_ler on public.nota_itens for select to authenticated using (true);
drop policy if exists notas_admin_cancelar on public.notas;
create policy notas_admin_cancelar on public.notas for update to authenticated using (public.is_admin() and status in ('pendente','em_conferencia')) with check (public.is_admin() and status = 'cancelada');
drop policy if exists mov_ler on public.estoque_movimentos;
create policy mov_ler on public.estoque_movimentos for select to authenticated using (true);
drop policy if exists cont_ler on public.contagens;
create policy cont_ler on public.contagens for select to authenticated using (true);
drop policy if exists contitens_ler on public.contagem_itens;
create policy contitens_ler on public.contagem_itens for select to authenticated using (true);
drop policy if exists alertas_ler on public.alertas;
create policy alertas_ler on public.alertas for select to authenticated using (destinatario_id = (select auth.uid()));
drop policy if exists push_ler on public.push_assinaturas;
create policy push_ler on public.push_assinaturas for select to authenticated using (usuario_id = (select auth.uid()));
-- (sem INSERT/UPDATE/DELETE: tudo passa pelas funções abaixo ou pela função "push")

-- ───────── Funções auxiliares ─────────
create or replace function public.cfg() returns jsonb language sql stable security definer set search_path = public, pg_temp as
$$ select valor from public.configuracoes where id = 1 $$;
revoke execute on function public.cfg() from public, anon; grant execute on function public.cfg() to authenticated;

create or replace function public.fora_expediente(p_ts timestamptz) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c jsonb := public.cfg(); l timestamp := p_ts at time zone 'America/Sao_Paulo'; m int := extract(hour from l)::int * 60 + extract(minute from l)::int;
begin
  if not ((extract(dow from l)::int) in (select jsonb_array_elements_text(c->'expediente'->'dias')::int)) then return true; end if;
  return m < (split_part(c->'expediente'->>'inicio', ':', 1)::int * 60 + split_part(c->'expediente'->>'inicio', ':', 2)::int)
      or m >= (split_part(c->'expediente'->>'fim', ':', 1)::int * 60 + split_part(c->'expediente'->>'fim', ':', 2)::int);
end $$;
revoke execute on function public.fora_expediente(timestamptz) from public, anon; grant execute on function public.fora_expediente(timestamptz) to authenticated;

-- Quem quer receber cada tipo de aviso (padrão por papel quando a pessoa não escolheu)
create or replace function public.emitir_alerta(p_tipo text, p_sev text, p_titulo text, p_texto text, p_ref_tipo text, p_ref_id uuid, p_dedupe text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_admin text[] := array['saida_sem_nota','divergencia_carga','estoque_negativo','estoque_baixo','contagem_divergente','nota_parada','fora_horario','senha_esquecida','resumo_dia','sistema'];
        v_func text[] := array['nota_nova','contagem_solicitada']; v_url text; v_seg text; v_novo uuid;
begin
  for r in select id from public.perfis where ativo and p_tipo = any(coalesce(alertas, case when papel = 'admin' then v_admin else v_func end)) loop
    insert into public.alertas (destinatario_id, tipo, severidade, titulo, texto, ref_tipo, ref_id, chave_dedupe)
    values (r.id, p_tipo, p_sev, p_titulo, p_texto, p_ref_tipo, p_ref_id, coalesce(p_dedupe, gen_random_uuid()::text))
    on conflict (destinatario_id, chave_dedupe) do nothing returning id into v_novo;
    if v_novo is not null then
      begin -- empurra para o celular (Web Push) sem nunca travar a operação principal
        select valor into v_url from public.config_segredos where nome = 'push_url';
        select valor into v_seg from public.config_segredos where nome = 'push_segredo';
        if v_url is not null and v_seg is not null then
          perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type','application/json','x-push-segredo', v_seg),
            body := jsonb_build_object('acao','enviar','usuario_id', r.id,'titulo', p_titulo,'texto', p_texto,'severidade', p_sev,'tag', coalesce(p_dedupe, v_novo::text)));
        end if;
      exception when others then null; end;
    end if;
    v_novo := null;
  end loop;
end $$;
revoke execute on function public.emitir_alerta(text,text,text,text,text,uuid,text) from public, anon, authenticated;

create or replace function public.exigir_ativo() returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null or not exists (select 1 from public.perfis where id = u and ativo) then raise exception 'Faça login novamente.'; end if;
  return u;
end $$;
revoke execute on function public.exigir_ativo() from public, anon; grant execute on function public.exigir_ativo() to authenticated;

-- ───────── Nota nova (administração) ─────────
create or replace function public.criar_nota(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); v_id uuid; v_num text := trim(coalesce(p->>'numero','')); v_n int;
begin
  if not public.is_admin() then raise exception 'Só a administração cadastra notas.'; end if;
  if v_num = '' then raise exception 'Digite o número da nota.'; end if;
  if exists (select 1 from public.notas where numero = v_num and status <> 'cancelada') then raise exception 'A nota % já está no sistema.', v_num; end if;
  select count(*) into v_n from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  if v_n = 0 then raise exception 'A nota precisa de pelo menos um item com quantidade.'; end if;
  insert into public.notas (numero, cliente, vendedor, chave_nfe, criado_por)
  values (v_num, nullif(trim(p->>'cliente'),''), nullif(trim(p->>'vendedor'),''), nullif(p->>'chave_nfe',''), v_uid) returning id into v_id;
  insert into public.nota_itens (nota_id, produto_id, descricao, codigo, quantidade)
  select v_id, nullif(i->>'produto_id','')::uuid, trim(i->>'descricao'), nullif(i->>'codigo',''), (i->>'quantidade')::numeric
  from jsonb_array_elements(p->'itens') i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  perform public.emitir_alerta('nota_nova','info','Nota ' || v_num || ' na fila', coalesce(nullif(trim(p->>'cliente'),'') || '. ', '') || v_n || ' item(ns) para conferir.', 'nota', v_id, 'nota_nova:' || v_id);
  return v_id;
end $$;
revoke execute on function public.criar_nota(jsonb) from public, anon; grant execute on function public.criar_nota(jsonb) to authenticated;

-- ───────── Conferência (atômica, idempotente, com estoque e avisos) ─────────
create or replace function public.registrar_conferencia(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.exigir_ativo(); v_id uuid; v_cid uuid := nullif(p->>'client_id','')::uuid; v_nota public.notas%rowtype;
  v_div boolean; v_mais numeric; v_menos numeric; v_placa text := upper(trim(coalesce(p->>'placa',''))); v_txt text; v_agora timestamptz := now();
  r record; v_saldo numeric; v_dia text := to_char(v_agora at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
begin
  if v_cid is not null then select id into v_id from public.conferencias where client_id = v_cid; if found then return v_id; end if; end if;
  if coalesce(trim(p->>'numero_nota'),'') = '' then raise exception 'Informe o número da nota.'; end if;
  if v_placa = '' then raise exception 'Informe a placa.'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]'::jsonb)) = 0 then raise exception 'Informe ao menos um item.'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p->'fotos','[]'::jsonb)) f where f->>'tipo' = 'carga')
     or not exists (select 1 from jsonb_array_elements(coalesce(p->'fotos','[]'::jsonb)) f where f->>'tipo' = 'placa') then
    raise exception 'As fotos da carga e da placa são obrigatórias.';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'fotos') f where split_part(f->>'caminho','/',1) <> v_uid::text) then raise exception 'Foto inválida.'; end if;
  select coalesce(sum(greatest((i->>'qtd_carregada')::numeric - (i->>'qtd_nota')::numeric, 0)),0), coalesce(sum(greatest((i->>'qtd_nota')::numeric - (i->>'qtd_carregada')::numeric, 0)),0)
    into v_mais, v_menos from jsonb_array_elements(p->'itens') i;
  v_div := (v_mais + v_menos) > 0;
  if v_div and coalesce(trim(p->>'motivo_divergencia'),'') = '' then raise exception 'Explique o motivo da diferença.'; end if;

  if nullif(p->>'nota_id','') is not null then
    select * into v_nota from public.notas where id = (p->>'nota_id')::uuid for update;
    if not found then raise exception 'Nota não encontrada.'; end if;
    if v_nota.status = 'conferida' then raise exception 'A nota % já foi conferida.', v_nota.numero; end if;
    if v_nota.status = 'cancelada' then raise exception 'A nota % foi cancelada.', v_nota.numero; end if;
  else
    select * into v_nota from public.notas where numero = trim(p->>'numero_nota') and status in ('pendente','em_conferencia') for update;
    if not found then
      insert into public.notas (numero, cliente, chave_nfe, criado_por) values (trim(p->>'numero_nota'), nullif(trim(p->>'cliente'),''), nullif(p->>'chave_nfe',''), v_uid) returning * into v_nota;
    end if;
  end if;

  insert into public.conferencias (numero_nota, chave_nfe, veiculo_id, placa, motorista, conferente_id, status, motivo_divergencia, observacao, latitude, longitude, token_publico, nota_id, client_id, cliente, duracao_s, metodo)
  values (v_nota.numero, coalesce(nullif(p->>'chave_nfe',''), v_nota.chave_nfe), nullif(p->>'veiculo_id','')::uuid, v_placa, nullif(trim(p->>'motorista'),''), v_uid, case when v_div then 'divergencia' else 'ok' end,
          nullif(trim(p->>'motivo_divergencia'),''), nullif(trim(p->>'observacao'),''), (p->>'latitude')::double precision, (p->>'longitude')::double precision,
          v_nota.token_publico, v_nota.id, v_cid, v_nota.cliente, nullif(p->>'duracao_s','')::int, case when p->>'metodo' = 'scanner' then 'scanner' else 'passo_a_passo' end)
  returning id into v_id;
  insert into public.conferencia_itens (conferencia_id, produto_id, descricao, qtd_nota, qtd_carregada)
  select v_id, nullif(i->>'produto_id','')::uuid, trim(i->>'descricao'), (i->>'qtd_nota')::numeric, (i->>'qtd_carregada')::numeric from jsonb_array_elements(p->'itens') i;
  insert into public.conferencia_fotos (conferencia_id, tipo, caminho) select v_id, f->>'tipo', f->>'caminho' from jsonb_array_elements(p->'fotos') f;
  update public.notas set status = 'conferida', conferencia_id = v_id where id = v_nota.id;

  insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, ref_tipo, ref_id, usuario_id)
  select (i->>'produto_id')::uuid, 'saida', -sum((i->>'qtd_carregada')::numeric), 'Nota ' || v_nota.numero, 'conferencia', v_id, v_uid
  from jsonb_array_elements(p->'itens') i where nullif(i->>'produto_id','') is not null and (i->>'qtd_carregada')::numeric > 0 group by (i->>'produto_id')::uuid;

  -- avisos
  if v_div then
    select string_agg(trim(i->>'descricao') || ' ' || case when (i->>'qtd_carregada')::numeric > (i->>'qtd_nota')::numeric then '+' else '−' end || abs((i->>'qtd_carregada')::numeric - (i->>'qtd_nota')::numeric)::text, ', ')
      into v_txt from jsonb_array_elements(p->'itens') i where (i->>'qtd_carregada')::numeric <> (i->>'qtd_nota')::numeric;
    perform public.emitir_alerta(case when v_mais > 0 then 'saida_sem_nota' else 'divergencia_carga' end, case when v_mais > 0 then 'critico' else 'atencao' end,
      case when v_mais > 0 then 'Nota ' || v_nota.numero || ': saiu mais do que a nota' else 'Nota ' || v_nota.numero || ': faltou peça na carga' end,
      v_txt || '. Caminhão ' || v_placa || '.' || coalesce(' Motivo informado: ' || nullif(trim(p->>'motivo_divergencia'),'') || '.', ''), 'conferencia', v_id, 'conf:' || v_id || ':dif');
  end if;
  for r in select pr.id, pr.nome, pr.unidade, pr.minimo from public.produtos pr where pr.id in (select (i->>'produto_id')::uuid from jsonb_array_elements(p->'itens') i where nullif(i->>'produto_id','') is not null) loop
    select coalesce(sum(quantidade),0) into v_saldo from public.estoque_movimentos where produto_id = r.id;
    if v_saldo < 0 then perform public.emitir_alerta('estoque_negativo','critico','Estoque negativo: ' || r.nome, 'Depois da nota ' || v_nota.numero || ', o sistema mostra ' || v_saldo || ' ' || r.unidade || ' de ' || r.nome || '. Saiu mais do que foi lançado de entrada. Faça uma contagem.', 'produto', r.id, 'estoque_negativo:' || r.id || ':' || v_dia);
    elsif r.minimo > 0 and v_saldo < r.minimo then perform public.emitir_alerta('estoque_baixo','atencao','Estoque baixo: ' || r.nome, 'Restam ' || v_saldo || ' ' || r.unidade || ' (mínimo ' || r.minimo || '). Hora de programar a produção.', 'produto', r.id, 'estoque_baixo:' || r.id || ':' || v_dia); end if;
  end loop;
  if public.fora_expediente(v_agora) then
    perform public.emitir_alerta('fora_horario','atencao','Conferência fora do expediente (nota ' || v_nota.numero || ')', 'A carga do caminhão ' || v_placa || ' foi conferida às ' || to_char(v_agora at time zone 'America/Sao_Paulo','HH24:MI') || ', fora do horário de trabalho.', 'conferencia', v_id, 'conf:' || v_id || ':horario');
  end if;
  return v_id;
end $$;
revoke execute on function public.registrar_conferencia(jsonb) from public, anon; grant execute on function public.registrar_conferencia(jsonb) to authenticated;

-- ───────── Estoque: lançamentos, contagens, ajustes ─────────
create or replace function public.registrar_movimento_manual(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); q numeric := coalesce((p->>'quantidade')::numeric, 0); t text := p->>'tipo';
begin
  if not public.is_admin() then raise exception 'Só a administração lança movimentos.'; end if;
  if q <= 0 then raise exception 'A quantidade precisa ser maior que zero.'; end if;
  if t not in ('entrada','perda') then raise exception 'Tipo de lançamento inválido.'; end if;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, usuario_id)
  values ((p->>'produto_id')::uuid, t, case when t = 'perda' then -q else q end, coalesce(nullif(trim(p->>'motivo'),''), case when t = 'entrada' then 'Produção' else 'Perda' end), v_uid);
end $$;
revoke execute on function public.registrar_movimento_manual(jsonb) from public, anon; grant execute on function public.registrar_movimento_manual(jsonb) to authenticated;

create or replace function public.pedir_contagem(p_produtos uuid[], p_escopo text default 'Pedido da expedição') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_nomes text;
begin
  perform public.exigir_ativo(); if not public.is_admin() then raise exception 'Só a administração pede contagem.'; end if;
  if coalesce(array_length(p_produtos,1),0) = 0 then raise exception 'Escolha pelo menos um produto.'; end if;
  insert into public.contagens (escopo, status) values (p_escopo, 'solicitada') returning id into v_id;
  insert into public.contagem_itens (contagem_id, produto_id) select v_id, unnest(p_produtos);
  select string_agg(nome, ', ') into v_nomes from public.produtos where id = any(p_produtos);
  perform public.emitir_alerta('contagem_solicitada','info','Contagem de estoque pedida','Contar: ' || v_nomes || '.','contagem', v_id, 'contagem_pedida:' || v_id);
  return v_id;
end $$;
revoke execute on function public.pedir_contagem(uuid[], text) from public, anon; grant execute on function public.pedir_contagem(uuid[], text) to authenticated;

create or replace function public.concluir_contagem(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); v_id uuid := nullif(p->>'solicitacao_id','')::uuid; i jsonb; v_esp numeric; v_dif boolean := false; v_itens jsonb := '[]'::jsonb; v_c numeric; v_status text; v_nome text; v_part text := '';
begin
  if jsonb_array_length(coalesce(p->'itens','[]'::jsonb)) = 0 then raise exception 'Conte pelo menos um produto.'; end if;
  if v_id is not null then
    perform 1 from public.contagens where id = v_id and status = 'solicitada' for update; if not found then raise exception 'Este pedido de contagem já foi respondido.'; end if;
    delete from public.contagem_itens where contagem_id = v_id;
  else insert into public.contagens (escopo, status) values (coalesce(nullif(p->>'escopo',''),'Contagem rápida'), 'solicitada') returning id into v_id; end if;
  for i in select * from jsonb_array_elements(p->'itens') loop
    v_c := (i->>'contado')::numeric; if v_c < 0 then raise exception 'Quantidade contada inválida.'; end if;
    select coalesce(sum(quantidade),0) into v_esp from public.estoque_movimentos where produto_id = (i->>'produto_id')::uuid;
    insert into public.contagem_itens (contagem_id, produto_id, esperado, contado, diferenca) values (v_id, (i->>'produto_id')::uuid, v_esp, v_c, v_c - v_esp);
    v_itens := v_itens || jsonb_build_object('produto_id', i->>'produto_id', 'esperado', v_esp, 'contado', v_c, 'diferenca', v_c - v_esp);
    if v_c <> v_esp then v_dif := true; select nome into v_nome from public.produtos where id = (i->>'produto_id')::uuid; v_part := v_part || case when v_part = '' then '' else ', ' end || v_nome || ' ' || case when v_c > v_esp then '+' else '−' end || abs(v_c - v_esp); end if;
  end loop;
  v_status := case when v_dif then 'aguardando_aprovacao' else 'aplicada' end;
  update public.contagens set status = v_status, criado_por = v_uid, criado_em = now() where id = v_id;
  if v_dif then perform public.emitir_alerta('contagem_divergente','atencao','Contagem com diferença', v_part || '. Aprove o ajuste ou peça nova contagem.','contagem', v_id, 'contagem:' || v_id); end if;
  return jsonb_build_object('id', v_id, 'status', v_status, 'itens', v_itens);
end $$;
revoke execute on function public.concluir_contagem(jsonb) from public, anon; grant execute on function public.concluir_contagem(jsonb) to authenticated;

create or replace function public.aplicar_ajuste_contagem(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo();
begin
  if not public.is_admin() then raise exception 'Só a administração aprova ajustes.'; end if;
  perform 1 from public.contagens where id = p_id and status = 'aguardando_aprovacao' for update; if not found then raise exception 'Esta contagem já foi resolvida.'; end if;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, ref_tipo, ref_id, usuario_id)
  select produto_id, 'ajuste', diferenca, 'Ajuste da contagem', 'contagem', p_id, v_uid from public.contagem_itens where contagem_id = p_id and coalesce(diferenca,0) <> 0;
  update public.contagens set status = 'aplicada' where id = p_id;
  update public.alertas set resolvido_em = now() where ref_tipo = 'contagem' and ref_id = p_id and resolvido_em is null;
end $$;
revoke execute on function public.aplicar_ajuste_contagem(uuid) from public, anon; grant execute on function public.aplicar_ajuste_contagem(uuid) to authenticated;

create or replace function public.descartar_contagem(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.exigir_ativo(); if not public.is_admin() then raise exception 'Só a administração descarta contagens.'; end if;
  update public.contagens set status = 'descartada' where id = p_id and status in ('aguardando_aprovacao','solicitada');
  update public.alertas set resolvido_em = now() where ref_tipo = 'contagem' and ref_id = p_id and resolvido_em is null;
end $$;
revoke execute on function public.descartar_contagem(uuid) from public, anon; grant execute on function public.descartar_contagem(uuid) to authenticated;

-- ───────── Avisos: ler, resolver, preferências ─────────
create or replace function public.marcar_alertas_lidos(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.alertas set lido_em = now() where destinatario_id = public.exigir_ativo() and lido_em is null and (p_ids is null or id = any(p_ids));
end $$;
create or replace function public.resolver_alerta(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.alertas set resolvido_em = now(), lido_em = coalesce(lido_em, now()) where id = p_id and destinatario_id = public.exigir_ativo();
end $$;
create or replace function public.salvar_preferencias(p_alertas text[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.perfis set alertas = p_alertas where id = public.exigir_ativo();
end $$;
revoke execute on function public.marcar_alertas_lidos(uuid[]), public.resolver_alerta(uuid), public.salvar_preferencias(text[]) from public, anon;
grant execute on function public.marcar_alertas_lidos(uuid[]), public.resolver_alerta(uuid), public.salvar_preferencias(text[]) to authenticated;

-- ───────── Varredura automática (a cada 5 min) ─────────
create or replace function public.varredura() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c jsonb := public.cfg(); r record; v_lim int := coalesce((c->>'limiteNotaParadaMin')::int, 120); v_dia text := to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD');
        v_h text := c->>'resumoDiarioHora'; v_min int; v_loc timestamp := now() at time zone 'America/Sao_Paulo'; v_t int; v_d int; v_f int;
begin
  for r in select id, numero, cliente, criado_em from public.notas where status in ('pendente','em_conferencia') and criado_em <= now() - make_interval(mins => v_lim) loop
    perform public.emitir_alerta('nota_parada','atencao','Nota ' || r.numero || ' esperando há ' || (extract(epoch from now() - r.criado_em)/60)::int || ' min', coalesce(r.cliente || '. ', '') || 'Está na fila sem conferência. Limite configurado: ' || v_lim || ' min.','nota', r.id, 'nota_parada:' || r.id);
  end loop;
  for r in select * from public.estoque_saldos where ativo loop
    if r.saldo < 0 then perform public.emitir_alerta('estoque_negativo','critico','Estoque negativo: ' || r.nome, 'O sistema mostra ' || r.saldo || ' ' || r.unidade || '. Faça uma contagem para corrigir.','produto', r.produto_id, 'estoque_negativo:' || r.produto_id || ':' || v_dia);
    elsif r.minimo > 0 and r.saldo < r.minimo then perform public.emitir_alerta('estoque_baixo','atencao','Estoque baixo: ' || r.nome, 'Restam ' || r.saldo || ' ' || r.unidade || ' (mínimo ' || r.minimo || ').','produto', r.produto_id, 'estoque_baixo:' || r.produto_id || ':' || v_dia); end if;
  end loop;
  v_min := split_part(v_h,':',1)::int * 60 + split_part(v_h,':',2)::int;
  if (extract(hour from v_loc)::int * 60 + extract(minute from v_loc)::int) >= v_min then
    select count(*), count(*) filter (where status = 'divergencia') into v_t, v_d from public.conferencias where criado_em >= date_trunc('day', v_loc) at time zone 'America/Sao_Paulo';
    select count(*) into v_f from public.notas where status in ('pendente','em_conferencia');
    perform public.emitir_alerta('resumo_dia','info','Resumo do dia', 'Conferências: ' || v_t || ' (' || v_d || ' com diferença). Fila: ' || v_f || ' nota(s).','painel', null, 'resumo:' || v_dia);
  end if;
end $$;
revoke execute on function public.varredura() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'confere-carga-varredura';
select cron.schedule('confere-carga-varredura', '*/5 * * * *', $$select public.varredura()$$);


-- ═══════════ [005] Esqueci minha senha ═══════════
create or replace function public.pedir_ajuda_senha(p_usuario text, p_nome text default null, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_u text := lower(trim(coalesce(p_usuario, '')));
  v_n text := nullif(left(trim(coalesce(p_nome, '')), 80), '');
  v_m text := nullif(left(trim(coalesce(p_mensagem, '')), 300), '');
  v_nome text; v_janela text;
begin
  if v_u !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Digite o seu usuário.'; end if;
  -- trava geral contra abuso: no máximo 60 pedidos por hora no sistema inteiro
  if (select count(*) from public.alertas where tipo = 'senha_esquecida' and criado_em > now() - interval '1 hour') > 60 then
    raise exception 'Muitos pedidos agora. Fale direto com a expedição.';
  end if;
  select nome into v_nome from public.perfis where usuario = v_u and ativo;
  v_janela := to_char(date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes', 'YYYYMMDDHH24MI'); -- 1 aviso por usuário a cada 10 min
  perform public.emitir_alerta('senha_esquecida', 'atencao', 'Pedido de ajuda para entrar',
    coalesce(v_nome, v_n, v_u) || ' (usuário ' || v_u || ')' || case when v_nome is null then ' — usuário NÃO encontrado, confira o nome' else '' end || ' pediu ajuda com a senha.' || coalesce(' Mensagem: ' || v_m, ''),
    'equipe', null, 'senha:' || v_u || ':' || v_janela);
end $$;
revoke all on function public.pedir_ajuda_senha(text, text, text) from public;
grant execute on function public.pedir_ajuda_senha(text, text, text) to anon, authenticated;


-- ═══════════ [006] Quem cadastrou cada funcionário ═══════════
alter table public.perfis add column if not exists cadastrado_por uuid references public.perfis(id) on delete set null;
create index if not exists perfis_cadastrado_por_idx on public.perfis (cadastrado_por);

create or replace function public.perfis_travar_cadastro() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.cadastrado_por := old.cadastrado_por;  -- ninguém reescreve a história: nem o próprio administrador
  new.criado_em := old.criado_em;
  return new;
end $$;
drop trigger if exists perfis_travar_cadastro on public.perfis;
create trigger perfis_travar_cadastro before update on public.perfis for each row execute function public.perfis_travar_cadastro();



-- ═══════════ [007] Registro do que o assistente (IA) fez ═══════════
-- Cada ação confirmada fica gravada: quem pediu, o que foi, quando e como terminou. Ninguém apaga nem edita esse histórico.
-- O código único de cada confirmação (nonce) também trava repetição: o mesmo "Confirmar" nunca executa duas vezes.
-- Senhas e dados de acesso NUNCA entram aqui (o resumo é montado sem segredos).

create table if not exists public.assistente_acoes (
  id uuid primary key default gen_random_uuid(),
  nonce uuid not null unique,
  usuario_id uuid references public.perfis(id) on delete set null,
  usuario_nome text,
  ferramenta text not null,
  resumo text not null,
  status text not null default 'executando' check (status in ('executando', 'ok', 'erro')),
  resultado jsonb,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index if not exists assistente_acoes_criado_idx on public.assistente_acoes (criado_em desc);

alter table public.assistente_acoes enable row level security;
drop policy if exists assistente_acoes_ver on public.assistente_acoes;
create policy assistente_acoes_ver on public.assistente_acoes for select to authenticated using (public.is_admin());
-- Sem política de escrita: só as duas funções abaixo (que validam quem chama) conseguem gravar.

-- Reserva a confirmação. Devolve false se este código já foi usado (repetição) — nesse caso o servidor NÃO executa.
create or replace function public.assistente_reservar(p_nonce uuid, p_ferramenta text, p_resumo text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); v_nome text; v_n int;
begin
  if not public.is_admin() then raise exception 'Só a administração usa o assistente.'; end if;
  select nome into v_nome from public.perfis where id = v_uid;
  insert into public.assistente_acoes (nonce, usuario_id, usuario_nome, ferramenta, resumo)
  values (p_nonce, v_uid, v_nome, left(coalesce(p_ferramenta, ''), 60), left(coalesce(p_resumo, ''), 1500))
  on conflict (nonce) do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;
revoke execute on function public.assistente_reservar(uuid, text, text) from public, anon;
grant execute on function public.assistente_reservar(uuid, text, text) to authenticated;

-- Fecha o registro com o resultado (ok ou erro). Só quem reservou, e só uma vez.
create or replace function public.assistente_concluir(p_nonce uuid, p_ok boolean, p_resultado jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo();
begin
  update public.assistente_acoes
     set status = case when p_ok then 'ok' else 'erro' end, resultado = p_resultado, concluido_em = now()
   where nonce = p_nonce and usuario_id = v_uid and status = 'executando';
end $$;
revoke execute on function public.assistente_concluir(uuid, boolean, jsonb) from public, anon;
grant execute on function public.assistente_concluir(uuid, boolean, jsonb) to authenticated;


-- ═══════════ [008] Painel do vendedor ═══════════
--  · A nota guarda QUEM vendeu (vendedor_id). O vendedor só lança nota em nome dele; administração pode escolher um vendedor cadastrado.
--  · O vendedor é AVISADO quando a carga da nota dele sai (ou sai com diferença) e quando a nota dele fica parada na fila.
--  · Vendedor deixa de receber os avisos de administração (estoque negativo, fora do expediente, senha esquecida...): só os dele.

alter table public.notas add column if not exists vendedor_id uuid references public.perfis(id) on delete set null;
create index if not exists notas_vendedor_idx on public.notas (vendedor_id, criado_em desc);

-- Nome sem acento, minúsculo, sem espaços repetidos (para achar o vendedor pelo nome escrito na nota)
create or replace function public.nome_simples(p_t text) returns text language sql immutable set search_path = public, pg_temp as $$
  select btrim(regexp_replace(translate(lower(coalesce(p_t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g'))
$$;

-- Acha o vendedor pelo nome ("Wesley" ou "Wesley Costa"). Se houver dois com o mesmo nome ou nenhum, não adivinha.
create or replace function public.perfil_do_vendedor(p_nome text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_n text := public.nome_simples(p_nome); v_ids uuid[];
begin
  if v_n = '' then return null; end if;
  select array_agg(id) into v_ids from public.perfis
   where ativo and funcao = 'vendedor' and (public.nome_simples(nome) = v_n or split_part(public.nome_simples(nome), ' ', 1) = v_n);
  return case when coalesce(array_length(v_ids, 1), 0) = 1 then v_ids[1] end;
end $$;
revoke execute on function public.perfil_do_vendedor(text) from public, anon, authenticated;

-- Avisos: vendedor recebe só os avisos de vendedor (a menos que a própria pessoa escolha outros em "Quais avisos eu quero")
create or replace function public.emitir_alerta(p_tipo text, p_sev text, p_titulo text, p_texto text, p_ref_tipo text, p_ref_id uuid, p_dedupe text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_admin text[] := array['saida_sem_nota','divergencia_carga','estoque_negativo','estoque_baixo','contagem_divergente','nota_parada','fora_horario','senha_esquecida','resumo_dia','sistema'];
        v_func text[] := array['nota_nova','contagem_solicitada']; v_vend text[] := array['minha_carga_saiu','minha_carga_diferenca','minha_nota_parada']; v_url text; v_seg text; v_novo uuid;
begin
  for r in select id from public.perfis where ativo and p_tipo = any(coalesce(alertas, case when funcao = 'vendedor' then v_vend when papel = 'admin' then v_admin else v_func end)) loop
    insert into public.alertas (destinatario_id, tipo, severidade, titulo, texto, ref_tipo, ref_id, chave_dedupe)
    values (r.id, p_tipo, p_sev, p_titulo, p_texto, p_ref_tipo, p_ref_id, coalesce(p_dedupe, gen_random_uuid()::text))
    on conflict (destinatario_id, chave_dedupe) do nothing returning id into v_novo;
    if v_novo is not null then
      begin -- empurra para o celular (Web Push) sem nunca travar a operação principal
        select valor into v_url from public.config_segredos where nome = 'push_url';
        select valor into v_seg from public.config_segredos where nome = 'push_segredo';
        if v_url is not null and v_seg is not null then
          perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type','application/json','x-push-segredo', v_seg),
            body := jsonb_build_object('acao','enviar','usuario_id', r.id,'titulo', p_titulo,'texto', p_texto,'severidade', p_sev,'tag', coalesce(p_dedupe, v_novo::text)));
        end if;
      exception when others then null; end;
    end if;
    v_novo := null;
  end loop;
end $$;

-- O mesmo aviso, mas para UMA pessoa só (respeita o que ela escolheu receber)
create or replace function public.emitir_alerta_para(p_dest uuid, p_tipo text, p_sev text, p_titulo text, p_texto text, p_ref_tipo text, p_ref_id uuid, p_dedupe text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_admin text[] := array['saida_sem_nota','divergencia_carga','estoque_negativo','estoque_baixo','contagem_divergente','nota_parada','fora_horario','senha_esquecida','resumo_dia','sistema'];
        v_func text[] := array['nota_nova','contagem_solicitada']; v_vend text[] := array['minha_carga_saiu','minha_carga_diferenca','minha_nota_parada']; v_url text; v_seg text; v_novo uuid;
begin
  for r in select id from public.perfis where id = p_dest and ativo and p_tipo = any(coalesce(alertas, case when funcao = 'vendedor' then v_vend when papel = 'admin' then v_admin else v_func end)) loop
    insert into public.alertas (destinatario_id, tipo, severidade, titulo, texto, ref_tipo, ref_id, chave_dedupe)
    values (r.id, p_tipo, p_sev, p_titulo, p_texto, p_ref_tipo, p_ref_id, coalesce(p_dedupe, gen_random_uuid()::text))
    on conflict (destinatario_id, chave_dedupe) do nothing returning id into v_novo;
    if v_novo is not null then
      begin
        select valor into v_url from public.config_segredos where nome = 'push_url';
        select valor into v_seg from public.config_segredos where nome = 'push_segredo';
        if v_url is not null and v_seg is not null then
          perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type','application/json','x-push-segredo', v_seg),
            body := jsonb_build_object('acao','enviar','usuario_id', r.id,'titulo', p_titulo,'texto', p_texto,'severidade', p_sev,'tag', coalesce(p_dedupe, v_novo::text)));
        end if;
      exception when others then null; end;
    end if;
    v_novo := null;
  end loop;
end $$;
revoke execute on function public.emitir_alerta_para(uuid, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- Nota nova: guarda o vendedor. Vendedor só lança em nome dele; a administração pode indicar um vendedor cadastrado (vendedor_id ou o nome).
create or replace function public.criar_nota(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); v_id uuid; v_num text := trim(coalesce(p->>'numero','')); v_n int;
        v_func text; v_vid uuid; v_vtxt text := nullif(trim(p->>'vendedor'),'');
begin
  if not public.is_admin() then raise exception 'Só a administração cadastra notas.'; end if;
  if v_num = '' then raise exception 'Digite o número da nota.'; end if;
  if exists (select 1 from public.notas where numero = v_num and status <> 'cancelada') then raise exception 'A nota % já está no sistema.', v_num; end if;
  select count(*) into v_n from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  if v_n = 0 then raise exception 'A nota precisa de pelo menos um item com quantidade.'; end if;
  select funcao into v_func from public.perfis where id = v_uid;
  if v_func = 'vendedor' then v_vid := v_uid;                                   -- vendedor só lança nota em nome dele
  else
    v_vid := nullif(p->>'vendedor_id','')::uuid;
    if v_vid is not null and not exists (select 1 from public.perfis where id = v_vid and funcao = 'vendedor' and ativo) then raise exception 'Esse vendedor não está cadastrado.'; end if;
    if v_vid is null and v_vtxt is not null then v_vid := public.perfil_do_vendedor(v_vtxt); end if;
  end if;
  if v_vid is not null then select nome into v_vtxt from public.perfis where id = v_vid; end if;
  insert into public.notas (numero, cliente, vendedor, vendedor_id, chave_nfe, criado_por)
  values (v_num, nullif(trim(p->>'cliente'),''), v_vtxt, v_vid, nullif(p->>'chave_nfe',''), v_uid) returning id into v_id;
  insert into public.nota_itens (nota_id, produto_id, descricao, codigo, quantidade)
  select v_id, nullif(i->>'produto_id','')::uuid, trim(i->>'descricao'), nullif(i->>'codigo',''), (i->>'quantidade')::numeric
  from jsonb_array_elements(p->'itens') i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  perform public.emitir_alerta('nota_nova','info','Nota ' || v_num || ' na fila', coalesce(nullif(trim(p->>'cliente'),'') || '. ', '') || v_n || ' item(ns) para conferir.', 'nota', v_id, 'nota_nova:' || v_id);
  return v_id;
end $$;

-- Quando a carga da nota é conferida, o vendedor da nota é avisado (saiu / saiu com diferença)
create or replace function public.notas_avisar_vendedor() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dest uuid; c record; v_txt text; v_hora text;
begin
  if new.status <> 'conferida' or old.status = 'conferida' or new.conferencia_id is null then return new; end if;
  v_dest := coalesce(new.vendedor_id, public.perfil_do_vendedor(new.vendedor));
  if v_dest is null then return new; end if;
  select * into c from public.conferencias where id = new.conferencia_id; if not found then return new; end if;
  v_hora := to_char(c.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI');
  if c.status = 'divergencia' then
    select string_agg(trim(descricao) || ' ' || case when qtd_carregada > qtd_nota then '+' else '−' end || trim_scale(abs(qtd_carregada - qtd_nota))::text, ', ') into v_txt
      from public.conferencia_itens where conferencia_id = c.id and qtd_carregada <> qtd_nota;
    perform public.emitir_alerta_para(v_dest, 'minha_carga_diferenca', 'atencao', 'Nota ' || new.numero || ': a carga saiu com diferença',
      coalesce(new.cliente || '. ', '') || coalesce(v_txt, '') || '. Caminhão ' || c.placa || ', às ' || v_hora || '. Avise o cliente antes que ele ligue.', 'conferencia', c.id, 'minha_conf:' || c.id);
  else
    perform public.emitir_alerta_para(v_dest, 'minha_carga_saiu', 'info', 'Nota ' || new.numero || ': a carga saiu',
      coalesce(new.cliente || '. ', '') || 'Conferida às ' || v_hora || ', caminhão ' || c.placa || '. Mande o rastreio para o cliente acompanhar.', 'conferencia', c.id, 'minha_conf:' || c.id);
  end if;
  return new;
end $$;
revoke execute on function public.notas_avisar_vendedor() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'notas_avisar_vendedor' and tgrelid = 'public.notas'::regclass) then
    create trigger notas_avisar_vendedor after update of status on public.notas for each row execute function public.notas_avisar_vendedor();
  end if;
end $$;

-- Varredura (a cada 5 min): além dos avisos de sempre, avisa o vendedor da nota que ficou parada na fila
create or replace function public.varredura() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c jsonb := public.cfg(); r record; v_lim int := coalesce((c->>'limiteNotaParadaMin')::int, 120); v_dia text := to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD');
        v_h text := c->>'resumoDiarioHora'; v_min int; v_loc timestamp := now() at time zone 'America/Sao_Paulo'; v_t int; v_d int; v_f int; v_dest uuid;
begin
  for r in select id, numero, cliente, criado_em, vendedor, vendedor_id from public.notas where status in ('pendente','em_conferencia') and criado_em <= now() - make_interval(mins => v_lim) loop
    perform public.emitir_alerta('nota_parada','atencao','Nota ' || r.numero || ' esperando há ' || (extract(epoch from now() - r.criado_em)/60)::int || ' min', coalesce(r.cliente || '. ', '') || 'Está na fila sem conferência. Limite configurado: ' || v_lim || ' min.','nota', r.id, 'nota_parada:' || r.id);
    v_dest := coalesce(r.vendedor_id, public.perfil_do_vendedor(r.vendedor));
    if v_dest is not null then
      perform public.emitir_alerta_para(v_dest, 'minha_nota_parada', 'atencao', 'Sua nota ' || r.numero || ' ainda não foi carregada', coalesce(r.cliente || '. ', '') || 'Está na fila há ' || (extract(epoch from now() - r.criado_em)/60)::int || ' min sem conferência. Se o cliente está esperando, fale com a expedição.', 'nota', r.id, 'minha_parada:' || r.id);
    end if;
  end loop;
  for r in select * from public.estoque_saldos where ativo loop
    if r.saldo < 0 then perform public.emitir_alerta('estoque_negativo','critico','Estoque negativo: ' || r.nome, 'O sistema mostra ' || r.saldo || ' ' || r.unidade || '. Faça uma contagem para corrigir.','produto', r.produto_id, 'estoque_negativo:' || r.produto_id || ':' || v_dia);
    elsif r.minimo > 0 and r.saldo < r.minimo then perform public.emitir_alerta('estoque_baixo','atencao','Estoque baixo: ' || r.nome, 'Restam ' || r.saldo || ' ' || r.unidade || ' (mínimo ' || r.minimo || ').','produto', r.produto_id, 'estoque_baixo:' || r.produto_id || ':' || v_dia); end if;
  end loop;
  v_min := split_part(v_h,':',1)::int * 60 + split_part(v_h,':',2)::int;
  if (extract(hour from v_loc)::int * 60 + extract(minute from v_loc)::int) >= v_min then
    select count(*), count(*) filter (where status = 'divergencia') into v_t, v_d from public.conferencias where criado_em >= date_trunc('day', v_loc) at time zone 'America/Sao_Paulo';
    select count(*) into v_f from public.notas where status in ('pendente','em_conferencia');
    perform public.emitir_alerta('resumo_dia','info','Resumo do dia', 'Conferências: ' || v_t || ' (' || v_d || ' com diferença). Fila: ' || v_f || ' nota(s).','painel', null, 'resumo:' || v_dia);
  end if;
end $$;

-- (Este arquivo NUNCA apaga nem cria dados: pode ser executado de novo, em qualquer momento, sem risco para o que já está cadastrado.)

-- ═══════════ CONFERÊNCIA (deve listar as tabelas novas e mostrar contagens zeradas) ═══════════
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('notas','nota_itens','estoque_movimentos','contagens','contagem_itens','alertas','push_assinaturas','configuracoes','config_segredos')) as tabelas_novas_de_9,
  (select count(*) from information_schema.routines where routine_schema = 'public' and routine_name in ('criar_nota','registrar_conferencia','registrar_movimento_manual','pedir_contagem','concluir_contagem','aplicar_ajuste_contagem','descartar_contagem','marcar_alertas_lidos','resolver_alerta','salvar_preferencias','varredura','pedir_ajuda_senha','emitir_alerta','exigir_ativo')) as funcoes_de_14,
  (select count(*) from public.produtos) as produtos,
  (select count(*) from public.perfis) as perfis,
  (select count(*) from public.conferencias) as conferencias;

-- 009 · Histórico de atividades
-- Quem fez, quando, qual mercadoria e os dados da nota. Só a administração (diretoria e administrativo) enxerga.
-- O registro é automático (gatilhos no banco): ninguém precisa lembrar de anotar, e nada pode ser editado ou apagado pelo app.

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  usuario_id uuid,                 -- sem chave estrangeira de propósito: o histórico sobrevive ao cadastro
  usuario_nome text not null default 'Sistema',
  usuario_funcao text,
  acao text not null,              -- ex.: nota_lancada, carga_conferida
  categoria text not null,         -- nota, carga, estoque, contagem, produto, caminhao, pessoa, ajuste
  resumo text not null,            -- frase pronta: "Lançou a nota 48213 de JB Obras (3 itens)"
  nota_numero text,
  cliente text,
  ref_tipo text,
  ref_id uuid,
  itens jsonb not null default '[]'::jsonb,     -- [{produto, quantidade, unidade, ...}]
  detalhes jsonb not null default '{}'::jsonb   -- placa, motorista, motivo, antes/depois…
);
create index if not exists atividades_quando_idx on public.atividades (criado_em desc);
create index if not exists atividades_nota_idx on public.atividades (nota_numero);
create index if not exists atividades_usuario_idx on public.atividades (usuario_id, criado_em desc);
create index if not exists atividades_categoria_idx on public.atividades (categoria, criado_em desc);

alter table public.atividades enable row level security;

-- Quem pode ver: administrador ativo com função diretoria ou administrativo.
create or replace function public.pode_ver_historico() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo and papel = 'admin' and funcao in ('diretoria','administrativo'));
$$;
revoke execute on function public.pode_ver_historico() from public, anon; grant execute on function public.pode_ver_historico() to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='atividades' and policyname='atividades_ler') then
    create policy atividades_ler on public.atividades for select to authenticated using (public.pode_ver_historico());
  end if;
end $$;
revoke all on public.atividades from anon, authenticated;
grant select on public.atividades to authenticated;     -- sem insert/update/delete: só os gatilhos escrevem

-- Escreve uma linha. Uso interno (gatilhos e funções do servidor): ninguém de fora chama.
create or replace function public.registrar_atividade(
  p_acao text, p_categoria text, p_resumo text, p_nota text default null, p_cliente text default null,
  p_ref_tipo text default null, p_ref_id uuid default null, p_itens jsonb default '[]'::jsonb, p_detalhes jsonb default '{}'::jsonb,
  p_usuario uuid default null, p_quando timestamptz default now()
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := coalesce(auth.uid(), p_usuario); v_nome text; v_func text;
begin
  if v_uid is not null then select nome, funcao into v_nome, v_func from public.perfis where id = v_uid; end if;
  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  values (p_quando, v_uid, coalesce(v_nome, case when v_uid is null then 'Sistema' else 'Pessoa removida' end), v_func, p_acao, p_categoria, p_resumo, p_nota, p_cliente, p_ref_tipo, p_ref_id, coalesce(p_itens,'[]'::jsonb), coalesce(p_detalhes,'{}'::jsonb));
end $$;
revoke execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) to service_role;

-- O que mudou entre duas versões de uma linha: {campo: {antes, depois}}
create or replace function public.dif_atividade(p_velho jsonb, p_novo jsonb, p_chaves text[]) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('antes', p_velho->k, 'depois', p_novo->k)), '{}'::jsonb)
  from unnest(p_chaves) k where (p_velho->k) is distinct from (p_novo->k);
$$;

create or replace function public.itens_da_nota(p_nota uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ni.descricao), 'quantidade', ni.quantidade, 'unidade', pr.unidade) order by coalesce(pr.nome, ni.descricao)), '[]'::jsonb)
  from public.nota_itens ni left join public.produtos pr on pr.id = ni.produto_id where ni.nota_id = p_nota;
$$;

-- ───────── Notas: lançada (a lista de itens só existe depois do insert da nota, por isso entra na própria função) ─────────
create or replace function public.criar_nota(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.exigir_ativo(); v_id uuid; v_num text := trim(coalesce(p->>'numero','')); v_n int;
        v_func text; v_vid uuid; v_vtxt text := nullif(trim(p->>'vendedor'),'');
begin
  if not public.is_admin() then raise exception 'Só a administração cadastra notas.'; end if;
  if v_num = '' then raise exception 'Digite o número da nota.'; end if;
  if exists (select 1 from public.notas where numero = v_num and status <> 'cancelada') then raise exception 'A nota % já está no sistema.', v_num; end if;
  select count(*) into v_n from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  if v_n = 0 then raise exception 'A nota precisa de pelo menos um item com quantidade.'; end if;
  select funcao into v_func from public.perfis where id = v_uid;
  if v_func = 'vendedor' then v_vid := v_uid;
  else
    v_vid := nullif(p->>'vendedor_id','')::uuid;
    if v_vid is not null and not exists (select 1 from public.perfis where id = v_vid and funcao = 'vendedor' and ativo) then raise exception 'Esse vendedor não está cadastrado.'; end if;
    if v_vid is null and v_vtxt is not null then v_vid := public.perfil_do_vendedor(v_vtxt); end if;
  end if;
  if v_vid is not null then select nome into v_vtxt from public.perfis where id = v_vid; end if;
  insert into public.notas (numero, cliente, vendedor, vendedor_id, chave_nfe, criado_por)
  values (v_num, nullif(trim(p->>'cliente'),''), v_vtxt, v_vid, nullif(p->>'chave_nfe',''), v_uid) returning id into v_id;
  insert into public.nota_itens (nota_id, produto_id, descricao, codigo, quantidade)
  select v_id, nullif(i->>'produto_id','')::uuid, trim(i->>'descricao'), nullif(i->>'codigo',''), (i->>'quantidade')::numeric
  from jsonb_array_elements(p->'itens') i where coalesce((i->>'quantidade')::numeric, 0) > 0;
  perform public.emitir_alerta('nota_nova','info','Nota ' || v_num || ' na fila', coalesce(nullif(trim(p->>'cliente'),'') || '. ', '') || v_n || ' item(ns) para conferir.', 'nota', v_id, 'nota_nova:' || v_id);
  perform public.registrar_atividade('nota_lancada', 'nota',
    'Lançou a nota ' || v_num || coalesce(' de ' || nullif(trim(p->>'cliente'),''), '') || ' (' || v_n || case when v_n = 1 then ' item)' else ' itens)' end,
    v_num, nullif(trim(p->>'cliente'),''), 'nota', v_id, public.itens_da_nota(v_id),
    jsonb_strip_nulls(jsonb_build_object('vendedor', v_vtxt, 'chave_nfe', nullif(p->>'chave_nfe',''))));
  return v_id;
end $$;
revoke execute on function public.criar_nota(jsonb) from public, anon; grant execute on function public.criar_nota(jsonb) to authenticated;

-- ───────── Notas: conferida (carga saiu) ou cancelada ─────────
create or replace function public.atividade_nota_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.conferencias%rowtype; v_itens jsonb; v_dif int; v_fotos int;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'conferida' and new.conferencia_id is not null then
    select * into c from public.conferencias where id = new.conferencia_id;
    select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ci.descricao), 'nota', ci.qtd_nota, 'carregada', ci.qtd_carregada, 'diferenca', ci.qtd_carregada - ci.qtd_nota, 'unidade', pr.unidade) order by coalesce(pr.nome, ci.descricao)), '[]'::jsonb),
           count(*) filter (where ci.qtd_carregada <> ci.qtd_nota)
      into v_itens, v_dif from public.conferencia_itens ci left join public.produtos pr on pr.id = ci.produto_id where ci.conferencia_id = c.id;
    select count(*) into v_fotos from public.conferencia_fotos where conferencia_id = c.id;
    perform public.registrar_atividade(case when c.status = 'divergencia' then 'carga_conferida_diferenca' else 'carga_conferida' end, 'carga',
      'Conferiu a carga da nota ' || new.numero || coalesce(' de ' || new.cliente, '') || ', caminhão ' || c.placa || case when c.status = 'divergencia' then ' (com diferença em ' || v_dif || case when v_dif = 1 then ' item)' else ' itens)' end else ' (tudo conforme)' end,
      new.numero, new.cliente, 'conferencia', c.id, v_itens,
      jsonb_strip_nulls(jsonb_build_object('placa', c.placa, 'motorista', c.motorista, 'situacao', c.status, 'motivo', c.motivo_divergencia, 'observacao', c.observacao,
        'metodo', c.metodo, 'duracao_s', c.duracao_s, 'fotos', v_fotos, 'latitude', c.latitude, 'longitude', c.longitude, 'chave_nfe', c.chave_nfe, 'vendedor', new.vendedor)),
      c.conferente_id, c.criado_em);
  elsif new.status = 'cancelada' then
    perform public.registrar_atividade('nota_cancelada', 'nota', 'Cancelou a nota ' || new.numero || coalesce(' de ' || new.cliente, ''),
      new.numero, new.cliente, 'nota', new.id, public.itens_da_nota(new.id), jsonb_strip_nulls(jsonb_build_object('vendedor', new.vendedor, 'situacao_antes', old.status)));
  end if;
  return new;
end $$;
create or replace trigger atividade_nota_status after update of status on public.notas for each row execute function public.atividade_nota_status();

-- ───────── Estoque: entrada e perda lançadas à mão (a saída da carga já aparece na conferência; ajuste, na contagem) ─────────
create or replace function public.atividade_movimento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pr public.produtos%rowtype;
begin
  if new.tipo not in ('entrada','perda') or new.ref_tipo is not null then return new; end if;
  select * into pr from public.produtos where id = new.produto_id;
  perform public.registrar_atividade(case when new.tipo = 'entrada' then 'estoque_entrada' else 'estoque_perda' end, 'estoque',
    case when new.tipo = 'entrada' then 'Lançou entrada de ' else 'Lançou perda de ' end || abs(new.quantidade) || ' ' || coalesce(pr.unidade,'un') || ' de ' || coalesce(pr.nome,'produto') || coalesce(' (' || new.motivo || ')', ''),
    null, null, 'produto', new.produto_id, jsonb_build_array(jsonb_build_object('produto', pr.nome, 'quantidade', abs(new.quantidade), 'unidade', pr.unidade)),
    jsonb_strip_nulls(jsonb_build_object('motivo', new.motivo)), new.usuario_id, new.criado_em);
  return new;
end $$;
create or replace trigger atividade_movimento after insert on public.estoque_movimentos for each row execute function public.atividade_movimento();

-- ───────── Contagem: pedida (função), feita / ajuste aplicado / descartada (gatilho) ─────────
create or replace function public.pedir_contagem(p_produtos uuid[], p_escopo text default 'Pedido da expedição') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_nomes text; v_itens jsonb;
begin
  perform public.exigir_ativo(); if not public.is_admin() then raise exception 'Só a administração pede contagem.'; end if;
  if coalesce(array_length(p_produtos,1),0) = 0 then raise exception 'Escolha pelo menos um produto.'; end if;
  insert into public.contagens (escopo, status) values (p_escopo, 'solicitada') returning id into v_id;
  insert into public.contagem_itens (contagem_id, produto_id) select v_id, unnest(p_produtos);
  select string_agg(nome, ', '), jsonb_agg(jsonb_build_object('produto', nome, 'unidade', unidade) order by nome) into v_nomes, v_itens from public.produtos where id = any(p_produtos);
  perform public.emitir_alerta('contagem_solicitada','info','Contagem de estoque pedida','Contar: ' || v_nomes || '.','contagem', v_id, 'contagem_pedida:' || v_id);
  perform public.registrar_atividade('contagem_pedida', 'contagem', 'Pediu contagem de ' || v_nomes, null, null, 'contagem', v_id, coalesce(v_itens,'[]'::jsonb), jsonb_build_object('escopo', p_escopo));
  return v_id;
end $$;
revoke execute on function public.pedir_contagem(uuid[], text) from public, anon; grant execute on function public.pedir_contagem(uuid[], text) to authenticated;

create or replace function public.atividade_contagem() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_itens jsonb; v_n int; v_dif int; v_acao text; v_txt text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('produto', pr.nome, 'esperado', ci.esperado, 'contado', ci.contado, 'diferenca', ci.diferenca, 'unidade', pr.unidade) order by pr.nome), '[]'::jsonb),
         count(*), count(*) filter (where coalesce(ci.diferenca,0) <> 0)
    into v_itens, v_n, v_dif from public.contagem_itens ci join public.produtos pr on pr.id = ci.produto_id where ci.contagem_id = new.id;
  if old.status = 'solicitada' and new.status in ('aguardando_aprovacao','aplicada') then
    v_acao := 'contagem_feita'; v_txt := 'Contou o estoque (' || v_n || case when v_n = 1 then ' produto' else ' produtos' end || case when v_dif > 0 then ', diferença em ' || v_dif || ')' else ', tudo certo)' end;
  elsif old.status = 'aguardando_aprovacao' and new.status = 'aplicada' then v_acao := 'ajuste_aplicado'; v_txt := 'Aprovou o ajuste da contagem (' || v_dif || case when v_dif = 1 then ' produto)' else ' produtos)' end;
  elsif new.status = 'descartada' then v_acao := 'contagem_descartada'; v_txt := 'Descartou a contagem';
  else return new; end if;
  perform public.registrar_atividade(v_acao, 'contagem', v_txt, null, null, 'contagem', new.id, v_itens, jsonb_build_object('escopo', new.escopo, 'situacao', new.status), new.criado_por);
  return new;
end $$;
create or replace trigger atividade_contagem after update of status on public.contagens for each row execute function public.atividade_contagem();

-- ───────── Produtos, caminhões, pessoas, ajustes ─────────
create or replace function public.atividade_produto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('produto_cadastrado','produto','Cadastrou o produto ' || new.nome, null, null, 'produto', new.id, '[]'::jsonb, jsonb_build_object('minimo', new.minimo, 'por_pilha', new.por_pilha, 'unidade', new.unidade));
  elsif tg_op = 'UPDATE' then
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['nome','unidade','codigo','minimo','por_pilha','ativo']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'produto_reativado' else 'produto_desativado' end) else 'produto_alterado' end, 'produto',
        case when d ? 'ativo' and not new.ativo then 'Tirou da lista o produto ' when d ? 'ativo' then 'Voltou para a lista o produto ' else 'Alterou o produto ' end || new.nome, null, null, 'produto', new.id, '[]'::jsonb, jsonb_build_object('mudou', d));
    end if;
  else
    perform public.registrar_atividade('produto_apagado','produto','Apagou o produto ' || old.nome, null, null, 'produto', old.id, '[]'::jsonb, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger atividade_produto after insert or update or delete on public.produtos for each row execute function public.atividade_produto();

create or replace function public.atividade_veiculo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('caminhao_cadastrado','caminhao','Cadastrou o caminhão ' || new.placa || coalesce(' (' || nullif(trim(coalesce(new.marca,'') || ' ' || coalesce(new.modelo,'')),'') || ')', ''), null, null, 'veiculo', new.id, '[]'::jsonb, jsonb_strip_nulls(jsonb_build_object('placa', new.placa, 'marca', new.marca, 'modelo', new.modelo, 'ano', new.ano)));
  elsif tg_op = 'UPDATE' then
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['placa','descricao','tipo','marca','modelo','ano','cor','capacidade_t','ativo']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'caminhao_reativado' else 'caminhao_desativado' end) else 'caminhao_alterado' end, 'caminhao',
        case when d ? 'ativo' and not new.ativo then 'Tirou da lista o caminhão ' when d ? 'ativo' then 'Voltou para a lista o caminhão ' else 'Alterou o caminhão ' end || new.placa, null, null, 'veiculo', new.id, '[]'::jsonb, jsonb_build_object('mudou', d));
    end if;
  else
    perform public.registrar_atividade('caminhao_apagado','caminhao','Apagou o caminhão ' || old.placa, null, null, 'veiculo', old.id, '[]'::jsonb, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger atividade_veiculo after insert or update or delete on public.veiculos for each row execute function public.atividade_veiculo();

create or replace function public.atividade_perfil() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('pessoa_cadastrada','pessoa','Cadastrou ' || new.nome || ' (' || coalesce(new.funcao,'sem função') || ')', null, null, 'perfil', new.id, '[]'::jsonb,
      jsonb_strip_nulls(jsonb_build_object('funcao', new.funcao, 'acesso_admin', new.papel = 'admin')), new.cadastrado_por);
  else
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['nome','funcao','papel','ativo','telefone','email_contato','usuario','admissao','cnh_validade','foto']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'pessoa_liberada' else 'pessoa_desativada' end) else 'pessoa_alterada' end, 'pessoa',
        case when d ? 'ativo' and not new.ativo then 'Desativou ' when d ? 'ativo' then 'Liberou de novo ' else 'Alterou o cadastro de ' end || new.nome, null, null, 'perfil', new.id, '[]'::jsonb,
        jsonb_build_object('mudou', d - 'foto' - 'telefone' - 'email_contato' || case when d ? 'foto' then jsonb_build_object('foto', jsonb_build_object('alterada', true)) else '{}'::jsonb end
                           || case when d ? 'telefone' or d ? 'email_contato' then jsonb_build_object('contato', jsonb_build_object('alterado', true)) else '{}'::jsonb end));
    end if;
  end if;
  return new;
end $$;
create or replace trigger atividade_perfil after insert or update on public.perfis for each row execute function public.atividade_perfil();

create or replace function public.atividade_config() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('antes', old.valor->k, 'depois', new.valor->k)), '{}'::jsonb) into d
  from (select jsonb_object_keys(coalesce(old.valor,'{}'::jsonb) || coalesce(new.valor,'{}'::jsonb)) k) t where (old.valor->k) is distinct from (new.valor->k);
  if d <> '{}'::jsonb then
    perform public.registrar_atividade('ajuste_alterado','ajuste','Mudou os ajustes da empresa (' || (select string_agg(k, ', ') from jsonb_object_keys(d) k) || ')', null, null, 'configuracao', null, '[]'::jsonb, jsonb_build_object('mudou', d));
  end if;
  return new;
end $$;
create or replace trigger atividade_config after update on public.configuracoes for each row execute function public.atividade_config();

-- ───────── O que já aconteceu antes desta migração (uma vez só) ─────────
do $$
begin
  if exists (select 1 from public.atividades) then return; end if;
  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  select n.criado_em, n.criado_por, coalesce(p.nome,'Sistema'), p.funcao, 'nota_lancada', 'nota',
         'Lançou a nota ' || n.numero || coalesce(' de ' || n.cliente, '') || ' (' || (select count(*) from public.nota_itens where nota_id = n.id) || ' itens)',
         n.numero, n.cliente, 'nota', n.id, public.itens_da_nota(n.id), jsonb_strip_nulls(jsonb_build_object('vendedor', n.vendedor, 'chave_nfe', n.chave_nfe))
  from public.notas n left join public.perfis p on p.id = n.criado_por;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  select c.criado_em, c.conferente_id, coalesce(p.nome,'Sistema'), p.funcao, case when c.status = 'divergencia' then 'carga_conferida_diferenca' else 'carga_conferida' end, 'carga',
         'Conferiu a carga da nota ' || c.numero_nota || coalesce(' de ' || c.cliente, '') || ', caminhão ' || c.placa || case when c.status = 'divergencia' then ' (com diferença)' else ' (tudo conforme)' end,
         c.numero_nota, c.cliente, 'conferencia', c.id,
         (select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ci.descricao), 'nota', ci.qtd_nota, 'carregada', ci.qtd_carregada, 'diferenca', ci.qtd_carregada - ci.qtd_nota, 'unidade', pr.unidade)), '[]'::jsonb)
            from public.conferencia_itens ci left join public.produtos pr on pr.id = ci.produto_id where ci.conferencia_id = c.id),
         jsonb_strip_nulls(jsonb_build_object('placa', c.placa, 'motorista', c.motorista, 'situacao', c.status, 'motivo', c.motivo_divergencia, 'observacao', c.observacao, 'metodo', c.metodo, 'duracao_s', c.duracao_s,
           'fotos', (select count(*) from public.conferencia_fotos where conferencia_id = c.id), 'chave_nfe', c.chave_nfe))
  from public.conferencias c left join public.perfis p on p.id = c.conferente_id;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, ref_tipo, ref_id, itens, detalhes)
  select m.criado_em, m.usuario_id, coalesce(p.nome,'Sistema'), p.funcao, case when m.tipo = 'entrada' then 'estoque_entrada' else 'estoque_perda' end, 'estoque',
         case when m.tipo = 'entrada' then 'Lançou entrada de ' else 'Lançou perda de ' end || abs(m.quantidade) || ' ' || coalesce(pr.unidade,'un') || ' de ' || pr.nome || coalesce(' (' || m.motivo || ')', ''),
         'produto', m.produto_id, jsonb_build_array(jsonb_build_object('produto', pr.nome, 'quantidade', abs(m.quantidade), 'unidade', pr.unidade)), jsonb_strip_nulls(jsonb_build_object('motivo', m.motivo))
  from public.estoque_movimentos m join public.produtos pr on pr.id = m.produto_id left join public.perfis p on p.id = m.usuario_id
  where m.tipo in ('entrada','perda') and m.ref_tipo is null;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, ref_tipo, ref_id, detalhes)
  select p.criado_em, p.cadastrado_por, coalesce(q.nome, 'Sistema'), q.funcao, 'pessoa_cadastrada', 'pessoa', 'Cadastrou ' || p.nome || ' (' || coalesce(p.funcao,'sem função') || ')', 'perfil', p.id, jsonb_strip_nulls(jsonb_build_object('funcao', p.funcao))
  from public.perfis p left join public.perfis q on q.id = p.cadastrado_por;
end $$;
-- 010 · Histórico: busca por mercadoria, pessoa, nota e cliente (texto sem acento e em minúsculas)
alter table public.atividades add column if not exists busca text;

create or replace function public.texto_busca(p_resumo text, p_nota text, p_cliente text, p_nome text, p_itens jsonb, p_detalhes jsonb) returns text
language sql immutable set search_path = public, pg_temp as $$
  select translate(lower(coalesce(p_resumo,'') || ' ' || coalesce(p_nota,'') || ' ' || coalesce(p_cliente,'') || ' ' || coalesce(p_nome,'') || ' ' || coalesce(p_itens::text,'') || ' ' || coalesce(p_detalhes->>'placa','') || ' ' || coalesce(p_detalhes->>'motorista','')),
                   'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

create or replace function public.registrar_atividade(
  p_acao text, p_categoria text, p_resumo text, p_nota text default null, p_cliente text default null,
  p_ref_tipo text default null, p_ref_id uuid default null, p_itens jsonb default '[]'::jsonb, p_detalhes jsonb default '{}'::jsonb,
  p_usuario uuid default null, p_quando timestamptz default now()
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := coalesce(auth.uid(), p_usuario); v_nome text; v_func text; v_n text;
begin
  if v_uid is not null then select nome, funcao into v_nome, v_func from public.perfis where id = v_uid; end if;
  v_n := coalesce(v_nome, case when v_uid is null then 'Sistema' else 'Pessoa removida' end);
  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes, busca)
  values (p_quando, v_uid, v_n, v_func, p_acao, p_categoria, p_resumo, p_nota, p_cliente, p_ref_tipo, p_ref_id, coalesce(p_itens,'[]'::jsonb), coalesce(p_detalhes,'{}'::jsonb),
          public.texto_busca(p_resumo, p_nota, p_cliente, v_n, p_itens, p_detalhes));
end $$;
revoke execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) to service_role;

update public.atividades set busca = public.texto_busca(resumo, nota_numero, cliente, usuario_nome, itens, detalhes) where busca is null;
-- 011 · Pacote (licença): Básico, Intermediário ou Premium.
-- Só o dono do sistema muda (no editor SQL do Supabase). Nenhum usuário do app consegue gravar aqui.
--   update public.licenca set pacote = 'intermediario', atualizado_em = now() where id = 1;
-- Sem linha (ou antes desta migração) vale Premium: nada some de quem já usa.

create table if not exists public.licenca (
  id int primary key default 1 check (id = 1),
  pacote text not null default 'premium' check (pacote in ('basico','intermediario','premium')),
  atualizado_em timestamptz not null default now()
);
insert into public.licenca (id, pacote) values (1, 'premium') on conflict (id) do nothing;

alter table public.licenca enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'licenca' and policyname = 'licenca_ler') then
    create policy licenca_ler on public.licenca for select to authenticated using (true);
  end if;
end $$;
revoke all on public.licenca from anon, authenticated;
grant select on public.licenca to authenticated;      -- só leitura: sem insert, update nem delete

create or replace function public.pacote_atual() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select pacote from public.licenca where id = 1), 'premium');
$$;
revoke execute on function public.pacote_atual() from public, anon; grant execute on function public.pacote_atual() to authenticated;

-- O histórico de atividades é do Premium: mesmo que alguém abra a tela na marra, o banco não entrega.
-- (O registro continua sendo gravado em todos os pacotes: ao subir para o Premium, o histórico já está lá.)
create or replace function public.pode_ver_historico() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.pacote_atual() = 'premium'
     and exists (select 1 from public.perfis where id = auth.uid() and ativo and papel = 'admin' and funcao in ('diretoria','administrativo'));
$$;
revoke execute on function public.pode_ver_historico() from public, anon; grant execute on function public.pode_ver_historico() to authenticated;
