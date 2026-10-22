-- Progresso real do cálculo da cotação: última etapa por cotação (1 linha).
-- Escrita só via RPC registrar_calculo_etapa (service_role); leitura herda cot_select.

create table if not exists public.cotacao_calculo_progresso (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  etapa text not null,
  seq smallint not null,
  erro text,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ccp_etapa_chk check (etapa in ('na_fila','login','veiculo','segurado',
    'seguradoras','calculando','lendo_resultados','concluido','erro')),
  constraint ccp_seq_chk check (seq between 0 and 9),
  constraint ccp_erro_len_chk check (erro is null or char_length(erro) <= 500)
);

alter table public.cotacao_calculo_progresso enable row level security;

drop policy if exists ccp_select on public.cotacao_calculo_progresso;
create policy ccp_select on public.cotacao_calculo_progresso for select to authenticated
using (exists (select 1 from public.cotacoes c where c.id = cotacao_id));

revoke all on public.cotacao_calculo_progresso from public, anon, authenticated;
grant select on public.cotacao_calculo_progresso to authenticated;
grant all on public.cotacao_calculo_progresso to service_role;

create or replace function public.registrar_calculo_etapa(
  p_cotacao_id uuid, p_etapa text, p_seq smallint, p_erro text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_reinicio boolean := (p_seq = 0 and p_etapa = 'na_fila');
  v_n int;
begin
  insert into public.cotacao_calculo_progresso as t (cotacao_id, etapa, seq, erro)
  values (p_cotacao_id, p_etapa, p_seq, p_erro)
  on conflict (cotacao_id) do update
    set etapa = excluded.etapa,
        seq = excluded.seq,
        erro = excluded.erro,
        atualizado_em = now(),
        iniciado_em = case when v_reinicio then now() else t.iniciado_em end
    where v_reinicio
       or (t.etapa not in ('concluido','erro') and excluded.seq >= t.seq);
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.registrar_calculo_etapa(uuid, text, smallint, text)
  from public, anon, authenticated;
grant execute on function public.registrar_calculo_etapa(uuid, text, smallint, text) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'cotacao_calculo_progresso') then
    alter publication supabase_realtime add table public.cotacao_calculo_progresso;
  end if;
end $$;
