-- 004 — Ficha da equipe (contato, foto, CNH) e da frota (marca, modelo, fotos).
alter table public.perfis
  add column if not exists email_contato text,
  add column if not exists admissao date,
  add column if not exists cnh_validade date,
  add column if not exists observacao text,
  add column if not exists foto text;           -- caminho no bucket privado fotos-cargas

alter table public.veiculos
  add column if not exists marca text,
  add column if not exists modelo text,
  add column if not exists ano integer check (ano is null or (ano between 1980 and 2100)),
  add column if not exists cor text,
  add column if not exists capacidade_t numeric check (capacidade_t is null or capacidade_t > 0),
  add column if not exists descricao text,
  add column if not exists fotos jsonb not null default '[]'::jsonb;  -- [{tipo, caminho}]
