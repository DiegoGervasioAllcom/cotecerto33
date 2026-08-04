-- ===========================================================================
-- V11.5.7 (Frente 5 — Franquia Full) — SLA por lead + fronteira Full/Matriz
--
-- Regras 9+10 das "Regras Decididas" (Lis): lead de canal PRÓPRIO de uma Full
-- segue o SLA da própria Full; lead REPASSADO pela Matriz (canal.empresa_id
-- NULL, ou lead sem canal) segue o SLA da Matriz. A distinção mora em
-- `canais.empresa_id` (20260729025723_v11_04_taxonomia_canais.sql).
--
-- GAP QUE ESTA MIGRATION FECHA (documentado no cabeçalho de
-- 20260803150000_v11_5_3_sla_por_empresa.sql, "fica pra V11.5.7"):
-- `expirar_leads_nao_atendidos(p_janela_seg)` (017/018/030/031) sempre usou UMA
-- janela fixa pro lote inteiro — quem chama hoje (cron, 030/031) sempre passa
-- 180. Uma Full que já configurou o próprio SLA via `fn_salvar_sla_empresa`
-- (V11.5.3) continuava sendo expirada nos 180s globais, nunca no prazo dela.
--
-- O QUE MUDA:
--   1. A função agora resolve o SLA POR LEAD via `fn_sla_aplicavel_lead(id)`,
--      em vez de aplicar `p_janela_seg` a todo o lote. `p_janela_seg`
--      permanece na assinatura só por compatibilidade com quem chama hoje
--      (cron 030/031 chama `expirar_leads_nao_atendidos(180)`) — na prática
--      só é usado como fallback se `fn_sla_aplicavel_lead` não resolver nada
--      (lead sem canal ainda cai no singleton global por dentro dela mesma,
--      então esse fallback é só rede de segurança, não deve disparar em uso
--      normal).
--   2. FRONTEIRA (item 3/4 do plano): ao expirar, a função agora olha se o
--      lead é repassado ou de canal próprio:
--        - REPASSADO (canal.empresa_id NULL, ou lead sem canal): mantém o
--          comportamento de sempre — limpa responsavel_id/empresa_id/
--          distribuido_em. O lead cai no MESMO pool que `distribuir_lead_auto`/
--          `distribuir_fila_pendente` já usam para a fila de redistribuição
--          PADRÃO da Matriz (`where empresa_id is null and responsavel_id is
--          null`, 024/028/032/v11_d5) — nenhum marcador novo é necessário
--          porque é o pool exato de "lead nunca distribuído", e o evento
--          `sla_expirado` já registra `empresa_anterior`/`responsavel_anterior`
--          para quem precisar do rastro de que ele já passou por uma franquia.
--        - PRÓPRIO de uma Full: NÃO zera `empresa_id`. Zerar zeraria a Full
--          dona do canal e devolveria o lead ao pool amplo da Matriz, que pode
--          redistribuí-lo pra QUALQUER franquia — vazando um lead que nasceu no
--          canal próprio da Full X para a franquia Y. Em vez disso, só limpa
--          `responsavel_id`/`distribuido_em`; o lead continua com
--          `empresa_id` = a própria Full e `status_pipeline = 'novo'`, então
--          ele já aparece de volta na Central de leads da própria Full via a
--          policy `leads_select` existente (`empresa_id in
--          (select empresa_id from empresas_visiveis(auth.uid())`,
--          002_modelos_metas.sql) — qualquer pessoa da equipe dela (ou a
--          própria franqueada) pode assumi-lo de novo via `assumir_lead`
--          (015). Redistribuição AUTOMÁTICA dentro da própria equipe da Full
--          (rodízio entre vendedores dela) não existe hoje pra lead nenhum —
--          nem pra Matriz fora do fluxo `distribuir_fila_pendente`/trigger de
--          INSERT — então não é este job que deveria inventá-la; fica de fora
--          por não fazer parte do gap desta task (V11.5.2b/V11.5.6, ainda não
--          implementadas, é onde a Central da Franquia ganha a tela de
--          distribuição própria).
--
-- SOBRE "PERDA" (item 1 do plano — modelo investigado, não alterado aqui):
-- perda é um fluxo TOTALMENTE separado de SLA (`classificar_perda_cotacao`,
-- 012/014, marca `leads.status_pipeline='perdido'`; `avaliar_perda_lead`,
-- 014/033, é quem decide o destino). Hoje QUALQUER perda — de canal próprio ou
-- repassado — já marca `em_avaliacao_matriz=true` e só Matriz/master decide
-- (`avaliar_perda_lead` checa `has_role('matriz'/'master')`, sem olhar canal).
-- Ou seja, pra "perda" a fronteira já está cruzada sempre, pra todo canal — é
-- exatamente o "volta como Perda da Matriz" do título desta task, e já
-- funciona assim desde 014, sem gap. NÃO restringimos isso ao caso repassado
-- (dar à Full autonomia pra triar a própria perda) porque: (a) nenhuma task do
-- plano da Frente 5 pede isso — só V11.5.7 (esta) e ela fala de "SLA" no gap
-- documentado, perda é mencionada só no título; (b) não existe tela de
-- triagem de perda escopada por franquia (a única tela, `operacao/perdas.tsx`,
-- é da Matriz); mudar a autorização de `avaliar_perda_lead` sem uma tela pra
-- Full usar seria abrir uma porta que ninguém chama. Fica registrado como
-- decisão consciente, não como esquecimento — se a Lis quiser essa autonomia
-- também pra perda, é uma task de front+RPC própria, não um efeito colateral
-- desta migration.
-- ===========================================================================

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
  for v_rec in
    select l.id, l.responsavel_id, l.empresa_id, l.distribuido_em, l.canal_id
      from public.leads l
     where l.status_pipeline = 'novo'
       and l.responsavel_id is not null
       and l.ultimo_atendimento_em is null
       and l.distribuido_em is not null
       and l.distribuido_em < now() - interval '30 seconds'
     for update skip locked
  loop
    v_sla := coalesce(public.fn_sla_aplicavel_lead(v_rec.id), p_janela_seg);

    -- Ainda dentro do prazo aplicável a ESTE lead (pode ser diferente de
    -- p_janela_seg) — não expira, segue pro próximo candidato.
    if v_rec.distribuido_em >= now() - make_interval(secs => v_sla) then
      continue;
    end if;

    select c.empresa_id into v_canal_empresa
      from public.canais c
     where c.id = v_rec.canal_id;

    -- Repassado (canal Supper/empresa_id NULL, ou lead sem canal) -> cruza a
    -- fronteira pro pool padrão da Matriz. Canal próprio de uma Full -> fica
    -- dentro do pool da própria empresa (ver cabeçalho, item 2).
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
  'V11.5.7: devolve leads não atendidos, com SLA resolvido POR LEAD via
   fn_sla_aplicavel_lead (canal próprio de Full usa o SLA dela; repassado/sem
   canal usa o SLA global). Repassado cruza a fronteira (empresa_id -> null,
   cai no pool padrão da Matriz); canal próprio de uma Full mantém empresa_id
   (só limpa responsavel_id/distribuido_em) para não vazar pra outra franquia.
   p_janela_seg mantido só por compatibilidade de assinatura com o cron
   existente (030/031); não é mais o que decide a janela.';

grant execute on function public.expirar_leads_nao_atendidos(int) to authenticated, anon, service_role;
