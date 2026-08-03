-- ===========================================================================
-- V11.7.6a (Frente 7) — régua "franquia abaixo da meta" por período flexível
--
-- Hoje só existe uma heurística client-side (`operacao/franquias.index.tsx`,
-- `statusChip`) sobre `v_franquia_kpis`/`oportunidades`, view legada mês-fixo
-- que a V11 não usa mais como fonte de venda real. Esta RPC é a régua
-- server-side sobre a fonte real (`propostas.emitida_em`), com a janela
-- flexível de V11.7.1 — não toca na view/tela legada (consumo front é outra
-- task, V7.6b, feita depois por outro agente).
--
-- "Franquia" aqui é qualquer linha de `public.empresas` (o mesmo universo que
-- `v_franquia_kpis` usa, sem filtrar por `empresas.tipo` — esse enum é pj/pf,
-- não tem uma distinção "matriz vs franquia"; a Matriz normalmente não tem
-- meta própria cadastrada, então naturalmente não entra na contagem).
--
-- Decisões de design:
--
-- 1. Escopo: filtro explícito por `empresas_visiveis(auth.uid())` (não só RLS
--    implícita das tabelas envolvidas) — pedido explícito da task, e mais
--    fácil de testar/auditar do que confiar na policy de `metas`/`propostas`
--    sozinha (que tem regras próprias e mais frouxas para o próprio usuário).
-- 2. Meta do mês: quando a janela cai dentro de um único mês-calendário
--    (America/Sao_Paulo, mesmo fuso de `normalizar_periodo_visao_geral`), o
--    mês certo é óbvio. Quando a janela cruza mês (só acontece em período
--    "personalizado" ou numa quinzena virada de mês), usamos o mês de
--    `p_inicio` — regra simples, documentada, aceitando a mesma limitação que
--    D3 (`fn_calcular_performance_pessoa`) já aceitou: não é perfeita para
--    janelas multi-mês raras, mas essas são o caso extremo, não o comum (a UI
--    usa dia/semana/quinzena/mês predefinidos na prática).
-- 3. Pró-rata: mesmo padrão de D3 — `meta_vendas * dias_da_janela / 30.0`,
--    calculando dias_da_janela como `(p_fim - p_inicio)` em dias corridos
--    (não dias úteis), já que a janela vem sempre alinhada a dias civis por
--    `normalizar_periodo_visao_geral`.
-- 4. Sem meta cadastrada para o mês => franquia NÃO entra na contagem (nem a
--    favor, nem contra) — mesmo comportamento do `statusChip` client-side
--    ("Sem meta" é neutro, não "abaixo").
-- 5. Retorno: `integer` (só a contagem). Os outros alertas de
--    `dashboard-alerts.ts` (sem-atendimento, sla-estourado, etc.) também só
--    precisam de contagem + navegação para uma tela que já filtra pelo mesmo
--    critério (Franquias) — não há necessidade de retornar a lista aqui.
-- ===========================================================================

create index if not exists idx_propostas_empresa_emitida_cancelada
  on public.propostas (empresa_id, emitida_em, cancelada_em);

create or replace function public.franquias_abaixo_meta_visao_geral(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_ano int;
  v_mes int;
  v_dias numeric;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'nao_autenticado';
  end if;

  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception using
      errcode = '22023',
      message = 'intervalo_invalido',
      hint = 'Informe uma janela valida no formato [inicio, fim).';
  end if;

  -- Mês/ano de referência da meta: o mês-calendário (America/Sao_Paulo) onde
  -- p_inicio cai. Ver nota de design (2) sobre janelas que cruzam mês.
  v_ano := extract(year from (p_inicio at time zone 'America/Sao_Paulo'))::int;
  v_mes := extract(month from (p_inicio at time zone 'America/Sao_Paulo'))::int;
  v_dias := extract(epoch from (p_fim - p_inicio)) / 86400.0;

  select count(*) into v_total
    from public.empresas e
    join public.metas mt
      on mt.escopo = 'empresa'
     and mt.ref_id = e.id
     and mt.ano = v_ano
     and mt.mes = v_mes
   where e.id in (select empresa_id from public.empresas_visiveis(auth.uid()))
     and (mt.meta_vendas * v_dias / 30.0) > (
       select count(*)
         from public.propostas p
        where p.empresa_id = e.id
          and p.emitida_em >= p_inicio
          and p.emitida_em < p_fim
          and p.cancelada_em is null
     );

  return coalesce(v_total, 0);
end;
$$;

comment on function public.franquias_abaixo_meta_visao_geral(timestamptz, timestamptz) is
  'V11.7.6a: conta franquias visíveis (empresas_visiveis) com meta cadastrada (metas.escopo=empresa) para o mês de p_inicio cujas vendas reais (propostas.emitida_em em [p_inicio,p_fim), não canceladas) ficam abaixo da meta pró-rata pela janela (meta_vendas*dias/30.0). Franquia sem meta cadastrada não entra na contagem.';

revoke all on function public.franquias_abaixo_meta_visao_geral(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.franquias_abaixo_meta_visao_geral(timestamptz, timestamptz)
  to authenticated, service_role;
