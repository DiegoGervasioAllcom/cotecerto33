-- ============================================================
-- q3_1: mensagens_prontas — coluna "dia" (cadência follow-up) + seed das 13 mensagens oficiais
-- ============================================================

-- ---------- coluna dia (cadência Dia 1..5; null = sem cadência) ----------
alter table public.mensagens_prontas
  add column if not exists dia smallint null;

comment on column public.mensagens_prontas.dia is 'Dia da cadência de follow-up (1..5); null quando a mensagem não pertence a uma cadência sequencial.';

do $$ begin
  alter table public.mensagens_prontas
    add constraint mensagens_prontas_dia_chk check (dia is null or (dia between 1 and 31));
exception when duplicate_object then null; end $$;

-- ---------- seed: 13 mensagens oficiais (globais, oficiais da matriz) ----------

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 1 — WhatsApp inicial', 'Primeiro contato', 'Gerar o primeiro contato, apresentar a corretora e despertar interesse em uma análise gratuita.', 'Olá, {cliente}, tudo bem?

Meu nome é {vendedor} e falo da SUPPER CERTO Corretora de Seguros. 🚙🚀💙

Tentei contato por telefone porque identifiquei que podemos ajudar você a encontrar opções mais vantajosas para seu seguro, com melhor custo-benefício e cobertura adequada às suas necessidades.

Posso fazer uma análise sem compromisso para verificar possíveis economias e melhorias na sua proteção.

Qual o melhor horário para conversarmos❔', 1, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 1 — WhatsApp inicial' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 1 — Follow-up', 'Follow-up', 'Reforçar a abordagem inicial e aumentar as chances de resposta.', 'Olá, {cliente}. 👋

Passando para reforçar meu contato anterior.

Muitas vezes conseguimos reduzir custos ou melhorar as coberturas sem aumentar o valor investido.

Caso tenha interesse, fico à disposição para realizar uma cotação sem compromisso. 🚙', 1, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 1 — Follow-up' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 2 — Reforço da proposta', 'Follow-up', 'Destacar o valor da consultoria e da análise personalizada.', 'Olá, {cliente}.

Gostaria de reforçar que a análise realizada pela SUPPER CERTO é totalmente gratuita e personalizada.

Nosso objetivo não é apenas buscar preço, mas garantir que você tenha a proteção adequada para seu patrimônio, família ou empresa.

Se desejar, posso apresentar algumas opções e condições disponíveis atualmente no mercado.

Posso te ajudar? 🚀💙', 2, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 2 — Reforço da proposta' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 3 — Alternativas e condição diferenciada', 'Follow-up', 'Reduzir objeções e facilitar o processo para o cliente.', 'Olá, {cliente}.

Entendo que sua rotina seja corrida, por isso queria facilitar o processo.

Posso realizar toda a análise de forma digital, sem burocracia e sem necessidade de deslocamento.

Além disso, trabalhamos com diversas seguradoras, o que permite encontrar alternativas mais alinhadas ao seu perfil.

Se preferir, me envie uma foto da sua apólice atual e eu retorno com uma comparação detalhada. 🚙💙', 3, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 3 — Alternativas e condição diferenciada' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 4 — Reativação', 'Follow-up', 'Recuperar o contato e validar se ainda existe interesse.', 'Olá, {cliente}.

Não tive retorno dos contatos anteriores e imaginei que talvez não tenha sido o melhor momento.

Gostaria apenas de confirmar se ainda faz sentido para você receber uma análise comparativa do seu seguro.

Se houver interesse, terei prazer em ajudar.

Caso contrário, sem problemas.

Agradeço sua atenção. 💙🚀', 4, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 4 — Reativação' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Dia 5 — Última tentativa', 'Follow-up', 'Encerrar a cadência de forma profissional, mantendo portas abertas.', 'Olá, {cliente}. 👋

Este será meu último contato referente à análise de seguro que oferecemos na SUPPER CERTO.

Como não obtive retorno, vou encerrar o acompanhamento por enquanto.

Se futuramente precisar de cotação, renovação ou revisão de cobertura, ficaremos à disposição para ajudar.

🚀 Muito obrigado pela atenção e sucesso em seus projetos.

Equipe SUPPER CERTO Corretora de Seguros. 💙', 5, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Dia 5 — Última tentativa' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Reativação (30 a 60 dias)', 'Reativação', 'Reengajar leads antigos com novas oportunidades comerciais.', 'Olá, {cliente}. 👋

Passando para saber como você está.

Recentemente surgiram novas condições e oportunidades junto às seguradoras parceiras da SUPPER CERTO, e lembrei de você.

Caso queira revisar seu seguro ou realizar uma nova cotação, será um prazer ajudar.

Posso verificar algumas opções para você? 💙🚙', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Reativação (30 a 60 dias)' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Primeiro contato (lead recebido)', 'Lead recebido', 'Confirmar o recebimento da solicitação e iniciar o relacionamento.', 'Olá, {cliente}.

Obrigado pelo seu interesse na Supper Certo. 💙

Recebemos sua solicitação de cotação e um de nossos especialistas já está analisando as melhores opções para você.

Enquanto isso, se preferir agilizar o atendimento, envie:

📌 Placa do veículo
📌 Ano do veículo
📌 CEP de pernoite
📌 CPF

Em breve entraremos em contato!

Equipe Supper Certo 🚙🚀💙', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Primeiro contato (lead recebido)' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Confirmação de recebimento', 'Lead recebido', 'Informar que a análise foi iniciada junto às seguradoras.', 'Olá, {cliente}! 👋

Recebemos suas informações com sucesso e já iniciamos a análise junto às seguradoras parceiras.

Em breve retornaremos com as melhores opções para proteger seu veículo.

Qualquer dúvida, estamos à disposição. 💙

Equipe Supper Certo', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Confirmação de recebimento' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Follow-up pós cotação', 'Pós-cotação', 'Confirmar o recebimento da proposta e esclarecer dúvidas.', 'Olá, {cliente}!

Conseguiu analisar a proposta que enviamos?

Caso tenha qualquer dúvida sobre coberturas, assistências ou condições de pagamento, estou à disposição para ajudar. ☺️

Nosso objetivo é garantir a melhor proteção para você e seu veículo. 🚙🚀', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Follow-up pós cotação' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Follow-up 2', 'Pós-cotação', 'Verificar interesse e incentivar o fechamento.', 'Olá, {cliente}! 👋

Passando para verificar se ainda tem interesse em proteger seu veículo.

Sua cotação continua disponível e posso ajudá-lo a encontrar a melhor opção de acordo com sua necessidade e orçamento.

Posso esclarecer alguma dúvida? 💙', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Follow-up 2' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Solicitação de documentos', 'Documentos', 'Obter os documentos necessários para emissão da apólice.', 'Olá, {cliente}! 👋

Para prosseguirmos com a contratação, preciso que envie os seguintes documentos:

📄 Documento do veículo
📄 CNH do condutor principal
📄 Comprovante de residência

🧾 Assim que recebermos, daremos continuidade ao processo.

Obrigado! 💙', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Solicitação de documentos' and m.escopo = 'global'
);

insert into public.mensagens_prontas (escopo, owner_id, titulo, categoria, objetivo, conteudo, dia, ativo)
select 'global', null, 'Campanha de reativação de leads', 'Reativação', 'Reativar oportunidades antigas com novas condições comerciais.', 'Olá, {cliente}! 👋

Há algum tempo realizamos uma cotação para você.

Atualmente temos novas condições, seguradoras e opções de pagamento que podem tornar seu seguro ainda mais vantajoso. 💙

Gostaria que atualizássemos sua cotação sem compromisso? 🚙', null, true
where not exists (
  select 1 from public.mensagens_prontas m where m.titulo = 'Campanha de reativação de leads' and m.escopo = 'global'
);
