# Plano — Frente 5 · Franquia Full como matrizinha (V11)

**Aberto em:** 03/08/2026 · **Gatilho:** a Lis respondeu as 6 perguntas em aberto
(`docs/PERGUNTAS_PARA_LIS.md`) e enviou `CoteCerto_Regras_Decididas.html` — as duas
travas que impediam planejar esta frente em detalhe (endereço das configurações e o
conteúdo da regra 12) caíram.

Este documento substitui a tabela solta de V11.5.1-7 em `docs/PLANO_TASKS_V11.md` por
um plano com sequência, dependências e o que já está construído de graça por outras
frentes.

**Fechamento parcial em 04/08/2026:** V11.5.1/2a/2b/3/7/8 entregues, testadas
(523 testes de banco + 216 unitários + 23 E2E, todos verdes) e prontas pra PR.
V11.5.4/5.5/5.6 (Personalização/Performance da Full) ficaram **bloqueadas** — ver
"Fechamento parcial" no fim deste documento — até o protótipo r41 chegar. Continuam
listadas abaixo como o plano original, para registro.

## O que já existe hoje (achado ao planejar)

- **Régua de performance (D1, Frente 4) já tem um bloco `'full'`** em
  `regua_performance_config`, com valores-padrão próprios (janela 30d, atenção 22%/12d,
  travado 12%/18d, 3 cancelamentos) — só falta a **tela** da Full editar o próprio
  bloco. `fn_salvar_regua_performance`/`fn_calcular_performance_pessoa` já são
  agnósticas de bloco. V11.5.6 fica bem mais barata do que a tabela original sugeria.
- **`distribuicao_config` é singleton** (`id='default'`, `sla_segundos=180` fixo) — não
  existe SLA por empresa/franquia hoje. V11.5.3 precisa de tabela nova, não de coluna.
- **`app-shell.tsx` não tem nenhuma ramificação por `modelo`/Full** — o franqueado Full
  recebe hoje o mesmo menu do Master (áreas de rede), não o espelho de 16 áreas da
  Matriz. V11.5.4/V11.5.2 precisam desse recorte novo.
- **Comissão (G4) não olha `leads.canal_id`/origem em nenhuma migration** — confirmado
  por grep em todas as migrations de comissão. Isso não estava na tabela original de
  Frente 5; é demanda nova da regra 9 das Regras Decididas. Entra como **V11.5.8**.

## Decisões da Lis que fecham o desenho

- **V11.5.1 resolvido:** endereço definitivo é **Acessos e permissões › Personalização
  geral/Performance** (mesmo padrão da Matriz). A Central da Franquia fica **só** com a
  operação de leads (Central de leads + Distribuição · SLA · Canais). Já refletido no
  protótipo r41 (a caminho).
- **Regra 8:** Full é "matrizinha" — gerencia o próprio time com autonomia (inclui/exclui
  sem depender da Matriz, mas o vendedor dela se autocadastra e a fila é da própria
  franquia — já implementado em F9). Menu espelha a Matriz com **16 áreas**, de fora só
  Franquias e Configurações globais. Comissionamento e modelo operacional são
  **customizados por operação**, não uma tabela fixa por classificação.
- **Regra 9:** comissão por origem do lead (canal próprio da Full × repassado pela
  Matriz) é **definida pela Matriz**, nas configurações — não pela franquia.
- **Regra 10:** a Full define o próprio SLA, não precisa ser os 3 min da Matriz.
- **Regra 12 (parte Full):** a franqueada **poderá** ter a régua própria — coerente com
  a matrizinha; não é obrigatório ela ter uma diferente da Matriz, é opção dela ativar.

## Tasks

| Task     | Tag    | Descrição                                                                                                                                                 | Depende de       |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ~~V11.5.1~~ | —   | ✅ Resolvido — endereço: Acessos e permissões › Personalização geral/Performance                                                                          | —                |
| V11.5.2a | banco  | Menu de 16 áreas pro franqueado Full (espelho da Matriz sem Franquias/Configurações globais) — nova função/regra de escopo em `app-shell.tsx`/RLS         | —                |
| V11.5.2b | front  | **Central da Franquia**: só leads — Central de leads, Distribuição, SLA, Canais próprios (leads próprios × repassados da Matriz)                          | V11.5.2a          |
| V11.5.3  | banco  | Tabela de SLA **por empresa** (não mais singleton); repassado segue o SLA da Matriz, próprio segue o da Full                                                | V11.5.2a          |
| V11.5.4  | front  | Acessos e permissões da Full: Personalização geral/Performance espelhando a Matriz (Modelo Franquia/CLT, Desconto, Respostas, **Performance**, sem Diretores/Histórico) | V11.5.1, V11.5.2a |
| V11.5.5  | front  | Modelo CLT + complementos pra Full; cadastro direto passa pela configuração (produtos/canais/comissão por pessoa, selo "personalizado")                    | V11.5.4           |
| V11.5.6  | front  | Régua própria **opcional** da Full na sub-aba Performance — banco já existe (bloco `'full'` do D1); só falta permitir a Full chamar `fn_salvar_regua_performance`/ver seu próprio bloco | V11.5.4           |
| V11.5.7  | banco  | Lead repassado que dá perda ou estoura SLA **cruza a fronteira** e volta como Devolvido/Perda da Matriz                                                    | V11.5.3           |
| V11.5.8  | banco  | Comissão por origem do lead: regra diferente pra canal próprio × repassado, **definida pela Matriz** nas configurações (não pela franquia)                 | V11.5.2a          |
| V11.5.9  | testes | RLS + regras de negócio das tasks acima (escopo de 16 áreas, SLA por empresa, régua opcional, comissão por origem, cruzamento de fronteira)                | todas acima       |

## Riscos e decisões conscientes

1. **V11.5.2a (menu 16 áreas) é pré-requisito silencioso** de quase tudo — sem ele, a
   Full continua vendo o menu de Master e nenhuma das telas novas aparece. Vai primeiro.
2. **V11.5.3 muda o shape de `distribuicao_config`** (de singleton pra por-empresa) —
   precisa decidir se vira tabela nova (`sla_config` por `empresa_id`, com fallback pro
   singleton quando a empresa não tem override) em vez de alterar a tabela existente,
   pra não quebrar o SLA global da Matriz que já está em produção.
3. **V11.5.8 (comissão por origem) não estava na tabela original da Frente 5** — é
   escopo novo, descoberto só agora com as Regras Decididas. Fica dentro desta frente
   porque nasce exclusivamente do contexto Full (canal próprio vs repassado), mas é
   trabalho de tamanho comparável ao G4 original (regras de campanha/comissão) — vale
   tratar como sub-entrega própria dentro da frente, não como 1 task pequena.
4. **Fora de escopo desta frente:** Carteira de Recuperação (Lis decidiu V12); override
   de aprovação da Matriz sobre vendedor Full (Lis decidiu manter como está); escopo de
   leitura do Marketing/Assistente Comercial (decidido, mas é mudança de ~22 policies
   sem relação com a Full — task separada, fora desta frente).
5. **Hierarquia Coordenador acima dos Supervisores (regra 5):** investigado — H6
   deriva a alçada de desconto por `has_role`/cargo direto, não por `superior_id`
   recursivo pros dois Supervisores. Apontar `superior_id` deles pro Coordenador não
   teria efeito funcional hoje (o Coordenador já vê tudo via `empresas_visiveis`, igual
   à Matriz). Tratado como puramente organizacional — **sem task**, a menos que apareça
   um uso funcional concreto depois (notificação, escalonamento).

## Sequência de implementação

1. **Banco primeiro:** V11.5.2a (menu 16 áreas) → V11.5.3 (SLA por empresa) → V11.5.8
   (comissão por origem) → V11.5.7 (cruzamento de fronteira).
2. **Front depois, já com o banco pronto:** V11.5.2b (Central da Franquia) →
   V11.5.4 (Acessos/Personalização) → V11.5.5 (Modelo CLT) → V11.5.6 (régua opcional).
3. **V11.5.9 (testes)** fecha a frente, com `supabase db reset` limpo antes da contagem
   final — mesmo padrão das frentes anteriores.

## Fechamento parcial (04/08/2026)

**Entregue e testado** — V11.5.1 (decisão), V11.5.2a (menu 15 áreas — ver nota abaixo),
V11.5.2b (Central da Franquia: leads/distribuição/SLA/canais), V11.5.3 (SLA por
empresa), V11.5.7 (SLA por lead + fronteira repassado/próprio), V11.5.8 (config +
resolução de comissão por origem, sem integrar ainda no motor de fechamento — ver
migration `20260803160000`). 523 testes de banco + 216 unitários + 23 E2E, todos verdes,
2 rodadas com `supabase db reset` limpo.

**Nota sobre V11.5.2a:** a Lis registrou "16 áreas"; a exclusão nomeada (Franquias +
Configurações globais) sobre as 17 do time interno dá **15**. Implementado como 15
(exclusão nomeada, não forçada pra bater com o número) — divergência pra confirmar
com a Lis quando o r41 chegar.

**V11.5.4/5.5/5.6 BLOQUEADAS, movidas pra uma futura Frente 5b** — decisão do usuário
em 04/08/2026, depois de eu investigar e achar 3 problemas no desenho original:

1. **Desconto e Respostas padrão só podem ser leitura pra Full** — a escrita é
   `has_role('matriz')` + gate de diretor (G6.1), e diretor é marcação exclusiva de
   perfil Matriz (regra 2). Não tem como a Full editar essas duas por design.
2. **"Modelo CLT" (`clt_config`) é um singleton global da Matriz**, igual
   `distribuicao_config` era antes da V11.5.3 — define o modelo de comissão do
   Vendedor Matriz interno, sem relação com o time da própria Full. A V11.5.5 original
   ("Modelo CLT + complementos pra Full") provavelmente lia mal o task original do
   plano — precisa reinterpretar à luz do r41, não assumir que é reaproveitar o painel
   global.
3. **A régua de performance trava pra Full por completo hoje**: `fn_salvar_regua_
   performance` exige gate de diretor pros 3 blocos (interno/rede/full), e Full nunca
   pode ser diretora — o comentário da própria migration D2 já admitia a divergência
   ("diverge do protótipo, que deixava o bloco full sem senha"). Além disso hoje existe
   **1 linha compartilhada** pro bloco `'full'` inteiro — se "régua própria" (regra 12)
   for por franquia (não uma só pra todas as Fulls), falta uma tabela de override por
   empresa, mesmo padrão da V11.5.3 (SLA), não só destravar a RPC existente.
4. **Consultado `docs/MAPA_PROTOTIPO_PERFIS.md` (r40):** a Full hoje só usa o mesmo
   Acessos do Master (`xacessos`, lista de equipe) — o r40 nunca teve uma aba de
   Personalização/Performance pra Full. Essas 3 tasks vieram da leitura das Regras
   Decididas, não de uma tela existente no protótipo — e a Lis avisou que o r41 (ainda
   não recebido) já corrige itens relacionados a esta frente.

**Decisão do usuário:** esperar o r41 chegar antes de desenhar essa tela, em vez de
arriscar retrabalho. PR aberto agora com o que está pronto; V11.5.4/5.5/5.6 voltam como
Frente 5b quando o r41 e o Handoff atualizado chegarem.

## Frente 5b — fechada em 04/08/2026

O r41 chegou junto com Regras Decididas + Handoff atualizado + Respostas de produto,
resolvendo as 3 dúvidas que travavam (ver seção acima). Entregue e testado:

- **V11.5b.1** — `fn_registrar_alteracao_franquia`: porta de escrita do histórico da
  franquia, gate por identidade (franqueado dono da empresa + modalidade Full via
  `fn_bloco_performance`), nunca senha de diretor.
- **V11.5b.2** — `fn_salvar_regua_performance_full`: a Full salva a própria régua
  (bloco `'full'`, linha COMPARTILHADA de `regua_performance_config`, D1) direto, sem
  senha, sem o toggle "Notificar o supervisor" (r41 confirma que não existe pro bloco
  full).
- **V11.5b.3** — tabela `full_comissao_complementos` (1 linha por empresa) +
  `fn_salvar_complementos_full`: comissão de venda/renovação (%) + bônus de
  campanha/meta da equipe (texto livre, r41 confirma), sem senha.
- **V11.5b.4/5** — `xacessos.tsx` ganhou toggle de 3 seções (Meu time / Personalização
  geral / Performance) — só visível pra Full (`isFranqFull`, nunca Master/Supervisor).
  Personalização geral tem 2 sub-abas: Modelo CLT (resumo somente-leitura do
  `clt_config` global + card editável "Complementos do time") e Histórico (só da
  própria franquia, filtro explícito de `empresa_id`).

**Decisão consciente, não bug:** nenhuma das 3 RPCs novas tem bypass de Matriz/Coordenador
(diferente de `fn_salvar_sla_empresa`, V11.5.3, que permite) — o r41 não mostra nenhum
caminho de Matriz editar régua/complementos de uma Full específica; é autonomia
exclusiva da "matrizinha" (regra 8). Se a operação real precisar de um override
administrativo, é task nova.

**Testado:** 553 testes de banco (30 novos) + 216 unitários + 29 E2E, verificado
manualmente no navegador (login real como Franquia Full, salvar Complementos e régua
sem nenhum modal de senha, ver a entrada no Histórico da franquia). Um bug de teste
(locator ambíguo, `<h1>` duplicado entre app-shell e a página) corrigido durante a
verificação — não é bug de produto.

Com isso, **a Frente 5 fecha por completo** — não fica mais nenhuma task V11.5.x
bloqueada.

## Frente 5b — desbloqueada em 04/08/2026 (r41 + Regras Decididas + Handoff atualizado + Respostas)

O r41 (`cotecerto_prototipo_v11.html`, função `fullAcessosPage()`/`fullPersoBody()`/
`perfRulesCard()`/`fullComCard()`) tem a tela real, não é mais suposição. Achados que
resolvem as 3 dúvidas do fechamento parcial:

1. **A régua da Full não passa por senha de diretor.** `perfSaveGate(scope)` no r41:
   pra `scope==='full'` salva direto e grava no histórico da franquia; pra `int`/`rede`
   passa por `dirGate` (senha de diretor). Bloco `'full'` continua **compartilhado**
   (uma linha só, não por empresa) — minha suspeita anterior de precisar de tabela de
   override por empresa estava errada. `regua_performance_config` (D1) já serve como
   está; só falta uma RPC de salvar sem senha, gate por identidade (é você mesma,
   franqueada Full) em vez de diretor.
2. **"Modelo CLT" pra Full = leitura do modelo global da Matriz + edição de
   "Complementos do time" (própria da franquia)** — não é o painel `ModeloCltPanel`
   inteiro editável. Complementos = 4 campos por empresa (comissão de venda %,
   comissão na renovação %, bônus de campanha, meta padrão da equipe), sem senha,
   mesmo gate de identidade da régua. Tabela nova (`full_comissao_complementos` ou
   nome equivalente, PK `empresa_id`).
3. **`historico_alteracoes` já tem `empresa_id`** desde a V11.0.6 ("nulo = Matriz,
   preenchido = franquia") — a tabela não precisa de nada novo. O que falta é a
   **porta de escrita**: `fn_registrar_alteracao` (a única hoje) exige
   `fn_confirmar_senha_diretor` sempre — incompatível com Full nunca ser diretora.
   Precisa de uma RPC irmã, `fn_registrar_alteracao_franquia(p_empresa_id, area,
   o_que, de_para)`, com gate de identidade (`has_role('franqueado')`,
   `profiles.empresa_id = p_empresa_id`, `fn_bloco_performance(p_empresa_id) =
   'full'`) em vez de senha — usada tanto pela régua quanto pelos complementos.

Estrutura confirmada da tela (`fullAcessosPage()`, 5 abas): Meu time / Pendentes de
aprovação / Desligamentos (as 3 já implementadas, F1-F9) + **Personalização geral**
(2 sub-abas: Modelo CLT·comissionamento, Histórico) + **Performance** (régua própria).
`xacessos.tsx` hoje não tem esse sistema de abas (as 3 primeiras seções aparecem juntas,
sem toggle) — as 2 novas entram como seções com toggle, no mesmo padrão de
`perso-geral.tsx` (`toggle-sub`).

### Tasks

| Task     | Tag    | Descrição                                                                                                    | Depende de |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------- | ---------- |
| V11.5b.1 | banco  | `fn_registrar_alteracao_franquia(p_empresa_id, area, o_que, de_para)` — porta de escrita do histórico da franquia, gate por identidade (não senha) | —          |
| V11.5b.2 | banco  | `fn_salvar_regua_performance_full()` — só bloco `'full'`, sem senha, gate por identidade, grava via V11.5b.1  | V11.5b.1   |
| V11.5b.3 | banco  | Tabela `full_comissao_complementos` (empresa_id PK) + `fn_salvar_complementos_full(...)`, sem senha, gate por identidade, grava via V11.5b.1 | V11.5b.1   |
| V11.5b.4 | front  | `xacessos.tsx`: seções Personalização geral (CLT leitura + Complementos edição) e Performance, com toggle    | V11.5b.2, V11.5b.3 |
| V11.5b.5 | front  | Sub-aba Histórico da franquia — reusa o padrão de `HistoricoPanel` (G6.5), filtrado por `empresa_id` própria | V11.5b.1   |
| V11.5b.6 | testes | RLS das 3 RPCs novas (só a própria Full, nunca outra franquia, nunca sem ser Full); histórico da franquia aparece certo | todas acima |

### Riscos

1. **Gate de identidade precisa ser preciso**: `has_role('franqueado')` sozinho não
   basta — Individual também é `franqueado`. Sempre combinar com
   `fn_bloco_performance(p_empresa_id) = 'full'` (D5, já usado em V11.5.3/V11.5.7).
2. **`perfRulesCard('full')` no r41 esconde o toggle "Notificar o supervisor"** (só
   existe pra int/rede) — replicar essa omissão no front, não é esquecimento.
3. **Não criar tabela de override por empresa pra régua** — é o erro que eu ia cometer
   antes do r41 chegar. Bloco `'full'` é uma linha só, compartilhada.
