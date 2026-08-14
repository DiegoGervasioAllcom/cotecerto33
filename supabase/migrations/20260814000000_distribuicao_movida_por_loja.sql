-- V11.9.6 — distribuição de leads captacao_movida por loja externa.
-- Configura loja/aliases/pool de vendedores e distribui atomicamente pela
-- menor carga ativa ponderada. Sem destino elegível, preserva a fila global.

create or replace function public.normalizar_alias_loja_movida(p_valor text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(trim(coalesce(p_valor, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '-', 'g'));
$$;

create table if not exists public.movida_lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  ativa boolean not null default true,
  exigir_online boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.movida_loja_aliases (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.movida_lojas(id) on delete cascade,
  alias text not null check (char_length(trim(alias)) between 1 and 160),
  alias_normalizado text generated always as (public.normalizar_alias_loja_movida(alias)) stored,
  criado_em timestamptz not null default now(),
  unique (alias_normalizado),
  check (char_length(alias_normalizado) between 1 and 160)
);

create table if not exists public.movida_loja_vendedores (
  loja_id uuid not null references public.movida_lojas(id) on delete cascade,
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  peso integer not null default 1 check (peso between 1 and 100),
  limite_diario integer check (limite_diario is null or limite_diario > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (loja_id, vendedor_id)
);

create table if not exists public.movida_distribuicao_auditoria (
  id bigint generated always as identity primary key,
  -- A auditoria precisa sobreviver ao ciclo de retenção/eliminação do lead.
  lead_id uuid references public.leads(id) on delete set null,
  loja_informada text check (loja_informada is null or char_length(loja_informada) <= 160),
  alias_normalizado text check (alias_normalizado is null or char_length(alias_normalizado) <= 160),
  loja_id uuid references public.movida_lojas(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  vendedor_id uuid references public.profiles(id) on delete set null,
  resultado text not null check (resultado in ('distribuido','sem_loja','loja_inativa','sem_elegivel','nao_pendente')),
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object'),
  ator_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists movida_lojas_empresa_idx on public.movida_lojas (empresa_id);
create index if not exists movida_aliases_loja_idx on public.movida_loja_aliases (loja_id);
create index if not exists movida_pool_vendedor_idx on public.movida_loja_vendedores (vendedor_id) where ativo;
create index if not exists movida_auditoria_lead_idx on public.movida_distribuicao_auditoria (lead_id, criado_em desc);
create index if not exists movida_auditoria_loja_idx on public.movida_distribuicao_auditoria (loja_id, criado_em desc);

grant select, insert, update, delete on public.movida_lojas, public.movida_loja_aliases, public.movida_loja_vendedores to authenticated;
grant select on public.movida_distribuicao_auditoria to authenticated;
revoke insert, update, delete, truncate on public.movida_distribuicao_auditoria from authenticated;
grant all on public.movida_lojas, public.movida_loja_aliases, public.movida_loja_vendedores, public.movida_distribuicao_auditoria to service_role;
grant usage, select on sequence public.movida_distribuicao_auditoria_id_seq to service_role;

alter table public.movida_lojas enable row level security;
alter table public.movida_loja_aliases enable row level security;
alter table public.movida_loja_vendedores enable row level security;
alter table public.movida_distribuicao_auditoria enable row level security;

drop policy if exists movida_lojas_gestao on public.movida_lojas;
create policy movida_lojas_gestao on public.movida_lojas for all to authenticated
  using (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and empresa_id in (select public.empresas_visiveis(auth.uid()))))
  with check (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and empresa_id in (select public.empresas_visiveis(auth.uid()))));
drop policy if exists movida_aliases_gestao on public.movida_loja_aliases;
create policy movida_aliases_gestao on public.movida_loja_aliases for all to authenticated
  using (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
      where ml.id=loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid())))))
  with check (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
      where ml.id=loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid())))));
drop policy if exists movida_pool_gestao on public.movida_loja_vendedores;
create policy movida_pool_gestao on public.movida_loja_vendedores for all to authenticated
  using (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
      where ml.id=loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid())))))
  with check (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
      where ml.id=loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid())))));
drop policy if exists movida_auditoria_leitura on public.movida_distribuicao_auditoria;
create policy movida_auditoria_leitura on public.movida_distribuicao_auditoria for select to authenticated
  using (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and empresa_id in (select public.empresas_visiveis(auth.uid()))));

-- Criação/edição da rota e do seu alias formam uma única unidade atômica.
-- O front não precisa apagar a loja em compensação se o alias for inválido.
create or replace function public.fn_salvar_rota_movida(
  p_loja_id uuid,
  p_nome text,
  p_alias text,
  p_empresa_id uuid,
  p_ativa boolean default true,
  p_exigir_online boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_alias_normalizado text := public.normalizar_alias_loja_movida(p_alias);
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_nome,''))) not between 1 and 120 then
    raise exception 'nome deve ter entre 1 e 120 caracteres';
  end if;
  if char_length(trim(coalesce(p_alias,''))) not between 1 and 160
     or char_length(v_alias_normalizado) not between 1 and 160 then
    raise exception 'alias deve ter entre 1 e 160 caracteres';
  end if;
  if not (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and p_empresa_id in (select public.empresas_visiveis(auth.uid())))) then
    raise exception 'forbidden';
  end if;

  if p_loja_id is null then
    insert into public.movida_lojas(nome,empresa_id,ativa,exigir_online)
    values(trim(p_nome),p_empresa_id,coalesce(p_ativa,true),coalesce(p_exigir_online,false))
    returning id into v_loja_id;
  else
    select id into v_loja_id from public.movida_lojas where id=p_loja_id for update;
    if not found then raise exception 'rota não encontrada'; end if;
    if not (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
      (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
        where ml.id=p_loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid()))))) then
      raise exception 'forbidden';
    end if;
    if exists (select 1 from public.movida_loja_vendedores mp join public.profiles p on p.id=mp.vendedor_id
      where mp.loja_id=p_loja_id and p.empresa_id is distinct from p_empresa_id) then
      raise exception 'remova o pool antes de trocar a empresa da rota';
    end if;
    update public.movida_lojas set nome=trim(p_nome),empresa_id=p_empresa_id,
      ativa=coalesce(p_ativa,true),exigir_online=coalesce(p_exigir_online,false),atualizado_em=now()
      where id=p_loja_id;
  end if;

  insert into public.movida_loja_aliases(loja_id,alias)
  values(v_loja_id,trim(p_alias))
  on conflict (alias_normalizado) do update set alias=excluded.alias
    where public.movida_loja_aliases.loja_id=v_loja_id;
  if not found then raise exception 'alias já pertence a outra rota'; end if;

  return v_loja_id;
end;
$$;
revoke all on function public.fn_salvar_rota_movida(uuid,text,text,uuid,boolean,boolean) from public, anon;
grant execute on function public.fn_salvar_rota_movida(uuid,text,text,uuid,boolean,boolean) to authenticated, service_role;

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
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'vendedor'
    where p.id = new.vendedor_id and p.empresa_id = v_empresa
      and p.status = 'aprovada' and p.desligado_em is null
  ) then
    raise exception 'vendedor deve ter role vendedor e pertencer à empresa da loja';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_validar_pool_movida on public.movida_loja_vendedores;
create trigger trg_validar_pool_movida before insert or update on public.movida_loja_vendedores
for each row execute function public.validar_pool_movida();
revoke all on function public.validar_pool_movida() from public, anon, authenticated;

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
          join public.user_roles ur on ur.user_id=p.id and ur.role='vendedor'
          left join public.leads l on l.responsavel_id=mp.vendedor_id
            and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
            and coalesce(l.arquivado,false)=false
          left join public.movida_distribuicao_auditoria aud on aud.loja_id=mp.loja_id
            and aud.vendedor_id=mp.vendedor_id
            and aud.criado_em >= (date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
          left join public.v_user_presence vp on vp.user_id=mp.vendedor_id
         where mp.loja_id=v_loja.id and mp.ativo and p.empresa_id=v_loja.empresa_id
           and p.status='aprovada' and p.desligado_em is null
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

revoke all on function public.distribuir_lead_movida(uuid,uuid) from public, anon, authenticated;
grant execute on function public.distribuir_lead_movida(uuid,uuid) to service_role;

create or replace function public.reprocessar_leads_movida_pendentes(p_loja_id uuid, p_limite integer default 500)
returns table(processados integer, distribuidos integer, pendentes integer)
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_processados integer:=0; v_distribuidos integer:=0;
begin
  if auth.uid() is not null and not (public.has_role(auth.uid(),'matriz') or public.fn_tem_area(auth.uid(),'mdist') or
    (public.has_role(auth.uid(),'master') and exists (select 1 from public.movida_lojas ml
      where ml.id=p_loja_id and ml.empresa_id in (select public.empresas_visiveis(auth.uid()))))) then
    raise exception 'forbidden';
  end if;
  if p_limite not between 1 and 5000 then raise exception 'p_limite deve estar entre 1 e 5000'; end if;
  if not exists (select 1 from public.movida_lojas where id=p_loja_id) then raise exception 'loja não encontrada'; end if;
  for v_id in select l.id from public.leads l
      join public.movida_loja_aliases ma on ma.alias_normalizado=public.normalizar_alias_loja_movida(l.dados->>'loja')
     where ma.loja_id=p_loja_id and l.origem='captacao_movida'
      and l.empresa_id is null and l.responsavel_id is null and l.status_pipeline::text='novo'
      and not coalesce(l.arquivado,false) and not coalesce(l.bloqueado,false)
      and not coalesce(l.em_avaliacao_matriz,false) order by l.criado_em for update skip locked limit p_limite
  loop
    v_processados:=v_processados+1;
    if public.distribuir_lead_movida(v_id,auth.uid()) then v_distribuidos:=v_distribuidos+1; end if;
  end loop;
  return query select v_processados,v_distribuidos,v_processados-v_distribuidos;
end;
$$;
revoke all on function public.reprocessar_leads_movida_pendentes(uuid,integer) from public, anon;
grant execute on function public.reprocessar_leads_movida_pendentes(uuid,integer) to authenticated, service_role;

-- A ingestão usa empresa sentinela apenas para o BEFORE trigger genérico não
-- capturar Movida; o motor específico resolve ou devolve à fila global.
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
  v_dados jsonb; v_cliente_id uuid; v_lead_id uuid; v_criado boolean; v_matriz uuid;
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
  insert into public.leads(origem,nome,contato,dados,empresa_id,responsavel_id,cliente_id)
  values('captacao_movida',v_nome,v_telefone,v_dados,v_matriz,null,v_cliente_id)
  on conflict ((dados->>'placa')) where origem='captacao_movida' do nothing returning id into v_lead_id;
  if v_lead_id is not null then v_criado:=true;
  else
    v_criado:=false;
    update public.leads l set nome=v_nome,dados=l.dados||v_dados,cliente_id=coalesce(l.cliente_id,v_cliente_id),atualizado_em=now()
     where l.origem='captacao_movida' and l.dados->>'placa'=v_placa returning l.id into v_lead_id;
  end if;
  -- Somente lead novo ou ainda pendente pode mudar de destino.
  update public.leads set empresa_id=null where id=v_lead_id and responsavel_id is null
    and (v_criado or empresa_id is null);
  perform public.distribuir_lead_movida(v_lead_id,null);
  return query select v_lead_id,v_criado;
end;
$$;
revoke all on function public.ingerir_lead_externo(jsonb,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingerir_lead_externo(jsonb,text,text,text,jsonb) to service_role;
