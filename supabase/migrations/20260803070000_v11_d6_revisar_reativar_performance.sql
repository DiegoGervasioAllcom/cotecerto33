-- ===========================================================================
-- V11 · D6 (Frente 4) — revisão manual: travado -> atenção (nunca ativo)
--
-- "Supervisor/Matriz" no plano não é o role literal `supervisor` (esse é
-- só o time de apoio interno, H2) — é quem gerencia a pessoa: reusa o mesmo
-- padrão de `fn_pode_ver_solicitacao_desconto` (G3.2), matriz OU qualquer
-- ancestral na cadeia `profiles.superior_id`. Cobre tanto o coordenador/
-- supervisor de um CLT interno quanto o master/franqueado Full de um
-- vendedor de rede/full — sem hardcodar role.
--
-- Decisão #4 do plano: reativação sempre volta pra 'atenção', nunca 'ativo'
-- direto — o job (D4) reavalia com dado fresco no próximo dia; se a pessoa
-- realmente melhorou, o próprio job resolve pra 'ativo' sozinho.
--
-- `performance_revisao_motivo` é novo aqui (D1 só previu revisado_em/_por) —
-- entra na mesma trava de D1 (trigger bloqueia escrita direta), por isso
-- `fn_bloquear_escrita_direta_performance` precisa ser reeditada.
-- ===========================================================================

alter table public.profiles
  add column if not exists performance_revisao_motivo text;

do $$ begin
  alter table public.profiles
    add constraint profiles_performance_revisao_motivo_tamanho
    check (char_length(performance_revisao_motivo) <= 2000);
exception when duplicate_object then null; end $$;

comment on column public.profiles.performance_revisao_motivo is
  'V11 D6: motivo (opcional) registrado por fn_revisar_reativar_performance
   junto com a reativação. Mesma trava de escrita direta das outras colunas
   de sinal (fn_bloquear_escrita_direta_performance).';

create or replace function public.fn_bloquear_escrita_direta_performance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role'
     or coalesce(current_setting('regua.internal_write', true), 'false') = 'true' then
    return new;
  end if;

  if new.performance_status is distinct from old.performance_status
     or new.performance_motivo is distinct from old.performance_motivo
     or new.performance_calculado_em is distinct from old.performance_calculado_em
     or new.performance_revisado_em is distinct from old.performance_revisado_em
     or new.performance_revisado_por is distinct from old.performance_revisado_por
     or new.performance_revisao_motivo is distinct from old.performance_revisao_motivo
  then
    raise exception 'Estes campos só podem ser alterados pelo job da régua ou pela revisão de performance.';
  end if;

  return new;
end;
$function$;

create or replace function public.fn_revisar_reativar_performance(p_profile_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _status_atual text;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;

  if not (
    public.has_role(_uid, 'matriz')
    or exists (
      with recursive cadeia as (
        select p.id, p.superior_id
          from public.profiles p
         where p.id = p_profile_id
        union all
        select pr.id, pr.superior_id
          from public.profiles pr
          join cadeia c on pr.id = c.superior_id
      ) cycle id set is_cycle using path
      select 1 from cadeia where id = _uid
    )
  ) then
    raise exception 'Sem permissão para revisar a performance desta pessoa.';
  end if;

  select performance_status into _status_atual
    from public.profiles
   where id = p_profile_id;

  if _status_atual is null then
    raise exception 'Pessoa não encontrada ou sem sinal de performance calculado ainda.';
  end if;
  if _status_atual <> 'travado' then
    raise exception 'Só é possível revisar quem está travado (sinal atual: %).', _status_atual;
  end if;

  perform set_config('regua.internal_write', 'true', true);
  update public.profiles
     set performance_status = 'atencao',
         performance_revisado_em = now(),
         performance_revisado_por = _uid,
         performance_revisao_motivo = p_motivo
   where id = p_profile_id;
end;
$function$;

comment on function public.fn_revisar_reativar_performance(uuid, text) is
  'V11 D6: Matriz ou qualquer ancestral (superior_id) de quem está travado
   registra a revisão — volta o sinal pra "atenção" (nunca "ativo" direto,
   decisão #4 do PLANO_REGUA_V11.md). Idempotente: chamar de novo enquanto
   ainda travado funciona; erro se já não estiver travado.';

revoke all on function public.fn_revisar_reativar_performance(uuid, text) from public, anon;
grant execute on function public.fn_revisar_reativar_performance(uuid, text) to authenticated;
