-- V11.5c — configuração e ciclo de vida do vendedor da própria Franquia Full.

create table if not exists public.full_vendedor_config (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  comissao_venda_pct numeric(5,2) check (comissao_venda_pct between 0 and 100),
  comissao_renovacao_pct numeric(5,2) check (comissao_renovacao_pct between 0 and 100),
  personalizado boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_full_vendedor_config_empresa on public.full_vendedor_config(empresa_id);
alter table public.full_vendedor_config enable row level security;
revoke all on public.full_vendedor_config from public, anon, authenticated;
grant select on public.full_vendedor_config to authenticated;
grant all on public.full_vendedor_config to service_role;
drop policy if exists full_vendedor_config_select on public.full_vendedor_config;
create policy full_vendedor_config_select on public.full_vendedor_config for select to authenticated
using (empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev));

create table if not exists public.full_vendedor_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  vendedor_id uuid not null references public.profiles(id),
  acao text not null check (acao in ('cadastro','configuracao','desligamento','reinclusao')),
  motivo text check (motivo is null or char_length(motivo) between 1 and 500),
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes)='object'),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);
create index if not exists idx_full_vendedor_historico_empresa
  on public.full_vendedor_historico(empresa_id,criado_em desc);
alter table public.full_vendedor_historico enable row level security;
revoke all on public.full_vendedor_historico from public,anon,authenticated;
grant select on public.full_vendedor_historico to authenticated;
grant all on public.full_vendedor_historico to service_role;
drop policy if exists full_vendedor_historico_select on public.full_vendedor_historico;
create policy full_vendedor_historico_select on public.full_vendedor_historico for select to authenticated
using (public.has_role(auth.uid(),'matriz') or empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev));
create or replace function public.fn_full_vendedor_historico_append_only()
returns trigger language plpgsql security definer set search_path=public as $function$
begin raise exception 'Histórico de vendedores da Full é imutável'; end;
$function$;
drop trigger if exists trg_full_vendedor_historico_sem_update on public.full_vendedor_historico;
create trigger trg_full_vendedor_historico_sem_update before update on public.full_vendedor_historico for each statement execute function public.fn_full_vendedor_historico_append_only();
drop trigger if exists trg_full_vendedor_historico_sem_delete on public.full_vendedor_historico;
create trigger trg_full_vendedor_historico_sem_delete before delete on public.full_vendedor_historico for each statement execute function public.fn_full_vendedor_historico_append_only();
drop trigger if exists trg_full_vendedor_historico_sem_truncate on public.full_vendedor_historico;
create trigger trg_full_vendedor_historico_sem_truncate before truncate on public.full_vendedor_historico for each statement execute function public.fn_full_vendedor_historico_append_only();

create or replace function public.fn_full_dona_vendedor(p_full_id uuid, p_vendedor_id uuid)
returns boolean language sql stable security definer set search_path = public as $function$
  select exists (
    select 1 from public.profiles f
    join public.user_roles fr on fr.user_id=f.id and fr.role='franqueado'
    join public.empresas e on e.id=f.empresa_id
    join public.modelos_franquia mf on mf.id=e.modelo_id and mf.modalidade='full'
    join public.profiles v on v.id=p_vendedor_id and v.empresa_id=f.empresa_id and v.superior_id=f.id
    join public.user_roles vr on vr.user_id=v.id and vr.role='vendedor'
    where f.id=p_full_id and f.status='aprovada' and f.desligado_em is null
  );
$function$;
revoke all on function public.fn_full_dona_vendedor(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_full_dona_vendedor(uuid,uuid) to service_role;

create or replace function public.fn_bloquear_reinclusao_vendedor_full_direta()
returns trigger language plpgsql security definer set search_path=public as $function$
begin
  if old.status='suspensa' and new.status='aprovada'
     and exists (
       select 1 from public.user_roles ur
       join public.profiles f on f.id=new.superior_id
       join public.user_roles fr on fr.user_id=f.id and fr.role='franqueado'
       join public.empresas e on e.id=f.empresa_id
       join public.modelos_franquia mf on mf.id=e.modelo_id and mf.modalidade='full'
       where ur.user_id=new.id and ur.role='vendedor'
     )
     and not public.has_role(auth.uid(),'matriz') then
    raise exception 'Apenas a Matriz pode reincluir vendedor desligado da Franquia Full';
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_bloquear_reinclusao_vendedor_full_direta on public.profiles;
create trigger trg_bloquear_reinclusao_vendedor_full_direta
before update of status on public.profiles for each row
execute function public.fn_bloquear_reinclusao_vendedor_full_direta();

create or replace function public.fn_configurar_vendedor_full(
  p_vendedor_id uuid, p_equipe text default null, p_leads_dia integer default null,
  p_produtos text[] default null, p_canais uuid[] default null,
  p_comissao_venda_pct numeric default null, p_comissao_renovacao_pct numeric default null
) returns public.full_vendedor_config
language plpgsql security definer set search_path = public as $function$
declare _uid uuid:=auth.uid(); _empresa uuid; _linha public.full_vendedor_config;
begin
  if not public.fn_full_dona_vendedor(_uid,p_vendedor_id) then raise exception 'Vendedor não pertence à sua Franquia Full'; end if;
  if p_equipe is not null and char_length(trim(p_equipe))>120 then raise exception 'Equipe inválida'; end if;
  if p_leads_dia is not null and p_leads_dia<0 then raise exception 'Leads/dia inválido'; end if;
  if p_comissao_venda_pct is not null and not p_comissao_venda_pct between 0 and 100 then raise exception 'Comissão de venda inválida'; end if;
  if p_comissao_renovacao_pct is not null and not p_comissao_renovacao_pct between 0 and 100 then raise exception 'Comissão de renovação inválida'; end if;
  select empresa_id into _empresa from public.profiles where id=p_vendedor_id;
  if exists (
    select 1 from unnest(coalesce(p_canais,'{}'::uuid[])) solicitado
    left join public.canais c on c.id=solicitado
    where c.id is null or not c.ativo or (c.empresa_id is not null and c.empresa_id<>_empresa)
  ) then raise exception 'Canal inválido, inativo ou pertencente a outra empresa'; end if;
  update public.profiles set equipe=nullif(trim(p_equipe),''), leads_dia=p_leads_dia where id=p_vendedor_id;
  delete from public.profile_produtos where profile_id=p_vendedor_id;
  insert into public.profile_produtos(profile_id,produto_id)
  select p_vendedor_id,x from unnest(coalesce(p_produtos,'{}'))x
  where exists(select 1 from public.produtos p where p.id=x and p.ativo) on conflict do nothing;
  insert into public.profile_produtos(profile_id,produto_id)
  select p_vendedor_id,id from public.produtos where fixo and ativo on conflict do nothing;
  delete from public.profile_canais where profile_id=p_vendedor_id;
  insert into public.profile_canais(profile_id,canal_id)
  select p_vendedor_id,x from unnest(coalesce(p_canais,'{}'::uuid[]))x
  where exists(select 1 from public.canais c where c.id=x and c.ativo and (c.empresa_id is null or c.empresa_id=_empresa)) on conflict do nothing;
  insert into public.full_vendedor_config(profile_id,empresa_id,comissao_venda_pct,comissao_renovacao_pct,atualizado_por)
  values(p_vendedor_id,_empresa,p_comissao_venda_pct,p_comissao_renovacao_pct,_uid)
  on conflict(profile_id) do update set comissao_venda_pct=excluded.comissao_venda_pct,
    comissao_renovacao_pct=excluded.comissao_renovacao_pct, personalizado=true,
    atualizado_em=now(), atualizado_por=excluded.atualizado_por returning * into _linha;
  perform public.fn_registrar_alteracao_franquia(_empresa,'Acessos','Configuração individual do vendedor alterada',
    jsonb_build_array(jsonb_build_object('campo','Vendedor','de','—','para',p_vendedor_id::text)));
  insert into public.full_vendedor_historico(empresa_id,vendedor_id,acao,detalhes,criado_por)
  values(_empresa,p_vendedor_id,'configuracao',jsonb_build_object('equipe',p_equipe,'leads_dia',p_leads_dia),_uid);
  return _linha;
end;
$function$;
revoke all on function public.fn_configurar_vendedor_full(uuid,text,integer,text[],uuid[],numeric,numeric) from public,anon;
grant execute on function public.fn_configurar_vendedor_full(uuid,text,integer,text[],uuid[],numeric,numeric) to authenticated;

create or replace function public.fn_cadastrar_vendedor_full(
  p_user_id uuid, p_criado_por uuid, p_nome text, p_email text,
  p_cpf text default null, p_celular text default null,
  p_equipe text default null, p_leads_dia integer default null,
  p_produtos text[] default null, p_canais uuid[] default null,
  p_comissao_venda_pct numeric default null, p_comissao_renovacao_pct numeric default null
) returns uuid language plpgsql security definer set search_path = public as $function$
declare _empresa uuid; _cpf text; _celular text;
begin
  if auth.role() <> 'service_role' then raise exception 'Cadastro direto exige função segura do servidor'; end if;
  if not public.usuario_ativo(p_criado_por) or not exists(
    select 1 from public.profiles f join public.user_roles ur on ur.user_id=f.id and ur.role='franqueado'
    join public.empresas e on e.id=f.empresa_id join public.modelos_franquia mf on mf.id=e.modelo_id and mf.modalidade='full'
    where f.id=p_criado_por) then raise exception 'Solicitante não é Franquia Full ativa'; end if;
  select empresa_id into _empresa from public.profiles where id=p_criado_por;
  if nullif(trim(p_nome),'') is null or char_length(trim(p_nome))>150 then raise exception 'Nome inválido'; end if;
  if nullif(trim(p_email),'') is null or char_length(trim(p_email))>254 then raise exception 'E-mail inválido'; end if;
  _cpf:=nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),'');
  _celular:=nullif(regexp_replace(coalesce(p_celular,''),'\D','','g'),'');
  if _cpf is not null and char_length(_cpf)<>11 then raise exception 'CPF inválido'; end if;
  if _celular is not null and char_length(_celular) not between 10 and 11 then raise exception 'Celular inválido'; end if;
  if exists (
    select 1 from unnest(coalesce(p_canais,'{}'::uuid[])) solicitado
    left join public.canais c on c.id=solicitado
    where c.id is null or not c.ativo or (c.empresa_id is not null and c.empresa_id<>_empresa)
  ) then raise exception 'Canal inválido, inativo ou pertencente a outra empresa'; end if;
  insert into public.profiles(id,empresa_id,nome,email,cpf,telefone,status,superior_id,aprovada_em,equipe,leads_dia)
  values(p_user_id,_empresa,trim(p_nome),lower(trim(p_email)),_cpf,_celular,'aprovada',p_criado_por,now(),nullif(trim(p_equipe),''),p_leads_dia)
  on conflict(id) do update set empresa_id=excluded.empresa_id,nome=excluded.nome,email=excluded.email,
    status='aprovada',superior_id=p_criado_por,aprovada_em=now(),desligado_em=null,
    desligado_motivo=null,equipe=excluded.equipe,leads_dia=excluded.leads_dia,
    cpf=excluded.cpf,telefone=excluded.telefone;
  delete from public.user_roles where user_id=p_user_id;
  insert into public.user_roles(user_id,role) values(p_user_id,'vendedor');
  -- Configuração com o mesmo comportamento da RPC autenticada, sem forjar auth.uid().
  delete from public.profile_produtos where profile_id=p_user_id;
  insert into public.profile_produtos(profile_id,produto_id)
  select p_user_id,x from unnest(coalesce(p_produtos,'{}'))x where exists(select 1 from public.produtos p where p.id=x and p.ativo) on conflict do nothing;
  insert into public.profile_produtos(profile_id,produto_id) select p_user_id,id from public.produtos where fixo and ativo on conflict do nothing;
  delete from public.profile_canais where profile_id=p_user_id;
  insert into public.profile_canais(profile_id,canal_id) select p_user_id,x from unnest(coalesce(p_canais,'{}'::uuid[]))x where exists(select 1 from public.canais c where c.id=x and c.ativo and (c.empresa_id is null or c.empresa_id=_empresa)) on conflict do nothing;
  insert into public.full_vendedor_config(profile_id,empresa_id,comissao_venda_pct,comissao_renovacao_pct,atualizado_por)
  values(p_user_id,_empresa,p_comissao_venda_pct,p_comissao_renovacao_pct,p_criado_por);
  insert into public.full_vendedor_historico(empresa_id,vendedor_id,acao,detalhes,criado_por)
  values(_empresa,p_user_id,'cadastro',jsonb_build_object('nome',trim(p_nome),'email',lower(trim(p_email))),p_criado_por);
  return p_user_id;
end;
$function$;
revoke all on function public.fn_cadastrar_vendedor_full(uuid,uuid,text,text,text,text,text,integer,text[],uuid[],numeric,numeric) from public,anon,authenticated;
grant execute on function public.fn_cadastrar_vendedor_full(uuid,uuid,text,text,text,text,text,integer,text[],uuid[],numeric,numeric) to service_role;

create or replace function public.fn_desligar_vendedor_full(p_vendedor_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path = public as $function$
declare _uid uuid:=auth.uid(); _motivo text:=nullif(trim(p_motivo),'');
begin
  if not public.fn_full_dona_vendedor(_uid,p_vendedor_id) then raise exception 'Vendedor não pertence à sua Franquia Full'; end if;
  if _motivo is null or char_length(_motivo)>500 then raise exception 'Motivo deve ter entre 1 e 500 caracteres'; end if;
  update public.profiles set status='suspensa',desligado_em=now(),desligado_motivo=_motivo where id=p_vendedor_id and desligado_em is null;
  if not found then raise exception 'Vendedor já está desligado'; end if;
  insert into public.desligamento_solicitacoes(alvo_profile_id,solicitante_id,motivo,status,resolved_at,resolved_by,observacao)
  values(p_vendedor_id,_uid,_motivo,'aprovada',now(),_uid,'Desligamento direto pela própria Franquia Full');
  insert into public.full_vendedor_historico(empresa_id,vendedor_id,acao,motivo,criado_por)
  select empresa_id,p_vendedor_id,'desligamento',_motivo,_uid from public.profiles where id=p_vendedor_id;
end;
$function$;
revoke all on function public.fn_desligar_vendedor_full(uuid,text) from public,anon;
grant execute on function public.fn_desligar_vendedor_full(uuid,text) to authenticated;

create or replace function public.fn_reincluir_vendedor_full(p_vendedor_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path = public as $function$
declare _motivo text:=nullif(trim(p_motivo),'');
begin
  if not public.has_role(auth.uid(),'matriz') then raise exception 'Apenas a Matriz pode reincluir vendedor desligado'; end if;
  if _motivo is null or char_length(_motivo)>500 then raise exception 'Motivo deve ter entre 1 e 500 caracteres'; end if;
  if not exists(
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id=p.id and ur.role='vendedor'
    join public.profiles f on f.id=p.superior_id
    join public.user_roles fr on fr.user_id=f.id and fr.role='franqueado'
    join public.empresas e on e.id=p.empresa_id and e.id=f.empresa_id
    join public.modelos_franquia mf on mf.id=e.modelo_id and mf.modalidade='full'
    where p.id=p_vendedor_id and p.status='suspensa'
      and f.status='aprovada' and f.desligado_em is null
  ) then
    raise exception 'Vendedor desligado de Franquia Full não encontrado';
  end if;
  update public.profiles set status='aprovada',desligado_em=null,desligado_motivo=null where id=p_vendedor_id;
  insert into public.full_vendedor_historico(empresa_id,vendedor_id,acao,motivo,criado_por)
  select empresa_id,p_vendedor_id,'reinclusao',_motivo,auth.uid() from public.profiles where id=p_vendedor_id;
end;
$function$;
revoke all on function public.fn_reincluir_vendedor_full(uuid,text) from public,anon;
grant execute on function public.fn_reincluir_vendedor_full(uuid,text) to authenticated;
