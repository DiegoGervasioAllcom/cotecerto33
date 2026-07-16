-- ============================================================
-- D4 — validação de schema dos jsonb
--
-- Defesa em profundidade: hoje várias colunas jsonb (parâmetros de
-- comissionamento CLT, critérios de distribuição de leads, params de
-- modelos de franquia, dados de cadastro/lead/ações/presença) só têm o
-- shape garantido pelo front. Este migration adiciona CHECKs no banco
-- para barrar valores fora do formato esperado, sem exigir chaves
-- específicas (chaves ausentes são toleradas; só o TIPO das chaves
-- presentes é validado) — assim os defaults/seeds continuam válidos e
-- novas chaves futuras não quebram o check.
-- ============================================================

-- ---------- Funções auxiliares ----------

-- true se `j` é array e cada elemento é um array de exatamente 2 strings
-- (par [rótulo, valor] usado nas tabelas de faixas do clt_config).
-- Array vazio ('[]', default das colunas) retorna true.
create or replace function public.jsonb_is_pair_array(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'array'
    and coalesce(
      (
        select bool_and(
          jsonb_typeof(e) = 'array'
          and jsonb_array_length(e) = 2
          and jsonb_typeof(e -> 0) = 'string'
          and jsonb_typeof(e -> 1) = 'string'
        )
        from jsonb_array_elements(j) e
      ),
      true
    );
$$;

-- true se `j` é objeto e, para cada chave conhecida PRESENTE, o tipo bate
-- com o shape de `clt_config.regras` (apuracao_ini/apuracao_fim/pagamento/iof
-- são string; rules é array). Chaves ausentes ou extras não invalidam.
create or replace function public.jsonb_clt_regras_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'object'
    and (not (j ? 'apuracao_ini') or jsonb_typeof(j -> 'apuracao_ini') = 'string')
    and (not (j ? 'apuracao_fim') or jsonb_typeof(j -> 'apuracao_fim') = 'string')
    and (not (j ? 'pagamento') or jsonb_typeof(j -> 'pagamento') = 'string')
    and (not (j ? 'iof') or jsonb_typeof(j -> 'iof') = 'string')
    and (not (j ? 'rules') or jsonb_typeof(j -> 'rules') = 'array');
$$;

-- true se `j` é objeto e, para cada chave conhecida
-- (regiao,franquia,disp,conv,volume,horario) PRESENTE, o valor é boolean.
-- Chaves ausentes ou extras não invalidam (shape de distribuicao_config.criterios).
create or replace function public.jsonb_criterios_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'object'
    and (not (j ? 'regiao') or jsonb_typeof(j -> 'regiao') = 'boolean')
    and (not (j ? 'franquia') or jsonb_typeof(j -> 'franquia') = 'boolean')
    and (not (j ? 'disp') or jsonb_typeof(j -> 'disp') = 'boolean')
    and (not (j ? 'conv') or jsonb_typeof(j -> 'conv') = 'boolean')
    and (not (j ? 'volume') or jsonb_typeof(j -> 'volume') = 'boolean')
    and (not (j ? 'horario') or jsonb_typeof(j -> 'horario') = 'boolean');
$$;

-- ---------- clt_config: tabelas de faixa [rótulo, valor] ----------
-- ituran_planos/ituran_adic foram renomeadas para seguradora_planos/seguradora_adic
-- em 20240101000006_rename_ituran_to_seguradora.sql; usa-se o nome atual aqui.

do $$ begin
  alter table public.clt_config
    add constraint clt_config_progressiva_shape check (public.jsonb_is_pair_array(progressiva));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_fator_novas_shape check (public.jsonb_is_pair_array(fator_novas));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_fator_remalho_shape check (public.jsonb_is_pair_array(fator_remalho));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_seguradora_planos_shape check (public.jsonb_is_pair_array(seguradora_planos));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_seguradora_adic_shape check (public.jsonb_is_pair_array(seguradora_adic));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_regras_shape check (public.jsonb_clt_regras_ok(regras));
exception when duplicate_object then null; end $$;

-- ---------- distribuicao_config: critérios booleanos ----------

do $$ begin
  alter table public.distribuicao_config
    add constraint distribuicao_config_criterios_shape check (public.jsonb_criterios_ok(criterios));
exception when duplicate_object then null; end $$;

-- ---------- demais jsonb: pelo menos objeto (não escalar, não array) ----------

-- modelos_franquia.params: not null, default '{}'.
do $$ begin
  alter table public.modelos_franquia
    add constraint modelos_franquia_params_object check (jsonb_typeof(params) = 'object');
exception when duplicate_object then null; end $$;

-- empresas.dados_cadastro: not null, default '{}'.
do $$ begin
  alter table public.empresas
    add constraint empresas_dados_cadastro_object check (jsonb_typeof(dados_cadastro) = 'object');
exception when duplicate_object then null; end $$;

-- leads.dados: nullable, default '{}'.
do $$ begin
  alter table public.leads
    add constraint leads_dados_object check (dados is null or jsonb_typeof(dados) = 'object');
exception when duplicate_object then null; end $$;

-- lead_eventos.meta: not null, default '{}' (plano citava "lead_acoes" — a tabela
-- de fato criada em 20240101000016_lead_acoes.sql é public.lead_eventos).
do $$ begin
  alter table public.lead_eventos
    add constraint lead_eventos_meta_object check (jsonb_typeof(meta) = 'object');
exception when duplicate_object then null; end $$;

-- presence_eventos.meta: nullable, sem default (plano citava user_presence.meta,
-- mas essa coluna não existe em user_presence — a coluna jsonb de metadados de
-- presença é presence_eventos.meta).
do $$ begin
  alter table public.presence_eventos
    add constraint presence_eventos_meta_object check (meta is null or jsonb_typeof(meta) = 'object');
exception when duplicate_object then null; end $$;
