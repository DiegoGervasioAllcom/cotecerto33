-- 040 — fix: distribuir_lead_auto voltou a respeitar bloqueado/arquivado/em_avaliacao_matriz.
-- A migration 032 redefiniu a função (critério "só online") e removeu sem querer os guards
-- introduzidos na 028. Regressão detectada por tests/db/distribuicao-lead.test.ts.

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
begin
  if new.empresa_id is not null or new.responsavel_id is not null then
    return new;
  end if;
  -- Guards restaurados (existiam na 028, perdidos na redefinição da 032 — bug pego pelo teste tests/db/distribuicao-lead.test.ts):
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

  select p.id into v_resp
    from public.profiles p
    left join public.leads l on l.responsavel_id = p.id
      and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
      and coalesce(l.arquivado,false) = false
    left join public.v_user_presence vp on vp.user_id = p.id
   where p.empresa_id = v_empresa
     and p.status = 'aprovada'
     and (not v_only_online or coalesce(vp.status_efetivo,'offline') = 'online')
   group by p.id, vp.status_efetivo
   order by count(l.id) asc, random()
   limit 1;

  new.empresa_id := v_empresa;
  new.responsavel_id := v_resp;
  new.distribuido_em := case when v_resp is not null then now() else null end;
  return new;
end$$;
