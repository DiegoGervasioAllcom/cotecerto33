-- Comissão por seguradora no ajuste da cotação (aba "+ Comissões" do portal).
-- O vendedor ajusta o percentual dentro da faixa que o portal aceita (20 a 25);
-- o limite é conferido aqui, não só no front. Mesma tabela e mesmo RPC do
-- ajuste de coberturas (V12.3.7): coluna nula = "não ajustar".

alter table public.cotacao_seguradora_ajustes
  add column if not exists comissao_pct numeric(5,2)
    check (comissao_pct is null or comissao_pct between 20 and 25);

alter table public.cotacao_seguradora_ajustes drop constraint if exists cot_seg_ajustes_algum;
alter table public.cotacao_seguradora_ajustes add constraint cot_seg_ajustes_algum check (
  franquia_primeira_opcao is not null or franquia_segunda_opcao is not null
  or vidros is not null or carro_reserva is not null or comissao_pct is not null);

-- Assinatura nova (7º parâmetro, opcional): sai a antiga para não ficar
-- sobrecarga ambígua com a mesma chamada de 6 argumentos.
drop function if exists public.salvar_ajuste_seguradora(uuid,text,text,text,text,text);

create or replace function public.salvar_ajuste_seguradora(
  p_cotacao_id uuid, p_seguradora text, p_franquia_1 text, p_franquia_2 text,
  p_vidros text, p_carro_reserva text, p_comissao_pct numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _empresa uuid;
  _id      uuid;
begin
  _empresa := public.fn_cot_seg_ajuste_acesso(p_cotacao_id);

  -- cotação que já virou proposta não aceita mais ajuste
  if exists (select 1 from public.cotacoes c
              where c.id = p_cotacao_id and c.status in ('proposta','aceita'))
     or exists (select 1 from public.propostas p
                 where p.cotacao_id = p_cotacao_id and p.status is distinct from 'cancelada') then
    raise exception 'cotação já virou proposta' using errcode = '22023';
  end if;

  insert into public.cotacao_seguradora_ajustes
    (cotacao_id, empresa_id, seguradora, franquia_primeira_opcao, franquia_segunda_opcao,
     vidros, carro_reserva, comissao_pct, aplicado_em, updated_by)
  values
    (p_cotacao_id, _empresa, p_seguradora, p_franquia_1, p_franquia_2,
     p_vidros, p_carro_reserva, p_comissao_pct, null, auth.uid())
  on conflict (cotacao_id, seguradora) do update set
    franquia_primeira_opcao = excluded.franquia_primeira_opcao,
    franquia_segunda_opcao  = excluded.franquia_segunda_opcao,
    vidros                  = excluded.vidros,
    carro_reserva           = excluded.carro_reserva,
    comissao_pct            = excluded.comissao_pct,
    aplicado_em             = null,
    updated_by              = excluded.updated_by
  returning id into _id;
  return _id;
end $$;

revoke all on function public.salvar_ajuste_seguradora(uuid,text,text,text,text,text,numeric) from public, anon;
grant execute on function public.salvar_ajuste_seguradora(uuid,text,text,text,text,text,numeric) to authenticated;
