-- ===========================================================================
-- G3.2b — Barra desconto em proposta já paga (decisão G3 <-> G4, opção a)
--
-- 20260719003943_g3_2_rpcs_desconto.sql documentava (no cabeçalho, "fora do
-- escopo deste PR") uma lacuna real: se um desconto é aprovado/aceito DEPOIS
-- que a proposta já tem propostas.pago_em preenchido, _aplicar_desconto_premio
-- atualiza propostas.premio/comissao_valor normalmente, o trigger
-- trg_sync_comissao_lancamento (G4.2) dispara, mas como pago_em NÃO muda
-- (old.pago_em is distinct from new.pago_em é false) e o índice único
-- (proposta_id, tipo, beneficiario_id) usa "on conflict do nothing", o crédito
-- já lançado no ledger NÃO é corrigido — fica com o valor antigo, errado, até
-- ajuste manual.
--
-- Decisão do usuário (regra de dinheiro): opção (a) — BARRAR o desconto nesse
-- caso, em vez de tentar corrigir o ledger retroativamente (opção b, fora de
-- escopo). Ponto único de estrangulamento: _aplicar_desconto_premio é chamada
-- tanto por aprovar_desconto quanto por aceitar_desconto, então um guard nela
-- cobre os dois fluxos.
--
-- Guard: antes de qualquer UPDATE que altere prêmio/comissão, se já existir
-- proposta NÃO cancelada com pago_em preenchido para a mesma cotação e
-- seguradora, levanta exceção. Como aprovar_desconto/aceitar_desconto fazem
-- "update ... set status = 'aprovado' ..." ANTES do "perform
-- _aplicar_desconto_premio(...)" na mesma transação, a exceção provoca ROLLBACK
-- de toda a transação — a solicitação continua no status anterior
-- (pendente/aguardando_aceite), sem sujar nada.
-- ===========================================================================

create or replace function public._aplicar_desconto_premio(
  p_cotacao_id uuid,
  p_seguradora_id uuid,
  p_pct numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _seg_nome text;
  _n        integer;
  _paga     boolean;
begin
  select nome into _seg_nome from public.seguradoras where id = p_seguradora_id;

  -- G3.2b: proposta já paga para essa cotação/seguradora -> barrar (opção a).
  -- Não confunde com proposta cancelada (cancelada_em not null é ignorada).
  select exists (
    select 1
      from public.propostas
     where cotacao_id = p_cotacao_id
       and seguradora = _seg_nome
       and pago_em is not null
       and cancelada_em is null
  ) into _paga;

  if _paga then
    raise exception 'desconto não pode ser aplicado: proposta já paga (cotação %, seguradora %) — trate manualmente', p_cotacao_id, _seg_nome;
  end if;

  update public.cotacao_premios
     set premio = round(premio * (1 - p_pct / 100.0), 2)
   where cotacao_id = p_cotacao_id
     and selecionada = true
     and seguradora = _seg_nome;

  -- Falha ALTA (não silenciosa): se nenhum prêmio selecionado casou com a
  -- seguradora do pedido, o desconto não foi aplicado a lugar nenhum — abortar
  -- a aprovação em vez de gravar 'aprovado' sem efeito no dinheiro.
  get diagnostics _n = row_count;
  if _n = 0 then
    raise exception 'sem prêmio selecionado para a seguradora % na cotação % — desconto não aplicado', _seg_nome, p_cotacao_id;
  end if;

  -- cotacao_premios.seguradora / propostas.seguradora são texto (nome), sem
  -- FK normalizada pra seguradoras — casa pelo nome (mesmo padrão do resto
  -- do fluxo de venda, 009_venda_real).
  update public.propostas
     set premio = round(premio * (1 - p_pct / 100.0), 2),
         comissao_valor = case
           when comissao_pct is not null
             then round(premio * (1 - p_pct / 100.0) * comissao_pct / 100.0, 2)
           else comissao_valor
         end,
         atualizado_em = now()
   where cotacao_id = p_cotacao_id
     and seguradora = _seg_nome;
end;
$$;

comment on function public._aplicar_desconto_premio(uuid, uuid, numeric) is
  'G3.2b: aplica pct_concedido no cotacao_premios selecionado e, se existir,
   na proposta gerada da cotação (recalcula comissao_valor quando
   comissao_pct estiver preenchido). BARRA (raise exception) se já existir
   proposta paga (pago_em not null, não cancelada) para a mesma
   cotação/seguradora — decisão G3<->G4 opção (a): não corrige ledger já
   lançado, apenas impede o desconto de ser aplicado depois do pagamento. Ver
   nota de interação G3<->G4 no topo de 20260719003943_g3_2_rpcs_desconto.sql
   e cabeçalho deste arquivo.';

revoke all on function public._aplicar_desconto_premio(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public._aplicar_desconto_premio(uuid, uuid, numeric) to service_role;
