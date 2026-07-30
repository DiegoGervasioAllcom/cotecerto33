-- ===========================================================================
-- V11 — corrige grants de EXECUTE que deixaram o service_role de fora
--
-- Bug latente introduzido pelas Frentes 0 e 1 (já na main). O padrão usado foi:
--
--   revoke all on function ... from public, anon;
--   grant execute on function ... to authenticated;
--
-- O `revoke ... from public` remove a concessão implícita de PUBLIC — que é de
-- onde o `service_role` herdava o EXECUTE. Como só `authenticated` foi
-- reconcedido, o service_role perdeu acesso.
--
-- Nada está quebrado no app hoje, porque o front chama como `authenticated`. Já
-- aconteceu uma vez em produção-de-desenvolvimento: `abrir_convite` foi corrigida
-- na Frente 1 depois de a server function do cadastro morrer com "permission
-- denied for function". Aqui a mesma armadilha aparece em 9 funções, e um teste
-- que chamou fn_areas_do_usuario com service_role tropeçou nela.
--
-- CRITÉRIO — e é por isso que não concedo em todas:
--
--   Concedo nas funções de LEITURA/DERIVAÇÃO. São úteis a server functions e a
--   testes, e não decidem nada por conta própria.
--
--   NÃO concedo nos MUTADORES QUE DEPENDEM DE ATOR (aprovar_empresa,
--   aprovar_acesso, fn_registrar_alteracao, fn_confirmar_senha_diretor). Todas
--   validam `auth.uid()`, que é NULL para service_role — então a chamada
--   falharia de qualquer forma, e conceder EXECUTE sugeriria que são usáveis
--   por ali. Quem precisar de ação server-side desses fluxos deve passar o ator
--   explicitamente, numa função própria e com a validação equivalente.
-- ===========================================================================

-- Leitura/derivação — seguras e úteis fora do contexto de um usuário logado.
grant execute on function public.fn_areas_do_usuario(uuid) to service_role;
grant execute on function public.fn_tem_area(uuid, text) to service_role;
grant execute on function public.fn_eh_diretor(uuid) to service_role;
grant execute on function public.fn_modelo_alcada_desconto(uuid) to service_role;

-- criar_convite recebe o ator por auth.uid() e valida escopo por ele; mantida
-- fora, pelo mesmo motivo dos mutadores acima.

comment on function public.fn_areas_do_usuario(uuid) is
  'H4: escopo efetivo de áreas. Matriz = todas as ativas; senão override de
   profile_areas se existir; senão preset do cargo; sem cargo = vazio.
   Perguntar pelo escopo de outra pessoa exige ser matriz/coordenador — sem isso
   a função (security definer) permitiria enumerar o menu de qualquer usuário.
   EXECUTE concedido também a service_role: é leitura e serve a server functions
   e testes (ver migration de correção dos grants).';
