-- V12 Impressão, fatia B (1/3): % efetivo da corretora para o PDF interno.
-- Devolve só o número; NULL quando o % está em fallback (sem cadastro).
-- fn_pct_comissao_efetivo continua fechada (execute revogado) — só é chamada aqui.
create or replace function public.rpc_comissao_para_impressao(p_cotacao_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _uid     uuid := auth.uid();
  _empresa uuid;
  _resp    uuid;
  _pct     numeric;
  _fonte   text;
begin
  if _uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  select c.empresa_id, c.responsavel_id into _empresa, _resp
    from public.cotacoes c where c.id = p_cotacao_id;
  if _empresa is null
     or not (coalesce(_resp = _uid, false)
             or _empresa in (select empresa_id from public.empresas_visiveis(_uid))) then
    raise exception 'sem permissão sobre esta cotação' using errcode = '42501';
  end if;

  select f.pct, f.fonte into _pct, _fonte from public.fn_pct_comissao_efetivo(_empresa) f;
  if _fonte = 'fallback' then
    return null;
  end if;
  return _pct;
end $$;

revoke all on function public.rpc_comissao_para_impressao(uuid) from public, anon;
grant execute on function public.rpc_comissao_para_impressao(uuid) to authenticated;
