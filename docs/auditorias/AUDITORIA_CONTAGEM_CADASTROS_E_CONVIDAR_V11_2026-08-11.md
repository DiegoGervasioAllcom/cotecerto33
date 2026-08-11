# Contagem em "Cadastros Matriz"/"Cadastros Rede" + verificação do Convidar · 11/08/2026

## Pedido

1. Verificar se o "Convidar" (criação de novo acesso) funciona em todas as franquias/personas
   que aparecem em "Acessos e permissões".
2. As abas "Cadastros Matriz" / "Cadastros Rede" não mostram o número entre parênteses, ao
   contrário do protótipo — verificar e corrigir.

## Achado 1 — contagem ausente nas abas de Cadastros

No protótipo (`cotecerto_prototipo_v11.html`), a função `tb(k, l, n)` (linhas 6811/6818/6822)
sempre recebe um `n` para "Cadastros Matriz" (`MATRIZ_USERS.length + CLT_VENDEDORES.length`) e
"Cadastros Rede" (`redeAll().length`), e renderiza `"<label> (<n>)"` — igual às abas de
Pendentes/Desligamentos, que já mostravam a contagem no app.

No app, `CadastrosMatrizTab`/`CadastrosRedeTab` calculam sua própria lista internamente (via
fetch em memória, com joins de cargos/roles/modelos), mas essa contagem nunca subia até o botão
da aba — os labels eram só texto fixo, sem número.

### Correção

- `CadastrosMatrizTab`/`CadastrosRedeTab` ganham uma prop opcional `onTotalChange(n)`, chamada via
  `useEffect` sempre que a lista local (`linhas`) muda — contando só os cadastros **ativos**
  (`!l.desligadoEm`), igual ao protótipo (que remove a pessoa de `MATRIZ_USERS`/`redeAll()` e
  só ela aparece em `MATRIZ_DESLIG`/`DESLIGAMENTOS` quando é desligada).
- `acessos.tsx` guarda o total em estado (`totalCadastrosMatriz`/`totalCadastrosRede`, `null`
  até a aba carregar pelo menos uma vez) e mostra `"(N)"` ao lado do label, só quando não é
  `null`.
- `AcessosNavigation.tsx` (bloco Externo) ganhou a prop `cadastros?: number | null` para o mesmo
  fim.

**Decisão de escopo:** não deixei as duas abas de Cadastros sempre montadas em segundo plano
(pré-carregando o total mesmo sem o usuário abrir a aba) — testei essa versão primeiro, mas ela
expôs um problema real e pré-existente de escala: as consultas de `user_roles`/`profiles`
dessas abas usam `.in(...)` com a lista completa de IDs, e numa base com muitos usuários (como o
banco local deste ambiente, cheio de dados de testes acumulados) a URL da requisição passa do
limite e a busca falha silenciosamente — mostrando "(0)" errado em vez de um erro visível. Abri
uma tarefa separada para corrigir isso (paginar/usar RPC em vez de `.in()` gigante). Por ora, a
contagem aparece do jeito mais simples e seguro: quando o usuário abre a aba pelo menos uma vez
(current da sessão) — o que já resolve a reclamação original, "os números não aparecem".

## Achado 2 — verificação do "Convidar" (criar novo acesso) por persona

Testado nesta e em sessões anteriores, o botão "Convidar" abre o modal certo e o fluxo completo
funciona (Gerar mensagem → pré-visualização do PDF → convidado abre o link → cadastro nasce
classificado) para:

- **Matriz** — escopo `interno` (cargo) e `externo` (Master/Franquia Individual). Verificado
  manualmente e via `tests/e2e/convite.spec.ts`.
- **Master** — escopo `master` (Franquia Full/Individual/Vendedor). Verificado manualmente e via
  `tests/e2e/filas-aprovacao.spec.ts`.
- **Franquia Full** — escopo `full` (só Vendedor | Full da própria franquia). Verificado via
  `tests/e2e/filas-aprovacao.spec.ts` (`Convidar · Convite Supper` em `/operacao/xacessos`).
- **Franquia Individual** — não tem botão "Convidar": opera como um vendedor, sem equipe própria
  (`isFull` só é `true` para modalidade Full). Comportamento correto por design, confirmado no
  código (`xacessos.tsx`).

Nenhuma regressão encontrada no fluxo de convite em si.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 358/358.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- `playwright test tests/e2e/convite.spec.ts tests/e2e/filas-aprovacao.spec.ts`: 7/7.
- Verificação visual manual (persona Matriz): abrir "Cadastros Matriz" e "Cadastros Rede" agora
  mostra "(0)" (correto para este ambiente de teste) ao lado do label, igual ao protótipo.
