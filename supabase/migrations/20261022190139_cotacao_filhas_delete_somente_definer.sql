-- Tabelas filhas de cotação: DELETE negado a todo client (só SECURITY DEFINER
-- e ON DELETE CASCADE de cotacoes apagam). Leitura/insert/update idênticos à _rw anterior.
do $$
declare
  t text;
  usando text;
  checando text;
begin
  foreach t in array array['cotacao_coberturas','cotacao_perfil','cotacao_premios',
                           'cotacao_segurado','cotacao_seguro','cotacao_veiculo'] loop
    execute format('alter table public.%I enable row level security', t);
    usando := format($q$exists (select 1 from public.cotacoes c
      where c.id = %1$I.cotacao_id and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select p.empresa_id from public.profiles p where p.id = auth.uid())
        or public.has_role(auth.uid(), 'matriz'::public.perfil)
        or (public.has_role(auth.uid(), 'master'::public.perfil)
            and c.empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev(empresa_id)))))$q$, t);
    checando := format($q$exists (select 1 from public.cotacoes c
      where c.id = %1$I.cotacao_id and c.responsavel_id = auth.uid())$q$, t);

    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, usando);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, checando);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, usando, checando);
  end loop;
end $$;
