-- D1 (PR 1/3) — limites de char_length no CRM core; PR2 (catálogos) e PR3 (auditoria+cotação) depois.

do $$ begin
  alter table public.empresas add constraint empresas_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_documento_tamanho check (char_length(documento) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_endereco_tamanho check (char_length(endereco) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_celular_tamanho check (char_length(celular) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_telefone_tamanho check (char_length(telefone) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_telefone_recado_tamanho check (char_length(telefone_recado) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_socio_nome_tamanho check (char_length(socio_nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_socio_cpf_tamanho check (char_length(socio_cpf) <= 14);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_socio_rg_tamanho check (char_length(socio_rg) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_rg_tamanho check (char_length(rg) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_contato_emergencia_tamanho check (char_length(contato_emergencia) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_pix_chave_tamanho check (char_length(pix_chave) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_dados_bancarios_tamanho check (char_length(dados_bancarios) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_cidade_tamanho check (char_length(cidade) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_uf_tamanho check (char_length(uf) <= 2);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_email_tamanho check (char_length(email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas add constraint empresas_recusa_motivo_tamanho check (char_length(recusa_motivo) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_email_tamanho check (char_length(email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_avatar_url_tamanho check (char_length(avatar_url) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_desligado_motivo_tamanho check (char_length(desligado_motivo) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pipeline_stages add constraint pipeline_stages_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pipeline_stages add constraint pipeline_stages_cor_tamanho check (char_length(cor) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes add constraint clientes_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes add constraint clientes_documento_tamanho check (char_length(documento) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes add constraint clientes_email_tamanho check (char_length(email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clientes add constraint clientes_telefone_tamanho check (char_length(telefone) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_origem_tamanho check (char_length(origem) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_contato_tamanho check (char_length(contato) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_motivo_bloqueio_tamanho check (char_length(motivo_bloqueio) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.oportunidades add constraint oportunidades_observacao_tamanho check (char_length(observacao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_numero_tamanho check (char_length(numero) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_status_tamanho check (char_length(status) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_apolice_numero_tamanho check (char_length(apolice_numero) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_tipo_venda_tamanho check (char_length(tipo_venda) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_forma_pagamento_tamanho check (char_length(forma_pagamento) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_cancelamento_motivo_tamanho check (char_length(cancelamento_motivo) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_seguradora_tamanho check (char_length(seguradora) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas add constraint propostas_transmissao_obs_tamanho check (char_length(transmissao_obs) <= 2000);
exception when duplicate_object then null; end $$;
