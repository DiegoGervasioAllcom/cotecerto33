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
-- Rotas iniciais da Captação Movida
--
-- As lojas começam pausadas e sem pool de vendedores. A empresa de destino é
-- resolvida pelo tipo (não por UUID/nome fixo), para o mesmo seed funcionar em
-- qualquer ambiente. Duplicidades ou aliases já ligados a outra rota abortam
-- a carga inteira em vez de produzir um roteamento ambíguo.
-- ---------------------------------------------------------------------------
do $$
declare
  _empresa_id uuid;
  _quantidade integer;
  _loja       record;
  _alias      record;
  _loja_id    uuid;
begin
  select count(*)
    into _quantidade
    from public.empresas
   where tipo = 'matriz';

  if _quantidade <> 1 then
    raise exception 'Seed Movida exige exatamente uma empresa Matriz; encontradas: %', _quantidade;
  end if;

  select id
    into _empresa_id
    from public.empresas
   where tipo = 'matriz';

  -- Impede que outra sessão crie uma rota/alias entre as validações e inserts.
  lock table public.movida_lojas in share row exclusive mode;
  lock table public.movida_loja_aliases in share row exclusive mode;

  select count(*)
    into _quantidade
    from (
      select trim(nome)
        from (values
          ('Americana'), ('Aricanduva'), ('Campinas Amoreiras'),
          ('Campinas Itapura'), ('Campinas Orosimbo'),
          ('Campinas Shop Dom Pedro'), ('Itaim Paulista'), ('Jundiaí'),
          ('Mogi das Cruzes'), ('Penha'), ('Praia Grande'), ('Santos'),
          ('São José dos Campos'), ('São Miguel Paulista'),
          ('São Paulo Radial Leste'), ('Suzano'), ('Taubaté'),
          ('Timóteo Penteado'), ('Vila Carrão'), ('Vila Ema'),
          ('Vila Guilherme')
        ) as carga(nome)
       group by trim(nome)
      having count(*) > 1
    ) duplicadas;

  if _quantidade > 0 then
    raise exception 'Seed Movida contém nomes de loja duplicados';
  end if;

  select count(*)
    into _quantidade
    from (
      select public.normalizar_alias_loja_movida(alias)
        from (values
          ('Americana', 'Americana'),
          ('Campinas Amoreiras', 'Campinas Amoreiras'),
          ('Campinas Itapura', 'Campinas Itapura'),
          ('Campinas Orosimbo', 'Campinas Orosimbo'),
          ('Campinas Shop Dom Pedro', 'Campinas Shop Dom Pedro'),
          ('Campinas Shop Dom Pedro', 'Campinas - Shopping Dom Pedro'),
          ('Campinas Shop Dom Pedro', 'Seminovos Movida Campinas Shopping Dom Pedro'),
          ('Jundiaí', 'Jundiai'),
          ('Praia Grande', 'Praia Grande'),
          ('Praia Grande', 'Seminovos Movida Praia Grande - Sp'),
          ('Santos', 'Santos'),
          ('São José dos Campos', 'Sao Jose dos Campos'),
          ('Suzano', 'Suzano'),
          ('Suzano', 'Seminovos Movida Suzano'),
          ('Suzano', 'Seminovos Movida Suzano - Sp'),
          ('Taubaté', 'Taubate'),
          ('Timóteo Penteado', 'Guarulhos Timoteo Penteado'),
          ('Timóteo Penteado', 'Timoteo Penteado'),
          ('Mogi das Cruzes', 'Mogi das Cruzes'),
          ('Aricanduva', 'Aricanduva'),
          ('Itaim Paulista', 'Itaim Paulista'),
          ('Penha', 'Penha'),
          ('São Paulo Radial Leste', 'Radial Leste'),
          ('São Paulo Radial Leste', 'Sao Paulo Radial Leste'),
          ('São Miguel Paulista', 'Sao Miguel'),
          ('São Miguel Paulista', 'Sao Miguel Paulista'),
          ('Vila Carrão', 'Vila Carrao'),
          ('Vila Ema', 'Vila Ema'),
          ('Vila Guilherme', 'Vila Guilherme')
        ) as carga(loja_nome, alias)
       group by public.normalizar_alias_loja_movida(alias)
      having count(*) > 1
          or count(distinct loja_nome) > 1
    ) duplicados;

  if _quantidade > 0 then
    raise exception 'Seed Movida contém aliases normalizados duplicados ou conflitantes';
  end if;

  for _loja in
    select nome
      from (values
        ('Americana'), ('Aricanduva'), ('Campinas Amoreiras'),
        ('Campinas Itapura'), ('Campinas Orosimbo'),
        ('Campinas Shop Dom Pedro'), ('Itaim Paulista'), ('Jundiaí'),
        ('Mogi das Cruzes'), ('Penha'), ('Praia Grande'), ('Santos'),
        ('São José dos Campos'), ('São Miguel Paulista'),
        ('São Paulo Radial Leste'), ('Suzano'), ('Taubaté'),
        ('Timóteo Penteado'), ('Vila Carrão'), ('Vila Ema'),
        ('Vila Guilherme')
      ) as carga(nome)
  loop
    select count(*)
      into _quantidade
      from public.movida_lojas
     where trim(nome) = _loja.nome;

    if _quantidade > 1 then
      raise exception 'Conflito no seed Movida: loja "%" existe % vezes', _loja.nome, _quantidade;
    end if;

    if _quantidade = 1 then
      select id
        into _loja_id
        from public.movida_lojas
       where trim(nome) = _loja.nome;

      if not exists (
        select 1 from public.movida_lojas
         where id = _loja_id and empresa_id = _empresa_id
      ) then
        raise exception 'Conflito no seed Movida: loja "%" pertence a outra empresa', _loja.nome;
      end if;

      update public.movida_lojas
         set ativa = false,
             exigir_online = false,
             atualizado_em = now()
       where id = _loja_id;
    else
      insert into public.movida_lojas (nome, empresa_id, ativa, exigir_online)
      values (_loja.nome, _empresa_id, false, false);
    end if;
  end loop;

  for _alias in
    select loja_nome, alias
      from (values
        ('Americana', 'Americana'),
        ('Campinas Amoreiras', 'Campinas Amoreiras'),
        ('Campinas Itapura', 'Campinas Itapura'),
        ('Campinas Orosimbo', 'Campinas Orosimbo'),
        ('Campinas Shop Dom Pedro', 'Campinas Shop Dom Pedro'),
        ('Campinas Shop Dom Pedro', 'Campinas - Shopping Dom Pedro'),
        ('Campinas Shop Dom Pedro', 'Seminovos Movida Campinas Shopping Dom Pedro'),
        ('Jundiaí', 'Jundiai'),
        ('Praia Grande', 'Praia Grande'),
        ('Praia Grande', 'Seminovos Movida Praia Grande - Sp'),
        ('Santos', 'Santos'),
        ('São José dos Campos', 'Sao Jose dos Campos'),
        ('Suzano', 'Suzano'),
        ('Suzano', 'Seminovos Movida Suzano'),
        ('Suzano', 'Seminovos Movida Suzano - Sp'),
        ('Taubaté', 'Taubate'),
        ('Timóteo Penteado', 'Guarulhos Timoteo Penteado'),
        ('Timóteo Penteado', 'Timoteo Penteado'),
        ('Mogi das Cruzes', 'Mogi das Cruzes'),
        ('Aricanduva', 'Aricanduva'),
        ('Itaim Paulista', 'Itaim Paulista'),
        ('Penha', 'Penha'),
        ('São Paulo Radial Leste', 'Radial Leste'),
        ('São Paulo Radial Leste', 'Sao Paulo Radial Leste'),
        ('São Miguel Paulista', 'Sao Miguel'),
        ('São Miguel Paulista', 'Sao Miguel Paulista'),
        ('Vila Carrão', 'Vila Carrao'),
        ('Vila Ema', 'Vila Ema'),
        ('Vila Guilherme', 'Vila Guilherme')
      ) as carga(loja_nome, alias)
  loop
    select id
      into _loja_id
      from public.movida_lojas
     where trim(nome) = _alias.loja_nome
       and empresa_id = _empresa_id;

    if exists (
      select 1
        from public.movida_loja_aliases
       where alias_normalizado = public.normalizar_alias_loja_movida(_alias.alias)
         and loja_id <> _loja_id
    ) then
      raise exception 'Conflito no seed Movida: alias "%" já pertence a outra loja', _alias.alias;
    end if;

    insert into public.movida_loja_aliases (loja_id, alias)
    values (_loja_id, _alias.alias)
    on conflict (alias_normalizado) do update
       set alias = excluded.alias
     where public.movida_loja_aliases.loja_id = excluded.loja_id;
  end loop;

  raise notice 'Rotas Movida prontas: 21 lojas inativas e 29 aliases, sem vendedores';
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
