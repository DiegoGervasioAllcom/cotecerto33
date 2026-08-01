-- V11.2.2: aprovação e criação da outbox precisam ser uma única transação.
create or replace function public.aprovar_acesso_com_boas_vindas(
  p_empresa_id uuid,
  p_perfil public.perfil,
  p_cargo_id text default null,
  p_areas text[] default null,
  p_produtos text[] default null,
  p_canais uuid[] default null,
  p_superior_id uuid default null,
  p_reclassificado boolean default false,
  p_motivo text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.aprovar_acesso(
    p_empresa_id, p_perfil, p_cargo_id, p_areas, p_produtos, p_canais,
    p_superior_id, p_reclassificado, p_motivo
  );
  return public.enfileirar_boas_vindas(p_empresa_id);
end
$$;

comment on function public.aprovar_acesso_com_boas_vindas(
  uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text
) is 'V11.2.2: aprova o acesso e cria a outbox de boas-vindas atomicamente; retorna o outbox_id.';

revoke all on function public.aprovar_acesso_com_boas_vindas(
  uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.aprovar_acesso_com_boas_vindas(
  uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text
) to authenticated;
