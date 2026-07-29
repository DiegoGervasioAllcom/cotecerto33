-- ===========================================================================
-- V11 · C1/C2/C3 (Frente 1 — Convite Supper) — tabela e RPCs
--
-- Fluxo "Autocadastro": "Todo acesso começa aqui e sempre a partir de um Convite
-- Supper: o link já traz o tipo de perfil e o vínculo, para quem aprova receber
-- sabendo do que se trata. Não há cadastro espontâneo."
--
-- O convite não é só um link: é o payload que classifica o pedido ANTES da
-- aprovação. É o que permite a Frente 2 rotear a fila sozinha (vendedor de
-- Franquia Full nunca chega à Matriz).
--
-- DOIS IDENTIFICADORES, de propósito:
--   codigo — 'SC-' + 6, o rótulo humano do protótipo. Vai na tela e no histórico.
--   token  — 32 bytes aleatórios em base64url. É o que vai na URL e o que
--            `abrir_convite` exige. O código curto do protótipo tem ~2 bilhões de
--            combinações, o que é força-brutável num endpoint público; então ele
--            fica como rótulo e o segredo é separado.
--
-- ESCOPO É VALIDADO NO SERVIDOR. Sem isso, um Master forja um convite de Direção
-- e a fila da Matriz aprova um acesso interno — a tela não pode ser a guarda.
-- `criar_convite` deriva o escopo permitido do perfil de quem chama e recusa
-- qualquer combinação fora dele.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) A tabela
-- ---------------------------------------------------------------------------
create table if not exists public.convites (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique check (codigo ~ '^SC-[0-9A-Z]{6}$'),
  token      text not null unique check (char_length(token) between 32 and 128),

  -- Nominal: o convite vale para uma pessoa.
  nome       text not null check (char_length(nome) between 2 and 120),

  -- O payload que classifica o pedido (espelha cvSel() do protótipo r40).
  escopo     text not null check (escopo in ('interno', 'externo', 'master', 'full')),
  trilha     text not null check (trilha in ('interno', 'externo')),
  perfil     text check (perfil in ('master', 'franquia_full', 'franquia_indiv', 'vendedor')),
  cargo_id   text references public.cargos(id) on delete restrict,
  vinc_tipo  text not null check (vinc_tipo in ('matriz', 'master', 'full')),
  vinc_empresa_id uuid references public.empresas(id) on delete cascade,

  expira_em  timestamptz not null,
  usado_em   timestamptz,
  usado_por  uuid references public.profiles(id) on delete set null,
  criado_por uuid not null references public.profiles(id) on delete cascade,
  criado_em  timestamptz not null default now(),

  -- Trilha interna descreve cargo OU Vendedor Matriz (perfil vendedor sem cargo);
  -- nunca as duas coisas, nunca nenhuma.
  constraint convites_interno_coerente check (
    trilha <> 'interno'
    or (cargo_id is not null and perfil is null)
    or (cargo_id is null and perfil = 'vendedor')
  ),
  -- Trilha externa sempre declara perfil e nunca tem cargo.
  constraint convites_externo_coerente check (
    trilha <> 'externo' or (perfil is not null and cargo_id is null)
  ),
  -- Vínculo com a Matriz não aponta empresa; os outros dois apontam.
  constraint convites_vinculo_coerente check (
    (vinc_tipo = 'matriz' and vinc_empresa_id is null)
    or (vinc_tipo <> 'matriz' and vinc_empresa_id is not null)
  )
);

comment on table public.convites is
  'V11 C1: Convite Supper — link nominal de uso único que carrega perfil e vínculo.
   `codigo` é o rótulo humano (SC-XXXXXX); `token` é o segredo que vai na URL.
   O payload (trilha/perfil/cargo_id/vinc_*) classifica o pedido antes da
   aprovação e é o que roteia a fila na Frente 2.';

comment on column public.convites.escopo is
  'De qual botão Convidar o convite saiu. Guardado para auditoria: é o escopo que
   limita o que pode ser convidado, e ele é conferido no servidor em criar_convite.';

create index if not exists idx_convites_criado_por on public.convites(criado_por);
create index if not exists idx_convites_vinc on public.convites(vinc_empresa_id);
create index if not exists idx_convites_pendentes
  on public.convites(expira_em) where usado_em is null;

-- ---------------------------------------------------------------------------
-- 2) RLS — leitura dos próprios convites; escrita só via RPC
-- ---------------------------------------------------------------------------
alter table public.convites enable row level security;

revoke all on public.convites from public, anon, authenticated;
grant select on public.convites to authenticated;
grant all on public.convites to service_role;

-- Quem convidou vê os seus. Matriz e Coordenador acompanham todos (a tela de
-- Acessos lista os convites emitidos). Ninguém escreve direto: a única porta é
-- criar_convite, que valida o escopo.
drop policy if exists convites_select_proprios_ou_matriz on public.convites;
create policy convites_select_proprios_ou_matriz on public.convites
  for select to authenticated
  using (
    criado_por = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

-- ---------------------------------------------------------------------------
-- 3) Geração de código e token
-- ---------------------------------------------------------------------------
create or replace function public.fn_convite_codigo()
  returns text
  language plpgsql
  volatile
  security definer
  set search_path to 'public'
as $function$
declare
  _alfabeto constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  _cod text;
  _i   int;
begin
  loop
    _cod := 'SC-';
    for _i in 1..6 loop
      _cod := _cod || substr(_alfabeto, 1 + floor(random() * length(_alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.convites c where c.codigo = _cod);
  end loop;
  return _cod;
end;
$function$;

comment on function public.fn_convite_codigo() is
  'V11 C2: rótulo humano SC-XXXXXX, único. NÃO é segredo — o segredo é o token.';

-- ---------------------------------------------------------------------------
-- 4) criar_convite — o escopo é conferido aqui, não na tela
-- ---------------------------------------------------------------------------
create or replace function public.criar_convite(
  p_nome            text,
  p_escopo          text,
  p_trilha          text,
  p_perfil          text default null,
  p_cargo_id        text default null,
  p_vinc_tipo       text default 'matriz',
  p_vinc_empresa_id uuid default null,
  p_validade_dias   int default 7
) returns table(id uuid, codigo text, token text, expira_em timestamptz)
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _uid        uuid := auth.uid();
  _minha_emp  uuid;
  _modalidade text;
  _token      text;
  _codigo     text;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;
  if p_validade_dias is null or p_validade_dias < 1 or p_validade_dias > 90 then
    raise exception 'validade fora da faixa permitida (1 a 90 dias)';
  end if;

  select p.empresa_id into _minha_emp from public.profiles p where p.id = _uid;

  -- ---- 1) Quem pode usar cada escopo -------------------------------------
  if p_escopo in ('interno', 'externo') then
    if not (public.has_role(_uid, 'matriz') or public.has_role(_uid, 'coordenador')) then
      raise exception 'Seu acesso não permite convidar neste escopo';
    end if;

  elsif p_escopo = 'master' then
    if not public.has_role(_uid, 'master') then
      raise exception 'Seu acesso não permite convidar neste escopo';
    end if;

  elsif p_escopo = 'full' then
    if not public.has_role(_uid, 'franqueado') then
      raise exception 'Seu acesso não permite convidar neste escopo';
    end if;
    select mf.modalidade into _modalidade
      from public.empresas e
      join public.modelos_franquia mf on mf.id = e.modelo_id
     where e.id = _minha_emp;
    if coalesce(_modalidade, '') <> 'full' then
      raise exception 'Só Franquia Full convida vendedor próprio';
    end if;

  else
    raise exception 'escopo inválido: %', p_escopo;
  end if;

  -- ---- 2) O que cada escopo pode convidar --------------------------------
  --
  -- ATENÇÃO à lógica ternária: `p_perfil = 'x'` com p_perfil NULL devolve NULL,
  -- não FALSE, e `if not (NULL)` NÃO dispara — um convite sem perfil passaria
  -- pela guarda e só morreria no check da tabela. Por isso todas as comparações
  -- de perfil aqui usam coalesce.
  if p_escopo = 'interno' then
    if p_trilha <> 'interno' then
      raise exception 'escopo interno só emite convite da trilha interna';
    end if;
    -- Cargo preset, ou Vendedor Matriz (perfil vendedor sem cargo).
    if not (
      (p_cargo_id is not null and p_perfil is null)
      or (p_cargo_id is null and coalesce(p_perfil, '') = 'vendedor')
    ) then
      raise exception 'convite interno exige um cargo, ou Vendedor Matriz';
    end if;
    p_vinc_tipo := 'matriz';
    p_vinc_empresa_id := null;

  elsif p_escopo = 'externo' then
    -- DE/PARA: "Matriz externo (Master e Franquia Individual direta — vínculo Matriz)".
    if p_trilha <> 'externo'
       or coalesce(p_perfil, '') not in ('master', 'franquia_indiv') then
      raise exception 'escopo externo da Matriz convida apenas Master ou Franquia Individual direta';
    end if;
    p_vinc_tipo := 'matriz';
    p_vinc_empresa_id := null;

  elsif p_escopo = 'master' then
    -- O Master convida as franquias e os vendedores dele. NÃO convida outro
    -- Master nem ninguém do time interno.
    if p_trilha <> 'externo'
       or coalesce(p_perfil, '') not in ('franquia_full', 'franquia_indiv', 'vendedor') then
      raise exception 'Master convida apenas franquias e vendedores da rede dele';
    end if;
    if coalesce(p_vinc_tipo, '') = 'full' then
      -- Vendedor de uma Franquia Full da rede dele: a Full tem de ser visível.
      if coalesce(p_perfil, '') <> 'vendedor' then
        raise exception 'vínculo com Franquia Full só se aplica a vendedor';
      end if;
      if p_vinc_empresa_id is null
         or p_vinc_empresa_id not in (select public.empresas_visiveis(_uid)) then
        raise exception 'a Franquia Full informada não está na sua rede';
      end if;
    else
      -- Qualquer outro caso fica travado NELE, ignorando o que a tela mandou.
      p_vinc_tipo := 'master';
      p_vinc_empresa_id := _minha_emp;
    end if;

  elsif p_escopo = 'full' then
    -- "Full (só Vendedor | Full da própria franquia)".
    if p_trilha <> 'externo' or coalesce(p_perfil, '') <> 'vendedor' then
      raise exception 'Franquia Full convida apenas Vendedor da própria franquia';
    end if;
    p_vinc_tipo := 'full';
    p_vinc_empresa_id := _minha_emp;
  end if;

  -- ---- 3) Emissão --------------------------------------------------------
  _codigo := public.fn_convite_codigo();
  -- base64url de 32 bytes: sem '+' e '/' para caber numa URL sem escape.
  _token := replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  _token := replace(_token, '=', '');

  insert into public.convites
    (codigo, token, nome, escopo, trilha, perfil, cargo_id,
     vinc_tipo, vinc_empresa_id, expira_em, criado_por)
  values
    (_codigo, _token, p_nome, p_escopo, p_trilha, p_perfil, p_cargo_id,
     p_vinc_tipo, p_vinc_empresa_id, now() + make_interval(days => p_validade_dias), _uid)
  returning convites.id, convites.codigo, convites.token, convites.expira_em
  into id, codigo, token, expira_em;

  return next;
end;
$function$;

comment on function public.criar_convite(text, text, text, text, text, text, uuid, int) is
  'V11 C2: emite Convite Supper validando NO SERVIDOR o que cada escopo pode
   convidar. Master e Full têm o vínculo forçado neles, ignorando o que a tela
   enviar. Devolve o token, que é o que vai na URL.';

revoke all on function public.criar_convite(text, text, text, text, text, text, uuid, int)
  from public, anon;
grant execute on function public.criar_convite(text, text, text, text, text, text, uuid, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5) abrir_convite — pública, porque o convidado ainda não tem login
--
-- É RPC e não policy de propósito: dar SELECT a `anon` abriria a tabela inteira
-- (quem convidou quem, para toda a rede). A função devolve só o necessário para
-- pré-preencher o formulário, e o motivo do erro é tipado para a tela saber o que
-- dizer.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_convite(p_token text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _c   record;
  _por text;
  _vinc text;
begin
  if p_token is null or char_length(p_token) < 32 then
    return jsonb_build_object('ok', false, 'motivo', 'inexistente');
  end if;

  select * into _c from public.convites c where c.token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'inexistente');
  end if;
  if _c.usado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'usado');
  end if;
  if _c.expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;

  -- "Você foi convidado por Fulana — Coordenadora Comercial": só o nome de quem
  -- convidou, nada mais do cadastro dele.
  select coalesce(p.nome, 'Equipe Supper') into _por
    from public.profiles p where p.id = _c.criado_por;

  select e.nome into _vinc
    from public.empresas e where e.id = _c.vinc_empresa_id;

  return jsonb_build_object(
    'ok', true,
    'codigo', _c.codigo,
    'nome', _c.nome,
    'trilha', _c.trilha,
    'perfil', _c.perfil,
    'cargo_id', _c.cargo_id,
    'cargo_nome', (select cg.nome from public.cargos cg where cg.id = _c.cargo_id),
    'vinc_tipo', _c.vinc_tipo,
    'vinc_nome', coalesce(_vinc, 'Matriz'),
    'convidado_por', _por,
    'expira_em', _c.expira_em
  );
end;
$function$;

comment on function public.abrir_convite(text) is
  'V11 C3: valida o token e devolve o payload para pré-preencher o cadastro.
   Pública (anon) porque o convidado ainda não tem login — por isso devolve só o
   necessário e nunca a tabela. Motivos de recusa: inexistente, usado, expirado.';

revoke all on function public.abrir_convite(text) from public;
grant execute on function public.abrir_convite(text) to anon, authenticated;
