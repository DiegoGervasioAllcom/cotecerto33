-- ===========================================================================
-- V11 · F1/F2 (Frente 2 — filas de aprovação) — roteamento e RLS das duas filas
--
-- Fluxo "Acesso e visualização": "quando o cadastro é de um vendedor de Franquia
-- Full, o pedido NÃO VAI PARA A MATRIZ — cai na fila da própria franquia, e o
-- franqueado libera o acesso do seu vendedor. É a autonomia da matrizinha: a
-- equipe é dela, a aprovação também."
--
-- O protótipo r40 implementa isso filtrando antes de montar as filas da Matriz:
--   matrizPending()   = PENDING sem os da fila da Full
--   internoPending()  = matrizPending() da trilha interna
--   externoPending()  = matrizPending() da trilha externa
--   isFullQueue(p)    = trilha externo + perfil vendedor + vincTipo full
--
-- Note o que NÃO é exceção: `franquia_full` (a franquia como entidade) é aprovada
-- pela Matriz normalmente. Só o *vendedor* vinculado a uma Full sai da fila dela.
-- A Matriz decide quem entra na rede; cada Full decide quem entra na equipe dela.
--
-- DUAS FUNÇÕES SEPARADAS, DE PROPÓSITO:
--
--   fn_destino_pedido      — de quem é a fila
--   fn_pode_aprovar_pedido — quem pode aprovar
--
-- Juntá-las numa só tornaria caro mudar de ideia. A pergunta "a Matriz também
-- deveria poder aprovar o vendedor da Full?" está aberta com a Lis (ver
-- docs/PERGUNTAS_PARA_LIS.md, item 5) e cada saída mexe em um ponto só:
--
--   override      -> `or public.has_role(_uid,'matriz')` no braço 'franquia' de
--                    fn_pode_aprovar_pedido, e inverter o teste negativo;
--   fallback (Nd) -> o mesmo, condicionado a um prazo — exige job periódico;
--   escalonamento -> pedido próprio de escalonamento, com motivo e rastro.
--
-- POR QUE ALTERAR AS POLICIES EXISTENTES, E NÃO SÓ ACRESCENTAR: policies se somam
-- com OR. A `empresas_admin` dá ALL à Matriz sobre toda empresa, então nenhuma
-- policy nova conseguiria ESCONDER o pendente da Full dela — só alterando a que
-- já existe. É o oposto do reflexo normal de "adicionar uma policy".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) De quem é a fila
--
-- security definer para ler `empresas`/`convites` sem cair na própria policy de
-- `empresas` (a função é usada DENTRO dela — sem isso, recursão).
-- ---------------------------------------------------------------------------
create or replace function public.fn_destino_pedido(_empresa_id uuid)
  returns text
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
declare
  _c record;
begin
  select cv.trilha, cv.perfil, cv.vinc_tipo, cv.vinc_empresa_id
    into _c
    from public.empresas e
    join public.convites cv on cv.id = e.convite_id
   where e.id = _empresa_id;

  -- Sem convite: criação manual por exceção (a "Prime Riscos" do protótipo, com
  -- o chip "manual · exceção" e sem tipo declarado). Vai para a fila externa da
  -- Matriz, que define o tipo na análise.
  if not found then
    return 'matriz_rede';
  end if;

  if _c.trilha = 'interno' then
    return 'matriz_interno';
  end if;

  -- A única exceção da rede — as três condições juntas, como no isFullQueue.
  if _c.perfil = 'vendedor' and _c.vinc_tipo = 'full' and _c.vinc_empresa_id is not null then
    return 'franquia';
  end if;

  return 'matriz_rede';
end;
$function$;

comment on function public.fn_destino_pedido(uuid) is
  'V11 F1: de quem é a fila deste pedido — matriz_interno, matriz_rede ou
   franquia. Só o vendedor com vínculo em Franquia Full sai das filas da Matriz;
   a própria franquia_full é aprovada por ela. Pedido sem convite (criação manual
   por exceção) cai em matriz_rede, sem tipo declarado.';

revoke all on function public.fn_destino_pedido(uuid) from public, anon;
grant execute on function public.fn_destino_pedido(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Qual franquia é a dona da fila (null quando o destino não é franquia)
-- ---------------------------------------------------------------------------
create or replace function public.fn_fila_franquia_id(_empresa_id uuid)
  returns uuid
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select cv.vinc_empresa_id
    from public.empresas e
    join public.convites cv on cv.id = e.convite_id
   where e.id = _empresa_id
     and cv.perfil = 'vendedor'
     and cv.vinc_tipo = 'full';
$function$;

comment on function public.fn_fila_franquia_id(uuid) is
  'V11 F1: empresa da Franquia Full dona da fila deste pedido. NULL quando o
   destino não é uma franquia.';

revoke all on function public.fn_fila_franquia_id(uuid) from public, anon;
grant execute on function public.fn_fila_franquia_id(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Quem pode aprovar — a costura que a pergunta em aberto vai mexer
-- ---------------------------------------------------------------------------
create or replace function public.fn_pode_aprovar_pedido(_uid uuid, _empresa_id uuid)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
declare
  _destino   text := public.fn_destino_pedido(_empresa_id);
  _franquia  uuid;
  _minha_emp uuid;
begin
  if _uid is null then
    return false;
  end if;

  if _destino in ('matriz_interno', 'matriz_rede') then
    return public.has_role(_uid, 'matriz') or public.has_role(_uid, 'coordenador');
  end if;

  -- destino = 'franquia': só o franqueado da Full em questão.
  _franquia := public.fn_fila_franquia_id(_empresa_id);
  select p.empresa_id into _minha_emp from public.profiles p where p.id = _uid;

  return public.has_role(_uid, 'franqueado')
     and _minha_emp is not null
     and _minha_emp = _franquia;
  -- Se a decisão com a Lis for dar esse poder à Matriz (item 5 das perguntas),
  -- é aqui que entra `or public.has_role(_uid,'matriz')` — e o teste negativo
  -- "matriz não aprova vendedor de Full" vira positivo. Mais nada muda.
end;
$function$;

comment on function public.fn_pode_aprovar_pedido(uuid, uuid) is
  'V11 F1: quem pode aprovar este pedido. Separada de fn_destino_pedido de
   propósito: a fila e o poder são perguntas diferentes, e a segunda ainda tem
   decisão de produto aberta (PERGUNTAS_PARA_LIS.md, item 5).';

revoke all on function public.fn_pode_aprovar_pedido(uuid, uuid) from public, anon;
grant execute on function public.fn_pode_aprovar_pedido(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) RLS — a Matriz deixa de ver o PENDENTE da Full; a Full passa a ver o dela
--
-- Só o pendente sai da visão da Matriz. Depois de aprovado, o vendedor da Full
-- aparece normalmente em Cadastros Rede — que no protótipo lista a rede inteira,
-- inclusive os vendedores das Fulls.
-- ---------------------------------------------------------------------------

-- Escrita da Matriz: continua ampla, menos o pendente que é da franquia.
drop policy if exists empresas_admin on public.empresas;
create policy empresas_admin on public.empresas
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    and not (status = 'pendente' and public.fn_destino_pedido(id) = 'franquia')
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    and not (status = 'pendente' and public.fn_destino_pedido(id) = 'franquia')
  );

drop policy if exists "empresas update matriz" on public.empresas;
create policy "empresas update matriz" on public.empresas
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    and not (status = 'pendente' and public.fn_destino_pedido(id) = 'franquia')
  );

-- Leitura: o pendente com destino de franquia sai da regra geral, e a policy
-- seguinte devolve o acesso a quem é dono da fila.
--
-- ATENÇÃO ao motivo de a exclusão envolver a expressão INTEIRA, e não só o braço
-- da Matriz: `empresas_visiveis()` devolve TODAS as empresas para matriz e
-- coordenador (é o braço curto dela). Então recortar apenas
-- `has_role(matriz) and not (...)` não esconde nada — o `or id in
-- empresas_visiveis` reabre tudo logo em seguida. Um teste pegou exatamente isso.
--
-- Havia ainda DUAS policies de SELECT quase homônimas — "empresas select" (com
-- espaço) e "empresas_select" (com underscore) — sendo a segunda um subconjunto
-- da primeira. Consolidadas numa só: duas policies equivalentes é armadilha, foi
-- por causa dela que o primeiro recorte vazou.
drop policy if exists "empresas select" on public.empresas;
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
  for select to authenticated
  using (
    (
      public.has_role(auth.uid(), 'matriz')
      or id in (select public.empresas_visiveis(auth.uid()))
    )
    and not (status = 'pendente' and public.fn_destino_pedido(id) = 'franquia')
  );

-- A fila da própria franquia: a Full vê e resolve o pendente do time dela.
-- `empresas_visiveis` não serve aqui porque o pedido pendente ainda não está
-- pendurado na rede — quem o liga à franquia é o convite.
drop policy if exists empresas_fila_da_franquia on public.empresas;
create policy empresas_fila_da_franquia on public.empresas
  for select to authenticated
  using (
    status = 'pendente'
    and public.fn_destino_pedido(id) = 'franquia'
    and public.fn_pode_aprovar_pedido(auth.uid(), id)
  );

drop policy if exists empresas_fila_da_franquia_update on public.empresas;
create policy empresas_fila_da_franquia_update on public.empresas
  for update to authenticated
  using (
    status = 'pendente'
    and public.fn_destino_pedido(id) = 'franquia'
    and public.fn_pode_aprovar_pedido(auth.uid(), id)
  );

-- ---------------------------------------------------------------------------
-- 5) A RPC de aprovação passa a validar o PEDIDO, não só o papel
--
-- Antes: `if not has_role(matriz) then raise` — qualquer matriz aprovava
-- qualquer pendente, inclusive o de uma Full. Como a RPC é exposta por HTTP, o
-- filtro de tela não segurava isso: bastava chamar com outro empresa_id.
-- ---------------------------------------------------------------------------
create or replace function public.aprovar_empresa(p_empresa_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  if not public.fn_pode_aprovar_pedido(auth.uid(), p_empresa_id) then
    if public.fn_destino_pedido(p_empresa_id) = 'franquia' then
      raise exception 'este pedido é da fila da franquia — quem aprova é ela';
    end if;
    raise exception 'somente matriz pode aprovar';
  end if;

  update public.empresas set status = 'aprovada', aprovada_em = now()
   where id = p_empresa_id;
  update public.profiles set status = 'aprovada', aprovada_em = now()
   where empresa_id = p_empresa_id;
end;
$function$;

comment on function public.aprovar_empresa(uuid) is
  'Aprova o pedido de acesso. V11 F1: valida o PEDIDO via fn_pode_aprovar_pedido,
   não só o papel de quem chama — a RPC é exposta por HTTP, então recortar a fila
   na tela não impediria a Matriz de aprovar o vendedor de uma Full.';

revoke all on function public.aprovar_empresa(uuid) from public, anon;
grant execute on function public.aprovar_empresa(uuid) to authenticated;
