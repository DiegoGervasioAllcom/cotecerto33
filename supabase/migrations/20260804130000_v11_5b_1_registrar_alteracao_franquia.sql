-- ===========================================================================
-- V11.5b.1 (Frente 5b — Franquia Full como matrizinha) — porta de escrita do
-- histórico da FRANQUIA, gate por identidade (não por senha de diretor)
--
-- `fn_registrar_alteracao` (V11.0.5) é a ÚNICA porta de escrita do histórico
-- das políticas GLOBAIS da Matriz — sempre exige diretor+senha, e diretor é
-- marcação exclusiva de perfil Matriz (regra 2). A Franquia Full nunca é
-- diretora, mas é uma "matrizinha": decide sozinha a régua de performance do
-- próprio time e os complementos de comissão (regra 8), sem senha nenhuma —
-- confirmado no protótipo r41 (`perfSaveGate('full')` salva direto e grava
-- histórico; `fullComSave()` idem, nunca passa por `dirGate`).
--
-- Por isso esta é uma function IRMÃ, não uma alteração de
-- `fn_registrar_alteracao` (que continua sendo a porta certa pras políticas
-- globais — G6.1, D2, etc.).
--
-- Gate por IDENTIDADE, não por senha: quem chama precisa, ao mesmo tempo,
--   1) ter o role `franqueado` (Individual também é `franqueado` — por isso o
--      passo 3 é obrigatório, não redundante);
--   2) ter profiles.empresa_id = p_empresa_id (só grava histórico da PRÓPRIA
--      empresa — nunca de outra franquia);
--   3) essa empresa resolver pro bloco 'full' via fn_bloco_performance (D5) —
--      franquia Individual não tem essa autonomia, é exclusiva da Full.
--
-- `historico_alteracoes.empresa_id` já existe desde V11.0.6 ("nulo = Matriz,
-- preenchido = franquia") — não precisa de nenhuma coluna nova.
-- ===========================================================================

create or replace function public.fn_registrar_alteracao_franquia(
  p_empresa_id uuid,
  p_area       text,
  p_o_que      text,
  p_de_para    jsonb default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid  uuid := auth.uid();
  _nome text;
  _id   uuid;
begin
  if p_empresa_id is null then
    raise exception 'empresa_id é obrigatório para gravar o histórico da franquia';
  end if;

  if not (
    public.has_role(_uid, 'franqueado')
    and exists (
      select 1 from public.profiles p
       where p.id = _uid
         and p.empresa_id = p_empresa_id
    )
    and public.fn_bloco_performance(p_empresa_id) = 'full'
  ) then
    raise exception 'Só a própria Franquia Full pode gravar o histórico da sua franquia'
      using hint = 'Gate por identidade (franqueado dono da empresa + modalidade Full), não por senha de diretor.';
  end if;

  select coalesce(p.nome, p.email, 'Franqueado') into _nome
    from public.profiles p where p.id = _uid;

  insert into public.historico_alteracoes
    (autor_id, autor_nome, area, o_que, de_para, empresa_id)
  values
    (_uid, coalesce(_nome, 'Franqueado') || ' (franqueado)', p_area, p_o_que, p_de_para, p_empresa_id)
  returning id into _id;

  return _id;
end;
$function$;

comment on function public.fn_registrar_alteracao_franquia(uuid, text, text, jsonb) is
  'V11.5b.1: porta de escrita do histórico da FRANQUIA (empresa_id preenchido
   em historico_alteracoes). Gate por identidade — franqueado dono da própria
   empresa, com essa empresa resolvendo pro bloco Full (fn_bloco_performance)
   — nunca senha de diretor (Full nunca é diretora). Irmã de
   fn_registrar_alteracao (V11.0.5), que continua sendo a porta certa pras
   políticas GLOBAIS da Matriz.';

revoke all on function public.fn_registrar_alteracao_franquia(uuid, text, text, jsonb) from public, anon;
grant execute on function public.fn_registrar_alteracao_franquia(uuid, text, text, jsonb) to authenticated;
