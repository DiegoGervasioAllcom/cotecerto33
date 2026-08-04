# Plano — Frente 3 · Cadastros e ciclo de vida

**Aberto em:** 01/08/2026 · **Status:** ✅ implementado e concluído (Frente 3
inteiramente fechada em 03/08/2026 — ver "Fechamento" abaixo)

**Escopo:** V11.3.1 a V11.3.7 do `PLANO_TASKS_V11.md`, **mais V11.1.6 e V11.1.7** (adiadas
por dependerem de e-mail/criar-senha — resolvido no PR #104, em produção).

**Fontes:** `docs/v11/FLUXOS_OPERACIONAIS.html` · protótipo r40 (`accMatriz`, `accRede`,
`openManualCad`, `deslSolicitCard`, `pedirMotivo`) · levantamento de código atual (abaixo).

## O que já existe hoje (levantamento, não é o que vamos construir)

- **"Cadastros" está fragmentado.** Não existe aba unificada nem para Matriz nem para
  Rede. O mais parecido é `UsuariosModal`/`UsuariosSistemaModal` dentro de
  Configurações — lista, Editar, Desativar/Reativar, Excluir **sem nenhuma trava**
  (`adminDeleteUser` deleta direto, sem checar se o Master tem franquias ou se a
  franquia tem vendedores).
- **"Cadastro manual · exceção" só existe do lado de exibição.** A fila já sabe mostrar
  o chip amarelo quando `convite_id is null` (Frente 1/2). O que falta é o botão que a
  Matriz aciona de propósito — hoje a única forma de nascer um pendente sem convite é o
  autocadastro espontâneo de `/auth/cadastro`, que é justamente a porta que a V11.1.7
  quer fechar.
- **O Master já tem DOIS caminhos redundantes para adicionar vendedor.** `xacessos.tsx`
  mostra ao mesmo tempo o botão "Convidar" (Convite Supper, escopo `master`, já
  nominal e já cai na fila certa — Frente 1/2) **e** o form `CadastrarVendedorForm`
  (cria uma linha em `vendedor_solicitacoes`, um sistema **paralelo** que não usa
  convite, não usa `empresas.status='pendente'`, e cuja aprovação **não cria o
  usuário** — a Matriz ainda tem que ir em Configurações e criar na mão). Isso é gap
  visível hoje, não é feature.
- **Desligamento não tem fluxo de solicitação.** A Matriz desliga direto
  (`admin_set_usuario_status`). `desligado_motivo` é opcional no schema
  (`text`, sem `not null`). Não existe trava de "tem time embaixo".
- **`auth.cadastro.tsx` (autocadastro espontâneo) está ativo e é a porta de entrada
  "antiga"** que a V11.1.7 quer fechar — hoje ela cria `empresas.status='pendente'`
  sem `convite_id`, com senha digitada pelo próprio cadastrante.

## A mudança de conceito

1. **`vendedor_solicitacoes` fica obsoleta.** O Convite Supper (escopo `master`) já faz
   o que ela tentava fazer, melhor: nominal, uso único, cai direto na fila certa via
   RLS. Em vez de manter os dois caminhos, o Master passa a ter **só** "Convidar" — o
   card "Meus cadastrados" (V11.3.4) passa a ler de `empresas`/`convites` (RLS já
   escopa pra rede dele), não de uma tabela paralela.
2. **"Cadastro manual · exceção" ganha um botão de verdade**, ao lado de cada
   "Convidar", em `acessos.tsx` e `xacessos.tsx`. Cria o pendente (`convite_id = null`)
   e abre direto a classificação (`ClassificarAcessoModal`, que já lida com
   `convite === null`). **Isso substitui `auth.cadastro.tsx`** — a porta de entrada
   deixa de ser pública/espontânea e passa a ser sempre iniciada por alguém com acesso
   (Matriz, ou Master/Full pro próprio escopo), com log de quem criou.
3. **Desligamento ganha o par solicitar → aprovar**, no mesmo padrão que a Etapa 2 já
   validou para vendedor (`vendedor_solicitacoes`) e pra reclassificação (motivo
   obrigatório, rastro). Trava se houver time embaixo.
4. **`auth.cadastro.tsx` e `cadastro.functions.ts` saem de circulação** (V11.1.7) — a
   dependência que os mantinha no ar (sem criar-senha, aprovado não tinha como entrar)
   está resolvida desde o PR #104.

## Tasks

| Task | Tag | Descrição | Depende de |
| --- | --- | --- | --- |
| C1 | banco | **Log da criação manual**: coluna `empresas.criado_por` (quem acionou o "manual · exceção" — nulo quando vem de convite, onde o log já é o `criado_por` do convite) | — |
| C2 | banco | **RPC `criar_pendente_manual`**: cria `empresas`+`profiles` com `status='pendente'`, `convite_id=null`, `criado_por=auth.uid()` — substitui `cadastrar_franquia`/`cadastrar_franquia_admin` pro caminho manual | C1 |
| C3 | front | **Botão "Cadastro manual · exceção"** ao lado de cada "Convidar" (`acessos.tsx` interno/externo, `xacessos.tsx`), com o aviso "fica registrado como exceção da Matriz" e indo direto pra `ClassificarAcessoModal` | C2 |
| C4 | front | **Aba Cadastros Matriz** unificada: colaboradores (por cargo real, não preset) + Vendedor Matriz (CLT), filtro Cargo/Ano, busca, Configurar (reusa `UsuariosModal`)/Excluir | C1 |
| C5 | front | **Aba Cadastros Rede** nova: Masters + franquias (com `modelos_franquia.modalidade` real) + vendedores, filtro Perfil/Modelo/Ano, busca, Configurar/Excluir | C1 |
| C6 | banco | **Travas de exclusão** (V11.3.2): Master com franquia vinculada, ou franquia com vendedor na base, bloqueiam exclusão — RPC dedicada, não o `adminDeleteUser` genérico atual | — |
| C7 | banco | **Tabela `desligamento_solicitacoes`** (nome/motivo obrigatório/solicitante/alvo/status) + RPCs `solicitar_desligamento`/`resolver_desligamento` — mesmo padrão de `vendedor_solicitacoes`, mas para desligar | — |
| C8 | front | **Master solicita desligamento** (vendedor ou franquia) com motivo obrigatório, dentro de "Meus cadastrados" | C7 |
| C9 | front | **Matriz aprova/nega desligamento**, com a trava de C6 replicada aqui (franquia com vendedor bloqueia aprovação, sugere transferir antes) | C6, C7 |
| C10 | banco | **Motivo obrigatório em todo desligamento**: `check` condicional (só quando `status='suspensa'`, não trava a reativação que zera o motivo) + backfill dos nulos históricos | — |
| C11 | banco+front | **Retirar `vendedor_solicitacoes`/`CadastrarVendedorForm`**: Master passa a usar só "Convidar" (escopo `master`); migração dos dados pendentes existentes (se houver) antes do DROP | — |
| C12 | front | **Desligado sai da aba de Cadastros e entra em Desligamentos**; separar situação do cadastro (ativo/suspenso/desligado) do sinal de performance — parcial, o resto trava na Frente 4 | — |
| C13 | front+infra | **Botão "Quero falar com a Cote Certo"** no login: nome/e-mail/tema/mensagem → e-mail à Matriz **sem persistir** (server fn nova, direto no Resend, sem outbox — o outbox é pra retry garantido, isso aqui é dispara-e-esquece) | — |
| C14 | banco+front | **Remover `auth.cadastro.tsx`/`cadastro.functions.ts`**: tirar o link "Criar franquia" do login, desativar a rota; o caminho manual passa a ser exclusivamente C2/C3 | C2, C3 |
| C15 | testes | E2E: cadastro manual vira pendente correto e vai pra classificação; trava de exclusão (Master c/ franquia, franquia c/ vendedor); solicitar→aprovar desligamento com motivo obrigatório; `auth.cadastro.tsx` de fato fora do ar | C3, C6, C9, C10, C14 |

## Decisões que estou tomando, para você contestar

1. **`vendedor_solicitacoes` é retirada, não estendida.** O Convite Supper já faz o
   trabalho dela — melhor, porque já cria o usuário direto na aprovação
   (`aprovar_acesso`), sem o passo manual que hoje falta. Manter os dois seria manter
   um gap conhecido. Isso é uma decisão de escopo maior que a task original V11.3.4
   sugeria — se você já tem vendedores reais parados em `vendedor_solicitacoes` em
   produção, C11 precisa de um passo de migração antes do DROP.
2. **"Cadastro manual · exceção" precisa de log de autoria** (C1) que hoje não existe
   em lugar nenhum — nem em `empresas`, nem em `historico_alteracoes` (essa é
   só para mudança de **política**, com diretor+senha, não pra ação operacional; usar
   ela aqui seria forçar um mecanismo caro pra uma coisa simples).
3. **Desligamento ganha tabela própria (C7)**, não reaproveita
   `vendedor_solicitacoes` — são entidades diferentes (uma pede pra criar, outra pede
   pra encerrar) e a C11 já está retirando a primeira.
4. **`desligado_motivo` fica obrigatório só condicionalmente** (C10): a coluna também é
   usada com `null` quando alguém é reativado. `not null` na coluna quebraria isso —
   vai ser um `check (status <> 'suspensa' or desligado_motivo is not null)`.
5. **C12 fica parcial.** A separação completa "situação do cadastro" × "sinal de
   performance" depende da régua da Frente 4 (V11.4.1), que ainda não existe. Entrego
   a parte que não depende disso (desligado sair da lista de Cadastros) e devo o resto.
6. **C13 (Quero falar) não usa a infra de outbox** da Frente 2 estendida — é uma
   server function nova, mais simples, sem tabela, sem retry. É rota pública (sem
   login), então C13 também define um rate-limit básico — hoje nenhuma rota pública
   trata isso, e esta é a primeira a precisar.

## Riscos

1. **C11 (retirar `vendedor_solicitacoes`) pode ter dados reais em produção agora.**
   Antes de fazer qualquer DROP, preciso checar se existe solicitação pendente/aprovada
   de verdade e decidir o que fazer com ela (migrar pra convite manualmente, ou só
   avisar e deixar você resolver na faxina do banco que você já vai fazer).
2. **A trava de exclusão (C6) é nova em produção** — hoje quem exclui não tem barreira
   nenhuma. Isso é uma mudança de comportamento visível pra quem já usa Configurações
   pra excluir; vale confirmar que "bloquear e pedir pra resolver antes" é o
   comportamento certo (e não, por exemplo, excluir em cascata).
3. **Retirar `auth.cadastro.tsx` (C14) fecha a porta antiga de verdade** — depois disso,
   TODO cadastro nasce de convite ou de "manual · exceção" acionado por alguém logado.
   Se sobrar algum fluxo dependendo do autocadastro espontâneo que eu não vi no
   levantamento, ele quebra. Vale um aviso antes do deploy, não só no código.
4. **`empresas.parent_id` e `profiles.superior_id` são duas hierarquias independentes,
   e podem divergir.** Achado ao testar C7: `empresas_visiveis()` (o que realmente
   governa RLS/visibilidade — e o que `solicitar_desligamento` usa pra checar "está na
   minha rede") desce por `profiles.superior_id`; já C5/C6 usam `empresas.parent_id`
   pra "quantas franquias esse Master tem" e pra saber quem é dono de quem. Os dois só
   coincidem se `aprovar_acesso` setar `superior_id` corretamente no momento da
   aprovação (parâmetro `p_superior_id`, escolha manual de quem aprova) — nada garante
   isso hoje. Efeito prático: uma franquia pode aparecer "vinculada" a um Master em
   Cadastros Rede (C5) sem que esse Master consiga solicitar desligamento dela (C7),
   porque o RLS não reconhece o vínculo. Não bloqueia nada hoje (nenhum teste falhou
   por causa disso — os fixtures é que precisaram setar os dois campos), mas é uma
   inconsistência de dado real esperando pra acontecer em produção. Resolver de verdade
   significa escolher UM mecanismo como fonte da verdade e migrar o outro — fora do
   escopo desta Frente; registrado aqui pra não se perder.

## Sequência

C1 → C2 → C3 (log e botão manual primeiro, porque C14 depende dele) → C4/C5 (as duas
abas, que só dependem do log) → C6 (trava, banco) → C7/C8/C9 (desligamento, ponta a
ponta) → C10 (motivo obrigatório, depois que o fluxo de desligamento novo já escreve
motivo sempre) → C11 (retirar o sistema paralelo, só depois que C3 prova que o caminho
novo funciona) → C12 (parcial) → C13 (independente, pode entrar em qualquer ponto) →
C14 (fechar a porta antiga, só depois que C3 está validado em produção) → C15.

## Fechamento (03/08/2026)

- **C12 fechada.** A parte que dependia da Frente 4 era ter uma coluna própria pro
  sinal de performance, separada da situação do cadastro — a Frente 4 (D1) entregou
  isso: `profiles.performance_status` (ativo/atenção/travado) é coluna própria,
  calculada pelo job, e o front (D8) já renderiza os dois sinais como chips visualmente
  distintos lado a lado (`chip-outline`/`chip-ok` pra situação do cadastro,
  `chip-ok`/`chip-yellow`/`chip-alert` pro sinal de performance) — nunca um substituindo
  o outro.
- **C14 fechada.** `auth.cadastro.tsx` removida, link "Criar franquia" fora do login.
  `cadastrar_franquia_admin` continua no banco (o Convite Supper reusa). A RPC antiga
  `cadastrar_franquia(jsonb)` (sem `_user`) foi dropada também — ficou sem chamador
  algum depois da rota sair; os 3 testes que dependiam dela como fixture (não como
  assunto do teste) passaram a usar `cadastrar_franquia_admin` (mesmo formato,
  inclusive o bug de origem `role='vendedor'` que motiva o teste de regressão de
  `classificar-acesso-role.test.ts` — continua real, só que na RPC que hoje é usada
  de verdade). Um `it` ficou obsoleto de fato (provava que um client autenticado
  comum conseguia chamar uma RPC própria de auto-cadastro — não existe mais nenhuma)
  e foi removido, não adaptado.
- **C15 fechada.** E2E novo (`tests/e2e/cadastros-ciclo-vida.spec.ts`) — não havia
  nada pra adaptar. Cobre cadastro manual (pendente correto + abre classificação),
  trava de exclusão (Master c/ franquia, franquia c/ vendedor) e desligamento
  (motivo obrigatório → solicitar → aprovar), além de confirmar `/auth/cadastro`
  fora do ar (C14). Com isso, a Frente 3 está inteiramente concluída.
- **C13 fechada** (não listada nas linhas acima por descuido de bookkeeping — a
  implementação sempre esteve pronta). Botão "Quero falar com a Cote Certo" em
  `src/routes/auth.index.tsx`, server function `src/lib/contato.functions.ts`
  (rate-limit em memória, chamada direta ao Resend, sem outbox — dispara-e-esquece,
  como decidido acima).
