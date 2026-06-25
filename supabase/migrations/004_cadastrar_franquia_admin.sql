-- ===========================================================================
-- CoteCerto 3.3 — Migração 004
-- Variante admin do cadastro: aceita user_id explicitamente, para uso via
-- service role (server function) já que o auth.uid() é nulo nesse contexto.
-- ===========================================================================

create or replace function public.cadastrar_franquia_admin(p jsonb, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _empresa uuid;
  _tipo public.empresa_tipo;
  _nome text;
  _doc text;
  _resp text;
begin
  if p_user is null then
    raise exception 'user_id obrigatório';
  end if;

  _tipo := (p->>'tipo')::public.empresa_tipo;
  _nome := nullif(p->>'nome','');
  _doc  := nullif(p->>'documento','');
  _resp := coalesce(nullif(p->>'socio_nome',''), _nome);

  if _nome is null or _doc is null then
    raise exception 'Nome e documento são obrigatórios';
  end if;

  select empresa_id into _empresa from public.profiles where id = p_user;
  if _empresa is not null then
    raise exception 'Franquia já cadastrada para este usuário';
  end if;

  insert into public.empresas (
    nome, tipo, documento, status,
    email, celular, telefone_recado, endereco,
    data_nascimento, socio_nome, socio_cpf, socio_rg,
    rg, contato_emergencia, pix_chave, dados_bancarios,
    dados_cadastro
  ) values (
    _nome, _tipo, _doc, 'pendente',
    nullif(p->>'email',''),
    nullif(p->>'celular',''),
    nullif(p->>'telefone_recado',''),
    nullif(p->>'endereco',''),
    nullif(p->>'data_nascimento','')::date,
    nullif(p->>'socio_nome',''),
    nullif(p->>'socio_cpf',''),
    nullif(p->>'socio_rg',''),
    nullif(p->>'rg',''),
    nullif(p->>'contato_emergencia',''),
    nullif(p->>'pix_chave',''),
    nullif(p->>'dados_bancarios',''),
    p
  )
  returning id into _empresa;

  -- Profile pode não existir ainda (trigger handle_new_user pode não ter rodado)
  insert into public.profiles (id, empresa_id, nome, email, telefone, status)
  values (
    p_user,
    _empresa,
    coalesce(_resp, _nome),
    nullif(p->>'email',''),
    nullif(p->>'celular',''),
    'pendente'
  )
  on conflict (id) do update
    set empresa_id = excluded.empresa_id,
        nome = coalesce(excluded.nome, public.profiles.nome),
        telefone = coalesce(excluded.telefone, public.profiles.telefone);

  insert into public.user_roles (user_id, role)
  values (p_user, 'vendedor')
  on conflict do nothing;

  return _empresa;
end;
$$;

revoke all on function public.cadastrar_franquia_admin(jsonb, uuid) from public, anon, authenticated;
-- Apenas service_role chama essa função (via server function).
grant execute on function public.cadastrar_franquia_admin(jsonb, uuid) to service_role;
