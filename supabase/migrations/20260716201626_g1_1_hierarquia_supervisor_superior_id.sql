-- ===========================================================================
-- 042 (G1.1) — Hierarquia multinível: base de dados
--   1) enum perfil += 'supervisor'
--   2) profiles.superior_id (a quem o usuário reporta — cadeia multinível)
--   3) índice para as consultas de hierarquia
--
-- IMPORTANTE: o Postgres não permite USAR um novo valor de enum na mesma
-- transação em que ele foi adicionado. Por isso esta migration apenas ADICIONA
-- o valor e a coluna; o USO (empresas_visiveis() multinível e revisão das
-- policies) fica na próxima migration (043 / G1.2–G1.3).
-- ===========================================================================

-- 1) Enum perfil += 'supervisor' (idempotente — mesmo padrão da 035).
do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'perfil' and e.enumlabel = 'supervisor'
  ) then
    alter type public.perfil add value 'supervisor';
  end if;
end$$;

-- 2) profiles.superior_id — a quem este usuário reporta.
--    Self-FK; on delete set null: remover um superior NÃO apaga os subordinados,
--    apenas zera o vínculo (a re-hierarquização é feita na tela de Acessos, G1.4).
--    NULL = topo da cadeia (Matriz).
alter table public.profiles
  add column if not exists superior_id uuid
    references public.profiles(id) on delete set null;

comment on column public.profiles.superior_id is
  'A quem este usuário reporta na hierarquia multinível (cadeia Vendedor de franquia > Franquia > Master/Supervisor > Matriz). NULL = topo (Matriz). Definido na classificação de acesso (G1.4).';

-- 3) Guarda mínima anti-auto-referência (um usuário não pode reportar a si
--    mesmo). Ciclos mais longos (A→B→A) ficam a cargo da resolução recursiva
--    com CYCLE na 043 — um check simples não os cobre.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_superior_id_nao_self'
  ) then
    alter table public.profiles
      add constraint profiles_superior_id_nao_self
      check (superior_id is distinct from id);
  end if;
end$$;

-- 4) Índice para a resolução da cadeia (empresas_visiveis() recursiva — 043).
create index if not exists idx_profiles_superior_id
  on public.profiles(superior_id);
