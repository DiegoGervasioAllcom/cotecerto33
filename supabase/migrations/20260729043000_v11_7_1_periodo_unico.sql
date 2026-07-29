-- ===========================================================================
-- V11.7.1 — período único server-side da Visão geral
--
-- Normaliza datas civis de America/Sao_Paulo em uma janela timestamptz
-- semiaberta [inicio, fim). Semana e quinzena são janelas móveis dos últimos
-- 7/15 dias, incluindo a referência. No período personalizado, p_fim é uma
-- data inclusiva de calendário; o retorno converte-a para o dia seguinte.
-- ===========================================================================

create or replace function public.normalizar_periodo_visao_geral(
  p_periodo text,
  p_referencia date default null,
  p_inicio date default null,
  p_fim date default null
)
returns table (
  inicio timestamptz,
  fim timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_periodo text := lower(trim(p_periodo));
  v_referencia date :=
    coalesce(p_referencia, (statement_timestamp() at time zone 'America/Sao_Paulo')::date);
  v_inicio_local date;
  v_fim_local date;
begin
  if v_periodo is null or v_periodo not in ('dia', 'semana', 'quinzena', 'mes', 'personalizado') then
    raise exception using
      errcode = '22023',
      message = 'periodo_invalido',
      hint = 'Use dia, semana, quinzena, mes ou personalizado.';
  end if;

  if v_periodo = 'personalizado' then
    if p_inicio is null or p_fim is null then
      raise exception using
        errcode = '22023',
        message = 'periodo_personalizado_exige_inicio_e_fim';
    end if;

    if p_fim < p_inicio then
      raise exception using
        errcode = '22023',
        message = 'periodo_personalizado_fim_anterior_ao_inicio';
    end if;

    v_inicio_local := p_inicio;
    v_fim_local := p_fim + 1;
  elsif v_periodo = 'dia' then
    v_inicio_local := v_referencia;
    v_fim_local := v_referencia + 1;
  elsif v_periodo = 'semana' then
    v_inicio_local := v_referencia - 6;
    v_fim_local := v_referencia + 1;
  elsif v_periodo = 'quinzena' then
    v_inicio_local := v_referencia - 14;
    v_fim_local := v_referencia + 1;
  else
    v_inicio_local := date_trunc('month', v_referencia::timestamp)::date;
    v_fim_local := (date_trunc('month', v_referencia::timestamp) + interval '1 month')::date;
  end if;

  return query
  select
    v_inicio_local::timestamp at time zone 'America/Sao_Paulo',
    v_fim_local::timestamp at time zone 'America/Sao_Paulo';
end;
$$;

comment on function public.normalizar_periodo_visao_geral(text, date, date, date) is
  'V11.7.1: converte dia/semana móvel 7d/quinzena móvel 15d/mes/personalizado em [inicio,fim) timestamptz no fuso America/Sao_Paulo. p_fim personalizado é inclusivo.';

revoke all on function public.normalizar_periodo_visao_geral(text, date, date, date)
  from public, anon;
grant execute on function public.normalizar_periodo_visao_geral(text, date, date, date)
  to authenticated, service_role;

-- O saldo exibido na Visão geral é calculado no servidor sobre o ledger real,
-- sob a RLS de comissao_lancamentos. O filtro explícito por auth.uid() impede
-- que perfis com visibilidade de rede transformem esta RPC em saldo de terceiros.
create index if not exists idx_comissao_lancamentos_beneficiario_criado_em
  on public.comissao_lancamentos (beneficiario_id, criado_em);

create or replace function public.saldo_comissao_visao_geral(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  saldo numeric,
  quantidade bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
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

  return query
  select
    coalesce(
      sum(case when lanc.tipo = 'credito' then lanc.valor else -lanc.valor end),
      0::numeric
    ) as saldo,
    count(*)::bigint as quantidade
  from public.comissao_lancamentos lanc
  where lanc.beneficiario_id = auth.uid()
    and lanc.criado_em >= p_inicio
    and lanc.criado_em < p_fim;
end;
$$;

comment on function public.saldo_comissao_visao_geral(timestamptz, timestamptz) is
  'V11.7.1: saldo e quantidade dos lançamentos cujo beneficiário é auth.uid(), sob RLS, na janela semiaberta [p_inicio,p_fim).';

revoke all on function public.saldo_comissao_visao_geral(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.saldo_comissao_visao_geral(timestamptz, timestamptz)
  to authenticated, service_role;
