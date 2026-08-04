# Q4 — Roteiro de QA manual por perfil (V11, atualizado em 04/08/2026)

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

> **Ambiente:** `https://cote-certo.sandboxallcom.com`
> **Login inicial (Matriz/diretor):** `desenvolvimento@suppercerto.com.br` · senha
> `Supper@123!`
> As outras personas **não existem no seed** (exceto quando indicado) — você as cria
> pela própria aplicação, pelo fluxo de **convite** (Bloco 0). Isso é proposital: o
> convite, o cadastro por link e a aprovação também são parte do teste.

## Como reportar um problema

Para cada item, marque ✅ (ok) / ❌ (bug) / ⚠️ (estranho, mas funciona). Ao achar um
bug, anote: **tela**, **perfil logado**, **passo**, **o que esperava**, **o que
aconteceu** (e print se der). Junte tudo e me manda que eu trato.

## As experiências (perfis e cargos)

| Persona de teste                     | Perfil / cargo (RLS)              | Experiência              | Tela inicial              |
| ------------------------------------- | ---------------------------------- | ------------------------ | -------------------------- |
| Matriz (diretor)                      | `matriz`                           | gestão total              | Visão geral da Matriz      |
| Coordenador Comercial                 | `coordenador` (cargo `coord_com`)  | gestão total, não diretor | Visão geral da Matriz      |
| Supervisor de Vendas                  | `supervisor` (cargo `sup_vendas`)  | comando comercial         | Visão geral (11 áreas)     |
| Supervisor Operacional                | `supervisor` (cargo `sup_operacional`) | comando operacional  | Visão geral (4 áreas)      |
| Supervisor Backoffice                 | `supervisor` (cargo `sup_backoffice`) | apoio operacional      | Visão geral (recorte)      |
| Assistente Comercial                  | `interno` (cargo `assist_com`)     | apoio comercial, só leitura da Matriz | Vendas/Pipeline |
| Marketing                             | `interno` (cargo `marketing`)      | apoio de captação, só leitura da Matriz | Leads/Distribuição |
| Master franqueado                     | `master`                           | gestão de grupo           | Visão geral do grupo       |
| Franquia **Full**                     | `franqueado` (modelo Full)         | gestão de grupo + matrizinha | Visão geral do grupo    |
| Franquia **Individual**               | `franqueado` (modelo Smart/Light/…) | vendedor                | Cockpit do vendedor        |
| Vendedor                              | `vendedor`                         | vendedor                  | Cockpit do vendedor        |

---

## Bloco 0 — Matriz: convite, filas de aprovação e onboarding

Logado como **Matriz/diretor**. Isso testa o convite, as duas filas de aprovação, o
e-mail real e a montagem da hierarquia inteira.

- [ ] **Login** entra e cai na **Visão geral da Matriz** (não vê "Novo lead"). O selo
      da marca mostra MATRIZ.
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
- [ ] **E-mail real** (produção): a pessoa aprovada recebe boas-vindas com o escopo
      no corpo e um link de **criar senha** (recovery, validade 48h, uso único).
      Abra o link, defina senha (8+, letras e números) e confirme que loga.
- [ ] Botão **"Quero falar com a Cote Certo"** na tela de login: preencha nome,
      e-mail, tema e mensagem — deve enviar sem persistir nada na base (é e-mail
      direto à Matriz).
- [ ] **Configurações** → abra os cards (Distribuição de leads, Metas, Auditoria,
      Integrações, Notificações, Perfis e usuários). Confira os modais por perfil.
- [ ] **Acessos e permissões** → aba **Personalização geral**: confira os modelos de
      franquia (Full vs Individual) e o **Modelo CLT**.
- [ ] Anote **e-mails e senhas** de cada persona criada — vai logar com elas nos
      próximos blocos.

> Se algum passo não estiver óbvio na UI, **pare e me avise** — pode ser gap de
> onboarding a fechar antes do go-live.

---

## Bloco 1 — Vendedor: fluxo de venda ponta a ponta

Logout → entre com o **vendedor** criado no Bloco 0.

- [ ] Cai no **cockpit (Início)**: vê "Novo lead"; selo CORRETOR. KPIs do dia
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
      - Franquia Full: quase o menu da Matriz, sem Franquias e sem Configurações
        globais, **+ Canais** e **+ Central da Franquia** (Bloco 4).
- [ ] **Escopo crítico:** cada persona de grupo **só vê a própria sub-rede** —
      Master não vê a rede de outro Master; Coordenador vê tudo da Matriz;
      Supervisor vê o que o cargo permite. Confirme trocando entre elas.

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
- [ ] Vá em `/operacao/xacessos` ("Acessos da equipe") — confirme o toggle de
      **3 seções**: "Meu time" (default), "Personalização geral" e "Performance".
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
- [ ] **Aprovações (desconto)**: aprove / negue / faça **contraproposta** / **escale**
      um pedido. Confira: aprovar **atualiza o prêmio** automaticamente;
      contraproposta volta ao solicitante; escalar sobe na cadeia
      **Master → Coordenador → Matriz**.
- [ ] **Comissões**: fechamento por competência; KPIs; comissão por
      franquia/seguradora; top vendedores.
- [ ] **Premiações**: cadastre uma campanha, lance um ganhador manualmente, marque
      **pago/a pagar**.
- [ ] **Estornos**: lista de vendas canceladas com prêmio/comissão revertidos.
- [ ] **Renovações**: apólices a vencer (janela de 60 dias); "Iniciar renovação"
      cria o lead na distribuição padrão.
- [ ] **Relatórios**: gere cada um dos relatórios em **PDF** e em **Excel/CSV** e
      confira que baixam e abrem.
- [ ] **Supervisão**: caça-gargalos e comparativo de vendedores.
- [ ] **Acessos** e **Configurações**: reconfirme que nada quebrou.

---

## Bloco 6 — Governança e histórico (diretor)

Ainda como **Matriz/diretor** (crie um segundo diretor se possível, para o item de
dupla aprovação).

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
- [ ] Em nenhum dos dois cargos há **escrita** liberada além do que o preset já dava
      (não conseguem editar/distribuir leads de fora do que a área permite).
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
