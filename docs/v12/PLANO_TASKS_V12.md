# Plano de Tasks — CoteCerto V12

**Base:** protótipo `cotecerto_prototipo_v12 - cópia.html` (build 03/09 · r116), comparado byte a byte contra `cotecerto_prototipo_v11.html` (build 28/07 · r40) e contra o estado real do repositório em 05/09/2026.

**Persona-alvo desta primeira leva:** **Vendedor · Diego (etapa 7)** — o corte fino da V12 que introduz a **Etapa 7 · Transmissão** dentro do wizard de cotação. As demais 7 personas da V12 (Matriz·Ana, Matriz escopo·Marina, Vendedor·Rafinha, Master·Douglas, Supervisor·Paula, Franquia Full·Marcelo, Franquia Individual·Felipe) recebem aqui um levantamento de primeira camada — profundidade equivalente à Etapa 7 fica para uma segunda rodada, quando esta frente fechar.

**Como ler este plano:** tasks numeradas `V12.<frente>.<n>`, tag do agente responsável (`banco`, `front`, `infra`, `testes`) conforme o fluxo do `AGENTS.md` (planejador → especialista → testes → revisor, com aprovação explícita antes de codar). Nenhuma task aqui está aprovada para implementação — este documento é o material de planejamento a ser revisado com o usuário antes de entrar no fluxo normal.

---

## Por que a Etapa 7 é o corte certo para começar

Hoje (`StepCalculo.tsx:118-160`), "Gerar proposta" é **um clique**: `gerarProposta()` chama `transmitirPropostaQuiver()`, que grava uma tentativa em `cotacao_transmissoes` e devolve controle na hora — o robô Quiver responde depois, assíncrono, via webhook (`quiver-transmissao-webhook.ts`), atualizando `propostas.transmissao_status`.

Na V12, esse clique deixa de ser o fim da jornada e passa a ser a **entrada** de um wizard de 4 sub-passos (Dados complementares → Confirmação → Pagamento condicional → Transmitida), só visível para o Diego (`temEtapa7()`). É uma mudança de UX e de modelo de dados relevante o bastante para justificar tratamento isolado, e é exatamente o que o usuário pediu para aprofundar primeiro.

---

## Frente 1 · Etapa 7 — Transmissão (Vendedor Diego)

### 1.1 — Modelo de dados

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.1 | banco | Migration: `propostas` ganha `parcelas int`, `valor_parcela numeric(14,2)`, `dia_vencimento smallint`, `protocolo_seguradora text`, `orcamento_cia text`, `vigencia_inicio date`, `vigencia_fim date`, `vigencia_aceita date`. Hoje só existem `forma_pagamento`, `premio`, `vencimento` (data única) — nada disso cobre parcelamento nem protocolo. Checks: `parcelas between 1 and 12`, `valor_parcela > 0`. | — |
| V12.1.2 | banco | Migration: tabela `proposta_dados_complementares` (1:1 com `propostas`) para os ~30 campos do sub-passo 0 que hoje não existem em `cotacao_segurado`/`cotacao_veiculo`: `rg`, `orgao_emissor`, `data_nascimento`, `nome_social`, `telefone_residencial`, endereço de correspondência completo (quando distinto do residencial), `cor`, `combustivel`, `zero_km`, `atividade_profissao`, `renda_mensal`, `pessoa_exposta_politicamente boolean`, `seguradora_anterior`, `vigencia_fim_anterior date`, `numero_apolice_anterior`, `sucursal_anterior`, `ci_classe_bonus`, `bonus_classe`. RLS: mesma visibilidade de `cotacao_segurado` (dono da cotação/empresa/matriz-master). | V12.1.1 |
| V12.1.3 | banco | Migration: `check` em `propostas.status` para incluir `'bloqueada'` (hoje o protótipo usa esse status quando pagamento é cartão e a reserva ainda não confirmou — checar se o enum de status atual já cobre isso ou se precisa de novo valor). Mapear os status do protótipo (`transmitida`, `bloqueada`, `analise`, `emitida`, `recusada`) contra o enum real e fechar o de-para. | V12.1.1 |
| V12.1.4 | banco | Migration: tabela `proposta_boletos` (proposta_id, parcela_numero, linha_digitavel, vencimento, valor, status, enviado_em) — só populada quando `forma_pagamento = 'Boleto Bancário'`. RLS por dono da proposta. | V12.1.1 |
| V12.1.5 | testes | Testes de RLS: vendedor só lê/escreve dados complementares e boletos das suas próprias propostas; matriz/master leem de qualquer uma dentro do escopo. | V12.1.2, V12.1.4 |

### 1.2 — Regra de acesso (decidida — mais simples do que o protótipo sugere)

**Decisão do usuário (05/09/2026):** a Etapa 7 **não é restrita a nenhum perfil**. É todo vendedor do sistema — matriz, franquia (Full ou Individual) e corretora parceira, CLT ou PJ. É tratada como uma extensão natural da cotação: "quem pode cotar, pode transmitir". A leitura de `temEtapa7()` como flag de vínculo (hipótese do relatório original) estava errada — no protótipo é só uma flag de persona de demonstração (só o Diego tem `etapa7:true`), não uma regra de produção.

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.6 | — | ~~Decidir a regra do gate~~ — **resolvido**: sem gate novo. Task removida do escopo. | — |
| V12.1.7 | banco | Confirmar que o controle de acesso já existente (dono da cotação, `assertDonoCotacao` em `src/lib/quiver.functions.ts`) cobre integralmente `propostas`/`proposta_dados_complementares` — sem RPC nem coluna de permissão nova. Só criar as policies de RLS das tabelas novas (V12.1.2, V12.1.4) espelhando o mesmo padrão de `cotacao_transmissoes_select` (dono da cotação OR empresa OR matriz/master). | V12.1.2, V12.1.4 |
| V12.1.8 | front | O passo "Transmissão" do wizard aparece **sempre**, para qualquer vendedor autenticado dono da cotação — sem condicional de perfil/cargo/vínculo. Substitui totalmente a lógica de `temEtapa7()` do protótipo. | — |

### 1.3 — UI do wizard de transmissão (sub-passo a sub-passo)

O botão "Gerar proposta" do card de oferta (`StepCalculo.tsx:531`) deixa de chamar `gerarProposta()` direto e passa a abrir este wizard. A tela de espera (`ccEspera`, protótipo linhas 5610-5665) narra passos textuais enquanto a chamada real acontece — reaproveitável como um componente `EsperaAssincrona` genérico.

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.9 | front | Componente `TransmissaoWizard` com stepper de 4 (ou 3, se não-cartão) sub-passos, estado local persistente entre re-renders (equivalente a `transmSalvaCampos`/`transmCampo` do protótipo — o formulário não pode perder o que foi digitado ao trocar seleção). | V12.1.8 |
| V12.1.10 | front | Sub-passo 0 "Dados complementares": formulário com as seções Dados básicos do segurado, Endereço residencial, toggle "endereço de correspondência é o mesmo" (pill), Dados complementares do veículo, Informações adicionais do segurado, Dados complementares do seguro (só exibido quando há seguro anterior). Todos os ~30 campos com zod espelhando os checks de V12.1.2. Botões: Voltar ao cálculo / Gravar rascunho / Efetivar. | V12.1.2, V12.1.9 |
| V12.1.11 | front | Sub-passo 1 "Confirmação": duas colunas — "Informações que serão enviadas" (dados do veículo/segurado já preenchidos) e "Retorno da seguradora" (protocolo, orçamento, valor IS, prêmio detalhado líquido/juros/IOF/total). Botão avança para Pagamento só se `forma === 'Cartão de Crédito'`, senão vai direto para "Confirmar e transmitir". | V12.1.10 |
| V12.1.12 | front | Sub-passo 2 "Pagamento" (condicional): para não-cartão, nota informativa (boleto/débito gerado pela seguradora após transmitir). Para cartão, formulário de dados do cartão. **Decisão de segurança obrigatória**: dados de cartão precisam ir direto a um ambiente PCI-compliant (gateway/seguradora), nunca trafegar nem persistir no CoteCerto — o protótipo já modela os campos como `disabled`/mascarados de propósito. | V12.1.11 |
| V12.1.13 | front | Sub-passo 3 "Transmitida": card de resultado com status (chip), dados da proposta (nº, protocolo, vigência proposta × aceita), prêmio e pagamento, nota de prazo de assinatura (15 dias), ações "Documentos e envio" / "Consultar protocolo" / atalhos para Emissão & histórico e Pipeline. | V12.1.4, V12.1.11 |
| V12.1.14 | testes | Testes de componente: navegação entre sub-passos preserva os dados digitados; passo de Pagamento não aparece para forma ≠ cartão; formulário bloqueia avanço com zod inválido. | V12.1.10 a V12.1.13 |

### 1.4 — Integração com a seguradora (Quiver)

O fluxo real já existe e é assíncrono via robô (`transmitirPropostaQuiver` → `cotacao_transmissoes` → webhook `registrar_resultado_transmissao_quiver`). A V12 amplia o payload e adiciona pontos de retorno que hoje não existem.

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.15 | integracao | Ampliar `montarPayloadQuiver`/`transmitirPropostaQuiver` para enviar os campos novos de V12.1.2 quando presentes (hoje só manda `renavam`, `corVeiculo`, `chassiRemarcado`, `cepResidencial`, `numeroEndereco`, `dddCelular` — faltam RG, data nascimento, profissão, PPE, endereço de correspondência, dados do seguro anterior). Confirmar com a doc da API Quiver quais desses campos ela de fato aceita. | V12.1.10 |
| V12.1.16 | integracao | Estender `registrar_resultado_transmissao_quiver`/o payload do webhook para capturar protocolo e orçamento da seguradora (`numero_cotacao_portal` já existe; falta `protocolo_seguradora`, `orcamento_cia`, valor IS, fator de ajuste) — hoje o webhook só grava `transmitido`, `motivo`, `mensagem`, `numero_cotacao_portal`. | V12.1.1, V12.1.16 |
| V12.1.17 | integracao | "Consultar protocolo" (`transmProtocolo`/`transmProtocoloRetorno` no protótipo) — decidir se é polling ativo (nova chamada ao robô) ou apenas releitura do último estado gravado por webhook. O protótipo simula progressão automática de status a cada consulta (`transmitida → analise → emitida`) — **isso é fake e não pode virar comportamento real**; a progressão de status tem que vir só da seguradora. | V12.1.16 |
| V12.1.18 | integracao | Tratamento de recusa/pendência: quando a seguradora recusa ou bloqueia (ex.: pendência de vistoria/reserva de cartão), status `bloqueada`/`recusada`, com o motivo estruturado do webhook exibido ao vendedor e ação de resolver pendência. Cruzar com o webhook de recusa já existente em `20260817040000_webhook_transmissao_recusa_portal_negociacao.sql`. | V12.1.16 |
| V12.1.19 | testes | Teste de integração (mock do robô): payload ampliado é montado corretamente; webhook duplicado não duplica proposta (idempotência, já existe no RPC atual — só validar que a extensão não quebra isso). | V12.1.15, V12.1.16 |

### 1.5 — Documentos e envio ao cliente

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.20 | front | Modal "Documentos da proposta" (`docsProposta`): lista Cotação Supper (marca da corretora), Proposta da seguradora, Boleto (só se aplicável e não bloqueado), Apólice (só quando emitida) — cada um com ver/baixar/encaminhar. | V12.1.13 |
| V12.1.21 | integracao | Geração real dos PDFs — hoje `docPropostaHtml`/`docCotacaoHtml` no protótipo são só um layout ilustrativo; produção precisa do gerador real (mesmo padrão de `src/lib/convite-pdf.ts`) com a arte da Supper e dados reais da proposta/cotação. | V12.1.20 |
| V12.1.22 | integracao | Boleto real: geração da linha digitável e do PDF vem da seguradora (não simulado) quando `forma_pagamento = 'Boleto Bancário'`; envio por e-mail (`transmBoletoEmail`) reaproveita `email-outbox-client.ts`/`email-templates.ts`. | V12.1.4, V12.1.21 |
| V12.1.23 | front | Modal "Enviar ao cliente" (`transmEnviar`): seleção do que enviar (cotação/proposta), canal (e-mail/SMS/WhatsApp), modelo de texto, assunto — reaproveitar `email-templates.ts` e o padrão de mensagens prontas já existente em `venda/mensagens-prontas.tsx`. | V12.1.20 |
| V12.1.24 | teste | Teste E2E: efetivar uma proposta cartão e uma boleto ponta a ponta, conferir que os documentos certos aparecem em cada caso e que "Documentos" fica indisponível para boleto quando `status = bloqueada`. | V12.1.9 a V12.1.23 |

### 1.6 — Correções encontradas em verificação ao vivo (clique a clique no protótipo)

Além da leitura estática do código, o protótipo V12 foi aberto de fato e percorrido campo a campo (login como Diego → Cálculo → Contratar → os 4 sub-passos → Documentos → Consultar protocolo). Isso revelou dois defeitos do próprio protótipo que **não podem ser copiados** para a implementação real, e um componente de UI que faltava no levantamento original.

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.27 | testes | Auditoria campo a campo do pré-preenchimento do sub-passo "Dados complementares": no protótipo, `f.nascimento`, `f.placaNum` e os campos de endereço não batem com as chaves reais do lead (`nasc`, `placa`, `rua`, `num`, `bairro`, `cidade`) — o formulário nasce com metade dos campos em branco mesmo quando o dado já existe (confirmado ao vivo: nascimento e placa existiam no lead mas apareciam vazios no formulário, na Confirmação e no documento final da proposta). Ao implementar de verdade, cada campo do sub-passo 0 que tem equivalente em etapa anterior do wizard precisa de teste dedicado conferindo que o valor bate. | V12.1.10 |
| V12.1.28 | integracao | Confirmar que "Consultar protocolo" nunca simula avanço de status sem retorno real — reforça V12.1.17. Verificado ao vivo: um único clique fez uma proposta pular de "em análise" direto para "Emitida" com número de apólice gerado na hora, sem nenhuma chamada real. | V12.1.17 |
| V12.1.29 | front | Componente "Resumo da cotação" — painel lateral fixo, presente em todos os 4 sub-passos da Transmissão, com segurado/seguro/veículo/coberturas já calculados e um selo de status ("Pronto"). Não estava no levantamento original; vale desenhar como componente próprio, reaproveitável em outras etapas do wizard. | V12.1.9 |
| V12.1.30 | banco | Confirmar se "Fechamento" (rótulo que substitui "Em finalização" no cabeçalho assim que a proposta é efetivada) é um estágio de pipeline formal novo ou só texto de cabeçalho — decide se o Kanban real precisa de uma coluna a mais. | V12.1.13 |

### 1.7 — Impressão de cotações (achado importante: fluxo próprio, anterior à Transmissão)

Existe uma impressão de cotação **antes** de contratar qualquer seguradora — acessível por três entradas (lista "Em negociação", lista "Fase atual", toolbar do Cálculo), todas abrindo o mesmo componente. É um fluxo de documento comparativo multi-seguradora, distinto do "Documentos da proposta" pós-transmissão (seção 1.5), e tem requisitos próprios de configuração.

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.31 | front | Modal "Imprimir cotação" com duas portas: **Configurar impressão** (formulário completo) e **Impressão expressa** (gera na hora com o padrão: Marca Supper, Resumida, todas as seguradoras do cálculo, todas as parcelas, sem comissão). | — |
| V12.1.32 | front | Formulário "Configurar impressão": modelo do documento (Marca Supper × Marca da seguradora — esta última gera **um documento por seguradora dentro do mesmo PDF**), nível de detalhe (Resumida × Detalhada — a Detalhada acrescenta perfil do condutor, uso do veículo e condutores/residentes jovens 17-25 anos), seleção individual de seguradoras (com toggle "incluir mensagens da seguradora no PDF" por cia), parcelas a incluir (à vista a 12x, individualmente ou "só à vista"), franquias (1ª opção/2ª opção/sem franquia), e opções do PDF (economia de páginas, resultado colunado, franquias das coberturas adicionais, marcar como já enviada ao cliente, imprimir comissão). | V12.1.31 |
| V12.1.33 | integracao | Geração real do PDF comparativo — hoje 100% ilustrativo (toast). Precisa layout para os dois modelos (comparativo único vs. um bloco por seguradora), respeitando as opções de nível de detalhe/parcelas/franquias escolhidas. | V12.1.32 |
| **V12.1.34** | **front/banco** | **[CRÍTICO — risco de vazamento de comissão]** Quando "Imprimir comissão" estiver marcado, o PDF passa a exibir o percentual de comissão da corretora por seguradora — e, no protótipo, os botões de envio (E-mail/SMS/WhatsApp) continuam habilitados sem nenhuma trava. Implementar bloqueio ou, no mínimo, um alerta de confirmação explícito antes de enviar externamente um documento com comissão marcada para impressão. Verificado ao vivo: `printEnviar()` não tem nenhuma guarda hoje no protótipo. | V12.1.32 |
| V12.1.35 | banco | Decidir se a linha "Controle interno · Grupo de produção / Padrão de cálculo" deve sair do PDF que vai para o cliente — no protótipo ela aparece sempre, em ambos os modelos, apesar do rótulo "controle interno". | V12.1.32 |
| V12.1.36 | front | Painel de envio (mesmo em ambos os modelos): E-mail (PDF anexado), SMS (link), WhatsApp, Gerar link, Baixar PDF — reaproveitar `email-outbox-client.ts`/`email-templates.ts` e o padrão de envio já usado em 1.5. | V12.1.33 |
| V12.1.37 | testes | Teste E2E: gerar impressão com "Imprimir comissão" ligado e confirmar que o sistema não permite envio externo silencioso (cobre V12.1.34). | V12.1.34 |

### 1.8 — Tela "Emissão & histórico" (lista de propostas transmitidas)

| Task | Tag | Descrição | Depende de |
|---|---|---|---|
| V12.1.25 | front | `propostasLista()` do protótipo separa "Aguardando a seguradora" (status ≠ emitida) de "Concluídas" (emitida) — comparar com `src/routes/_authenticated/venda/propostas.tsx` atual e decidir se é a mesma tela reformulada ou uma tela nova (`emissao`). | V12.1.13 |
| V12.1.26 | front | Ação "Consultar" por linha (só quando não concluída) chama V12.1.17; ação "Documentos" abre V12.1.20. | V12.1.17, V12.1.20 |

---

## Frente 2 · Visão geral das outras 7 personas (levantamento de 1ª camada)

Esta frente é um **radar**, não o detalhamento final — serve para a próxima rodada de planejamento saber onde apontar o próximo aprofundamento. Evidência: nomes de função novos na V12 (277 no total vs V11), agrupados por prefixo.

| Cluster | Prefixo/evidência no protótipo | Personas afetadas | O que investigar na próxima rodada |
|---|---|---|---|
| Cliente VIP | `vip*` (~35 funções: concessão, alçada, indicações, dossiê, inbox de pendências) | Vendedor, Supervisor, Matriz | Não existe hoje no repo nenhuma tabela/tela de "cliente VIP" — é 100% novo. Precisa de reunião de escopo antes de estimar (alçada por perfil, o que dispara a concessão, dossiê = quais dados). |
| Personalização por seguradora | `seg*` (config, planos, personalização, picker) | Matriz (configura), Vendedor (usa no Cálculo) | Mapear contra a config de seguradoras que já existe (tabela `seguradoras`/`planos` — checar `010_seguradoras_planos.sql`) para achar o delta real. |
| Cálculo/comparativo | `calc*` (~25 funções: filtro por cobertura, faixas de prêmio, parcelamento por seguradora) | Vendedor | Comparar contra `StepCalculo.tsx`/`ComparativoQuiver.tsx` atuais — parte já deve existir; achar o que é novo de fato (filtros, ordenação, visão resumo). |
| Agenda/lembretes | `ag*`, `lembrete*` | Vendedor, Supervisor | Não há rota `agenda` hoje no repo (`src/routes/_authenticated/venda/`) — tela nova, checar se substitui algo do pipeline atual. |
| Carteira/renovação (`cr*`) | `crAgendar`, `crRedistribuir`, `crAbsorverDe`, `crExcluir`, `crHist` | Vendedor, Matriz | Confirmar se é a mesma área de `operacao/renovacoes.tsx` reformulada ou tela nova. |
| Fase atual | `render_fase_atual` (única função `render_*` nova — tratar como tela de 1ª classe) + `fase*` | Vendedor, Supervisor | É a única tela inteiramente nova batizada com `render_*` — merece o mesmo tratamento de profundidade dado à Etapa 7 na próxima rodada. |
| Documentos/impressão | `doc*`, `print*`, `imprimir*`, `zap` | Vendedor | Parcialmente descrito acima (1.5) por causa da Transmissão; falta cobrir os documentos fora do fluxo de transmissão (cotação avulsa, reimpressão). |
| Home/pipeline/foco | `home*`, `pipe*`, `foco*`, `cot*` | Vendedor | Provavelmente refino de telas existentes (`inicio.tsx`, `pipeline.tsx`) — comparar linha a linha. |
| Personas de gestão | `setFranqPersona`, `MATRIZ_USERS`, `matrizScope`, `activeGroup` | Ana, Marina, Douglas, Paula, Marcelo, Felipe | Nenhuma mudança estrutural óbvia foi encontrada nos nomes de função — hipótese é que estas 6 personas herdam os clusters acima (VIP, Agenda, Fase atual) mais do que ganham telas próprias. Precisa confirmação tela a tela. |
| Autocadastro/convite | `authDemo`, `AUTH_FIELDS`, `authForm` | Todas (porta de entrada) | Comparar contra `src/routes/auth.*.tsx` e `src/lib/cadastro*.ts` — à primeira vista não há função nova relevante além do botão de persona Diego; baixa prioridade. |

---

## Decisões pendentes que bloqueiam o início

1. ~~Regra real do gate da Etapa 7~~ — **resolvido** (05/09/2026): sem gate, é para todo vendedor. Ver `docs/v12` memória do usuário / seção 1.2 acima.
2. **Escopo de Cliente VIP**: não há nenhuma referência a isso em nenhum documento V10/V11 existente — é uma feature nova que precisa de uma sessão de escopo dedicada antes de virar task.
3. **Campos do sub-passo "Dados complementares"**: confirmar com a seguradora/Quiver quais desses ~30 campos ela realmente aceita hoje via API, para não desenhar UI para campos que o robô não consome.
4. **Dados de cartão de crédito**: confirmar o gateway/fluxo PCI antes de desenhar V12.1.12 — não pode ser implementado "como no protótipo" (campos mascarados fixos) em produção.

---

## Estimativa de esforço — Frente 1 (Etapa 7)

| Tipo | Horas |
|---|---|
| Banco (1.1, parte de 1.4, 1.6, 1.7) | 56h |
| Front (1.3, 1.5, 1.6, 1.7, 1.8) | 130h |
| Integração (1.4, parte de 1.5, 1.7) | 66h |
| Testes (1.6, 1.7) | 40h |
| **Total Frente 1** | **292h** |

Inclui as 11 tasks acrescentadas após a verificação ao vivo do protótipo (correções de pré-preenchimento, o fluxo completo de Impressão de cotações e o bloqueio de vazamento de comissão). A 30h úteis/semana por dev: **≈ 10 semanas** com 1 dev; **≈ 5 semanas** com 2 devs em paralelo (banco+integração / front), respeitando a dependência de V12.1.1-1.2 antes do front começar a consumir o modelo de dados real.

A Frente 2 (as outras 7 personas) ainda não tem estimativa — é levantamento, não plano de execução; a estimativa vem depois que cada cluster passar pelo mesmo aprofundamento dado à Etapa 7.
