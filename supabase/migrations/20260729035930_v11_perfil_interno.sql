-- ===========================================================================
-- V11 — enum perfil += 'interno' (time de apoio da Matriz)
--
-- Achado testando as 12 personas: dos 7 cargos do protótipo r40, dois não têm
-- perfil onde morar. Direção -> matriz, Coordenador -> coordenador e os três
-- supervisores -> supervisor encaixam. Assistente Comercial e Marketing não são
-- supervisores nem Matriz, e estavam só podendo rodar como 'supervisor'.
--
-- POR QUE ISSO IMPORTA — e não é o motivo óbvio. Levantamento no banco:
--
--   - Nenhuma policy RLS usa 'supervisor' (0 de todas as policies do schema).
--     Então o perfil NÃO decide escopo de dado: quem decide é empresas_visiveis(),
--     que só abre para matriz/coordenador e, fora disso, desce superior_id.
--   - Mas duas coisas leem o papel:
--       1) fechar_comissao_competencia paga ROYALTIES a todo profile com role
--          'supervisor' e profiles.royalties > 0. Um Assistente marcado como
--          supervisor entra nesse laço; hoje não recebe nada só porque a coluna
--          está nula. É a única coisa separando Marketing de receber royalties
--          de supervisor no fechamento.
--       2) solicitar_vendedor aceita supervisor como solicitante.
--
-- Ou seja: o problema é de dinheiro e de capacidade, não de visibilidade. Daí um
-- valor próprio, para o time de apoio ficar fora do laço de royalties por
-- construção, em vez de por uma coluna nula.
--
-- ESCOPO DE DADOS CONTINUA ESTREITO, DE PROPÓSITO. 'interno' não entra no braço
-- amplo de empresas_visiveis(): 18 policies de ESCRITA (leads, clientes,
-- oportunidades, cotacao_*, metas, canais) usam essa mesma função, então abrir
-- visibilidade abriria escrita na rede toda. Dar leitura ampla sem escrita exige
-- separar os dois eixos nas 22 policies de SELECT — decisão de produto sobre o
-- que Marketing e Assistente devem ver, registrada em ANALISE_LACUNAS_V11.md.
-- ===========================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'perfil' and e.enumlabel = 'interno'
  ) then
    alter type public.perfil add value 'interno';
  end if;
end$$;
