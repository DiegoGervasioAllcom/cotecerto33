# Plano de Tasks — CoteCerto V11

**Base:** `docs/ANALISE_LACUNAS_V11.md` (corte 28/07/2026) · pacote V11 em `docs/v11/`

**Referência de UX:** `cotecerto_prototipo_v11.html` (build 28/07 · r40)

**Fonte da verdade das regras:** `docs/v11/FLUXOS_OPERACIONAIS.html`

## Como ler este plano

As tasks seguem a numeração `V11.<etapa>.<n>` e espelham as etapas aprovadas do
Relatório DE/PARA. Cada linha traz a tag do agente responsável (`banco`, `front`,
`infra`, `testes`) conforme o fluxo obrigatório do `AGENTS.md`: **planejador → especialista
→ testes → revisor**, com aprovação explícita do usuário antes de qualquer implementação.

A Definition of Done do `AGENTS.md` vale integralmente, com uma troca: onde se lê
"tela igual ao protótipo V10", leia-se **protótipo V11 r40**.

## Frente 0 · Pré-obra da V11

Sem isso, toda tela da V11 nasce em cima de premissa errada.

| Task    | Tag    | Descrição                                                                                                                               | Depende de       |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| V11.0.1 | front  | ✅ Diffar o CSS do protótipo r40 contra `src/styles/proto.css` e aplicar o delta (regra 6: byte a byte)                                 | —                |
| V11.0.2 | banco  | ✅ `public.perfil += 'coordenador'`; supervisor Vendas × Operacional resolvido como **cargo** (ver `PLANO_HIERARQUIA_V11.md`)           | —                |
| V11.0.3 | banco  | ✅ Tabela de **cargos** + áreas de escopo (7 presets + Vendedor Matriz), com RLS e checks                                               | V11.0.2          |
| V11.0.4 | banco  | ✅ Taxonomia única de **canais** (item 9): tabela + `leads.canal_id` + `profile_canais`. **Telas pendentes** — ver nota abaixo          | —                |
| V11.0.5 | banco  | ✅ Marcação de **diretor** no cadastro (mín. 2, não é cargo) + verificação da senha no servidor e a única porta de escrita do histórico | V11.0.2          |
| V11.0.6 | banco  | ✅ **Histórico append-only** com DE/PARA em JSON, sem `UPDATE`/`DELETE`/`TRUNCATE` para a aplicação (item 7)                            | —                |
| V11.0.7 | testes | ✅ Testes de RLS/grants: histórico não editável, política sem diretor é rejeitada no backend                                            | V11.0.5, V11.0.6 |
| V11.0.8 | banco  | ✅ Cadeia hierárquica: Master passa a responder ao Coordenador; `empresas_visiveis()` já era agnóstica de rótulo                        | V11.0.2          |

> **Frente 0 concluída.** O delta de CSS entre o V10 e o r40 era de duas coisas: `.kpi .lbl`
> ganhou `padding-right:44px` e `min-height:36px` (reserva o canto do card para o ícone) e
> entrou `.pw-toggle` (o "olhinho" da tela Criar senha, que é da frente de e-mail adiada).
> `proto.css` está em 473 classes, igual ao r40, sem nada sobrando. Os únicos "diffs"
> restantes são de formatação — o prettier normaliza `.01em` para `0.01em`, convenção que já
> valia no arquivo inteiro; os valores são idênticos.
>
> **`leads.origem` virou legado, mas as telas ainda leem.** A V11.0.4 entregou a
> taxonomia no banco: `canais` (com `tipo` separando captação paga, entrada manual e
> lead que nasce de dentro), `leads.canal_id` e `profile_canais`. Um trigger resolve
> `canal_id` a partir do texto para os escritores antigos, então o dado novo nasce certo.
> **`comando/leads.tsx` já migrou (F11 da Frente 2, PR #102):** filtro e selo de mídia paga
> agora leem `canal_id`/`canais.tipo='supper'`, não mais os textos distintos das linhas
> nem o regex `/ads|meta|google/i`; `origem` só entra como fallback de exibição para leads
> legados sem canal resolvido. **Falta migrar as outras 5 telas** (`venda/aceite.tsx`,
> `venda/pipeline.tsx`, `venda/atender.tsx`, `operacao/comissoes.tsx`,
> `operacao/pipeline-geral.tsx`), tela por tela, nas frentes que já as tocam: funis na
> Frente 7, Central da Full na Frente 5. Só quando isso fechar o item 9 está inteiro.
>
> **Armadilha registrada para quem fizer o histórico da franquia (V11.5.6).** Trigger
> `for each row` **não dispara em TRUNCATE**. O Supabase concede `ALL` em `public` a
> `service_role` por default privileges, e `ALL` inclui `TRUNCATE` — então o histórico
> nasceu apagável por um `truncate` da própria aplicação, passando por cima dos triggers
> de UPDATE/DELETE. Verificado na prática (1 linha → 0). A tabela da franquia precisa do
> mesmo par: `revoke all from service_role` antes do grant seletivo **e** um trigger
> `before truncate ... for each statement`.

## Frente 1 · Convite Supper e porta de entrada

| Task    | Tag    | Descrição                                                                                                                                                                                             | Depende de                |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| V11.1.1 | banco  | ✅ Tabela de **convites**: token nominal, uso único, validade configurável (demo 7d), perfil e vínculo embutidos                                                                                      | V11.0.2, V11.0.3          |
| V11.1.2 | front  | ✅ Modal Convidar em 4 escopos: Matriz interno (7 cargos + Vendedor Matriz), Matriz externo (Master, Individual direta), Master (franquias e vendedores dele), Full (só Vendedor da própria franquia) | V11.1.1                   |
| V11.1.3 | front  | ✅ Saídas do convite: WhatsApp via wa.me, Copiar, **PDF com arte oficial e link clicável**, pré-visualização no modal                                                                                 | V11.1.2                   |
| V11.1.4 | front  | ✅ Rota **`/convite/{token}`** (item 1): valida token, abre cadastro pré-preenchido com perfil e vínculo em texto fixo                                                                                | V11.1.1                   |
| V11.1.5 | front  | ✅ Erro amigável para link expirado/reusado, com opção de pedir novo convite                                                                                                                          | V11.1.4                   |
| V11.1.6 | front  | ✅ Botão **"Quero falar com a Cote Certo"** no login: nome, e-mail, tema, mensagem → e-mail à Matriz, sem persistir (`auth.index.tsx`, C13)                                                           | V11.2.1                   |
| V11.1.7 | front  | ✅ Cadastro espontâneo removido (`auth.cadastro.tsx`, commit `0c09ba5`, C14); criação direta pela Matriz é exceção com log (`empresas.criado_por`, C1/C2)                                             | V11.1.4, V11.2.2, V11.2.3 |
| V11.1.8 | testes | ✅ E2E do convite: emitir → abrir link → cadastrar → cair na fila certa; e os casos de expirado e reuso                                                                                               | V11.1.4                   |

> **Frente 1 concluída** (detalhes em `PLANO_CONVITE_V11.md`) — inclusive as 2 tasks que
> dependiam da frente de e-mail, que entrou em produção em 01/08/2026 (ver Frente 2). O
> convite carrega o payload que classifica o pedido, e `empresas.convite_id` liga o
> pedido ao convite — é dali que a Frente 2 lê para abrir o modal travado e rotear a
> fila. A validação de escopo é da RPC `criar_convite`, no servidor: Master e Full têm
> o vínculo forçado neles, ignorando o que a tela enviar.
>
> **A porta de entrada antiga saiu do ar em 03/08/2026** (C14, `auth.cadastro.tsx`
> removido) — só existe cadastro por convite ou a exceção manual da Matriz, com log.

## Frente 2 · Filas de aprovação, e-mails e senha

> **E-mail em produção desde 01/08/2026** (PR #104 — "emails de acesso V11 e deploy
> controlado"). V11.2.1 entrega pendência e recusa com outbox; V11.2.2 entrega
> boas-vindas, link recovery de 48h e a tela Criar senha. Smoke test de ponta a ponta
> feito no navegador contra produção real: convite → cadastro → aprovação → e-mail de
> boas-vindas chegou → link de criar senha funcionou. Ver `docs/RUNBOOK_DEPLOY.md`
> §6.2-6.5.
>
> - ✅ **DNS concluído em 30/07/2026.** O domínio
>   `cote-certo.sandboxallcom.com` está verificado no Resend, com DKIM, SPF e
>   DMARC (`p=none`) publicados no Cloudflare. Remetente:
>   `acesso@cote-certo.sandboxallcom.com`; respostas:
>   `diego.gervasio@allcomtelecom.com`.

**Desenho decidido para quando a frente entrar:**

Provider transacional com domínio verificado (Resend ou equivalente), usado por dois
caminhos que o mesmo domínio atende:

- **API HTTP**, chamada de server function no padrão de `src/lib/*.functions.ts` — para os
  e-mails próprios: Convite Supper, boas-vindas com escopo no corpo, pendência com motivo,
  recusa. Arte e conteúdo nossos.
- **SMTP**, configurado no GoTrue do Supabase self-hosted — sem isso ele não envia nenhum
  e-mail de auth.

São **dois tokens diferentes**, não um:

- **Convite** → token próprio, tabela própria (V11.1.1). Carrega perfil e vínculo e existe
  antes de haver usuário; não há onde o Supabase Auth guardar isso.
- **Criar senha** → `admin.auth.admin.generateLink()` gera o link, enviado no nosso
  template. Hash e invalidação no uso vêm do GoTrue (atende o item 3 sem implementar
  criptografia). **Gotcha:** a validade do link é config global do servidor, não por
  e-mail — se as 48h brigarem com outro fluxo, aí sim token próprio.

Dev local não precisa de provider: o Supabase CLI sobe **Mailpit em `127.0.0.1:54324`** e
captura tudo. Provider só em staging e produção. Volume é de onboarding (dezenas/mês).

Env novas: chave da API do provider e credenciais SMTP do GoTrue — server-side, no padrão
`SELF_*` do `.env.example` (nunca `VITE_*`).

| Task    | Tag    | Descrição                                                                                                                                                                                  | Depende de       |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| V11.2.1 | infra  | ✅ **em produção** · Pendência e recusa com outbox transacional, Resend e retry                                                                                                            | —                |
| V11.2.2 | front  | ✅ **em produção** · Boas-vindas atômica com a aprovação, `generateLink`, link recovery 48h de uso único e tela Criar senha (8+, letras e números)                                         | V11.2.1          |
| V11.2.0 | infra  | ✅ Domínio `cote-certo.sandboxallcom.com` verificado no Resend; DKIM, SPF e DMARC publicados. Remetente `acesso@cote-certo.sandboxallcom.com`; Reply-To `diego.gervasio@allcomtelecom.com` | —                |
| V11.2.3 | banco  | ✅ Roteamento da fila pelo vínculo estruturado do pedido (trilha/perfil/vincTipo/vincId) — vendedor de Full **nunca** chega à Matriz                                                       | V11.1.1          |
| V11.2.4 | front  | ✅ Pendentes em dois blocos: time interno no bloco Matriz, rede no bloco Externos                                                                                                          | V11.2.3          |
| V11.2.5 | front  | ✅ Fila própria da Franquia Full, que aprova o vendedor dela sem a Matriz                                                                                                                  | V11.2.3          |
| V11.2.6 | front  | ✅ Modal de análise travado no que o convite definiu; "Reclassificar" só como exceção registrada                                                                                           | V11.2.3          |
| V11.2.7 | front  | ✅ Na aprovação: seletor de Supervisor de Vendas (Master), cargo + áreas + janela (interno), produtos e canais com botão "Todos". Master franqueado **não** recebe produtos/canais         | V11.0.3, V11.0.4 |
| V11.2.8 | banco  | ✅ Produtos padrão por bloco (interno: todos · externo: só Auto), herdados na aprovação                                                                                                    | V11.0.4          |
| V11.2.9 | testes | ✅ RLS por perfil nas duas filas: cada bloco vê só o seu; Full não vê pendente da Matriz e vice-versa                                                                                      | V11.2.3          |

> **Frente 2 concluída para o roteamento/aprovação** (V11.2.3-V11.2.9, PR #102, mergeado
> 30/07/2026 — detalhes em `PLANO_FILAS_V11.md`). `fn_destino_pedido`/`fn_pode_aprovar_pedido`
> decidem fila e autoridade no banco, não na tela; `aprovar_acesso` grava
> papel/cargo/áreas/produtos/canais/superior numa única transação. Testado com 20 testes de
> banco (`tests/db/filas-aprovacao-v11.test.ts`) e 30 E2E (`tests/e2e/`, incluindo o novo
> `filas-aprovacao.spec.ts`). **V11.2.1 e V11.2.2 foram pra produção em 01/08/2026**
> (PR #104), com smoke test de ponta a ponta validado. **Resolvido com a Lis em
> 03/08/2026** (`docs/PERGUNTAS_PARA_LIS.md` item 5): a Full continua aprovando o
> próprio vendedor sozinha, sem override da Matriz — `fn_destino_pedido`/
> `fn_pode_aprovar_pedido` continuam separadas de propósito, caso a operação real peça
> revisão na V12.

## Frente 3 · Cadastros e ciclo de vida

| Task    | Tag   | Descrição                                                                                                                | Depende de       |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| V11.3.1 | front | Aba **Cadastros Matriz** unificada: colaboradores + Vendedores Matriz, filtros de cargo/ano, busca, Configurar/Excluir   | V11.0.3          |
| V11.3.2 | front | Aba **Cadastros Rede** nova: Masters, franquias com modelo visível/filtrável, vendedores; travas de exclusão             | V11.0.8          |
| V11.3.3 | front | "Cadastro manual · exceção" ao lado de cada Convidar: selo amarelo, vai direto à classificação, entra no log             | V11.0.6, V11.1.2 |
| V11.3.4 | front | Master **convida e acompanha** ("Meus cadastrados" com status, lembrete à Matriz) — deixa de cadastrar direto            | V11.1.2          |
| V11.3.5 | front | Master **solicita** desligamento (vendedor e franquia) com motivo; Matriz aprova/nega, com trava se houver time          | V11.3.4          |
| V11.3.6 | banco | Motivo **obrigatório** em todo desligamento (hoje `desligado_motivo` é opcional) + "Detalhes"                            | —                |
| V11.3.7 | front | Excluído vai para Desligamentos; separar **situação do cadastro** (ativo/suspenso/desligado) do **sinal de performance** | V11.4.1          |

## Frente 4 · Régua de performance

| Task    | Tag    | Descrição                                                                                                                  | Depende de       |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| V11.4.1 | banco  | Tabelas da régua: **duas réguas independentes** (interno e rede) + a da franquia, com histórico de alteração               | V11.0.6          |
| V11.4.2 | front  | Personalização geral › **Performance**: configurar as réguas, salvando com senha de diretor                                | V11.4.1, V11.0.5 |
| V11.4.3 | banco  | **Job periódico** (item 5) que recalcula OK/Atenção/Travado por bloco — sem botão manual                                   | V11.4.1          |
| V11.4.4 | banco  | Travado + pausa ativa sai da distribuição automática; reativação exige registro de quem revisou                            | V11.4.3          |
| V11.4.5 | front  | Selo nas listas; **clicar no selo** abre resumo com motivo em números e ações do supervisor (notificar / revisar-reativar) | V11.4.3          |
| V11.4.6 | testes | Travado não recebe lead do distribuidor; reativação sem registro é rejeitada                                               | V11.4.4          |

## Frente 5 · Franquia Full como matrizinha

> **⚠️ Conclusão de 04/08/2026 corrigida em 09/08/2026.** O PR #120 entregou a Frente
> 5b, mas uma auditoria posterior com persona Full real mostrou que ainda faltavam as
> cinco abas do protótipo, cadastro/configuração individual e a obrigatoriedade
> Full → Master. A correção complementar é a **Frente 5c** abaixo. A Frente 5 permanece
> reaberta até concluir front, integração, E2E e validação visual. Plano detalhado em
> `docs/PLANO_FRANQUIA_FULL_V11.md`.
>
> V11.5.4/5.5/5.6 chegaram a ficar bloqueadas (a régua trava por gate de diretor — Full
> nunca pode ser diretora; "Modelo CLT" é singleton global sem relação com o time da
> Full; o r40 nunca teve essa tela pra Full) esperando o protótipo r41. O r41 chegou
> junto com "Regras Decididas" em 04/08/2026 e resolveu as 3 dúvidas — virou **Frente
> 5b** (V11.5b.1-6), entregue no mesmo PR #120, sem precisar da tabela de override por
> empresa que a investigação original previu (o bloco `full` da régua continua **uma
> linha compartilhada**, só ganhou uma RPC de salvar sem senha).
>
> ✅ V11.5.1 — decisão da Lis: Acessos e permissões › Personalização geral/Performance
> ✅ V11.5.2 → V11.5.2a (menu 14 áreas, não 15 nem 16 — ver nota no plano detalhado) + V11.5.2b (Central da Franquia)
> ✅ V11.5.3 — SLA por empresa (`sla_empresa_config`, não mais singleton)
> ✅ V11.5.4/5.5/5.6 → **Frente 5b** (V11.5b.1-6): histórico da franquia sem senha
> (gate por identidade), régua própria sem senha, Complementos do time (4 campos,
> não o Modelo CLT inteiro nem produtos/canais/comissão por pessoa), tudo dentro de
> `/operacao/xacessos` (não uma tela "Acessos da Full com 5 abas" nova)
> ✅ V11.5.7 — SLA por lead + fronteira repassado/próprio
> ✅ V11.5.8 (novo, fora da tabela original) — comissão por origem do lead

| Task    | Tag   | Descrição                                                                                                                                                                                                              | Depende de       |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| V11.5.1 | —     | **Decisão da Lis (item 11):** endereço único das configurações da Full — Central da Franquia × Acessos › Personalização. Bloqueia a tela final                                                                         | —                |
| V11.5.2 | front | **Central da Franquia**: leads próprios × repassados da Matriz, SLA e canais próprios                                                                                                                                  | V11.0.4, V11.5.1 |
| V11.5.3 | banco | SLA por origem do lead: repassado segue o SLA da Matriz, próprio segue o da Full                                                                                                                                       | V11.5.2          |
| V11.5.4 | front | ~~Acessos da Full com 5 abas espelhando a Matriz~~ — entregue como 2 seções novas (Personalização geral/Performance) dentro de `/operacao/xacessos` (V11.5b.4)                                                         | V11.2.5, V11.3.1 |
| V11.5.5 | front | ~~Modelo CLT + complementos; cadastro direto passando pela configuração (produtos/canais/comissão por pessoa, selo "personalizado")~~ — entregue como Modelo CLT (leitura) + Complementos do time, 4 campos (V11.5b.3) | V11.2.7          |
| V11.5.6 | banco | ~~Régua e histórico próprios da Full~~ — entregue via RPCs novas com gate de identidade, sem senha (V11.5b.1/2)                                                                                                        | V11.4.1, V11.0.6 |
| V11.5.7 | banco | Lead repassado que dá perda ou estoura SLA **cruza a fronteira** e volta como Devolvido/Perda da Matriz                                                                                                                | V11.5.3          |

### Frente 5c · Correção da auditoria Full

| Task     | Tag    | Descrição                                                                                                                                                     | Estado                                                                                                                            |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| V11.5c.1 | banco  | Full ativa exige Master ativo/aprovado; triggers diferíveis fecham aprovação e escrita direta; órfãs legadas são suspensas e auditadas sem vínculo arbitrário | ✅ Implementado/testado localmente — `20260809212121_v11_5c_integridade_full_master.sql`                                          |
| V11.5c.2 | banco  | Matriz vincula Master e reativa a Full regularizada; JWT antigo permanece bloqueado enquanto suspensa                                                         | ✅ Implementado/testado localmente                                                                                                |
| V11.5c.3 | banco  | Cadastro direto, configuração individual, desligamento direto pela Full e reinclusão exclusiva da Matriz, com RLS/histórico                                   | ✅ Implementado/testado localmente — `20260809212122_v11_5c_gestao_direta_time_full.sql`                                          |
| V11.5c.4 | front  | Cinco abas: Meu time, Pendentes, Desligamentos, Personalização geral e Performance                                                                            | ✅ Implementado e validado localmente                                                                                             |
| V11.5c.5 | front  | Cadastro direto em duas etapas com CPF/celular e configuração de equipe, leads, produtos, canais e comissão; tabela/selo conforme protótipo                   | ✅ Implementado; servidor rejeita canal inativo/cross-tenant e persiste identidade/configuração                                   |
| V11.5c.6 | front  | Corrigir Visão Geral da Full e filtros que listam o próprio franqueado como vendedor                                                                          | ✅ Implementado e coberto por E2E                                                                                                 |
| V11.5c.7 | testes | DB/RLS, unitários, E2E das cinco abas e auditoria visual por persona                                                                                          | ✅ Local: DB focado 15/15, regressões DB 66/66, DB completo 579/579, unitários 346/346, E2E 14/14, typecheck/lint/Prettier verdes |

O cadastro direto depende de server function com `service_role`: criar usuário no
Auth, chamar `fn_cadastrar_vendedor_full` e remover o usuário Auth se a RPC falhar. A
chave administrativa nunca pode ser exposta ao front.

**Estado em 09/08/2026:** Frente 5c concluída localmente. Publicação em produção
permanece condicionada a revisão final, PR, CI e deploy das duas migrations e da
aplicação.

## Frente 6 · Governança e histórico

| Task    | Tag    | Descrição                                                                                         | Depende de |
| ------- | ------ | ------------------------------------------------------------------------------------------------- | ---------- |
| V11.6.1 | front  | Senha de diretor nos **9 botões "Salvar política"** (um por aba), padronizados                    | V11.0.5    |
| V11.6.2 | front  | Mensagem "Seu acesso não permite esse tipo de alteração" para quem não é diretor                  | V11.0.5    |
| V11.6.3 | front  | Tela **Histórico** com DE/PARA, filtro por área persistente                                       | V11.0.6    |
| V11.6.4 | banco  | Incluir/remover diretor exige aprovação do Diretor Geral/CEO (dupla aprovação)                    | V11.0.5    |
| V11.6.5 | testes | Toda gravação de política gera linha com antes/depois; alteração sem diretor falha **no backend** | V11.0.7    |

## Frente 7 · Visão geral com período único

| Task    | Tag   | Descrição                                                                                                                                                                                                                            | Depende de                              |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| V11.7.1 | banco | ✅ **Período único** server-side (item 8): dia/semana/quinzena/mês/personalizado                                                                                                                                                     | —                                       |
| V11.7.2 | front | Todos os widgets da Visão geral lendo a mesma janela — hoje são 4 opções mensais no cliente (`visao-geral.tsx`)                                                                                                                      | V11.7.1                                 |
| V11.7.3 | front | ✅ **4 funis por canal** (Movida/Google/Facebook/Manual) escalando com o período                                                                                                                                                     | V11.7.1, V11.0.4                        |
| V11.7.4 | front | ✅ **Alertas clicáveis** derivados do estado real — 8 alertas (5 originais + os 3 fechados abaixo)                                                                                                                                   | V11.7.2                                 |
| V11.7.5 | banco | ✅ Modelar o estado real de **pendência da seguradora** após a transmissão; não inferir pendência a partir de proposta apenas `gerada`                                                                                               | regra operacional da pendência definida |
| V11.7.6 | front | ✅ **Fechar os alertas adiados da Visão geral**: pendência da seguradora, franquia abaixo da meta e vendedor em atenção. "Destinos por perfil novo" (V11.8) ficou fora de escopo — os 3 alertas apontam pra destinos já válidos hoje | V11.7.5, V11.4.1                        |

> **V11.7.1 e V11.7.3 já tinham sido entregues em 29/07/2026** (commits `10e8bdd`,
> `1d34317`), antes de a numeração de frentes virar prática — só não tinham sido marcadas
> aqui. **Fechamento da Frente 7 concluído em 03/08/2026** (V11.7.5/V11.7.6, banco+front):
> `docs/PLANO_VISAO_GERAL_V11.md` tem o levantamento completo do que estava pronto vs.
> faltando em cada task, as decisões tomadas (V11.7.2 — mover KPI grid/rankings/gráfico
> pra RPC — e a mudança em `operacao/vendas.tsx` ficaram de fora, por escolha) e os dois
> bugs vivos de heurística corrigidos (`visao-geral.tsx` tratava `status='gerada'` como
> pendência da seguradora; o mesmo schema zod sem `{offset:true}` quebrava a navegação de
> todos os alertas com período). 489 testes de banco + 207 unitários, todos passando.

### Pendências rastreadas da V11.7.4

| Pendência                          | Por que não entra agora                                                                                                                                                             | Task que desbloqueia | Critério para fechar                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pendência da seguradora            | `propostas` registra transmissão, emissão, pagamento e cancelamento, mas não distingue retorno pendente da seguradora. Tratar `status = 'gerada'` como pendência inventaria estado. | V11.7.5              | Estado persistido, regra de transição, RLS e testes positivo/negativo disponíveis; alerta abre `Vendas → Transmissão` já filtrado. |
| Franquia abaixo da meta no período | A comparação exige a regra oficial de proporcionalização/competência da meta; não deve ser recalculada com heurística própria do dashboard.                                         | V11.4.1              | Régua server-side fornece o resultado por franquia e período; alerta e destino usam exatamente o mesmo cálculo.                    |
| Vendedor em atenção/travado        | O estado pertence à régua de performance e ainda não existe como classificação persistida/calculada.                                                                                | V11.4.1              | Régua fornece a classificação e a Visão geral apenas consome o resultado, respeitando o escopo da rede.                            |
| Destinos por perfil novo           | Um alerta não pode oferecer rota fora das áreas liberadas ao Coordenador/Supervisores.                                                                                              | V11.8                | Catálogo de alertas consulta a capacidade/área final de cada perfil e há teste de navegação positivo e negativo.                   |

Enquanto essas dependências não fecharem, a V11.7.4 exibe somente alertas sustentados
por estados reais já persistidos. A V11.7.6 é a task de retorno obrigatória: ela não pode
ser marcada como concluída antes de revisitar as quatro linhas acima.

## Frente 8 · Menus e escopo por perfil

> **Frente 8 já entregue — sem trabalho novo.** As 6 tasks abaixo são exatamente o
> escopo de H1–H10 (`docs/PLANO_HIERARQUIA_V11.md`), implementados e testados em
> 28/07/2026, antes de a numeração de frentes virar prática (mesmo padrão do que
> aconteceu com V11.7.1/7.3, ver Frente 7). Auditoria feita em 03/08/2026: reexecutei
> `rls-hierarquia-v11-areas`, `rpc-desconto` e `cadastro-manual-v11` (38 testes, todos
> verdes) e confirmei no código (`app-shell.tsx`, `fn_modelo_alcada_desconto`) que os 4
> menus por perfil e a alçada por cargo com escalonamento Master → Coordenador → Matriz
> continuam como descrito. Duas dívidas conscientes ficaram documentadas em
> `PLANO_HIERARQUIA_V11.md` (não bloqueiam o fechamento): (1) `isGroupView` ainda rotula
> o dashboard do Supervisor como "visão de grupo" em 6 telas — decisão de produto, fora
> do escopo de H7/H8; (2) um override de `profile_areas` pode remover a área `maprov` de
> quem tem alçada de desconto, mantendo a autoridade sem a tela — separação considerada
> correta por design.
>
> ✅ V11.8.1 — H8 (menu Coordenador, 17 áreas)
> ✅ V11.8.2 — H8 (menu Supervisor de Vendas, 11 áreas)
> ✅ V11.8.3 — H8 (menu Supervisor Operacional, 4 áreas)
> ✅ V11.8.4 — H8 (menu por cargo: Backoffice, Assistente Comercial, Marketing)
> ✅ V11.8.5 — H6 (alçada por cargo; H9 confirma escalonamento Master → Coordenador → Matriz)
> ✅ V11.8.6 — H9/H10 (testes de RLS por perfil, positivo e negativo)

| Task    | Tag    | Descrição                                                                                                                    | Depende de |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| V11.8.1 | front  | Menu do **Coordenador Comercial**: as 17 áreas (vê tudo que a Matriz vê, mas não altera comissionamento por não ser diretor) | V11.0.2    |
| V11.8.2 | front  | Menu do **Supervisor de Vendas**: time comercial, com alçada de desconto nas Aprovações                                      | V11.0.2    |
| V11.8.3 | front  | Menu do **Supervisor Operacional**: Leads, Distribuição, Acessos — sem alçada de desconto                                    | V11.0.2    |
| V11.8.4 | front  | Menu recortado pelas áreas do cargo (Backoffice, Assistente Comercial, Marketing)                                            | V11.0.3    |
| V11.8.5 | banco  | Alçada de desconto passa a ser exclusiva do Supervisor de Vendas; cadeia externa ganha Master → Coordenador → Matriz         | V11.0.8    |
| V11.8.6 | testes | Escopo por perfil dos 4 perfis novos, positivo e negativo (skill `teste-rls`)                                                | V11.8.5    |

## Frente 9 · Fora do caminho crítico

| Task    | Tag   | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Depende de |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| V11.9.1 | infra | **WhatsApp Business API** (item 4): convite com PDF anexado automaticamente, sem passo manual. Exige conta e aprovação de template — aguardando o usuário abrir a conta; paliativo (`wa.me` + PDF manual) segue no ar                                                                                                                                                                                                                                                           | V11.1.3    |
| V11.9.2 | —     | ✅ **Resolvido pela Lis em 03/08/2026:** Carteira de Recuperação fica pra V12, fora da V11                                                                                                                                                                                                                                                                                                                                                                                      | —          |
| V11.9.3 | —     | ✅ **Resolvido em 04/08/2026:** documento "Regras Decididas" chegou (`CoteCerto_Regras_Decididas.html`, 27/07)                                                                                                                                                                                                                                                                                                                                                                  | —          |
| V11.9.4 | —     | ✅ **Concluída em 05/08/2026:** varredura extensa (motivo de perda, desconto, desligamento, fila de aprovação da Full, avaliação de perda, classificação de acesso) — todo fluxo de negócio já grava via RPC/update real, sem `catch` silencioso. Único `localStorage` fora de preferência de UI seria bug; não achou nenhum. Nota (não bug): "Notificar supervisor" em `performance-resumo-modal.tsx` não persiste de propósito, decisão já registrada em `PLANO_REGUA_V11.md` | todas      |

## Sequência recomendada

**Ordem escolhida em 28/07/2026: começar pela hierarquia.** A Frente 0, o núcleo da
Frente 1 e o núcleo de roteamento/aprovação da Frente 2 já foram implementados. Os
detalhes da hierarquia estão em `docs/PLANO_HIERARQUIA_V11.md`.

1. ✅ **Base implementada** — V11.0.2, V11.0.3 e V11.0.8 estabeleceram a
   hierarquia; V11.1.1–V11.1.5 e V11.1.8 entregaram o núcleo do convite;
   V11.2.3–V11.2.9 entregaram filas e aprovação. V11.2.1 e V11.2.2 foram para
   produção em 01/08/2026 (PR #104); V11.1.6 e V11.1.7, que dependiam delas,
   fecharam junto (ver Frente 1).
2. **Pedidos disparados em paralelo, porque têm prazo de terceiro:** V11.9.3 ("Regras
   Decididas", que trava a Frente 4) e V11.5.1 (endereço das configurações da Full).
3. **Frente 3** — começar por V11.3.1 e V11.3.2 (Cadastros Matriz e Rede), que já
   contam com a hierarquia concluída. V11.3.7 espera a régua da V11.4.1.
4. **Frente 4** (régua) e **Frente 6** (governança), que dependem de histórico e diretor.
5. **Frente 5** (Full) depois de V11.5.1 decidido pela Lis.
6. **Frente 7** (visão geral) em paralelo a partir da taxonomia de canais.
7. **Frente 8** — auditar o status das tasks contra as entregas H7–H10 da hierarquia
   antes de abrir nova implementação, evitando refazer menus, alçada e testes já cobertos.
8. ✅ **Boas-vindas e senha (V11.2.2, V11.1.6, V11.1.7)** — fecharam junto com a
   ida para produção do e-mail (01/08/2026) e a remoção do autocadastro (03/08/2026).
9. **Frente 9** por último, exceto os pedidos do item 2.

## Decisões pendentes que bloqueiam tasks

**Nenhuma.** As 3 pendências que bloquearam tasks foram todas resolvidas pela Lis (ver
"Decisões já resolvidas" abaixo) — a última delas em 04/08/2026. Tabela mantida vazia
de propósito, para reaparecer só se uma decisão nova travar alguma task.

### Decisões já resolvidas

- ✅ **Supervisor de Vendas × Supervisor Operacional:** solução híbrida implementada
  em 29/07/2026 pela V11.0.2/V11.0.3. `coordenador` é perfil estrutural; os
  supervisores são cargos (`sup_vendas` e `sup_operacional`). A alçada de desconto
  deriva do cargo e existe somente para Supervisor de Vendas. Implementação e testes:
  commit `72ec5dc`; detalhes em `PLANO_HIERARQUIA_V11.md`.
- ✅ **Remetente e DNS dos e-mails de acesso:** V11.2.0 concluída em 30/07/2026.
  `cote-certo.sandboxallcom.com` está verificado no Resend (São Paulo), com DKIM,
  SPF e DMARC (`p=none`) publicados no Cloudflare. O remetente é
  `acesso@cote-certo.sandboxallcom.com` e o `Reply-To` é
  `diego.gervasio@allcomtelecom.com`.
- ✅ **Documento "Regras Decididas" não veio no pacote:** chegou em 04/08/2026
  (`CoteCerto_Regras_Decididas.html`, junto do protótipo r41, do Handoff atualizado e
  das Respostas de Produto/TI) — destravou a Frente 5b. Ver `docs/PERGUNTAS_PARA_LIS.md`
  item 1 e `docs/PLANO_FRANQUIA_FULL_V11.md`.
- ✅ **Endereço único das configurações da Full (item 11 do Handoff):** resolvido em
  03/08/2026 — **Acessos e permissões › Personalização geral/Performance**, não uma
  tela "Central da Franquia" separada. Ver `docs/PERGUNTAS_PARA_LIS.md` item 2.
- ✅ **Carteira de Recuperação:** resolvido em 03/08/2026 — fica para a V12, fora do
  escopo da V11 (V11.9.2). Ver `docs/PERGUNTAS_PARA_LIS.md` item 4.
