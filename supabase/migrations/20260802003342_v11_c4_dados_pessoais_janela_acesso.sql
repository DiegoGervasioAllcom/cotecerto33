-- ===========================================================================
-- V11 · C4 (Frente 3) — dados pessoais e janela de acesso do time interno
--
-- Fidelidade ao protótipo r40 (`MATRIZ_USERS`/`buildCadMatrizModal`): a aba
-- Cadastros Matriz edita CPF, sobrenome, nascimento, sexo, função, estado civil,
-- telefones, e-mail pessoal e a "janela de acesso" (período + dias da semana +
-- horário). Nada disso existia em `profiles` — só nome/email/telefone (celular).
--
-- `telefone` já existente continua sendo o celular; `telefone_residencial` e
-- `telefone_comercial` são novos, junto com o resto.
-- ===========================================================================

alter table public.profiles
  add column if not exists cpf text,
  add column if not exists sobrenome text,
  add column if not exists data_nascimento date,
  add column if not exists sexo text,
  add column if not exists funcao text,
  add column if not exists estado_civil text,
  add column if not exists telefone_residencial text,
  add column if not exists telefone_comercial text,
  add column if not exists email_pessoal text,
  add column if not exists dias_acesso text[],
  add column if not exists hora_inicio time,
  add column if not exists hora_fim time,
  add column if not exists periodo_inicio date,
  add column if not exists periodo_fim date;

do $$ begin
  alter table public.profiles
    add constraint profiles_sexo_check check (sexo is null or sexo in ('Masculino', 'Feminino'));
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_estado_civil_check check (
      estado_civil is null or estado_civil in (
        'Casado(a)', 'Solteiro(a)', 'Viúvo(a)', 'Divorciado(a)', 'União estável'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_dias_acesso_check check (
      dias_acesso is null or dias_acesso <@ array['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']::text[]
    );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles add constraint profiles_cpf_check check (char_length(cpf) <= 20);
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles
    add constraint profiles_sobrenome_check check (char_length(sobrenome) <= 120);
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_funcao_check check (char_length(funcao) <= 120);
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles
    add constraint profiles_email_pessoal_check check (char_length(email_pessoal) <= 254);
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles
    add constraint profiles_telefone_residencial_check check (char_length(telefone_residencial) <= 30);
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles
    add constraint profiles_telefone_comercial_check check (char_length(telefone_comercial) <= 30);
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.periodo_inicio is
  'V11 C4: início da janela de acesso do colaborador Matriz. Também é a fonte do
   filtro "Ano" na aba Cadastros Matriz (fallback: aprovada_em, depois created_at).';
