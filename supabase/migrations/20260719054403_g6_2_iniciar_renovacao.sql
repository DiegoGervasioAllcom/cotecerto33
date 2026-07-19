-- ===========================================================================
-- 051 (G6.2) — iniciar_renovacao: cria manualmente o lead de renovação de UMA
-- apólice (versão por-apólice do passo "criar" do cron criar_leads_renovacao).
--
-- Por que RPC security definer (e não insert client-side): o botão "Iniciar
-- renovação" insere um lead SEM empresa_id/responsavel_id para o trigger
-- trg_distribuir_lead_auto distribuir. Esse trigger (BEFORE INSERT) escolhe uma
-- franquia da rede inteira; a policy leads_insert exige, para não-matriz, que a
-- empresa resultante esteja em empresas_visiveis(auth.uid()). Um master (que vê
-- a tela de Renovações) só enxerga a própria subárvore, então o insert direto
-- falharia por RLS quando o distribuidor sorteasse uma franquia fora dela.
-- A função security definer bypassa a RLS de escrita de leads (owner), com um
-- gate próprio de permissão. Decisão do usuário: distribuição padrão (não vai
-- ao vendedor original).
-- ===========================================================================

create or replace function public.iniciar_renovacao(p_proposta_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_prop   record;
  v_origem record;
  v_lead_id uuid;
begin
  select id, lead_id, cotacao_id, vencimento, cancelada_em, empresa_id
    into v_prop
    from public.propostas
   where id = p_proposta_id;
  if not found then
    raise exception 'proposta não encontrada';
  end if;

  -- Gate: só a Matriz ou quem enxerga a empresa da apólice (rede visível).
  if not (
    public.has_role(auth.uid(), 'matriz')
    or v_prop.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  ) then
    raise exception 'permissão negada para iniciar renovação desta apólice';
  end if;

  if v_prop.cancelada_em is not null then
    raise exception 'apólice cancelada — não pode ser renovada';
  end if;

  -- Dados do lead de origem (cliente/nome/contato/dados).
  if v_prop.lead_id is not null then
    select cliente_id, nome, contato, dados into v_origem
      from public.leads where id = v_prop.lead_id;
  elsif v_prop.cotacao_id is not null then
    select l.cliente_id, l.nome, l.contato, l.dados into v_origem
      from public.cotacoes c
      join public.leads l on l.id = c.lead_id
     where c.id = v_prop.cotacao_id;
  end if;

  -- Cria o lead de renovação; on conflict (dedup pelo índice único parcial da
  -- G6.1) trata a corrida com o cron — devolve o lead já existente.
  insert into public.leads (
    cliente_id, origem, nome, contato, status_pipeline, dados, renovacao_proposta_id
  ) values (
    v_origem.cliente_id, 'renovacao', coalesce(v_origem.nome, ''), v_origem.contato,
    'novo', coalesce(v_origem.dados, '{}'::jsonb), p_proposta_id
  )
  on conflict (renovacao_proposta_id) where renovacao_proposta_id is not null do nothing
  returning id into v_lead_id;

  if v_lead_id is null then
    select id into v_lead_id
      from public.leads where renovacao_proposta_id = p_proposta_id;
  end if;

  return v_lead_id;
end;
$$;

revoke all on function public.iniciar_renovacao(uuid) from public, anon;
grant execute on function public.iniciar_renovacao(uuid) to authenticated;

comment on function public.iniciar_renovacao(uuid) is
  'G6.2: cria manualmente o lead de renovação de uma apólice (distribuição
   padrão via trigger). Gate: matriz ou rede visível. Idempotente (dedup pelo
   índice único de renovacao_proposta_id). Security definer para não esbarrar
   na RLS de insert de leads (o distribuidor pode alocar fora da subárvore do
   solicitante).';
