-- ===========================================================================
-- V11 · F5 (Frente 2) — a aprovação grava tudo numa transação
--
-- Etapa 2 do DE/PARA: "Modal abre travado no que o convite definiu (tipo +
-- vínculo herdados; 'Reclassificar' só como exceção). Master ganha o seletor de
-- Supervisor de Vendas; interno ganha cargo (preset) + áreas ajustáveis + janela"
-- e "Canais de leads escolhidos na aprovação ... Master franqueado NÃO tem
-- produtos/canais — não vende nem recebe leads".
--
-- POR QUE UMA RPC. Hoje a classificação escreve do FRONT, em chamadas separadas:
-- `profiles.update`, depois `substituirRolePorEmpresa` (delete + insert em
-- user_roles), depois mais um insert. Se qualquer uma falhar no meio, o acesso
-- fica meio classificado — com role trocada e escopo não gravado, ou vice-versa.
-- Aqui é uma transação: ou o acesso nasce completo, ou nada acontece.
--
-- ONDE A RECLASSIFICAÇÃO É REGISTRADA — e uma correção ao meu próprio plano.
-- O plano dizia "registra no histórico imutável (V11.0.6)". Não faço isso, de
-- propósito: a única porta de escrita daquele histórico exige **diretor com
-- senha**, porque ele existe para alteração de POLÍTICA (comissionamento,
-- performance, diretores — as áreas que o protótipo lista). Aprovar acesso é ato
-- operacional; exigir senha de diretor a cada reclassificação seria errado, e
-- abrir uma segunda porta sem gate enfraqueceria a garantia que a V11.0.5 criou.
-- Então a exceção fica registrada no próprio pedido, com motivo obrigatório — o
-- "registrado em log" que a Etapa 1 pede. Se a Lis quiser reclassificação
-- aparecendo na tela Histórico, isso é uma decisão à parte (ver
-- PERGUNTAS_PARA_LIS.md).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) O rastro da exceção, no próprio pedido
--
-- O tipo DECLARADO não é sobrescrito: ele vive no convite (imutável depois de
-- usado) e é alcançável por `empresas.convite_id`. Aqui guardamos apenas que
-- houve exceção e por quê — o declarado e o final coexistem.
-- ---------------------------------------------------------------------------
alter table public.empresas
  add column if not exists reclassificado_em timestamptz,
  add column if not exists reclassificacao_motivo text
    check (reclassificacao_motivo is null or char_length(reclassificacao_motivo) between 3 and 400);

comment on column public.empresas.reclassificado_em is
  'F5: quando a aprovação divergiu do tipo declarado no convite. NULL = aprovado
   como veio. O tipo declarado continua no convite (empresas.convite_id).';

-- ---------------------------------------------------------------------------
-- 2) A aprovação
-- ---------------------------------------------------------------------------
create or replace function public.aprovar_acesso(
  p_empresa_id      uuid,
  p_perfil          public.perfil,
  p_cargo_id        text default null,
  p_areas           text[] default null,
  p_produtos        text[] default null,
  p_canais          uuid[] default null,
  p_superior_id     uuid default null,
  p_reclassificado  boolean default false,
  p_motivo          text default null
) returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _uid     uuid := auth.uid();
  _profile uuid;
  _bloco   text;
  _vende   boolean;
begin
  -- ---- 1) Quem pode aprovar ESTE pedido (F1) ----------------------------
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    if public.fn_destino_pedido(p_empresa_id) = 'franquia' then
      raise exception 'este pedido é da fila da franquia — quem aprova é ela';
    end if;
    raise exception 'Seu acesso não permite aprovar este pedido';
  end if;

  select p.id into _profile from public.profiles p where p.empresa_id = p_empresa_id;
  if _profile is null then
    raise exception 'pedido % não tem cadastro de pessoa associado', p_empresa_id;
  end if;

  -- ---- 2) Reclassificar é exceção, e exceção exige motivo ---------------
  if p_reclassificado then
    if p_motivo is null or char_length(trim(p_motivo)) < 3 then
      raise exception 'reclassificar é exceção: informe o motivo';
    end if;
  end if;

  -- ---- 3) Coerência do escopo por perfil --------------------------------
  -- "Master franqueado não tem produtos/canais — não vende nem recebe leads."
  _vende := p_perfil <> 'master';
  if not _vende then
    if coalesce(array_length(p_produtos, 1), 0) > 0
       or coalesce(array_length(p_canais, 1), 0) > 0 then
      raise exception 'Master franqueado não vende nem recebe leads: não tem produtos nem canais';
    end if;
  end if;

  -- Cargo só faz sentido no time interno.
  if p_cargo_id is not null and p_perfil not in ('matriz', 'coordenador', 'supervisor', 'interno') then
    raise exception 'cargo só se aplica ao time interno da Matriz';
  end if;

  -- ---- 4) Papel definitivo ---------------------------------------------
  -- Substitui em vez de inserir: user_roles é UNIQUE(user_id, role) e o
  -- useAuth() espera no máximo uma linha por usuário.
  delete from public.user_roles where user_id = _profile;
  insert into public.user_roles (user_id, role) values (_profile, p_perfil);

  -- ---- 5) Cadastro ------------------------------------------------------
  update public.profiles
     set status = 'aprovada',
         aprovada_em = now(),
         cargo_id = p_cargo_id,
         superior_id = coalesce(p_superior_id, superior_id)
   where id = _profile;

  -- ---- 6) Áreas: o que a tela mandou, ou o preset do cargo -------------
  delete from public.profile_areas where profile_id = _profile;
  if p_areas is not null and array_length(p_areas, 1) > 0 then
    insert into public.profile_areas (profile_id, area_chave)
    select _profile, a from unnest(p_areas) a
     where exists (select 1 from public.areas x where x.chave = a)
    on conflict do nothing;
  end if;
  -- Sem override, fn_areas_do_usuario cai no preset do cargo — não precisa
  -- materializar nada aqui.

  -- ---- 7) Produtos: o que a tela mandou, ou o padrão do bloco ----------
  delete from public.profile_produtos where profile_id = _profile;
  if _vende then
    _bloco := case
                when p_perfil in ('matriz', 'coordenador', 'supervisor', 'interno')
                then 'interno' else 'externo'
              end;
    insert into public.profile_produtos (profile_id, produto_id)
    select _profile, p from unnest(
      coalesce(
        nullif(p_produtos, '{}'),
        array(select public.fn_produtos_padrao(_bloco))
      )
    ) p
     where exists (select 1 from public.produtos x where x.id = p and x.ativo)
    on conflict do nothing;

    -- O produto fixo entra sempre, mesmo que a tela o tenha esquecido.
    insert into public.profile_produtos (profile_id, produto_id)
    select _profile, x.id from public.produtos x where x.fixo and x.ativo
    on conflict do nothing;
  end if;

  -- ---- 8) Canais habilitados ------------------------------------------
  delete from public.profile_canais where profile_id = _profile;
  if _vende and p_canais is not null and array_length(p_canais, 1) > 0 then
    insert into public.profile_canais (profile_id, canal_id)
    select _profile, c from unnest(p_canais) c
     where exists (select 1 from public.canais x where x.id = c)
    on conflict do nothing;
  end if;

  -- ---- 9) Libera o pedido e registra a exceção -------------------------
  update public.empresas
     set status = 'aprovada',
         aprovada_em = now(),
         reclassificado_em = case when p_reclassificado then now() else null end,
         reclassificacao_motivo = case when p_reclassificado then trim(p_motivo) else null end
   where id = p_empresa_id;
end;
$function$;

comment on function public.aprovar_acesso(uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text) is
  'F5: aprova o pedido gravando papel, cargo, áreas, produtos, canais e supervisão
   numa única transação — antes isso era feito em chamadas separadas do front, e
   uma falha no meio deixava o acesso meio classificado. Valida quem pode aprovar
   ESTE pedido (fn_pode_aprovar_pedido), exige motivo quando reclassifica, e
   recusa produtos/canais para Master franqueado, que não vende nem recebe leads.';

revoke all on function public.aprovar_acesso(uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text)
  from public, anon;
grant execute on function public.aprovar_acesso(uuid, public.perfil, text, text[], text[], uuid[], uuid, boolean, text)
  to authenticated;
