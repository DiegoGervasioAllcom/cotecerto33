-- S-crítica: master tinha acesso irrestrito (sem escopo de rede) em 12 tabelas via
-- has_role(auth.uid(),'master') solto. Corrige para exigir também
-- empresa_id IN (select empresa_id from empresas_visiveis(auth.uid())), no mesmo
-- padrão já usado em profiles/empresas/leads/comissao_lancamentos (G1.2).
-- matriz continua irrestrita (intencional, não mexido).

-- 1) propostas
drop policy if exists prop_select on public.propostas;
create policy prop_select on public.propostas
  for select
  to authenticated
  using (
    (responsavel_id = auth.uid())
    or (empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid()))
    or has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  );

-- 2) cotacoes
drop policy if exists cot_select on public.cotacoes;
create policy cot_select on public.cotacoes
  for select
  to authenticated
  using (
    (responsavel_id = auth.uid())
    or (empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid()))
    or has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  );

-- 3) tabelas-filha de cotacoes (FOR ALL, mesma condição no USING; WITH CHECK mantido igual)
drop policy if exists cotacao_coberturas_rw on public.cotacao_coberturas;
create policy cotacao_coberturas_rw on public.cotacao_coberturas
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_coberturas.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_coberturas.cotacao_id and c.responsavel_id = auth.uid()
  ));

drop policy if exists cotacao_perfil_rw on public.cotacao_perfil;
create policy cotacao_perfil_rw on public.cotacao_perfil
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_perfil.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_perfil.cotacao_id and c.responsavel_id = auth.uid()
  ));

drop policy if exists cotacao_premios_rw on public.cotacao_premios;
create policy cotacao_premios_rw on public.cotacao_premios
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_premios.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_premios.cotacao_id and c.responsavel_id = auth.uid()
  ));

drop policy if exists cotacao_segurado_rw on public.cotacao_segurado;
create policy cotacao_segurado_rw on public.cotacao_segurado
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_segurado.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_segurado.cotacao_id and c.responsavel_id = auth.uid()
  ));

drop policy if exists cotacao_seguro_rw on public.cotacao_seguro;
create policy cotacao_seguro_rw on public.cotacao_seguro
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_seguro.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_seguro.cotacao_id and c.responsavel_id = auth.uid()
  ));

drop policy if exists cotacao_veiculo_rw on public.cotacao_veiculo;
create policy cotacao_veiculo_rw on public.cotacao_veiculo
  for all
  to authenticated
  using (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_veiculo.cotacao_id
      and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and c.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ))
  with check (exists (
    select 1 from public.cotacoes c
    where c.id = cotacao_veiculo.cotacao_id and c.responsavel_id = auth.uid()
  ));

-- 4) lead_eventos
drop policy if exists leadev_read on public.lead_eventos;
create policy leadev_read on public.lead_eventos
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and exists (
      select 1 from public.leads l2
      where l2.id = lead_eventos.lead_id
        and l2.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    ))
    or exists (
      select 1 from public.leads l
      where l.id = lead_eventos.lead_id
        and (
          l.responsavel_id = auth.uid()
          or l.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        )
    )
  );

-- 5) login_audit (sem empresa_id direto; escopa via profiles.user_id)
drop policy if exists login_audit_select_matriz on public.login_audit;
create policy login_audit_select_matriz on public.login_audit
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and exists (
      select 1 from public.profiles p
      where p.id = login_audit.user_id
        and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    ))
  );

-- 6) metas (escopo 'empresa' -> empresas_visiveis; escopo 'usuario' -> profiles da rede)
drop policy if exists metas_admin on public.metas;
create policy metas_admin on public.metas
  for all
  to authenticated
  using (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and (
      (escopo = 'empresa' and ref_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      or (escopo = 'usuario' and ref_id in (
        select id from public.profiles
        where empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      ))
    ))
  )
  with check (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and (
      (escopo = 'empresa' and ref_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      or (escopo = 'usuario' and ref_id in (
        select id from public.profiles
        where empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      ))
    ))
  );

-- proposta_versoes ficou sem grant a service_role em 20260719234500_g7_1_propostas_negociacao.sql
-- (gap incidental, não relacionado ao bug de master, mas bloqueia service_role/fixtures de teste).
grant select, insert, update, delete on public.proposta_versoes to service_role;

-- 7) proposta_versoes
drop policy if exists propv_select on public.proposta_versoes;
create policy propv_select on public.proposta_versoes
  for select
  to authenticated
  using (exists (
    select 1 from public.propostas p
    where p.id = proposta_versoes.proposta_id
      and (
        p.responsavel_id = auth.uid()
        or p.empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
        or has_role(auth.uid(), 'matriz'::perfil)
        or (has_role(auth.uid(), 'master'::perfil) and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      )
  ));
