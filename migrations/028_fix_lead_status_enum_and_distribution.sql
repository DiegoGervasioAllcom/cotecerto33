-- ============================================================
-- 028: lead_status — compatibilidade de enums + distribuição
-- ============================================================
-- Valores canônicos do funil usados pelo app:
--   novo, contato, qualificado, cotacao, proposta, negociacao, ganho, perdido
--
-- Valores abaixo são aliases de compatibilidade com os rótulos do protótipo
-- que apareceram em funções antigas. Eles são adicionados aqui para evitar
-- "invalid input value for enum lead_status" caso algum fluxo legado ainda
-- tente comparar/gravar estes rótulos.
--
-- IMPORTANTE: esta migration NÃO usa os novos valores de enum em casts diretos
-- após adicioná-los. As funções abaixo comparam status_pipeline::text para
-- evitar o erro de "unsafe use of new value" no mesmo commit/transação.

alter type public.lead_status add value if not exists 'qualificando';
alter type public.lead_status add value if not exists 'cotando';
alter type public.lead_status add value if not exists 'proposta_enviada';
alter type public.lead_status add value if not exists 'em_negociacao';
alter type public.lead_status add value if not exists 'fechado';

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
begin
  -- Só age em leads novos sem destino e não bloqueados/arquivados.
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

  v_modo   := coalesce(v_cfg.modo,'regiao');
  v_uf     := upper(coalesce(new.dados->>'uf',''));
  v_cidade := lower(coalesce(new.dados->>'cidade',''));

  -- 1) Tenta casar por região se o critério estiver ligado.
  if coalesce((v_cfg.criterios->>'regiao')::boolean, true) and (v_uf <> '' or v_cidade <> '') then
    select e.id into v_empresa
      from public.empresas e
     where e.status = 'aprovada'
       and e.tipo::text <> 'matriz'
       and (
         (v_uf <> '' and upper(coalesce(e.uf,'')) = v_uf)
         or (v_cidade <> '' and lower(coalesce(e.cidade,'')) = v_cidade)
       )
     order by random()
     limit 1;
  end if;

  -- 2) Fila equilibrada — empresa com menor nº de leads ativos.
  if v_empresa is null and v_modo = 'fila' then
    select e.id into v_empresa
      from public.empresas e
      left join public.leads l on l.empresa_id = e.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id
     order by count(l.id) asc, random()
     limit 1;
  end if;

  -- 3) Performance — empresa com mais vendedores aprovados.
  if v_empresa is null and v_modo = 'performance' then
    select e.id into v_empresa
      from public.empresas e
      left join public.profiles p on p.empresa_id = e.id and p.status = 'aprovada'
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id
     order by count(p.id) desc, random()
     limit 1;
  end if;

  -- 4) Fallback — qualquer franquia aprovada.
  if v_empresa is null then
    select id into v_empresa
      from public.empresas
     where status = 'aprovada' and tipo::text <> 'matriz'
     order by random()
     limit 1;
  end if;

  if v_empresa is null then
    return new;
  end if;

  -- Escolhe um vendedor aprovado da empresa por menor carga ativa.
  select p.id into v_resp
    from public.profiles p
    left join public.leads l on l.responsavel_id = p.id
      and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
      and coalesce(l.arquivado,false) = false
   where p.empresa_id = v_empresa and p.status = 'aprovada'
   group by p.id
   order by count(l.id) asc, random()
   limit 1;

  new.empresa_id := v_empresa;
  new.responsavel_id := v_resp;
  new.distribuido_em := now();
  return new;
end;
$$;

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
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'forbidden';
  end if;

  select * into v_cfg from public.distribuicao_config where id = 'default';
  if not found or not coalesce(v_cfg.automatico_on,false) then
    return 0;
  end if;
  v_modo := coalesce(v_cfg.modo,'regiao');

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
      select id into v_empresa
        from public.empresas
       where status = 'aprovada' and tipo::text <> 'matriz'
       order by random()
       limit 1;
    end if;
    if v_empresa is null then continue; end if;

    select p.id into v_resp from public.profiles p
      left join public.leads l on l.responsavel_id = p.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
     where p.empresa_id = v_empresa and p.status = 'aprovada'
     group by p.id order by count(l.id) asc, random() limit 1;

    update public.leads
       set empresa_id = v_empresa,
           responsavel_id = v_resp,
           distribuido_em = now()
     where id = v_lead.id;

    insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
    values (v_lead.id, 'distribuido', 'Distribuído automaticamente',
            'Encaminhado pela regra automática vigente.',
            auth.uid(),
            jsonb_build_object('empresa_id', v_empresa, 'responsavel_id', v_resp, 'modo', v_modo));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.distribuir_lead_auto() to authenticated;
grant execute on function public.distribuir_fila_pendente() to authenticated;