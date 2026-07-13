-- Mensagens prontas: add categoria + objetivo for curatorial view
alter table public.mensagens_prontas
  add column if not exists categoria text,
  add column if not exists objetivo text;

create index if not exists msg_categoria_idx on public.mensagens_prontas(categoria);
