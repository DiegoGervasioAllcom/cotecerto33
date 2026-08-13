-- 20260813030000 — Quiver: avança lead para Cotação após retorno válido.
--
-- O bloqueio da linha de cotacoes serializa callbacks concorrentes. A transição
-- do lead é condicional às etapas anteriores, portanto é idempotente e nunca
-- regride leads que já avançaram no pipeline.

create or replace function public.registrar_premios_quiver(p_cotacao_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tem_premios boolean := coalesce((p_payload->>'temPremios')::boolean, false);
  _placa_nao_encontrada boolean := coalesce((p_payload->>'placaNaoEncontrada')::boolean, false);
  _lead_id uuid;
  _lead_alterado uuid;
  _sucesso_existente boolean;
  _card jsonb;
  _opcao jsonb;
  _premio_txt text;
  _premio numeric;
  _cobertura text;
  _seguradora text;
  _premios_validos integer := 0;
  _cards_validos jsonb := '[]'::jsonb;
begin
  -- Além de validar a cotação, esta trava serializa callbacks repetidos ou
  -- concorrentes para que delete/insert/status/transição formem uma unidade.
  select c.lead_id,
         c.status = 'calculada'
         and exists (
           select 1 from public.cotacao_premios cp where cp.cotacao_id = c.id
         )
    into _lead_id, _sucesso_existente
    from public.cotacoes c
   where c.id = p_cotacao_id
   for update;

  if not found then
    raise exception 'Cotação % não encontrada', p_cotacao_id;
  end if;

  if _tem_premios then
    -- Classifica primeiro, sem apagar o sucesso anterior. Assim um callback
    -- atrasado/vazio não degrada um resultado válido já persistido.
    for _card in
      select value from jsonb_array_elements(
        case when jsonb_typeof(p_payload->'cards') = 'array'
             then p_payload->'cards' else '[]'::jsonb end
      )
    loop
      _seguradora := nullif(btrim(_card->>'seguradora'), '');
      _opcao := case when jsonb_typeof(_card->'opcoes') = 'array'
                     then (_card->'opcoes')->0 else null end;
      _cobertura := nullif(btrim(_opcao->>'tipo'), '');
      -- O retorno da Quiver usa moeda pt-BR. Remove símbolo e separadores de
      -- milhar, preservando apenas a vírgula decimal.
      _premio_txt := nullif(regexp_replace(coalesce(_opcao->>'avista', ''), '[^0-9,]', '', 'g'), '');

      if _seguradora is null
         or _cobertura is null
         or _premio_txt is null
         or _premio_txt !~ '^[0-9]+(,[0-9]{1,2})?$' then
        raise notice 'registrar_premios_quiver: card inválido ignorado (cotacao %)', p_cotacao_id;
        continue;
      end if;

      _premio := replace(_premio_txt, ',', '.')::numeric;
      if _premio <= 0 then
        raise notice 'registrar_premios_quiver: prêmio não positivo ignorado (cotacao %)', p_cotacao_id;
        continue;
      end if;

      _cards_validos := _cards_validos || jsonb_build_array(jsonb_build_object(
        'seguradora', _seguradora,
        'cobertura', _cobertura,
        'premio', _premio
      ));
      _premios_validos := _premios_validos + 1;
    end loop;
  end if;

  if not _tem_premios or _premios_validos = 0 then
    if _sucesso_existente then
      -- Preserva status, cards, payload de sucesso, lead e evento. O callback
      -- conflitante é apenas uma repetição atrasada do provedor.
      return;
    end if;

    update public.cotacoes
       set status = 'erro_quiver',
           quiver_resultado_raw = p_payload,
           quiver_mensagem = case
             when _tem_premios then
               'A seguradora não retornou prêmios válidos para esta cotação.'
             else coalesce(
               nullif(p_payload->>'mensagem', ''),
               case when _placa_nao_encontrada then 'Placa não encontrada no portal.'
                    else 'A seguradora não retornou prêmios para esta cotação.' end
             )
           end,
           atualizado_em = now()
     where id = p_cotacao_id;
    return;
  end if;

  -- Um novo sucesso válido substitui os cards anteriores, como no contrato
  -- legado, mas somente depois de sua validação completa.
  update public.cotacoes
     set status = 'calculada',
         quiver_resultado_raw = p_payload,
         quiver_mensagem = null,
         atualizado_em = now()
   where id = p_cotacao_id;

  delete from public.cotacao_premios where cotacao_id = p_cotacao_id;
  insert into public.cotacao_premios (cotacao_id, seguradora, cobertura, premio)
  select p_cotacao_id,
         card->>'seguradora',
         card->>'cobertura',
         (card->>'premio')::numeric
    from jsonb_array_elements(_cards_validos) as card;

  if _lead_id is not null then
      update public.leads
         set status_pipeline = 'cotacao',
             atualizado_em = now()
       where id = _lead_id
         and status_pipeline in ('novo', 'contato', 'qualificado', 'qualificando', 'cotando')
      returning id into _lead_alterado;

      if _lead_alterado is not null then
        insert into public.lead_eventos (lead_id, tipo, titulo, descricao, ator_id, meta)
        values (
          _lead_alterado,
          'cotacao_calculada',
          'Cotação calculada',
          'Lead avançado automaticamente após retorno válido da cotação.',
          null,
          jsonb_build_object('cotacao_id', p_cotacao_id, 'premios_validos', _premios_validos)
        );
      end if;
  end if;
end;
$$;

revoke all on function public.registrar_premios_quiver(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_premios_quiver(uuid, jsonb) to service_role;
