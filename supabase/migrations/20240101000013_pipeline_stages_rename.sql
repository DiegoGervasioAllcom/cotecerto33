-- Atualiza nomes das fases do pipeline para corresponder ao protótipo.
-- Mantém os valores do enum lead_status (novo/contato/cotacao/proposta/negociacao/ganho)
-- e apenas atualiza os rótulos exibidos em pipeline_stages.

update public.pipeline_stages set nome='Novo',             cor='#C9B57A' where ordem=1;
update public.pipeline_stages set nome='Qualificando',     cor='#C9B57A' where ordem=2;
update public.pipeline_stages set nome='Cotando',          cor='#C9B57A' where ordem=3;
update public.pipeline_stages set nome='Proposta enviada', cor='#C9B57A' where ordem=4;
update public.pipeline_stages set nome='Em negociação',    cor='#C9B57A' where ordem=5;
update public.pipeline_stages set nome='Fechado',          cor='#C9B57A' where ordem=6;
