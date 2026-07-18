-- ===========================================================================
-- 049 (G4.3) — Motor de comissão do vendedor CLT (cálculo puro)
--
-- Só o CÁLCULO determinístico (fn_comissao_clt). Não grava lançamento algum —
-- isso é da fatia G4.4 (RPC de fechamento). Números extraídos do protótipo
-- (já seedados como texto em clt_config desde a 005): ver colunas novas
-- `progressiva_num` / `fator_novas_num` / `fator_remalho_num` abaixo, que são
-- a MESMA informação num shape numérico estruturado (as colunas de texto
-- ["rótulo","valor"] continuam existindo e alimentando a tela de configuração
-- atual; não foram tocadas).
--
-- Faixas progressivas (7, extraídas do seed da 005 — 2,00% a 3,50%):
--   até 40.000,00        -> 2,00%
--   40.000,01 – 55.000   -> 2,25%
--   55.000,01 – 65.000   -> 2,50%
--   65.000,01 – 75.000   -> 2,75%
--   75.000,01 – 85.000   -> 3,00%
--   85.000,01 – 100.000  -> 3,25%
--   acima de 100.000     -> 3,50%
--
-- Fator "novas" (mapeia % médio de comissão do vendedor nas vendas tipo_venda
-- = 'novo' -> fator multiplicador sobre a comissão calculada):
--   < 17%            -> 70%
--   17% a 18%        -> 80%
--   18,01% a 19%     -> 90%
--   19,01% a 20%     -> 95%
--   acima de 20%     -> 100%
--
-- Fator "remanejo" (mesma lógica, vendas tipo_venda = 'renovacao'):
--   < 14%            -> 70%
--   14% a 15%        -> 80%
--   15,01% a 16%     -> 90%
--   16,01% a 17%     -> 95%
--   acima de 17%     -> 100%
--
-- Decisão do usuário: o fator é calculado pela média de % de comissão DO
-- PRÓPRIO VENDEDOR (não da equipe) — usa-se `propostas.comissao_pct` das
-- propostas pagas do vendedor na competência, separadas por
-- coalesce(tipo_venda,'novo') = 'novo' | 'renovacao'. O fator final aplicado
-- ao valor calculado é a média ponderada (por produção) dos dois fatores;
-- se não houver propostas de um dos dois grupos, aquele fator não entra na
-- ponderação; se não houver NENHUMA proposta na competência, fator = 1.0.
--
-- Faixa Elite individual (profiles.faixa_elite_valor/faixa_elite_pct, G1.4):
-- modelo EXCEDENTE (progressivo estilo IR) — o % Elite incide só sobre a
-- produção acima do limiar; o restante paga a faixa normal (pct da faixa
-- determinado pela produção TOTAL, não pela produção descontada do limiar).
--
-- Base de cálculo: "prêmio líquido = prêmio − juros − IOF 7,38%" (conforme
-- clt_config.regras.iof), mas `propostas` só guarda `premio` bruto — não há
-- colunas de juros/IOF discriminadas no schema hoje. Não inventamos a
-- dedução: a base usada é `propostas.premio` (bruto), documentado em
-- `comissao_regras.parametros` do papel vendedor_clt (`base_calculo` +
-- `iof_pct_documentado`, ambos só informativos até o schema ganhar as
-- colunas necessárias — nenhuma lógica de dedução roda hoje).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas numéricas estruturadas em clt_config (aditivas, nullable/array)
-- ---------------------------------------------------------------------------
alter table public.clt_config
  add column if not exists progressiva_num   jsonb not null default '[]'::jsonb,
  add column if not exists fator_novas_num    jsonb not null default '[]'::jsonb,
  add column if not exists fator_remalho_num  jsonb not null default '[]'::jsonb;

comment on column public.clt_config.progressiva_num is
  'Faixas progressivas em shape numérico: array de {ate: number|null, pct: number
   0-100}, ordenado por `ate` ascendente, último elemento com ate=null (faixa
   catch-all "e acima"). Produção <= ate cai naquela faixa (senão a seguinte).
   Fonte da verdade pro cálculo (fn_comissao_clt); progressiva (texto) segue
   alimentando a tela de configuração.';
comment on column public.clt_config.fator_novas_num is
  'Fator multiplicador conforme % médio de comissão do vendedor em vendas
   novas: array de {limite: number|null, comparador: "menor"|"menor_igual"|
   null, fator: number 0-100 (percentual, não fração)}, avaliado em ordem —
   primeiro que casar vence; limite=null é o catch-all final.';
comment on column public.clt_config.fator_remalho_num is
  'Mesmo shape de fator_novas_num, para vendas de renovação/remanejo.';

-- ---------- Validação de shape (padrão D4: tolera chaves ausentes/extras) ----------

create or replace function public.jsonb_faixas_pct_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'array'
    and jsonb_array_length(j) > 0
    and bool_and(
      jsonb_typeof(e) = 'object'
      and (e ? 'pct')
      and jsonb_typeof(e -> 'pct') = 'number'
      and (e ->> 'pct')::numeric between 0 and 100
      and (
        not (e ? 'ate')
        or jsonb_typeof(e -> 'ate') = 'null'
        or (jsonb_typeof(e -> 'ate') = 'number' and (e ->> 'ate')::numeric >= 0)
      )
    )
  from jsonb_array_elements(j) e;
$$;

comment on function public.jsonb_faixas_pct_ok(jsonb) is
  'Shape de clt_config.progressiva_num: array não-vazio de {ate: number|null
   >=0, pct: number 0-100}. Array vazio (ainda não seedado) reprova de
   propósito — diferente do padrão D4 de pair_array — porque a fn de cálculo
   depende dessas faixas existirem para não quebrar em runtime.';

create or replace function public.jsonb_fator_faixas_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'array'
    and jsonb_array_length(j) > 0
    and bool_and(
      jsonb_typeof(e) = 'object'
      and (e ? 'fator')
      and jsonb_typeof(e -> 'fator') = 'number'
      and (e ->> 'fator')::numeric between 0 and 100
      and (
        not (e ? 'limite')
        or jsonb_typeof(e -> 'limite') = 'null'
        or (jsonb_typeof(e -> 'limite') = 'number' and (e ->> 'limite')::numeric >= 0)
      )
      and (
        not (e ? 'comparador')
        or jsonb_typeof(e -> 'comparador') = 'null'
        or (e ->> 'comparador') in ('menor', 'menor_igual')
      )
    )
  from jsonb_array_elements(j) e;
$$;

comment on function public.jsonb_fator_faixas_ok(jsonb) is
  'Shape de clt_config.fator_novas_num/fator_remalho_num: array não-vazio de
   {limite: number|null >=0, comparador: "menor"|"menor_igual"|null,
   fator: number 0-100}.';

-- Os CHECKs são adicionados DEPOIS do seed abaixo (a validação exige array
-- não-vazio; o default '[]' das colunas recém-criadas violaria o check antes
-- de serem semeadas).

-- ---------- Seed numérico (idempotente: só semeia se o array estiver vazio) ----------

update public.clt_config
   set progressiva_num = '[
     {"ate": 40000,  "pct": 2.00},
     {"ate": 55000,  "pct": 2.25},
     {"ate": 65000,  "pct": 2.50},
     {"ate": 75000,  "pct": 2.75},
     {"ate": 85000,  "pct": 3.00},
     {"ate": 100000, "pct": 3.25},
     {"ate": null,   "pct": 3.50}
   ]'::jsonb
 where id = 'default' and jsonb_array_length(progressiva_num) = 0;

update public.clt_config
   set fator_novas_num = '[
     {"limite": 17,   "comparador": "menor",       "fator": 70},
     {"limite": 18,   "comparador": "menor_igual", "fator": 80},
     {"limite": 19,   "comparador": "menor_igual", "fator": 90},
     {"limite": 20,   "comparador": "menor_igual", "fator": 95},
     {"limite": null, "comparador": null,           "fator": 100}
   ]'::jsonb
 where id = 'default' and jsonb_array_length(fator_novas_num) = 0;

update public.clt_config
   set fator_remalho_num = '[
     {"limite": 14,   "comparador": "menor",       "fator": 70},
     {"limite": 15,   "comparador": "menor_igual", "fator": 80},
     {"limite": 16,   "comparador": "menor_igual", "fator": 90},
     {"limite": 17,   "comparador": "menor_igual", "fator": 95},
     {"limite": null, "comparador": null,           "fator": 100}
   ]'::jsonb
 where id = 'default' and jsonb_array_length(fator_remalho_num) = 0;

-- ---------- CHECKs de shape (depois do seed, ver nota acima) ----------

do $$ begin
  alter table public.clt_config
    add constraint clt_config_progressiva_num_shape check (public.jsonb_faixas_pct_ok(progressiva_num));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_fator_novas_num_shape check (public.jsonb_fator_faixas_ok(fator_novas_num));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clt_config
    add constraint clt_config_fator_remalho_num_shape check (public.jsonb_fator_faixas_ok(fator_remalho_num));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) Documenta a base de cálculo (premio bruto) nos parâmetros de
--    comissao_regras.vendedor_clt, seedada na 047 — não afrouxa nada, só
--    acrescenta chaves informativas (jsonb_comissao_regras_ok já tolera
--    string/number/boolean/array como valor de 1º nível).
-- ---------------------------------------------------------------------------
update public.comissao_regras
   set parametros = parametros
     || jsonb_build_object(
          'base_calculo', 'premio_bruto',
          'iof_pct_documentado', 7.38,
          'observacao_iof',
          'clt_config.regras.iof cita 7,38% de IOF e exclusão de juros da base, mas propostas.premio não discrimina esses componentes hoje — a dedução não é aplicada (não há como computá-la); fn_comissao_clt usa premio bruto. Ajustar quando o schema ganhar as colunas.'
        ),
       atualizado_em = now()
 where papel = 'vendedor_clt'
   and not (parametros ? 'base_calculo');

-- ---------------------------------------------------------------------------
-- 3) fn_comissao_clt — cálculo puro (não grava nada)
--    STABLE, security definer (lê profiles/empresas/clt_config sem depender
--    da RLS de quem chama), search_path fixo. EXECUTE revogado de
--    public/anon/authenticated: é peça interna do motor, chamada pela RPC de
--    fechamento (G4.4) que roda com privilégio elevado; testes chamam via
--    service_role/postgres (mesma lição da fn_pct_comissao_efetivo, 048).
-- ---------------------------------------------------------------------------
create or replace function public.fn_comissao_clt(p_vendedor uuid, p_competencia text)
returns table(
  vendedor_id        uuid,
  competencia        text,
  producao_total     numeric,
  producao_novas     numeric,
  producao_remanejo  numeric,
  pct_faixa          numeric,
  valor_base         numeric,
  valor_elite        numeric,
  fator_novas        numeric,
  fator_remanejo     numeric,
  fator_aplicado     numeric,
  valor_final        numeric,
  regra              jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cfg              record;
  _elite_valor      numeric;
  _elite_pct        numeric;
  _producao_total   numeric := 0;
  _producao_novas   numeric := 0;
  _producao_remanejo numeric := 0;
  _pct_medio_novas  numeric;
  _pct_medio_remanejo numeric;
  _pct_faixa        numeric := 0;
  _valor_base       numeric := 0;
  _valor_elite      numeric := 0;
  _fator_novas      numeric := 100;
  _fator_remanejo   numeric := 100;
  _fator_aplicado   numeric := 1;
  _valor_final      numeric := 0;
  _regra            jsonb;
begin
  if p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'competência inválida: %', p_competencia;
  end if;

  select * into _cfg from public.clt_config where id = 'default';

  select e.faixa_elite_valor, e.faixa_elite_pct
    into _elite_valor, _elite_pct
    from public.profiles e
   where e.id = p_vendedor;

  -- Produção total e por grupo (novas/remanejo), só propostas pagas e não
  -- canceladas, na competência alvo (competência derivada de pago_em).
  select
    coalesce(sum(p.premio), 0),
    coalesce(sum(p.premio) filter (where coalesce(p.tipo_venda, 'novo') = 'novo'), 0),
    coalesce(sum(p.premio) filter (where coalesce(p.tipo_venda, 'novo') = 'renovacao'), 0),
    avg(p.comissao_pct) filter (where coalesce(p.tipo_venda, 'novo') = 'novo'),
    avg(p.comissao_pct) filter (where coalesce(p.tipo_venda, 'novo') = 'renovacao')
    into _producao_total, _producao_novas, _producao_remanejo,
         _pct_medio_novas, _pct_medio_remanejo
    from public.propostas p
   where p.responsavel_id = p_vendedor
     and p.pago_em is not null
     and p.cancelada_em is null
     and public.fn_competencia(p.pago_em) = p_competencia;

  -- % da faixa progressiva pela produção TOTAL.
  select (f ->> 'pct')::numeric
    into _pct_faixa
    from jsonb_array_elements(_cfg.progressiva_num) f
   where f -> 'ate' is null or jsonb_typeof(f -> 'ate') = 'null'
      or (f ->> 'ate')::numeric >= _producao_total
   order by (case when f -> 'ate' is null or jsonb_typeof(f -> 'ate') = 'null'
                  then 'infinity'::numeric else (f ->> 'ate')::numeric end) asc
   limit 1;
  _pct_faixa := coalesce(_pct_faixa, 0);

  -- Faixa Elite individual: modelo EXCEDENTE.
  if _elite_valor is not null and _elite_pct is not null then
    _valor_base  := least(_producao_total, _elite_valor) * _pct_faixa / 100.0;
    _valor_elite := greatest(_producao_total - _elite_valor, 0) * _elite_pct / 100.0;
  else
    _valor_base  := _producao_total * _pct_faixa / 100.0;
    _valor_elite := 0;
  end if;

  -- Fator novas: lookup por _pct_medio_novas (se houver produção "novas").
  if _pct_medio_novas is not null then
    select (f ->> 'fator')::numeric
      into _fator_novas
      from jsonb_array_elements(_cfg.fator_novas_num) f
     where f -> 'limite' is null or jsonb_typeof(f -> 'limite') = 'null'
        or (
             (f ->> 'comparador') = 'menor' and _pct_medio_novas < (f ->> 'limite')::numeric
           ) or (
             (f ->> 'comparador') = 'menor_igual' and _pct_medio_novas <= (f ->> 'limite')::numeric
           )
     order by (case when f -> 'limite' is null or jsonb_typeof(f -> 'limite') = 'null'
                    then 'infinity'::numeric else (f ->> 'limite')::numeric end) asc
     limit 1;
    _fator_novas := coalesce(_fator_novas, 100);
  else
    _fator_novas := 100;
  end if;

  -- Fator remanejo: lookup por _pct_medio_remanejo (se houver produção de renovação).
  if _pct_medio_remanejo is not null then
    select (f ->> 'fator')::numeric
      into _fator_remanejo
      from jsonb_array_elements(_cfg.fator_remalho_num) f
     where f -> 'limite' is null or jsonb_typeof(f -> 'limite') = 'null'
        or (
             (f ->> 'comparador') = 'menor' and _pct_medio_remanejo < (f ->> 'limite')::numeric
           ) or (
             (f ->> 'comparador') = 'menor_igual' and _pct_medio_remanejo <= (f ->> 'limite')::numeric
           )
     order by (case when f -> 'limite' is null or jsonb_typeof(f -> 'limite') = 'null'
                    then 'infinity'::numeric else (f ->> 'limite')::numeric end) asc
     limit 1;
    _fator_remanejo := coalesce(_fator_remanejo, 100);
  else
    _fator_remanejo := 100;
  end if;

  -- Fator aplicado: média ponderada por produção dos dois fatores (100 = 1.0x).
  if _producao_total = 0 then
    _fator_aplicado := 1;
  else
    _fator_aplicado :=
      ((_producao_novas * _fator_novas) + (_producao_remanejo * _fator_remanejo))
      / _producao_total / 100.0;
  end if;

  _valor_final := (_valor_base + _valor_elite) * _fator_aplicado;

  _regra := jsonb_build_object(
    'producao_total', _producao_total,
    'producao_novas', _producao_novas,
    'producao_remanejo', _producao_remanejo,
    'pct_faixa', _pct_faixa,
    'faixa_elite_valor', _elite_valor,
    'faixa_elite_pct', _elite_pct,
    'pct_medio_novas', _pct_medio_novas,
    'pct_medio_remanejo', _pct_medio_remanejo,
    'fator_novas', _fator_novas,
    'fator_remanejo', _fator_remanejo,
    'fator_aplicado', _fator_aplicado,
    'base_calculo', 'premio_bruto',
    'progressiva_num', _cfg.progressiva_num
  );

  return query select
    p_vendedor, p_competencia,
    _producao_total, _producao_novas, _producao_remanejo,
    _pct_faixa, _valor_base, _valor_elite,
    _fator_novas, _fator_remanejo, _fator_aplicado,
    _valor_final, _regra;
end;
$$;

comment on function public.fn_comissao_clt(uuid, text) is
  'G4.3: cálculo puro da comissão do vendedor CLT numa competência (faixa
   progressiva sobre a produção total + faixa Elite individual excedente +
   fator novas/remanejo pela média de % de comissão do PRÓPRIO vendedor).
   Não grava lançamento — isso é da RPC de fechamento (G4.4). security
   definer / search_path fixo; EXECUTE revogado de public/anon/authenticated
   (uso interno, ver comentário na declaração).';

revoke execute on function public.fn_comissao_clt(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_comissao_clt(uuid, text) to service_role;
