-- 002 — "Confere Carga": conferência nota × carga na expedição
-- Foco definido na reunião de 19/11: o problema é sair produto a mais do que está na nota.
-- Rastreamento/etapas de viagem saem (a empresa já tem rastreador).
-- Regra de prova: conferência, itens e fotos NÃO podem ser alterados nem apagados por ninguém.

drop table if exists public.checkin_fotos, public.checkins, public.carga_funcionarios, public.cargas cascade;

-- Perfis: login por "usuário" (funcionário não precisa ter e-mail)
alter table public.perfis add column usuario text unique;
alter table public.perfis drop constraint if exists perfis_funcao_check;
alter table public.perfis alter column funcao set default 'conferente';
alter table public.perfis add constraint perfis_funcao_check
  check (funcao in ('conferente','motorista','ajudante','expedicao','diretoria','administrativo'));

-- Veículos com tipo
alter table public.veiculos add column tipo text not null default 'caminhao'
  check (tipo in ('caminhao','truck_munck','betoneira','basculante','outro'));

-- Catálogo de produtos (nomes padrão para conferir mais rápido)
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  unidade text not null default 'un',
  ativo boolean not null default true
);

create table public.conferencias (
  id uuid primary key default gen_random_uuid(),
  numero_nota text not null,
  veiculo_id uuid references public.veiculos(id),
  placa text not null,
  motorista text,
  conferente_id uuid not null default auth.uid() references public.perfis(id),
  status text not null check (status in ('ok','divergencia')),
  motivo_divergencia text,
  observacao text,
  latitude double precision,
  longitude double precision,
  criado_em timestamptz not null default now()
);
create index on public.conferencias (criado_em desc);
create index on public.conferencias (conferente_id);
create index on public.conferencias (veiculo_id);

create table public.conferencia_itens (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias(id) on delete cascade,
  produto_id uuid references public.produtos(id),
  descricao text not null,
  qtd_nota numeric not null check (qtd_nota >= 0),
  qtd_carregada numeric not null check (qtd_carregada >= 0)
);
create index on public.conferencia_itens (conferencia_id);
create index on public.conferencia_itens (produto_id);

create table public.conferencia_fotos (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias(id) on delete cascade,
  tipo text not null check (tipo in ('nota','carga','placa','avaria')),
  caminho text not null
);
create index on public.conferencia_fotos (conferencia_id);

-- RLS
alter table public.produtos enable row level security;
alter table public.conferencias enable row level security;
alter table public.conferencia_itens enable row level security;
alter table public.conferencia_fotos enable row level security;

create policy prod_ler on public.produtos for select to authenticated using (true);
create policy prod_admin on public.produtos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Somente leitura e inserção: sem políticas de UPDATE/DELETE = registro imutável (prova)
create policy conf_ler on public.conferencias for select to authenticated
  using (conferente_id = (select auth.uid()) or public.is_admin());
create policy conf_criar on public.conferencias for insert to authenticated
  with check (conferente_id = (select auth.uid())
    and exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.ativo));

create policy itens_ler on public.conferencia_itens for select to authenticated using (
  exists (select 1 from public.conferencias c where c.id = conferencia_id
          and (c.conferente_id = (select auth.uid()) or public.is_admin())));
create policy itens_criar on public.conferencia_itens for insert to authenticated with check (
  exists (select 1 from public.conferencias c where c.id = conferencia_id and c.conferente_id = (select auth.uid())));

create policy cfotos_ler on public.conferencia_fotos for select to authenticated using (
  exists (select 1 from public.conferencias c where c.id = conferencia_id
          and (c.conferente_id = (select auth.uid()) or public.is_admin())));
create policy cfotos_criar on public.conferencia_fotos for insert to authenticated with check (
  exists (select 1 from public.conferencias c where c.id = conferencia_id and c.conferente_id = (select auth.uid()))
  and split_part(caminho, '/', 1) = (select auth.uid())::text);

-- Registro atômico: conferência + itens + fotos numa transação; status calculado no banco
create or replace function public.registrar_conferencia(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_div boolean;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Faça login novamente.'; end if;
  if coalesce(trim(p->>'numero_nota'), '') = '' then raise exception 'Informe o número da nota.'; end if;
  if coalesce(trim(p->>'placa'), '') = '' then raise exception 'Informe a placa.'; end if;
  if jsonb_array_length(coalesce(p->'itens', '[]'::jsonb)) = 0 then raise exception 'Informe ao menos um item.'; end if;
  if not exists (select 1 from jsonb_array_elements(p->'fotos') f where f->>'tipo' = 'carga')
     or not exists (select 1 from jsonb_array_elements(p->'fotos') f where f->>'tipo' = 'placa') then
    raise exception 'As fotos da carga e da placa são obrigatórias.';
  end if;

  select bool_or((i->>'qtd_nota')::numeric <> (i->>'qtd_carregada')::numeric)
    into v_div from jsonb_array_elements(p->'itens') i;
  if v_div and coalesce(trim(p->>'motivo_divergencia'), '') = '' then
    raise exception 'Explique o motivo da diferença.';
  end if;

  insert into conferencias (numero_nota, veiculo_id, placa, motorista, conferente_id, status,
                            motivo_divergencia, observacao, latitude, longitude)
  values (trim(p->>'numero_nota'), nullif(p->>'veiculo_id', '')::uuid, upper(trim(p->>'placa')),
          nullif(trim(p->>'motorista'), ''), v_uid, case when v_div then 'divergencia' else 'ok' end,
          nullif(trim(p->>'motivo_divergencia'), ''), nullif(trim(p->>'observacao'), ''),
          (p->>'latitude')::double precision, (p->>'longitude')::double precision)
  returning id into v_id;

  insert into conferencia_itens (conferencia_id, produto_id, descricao, qtd_nota, qtd_carregada)
  select v_id, nullif(i->>'produto_id', '')::uuid, trim(i->>'descricao'),
         (i->>'qtd_nota')::numeric, (i->>'qtd_carregada')::numeric
  from jsonb_array_elements(p->'itens') i;

  insert into conferencia_fotos (conferencia_id, tipo, caminho)
  select v_id, f->>'tipo', f->>'caminho' from jsonb_array_elements(p->'fotos') f;

  return v_id;
end $$;

revoke execute on function public.registrar_conferencia(jsonb) from public, anon;
grant execute on function public.registrar_conferencia(jsonb) to authenticated;

-- Produtos iniciais (do site da empresa) — ajustar com o Eduardo
insert into public.produtos (nome) values
  ('Boca de lobo'), ('Meio-fio'), ('Guia'), ('Caixa para galeria'), ('Caixa de inspeção'),
  ('Tubo de concreto'), ('Aduela'), ('Dissipador'), ('Ala'), ('Laje')
on conflict (nome) do nothing;
