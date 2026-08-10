# Auditoria de "Acessos e permissões" V11 — 10/08/2026 (rodada 2)

Continuação de [`AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10.md`](AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10.md) — verificação final com **todas** as personas depois do PR #142 já mergeado, cobrindo também Franquia Individual e Vendedor (que a rodada 1 não tinha testado).

## Escopo e ambiente

- Checkout: `main` em `f40af37` (PR #142 já mergeado).
- Personas testadas: Matriz, Master, Supervisor de Vendas, Franquia Full, Franquia Individual, Vendedor — todas via `criarPersona`.
- Método: login real por persona, navegação para `/operacao/acessos` e `/operacao/xacessos` (inclusive por URL direta, não só pelo menu), comparação com o protótipo.

## Resultado executivo

| Persona                | Achado                                                                                                                                        | Status    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Matriz                  | Sem mudanças desde a rodada 1 — dois blocos intactos.                                                                                            | OK        |
| Master                  | Confirmado o fix da rodada 1 (pendentes separados + "Ver").                                                                                      | OK        |
| Supervisor de Vendas    | Confirmado o fix da rodada 1 (visão read-only escopada por hierarquia).                                                                          | OK        |
| Franquia Full           | Sem mudanças desde a rodada 1 — bloco "MINHA FRANQUIA" intacto.                                                                                   | OK        |
| Franquia Individual     | **Bug novo**: `/operacao/xacessos` não tinha guard nenhum — Individual acessava por URL direta e via "Convidar vendedor" plenamente funcional, apesar de operar como vendedor (sem equipe), contrariando o protótipo/docs. | Corrigido |
| Vendedor                | Sem tela de Acessos, nem no menu nem por URL direta (mesmo guard do fix da Individual). Bate com o protótipo.                                    | OK        |

## Achado: `/operacao/xacessos` sem guard de rota

A rota é destinada só a Master e Franquia Full (`role === "master"` ou `role === "franqueado" && isFranqFull`), mas o componente não tinha nenhum `useRequireRole`/guard equivalente — diferente de `/operacao/acessos`, que usa `useRequirePerfilInterno`. Qualquer perfil (Individual, Vendedor) que navegasse manualmente para a URL renderizava a tela inteira, incluindo o botão "Convidar vendedor" funcional, mesmo sem esse conceito existir para eles.

**Correção:** novo guard `useRequireGrupoAcessos` em `src/lib/require-role.tsx`, aplicado em `xacessos.tsx` antes do JSX — redireciona para `/inicio` quem não é Master nem Franquia Full.

**Teste novo:** `tests/e2e/personas.spec.ts` — "franquia Individual é redirecionada ao acessar /operacao/xacessos por URL direta".

## Verificação

- `tsc --noEmit`: limpo.
- `vitest run tests/unit`: 348/348.
- `playwright test tests/e2e/personas.spec.ts`: 7/7 (6 anteriores + 1 novo).
- Verificação visual manual no browser com as 6 personas, incluindo tentativa de acesso direto por URL para Individual e Vendedor.
