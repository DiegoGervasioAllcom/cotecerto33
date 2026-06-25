-- ============================================================
-- 029: Garante que a distribuição automática ocorra no servidor
-- assim que um novo lead cair (BEFORE INSERT em public.leads).
-- A função distribuir_lead_auto() já foi atualizada na 028; aqui
-- recriamos o trigger para garantir que esteja ativo (caso a 024
-- tenha falhado antes da criação do trigger por causa de enums).
-- ============================================================

drop trigger if exists trg_distribuir_lead_auto on public.leads;

create trigger trg_distribuir_lead_auto
  before insert on public.leads
  for each row execute function public.distribuir_lead_auto();

-- Verifica/normaliza a config padrão de distribuição.
insert into public.distribuicao_config (id, automatico_on, modo, criterios)
values ('default', false, 'regiao', '{"regiao":true,"performance":true,"carga":true}'::jsonb)
on conflict (id) do nothing;
