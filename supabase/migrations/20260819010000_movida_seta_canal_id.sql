-- ===========================================================================
-- Leads da Captação Movida ganham canal_id — Performance por canal
--
-- Bug relatado: o card "Movida" em "Performance por canal" (Visão geral)
-- sempre mostra zero. Causa: `funis_por_canal_visao_geral()` (20260729050000)
-- faz left join de `canais` com `leads` por `canal_id`, e `ingerir_lead_
-- externo` (20260812000000/20260814000000) NUNCA seta `leads.canal_id` — a
-- Movida usa `movida_lojas`/aliases, não a taxonomia de canais. O canal
-- "Movida" já existe em `canais` (seed original, 20260729025723, id fixo
-- 'Movida'/tipo 'supper'/empresa_id null, exibir_funil=true) só não estava
-- ligado aos leads.
--
-- Fix: `ingerir_lead_externo` agora resolve esse canal e grava `canal_id` no
-- insert (e no update do caminho de re-ingestão pela mesma placa) + backfill
-- dos leads já existentes.
--
-- Checagem de segurança (não reabre o bug do SLA que 20260819000000 já
-- corrigiu): `expirar_leads_nao_atendidos` decide o ramo Movida por
-- `origem = 'captacao_movida'`, checado ANTES de qualquer uso de `canal_id`
-- (ver o `continue` logo após o bloco `if v_rec.origem = 'captacao_movida'`) —
-- então setar `canal_id` aqui não afeta esse comportamento. `fn_origem_lead`
-- (comissão) já tratava `canal_id` nulo como "ambíguo" sem nunca supor
-- "repassado"; passar a ter `canal_id` preenchido só torna essa resolução
-- mais precisa, não muda o comportamento de leads não-Movida.
-- ===========================================================================

create or replace function public.ingerir_lead_externo(
  record jsonb, type text default null, "table" text default null,
  schema text default null, old_record jsonb default null
)
returns table(lead_id uuid, criado boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_record jsonb:=coalesce(record,'{}'::jsonb); v_nome text:=trim(coalesce(v_record->>'nome_cliente',''));
  v_telefone text:=regexp_replace(coalesce(v_record->>'telefone',''),'\D','','g');
  v_placa text:=upper(regexp_replace(coalesce(v_record->>'placa',''),'\s','','g'));
  v_cpf text:=nullif(regexp_replace(coalesce(v_record->>'cpf',''),'\D','','g'),'');
  v_dados jsonb; v_cliente_id uuid; v_lead_id uuid; v_criado boolean; v_matriz uuid; v_canal uuid;
begin
  if v_nome='' then raise exception 'nome é obrigatório'; end if;
  if char_length(v_nome)>150 then raise exception 'nome excede o tamanho máximo (150)'; end if;
  if v_telefone='' then raise exception 'telefone é obrigatório'; end if;
  if char_length(v_telefone)>20 then raise exception 'telefone excede o tamanho máximo (20)'; end if;
  if v_placa='' then raise exception 'placa é obrigatória'; end if;
  if v_cpf is not null and char_length(v_cpf) not in (11,14) then raise exception 'cpf/cnpj com tamanho inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ingerir_lead_externo:cliente:'||v_telefone,0));
  select id into v_cliente_id from public.clientes where telefone=v_telefone order by criado_em limit 1;
  if v_cliente_id is null then
    insert into public.clientes(empresa_id,nome,documento,telefone) values(null,v_nome,v_cpf,v_telefone) returning id into v_cliente_id;
  else
    update public.clientes set nome=coalesce(nullif(v_nome,''),nome),documento=coalesce(nullif(documento,''),v_cpf) where id=v_cliente_id;
  end if;
  v_dados:=(v_record-'nome_cliente'-'telefone'-'placa'-'cpf')||jsonb_build_object('placa',v_placa);
  if v_cpf is not null then v_dados:=v_dados||jsonb_build_object('cpf',v_cpf); end if;
  perform pg_advisory_xact_lock(hashtextextended('ingerir_lead_externo:placa:'||v_placa,0));
  select public.fn_empresa_matriz() into v_matriz;
  select id into v_canal from public.canais where nome='Movida' and tipo='supper' and empresa_id is null;
  insert into public.leads(origem,nome,contato,dados,empresa_id,responsavel_id,cliente_id,canal_id)
  values('captacao_movida',v_nome,v_telefone,v_dados,v_matriz,null,v_cliente_id,v_canal)
  on conflict ((dados->>'placa')) where origem='captacao_movida' do nothing returning id into v_lead_id;
  if v_lead_id is not null then v_criado:=true;
  else
    v_criado:=false;
    update public.leads l set nome=v_nome,dados=l.dados||v_dados,cliente_id=coalesce(l.cliente_id,v_cliente_id),
        canal_id=coalesce(l.canal_id,v_canal),atualizado_em=now()
     where l.origem='captacao_movida' and l.dados->>'placa'=v_placa returning l.id into v_lead_id;
  end if;
  -- Somente lead novo ou ainda pendente pode mudar de destino.
  update public.leads set empresa_id=null where id=v_lead_id and responsavel_id is null
    and (v_criado or empresa_id is null);
  perform public.distribuir_lead_movida(v_lead_id,null);
  return query select v_lead_id,v_criado;
end;
$$;

-- Backfill: leads da Movida já ingeridos antes deste fix.
update public.leads
   set canal_id = (select id from public.canais where nome='Movida' and tipo='supper' and empresa_id is null)
 where origem='captacao_movida' and canal_id is null;
