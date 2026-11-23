-- 008 — Painel do vendedor.
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
