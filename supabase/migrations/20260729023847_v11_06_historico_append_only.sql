-- ===========================================================================
-- V11.0.6 (item 7 do Handoff) — histórico de alterações append-only com DE/PARA
--
-- O protótipo r40 é explícito sobre o contrato: "Ninguém edita nem apaga este
-- histórico — nem os diretores. Só entram linhas novas. Consulta liberada a
-- qualquer cargo com acesso à área; alterar as regras exige diretor com senha."
--
-- Modelagem espelhando HIST_LOG do protótipo:
--   when -> quando · who -> autor_nome · area -> area · what -> o_que
--   det:[[campo, de, para], ...] -> de_para jsonb [{campo, de, para}, ...]
--
-- Três camadas garantem a imutabilidade, porque grant sozinho não basta:
--
--   1) GRANT — `authenticated` recebe apenas SELECT. Não existe INSERT direto:
--      a única porta de escrita é a função auditada da V11.0.5, que exige
--      diretor + senha. Assim ninguém forja linha de log.
--   2) TRIGGER — bloqueia UPDATE e DELETE para QUALQUER papel, inclusive
--      service_role. É o que faz valer "nem os diretores": as server functions
--      do app usam service_role, e sem isso elas poderiam reescrever o passado.
--   3) RLS — recorta a leitura por escopo.
--
-- `empresa_id` nulo = histórico global da Matriz. Preenchido = histórico próprio
-- da franquia (a Franquia Full tem o dela; ver V11.5.6), que no protótipo é uma
-- segunda tela com o mesmo formato.
-- ===========================================================================

create table if not exists public.historico_alteracoes (
  id          uuid primary key default gen_random_uuid(),
  quando      timestamptz not null default now(),
  autor_id    uuid references public.profiles(id) on delete set null,
  -- Snapshot do nome: log imutável não pode perder a autoria quando o cadastro
  -- é desligado e o profile removido (a FK acima zera, o texto permanece).
  autor_nome  text not null check (char_length(autor_nome) between 1 and 120),
  area        text not null check (char_length(area) between 2 and 60),
  o_que       text not null check (char_length(o_que) between 2 and 400),
  de_para     jsonb check (de_para is null or jsonb_typeof(de_para) = 'array'),
  empresa_id  uuid references public.empresas(id) on delete cascade
);

comment on table public.historico_alteracoes is
  'V11.0.6: histórico imutável de alterações de política (item 7 do Handoff).
   Append-only por grant + trigger; a única escrita é via
   fn_registrar_alteracao (V11.0.5), que exige diretor autenticado com senha.
   empresa_id nulo = histórico da Matriz; preenchido = histórico da franquia.';

comment on column public.historico_alteracoes.de_para is
  'Array [{campo, de, para}] — o "det" do protótipo, que alimenta o botão
   "Ver DE/PARA". NULL quando a alteração não tem diff campo a campo.';

create index if not exists idx_historico_quando
  on public.historico_alteracoes(quando desc);
create index if not exists idx_historico_area on public.historico_alteracoes(area);
create index if not exists idx_historico_empresa on public.historico_alteracoes(empresa_id);

-- ---------------------------------------------------------------------------
-- Camada 1: grants — só leitura para a aplicação.
-- ---------------------------------------------------------------------------
alter table public.historico_alteracoes enable row level security;

revoke all on public.historico_alteracoes from public, anon, authenticated;
grant select on public.historico_alteracoes to authenticated;

-- service_role: só select/insert. O `revoke all` explícito antes do grant é
-- necessário porque o Supabase concede ALL em public por default privileges —
-- e isso inclui TRUNCATE, que **não dispara trigger de linha**. Sem este revoke,
-- a aplicação (que usa service_role nas server functions) apagaria o log inteiro
-- com um TRUNCATE, passando por cima do append-only. Verificado na prática.
revoke all on public.historico_alteracoes from service_role;
grant select, insert on public.historico_alteracoes to service_role;

-- ---------------------------------------------------------------------------
-- Camada 2: trigger — o passado não se reescreve, para ninguém.
-- ---------------------------------------------------------------------------
create or replace function public.fn_historico_imutavel()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  raise exception
    'historico_alteracoes é append-only: % não é permitido (item 7 do Handoff V11)',
    tg_op;
end;
$function$;

comment on function public.fn_historico_imutavel() is
  'V11.0.6: barra UPDATE/DELETE no histórico para qualquer papel, incluindo
   service_role — as server functions do app usam service_role e sem isto
   poderiam reescrever o log.';

drop trigger if exists trg_historico_sem_update on public.historico_alteracoes;
create trigger trg_historico_sem_update
  before update on public.historico_alteracoes
  for each row execute function public.fn_historico_imutavel();

drop trigger if exists trg_historico_sem_delete on public.historico_alteracoes;
create trigger trg_historico_sem_delete
  before delete on public.historico_alteracoes
  for each row execute function public.fn_historico_imutavel();

-- TRUNCATE precisa de trigger de STATEMENT: os dois acima são FOR EACH ROW e
-- truncate não passa por eles. Cinto e suspensório junto com o revoke — se uma
-- migration futura reconceder ALL a algum papel, o log continua protegido.
drop trigger if exists trg_historico_sem_truncate on public.historico_alteracoes;
create trigger trg_historico_sem_truncate
  before truncate on public.historico_alteracoes
  for each statement execute function public.fn_historico_imutavel();

-- ---------------------------------------------------------------------------
-- Camada 3: RLS de leitura.
--
-- "Consulta liberada a qualquer cargo com acesso à área": quem tem Configurações
-- ou Acessos e permissões no escopo enxerga o histórico global. O histórico de
-- uma franquia segue empresas_visiveis().
-- ---------------------------------------------------------------------------
drop policy if exists historico_select_escopo on public.historico_alteracoes;
create policy historico_select_escopo on public.historico_alteracoes
  for select to authenticated
  using (
    case
      when empresa_id is null then
        public.fn_tem_area(auth.uid(), 'mconf')
        or public.fn_tem_area(auth.uid(), 'macessos')
      else
        empresa_id in (select public.empresas_visiveis(auth.uid()))
    end
  );
