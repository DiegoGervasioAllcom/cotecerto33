-- V11 — serializa atomically o claim do dispatcher e a reemissão por empresa.
-- A trava transacional é adquirida pelos dois caminhos antes de alterar a outbox:
-- uma reemissão não pode passar entre o claim e o generateLink antigo.

create or replace function public.marcar_email_outbox_enviando(p_outbox_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.email_outbox;
  _empresa_id uuid;
begin
  select empresa_id into _empresa_id
    from public.email_outbox
   where id = p_outbox_id
     and criado_por = auth.uid();

  if _empresa_id is null then
    raise exception 'e-mail indisponível para envio';
  end if;

  -- Compartilhada com reenviar_link_acesso. A transação que vencer decide o
  -- estado: claim vence -> reenvio recusa o lease; reenvio vence -> claim não
  -- encontra mais uma boas-vindas enviável e jamais chama generateLink.
  perform pg_advisory_xact_lock(hashtextextended(_empresa_id::text, 0));

  update public.email_outbox
     set status = 'enviando', processando_em = now(), tentativas = tentativas + 1,
         lease_token = gen_random_uuid(), ultimo_erro = null
   where id = p_outbox_id
     and criado_por = auth.uid()
     and status in ('pendente', 'falhou')
     and tentativas < 10
  returning * into _row;

  if _row.id is null then raise exception 'e-mail indisponível para envio'; end if;
  return jsonb_build_object(
    'id', _row.id, 'tipo', _row.tipo, 'destinatario', _row.destinatario,
    'payload', _row.payload, 'lease_token', _row.lease_token
  );
end
$$;

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

  perform pg_advisory_xact_lock(hashtextextended(p_empresa_id::text, 0));

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
     and eo.status in ('pendente', 'falhou', 'enviado', 'incerto')
     and exists (
       select 1 from public.acesso_emissoes ae
        where ae.outbox_id = eo.id and ae.status in ('novo', 'pendente')
     );

  return public.enfileirar_boas_vindas(p_empresa_id);
end
$$;

revoke all on function public.marcar_email_outbox_enviando(uuid) from public, anon;
grant execute on function public.marcar_email_outbox_enviando(uuid) to authenticated;
revoke all on function public.reenviar_link_acesso(uuid) from public, anon;
grant execute on function public.reenviar_link_acesso(uuid) to authenticated;

comment on function public.marcar_email_outbox_enviando(uuid) is
  'V11: claim da outbox serializado com a reemissão por empresa; um dispatcher antigo não gera recovery após nova emissão.';
comment on function public.reenviar_link_acesso(uuid) is
  'V11: reemissão serializada com o claim do dispatcher; lease vigente bloqueia nova emissão antes do generateLink.';
