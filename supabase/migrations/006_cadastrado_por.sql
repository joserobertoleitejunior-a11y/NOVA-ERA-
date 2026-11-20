-- 006 — Registro de QUEM cadastrou cada funcionário (auditoria). Quem e quando ficam gravados e não podem ser alterados depois.
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
