-- ===========================================================================
-- 051 (G4.5) — Campanhas Elite trimestrais: cálculo/fechamento + ledger.
--
-- Consome `campanhas_elite` (parametrizada na G4.1: faixas de PRODUÇÃO com
-- bonus_pct, uma campanha vigente por tipo elite_franqueado/elite_master) e
-- grava crédito no ledger, no mesmo estilo do fechamento de competência
-- (G4.4 / `fechar_comissao_competencia`): RPC única, transação atômica,
-- advisory lock, trava de idempotência.
--
-- ---------------------------------------------------------------------------
-- DECISÕES (usuário, 18/07) — resumo para quem ler o código no futuro:
--
-- Trimestre = calendário padrão (Q1 jan-mar, Q2 abr-jun, Q3 jul-set, Q4
-- out-dez), 3 competências 'YYYY-MM' por trimestre. Faixa atingida = maior
-- `minimo` (das faixas em campanhas_elite.faixas) <= produção acumulada do
-- BENEFICIÁRIO no trimestre. Bônus = STEP SIMPLES: bonus_pct da faixa
-- atingida incide sobre a COMISSÃO INTEIRA do trimestre (não é excedente).
-- Sem faixa atingida (produção < mínimo mais baixo) -> sem bônus, nada
-- lançado.
--
-- Participantes:
--   - elite_franqueado: role 'franqueado' (cobre franquia full E individual —
--     a modalidade não distingue elegibilidade da campanha, só o schema de
--     área de grupo x cockpit individual no front).
--   - elite_master: role 'master'. Supervisor NÃO participa (mesmo com
--     produção alta) — filtro explícito, não incluído em nenhum loop abaixo.
--   PREMISSA: cada usuário tem UM papel (a classificação de acesso do G1.4
--   atribui um tipo único por pessoa). Um profile com 'franqueado' E 'master'
--   simultâneos em user_roles — estado não suportado — entraria nos dois loops
--   e receberia os dois bônus; se essa combinação passar a existir, adicionar
--   um filtro de exclusão mútua aqui.
--
-- Produção do trimestre (base da FAIXA, não da comissão):
--   - franqueado: soma de propostas.premio das propostas PAGAS (pago_em not
--     null) e NÃO canceladas (cancelada_em is null) da PRÓPRIA empresa do
--     franqueado (profiles.empresa_id), cuja fn_competencia(pago_em) caia
--     numa das 3 competências do trimestre.
--   - master: soma de propostas.premio (mesmo filtro pago/não cancelada) das
--     empresas ligadas aos profiles retornados por fn_rede_subordinados(master)
--     — MESMA função/semântica da G4.4 (subárvore de superior_id, EXCLUINDO o
--     próprio master). Ou seja, a "rede" aqui é só a subárvore de
--     subordinados; a produção da empresa do próprio master (se ele mesmo
--     lançar propostas) NÃO entra nesta soma — escolha conservadora e
--     simétrica ao que a G4.4 já faz para a base do override (evita
--     ambiguidade sobre se o master "conta a si mesmo" na campanha da rede
--     que ele lidera).
--
-- Comissão do trimestre (base do BÔNUS, distinta da produção acima): soma de
-- (créditos - débitos) do PRÓPRIO beneficiário (beneficiario_id) no ledger,
-- nas 3 competências do trimestre, EXCLUINDO origem = 'campanha_elite' (não
-- compor bônus sobre bônus de trimestres/rodadas anteriores).
--
-- Lançamento: crédito único por beneficiário elegível+premiado, competência
-- = ÚLTIMA competência do trimestre (ex.: Q1 -> 'YYYY-03'), origem
-- 'campanha_elite', papel = 'elite_franqueado'/'elite_master' (valores novos
-- no check de comissao_lancamentos.papel), regra jsonb com faixa/bonus_pct/
-- producao/comissao_base/campanha_id para auditoria.
--
-- Idempotência: trava por (ano, trimestre) via pg_advisory_xact_lock +
-- checagem "já existe lançamento origem='campanha_elite' em qualquer das 3
-- competências do trimestre" -> exceção (sem reabertura nesta fatia, mesmo
-- padrão da G4.4).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) papel novo permitido no ledger para os créditos de campanha Elite.
-- ---------------------------------------------------------------------------
alter table public.comissao_lancamentos
  drop constraint if exists comissao_lancamentos_papel_valido;

alter table public.comissao_lancamentos
  add constraint comissao_lancamentos_papel_valido
  check (papel is null or papel in (
    'vendedor_clt', 'franquia_individual', 'franquia_full', 'master', 'supervisor',
    'elite_franqueado', 'elite_master'
  ));

-- ---------------------------------------------------------------------------
-- 2) fn_trimestre — mapeia competência 'YYYY-MM' -> trimestre (1-4).
--    IMMUTABLE: só faz aritmética inteira sobre o texto, sem depender de fuso.
-- ---------------------------------------------------------------------------
create or replace function public.fn_trimestre(p_competencia text)
returns int
language sql
immutable
set search_path = public
as $$
  select ceil(substring(p_competencia from 6 for 2)::int / 3.0)::int;
$$;

comment on function public.fn_trimestre(text) is
  'G4.5: trimestre (1-4) de uma competência YYYY-MM (calendário padrão: Q1
   jan-mar, Q2 abr-jun, Q3 jul-set, Q4 out-dez). Não valida formato da entrada
   (quem chama já valida competencia ~ regex); IMMUTABLE, só aritmética.';

-- ---------------------------------------------------------------------------
-- 3) fn_competencias_trimestre — as 3 competências 'YYYY-MM' de (ano, trimestre).
-- ---------------------------------------------------------------------------
create or replace function public.fn_competencias_trimestre(p_ano int, p_trimestre int)
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    to_char(make_date(p_ano, (p_trimestre - 1) * 3 + 1, 1), 'YYYY-MM'),
    to_char(make_date(p_ano, (p_trimestre - 1) * 3 + 2, 1), 'YYYY-MM'),
    to_char(make_date(p_ano, (p_trimestre - 1) * 3 + 3, 1), 'YYYY-MM')
  ];
$$;

comment on function public.fn_competencias_trimestre(int, int) is
  'G4.5: as 3 competências YYYY-MM do trimestre p_trimestre (1-4) do ano p_ano,
   em ordem (ex.: (2026,1) -> {2026-01,2026-02,2026-03}). Não valida
   p_trimestre (quem chama valida antes) — make_date lança erro para mês fora
   de 1-12 se p_trimestre estiver fora de 1-4.';

-- ---------------------------------------------------------------------------
-- 4) fechar_campanha_elite — RPC de fechamento trimestral (só matriz).
-- ---------------------------------------------------------------------------
create or replace function public.fechar_campanha_elite(p_ano int, p_trimestre int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _comps text[];
  _ultima_comp text;
  _existe boolean;
  _campanha_franq record;
  _campanha_master record;
  rec record;
  _producao numeric;
  _comissao_base numeric;
  _faixa jsonb;
  _bonus_pct numeric;
  _valor numeric;

  _cnt_franq int := 0; _soma_franq numeric := 0;
  _cnt_master int := 0; _soma_master numeric := 0;
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'forbidden';
  end if;

  if p_trimestre not between 1 and 4 then
    raise exception 'trimestre inválido: % (deve ser 1-4)', p_trimestre;
  end if;

  _comps := public.fn_competencias_trimestre(p_ano, p_trimestre);
  _ultima_comp := _comps[3];

  -- Serializa fechamentos concorrentes do MESMO (ano,trimestre) — mesma lição
  -- da G4.4: sem lock, duas chamadas simultâneas passam ambas na checagem
  -- "já paga" e duplicam bônus.
  perform pg_advisory_xact_lock(hashtext('fechar_campanha_elite:' || p_ano || ':' || p_trimestre));

  select exists(
    select 1 from public.comissao_lancamentos
     where origem = 'campanha_elite'
       and competencia = any(_comps)
  ) into _existe;
  if _existe then
    raise exception 'campanha elite do trimestre %/% já paga', p_trimestre, p_ano;
  end if;

  select * into _campanha_franq from public.campanhas_elite where tipo = 'elite_franqueado' and ativa;
  select * into _campanha_master from public.campanhas_elite where tipo = 'elite_master' and ativa;

  -- =========================================================================
  -- elite_franqueado: role 'franqueado' (full E individual).
  -- =========================================================================
  if _campanha_franq.id is not null then
    for rec in
      select p.id as profile_id, p.empresa_id
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id and ur.role = 'franqueado'
       where p.empresa_id is not null
    loop
      select coalesce(sum(pr.premio), 0)
        into _producao
        from public.propostas pr
       where pr.empresa_id = rec.empresa_id
         and pr.pago_em is not null
         and pr.cancelada_em is null
         and public.fn_competencia(pr.pago_em) = any(_comps);

      -- faixa mais alta cujo mínimo <= produção (step simples).
      select f into _faixa
        from jsonb_array_elements(_campanha_franq.faixas) f
       where (f ->> 'minimo')::numeric <= _producao
       order by (f ->> 'minimo')::numeric desc
       limit 1;

      continue when _faixa is null;

      _bonus_pct := (_faixa ->> 'bonus_pct')::numeric;

      select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0)
        into _comissao_base
        from public.comissao_lancamentos
       where beneficiario_id = rec.profile_id
         and competencia = any(_comps)
         and origem <> 'campanha_elite';

      continue when _comissao_base <= 0;

      _valor := round(_comissao_base * _bonus_pct / 100.0, 2);
      continue when _valor <= 0;

      insert into public.comissao_lancamentos
        (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
      values
        (rec.profile_id, rec.profile_id, rec.empresa_id, 'credito', _valor,
         'Campanha Elite Franqueado · trimestre ' || p_trimestre || '/' || p_ano,
         'campanha_elite', 'elite_franqueado', _ultima_comp,
         jsonb_build_object(
           'campanha_id', _campanha_franq.id, 'faixa', _faixa, 'bonus_pct', _bonus_pct,
           'producao', _producao, 'comissao_base', _comissao_base,
           'ano', p_ano, 'trimestre', p_trimestre
         ));

      _cnt_franq := _cnt_franq + 1;
      _soma_franq := _soma_franq + _valor;
    end loop;
  end if;

  -- =========================================================================
  -- elite_master: role 'master'. Supervisor explicitamente NÃO participa
  -- (não há loop para 'supervisor' nesta função).
  -- =========================================================================
  if _campanha_master.id is not null then
    for rec in
      select p.id as profile_id, p.empresa_id
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id and ur.role = 'master'
    loop
      -- produção da REDE (subárvore de superior_id, exclui o próprio master —
      -- mesma semântica de fn_rede_subordinados usada na base do override G4.4).
      select coalesce(sum(pr.premio), 0)
        into _producao
        from public.propostas pr
       where pr.empresa_id in (
               select distinct p2.empresa_id
                 from public.profiles p2
                where p2.id in (select id from public.fn_rede_subordinados(rec.profile_id))
                  and p2.empresa_id is not null
             )
         and pr.pago_em is not null
         and pr.cancelada_em is null
         and public.fn_competencia(pr.pago_em) = any(_comps);

      select f into _faixa
        from jsonb_array_elements(_campanha_master.faixas) f
       where (f ->> 'minimo')::numeric <= _producao
       order by (f ->> 'minimo')::numeric desc
       limit 1;

      continue when _faixa is null;

      _bonus_pct := (_faixa ->> 'bonus_pct')::numeric;

      select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0)
        into _comissao_base
        from public.comissao_lancamentos
       where beneficiario_id = rec.profile_id
         and competencia = any(_comps)
         and origem <> 'campanha_elite';

      continue when _comissao_base <= 0;

      _valor := round(_comissao_base * _bonus_pct / 100.0, 2);
      continue when _valor <= 0;

      insert into public.comissao_lancamentos
        (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
      values
        (rec.profile_id, rec.profile_id, rec.empresa_id, 'credito', _valor,
         'Campanha Elite Master · trimestre ' || p_trimestre || '/' || p_ano,
         'campanha_elite', 'elite_master', _ultima_comp,
         jsonb_build_object(
           'campanha_id', _campanha_master.id, 'faixa', _faixa, 'bonus_pct', _bonus_pct,
           'producao', _producao, 'comissao_base', _comissao_base,
           'ano', p_ano, 'trimestre', p_trimestre
         ));

      _cnt_master := _cnt_master + 1;
      _soma_master := _soma_master + _valor;
    end loop;
  end if;

  return jsonb_build_object(
    'ano', p_ano,
    'trimestre', p_trimestre,
    'competencias', _comps,
    'elite_franqueado', jsonb_build_object('qtd', _cnt_franq, 'soma', _soma_franq),
    'elite_master', jsonb_build_object('qtd', _cnt_master, 'soma', _soma_master)
  );
end;
$$;

comment on function public.fechar_campanha_elite(int, int) is
  'G4.5: fecha a campanha Elite trimestral (ano, trimestre 1-4) — só matriz.
   Para cada beneficiário elegível (role franqueado -> elite_franqueado; role
   master -> elite_master; supervisor NUNCA participa), calcula a PRODUÇÃO do
   trimestre (franqueado: propostas pagas/não-canceladas da própria empresa;
   master: idem, das empresas da subárvore fn_rede_subordinados, exclui o
   próprio master), acha a faixa mais alta com minimo <= produção (step
   simples) e aplica bonus_pct sobre a COMISSÃO do trimestre (créditos-débitos
   do próprio beneficiário no ledger, excluindo origem=''campanha_elite'').
   Sem faixa atingida ou comissão-base <= 0: nada é lançado. Idempotente por
   trava: já existe lançamento origem=''campanha_elite'' em alguma das 3
   competências do trimestre -> exceção (sem reabertura nesta fatia).
   security definer / search_path fixo; EXECUTE revogado de public/anon (gate
   real é has_role(matriz) interno, padrão do repo).';

revoke execute on function public.fechar_campanha_elite(int, int) from public, anon;
grant execute on function public.fechar_campanha_elite(int, int) to authenticated;
