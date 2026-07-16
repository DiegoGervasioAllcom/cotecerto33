-- D1 (PR 2/3) — limites de char_length em catálogos e operação. PR3 (auditoria+cotação) depois.

do $$ begin
  alter table public.modelos_franquia add constraint modelos_franquia_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.modelos_franquia add constraint modelos_franquia_descricao_tamanho check (char_length(descricao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.mensagens_prontas add constraint mensagens_prontas_titulo_tamanho check (char_length(titulo) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.mensagens_prontas add constraint mensagens_prontas_conteudo_tamanho check (char_length(conteudo) <= 5000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.perda_motivos add constraint perda_motivos_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.perda_submotivos add constraint perda_submotivos_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.seguradoras add constraint seguradoras_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.seguradoras add constraint seguradoras_codigo_tamanho check (char_length(codigo) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.planos add constraint planos_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.planos add constraint planos_codigo_tamanho check (char_length(codigo) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.planos add constraint planos_descricao_tamanho check (char_length(descricao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.integracoes add constraint integracoes_nome_tamanho check (char_length(nome) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.integracoes add constraint integracoes_descricao_tamanho check (char_length(descricao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.comissao_lancamentos add constraint comissao_lancamentos_descricao_tamanho check (char_length(descricao) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.comissao_lancamentos add constraint comissao_lancamentos_referencia_tamanho check (char_length(referencia) <= 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.comissao_lancamentos add constraint comissao_lancamentos_seguradora_tamanho check (char_length(seguradora) <= 150);
exception when duplicate_object then null; end $$;
