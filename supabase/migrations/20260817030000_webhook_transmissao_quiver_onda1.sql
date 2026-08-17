-- ============================================================
-- Webhook de resultado da transmissão (robô Quiver) — Onda 1 (banco).
-- Ver doc/PLANO_WEBHOOK_TRANSMISSAO.md. T.1: tabela de histórico de
-- tentativas; T.2: colunas de status de transmissão em `propostas`;
-- T.3: RPC `registrar_resultado_transmissao_quiver` chamada pelo webhook
-- (Onda 2, ainda não implementada) via service_role.
-- ============================================================

-- ---------- T.1: cotacao_transmissoes (histórico de tentativas) ----------
create table if not exists public.cotacao_transmissoes (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  proposta_id uuid references public.propostas(id) on delete set null,
  seguradora text,
  produto_id text,
  produto text,
  forma_pagamento text,
  parcelas text,
  premio numeric(14,2),
  status text not null default 'enviada',
  motivo text,
  mensagem text,
  numero_cotacao_portal text,
  capturado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint cotacao_transmissoes_status_chk
    check (status in ('enviada','transmitida','falha'))
);

create index if not exists cotacao_transmissoes_cotacao_idx
  on public.cotacao_transmissoes(cotacao_id);

alter table public.cotacao_transmissoes enable row level security;

-- Leitura: mesmo padrão de visibilidade de cotacao_premios (herda do dono da
-- cotação/empresa/matriz-master). Escrita: só service_role/RPC security
-- definer — o vendedor não edita histórico de transmissão diretamente.
grant select on public.cotacao_transmissoes to authenticated;
grant all on public.cotacao_transmissoes to service_role;

drop policy if exists cotacao_transmissoes_select on public.cotacao_transmissoes;
create policy cotacao_transmissoes_select on public.cotacao_transmissoes
  for select to authenticated using (
    exists (
      select 1 from public.cotacoes c where c.id = cotacao_transmissoes.cotacao_id and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select empresa_id from public.profiles where id = auth.uid())
        or (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master'))
      )
    )
  );

-- ---------- T.2: colunas de status de transmissão em propostas ----------
-- Distinto do `status` de ciclo de vida (gerada/transmitida/...) e do
-- `transmissao_obs` (campo livre do fluxo manual) — este é o resultado
-- estruturado que vem do robô via webhook.
alter table public.propostas
  add column if not exists transmissao_status text,
  add column if not exists transmissao_motivo text,
  add column if not exists transmissao_mensagem text;

do $$ begin
  alter table public.propostas
    add constraint propostas_transmissao_status_chk
    check (transmissao_status is null or transmissao_status in ('processando','transmitida','falha'));
exception when duplicate_object then null; end $$;

-- ---------- T.3: RPC de resultado da transmissão ----------
-- Chamada pelo webhook da Onda 2 com a service_role key — nunca pelo
-- cliente autenticado do vendedor. Idempotente: só reprocessa tentativas
-- com status='enviada' (webhook duplicado não reprocessa nem duplica).
create or replace function public.registrar_resultado_transmissao_quiver(
  p_tentativa_id uuid,
  p_transmitido boolean,
  p_motivo text default null,
  p_mensagem text default null,
  p_numero_cotacao text default null,
  p_capturado_em timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tent record;
  _cot record;
  _prop_id uuid;
begin
  select * into _tent from public.cotacao_transmissoes where id = p_tentativa_id;
  if not found then
    raise exception 'Tentativa de transmissão não encontrada: %', p_tentativa_id;
  end if;

  -- Idempotência: tentativa já processada (webhook duplicado) — não reprocessa.
  if _tent.status <> 'enviada' then
    return;
  end if;

  update public.cotacao_transmissoes
     set status = case when p_transmitido then 'transmitida' else 'falha' end,
         motivo = p_motivo,
         mensagem = p_mensagem,
         numero_cotacao_portal = coalesce(p_numero_cotacao, numero_cotacao_portal),
         capturado_em = p_capturado_em
   where id = p_tentativa_id;

  select c.id, c.empresa_id, c.lead_id, c.responsavel_id, c.numero
    into _cot from public.cotacoes c where c.id = _tent.cotacao_id;

  if p_transmitido then
    insert into public.propostas (
      empresa_id, cotacao_id, lead_id, responsavel_id,
      numero, status, seguradora, premio, valor, forma_pagamento,
      transmissao_status, transmitida_em, atualizado_em
    ) values (
      _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
      'PRP-'||lpad(_cot.numero::text,5,'0'),
      'transmitida', _tent.seguradora, _tent.premio, _tent.premio, _tent.forma_pagamento,
      'transmitida', p_capturado_em, now()
    )
    on conflict (cotacao_id) where cotacao_id is not null do update
       set seguradora = excluded.seguradora,
           premio = excluded.premio,
           valor = excluded.valor,
           forma_pagamento = excluded.forma_pagamento,
           status = 'transmitida',
           transmissao_status = 'transmitida',
           transmissao_motivo = null,
           transmissao_mensagem = null,
           transmitida_em = p_capturado_em,
           atualizado_em = now()
     returning id into _prop_id;
  else
    insert into public.propostas (
      empresa_id, cotacao_id, lead_id, responsavel_id,
      numero, status, seguradora,
      transmissao_status, transmissao_motivo, transmissao_mensagem, atualizado_em
    ) values (
      _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
      'PRP-'||lpad(_cot.numero::text,5,'0'),
      'gerada', _tent.seguradora,
      'falha', p_motivo, p_mensagem, now()
    )
    on conflict (cotacao_id) where cotacao_id is not null do update
       set status = case when public.propostas.status='transmitida' then public.propostas.status else 'gerada' end,
           transmissao_status = 'falha',
           transmissao_motivo = p_motivo,
           transmissao_mensagem = p_mensagem,
           atualizado_em = now()
     returning id into _prop_id;
  end if;

  update public.cotacao_transmissoes set proposta_id = _prop_id where id = p_tentativa_id;
end;
$$;

revoke all on function public.registrar_resultado_transmissao_quiver(uuid, boolean, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.registrar_resultado_transmissao_quiver(uuid, boolean, text, text, text, timestamptz)
  to service_role;
