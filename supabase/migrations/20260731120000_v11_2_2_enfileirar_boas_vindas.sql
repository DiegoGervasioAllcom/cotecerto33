-- ===========================================================================
-- V11.2.2 — enfileira boas-vindas somente depois da aprovação do acesso
-- O link de recovery é gerado pelo dispatcher e nunca persiste na outbox.
-- ===========================================================================

-- Uma aprovação produz no máximo um evento de boas-vindas. Repetir a RPC
-- devolve o mesmo id, sem criar outro envio.
create unique index if not exists email_outbox_boas_vindas_empresa_uidx
  on public.email_outbox (empresa_id)
  where tipo = 'boas_vindas';

create or replace function public.enfileirar_boas_vindas(p_empresa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _profile_id uuid;
  _nome text;
  _email text;
  _cargo text;
  _areas text[];
  _outbox_id uuid;
begin
  -- A alçada é revalidada no servidor; conhecer o id da empresa não basta.
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite concluir a aprovação deste pedido';
  end if;

  select p.id, p.nome, p.email, c.nome
    into _profile_id, _nome, _email, _cargo
    from public.empresas e
    join public.profiles p on p.empresa_id = e.id
    left join public.cargos c on c.id = p.cargo_id
   where e.id = p_empresa_id
     and e.status = 'aprovada'
     and p.status = 'aprovada';

  if _profile_id is null then
    raise exception 'empresa e usuário precisam estar aprovados antes das boas-vindas';
  end if;
  if _email is null
     or char_length(trim(_email)) not between 3 and 320
     or trim(_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'usuário aprovado sem e-mail válido';
  end if;

  -- Replica a resolução do escopo efetivo sem expor uma consulta arbitrária:
  -- override individual, quando existe; caso contrário, preset do cargo.
  if exists (
    select 1 from public.profile_areas pa where pa.profile_id = _profile_id
  ) then
    select coalesce(array_agg(a.label order by a.ordem), '{}'::text[])
      into _areas
      from public.profile_areas pa
      join public.areas a on a.chave = pa.area_chave
     where pa.profile_id = _profile_id;
  else
    select coalesce(array_agg(a.label order by a.ordem), '{}'::text[])
      into _areas
      from public.profiles p
      join public.cargo_areas ca on ca.cargo_id = p.cargo_id
      join public.areas a on a.chave = ca.area_chave
     where p.id = _profile_id;
  end if;

  insert into public.email_outbox (
    empresa_id, tipo, destinatario, payload, criado_por
  ) values (
    p_empresa_id,
    'boas_vindas',
    lower(trim(_email)),
    jsonb_strip_nulls(jsonb_build_object(
      'nome', _nome,
      'tipo_declarado', public.fn_tipo_declarado_email(p_empresa_id),
      'cargo', _cargo,
      'areas', to_jsonb(coalesce(_areas, '{}'::text[]))
    )),
    _uid
  )
  on conflict (empresa_id) where tipo = 'boas_vindas' do nothing
  returning id into _outbox_id;

  if _outbox_id is null then
    select eo.id into _outbox_id
      from public.email_outbox eo
     where eo.empresa_id = p_empresa_id
       and eo.tipo = 'boas_vindas';
  end if;

  return _outbox_id;
end
$$;

comment on function public.enfileirar_boas_vindas(uuid) is
  'V11.2.2: após empresa e profile aprovados, revalida a alçada e cria uma única
   boas-vindas por empresa. Retorna somente o outbox_id; token e link de recovery
   são gerados em memória pelo dispatcher e nunca entram no banco.';

revoke all on function public.enfileirar_boas_vindas(uuid)
  from public, anon, authenticated;
grant execute on function public.enfileirar_boas_vindas(uuid)
  to authenticated;
