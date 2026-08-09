-- V11.5c — integridade da hierarquia Franquia Full -> Master.

create table if not exists public.full_master_historico (
  id uuid primary key default gen_random_uuid(),
  full_profile_id uuid not null references public.profiles(id),
  master_anterior_id uuid references public.profiles(id),
  master_novo_id uuid references public.profiles(id),
  acao text not null check (acao in ('suspensao_orfandade', 'vinculo_master', 'reativacao')),
  motivo text not null check (char_length(motivo) between 3 and 500),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

create index if not exists idx_full_master_historico_full
  on public.full_master_historico(full_profile_id, criado_em desc);

alter table public.full_master_historico enable row level security;
revoke all on public.full_master_historico from public, anon, authenticated;
grant select on public.full_master_historico to authenticated;
grant all on public.full_master_historico to service_role;

drop policy if exists full_master_historico_select on public.full_master_historico;
create policy full_master_historico_select on public.full_master_historico
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or full_profile_id = auth.uid()
    or full_profile_id in (
      select p.id from public.profiles p
       where p.empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev)
    )
  );

create or replace function public.fn_full_master_historico_append_only()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  raise exception 'Histórico Full/Master é imutável';
end;
$function$;
drop trigger if exists trg_full_master_historico_sem_update on public.full_master_historico;
create trigger trg_full_master_historico_sem_update before update on public.full_master_historico
for each statement execute function public.fn_full_master_historico_append_only();
drop trigger if exists trg_full_master_historico_sem_delete on public.full_master_historico;
create trigger trg_full_master_historico_sem_delete before delete on public.full_master_historico
for each statement execute function public.fn_full_master_historico_append_only();
drop trigger if exists trg_full_master_historico_sem_truncate on public.full_master_historico;
create trigger trg_full_master_historico_sem_truncate before truncate on public.full_master_historico
for each statement execute function public.fn_full_master_historico_append_only();

create or replace function public.fn_master_valido_para_full(
  p_full_profile_id uuid,
  p_master_profile_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select p_master_profile_id is not null and exists (
    select 1
      from public.profiles f
      join public.empresas e on e.id = f.empresa_id
      join public.modelos_franquia mf on mf.id = e.modelo_id and mf.modalidade = 'full'
      join public.user_roles fr on fr.user_id = f.id and fr.role = 'franqueado'
      join public.profiles m on m.id = p_master_profile_id
      join public.user_roles mr on mr.user_id = m.id and mr.role = 'master'
     where f.id = p_full_profile_id
       and m.status = 'aprovada'
       and m.desligado_em is null
  );
$function$;

revoke all on function public.fn_master_valido_para_full(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_master_valido_para_full(uuid, uuid) to service_role;

-- Legado: nenhuma escolha automática de Master. A Full órfã fica suspensa,
-- preserva todos os dados e perde autorização imediatamente pelo pre-request.
with orfas as (
  select p.id, p.superior_id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'franqueado'
    join public.empresas e on e.id = p.empresa_id
    join public.modelos_franquia mf on mf.id = e.modelo_id and mf.modalidade = 'full'
   where p.status = 'aprovada'
     and p.desligado_em is null
     and not public.fn_master_valido_para_full(p.id, p.superior_id)
), auditados as (
  insert into public.full_master_historico
    (full_profile_id, master_anterior_id, acao, motivo)
  select id, superior_id, 'suspensao_orfandade',
         'Full suspensa automaticamente: Master ativo obrigatório não configurado.'
    from orfas
  returning full_profile_id
)
update public.profiles p
   set status = 'suspensa',
       desligado_em = now(),
       desligado_motivo = 'Regularização obrigatória: vincule um Master ativo à Franquia Full.'
  from auditados a
 where p.id = a.full_profile_id;

create or replace function public.fn_validar_integridade_full_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if exists (
    select 1
      from public.profiles f
      join public.user_roles fr on fr.user_id = f.id and fr.role = 'franqueado'
      join public.empresas e on e.id = f.empresa_id
      join public.modelos_franquia mf on mf.id = e.modelo_id and mf.modalidade = 'full'
     where f.status = 'aprovada'
       and f.desligado_em is null
       and not public.fn_master_valido_para_full(f.id, f.superior_id)
  ) then
    raise exception 'Franquia Full ativa exige superior_id apontando para Master ativo e aprovado';
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_validar_full_master_profiles on public.profiles;
create constraint trigger trg_validar_full_master_profiles
after insert or update or delete on public.profiles
deferrable initially deferred for each row
execute function public.fn_validar_integridade_full_master();

drop trigger if exists trg_validar_full_master_roles on public.user_roles;
create constraint trigger trg_validar_full_master_roles
after insert or update or delete on public.user_roles
deferrable initially deferred for each row
execute function public.fn_validar_integridade_full_master();

drop trigger if exists trg_validar_full_master_empresas on public.empresas;
create constraint trigger trg_validar_full_master_empresas
after insert or update or delete on public.empresas
deferrable initially deferred for each row
execute function public.fn_validar_integridade_full_master();

drop trigger if exists trg_validar_full_master_modelos on public.modelos_franquia;
create constraint trigger trg_validar_full_master_modelos
after insert or update or delete on public.modelos_franquia
deferrable initially deferred for each row
execute function public.fn_validar_integridade_full_master();

create or replace function public.fn_vincular_master_full(
  p_full_profile_id uuid,
  p_master_profile_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  _uid uuid := auth.uid();
  _anterior uuid;
  _motivo text := nullif(trim(p_motivo), '');
begin
  if not public.has_role(_uid, 'matriz') then
    raise exception 'Apenas a Matriz pode vincular ou regularizar o Master da Full';
  end if;
  if _motivo is null or char_length(_motivo) > 500 then
    raise exception 'Motivo deve ter entre 3 e 500 caracteres';
  end if;
  if char_length(_motivo) < 3 then
    raise exception 'Motivo deve ter entre 3 e 500 caracteres';
  end if;

  select superior_id into _anterior from public.profiles where id = p_full_profile_id for update;
  if not found then raise exception 'Franquia Full não encontrada'; end if;
  if not public.fn_master_valido_para_full(p_full_profile_id, p_master_profile_id) then
    raise exception 'O superior informado precisa ser um Master ativo e aprovado';
  end if;

  update public.profiles
     set superior_id = p_master_profile_id,
         status = 'aprovada', desligado_em = null, desligado_motivo = null,
         aprovada_em = coalesce(aprovada_em, now())
   where id = p_full_profile_id;

  insert into public.full_master_historico
    (full_profile_id, master_anterior_id, master_novo_id, acao, motivo, criado_por)
  values
    (p_full_profile_id, _anterior, p_master_profile_id,
     case when _anterior is distinct from p_master_profile_id then 'vinculo_master' else 'reativacao' end,
     _motivo, _uid);
end;
$function$;

revoke all on function public.fn_vincular_master_full(uuid, uuid, text) from public, anon;
grant execute on function public.fn_vincular_master_full(uuid, uuid, text) to authenticated;

-- Fecha a porta principal de aprovação com mensagem de negócio antes do trigger.
create or replace function public.aprovar_acesso(
  p_empresa_id uuid, p_perfil public.perfil, p_cargo_id text default null,
  p_areas text[] default null, p_produtos text[] default null,
  p_canais uuid[] default null, p_superior_id uuid default null,
  p_reclassificado boolean default false, p_motivo text default null
) returns void language plpgsql security definer set search_path = public
as $function$
declare
  _uid uuid := auth.uid(); _profile uuid; _bloco text; _vende boolean;
  _modalidade text;
begin
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite aprovar este pedido';
  end if;
  select p.id, mf.modalidade into _profile, _modalidade
    from public.profiles p
    join public.empresas e on e.id = p.empresa_id
    left join public.modelos_franquia mf on mf.id = e.modelo_id
   where p.empresa_id = p_empresa_id limit 1;
  if _profile is null then raise exception 'pedido não tem cadastro de pessoa associado'; end if;
  if p_reclassificado and (p_motivo is null or char_length(trim(p_motivo)) < 3) then
    raise exception 'reclassificar é exceção: informe o motivo';
  end if;
  -- Nesta altura a role definitiva da Full ainda não foi inserida. Validar o
  -- Master candidato diretamente; o constraint trigger diferível valida o
  -- estado completo (Full + empresa + role + Master) ao fim da transação.
  if p_perfil = 'franqueado' and _modalidade = 'full'
     and not exists (
       select 1
         from public.profiles m
         join public.user_roles mr on mr.user_id = m.id and mr.role = 'master'
        where m.id = p_superior_id
          and m.status = 'aprovada'
          and m.desligado_em is null
     ) then
    raise exception 'Franquia Full exige um Master ativo e aprovado';
  end if;
  _vende := p_perfil <> 'master';
  if not _vende and (coalesce(array_length(p_produtos,1),0)>0 or coalesce(array_length(p_canais,1),0)>0) then
    raise exception 'Master franqueado não vende nem recebe leads: não tem produtos nem canais';
  end if;
  if p_cargo_id is not null and p_perfil not in ('matriz','coordenador','supervisor','interno') then
    raise exception 'cargo só se aplica ao time interno da Matriz';
  end if;
  delete from public.user_roles where user_id = _profile;
  insert into public.user_roles(user_id,role) values (_profile,p_perfil);
  update public.profiles set status='aprovada', aprovada_em=now(), cargo_id=p_cargo_id,
    superior_id=case when p_perfil='franqueado' and _modalidade='full' then p_superior_id else coalesce(p_superior_id,superior_id) end
    where id=_profile;
  delete from public.profile_areas where profile_id=_profile;
  if coalesce(array_length(p_areas,1),0)>0 then
    insert into public.profile_areas(profile_id,area_chave)
    select _profile,a from unnest(p_areas)a where exists(select 1 from public.areas x where x.chave=a) on conflict do nothing;
  end if;
  delete from public.profile_produtos where profile_id=_profile;
  if _vende then
    _bloco := case when p_perfil in ('matriz','coordenador','supervisor','interno') then 'interno' else 'externo' end;
    insert into public.profile_produtos(profile_id,produto_id)
    select _profile,p from unnest(coalesce(nullif(p_produtos,'{}'),array(select public.fn_produtos_padrao(_bloco))))p
    where exists(select 1 from public.produtos x where x.id=p and x.ativo) on conflict do nothing;
    insert into public.profile_produtos(profile_id,produto_id)
    select _profile,id from public.produtos where fixo and ativo on conflict do nothing;
  end if;
  delete from public.profile_canais where profile_id=_profile;
  if _vende and coalesce(array_length(p_canais,1),0)>0 then
    insert into public.profile_canais(profile_id,canal_id)
    select _profile,c from unnest(p_canais)c where exists(select 1 from public.canais x where x.id=c) on conflict do nothing;
  end if;
  update public.empresas set status='aprovada', aprovada_em=now(),
    reclassificado_em=case when p_reclassificado then now() else null end,
    reclassificacao_motivo=case when p_reclassificado then trim(p_motivo) else null end
   where id=p_empresa_id;
end;
$function$;

revoke all on function public.aprovar_acesso(uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text) from public, anon;
grant execute on function public.aprovar_acesso(uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text) to authenticated;
