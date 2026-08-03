-- ===========================================================================
-- V11 · G6.1 (Frente 6) — gate de diretor nos "botões Salvar política"
--
-- 4 RPCs (uma por tabela), cada uma: monta o DE/PARA, chama
-- fn_registrar_alteracao (V11.0.5/V11.0.6 — gate de diretor + histórico
-- imutável) e só então grava. Mesmo padrão de fn_salvar_regua_performance
-- (D2, Frente 4).
--
-- Escopo é literal ao "botão Salvar", não "toda escrita na tabela":
--   - modelos_franquia: só revoga UPDATE. "Adicionar modelo"/"Remover" são
--     uma ação distinta (criar/apagar um tipo de modelo, não editar
--     parâmetros de um existente) e continuam via RLS matriz-only, como já
--     eram — fora do escopo desta task.
--   - clt_config: revoga tudo (não existe insert/delete na tela; é 1 linha
--     fixa, id='default').
--   - desconto_politicas / respostas_padrao: revoga tudo — aqui TODAS as
--     mutações da tela (upsert/delete de política, criar/editar/ativar/
--     excluir resposta) são "a política", sem uma ação distinta como a de
--     modelos_franquia.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) modelos_franquia — só UPDATE (parâmetros de modelos existentes)
-- ---------------------------------------------------------------------------
drop policy if exists modelos_admin on public.modelos_franquia;
create policy modelos_admin on public.modelos_franquia
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));
revoke update on public.modelos_franquia from authenticated;

create or replace function public.fn_salvar_modelos_franquia(p_senha text, p_modelos jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _de_para jsonb := '[]'::jsonb;
  _item jsonb;
  _antes public.modelos_franquia;
  _novo_nome text;
  _novo_ordem int;
  _nova_modalidade text;
begin
  for _item in select * from jsonb_array_elements(p_modelos)
  loop
    select * into _antes from public.modelos_franquia where id = (_item->>'id')::uuid;
    if _antes is null then continue; end if;

    _novo_nome := _item->>'nome';
    _novo_ordem := (_item->>'ordem')::int;
    _nova_modalidade := _item->>'modalidade';

    if _antes.nome is distinct from _novo_nome then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Modelo %s · nome', _antes.nome), 'de', _antes.nome, 'para', _novo_nome));
    end if;
    if _antes.ordem is distinct from _novo_ordem then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Modelo %s · ordem', _antes.nome), 'de', _antes.ordem::text, 'para', _novo_ordem::text));
    end if;
    if _antes.modalidade is distinct from _nova_modalidade then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Modelo %s · modalidade', _antes.nome), 'de', coalesce(_antes.modalidade, '—'), 'para', coalesce(_nova_modalidade, '—')));
    end if;
    if _antes.params is distinct from (_item->'params') then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Modelo %s · parâmetros', _antes.nome), 'de', _antes.params::text, 'para', (_item->'params')::text));
    end if;
  end loop;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Modelos de franquia',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  for _item in select * from jsonb_array_elements(p_modelos)
  loop
    update public.modelos_franquia
       set nome = _item->>'nome',
           ordem = (_item->>'ordem')::int,
           modalidade = _item->>'modalidade',
           params = _item->'params'
     where id = (_item->>'id')::uuid;
  end loop;
end;
$function$;

revoke all on function public.fn_salvar_modelos_franquia(text, jsonb) from public, anon;
grant execute on function public.fn_salvar_modelos_franquia(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) clt_config — linha única (id='default')
-- ---------------------------------------------------------------------------
drop policy if exists clt_admin on public.clt_config;
revoke insert, update, delete on public.clt_config from authenticated;

create or replace function public.fn_salvar_clt_config(
  p_senha text,
  p_progressiva jsonb,
  p_fator_novas jsonb,
  p_fator_remalho jsonb,
  p_seguradora_planos jsonb,
  p_seguradora_adic jsonb,
  p_regras jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes public.clt_config;
  _de_para jsonb := '[]'::jsonb;
begin
  select * into _antes from public.clt_config where id = 'default';
  if _antes is null then
    raise exception 'Configuração CLT não encontrada.';
  end if;

  if _antes.progressiva is distinct from p_progressiva then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · comissão progressiva', 'de', _antes.progressiva::text, 'para', p_progressiva::text));
  end if;
  if _antes.fator_novas is distinct from p_fator_novas then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · fator novas vendas', 'de', _antes.fator_novas::text, 'para', p_fator_novas::text));
  end if;
  if _antes.fator_remalho is distinct from p_fator_remalho then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · fator remalho', 'de', _antes.fator_remalho::text, 'para', p_fator_remalho::text));
  end if;
  if _antes.seguradora_planos is distinct from p_seguradora_planos then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · seguradora (planos)', 'de', _antes.seguradora_planos::text, 'para', p_seguradora_planos::text));
  end if;
  if _antes.seguradora_adic is distinct from p_seguradora_adic then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · seguradora (adicionais)', 'de', _antes.seguradora_adic::text, 'para', p_seguradora_adic::text));
  end if;
  if _antes.regras is distinct from p_regras then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'CLT · regras gerais', 'de', _antes.regras::text, 'para', p_regras::text));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Modelo CLT',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  update public.clt_config
     set progressiva = p_progressiva,
         fator_novas = p_fator_novas,
         fator_remalho = p_fator_remalho,
         seguradora_planos = p_seguradora_planos,
         seguradora_adic = p_seguradora_adic,
         regras = p_regras,
         atualizado_em = now()
   where id = 'default';
end;
$function$;

revoke all on function public.fn_salvar_clt_config(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.fn_salvar_clt_config(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) desconto_politicas — grade seguradora × modelo (upsert + delete)
-- ---------------------------------------------------------------------------
drop policy if exists desconto_politicas_write_matriz on public.desconto_politicas;
revoke insert, update, delete on public.desconto_politicas from authenticated;

create or replace function public.fn_salvar_desconto_politicas(
  p_senha text,
  p_upsert jsonb,
  p_delete jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _de_para jsonb := '[]'::jsonb;
  _item jsonb;
  _antes numeric;
  _seg_nome text;
begin
  for _item in select * from jsonb_array_elements(p_upsert)
  loop
    select pct_maximo into _antes
      from public.desconto_politicas
     where modelo = _item->>'modelo' and seguradora_id = (_item->>'seguradora_id')::uuid;
    select nome into _seg_nome from public.seguradoras where id = (_item->>'seguradora_id')::uuid;
    if _antes is distinct from (_item->>'pct_maximo')::numeric then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Alçada · %s × %s', _item->>'modelo', coalesce(_seg_nome, '?')),
        'de', coalesce(_antes::text, '—'), 'para', _item->>'pct_maximo'));
    end if;
  end loop;

  for _item in select * from jsonb_array_elements(p_delete)
  loop
    select pct_maximo into _antes
      from public.desconto_politicas
     where modelo = _item->>'modelo' and seguradora_id = (_item->>'seguradora_id')::uuid;
    if _antes is not null then
      select nome into _seg_nome from public.seguradoras where id = (_item->>'seguradora_id')::uuid;
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Alçada · %s × %s', _item->>'modelo', coalesce(_seg_nome, '?')),
        'de', _antes::text, 'para', '—'));
    end if;
  end loop;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Política de alçada (desconto máximo)',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  if jsonb_array_length(p_upsert) > 0 then
    insert into public.desconto_politicas (modelo, seguradora_id, pct_maximo)
    select x.modelo, x.seguradora_id, x.pct_maximo
      from jsonb_to_recordset(p_upsert) as x(modelo text, seguradora_id uuid, pct_maximo numeric)
    on conflict (modelo, seguradora_id) do update set pct_maximo = excluded.pct_maximo, atualizado_em = now();
  end if;

  if jsonb_array_length(p_delete) > 0 then
    delete from public.desconto_politicas dp
     using jsonb_to_recordset(p_delete) as x(modelo text, seguradora_id uuid)
     where dp.modelo = x.modelo and dp.seguradora_id = x.seguradora_id;
  end if;
end;
$function$;

revoke all on function public.fn_salvar_desconto_politicas(text, jsonb, jsonb) from public, anon;
grant execute on function public.fn_salvar_desconto_politicas(text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) respostas_padrao — upsert (criar/editar/ativar-desativar) + excluir
-- ---------------------------------------------------------------------------
drop policy if exists respostas_padrao_write_matriz on public.respostas_padrao;
revoke insert, update, delete on public.respostas_padrao from authenticated;

create or replace function public.fn_salvar_resposta_padrao(
  p_senha text,
  p_titulo text,
  p_texto text,
  p_ativo boolean,
  p_id uuid default null,
  p_seguradora_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes public.respostas_padrao;
  _de_para jsonb := '[]'::jsonb;
  _id uuid;
begin
  if p_id is not null then
    select * into _antes from public.respostas_padrao where id = p_id;
    if _antes is null then
      raise exception 'Resposta padrão não encontrada.';
    end if;
    if _antes.titulo is distinct from p_titulo then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', 'Resposta padrão · título', 'de', _antes.titulo, 'para', p_titulo));
    end if;
    if _antes.texto is distinct from p_texto then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Resposta padrão "%s" · texto', _antes.titulo), 'de', _antes.texto, 'para', p_texto));
    end if;
    if _antes.seguradora_id is distinct from p_seguradora_id then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Resposta padrão "%s" · seguradora', _antes.titulo), 'de', coalesce(_antes.seguradora_id::text, 'geral'), 'para', coalesce(p_seguradora_id::text, 'geral')));
    end if;
    if _antes.ativo is distinct from p_ativo then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Resposta padrão "%s" · ativa', _antes.titulo), 'de', _antes.ativo::text, 'para', p_ativo::text));
    end if;
  else
    _de_para := jsonb_build_array(jsonb_build_object(
      'campo', 'Resposta padrão · criada', 'de', '—', 'para', p_titulo));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Respostas padrão',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  if p_id is not null then
    update public.respostas_padrao
       set titulo = p_titulo, texto = p_texto, seguradora_id = p_seguradora_id, ativo = p_ativo
     where id = p_id;
    _id := p_id;
  else
    insert into public.respostas_padrao (titulo, texto, seguradora_id, ativo)
    values (p_titulo, p_texto, p_seguradora_id, p_ativo)
    returning id into _id;
  end if;

  return _id;
end;
$function$;

revoke all on function public.fn_salvar_resposta_padrao(text, text, text, boolean, uuid, uuid) from public, anon;
grant execute on function public.fn_salvar_resposta_padrao(text, text, text, boolean, uuid, uuid) to authenticated;

create or replace function public.fn_excluir_resposta_padrao(p_senha text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes public.respostas_padrao;
begin
  select * into _antes from public.respostas_padrao where id = p_id;
  if _antes is null then
    raise exception 'Resposta padrão não encontrada.';
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Respostas padrão',
    p_senha,
    jsonb_build_array(jsonb_build_object(
      'campo', 'Resposta padrão · excluída', 'de', _antes.titulo, 'para', '—')),
    null
  );

  delete from public.respostas_padrao where id = p_id;
end;
$function$;

revoke all on function public.fn_excluir_resposta_padrao(text, uuid) from public, anon;
grant execute on function public.fn_excluir_resposta_padrao(text, uuid) to authenticated;
