-- ===========================================================================
-- G1.5c — registrar_premios_quiver não deve derrubar a cotação inteira quando
-- um único card vem sem `seguradora`.
--
-- Causa raiz observada em produção (jul/2026): o portal Suppercerto às vezes
-- renderiza o logo da seguradora com `alt=""` vazio; o robô não consegue
-- extrair o nome nesse caso e envia o card sem o campo `seguradora`. Como o
-- INSERT rodava dentro do mesmo bloco/transação da função, uma violação de
-- NOT NULL num único card abortava a função inteira via exceção — nenhum
-- prêmio era salvo, nem os cards que vieram OK, e o webhook retornava 500
-- ("null value in column seguradora... violates not-null constraint").
--
-- Fix: pular (com log via RAISE NOTICE) cards sem seguradora/cobertura em vez
-- de deixar o INSERT falhar e abortar o restante do laço.
-- ===========================================================================

create or replace function public.registrar_premios_quiver(p_cotacao_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tem_premios boolean := coalesce((p_payload->>'temPremios')::boolean, false);
  _placa_nao_encontrada boolean := coalesce((p_payload->>'placaNaoEncontrada')::boolean, false);
  _card jsonb;
  _opcao jsonb;
  _premio_txt text;
  _premio numeric;
  _cobertura text;
  _seguradora text;
begin
  if not exists (select 1 from public.cotacoes where id = p_cotacao_id) then
    raise exception 'Cotação % não encontrada', p_cotacao_id;
  end if;

  update public.cotacoes
     set quiver_resultado_raw = p_payload,
         atualizado_em = now()
   where id = p_cotacao_id;

  if _tem_premios then
    delete from public.cotacao_premios where cotacao_id = p_cotacao_id;

    for _card in select * from jsonb_array_elements(coalesce(p_payload->'cards', '[]'::jsonb))
    loop
      _seguradora := nullif(_card->>'seguradora', '');
      if _seguradora is null then
        -- Card malformado (ex.: logo com alt="" no portal — o robô não
        -- conseguiu identificar a seguradora). Pula em vez de abortar toda
        -- a cotação; o payload bruto completo continua em
        -- quiver_resultado_raw para auditoria/investigação.
        raise notice 'registrar_premios_quiver: card sem seguradora ignorado (cotacao %)', p_cotacao_id;
        continue;
      end if;

      -- Primeira opção de franquia/pagamento do card vira o prêmio "de referência"
      -- exibido nas telas atuais (comparativo, resumo). O card inteiro (todas as
      -- opções, coberturas básicas/adicionais) fica preservado em quiver_resultado_raw.
      _opcao := (_card->'opcoes')->0;
      _premio_txt := nullif(regexp_replace(coalesce(_opcao->>'avista', ''), '[^0-9,]', '', 'g'), '');
      _premio := coalesce(nullif(replace(_premio_txt, ',', '.'), '')::numeric, 0);
      _cobertura := _opcao->>'tipo';

      insert into public.cotacao_premios (cotacao_id, seguradora, cobertura, premio)
      values (p_cotacao_id, _seguradora, _cobertura, _premio);
    end loop;

    update public.cotacoes set status = 'calculada' where id = p_cotacao_id;
  else
    update public.cotacoes
       set status = 'erro_quiver',
           quiver_mensagem = coalesce(
             nullif(p_payload->>'mensagem', ''),
             case when _placa_nao_encontrada then 'Placa não encontrada no portal.'
                  else 'A seguradora não retornou prêmios para esta cotação.' end
           )
     where id = p_cotacao_id;
  end if;
end;
$$;
