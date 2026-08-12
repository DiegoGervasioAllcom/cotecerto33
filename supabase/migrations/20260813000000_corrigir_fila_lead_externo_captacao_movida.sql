-- ===========================================================================
-- Correção: leads do captacao-movida devem cair na fila GLOBAL sem vendedor
-- (empresa_id null, responsavel_id null) — igual a qualquer outro lead sem
-- vendedor no sistema (mesmo padrão do G6/renovação) — em vez de forçar
-- empresa_id = fn_empresa_matriz() como a versão anterior fazia
-- (20260812000000_ingerir_lead_externo_captacao_movida.sql).
--
-- Por quê: a tela de Leads da Matriz (comando/leads.tsx) considera um lead
-- "já distribuído" só por ter empresa_id preenchido — leads forçados pra
-- Matriz apareciam como "atribuídos" em vez de cair na fila pendente. A fila
-- oficial de distribuição (distribuir_fila_pendente / trg_distribuir_lead_auto,
-- 20240101000024_distribuicao_automatica.sql) só processa leads com
-- empresa_id IS NULL — é essa fila que permite a Matriz distribuir
-- manualmente pra vendedor de QUALQUER empresa/franquia da rede (não só
-- dentro da Matriz).
--
-- Reabre o problema do cliente "órfão" (empresa_id null) enquanto a
-- distribuição não resolve: aceito como estado equivalente ao do próprio
-- lead pendente. RLS já cobre (clientes_select / leads_select têm ramo
-- has_role(matriz) incondicional — Matriz sempre vê empresa_id is null,
-- confirmado em 20260804120000_v11_i_escopo_interno_matriz.sql).
--
-- Proteção adicionada: a religação de clientes.empresa_id (quando o trigger
-- resolve uma empresa pro lead) pode colidir com o índice único parcial
-- clientes_empresa_documento_uidx (empresa_id, documento) where documento <>
-- ''. Protegida com begin/exception (unique_violation) — se colidir, a
-- religação é pulada e o cliente permanece com empresa_id null, sem estourar
-- a transação/perder o lead.
-- ===========================================================================

-- clientes.empresa_id volta a ser nullable: cliente pode nascer órfão
-- enquanto a distribuição do lead não resolve empresa.
alter table public.clientes alter column empresa_id drop not null;

create or replace function public.ingerir_lead_externo(
  record jsonb,
  type text default null,
  "table" text default null,
  schema text default null,
  old_record jsonb default null
)
returns table(lead_id uuid, criado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record jsonb := coalesce(record, '{}'::jsonb);
  v_nome text := trim(coalesce(v_record->>'nome_cliente', ''));
  v_telefone text := regexp_replace(coalesce(v_record->>'telefone', ''), '\D', '', 'g');
  v_placa text := upper(regexp_replace(coalesce(v_record->>'placa', ''), '\s', '', 'g'));
  v_cpf text := nullif(regexp_replace(coalesce(v_record->>'cpf', ''), '\D', '', 'g'), '');
  v_dados jsonb;
  v_cliente_id uuid;
  v_lead_id uuid;
  v_criado boolean;
  v_lead_empresa_id uuid;
  v_conflito boolean;
begin
  if v_nome = '' then raise exception 'nome é obrigatório'; end if;
  if char_length(v_nome) > 150 then raise exception 'nome excede o tamanho máximo (150)'; end if;
  if v_telefone = '' then raise exception 'telefone é obrigatório'; end if;
  if char_length(v_telefone) > 20 then raise exception 'telefone excede o tamanho máximo (20)'; end if;
  if v_placa = '' then raise exception 'placa é obrigatória'; end if;
  if v_cpf is not null and char_length(v_cpf) not in (11, 14) then
    raise exception 'cpf/cnpj com tamanho inválido';
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
    values (null, v_nome, v_cpf, v_telefone)
    returning id into v_cliente_id;
  else
    update public.clientes
       set nome = coalesce(nullif(v_nome, ''), nome),
           documento = coalesce(nullif(documento, ''), v_cpf)
     where id = v_cliente_id;
  end if;

  -- ---------- lead: dedup por placa (índice único cobre concorrência) ------
  -- campos do webhook sem coluna própria em `leads` viram `dados` (canal,
  -- vendedor_nome, vendedor_telefone, loja, vendedor_id, email, id da
  -- captação, created_at etc.); nome/telefone/placa/cpf já viraram
  -- nome/contato/placa/cpf normalizados e não entram duplicados aqui.
  v_dados := (v_record - 'nome_cliente' - 'telefone' - 'placa' - 'cpf')
    || jsonb_build_object('placa', v_placa);
  if v_cpf is not null then
    v_dados := v_dados || jsonb_build_object('cpf', v_cpf);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ingerir_lead_externo:placa:' || v_placa, 0));

  -- empresa_id/responsavel_id nulos: cai na mesma fila global de qualquer
  -- lead sem vendedor. trg_distribuir_lead_auto (BEFORE INSERT) age dentro
  -- do próprio INSERT — se resolver uma regra automática, o RETURNING abaixo
  -- já traz o empresa_id final; se não resolver, volta null (fila pendente
  -- da Matriz, distribuível manualmente pra qualquer empresa da rede).
  insert into public.leads (origem, nome, contato, dados, empresa_id, responsavel_id, cliente_id)
  values ('captacao_movida', v_nome, v_telefone, v_dados, null, null, v_cliente_id)
  on conflict ((dados->>'placa')) where origem = 'captacao_movida'
  do nothing
  returning id, empresa_id into v_lead_id, v_lead_empresa_id;

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
     returning l.id, l.empresa_id into v_lead_id, v_lead_empresa_id;
  end if;

  -- ---------- religação do cliente à empresa que o lead resolveu ----------
  -- só quando o lead (novo ou já existente) tem empresa_id preenchido e o
  -- cliente ainda está órfão. Protegido contra colisão com o índice único
  -- parcial (empresa_id, documento) where documento <> '': se colidir,
  -- pula a religação em vez de estourar a transação inteira.
  if v_lead_empresa_id is not null then
    select exists(
      select 1 from public.clientes c2
       where c2.empresa_id = v_lead_empresa_id
         and c2.documento is not null
         and c2.documento <> ''
         and c2.id <> v_cliente_id
         and c2.documento = (select documento from public.clientes where id = v_cliente_id)
    ) into v_conflito;

    if not coalesce(v_conflito, false) then
      begin
        update public.clientes
           set empresa_id = v_lead_empresa_id
         where id = v_cliente_id
           and empresa_id is null;
      exception when unique_violation then
        null; -- mantém o cliente órfão em caso de corrida com outra religação
      end;
    end if;
  end if;

  return query select v_lead_id, v_criado;
end;
$$;

comment on function public.ingerir_lead_externo(jsonb, text, text, text, jsonb) is
  'Porta de entrada dos leads do app captacao-movida, chamada via Database
   Webhook nativo do Supabase (payload fixo {type,table,schema,record,
   old_record}). Extrai nome/telefone/placa/cpf de `record`; o resto vira
   `dados`. Dedup de cliente por telefone, de lead por placa
   (origem=captacao_movida). Insere com empresa_id/responsavel_id nulos —
   cai na mesma fila global de qualquer lead sem vendedor, sujeito a
   trg_distribuir_lead_auto; se o trigger resolver empresa, o cliente é
   religado à mesma empresa (protegido contra colisão com o índice único de
   documento).';

revoke all on function public.ingerir_lead_externo(jsonb, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingerir_lead_externo(jsonb, text, text, text, jsonb) to service_role;
