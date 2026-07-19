-- ===========================================================================
-- G3.2 — RPCs do fluxo de desconto adicional multinível
--
-- PR1 (20260718235007) criou o schema (desconto_politicas/solicitacoes/
-- trilha/respostas_padrao) com escrita fechada em solicitacoes/trilha — só
-- via RPC security definer. Este PR2 entrega:
--
--   1) fn_pode_ver_solicitacao_desconto — substitui o vazamento lateral
--      (empresas_visiveis) da policy de SELECT do PR1 por checagem real de
--      cadeia (ancestral via superior_id) ou solicitante/matriz.
--   2) fn_modelo_alcada_desconto — deriva o "modelo" (mesmo enum de
--      desconto_politicas.modelo) do aprovador a partir do role + modalidade
--      da franquia (mesma derivação do G1.5/G4).
--   3) fn_dentro_alcada_desconto — checa se um pct está dentro da alçada.
--   4) _aplicar_desconto_premio — aplica pct_concedido no prêmio selecionado
--      da cotação (e na proposta gerada, se existir).
--   5) As 7 RPCs do fluxo: solicitar/aprovar/contrapropor/aceitar/negar/
--      escalar/cancelar.
--
-- Cadeia: nivel_atual (profiles.id) é sempre um ANCESTRAL do solicitante na
-- hierarquia real (profiles.superior_id). NULL em nivel_atual é usado como
-- sentinela de "está na Matriz agora" (mesmo significado de superior_id NULL
-- = topo da cadeia, G1.1) — assim várias contas com role matriz podem agir
-- sobre o mesmo pedido sem precisar apontar pra uma pessoa específica.
--
-- Alçada: só quem está em nivel_atual (ou matriz) pode aprovar/contrapropor/
-- negar/escalar. Matriz nunca tem limite de alçada. Demais: só podem aprovar/
-- contrapropor se existir linha em desconto_politicas para (modelo do
-- aprovador, seguradora do pedido) E o pct estiver dentro do pct_maximo —
-- senão têm que escalar.
--
-- Interação G3 <-> G4 (documentar): a aplicação do desconto atualiza
-- propostas.premio/comissao_valor quando já existe proposta gerada para a
-- cotação. O trigger trg_sync_comissao_lancamento (G4.2, 038/050) dispara em
-- "update of pago_em, cancelada_em, comissao_valor", mas só INSERE um novo
-- lançamento de crédito quando pago_em MUDA de valor (old.pago_em is
-- distinct from new.pago_em) — e o índice único
-- (proposta_id, tipo, beneficiario_id) tem "on conflict do nothing", sem
-- atualizar o valor de um lançamento já existente. Ou seja: se o desconto é
-- negociado ANTES da proposta ser marcada como paga (fluxo normal — desconto
-- negocia-se durante a cotação/proposta, antes da emissão/pagamento), o novo
-- comissao_valor já correto é usado quando o trigger eventualmente inserir o
-- crédito no pago_em. Se o desconto for aplicado DEPOIS de já paga, o
-- trigger dispara mas não re-sincroniza o lançamento já gravado (não
-- retroage) — comportamento herdado do G4.2, fora do escopo deste PR corrigir.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0) BUGFIX pré-existente (009_venda_real, fora do escopo original do G3, mas
--    bloqueia o teste/uso real do fluxo de desconto): o trigger
--    _gerar_proposta_de_premio faz "on conflict (cotacao_id) do update", mas o
--    índice único é PARCIAL (propostas_cotacao_uq ... where cotacao_id is not
--    null) — Postgres exige repetir o predicado no ON CONFLICT pra inferir o
--    índice parcial, senão erro 42P10 ("no unique or exclusion constraint
--    matching the ON CONFLICT specification"). Sem essa correção, marcar um
--    cotacao_premios como selecionada=true nunca gera/atualiza a proposta —
--    bug real de produção, não só dos testes deste PR.
-- ---------------------------------------------------------------------------
create or replace function public._gerar_proposta_de_premio()
returns trigger language plpgsql security definer set search_path=public as $$
declare _cot record;
begin
  if new.selecionada is not true then
    return new;
  end if;
  -- desmarca outros prêmios da mesma cotação
  update public.cotacao_premios
     set selecionada = false
   where cotacao_id = new.cotacao_id and id <> new.id;

  select c.id, c.empresa_id, c.lead_id, c.responsavel_id, c.numero
    into _cot from public.cotacoes c where c.id = new.cotacao_id;

  insert into public.propostas (
    empresa_id, cotacao_id, lead_id, responsavel_id,
    numero, status, seguradora, premio, valor, atualizado_em
  ) values (
    _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
    'PRP-'||lpad(_cot.numero::text,5,'0'),
    'gerada', new.seguradora, new.premio, new.premio, now()
  )
  on conflict (cotacao_id) where cotacao_id is not null do update
     set seguradora = excluded.seguradora,
         premio = excluded.premio,
         valor = excluded.valor,
         status = case when public.propostas.status='transmitida' then public.propostas.status else 'gerada' end,
         atualizado_em = now();

  update public.cotacoes set status='proposta', atualizado_em=now()
   where id=_cot.id and status in ('rascunho','calculada');

  return new;
end $$;

comment on function public._gerar_proposta_de_premio() is
  'G3.2 bugfix: ON CONFLICT agora repete o predicado do índice parcial
   propostas_cotacao_uq (where cotacao_id is not null) — sem isso o Postgres
   rejeitava o insert com 42P10 e nenhuma proposta era gerada/atualizada ao
   marcar um prêmio como selecionado. Corpo idêntico ao original (009), só a
   cláusula ON CONFLICT muda.';

-- ---------------------------------------------------------------------------
-- 1) fn_pode_ver_solicitacao_desconto — reaperta a visão lateral do PR1.
-- ---------------------------------------------------------------------------
create or replace function public.fn_pode_ver_solicitacao_desconto(p_solicitante uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    return false;
  end if;

  if _uid = p_solicitante then
    return true;
  end if;

  if public.has_role(_uid, 'matriz') then
    return true;
  end if;

  -- Ancestral: auth.uid() está na cadeia acima do solicitante (superior_id)?
  return exists (
    with recursive cadeia as (
      select p.id, p.superior_id
        from public.profiles p
       where p.id = p_solicitante
      union all
      select pr.id, pr.superior_id
        from public.profiles pr
        join cadeia c on pr.id = c.superior_id
    ) cycle id set is_cycle using path
    select 1 from cadeia where id = _uid
  );
end;
$$;

comment on function public.fn_pode_ver_solicitacao_desconto(uuid) is
  'G3.2: true se auth.uid() é o próprio solicitante, é matriz, ou está na
   cadeia ACIMA do solicitante (ancestral via profiles.superior_id). Substitui
   a visão lateral (empresas_visiveis) do PR1 nas policies de SELECT de
   desconto_solicitacoes/desconto_trilha — um colega da mesma empresa sem
   relação hierárquica não vê o pedido.';

revoke all on function public.fn_pode_ver_solicitacao_desconto(uuid) from public, anon;
grant execute on function public.fn_pode_ver_solicitacao_desconto(uuid) to authenticated;

-- Reescreve as policies de SELECT do PR1 para usar a função em vez da visão
-- lateral por empresas_visiveis.
drop policy if exists desconto_solicitacoes_select on public.desconto_solicitacoes;
create policy desconto_solicitacoes_select
  on public.desconto_solicitacoes
  for select
  to authenticated
  using (
    nivel_atual = auth.uid()
    or public.fn_pode_ver_solicitacao_desconto(solicitante_id)
  );

comment on policy desconto_solicitacoes_select on public.desconto_solicitacoes is
  'G3.2: nivel_atual (a quem o pedido está pendente agora) sempre vê; demais
   visibilidade via fn_pode_ver_solicitacao_desconto (solicitante, ancestral
   na hierarquia real, ou matriz) — substitui o vazamento lateral do PR1.';

drop policy if exists desconto_trilha_select on public.desconto_trilha;
create policy desconto_trilha_select
  on public.desconto_trilha
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.desconto_solicitacoes s
       where s.id = desconto_trilha.solicitacao_id
         and (
           s.nivel_atual = auth.uid()
           or public.fn_pode_ver_solicitacao_desconto(s.solicitante_id)
         )
    )
  );

comment on policy desconto_trilha_select on public.desconto_trilha is
  'G3.2: mesma regra de visibilidade da solicitação-pai (via
   fn_pode_ver_solicitacao_desconto), sem o vazamento lateral do PR1.';

-- ---------------------------------------------------------------------------
-- 2) fn_modelo_alcada_desconto — deriva o modelo do aprovador (mesma
--    derivação do G1.5/G4: master -> 'master'; supervisor -> 'supervisor';
--    franqueado full/individual -> 'franquia_full'/'franquia_individual').
-- ---------------------------------------------------------------------------
create or replace function public.fn_modelo_alcada_desconto(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _modalidade text;
begin
  if public.has_role(p_profile_id, 'master') then
    return 'master';
  elsif public.has_role(p_profile_id, 'supervisor') then
    return 'supervisor';
  elsif public.has_role(p_profile_id, 'franqueado') then
    select mf.modalidade into _modalidade
      from public.profiles p
      join public.empresas e on e.id = p.empresa_id
      join public.modelos_franquia mf on mf.id = e.modelo_id
     where p.id = p_profile_id;

    if _modalidade = 'full' then
      return 'franquia_full';
    else
      return 'franquia_individual';
    end if;
  else
    return null;
  end if;
end;
$$;

comment on function public.fn_modelo_alcada_desconto(uuid) is
  'G3.2: modelo de rede do aprovador para checagem de alçada em
   desconto_politicas — mesma derivação do G1.5/G4 (role + modalidade da
   franquia). NULL para vendedor/matriz (matriz não usa alçada; vendedor
   nunca é nivel_atual de um pedido próprio).';

revoke all on function public.fn_modelo_alcada_desconto(uuid) from public, anon;
grant execute on function public.fn_modelo_alcada_desconto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) fn_dentro_alcada_desconto — matriz sem limite; demais exigem linha em
--    desconto_politicas para (modelo, seguradora) com pct <= pct_maximo.
-- ---------------------------------------------------------------------------
create or replace function public.fn_dentro_alcada_desconto(
  p_aprovador uuid,
  p_seguradora uuid,
  p_pct numeric
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _modelo text;
  _max numeric;
begin
  if public.has_role(p_aprovador, 'matriz') then
    return true;
  end if;

  _modelo := public.fn_modelo_alcada_desconto(p_aprovador);
  if _modelo is null then
    return false;
  end if;

  select pct_maximo into _max
    from public.desconto_politicas
   where modelo = _modelo and seguradora_id = p_seguradora;

  if _max is null then
    return false; -- sem política configurada -> escala pra Matriz.
  end if;

  return p_pct <= _max;
end;
$$;

comment on function public.fn_dentro_alcada_desconto(uuid, uuid, numeric) is
  'G3.2: true se p_aprovador pode conceder p_pct para p_seguradora (matriz
   sempre true; demais precisam de desconto_politicas(modelo,seguradora) com
   pct_maximo >= p_pct — ausência de política = fora da alçada, escalar).';

revoke all on function public.fn_dentro_alcada_desconto(uuid, uuid, numeric) from public, anon;
grant execute on function public.fn_dentro_alcada_desconto(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) _aplicar_desconto_premio — reduz o prêmio selecionado da cotação (e a
--    proposta gerada, se existir) pelo pct concedido.
-- ---------------------------------------------------------------------------
create or replace function public._aplicar_desconto_premio(
  p_cotacao_id uuid,
  p_seguradora_id uuid,
  p_pct numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _seg_nome text;
  _n        integer;
begin
  select nome into _seg_nome from public.seguradoras where id = p_seguradora_id;

  update public.cotacao_premios
     set premio = round(premio * (1 - p_pct / 100.0), 2)
   where cotacao_id = p_cotacao_id
     and selecionada = true
     and seguradora = _seg_nome;

  -- Falha ALTA (não silenciosa): se nenhum prêmio selecionado casou com a
  -- seguradora do pedido, o desconto não foi aplicado a lugar nenhum — abortar
  -- a aprovação em vez de gravar 'aprovado' sem efeito no dinheiro.
  get diagnostics _n = row_count;
  if _n = 0 then
    raise exception 'sem prêmio selecionado para a seguradora % na cotação % — desconto não aplicado', _seg_nome, p_cotacao_id;
  end if;

  -- cotacao_premios.seguradora / propostas.seguradora são texto (nome), sem
  -- FK normalizada pra seguradoras — casa pelo nome (mesmo padrão do resto
  -- do fluxo de venda, 009_venda_real).
  update public.propostas
     set premio = round(premio * (1 - p_pct / 100.0), 2),
         comissao_valor = case
           when comissao_pct is not null
             then round(premio * (1 - p_pct / 100.0) * comissao_pct / 100.0, 2)
           else comissao_valor
         end,
         atualizado_em = now()
   where cotacao_id = p_cotacao_id
     and seguradora = _seg_nome;
end;
$$;

comment on function public._aplicar_desconto_premio(uuid, uuid, numeric) is
  'G3.2: aplica pct_concedido no cotacao_premios selecionado e, se existir,
   na proposta gerada da cotação (recalcula comissao_valor quando
   comissao_pct estiver preenchido). Ver nota de interação G3<->G4 no topo
   do arquivo sobre o trigger de sincronização do ledger (G4.2).';

revoke all on function public._aplicar_desconto_premio(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public._aplicar_desconto_premio(uuid, uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- 5) RPCs do fluxo.
-- ---------------------------------------------------------------------------

-- 5.1 solicitar_desconto
create or replace function public.solicitar_desconto(
  p_cotacao_id uuid,
  p_seguradora_id uuid,
  p_pct_pedido numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _nivel uuid;
  _id uuid;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;

  -- nivel_atual inicial = superior do solicitante; NULL (topo) = Matriz.
  select superior_id into _nivel from public.profiles where id = _uid;

  insert into public.desconto_solicitacoes
    (cotacao_id, solicitante_id, nivel_atual, seguradora_id, pct_pedido, status)
  values
    (p_cotacao_id, _uid, _nivel, p_seguradora_id, p_pct_pedido, 'pendente')
  returning id into _id;

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao, pct)
  values (_id, _uid, 'solicitou', p_pct_pedido);

  return _id;
end;
$$;

comment on function public.solicitar_desconto(uuid, uuid, numeric) is
  'G3.2: abre um pedido de desconto adicional. solicitante = auth.uid() (não
   spoofável); nivel_atual = superior_id do solicitante (NULL = já nasce na
   Matriz, quando o solicitante é topo de cadeia).';

revoke all on function public.solicitar_desconto(uuid, uuid, numeric) from public, anon;
grant execute on function public.solicitar_desconto(uuid, uuid, numeric) to authenticated;

-- 5.2 aprovar_desconto
create or replace function public.aprovar_desconto(
  p_id uuid,
  p_pct_concedido numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.status <> 'pendente' then
    raise exception 'solicitação não está pendente';
  end if;
  if not (
    (_s.nivel_atual is not null and _s.nivel_atual = _uid)
    or public.has_role(_uid, 'matriz')
  ) then
    raise exception 'sem permissão para aprovar este pedido';
  end if;

  if not public.has_role(_uid, 'matriz')
     and not public.fn_dentro_alcada_desconto(_uid, _s.seguradora_id, p_pct_concedido) then
    raise exception 'acima da alçada — use escalar';
  end if;

  update public.desconto_solicitacoes
     set status = 'aprovado',
         pct_concedido = p_pct_concedido,
         resolvido_em = now()
   where id = p_id;

  perform public._aplicar_desconto_premio(_s.cotacao_id, _s.seguradora_id, p_pct_concedido);

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao, pct)
  values (p_id, _uid, 'aprovou', p_pct_concedido);
end;
$$;

comment on function public.aprovar_desconto(uuid, numeric) is
  'G3.2: só nivel_atual (não-NULL) ou matriz aprovam; fora da alçada exige
   escalar. Ao aprovar, aplica o pct no prêmio (e na proposta) de imediato.';

revoke all on function public.aprovar_desconto(uuid, numeric) from public, anon;
grant execute on function public.aprovar_desconto(uuid, numeric) to authenticated;

-- 5.3 contrapropor_desconto
create or replace function public.contrapropor_desconto(
  p_id uuid,
  p_pct_novo numeric,
  p_obs text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.status <> 'pendente' then
    raise exception 'solicitação não está pendente';
  end if;
  if not (
    (_s.nivel_atual is not null and _s.nivel_atual = _uid)
    or public.has_role(_uid, 'matriz')
  ) then
    raise exception 'sem permissão para contrapropor neste pedido';
  end if;

  if not public.has_role(_uid, 'matriz')
     and not public.fn_dentro_alcada_desconto(_uid, _s.seguradora_id, p_pct_novo) then
    raise exception 'acima da alçada — use escalar';
  end if;

  update public.desconto_solicitacoes
     set status = 'aguardando_aceite',
         pct_concedido = p_pct_novo
   where id = p_id;

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao, pct, observacao)
  values (p_id, _uid, 'contrapropos', p_pct_novo, p_obs);
end;
$$;

comment on function public.contrapropor_desconto(uuid, numeric, text) is
  'G3.2: registra contraproposta (dentro da alçada do aprovador) e devolve ao
   solicitante para aceitar/cancelar — NÃO aplica no prêmio ainda.';

revoke all on function public.contrapropor_desconto(uuid, numeric, text) from public, anon;
grant execute on function public.contrapropor_desconto(uuid, numeric, text) to authenticated;

-- 5.4 aceitar_desconto
create or replace function public.aceitar_desconto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.solicitante_id <> _uid then
    raise exception 'apenas o solicitante pode aceitar';
  end if;
  if _s.status <> 'aguardando_aceite' then
    raise exception 'solicitação não está aguardando aceite';
  end if;

  update public.desconto_solicitacoes
     set status = 'aprovado',
         resolvido_em = now()
   where id = p_id;

  perform public._aplicar_desconto_premio(_s.cotacao_id, _s.seguradora_id, _s.pct_concedido);

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao, pct)
  values (p_id, _uid, 'aceitou', _s.pct_concedido);
end;
$$;

comment on function public.aceitar_desconto(uuid) is
  'G3.2: só o solicitante aceita uma contraproposta (status aguardando_aceite)
   — aplica o pct_concedido no prêmio nesse momento.';

revoke all on function public.aceitar_desconto(uuid) from public, anon;
grant execute on function public.aceitar_desconto(uuid) to authenticated;

-- 5.5 negar_desconto
create or replace function public.negar_desconto(p_id uuid, p_obs text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.status <> 'pendente' then
    raise exception 'solicitação não está pendente';
  end if;
  if not (
    (_s.nivel_atual is not null and _s.nivel_atual = _uid)
    or public.has_role(_uid, 'matriz')
  ) then
    raise exception 'sem permissão para negar este pedido';
  end if;

  update public.desconto_solicitacoes
     set status = 'negado',
         resolvido_em = now()
   where id = p_id;

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao, observacao)
  values (p_id, _uid, 'negou', p_obs);
end;
$$;

comment on function public.negar_desconto(uuid, text) is
  'G3.2: encerra o pedido (status negado) — o solicitante pode abrir um novo
   pedido depois (nova chamada de solicitar_desconto).';

revoke all on function public.negar_desconto(uuid, text) from public, anon;
grant execute on function public.negar_desconto(uuid, text) to authenticated;

-- 5.6 escalar_desconto
create or replace function public.escalar_desconto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
  _novo_nivel uuid;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.status <> 'pendente' then
    raise exception 'solicitação não está pendente';
  end if;
  if not (
    (_s.nivel_atual is not null and _s.nivel_atual = _uid)
    or public.has_role(_uid, 'matriz')
  ) then
    raise exception 'sem permissão para escalar este pedido';
  end if;
  if _s.nivel_atual is null then
    raise exception 'não há nível acima da Matriz';
  end if;

  select superior_id into _novo_nivel from public.profiles where id = _s.nivel_atual;

  update public.desconto_solicitacoes
     set nivel_atual = _novo_nivel
   where id = p_id;

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao)
  values (p_id, _uid, 'escalou');
end;
$$;

comment on function public.escalar_desconto(uuid) is
  'G3.2: sobe nivel_atual para o superior do nível atual (NULL = Matriz).
   Escalar quando já está na Matriz (nivel_atual NULL) é barrado.';

revoke all on function public.escalar_desconto(uuid) from public, anon;
grant execute on function public.escalar_desconto(uuid) to authenticated;

-- 5.7 cancelar_desconto
create or replace function public.cancelar_desconto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s public.desconto_solicitacoes%rowtype;
begin
  select * into _s from public.desconto_solicitacoes where id = p_id for update;
  if not found then
    raise exception 'solicitação não encontrada';
  end if;
  if _s.solicitante_id <> _uid then
    raise exception 'apenas o solicitante pode cancelar';
  end if;
  if _s.status not in ('pendente', 'aguardando_aceite') then
    raise exception 'solicitação não pode mais ser cancelada';
  end if;

  update public.desconto_solicitacoes
     set status = 'cancelado',
         resolvido_em = now()
   where id = p_id;

  insert into public.desconto_trilha (solicitacao_id, autor_id, acao)
  values (p_id, _uid, 'cancelou');
end;
$$;

comment on function public.cancelar_desconto(uuid) is
  'G3.2: só o solicitante cancela um pedido pendente ou aguardando aceite.';

revoke all on function public.cancelar_desconto(uuid) from public, anon;
grant execute on function public.cancelar_desconto(uuid) to authenticated;
