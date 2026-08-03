-- ===========================================================================
-- V11 · C4 (Frente 3) — trava de autoedição dos campos da aba Cadastros Matriz
--
-- Achado da revisão de código: as colunas novas de dados pessoais e janela de
-- acesso (20260802003342) ficaram, sem querer, escreveis pela própria pessoa
-- via a policy pré-existente "profiles update self" (using (id = auth.uid())).
-- Essas colunas são o "Configurar" que só a Matriz aciona (buildCadMatrizModal
-- do protótipo) — não é autoatendimento. Sem esta trava, qualquer colaborador
-- poderia, via API direta (fora da UI), mudar sua própria janela de acesso ou
-- dados cadastrais sem passar pela Matriz/Coordenador.
--
-- RLS não faz restrição por coluna nativamente — por isso o trigger, não uma
-- policy nova. `auth.role() = 'service_role'` libera os server functions que
-- rodam com a service key (nenhum hoje escreve estas colunas, mas a fórmula é
-- a mesma de sempre: nunca confiar só no filtro de tela).
-- ===========================================================================

create or replace function public.fn_bloquear_autoedicao_dados_matriz()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role'
     or public.has_role(auth.uid(), 'matriz')
     or public.has_role(auth.uid(), 'coordenador') then
    return new;
  end if;

  if new.cpf is distinct from old.cpf
     or new.sobrenome is distinct from old.sobrenome
     or new.data_nascimento is distinct from old.data_nascimento
     or new.sexo is distinct from old.sexo
     or new.funcao is distinct from old.funcao
     or new.estado_civil is distinct from old.estado_civil
     or new.telefone_residencial is distinct from old.telefone_residencial
     or new.telefone_comercial is distinct from old.telefone_comercial
     or new.email_pessoal is distinct from old.email_pessoal
     or new.dias_acesso is distinct from old.dias_acesso
     or new.hora_inicio is distinct from old.hora_inicio
     or new.hora_fim is distinct from old.hora_fim
     or new.periodo_inicio is distinct from old.periodo_inicio
     or new.periodo_fim is distinct from old.periodo_fim
  then
    raise exception 'Só a Matriz ou a Coordenação podem alterar esses campos.';
  end if;

  return new;
end;
$function$;

comment on function public.fn_bloquear_autoedicao_dados_matriz() is
  'V11 C4: barra autoedição dos campos que só nascem pelo "Configurar" da aba
   Cadastros Matriz. A policy de update self continua valendo para nome/e-mail
   de login/telefone — só estas colunas específicas exigem matriz/coordenador.';

drop trigger if exists trg_bloquear_autoedicao_dados_matriz on public.profiles;
create trigger trg_bloquear_autoedicao_dados_matriz
  before update on public.profiles
  for each row execute function public.fn_bloquear_autoedicao_dados_matriz();
