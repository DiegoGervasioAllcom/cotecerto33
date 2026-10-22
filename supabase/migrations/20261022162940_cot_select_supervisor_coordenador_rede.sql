-- Supervisor e Coordenador passam a LER as cotações da rede (empresas_visiveis),
-- incluindo filhas (segurado etc.) e transmissões. Só leitura.

drop policy if exists cot_select on public.cotacoes;
create policy cot_select on public.cotacoes for select to authenticated using (
  (responsavel_id = auth.uid())
  or (empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid()))
  or has_role(auth.uid(), 'matriz'::perfil)
  or (has_role(auth.uid(), 'master'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
  or (has_role(auth.uid(), 'supervisor'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  or (has_role(auth.uid(), 'coordenador'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
);

do $$
declare t text;
begin
  foreach t in array array[
    'cotacao_coberturas', 'cotacao_perfil', 'cotacao_premios',
    'cotacao_segurado', 'cotacao_seguro', 'cotacao_veiculo', 'cotacao_transmissoes'
  ] loop
    execute format('drop policy if exists "%1$s_select_supervisor_rede" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select_supervisor_rede" on public.%1$s
      for select to authenticated using (
        exists (
          select 1 from public.cotacoes c
          where c.id = %1$s.cotacao_id
            and (has_role(auth.uid(), 'supervisor'::perfil) or has_role(auth.uid(), 'coordenador'::perfil))
            and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
        )
      )
    $f$, t);
  end loop;
end $$;
