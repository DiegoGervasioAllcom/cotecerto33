-- V12.4.12 (parte B): limpa htmlSnippet/rawText dos registros existentes.
-- Única coluna que guarda o payload bruto: public.cotacoes.quiver_resultado_raw.
--
-- Contagem (rodar antes e depois; depois deve dar 0):
--   select count(*) from public.cotacoes
--    where quiver_resultado_raw::text like '%"htmlSnippet"%'
--       or quiver_resultado_raw::text like '%"rawText"%';
--
-- Em lotes de 500 (cada UPDATE toca no máx. 500 linhas). Dentro de uma
-- transação única os locks só saem no commit; para lock curto em base grande,
-- chame `select public.quiver_limpar_bruto_lote(500);` repetidamente em
-- autocommit até retornar 0.

create or replace function public.quiver_limpar_bruto_lote(p_limite integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  with alvo as (
    select id
      from public.cotacoes
     where (quiver_resultado_raw::text like '%"htmlSnippet"%'
            or quiver_resultado_raw::text like '%"rawText"%')
       and quiver_resultado_raw is distinct from public.quiver_sem_bruto(quiver_resultado_raw)
     order by id
     limit greatest(coalesce(p_limite, 500), 1)
       for update skip locked
  )
  update public.cotacoes c
     set quiver_resultado_raw = public.quiver_sem_bruto(c.quiver_resultado_raw)
    from alvo
   where c.id = alvo.id;
  get diagnostics _n = row_count;
  return _n;
end;
$$;

revoke all on function public.quiver_limpar_bruto_lote(integer) from public, anon, authenticated;
grant execute on function public.quiver_limpar_bruto_lote(integer) to service_role;

do $$
declare
  _n integer;
begin
  loop
    _n := public.quiver_limpar_bruto_lote(500);
    exit when _n = 0;
  end loop;
end;
$$;
