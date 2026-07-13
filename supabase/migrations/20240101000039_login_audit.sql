-- Auditoria de tentativas de login
create table if not exists public.login_audit (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid null references auth.users(id) on delete set null,
  sucesso boolean not null,
  motivo_falha text null,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists login_audit_email_idx on public.login_audit (email, created_at desc);
create index if not exists login_audit_created_idx on public.login_audit (created_at desc);
create index if not exists login_audit_sucesso_idx on public.login_audit (sucesso, created_at desc);

grant select on public.login_audit to authenticated;
grant all on public.login_audit to service_role;

alter table public.login_audit enable row level security;

-- Apenas matriz/master pode ler
drop policy if exists login_audit_select_matriz on public.login_audit;
create policy login_audit_select_matriz on public.login_audit
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'master')
  );

-- RPC pública (security definer) para registrar tentativa — pode ser chamada por anon
create or replace function public.registrar_tentativa_login(
  p_email text,
  p_sucesso boolean,
  p_motivo text default null,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  insert into public.login_audit (email, user_id, sucesso, motivo_falha, user_agent)
  values (lower(coalesce(p_email,'')), v_user_id, coalesce(p_sucesso,false), p_motivo, p_user_agent)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.registrar_tentativa_login(text, boolean, text, text) to anon, authenticated;
