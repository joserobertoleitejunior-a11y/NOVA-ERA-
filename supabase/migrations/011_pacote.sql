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
