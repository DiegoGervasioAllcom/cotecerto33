-- ============================================================
-- G7.1b: RPCs para atualizar negociacao_status/prazo_resposta
-- ============================================================
-- Correção de bloqueante de segurança: o front fazia update direto em
-- `propostas` para estes dois campos, violando o invariante de
-- 20260714190228_fix_propostas_rls_iud_only.sql ("todas as escritas
-- passam por RPCs security definer") e abrindo risco de coluna
-- (RLS é por linha, não por coluna). Estas RPCs tocam apenas os
-- campos de negociação, com o mesmo gate de autorização usado em
-- registrar_versao_proposta.

create or replace function public.definir_negociacao_status(
  p_proposta_id uuid,
  p_status text
)
returns table (id uuid, negociacao_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _prop record;
begin
  if p_status not in ('aguardando','em_negociacao','aceita','recusada') then
    raise exception 'Status de negociação inválido';
  end if;

  select p.id, p.responsavel_id into _prop
  from public.propostas p
  where p.id = p_proposta_id;

  if not found then
    raise exception 'Proposta não encontrada';
  end if;

  if not (_prop.responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz')) then
    raise exception 'Não autorizado a negociar esta proposta';
  end if;

  update public.propostas
     set negociacao_status = p_status,
         atualizado_em = now()
   where propostas.id = p_proposta_id;

  return query
    select propostas.id, propostas.negociacao_status
    from public.propostas
    where propostas.id = p_proposta_id;
end $$;

revoke execute on function public.definir_negociacao_status(uuid, text) from public, anon;
grant execute on function public.definir_negociacao_status(uuid, text) to authenticated;

create or replace function public.definir_prazo_resposta(
  p_proposta_id uuid,
  p_prazo date default null
)
returns table (id uuid, prazo_resposta date)
language plpgsql
security definer
set search_path = public
as $$
declare
  _prop record;
begin
  select p.id, p.responsavel_id into _prop
  from public.propostas p
  where p.id = p_proposta_id;

  if not found then
    raise exception 'Proposta não encontrada';
  end if;

  if not (_prop.responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz')) then
    raise exception 'Não autorizado a negociar esta proposta';
  end if;

  update public.propostas
     set prazo_resposta = p_prazo,
         atualizado_em = now()
   where propostas.id = p_proposta_id;

  return query
    select propostas.id, propostas.prazo_resposta
    from public.propostas
    where propostas.id = p_proposta_id;
end $$;

revoke execute on function public.definir_prazo_resposta(uuid, date) from public, anon;
grant execute on function public.definir_prazo_resposta(uuid, date) to authenticated;
