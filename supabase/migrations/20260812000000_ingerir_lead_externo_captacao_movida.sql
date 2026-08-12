-- ===========================================================================
-- Ingestão de leads externos (app "captacao-movida") — Etapa 1
--
-- Hoje os leads captados pelo captacao-movida (canais Indicação/ViaNuvem) só
-- vão pro banco dele + planilhas. Esta migration cria a porta de entrada
-- desses leads no cotecerto33.
--
-- Distribuição: NÃO usa `trg_distribuir_lead_auto`. O lead é inserido já com
-- `empresa_id = fn_empresa_matriz()` e `responsavel_id = null` — cai direto
-- na fila da Matriz pra distribuição MANUAL (mesmo lugar onde já caem hoje
-- leads sem vendedor de qualquer empresa: `empresa_id` preenchido,
-- `responsavel_id` nulo). Não há regra automática específica pra esses leads
-- por ora; pode vir numa etapa futura.
--
-- Isso também evita o cliente "órfão" (empresa_id null) enquanto a
-- distribuição não resolve: o cliente já nasce com empresa_id = Matriz, nunca
-- null, então não precisa de religação posterior — e não corre risco de
-- violar o índice único (empresa_id, documento) por causa disso.
--
-- Dedup:
--   - CLIENTE por telefone (único campo garantido em qualquer captação de
--     origem; CPF só existe no canal ViaNuvem e nunca é chave de busca).
--   - LEAD por PLACA, escopado a origem='captacao_movida' (índice único
--     funcional em `dados->>'placa'`).
--
-- Concorrência: lock consultivo por telefone/placa dentro da transação
-- (`pg_advisory_xact_lock`) + índice único funcional (placa) garantem que
-- duas chamadas simultâneas com os mesmos dados não dupliquem cliente/lead.
--
-- RPC de borda (como `registrar_premios_quiver`, 20260722205124): só
-- `service_role` executa — o app externo chama com a service role key do
-- cotecerto33, nunca exposta a `anon`/`authenticated`.
-- ===========================================================================

-- índice de apoio pro lookup de dedup por telefone (não único: telefone não
-- é chave global no modelo pré-existente, só na ingestão externa, que
-- serializa via advisory lock).
create index if not exists clientes_telefone_lookup_idx
  on public.clientes (telefone)
  where telefone <> '';

-- ---------- leads: dedup por placa (origem captacao_movida) ----------------
create unique index if not exists leads_captacao_movida_placa_uidx
  on public.leads ((dados->>'placa'))
  where origem = 'captacao_movida';

-- ---------- RPC de ingestão --------------------------------------------------
create or replace function public.ingerir_lead_externo(
  p_nome text,
  p_telefone text,
  p_placa text,
  p_cpf text default null,
  p_dados jsonb default '{}'::jsonb
)
returns table(lead_id uuid, criado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_telefone text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '\s', '', 'g'));
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_dados jsonb;
  v_cliente_id uuid;
  v_lead_id uuid;
  v_criado boolean;
  v_matriz_id uuid;
begin
  if v_nome = '' then raise exception 'nome é obrigatório'; end if;
  if char_length(v_nome) > 150 then raise exception 'nome excede o tamanho máximo (150)'; end if;
  if v_telefone = '' then raise exception 'telefone é obrigatório'; end if;
  if char_length(v_telefone) > 20 then raise exception 'telefone excede o tamanho máximo (20)'; end if;
  if v_placa = '' then raise exception 'placa é obrigatória'; end if;
  if v_cpf is not null and char_length(v_cpf) not in (11, 14) then
    raise exception 'cpf/cnpj com tamanho inválido';
  end if;

  select empresa_id into v_matriz_id from public.fn_empresa_matriz() limit 1;
  if v_matriz_id is null then
    raise exception 'empresa matriz não configurada';
  end if;

  -- ---------- cliente: dedup por telefone (lock serializa concorrência) ----
  perform pg_advisory_xact_lock(hashtextextended('ingerir_lead_externo:cliente:' || v_telefone, 0));

  select c.id into v_cliente_id
    from public.clientes c
   where c.telefone = v_telefone
   order by c.criado_em asc
   limit 1;

  if v_cliente_id is null then
    insert into public.clientes (empresa_id, nome, documento, telefone)
    values (v_matriz_id, v_nome, v_cpf, v_telefone)
    returning id into v_cliente_id;
  else
    update public.clientes
       set nome = coalesce(nullif(v_nome, ''), nome),
           documento = coalesce(nullif(documento, ''), v_cpf)
     where id = v_cliente_id;
  end if;

  -- ---------- lead: dedup por placa (índice único cobre concorrência) ------
  v_dados := coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('placa', v_placa);
  if v_cpf is not null then
    v_dados := v_dados || jsonb_build_object('cpf', v_cpf);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ingerir_lead_externo:placa:' || v_placa, 0));

  -- empresa_id já vem preenchido (Matriz) e responsavel_id nulo: o lead cai
  -- direto na fila da Matriz pra distribuição manual — trg_distribuir_lead_auto
  -- não age (só distribui quando empresa_id e responsavel_id vêm nulos).
  insert into public.leads (origem, nome, contato, dados, empresa_id, responsavel_id, cliente_id)
  values ('captacao_movida', v_nome, v_telefone, v_dados, v_matriz_id, null, v_cliente_id)
  on conflict ((dados->>'placa')) where origem = 'captacao_movida'
  do nothing
  returning id into v_lead_id;

  if v_lead_id is not null then
    v_criado := true;
  else
    v_criado := false;
    update public.leads l
       set nome = v_nome,
           dados = l.dados || v_dados,
           cliente_id = coalesce(l.cliente_id, v_cliente_id),
           atualizado_em = now()
     where l.origem = 'captacao_movida' and l.dados->>'placa' = v_placa
     returning l.id into v_lead_id;
  end if;

  return query select v_lead_id, v_criado;
end;
$$;

comment on function public.ingerir_lead_externo(text, text, text, text, jsonb) is
  'Porta de entrada dos leads do app captacao-movida. Dedup de cliente por
   telefone, de lead por placa (origem=captacao_movida). Insere sempre com
   empresa_id = fn_empresa_matriz() e responsavel_id nulo — cai na fila de
   distribuição manual da Matriz, sem passar por trg_distribuir_lead_auto.';

revoke all on function public.ingerir_lead_externo(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingerir_lead_externo(text, text, text, text, jsonb) to service_role;
