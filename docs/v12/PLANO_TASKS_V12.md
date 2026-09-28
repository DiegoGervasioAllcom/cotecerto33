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

## Frente 3 · Telas que o tutorial do vendedor V12 exige (levantamento de 24/09/2026)

O tutorial do vendedor do protótipo V12 (`TOUR_CHAPTERS`, 10 capítulos / 5 módulos — o mesmo para todo vendedor, a persona Diego é só a de demonstração) aponta para telas que o app ainda não tem. **Decisão do usuário (24/09/2026):** construir essas telas primeiro e fazer o tutorial por último, com o texto literal do protótipo. Uma branch por frente, PR ao fechar cada uma.

Falsos gaps (já existem, só o tutorial precisa mapear): Pipeline (`.kcol`/`.kcard`/filtros/toggle), `.seg-pick`, `.plano-pick`, `.hero-placar`, Histórico/Classificar perda, Mensagens prontas, Extrato inteiro, sub-passos 0–1 da Transmissão, desconto `%` no comparativo.

**Integração com o robô (24/09/2026):** a transmissão para a Suhai funciona (resultado transmitida/falha + nº da cotação no portal). ~~O robô também devolve os documentos originais~~ — **corrigido em 27/09/2026 após leitura do código do robô** (`/Users/diego.gervasio/Documents/playwright`): o robô **não** captura PDF de proposta/boleto (a captura de PDF foi removida; quem envia proposta/boleto ao cliente é o próprio portal, por e-mail) e o protocolo da seguradora só vai para o log. V12.1.20/V12.1.21 dependem de o robô passar a extrair esses dados (ver "Lacunas do robô" abaixo). Nº da proposta/protocolo da seguradora, status pós-transmissão (análise/emitida) e "Consultar protocolo" (V12.1.16/V12.1.17) não são capturados nesta frente, mas **o front de Emissão e Transmitida fica pronto para recebê-los** (decisão do usuário). Ordem ajustada: o Pipeline (V12.3.3) vem antes de Emissão e Transmitida.

**Lacunas do robô (leitura do código em 27/09/2026, sem rodar o portal):** o portal Quiver tem, e o robô **não** extrai: (a) a seção de cada oferta — "Cotações para a cobertura Compreensiva" × "Ofertas adicionais" (é o dado real do filtro Compreensiva/Demais, V12.3.12); (b) "Mensagens de retorno" da seguradora (vistoria, alertas) — hoje só dentro de um `htmlSnippet` truncado que o CoteCerto descarta; (c) motivo de "sem retorno" por seguradora (cards/faixas sem preço são descartados); (d) "Prêmios por cobertura"; (e) campos de cobertura por seguradora na entrada (`PremiosCob_<cia>_<id>`, modal Coberturas) — o robô só preenche "(Todas)" (V12.3.7); (f) comissão/desconto/Código Afinidade por cia; (g) protocolo da seguradora (só no log). A conta do portal é de produção e cada cotação é real. **Decisão do usuário:** planejar as mudanças no robô e o consumo no CoteCerto.

| Ordem | Task | Tag | Descrição | Depende de |
|---|---|---|---|---|
| 1 | V12.3.1 | front | **Início — fila do dia unificada** (`.dia-fila`): cartão único "O que fazer agora" com até 6 itens (`HOME_FILA_N`), ordenados atrasado → hoje → resto, garantindo ao menos 1 retorno/lembrete; fontes: retorno agendado, negócio em risco e lembrete (pendência da seguradora e aprovação pedida entram com a V12.3.2); clique navega à origem (o destaque é a V12.3.11); visto verde risca retorno/lembrete na própria linha. Reaproveita `montarAgenda` (`src/lib/agenda.ts`). Substitui os blocos "Sua missão de hoje" e "O que fazer agora (com retorno)". | — |
| 2 | V12.3.2 | front | **Agenda — filtros por tipo** (`.ag-filtros`, chips com contador) + fontes que faltam (pendência da seguradora, aprovações que você pediu — dado já existe no fluxo de desconto). Acrescentar `data-tour` em Novo lembrete, item e visto. | V12.3.1 (fontes compartilhadas) |
| 3 | V12.1.25 (parcial) | front | **Emissão & histórico** — duas listas, "Aguardando a seguradora" (transmitida, falha e, quando existir, análise) e "Concluídas" (emitida), coluna Situação e ações Documentos/Consultar por linha. **O front fica pronto para receber** os dados da integração futura: nº da proposta/protocolo da seguradora (`propostas.protocolo_seguradora`, já existe) mostram "—" enquanto vazios; os status análise/emitida já têm chip e lista; Consultar e Documentos existem, desabilitados com aviso até a integração (V12.1.16/17/20) ligar. Nada de simular status (V12.1.28). | V12.3.3 |
| 4 | V12.1.13 (parcial) | front | **Transmitida** — card de resultado igual ao protótipo (status, nº da proposta e protocolo, vigência proposta × aceita, prêmio e pagamento, prazo de assinatura) e separação "esta proposta" × "próximo passo" (`.atalhos`). **Pronto para receber** os dados da integração: campos sem dado mostram "—"; lista de documentos (`.doc-li`) e "Consultar protocolo" existem e aguardam a integração, sem simular. | V12.3.3 |
| 5 | V12.3.3 | front | **Pipeline — overflow por coluna** (feito): coluna rola por dentro (`.kcol-fixo`/`.kcol-fila`), desbotado e rodapé "mais N ⌄" — com mais leads no servidor, N = total − carregados e o clique carrega a próxima página; sem mais, N = cards fora da vista e o clique rola. Saíram a sentinela de scroll e o "Mostrar mais". **Divergência intencional:** no protótipo o Pipeline geral da gestão (`render_mpipe`) usa `.kcol` puro, mas com a altura fixa do `.kanban` V12 os cards seriam cortados — no app ele reusa a mesma coluna com rolagem. | — |
| 6 | V12.3.4 | front | **Em negociação — duas listas** ("Aguardando cotação" com "7 de 8" respondidas × "Cotação finalizada") + cartão persistente "COTAÇÃO FINALIZADA" (Abrir cálculo / Depois) + item do menu verde pulsando enquanto houver cotação não aberta. Avaliar realtime do Supabase em vez de polling. Wrapper `data-tour` nas ações por linha (`.fase-acoes`) de Em negociação e Em finalização. | — |
| 7a | V12.1.31–33, 36 (fatia A) | front | **Impressão configurável — fatia A:** os 3 botões de imprimir (Cálculo, Comparativo, Em negociação) abrem o modal do protótipo (Configurar impressão × Impressão expressa); PDF nos 2 modelos (Marca Supper × Marca da seguradora), resumida × detalhada, escolha das seguradoras; Baixar PDF/imprimir local. "Imprimir comissão", E-mail, SMS, WhatsApp e Gerar link aparecem desabilitados com aviso. Sem banco. | — |
| 7b | V12.1.34–35, 37 (fatia B) | front/banco | **Impressão — fatia B:** comissão = % efetivo da corretora (não por seguradora — esse dado não existe), lido por RPC nova `security definer` de escopo mínimo (hoje `fn_pct_comissao_efetivo` é fechada de propósito) + registro de impressão/envio; **bloqueio total** de e-mail/SMS/WhatsApp com comissão marcada (só baixar/imprimir local); linha "Controle interno" **sai do PDF do cliente** (só no documento interno, com comissão); e-mail pela fila existente. Gerar link público, SMS e WhatsApp continuam fora (sem provedor / exige desenho de segurança). | 7a |
| 8 | V12.3.5 | front | **Cálculo — lista comparativa como tela principal.** Decisão do usuário: o protótipo mantém as duas visões, mas a principal passou a ser a lista (seguradoras em colunas × coberturas em linhas); no app a principal ainda são os cards. Trocar a visão padrão do passo Cálculo para a lista comparativa e manter os cards como alternativa (`.calc-toolset` lista/cards), com barra de contexto (`.calc-ctx`: nº, cliente, plano, validade), setas com contador de seguradoras fora da tela (`.cl-nav`), faixa de preço e ordenação (o filtro Compreensiva/Demais/Todas `.cob-filtro` fica fora até a V12.3.12 — sem dado real), botões de impressão (`.calc-bar-r`). | V12.1.31 (impressão) |
| 8b | V12.3.12 | integracao | **Tipo de cobertura por oferta** (filtro Compreensiva/Demais/Todas do Cálculo, linha "Tipo de cobertura" e rótulo sob cada seguradora). O protótipo classifica com uma lista fixa (`SEG_COB_DEMAIS=['Azul','Pier']`) — dado inventado. Hoje o robô só devolve o nome do produto em texto livre e o tipo escolhido no Passo 4 não é gravado nem enviado. **Decisão do usuário (25/09/2026):** o filtro não aparece até existir o dado real; ver com o robô/Quiver se dá para enviar e receber o tipo de cobertura de cada oferta. | V12.3.5 |
| 9 | V12.3.6 | front | **Cálculo — ações por seguradora** (`.seg-acoes`): Mensagens (retorno da seguradora sobre o risco), `%` desconto (já existe), Engrenagem (análise do envio, prêmios por cobertura, personalizar) e Recalcular só daquela seguradora. Prêmio/VIP fica fora até a decisão pendente nº 2. | V12.3.5 |
| 10 | V12.3.7 | front/banco | **Personalização por seguradora** (`.seg-perso` e modal da engrenagem): ajustar franquia/carro reserva/vidros de uma seguradora e recalcular só ela. Persistir o ajuste por seguradora na cotação (migration + RLS). | V12.3.6 **Pausada (25/09/2026) — investigar com o robô/Quiver antes:** o robô recebe um único objeto `cobertura` por envio (não há cobertura diferente por seguradora na mesma requisição); só franquia 1ª/2ª opção, vidros e carro reserva têm opções reais no sistema — o catálogo por seguradora do protótipo (`SEG_CAMPOS`) e as abas Assistências/Descontos/Comissões são inventados. Confirmar se o robô/portal tem opções de cobertura por seguradora. Decisão já tomada: o ajuste vale só para "Recalcular esta seguradora" (que descarta as outras, V12.3.6); um recálculo geral usa as coberturas do Passo 5 e marca o ajuste como não aplicado. |
| 11 | V12.3.8 | front/banco | **Segurado — tipo de seguro por ícone** (`.tipo-item`, Auto/Moto/Vida): troca o tipo sem recomeçar o cadastro; só Auto tem jornada completa, os outros aparecem marcados como "em breve". Checar se a cotação já tem coluna de tipo. Mesma task cobre o agrupamento do perfil do condutor (`#swCond`: garagem, principal condutor, jovens). | — |
| 11b | V12.3.11 | front | **Foco ao chegar** (`focoIr`/`.foco-barra`/`.em-foco` no protótipo): ao clicar num item da fila do dia ou da agenda, a tela de origem rola até o item, marca com contorno amarelo e mostra uma faixa "de onde você veio" com X para sair. Transversal (Pipeline, wizard, Em negociação, Em finalização); as classes não estão no `proto.css`. Na V12.3.1 o clique só navega, como a agenda já faz. | V12.3.1, V12.3.2 |
| — | V12.3.9 | front/banco | **Cliente VIP** (botão Prêmio do `.seg-acoes`) — bloqueado pela decisão pendente nº 2; não entra na sequência. | Decisão pendente nº 2 |
| 12 | V12.3.10 | front | **Tutorial do vendedor V12**: reescrever `src/components/tutorial/tutorial-content-sales.ts` com os 10 capítulos literais do protótipo, trocar a abertura em `tutorial-persona.ts` (CoteCerto · "TUTORIAL · O DIA A DIA DO VENDEDOR"), novas páginas em `tutorial-targets.ts` (agenda, em-cotação, em-negociação, em-finalização, emissão), novas preparações (Cálculo em lista, Transmissão sub-passos 0/1/3), e ajustar os testes unitários e E2E do tutorial. | V12.3.1–V12.3.8 |

---

## Frente 4 · Integração robô V12 (planejada em 27/09/2026 — começa depois do PR da Frente 3)

Robô: `/Users/diego.gervasio/Documents/playwright` (tem `CLAUDE.md` próprio). **A conta do portal é de produção**: cada cotação é real e a sessão é única (derruba outros logados). Só rodar `tests/cotacao.spec.ts` com uma cotação por vez, em horário combinado com o usuário; **nunca** `transmissao.spec.ts` nem `npm run test` (roda a transmissão). Todo campo novo no webhook é opcional (robô e app sobem em qualquer ordem). Uma branch no robô e outra no CoteCerto.

| Ordem | Task | Robô | CoteCerto | Obs. |
|---|---|---|---|---|
| 1 | V12.4.1 Protocolo da seguradora | `confirmarTransmissao` devolve o protocolo (já capturado em `TransmissaoPage.ts:1265`); spec grava `data/transmissoes/{id}.json` também no sucesso; webhook de transmissão manda `protocolo` | migration nova da RPC `registrar_resultado_transmissao_quiver` com `p_protocolo` → `propostas.protocolo_seguradora`; telas já exibem | decidir: texto completo ("Protocolo Suhai 215575619") ou só o número |
| 2 | V12.4.2 Motivo de "Sem retorno" | array novo `semRetorno[]` fora de `cards[]` (o card sem preço hoje é descartado) | zod + "Sem retorno" com o motivo real na lista/cards | não vira linha em `cotacao_premios` |
| 3 | V12.4.3 Mapeamento ao vivo da página de prêmios | 1–2 cotações reais, só leitura, em `doc/selectors/pagina6-premios.md`; **medir o custo de tempo** de cada captura | — | autorizado pelo usuário em horário combinado |
| 4 | V12.4.4 Seção Compreensiva × Ofertas adicionais | campo `secao` pela posição do card em `Comp_Box`/`Demais_Box`; ausente se não der para decidir | filtro `.cob-filtro` só quando houver `secao` (destrava V12.3.12 e o passo reservado do tutorial) | |
| 5 | V12.4.5 Mensagens da seguradora | `mensagensRetorno[]` (sem clique se possível) | botão Mensagens da `SegAcoes` habilitado quando houver; visível para quem já vê a cotação (decisão do usuário) | |
| 6 | V12.3.7 Personalizar por seguradora | nada (usa "Recalcular esta seguradora" com a cobertura global) | persistir o ajuste por seguradora (migration + RLS) e enviar no recálculo; destrava o passo reservado do tutorial | |
| 7 | V12.4.6 Prêmios por cobertura | `premiosPorCobertura` via `PremiosCoberturas` | item na Engrenagem | ver regra de custo abaixo |
| 8 | V12.4.7 Documentos (spike) | só navegar para descobrir onde fica a cotação transmitida e se há PDF da proposta/boleto | — | sem clicar em Comprar/Efetivar |

**Regra de custo (decisão do usuário):** medir no mapeamento ao vivo quanto cada captura com clique (mensagens, prêmios por cobertura) aumenta o tempo da cotação; se o aumento for grande, não capturar; se for pequeno, capturar; e procurar primeiro um jeito de obter o dado sem clique (texto já presente no card).
**Fora:** comissão, desconto e Código Afinidade por seguradora (dado sensível; o CoteCerto tem motor de comissão e fluxo de desconto próprios).

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
