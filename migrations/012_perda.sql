-- ============================================================
-- 012: Classificar Perda — motivos, sub-motivos, RPC
-- ============================================================

-- Motivos
create table if not exists public.perda_motivos (
  id serial primary key,
  nome text not null unique,
  ordem int not null default 0,
  ativo boolean not null default true
);
grant select on public.perda_motivos to authenticated;
grant all on public.perda_motivos to service_role;
alter table public.perda_motivos enable row level security;
drop policy if exists perda_motivos_sel on public.perda_motivos;
create policy perda_motivos_sel on public.perda_motivos for select to authenticated using (true);

-- Sub-motivos
create table if not exists public.perda_submotivos (
  id serial primary key,
  motivo_id int not null references public.perda_motivos(id) on delete cascade,
  nome text not null,
  destino_sugerido text not null check (destino_sugerido in ('Remalho','Descarte')),
  ordem int not null default 0,
  ativo boolean not null default true,
  unique(motivo_id, nome)
);
grant select on public.perda_submotivos to authenticated;
grant all on public.perda_submotivos to service_role;
alter table public.perda_submotivos enable row level security;
drop policy if exists perda_submotivos_sel on public.perda_submotivos;
create policy perda_submotivos_sel on public.perda_submotivos for select to authenticated using (true);

-- Colunas em cotações para a classificação de perda
alter table public.cotacoes
  add column if not exists motivo_perda text,
  add column if not exists submotivo_perda text,
  add column if not exists destino_perda_sugerido text,
  add column if not exists destino_perda text default 'Pendente',
  add column if not exists observacao_perda text,
  add column if not exists perdida_em timestamptz;

-- Seed
insert into public.perda_motivos(nome, ordem) values
  ('Preço',1), ('Concorrência',2), ('Sem contato',3),
  ('Momento de compra',4), ('Falta de interesse',5), ('Outros',6)
on conflict (nome) do nothing;

with m as (select id,nome from public.perda_motivos)
insert into public.perda_submotivos(motivo_id, nome, destino_sugerido, ordem)
select m.id, x.nome, x.destino, x.ordem from m join (values
  ('Preço','Preço acima do orçamento / achou caro','Remalho',1),
  ('Preço','Proposta mais barata','Remalho',2),
  ('Preço','Franquia muito alta','Remalho',3),
  ('Concorrência','Renovou com corretor atual','Descarte',1),
  ('Concorrência','Fechou com outro corretor','Descarte',2),
  ('Concorrência','Optou por proteção veicular','Descarte',3),
  ('Sem contato','Telefone inválido','Descarte',1),
  ('Sem contato','Cliente parou de responder','Remalho',2),
  ('Sem contato','Não conseguimos contato','Remalho',3),
  ('Momento de compra','Não comprou o carro / sem veículo','Remalho',1),
  ('Momento de compra','Renovação distante','Remalho',2),
  ('Momento de compra','Vai decidir depois','Remalho',3),
  ('Falta de interesse','Não vê necessidade','Descarte',1),
  ('Falta de interesse','Vai assumir o risco','Descarte',2),
  ('Falta de interesse','Não encaminhou dados','Remalho',3),
  ('Outros','Sem aceitação da seguradora','Descarte',1),
  ('Outros','Restrições cadastrais','Descarte',2),
  ('Outros','Lead duplicado','Descarte',3),
  ('Outros','Não pediu cotação','Descarte',4)
) as x(motivo, nome, destino, ordem) on x.motivo = m.nome
on conflict (motivo_id, nome) do nothing;

-- RPC: classificar perda
create or replace function public.classificar_perda_cotacao(
  p_cotacao_id uuid,
  p_motivo text,
  p_submotivo text,
  p_observacao text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest text;
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select responsavel_id into v_owner from public.cotacoes where id = p_cotacao_id;
  if v_owner is null then raise exception 'cotacao not found'; end if;
  if v_owner <> v_uid and not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;

  select sm.destino_sugerido into v_dest
  from public.perda_submotivos sm
  join public.perda_motivos m on m.id = sm.motivo_id
  where m.nome = p_motivo and sm.nome = p_submotivo;
  if v_dest is null then raise exception 'invalid motivo/submotivo'; end if;

  update public.cotacoes
     set status = 'perdida',
         motivo_perda = p_motivo,
         submotivo_perda = p_submotivo,
         destino_perda_sugerido = v_dest,
         destino_perda = 'Pendente',
         observacao_perda = p_observacao,
         perdida_em = now(),
         atualizado_em = now()
   where id = p_cotacao_id;
end$$;

grant execute on function public.classificar_perda_cotacao(uuid,text,text,text) to authenticated;
