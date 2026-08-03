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

⚠️ **Ordem obrigatória.** A Etapa 1 remove o autocadastro. Nada de `auth.cadastro.tsx`
sai do ar antes de V11.1.4 estar de pé, e a criação direta pela Matriz continua
funcionando como exceção durante toda a transição.

| Task    | Tag    | Descrição                                                                                                                                                                                             | Depende de                |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| V11.1.1 | banco  | ✅ Tabela de **convites**: token nominal, uso único, validade configurável (demo 7d), perfil e vínculo embutidos                                                                                      | V11.0.2, V11.0.3          |
| V11.1.2 | front  | ✅ Modal Convidar em 4 escopos: Matriz interno (7 cargos + Vendedor Matriz), Matriz externo (Master, Individual direta), Master (franquias e vendedores dele), Full (só Vendedor da própria franquia) | V11.1.1                   |
| V11.1.3 | front  | ✅ Saídas do convite: WhatsApp via wa.me, Copiar, **PDF com arte oficial e link clicável**, pré-visualização no modal                                                                                 | V11.1.2                   |
| V11.1.4 | front  | ✅ Rota **`/convite/{token}`** (item 1): valida token, abre cadastro pré-preenchido com perfil e vínculo em texto fixo                                                                                | V11.1.1                   |
| V11.1.5 | front  | ✅ Erro amigável para link expirado/reusado, com opção de pedir novo convite                                                                                                                          | V11.1.4                   |
| V11.1.6 | front  | ⏸ **adiada** (depende de e-mail) · Botão **"Quero falar com a Cote Certo"** no login: nome, e-mail, tema, mensagem → e-mail à Matriz, sem persistir                                                   | V11.2.1                   |
| V11.1.7 | front  | ⏸ **adiada** (sem criar senha, não há como aprovar alguém) · Remover o cadastro espontâneo de `auth.cadastro.tsx`; criação direta pela Matriz vira exceção com log                                    | V11.1.4, V11.2.2, V11.2.3 |
| V11.1.8 | testes | ✅ E2E do convite: emitir → abrir link → cadastrar → cair na fila certa; e os casos de expirado e reuso                                                                                               | V11.1.4                   |

> **Frente 1 concluída** (detalhes em `PLANO_CONVITE_V11.md`), menos as duas tasks que
> dependem da frente de e-mail. O convite carrega o payload que classifica o pedido, e
> `empresas.convite_id` liga o pedido ao convite — é dali que a Frente 2 lê para abrir o
> modal travado e rotear a fila. A validação de escopo é da RPC `criar_convite`, no
> servidor: Master e Full têm o vínculo forçado neles, ignorando o que a tela enviar.
>
> **A porta de entrada antiga continua no ar.** Enquanto V11.1.7 estiver adiada,
> `auth.cadastro.tsx` segue aceitando cadastro espontâneo com senha digitada por quem
> cadastra. Convite e autocadastro coexistem — é dívida consciente, não esquecimento.

## Frente 2 · Filas de aprovação, e-mails e senha

> **E-mail implementado localmente em 31/07/2026.** V11.2.1 entrega pendência e
> recusa com outbox; V11.2.2 entrega boas-vindas, link recovery de 48h e a tela
> Criar senha. Falta configurar/testar Resend e GoTrue no ambiente publicado. V11.1.6
> continua fora do caminho crítico. Consequências, para não virar surpresa:
>
> - **O convite não trava.** As saídas do Convite Supper são WhatsApp, Copiar e PDF
>   (V11.1.3) — nenhuma delas depende de e-mail. Frentes 1, 2 e 3 seguem.
> - **V11.1.7 adia junto.** Sem a tela de criar senha, quem for aprovado não tem como
>   definir a própria senha. Então o caminho atual de `auth.cadastro.tsx` (senha digitada
>   por quem cadastra, `cadastro.functions.ts:41`) **continua no ar** como exceção até a
>   frente de e-mail entrar. É o oposto do que a V11 quer, e é dívida consciente.
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

| Task    | Tag    | Descrição                                                                                                                                                                                                           | Depende de       |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| V11.2.1 | infra  | 🟡 **implementada e validada localmente** · Pendência e recusa com outbox transacional, Resend e retry; falta envio real no ambiente publicado                                                                      | —                |
| V11.2.2 | front  | 🟡 **implementada e validada localmente** · Boas-vindas atômica com a aprovação, `generateLink`, link recovery 48h de uso único e tela Criar senha (8+, letras e números); falta configurar GoTrue/Resend publicado | V11.2.1          |
| V11.2.0 | infra  | ✅ Domínio `cote-certo.sandboxallcom.com` verificado no Resend; DKIM, SPF e DMARC publicados. Remetente `acesso@cote-certo.sandboxallcom.com`; Reply-To `diego.gervasio@allcomtelecom.com`                          | —                |
| V11.2.3 | banco  | ✅ Roteamento da fila pelo vínculo estruturado do pedido (trilha/perfil/vincTipo/vincId) — vendedor de Full **nunca** chega à Matriz                                                                                | V11.1.1          |
| V11.2.4 | front  | ✅ Pendentes em dois blocos: time interno no bloco Matriz, rede no bloco Externos                                                                                                                                   | V11.2.3          |
| V11.2.5 | front  | ✅ Fila própria da Franquia Full, que aprova o vendedor dela sem a Matriz                                                                                                                                           | V11.2.3          |
| V11.2.6 | front  | ✅ Modal de análise travado no que o convite definiu; "Reclassificar" só como exceção registrada                                                                                                                    | V11.2.3          |
| V11.2.7 | front  | ✅ Na aprovação: seletor de Supervisor de Vendas (Master), cargo + áreas + janela (interno), produtos e canais com botão "Todos". Master franqueado **não** recebe produtos/canais                                  | V11.0.3, V11.0.4 |
| V11.2.8 | banco  | ✅ Produtos padrão por bloco (interno: todos · externo: só Auto), herdados na aprovação                                                                                                                             | V11.0.4          |
| V11.2.9 | testes | ✅ RLS por perfil nas duas filas: cada bloco vê só o seu; Full não vê pendente da Matriz e vice-versa                                                                                                               | V11.2.3          |

> **Frente 2 concluída para o roteamento/aprovação** (V11.2.3-V11.2.9, PR #102, mergeado
> 30/07/2026 — detalhes em `PLANO_FILAS_V11.md`). `fn_destino_pedido`/`fn_pode_aprovar_pedido`
> decidem fila e autoridade no banco, não na tela; `aprovar_acesso` grava
> papel/cargo/áreas/produtos/canais/superior numa única transação. Testado com 20 testes de
> banco (`tests/db/filas-aprovacao-v11.test.ts`) e 30 E2E (`tests/e2e/`, incluindo o novo
> `filas-aprovacao.spec.ts`). **V11.2.1 e V11.2.2 estão implementadas e validadas
> localmente**; a conclusão de produção depende da configuração e do envio real por
> Resend/GoTrue no ambiente publicado. A V11.2.0 foi concluída em 30/07 — não
> bloqueiam a Frente 3. Decisão em aberto
> com a Lis sobre a Matriz também
> aprovar o vendedor de uma Full: `docs/PERGUNTAS_PARA_LIS.md` item 5; a separação
> `fn_destino_pedido`/`fn_pode_aprovar_pedido` foi feita de propósito para isso custar
> pouco quando decidido.

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

| Task    | Tag   | Descrição                                                                                                                                      | Depende de       |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| V11.5.1 | —     | **Decisão da Lis (item 11):** endereço único das configurações da Full — Central da Franquia × Acessos › Personalização. Bloqueia a tela final | —                |
| V11.5.2 | front | **Central da Franquia**: leads próprios × repassados da Matriz, SLA e canais próprios                                                          | V11.0.4, V11.5.1 |
| V11.5.3 | banco | SLA por origem do lead: repassado segue o SLA da Matriz, próprio segue o da Full                                                               | V11.5.2          |
| V11.5.4 | front | Acessos da Full com 5 abas espelhando a Matriz                                                                                                 | V11.2.5, V11.3.1 |
| V11.5.5 | front | Modelo CLT + complementos; cadastro direto passando pela **configuração** (produtos/canais/comissão por pessoa, selo "personalizado")          | V11.2.7          |
| V11.5.6 | banco | Régua e histórico próprios da Full                                                                                                             | V11.4.1, V11.0.6 |
| V11.5.7 | banco | Lead repassado que dá perda ou estoura SLA **cruza a fronteira** e volta como Devolvido/Perda da Matriz                                        | V11.5.3          |

## Frente 6 · Governança e histórico

| Task    | Tag    | Descrição                                                                                         | Depende de |
| ------- | ------ | ------------------------------------------------------------------------------------------------- | ---------- |
| V11.6.1 | front  | Senha de diretor nos **9 botões "Salvar política"** (um por aba), padronizados                    | V11.0.5    |
| V11.6.2 | front  | Mensagem "Seu acesso não permite esse tipo de alteração" para quem não é diretor                  | V11.0.5    |
| V11.6.3 | front  | Tela **Histórico** com DE/PARA, filtro por área persistente                                       | V11.0.6    |
| V11.6.4 | banco  | Incluir/remover diretor exige aprovação do Diretor Geral/CEO (dupla aprovação)                    | V11.0.5    |
| V11.6.5 | testes | Toda gravação de política gera linha com antes/depois; alteração sem diretor falha **no backend** | V11.0.7    |

## Frente 7 · Visão geral com período único

| Task    | Tag   | Descrição                                                                                                                                                                 | Depende de                              |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| V11.7.1 | banco | ✅ **Período único** server-side (item 8): dia/semana/quinzena/mês/personalizado                                                                                             | —                                       |
| V11.7.2 | front | Todos os widgets da Visão geral lendo a mesma janela — hoje são 4 opções mensais no cliente (`visao-geral.tsx`)                                                           | V11.7.1                                 |
| V11.7.3 | front | ✅ **4 funis por canal** (Movida/Google/Facebook/Manual) escalando com o período                                                                                             | V11.7.1, V11.0.4                        |
| V11.7.4 | front | ✅ **Alertas clicáveis** derivados do estado real — 8 alertas (5 originais + os 3 fechados abaixo)                                                                                                                            | V11.7.2                                 |
| V11.7.5 | banco | ✅ Modelar o estado real de **pendência da seguradora** após a transmissão; não inferir pendência a partir de proposta apenas `gerada`                                       | regra operacional da pendência definida |
| V11.7.6 | front | ✅ **Fechar os alertas adiados da Visão geral**: pendência da seguradora, franquia abaixo da meta e vendedor em atenção. "Destinos por perfil novo" (V11.8) ficou fora de escopo — os 3 alertas apontam pra destinos já válidos hoje | V11.7.5, V11.4.1                 |

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

| Task    | Tag   | Descrição                                                                                                                                                             | Depende de |
| ------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| V11.9.1 | infra | **WhatsApp Business API** (item 4): convite com PDF anexado automaticamente, sem passo manual. Exige conta e aprovação de template                                    | V11.1.3    |
| V11.9.2 | —     | **Decisão pendente:** Carteira de Recuperação está nos Fluxos mas não no protótipo r40 — entra na V11 sem referência visual ou fica para a V12?                       | —          |
| V11.9.3 | —     | **Pedir à Lis:** documento "Regras Decididas", citado pelo DE/PARA e pelo Handoff e ausente do pacote. Regra 12 (régua) e regra 5 (escopos dos presets) dependem dele | —          |
| V11.9.4 | infra | **Persistência geral** (item 10): filas, cadastros, solicitações e motivos em banco — varredura final de que nada ficou só no navegador                               | todas      |

## Sequência recomendada

**Ordem escolhida em 28/07/2026: começar pela hierarquia.** A Frente 0, o núcleo da
Frente 1 e o núcleo de roteamento/aprovação da Frente 2 já foram implementados. Os
detalhes da hierarquia estão em `docs/PLANO_HIERARQUIA_V11.md`.

1. ✅ **Base implementada** — V11.0.2, V11.0.3 e V11.0.8 estabeleceram a
   hierarquia; V11.1.1–V11.1.5 e V11.1.8 entregaram o núcleo do convite;
   V11.2.3–V11.2.9 entregaram filas e aprovação. V11.2.1 e V11.2.2 estão
   implementadas localmente; V11.1.6 e V11.1.7 continuam adiadas, e e-mail/senha
   aguardam configuração e prova real no ambiente publicado.
2. **Pedidos disparados em paralelo, porque têm prazo de terceiro:** V11.9.3 ("Regras
   Decididas", que trava a Frente 4) e V11.5.1 (endereço das configurações da Full).
3. **Frente 3** — começar por V11.3.1 e V11.3.2 (Cadastros Matriz e Rede), que já
   contam com a hierarquia concluída. V11.3.7 espera a régua da V11.4.1.
4. **Frente 4** (régua) e **Frente 6** (governança), que dependem de histórico e diretor.
5. **Frente 5** (Full) depois de V11.5.1 decidido pela Lis.
6. **Frente 7** (visão geral) em paralelo a partir da taxonomia de canais.
7. **Frente 8** — auditar o status das tasks contra as entregas H7–H10 da hierarquia
   antes de abrir nova implementação, evitando refazer menus, alçada e testes já cobertos.
8. **Boas-vindas e senha (V11.2.2, V11.1.6, V11.1.7)** — pendência e recusa da
   V11.2.1 já foram retomadas; só depois da senha o autocadastro sai do ar.
9. **Frente 9** por último, exceto os pedidos do item 2.

## Decisões pendentes que bloqueiam tasks

| #   | Pendência                                                     | Bloqueia                | Com quem |
| --- | ------------------------------------------------------------- | ----------------------- | -------- |
| 1   | Documento "Regras Decididas" não veio no pacote               | Frentes 4 e 2 (escopos) | Lis      |
| 2   | Endereço único das configurações da Full (item 11 do Handoff) | V11.5.2, V11.5.4        | Lis      |
| 3   | Carteira de Recuperação: V11 sem referência visual, ou V12?   | V11.9.2                 | Lis      |

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
