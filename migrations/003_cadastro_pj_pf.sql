-- ===========================================================================
-- CoteCerto 3.3 — Migração 003
-- Cadastro externo completo (PJ/PF) + dados expandidos da franquia.
-- Execute uma única vez no SQL editor.
-- ===========================================================================

-- ---------- EMPRESAS: campos do formulário de cadastro ----------
alter table public.empresas add column if not exists endereco text;
alter table public.empresas add column if not exists celular text;
alter table public.empresas add column if not exists telefone_recado text;
alter table public.empresas add column if not exists data_nascimento date;
alter table public.empresas add column if not exists socio_nome text;
alter table public.empresas add column if not exists socio_cpf text;
alter table public.empresas add column if not exists socio_rg text;
alter table public.empresas add column if not exists contato_emergencia text;
alter table public.empresas add column if not exists pix_chave text;
alter table public.empresas add column if not exists dados_bancarios text;
alter table public.empresas add column if not exists rg text; -- PF
alter table public.empresas add column if not exists dados_cadastro jsonb not null default '{}'::jsonb;

-- ---------- RPC: cadastrar_franquia (expandida) ----------
drop function if exists public.cadastrar_franquia(text, public.empresa_tipo, text, text);
drop function if exists public.cadastrar_franquia(jsonb);

create or replace function public.cadastrar_franquia(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _empresa uuid;
  _tipo public.empresa_tipo;
  _nome text;
  _doc text;
  _resp text;
begin
  if _uid is null then
    raise exception 'Não autenticado';
  end if;

  _tipo := (p->>'tipo')::public.empresa_tipo;
  _nome := nullif(p->>'nome','');
  _doc  := nullif(p->>'documento','');
  _resp := coalesce(nullif(p->>'socio_nome',''), _nome);

  if _nome is null or _doc is null then
    raise exception 'Nome e documento são obrigatórios';
  end if;

  select empresa_id into _empresa from public.profiles where id = _uid;
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

  update public.profiles
    set empresa_id = _empresa,
        nome = coalesce(_resp, nome),
        telefone = coalesce(nullif(p->>'celular',''), telefone)
    where id = _uid;

  insert into public.user_roles (user_id, role)
  values (_uid, 'vendedor')
  on conflict do nothing;

  return _empresa;
end;
$$;

grant execute on function public.cadastrar_franquia(jsonb) to authenticated;
