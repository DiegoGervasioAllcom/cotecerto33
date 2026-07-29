-- ===========================================================================
-- V11.7.3 — quatro funis por canal na Visão geral
--
-- A configuração dos cards pertence à taxonomia única de canais. O front e a
-- RPC não conhecem nomes: leem exibir_funil e respeitam a ordem do catálogo.
-- A coorte é formada pelos leads criados em [p_inicio,p_fim); cada marco é
-- apurado pelas relações e timestamps reais do ciclo comercial.
-- ===========================================================================

alter table public.canais
  add column if not exists exibir_funil boolean not null default false;

comment on column public.canais.exibir_funil is
  'V11.7.3: inclui o canal nos quatro cards de funil da Visão geral. A apresentação usa canais.ordem; nomes podem ser renomeados sem alterar o dashboard.';

-- Configuração canônica inicial do protótipo r40. Zera primeiro para que uma
-- reaplicação converja exatamente aos quatro cards aprovados.
update public.canais
   set exibir_funil = false
 where exibir_funil;

insert into public.canais (nome, tipo, empresa_id, ordem, exibir_funil) values
  ('Movida',   'supper', null, 1, true),
  ('Google',   'supper', null, 2, true),
  ('Facebook', 'supper', null, 3, true),
  ('Manual',   'manual', null, 5, true)
on conflict do nothing;

update public.canais
   set exibir_funil = true
 where empresa_id is null
   and nome in ('Movida', 'Google', 'Facebook', 'Manual');

create index if not exists idx_canais_funil_ordem
  on public.canais (ordem, id)
  where exibir_funil and ativo;

create index if not exists idx_leads_canal_criado_em
  on public.leads (canal_id, criado_em);

create index if not exists idx_propostas_lead_marcos_funil
  on public.propostas (lead_id, transmitida_em, emitida_em)
  where lead_id is not null;

create or replace function public.funis_por_canal_visao_geral(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  canal_id uuid,
  canal_nome text,
  ordem smallint,
  indicacoes bigint,
  contatos bigint,
  cotacoes bigint,
  negociacoes bigint,
  transmissoes bigint,
  pendentes bigint,
  vendas_emitidas bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'nao_autenticado';
  end if;

  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception using
      errcode = '22023',
      message = 'intervalo_invalido',
      hint = 'Informe uma janela valida no formato [inicio, fim).';
  end if;

  return query
  with coorte as (
    select l.id, l.canal_id, l.ultimo_atendimento_em
      from public.leads l
     where l.criado_em >= p_inicio
       and l.criado_em < p_fim
  ),
  marcos as (
    select
      l.id as lead_id,
      l.canal_id,
      (
        l.ultimo_atendimento_em is not null
        or exists (select 1 from public.cotacoes cot where cot.lead_id = l.id)
      ) as teve_contato,
      exists (
        select 1 from public.cotacoes cot where cot.lead_id = l.id
      ) as teve_cotacao,
      exists (
        select 1
          from public.propostas prop
         where prop.lead_id = l.id
           and (
             prop.negociacao_status in ('em_negociacao', 'aceita', 'recusada')
             or exists (
               select 1
                 from public.proposta_versoes pv
                where pv.proposta_id = prop.id
             )
           )
      ) as teve_negociacao,
      exists (
        select 1
          from public.propostas prop
         where prop.lead_id = l.id
           and prop.transmitida_em is not null
      ) as teve_transmissao,
      exists (
        select 1
          from public.propostas prop
         where prop.lead_id = l.id
           and prop.transmitida_em is not null
           and prop.emitida_em is null
           and prop.cancelada_em is null
      ) as esta_pendente,
      exists (
        select 1
          from public.propostas prop
         where prop.lead_id = l.id
           and prop.emitida_em is not null
           and prop.cancelada_em is null
      ) as teve_venda_emitida
    from coorte l
  )
  select
    c.id,
    c.nome,
    c.ordem,
    count(distinct m.lead_id)::bigint,
    count(distinct m.lead_id) filter (where m.teve_contato)::bigint,
    count(distinct m.lead_id) filter (where m.teve_cotacao)::bigint,
    count(distinct m.lead_id) filter (where m.teve_negociacao)::bigint,
    count(distinct m.lead_id) filter (where m.teve_transmissao)::bigint,
    count(distinct m.lead_id) filter (where m.esta_pendente)::bigint,
    count(distinct m.lead_id) filter (where m.teve_venda_emitida)::bigint
  from public.canais c
  left join marcos m on m.canal_id = c.id
  where c.exibir_funil
    and c.ativo
  group by c.id, c.nome, c.ordem
  order by c.ordem, c.id;
end;
$$;

comment on function public.funis_por_canal_visao_geral(timestamptz, timestamptz) is
  'V11.7.3: quatro funis configurados por canais.exibir_funil, agregados por lead da coorte [p_inicio,p_fim), sob RLS do usuário autenticado. Pendentes = transmitidos ainda não emitidos nem cancelados.';

revoke all on function public.funis_por_canal_visao_geral(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.funis_por_canal_visao_geral(timestamptz, timestamptz)
  to authenticated, service_role;
