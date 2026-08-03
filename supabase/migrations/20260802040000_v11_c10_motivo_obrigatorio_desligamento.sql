-- ===========================================================================
-- V11 · C10 (Frente 3) — motivo obrigatório em todo desligamento
--
-- Achado ao implementar C7: `desligar_usuario` (20240101000002_modelos_metas,
-- V10) é uma RPC morta — nenhuma tela do front chama ela hoje — mas continua
-- com EXECUTE liberado a PUBLIC, sem checar se o alvo está na rede de quem
-- chama (Master podia desligar QUALQUER pessoa do sistema, não só a própria
-- rede), sem a trava de dependentes (C6) e com motivo opcional (`default
-- null`). Ou seja: um bypass total de C6/C7 que sobreviveu à V10. Removida
-- aqui — os dois caminhos vivos hoje (`admin_set_usuario_status`,
-- `excluir_cadastro_rede`) cobrem tudo que ela fazia, com trava e escopo.
--
-- O `check` abaixo fecha a porta de verdade: não importa por qual caminho o
-- desligamento aconteça no futuro, `status='suspensa'` sem `desligado_motivo`
-- não entra no banco. Condicional de propósito — a REATIVAÇÃO (`p_ativo=true`
-- em admin_set_usuario_status) zera `desligado_motivo` de volta pra null com
-- `status='aprovada'`, e isso continua permitido.
-- ===========================================================================

drop function if exists public.desligar_usuario(uuid, text);

-- Backfill: desligados históricos sem motivo (o antigo `desligar_usuario`
-- aceitava motivo nulo) ganham um marcador — não dá pra reconstruir o motivo
-- real retroativamente, mas o check abaixo não pode nascer quebrando dados existentes.
update public.profiles
   set desligado_motivo = 'Motivo não registrado (backfill C10 — desligamento anterior a 02/08/2026)'
 where status = 'suspensa'
   and desligado_motivo is null;

do $$ begin
  alter table public.profiles
    add constraint profiles_desligamento_motivo_obrigatorio
    check (status <> 'suspensa' or desligado_motivo is not null);
exception
  when duplicate_object then null;
end $$;

comment on constraint profiles_desligamento_motivo_obrigatorio on public.profiles is
  'V11 C10: todo desligamento (status=suspensa) precisa de motivo. Condicional —
   não trava a reativação, que zera desligado_motivo de volta pra null.';

-- ---------------------------------------------------------------------------
-- admin_set_usuario_status ganha a mesma checagem, com mensagem amigável —
-- sem isto, quem chamar com motivo vazio bate direto na violação do check
-- acima (mensagem genérica do Postgres, não "Motivo é obrigatório.").
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_usuario_status(
  p_user_id uuid,
  p_ativo boolean,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _motivo text;
begin
  if not public.has_role(auth.uid(),'matriz') then
    raise exception 'permissao negada';
  end if;
  if p_ativo then
    update public.profiles
       set desligado_em = null,
           desligado_motivo = null,
           status = 'aprovada'
     where id = p_user_id;
  else
    _motivo := nullif(trim(coalesce(p_motivo, '')), '');
    if _motivo is null then
      raise exception 'Motivo é obrigatório.';
    end if;
    update public.profiles
       set desligado_em = now(),
           desligado_motivo = _motivo,
           status = 'suspensa'
     where id = p_user_id;
  end if;
end$$;

grant execute on function public.admin_set_usuario_status(uuid,boolean,text) to authenticated;
