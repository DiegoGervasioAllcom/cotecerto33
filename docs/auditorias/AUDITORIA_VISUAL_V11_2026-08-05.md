# Auditoria visual e de acessos V11 — 05/08/2026

## Escopo e ambiente

- Checkout: `main` em `60641080d5f5985b0c3e31ccb3382d6c6bb4f9af`.
- Ambiente: front e Supabase locais.
- Fontes: `docs/v11/FLUXOS_OPERACIONAIS.html`, protótipo V11 r40, decisões r41 e `docs/Q4_ROTEIRO_QA_MANUAL.pdf`.
- Personas: Matriz, Diretor, Coordenador, Supervisores de Vendas/Operacional/Backoffice, Assistente Comercial, Marketing, Master, Franquia Full, Franquia Individual e Vendedor.
- Método: login real, coleta do menu, abertura de cada link esperado, conferência de URL/títulos/console e cenário de override com novo login.

## Resultado executivo

O sistema **não está integralmente de acordo** com o protótipo/Fluxos. Os presets do menu têm a quantidade esperada nas 12 experiências, mas foram encontrados problemas funcionais reproduzíveis.

| Prioridade | Classificação     | Achado                                                                                                                                                                                                                                                                 |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crítica    | BUG               | `/operacao/pipeline-geral` quebra para Matriz e Diretor com `Objects are not valid as a React child`; o objeto do veículo (`ano_modelo`, `marca_nome`, `modelo_nome`) está sendo renderizado diretamente.                                                              |
| Alta       | BUG               | Coordenador recebe 17 links, mas Leads, Distribuição, Franquias, Mensagens e Configurações redirecionam para a Visão geral. O menu promete acesso que os guards rejeitam.                                                                                              |
| Alta       | BUG               | Supervisor Operacional e Supervisor Backoffice recebem Leads/Distribuição no menu, mas essas duas rotas os redirecionam para a Visão geral.                                                                                                                            |
| Alta       | BUG               | Override de áreas reduz corretamente o menu após novo login, porém uma rota removida continua acessível por URL direta. Testado com Supervisor de Vendas: menu `Visão geral + Relatórios`, mas `/operacao/aprovacoes` abriu normalmente.                               |
| Média      | BUG               | Master e Franquia Full permaneceram em `/inicio` após o login, em vez de cair na Visão geral do grupo/comando prevista pelo Q4.                                                                                                                                        |
| Média      | BUG               | A listagem ampla de Franquias produz uma requisição `profiles?...empresa_id=in.(...)` enorme; com a base local atual, o navegador registrou falha/CORS. Paginação ou consulta server-side são alternativas a avaliar na task de correção, não uma solução já validada. |
| Média      | ATENÇÃO           | O app usa “Novo lead”, enquanto o r40 usa “Lead Manual”. O fluxo é equivalente, mas o texto não é idêntico.                                                                                                                                                            |
| Documental | ATENÇÃO resolvida | Supervisor de Vendas tem 11 áreas, incluindo Estornos. A diferença contra o r40 (10) foi decidida a favor dos Fluxos e incorporada ao r41.                                                                                                                             |

## Matriz de navegação

| Persona                | Landing observada | Links | Resultado                                                           |
| ---------------------- | ----------------- | ----: | ------------------------------------------------------------------- |
| Matriz                 | Visão geral       |    17 | BUG no Pipeline geral                                               |
| Diretor                | Visão geral       |    17 | BUG no Pipeline geral                                               |
| Coordenador            | Visão geral       |    17 | 5 links quebrados                                                   |
| Supervisor de Vendas   | Visão geral       |    11 | links do preset abriram; override não bloqueia URL direta           |
| Supervisor Operacional | Visão geral       |     4 | Leads e Distribuição quebrados                                      |
| Supervisor Backoffice  | Visão geral       |     5 | Leads e Distribuição quebrados                                      |
| Assistente Comercial   | Visão geral       |     3 | links do preset abriram                                             |
| Marketing              | Visão geral       |     4 | links do preset abriram; Leads/Distribuição em leitura              |
| Master                 | `/inicio`         |    12 | landing divergente                                                  |
| Franquia Full          | `/inicio`         |    14 | landing divergente; conjunto do menu segue decisão posterior ao r40 |
| Franquia Individual    | `/inicio`         |     9 | links de venda abriram                                              |
| Vendedor               | `/inicio`         |     9 | links de venda abriram                                              |

## Cenário Matriz define a visualização

1. Supervisor de Vendas iniciou com preset de 11 áreas.
2. Foi aplicado um override sintético contendo somente `mdash` e `mrel`.
3. Em novo login, o menu mostrou exatamente `Visão geral` e `Relatórios`.
4. A rota permitida `/operacao/relatorios` abriu.
5. A rota removida `/operacao/aprovacoes` também abriu por URL direta.
6. O override foi removido na limpeza.

Conclusão: a configuração da Matriz controla corretamente a **visibilidade do menu**, mas não representa bloqueio completo de navegação. A proteção dos dados continua dependente das policies/RPCs; esconder o link não deve ser tratado como autorização.

## Evidência automatizada correlata

- `tests/db/rls-hierarquia-v11-areas.test.ts` e `tests/db/rls-escopo-interno-matriz.test.ts`: 23/23 aprovados.
- `tests/e2e/personas.spec.ts` e `tests/e2e/central-interno-matriz.spec.ts`: 8/8 aprovados.
- Varredura temporária Q4: execução concluída com exit code 0, 12 personas e 124 tentativas de rota: 122 links canônicos da matriz de menus mais duas sondagens negativas de `/operacao/franquias` para Master/Full. Também houve passagens direcionadas no navegador para Matriz, Coordenador e override. As screenshots e o JSON bruto ficaram temporariamente em `/tmp`; os achados consolidados e duráveis são este relatório.

Os testes existentes aprovam porque verificam marcadores do menu, não cada link, landing page, erro de renderização ou acesso direto depois de override.

## Limitações

- Não foram enviados e-mails reais, WhatsApp, downloads externos nem alterações em produção.
- A auditoria percorreu todas as rotas principais de menu. Rotas de detalhe dependentes de ID e o fluxo comercial completo de seis etapas exigem fixtures específicas adicionais.
- Falhas intermitentes `Failed to fetch` foram separadas dos bugs reproduzíveis; o crash React e os redirecionamentos foram confirmados diretamente.

## Conclusão

Status: **REPROVADO para declarar conformidade integral com o protótipo V11**.

Antes do go-live, devem ser corrigidos ao menos o crash do Pipeline geral, os guards incompatíveis com os menus de Coordenador/Supervisores, a landing de Master/Full e a ausência de bloqueio visual por área quando essa for a regra desejada. Cada correção deve voltar à suíte e ao revisor conforme `AGENTS.md`.

---

## Revalidação das correções — 06/08/2026

Esta seção preserva o diagnóstico original acima e registra a revalidação no branch
`dgoGervasio/corrige-auditoria-visual-v11`. Os achados foram tratados em commits separados por
severidade:

| Commit    | Correção                                                                                                                                                                              | Evidência automatizada                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db6097f` | Pipeline geral formata `dados.veiculo` estruturado, legado, inválido ou nulo sem entregar objetos ao React.                                                                           | `tests/unit/veiculo.test.ts` e cenário real no Chromium com `FIAT UNO 2020`.                                                                          |
| `e1c5d5a` | Guards aceitam Coordenador e Supervisores nas áreas prometidas; Configurações permanece somente leitura fora da Matriz.                                                               | `tests/unit/route-access.test.ts` e abertura E2E das cinco rotas antes quebradas do Coordenador mais Leads/Distribuição dos dois supervisores.        |
| `aeb3c01` | As 17 áreas internas passam por um guard central baseado em `AreaChave`; override também bloqueia URL direta removida. Acessos sem privilégio administrativo vira consulta explícita. | `tests/unit/internal-route-guards.test.ts`, matriz canônica em `route-access.test.ts` e E2E negativo `/operacao/aprovacoes` → `/comando/visao-geral`. |
| `7e68e7d` | Master e Franquia Full entram na Visão geral do comando; Vendedor e Franquia Individual permanecem no cockpit. “Lead Manual” substitui “Novo lead” na experiência ativa.              | `tests/unit/landing.test.ts`, `group-scope.test.ts` e asserts de URL/menu em `tests/e2e/personas.spec.ts`.                                            |
| `0dfee7a` | Franquias usa RPC server-side paginada e remove a consulta `profiles?...empresa_id=in.(...)` proporcional à base inteira.                                                             | `tests/db/listar-franquias-paginada.test.ts` e `tests/unit/franquias-pagination.test.ts`, incluindo caso negativo de usuário sem área.                |
| `3bdb61f` | Elimina o loop de navegação do override: trata `role` nula, torna redirects idempotentes e troca recarga implícita por retry explícito.                                               | Cenário isolado 2/2 e repetição completa do E2E de auditoria, personas e Central 12/12 no Chromium.                                                   |

### Cobertura durável acrescentada

- `tests/e2e/auditoria-visual-regressao.spec.ts` reproduz os pontos que a suíte anterior não
  cobria: veículo estruturado no Pipeline, cinco acessos críticos do Coordenador, Leads e
  Distribuição dos Supervisores Operacional/Backoffice, bloqueio por URL após override e os modos
  somente leitura de Configurações/Acessos.
- `tests/e2e/personas.spec.ts` agora verifica explicitamente as landings: Master/Full em
  `/comando/visao-geral`; Vendedor/Individual em `/inicio`; e usa o rótulo “Lead Manual”.
- O contrato unitário enumera as 17 `AreaChave` e suas rotas, inclusive detalhes de Franquias e
  Vendedores, com casos positivos e negativos.
- A regressão de paginação valida limite/offset, total, busca, ordenação, responsável e negação
  quando a pessoa autenticada não possui `mfranq`; os asserts não usam `service_role` para provar
  autorização.

### Resultado atualizado

Status dos achados funcionais deste relatório: **CORRIGIDOS E APROVADOS NO AMBIENTE LOCAL**.

Validações finais executadas em 06/08/2026:

- `bun run lint`: aprovado, sem erros; 19 avisos preexistentes.
- `bun run typecheck`: aprovado.
- `bun run build`: aprovado; permaneceu o aviso de chunk acima de 500 kB.
- `bun run test:unit -- --reporter=dot`: 26 arquivos, 321 testes aprovados.
- `bun run test:db -- --reporter=dot`: a suíte DB/RLS completa **não ficou verde**. Houve duas
  falhas associadas a estado compartilhado entre suítes: `rls-hierarquia-v11-areas` ultrapassou o
  limite padrão de 1.000 linhas do PostgREST e `rpc-desconto` encontrou política herdada de outra
  execução. Após o reset, o gateway respondeu 502 até o reinício de REST/Kong. Esses incidentes
  precisam ser estabilizados ou isolados antes de declarar a suíte completa aprovada.
- Regressões DB/RLS diretamente ligadas aos achados: 3 arquivos, 31 testes aprovados.
- A primeira execução completa do `playwright` de auditoria, personas e Marketing/rotas encontrou
  `Maximum update depth` no cenário de override. O commit `3bdb61f` corrigiu o ciclo em
  landing/auth/guard de área; depois dele, o cenário isolado passou 2/2 e a repetição completa
  passou **12/12** no Chromium. O console ainda registrou ocorrências intermitentes de
  `Failed to fetch` em consultas de badge/Visão geral, sem quebrar os fluxos validados.

A primeira repetição isolada do teste paginado detectou que seu assert comparava o total global
entre várias chamadas enquanto outras suítes criavam empresas em paralelo. O teste foi estabilizado
para validar o total dentro de cada snapshot e a ausência de repetição entre páginas, sem enfraquecer
os casos negativos de autorização; a suíte direcionada passou depois do ajuste. Isso não transforma
o resultado da suíte DB completa em verde, devido às duas falhas de estado compartilhado acima.

O status aprovado limita-se aos achados funcionais, personas e rotas descritos nesta auditoria. A
suíte DB/RLS completa permanece **não verde** pelas duas falhas de estado compartilhado acima e
precisa de estabilização independente. Esta conclusão também não substitui os itens de go-live fora
do escopo registrados na seção “Limitações”, nem antecipa o resultado de CI ou validação em
produção.
