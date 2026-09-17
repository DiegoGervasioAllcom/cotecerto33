-- ============================================================
-- Correção de 2 gaps de RLS reportados pelo agente `testes` sobre a
-- migration 20260908152312_etapa7_transmissao_dados_complementares.sql:
--
-- GAP 1: a policy "profiles update self" (20240101000001_init.sql,
-- IMUTÁVEL) só libera `id = auth.uid() or has_role(matriz)` — supervisor
-- nunca chega a atualizar `pode_transmitir` de um subordinado (a RLS barra
-- antes do trigger fn_bloquear_auto_alteracao_pode_transmitir rodar; 0
-- linhas afetadas, sem erro). Em vez de acrescentar uma policy de UPDATE
-- geral para supervisor (o que abriria TODOS os campos de `profiles`, não
-- só a flag de transmissão — risco desnecessário), criamos uma RPC
-- `security definer` cirúrgica que só altera essa coluna e valida a
-- alçada dentro da própria function.
--
-- GAP 2: a policy `proposta_dados_complementares_write` usa
-- `exists (select 1 from public.propostas p where ...)`. Essa subquery
-- roda com o role `authenticated` do chamador, então continua sujeita à
-- RLS de `propostas` (policy `prop_select`, que NÃO tem cláusula para
-- `supervisor`). Resultado: para um supervisor de cadeia (cenário comum,
-- multi-franquia), a linha de `propostas` nem aparece no from-clause da
-- subquery — o `exists` nunca é alcançado, mesmo com superior_id correto.
-- Confirmado manualmente: authenticated não tem `rolbypassrls` (só
-- postgres/service_role têm), então RLS de propostas se aplica dentro da
-- subquery de outra policy. Correção: mover a checagem para dentro de uma
-- function `security definer` (dona = postgres, bypassa RLS de propostas
-- internamente, mesmo padrão de has_role/empresas_visiveis já usado no
-- projeto desde 20240101000001_init.sql).
-- ============================================================

-- ---------- GAP 1: RPC definir_pode_transmitir ----------
create or replace function public.definir_pode_transmitir(p_profile_id uuid, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _superior_id uuid;
begin
  if p_profile_id = auth.uid()
     and not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'supervisor')) then
    raise exception 'Você não pode alterar sua própria permissão de transmissão. Fale com a Matriz ou seu supervisor.';
  end if;

  if public.has_role(auth.uid(),'matriz') then
    -- matriz altera qualquer perfil
    null;
  elsif public.has_role(auth.uid(),'supervisor') then
    select superior_id into _superior_id from public.profiles where id = p_profile_id;
    if _superior_id is distinct from auth.uid() then
      raise exception 'Você só pode alterar a permissão de transmissão de subordinados diretos da sua cadeia.';
    end if;
  else
    raise exception 'Você não tem permissão para alterar a permissão de transmissão de outro perfil.';
  end if;

  update public.profiles set pode_transmitir = p_valor where id = p_profile_id;
end;
$$;

grant execute on function public.definir_pode_transmitir(uuid, boolean) to authenticated;

comment on function public.definir_pode_transmitir(uuid, boolean) is
  'Único caminho suportado para matriz/supervisor alterarem profiles.pode_transmitir de terceiros — não abre UPDATE geral de profiles para supervisor. Vendedor comum não pode chamar para si mesmo (bloqueio replicado aqui, além do trigger).';

-- ---------- GAP 2: função security definer + policy de write sem depender de prop_select ----------
create or replace function public.pode_editar_dados_complementares(_proposta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _resp uuid;
  _superior uuid;
begin
  select responsavel_id into _resp from public.propostas where id = _proposta_id;
  if _resp is null then
    return false;
  end if;

  if _resp = auth.uid() then
    return true;
  end if;

  if public.has_role(auth.uid(),'matriz') then
    return true;
  end if;

  if public.has_role(auth.uid(),'supervisor') then
    select superior_id into _superior from public.profiles where id = _resp;
    return _superior = auth.uid();
  end if;

  return false;
end;
$$;

grant execute on function public.pode_editar_dados_complementares(uuid) to authenticated;

drop policy if exists proposta_dados_complementares_write on public.proposta_dados_complementares;
create policy proposta_dados_complementares_write on public.proposta_dados_complementares
  for all to authenticated
  using (public.pode_editar_dados_complementares(proposta_dados_complementares.proposta_id))
  with check (public.pode_editar_dados_complementares(proposta_dados_complementares.proposta_id));
