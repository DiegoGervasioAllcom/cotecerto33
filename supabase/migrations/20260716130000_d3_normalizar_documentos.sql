-- ============================================================
-- D3.1 — normalização e validação de documentos/contatos
--
-- Guarda documento/CPF/CNPJ/CEP/telefone SÓ com dígitos (a máscara é
-- responsabilidade da UI, que já foi ajustada em D3.2 para re-mascarar
-- na exibição). Trigger BEFORE INSERT/UPDATE tira tudo que não é dígito
-- (`regexp_replace(col, '\D', '', 'g')`). E-mail não é normalizado, só
-- validado por regex.
--
-- Colunas normalizadas:
--   empresas: documento, socio_cpf, celular, telefone, telefone_recado
--   clientes: documento, telefone
--   cotacao_segurado: cpf_cnpj, cep, celular, tel_res
--   cotacao_perfil: cond_cpf, cep_pernoite
--
-- Checks de formato (tolerantes a null/''), aplicados no valor já
-- normalizado (só dígitos):
--   documento/CPF/CNPJ: length in (11,14)
--   CEP: length = 8
--   telefone: length between 10 and 11
--   email (não normalizado): regex simples
--
-- Uniques:
--   empresas.documento: global (índice parcial where documento <> ''
--     para não colidir em registros sem documento)
--   clientes: composto (empresa_id, documento) — mesmo CPF pode ser
--     cliente de empresas diferentes (índice parcial where documento <> '')
--   profiles.email: defesa em profundidade (já é único via auth) — parcial
--     where email <> ''
-- ============================================================

-- ---------- normalização (triggers) ----------

create or replace function public.normalizar_documentos_empresas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.documento := regexp_replace(new.documento, '\D', '', 'g');
  new.socio_cpf := regexp_replace(new.socio_cpf, '\D', '', 'g');
  new.celular := regexp_replace(new.celular, '\D', '', 'g');
  new.telefone := regexp_replace(new.telefone, '\D', '', 'g');
  new.telefone_recado := regexp_replace(new.telefone_recado, '\D', '', 'g');
  return new;
end;
$$;

drop trigger if exists trg_normalizar_documentos_empresas on public.empresas;
create trigger trg_normalizar_documentos_empresas
  before insert or update on public.empresas
  for each row execute function public.normalizar_documentos_empresas();

create or replace function public.normalizar_documentos_clientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.documento := regexp_replace(new.documento, '\D', '', 'g');
  new.telefone := regexp_replace(new.telefone, '\D', '', 'g');
  return new;
end;
$$;

drop trigger if exists trg_normalizar_documentos_clientes on public.clientes;
create trigger trg_normalizar_documentos_clientes
  before insert or update on public.clientes
  for each row execute function public.normalizar_documentos_clientes();

create or replace function public.normalizar_documentos_cotacao_segurado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.cpf_cnpj := regexp_replace(new.cpf_cnpj, '\D', '', 'g');
  new.cep := regexp_replace(new.cep, '\D', '', 'g');
  new.celular := regexp_replace(new.celular, '\D', '', 'g');
  new.tel_res := regexp_replace(new.tel_res, '\D', '', 'g');
  return new;
end;
$$;

drop trigger if exists trg_normalizar_documentos_cotacao_segurado on public.cotacao_segurado;
create trigger trg_normalizar_documentos_cotacao_segurado
  before insert or update on public.cotacao_segurado
  for each row execute function public.normalizar_documentos_cotacao_segurado();

create or replace function public.normalizar_documentos_cotacao_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.cond_cpf := regexp_replace(new.cond_cpf, '\D', '', 'g');
  new.cep_pernoite := regexp_replace(new.cep_pernoite, '\D', '', 'g');
  return new;
end;
$$;

drop trigger if exists trg_normalizar_documentos_cotacao_perfil on public.cotacao_perfil;
create trigger trg_normalizar_documentos_cotacao_perfil
  before insert or update on public.cotacao_perfil
  for each row execute function public.normalizar_documentos_cotacao_perfil();

-- ---------- checks de formato (valor já normalizado = só dígitos) ----------

do $$ begin
  alter table public.empresas
    add constraint empresas_documento_formato
    check (documento is null or documento = '' or char_length(documento) in (11,14));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_socio_cpf_formato
    check (socio_cpf is null or socio_cpf = '' or char_length(socio_cpf) = 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_celular_formato
    check (celular is null or celular = '' or char_length(celular) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_telefone_formato
    check (telefone is null or telefone = '' or char_length(telefone) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_telefone_recado_formato
    check (telefone_recado is null or telefone_recado = '' or char_length(telefone_recado) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_email_formato
    check (email is null or email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes
    add constraint clientes_documento_formato
    check (documento is null or documento = '' or char_length(documento) in (11,14));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes
    add constraint clientes_telefone_formato
    check (telefone is null or telefone = '' or char_length(telefone) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes
    add constraint clientes_email_formato
    check (email is null or email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado
    add constraint cotacao_segurado_cpf_cnpj_formato
    check (cpf_cnpj is null or cpf_cnpj = '' or char_length(cpf_cnpj) in (11,14));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado
    add constraint cotacao_segurado_cep_formato
    check (cep is null or cep = '' or char_length(cep) = 8);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado
    add constraint cotacao_segurado_celular_formato
    check (celular is null or celular = '' or char_length(celular) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado
    add constraint cotacao_segurado_tel_res_formato
    check (tel_res is null or tel_res = '' or char_length(tel_res) between 10 and 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado
    add constraint cotacao_segurado_email_formato
    check (email is null or email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil
    add constraint cotacao_perfil_cond_cpf_formato
    check (cond_cpf is null or cond_cpf = '' or char_length(cond_cpf) in (11,14));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil
    add constraint cotacao_perfil_cep_pernoite_formato
    check (cep_pernoite is null or cep_pernoite = '' or char_length(cep_pernoite) = 8);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_email_formato
    check (email is null or email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

-- ---------- uniques ----------

create unique index if not exists empresas_documento_uidx
  on public.empresas (documento) where documento <> '';

create unique index if not exists clientes_empresa_documento_uidx
  on public.clientes (empresa_id, documento) where documento <> '';

create unique index if not exists profiles_email_uidx
  on public.profiles (email) where email <> '';
