-- D1 (PR 3/3) — limites de char_length em auditoria (presença/leads/login) e no wizard de cotação.
--
-- Colunas puladas (motivo):
-- - user_presence.status: já tem check in ('online','ausente','offline').
-- - presence_eventos.tipo: já tem check in ('entrou','saiu','ausente','retornou').

-- ---------- user_presence ----------
do $$ begin
  alter table public.user_presence add constraint user_presence_user_agent_tamanho check (char_length(user_agent) <= 500);
exception when duplicate_object then null; end $$;

-- ---------- presence_eventos ----------
do $$ begin
  alter table public.presence_eventos add constraint presence_eventos_user_agent_tamanho check (char_length(user_agent) <= 500);
exception when duplicate_object then null; end $$;

-- ---------- lead_eventos ----------
do $$ begin
  alter table public.lead_eventos add constraint lead_eventos_titulo_tamanho check (char_length(titulo) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.lead_eventos add constraint lead_eventos_descricao_tamanho check (char_length(descricao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.lead_eventos add constraint lead_eventos_tipo_tamanho check (char_length(tipo) <= 50);
exception when duplicate_object then null; end $$;

-- ---------- login_audit ----------
do $$ begin
  alter table public.login_audit add constraint login_audit_email_tamanho check (char_length(email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.login_audit add constraint login_audit_motivo_falha_tamanho check (char_length(motivo_falha) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.login_audit add constraint login_audit_ip_tamanho check (char_length(ip) <= 45);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.login_audit add constraint login_audit_user_agent_tamanho check (char_length(user_agent) <= 500);
exception when duplicate_object then null; end $$;

-- ---------- cotacoes ----------
do $$ begin
  alter table public.cotacoes add constraint cotacoes_ramo_tamanho check (char_length(ramo) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes add constraint cotacoes_motivo_perda_tamanho check (char_length(motivo_perda) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes add constraint cotacoes_submotivo_perda_tamanho check (char_length(submotivo_perda) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes add constraint cotacoes_observacao_perda_tamanho check (char_length(observacao_perda) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes add constraint cotacoes_destino_perda_sugerido_tamanho check (char_length(destino_perda_sugerido) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes add constraint cotacoes_destino_perda_tamanho check (char_length(destino_perda) <= 30);
exception when duplicate_object then null; end $$;

-- ---------- leads ----------
-- Nota: `destino_perda_final` não existe em `cotacoes` (o revisor apontou o
-- nome errado) — ela foi adicionada em `leads` por 20240101000014_perda_matriz.sql,
-- irmã de leads.destino_perda_sugerido/motivo_perda/submotivo_perda/observacao_perda.
do $$ begin
  alter table public.leads add constraint leads_destino_perda_final_tamanho check (char_length(destino_perda_final) <= 30);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_segurado ----------
do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_cpf_cnpj_tamanho check (char_length(cpf_cnpj) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_nome_social_tamanho check (char_length(nome_social) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_sexo_tamanho check (char_length(sexo) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_estado_civil_tamanho check (char_length(estado_civil) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_pessoa_tamanho check (char_length(pessoa) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_celular_tamanho check (char_length(celular) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_tel_res_tamanho check (char_length(tel_res) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_email_tamanho check (char_length(email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_cep_tamanho check (char_length(cep) <= 9);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_logradouro_tamanho check (char_length(logradouro) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_bairro_tamanho check (char_length(bairro) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_cidade_tamanho check (char_length(cidade) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_segurado add constraint cotacao_segurado_uf_tamanho check (char_length(uf) <= 2);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_seguro ----------
do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_tipo_seguro_tamanho check (char_length(tipo_seguro) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_categoria_tamanho check (char_length(categoria) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_ramo_tamanho check (char_length(ramo) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_cia_atual_tamanho check (char_length(cia_atual) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_ci_atual_tamanho check (char_length(ci_atual) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_classe_bonus_tamanho check (char_length(classe_bonus) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro add constraint cotacao_seguro_apolice_atual_tamanho check (char_length(apolice_atual) <= 50);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_veiculo ----------
do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_placa_tamanho check (char_length(placa) <= 8);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_chassi_tamanho check (char_length(chassi) <= 17);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_renavam_tamanho check (char_length(renavam) <= 11);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_marca_codigo_tamanho check (char_length(marca_codigo) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_modelo_codigo_tamanho check (char_length(modelo_codigo) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_marca_nome_tamanho check (char_length(marca_nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_modelo_nome_tamanho check (char_length(modelo_nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_ano_modelo_tamanho check (char_length(ano_modelo) <= 4);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_ano_fab_tamanho check (char_length(ano_fab) <= 4);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_combustivel_tamanho check (char_length(combustivel) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_cor_tamanho check (char_length(cor) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_banco_tamanho check (char_length(banco) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_uso_comercial_tamanho check (char_length(uso_comercial) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_km_mensal_tamanho check (char_length(km_mensal) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_veiculo add constraint cotacao_veiculo_fipe_valor_tamanho check (char_length(fipe_valor) <= 100);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_perfil ----------
do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_cond_cpf_tamanho check (char_length(cond_cpf) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_cond_nome_tamanho check (char_length(cond_nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_cond_sexo_tamanho check (char_length(cond_sexo) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_cond_estado_civil_tamanho check (char_length(cond_estado_civil) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_profissao_tamanho check (char_length(profissao) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_perfil add constraint cotacao_perfil_cep_pernoite_tamanho check (char_length(cep_pernoite) <= 9);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_coberturas ----------
do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_tipo_cobertura_tamanho check (char_length(tipo_cobertura) <= 50);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_casco_tamanho check (char_length(casco) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_casco_valor_tamanho check (char_length(casco_valor) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_franquia_tamanho check (char_length(franquia) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_app_morte_tamanho check (char_length(app_morte) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_app_invalidez_tamanho check (char_length(app_invalidez) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_dmh_tamanho check (char_length(dmh) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_rcf_dm_tamanho check (char_length(rcf_dm) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_rcf_dc_tamanho check (char_length(rcf_dc) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_carro_reserva_tamanho check (char_length(carro_reserva) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_coberturas add constraint cotacao_coberturas_assist_24_tamanho check (char_length(assist_24) <= 30);
exception when duplicate_object then null; end $$;

-- ---------- cotacao_premios ----------
do $$ begin
  alter table public.cotacao_premios add constraint cotacao_premios_seguradora_tamanho check (char_length(seguradora) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_premios add constraint cotacao_premios_cobertura_tamanho check (char_length(cobertura) <= 2000);
exception when duplicate_object then null; end $$;
