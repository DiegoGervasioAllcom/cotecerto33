-- ===========================================================================
-- CoteCerto 3.3 — Migração inicial (Supabase self-hosted)
--
-- Execute este arquivo uma única vez no SQL Editor do seu Supabase
-- self-hosted (https://supabase-cotecerto.sandboxallcom.com).
--
-- Cria:
--   - Enums perfil / empresa_tipo / empresa_status / lead_status
--   - Tabelas: empresas, profiles, user_roles, leads, clientes,
--     oportunidades, pipeline_stages, propostas
--   - Funções security definer: has_role, empresas_visiveis
--   - Trigger: cria profile pendente no signup (handle_new_user)
--   - RPC: cadastrar_franquia(nome, tipo, documento, responsavel)
--   - RPC: aprovar_empresa(empresa_id)
--   - Pipeline padrão (6 estágios)
--   - RLS + GRANTs para todas as tabelas
-- ===========================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.perfil as enum ('matriz','master','vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.empresa_tipo as enum ('pj','pf');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.empresa_status as enum ('pendente','aprovada','recusada','suspensa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'novo','contato','qualificado','cotacao','proposta','negociacao','ganho','perdido','tarefa_hoje'
  );
exception when duplicate_object then null; end $$;

-- ---------- EMPRESAS ----------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.empresa_tipo not null,
  documento text not null,
  status public.empresa_status not null default 'pendente',
  parent_id uuid references public.empresas(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.empresas to authenticated;
grant all on public.empresas to service_role;

alter table public.empresas enable row level security;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  nome text not null default '',
  email text not null default '',
  avatar_url text,
  status public.empresa_status not null default 'pendente',
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- ---------- USER ROLES (separada — anti-escalada) ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.perfil not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- ---------- has_role (security definer) ----------
create or replace function public.has_role(_user_id uuid, _role public.perfil)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ---------- empresas_visiveis (security definer) ----------
-- Retorna o conjunto de empresa_id que o usuário enxerga conforme seu perfil.
create or replace function public.empresas_visiveis(_user_id uuid)
returns table (empresa_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _empresa uuid;
begin
  if public.has_role(_user_id, 'matriz') then
    return query select e.id from public.empresas e;
    return;
  end if;

  select p.empresa_id into _empresa from public.profiles p where p.id = _user_id;
  if _empresa is null then
    return;
  end if;

  if public.has_role(_user_id, 'master') then
    return query
      select e.id from public.empresas e
      where e.id = _empresa or e.parent_id = _empresa;
    return;
  end if;

  return query select _empresa;
end;
$$;

-- ---------- PIPELINE (compartilhado entre toda a rede) ----------
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  ordem int not null,
  nome text not null,
  cor text,
  unique (ordem)
);

grant select on public.pipeline_stages to authenticated, anon;
grant all on public.pipeline_stages to service_role;

alter table public.pipeline_stages enable row level security;

insert into public.pipeline_stages (ordem, nome, cor) values
  (1,'Novo','#FFB600'),
  (2,'Contato','#2563EB'),
  (3,'Cotação','#5C6F80'),
  (4,'Proposta','#FFB600'),
  (5,'Negociação','#2E8B57'),
  (6,'Ganho','#2E8B57')
on conflict (ordem) do nothing;

-- ---------- CLIENTES ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  documento text,
  email text,
  telefone text,
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.clientes to authenticated;
grant all on public.clientes to service_role;
alter table public.clientes enable row level security;

-- ---------- LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null, -- null = matriz pré-distribuição
  responsavel_id uuid references auth.users(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  origem text,
  nome text not null default '',
  contato text,
  status_pipeline public.lead_status not null default 'novo',
  valor numeric(14,2) default 0,
  dados jsonb default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;

create index if not exists leads_empresa_idx on public.leads (empresa_id);
create index if not exists leads_resp_idx on public.leads (responsavel_id);
create index if not exists leads_status_idx on public.leads (status_pipeline);

-- ---------- OPORTUNIDADES ----------
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  responsavel_id uuid references auth.users(id) on delete set null,
  estagio_id uuid references public.pipeline_stages(id),
  valor numeric(14,2) default 0,
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.oportunidades to authenticated;
grant all on public.oportunidades to service_role;
alter table public.oportunidades enable row level security;

-- ---------- PROPOSTAS ----------
create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  oportunidade_id uuid references public.oportunidades(id) on delete set null,
  numero text,
  status text not null default 'rascunho',
  valor numeric(14,2),
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.propostas to authenticated;
grant all on public.propostas to service_role;
alter table public.propostas enable row level security;

-- ===========================================================================
-- POLÍTICAS RLS
-- ===========================================================================

-- ---- empresas ----
drop policy if exists "empresas select" on public.empresas;
create policy "empresas select" on public.empresas
  for select to authenticated
  using (
    public.has_role(auth.uid(),'matriz')
    or id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  );

drop policy if exists "empresas insert self" on public.empresas;
create policy "empresas insert self" on public.empresas
  for insert to authenticated
  with check (true);  -- criação ocorre via RPC cadastrar_franquia (security definer)

drop policy if exists "empresas update matriz" on public.empresas;
create policy "empresas update matriz" on public.empresas
  for update to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

-- ---- profiles ----
drop policy if exists "profiles select self or rede" on public.profiles;
create policy "profiles select self or rede" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(),'matriz')
    or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  );

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'matriz'))
  with check (id = auth.uid() or public.has_role(auth.uid(),'matriz'));

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ---- user_roles ----
drop policy if exists "user_roles select self" on public.user_roles;
create policy "user_roles select self" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'matriz'));

-- ---- pipeline_stages (público de leitura) ----
drop policy if exists "pipeline read" on public.pipeline_stages;
create policy "pipeline read" on public.pipeline_stages
  for select to anon, authenticated using (true);

-- ---- leads / clientes / oportunidades / propostas (mesmo padrão) ----
do $$
declare t text;
begin
  foreach t in array array['leads','clientes','oportunidades','propostas'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select" on public.%1$s
      for select to authenticated using (
        public.has_role(auth.uid(),'matriz')
        or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
        or (
          %2$s
        )
      )
    $f$, t, case when t = 'leads' then 'responsavel_id = auth.uid()' else 'false' end);

    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_insert" on public.%1$s
      for insert to authenticated with check (
        public.has_role(auth.uid(),'matriz')
        or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      )
    $f$, t);

    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_update" on public.%1$s
      for update to authenticated using (
        public.has_role(auth.uid(),'matriz')
        or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      )
    $f$, t);

    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_delete" on public.%1$s
      for delete to authenticated using (
        public.has_role(auth.uid(),'matriz')
        or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      )
    $f$, t);
  end loop;
end $$;

-- ===========================================================================
-- TRIGGER: cria profile ao registrar novo usuário
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    'pendente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- RPC: cadastrar_franquia
-- Chamada pela tela de cadastro externo logo após o signUp.
-- ===========================================================================
create or replace function public.cadastrar_franquia(
  p_nome text,
  p_tipo public.empresa_tipo,
  p_documento text,
  p_responsavel text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _empresa uuid;
begin
  if _uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Se já tem empresa vinculada, retorna a existente
  select empresa_id into _empresa from public.profiles where id = _uid;
  if _empresa is not null then
    raise exception 'Franquia já cadastrada para este usuário';
  end if;

  insert into public.empresas (nome, tipo, documento, status)
  values (p_nome, p_tipo, p_documento, 'pendente')
  returning id into _empresa;

  update public.profiles
    set empresa_id = _empresa,
        nome = coalesce(nullif(p_responsavel,''), nome)
    where id = _uid;

  -- Role padrão: vendedor (a Matriz pode promover depois)
  insert into public.user_roles (user_id, role)
  values (_uid, 'vendedor')
  on conflict do nothing;

  return _empresa;
end;
$$;

grant execute on function public.cadastrar_franquia(text, public.empresa_tipo, text, text)
  to authenticated;

-- ===========================================================================
-- RPC: aprovar_empresa
-- Apenas Matriz pode aprovar. Marca empresa + todos os profiles da empresa.
-- ===========================================================================
create or replace function public.aprovar_empresa(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'Apenas a Matriz pode aprovar franquias';
  end if;

  update public.empresas set status = 'aprovada' where id = p_empresa_id;
  update public.profiles set status = 'aprovada' where empresa_id = p_empresa_id;
end;
$$;

grant execute on function public.aprovar_empresa(uuid) to authenticated;

-- ===========================================================================
-- SEED OPCIONAL: promova um usuário a Matriz manualmente, por exemplo:
--   insert into public.user_roles (user_id, role)
--   values ('<UUID_DO_USUARIO>', 'matriz');
--   update public.profiles set status = 'aprovada' where id = '<UUID_DO_USUARIO>';
-- ===========================================================================
