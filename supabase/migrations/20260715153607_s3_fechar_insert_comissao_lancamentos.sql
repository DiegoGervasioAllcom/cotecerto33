-- S3: fecha o insert direto em `comissao_lancamentos` e blinda a RPC de ajuste.
--
-- Problema: a policy "cc lanc insert matriz" (20240101000038_conta_corrente_comissoes.sql
-- ~L42-48) permitia que qualquer usuário com role matriz/master inserisse linhas
-- DIRETAMENTE na tabela via `.from("comissao_lancamentos").insert(...)`, contornando
-- por completo a validação da RPC `lancar_ajuste_comissao` (valor arbitrário, vendedor
-- de qualquer rede, origem livre). A escrita legítima é: (a) o trigger
-- `_sync_comissao_lancamento` (security definer, não tocado aqui) e (b) a RPC
-- `lancar_ajuste_comissao` (security definer). Nenhuma das duas precisa que
-- `authenticated` tenha policy de INSERT na tabela.
--
-- Fix:
--   1) Remove "cc lanc insert matriz" sem policy substituta — INSERT direto por
--      `authenticated` fica negado (UPDATE/DELETE já não tinham policy).
--   2) `lancar_ajuste_comissao` passa a validar:
--      - valor > 0 (magnitude; a direção é dada por `tipo` credito/debito);
--      - escopo de rede: matriz lança para qualquer vendedor; master só lança para
--        vendedor cuja empresa esteja em `empresas_visiveis(auth.uid())` (mesmo
--        critério de "cc lanc select self or rede", S1);
--      - `origem` já era fixada em 'ajuste' no corpo (não é parâmetro) — mantido.
--      Assinatura, retorno, `security definer`/`search_path` e grant preservados
--      idênticos — só o corpo muda.

-- ============================================================
-- 1) Remove a policy de insert direto (matriz/master) — sem substituta.
-- ============================================================
drop policy if exists "cc lanc insert matriz" on public.comissao_lancamentos;

-- ============================================================
-- 2) RPC de ajuste: valida valor > 0 e escopo de rede para master.
-- ============================================================
create or replace function public.lancar_ajuste_comissao(
  p_vendedor uuid,
  p_tipo text,
  p_valor numeric,
  p_descricao text
) returns uuid language plpgsql security definer set search_path=public as $$
declare _id uuid;
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'forbidden';
  end if;
  if p_tipo not in ('credito','debito') then
    raise exception 'tipo invalido';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor deve ser maior que zero';
  end if;
  if public.has_role(auth.uid(),'master') and not public.has_role(auth.uid(),'matriz') then
    if not exists (
      select 1
      from public.profiles p
      where p.id = p_vendedor
        and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    ) then
      raise exception 'vendedor fora da rede visivel';
    end if;
  end if;
  insert into public.comissao_lancamentos
    (vendedor_id, tipo, valor, descricao, origem, criado_por)
  values
    (p_vendedor, p_tipo, p_valor, p_descricao, 'ajuste', auth.uid())
  returning id into _id;
  return _id;
end $$;
grant execute on function public.lancar_ajuste_comissao(uuid,text,numeric,text) to authenticated;

comment on function public.lancar_ajuste_comissao(uuid,text,numeric,text) is
  'Lançamento manual de ajuste de comissão (crédito/débito). S3: valida valor > 0 e, para
  master, que o vendedor pertença à rede visível (empresas_visiveis). origem é sempre
  ''ajuste'' (não parametrizável). Único caminho de escrita autenticada em
  comissao_lancamentos — INSERT direto na tabela foi removido ("cc lanc insert matriz").';
