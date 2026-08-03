-- ===========================================================================
-- V11 · D1 (Frente 4) — schema da régua de performance
--
-- Três réguas (`interno`, `rede`, `full`), uma linha fixa por bloco — não uma
-- tabela por bloco, pra simplificar a RPC de salvar e o job que vai iterar as
-- três. Números padrão são os mesmos do protótipo (`PERF_RULES`) — placeholder
-- editável, não a regra de negócio confirmada (ver Riscos do
-- docs/PLANO_REGUA_V11.md: o doc "Regras Decididas" nunca chegou).
--
-- Escrita só via RPC (D2/D6) ou pelo job (D4) — nunca direto pelo cliente.
-- Por isso o revoke de UPDATE nas colunas de sinal em `profiles`: funções
-- security definer rodam com o privilégio de quem é dona da function
-- (o owner da migration), não do papel de quem chamou, então continuam
-- escrevendo essas colunas sem problema — só a escrita DIRETA via
-- `supabase.from("profiles").update(...)` é que fica bloqueada.
-- ===========================================================================

create table if not exists public.regua_performance_config (
  bloco text primary key check (bloco in ('interno', 'rede', 'full')),
  janela_dias int not null default 30 check (janela_dias > 0),
  conv_atencao_pct numeric(5, 2) not null default 25 check (conv_atencao_pct between 0 and 100),
  conv_travado_pct numeric(5, 2) not null default 15 check (conv_travado_pct between 0 and 100),
  dias_atencao int not null default 10 check (dias_atencao >= 0),
  dias_travado int not null default 15 check (dias_travado >= 0),
  cancelamentos_limite int not null default 3 check (cancelamentos_limite >= 0),
  pausa_leads_ativa boolean not null default true,
  notifica_supervisor boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id),
  constraint regua_travado_pior_que_atencao check (conv_travado_pct <= conv_atencao_pct),
  constraint regua_dias_travado_maior check (dias_atencao <= dias_travado)
);

comment on table public.regua_performance_config is
  'V11 D1: limites configuráveis da régua de performance, um bloco por linha
   (interno/rede/full). Escrita só via fn_salvar_regua_performance (D2) — grava
   no histórico append-only via fn_registrar_alteracao, com gate de diretor.';

insert into public.regua_performance_config
  (bloco, janela_dias, conv_atencao_pct, conv_travado_pct, dias_atencao, dias_travado, cancelamentos_limite, pausa_leads_ativa, notifica_supervisor)
values
  ('interno', 30, 25, 15, 10, 15, 3, true, true),
  ('rede', 30, 20, 12, 12, 20, 4, true, true),
  ('full', 30, 22, 12, 12, 18, 3, true, true)
on conflict (bloco) do nothing;

alter table public.regua_performance_config enable row level security;

revoke all on public.regua_performance_config from public, anon, authenticated;
grant select on public.regua_performance_config to authenticated;
grant all on public.regua_performance_config to service_role;

drop policy if exists regua_performance_config_select on public.regua_performance_config;
create policy regua_performance_config_select on public.regua_performance_config
  for select to authenticated
  using (true);

-- Sem policy de insert/update/delete: só via RPC security definer (D2) ou o job (D4).

-- ---------------------------------------------------------------------------
-- Sinal calculado por pessoa (vendedor CLT interno, vendedor de rede, ou
-- franqueado Individual — que "é" o vendedor da própria franquia).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists performance_status text check (performance_status in ('ativo', 'atencao', 'travado')),
  add column if not exists performance_motivo jsonb,
  add column if not exists performance_calculado_em timestamptz,
  add column if not exists performance_revisado_em timestamptz,
  add column if not exists performance_revisado_por uuid references public.profiles(id);

comment on column public.profiles.performance_status is
  'V11 D1: sinal calculado pelo job (D4) — null = ainda não avaliado. Nunca
   escrito direto pelo cliente (ver revoke de UPDATE abaixo); só pelo job ou
   por fn_revisar_reativar_performance (D6).';

comment on column public.profiles.performance_motivo is
  'V11 D1: números da janela que geraram o sinal (leads, conversão, cancelamentos
   etc. — mesmo formato que fn_calcular_performance_pessoa/D3 devolve), pro
   modal de resumo (D9) não precisar recalcular para exibir "por que este sinal".';

-- `authenticated` já tem UPDATE de tabela inteira (policies de self/matriz) —
-- revoke de coluna específica não sobrepõe privilégio de tabela em Postgres.
-- Por isso o trigger: bloqueia qualquer UPDATE dessas 5 colunas que não venha
-- do job (`service_role`) ou de dentro de fn_revisar_reativar_performance
-- (D6), que liga a flag local à transação antes de escrever.
create or replace function public.fn_bloquear_escrita_direta_performance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role'
     or coalesce(current_setting('regua.internal_write', true), 'false') = 'true' then
    return new;
  end if;

  if new.performance_status is distinct from old.performance_status
     or new.performance_motivo is distinct from old.performance_motivo
     or new.performance_calculado_em is distinct from old.performance_calculado_em
     or new.performance_revisado_em is distinct from old.performance_revisado_em
     or new.performance_revisado_por is distinct from old.performance_revisado_por
  then
    raise exception 'Estes campos só podem ser alterados pelo job da régua ou pela revisão de performance.';
  end if;

  return new;
end;
$function$;

comment on function public.fn_bloquear_escrita_direta_performance() is
  'V11 D1: bloqueia UPDATE direto (inclusive por matriz) nas colunas de sinal
   de performance — só o job (service_role) ou fn_revisar_reativar_performance
   (D6, via set_config(''regua.internal_write'',''true'',true) na mesma
   transação) escrevem essas colunas.';

drop trigger if exists trg_bloquear_escrita_direta_performance on public.profiles;
create trigger trg_bloquear_escrita_direta_performance
  before update on public.profiles
  for each row execute function public.fn_bloquear_escrita_direta_performance();
