-- S6: catálogos (seguradoras, planos, pipeline_stages) não devem ser públicos.
-- `planos` carrega % de comissão e `seguradoras`/`pipeline_stages` expõem estrutura
-- interna de negócio. Nenhuma tela pré-login precisa ler esses catálogos (todos os
-- consumidores estão sob _authenticated/*). Revoga leitura anônima em dois caminhos:
-- grant de tabela + policy RLS `to anon, authenticated`.

revoke select on public.seguradoras from anon;
revoke select on public.planos from anon;
revoke select on public.pipeline_stages from anon;

drop policy if exists "seguradoras_read_all" on public.seguradoras;
create policy "seguradoras_read_all" on public.seguradoras
  for select to authenticated using (true);

drop policy if exists "planos_read_all" on public.planos;
create policy "planos_read_all" on public.planos
  for select to authenticated using (true);

drop policy if exists "pipeline read" on public.pipeline_stages;
create policy "pipeline read" on public.pipeline_stages
  for select to authenticated using (true);
