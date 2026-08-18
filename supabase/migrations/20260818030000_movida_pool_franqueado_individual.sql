-- ===========================================================================
-- Pool de vendedores da loja Movida: aceita franqueado individual (PJ)
--
-- Bug relatado: um vendedor PJ (franquia Individual, que opera sozinho como
-- um vendedor único — sem equipe) não aparecia na lista de vendedores
-- disponíveis para o pool de uma loja Movida, e mesmo contornando o front o
-- banco rejeitaria o insert. Causa: tanto o trigger `validar_pool_movida()`
-- quanto a engine `distribuir_lead_movida()` (20260814000000) exigiam
-- estritamente `user_roles.role = 'vendedor'` — um franqueado (individual ou
-- full) sempre recebe `role = 'franqueado'` (ver 20260718171906_g4_5_
-- campanhas_elite.sql), então nunca passava nessa checagem, mesmo operando
-- como vendedor único da própria franquia.
--
-- Escopo da correção (decisão do usuário, 18/08/2026): só Franquia
-- Individual (modelos_franquia.modalidade = 'individual') entra no pool como
-- se fosse ela mesma um vendedor. Franquia Full não entra aqui — ela tem
-- vendedores próprios (role vendedor, vinc_tipo full) que são quem de fato
-- participaria do pool de uma loja.
-- ===========================================================================

create or replace function public.validar_pool_movida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.movida_lojas where id = new.loja_id;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.vendedor_id and p.empresa_id = v_empresa
      and p.status = 'aprovada' and p.desligado_em is null
      and (
        exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id and ur.role = 'vendedor'
        )
        or exists (
          select 1
            from public.user_roles ur
            join public.empresas e on e.id = p.empresa_id
            join public.modelos_franquia mf on mf.id = e.modelo_id
           where ur.user_id = p.id and ur.role = 'franqueado' and mf.modalidade = 'individual'
        )
      )
  ) then
    raise exception 'vendedor deve ter role vendedor (ou franqueado individual) e pertencer à empresa da loja';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.distribuir_lead_movida(p_lead_id uuid, p_ator_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_loja_informada text;
  v_alias text;
  v_loja public.movida_lojas%rowtype;
  v_vendedor uuid;
  v_carga integer;
  v_limite_diario integer;
  v_peso integer;
  v_distribuidos_hoje integer;
  v_resultado text;
  v_pausar_travado boolean;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or v_lead.origem <> 'captacao_movida'
     or v_lead.empresa_id is not null or v_lead.responsavel_id is not null
     or v_lead.status_pipeline::text <> 'novo' or coalesce(v_lead.arquivado,false)
     or coalesce(v_lead.bloqueado,false) or coalesce(v_lead.em_avaliacao_matriz,false) then
    return false;
  end if;

  v_loja_informada := nullif(trim(coalesce(v_lead.dados->>'loja', '')), '');
  v_alias := public.normalizar_alias_loja_movida(v_loja_informada);
  select ml.* into v_loja
    from public.movida_loja_aliases ma join public.movida_lojas ml on ml.id = ma.loja_id
   where ma.alias_normalizado = v_alias;

  if not found then
    v_resultado := 'sem_loja';
  elsif not v_loja.ativa or not exists (select 1 from public.empresas e where e.id=v_loja.empresa_id and e.status='aprovada') then
    v_resultado := 'loja_inativa';
  else
    perform pg_advisory_xact_lock(hashtextextended('movida:loja:' || v_loja.id::text, 0));

    select r.pausa_leads_ativa into v_pausar_travado
      from public.regua_performance_config r
     where r.bloco=public.fn_bloco_performance(v_loja.empresa_id);
    v_pausar_travado:=coalesce(v_pausar_travado,false);

    select candidato.vendedor_id, candidato.carga, candidato.limite_diario, candidato.peso, candidato.distribuidos_hoje
      into v_vendedor, v_carga, v_limite_diario, v_peso, v_distribuidos_hoje
      from (
        select mp.vendedor_id, mp.limite_diario, mp.peso, count(distinct l.id)::integer as carga,
          count(distinct aud.id) filter (where aud.resultado='distribuido')::integer as distribuidos_hoje
          from public.movida_loja_vendedores mp
          join public.profiles p on p.id=mp.vendedor_id
          join public.user_roles ur on ur.user_id=p.id and ur.role in ('vendedor','franqueado')
          left join public.empresas emp_v on emp_v.id = p.empresa_id
          left join public.modelos_franquia mf_v on mf_v.id = emp_v.modelo_id
          left join public.leads l on l.responsavel_id=mp.vendedor_id
            and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
            and coalesce(l.arquivado,false)=false
          left join public.movida_distribuicao_auditoria aud on aud.loja_id=mp.loja_id
            and aud.vendedor_id=mp.vendedor_id
            and aud.criado_em >= (date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
          left join public.v_user_presence vp on vp.user_id=mp.vendedor_id
         where mp.loja_id=v_loja.id and mp.ativo and p.empresa_id=v_loja.empresa_id
           and p.status='aprovada' and p.desligado_em is null
           and (ur.role='vendedor' or (ur.role='franqueado' and mf_v.modalidade='individual'))
           and (not v_pausar_travado or p.performance_status is distinct from 'travado')
           and (not v_loja.exigir_online or coalesce(vp.status_efetivo,'offline')='online')
         group by mp.vendedor_id, mp.limite_diario, mp.peso
        having mp.limite_diario is null
            or count(distinct aud.id) filter (where aud.resultado='distribuido') < mp.limite_diario
      ) candidato
     order by candidato.carga::numeric / candidato.peso asc, candidato.carga asc, candidato.vendedor_id
     limit 1;

    if v_vendedor is null then
      v_resultado := 'sem_elegivel';
    else
      update public.leads set empresa_id=v_loja.empresa_id, responsavel_id=v_vendedor,
        distribuido_em=now(), atualizado_em=now() where id=p_lead_id;
      update public.clientes set empresa_id=v_loja.empresa_id
       where id=v_lead.cliente_id and empresa_id is null
         and not exists (select 1 from public.clientes c2 where c2.empresa_id=v_loja.empresa_id
           and c2.id<>v_lead.cliente_id and c2.documento is not null and c2.documento<>''
           and c2.documento=(select documento from public.clientes where id=v_lead.cliente_id));
      v_resultado := 'distribuido';
    end if;
  end if;

  insert into public.movida_distribuicao_auditoria
    (lead_id,loja_informada,alias_normalizado,loja_id,empresa_id,vendedor_id,resultado,detalhes,ator_id)
  values (p_lead_id,v_loja_informada,nullif(v_alias,''),v_loja.id,v_loja.empresa_id,v_vendedor,v_resultado,
    jsonb_strip_nulls(jsonb_build_object('carga_ativa_antes',v_carga,'distribuidos_hoje_antes',v_distribuidos_hoje,
      'limite_diario',v_limite_diario,'peso',v_peso,'exigir_online',v_loja.exigir_online)),p_ator_id);

  if v_resultado='distribuido' then
    insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
    values (p_lead_id,'distribuido_movida','Distribuído por loja Movida',
      'Encaminhado ao pool específico da loja externa.',p_ator_id,
      jsonb_build_object('loja_id',v_loja.id,'empresa_id',v_loja.empresa_id,'responsavel_id',v_vendedor));
    return true;
  end if;
  return false;
end;
$$;
