-- ===========================================================================
-- V11 · C9 (Frente 1) — consumir o convite e nascer classificado
--
-- Fluxo "Acesso e visualização": "O tipo declarado segue sendo declaração — quem
-- confirma é quem aprova". E a Etapa 2 do DE/PARA: o modal de análise "abre
-- travado no que o convite definiu (tipo + vínculo herdados)".
--
-- Para isso o pedido precisa APONTAR para o convite. Hoje o pedido pendente é uma
-- linha em `empresas` com status='pendente'; ligamos as duas por FK em vez de
-- copiar o payload para `dados_cadastro`:
--
--   - a classificação fica normalizada, com um só lugar de verdade;
--   - o modal da Frente 2 lê por join, sem garimpar jsonb;
--   - e a origem do pedido (Convite Supper x criação manual por exceção) sai de
--     `convite_id is null`, que é o que a fila precisa mostrar no chip.
--
-- Uso único é garantido aqui: `consumir_convite` só marca se ainda não estava
-- marcado, e devolve false se outra requisição chegou primeiro.
-- ===========================================================================

alter table public.empresas
  add column if not exists convite_id uuid
    references public.convites(id) on delete set null;

comment on column public.empresas.convite_id is
  'V11 C9: convite que originou este pedido de acesso. NULL = criação direta pela
   Matriz (a "exceção com log" da Etapa 1) ou cadastro legado. A aprovação lê a
   classificação daqui, em vez de confiar no que a tela mandou.';

create index if not exists idx_empresas_convite on public.empresas(convite_id);

-- ---------------------------------------------------------------------------
-- consumir_convite — marca o uso e amarra o pedido ao convite
--
-- security definer porque roda no fim do cadastro, quando o solicitante ainda
-- não tem acesso a nada: ele acabou de ser criado e a empresa está pendente.
-- ---------------------------------------------------------------------------
create or replace function public.consumir_convite(
  p_token   text,
  p_user_id uuid
) returns boolean
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _c       record;
  _empresa uuid;
begin
  if p_token is null or p_user_id is null then
    return false;
  end if;

  -- `for update` fecha a corrida entre duas submissões do mesmo link.
  select * into _c from public.convites c where c.token = p_token for update;
  if not found or _c.usado_em is not null or _c.expira_em <= now() then
    return false;
  end if;

  select p.empresa_id into _empresa from public.profiles p where p.id = p_user_id;
  if _empresa is null then
    raise exception 'cadastro não criou empresa para o usuário %', p_user_id;
  end if;

  update public.empresas
     set convite_id = _c.id
   where id = _empresa;

  update public.convites
     set usado_em = now(),
         usado_por = p_user_id
   where id = _c.id
     and usado_em is null;

  return true;
end;
$function$;

comment on function public.consumir_convite(text, uuid) is
  'V11 C9: fecha o convite (uso único, com for update contra corrida) e liga o
   pedido pendente a ele. Devolve false quando o token não serve mais, para o
   cadastro poder avisar em vez de seguir como se tivesse dado certo.';

revoke all on function public.consumir_convite(text, uuid) from public, anon, authenticated;
grant execute on function public.consumir_convite(text, uuid) to service_role;
