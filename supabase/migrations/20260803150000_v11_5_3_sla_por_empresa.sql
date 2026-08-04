-- ===========================================================================
-- V11.5.3 (Frente 5 — Franquia Full) — SLA por empresa
--
-- Regra 10 das "Regras Decididas" (Lis, 26/07/2026): "A Franquia Full define
-- o próprio prazo de atendimento. O SLA dela não precisa ser os 3 minutos da
-- Matriz." Hoje `distribuicao_config` (023) é singleton (`id='default'`,
-- `sla_segundos=180` fixo) — não existe SLA por empresa.
--
-- DECISÃO DE DESIGN (plano V11.5.3, risco 2): NÃO alteramos
-- `distribuicao_config` — ela é o SLA global da Matriz, já em produção. Uma
-- tabela nova por empresa, com fallback pro singleton quando a empresa não
-- tem override, preserva 100% do comportamento atual pra quem nunca configurar
-- nada (a Matriz e toda franquia individual continuam nos 180s de sempre).
--
-- MODELO:
--   sla_empresa_config  — 1 linha opcional por empresa (override). Ausência de
--                         linha = usa o singleton.
--   fn_sla_efetivo(empresa)      — resolve override > singleton. Função única
--                                   pra não duplicar o fallback em todo SELECT.
--   fn_sla_aplicavel_lead(lead)  — a régua real de roteamento (regra 9/10
--                                   combinadas com a taxonomia de canais,
--                                   004/`v11_04_taxonomia_canais`):
--                                     canal.empresa_id NULL      (repassado
--                                       pela Matriz, ou lead sem canal) -> cai
--                                       direto no fallback global via
--                                       fn_sla_efetivo(NULL);
--                                     canal.empresa_id = X (próprio da Full X)
--                                       -> fn_sla_efetivo(X) (override da
--                                       própria Full, ou o mesmo fallback se
--                                       ela nunca configurou).
--   fn_salvar_sla_empresa(...)    — ÚNICA porta de escrita (RPC). A tabela não
--                                   recebe grant de insert/update/delete pra
--                                   `authenticated` — igual ao padrão já usado
--                                   pra configuração sensível neste repo
--                                   (`fn_pct_comissao_efetivo`/trigger em vez
--                                   de escrita direta). Quem pode chamar: a
--                                   Matriz (ou Coordenador, que no V11 tem a
--                                   mesma visão de rede da Matriz — H5) sobre
--                                   QUALQUER empresa; a própria Franquia Full
--                                   (role `franqueado` cuja `profiles.empresa_id`
--                                   é exatamente a empresa alvo) sobre a
--                                   PRÓPRIA empresa. Franquia individual não
--                                   ganha essa autonomia (regra 10 é
--                                   especificamente da Full) — `fn_bloco_
--                                   performance` (D5) já resolve modalidade
--                                   full/individual/CLT sem duplicar a lógica.
--
-- GAP CONHECIDO (documentado, não resolvido aqui — fora do escopo desta task):
-- `sla_expirar_leads_pendentes(p_janela_seg)` (017/018/030/031) recebe UM
-- parâmetro de janela por chamada — quem chama hoje sempre usa o singleton
-- global, não itera lead a lead aplicando `fn_sla_aplicavel_lead`. Fazer o job
-- de expiração respeitar o SLA por empresa é a "task de consumo" citada no
-- plano (fica pra V11.5.7/V11.5.9 ou task própria) — mudar essa função aqui
-- expandiria o escopo pra um motor que já roda em produção sem o teste de
-- regressão dedicado que essa mudança merece.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela: override de SLA por empresa
-- ---------------------------------------------------------------------------
create table if not exists public.sla_empresa_config (
  empresa_id     uuid primary key references public.empresas(id) on delete cascade,
  -- Faixa: 30s (piso realista pra "atender agora") a 86400s/24h (teto — SLA de
  -- dias não cabe no conceito de "prazo de atendimento" da Central de leads).
  sla_segundos   integer not null check (sla_segundos between 30 and 86400),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

comment on table public.sla_empresa_config is
  'V11.5.3: override de SLA de atendimento por empresa (regra 10 — só faz
   sentido pra Franquia Full). Ausência de linha para uma empresa = usa
   distribuicao_config.sla_segundos (singleton da Matriz). Escrita só via
   fn_salvar_sla_empresa; sem grant de insert/update/delete pra authenticated.';

-- select liberado pra authenticated; grants de escrita ficam só com
-- service_role — a única porta pro client é a RPC (security definer).
grant select on public.sla_empresa_config to authenticated;
grant all on public.sla_empresa_config to service_role;

alter table public.sla_empresa_config enable row level security;

drop policy if exists sla_empresa_config_select on public.sla_empresa_config;
create policy sla_empresa_config_select on public.sla_empresa_config
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or empresa_id in (select public.empresas_visiveis(auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2) fn_sla_efetivo — resolve override > singleton. NULL de p_empresa_id (ou
--    empresa sem override) cai naturalmente no singleton, pela mesma consulta
--    (where empresa_id = p_empresa_id nunca casa com NULL) — sem precisar de
--    um branch separado pro caso "lead repassado" (ver fn_sla_aplicavel_lead).
-- ---------------------------------------------------------------------------
create or replace function public.fn_sla_efetivo(p_empresa_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select sla_segundos from public.sla_empresa_config where empresa_id = p_empresa_id),
    (select sla_segundos from public.distribuicao_config where id = 'default')
  );
$$;

comment on function public.fn_sla_efetivo(uuid) is
  'V11.5.3: SLA efetivo de uma empresa — override em sla_empresa_config se
   existir, senão distribuicao_config.sla_segundos (singleton global). NULL de
   p_empresa_id também cai no singleton (usado por fn_sla_aplicavel_lead pra
   lead repassado/sem canal). security definer: mesmo padrão de
   fn_bloco_performance (D5) — não é dado sensível, só operacional.';

revoke all on function public.fn_sla_efetivo(uuid) from public, anon;
grant execute on function public.fn_sla_efetivo(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) fn_sla_aplicavel_lead — a régua real de roteamento (regras 9+10): canal
--    próprio da Full X usa o SLA de X; canal repassado (ou lead sem canal,
--    rede de segurança) usa o SLA global. Lead inexistente -> NULL (sem
--    exceção; língua consistente com a checagem de existência ficar a cargo
--    de quem já tem lead_id em mãos, não desta função de leitura).
-- ---------------------------------------------------------------------------
create or replace function public.fn_sla_aplicavel_lead(p_lead_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_sla_efetivo(c.empresa_id)
    from public.leads l
    left join public.canais c on c.id = l.canal_id
   where l.id = p_lead_id;
$$;

comment on function public.fn_sla_aplicavel_lead(uuid) is
  'V11.5.3: SLA aplicável a um lead — resolve o canal do lead (leads.canal_id)
   e aplica fn_sla_efetivo(canal.empresa_id). canal.empresa_id NULL (canal
   Supper/repassado pela Matriz, ou lead sem canal) -> SLA global; preenchido
   (canal próprio de uma Full) -> SLA efetivo dessa Full. NÃO consumida ainda
   pelo job de expiração (ver gap documentado no cabeçalho desta migration).';

revoke all on function public.fn_sla_aplicavel_lead(uuid) from public, anon;
grant execute on function public.fn_sla_aplicavel_lead(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) fn_salvar_sla_empresa — única porta de escrita.
-- ---------------------------------------------------------------------------
create or replace function public.fn_salvar_sla_empresa(
  p_empresa_id uuid,
  p_sla_segundos integer
)
returns public.sla_empresa_config
language plpgsql
security definer
set search_path = public
as $$
declare
  _pode boolean;
  _linha public.sla_empresa_config;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'nao_autenticado';
  end if;

  if p_empresa_id is null then
    raise exception using errcode = '22023', message = 'empresa_id_obrigatorio';
  end if;

  if p_sla_segundos is null or p_sla_segundos < 30 or p_sla_segundos > 86400 then
    raise exception using
      errcode = '22023',
      message = 'sla_segundos_fora_da_faixa',
      hint = 'Informe um valor entre 30 e 86400 segundos (24h).';
  end if;

  -- Matriz/Coordenador: qualquer empresa. Franqueado: só a PRÓPRIA empresa, e
  -- só se ela for modalidade Full (regra 10 é autonomia da Full, não da
  -- franquia individual) — fn_bloco_performance (D5) já resolve isso sem
  -- duplicar a derivação empresas.modelo_id -> modelos_franquia.modalidade.
  _pode :=
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or (
      public.has_role(auth.uid(), 'franqueado')
      and exists (
        select 1 from public.profiles p
         where p.id = auth.uid()
           and p.empresa_id = p_empresa_id
      )
      and public.fn_bloco_performance(p_empresa_id) = 'full'
    );

  if not _pode then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  insert into public.sla_empresa_config (empresa_id, sla_segundos, atualizado_em, atualizado_por)
  values (p_empresa_id, p_sla_segundos, now(), auth.uid())
  on conflict (empresa_id) do update
    set sla_segundos = excluded.sla_segundos,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  returning * into _linha;

  return _linha;
end;
$$;

comment on function public.fn_salvar_sla_empresa(uuid, integer) is
  'V11.5.3: única porta de escrita de sla_empresa_config. Autoriza Matriz/
   Coordenador sobre qualquer empresa, ou a própria Franquia Full (role
   franqueado, profiles.empresa_id = p_empresa_id, fn_bloco_performance =
   ''full'') sobre a própria empresa. Upsert por empresa_id. Faixa validada
   (30..86400s) — regra de negócio dentro da função, nunca confiando no front.';

revoke all on function public.fn_salvar_sla_empresa(uuid, integer) from public, anon;
grant execute on function public.fn_salvar_sla_empresa(uuid, integer) to authenticated, service_role;
