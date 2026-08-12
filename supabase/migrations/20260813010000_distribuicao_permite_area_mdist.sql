-- ===========================================================================
-- Distribuição de leads — permitir também via área "mdist" (Distribuição)
--
-- Hoje as RPCs de distribuição só liberam quem tem role matriz/master (match
-- exato). O sistema já tem um mecanismo de "áreas liberadas" por usuário
-- (profile_areas / fn_tem_area), usado na tela de Acessos e permissões pra
-- dar a um coordenador/supervisor/interno da Matriz acesso à área
-- "Distribuição" (mdist) sem precisar virar matriz/master.
--
-- Decisão do usuário: quem tem a área mdist liberada (via cargo preset ou
-- override em profile_areas) passa a poder chamar redistribuir_lead,
-- puxar_lead_de_volta e distribuir_fila_pendente — matriz/master continuam
-- com acesso total, sem depender de área.
--
-- create or replace preserva 100% do corpo vigente de cada função (ver
-- 20240101000019_redistribuir_perdido.sql, 20240101000016_lead_acoes.sql e
-- 20260803060000_v11_d5_trava_distribuicao_travado.sql), só troca a checagem
-- de permissão.
-- ===========================================================================

create or replace function public.redistribuir_lead(
  p_lead uuid, p_empresa uuid, p_responsavel uuid default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_was_perdido boolean;
  v_motivo text;
  v_sub text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master') or public.fn_tem_area(v_uid,'mdist')) then
    raise exception 'forbidden';
  end if;

  select status_pipeline = 'perdido', motivo_perda, submotivo_perda
    into v_was_perdido, v_motivo, v_sub
  from public.leads where id = p_lead;

  update public.leads
     set empresa_id = p_empresa,
         responsavel_id = p_responsavel,
         distribuido_em = now(),
         em_avaliacao_matriz = false,
         status_pipeline = case when status_pipeline = 'perdido'
                                then 'novo'::public.lead_status
                                else status_pipeline end,
         motivo_perda = case when status_pipeline = 'perdido' then null else motivo_perda end,
         submotivo_perda = case when status_pipeline = 'perdido' then null else submotivo_perda end,
         atualizado_em = now()
   where id = p_lead;

  if v_was_perdido then
    insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
    values (p_lead,'reativado_de_perda','Reativado de perda',
            coalesce('Motivo anterior: '||v_motivo, 'Lead reaberto pela matriz'),
            v_uid,
            jsonb_build_object('empresa_id',p_empresa,'responsavel_id',p_responsavel,
                               'motivo_anterior',v_motivo,'submotivo_anterior',v_sub));
  end if;

  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
  values (p_lead,'redistribuido','Redistribuído','Lead redistribuído pela matriz', v_uid,
          jsonb_build_object('empresa_id',p_empresa,'responsavel_id',p_responsavel,
                             'reativado', v_was_perdido));
end$$;

grant execute on function public.redistribuir_lead(uuid,uuid,uuid) to authenticated;

create or replace function public.puxar_lead_de_volta(p_lead uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master') or public.fn_tem_area(v_uid,'mdist')) then
    raise exception 'forbidden';
  end if;
  update public.leads
     set empresa_id = null, responsavel_id = null, distribuido_em = null,
         atualizado_em = now()
   where id = p_lead;
  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id)
  values (p_lead,'puxado_de_volta','Puxado de volta','Matriz reassumiu o lead', v_uid);
end$$;
grant execute on function public.puxar_lead_de_volta(uuid) to authenticated;

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
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master') or public.fn_tem_area(auth.uid(),'mdist')) then
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

grant execute on function public.distribuir_fila_pendente() to authenticated;

comment on function public.redistribuir_lead(uuid,uuid,uuid) is
  'Redistribui/reativa um lead. Permitido para matriz/master ou quem tiver a área mdist liberada (profile_areas/fn_tem_area).';
comment on function public.puxar_lead_de_volta(uuid) is
  'Puxa lead de volta pra fila (sem empresa/responsável). Permitido para matriz/master ou quem tiver a área mdist liberada.';
comment on function public.distribuir_fila_pendente() is
  'Roda a distribuição automática sobre a fila pendente. Permitido para matriz/master ou quem tiver a área mdist liberada.';
