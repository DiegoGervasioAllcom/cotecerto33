-- V11.2.2 — resultado ambíguo de envio não pode ser repetido automaticamente.
-- Rede, 5xx e resposta de sucesso sem identidade do provedor ficam em `incerto`.

do $$
declare
  _constraint_name text;
begin
  select c.conname into _constraint_name
    from pg_constraint c
   where c.conrelid = 'public.email_outbox'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%status%pendente%enviando%enviado%falhou%';

  if _constraint_name is not null then
    execute format('alter table public.email_outbox drop constraint %I', _constraint_name);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.email_outbox'::regclass
       and conname = 'email_outbox_status_check'
  ) then
    alter table public.email_outbox
      add constraint email_outbox_status_check
      check (status in ('pendente', 'enviando', 'enviado', 'falhou', 'incerto'));
  end if;
end
$$;

create or replace function public.marcar_email_outbox_enviando(p_outbox_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _row public.email_outbox;
begin
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

drop function if exists public.finalizar_email_outbox(uuid, uuid, boolean, text, text);

create function public.finalizar_email_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_resultado text,
  p_provider_id text default null,
  p_erro text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare _alteradas integer;
begin
  if auth.role() <> 'service_role' then raise exception 'somente serviço'; end if;
  if p_resultado not in ('enviado', 'falha_explicita', 'incerto') then
    raise exception 'resultado de envio inválido';
  end if;
  if p_resultado = 'enviado' and nullif(trim(p_provider_id), '') is null then
    raise exception 'envio confirmado exige provider_id';
  end if;

  update public.email_outbox
     set status = case p_resultado
                    when 'enviado' then 'enviado'
                    when 'falha_explicita' then 'falhou'
                    else 'incerto'
                  end,
         enviado_em = case when p_resultado = 'enviado' then now() else null end,
         provider_id = case when p_resultado = 'enviado' then left(p_provider_id, 200) else null end,
         ultimo_erro = left(p_erro, 1000)
   where id = p_outbox_id and status = 'enviando' and lease_token = p_lease_token;
  get diagnostics _alteradas = row_count;
  if _alteradas = 0 then raise exception 'lease de e-mail expirado ou substituído'; end if;
end
$$;

revoke all on function public.marcar_email_outbox_enviando(uuid) from public, anon;
revoke all on function public.finalizar_email_outbox(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.marcar_email_outbox_enviando(uuid) to authenticated;
grant execute on function public.finalizar_email_outbox(uuid, uuid, text, text, text) to service_role;

comment on function public.finalizar_email_outbox(uuid, uuid, text, text, text) is
  'Finaliza sob fencing token; resultados ambíguos tornam a mensagem não claimável para evitar duplicidade.';
