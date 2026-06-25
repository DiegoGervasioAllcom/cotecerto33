-- Fix ambiguous "empresa_id" reference in approval/refusal functions
drop function if exists public.aprovar_empresa(uuid);
drop function if exists public.recusar_empresa(uuid, text);

create or replace function public.aprovar_empresa(p_empresa_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'somente matriz pode aprovar';
  end if;
  update public.empresas set status='aprovada', aprovada_em=now() where id=p_empresa_id;
  update public.profiles set status='aprovada', aprovada_em=now() where empresa_id=p_empresa_id;
end $$;

create or replace function public.recusar_empresa(p_empresa_id uuid, motivo text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'somente matriz pode recusar';
  end if;
  update public.empresas set status='recusada', recusada_em=now(), recusa_motivo=motivo where id=p_empresa_id;
  update public.profiles set status='recusada' where empresa_id=p_empresa_id;
end $$;

grant execute on function public.aprovar_empresa(uuid) to authenticated;
grant execute on function public.recusar_empresa(uuid, text) to authenticated;
