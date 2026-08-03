# Plano — Frente 4 · Régua de performance

**Aberto em:** 03/08/2026 · **Status:** aguardando aprovação para implementar

**Escopo:** V11.4.1 a V11.4.6 do `PLANO_TASKS_V11.md` — regra 12 do Relatório DE/PARA,
item 5 do Handoff de Produção.

## O que existe hoje (achado no levantamento)

A régua está **inteiramente simulada no protótipo** (`cotecerto_prototipo_v11.html`,
objeto `PERF_RULES`) e **não existe nada no banco real** — nem tabela, nem coluna de
sinal, nem job. É greenfield total. Pontos que a implementação real precisa decidir
diferente do protótipo (documentados como decisões abaixo):

- O protótipo tem os campos `diasA`/`diasT` ("dias sem venda") na tela de configuração,
  mas **nunca os usa** no cálculo (`statusPerf()` só olha conversão e cancelamentos).
- "Revisar e reativar" no protótipo (`perfReativar()`) é só um `toast()` — não grava
  quem revisou nem quando. Exatamente a lacuna que V11.4.4/V11.4.6 pedem para fechar.
- "Notificar supervisor" no protótipo também é só um `toast()` — não persiste nada,
  não envia nada de verdade.
- A régua da Franquia Full (`scope='full'`) é salva **sem** gate de senha de diretor no
  protótipo — só os escopos interno/rede passam por `dirGate()`.
- "Pausa ativa" (citada na task V11.4.4) não é um recurso próprio — é o toggle
  `pausaLeads` da própria régua. Não existe "vendedor se pausar" em lugar nenhum.

Infra que **já existe e será reaproveitada sem mudança**:

- `fn_confirmar_senha_diretor` + `fn_registrar_alteracao` (V11.0.5/V11.0.6) — gate de
  diretor e histórico append-only. Salvar a régua chama essas duas, não inventa nada novo.
- Padrão de job periódico via `pg_cron`, com fallback `insufficient_privilege`
  (`20260719045047_g6_1_cron_renovacao.sql` é o template a seguir).
- `distribuir_lead_auto()` (`20260713190000_fix_distribuicao_guards_avaliacao.sql`) e
  `distribuir_fila_pendente()` — os dois pontos que precisam aprender a ignorar quem
  está travado.

## Tasks

| Task | Tag | Descrição | Depende de |
| ---- | --- | --------- | ---------- |
| D1 | banco | Tabela `regua_performance_config` (3 linhas fixas: `interno`/`rede`/`full`) com os limites configuráveis + colunas de sinal em `profiles` (`performance_status`, `performance_motivo`, `performance_calculado_em`, `performance_revisado_em`, `performance_revisado_por`) | — |
| D2 | banco | `fn_salvar_regua_performance(bloco, ...)` — grava a config chamando `fn_registrar_alteracao` (área "Performance", gate de diretor) para os **três** blocos, inclusive `full` | D1 |
| D3 | banco | `fn_calcular_performance_pessoa(profile_id, bloco)` — números da janela deslizante (leads, cotações, propostas, vendas, conversão %, cancelamentos, comissão, meta); janela em dias corridos, não mês-calendário (as views `v_vendedor_kpis`/`v_franquia_kpis` são mês-fixo, não servem aqui) | — |
| D4 | banco | Job periódico `recalcular_regua_performance()` (pg_cron diário, padrão do G6.1) — roda D3 para todo vendedor elegível (CLT interno, vendedor de rede, franqueado Individual-como-vendedor) e grava o sinal calculado | D1, D3 |
| D5 | banco | `distribuir_lead_auto()` e `distribuir_fila_pendente()` passam a excluir quem está `travado` com `pausa_leads_ativa=true` na régua do próprio bloco | D1 |
| D6 | banco | `fn_revisar_reativar_performance(profile_id, motivo?)` — Supervisor/Matriz registra a revisão; volta o sinal para `atenção` (não `ativo` — a régua reavalia no próximo job) e grava `performance_revisado_em/_por` | D1 |
| D7 | front | Sub-aba **Performance** em Personalização geral (Matriz · interno e rede) — os 2 blocos, mesmo componente parametrizado por bloco, salva via D2. Bloco `full` fica pendente (ver nota abaixo) | D2 |
| D8 | front | Selo clicável (`Ativo`/`Atenção`/`Travado`) nas listas que já mostram vendedor (Cadastros Matriz, Cadastros Rede) — abre modal de resumo com números (D3) e motivo. Central da Franquia fica pendente (ver nota abaixo) | D3, D4 |
| D9 | front | Modal de resumo: botão **Notificar supervisor** (aviso local, sem persistência — mesmo nível do protótipo) e **Revisado — reativar** (só quando `travado`, chama D6) | D6, D8 |
| D10 | testes | Travado com `pausa_leads_ativa` não recebe lead (auto **e** fila manual); reativação sem RPC de revisão não muda o sinal; cálculo de conversão/cancelamento da janela; gate de diretor bloqueia salvar régua sem senha (nos 3 blocos, inclusive `full`) | D5, D6, D2 |

## Decisões que estou tomando, para você contestar

1. **`diasA`/`diasT` passam a valer de verdade**, diferente do protótipo (que tem o
   campo mas não usa). "Dias sem venda" é um sinal que o próprio protótipo promete na
   tela de configuração — implementar sem usar seria entregar uma configuração
   decorativa. Critério: `dias sem venda >= diasT` também trava, `>= diasA` também
   marca atenção (em OU com a conversão/cancelamento, não em E — qualquer critério
   isolado já muda o sinal).
2. **A régua `full` só é editável pela Matriz (com senha de diretor), não pelo
   franqueado** — diverge do protótipo de propósito. No protótipo, o franqueado Full
   salva a própria régua sem gate nenhum; como é um bloco **global** (não por empresa —
   confirmado no código: `PERF_RULES.full` é um objeto único, não por franquia), deixar
   qualquer Full editar mudaria o critério de **todas as outras** Fulls ao mesmo tempo.
   Isso é meio que um buraco de governança que o protótipo tem e a V11 real não deveria
   ter. O franqueado Full continua vendo a régua (read-only) e os selos do próprio time.
3. **"Notificar supervisor" fica igual ao protótipo — sem persistir nada.** Só um aviso
   local (toast). A task V11.4.6 só exige teste para a reativação, não para a
   notificação; construir notificação real (quem recebe, onde aparece, se é e-mail ou
   in-app) é escopo novo que a task não pede e o protótipo não define.
4. **Reativação volta o sinal para `atenção`, nunca `ativo`** — replica o protótipo de
   propósito aqui (é o comportamento correto: a régua reavalia com dado fresco no
   próximo job; se a pessoa realmente melhorou, o job resolve sozinho).
5. **Cadência do job: diária**, mesmo horário do cron de renovação (06:00). O Handoff só
   diz "periódico" sem número; diário é o menor incremento razoável para uma janela de
   30 dias corridos, e evita recalcular a cada minuto sem necessidade.
6. **As 3 réguas (`interno`/`rede`/`full`) ficam numa tabela só**, uma linha por bloco —
   não uma tabela por bloco. Simplifica a RPC de salvar e o job (que itera as 3 linhas).

## Nota — bloco `full` sem tela própria por agora

Descoberto ao começar D7: a página "Central da Franquia" (onde o franqueado
Full veria/editaria a régua do próprio time) **não existe no app real** — só
no protótipo (`data-nav="xcentral"`). Construí-la é exatamente a Frente 5
(V11.5.1/V11.5.2 do `PLANO_TASKS_V11.md`), e V11.5.1 está **bloqueada por uma
decisão pendente da Lis** (item 11 do Handoff: "endereço único" das
configurações da Full — Central da Franquia × Acessos › Personalização).

Decisão (confirmada com o usuário em 03/08/2026): D7/D8/D9 agora cobrem só
Personalização geral (Matriz · interno e rede). O bloco `full` já está
completo e testado no banco (D1-D6 tratam os 3 blocos igual) — só a tela do
franqueado Full pra ver a própria régua/selo/resumo fica pendente até a
Frente 5 resolver o endereço. D10 testa os 3 blocos no banco; os testes de
front cobrem só o que tem tela.

## Riscos

1. **O documento "Regras Decididas" citado pelo DE/PARA e pelo Handoff não veio no
   pacote e não está no repo.** Os limiares (`conv_atencao`, `conv_travado`, `dias_a`,
   `dias_travado`, `cancelamentos_limite`) que vou usar como *default* são os mesmos
   números de exemplo do protótipo — não são a regra de negócio real, só um ponto de
   partida editável. **Pedir à Lis os valores reais antes de considerar a régua
   "correta" em produção** (a V11.9.3 já registra isso; repito aqui porque é a régua
   quem mais depende disso).
2. **Conversão % e cancelamentos não existem hoje como métrica persistida** — vou
   derivar de `leads`/`propostas` na janela (D3). Se a definição de "cancelamento" da
   Lis for diferente do que estou assumindo (`propostas.cancelada_em` dentro da
   janela), o número sai errado silenciosamente até alguém notar.
3. **Job diário pode não ser frequente o suficiente** se a operação esperar que
   "Travado" reflita quase em tempo real. Fácil de ajustar a cadência depois; deixo
   registrado para não ser pego de surpresa se a expectativa for outra.
4. **Duas funções de distribuição precisam do mesmo ajuste** (`distribuir_lead_auto` e
   `distribuir_fila_pendente`) — lógica duplicada no banco hoje; esquecer uma delas
   deixaria a fila manual furando a trava enquanto a automática funciona.

## Sequência

D1 (schema) → D2 (salvar régua, reusa diretor+histórico) → D3 (cálculo da janela) → D4
(job, chama D3) → D5 (trava na distribuição, lê o sinal que D4 grava) → D6 (revisão) →
D7/D8/D9 (front, depende de D2/D3/D4/D6 já existirem) → D10 (testes, fecha tudo).
