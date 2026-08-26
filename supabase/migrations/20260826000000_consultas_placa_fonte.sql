-- Registra qual provedor respondeu a consulta de placa, agora que existe
-- fallback: sisconsulta (principal) e wdapi2 (usada só quando a principal
-- falha ou não identifica o veículo). Ver src/lib/placa.functions.ts.

alter table public.consultas_placa
  add column if not exists fonte text not null default 'sisconsulta';

alter table public.consultas_placa
  add constraint consultas_placa_fonte_chk
  check (fonte in ('sisconsulta', 'wdapi2'));
