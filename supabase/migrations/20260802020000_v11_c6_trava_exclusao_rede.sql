-- ===========================================================================
-- V11 · C6 (Frente 3) — trava de exclusão na rede externa
--
-- `admin_set_usuario_status` (035) desliga qualquer profile sem checar
-- dependentes — correto para o time interno (C4), mas para Master/Franquia
-- (C5, aba Cadastros Rede) excluir sem checar deixaria franquias órfãs de um
-- Master desligado, ou vendedores ativos numa franquia desligada.
--
-- RPC dedicada em vez de estender `admin_set_usuario_status`: essa função é
-- genérica (usada também pelo time interno, sem noção de franquia/vendedor);
-- misturar a trava nela puniria casos que não têm essa dependência.
--
-- "Ativo" aqui é sempre `desligado_em is null` — o mesmo sinal já mostrado
-- como chip Ativo/Desligado em cadastros-matriz-tab.tsx e cadastros-rede-tab.tsx.
-- `empresas.status` não é usado como sinal (nada hoje escreve 'suspensa' lá).
-- ===========================================================================

create or replace function public.excluir_cadastro_rede(
  p_user_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _role public.perfil;
  _empresa_id uuid;
  _franquias_ativas int;
  _vendedores_ativos int;
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'permissao negada';
  end if;

  select ur.role, p.empresa_id into _role, _empresa_id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
   where p.id = p_user_id
     and ur.role in ('master', 'franqueado', 'vendedor')
   limit 1;

  if _role is null then
    raise exception 'Cadastro não encontrado ou fora do escopo desta operação.';
  end if;

  if _role = 'master' then
    select count(*) into _franquias_ativas
      from public.empresas e
      join public.profiles dono on dono.empresa_id = e.id and dono.desligado_em is null
      join public.user_roles ur2 on ur2.user_id = dono.id and ur2.role = 'franqueado'
     where e.parent_id = _empresa_id;
    if _franquias_ativas > 0 then
      raise exception
        'Este Master tem % franquia(s) ativa(s) vinculada(s) — transfira ou desligue-as antes de excluir.',
        _franquias_ativas;
    end if;
  elsif _role = 'franqueado' then
    select count(*) into _vendedores_ativos
      from public.profiles p2
      join public.user_roles ur2 on ur2.user_id = p2.id and ur2.role = 'vendedor'
     where p2.empresa_id = _empresa_id
       and p2.desligado_em is null;
    if _vendedores_ativos > 0 then
      raise exception
        'Esta franquia tem % vendedor(es) ativo(s) na base — desligue-os antes de excluir.',
        _vendedores_ativos;
    end if;
  end if;

  perform public.admin_set_usuario_status(p_user_id, false, p_motivo);
end;
$function$;

comment on function public.excluir_cadastro_rede(uuid, text) is
  'V11 C6: exclusão (desligamento) de Master/franquia/vendedor da aba Cadastros
   Rede, com trava de dependentes ativos. Vendedor nunca tem dependente — cai
   direto em admin_set_usuario_status. Motivo obrigatório é responsabilidade
   do front (C10 formaliza isso no banco).';

revoke all on function public.excluir_cadastro_rede(uuid, text) from public, anon;
grant execute on function public.excluir_cadastro_rede(uuid, text) to authenticated;
