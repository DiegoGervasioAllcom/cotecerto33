-- ============================================================
-- 030: Devolução automática de leads não atendidos — 100% no servidor
-- ============================================================
-- Garante que a expiração de SLA (devolver lead à Matriz quando não for
-- "Assumido e iniciado" dentro do tempo limite) seja executada pelo banco,
-- sem depender de chamada do frontend.
--
-- Estratégia:
--   1. Habilita a extensão pg_cron (presente no Supabase self-hosted).
--   2. Reagenda o job para rodar a cada 30 segundos (ou 1 minuto como
--      fallback se a sintaxe "30 seconds" não for suportada).
--   3. (Bônus) Cria um trigger AFTER UPDATE em leads que, sempre que um
--      lead distribuído for "tocado" (qualquer update), reavalia a fila de
--      expirados — isso garante que mesmo sem cron, qualquer atividade do
--      sistema dispara a limpeza.

create extension if not exists pg_cron;

-- Reagenda o job (idempotente).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'expirar_leads_nao_atendidos';
    begin
      perform cron.schedule(
        'expirar_leads_nao_atendidos',
        '30 seconds',
        $cron$ select public.expirar_leads_nao_atendidos(180); $cron$
      );
    exception when others then
      perform cron.schedule(
        'expirar_leads_nao_atendidos',
        '* * * * *',
        $cron$ select public.expirar_leads_nao_atendidos(180); $cron$
      );
    end;
  end if;
end$$;

-- Trigger de "oportunidade": qualquer INSERT/UPDATE em leads dispara a
-- varredura de expirados de forma assíncrona-leve. Como a função usa
-- "for update skip locked", concorrência é segura. Isto serve como rede
-- de segurança caso o pg_cron esteja desabilitado no ambiente.
create or replace function public.trg_expirar_leads_oportunista()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expirar_leads_nao_atendidos(180);
  return null;
end$$;

drop trigger if exists trg_expirar_leads_oportunista on public.leads;
create trigger trg_expirar_leads_oportunista
  after insert or update of distribuido_em, responsavel_id, ultimo_atendimento_em
  on public.leads
  for each statement
  execute function public.trg_expirar_leads_oportunista();
