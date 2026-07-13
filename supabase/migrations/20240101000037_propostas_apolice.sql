-- ============================================================
-- 037: Campos de apólice/pagamento em propostas + RPCs p/ Controle de Vendas
-- ============================================================

alter table public.propostas
  add column if not exists apolice_numero text,
  add column if not exists tipo_venda text,                 -- 'novo' | 'renovacao'
  add column if not exists forma_pagamento text,
  add column if not exists comissao_pct numeric(6,3),
  add column if not exists comissao_valor numeric(14,2),
  add column if not exists emitida_em timestamptz,
  add column if not exists baixa_em timestamptz,
  add column if not exists pago_em timestamptz,
  add column if not exists vencimento date,
  add column if not exists cancelada_em timestamptz,
  add column if not exists cancelamento_motivo text;

create index if not exists propostas_emitida_idx on public.propostas(emitida_em);
create index if not exists propostas_pago_idx    on public.propostas(pago_em);
create index if not exists propostas_cancel_idx  on public.propostas(cancelada_em);

-- Marca apólice como emitida (matriz / responsável)
create or replace function public.marcar_apolice_emitida(
  p_proposta_id uuid,
  p_apolice text,
  p_tipo_venda text default null,
  p_forma_pagamento text default null,
  p_comissao_pct numeric default null
) returns void language plpgsql security definer set search_path=public as $$
declare _premio numeric;
begin
  select premio into _premio from public.propostas where id = p_proposta_id;
  update public.propostas
     set apolice_numero  = coalesce(p_apolice, apolice_numero),
         tipo_venda      = coalesce(p_tipo_venda, tipo_venda, 'novo'),
         forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento),
         comissao_pct    = coalesce(p_comissao_pct, comissao_pct, 16),
         comissao_valor  = coalesce(_premio,0) * (coalesce(p_comissao_pct, comissao_pct, 16) / 100.0),
         emitida_em      = coalesce(emitida_em, now()),
         status          = 'transmitida',
         atualizado_em   = now()
   where id = p_proposta_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz')
          or public.has_role(auth.uid(),'master'));
end $$;
grant execute on function public.marcar_apolice_emitida(uuid,text,text,text,numeric) to authenticated;

-- Registra pagamento / baixa financeira
create or replace function public.marcar_pagamento(
  p_proposta_id uuid,
  p_pago boolean default true
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.propostas
     set pago_em      = case when p_pago then coalesce(pago_em, now()) else null end,
         baixa_em     = case when p_pago then coalesce(baixa_em, now()) else baixa_em end,
         atualizado_em = now()
   where id = p_proposta_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz')
          or public.has_role(auth.uid(),'master'));
end $$;
grant execute on function public.marcar_pagamento(uuid,boolean) to authenticated;

-- Cancela proposta/apólice
create or replace function public.cancelar_apolice(
  p_proposta_id uuid,
  p_motivo text default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.propostas
     set cancelada_em        = coalesce(cancelada_em, now()),
         cancelamento_motivo = coalesce(p_motivo, cancelamento_motivo),
         status              = 'cancelada',
         atualizado_em       = now()
   where id = p_proposta_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz')
          or public.has_role(auth.uid(),'master'));
end $$;
grant execute on function public.cancelar_apolice(uuid,text) to authenticated;
