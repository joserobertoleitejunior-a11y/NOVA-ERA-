-- 005 — "Esqueci minha senha": quem não consegue entrar manda um aviso direto para os administradores.
-- Pode ser chamada SEM login (por isso valida o texto, limita o volume e não revela se o usuário existe).
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
