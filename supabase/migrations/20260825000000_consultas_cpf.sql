-- ============================================================
-- Integração de CPF (localização simples — ws.sisconsulta.com,
-- mesma conta usada pelo decodificador de placa). Toda consulta feita
-- pelo formulário de cotação é gravada aqui: as bem-sucedidas servem de
-- cache (a server function reaproveita consulta do mesmo CPF feita nos
-- últimos 30 dias em vez de gastar uma nova chamada na API) e as falhas
-- ficam como histórico de auditoria/diagnóstico.
--
-- Contém dados pessoais sensíveis (nome da mãe, endereço, telefone,
-- e-mail) — igual a `consultas_placa`, escrita SÓ pela server function
-- (service_role); o front nunca insere aqui.
-- ============================================================

create table if not exists public.consultas_cpf (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  -- Cotação/empresa são opcionais: a consulta pode acontecer antes de o
  -- rascunho existir (vendedor digita o CPF no primeiro passo).
  cotacao_id uuid null references public.cotacoes(id) on delete set null,
  empresa_id uuid null references public.empresas(id) on delete set null,
  consultado_por uuid null references auth.users(id) on delete set null,
  sucesso boolean not null default false,
  codigo_retorno text null,
  mensagem_retorno text null,
  -- Erro de transporte/parse (quando nem chegou a haver XML válido).
  erro text null,
  -- Campos decodificados, achatados para consulta/relatório.
  nome text null,
  sexo text null,
  data_nascimento date null,
  nome_mae text null,
  estado_civil text null,
  celular text null,
  email text null,
  endereco_logradouro text null,
  endereco_numero text null,
  endereco_complemento text null,
  endereco_bairro text null,
  endereco_cidade text null,
  endereco_uf text null,
  endereco_cep text null,
  -- Resposta normalizada completa.
  payload jsonb null,
  -- XML cru, para auditoria e para depurar divergências com o fornecedor.
  raw_xml text null,
  criado_em timestamptz not null default now(),
  constraint consultas_cpf_cpf_chk check (char_length(cpf) = 11),
  constraint consultas_cpf_nome_chk check (nome is null or char_length(nome) <= 150),
  constraint consultas_cpf_nome_mae_chk check (nome_mae is null or char_length(nome_mae) <= 150),
  constraint consultas_cpf_erro_chk check (erro is null or char_length(erro) <= 500),
  constraint consultas_cpf_raw_chk check (raw_xml is null or char_length(raw_xml) <= 200000)
);

-- Índice do cache: busca a última consulta bem-sucedida de um CPF.
create index if not exists consultas_cpf_cpf_idx
  on public.consultas_cpf (cpf, criado_em desc);
create index if not exists consultas_cpf_cotacao_idx
  on public.consultas_cpf (cotacao_id, criado_em desc);
create index if not exists consultas_cpf_empresa_idx
  on public.consultas_cpf (empresa_id, criado_em desc);

alter table public.consultas_cpf enable row level security;

grant select on public.consultas_cpf to authenticated;
grant all on public.consultas_cpf to service_role;

-- Leitura: quem consultou vê a própria consulta; matriz/master enxergam
-- as consultas das empresas visíveis (mesma escala de hierarquia usada
-- no resto do sistema).
drop policy if exists consultas_cpf_select on public.consultas_cpf;
create policy consultas_cpf_select on public.consultas_cpf
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
