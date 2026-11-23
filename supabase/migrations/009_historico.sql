-- 009 · Histórico de atividades
-- Quem fez, quando, qual mercadoria e os dados da nota. Só a administração (diretoria e administrativo) enxerga.
-- O registro é automático (gatilhos no banco): ninguém precisa lembrar de anotar, e nada pode ser editado ou apagado pelo app.

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  usuario_id uuid,                 -- sem chave estrangeira de propósito: o histórico sobrevive ao cadastro
  usuario_nome text not null default 'Sistema',
  usuario_funcao text,
  acao text not null,              -- ex.: nota_lancada, carga_conferida
  categoria text not null,         -- nota, carga, estoque, contagem, produto, caminhao, pessoa, ajuste
  resumo text not null,            -- frase pronta: "Lançou a nota 48213 de JB Obras (3 itens)"
  nota_numero text,
  cliente text,
  ref_tipo text,
  ref_id uuid,
  itens jsonb not null default '[]'::jsonb,     -- [{produto, quantidade, unidade, ...}]
  detalhes jsonb not null default '{}'::jsonb   -- placa, motorista, motivo, antes/depois…
);
create index if not exists atividades_quando_idx on public.atividades (criado_em desc);
create index if not exists atividades_nota_idx on public.atividades (nota_numero);
create index if not exists atividades_usuario_idx on public.atividades (usuario_id, criado_em desc);
create index if not exists atividades_categoria_idx on public.atividades (categoria, criado_em desc);

alter table public.atividades enable row level security;

-- Quem pode ver: administrador ativo com função diretoria ou administrativo.
create or replace function public.pode_ver_historico() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo and papel = 'admin' and funcao in ('diretoria','administrativo'));
$$;
revoke execute on function public.pode_ver_historico() from public, anon; grant execute on function public.pode_ver_historico() to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='atividades' and policyname='atividades_ler') then
    create policy atividades_ler on public.atividades for select to authenticated using (public.pode_ver_historico());
  end if;
end $$;
revoke all on public.atividades from anon, authenticated;
grant select on public.atividades to authenticated;     -- sem insert/update/delete: só os gatilhos escrevem

-- Escreve uma linha. Uso interno (gatilhos e funções do servidor): ninguém de fora chama.
create or replace function public.registrar_atividade(
  p_acao text, p_categoria text, p_resumo text, p_nota text default null, p_cliente text default null,
  p_ref_tipo text default null, p_ref_id uuid default null, p_itens jsonb default '[]'::jsonb, p_detalhes jsonb default '{}'::jsonb,
  p_usuario uuid default null, p_quando timestamptz default now()
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := coalesce(auth.uid(), p_usuario); v_nome text; v_func text;
begin
  if v_uid is not null then select nome, funcao into v_nome, v_func from public.perfis where id = v_uid; end if;
  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  values (p_quando, v_uid, coalesce(v_nome, case when v_uid is null then 'Sistema' else 'Pessoa removida' end), v_func, p_acao, p_categoria, p_resumo, p_nota, p_cliente, p_ref_tipo, p_ref_id, coalesce(p_itens,'[]'::jsonb), coalesce(p_detalhes,'{}'::jsonb));
end $$;
revoke execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_atividade(text,text,text,text,text,text,uuid,jsonb,jsonb,uuid,timestamptz) to service_role;

-- O que mudou entre duas versões de uma linha: {campo: {antes, depois}}
create or replace function public.dif_atividade(p_velho jsonb, p_novo jsonb, p_chaves text[]) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('antes', p_velho->k, 'depois', p_novo->k)), '{}'::jsonb)
  from unnest(p_chaves) k where (p_velho->k) is distinct from (p_novo->k);
$$;

create or replace function public.itens_da_nota(p_nota uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ni.descricao), 'quantidade', ni.quantidade, 'unidade', pr.unidade) order by coalesce(pr.nome, ni.descricao)), '[]'::jsonb)
  from public.nota_itens ni left join public.produtos pr on pr.id = ni.produto_id where ni.nota_id = p_nota;
$$;

-- ───────── Notas: lançada (a lista de itens só existe depois do insert da nota, por isso entra na própria função) ─────────
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
  if v_func = 'vendedor' then v_vid := v_uid;
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
  perform public.registrar_atividade('nota_lancada', 'nota',
    'Lançou a nota ' || v_num || coalesce(' de ' || nullif(trim(p->>'cliente'),''), '') || ' (' || v_n || case when v_n = 1 then ' item)' else ' itens)' end,
    v_num, nullif(trim(p->>'cliente'),''), 'nota', v_id, public.itens_da_nota(v_id),
    jsonb_strip_nulls(jsonb_build_object('vendedor', v_vtxt, 'chave_nfe', nullif(p->>'chave_nfe',''))));
  return v_id;
end $$;
revoke execute on function public.criar_nota(jsonb) from public, anon; grant execute on function public.criar_nota(jsonb) to authenticated;

-- ───────── Notas: conferida (carga saiu) ou cancelada ─────────
create or replace function public.atividade_nota_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.conferencias%rowtype; v_itens jsonb; v_dif int; v_fotos int;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'conferida' and new.conferencia_id is not null then
    select * into c from public.conferencias where id = new.conferencia_id;
    select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ci.descricao), 'nota', ci.qtd_nota, 'carregada', ci.qtd_carregada, 'diferenca', ci.qtd_carregada - ci.qtd_nota, 'unidade', pr.unidade) order by coalesce(pr.nome, ci.descricao)), '[]'::jsonb),
           count(*) filter (where ci.qtd_carregada <> ci.qtd_nota)
      into v_itens, v_dif from public.conferencia_itens ci left join public.produtos pr on pr.id = ci.produto_id where ci.conferencia_id = c.id;
    select count(*) into v_fotos from public.conferencia_fotos where conferencia_id = c.id;
    perform public.registrar_atividade(case when c.status = 'divergencia' then 'carga_conferida_diferenca' else 'carga_conferida' end, 'carga',
      'Conferiu a carga da nota ' || new.numero || coalesce(' de ' || new.cliente, '') || ', caminhão ' || c.placa || case when c.status = 'divergencia' then ' (com diferença em ' || v_dif || case when v_dif = 1 then ' item)' else ' itens)' end else ' (tudo conforme)' end,
      new.numero, new.cliente, 'conferencia', c.id, v_itens,
      jsonb_strip_nulls(jsonb_build_object('placa', c.placa, 'motorista', c.motorista, 'situacao', c.status, 'motivo', c.motivo_divergencia, 'observacao', c.observacao,
        'metodo', c.metodo, 'duracao_s', c.duracao_s, 'fotos', v_fotos, 'latitude', c.latitude, 'longitude', c.longitude, 'chave_nfe', c.chave_nfe, 'vendedor', new.vendedor)),
      c.conferente_id, c.criado_em);
  elsif new.status = 'cancelada' then
    perform public.registrar_atividade('nota_cancelada', 'nota', 'Cancelou a nota ' || new.numero || coalesce(' de ' || new.cliente, ''),
      new.numero, new.cliente, 'nota', new.id, public.itens_da_nota(new.id), jsonb_strip_nulls(jsonb_build_object('vendedor', new.vendedor, 'situacao_antes', old.status)));
  end if;
  return new;
end $$;
create or replace trigger atividade_nota_status after update of status on public.notas for each row execute function public.atividade_nota_status();

-- ───────── Estoque: entrada e perda lançadas à mão (a saída da carga já aparece na conferência; ajuste, na contagem) ─────────
create or replace function public.atividade_movimento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pr public.produtos%rowtype;
begin
  if new.tipo not in ('entrada','perda') or new.ref_tipo is not null then return new; end if;
  select * into pr from public.produtos where id = new.produto_id;
  perform public.registrar_atividade(case when new.tipo = 'entrada' then 'estoque_entrada' else 'estoque_perda' end, 'estoque',
    case when new.tipo = 'entrada' then 'Lançou entrada de ' else 'Lançou perda de ' end || abs(new.quantidade) || ' ' || coalesce(pr.unidade,'un') || ' de ' || coalesce(pr.nome,'produto') || coalesce(' (' || new.motivo || ')', ''),
    null, null, 'produto', new.produto_id, jsonb_build_array(jsonb_build_object('produto', pr.nome, 'quantidade', abs(new.quantidade), 'unidade', pr.unidade)),
    jsonb_strip_nulls(jsonb_build_object('motivo', new.motivo)), new.usuario_id, new.criado_em);
  return new;
end $$;
create or replace trigger atividade_movimento after insert on public.estoque_movimentos for each row execute function public.atividade_movimento();

-- ───────── Contagem: pedida (função), feita / ajuste aplicado / descartada (gatilho) ─────────
create or replace function public.pedir_contagem(p_produtos uuid[], p_escopo text default 'Pedido da expedição') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_nomes text; v_itens jsonb;
begin
  perform public.exigir_ativo(); if not public.is_admin() then raise exception 'Só a administração pede contagem.'; end if;
  if coalesce(array_length(p_produtos,1),0) = 0 then raise exception 'Escolha pelo menos um produto.'; end if;
  insert into public.contagens (escopo, status) values (p_escopo, 'solicitada') returning id into v_id;
  insert into public.contagem_itens (contagem_id, produto_id) select v_id, unnest(p_produtos);
  select string_agg(nome, ', '), jsonb_agg(jsonb_build_object('produto', nome, 'unidade', unidade) order by nome) into v_nomes, v_itens from public.produtos where id = any(p_produtos);
  perform public.emitir_alerta('contagem_solicitada','info','Contagem de estoque pedida','Contar: ' || v_nomes || '.','contagem', v_id, 'contagem_pedida:' || v_id);
  perform public.registrar_atividade('contagem_pedida', 'contagem', 'Pediu contagem de ' || v_nomes, null, null, 'contagem', v_id, coalesce(v_itens,'[]'::jsonb), jsonb_build_object('escopo', p_escopo));
  return v_id;
end $$;
revoke execute on function public.pedir_contagem(uuid[], text) from public, anon; grant execute on function public.pedir_contagem(uuid[], text) to authenticated;

create or replace function public.atividade_contagem() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_itens jsonb; v_n int; v_dif int; v_acao text; v_txt text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('produto', pr.nome, 'esperado', ci.esperado, 'contado', ci.contado, 'diferenca', ci.diferenca, 'unidade', pr.unidade) order by pr.nome), '[]'::jsonb),
         count(*), count(*) filter (where coalesce(ci.diferenca,0) <> 0)
    into v_itens, v_n, v_dif from public.contagem_itens ci join public.produtos pr on pr.id = ci.produto_id where ci.contagem_id = new.id;
  if old.status = 'solicitada' and new.status in ('aguardando_aprovacao','aplicada') then
    v_acao := 'contagem_feita'; v_txt := 'Contou o estoque (' || v_n || case when v_n = 1 then ' produto' else ' produtos' end || case when v_dif > 0 then ', diferença em ' || v_dif || ')' else ', tudo certo)' end;
  elsif old.status = 'aguardando_aprovacao' and new.status = 'aplicada' then v_acao := 'ajuste_aplicado'; v_txt := 'Aprovou o ajuste da contagem (' || v_dif || case when v_dif = 1 then ' produto)' else ' produtos)' end;
  elsif new.status = 'descartada' then v_acao := 'contagem_descartada'; v_txt := 'Descartou a contagem';
  else return new; end if;
  perform public.registrar_atividade(v_acao, 'contagem', v_txt, null, null, 'contagem', new.id, v_itens, jsonb_build_object('escopo', new.escopo, 'situacao', new.status), new.criado_por);
  return new;
end $$;
create or replace trigger atividade_contagem after update of status on public.contagens for each row execute function public.atividade_contagem();

-- ───────── Produtos, caminhões, pessoas, ajustes ─────────
create or replace function public.atividade_produto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('produto_cadastrado','produto','Cadastrou o produto ' || new.nome, null, null, 'produto', new.id, '[]'::jsonb, jsonb_build_object('minimo', new.minimo, 'por_pilha', new.por_pilha, 'unidade', new.unidade));
  elsif tg_op = 'UPDATE' then
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['nome','unidade','codigo','minimo','por_pilha','ativo']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'produto_reativado' else 'produto_desativado' end) else 'produto_alterado' end, 'produto',
        case when d ? 'ativo' and not new.ativo then 'Tirou da lista o produto ' when d ? 'ativo' then 'Voltou para a lista o produto ' else 'Alterou o produto ' end || new.nome, null, null, 'produto', new.id, '[]'::jsonb, jsonb_build_object('mudou', d));
    end if;
  else
    perform public.registrar_atividade('produto_apagado','produto','Apagou o produto ' || old.nome, null, null, 'produto', old.id, '[]'::jsonb, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger atividade_produto after insert or update or delete on public.produtos for each row execute function public.atividade_produto();

create or replace function public.atividade_veiculo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('caminhao_cadastrado','caminhao','Cadastrou o caminhão ' || new.placa || coalesce(' (' || nullif(trim(coalesce(new.marca,'') || ' ' || coalesce(new.modelo,'')),'') || ')', ''), null, null, 'veiculo', new.id, '[]'::jsonb, jsonb_strip_nulls(jsonb_build_object('placa', new.placa, 'marca', new.marca, 'modelo', new.modelo, 'ano', new.ano)));
  elsif tg_op = 'UPDATE' then
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['placa','descricao','tipo','marca','modelo','ano','cor','capacidade_t','ativo']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'caminhao_reativado' else 'caminhao_desativado' end) else 'caminhao_alterado' end, 'caminhao',
        case when d ? 'ativo' and not new.ativo then 'Tirou da lista o caminhão ' when d ? 'ativo' then 'Voltou para a lista o caminhão ' else 'Alterou o caminhão ' end || new.placa, null, null, 'veiculo', new.id, '[]'::jsonb, jsonb_build_object('mudou', d));
    end if;
  else
    perform public.registrar_atividade('caminhao_apagado','caminhao','Apagou o caminhão ' || old.placa, null, null, 'veiculo', old.id, '[]'::jsonb, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger atividade_veiculo after insert or update or delete on public.veiculos for each row execute function public.atividade_veiculo();

create or replace function public.atividade_perfil() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_atividade('pessoa_cadastrada','pessoa','Cadastrou ' || new.nome || ' (' || coalesce(new.funcao,'sem função') || ')', null, null, 'perfil', new.id, '[]'::jsonb,
      jsonb_strip_nulls(jsonb_build_object('funcao', new.funcao, 'acesso_admin', new.papel = 'admin')), new.cadastrado_por);
  else
    d := public.dif_atividade(to_jsonb(old), to_jsonb(new), array['nome','funcao','papel','ativo','telefone','email_contato','usuario','admissao','cnh_validade','foto']);
    if d <> '{}'::jsonb then
      perform public.registrar_atividade(case when d ? 'ativo' then (case when new.ativo then 'pessoa_liberada' else 'pessoa_desativada' end) else 'pessoa_alterada' end, 'pessoa',
        case when d ? 'ativo' and not new.ativo then 'Desativou ' when d ? 'ativo' then 'Liberou de novo ' else 'Alterou o cadastro de ' end || new.nome, null, null, 'perfil', new.id, '[]'::jsonb,
        jsonb_build_object('mudou', d - 'foto' - 'telefone' - 'email_contato' || case when d ? 'foto' then jsonb_build_object('foto', jsonb_build_object('alterada', true)) else '{}'::jsonb end
                           || case when d ? 'telefone' or d ? 'email_contato' then jsonb_build_object('contato', jsonb_build_object('alterado', true)) else '{}'::jsonb end));
    end if;
  end if;
  return new;
end $$;
create or replace trigger atividade_perfil after insert or update on public.perfis for each row execute function public.atividade_perfil();

create or replace function public.atividade_config() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('antes', old.valor->k, 'depois', new.valor->k)), '{}'::jsonb) into d
  from (select jsonb_object_keys(coalesce(old.valor,'{}'::jsonb) || coalesce(new.valor,'{}'::jsonb)) k) t where (old.valor->k) is distinct from (new.valor->k);
  if d <> '{}'::jsonb then
    perform public.registrar_atividade('ajuste_alterado','ajuste','Mudou os ajustes da empresa (' || (select string_agg(k, ', ') from jsonb_object_keys(d) k) || ')', null, null, 'configuracao', null, '[]'::jsonb, jsonb_build_object('mudou', d));
  end if;
  return new;
end $$;
create or replace trigger atividade_config after update on public.configuracoes for each row execute function public.atividade_config();

-- ───────── O que já aconteceu antes desta migração (uma vez só) ─────────
do $$
begin
  if exists (select 1 from public.atividades) then return; end if;
  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  select n.criado_em, n.criado_por, coalesce(p.nome,'Sistema'), p.funcao, 'nota_lancada', 'nota',
         'Lançou a nota ' || n.numero || coalesce(' de ' || n.cliente, '') || ' (' || (select count(*) from public.nota_itens where nota_id = n.id) || ' itens)',
         n.numero, n.cliente, 'nota', n.id, public.itens_da_nota(n.id), jsonb_strip_nulls(jsonb_build_object('vendedor', n.vendedor, 'chave_nfe', n.chave_nfe))
  from public.notas n left join public.perfis p on p.id = n.criado_por;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, nota_numero, cliente, ref_tipo, ref_id, itens, detalhes)
  select c.criado_em, c.conferente_id, coalesce(p.nome,'Sistema'), p.funcao, case when c.status = 'divergencia' then 'carga_conferida_diferenca' else 'carga_conferida' end, 'carga',
         'Conferiu a carga da nota ' || c.numero_nota || coalesce(' de ' || c.cliente, '') || ', caminhão ' || c.placa || case when c.status = 'divergencia' then ' (com diferença)' else ' (tudo conforme)' end,
         c.numero_nota, c.cliente, 'conferencia', c.id,
         (select coalesce(jsonb_agg(jsonb_build_object('produto', coalesce(pr.nome, ci.descricao), 'nota', ci.qtd_nota, 'carregada', ci.qtd_carregada, 'diferenca', ci.qtd_carregada - ci.qtd_nota, 'unidade', pr.unidade)), '[]'::jsonb)
            from public.conferencia_itens ci left join public.produtos pr on pr.id = ci.produto_id where ci.conferencia_id = c.id),
         jsonb_strip_nulls(jsonb_build_object('placa', c.placa, 'motorista', c.motorista, 'situacao', c.status, 'motivo', c.motivo_divergencia, 'observacao', c.observacao, 'metodo', c.metodo, 'duracao_s', c.duracao_s,
           'fotos', (select count(*) from public.conferencia_fotos where conferencia_id = c.id), 'chave_nfe', c.chave_nfe))
  from public.conferencias c left join public.perfis p on p.id = c.conferente_id;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, ref_tipo, ref_id, itens, detalhes)
  select m.criado_em, m.usuario_id, coalesce(p.nome,'Sistema'), p.funcao, case when m.tipo = 'entrada' then 'estoque_entrada' else 'estoque_perda' end, 'estoque',
         case when m.tipo = 'entrada' then 'Lançou entrada de ' else 'Lançou perda de ' end || abs(m.quantidade) || ' ' || coalesce(pr.unidade,'un') || ' de ' || pr.nome || coalesce(' (' || m.motivo || ')', ''),
         'produto', m.produto_id, jsonb_build_array(jsonb_build_object('produto', pr.nome, 'quantidade', abs(m.quantidade), 'unidade', pr.unidade)), jsonb_strip_nulls(jsonb_build_object('motivo', m.motivo))
  from public.estoque_movimentos m join public.produtos pr on pr.id = m.produto_id left join public.perfis p on p.id = m.usuario_id
  where m.tipo in ('entrada','perda') and m.ref_tipo is null;

  insert into public.atividades (criado_em, usuario_id, usuario_nome, usuario_funcao, acao, categoria, resumo, ref_tipo, ref_id, detalhes)
  select p.criado_em, p.cadastrado_por, coalesce(q.nome, 'Sistema'), q.funcao, 'pessoa_cadastrada', 'pessoa', 'Cadastrou ' || p.nome || ' (' || coalesce(p.funcao,'sem função') || ')', 'perfil', p.id, jsonb_strip_nulls(jsonb_build_object('funcao', p.funcao))
  from public.perfis p left join public.perfis q on q.id = p.cadastrado_por;
end $$;
