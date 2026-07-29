# Plano — Frente 1 · Convite Supper

**Aberto em:** 29/07/2026 · **Status:** aguardando aprovação para implementar

**Branch:** `feat/v11-convite-supper` (da `main`, com a Frente 0 já mergeada no PR #97)

**Escopo:** V11.1.1 a V11.1.5 e V11.1.8 do `PLANO_TASKS_V11.md`. **Fora:** V11.1.6
("Quero falar") e V11.1.7 (remover o autocadastro), que dependem da frente de e-mail
adiada.

**Fontes:** fluxo "Autocadastro" em `docs/v11/FLUXOS_OPERACIONAIS.html` · Etapa 1 do
Relatório DE/PARA · item 1 do Handoff · `openConvite`/`cvGerar`/`cvSel` no protótipo r40.

## A mudança de conceito

Hoje qualquer um se cadastra sozinho (`auth.cadastro.tsx`) e a Matriz descobre depois quem
é. Na V11 **o cadastro não existe sem convite**: quem está acima gera um link nominal de uso
único que já carrega perfil e vínculo, e o formulário abre com esses campos **em texto fixo**
— quem recebe não altera; se estiver errado, pede outro convite.

O ganho não é de tela, é de dado: o pedido chega na fila **já classificado**, então a
aprovação confirma em vez de adivinhar. É o que permite a Frente 2 rotear a fila
automaticamente (vendedor de Full nunca cai na Matriz).

## O que o convite carrega

Extraído de `cvSel()` no protótipo — é o payload estruturado que a Frente 2 vai consumir:

| Campo | Valores | Para quê |
| --- | --- | --- |
| `trilha` | `interno` \| `externo` | define o resto do formulário e a fila de destino |
| `perfil` | `master`, `franquia_full`, `franquia_indiv`, `vendedor` | o tipo declarado |
| `cargo_id` | um dos 7 presets, ou `vend_matriz` | só na trilha interna |
| `vinc_tipo` | `master` \| `full` \| `matriz` | a quem o convidado se liga |
| `vinc_id` | uuid | qual Master / qual Franquia Full |
| `nome` | texto | nominal: o convite vale para uma pessoa |

## Quem convida o quê — os 4 escopos

Do protótipo (`openConvite(scope)`), e é aqui que a segurança mora: **o escopo restringe as
opções no servidor, não só na tela.**

| Escopo | Quem usa | Pode convidar | Vínculo |
| --- | --- | --- | --- |
| `interno` | Matriz / Coordenador | os 7 cargos + Vendedor Matriz | Matriz |
| `externo` | Matriz / Coordenador | Master e Franquia Individual direta | Matriz |
| `master` | Master | Franquia Full, Individual, Vendedor·Master, Vendedor·Full | **travado nele** |
| `full` | Franquia Full | só Vendedor \| Full | **travada na franquia dele** |

Note as ausências, que são regra e não esquecimento: o Master **não** convida outro Master
nem ninguém do time interno; a Full convida **só** o vendedor dela.

## Tasks

| Task | Tag | Descrição | Depende de |
| --- | --- | --- | --- |
| C1 | banco | Tabela `convites`: token, nominal (`nome`), payload estruturado acima, `validade` (demo 7d), `usado_em`, `criado_por`. RLS: cada escopo só cria o que lhe cabe e só vê os próprios convites | — |
| C2 | banco | RPC `criar_convite` que **valida o escopo no servidor** a partir do perfil de quem chama, e gera o token no formato do protótipo (`SC-` + 6) | C1 |
| C3 | banco | RPC `abrir_convite(token)` — pública para anônimo: devolve o payload para pré-preencher, ou erro tipado (`expirado`, `usado`, `inexistente`). **Não** devolve dados de quem convidou além do nome | C1 |
| C4 | front | Modal Convidar, com as opções recortadas por escopo e o vínculo travado onde o protótipo trava | C2 |
| C5 | front | Mensagem pronta de WhatsApp (texto do protótipo, com as 3 instruções e o aviso de 7 dias), botão Copiar e `wa.me` | C4 |
| C6 | front | **PDF da arte oficial** com logo e link clicável, mais a pré-visualização no modal. Reaproveitar o padrão de `src/lib/export-relatorio.ts` (jsPDF já é dependência) | C4 |
| C7 | front | Rota **`/convite/$codigo`**: chama `abrir_convite`, abre o cadastro com perfil e vínculo em **texto fixo** | C3 |
| C8 | front | Erro amigável de link expirado/reusado, com o caminho de pedir novo convite | C7 |
| C9 | banco | Consumir o convite ao concluir o cadastro: marca `usado_em` e grava o pedido **já classificado** | C7 |
| C10 | testes | RLS: Master não convida Master nem interno; Full só convida vendedor dela; token de outro escopo é rejeitado no servidor | C2 |
| C11 | testes | E2E do caminho: gerar convite → abrir pelo link → cadastrar → cair na fila certa. Mais expirado e reuso | C9 |

## Decisões que estou tomando, para você contestar se discordar

1. **Token opaco, não JWT.** `SC-` + 6 caracteres é curto e caberia em força bruta, então o
   token do protótipo serve de *rótulo* e a validação real é por uma coluna aleatória longa.
   Mantenho o formato curto na URL só se ele for suficientemente aleatório; senão a URL leva
   o token longo e o `SC-` fica como identificador humano no histórico.
2. **`abrir_convite` é RPC pública, não policy.** O convidado ainda não tem login, então
   quem lê o convite é `anon`. Uma policy em `anon` abriria a tabela; uma RPC `security
   definer` devolve só o necessário e registra a tentativa.
3. **Validade configurável, com 7 dias de padrão.** O protótipo diz 7 dias e o Handoff diz
   "validade configurável (demo: 7 dias)" — então é coluna, não constante.
4. **O convite cria pedido, nunca usuário ativo.** Está explícito na orientação ao
   programador da Etapa 1. O cadastro pelo link termina em pedido pendente.

## Riscos

1. **Sem e-mail, o aprovado não entra.** O convite funciona (WhatsApp/Copiar/PDF), o pedido
   entra na fila e a aprovação acontece — mas criar senha é a frente adiada. Enquanto isso o
   caminho atual de `auth.cadastro.tsx` continua no ar, e é por isso que V11.1.7 não entra
   aqui. Sem essa ordem, o sistema fica sem porta de entrada.
2. **Escopo validado só na tela seria um furo sério.** Se `criar_convite` não conferir o
   perfil de quem chama, um Master forja um convite de Direção e a fila da Matriz aprova um
   acesso interno. Por isso C2 é banco e C10 testa o negativo de cada escopo.
3. **O PDF é o entregável mais frágil.** Arte oficial com logo e link clicável em jsPDF dá
   trabalho e é fácil sair diferente do protótipo. Se apertar, C6 sai por último — o convite
   funciona sem ele (WhatsApp e Copiar cobrem o caminho).

## Sequência

C1 → C2 → C3 (banco inteiro primeiro, com C10 fechando) → C7/C8 (a rota, que é o item 1 do
Handoff) → C4/C5 (o modal e as saídas de texto) → C9 → C11 → C6 (PDF por último).
