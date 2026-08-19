-- ===========================================================================
-- SLA de leads da Captação Movida: métrica, sem devolução (decisão do usuário,
-- 19/08/2026)
--
-- Comportamento vigente (20260804003840_v11_5_7_sla_fronteira_franquia.sql):
-- quando o SLA de reação estoura, `expirar_leads_nao_atendidos` sempre devolve
-- o lead (zera responsavel_id, e no caso "repassado" também zera empresa_id).
-- Leads de `origem='captacao_movida'` nunca setam `canal_id`, então caem
-- sempre no ramo "repassado" — o pior caso: perdem inclusive o vínculo com a
-- loja/empresa da Movida e vão pro pool genérico da Matriz, saindo de
-- qualquer roteamento por loja.
--
-- Pedido do usuário: pra Movida, o SLA deve CONTINUAR sendo contado (métrica
-- de tempo de atendimento), mas o estouro NÃO deve mexer em responsavel_id,
-- empresa_id, nem status_pipeline — o lead segue com o mesmo vendedor, como
-- 'novo', só que registrado como "estourou". Duração do SLA usada continua a
-- global (distribuicao_config.sla_segundos, 180s) — Movida não usa canal, já
-- cai nesse singleton via fn_sla_aplicavel_lead sem mudança nenhuma.
--
-- Implementação: coluna `leads.sla_estourado_em` guarda o instante da métrica
-- (permite calcular "distribuido_em -> sla_estourado_em" depois, e serve de
-- guarda pra não reprocessar/re-logar o mesmo lead a cada rodada do cron,já
-- que nada mais muda nele para tirá-lo da lista de candidatos).
-- ===========================================================================

alter table public.leads
  add column if not exists sla_estourado_em timestamptz;

create or replace function public.expirar_leads_nao_atendidos(p_janela_seg int default 180)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_total int := 0;
  v_updated int;
  v_sla int;
  v_canal_empresa uuid;
  v_cruza boolean;
begin
  -- Guard de reentrância (031): impede reprocessamento recursivo na mesma txn.
  if not pg_try_advisory_xact_lock(hashtext('expirar_leads_nao_atendidos')) then
    return 0;
  end if;

  -- Candidatos: mesmo filtro de sempre, exceto a janela — o piso de 30s é o
  -- mínimo possível de qualquer SLA configurável (check de sla_empresa_config
  -- e distribuicao_config), então nada expira antes disso; o corte exato por
  -- lead é feito dentro do loop, com fn_sla_aplicavel_lead.
  --
  -- `sla_estourado_em is null`: sem isso, um lead da Movida (que não muda
  -- responsavel_id/distribuido_em/status_pipeline no ramo novo abaixo)
  -- continuaria elegível pra sempre e re-logaria o evento a cada 30s.
  for v_rec in
    select l.id, l.responsavel_id, l.empresa_id, l.distribuido_em, l.canal_id, l.origem
      from public.leads l
     where l.status_pipeline = 'novo'
       and l.responsavel_id is not null
       and l.ultimo_atendimento_em is null
       and l.distribuido_em is not null
       and l.distribuido_em < now() - interval '30 seconds'
       and l.sla_estourado_em is null
     for update skip locked
  loop
    v_sla := coalesce(public.fn_sla_aplicavel_lead(v_rec.id), p_janela_seg);

    -- Ainda dentro do prazo aplicável a ESTE lead (pode ser diferente de
    -- p_janela_seg) — não expira, segue pro próximo candidato.
    if v_rec.distribuido_em >= now() - make_interval(secs => v_sla) then
      continue;
    end if;

    -- Movida: só métrica — não devolve, não redistribui, não muda pipeline.
    if v_rec.origem = 'captacao_movida' then
      update public.leads
         set sla_estourado_em = now(),
             atualizado_em    = now()
       where id = v_rec.id
         and sla_estourado_em is null;
      get diagnostics v_updated = row_count;

      if v_updated > 0 then
        insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
        values (
          v_rec.id,
          'sla_expirado',
          'SLA de reação estourado (Movida) — métrica registrada',
          'Lead não foi assumido em ' || v_sla || 's, mas permanece com o mesmo vendedor (não é devolvido). Registrado para métrica de tempo de atendimento.',
          null,
          jsonb_build_object(
            'responsavel_anterior', v_rec.responsavel_id,
            'empresa_anterior',     v_rec.empresa_id,
            'distribuido_em',       v_rec.distribuido_em,
            'sla_aplicado_seg',     v_sla,
            'cruzou_fronteira',     false,
            'redistribuido',        false
          )
        );
        v_total := v_total + 1;
      end if;

      continue;
    end if;

    select c.empresa_id into v_canal_empresa
      from public.canais c
     where c.id = v_rec.canal_id;

    -- Repassado (canal Supper/empresa_id NULL, ou lead sem canal) -> cruza a
    -- fronteira pro pool padrão da Matriz. Canal próprio de uma Full -> fica
    -- dentro do pool da própria empresa (ver cabeçalho de 20260804003840).
    v_cruza := v_canal_empresa is null;

    if v_cruza then
      update public.leads
         set responsavel_id = null,
             empresa_id     = null,
             distribuido_em = null,
             atualizado_em  = now()
       where id = v_rec.id
         and responsavel_id is not null
         and distribuido_em is not null;
    else
      update public.leads
         set responsavel_id = null,
             distribuido_em = null,
             atualizado_em  = now()
       where id = v_rec.id
         and responsavel_id is not null
         and distribuido_em is not null;
    end if;
    get diagnostics v_updated = row_count;

    if v_updated > 0 then
      insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
      values (
        v_rec.id,
        'sla_expirado',
        case when v_cruza
          then 'SLA expirado — devolvido à Matriz'
          else 'SLA expirado — devolvido à fila da franquia'
        end,
        case when v_cruza
          then 'Lead não foi assumido em ' || v_sla || 's após a distribuição e retornou para a fila da Matriz para nova redistribuição.'
          else 'Lead de canal próprio não foi assumido em ' || v_sla || 's (SLA da própria franquia) e voltou para a fila dela.'
        end,
        null,
        jsonb_build_object(
          'responsavel_anterior', v_rec.responsavel_id,
          'empresa_anterior',     v_rec.empresa_id,
          'distribuido_em',       v_rec.distribuido_em,
          'sla_aplicado_seg',     v_sla,
          'cruzou_fronteira',     v_cruza
        )
      );
      v_total := v_total + 1;
    end if;
  end loop;

  return v_total;
end$$;

comment on function public.expirar_leads_nao_atendidos(int) is
  'V11.5.7 + Movida-só-métrica (19/08/2026): devolve leads não atendidos, com
   SLA resolvido POR LEAD via fn_sla_aplicavel_lead (canal próprio de Full usa
   o SLA dela; repassado/sem canal usa o SLA global). Repassado cruza a
   fronteira (empresa_id -> null, cai no pool padrão da Matriz); canal próprio
   de uma Full mantém empresa_id (só limpa responsavel_id/distribuido_em) para
   não vazar pra outra franquia. Exceção: origem=''captacao_movida'' nunca é
   devolvido — só registra sla_estourado_em (métrica) e o evento sla_expirado,
   mantendo responsavel_id/empresa_id/status_pipeline intactos.
   p_janela_seg mantido só por compatibilidade de assinatura com o cron
   existente (030/031); não é mais o que decide a janela.';

grant execute on function public.expirar_leads_nao_atendidos(int) to authenticated, anon, service_role;
