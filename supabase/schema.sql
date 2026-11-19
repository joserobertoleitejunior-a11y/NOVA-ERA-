-- NOVA ERA — schema inicial (Supabase / Postgres)
-- Regra da agência: toda tabela nasce com RLS + políticas na mesma migration.
-- Papéis: 'admin' (administração), 'funcionario' (motorista/ajudante/conferente).

create extension if not exists pgcrypto;

-- ───────── Perfis (1 por usuário do Supabase Auth) ─────────
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cpf text,
  telefone text,
  funcao text not null default 'ajudante'
    check (funcao in ('motorista','ajudante','conferente','administrativo')),
  papel text not null default 'funcionario' check (papel in ('admin','funcionario')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin' and ativo);
$$;

-- ───────── Veículos ─────────
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  descricao text,
  ativo boolean not null default true
);

-- ───────── Cargas ─────────
create table public.cargas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,               -- nº/romaneio da carga
  tipo text not null check (tipo in ('carga','descarga')),
  cliente text,
  origem text,
  destino text,
  veiculo_id uuid references public.veiculos(id),
  status text not null default 'agendada'
    check (status in ('agendada','em_andamento','concluida','ocorrencia','cancelada')),
  agendada_para timestamptz,
  observacoes text,
  criado_em timestamptz not null default now()
);

-- ───────── Escala: quem trabalha em qual carga ─────────
create table public.carga_funcionarios (
  carga_id uuid references public.cargas(id) on delete cascade,
  funcionario_id uuid references public.perfis(id) on delete cascade,
  primary key (carga_id, funcionario_id)
);

-- ───────── Check-ins (início/fim/ocorrência, com foto e geolocalização) ─────────
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references public.cargas(id) on delete cascade,
  funcionario_id uuid not null references public.perfis(id),
  etapa text not null check (etapa in ('chegada','inicio','fim','ocorrencia')),
  observacao text,
  latitude double precision,
  longitude double precision,
  criado_em timestamptz not null default now()
);

create table public.checkin_fotos (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  caminho text not null,                      -- caminho no bucket privado 'fotos-cargas'
  criado_em timestamptz not null default now()
);

create index on public.checkins (carga_id, criado_em);
create index on public.checkins (funcionario_id, criado_em);

-- ───────── RLS ─────────
alter table public.perfis enable row level security;
alter table public.veiculos enable row level security;
alter table public.cargas enable row level security;
alter table public.carga_funcionarios enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_fotos enable row level security;

-- perfis: cada um vê o seu; admin vê e edita todos
create policy perfis_ler on public.perfis for select using (id = auth.uid() or public.is_admin());
create policy perfis_admin on public.perfis for all using (public.is_admin()) with check (public.is_admin());

-- veículos: funcionários leem, admin gerencia
create policy veic_ler on public.veiculos for select using (auth.uid() is not null);
create policy veic_admin on public.veiculos for all using (public.is_admin()) with check (public.is_admin());

-- cargas: funcionário só vê as cargas em que está escalado
create policy cargas_ler on public.cargas for select using (
  public.is_admin() or exists (
    select 1 from public.carga_funcionarios cf
    where cf.carga_id = cargas.id and cf.funcionario_id = auth.uid())
);
create policy cargas_admin on public.cargas for all using (public.is_admin()) with check (public.is_admin());

create policy cf_ler on public.carga_funcionarios for select using (funcionario_id = auth.uid() or public.is_admin());
create policy cf_admin on public.carga_funcionarios for all using (public.is_admin()) with check (public.is_admin());

-- check-ins: funcionário cria só em nome próprio e só em carga em que está escalado
create policy checkins_ler on public.checkins for select using (funcionario_id = auth.uid() or public.is_admin());
create policy checkins_criar on public.checkins for insert with check (
  funcionario_id = auth.uid() and exists (
    select 1 from public.carga_funcionarios cf
    where cf.carga_id = checkins.carga_id and cf.funcionario_id = auth.uid())
);
create policy checkins_admin on public.checkins for all using (public.is_admin()) with check (public.is_admin());

create policy fotos_ler on public.checkin_fotos for select using (
  public.is_admin() or exists (select 1 from public.checkins c where c.id = checkin_id and c.funcionario_id = auth.uid())
);
create policy fotos_criar on public.checkin_fotos for insert with check (
  exists (select 1 from public.checkins c where c.id = checkin_id and c.funcionario_id = auth.uid())
);
create policy fotos_admin on public.checkin_fotos for all using (public.is_admin()) with check (public.is_admin());

-- ───────── Storage: bucket PRIVADO para fotos ─────────
insert into storage.buckets (id, name, public) values ('fotos-cargas','fotos-cargas', false)
on conflict (id) do nothing;

-- funcionário envia para a pasta com o próprio id: <uid>/<arquivo>
create policy fotos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-cargas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos-cargas' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Hardening: is_admin() só para usuários logados (policies a usam; anon não precisa)
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
