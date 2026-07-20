-- ============================================================
-- G7.1: Negociação de propostas (status separado + histórico de versões)
-- ============================================================
-- IMPORTANTE: `propostas.status` continua sendo o ciclo de transmissão
-- ('gerada' | 'transmitida' | 'cancelada') e NÃO é alterado aqui.
-- `negociacao_status` é um campo NOVO e independente, controlado só
-- pela RPC registrar_versao_proposta (e futuras RPCs de
-- aceitar/recusar negociação).

-- ---------- propostas: campos de negociação ----------
alter table public.propostas
  add column if not exists negociacao_status text not null default 'aguardando',
  add column if not exists prazo_resposta date null;

comment on column public.propostas.negociacao_status is
  'Status da negociação (independente de status de transmissão): aguardando | em_negociacao | aceita | recusada.';
comment on column public.propostas.prazo_resposta is
  'Data limite para resposta do cliente na negociação em andamento.';

do $$
begin
  alter table public.propostas
    add constraint propostas_negociacao_status_chk
    check (negociacao_status in ('aguardando','em_negociacao','aceita','recusada'));
exception when duplicate_object then null;
end $$;

-- ---------- proposta_versoes: histórico de cada versão negociada ----------
create table if not exists public.proposta_versoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  versao int not null,
  premio numeric(14,2),
  forma_pagamento text,
  parcelas int,
  nota text not null check (char_length(nota) > 0 and char_length(nota) <= 1000),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (proposta_id, versao)
);

do $$
begin
  alter table public.proposta_versoes
    add constraint proposta_versoes_parcelas_chk
    check (parcelas is null or (parcelas between 1 and 99));
exception when duplicate_object then null;
end $$;

create index if not exists proposta_versoes_prop_idx on public.proposta_versoes(proposta_id, versao desc);

alter table public.proposta_versoes enable row level security;

-- Mesma visibilidade de prop_select (leitura) e prop_iud (escrita) da proposta pai.
drop policy if exists propv_select on public.proposta_versoes;
create policy propv_select on public.proposta_versoes for select to authenticated using (
  exists (
    select 1 from public.propostas p
    where p.id = proposta_versoes.proposta_id
      and (
        p.responsavel_id = auth.uid()
        or p.empresa_id in (select empresa_id from public.profiles where id = auth.uid())
        or public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')
      )
  )
);

drop policy if exists propv_iud on public.proposta_versoes;
create policy propv_iud on public.proposta_versoes for all to authenticated
  using (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_versoes.proposta_id
        and (p.responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz'))
    )
  )
  with check (
    exists (
      select 1 from public.propostas p
      where p.id = proposta_versoes.proposta_id
        and (p.responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz'))
    )
  );

grant select, insert, update, delete on public.proposta_versoes to authenticated;

-- ---------- RPC: registrar_versao_proposta ----------
create or replace function public.registrar_versao_proposta(
  p_proposta_id uuid,
  p_premio numeric,
  p_forma_pagamento text,
  p_parcelas int,
  p_nota text
)
returns table (id uuid, versao int)
language plpgsql
security definer
set search_path = public
as $$
declare
  _prop record;
  _versao int;
  _id uuid;
begin
  select p.id, p.responsavel_id into _prop
  from public.propostas p
  where p.id = p_proposta_id;

  if not found then
    raise exception 'Proposta não encontrada';
  end if;

  if not (_prop.responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz')) then
    raise exception 'Não autorizado a negociar esta proposta';
  end if;

  -- Evita corrida no número de versão para a mesma proposta.
  perform pg_advisory_xact_lock(hashtext(p_proposta_id::text));

  select coalesce(max(pv.versao), 0) + 1 into _versao
  from public.proposta_versoes pv
  where pv.proposta_id = p_proposta_id;

  insert into public.proposta_versoes
    (proposta_id, versao, premio, forma_pagamento, parcelas, nota, criado_por)
  values
    (p_proposta_id, _versao, p_premio, p_forma_pagamento, p_parcelas, p_nota, auth.uid())
  returning proposta_versoes.id into _id;

  update public.propostas
     set negociacao_status = 'em_negociacao',
         premio = coalesce(p_premio, premio),
         forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento),
         atualizado_em = now()
   where propostas.id = p_proposta_id;

  return query select _id, _versao;
end $$;

revoke execute on function public.registrar_versao_proposta(uuid, numeric, text, int, text) from public, anon;
grant execute on function public.registrar_versao_proposta(uuid, numeric, text, int, text) to authenticated;
