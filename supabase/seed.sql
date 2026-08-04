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
--   - Ana e Melo, os 2 diretores (regra 2 de docs/CoteCerto_Regras_Decididas.html:
--     "a carga inicial [de diretores] entra como seed do banco; depois disso,
--     tudo pela tela"). Sem esse seed, `fn_eh_diretor` nunca é true pra ninguém
--     e nenhuma tela de Governança funciona (Salvar política, Diretores,
--     Histórico) — confirmado em 03/08/2026: não havia seed nenhum até aqui.
--     Este bloco é só para DESENVOLVIMENTO/local — em produção, os 2 diretores
--     reais já existem como contas próprias (cadastradas pelo fluxo normal) e
--     só precisam do `update profiles set diretor = true` manual, documentado
--     em docs/RUNBOOK_DEPLOY.md, com os UUIDs reais deles.
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
    -- tipo='matriz' (não 'pj'): migrations 025/026 (fix_enum_empresa_tipo_matriz
    -- / set_matriz_tipo) já preparam o enum e corrigem esta linha por nome, mas
    -- só rodam UMA vez, antes deste seed existir — em `db reset` local elas
    -- não têm o que corrigir (a empresa nasce aqui, depois delas). Sem isto, a
    -- Matriz seedada localmente fica com tipo='pj' e passa despercebida pelos
    -- filtros `tipo <> 'matriz'` da distribuição automática (024/028/032) e
    -- pela V11.I.1 (`fn_empresa_matriz`, 20260804120000) — nenhuma linha
    -- responderia por "a operação própria da Matriz".
    insert into public.empresas (nome, tipo, documento, status)
    values ('Matriz CoteCerto', 'matriz', '00.000.000/0001-00', 'aprovada')
    returning id into _empresa_id;
  else
    update public.empresas set status = 'aprovada', tipo = 'matriz' where id = _empresa_id;
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

-- ---------------------------------------------------------------------------
-- Diretores iniciais (Ana e Melo) — regra 2, ver comentário no topo do arquivo
-- ---------------------------------------------------------------------------
do $$
declare
  _empresa_id uuid;
  _diretor    record;
  _user_id    uuid;
begin
  select id into _empresa_id from public.empresas where nome = 'Matriz CoteCerto' limit 1;

  for _diretor in
    select * from (values
      ('ana@suppercerto.com.br',  'Ana'),
      ('melo@suppercerto.com.br', 'Melo')
    ) as t(email, nome)
  loop
    select id into _user_id from auth.users where email = _diretor.email limit 1;

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
        _diretor.email,
        crypt('Supper@123!', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', _diretor.nome),
        now(), now(),
        '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider, provider_id, identity_data,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        _user_id,
        'email',
        _user_id::text,
        jsonb_build_object('sub', _user_id::text, 'email', _diretor.email, 'email_verified', true),
        now(), now(), now()
      );
    else
      update auth.users
         set encrypted_password = crypt('Supper@123!', gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = _user_id;
    end if;

    insert into public.profiles (id, empresa_id, nome, email, status, diretor)
    values (_user_id, _empresa_id, _diretor.nome, _diretor.email, 'aprovada', true)
    on conflict (id) do update
       set empresa_id = excluded.empresa_id,
           nome       = excluded.nome,
           email      = excluded.email,
           status     = 'aprovada',
           diretor    = true;

    insert into public.user_roles (user_id, role)
    values (_user_id, 'matriz')
    on conflict (user_id, role) do nothing;

    raise notice 'Diretor pronto: % (%)', _diretor.nome, _user_id;
  end loop;
end $$;
