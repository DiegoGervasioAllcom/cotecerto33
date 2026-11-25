-- Progresso em tempo real de UMA tentativa de transmissão (1 linha por tentativa).
-- Escrita só via RPC registrar_transmissao_etapa (service_role); leitura herda cotacoes.
-- ATENÇÃO: a lista de etapas é duplicada em src/lib/transmissao-etapas.ts e em
-- utils/etapa.ts do robô (repo playwright). Alterar nos três lugares.

create table if not exists public.cotacao_transmissao_progresso (
  tentativa_id uuid primary key references public.cotacao_transmissoes(id) on delete cascade,
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  etapa text not null,
  seq int not null,
  erro text,
  atualizado_em timestamptz not null default now(),
  constraint ctp_etapa_chk check (etapa in ('na_fila','entrando_portal','abrindo_painel',
    'localizando_cotacao','escolhendo_seguradora','preenchendo_efetivacao','confirmando',
    'concluido','erro')),
  constraint ctp_seq_chk check (seq between 0 and 20),
  constraint ctp_erro_len_chk check (erro is null or char_length(erro) <= 500),
  constraint ctp_erro_etapa_chk check (erro is null or etapa = 'erro')
);

create index if not exists ctp_cotacao_idx on public.cotacao_transmissao_progresso(cotacao_id);

alter table public.cotacao_transmissao_progresso enable row level security;

drop policy if exists ctp_select on public.cotacao_transmissao_progresso;
create policy ctp_select on public.cotacao_transmissao_progresso for select to authenticated
using (exists (select 1 from public.cotacoes c where c.id = cotacao_id));

revoke all on public.cotacao_transmissao_progresso from public, anon, authenticated;
grant select on public.cotacao_transmissao_progresso to authenticated;
grant all on public.cotacao_transmissao_progresso to service_role;

-- Retorna true se aplicou, false se ignorou (atrasado/duplicado/já terminal).
create or replace function public.registrar_transmissao_etapa(
  p_tentativa_id uuid, p_etapa text, p_seq int default null, p_erro text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_cotacao uuid;
  v_esperado int;
  v_atual public.cotacao_transmissao_progresso%rowtype;
  v_seq int;
begin
  select cotacao_id into v_cotacao from public.cotacao_transmissoes where id = p_tentativa_id;
  if v_cotacao is null then
    raise exception 'tentativa de transmissão inexistente: %', p_tentativa_id
      using errcode = 'P0001';
  end if;

  v_esperado := case p_etapa
    when 'na_fila' then 0 when 'entrando_portal' then 1 when 'abrindo_painel' then 2
    when 'localizando_cotacao' then 3 when 'escolhendo_seguradora' then 4
    when 'preenchendo_efetivacao' then 5 when 'confirmando' then 6
    when 'concluido' then -1 when 'erro' then -1 else null end;
  if v_esperado is null then
    raise exception 'etapa inválida: %', p_etapa using errcode = '23514';
  end if;
  if v_esperado >= 0 and p_seq is distinct from v_esperado then
    raise exception 'seq % não corresponde à etapa %', p_seq, p_etapa using errcode = '23514';
  end if;

  -- serializa avisos concorrentes da mesma tentativa
  perform pg_advisory_xact_lock(hashtextextended(p_tentativa_id::text, 0));
  select * into v_atual from public.cotacao_transmissao_progresso where tentativa_id = p_tentativa_id;

  if found then
    if v_atual.etapa in ('concluido','erro') then return false; end if;
    if v_esperado >= 0 and v_esperado <= v_atual.seq then return false; end if;
  end if;

  v_seq := case when v_esperado >= 0 then v_esperado else coalesce(v_atual.seq, 0) + 1 end;

  insert into public.cotacao_transmissao_progresso as t (tentativa_id, cotacao_id, etapa, seq, erro)
  values (p_tentativa_id, v_cotacao, p_etapa, v_seq,
          case when p_etapa = 'erro' then left(p_erro, 500) end)
  on conflict (tentativa_id) do update
    set etapa = excluded.etapa, seq = excluded.seq, erro = excluded.erro, atualizado_em = now();
  return true;
end $$;

revoke all on function public.registrar_transmissao_etapa(uuid, text, int, text)
  from public, anon, authenticated;
grant execute on function public.registrar_transmissao_etapa(uuid, text, int, text) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'cotacao_transmissao_progresso') then
    alter publication supabase_realtime add table public.cotacao_transmissao_progresso;
  end if;
end $$;
