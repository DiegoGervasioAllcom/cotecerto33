-- ===========================================================================
-- V11 · D5 (Frente 4) — travado com pausa ativa não recebe lead
--
-- `distribuir_lead_auto()` (trigger) e `distribuir_fila_pendente()` (RPC da
-- fila manual) escolhem primeiro a EMPRESA (região/fila/performance/random)
-- e só depois, dentro dela, a PESSOA responsável. Como todo candidato a
-- responsável já está filtrado por `p.empresa_id = v_empresa`, o bloco
-- (interno/rede/full) é o MESMO pra todos os candidatos de uma mesma
-- distribuição — dá pra resolver uma vez só, não por linha.
--
-- `fn_bloco_performance` reusa a mesma derivação do job (D4): sem modelo (a
-- maioria dos vendedores em produção, ver comentário do D4) ou modelo tipo
-- CLT → interno; modalidade full → full; franqueada sem full → rede.
--
-- Se `pausa_leads_ativa=false` no bloco (ou não há régua pro bloco), quem
-- está travado continua recebendo lead normalmente — a pausa é opt-in por
-- bloco, decisão que já está em `regua_performance_config` desde D1.
-- ===========================================================================

create or replace function public.fn_bloco_performance(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when m.id is null then 'interno'
    when m.tipo = 'clt' then 'interno'
    when m.modalidade = 'full' then 'full'
    else 'rede'
  end
  from public.empresas e
  left join public.modelos_franquia m on m.id = e.modelo_id
  where e.id = p_empresa_id;
$function$;

comment on function public.fn_bloco_performance(uuid) is
  'V11 D5: bloco da régua de performance (interno/rede/full) de uma empresa,
   pela mesma derivação de D4 (sem modelo ou tipo CLT / modalidade full /
   franqueada). Sempre resolve pra um dos 3 blocos — nunca null.';

revoke all on function public.fn_bloco_performance(uuid) from public, anon;
grant execute on function public.fn_bloco_performance(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- distribuir_lead_auto() — mesmo corpo de 20260713190000, + trava de travado
-- ---------------------------------------------------------------------------
create or replace function public.distribuir_lead_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_uf text;
  v_cidade text;
  v_empresa uuid;
  v_resp uuid;
  v_modo text;
  v_only_online boolean;
  v_pausar_travado boolean;
begin
  if new.empresa_id is not null or new.responsavel_id is not null then
    return new;
  end if;
  if coalesce(new.bloqueado,false) or coalesce(new.arquivado,false) then
    return new;
  end if;
  if coalesce(new.em_avaliacao_matriz,false) then
    return new;
  end if;

  select * into v_cfg from public.distribuicao_config where id = 'default';
  if not found or not coalesce(v_cfg.automatico_on,false) then
    return new;
  end if;

  v_modo := coalesce(v_cfg.modo,'regiao');
  v_only_online := coalesce((v_cfg.criterios->>'disp')::boolean, false);
  v_uf     := upper(coalesce(new.dados->>'uf',''));
  v_cidade := lower(coalesce(new.dados->>'cidade',''));

  if coalesce((v_cfg.criterios->>'regiao')::boolean, true) and (v_uf <> '' or v_cidade <> '') then
    select e.id into v_empresa from public.empresas e
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       and ((v_uf <> '' and upper(coalesce(e.uf,'')) = v_uf)
            or (v_cidade <> '' and lower(coalesce(e.cidade,'')) = v_cidade))
     order by random() limit 1;
  end if;

  if v_empresa is null and v_modo = 'fila' then
    select e.id into v_empresa from public.empresas e
      left join public.leads l on l.empresa_id = e.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id order by count(l.id) asc, random() limit 1;
  end if;

  if v_empresa is null and v_modo = 'performance' then
    select e.id into v_empresa from public.empresas e
      left join public.profiles p on p.empresa_id = e.id and p.status = 'aprovada'
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id order by count(p.id) desc, random() limit 1;
  end if;

  if v_empresa is null then
    select id into v_empresa from public.empresas
     where status = 'aprovada' and tipo::text <> 'matriz'
     order by random() limit 1;
  end if;
  if v_empresa is null then return new; end if;

  -- D5: travado só pausa se a régua do bloco tiver pausa_leads_ativa=true.
  select r.pausa_leads_ativa into v_pausar_travado
    from public.regua_performance_config r
   where r.bloco = public.fn_bloco_performance(v_empresa);
  v_pausar_travado := coalesce(v_pausar_travado, false);

  select p.id into v_resp
    from public.profiles p
    left join public.leads l on l.responsavel_id = p.id
      and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
      and coalesce(l.arquivado,false) = false
    left join public.v_user_presence vp on vp.user_id = p.id
   where p.empresa_id = v_empresa
     and p.status = 'aprovada'
     and (not v_only_online or coalesce(vp.status_efetivo,'offline') = 'online')
     and (not v_pausar_travado or p.performance_status is distinct from 'travado')
   group by p.id, vp.status_efetivo
   order by count(l.id) asc, random()
   limit 1;

  new.empresa_id := v_empresa;
  new.responsavel_id := v_resp;
  new.distribuido_em := case when v_resp is not null then now() else null end;
  return new;
end$$;

-- ---------------------------------------------------------------------------
-- distribuir_fila_pendente() — mesmo corpo de 20240101000032, + trava de travado
-- ---------------------------------------------------------------------------
create or replace function public.distribuir_fila_pendente()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_count integer := 0;
  v_cfg record;
  v_uf text;
  v_cidade text;
  v_empresa uuid;
  v_resp uuid;
  v_modo text;
  v_only_online boolean;
  v_pausar_travado boolean;
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'forbidden';
  end if;

  select * into v_cfg from public.distribuicao_config where id = 'default';
  if not found or not coalesce(v_cfg.automatico_on,false) then return 0; end if;
  v_modo := coalesce(v_cfg.modo,'regiao');
  v_only_online := coalesce((v_cfg.criterios->>'disp')::boolean, false);

  for v_lead in
    select * from public.leads
     where empresa_id is null and responsavel_id is null
       and status_pipeline::text = 'novo'
       and coalesce(arquivado,false) = false
       and coalesce(bloqueado,false) = false
       and coalesce(em_avaliacao_matriz,false) = false
     order by criado_em asc
     limit 500
  loop
    v_uf     := upper(coalesce(v_lead.dados->>'uf',''));
    v_cidade := lower(coalesce(v_lead.dados->>'cidade',''));
    v_empresa := null;
    v_resp := null;

    if coalesce((v_cfg.criterios->>'regiao')::boolean, true) and (v_uf <> '' or v_cidade <> '') then
      select e.id into v_empresa from public.empresas e
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
         and ((v_uf <> '' and upper(coalesce(e.uf,'')) = v_uf)
              or (v_cidade <> '' and lower(coalesce(e.cidade,'')) = v_cidade))
       order by random() limit 1;
    end if;

    if v_empresa is null and v_modo = 'fila' then
      select e.id into v_empresa from public.empresas e
        left join public.leads l on l.empresa_id = e.id
          and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
          and coalesce(l.arquivado,false) = false
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       group by e.id order by count(l.id) asc, random() limit 1;
    end if;

    if v_empresa is null and v_modo = 'performance' then
      select e.id into v_empresa from public.empresas e
        left join public.profiles p on p.empresa_id = e.id and p.status = 'aprovada'
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       group by e.id order by count(p.id) desc, random() limit 1;
    end if;

    if v_empresa is null then
      select id into v_empresa from public.empresas
       where status = 'aprovada' and tipo::text <> 'matriz'
       order by random() limit 1;
    end if;
    if v_empresa is null then continue; end if;

    -- D5: travado só pausa se a régua do bloco tiver pausa_leads_ativa=true.
    select r.pausa_leads_ativa into v_pausar_travado
      from public.regua_performance_config r
     where r.bloco = public.fn_bloco_performance(v_empresa);
    v_pausar_travado := coalesce(v_pausar_travado, false);

    select p.id into v_resp
      from public.profiles p
      left join public.leads l on l.responsavel_id = p.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
      left join public.v_user_presence vp on vp.user_id = p.id
     where p.empresa_id = v_empresa
       and p.status = 'aprovada'
       and (not v_only_online or coalesce(vp.status_efetivo,'offline') = 'online')
       and (not v_pausar_travado or p.performance_status is distinct from 'travado')
     group by p.id, vp.status_efetivo
     order by count(l.id) asc, random() limit 1;

    -- Se "somente online" e não houver vendedor disponível, pula
    if v_resp is null and v_only_online then continue; end if;

    update public.leads
       set empresa_id = v_empresa,
           responsavel_id = v_resp,
           distribuido_em = case when v_resp is not null then now() else null end
     where id = v_lead.id;

    insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
    values (v_lead.id, 'distribuido', 'Distribuído automaticamente',
            'Encaminhado pela regra automática vigente.',
            auth.uid(),
            jsonb_build_object('empresa_id', v_empresa, 'responsavel_id', v_resp, 'modo', v_modo, 'somente_online', v_only_online));

    v_count := v_count + 1;
  end loop;

  return v_count;
end$$;

grant execute on function public.distribuir_lead_auto() to authenticated;
grant execute on function public.distribuir_fila_pendente() to authenticated;
