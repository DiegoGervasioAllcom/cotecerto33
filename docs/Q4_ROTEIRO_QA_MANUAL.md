# Q4 — Roteiro de QA manual por perfil (V11, atualizado em 12/08/2026)

> **Histórico:** a versão original deste roteiro (6 experiências) foi executada e
> aprovada em 28/07/2026, sem divergências reais (confirmação verbal do dono do
> produto), antes de a V11 começar. Esta versão substitui a anterior — incorpora
> tudo que a V11 entregou desde então: hierarquia de cargos, convite, filas de
> aprovação e e-mail real, cadastros e ciclo de vida, régua de performance,
> Franquia Full como matrizinha (Central da Franquia, Personalização, Performance,
> Histórico), governança/diretor, visão geral com período único e escopo de leitura
> do time de apoio. Os checkboxes são checklist de referência, não registro de
> evidência — a execução formal fica a critério de quem testar.

**Objetivo:** validar, à mão, os fluxos das experiências de usuário em staging, na
ordem em que alguém real usaria o sistema. Tudo que é automatizável já está coberto
por CI (`ci`, `db-tests`) e pelas suítes de teste do repositório (banco, unitário,
E2E) — este roteiro cobre o que só se percebe usando a tela.

> **Ambiente:** `<URL_DO_AMBIENTE_DE_QA>`
> **Login inicial (Matriz):** `<EMAIL_MATRIZ_QA>` · senha obtida pelo canal seguro
> definido para o teste. Essa conta deve ser **não diretora**. Para Governança (Bloco
> 6), use duas contas distintas com `diretor=true`, também provisionadas para QA e sem
> credenciais registradas neste documento.
> As outras personas **não existem no seed** (exceto quando indicado) — você as cria
> pela própria aplicação, pelo fluxo de **convite** (Bloco 0). Isso é proposital: o
> convite, o cadastro por link e a aprovação também são parte do teste.

## Como reportar um problema

Para cada item, marque ✅ (ok) / ❌ (bug) / ⚠️ (estranho, mas funciona). Ao achar um
bug, anote: **tela**, **perfil logado**, **passo**, **o que esperava**, **o que
aconteceu** (e print se der). Junte tudo e me manda que eu trato.

## As experiências (perfis e cargos)

| Persona de teste               | Perfil / cargo (RLS)                   | Experiência                             | Tela inicial           |
| ------------------------------ | -------------------------------------- | --------------------------------------- | ---------------------- |
| Matriz                         | `matriz`                               | gestão total                            | Visão geral da Matriz  |
| Diretor (Ana/Melo, já no seed) | `matriz`, `diretor=true`               | gestão total + governança               | Visão geral da Matriz  |
| Coordenador Comercial          | `coordenador` (cargo `coord_com`)      | gestão total, não diretor               | Visão geral da Matriz  |
| Supervisor de Vendas           | `supervisor` (cargo `sup_vendas`)      | comando comercial                       | Visão geral (11 áreas) |
| Supervisor Operacional         | `supervisor` (cargo `sup_operacional`) | comando operacional                     | Visão geral (4 áreas)  |
| Supervisor Backoffice          | `supervisor` (cargo `sup_backoffice`)  | apoio operacional                       | Visão geral (recorte)  |
| Assistente Comercial           | `interno` (cargo `assist_com`)         | apoio comercial, só leitura da Matriz   | Vendas/Pipeline        |
| Marketing                      | `interno` (cargo `marketing`)          | apoio de captação, só leitura da Matriz | Leads/Distribuição     |
| Master franqueado              | `master`                               | gestão de grupo                         | Visão geral do grupo   |
| Franquia **Full**              | `franqueado` (modelo Full)             | gestão de grupo + matrizinha            | Visão geral do grupo   |
| Franquia **Individual**        | `franqueado` (modelo Smart/Light/…)    | vendedor                                | Cockpit do vendedor    |
| Vendedor                       | `vendedor`                             | vendedor                                | Cockpit do vendedor    |

---

## Bloco 0 — Matriz: convite, filas de aprovação e onboarding

Logado como **Matriz** (`<EMAIL_MATRIZ_QA>`). Isso testa o convite, as
duas filas de aprovação, o e-mail real e a montagem da hierarquia inteira — nenhum
passo deste bloco exige ser diretor.

- [ ] **Login** entra e cai na **Visão geral da Matriz** (não vê "Novo lead"). O selo
      da marca mostra MATRIZ.
- [ ] Todos os campos de senha do login, criação e redefinição têm controle para
      **mostrar/ocultar** sem alterar o valor digitado.
- [ ] **Esqueci minha senha:** solicite a recuperação para uma conta ativa. A tela
      não deve revelar se um e-mail desconhecido existe; abra o e-mail recebido,
      redefina a senha e confirme o login com a nova senha. Link usado/expirado deve
      mostrar erro seguro e permitir iniciar uma nova solicitação.
- [ ] A porta antiga de autocadastro **não existe mais** — não há link de "criar
      conta" na tela de login; a única entrada é convite ou o cadastro manual da
      Matriz (com log).
- [ ] **Convidar** (modal em 4 escopos): emita um convite para Coordenador, um para
      Master, um para Franquia (Full e Individual) e um para Vendedor Matriz. Para
      cada um, confira as 3 saídas: **Copiar link**, **WhatsApp** (`wa.me`) e **PDF**
      com arte oficial e link clicável.
- [ ] Abra cada link de convite em aba anônima (`/convite/{token}`): cai no cadastro
      **pré-preenchido** com perfil e vínculo em texto fixo (não editável).
- [ ] **Link expirado ou já usado:** reabra um convite já consumido — mensagem
      amigável, com opção de pedir novo convite (não deixa a pessoa travada).
- [ ] **Cadastro manual · exceção** (ao lado do Convidar): cadastre uma pessoa direto
      — selo amarelo de exceção aparece, e o cadastro entra no log/histórico com o
      autor.
- [ ] **Pendentes**, bloco **time interno** (Coordenador, Supervisores, cargos):
      aprove um pedido — escolha cargo, áreas (ou aceite o preset) e, se aplicável,
      janela/produtos/canais.
- [ ] **Pendentes**, bloco **Externos** (Master, franquias, vendedores): aprove um
      Master e uma franquia; confira o seletor de Supervisor de Vendas para vendedor
      novo; Master franqueado **não** recebe seleção de produtos/canais.
- [ ] Repita a aprovação de vendedor **logado como Franquia Full** — ela aprova o
      próprio vendedor **sem passar pela Matriz** (fila própria, `xacessos.tsx`).
- [ ] **Modal de análise:** confirme que ele vem travado no que o convite definiu
      (perfil/vínculo); "Reclassificar" só deve aparecer como exceção registrada.
- [ ] **E-mail real no ambiente configurado:** a pessoa aprovada recebe boas-vindas
      com o escopo no corpo e um link de **criar senha** (recovery, validade 48h, uso único).
      Abra o link, defina senha (8+, letras e números) e confirme que loga.
- [ ] **Reenvio do acesso:** enquanto o cadastro ainda não tiver ativado a conta,
      use **Enviar novo link** em Acessos. Confirme a mensagem de sucesso, abra o link
      mais recente e verifique que o anterior foi invalidado. Cliques repetidos ou
      concorrentes não podem produzir links válidos concorrentes nem expor o link na UI.
- [ ] Botão **"Quero falar com a Cote Certo"** na tela de login: preencha nome,
      e-mail, tema e mensagem — deve enviar sem persistir nada na base (é e-mail
      direto à Matriz).
- [ ] **Configurações** → abra os cards (Distribuição de leads, Metas, Auditoria,
      Integrações, Notificações, Perfis e usuários). Confira os modais por perfil.
- [ ] **Acessos e permissões** → aba **Personalização geral**: confira os modelos de
      franquia (Full vs Individual) e o **Modelo CLT**.
- [ ] Registre apenas os **e-mails de QA** de cada persona criada. Guarde as senhas no
      canal seguro da execução, nunca neste roteiro, em prints ou no relato do bug.

> Se algum passo não estiver óbvio na UI, **pare e me avise** — pode ser gap de
> onboarding a fechar antes do go-live.

---

## Bloco 1 — Vendedor: fluxo de venda ponta a ponta

Logout → entre com o **vendedor** criado no Bloco 0.

- [ ] Cai no **cockpit (Início)**: vê "Novo lead"; selo VENDEDOR. KPIs do dia
      carregam sem erro.
- [ ] **Atender agora**: se houver lead distribuído, "Assumir e iniciar" funciona;
      sem lead, mostra o estado vazio.
- [ ] **Novo lead** → preencha o **wizard de cotação** inteiro (6 etapas: Segurado →
      Seguro → Veículo → Perfil → Coberturas → Cálculo):
  - [ ] Máscaras funcionam (CPF/CNPJ, celular, CEP com busca de endereço, placa,
        valores em R$).
  - [ ] Busca de **CEP** preenche endereço; **FIPE** (marca/modelo) carrega e traz o
        valor.
  - [ ] Validação por etapa: tentar avançar com campo obrigatório vazio **bloqueia**
        e mostra o erro.
  - [ ] **Rascunho**: saia no meio (feche/volte) e reabra a cotação — os dados
        voltam.
  - [ ] Na etapa **Cálculo**, "Calcular" gera os prêmios por seguradora.
- [ ] **Cotações**: a cotação aparece na lista; abrir o detalhe mostra o comparativo
      de seguradoras.
- [ ] **Gerar proposta** a partir da cotação; ela aparece em **Propostas**.
- [ ] **Aceite & transmissão**: registrar transmissão da proposta.
- [ ] **Pipeline**: o lead/cotação transita de etapa (arrastar cartão).
- [ ] **Classificar perda**: pegue um lead e classifique como perdido (motivo +
      submotivo) — some do pipeline ativo.
- [ ] **Extrato de vendas**: mostra a venda e o total do período.
- [ ] **Mensagens prontas**: lista as mensagens; botão **Copiar** funciona.
- [ ] **Escopo (importante):** o vendedor **só enxerga os próprios**
      leads/cotações/propostas — não vê de outros vendedores.

---

## Bloco 2 — Franquia Individual

Logout → entre com a **franquia Individual**.

- [ ] Tem a **mesma navegação do vendedor** (vê "Novo lead"); selo FRANQUEADO com
      "· individual".
- [ ] Repasse rápido do fluxo de venda (Bloco 1) — deve se comportar igual ao
      vendedor.
- [ ] **Escopo:** vê só a própria operação (não a rede); em `/operacao/xacessos` não
      vê nenhuma das seções exclusivas da Full ("Personalização geral",
      "Performance").

---

## Bloco 3 — Grupo (Master / Coordenador / Supervisores / Franquia Full)

Faça este bloco com **cada uma** das personas de grupo. O comportamento de tela é
parecido; o que muda é o **alcance** (rede completa vs. recorte por cargo) e, na
Franquia Full, as seções extras do Bloco 4.

- [ ] Login cai na **Visão geral do grupo/comando** (`xdash`); vê a navegação
      correspondente às áreas do cargo (ver tabela abaixo). Master/Full/Coordenador
      **não** veem "Novo lead" nem "Distribuição de leads pendentes" no sentido de
      criar cotação própria.
- [ ] Dashboard: KPIs, alertas e ranking carregam sem erro.
- [ ] **Vendedores**: lista da rede/time; abrir um vendedor mostra o detalhe (KPIs,
      funil, performance por seguradora).
- [ ] **Pipeline geral**: kanban com os leads visíveis; filtros por
      franquia/vendedor/origem/seguradora.
- [ ] **Aprovações**: só quem tem alçada de desconto (**Supervisor de Vendas**,
      Coordenador, Master, Matriz) vê pedido de desconto de subordinado; o
      **Supervisor Operacional não vê** (sem alçada, por design — confirme que a
      tela nem mostra a área).
- [ ] **Menu por cargo** (confirme a lista exata, área por área):
  - Coordenador Comercial: as mesmas **17 áreas** da Matriz (menu igual; a
    diferença é não ser diretor, não é o menu).
  - Supervisor de Vendas: **11 áreas** — Visão geral, Aprovações, Vendedores,
    Supervisão, Pipeline geral, Vendas, Comissões, Premiações, **Estornos**,
    Renovações, Relatórios.
  - Supervisor Operacional: **4 áreas** — Visão geral, Leads, Distribuição,
    Acessos e permissões.
  - Master: menu de comando do grupo, sem Configurações globais.
  - Franquia Full: **14 áreas** — quase o menu da Matriz, sem Franquias, sem
    Configurações globais e sem Mensagens prontas. Não existe uma área "Canais"
    nem "Central da Franquia" separadas no menu — "Central da Franquia" é o
    comportamento das próprias áreas Leads/Distribuição pra Full (leads/SLA/canais
    próprios, ver Bloco 4), não um item novo.

- [ ] **Escopo crítico:** cada persona de grupo **só vê a própria sub-rede** —
      Master não vê a rede de outro Master; Coordenador vê tudo da Matriz;
      Supervisor vê o que o cargo permite. Confirme trocando entre elas.
- [ ] **Solicitar desligamento** (Master ou Franquia): peça o desligamento de um
      vendedor da própria rede — tente enviar **sem motivo** primeiro (deve
      bloquear, motivo é obrigatório); confirme com motivo preenchido. A
      solicitação vai pra Matriz decidir (retome em "Aprovar desligamento" no
      Bloco 5). Confira também "Minhas solicitações" mostrando o status
      (pendente/aprovado/negado).
- [ ] **Trava de exclusão:** tente excluir direto (sem passar por desligamento) um
      Master que tem franquia/vendedor embaixo, ou uma franquia que tem vendedor
      embaixo — deve **bloquear** com mensagem clara, não deixar excluir
      silenciosamente e órfãos ficarem soltos na hierarquia.

---

## Bloco 4 — Franquia Full: Central da Franquia, Personalização e Performance

Continue logado como **Franquia Full** (modelo Full). Este bloco é novo em relação
ao roteiro original — cobre a Full como "matrizinha" da própria rede.

- [ ] **Central da Franquia**: distingue leads **próprios** (captação da própria
      franquia) dos **repassados** pela Matriz; cada tipo mostra seu próprio SLA e
      canal.
- [ ] Crie/receba um lead **próprio**: o SLA aplicado é o da própria Full, não o da
      Matriz.
- [ ] Um lead **repassado** que estoure o SLA, ou seja classificado como perda, deve
      **voltar para a Matriz** como Devolvido/Perda (cruzamento de fronteira) —
      confirme do lado da Matriz que ele reaparece lá.
- [ ] Vá em `/operacao/xacessos` ("Acessos da equipe") — confirme as **5 abas**:
      "Meu time" (default), "Pendentes de aprovação", "Desligamentos",
      "Personalização geral" e "Performance".
      Franquia Individual **não** vê esse toggle (Bloco 2).
- [ ] Aba **Personalização geral** → sub-aba **Modelo CLT · comissionamento**:
  - [ ] Card "Modelo CLT" é **somente leitura** (singleton global da Matriz) —
        não há botão de salvar ali.
  - [ ] Card "Complementos do time" é **editável**: comissão de venda (%),
        comissão na renovação (%), bônus de campanha, meta padrão da equipe.
        Salve e confirme que persiste (recarregue a página).
  - [ ] **Nenhum modal de senha de diretor aparece** ao salvar — a Full nunca é
        diretora; o controle aqui é por identidade (dono da própria franquia +
        modalidade Full), não por senha.

- [ ] Aba **Performance**: régua de performance **do próprio time** (janela, limites
      de conversão para Atenção/Travado, cancelamentos, pausa de leads).
  - [ ] Salvar a régua **não** pede senha de diretor e **não** tem o toggle
        "Notificar o supervisor" (esse é exclusivo da régua interna/rede da
        Matriz, Bloco 6).
  - [ ] **Atenção:** essa régua (bloco `full`) é **compartilhada entre todas as
        Franquias Full** — se houver mais de uma Full de teste, uma altera e a
        outra vê o valor novo.

- [ ] Aba **Histórico**: mostra as alterações feitas nesta franquia (inclusive a
      que você acabou de salvar), filtradas só para ela — não mistura com o
      histórico global da Matriz.
- [ ] **Comissão por origem do lead:** confira que o comissionamento aplicado
      distingue lead próprio vs. repassado, conforme a regra configurada.

---

## Bloco 5 — Matriz: telas de gestão e visão geral

Volte para a **Matriz** e valide as telas de comando (a Matriz vê **tudo**).

- [ ] **Visão geral (Matriz)**: 9 KPIs, **seletor de período único** (dia / semana /
      quinzena / mês / personalizado) — todos os widgets (KPIs, funis, evolução,
      rankings) devem reagir à **mesma** janela escolhida, não a opções soltas por
      widget.
- [ ] **4 funis por canal** (Movida/Google/Facebook/Manual) escalando com o período
      escolhido.
- [ ] **8 alertas clicáveis**, todos derivados de estado real persistido (não
      heurística de tela): confira especialmente os 3 mais recentes — **pendência
      da seguradora** (não é só proposta "gerada"), **franquia abaixo da meta** no
      período, e **vendedor em atenção/travado** (vem da régua de performance). Cada
      alerta deve abrir na tela e no filtro certos.
- [ ] **Leads** e **Distribuição**: distribuir leads pendentes (manual e
      automático); regras e simulação.
- [ ] **Lead externo — Captação Movida:** envie um evento válido pela integração e
      confirme que o lead nasce na **fila global**, sem vendedor e sem atribuição à
      empresa Matriz. Reenvie o mesmo evento e confirme idempotência (não duplica).
      Evento inválido deve falhar sem criar lead parcial.
- [ ] **Aprovações (desconto)**: aprove / negue / faça **contraproposta** / **escale**
      um pedido. Confira: aprovar **atualiza o prêmio** automaticamente;
      contraproposta volta ao solicitante; escalar sobe na cadeia
      **Master → Coordenador → Matriz**.
- [ ] **Aprovar desligamento**: retome a solicitação do Bloco 3 — em **Acessos** →
      aba **Desligamentos**, confirme que o motivo aparece pra decisão; aprove uma
      e negue outra (se tiver 2). Depois de aprovado, a pessoa sai da rede ativa e
      vai para a lista de desligados; confirme que "Minhas solicitações" do lado de
      quem pediu reflete o status novo.
- [ ] **Vendas** (visão da rede, diferente do Extrato pessoal do vendedor): confira
      que mostra as vendas de toda a operação, com filtro por franquia/vendedor.
- [ ] **Franquias**: abra o detalhe de uma franquia já cadastrada (não a que você
      acabou de criar por convite) e confirme que os dados carregam e são editáveis
      onde deveriam ser.
- [ ] **Comissões**: fechamento por competência; KPIs; comissão por
      franquia/seguradora; top vendedores.
- [ ] **Premiações**: cadastre uma campanha, lance um ganhador manualmente, marque
      **pago/a pagar**.
- [ ] **Estornos**: cancele uma apólice (não só veja a lista) e confirme que ela
      aparece aqui com prêmio/comissão revertidos automaticamente.
- [ ] **Renovações**: apólices a vencer (janela de 60 dias); "Iniciar renovação"
      cria o lead na distribuição padrão.
- [ ] **Mensagens prontas (biblioteca/admin)**: cadastre ou edite uma mensagem —
      confirme que ela aparece pro vendedor consumir (Bloco 1).
- [ ] **Motivos e submotivos de perda (catálogo)**: confira a lista configurada —
      se der pra ajustar aqui, teste que a mudança reflete no modal "Classificar
      perda" que o vendedor usa (Bloco 1).
- [ ] **Relatórios**: gere cada um dos relatórios em **PDF** e em **Excel/CSV** e
      confira que baixam e abrem.
- [ ] **Supervisão**: caça-gargalos e comparativo de vendedores.
- [ ] **Acessos** e **Configurações**: reconfirme que nada quebrou.

---

## Bloco 6 — Governança e histórico (diretor)

Logout → entre com `<EMAIL_DIRETOR_1_QA>` e depois com `<EMAIL_DIRETOR_2_QA>`.
As duas contas devem ter `diretor=true` e credenciais fornecidas pelo canal seguro,
para testar a dupla aprovação (uma propõe, a outra confirma).

- [ ] Nos botões **"Salvar política"** das telas de configuração (réguas
      interna/rede, e demais políticas sensíveis da Matriz — não confundir com os
      da Full, Bloco 4, que não pedem senha): confirme que cada um pede **senha de
      diretor** antes de gravar.
- [ ] Logado como alguém **sem** marcação de diretor (ex.: Coordenador), tente
      salvar uma dessas políticas: deve aparecer "Seu acesso não permite esse tipo
      de alteração" (bloqueado também no backend, não só escondido na tela).
- [ ] **Incluir/remover diretor** exige aprovação de outro Diretor (dupla
      aprovação) — não deve ser uma ação de um clique só.
- [ ] Tela **Histórico**: mostra DE/PARA de cada alteração; filtro por área
      persiste ao navegar. Tente editar ou apagar uma linha do histórico
      diretamente (se tiver acesso a ferramenta de banco) — deve ser rejeitado
      (append-only, nem o superusuário edita).

---

## Bloco 7 — Cargos internos: escopo restrito à operação da Matriz

Entre com **Marketing** e depois com **Assistente Comercial** (cargos do time de
apoio, perfil `interno`).

- [ ] **Marketing** vê no menu: Visão geral, Leads, Distribuição, Relatórios (áreas
      do preset). Abrindo Leads/Distribuição, os dados carregam — **não é tela
      vazia**.
- [ ] **Marketing enxerga somente a operação própria da Matriz** — não aparece
      nenhum lead/dado de Master, Franquia Individual ou Franquia Full.
- [ ] **Assistente Comercial** vê no menu: Visão geral, Vendas, Pipeline geral.
      Mesma regra: só dados da Matriz, nenhuma franquia.
- [ ] **Marketing com área `mdist`:** em Distribuição, consegue redistribuir, puxar
      lead de volta e rodar a distribuição automática. Remova `mdist` por override e
      confirme que as ações somem/falham também no servidor.
- [ ] **Assistente Comercial sem `mdist`:** permanece sem as ações de distribuição.
      A autorização acompanha a área concedida, não o nome do cargo.
- [ ] **Supervisor Backoffice** (se testado): confira que o menu reflete o recorte
      do cargo (Distribuição de leads, vendas de todos os canais, pendências de
      emissão) e não sobra nem falta área.

---

## Bloco 8 — Regras de negócio críticas (validar o comportamento, não só a tela)

- [ ] **Desconto multinível:** um vendedor pede desconto acima da alçada → sobe para
      o superior; sem política definida no nível, **escala até a Matriz** pela
      cadeia **Master → Coordenador → Matriz**; aprovar **atualiza o prêmio** da
      proposta.
- [ ] **Comissão (G4):** o valor bate com a regra (fator pela média do vendedor;
      override de base desconta royalties; bônus Elite trimestral entra sobre a
      comissão). Compare um caso simples na mão.
- [ ] **Comissão por origem (Full):** lead próprio e lead repassado da mesma
      franquia Full usam a regra de comissão certa para cada origem.
- [ ] **Renovação (G6):** apólice a 60 dias do vencimento vira lead **manual**; o
      lead entra na **distribuição padrão** (não vai direto pro vendedor original);
      apólice vencida sem ação → marcada como perdida.
- [ ] **Premiação (G5):** é **manual** e **só a Matriz** lança; grupo só vê as da
      própria rede.
- [ ] **Régua de performance:** vendedor/franquia classificado como **Travado** sai
      da distribuição automática; reativar exige registro de quem revisou.
- [ ] **Régua da Full vs. régua interna/rede:** confirme que são **réguas
      independentes** — alterar a régua interna (Matriz, com senha de diretor) não
      afeta a régua da Full (Bloco 4, sem senha, gate por identidade), e vice-versa.
- [ ] **Cruzamento de fronteira:** lead repassado que estoura SLA ou vira perda
      **sai da conta da Full e volta para a Matriz** (Bloco 4).
- [ ] **Isolamento por rede (RLS):** o teste mais importante — em cada perfil,
      confirme que **não** aparece dado de outra rede/vendedor/franquia. Se alguém
      enxergar leads/comissões de fora do próprio escopo, é **bug de segurança
      grave** (reporte com prioridade).

---

## Regressões que devem ser reportadas

Confirme que estes itens, resolvidos ao longo da V10/V11, continuam funcionando —
regressões neles são bug, não "sempre foi assim":

- categorias, busca ou ação WhatsApp em Mensagens prontas;
- tabela, filtros ou cards ricos no Pipeline;
- negociação, versões ou status em Propostas;
- timeline ou conferência obrigatória no Aceite;
- KPIs, metas ou estornos no Extrato;
- trilha de auditoria em Comissões;
- busca, menu do usuário ou badges esperados na navegação;
- porta de entrada por convite (autocadastro espontâneo **não deve reaparecer**).

Também valide o ciclo assíncrono da Quiver. Falha externa deve produzir estado de
erro compreensível, sem perder o rascunho nem duplicar uma solicitação.

---

## Resultado

Ao terminar, me diga: (1) o que passou, (2) a lista de bugs achados (formato acima),
(3) qualquer fluxo de onboarding ou de configuração da Full que ficou confuso. A
partir disso eu priorizo correções e a gente decide o que entra antes do go-live.
