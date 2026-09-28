-- ============================================================
-- Base de comissão/desconto = soma das parcelas (não o valor de 1 parcela).
--
-- Bug (ajustes pós-deploy V12, item 2): quando o card da Quiver só tem
-- parcelamento (sem "avista"), o fallback de 20260817000000 extraía apenas o
-- valor da parcela (ex.: "em 12x de R$ 463,20" → gravava 463,20) e esse
-- número virava `propostas.premio`, que é a base do ledger de comissão
-- (20260718023017_g4_2_ledger_multinivel_competencia.sql, trigger em
-- `new.premio` e `registrar_fechamento_comissao`) e da alçada de desconto.
-- Decisão do usuário: com parcelamento, a base é nº de parcelas × valor da
-- parcela; com preço à vista, continua sendo o à vista (comportamento
-- inalterado nesse ramo).
--
-- 1) fn_premio_total_de_parcelas(texto): função pura auxiliar que extrai
--    (parcelas_num, valor_parcela, premio_total) de textos como
--    "em 12x de R$ 463,20" ou "3x sem juros de R$ 429,25". Não acessa
--    tabelas, immutable, sem grant (segue o mesmo padrão sem grant explícito
--    de `_normalizar_vidros` em 20260821010000 — o setup do Supabase já
--    revoga EXECUTE de PUBLIC/anon por padrão em funções novas do schema
--    public). Se não conseguir extrair a quantidade (1-12) OU o valor com
--    segurança, não retorna linha nenhuma — decisão conservadora: melhor não
--    ter prêmio nenhum daquela opção do que gravar um valor sabidamente
--    incompleto (era exatamente esse o bug que está sendo corrigido aqui).
--
-- 2) registrar_premios_quiver: no fallback sem "avista", usa a função acima
--    em vez de extrair só o valor da parcela. Resto da função inalterado.
--
-- 3) cotacao_transmissoes ganha parcelas_num/valor_parcela (nullable, checks
--    de faixa) — mesmos nomes de coluna já existentes em `propostas` desde
--    20260908152312, pra o server ao registrar a tentativa de transmissão
--    poder gravar o detalhamento junto com o total em `premio`.
--
-- 4) registrar_resultado_transmissao_quiver: copia parcelas_num/valor_parcela
--    da tentativa para propostas.parcelas/propostas.valor_parcela no insert
--    e no on-conflict, do mesmo jeito que já faz para seguradora/premio/
--    forma_pagamento. Assinatura inalterada (sem overload).
-- ============================================================

-- 1) Função pura auxiliar -------------------------------------------------
create or replace function public.fn_premio_total_de_parcelas(p_texto text)
returns table (parcelas_num smallint, valor_parcela numeric(14,2), premio_total numeric(14,2))
language plpgsql
immutable
as $$
declare
  _n_txt text;
  _v_txt text;
  _n int;
  _v numeric;
begin
  _n_txt := (regexp_match(coalesce(p_texto, ''), '(\d{1,2})\s*[xX]\M'))[1];
  _v_txt := (regexp_match(coalesce(p_texto, ''), '([0-9\.]*[0-9],[0-9]{1,2})'))[1];
  if _v_txt is not null then
    _v_txt := regexp_replace(_v_txt, '[^0-9,]', '', 'g');
  end if;

  if _n_txt is null or _n_txt !~ '^[0-9]{1,2}$'
     or _v_txt is null or _v_txt !~ '^[0-9]+(,[0-9]{1,2})?$' then
    return;
  end if;

  _n := _n_txt::int;
  _v := replace(_v_txt, ',', '.')::numeric;

  if _n < 1 or _n > 12 or _v <= 0 then
    return;
  end if;

  parcelas_num := _n::smallint;
  valor_parcela := round(_v, 2);
  premio_total := round(_n * _v, 2);
  return next;
end;
$$;

-- 2) registrar_premios_quiver: fallback usa soma das parcelas ------------
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
  _parcelado record;
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
      _premio := null;

      if _premio_txt is not null and _premio_txt ~ '^[0-9]+(,[0-9]{1,2})?$' then
        _premio := replace(_premio_txt, ',', '.')::numeric;
      else
        -- Sem preço à vista (produto só parcelado): a base passa a ser a
        -- soma das parcelas (nº × valor), nunca o valor de 1 parcela isolada
        -- (ver cabeçalho desta migration). Se não der pra extrair a
        -- quantidade e o valor com segurança de "parcelas", o card fica sem
        -- prêmio (comportamento conservador) em vez de gravar algo incompleto.
        select * into _parcelado
          from public.fn_premio_total_de_parcelas(coalesce(_opcao->>'parcelas', ''));
        if _parcelado.premio_total is not null then
          _premio := _parcelado.premio_total;
        end if;
      end if;

      if _seguradora is null
         or _cobertura is null
         or _premio is null then
        raise notice 'registrar_premios_quiver: card inválido ignorado (cotacao %)', p_cotacao_id;
        continue;
      end if;

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

-- 3) cotacao_transmissoes: colunas de detalhamento de parcela ------------
alter table public.cotacao_transmissoes
  add column if not exists parcelas_num smallint null,
  add column if not exists valor_parcela numeric(14,2) null;

do $$ begin
  alter table public.cotacao_transmissoes
    add constraint cotacao_transmissoes_parcelas_num_chk
    check (parcelas_num is null or parcelas_num between 1 and 12);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_transmissoes
    add constraint cotacao_transmissoes_valor_parcela_chk
    check (valor_parcela is null or valor_parcela > 0);
exception when duplicate_object then null; end $$;

-- 4) registrar_resultado_transmissao_quiver: propaga parcelas_num/valor_parcela
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
      parcelas, valor_parcela,
      transmissao_status, transmitida_em, atualizado_em, tipo_venda
    ) values (
      _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
      'PRP-'||lpad(_cot.numero::text,5,'0'),
      'transmitida', _tent.seguradora, _tent.premio, _tent.premio, _tent.forma_pagamento,
      _tent.parcelas_num, _tent.valor_parcela,
      'transmitida', p_capturado_em, now(), _tipo_venda
    )
    on conflict (cotacao_id) where cotacao_id is not null do update
       set seguradora = excluded.seguradora,
           premio = excluded.premio,
           valor = excluded.valor,
           forma_pagamento = excluded.forma_pagamento,
           parcelas = excluded.parcelas,
           valor_parcela = excluded.valor_parcela,
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
