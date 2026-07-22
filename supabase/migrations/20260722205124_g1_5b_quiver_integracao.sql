-- ===========================================================================
-- G1.5b — Colunas de acompanhamento da Quiver em `cotacoes` + RPC que o
-- webhook receiver (endpoint HTTP novo, fora do RLS/sessão de usuário) usa
-- para gravar o resultado assim que a automação termina.
--
-- Segurança: `registrar_premios_quiver` é executada só por `service_role`
-- (o endpoint HTTP valida antes um segredo compartilhado — ver
-- SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET — e só então chama a função com o
-- client de service role). Não é liberada para `authenticated`: nenhum
-- usuário logado deve conseguir "forjar" um resultado de cotação chamando
-- a RPC direto via supabase.rpc(...) do client.
-- ===========================================================================

alter table public.cotacoes
  add column if not exists quiver_enviado_em   timestamptz,
  add column if not exists quiver_mensagem     text,
  add column if not exists quiver_resultado_raw jsonb;

alter table public.cotacoes
  drop constraint if exists cotacoes_quiver_mensagem_tam,
  add  constraint cotacoes_quiver_mensagem_tam
       check (quiver_mensagem is null or char_length(quiver_mensagem) <= 2000);

comment on column public.cotacoes.quiver_enviado_em    is 'Quando o POST /cotacao foi feito para a Quiver (G1.5b).';
comment on column public.cotacoes.quiver_mensagem       is 'Mensagem legível quando a Quiver não retorna prêmios (placa não encontrada, portal sem produto, etc.) — G1.5b.';
comment on column public.cotacoes.quiver_resultado_raw  is 'Payload bruto do webhook da Quiver (PremiosExtraidos), guardado para auditoria e para a tela de resultado detalhada (G1.5b).';

-- ---- RPC chamada pelo webhook receiver (não pelo frontend) ----------------
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
      -- Primeira opção de franquia/pagamento do card vira o prêmio "de referência"
      -- exibido nas telas atuais (comparativo, resumo). O card inteiro (todas as
      -- opções, coberturas básicas/adicionais) fica preservado em quiver_resultado_raw.
      _opcao := (_card->'opcoes')->0;
      _premio_txt := nullif(regexp_replace(coalesce(_opcao->>'avista', ''), '[^0-9,]', '', 'g'), '');
      _premio := coalesce(nullif(replace(_premio_txt, ',', '.'), '')::numeric, 0);
      _cobertura := _opcao->>'tipo';

      insert into public.cotacao_premios (cotacao_id, seguradora, cobertura, premio)
      values (p_cotacao_id, _card->>'seguradora', _cobertura, _premio);
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

revoke all on function public.registrar_premios_quiver(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_premios_quiver(uuid, jsonb) to service_role;
