# Auditoria de "Acesso e visualização" V11 — 10/08/2026

Comparação dos menus por persona com a aba **"Acesso e visualização"** do documento "Fluxos Operacionais - Supper Certo · Plataforma Cote Certo" enviado pela Lis (constante `MENUS` do arquivo).

## Resultado executivo

| Persona                | Achado                                                                                                     | Status    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| Matriz (17 áreas)       | Bate exatamente.                                                                                            | OK        |
| Coordenador (17 áreas)  | Bate exatamente.                                                                                            | OK        |
| Master (12 itens)       | Bate exatamente, mesma ordem.                                                                                | OK        |
| Vendedor / Individual / Vendedor Master-Full (9 itens) | Bate — só o rótulo "Lead Manual" (app) vs. "Novo lead" (documento), já registrado antes como cosmético. | OK        |
| Supervisor Operacional  | As 4 áreas próprias já batiam; faltava administrar Acessos ("cuida da liberação dos cadastros").             | Corrigido |
| Supervisor de Vendas    | Eu mesmo tinha adicionado `macessos` numa correção anterior, sem checar este documento — revertido.          | Corrigido |
| Marketing               | 5ª área era `mkt` (área futura, desativada) em vez de `mmsgs` (Mensagens).                                    | Corrigido |
| Franquia Full           | Sem "Canais" (funcionalidade não construída) e sem "Mensagens" (decisão deliberada, V11.5.2b) — gaps já conhecidos, fora do escopo desta auditoria. | Não alterado |
| Assistente Comercial / Supervisor Backoffice | O documento não especifica o menu exato desses dois cargos (só usa Marketing como exemplo do tipo "escopo"). | Sem comparação possível |

## Achados e correções

### 1. Engano meu: Supervisor de Vendas não deveria ter `macessos`

Numa sessão de QA anterior (10/08/2026, mesma data), eu tinha adicionado a área `macessos` ao cargo `sup_vendas`, inferindo que ele deveria "acompanhar" a tela de Acessos por ser "time interno da Matriz" (H5) — sem ter visto este documento. O documento define o menu do Supervisor de Vendas com **11 itens**, sem Acessos e permissões — e essa contagem já batia certinho desde a migration H8 (`20260803130000_v11_h8_sup_vendas_estornos.sql`), que citava o mesmo documento para justificar Estornos.

**Correção:** `supabase/migrations/20260810160000_reverte_sup_vendas_macessos_e_marketing_mensagens.sql` remove `macessos` do preset de `sup_vendas`.

### 2. Supervisor Operacional deveria administrar Acessos, não só acompanhar

O documento é explícito: *"É ele quem cuida da fila de entrada e da liberação dos cadastros. Sem alçada de desconto."* — ou seja, ele aprova/libera cadastros, com o mesmo nível de admin que a Matriz na tela de Acessos e permissões (só sem a alçada de desconto, que é de Aprovações, tela separada).

Na mesma sessão anterior, eu tinha trocado `podeAdministrarAcessos` para excluir `supervisor` inteiro (pensando que nenhum supervisor deveria administrar), o que forçava também o Supervisor Operacional para a visão read-only criada para o Supervisor de Vendas.

**Correção:** `podeAdministrarAcessos` (`src/lib/route-access.ts`) agora recebe também o `cargo_id` e concede admin completo quando `role==='supervisor' && cargo_id==='sup_operacional'`. O componente `SupervisorAcessosView` (read-only) foi removido — não há mais nenhum cargo que precise dele: Supervisor Operacional administra, Supervisor de Vendas nem tem a área no menu.

### 3. Marketing tinha a área errada como 5º item

O documento lista o menu de exemplo do Marketing como: Visão geral, Leads, Distribuição, Relatórios, **Mensagens**. O preset do cargo tinha `mkt` — uma área futura chamada "Marketing" (`disponivel=false`, sem rota, ordem 18) que colide de nome com o próprio cargo `marketing`, mas é outra coisa — em vez de `mmsgs` (Mensagens).

**Correção:** mesma migration do item 1 troca `mkt` por `mmsgs` no preset de `marketing`.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 353/353.
- `bun run test:db`: 65/65 arquivos, 579/579 testes (2 testes que hardcodeavam o preset antigo do Marketing — `perfil-interno-v11.test.ts` e `rls-escopo-interno-matriz.test.ts` — foram atualizados).
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação visual no browser: Supervisor Operacional vê a tela completa de admin (blocos MATRIZ/EXTERNOS, Convidar, Cadastro manual) com as 4 áreas certas no menu; Marketing tem "Mensagens" no menu em vez da área desativada.
