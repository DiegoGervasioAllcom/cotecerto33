-- ===========================================================================
-- H6 (V11 · hierarquia) — alçada de desconto derivada de CARGO, não de perfil
--
-- Na V10 havia um supervisor só, e 'supervisor' era um modelo de alçada. Na V11
-- existem três (Vendas, Operacional, Backoffice) e apenas o de Vendas tem alçada:
-- "É o único supervisor com alçada de desconto, nas Aprovações" (fluxo "Acesso e
-- visualização"). O Operacional é explicitamente "sem alçada de desconto".
--
-- Por que isso NÃO exigiu valores novos de enum: a alçada nunca foi o enum
-- perfil. desconto_politicas.modelo é text com check, e a ponte é esta função.
-- Basta ela ler o cargo. Ver docs/PLANO_HIERARQUIA_V11.md.
--
-- Mudanças:
--   1) desconto_politicas.modelo: 'supervisor' -> 'supervisor_vendas', + 'coordenador'.
--      Assim a ausência de alçada do Operacional/Backoffice é ESTRUTURAL (não existe
--      modelo para eles), não um esquecimento de configuração.
--   2) fn_modelo_alcada_desconto passa a derivar de profiles.cargo_id.
--
-- Reescrever o check é seguro porque o sistema não está em uso em produção
-- (AGENTS.md, decisões de 13/07 — banco pode ser recriado).
--
-- A cadeia de escalonamento NÃO muda: fn_desconto_pode_aprovar resolve por
-- with recursive sobre superior_id, agnóstica de rótulo. O Supervisor Operacional
-- é IRMÃO do de Vendas (ambos sob o Coordenador) e não é ancestral de vendedor
-- nenhum — então ele já fica fora das aprovações pela topologia, sem regra nova.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Novos modelos de alçada
-- ---------------------------------------------------------------------------

-- Migra linhas existentes antes de trocar o check (idempotente).
update public.desconto_politicas
   set modelo = 'supervisor_vendas'
 where modelo = 'supervisor';

alter table public.desconto_politicas
  drop constraint if exists desconto_politicas_modelo_check;

alter table public.desconto_politicas
  add constraint desconto_politicas_modelo_check
  check (modelo in (
    'franquia_individual',
    'franquia_full',
    'master',
    'supervisor_vendas',
    'coordenador'
  ));

comment on table public.desconto_politicas is
  'G3.1 + H6: alçada de desconto (% máximo) por modelo x seguradora, configurada
   pela Matriz. Nasce vazia — ausência de linha para um par (modelo, seguradora_id)
   significa que o pedido escala ao nível de cima (lógica na RPC do G3.2).
   V11: o modelo do time interno vem do CARGO (só Supervisor de Vendas e
   Coordenador têm alçada); Operacional e Backoffice não têm modelo, de propósito.';

-- ---------------------------------------------------------------------------
-- 2) Derivação por cargo
-- ---------------------------------------------------------------------------
create or replace function public.fn_modelo_alcada_desconto(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _modalidade text;
  _cargo      text;
begin
  -- Rede externa primeiro (não tem cargo).
  if public.has_role(p_profile_id, 'master') then
    return 'master';

  elsif public.has_role(p_profile_id, 'franqueado') then
    select mf.modalidade into _modalidade
      from public.profiles p
      join public.empresas e on e.id = p.empresa_id
      join public.modelos_franquia mf on mf.id = e.modelo_id
     where p.id = p_profile_id;

    if _modalidade = 'full' then
      return 'franquia_full';
    else
      return 'franquia_individual';
    end if;

  elsif public.has_role(p_profile_id, 'coordenador') then
    return 'coordenador';

  elsif public.has_role(p_profile_id, 'supervisor') then
    -- V11: qual supervisor? Só o de Vendas tem alçada. Sem cargo definido,
    -- retorna NULL — que na RPC do G3.2 significa "escala para cima", o
    -- comportamento seguro (nunca aprovar por omissão).
    select p.cargo_id into _cargo
      from public.profiles p
     where p.id = p_profile_id;

    if _cargo = 'sup_vendas' then
      return 'supervisor_vendas';
    else
      return null;
    end if;

  else
    return null;
  end if;
end;
$$;

comment on function public.fn_modelo_alcada_desconto(uuid) is
  'G3.2 + H6: modelo de alçada do aprovador para desconto_politicas. Rede externa
   por role/modalidade; time interno por profiles.cargo_id — só sup_vendas vira
   supervisor_vendas. NULL = sem alçada (escala para cima): vendedor, matriz
   (que não usa alçada), Supervisor Operacional e Backoffice.';

revoke all on function public.fn_modelo_alcada_desconto(uuid) from public, anon;
grant execute on function public.fn_modelo_alcada_desconto(uuid) to authenticated;
