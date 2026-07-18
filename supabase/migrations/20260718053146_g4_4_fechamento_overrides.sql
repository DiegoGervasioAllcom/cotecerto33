-- ===========================================================================
-- 050 (G4.4) — RPC de fechamento de competência: overrides master/supervisor,
-- ajuste CLT, royalties como débito automático + fix de policy (pendência S1).
--
-- ATENÇÃO: esta migration GRAVA dinheiro no ledger (comissao_lancamentos).
-- Toda a lógica roda dentro de UMA função plpgsql (transação atômica).
--
-- ---------------------------------------------------------------------------
-- DECISÕES (usuário, ver prompt) — resumo para quem ler o código no futuro:
--
-- Base do override (20% master / %supervisor) = comissão LÍQUIDA DA REDE
-- (créditos - débitos, onde débitos incluem estornos e os débitos de
-- royalties lançados nesta mesma função) na competência, SEM incluir o
-- próprio beneficiário do override (evita duplicar: a operação própria do
-- master/supervisor já foi creditada a 100% pelo trigger `_sync_comissao_
-- lancamento`).
--
-- Royalties: `empresas.royalties_fpp` (master) e `profiles.royalties`
-- (supervisor) são valores fixos configurados na classificação (G1.4). Não
-- existe royalties por franquia no schema hoje — lançamos royalties como
-- DÉBITO automático no ledger do PRÓPRIO master/supervisor (não entra na
-- base do próprio override, pois a base exclui o beneficiário; mas reduz a
-- base de quem está ACIMA dele na hierarquia, já que débitos de rede contam).
--
-- Anti-dupla-contagem (o trigger 048 já credita por proposta paga):
--   - franquia individual/full: já credita no % efetivo -> NENHUM ajuste.
--   - vendedor CLT: ajuste = fn_comissao_clt(...).valor_final - Σ(créditos
--     por proposta do vendedor na competência, origem='auto') -> pode ser
--     crédito ou débito; se a diferença = 0, nada é lançado (valor > 0 é
--     obrigatório na tabela).
--   - vendedor de empresa franqueada (modelos_franquia.tipo='franqueada'):
--     NÃO tem ajuste CLT — a comissão dele é assunto interno da franquia
--     (ela já recebeu seu crédito de proposta ao % efetivo). Conservador:
--     se a empresa do vendedor não tiver modelo (modelo_id null), TAMBÉM
--     não lançamos ajuste (ambíguo — não dá para afirmar que é time CLT da
--     matriz vs. uma franquia mal configurada).
--   - master/supervisor: override é um crédito NOVO (não existia antes).
--
-- ORDEM da transação: 1) royalties (débito) -> 2) ajustes CLT -> 3) overrides
-- de master/supervisor. As BASES de override são calculadas e ARMAZENADAS
-- (tabela temporária) usando o estado do ledger IMEDIATAMENTE APÓS os passos
-- 1 e 2 — e só então os créditos de override são inseridos, todos de uma vez.
-- Isso evita que o override de um supervisor "pyramide" para dentro da base
-- do master que está acima dele na mesma competência (a base de cada nível é
-- calculada a partir do MESMO snapshot, não em cascata).
--
-- Idempotência: sem reabertura nesta fatia. Se já existir qualquer lançamento
-- com origem like 'fechamento%' na competência, a função aborta com exceção.
-- Reabrir competência fechada é operação manual via service_role (fora desta
-- RPC), documentado aqui de propósito.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Fix de policy pendente (S1 / fatia G4.2): SELECT de comissao_lancamentos
--    precisa cobrir também o BENEFICIÁRIO do lançamento (master/supervisor
--    de override), não só vendedor_id (self) e empresas_visiveis (rede).
-- ---------------------------------------------------------------------------
drop policy if exists "cc lanc select self or rede" on public.comissao_lancamentos;
create policy "cc lanc select self or rede" on public.comissao_lancamentos
  for select to authenticated
  using (
    vendedor_id = auth.uid()
    or beneficiario_id = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or empresa_id in (select public.empresas_visiveis(auth.uid()))
  );

comment on policy "cc lanc select self or rede" on public.comissao_lancamentos is
  'Vendedor/beneficiário lê os próprios lançamentos (vendedor_id OU beneficiario_id
   = auth.uid() — G4.4 acrescenta beneficiario_id, pendência da G4.2/S1: master/
   supervisor precisam ver o próprio saldo de override); matriz lê tudo; demais
   (master/franqueado legado) leem lançamentos de empresas da rede visível.';

-- ---------------------------------------------------------------------------
-- 2) fn_rede_subordinados — subárvore de profiles.superior_id, EXCLUINDO o
--    próprio (diferente de empresas_visiveis, que inclui). Uso interno do
--    motor de fechamento (base do override não inclui o próprio beneficiário).
--    CYCLE guard: mesma razão da empresas_visiveis (043) — cadeias longas
--    A->B->A não são impedidas pelo check simples de auto-referência.
-- ---------------------------------------------------------------------------
create or replace function public.fn_rede_subordinados(p_user_id uuid)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive subordinados as (
    select c.id
      from public.profiles c
     where c.superior_id = p_user_id
    union all
    select c.id
      from public.profiles c
      join subordinados s on c.superior_id = s.id
  ) cycle id set is_cycle using path
  select id from subordinados;
$$;

comment on function public.fn_rede_subordinados(uuid) is
  'G4.4: subárvore de profiles que reportam (recursivamente) a p_user_id via
   superior_id, EXCLUINDO o próprio p_user_id (diferente de empresas_visiveis,
   que inclui). Uso interno do motor de fechamento — EXECUTE revogado de
   public/anon/authenticated (vaza estrutura de rede/hierarquia se chamável
   direto).';

revoke execute on function public.fn_rede_subordinados(uuid) from public, anon, authenticated;
grant execute on function public.fn_rede_subordinados(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3) fechar_comissao_competencia — RPC de fechamento (só matriz).
-- ---------------------------------------------------------------------------
create or replace function public.fechar_comissao_competencia(p_competencia text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _existe boolean;
  rec record;
  _valor numeric;
  _calc  numeric;
  _creditado numeric;
  _diff numeric;
  _modelo_tipo public.modelo_tipo;

  _cnt_royalties int := 0; _soma_royalties numeric := 0;
  _cnt_clt_credito int := 0; _soma_clt_credito numeric := 0;
  _cnt_clt_debito int := 0; _soma_clt_debito numeric := 0;
  _cnt_master int := 0; _soma_master numeric := 0;
  _cnt_supervisor int := 0; _soma_supervisor numeric := 0;
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'forbidden';
  end if;

  if p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'competência inválida: %', p_competencia;
  end if;

  -- Serializa fechamentos concorrentes da MESMA competência: sem este lock, duas
  -- chamadas simultâneas passariam ambas na checagem "já fechada" (read-then-write)
  -- e duplicariam royalties/ajustes/overrides no ledger. O lock é liberado no fim
  -- da transação.
  perform pg_advisory_xact_lock(hashtext('fechar_comissao_competencia:' || p_competencia));

  select exists(
    select 1 from public.comissao_lancamentos
     where competencia = p_competencia and origem like 'fechamento%'
  ) into _existe;
  if _existe then
    raise exception 'competência % já fechada', p_competencia;
  end if;

  -- =========================================================================
  -- PASSO 1: royalties (débito automático) — master (empresas.royalties_fpp)
  -- =========================================================================
  for rec in
    select p.id as profile_id, p.empresa_id, e.royalties_fpp as valor
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'master'
      join public.empresas e on e.id = p.empresa_id
     where e.royalties_fpp is not null and e.royalties_fpp > 0
  loop
    insert into public.comissao_lancamentos
      (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
    values
      (rec.profile_id, rec.profile_id, rec.empresa_id, 'debito', rec.valor,
       'Royalties/FPP · competência ' || p_competencia,
       'fechamento_royalties', 'master', p_competencia,
       jsonb_build_object('valor', rec.valor, 'fonte', 'empresas.royalties_fpp'));
    _cnt_royalties := _cnt_royalties + 1;
    _soma_royalties := _soma_royalties + rec.valor;
  end loop;

  -- royalties do supervisor (profiles.royalties)
  for rec in
    select p.id as profile_id, p.empresa_id, p.royalties as valor
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'supervisor'
     where p.royalties is not null and p.royalties > 0
  loop
    insert into public.comissao_lancamentos
      (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
    values
      (rec.profile_id, rec.profile_id, rec.empresa_id, 'debito', rec.valor,
       'Royalties · competência ' || p_competencia,
       'fechamento_royalties', 'supervisor', p_competencia,
       jsonb_build_object('valor', rec.valor, 'fonte', 'profiles.royalties'));
    _cnt_royalties := _cnt_royalties + 1;
    _soma_royalties := _soma_royalties + rec.valor;
  end loop;

  -- =========================================================================
  -- PASSO 2: ajuste CLT (só vendedor cuja empresa NÃO seja franqueada; se a
  -- empresa não tiver modelo (modelo_id null), conservador: não lança).
  -- ajuste = fn_comissao_clt(...).valor_final - Σ(créditos 'auto' por
  -- proposta do vendedor na competência, já lançados pelo trigger 048).
  -- =========================================================================
  for rec in
    select p.id as profile_id, p.empresa_id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'vendedor'
  loop
    select m.tipo into _modelo_tipo
      from public.empresas e
      left join public.modelos_franquia m on m.id = e.modelo_id
     where e.id = rec.empresa_id;

    -- Vendedor de empresa franqueada (ou sem modelo configurado): sem ajuste.
    if _modelo_tipo is distinct from 'clt' then
      continue;
    end if;

    select f.valor_final into _calc from public.fn_comissao_clt(rec.profile_id, p_competencia) f;

    select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0)
      into _creditado
      from public.comissao_lancamentos
     where beneficiario_id = rec.profile_id
       and competencia = p_competencia
       and origem = 'auto';

    _diff := round(coalesce(_calc, 0) - _creditado, 2);

    if _diff > 0 then
      insert into public.comissao_lancamentos
        (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
      values
        (rec.profile_id, rec.profile_id, rec.empresa_id, 'credito', _diff,
         'Ajuste CLT (fechamento) · competência ' || p_competencia,
         'fechamento_clt', 'vendedor_clt', p_competencia,
         jsonb_build_object('valor_calculado', _calc, 'creditado_no_periodo', _creditado, 'ajuste', _diff));
      _cnt_clt_credito := _cnt_clt_credito + 1;
      _soma_clt_credito := _soma_clt_credito + _diff;
    elsif _diff < 0 then
      insert into public.comissao_lancamentos
        (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
      values
        (rec.profile_id, rec.profile_id, rec.empresa_id, 'debito', abs(_diff),
         'Ajuste CLT (fechamento) · competência ' || p_competencia,
         'fechamento_clt', 'vendedor_clt', p_competencia,
         jsonb_build_object('valor_calculado', _calc, 'creditado_no_periodo', _creditado, 'ajuste', _diff));
      _cnt_clt_debito := _cnt_clt_debito + 1;
      _soma_clt_debito := _soma_clt_debito + abs(_diff);
    end if;
    -- _diff = 0: nada a lançar.
  end loop;

  -- =========================================================================
  -- PASSO 3: overrides de master/supervisor. Bases calculadas AGORA (snapshot
  -- pós passos 1-2, ANTES de qualquer override ser inserido) e guardadas numa
  -- tabela temporária — evita "pirâmide" (override de supervisor entrando na
  -- base do master acima dele na mesma leva).
  -- =========================================================================
  create temporary table _fechamento_overrides (
    profile_id uuid,
    papel text,
    pct numeric,
    base numeric,
    valor numeric,
    empresa_id uuid
  ) on commit drop;

  -- master: pct = empresas.perc_equipe (padrão 20 se null).
  for rec in
    select p.id as profile_id, p.empresa_id, coalesce(e.perc_equipe, 20) as pct
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'master'
      join public.empresas e on e.id = p.empresa_id
  loop
    select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0)
      into _valor
      from public.comissao_lancamentos
     where competencia = p_competencia
       and beneficiario_id in (select id from public.fn_rede_subordinados(rec.profile_id));

    if _valor > 0 then
      insert into _fechamento_overrides values
        (rec.profile_id, 'master', rec.pct, _valor, round(_valor * rec.pct / 100.0, 2), rec.empresa_id);
    end if;
  end loop;

  -- supervisor: pct = profiles.comissao_modelo (sem override próprio se nulo).
  for rec in
    select p.id as profile_id, p.empresa_id, p.comissao_modelo as pct
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'supervisor'
     where p.comissao_modelo is not null and p.comissao_modelo > 0
  loop
    select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0)
      into _valor
      from public.comissao_lancamentos
     where competencia = p_competencia
       and beneficiario_id in (select id from public.fn_rede_subordinados(rec.profile_id));

    if _valor > 0 then
      insert into _fechamento_overrides values
        (rec.profile_id, 'supervisor', rec.pct, _valor, round(_valor * rec.pct / 100.0, 2), rec.empresa_id);
    end if;
  end loop;

  -- Insere os créditos de override (valor > 0 garantido pelo filtro acima).
  for rec in select * from _fechamento_overrides where valor > 0
  loop
    insert into public.comissao_lancamentos
      (vendedor_id, beneficiario_id, empresa_id, tipo, valor, descricao, origem, papel, competencia, regra)
    values
      (rec.profile_id, rec.profile_id, rec.empresa_id, 'credito', rec.valor,
       'Override ' || rec.papel || ' (fechamento) · competência ' || p_competencia,
       'fechamento_override', rec.papel, p_competencia,
       jsonb_build_object('pct', rec.pct, 'base_liquida_rede', rec.base));

    if rec.papel = 'master' then
      _cnt_master := _cnt_master + 1;
      _soma_master := _soma_master + rec.valor;
    else
      _cnt_supervisor := _cnt_supervisor + 1;
      _soma_supervisor := _soma_supervisor + rec.valor;
    end if;
  end loop;

  return jsonb_build_object(
    'competencia', p_competencia,
    'royalties', jsonb_build_object('qtd', _cnt_royalties, 'soma', _soma_royalties),
    'ajuste_clt', jsonb_build_object(
      'qtd_credito', _cnt_clt_credito, 'soma_credito', _soma_clt_credito,
      'qtd_debito', _cnt_clt_debito, 'soma_debito', _soma_clt_debito
    ),
    'override_master', jsonb_build_object('qtd', _cnt_master, 'soma', _soma_master),
    'override_supervisor', jsonb_build_object('qtd', _cnt_supervisor, 'soma', _soma_supervisor)
  );
end;
$$;

comment on function public.fechar_comissao_competencia(text) is
  'G4.4: fecha uma competência (YYYY-MM) — só matriz. Lança, em ordem, (1)
   royalties como débito (empresas.royalties_fpp / profiles.royalties), (2)
   ajuste CLT (fn_comissao_clt vs. créditos automáticos do trigger 048) e (3)
   overrides de master/supervisor sobre a comissão líquida da rede
   (fn_rede_subordinados, exclui o próprio beneficiário). Idempotente por
   trava: já fechada (existe lançamento origem like ''fechamento%'' na
   competência) -> exceção. Reabertura é manual (service_role), fora desta
   RPC. security definer / search_path fixo; EXECUTE revogado de public/anon
   (gate real é has_role(matriz) internamente, padrão do repo).';

revoke execute on function public.fechar_comissao_competencia(text) from public, anon;
grant execute on function public.fechar_comissao_competencia(text) to authenticated;
