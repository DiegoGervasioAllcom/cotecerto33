-- ===========================================================================
-- CoteCerto 3.3 — Seed do administrador da Matriz
--
-- Execute este arquivo UMA ÚNICA VEZ no SQL Editor do Supabase self-hosted,
-- DEPOIS de já ter rodado supabase-migration.sql.
--
-- Cria:
--   - Empresa "Matriz CoteCerto" (status aprovada)
--   - Usuário desenvolvimento@suppercerto.com.br (senha Supper@123!)
--   - Profile vinculado, aprovado
--   - Role 'matriz'
-- ===========================================================================

create extension if not exists pgcrypto;

do $$
declare
  _user_id    uuid;
  _empresa_id uuid;
  _email      text := 'desenvolvimento@suppercerto.com.br';
  _password   text := 'Supper@123!';
begin
  -- 1) Empresa Matriz ------------------------------------------------------
  select id into _empresa_id from public.empresas where nome = 'Matriz CoteCerto' limit 1;
  if _empresa_id is null then
    insert into public.empresas (nome, tipo, documento, status)
    values ('Matriz CoteCerto', 'pj', '00.000.000/0001-00', 'aprovada')
    returning id into _empresa_id;
  else
    update public.empresas set status = 'aprovada' where id = _empresa_id;
  end if;

  -- 2) Usuário auth.users --------------------------------------------------
  select id into _user_id from auth.users where email = _email limit 1;

  if _user_id is null then
    _user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      _user_id,
      'authenticated', 'authenticated',
      _email,
      crypt(_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome','Administrador Matriz'),
      now(), now(),
      '', '', '', ''
    );

    -- identity (necessária no Supabase moderno)
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      _user_id,
      'email',
      _user_id::text,
      jsonb_build_object('sub', _user_id::text, 'email', _email, 'email_verified', true),
      now(), now(), now()
    );
  else
    -- Garante senha e confirmação caso já existisse
    update auth.users
       set encrypted_password = crypt(_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = _user_id;
  end if;

  -- 3) Profile -------------------------------------------------------------
  insert into public.profiles (id, empresa_id, nome, email, status)
  values (_user_id, _empresa_id, 'Administrador Matriz', _email, 'aprovada')
  on conflict (id) do update
     set empresa_id = excluded.empresa_id,
         nome       = excluded.nome,
         email      = excluded.email,
         status     = 'aprovada';

  -- 4) Role matriz ---------------------------------------------------------
  insert into public.user_roles (user_id, role)
  values (_user_id, 'matriz')
  on conflict (user_id, role) do nothing;

  raise notice 'Admin pronto: % (empresa %)', _user_id, _empresa_id;
end $$;
