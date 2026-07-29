-- ===========================================================================
-- H1 (V11 · hierarquia) — enum perfil += 'coordenador'
--
-- A V11 insere o Coordenador Comercial entre a Matriz e a rede: ele comanda os
-- dois supervisores (Vendas e Operacional) e cada Master passa a responder a
-- ele (fluxo "Hierarquia" em docs/v11/FLUXOS_OPERACIONAIS.html).
--
-- Por que 'coordenador' é valor de enum e os supervisores NÃO são: o Coordenador
-- é nível estrutural da cadeia (aparece no escalonamento de desconto e precisa
-- de linha própria de alçada). Supervisor de Vendas x Operacional x Backoffice
-- são recorte de escopo, que a V11 exige ajustável por pessoa — logo vivem na
-- tabela de cargos (H2), não no enum. Ver docs/PLANO_HIERARQUIA_V11.md.
--
-- Esta migration faz SÓ o enum, de propósito: em Postgres um valor novo de enum
-- não pode ser usado na mesma transação em que é criado. O uso está em H5/H6.
-- ===========================================================================

-- Idempotente — mesmo padrão da 035 (franqueado) e da g1_1 (supervisor).
do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'perfil' and e.enumlabel = 'coordenador'
  ) then
    alter type public.perfil add value 'coordenador';
  end if;
end$$;
