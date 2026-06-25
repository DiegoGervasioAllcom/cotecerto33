-- ============================================================
-- 031: Corrige duplicação de eventos "SLA expirado — devolvido à Matriz"
-- ============================================================
-- Causa:
--   O trigger AFTER UPDATE `trg_expirar_leads_oportunista` (mig. 030)
--   re-chamava `expirar_leads_nao_atendidos(180)` a cada UPDATE feito
--   dentro do próprio loop da função. Como FOR UPDATE SKIP LOCKED NÃO
--   ignora locks da própria transação, a chamada recursiva reprocessava
--   os demais leads ainda no loop, gerando N inserts em lead_eventos
--   para o mesmo lead.
--
-- Correção:
--   1. Remover o trigger oportunista (o pg_cron já garante execução).
--   2. Reforçar a função com WHERE extra no UPDATE para impedir
--      reprocessamento, e adicionar guard de reentrância via
--      pg_try_advisory_xact_lock.
-- ============================================================

drop trigger if exists trg_expirar_leads_oportunista on public.leads;
drop function if exists public.trg_expirar_leads_oportunista();

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
begin
  -- Guard de reentrância: se outra execução já está rodando nesta txn,
  -- aborta silenciosamente.
  if not pg_try_advisory_xact_lock(hashtext('expirar_leads_nao_atendidos')) then
    return 0;
  end if;

  for v_rec in
    select id, responsavel_id, empresa_id, distribuido_em
      from public.leads
     where status_pipeline = 'novo'
       and responsavel_id is not null
       and ultimo_atendimento_em is null
       and distribuido_em is not null
       and distribuido_em < now() - make_interval(secs => p_janela_seg)
     for update skip locked
  loop
    update public.leads
       set responsavel_id = null,
           empresa_id     = null,
           distribuido_em = null,
           atualizado_em  = now()
     where id = v_rec.id
       and responsavel_id is not null   -- evita re-update
       and distribuido_em is not null;
    get diagnostics v_updated = row_count;

    if v_updated > 0 then
      insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
      values (
        v_rec.id,
        'sla_expirado',
        'SLA expirado — devolvido à Matriz',
        'Lead não foi assumido em ' || p_janela_seg || 's após a distribuição e retornou para a fila da Matriz.',
        null,
        jsonb_build_object(
          'responsavel_anterior', v_rec.responsavel_id,
          'empresa_anterior',     v_rec.empresa_id,
          'distribuido_em',       v_rec.distribuido_em,
          'janela_seg',           p_janela_seg
        )
      );
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end$$;

grant execute on function public.expirar_leads_nao_atendidos(int) to authenticated, anon, service_role;

-- Limpa duplicatas existentes (mantém o evento mais antigo por lead+segundo).
with dups as (
  select id,
         row_number() over (
           partition by lead_id, tipo, date_trunc('minute', criado_em)
           order by criado_em
         ) as rn
    from public.lead_eventos
   where tipo = 'sla_expirado'
)
delete from public.lead_eventos e
 using dups
 where e.id = dups.id
   and dups.rn > 1;
