-- V11 — estado canônico para acessos anteriores e fencing de links recovery.
-- Um link só ativa a emissão exata que o dispatcher vinculou ao redirect.

do $$
begin
  alter table public.email_outbox drop constraint if exists email_outbox_tipo_check;
  alter table public.email_outbox add constraint email_outbox_tipo_check
    check (tipo in (
      'pendencia', 'recusa', 'boas_vindas', 'boas_vindas_invalidada',
      'boas_vindas_herdada'
    ));
exception when duplicate_object then null;
end $$;

-- Perfis já aprovados antes de `acesso_emissoes` não precisam (nem podem)
-- receber um recovery novo. Registramos apenas o fato histórico, sem URL/token.
with historico as (
  insert into public.email_outbox (
    empresa_id, tipo, destinatario, payload, status, criado_por,
    criado_em, enviado_em, provider_id
  )
  select p.empresa_id, 'boas_vindas_herdada', p.email,
         jsonb_build_object('origem', 'backfill_acesso_pre_emissoes'),
         'enviado', p.id,
         coalesce(p.aprovada_em, p.created_at, now()),
         coalesce(p.aprovada_em, p.created_at, now()),
         'historico-pre-acesso-emissoes'
    from public.profiles p
   where p.status = 'aprovada'::public.empresa_status
     and p.empresa_id is not null
     and char_length(trim(p.email)) between 3 and 320
     and p.email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
     and not exists (
       select 1 from public.acesso_emissoes ae where ae.profile_id = p.id
     )
  returning id, empresa_id, criado_por, criado_em
)
insert into public.acesso_emissoes (
  empresa_id, profile_id, outbox_id, numero, status, criado_por,
  criado_em, envio_confirmado_em, ativado_em
)
select h.empresa_id, h.criado_por, h.id, 1, 'ativo', h.criado_por,
       h.criado_em, h.criado_em, h.criado_em
  from historico h;

-- A assinatura sem argumentos permitiria ativar qualquer emissão pendente do
-- titular após um recovery antigo. Removemos-a antes de publicar o contrato.
drop function if exists public.ativar_acesso_apos_criar_senha();

create function public.ativar_acesso_apos_criar_senha(
  p_emissao_id uuid,
  p_versao smallint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _emissao_id uuid;
begin
  if auth.uid() is null then raise exception 'sessão autenticada obrigatória'; end if;
  if p_emissao_id is null or p_versao is null or p_versao <= 0 then
    raise exception 'contrato de ativação inválido';
  end if;

  update public.acesso_emissoes
     set status = 'ativo', ativado_em = now()
   where id = p_emissao_id
     and profile_id = auth.uid()
     and numero = p_versao
     and status = 'pendente'
  returning id into _emissao_id;

  if _emissao_id is null then
    raise exception 'link de acesso inválido, substituído ou já utilizado';
  end if;
  return _emissao_id;
end
$$;

revoke all on function public.ativar_acesso_apos_criar_senha(uuid, smallint) from public, anon;
grant execute on function public.ativar_acesso_apos_criar_senha(uuid, smallint) to authenticated;

-- O dispatcher consulta isto já sob service_role e antes de gerar o recovery.
-- A versão é carregada no redirect_to; não é segredo, mas torna o link antigo
-- inelegível depois que `reenviar_link_acesso` invalida sua emissão.
create or replace function public.obter_contrato_link_acesso(
  p_outbox_id uuid,
  p_lease_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _contrato jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'somente serviço'; end if;

  select jsonb_build_object('emissao_id', ae.id, 'versao', ae.numero)
    into _contrato
    from public.email_outbox eo
    join public.acesso_emissoes ae on ae.outbox_id = eo.id
   where eo.id = p_outbox_id
     and eo.lease_token = p_lease_token
     and eo.status = 'enviando'
     and eo.tipo = 'boas_vindas'
     and ae.status = 'novo';
  if _contrato is null then
    raise exception 'emissão de acesso substituída ou indisponível';
  end if;
  return _contrato;
end
$$;

revoke all on function public.obter_contrato_link_acesso(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obter_contrato_link_acesso(uuid, uuid) to service_role;

comment on function public.ativar_acesso_apos_criar_senha(uuid, smallint) is
  'V11: ativa somente a emissão id+versão presente no redirect do recovery; reemissões invalidam versões anteriores.';
comment on function public.obter_contrato_link_acesso(uuid, uuid) is
  'V11: contrato service_role do dispatcher, consultado antes de gerar o recovery; nunca retorna token ou URL.';
