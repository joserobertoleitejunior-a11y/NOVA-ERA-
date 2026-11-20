-- 002 — "Confere Carga": conferência nota × carga na expedição
-- Foco definido na reunião de 19/11: o problema é sair produto a mais do que está na nota.
-- Rastreamento/etapas de viagem saem (a empresa já tem rastreador).
-- Regra de prova: conferência, itens e fotos NÃO podem ser alterados nem apagados por ninguém.

-- (as tabelas do primeiro desenho — cargas, checkins… — ficam sem uso; nenhuma tabela é apagada aqui)

-- Perfis: login por "usuário" (funcionário não precisa ter e-mail)
alter table public.perfis add column usuario text unique;
alter table public.perfis add column alertas text[];  -- quais avisos a pessoa quer receber (null = padrão do papel)
alter table public.perfis add column if not exists telefone text;
alter table public.perfis drop constraint if exists perfis_funcao_check;
alter table public.perfis alter column funcao set default 'conferente';
alter table public.perfis add constraint perfis_funcao_check
  check (funcao in ('conferente','motorista','ajudante','expedicao','vendedor','diretoria','administrativo'));

-- Veículos com tipo
alter table public.veiculos add column tipo text not null default 'caminhao'
  check (tipo in ('caminhao','truck_munck','betoneira','basculante','outro'));

-- Catálogo de produtos (nomes padrão para conferir mais rápido)
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  unidade text not null default 'un',
  codigo text,
  minimo numeric not null default 0 check (minimo >= 0),
  por_pilha numeric check (por_pilha is null or por_pilha > 0),
  ativo boolean not null default true
);

create table public.conferencias (
  id uuid primary key default gen_random_uuid(),
  numero_nota text not null,
  chave_nfe text check (chave_nfe ~ '^[0-9]{44}$'), -- chave de acesso lida do código de barras da DANFE
  veiculo_id uuid references public.veiculos(id),
  placa text not null,
  motorista text,
  conferente_id uuid not null default auth.uid() references public.perfis(id),
  status text not null check (status in ('ok','divergencia')),
  motivo_divergencia text,
  observacao text,
  latitude double precision,
  longitude double precision,
  criado_em timestamptz not null default now(),
  -- código secreto do link de rastreio do cliente (só a função "rastreio" lê por ele)
  token_publico uuid not null default gen_random_uuid() unique,
  nota_id uuid,                       -- nota da fila (003)
  client_id uuid unique,              -- idempotência: o app reenvia sem duplicar
  cliente text,
  duracao_s integer check (duracao_s is null or duracao_s >= 0),
  metodo text not null default 'passo_a_passo' check (metodo in ('passo_a_passo','scanner'))
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

-- Somente leitura: sem políticas de INSERT/UPDATE/DELETE, o registro é imutável (prova); a escrita é pela função da 003
create policy conf_ler on public.conferencias for select to authenticated
  using (conferente_id = (select auth.uid()) or public.is_admin());

create policy itens_ler on public.conferencia_itens for select to authenticated using (
  exists (select 1 from public.conferencias c where c.id = conferencia_id
          and (c.conferente_id = (select auth.uid()) or public.is_admin())));
create policy cfotos_ler on public.conferencia_fotos for select to authenticated using (
  exists (select 1 from public.conferencias c where c.id = conferencia_id
          and (c.conferente_id = (select auth.uid()) or public.is_admin())));

-- A gravação da conferência é feita SÓ pela função registrar_conferencia (003): atômica, idempotente e com estoque/avisos.

-- Produtos iniciais (do site da empresa) — ajustar com o Eduardo
insert into public.produtos (nome) values
  ('Boca de lobo'), ('Meio-fio'), ('Guia'), ('Caixa para galeria'), ('Caixa de inspeção'),
  ('Tubo de concreto'), ('Aduela'), ('Dissipador'), ('Ala'), ('Laje')
on conflict (nome) do nothing;
