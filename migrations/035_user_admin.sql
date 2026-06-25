-- 035 — Adiciona 'franqueado' ao enum perfil e RPCs/policies para gestão de usuários.

do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'perfil' and e.enumlabel = 'franqueado'
  ) then
    alter type public.perfil add value 'franqueado';
  end if;
end$$;

-- Permite que a Matriz gerencie profiles e user_roles
drop policy if exists "profiles_matriz_admin" on public.profiles;
create policy "profiles_matriz_admin" on public.profiles
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

drop policy if exists "user_roles_matriz_admin" on public.user_roles;
create policy "user_roles_matriz_admin" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

-- RPC: atualizar perfil de usuário (nome + empresa_id)
create or replace function public.admin_atualizar_usuario(
  p_user_id uuid,
  p_nome text,
  p_empresa_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'matriz') then
    raise exception 'permissao negada';
  end if;
  update public.profiles
     set nome = coalesce(p_nome, nome),
         empresa_id = p_empresa_id
   where id = p_user_id;
end$$;

grant execute on function public.admin_atualizar_usuario(uuid,text,uuid) to authenticated;

-- RPC: desativar/reativar
create or replace function public.admin_set_usuario_status(
  p_user_id uuid,
  p_ativo boolean,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'matriz') then
    raise exception 'permissao negada';
  end if;
  if p_ativo then
    update public.profiles
       set desligado_em = null,
           desligado_motivo = null,
           status = 'aprovada'
     where id = p_user_id;
  else
    update public.profiles
       set desligado_em = now(),
           desligado_motivo = p_motivo,
           status = 'suspensa'
     where id = p_user_id;
  end if;
end$$;

grant execute on function public.admin_set_usuario_status(uuid,boolean,text) to authenticated;
