-- ============================================================
-- Webhook de transmissão Quiver passa a marcar tipo_venda='renovacao'.
--
-- Contexto: o fluxo antigo de aceite (src/routes/_authenticated/venda/
-- aceite.tsx) fazia um update direto em `propostas.tipo_venda='renovacao'`
-- logo após transmitir, quando o lead de origem da proposta veio do fluxo de
-- renovação (leads.origem='renovacao' — ver G6). Esse fluxo antigo está
-- sendo aposentado em favor da Etapa 7 (wizard novo), que transmite de forma
-- assíncrona: `transmitirPropostaQuiver` grava uma tentativa em
-- `cotacao_transmissoes` e o robô, via webhook, chama
-- `registrar_resultado_transmissao_quiver` (service_role) pra gravar o
-- resultado final em `propostas`. Sem o update do aceite.tsx, não sobra
-- nenhum lugar no front marcando tipo_venda — o motor de comissão (G4) usa
-- esse campo pra aplicar o fator de renovação, então essa função precisa
-- assumir a marcação.
--
-- Só no ramo de sucesso (p_transmitido=true): busca `leads.origem` da
-- cotação e, se for 'renovacao', grava tipo_venda='renovacao' na proposta.
-- No insert (primeira transmissão bem-sucedida) o campo ainda está vazio,
-- então é seguro setar direto. No `on conflict` (proposta já existia, ex.:
-- uma tentativa anterior falhou e criou a proposta 'gerada') usa
-- coalesce(propostas.tipo_venda, ...) pra nunca sobrescrever um tipo_venda
-- já setado por outro fluxo (ex.: marcação manual). O ramo de falha
-- (p_transmitido=false) não é tocado.
-- ============================================================
create or replace function public.registrar_resultado_transmissao_quiver(
  p_tentativa_id uuid,
  p_transmitido boolean,
  p_motivo text default null,
  p_mensagem text default null,
  p_numero_cotacao text default null,
  p_capturado_em timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tent record;
  _cot record;
  _prop_id uuid;
  _versao int;
  _tipo_venda text;
begin
  select * into _tent from public.cotacao_transmissoes where id = p_tentativa_id;
  if not found then
    raise exception 'Tentativa de transmissão não encontrada: %', p_tentativa_id;
  end if;

  -- Idempotência: tentativa já processada (webhook duplicado) — não reprocessa.
  if _tent.status <> 'enviada' then
    return;
  end if;

  update public.cotacao_transmissoes
     set status = case when p_transmitido then 'transmitida' else 'falha' end,
         motivo = p_motivo,
         mensagem = p_mensagem,
         numero_cotacao_portal = coalesce(p_numero_cotacao, numero_cotacao_portal),
         capturado_em = p_capturado_em
   where id = p_tentativa_id;

  select c.id, c.empresa_id, c.lead_id, c.responsavel_id, c.numero
    into _cot from public.cotacoes c where c.id = _tent.cotacao_id;

  if p_transmitido then
    -- G6: lead de origem da cotação veio do fluxo de renovação (60 dias
    -- fixos, sempre lead novo) → a proposta que nasce/atualiza aqui herda
    -- tipo_venda='renovacao' (senão o motor de comissão G4 aplica o fator
    -- errado no fechamento).
    select case when l.origem = 'renovacao' then 'renovacao' else null end
      into _tipo_venda
      from public.leads l
     where l.id = _cot.lead_id;

    insert into public.propostas (
      empresa_id, cotacao_id, lead_id, responsavel_id,
      numero, status, seguradora, premio, valor, forma_pagamento,
      transmissao_status, transmitida_em, atualizado_em, tipo_venda
    ) values (
      _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
      'PRP-'||lpad(_cot.numero::text,5,'0'),
      'transmitida', _tent.seguradora, _tent.premio, _tent.premio, _tent.forma_pagamento,
      'transmitida', p_capturado_em, now(), _tipo_venda
    )
    on conflict (cotacao_id) where cotacao_id is not null do update
       set seguradora = excluded.seguradora,
           premio = excluded.premio,
           valor = excluded.valor,
           forma_pagamento = excluded.forma_pagamento,
           status = 'transmitida',
           transmissao_status = 'transmitida',
           transmissao_motivo = null,
           transmissao_mensagem = null,
           transmitida_em = p_capturado_em,
           atualizado_em = now(),
           tipo_venda = coalesce(public.propostas.tipo_venda, excluded.tipo_venda)
     returning id into _prop_id;
  else
    insert into public.propostas (
      empresa_id, cotacao_id, lead_id, responsavel_id,
      numero, status, seguradora,
      transmissao_status, transmissao_motivo, transmissao_mensagem,
      negociacao_status, atualizado_em
    ) values (
      _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
      'PRP-'||lpad(_cot.numero::text,5,'0'),
      'gerada', _tent.seguradora,
      'falha', p_motivo, p_mensagem,
      case when p_motivo = 'RECUSADA_PELO_PORTAL' then 'recusada' else 'aguardando' end,
      now()
    )
    on conflict (cotacao_id) where cotacao_id is not null do update
       set status = case when public.propostas.status='transmitida' then public.propostas.status else 'gerada' end,
           transmissao_status = 'falha',
           transmissao_motivo = p_motivo,
           transmissao_mensagem = p_mensagem,
           negociacao_status = case
             when p_motivo = 'RECUSADA_PELO_PORTAL' then 'recusada'
             else public.propostas.negociacao_status
           end,
           atualizado_em = now()
     returning id into _prop_id;

    if p_motivo = 'RECUSADA_PELO_PORTAL' then
      perform pg_advisory_xact_lock(hashtext(_prop_id::text));
      select coalesce(max(pv.versao), 0) + 1 into _versao
        from public.proposta_versoes pv where pv.proposta_id = _prop_id;

      insert into public.proposta_versoes (proposta_id, versao, nota, criado_por)
      values (
        _prop_id, _versao,
        'Recusada pelo portal (RECUSADA_PELO_PORTAL): ' || coalesce(p_mensagem, 'sem mensagem do portal'),
        null
      );
    end if;
  end if;

  update public.cotacao_transmissoes set proposta_id = _prop_id where id = p_tentativa_id;
end;
$$;

revoke all on function public.registrar_resultado_transmissao_quiver(uuid, boolean, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.registrar_resultado_transmissao_quiver(uuid, boolean, text, text, text, timestamptz)
  to service_role;
