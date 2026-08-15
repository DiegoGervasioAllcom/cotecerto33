-- ============================================================
-- Integração de placa (decodificador AR — ws.sisconsulta.com).
-- Toda consulta feita pelo formulário de cotação é gravada aqui:
-- as bem-sucedidas servem de cache (a server function reaproveita
-- consulta da mesma placa feita nos últimos 30 dias em vez de gastar
-- uma nova chamada na API) e as falhas ficam como histórico de
-- auditoria/diagnóstico.
--
-- Escrita SÓ pela server function (service_role) — o front nunca
-- insere aqui, porque a chave da API e o custo por consulta ficam do
-- lado do servidor.
-- ============================================================

create table if not exists public.consultas_placa (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  -- Cotação/empresa são opcionais: a consulta pode acontecer antes de o
  -- rascunho existir (vendedor digita a placa no primeiro passo).
  cotacao_id uuid null references public.cotacoes(id) on delete set null,
  empresa_id uuid null references public.empresas(id) on delete set null,
  consultado_por uuid null references auth.users(id) on delete set null,
  sucesso boolean not null default false,
  -- NuCdRetorno / DsRetorno do XML (0 = "Marca/Modelo/Ano Identificados").
  codigo_retorno text null,
  mensagem_retorno text null,
  -- Erro de transporte/parse (quando nem chegou a haver XML válido).
  erro text null,
  -- Campos decodificados, achatados para consulta/relatório.
  marca text null,
  modelo text null,
  versao text null,
  ano_modelo text null,
  ano_fabricacao text null,
  chassi text null,
  combustivel text null,
  categoria text null,
  tipo_carroceria text null,
  origem text null,
  motor text null,
  local_fabricacao text null,
  -- Primeira opção FIPE retornada (as demais ficam em `payload`).
  fipe_codigo text null,
  fipe_valor numeric(14, 2) null,
  -- Resposta normalizada completa, incluindo todas as versões FIPE.
  payload jsonb null,
  -- XML cru, para auditoria e para depurar divergências com o fornecedor.
  raw_xml text null,
  criado_em timestamptz not null default now(),
  constraint consultas_placa_placa_chk check (char_length(placa) between 5 and 10),
  constraint consultas_placa_marca_chk check (marca is null or char_length(marca) <= 120),
  constraint consultas_placa_modelo_chk check (modelo is null or char_length(modelo) <= 200),
  constraint consultas_placa_versao_chk check (versao is null or char_length(versao) <= 200),
  constraint consultas_placa_chassi_chk check (chassi is null or char_length(chassi) <= 30),
  constraint consultas_placa_erro_chk check (erro is null or char_length(erro) <= 500),
  constraint consultas_placa_raw_chk check (raw_xml is null or char_length(raw_xml) <= 200000),
  constraint consultas_placa_fipe_valor_chk check (fipe_valor is null or fipe_valor > 0)
);

-- Índice do cache: busca a última consulta bem-sucedida de uma placa.
create index if not exists consultas_placa_placa_idx
  on public.consultas_placa (placa, criado_em desc);
create index if not exists consultas_placa_cotacao_idx
  on public.consultas_placa (cotacao_id, criado_em desc);
create index if not exists consultas_placa_empresa_idx
  on public.consultas_placa (empresa_id, criado_em desc);

alter table public.consultas_placa enable row level security;

grant select on public.consultas_placa to authenticated;
grant all on public.consultas_placa to service_role;

-- Leitura: quem consultou vê a própria consulta; matriz/master enxergam
-- as consultas das empresas visíveis (mesma escala de hierarquia usada
-- no resto do sistema).
drop policy if exists consultas_placa_select on public.consultas_placa;
create policy consultas_placa_select on public.consultas_placa
  for select to authenticated
  using (
    consultado_por = auth.uid()
    or (
      empresa_id is not null
      and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      and (
        public.has_role(auth.uid(), 'matriz')
        or public.has_role(auth.uid(), 'master')
      )
    )
  );

-- Sem policy de insert/update/delete para `authenticated`: a gravação é
-- exclusiva da server function com service_role (que ignora RLS).
