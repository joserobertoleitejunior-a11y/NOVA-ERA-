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
