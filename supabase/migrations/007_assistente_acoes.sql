-- 007 — Registro do que o assistente (IA) fez a pedido da administração.
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
