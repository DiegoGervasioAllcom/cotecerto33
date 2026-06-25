-- ===========================================================================
-- CoteCerto 3.3 — Corrige enum empresa_tipo para aceitar 'matriz'
--
-- O enum foi criado apenas com ('pj','pf'). A migration 024 usa
--   e.tipo <> 'matriz'
-- o que gera erro de valor inválido para o enum.
-- ===========================================================================

do $$ begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.empresa_tipo'::regtype
      and enumlabel = 'matriz'
  ) then
    alter type public.empresa_tipo add value 'matriz';
  end if;
end $$;

-- Atualiza a empresa matriz do seed para o tipo correto
update public.empresas
   set tipo = 'matriz'
 where nome = 'Matriz CoteCerto'
   and tipo <> 'matriz';
