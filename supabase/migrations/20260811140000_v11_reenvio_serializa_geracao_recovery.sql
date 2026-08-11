-- V11 — serializa reemissão contra a geração do recovery pelo dispatcher.
-- O lease `enviando` abrange obter o contrato, chamar GoTrue e enviar ao
-- provedor. Reemissão concorrente não pode invalidar a emissão nesse intervalo:
-- ou ela ocorre antes (e o contrato antigo deixa de ser elegível), ou depois
-- (e o próximo generateLink revoga o recovery anterior).

create or replace function public.reenviar_link_acesso(p_empresa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_pode_aprovar_pedido(auth.uid(), p_empresa_id) then
    raise exception 'Seu acesso não permite reenviar este link';
  end if;

  -- Não há como manter uma transação SQL aberta durante `generateLink`. Em vez
  -- disso, o lease da outbox é a seção crítica persistente: bloquear o reenvio
  -- enquanto ela está enviando impede que um generateLink antigo rode depois de
  -- uma nova emissão e revogue o recovery mais novo no GoTrue.
  if exists (
    select 1
      from public.email_outbox eo
      join public.acesso_emissoes ae on ae.outbox_id = eo.id
     where eo.empresa_id = p_empresa_id
       and eo.tipo = 'boas_vindas'
       and eo.status = 'enviando'
       and ae.status = 'novo'
  ) then
    raise exception 'A geração do link de acesso está em andamento; aguarde a conclusão antes de reenviar';
  end if;

  if exists (
    select 1 from public.acesso_emissoes ae
     where ae.empresa_id = p_empresa_id and ae.status = 'ativo'
  ) then
    raise exception 'acesso já está ativo; não é possível emitir novo link';
  end if;

  update public.email_outbox eo
     set tipo = 'boas_vindas_invalidada', status = 'incerto',
         ultimo_erro = 'emissão invalidada por reenvio de acesso'
   where eo.empresa_id = p_empresa_id
     and eo.tipo = 'boas_vindas'
     and exists (
       select 1 from public.acesso_emissoes ae
        where ae.outbox_id = eo.id and ae.status in ('novo', 'pendente')
     );

  return public.enfileirar_boas_vindas(p_empresa_id);
end
$$;

revoke all on function public.reenviar_link_acesso(uuid) from public, anon;
grant execute on function public.reenviar_link_acesso(uuid) to authenticated;

comment on function public.reenviar_link_acesso(uuid) is
  'V11: reemite somente fora do lease do dispatcher. Assim uma geração antiga nunca sucede uma reemissão e não pode revogar o recovery mais novo.';
