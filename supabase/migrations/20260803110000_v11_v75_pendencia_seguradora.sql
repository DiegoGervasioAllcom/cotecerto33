-- ===========================================================================
-- V11.7.5 (Frente 7) — função canônica de "pendência da seguradora"
--
-- A fórmula certa (transmitida, não emitida, não cancelada) já existia, mas só
-- embutida no CTE de `funis_por_canal_visao_geral` (20260729050000). Fora dali,
-- dois lugares usam heurísticas erradas hoje (`visao-geral.tsx:275` filtra
-- status='gerada', que é "ainda não enviada", não "pendente"; a aba Transmissão
-- de `operacao/vendas.tsx` também não distingue os dois casos) — corrigi-los é
-- V7.5b/V7.6c (front), fora desta migration.
--
-- Extraímos a fórmula em duas funções, para dois usos diferentes:
--
-- 1. `esta_pendente_seguradora(transmitida_em, emitida_em, cancelada_em)` —
--    function SQL pura sobre os 3 timestamps (não sobre um id), immutable, para
--    poder ser usada dentro do WHERE/filter de uma agregação em massa (a RPC de
--    contagem abaixo) sem precisar buscar a proposta linha a linha. `immutable`
--    é seguro aqui: dados os mesmos 3 timestamps, o resultado é sempre o mesmo,
--    não depende de estado do banco.
-- 2. `proposta_pendente_seguradora(p_proposta_id)` — conveniência para checar
--    UMA proposta específica (ex.: tela de detalhe), sob RLS de `propostas`
--    (security invoker: se o usuário não pode ver a proposta, a subquery não
--    retorna linha e a função devolve null). Delega para a função (1).
--
-- Decisão: NÃO refatoramos `funis_por_canal_visao_geral` para chamar a nova
-- função — está testada (`tests/db/rpc-funis-canal-v11.test.ts`) e o ganho de
-- reaproveitamento não compensa o risco de regressão numa RPC já em produção
-- de fato (mesmo sem prod ativa, é a que tem mais cobertura hoje). Registrado
-- como a mesma dívida técnica consciente que o plano já assume em outros pontos
-- (ver docs/PLANO_VISAO_GERAL_V11.md, decisão 4).
-- ===========================================================================

create or replace function public.esta_pendente_seguradora(
  p_transmitida_em timestamptz,
  p_emitida_em timestamptz,
  p_cancelada_em timestamptz
)
returns boolean
language sql
immutable
as $$
  select p_transmitida_em is not null
     and p_emitida_em is null
     and p_cancelada_em is null;
$$;

comment on function public.esta_pendente_seguradora(timestamptz, timestamptz, timestamptz) is
  'V11.7.5: fórmula canônica de pendência da seguradora (transmitida, ainda não emitida, não cancelada). Pura/immutable sobre os 3 timestamps para poder ser usada em massa (WHERE/filter) sem buscar a proposta linha a linha. Mesma fórmula usada em funis_por_canal_visao_geral.';

grant execute on function public.esta_pendente_seguradora(timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

create or replace function public.proposta_pendente_seguradora(p_proposta_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.esta_pendente_seguradora(p.transmitida_em, p.emitida_em, p.cancelada_em)
    from public.propostas p
   where p.id = p_proposta_id;
$$;

comment on function public.proposta_pendente_seguradora(uuid) is
  'V11.7.5: conveniência para checar a pendência de UMA proposta (ex.: tela de detalhe), sob RLS de propostas (security invoker). Sem linha visível/existente, retorna null. Para contagem em massa, use esta_pendente_seguradora() direto num WHERE, não esta função (evita subquery por linha).';

revoke all on function public.proposta_pendente_seguradora(uuid) from public, anon;
grant execute on function public.proposta_pendente_seguradora(uuid) to authenticated, service_role;

-- Índice de suporte para a contagem em massa abaixo (sem lead_id — diferente do
-- índice parcial já existente para o CTE de funis por canal).
create index if not exists idx_propostas_marcos_seguradora
  on public.propostas (transmitida_em, emitida_em, cancelada_em);

create or replace function public.contar_pendentes_seguradora_visao_geral(
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

  -- Janela filtrada por transmitida_em (não pelo criado_em do lead): o alerta é
  -- "quantas propostas ENTRARAM em pendência da seguradora nesta janela", e o
  -- marco que define isso é a transmissão, não a criação do lead — mesmo padrão
  -- de "o timestamp do próprio evento define a janela" usado por
  -- saldo_comissao_visao_geral (criado_em do lançamento) e mais consistente que
  -- usar leads.criado_em, que mistura leads antigos com propostas transmitidas
  -- só agora.
  select count(*) into v_total
    from public.propostas p
   where p.transmitida_em >= p_inicio
     and p.transmitida_em < p_fim
     and public.esta_pendente_seguradora(p.transmitida_em, p.emitida_em, p.cancelada_em);

  return coalesce(v_total, 0);
end;
$$;

comment on function public.contar_pendentes_seguradora_visao_geral(timestamptz, timestamptz) is
  'V11.7.5: conta propostas pendentes da seguradora (transmitida, não emitida, não cancelada) cuja transmitida_em cai em [p_inicio,p_fim), sob RLS de propostas (empresa visível/responsável/matriz/master de rede).';

revoke all on function public.contar_pendentes_seguradora_visao_geral(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.contar_pendentes_seguradora_visao_geral(timestamptz, timestamptz)
  to authenticated, service_role;
